"""
KeywordService - Business operations for keywords.

This service handles all write/mutation operations for keywords,
including creating, updating, merging, and unmerging.

For query operations, use KeywordQueryService.
For aggregation/statistics, use KeywordAggregationService.

NOTE: For backward compatibility, this module re-exports all methods from
KeywordQueryService and KeywordAggregationService. New code should import
from the specific services directly.
"""

import json
import time
import traceback
from typing import Any, Dict, List, Optional

from sqlalchemy import delete, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.keyword import Keyword, KeywordStatus
from app.services.keyword_aggregation import KeywordAggregationService
from app.services.keyword_query import KeywordQueryService


class KeywordService:
    """
    Service for keyword business operations.

    This class contains methods for creating, updating, and managing keywords.
    Query methods are delegated to KeywordQueryService.
    Aggregation methods are delegated to KeywordAggregationService.
    """

    # =========================================================================
    # Re-exports from KeywordQueryService (for backward compatibility)
    # =========================================================================
    get_parents_by_project = staticmethod(
        KeywordQueryService.get_parents_by_project
    )
    get_children_by_group = staticmethod(
        KeywordQueryService.get_children_by_group
    )
    find_by_ids = staticmethod(KeywordQueryService.find_by_ids)
    get_all_by_project = staticmethod(KeywordQueryService.get_all_by_project)
    get_keywords_by_status = staticmethod(
        KeywordQueryService.get_keywords_by_status
    )
    find_parent_by_group_id = staticmethod(
        KeywordQueryService.find_parent_by_group_id
    )
    find_children_by_group_id = staticmethod(
        KeywordQueryService.find_children_by_group_id
    )
    find_keywords_by_tokens = staticmethod(
        KeywordQueryService.find_keywords_by_tokens
    )
    find_keywords_by_text = staticmethod(
        KeywordQueryService.find_keywords_by_text
    )
    find_by_group_id = staticmethod(KeywordQueryService.find_by_group_id)
    find_group_by_name = staticmethod(KeywordQueryService.find_group_by_name)
    find_by_ids_and_status = staticmethod(
        KeywordQueryService.find_by_ids_and_status
    )

    # =========================================================================
    # Re-exports from KeywordAggregationService (for backward compatibility)
    # =========================================================================
    count_total_by_project = staticmethod(
        KeywordAggregationService.count_total_by_project
    )
    count_parents_by_project = staticmethod(
        KeywordAggregationService.count_parents_by_project
    )
    count_total_parents_by_project = staticmethod(
        KeywordAggregationService.count_total_parents_by_project
    )
    count_by_token = staticmethod(KeywordAggregationService.count_by_token)
    get_token_volumes = staticmethod(
        KeywordAggregationService.get_token_volumes
    )

    # =========================================================================
    # Business Operations (create, update, delete, merge)
    # =========================================================================

    @staticmethod
    async def create_many(
        db: AsyncSession, keywords_data: List[Dict[str, Any]]
    ) -> bool:
        """Create multiple keywords with upsert behavior."""
        if not keywords_data:
            return False

        values = [
            {
                "project_id": kw.get("project_id"),
                "keyword": kw.get("keyword"),
                "volume": kw.get("volume"),
                "difficulty": kw.get("difficulty"),
                "tokens": kw.get("tokens", "[]"),
                "is_parent": kw.get("is_parent", False),
                "group_id": kw.get("group_id"),
                "status": kw.get("status", KeywordStatus.ungrouped).value,
                "original_volume": kw.get("original_volume"),
                "original_state": kw.get("original_state"),
                "blocked_by": kw.get("blocked_by"),
                "serp_features": kw.get("serp_features", "[]"),
            }
            for kw in keywords_data
        ]

        stmt = (
            insert(Keyword)
            .values(values)
            .on_conflict_do_nothing(index_elements=["project_id", "keyword"])
        )
        await db.execute(stmt)
        await db.commit()

        return True

    @staticmethod
    async def delete_by_project(db: AsyncSession, project_id: int) -> None:
        """Delete all keywords for a project."""
        stmt = delete(Keyword).where(Keyword.project_id == project_id)
        await db.execute(stmt)
        await db.commit()

    @staticmethod
    async def update(
        db: AsyncSession, keyword_id: int, update_data: Dict[str, Any]
    ) -> None:
        """Update a keyword by ID."""
        await db.execute(
            update(Keyword)
            .filter(Keyword.id == keyword_id)
            .values(**update_data)
            .execution_options(synchronize_session="fetch")
        )

    @staticmethod
    async def update_status_by_ids_batched(
        db: AsyncSession,
        project_id: int,
        keyword_ids: List[int],
        update_data: Dict[str, Any],
        required_current_status: KeywordStatus,
        batch_size: int = 100,
    ) -> int:
        """
        Update keyword status by IDs using batch processing.

        Handles large ID lists efficiently by processing in batches.
        """
        if not keyword_ids:
            return 0

        total_updated = 0

        # Process in batches
        for i in range(0, len(keyword_ids), batch_size):
            batch_ids = keyword_ids[i : i + batch_size]

            stmt = text("""
                UPDATE keywords
                SET status = :new_status
                WHERE project_id = :project_id
                AND id = ANY(:batch_ids)
                AND status = :current_status
                RETURNING id
            """)

            result = await db.execute(
                stmt,
                {
                    "project_id": project_id,
                    "batch_ids": batch_ids,
                    "current_status": required_current_status.value,
                    "new_status": update_data.get("status"),
                },
            )

            batch_updated = result.rowcount
            total_updated += batch_updated

            batch_num = i // batch_size + 1
            print(
                f"Batch {batch_num}: Updated {batch_updated} "
                f"of {len(batch_ids)} keywords"
            )

        return total_updated

    @staticmethod
    async def update_status_by_token(
        db: AsyncSession,
        project_id: int,
        token: str,
        new_status: KeywordStatus,
        current_statuses: List[KeywordStatus],
        blocked_by: Optional[str] = None,
    ) -> int:
        """Update the status of keywords containing a specific token."""
        if not token:
            return 0

        status_values = [status.value for status in current_statuses]
        stmt = text("""
            WITH keywords_to_update AS (
                SELECT id FROM keywords
                WHERE project_id = :project_id
                AND status = ANY(:status_values)
                AND tokens::jsonb ? :token
            )
            UPDATE keywords
            SET status = :new_status,
                blocked_by = :blocked_by
            FROM keywords_to_update
            WHERE keywords.id = keywords_to_update.id
            RETURNING keywords.id
        """)
        result = await db.execute(
            stmt,
            {
                "project_id": project_id,
                "status_values": status_values,
                "token": token,
                "new_status": new_status.value,
                "blocked_by": blocked_by,
            },
        )

        affected_rows = result.rowcount
        return affected_rows

    @staticmethod
    async def update_group_parent(
        db: AsyncSession, project_id: int, group_id: str
    ) -> None:
        """
        Update the parent of a group after changes.

        Ensures volume is correctly summed from all children.
        """
        try:
            children_query = text("""
                SELECT id, original_volume, volume, difficulty
                FROM keywords
                WHERE project_id = :project_id
                AND group_id = :group_id
                AND is_parent = false
            """)
            children_result = await db.execute(
                children_query, {"project_id": project_id, "group_id": group_id}
            )
            children_data = children_result.mappings().all()

            if not children_data:
                print(f"No children found for group {group_id}")
                return

            total_volume = sum(child.get("volume") or 0 for child in children_data)

            parent_query = text("""
                SELECT id, volume
                FROM keywords
                WHERE project_id = :project_id
                AND group_id = :group_id
                AND is_parent = true
            """)
            parent_result = await db.execute(
                parent_query, {"project_id": project_id, "group_id": group_id}
            )
            parent_data = parent_result.mappings().first()

            if parent_data:
                parent_id = parent_data["id"]
                current_volume = parent_data["volume"] or 0

                if abs(current_volume - total_volume) > 0.01:
                    print(
                        f"Updating parent {parent_id} volume "
                        f"from {current_volume} to {total_volume}"
                    )
                    update_query = text("""
                        UPDATE keywords
                        SET volume = :volume
                        WHERE id = :id
                    """)
                    await db.execute(
                        update_query, {"id": parent_id, "volume": total_volume}
                    )
            else:
                children_sorted = sorted(
                    children_data,
                    key=lambda x: (x.get("volume") or 0, -(x.get("difficulty") or 0)),
                    reverse=True,
                )
                new_parent_id = children_sorted[0]["id"]
                parent_info_query = text("""
                    SELECT keyword
                    FROM keywords
                    WHERE id = :id
                """)
                parent_info = await db.execute(
                    parent_info_query, {"id": new_parent_id}
                )
                parent_name = parent_info.scalar_one_or_none() or "Group"

                difficulties = [
                    c.get("difficulty")
                    for c in children_data
                    if c.get("difficulty") is not None
                ]
                avg_difficulty = (
                    sum(difficulties) / len(difficulties) if difficulties else 0.0
                )

                update_queries = [
                    text("""
                        UPDATE keywords
                        SET is_parent = false
                        WHERE project_id = :project_id AND group_id = :group_id
                    """),
                    text("""
                        UPDATE keywords
                        SET
                            is_parent = true,
                            volume = :volume,
                            difficulty = :difficulty,
                            group_name = :group_name
                        WHERE id = :id
                    """),
                ]

                await db.execute(
                    update_queries[0],
                    {"project_id": project_id, "group_id": group_id},
                )
                await db.execute(
                    update_queries[1],
                    {
                        "id": new_parent_id,
                        "volume": total_volume,
                        "difficulty": round(avg_difficulty, 2),
                        "group_name": parent_name,
                    },
                )

                print(
                    f"Set keyword {new_parent_id} as new parent "
                    f"with volume {total_volume}"
                )

            await db.commit()

        except Exception as e:
            print(f"Error updating group parent: {e}")
            traceback.print_exc()
            await db.rollback()

    @staticmethod
    async def merge_matching_keywords(db: AsyncSession, project_id: int) -> int:
        """Merge keywords with exact matching tokens into groups."""
        sql = text("""
            WITH grouped_keywords AS (
                SELECT
                    tokens,
                    array_agg(id) AS keyword_ids,
                    COUNT(*) AS group_size,
                    SUM(COALESCE(volume, 0)) AS total_volume,
                    AVG(COALESCE(difficulty, 0)) AS avg_difficulty,
                    MAX(id) AS parent_id
                FROM keywords
                WHERE project_id = :project_id
                AND group_id IS NULL
                AND status = 'ungrouped'
                GROUP BY tokens
                HAVING COUNT(*) > 1
            ),
            updated_keywords AS (
                UPDATE keywords k
                SET
                    group_id = CONCAT(
                        'token_merge_', :project_id, '_', gen_random_uuid()
                    ),
                    is_parent = (k.id = gk.parent_id),
                    volume = CASE
                        WHEN k.id = gk.parent_id THEN gk.total_volume
                        ELSE k.volume
                    END,
                    difficulty = CASE
                        WHEN k.id = gk.parent_id
                        THEN ROUND(gk.avg_difficulty::numeric, 2)
                        ELSE k.difficulty
                    END,
                    group_name = (
                        SELECT keyword FROM keywords WHERE id = gk.parent_id
                    )
                FROM grouped_keywords gk
                WHERE k.project_id = :project_id
                AND k.id = ANY(gk.keyword_ids)
                RETURNING k.group_id
            )
            SELECT COUNT(DISTINCT group_id) AS group_count
            FROM updated_keywords
        """)
        result = await db.execute(sql, {"project_id": project_id})
        group_count = result.scalar_one() or 0
        return group_count

    @staticmethod
    async def unmerge_keywords(
        db: AsyncSession, project_id: int, parent_token: str
    ) -> int:
        """Ungroup keywords that were merged due to token merging."""
        stmt = text("""
            WITH affected_groups AS (
                SELECT DISTINCT group_id
                FROM keywords
                WHERE project_id = :project_id
                AND status = 'grouped'
                AND tokens ? :parent_token
                AND group_id IS NOT NULL
            )
            SELECT k.id, k.original_state
            FROM keywords k
            JOIN affected_groups ag ON k.group_id = ag.group_id
            WHERE k.project_id = :project_id
        """)
        result = await db.execute(
            stmt, {"project_id": project_id, "parent_token": parent_token}
        )
        keywords = result.fetchall()
        groups_processed = set()

        for keyword_id, original_state_json in keywords:
            try:
                if original_state_json:
                    original = json.loads(original_state_json)
                    update_data = {
                        "keyword": original.get("keyword"),
                        "volume": original.get("volume"),
                        "difficulty": original.get("difficulty"),
                        "is_parent": False,
                        "group_id": None,
                        "group_name": None,
                        "status": KeywordStatus.ungrouped.value,
                        "original_state": None,
                    }
                else:
                    update_data = {
                        "is_parent": False,
                        "group_id": None,
                        "group_name": None,
                        "status": KeywordStatus.ungrouped.value,
                    }
                await db.execute(
                    update(Keyword)
                    .where(Keyword.id == keyword_id)
                    .values(**update_data)
                )
                affected_group_id = (
                    original.get("group_id") if original_state_json else None
                )
                if affected_group_id:
                    groups_processed.add(affected_group_id)
            except Exception as e:
                print(f"Error restoring keyword ID {keyword_id}: {e}")
                continue

        return len(groups_processed)

    @staticmethod
    async def store_original_state(db: AsyncSession, keyword: Keyword) -> None:
        """Store the full original state of a keyword for later restoration."""
        if keyword.original_state:
            return

        tokens = []
        try:
            if isinstance(keyword.tokens, str):
                try:
                    tokens = json.loads(keyword.tokens)
                except json.JSONDecodeError:
                    tokens = [keyword.tokens]
            elif isinstance(keyword.tokens, list):
                tokens = keyword.tokens

            # Store complete original state with all fields
            original_data = {
                "keyword": keyword.keyword,
                "volume": (
                    keyword.original_volume
                    if keyword.original_volume is not None
                    else keyword.volume
                ),
                "original_volume": keyword.original_volume,
                "difficulty": keyword.difficulty,
                "tokens": tokens,
                "is_parent": keyword.is_parent,
                "group_id": keyword.group_id,
                "status": keyword.status,
                "group_name": keyword.group_name,
                "serp_features": keyword.serp_features,
                "timestamp": time.time(),
                "operation": "stored",
            }

            if keyword.is_parent and keyword.group_id:
                children = await KeywordQueryService.find_children_by_group_id(
                    db, keyword.group_id
                )
                original_data["child_ids"] = [child.id for child in children]

            original_state_json = json.dumps(original_data).replace("'", "''")

            stmt = text("""
                UPDATE keywords
                SET original_state = :original_state
                WHERE id = :keyword_id
            """)

            await db.execute(
                stmt, {"keyword_id": keyword.id, "original_state": original_state_json}
            )
        except Exception as e:
            print(f"Error storing original state for keyword ID {keyword.id}: {e}")
            # Fallback to storing essential fields only
            simplified_data = {
                "keyword": keyword.keyword,
                "volume": (
                    keyword.original_volume
                    if keyword.original_volume is not None
                    else keyword.volume
                ),
                "original_volume": keyword.original_volume,
                "difficulty": keyword.difficulty,
                "tokens": tokens,
                "is_parent": keyword.is_parent,
                "status": keyword.status,
                "timestamp": time.time(),
                "operation": "stored_fallback",
            }
            simplified_json = json.dumps(simplified_data).replace("'", "''")
            await db.execute(
                text("""
                    UPDATE keywords
                    SET original_state = :original_state
                    WHERE id = :keyword_id
                """),
                {"keyword_id": keyword.id, "original_state": simplified_json},
            )

    @staticmethod
    async def add_token_to_keywords(
        db: AsyncSession, project_id: int, token_name: str, keywords: List[Keyword]
    ) -> int:
        """Add a new token to the tokens array of each keyword in the list."""
        affected_count = 0

        for keyword in keywords:
            try:
                # Parse existing tokens
                if keyword.tokens is None:
                    tokens = []
                elif isinstance(keyword.tokens, str):
                    try:
                        tokens = json.loads(keyword.tokens)
                    except json.JSONDecodeError as e:
                        print(
                            f"JSON decode error for keyword {keyword.id}: {e}, "
                            "defaulting to empty list"
                        )
                        tokens = []
                elif isinstance(keyword.tokens, list):
                    tokens = keyword.tokens
                else:
                    print(
                        f"Unexpected tokens type for keyword {keyword.id}: "
                        f"{type(keyword.tokens)}"
                    )
                    tokens = []

                # Skip if token already exists
                if token_name in tokens:
                    print(
                        f"Token '{token_name}' already exists in keyword {keyword.id}"
                    )
                    continue

                # Add new token
                tokens.append(token_name)
                tokens_json = json.dumps(tokens)

                # Update database
                update_stmt = text("""
                    UPDATE keywords
                    SET tokens = :tokens
                    WHERE id = :keyword_id
                """)
                result = await db.execute(
                    update_stmt, {"tokens": tokens_json, "keyword_id": keyword.id}
                )

                if result.rowcount > 0:
                    affected_count += 1
                    print(f"Added token '{token_name}' to keyword {keyword.id}")
                else:
                    print(
                        f"Update failed for keyword {keyword.id}, no rows affected"
                    )

            except Exception as e:
                print(f"Error processing keyword {keyword.id}: {str(e)}")
                continue

        print(
            f"Total keywords processed: {len(keywords)}, "
            f"tokens added to {affected_count} keywords"
        )
        return affected_count

    @staticmethod
    async def unmerge_individual_token(
        db: AsyncSession, project_id: int, parent_token: str, child_token: str
    ) -> int:
        """
        Unmerge an individual child token from a parent token.

        Uses merge_group_id to ensure isolation between different merge operations.
        Returns count of affected keywords.
        """
        if not parent_token or not child_token:
            return 0

        try:
            affected_keywords_query = text("""
                WITH keywords_to_update AS (
                    SELECT id, tokens, keyword, merge_group_id
                    FROM keywords
                    WHERE project_id = :project_id
                    AND tokens ? :parent_token
                    AND LOWER(keyword) LIKE :child_pattern
                )
                SELECT id, tokens, merge_group_id FROM keywords_to_update
            """)

            result = await db.execute(
                affected_keywords_query,
                {
                    "project_id": project_id,
                    "parent_token": parent_token,
                    "child_pattern": f"%{child_token.lower()}%",
                },
            )

            affected_rows = result.fetchall()

            if not affected_rows:
                return 0

            affected_ids = []
            merge_group_ids = set()

            for row in affected_rows:
                keyword_id, tokens_json, merge_group_id = row
                affected_ids.append(keyword_id)
                if merge_group_id:
                    merge_group_ids.add(merge_group_id)

                tokens = (
                    json.loads(tokens_json)
                    if isinstance(tokens_json, str)
                    else tokens_json
                )
                updated_tokens = [
                    child_token if t == parent_token else t for t in tokens
                ]

                update_query = text("""
                    UPDATE keywords
                    SET tokens = :updated_tokens
                    WHERE id = :keyword_id
                """)

                await db.execute(
                    update_query,
                    {
                        "keyword_id": keyword_id,
                        "updated_tokens": json.dumps(updated_tokens),
                    },
                )

            update_relationships_query = text("""
                WITH affected_groups AS (
                    SELECT DISTINCT group_id
                    FROM keywords
                    WHERE id = ANY(:affected_ids)
                    AND group_id IS NOT NULL
                ),
                groups_to_break AS (
                    SELECT
                        k.group_id,
                        COUNT(DISTINCT k.tokens) AS distinct_token_sets
                    FROM keywords k
                    JOIN affected_groups ag ON k.group_id = ag.group_id
                    WHERE k.project_id = :project_id
                    GROUP BY k.group_id
                    HAVING COUNT(DISTINCT k.tokens) > 1
                ),
                reset_keywords AS (
                    UPDATE keywords k
                    SET
                        is_parent = FALSE,
                        group_id = NULL,
                        group_name = NULL
                    FROM groups_to_break gtb
                    WHERE k.group_id = gtb.group_id
                    RETURNING k.id
                )
                SELECT COUNT(*) FROM reset_keywords
            """)

            await db.execute(
                update_relationships_query,
                {"project_id": project_id, "affected_ids": affected_ids},
            )

            return len(affected_ids)

        except Exception as e:
            print(f"Error unmerging individual token: {e}")
            traceback.print_exc()
            raise e

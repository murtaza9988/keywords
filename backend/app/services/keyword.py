import json
import time
import traceback
from typing import List, Optional, Dict, Any, Tuple
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update, select, func, delete, and_, or_, text, Index
from sqlalchemy.orm import aliased, joinedload
from sqlalchemy.dialects.postgresql import JSONB, insert
from sqlalchemy.sql import cast
import csv
import os
import tempfile
import asyncio
from app.models.keyword import Keyword, KeywordStatus

class KeywordService:
    @staticmethod
    async def create_many(db: AsyncSession, keywords_data: List[Dict[str, Any]]) -> bool:
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
                "serp_features": kw.get("serp_features", "[]")
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
    async def count_total_by_project(db: AsyncSession, project_id: int) -> int:
        """
        Count total keywords for a project (parents + children), excluding merge-hidden rows.
        """
        query = text(
            """
            SELECT COUNT(*)
            FROM keywords
            WHERE project_id = :project_id
              AND (blocked_by IS NULL OR blocked_by != 'merge_hidden')
            """
        )
        result = await db.execute(query, {"project_id": project_id})
        return int(result.scalar_one() or 0)


    @staticmethod
    async def get_parents_by_project(
        db: AsyncSession,
        project_id: int,
        skip: int,
        limit: Optional[int],
        status: Optional[KeywordStatus] = None,
        tokens: Optional[List[str]] = None,
        include: Optional[str] = None,
        exclude: Optional[str] = None,
        minVolume: Optional[int] = None,
        maxVolume: Optional[int] = None,
        minLength: Optional[int] = None,
        maxLength: Optional[int] = None,
        minDifficulty: Optional[float] = None,
        maxDifficulty: Optional[float] = None,
        minRating: Optional[int] = None,
        maxRating: Optional[int] = None,
        sort: str = "volume",
        direction: str = "desc"
    ) -> List[Dict]:
        query_params = {"project_id": project_id}
        
        sql_parts = [
            "WITH child_counts AS (",
            "  SELECT group_id, COUNT(*) AS child_count",
            "  FROM keywords",
            "  WHERE project_id = :project_id AND is_parent = FALSE",
            "  AND (blocked_by IS NULL OR blocked_by != 'merge_hidden')",
            "  GROUP BY group_id",
            ")",
            "SELECT k.*, COALESCE(cc.child_count, 0) AS child_count",
            "FROM keywords k",
            "LEFT JOIN child_counts cc ON k.group_id = cc.group_id",
            "WHERE k.project_id = :project_id"
        ]
        
        # For grouped/confirmed keywords, handle search vs normal display differently
        if status == KeywordStatus.grouped or status == KeywordStatus.confirmed:
            if include or exclude:
                pass  # Don't filter by is_parent when searching
            else:
                # Normal case: only return parent keywords
                sql_parts.append("AND k.is_parent = TRUE")
        elif status == KeywordStatus.ungrouped:
            if include or exclude:
                # For ungrouped search: show parent keywords of groups where children match the search
                # This ensures search results show the parent instead of individual children
                sql_parts.append("""
                    AND (
                        (k.group_id IS NULL AND k.status = 'ungrouped') OR 
                        (k.is_parent = TRUE AND EXISTS (
                            SELECT 1 FROM keywords k2 
                            WHERE k2.group_id = k.group_id 
                            AND k2.status = 'ungrouped' 
                            AND k2.is_parent = FALSE
                        ))
                    )
                """)
            else:
                # For ungrouped: show all parent keywords with ungrouped status
                # This ensures we show all ungrouped parent keywords, not just those with ungrouped children
                sql_parts.append("AND k.is_parent = TRUE")
        
        if status and not (status == KeywordStatus.ungrouped and (include or exclude)):
            sql_parts.append("AND k.status = :status")
            query_params["status"] = status.value            
        if minVolume is not None:
            sql_parts.append("AND k.volume >= :min_volume")
            query_params["min_volume"] = minVolume
            
        if maxVolume is not None:
            sql_parts.append("AND k.volume <= :max_volume")
            query_params["max_volume"] = maxVolume
            
        if minLength is not None:
            sql_parts.append("AND LENGTH(k.keyword) >= :min_length")
            query_params["min_length"] = minLength
            
        if maxLength is not None:
            sql_parts.append("AND LENGTH(k.keyword) <= :max_length")
            query_params["max_length"] = maxLength
            
        if minDifficulty is not None:
            sql_parts.append("AND k.difficulty >= :min_difficulty")
            query_params["min_difficulty"] = minDifficulty
            
        if maxDifficulty is not None:
            sql_parts.append("AND k.difficulty <= :max_difficulty")
            query_params["max_difficulty"] = maxDifficulty
            
        if minRating is not None:
            sql_parts.append("AND k.rating >= :min_rating")
            query_params["min_rating"] = minRating
            
        if maxRating is not None:
            sql_parts.append("AND k.rating <= :max_rating")
            query_params["max_rating"] = maxRating
            
        if tokens and len(tokens) > 0:
            token_conditions = []
            for i, token in enumerate(tokens):
                param_name = f"token_{i}"
                token_conditions.append(f"k.tokens ? :{param_name}")
                query_params[param_name] = token
            sql_parts.append("AND " + " AND ".join(token_conditions))
        
        if include:
            if status == KeywordStatus.ungrouped:
                # For ungrouped keywords, also consider children when filtering
                sql_parts.append("""
                    AND (
                        LOWER(k.keyword) LIKE :include OR
                        EXISTS (
                            SELECT 1 FROM keywords k2 
                            WHERE k2.group_id = k.group_id 
                            AND k2.status = 'ungrouped' 
                            AND k2.is_parent = FALSE
                            AND LOWER(k2.keyword) LIKE :include
                        )
                    )
                """)
            else:
                sql_parts.append("AND LOWER(k.keyword) LIKE :include")
            query_params["include"] = f"%{include.lower()}%"
        
        if exclude:
            if status == KeywordStatus.ungrouped:
                # For ungrouped keywords, also consider children when filtering
                sql_parts.append("""
                    AND (
                        LOWER(k.keyword) NOT LIKE :exclude AND
                        NOT EXISTS (
                            SELECT 1 FROM keywords k2 
                            WHERE k2.group_id = k.group_id 
                            AND k2.status = 'ungrouped' 
                            AND k2.is_parent = FALSE
                            AND LOWER(k2.keyword) LIKE :exclude
                        )
                    )
                """)
            else:
                sql_parts.append("AND LOWER(k.keyword) NOT LIKE :exclude")
            query_params["exclude"] = f"%{exclude.lower()}%"
        
        sort_column = {
            "keyword": "k.keyword",
            "groupName": "k.keyword",
            "length": "LENGTH(k.keyword)",
            "childCount": "child_count",
            "volume": "k.volume",
            "difficulty": "k.difficulty",
            "rating": "k.rating",
        }.get(sort, "k.volume")
        
        sort_direction = "ASC" if direction == "asc" else "DESC"
        if direction == "asc":
            sql_parts.append(f"ORDER BY {sort_column} {sort_direction} NULLS LAST, k.id ASC")
        else:
            sql_parts.append(f"ORDER BY {sort_column} {sort_direction} NULLS FIRST, k.id ASC")
        
        if limit is not None and limit > 0:
            sql_parts.append("LIMIT :limit OFFSET :offset")
            query_params["limit"] = limit
            query_params["offset"] = skip
        
        sql_query = " ".join(sql_parts)
        
        try:
            stmt = text(sql_query).execution_options(timeout=30)
            result = await db.execute(stmt, query_params)
            rows = result.mappings().all()
            
            keywords_with_counts = []
            for row in rows:
                keyword_dict = {
                    "id": row["id"],
                    "project_id": row["project_id"],
                    "keyword": row["keyword"],
                    "volume": row["volume"],
                    "difficulty": row["difficulty"],
                    "rating": row["rating"],
                    "tokens": row["tokens"],
                    "is_parent": row["is_parent"],
                    "group_id": row["group_id"],
                    "group_name": row["group_name"],
                    "status": row["status"],
                    "original_volume": row["original_volume"],
                    "original_state": row["original_state"],
                    "child_count": row["child_count"],
                    "serp_features": row["serp_features"]
                }
                keywords_with_counts.append(keyword_dict)
            
            return keywords_with_counts
            
        except Exception as e:
            print(f"Error executing query: {e}")
            import traceback
            traceback.print_exc()
            return []
    @staticmethod
    async def count_parents_by_project(
        db: AsyncSession,
        project_id: int,
        status: Optional[KeywordStatus] = None,
        tokens: Optional[List[str]] = None,
        include: Optional[str] = None,
        exclude: Optional[str] = None,
        minVolume: Optional[int] = None,
        maxVolume: Optional[int] = None,
        minLength: Optional[int] = None,
        maxLength: Optional[int] = None,
        minDifficulty: Optional[float] = None,
        maxDifficulty: Optional[float] = None,
        minRating: Optional[int] = None,
        maxRating: Optional[int] = None
    ) -> int:
        """
        Optimized count query for parent keywords with efficient filtering.
        Avoids setting statement_timeout to prevent asyncpg concurrency issues.
        """
        query_params = {"project_id": project_id}
        
        sql_parts = [
            "SELECT COUNT(*)",
            "FROM keywords",
            "WHERE project_id = :project_id AND is_parent = TRUE"
        ]
        
        if status:
            sql_parts.append("AND status = :status")
            query_params["status"] = status.value
        
        if tokens and len(tokens) > 0:
            token_conditions = []
            for i, token in enumerate(tokens):
                param_name = f"token_{i}"
                token_conditions.append(f"tokens ? :{param_name}")
                query_params[param_name] = token
            
            sql_parts.append("AND " + " AND ".join(token_conditions))
        
        if include:
            sql_parts.append("AND LOWER(keyword) LIKE :include")
            query_params["include"] = f"%{include.lower()}%"
        
        if exclude:
            sql_parts.append("AND LOWER(keyword) NOT LIKE :exclude")
            query_params["exclude"] = f"%{exclude.lower()}%"
        
        if minVolume is not None:
            sql_parts.append("AND volume >= :min_volume")
            query_params["min_volume"] = minVolume
            
        if maxVolume is not None:
            sql_parts.append("AND volume <= :max_volume")
            query_params["max_volume"] = maxVolume
            
        if minLength is not None:
            sql_parts.append("AND LENGTH(keyword) >= :min_length")
            query_params["min_length"] = minLength
            
        if maxLength is not None:
            sql_parts.append("AND LENGTH(keyword) <= :max_length")
            query_params["max_length"] = maxLength
            
        if minDifficulty is not None:
            sql_parts.append("AND difficulty >= :min_difficulty")
            query_params["min_difficulty"] = minDifficulty
            
        if maxDifficulty is not None:
            sql_parts.append("AND difficulty <= :max_difficulty")
            query_params["max_difficulty"] = maxDifficulty
        
        if minRating is not None:
            sql_parts.append("AND rating >= :min_rating")
            query_params["min_rating"] = minRating
            
        if maxRating is not None:
            sql_parts.append("AND rating <= :max_rating")
            query_params["max_rating"] = maxRating
        
        sql_query = " ".join(sql_parts)
        
        try:
            stmt = text(sql_query).execution_options(timeout=10)
            result = await db.execute(stmt, query_params)
            count = result.scalar_one()
            return count or 0
            
        except Exception as e:
            print(f"Error executing count query: {e}")
            import traceback
            traceback.print_exc()
            return 0
    @staticmethod
    async def count_total_parents_by_project(
        db: AsyncSession,
        project_id: int
    ) -> int:
        """Count total parent keywords across all statuses for a project."""
        query = select(func.count(Keyword.id)).filter(
            Keyword.project_id == project_id,
            Keyword.is_parent == True
        )
        
        result = await db.execute(query.execution_options(
            timeout=10,
            statement_timeout=10000
        ))
        
        count = result.scalar_one_or_none()
        return count if count is not None else 0

    @staticmethod
    async def get_children_by_group(
        db: AsyncSession, project_id: int, group_id: str
    ) -> List[Keyword]:
        """
        Get children for a specific group, including parent as first child.
        EXCLUDES merge-hidden children (those created by token merging).
        """
        if not group_id: 
            return []

        query = text("""
            WITH parent AS (
                SELECT * FROM keywords 
                WHERE project_id = :project_id AND group_id = :group_id AND is_parent = true
                LIMIT 1
            ),
            parent_as_child AS (
                SELECT 
                    id::integer, 
                    project_id::integer, 
                    keyword::varchar, 
                    -- For grouped status: use volume from original_state if available, else original_volume
                    -- For ungrouped status: use original_volume
                    CASE 
                        WHEN status = 'grouped' AND original_state IS NOT NULL AND original_state::jsonb ? 'volume'
                        THEN (original_state::jsonb->>'volume')::numeric
                        ELSE COALESCE(original_volume, 0)
                    END::numeric as volume,
                    difficulty::numeric, 
                    tokens::varchar, 
                    false as is_parent, 
                    group_id::varchar, 
                    status::varchar, 
                    original_volume::numeric, 
                    original_state::varchar, 
                    group_name::varchar,
                    serp_features::jsonb
                FROM parent
            ),
            children AS (
                SELECT 
                    id::integer, 
                    project_id::integer, 
                    keyword::varchar, 
                    volume::numeric, 
                    difficulty::numeric, 
                    tokens::varchar, 
                    is_parent::boolean, 
                    group_id::varchar, 
                    status::varchar, 
                    original_volume::numeric, 
                    original_state::varchar, 
                    group_name::varchar,
                    serp_features::jsonb 
                FROM keywords
                WHERE project_id = :project_id 
                AND group_id = :group_id 
                AND is_parent = false
                AND (blocked_by IS NULL OR blocked_by != 'merge_hidden')  -- EXCLUDE merge-hidden children
                ORDER BY volume DESC NULLS LAST, keyword ASC
            )
            SELECT * FROM parent_as_child
            UNION ALL
            SELECT * FROM children
        """)
        
        result = await db.execute(query, {"project_id": project_id, "group_id": group_id})
        keywords = []
        
        for row in result.mappings():
            keyword = Keyword(
                id=row["id"],
                project_id=row["project_id"],
                keyword=row["keyword"],
                volume=row["volume"],
                difficulty=row["difficulty"],
                tokens=row["tokens"],
                is_parent=row["is_parent"],
                group_id=row["group_id"],
                status=row["status"],
                original_state=row["original_state"],
                original_volume=row["original_volume"],
                group_name=row.get("group_name"),
                serp_features=row.get("serp_features")
            )
            keywords.append(keyword)
                
        return keywords
    @staticmethod
    async def find_by_ids(db: AsyncSession, project_id: int, keyword_ids: List[int]) -> List[Keyword]:
        """Find keywords by IDs."""
        if not keyword_ids: 
            return []

        result = await db.execute(
            select(Keyword)
            .filter(
                Keyword.project_id == project_id,
                Keyword.id.in_(keyword_ids)
            )
            .execution_options(populate_existing=True)
        )
        return result.scalars().all()


    @staticmethod
    async def update(db: AsyncSession, keyword_id: int, update_data: Dict[str, Any]) -> None:
        """Update a keyword by ID."""
        await db.execute(
            update(Keyword)
            .filter(Keyword.id == keyword_id)
            .values(**update_data)
            .execution_options(synchronize_session="fetch")
        )

    @staticmethod
    async def update_status_by_ids_batched(
        db: AsyncSession, project_id: int, keyword_ids: List[int],
        update_data: Dict[str, Any], required_current_status: KeywordStatus,
        batch_size: int = 100
    ) -> int:
        """
        Update keyword status by IDs using batch processing for better handling of large ID lists.
        """
        if not keyword_ids:
            return 0
        
        total_updated = 0
        
        # Process in batches
        for i in range(0, len(keyword_ids), batch_size):
            batch_ids = keyword_ids[i:i+batch_size]
            
            # Use text-based SQL for more control
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
                    "new_status": update_data.get("status")
                }
            )
            
            # Count the number of updated rows in this batch
            batch_updated = result.rowcount
            total_updated += batch_updated
            
            print(f"Batch {i//batch_size + 1}: Updated {batch_updated} of {len(batch_ids)} keywords")
        
        return total_updated
    @staticmethod
    async def count_by_token(
        db: AsyncSession, 
        project_id: int, 
        token: str,
        statuses: List[KeywordStatus] = [KeywordStatus.ungrouped, KeywordStatus.grouped]
    ) -> int:
        """Count keywords containing a specific token."""
        status_values = [status.value for status in statuses]
        
        # Use the GIN index for token queries
        count_query = select(func.count(Keyword.id)).filter(
            Keyword.project_id == project_id,
            Keyword.status.in_(status_values),
            Keyword.tokens.op('?')(token)
        ).execution_options(timeout=10)
        
        result = await db.execute(count_query)
        count = result.scalar_one_or_none()
        return count or 0

    @staticmethod
    async def update_status_by_token(
        db: AsyncSession,
        project_id: int,
        token: str,
        new_status: KeywordStatus,
        current_statuses: List[KeywordStatus],
        blocked_by: Optional[str] = None
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
                "status_values": status_values,  # Pass as a list, not tuple
                "token": token,
                "new_status": new_status.value,
                "blocked_by": blocked_by
            }
        )
        
        # Count the affected rows
        affected_rows = result.rowcount
        return affected_rows


    @staticmethod
    async def update_group_parent(
        db: AsyncSession, 
        project_id: int, 
        group_id: str
    ) -> None:
        """Update the parent of a group after changes to the group - ensuring volume is correctly summed."""
        try:
            children_query = text("""
                SELECT id, original_volume, volume, difficulty
                FROM keywords
                WHERE project_id = :project_id 
                AND group_id = :group_id 
                AND is_parent = false
            """)
            children_result = await db.execute(children_query, {"project_id": project_id, "group_id": group_id})
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
            parent_result = await db.execute(parent_query, {"project_id": project_id, "group_id": group_id})
            parent_data = parent_result.mappings().first()
            
            if parent_data:
                parent_id = parent_data["id"]
                current_volume = parent_data["volume"] or 0
                
                if abs(current_volume - total_volume) > 0.01:
                    print(f"Updating parent {parent_id} volume from {current_volume} to {total_volume}")
                    update_query = text("""
                        UPDATE keywords
                        SET volume = :volume
                        WHERE id = :id
                    """)
                    await db.execute(update_query, {"id": parent_id, "volume": total_volume})
            else:
                children_sorted = sorted(
                    children_data, 
                    key=lambda x: (x.get("volume") or 0, -(x.get("difficulty") or 0)), 
                    reverse=True
                )
                new_parent_id = children_sorted[0]["id"]
                parent_info_query = text("""
                    SELECT keyword
                    FROM keywords
                    WHERE id = :id
                """)
                parent_info = await db.execute(parent_info_query, {"id": new_parent_id})
                parent_name = parent_info.scalar_one_or_none() or "Group"
                
                difficulties = [c.get("difficulty") for c in children_data if c.get("difficulty") is not None]
                avg_difficulty = sum(difficulties) / len(difficulties) if difficulties else 0.0
                
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
                    """)
                ]
                
                await db.execute(update_queries[0], {"project_id": project_id, "group_id": group_id})
                await db.execute(update_queries[1], {
                    "id": new_parent_id,
                    "volume": total_volume,
                    "difficulty": round(avg_difficulty, 2),
                    "group_name": parent_name
                })
                
                print(f"Set keyword {new_parent_id} as new parent with volume {total_volume}")
            
            await db.commit()
            
        except Exception as e:
            print(f"Error updating group parent: {e}")
            import traceback
            traceback.print_exc()
            await db.rollback()
    @staticmethod
    async def get_all_by_project(db: AsyncSession, project_id: int) -> List[Keyword]:
        """Retrieve all keywords for a project efficiently."""
        query = select(Keyword).filter(
            Keyword.project_id == project_id
        ).execution_options(
            populate_existing=True,
            timeout=30  # 30 second timeout
        )
        
        result = await db.execute(query)
        return result.scalars().all() or []

    @staticmethod
    async def get_keywords_by_status(
        db: AsyncSession, 
        project_id: int,
        statuses: List[KeywordStatus] = None,
        blocked_by: Optional[str] = None
    ) -> Dict[str, List[Keyword]]:
        if not statuses:
            statuses = [KeywordStatus.ungrouped, KeywordStatus.grouped, KeywordStatus.blocked]
            
        status_values = [status.value for status in statuses]
        
        query = select(Keyword).filter(
            Keyword.project_id == project_id,
            Keyword.status.in_(status_values)
        )
        
        if blocked_by and KeywordStatus.blocked in statuses:
            query = query.filter(Keyword.blocked_by == blocked_by)
        
        query = query.execution_options(populate_existing=True, timeout=30)
        
        result = await db.execute(query)
        all_keywords = result.scalars().all()
        
        keywords_by_status = {status.value: [] for status in statuses}
        for keyword in all_keywords:
            if keyword.status in keywords_by_status:
                keywords_by_status[keyword.status].append(keyword)
                
        return keywords_by_status
   
    @staticmethod
    async def find_parent_by_group_id(db: AsyncSession, group_id: str) -> Optional[Keyword]:
        """Find the parent keyword for a specific group."""
        query = select(Keyword).where(
            and_(
                Keyword.group_id == group_id,
                Keyword.is_parent == True,
                Keyword.status == KeywordStatus.grouped.value
            )
        )
        result = await db.execute(query)
        return result.scalars().first()

    @staticmethod
    async def find_children_by_group_id(
        db: AsyncSession,
        group_id: str,
        status: Optional[str] = None,
    ) -> List[Keyword]:
        """Find all child keywords for a specific group, optionally filtering by status."""
        query = select(Keyword).where(
            and_(
                Keyword.group_id == str(group_id),
                Keyword.is_parent == False
            )
        )
        
        if status:
            query = query.filter(Keyword.status == status)
        else:
            query = query.filter(Keyword.status.in_(["grouped", "confirmed"]))
            
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def find_keywords_by_tokens(db: AsyncSession, project_id: int, tokens: List[str]) -> List[Keyword]:
        try:
            conditions = [
                Keyword.tokens.contains(func.jsonb_build_array(token))
                for token in tokens
            ]
            stmt = (
                select(Keyword)
                .where(
                    Keyword.project_id == project_id,
                    or_(*conditions)
                )
            )
            
            result = await db.execute(stmt)
            keywords = result.scalars().all()
            
            if not keywords:
                print(f"No keywords found for project_id={project_id} with tokens={tokens}")
            
            return list(keywords)
        except Exception as e:
            print(f"Error finding keywords by tokens: {str(e)}")
            print("Traceback:", traceback.format_exc())
            return []

    @staticmethod
    async def merge_matching_keywords(db: AsyncSession, project_id: int) -> int:
        """
        Merge keywords with exact matching tokens into groups.
        """
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
                    group_id = CONCAT('token_merge_', :project_id, '_', gen_random_uuid()),
                    is_parent = (k.id = gk.parent_id),
                    volume = CASE 
                        WHEN k.id = gk.parent_id THEN gk.total_volume 
                        ELSE k.volume 
                    END,
                    difficulty = CASE 
                        WHEN k.id = gk.parent_id THEN ROUND(gk.avg_difficulty::numeric, 2) 
                        ELSE k.difficulty 
                    END,
                    group_name = (SELECT keyword FROM keywords WHERE id = gk.parent_id)
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
    async def get_token_volumes(db: AsyncSession, project_id: int, tokens: List[str]) -> List[Dict[str, Any]]:
        """Helper to determine token volumes."""
        stmt = text("""
            SELECT token, SUM(volume) AS total_volume
            FROM keywords, jsonb_array_elements(tokens) AS token
            WHERE project_id = :project_id
            AND tokens ?| :tokens
            GROUP BY token
        """)
        try:
            result = await db.execute(stmt, {"project_id": project_id, "tokens": tokens})
            token_volumes = [{"tokenName": row[0], "volume": row[1] or 0} for row in result.fetchall()]
            return token_volumes
        except Exception as e:
            print(f"Error fetching token volumes: {e}")
            return [{"tokenName": t, "volume": 0} for t in tokens]
    @staticmethod
    async def unmerge_keywords(db: AsyncSession, project_id: int, parent_token: str) -> int:
        """
        Ungroup keywords that were merged due to token merging.
        """
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
            stmt,
            {"project_id": project_id, "parent_token": parent_token}
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
                        "original_state": None
                    }
                else:
                    update_data = {
                        "is_parent": False,
                        "group_id": None,
                        "group_name": None,
                        "status": KeywordStatus.ungrouped.value
                    }
                await db.execute(
                    update(Keyword)
                    .where(Keyword.id == keyword_id)
                    .values(**update_data)
                )
                affected_group_id = original.get("group_id") if original_state_json else None
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
        
        try:
            tokens = []
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
                "volume": keyword.original_volume if keyword.original_volume is not None else keyword.volume,
                "original_volume": keyword.original_volume,
                "difficulty": keyword.difficulty,
                "tokens": tokens,
                "is_parent": keyword.is_parent,
                "group_id": keyword.group_id,
                "status": keyword.status,
                "group_name": keyword.group_name,
                "serp_features": keyword.serp_features,
                "timestamp": time.time(),  # Add timestamp for debugging
                "operation": "stored"      # Track what operation created this state
            }
            
            if keyword.is_parent and keyword.group_id:
                children = await KeywordService.find_children_by_group_id(db, keyword.group_id)
                original_data["child_ids"] = [child.id for child in children]
            
            original_state_json = json.dumps(original_data).replace("'", "''")
            
            stmt = text("""
                UPDATE keywords
                SET original_state = :original_state
                WHERE id = :keyword_id
            """)
            
            await db.execute(stmt, {
                "keyword_id": keyword.id,
                "original_state": original_state_json
            })
        except Exception as e:
            print(f"Error storing original state for keyword ID {keyword.id}: {e}")
            # Fallback to storing essential fields only
            simplified_data = {
                "keyword": keyword.keyword,
                "volume": keyword.original_volume if keyword.original_volume is not None else keyword.volume,
                "original_volume": keyword.original_volume,
                "difficulty": keyword.difficulty,
                "tokens": tokens,
                "is_parent": keyword.is_parent,
                "status": keyword.status,
                "timestamp": time.time(),
                "operation": "stored_fallback"
            }
            simplified_json = json.dumps(simplified_data).replace("'", "''")
            await db.execute(
                text("""
                    UPDATE keywords
                    SET original_state = :original_state
                    WHERE id = :keyword_id
                """),
                {
                    "keyword_id": keyword.id,
                    "original_state": simplified_json
                }
            )

    @staticmethod
    async def get_keywords_by_status(db: AsyncSession, project_id: int, statuses: List[KeywordStatus] = None, blocked_by: Optional[str] = None) -> Dict[str, List[Keyword]]:
        if not statuses:
            statuses = [KeywordStatus.ungrouped, KeywordStatus.grouped, KeywordStatus.blocked]
        status_values = [status.value for status in statuses]
        query = select(Keyword).filter(Keyword.project_id == project_id, Keyword.status.in_(status_values))
        if blocked_by and KeywordStatus.blocked in statuses:
            query = query.filter(Keyword.blocked_by == blocked_by)
        result = await db.execute(query)
        all_keywords = result.scalars().all()
        return {status.value: [kw for kw in all_keywords if kw.status == status.value] for status in statuses}

    @staticmethod
    async def find_keywords_by_text(db: AsyncSession, project_id: int, search_text: str) -> List[Keyword]:
        """
        Find all keywords that contain the specified text string.
        """
        try:
            stmt = select(Keyword).where(
                Keyword.project_id == project_id,
                Keyword.keyword.ilike(f"%{search_text}%")
            )
            
            result = await db.execute(stmt)
            keywords = result.scalars().all()
            
            if not keywords:
                print(f"No keywords found for project_id={project_id} with text='{search_text}'")
            
            return list(keywords)
        except Exception as e:
            print(f"Error finding keywords by text: {str(e)}")
            print("Traceback:", traceback.format_exc())
            return []

    @staticmethod
    async def add_token_to_keywords(
        db: AsyncSession, 
        project_id: int, 
        token_name: str, 
        keywords: List[Keyword]
    ) -> int:
        """
        Add a new token to the tokens array of each keyword in the list.
        """
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
                        print(f"JSON decode error for keyword {keyword.id}: {e}, defaulting to empty list")
                        tokens = []
                elif isinstance(keyword.tokens, list):
                    tokens = keyword.tokens
                else:
                    print(f"Unexpected tokens type for keyword {keyword.id}: {type(keyword.tokens)}")
                    tokens = []

                # Skip if token already exists
                if token_name in tokens:
                    print(f"Token '{token_name}' already exists in keyword {keyword.id}")
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
                    update_stmt,
                    {"tokens": tokens_json, "keyword_id": keyword.id}
                )
                # Check if the update actually affected a row
                if result.rowcount > 0:
                    affected_count += 1
                    print(f"Added token '{token_name}' to keyword {keyword.id}")
                else:
                    print(f"Update failed for keyword {keyword.id}, no rows affected")

            except Exception as e:
                print(f"Error processing keyword {keyword.id}: {str(e)}")
                continue
        
        print(f"Total keywords processed: {len(keywords)}, tokens added to {affected_count} keywords")
        return affected_count
    @staticmethod
    async def unmerge_individual_token(
        db: AsyncSession, 
        project_id: int, 
        parent_token: str, 
        child_token: str
    ) -> int:
        """
        Unmerge an individual child token from a parent token.
        Uses merge_group_id to ensure isolation between different merge operations.
        Instead of completely removing the merged_token, this replaces instances of parent_token
        with child_token in keywords that contain the child text and belong to the same merge group.
        
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
            
            result = await db.execute(affected_keywords_query, {
                "project_id": project_id,
                "parent_token": parent_token,
                "child_pattern": f"%{child_token.lower()}%"
            })
            
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
                
                tokens = json.loads(tokens_json) if isinstance(tokens_json, str) else tokens_json
                updated_tokens = [child_token if t == parent_token else t for t in tokens]
                
                update_query = text("""
                    UPDATE keywords
                    SET tokens = :updated_tokens,
                    WHERE id = :keyword_id
                """)
                
                await db.execute(update_query, {
                    "keyword_id": keyword_id,
                    "updated_tokens": json.dumps(updated_tokens)
                })
            
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
            
            await db.execute(update_relationships_query, {
                "project_id": project_id,
                "affected_ids": affected_ids
            })
            
            return len(affected_ids)
        
        except Exception as e:
            print(f"Error unmerging individual token: {e}")
            import traceback
            traceback.print_exc()
            raise e

    @staticmethod
    async def find_by_group_id(db: AsyncSession, project_id: int, group_id: str) -> List[Keyword]:
        """Find all keywords in a specific group."""
        if not group_id:
            return []

        query = select(Keyword).filter(
            Keyword.project_id == project_id,
            Keyword.group_id == group_id
        ).execution_options(populate_existing=True)
        
        result = await db.execute(query)
        return result.scalars().all() or []

    @staticmethod
    async def find_group_by_name(db: AsyncSession, project_id: int, group_name: str) -> Optional[Keyword]:
        """Find a group by name in the project."""
        query = select(Keyword).where(
            and_(
                Keyword.project_id == project_id,
                Keyword.group_name == group_name,
                Keyword.status == KeywordStatus.grouped.value
            )
        )
        result = await db.execute(query)
        return result.scalars().first()

    @staticmethod
    async def find_by_ids_and_status(db: AsyncSession, project_id: int, keyword_ids: List[int], status: KeywordStatus) -> List[Keyword]:
        """Find keywords by IDs and status."""
        if not keyword_ids: 
            return []

        result = await db.execute(
            select(Keyword)
            .filter(
                Keyword.project_id == project_id,
                Keyword.id.in_(keyword_ids),
                Keyword.status == status.value
            )
            .execution_options(populate_existing=True)
        )
        return result.scalars().all()

    @staticmethod
    async def find_by_group_id(db: AsyncSession, project_id: int, group_id: str) -> List[Keyword]:
        """Find all keywords in a specific group."""
        if not group_id:
            return []

        query = select(Keyword).filter(
            Keyword.project_id == project_id,
            Keyword.group_id == group_id
        ).execution_options(populate_existing=True)
        
        result = await db.execute(query)
        return result.scalars().all() or []

    @staticmethod
    async def find_group_by_name(db: AsyncSession, project_id: int, group_name: str) -> Optional[Keyword]:
        """Find a group by name in the project."""
        query = select(Keyword).where(
            and_(
                Keyword.project_id == project_id,
                Keyword.group_name == group_name,
                Keyword.status == KeywordStatus.grouped.value
            )
        )
        result = await db.execute(query)
        return result.scalars().first()

    @staticmethod
    async def find_by_ids_and_status(db: AsyncSession, project_id: int, keyword_ids: List[int], status: KeywordStatus) -> List[Keyword]:
        """Find keywords by IDs and status."""
        if not keyword_ids: 
            return []

        result = await db.execute(
            select(Keyword)
            .filter(
                Keyword.project_id == project_id,
                Keyword.id.in_(keyword_ids),
                Keyword.status == status.value
            )
            .execution_options(populate_existing=True)
        )
        return result.scalars().all()

    @staticmethod
    async def update(db: AsyncSession, keyword_id: int, update_data: Dict[str, Any]) -> None:
        """Update a keyword by ID."""
        await db.execute(
            update(Keyword)
            .filter(Keyword.id == keyword_id)
            .values(**update_data)
            .execution_options(synchronize_session="fetch")
        )

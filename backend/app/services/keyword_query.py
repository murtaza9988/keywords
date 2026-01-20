"""
KeywordQueryService - Query building and filtering operations for keywords.

This service handles all read operations and query building for keywords,
including filtering, sorting, and pagination.
"""

import traceback
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.keyword import Keyword, KeywordStatus


class KeywordQueryService:
    """Service for keyword query and filter operations."""

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
        direction: str = "desc",
    ) -> List[Dict]:
        """
        Get parent keywords for a project with filtering and pagination.

        Returns a list of keyword dictionaries with child counts.
        """
        query_params: Dict[str, Any] = {"project_id": project_id}

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
            "WHERE k.project_id = :project_id",
        ]

        # Handle grouped/confirmed keywords search vs normal display
        if status == KeywordStatus.grouped or status == KeywordStatus.confirmed:
            if include or exclude:
                pass  # Don't filter by is_parent when searching
            else:
                sql_parts.append("AND k.is_parent = TRUE")
        elif status == KeywordStatus.ungrouped:
            if include or exclude:
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
                sql_parts.append("AND k.is_parent = TRUE")

        if status and not (
            status == KeywordStatus.ungrouped and (include or exclude)
        ):
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
            sql_parts.append(
                f"ORDER BY {sort_column} {sort_direction} NULLS LAST, k.id ASC"
            )
        else:
            sql_parts.append(
                f"ORDER BY {sort_column} {sort_direction} NULLS FIRST, k.id ASC"
            )

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
                    "serp_features": row["serp_features"],
                }
                keywords_with_counts.append(keyword_dict)

            return keywords_with_counts

        except Exception as e:
            print(f"Error executing query: {e}")
            traceback.print_exc()
            return []

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
                WHERE project_id = :project_id
                AND group_id = :group_id AND is_parent = true
                LIMIT 1
            ),
            parent_as_child AS (
                SELECT
                    id::integer,
                    project_id::integer,
                    keyword::varchar,
                    CASE
                        WHEN status = 'grouped'
                            AND original_state IS NOT NULL
                            AND original_state::jsonb ? 'volume'
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
                AND (blocked_by IS NULL OR blocked_by != 'merge_hidden')
                ORDER BY volume DESC NULLS LAST, keyword ASC
            )
            SELECT * FROM parent_as_child
            UNION ALL
            SELECT * FROM children
        """)

        result = await db.execute(
            query, {"project_id": project_id, "group_id": group_id}
        )
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
                serp_features=row.get("serp_features"),
            )
            keywords.append(keyword)

        return keywords

    @staticmethod
    async def find_by_ids(
        db: AsyncSession, project_id: int, keyword_ids: List[int]
    ) -> List[Keyword]:
        """Find keywords by IDs."""
        if not keyword_ids:
            return []

        result = await db.execute(
            select(Keyword)
            .filter(Keyword.project_id == project_id, Keyword.id.in_(keyword_ids))
            .execution_options(populate_existing=True)
        )
        return result.scalars().all()

    @staticmethod
    async def get_all_by_project(
        db: AsyncSession, project_id: int
    ) -> List[Keyword]:
        """Retrieve all keywords for a project efficiently."""
        query = select(Keyword).filter(
            Keyword.project_id == project_id
        ).execution_options(populate_existing=True, timeout=30)

        result = await db.execute(query)
        return result.scalars().all() or []

    @staticmethod
    async def get_keywords_by_status(
        db: AsyncSession,
        project_id: int,
        statuses: Optional[List[KeywordStatus]] = None,
        blocked_by: Optional[str] = None,
    ) -> Dict[str, List[Keyword]]:
        """Get keywords grouped by status."""
        if not statuses:
            statuses = [
                KeywordStatus.ungrouped,
                KeywordStatus.grouped,
                KeywordStatus.blocked,
            ]

        status_values = [status.value for status in statuses]

        query = select(Keyword).filter(
            Keyword.project_id == project_id, Keyword.status.in_(status_values)
        )

        if blocked_by and KeywordStatus.blocked in statuses:
            query = query.filter(Keyword.blocked_by == blocked_by)

        query = query.execution_options(populate_existing=True, timeout=30)

        result = await db.execute(query)
        all_keywords = result.scalars().all()

        keywords_by_status: Dict[str, List[Keyword]] = {
            status.value: [] for status in statuses
        }
        for keyword in all_keywords:
            if keyword.status in keywords_by_status:
                keywords_by_status[keyword.status].append(keyword)

        return keywords_by_status

    @staticmethod
    async def find_parent_by_group_id(
        db: AsyncSession, group_id: str
    ) -> Optional[Keyword]:
        """Find the parent keyword for a specific group."""
        query = select(Keyword).where(
            and_(
                Keyword.group_id == group_id,
                Keyword.is_parent.is_(True),
                Keyword.status == KeywordStatus.grouped.value,
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
        """Find all child keywords for a specific group."""
        query = select(Keyword).where(
            and_(
                Keyword.group_id == str(group_id),
                Keyword.is_parent.is_(False),
            )
        )

        if status:
            query = query.filter(Keyword.status == status)
        else:
            query = query.filter(Keyword.status.in_(["grouped", "confirmed"]))

        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def find_keywords_by_tokens(
        db: AsyncSession, project_id: int, tokens: List[str]
    ) -> List[Keyword]:
        """Find all keywords that contain any of the specified tokens."""
        try:
            conditions = [
                Keyword.tokens.contains(func.jsonb_build_array(token))
                for token in tokens
            ]
            stmt = select(Keyword).where(
                Keyword.project_id == project_id, or_(*conditions)
            )

            result = await db.execute(stmt)
            keywords = result.scalars().all()

            if not keywords:
                print(
                    f"No keywords found for project_id={project_id} "
                    f"with tokens={tokens}"
                )

            return list(keywords)
        except Exception as e:
            print(f"Error finding keywords by tokens: {str(e)}")
            print("Traceback:", traceback.format_exc())
            return []

    @staticmethod
    async def find_keywords_by_text(
        db: AsyncSession, project_id: int, search_text: str
    ) -> List[Keyword]:
        """Find all keywords that contain the specified text string."""
        try:
            stmt = select(Keyword).where(
                Keyword.project_id == project_id,
                Keyword.keyword.ilike(f"%{search_text}%"),
            )

            result = await db.execute(stmt)
            keywords = result.scalars().all()

            if not keywords:
                print(
                    f"No keywords found for project_id={project_id} "
                    f"with text='{search_text}'"
                )

            return list(keywords)
        except Exception as e:
            print(f"Error finding keywords by text: {str(e)}")
            print("Traceback:", traceback.format_exc())
            return []

    @staticmethod
    async def find_by_group_id(
        db: AsyncSession, project_id: int, group_id: str
    ) -> List[Keyword]:
        """Find all keywords in a specific group."""
        if not group_id:
            return []

        query = (
            select(Keyword)
            .filter(Keyword.project_id == project_id, Keyword.group_id == group_id)
            .execution_options(populate_existing=True)
        )

        result = await db.execute(query)
        return result.scalars().all() or []

    @staticmethod
    async def find_group_by_name(
        db: AsyncSession, project_id: int, group_name: str
    ) -> Optional[Keyword]:
        """Find a group by name in the project."""
        query = select(Keyword).where(
            and_(
                Keyword.project_id == project_id,
                Keyword.group_name == group_name,
                Keyword.status == KeywordStatus.grouped.value,
            )
        )
        result = await db.execute(query)
        return result.scalars().first()

    @staticmethod
    async def find_by_ids_and_status(
        db: AsyncSession,
        project_id: int,
        keyword_ids: List[int],
        status: KeywordStatus,
    ) -> List[Keyword]:
        """Find keywords by IDs and status."""
        if not keyword_ids:
            return []

        result = await db.execute(
            select(Keyword)
            .filter(
                Keyword.project_id == project_id,
                Keyword.id.in_(keyword_ids),
                Keyword.status == status.value,
            )
            .execution_options(populate_existing=True)
        )
        return result.scalars().all()

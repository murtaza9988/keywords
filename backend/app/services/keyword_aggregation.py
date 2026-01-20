"""
KeywordAggregationService - Statistics and metrics operations for keywords.

This service handles all aggregation, counting, and metrics operations
for keywords.
"""

import traceback
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.keyword import Keyword, KeywordStatus


class KeywordAggregationService:
    """Service for keyword aggregation and statistics operations."""

    @staticmethod
    async def count_total_by_project(db: AsyncSession, project_id: int) -> int:
        """
        Count total keywords for a project (parents + children).

        Excludes merge-hidden rows.
        """
        query = text("""
            SELECT COUNT(*)
            FROM keywords
            WHERE project_id = :project_id
              AND (blocked_by IS NULL OR blocked_by != 'merge_hidden')
        """)
        result = await db.execute(query, {"project_id": project_id})
        return int(result.scalar_one() or 0)

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
        maxRating: Optional[int] = None,
    ) -> int:
        """
        Optimized count query for parent keywords with efficient filtering.

        Avoids setting statement_timeout to prevent asyncpg concurrency issues.
        """
        query_params: Dict[str, Any] = {"project_id": project_id}

        sql_parts = [
            "SELECT COUNT(*)",
            "FROM keywords",
            "WHERE project_id = :project_id AND is_parent = TRUE",
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
            traceback.print_exc()
            return 0

    @staticmethod
    async def count_total_parents_by_project(
        db: AsyncSession, project_id: int
    ) -> int:
        """Count total parent keywords across all statuses for a project."""
        query = select(func.count(Keyword.id)).filter(
            Keyword.project_id == project_id, Keyword.is_parent.is_(True)
        )

        result = await db.execute(
            query.execution_options(timeout=10, statement_timeout=10000)
        )

        count = result.scalar_one_or_none()
        return count if count is not None else 0

    @staticmethod
    async def count_by_token(
        db: AsyncSession,
        project_id: int,
        token: str,
        statuses: Optional[List[KeywordStatus]] = None,
    ) -> int:
        """Count keywords containing a specific token."""
        if statuses is None:
            statuses = [KeywordStatus.ungrouped, KeywordStatus.grouped]

        status_values = [status.value for status in statuses]

        # Use the GIN index for token queries
        count_query = (
            select(func.count(Keyword.id))
            .filter(
                Keyword.project_id == project_id,
                Keyword.status.in_(status_values),
                Keyword.tokens.op("?")(token),
            )
            .execution_options(timeout=10)
        )

        result = await db.execute(count_query)
        count = result.scalar_one_or_none()
        return count or 0

    @staticmethod
    async def get_token_volumes(
        db: AsyncSession, project_id: int, tokens: List[str]
    ) -> List[Dict[str, Any]]:
        """Helper to determine token volumes."""
        stmt = text("""
            SELECT token, SUM(volume) AS total_volume
            FROM keywords, jsonb_array_elements(tokens) AS token
            WHERE project_id = :project_id
            AND tokens ?| :tokens
            GROUP BY token
        """)
        try:
            result = await db.execute(
                stmt, {"project_id": project_id, "tokens": tokens}
            )
            token_volumes = [
                {"tokenName": row[0], "volume": row[1] or 0}
                for row in result.fetchall()
            ]
            return token_volumes
        except Exception as e:
            print(f"Error fetching token volumes: {e}")
            return [{"tokenName": t, "volume": 0} for t in tokens]

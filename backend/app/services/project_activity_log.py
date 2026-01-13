from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import select, func, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project_activity_log import ProjectActivityLog


class ProjectActivityLogService:
    @staticmethod
    async def record_action(
        db: AsyncSession,
        project_id: int,
        username: str,
        action: str,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> ProjectActivityLog:
        log_entry = ProjectActivityLog(
            project_id=project_id,
            username=username,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details or None,
        )
        db.add(log_entry)
        await db.flush()
        return log_entry

    @staticmethod
    async def list_logs(
        db: AsyncSession,
        project_id: int,
        page: int,
        limit: int,
        sort: str,
        direction: str,
    ) -> Tuple[List[ProjectActivityLog], int]:
        sort_map = {
            "created_at": ProjectActivityLog.created_at,
            "username": ProjectActivityLog.username,
            "action": ProjectActivityLog.action,
            "entity_type": ProjectActivityLog.entity_type,
        }
        sort_column = sort_map.get(sort, ProjectActivityLog.created_at)
        order_by = desc(sort_column) if direction == "desc" else asc(sort_column)

        total_query = select(func.count()).select_from(ProjectActivityLog).where(
            ProjectActivityLog.project_id == project_id
        )
        total_result = await db.execute(total_query)
        total = total_result.scalar_one()

        logs_query = (
            select(ProjectActivityLog)
            .where(ProjectActivityLog.project_id == project_id)
            .order_by(order_by, desc(ProjectActivityLog.id))
            .offset((page - 1) * limit)
            .limit(limit)
        )
        logs_result = await db.execute(logs_query)
        logs = logs_result.scalars().all()
        return logs, total

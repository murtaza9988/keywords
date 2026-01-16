from datetime import datetime
from typing import Any, Dict, Optional, Tuple, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_log import ActivityLog


class ActivityLogService:
    @staticmethod
    async def log_activity(
        db: AsyncSession,
        project_id: int,
        action: str,
        details: Optional[Dict[str, Any]] = None,
        user: str = "admin",
    ) -> ActivityLog:
        log = ActivityLog(
            project_id=project_id,
            action=action,
            details=details,
            user=user or "admin",
        )
        db.add(log)
        await db.commit()
        await db.refresh(log)
        return log

    @staticmethod
    async def list_logs(
        db: AsyncSession,
        project_id: Optional[int] = None,
        user: Optional[str] = None,
        action: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        page: int = 1,
        limit: int = 100,
    ) -> Tuple[List[ActivityLog], int]:
        filters = []
        if project_id is not None:
            filters.append(ActivityLog.project_id == project_id)
        if user:
            filters.append(ActivityLog.user == user)
        if action:
            filters.append(ActivityLog.action == action)
        if start_date:
            filters.append(ActivityLog.created_at >= start_date)
        if end_date:
            filters.append(ActivityLog.created_at <= end_date)

        offset = (page - 1) * limit
        logs_result = await db.execute(
            select(ActivityLog)
            .where(*filters)
            .order_by(ActivityLog.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        logs = logs_result.scalars().all()

        total_result = await db.execute(
            select(func.count()).select_from(ActivityLog).where(*filters)
        )
        total = total_result.scalar_one()

        return logs, total

from typing import Any, Dict, Optional
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
        return log

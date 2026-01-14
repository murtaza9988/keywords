from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.activity_log import ActivityLog
from app.schemas.activity_log import ActivityLogResponse
from app.services.project import ProjectService
from app.utils.security import get_current_user

router = APIRouter(tags=["activity-logs"])


@router.get("/projects/{project_id}/logs", response_model=List[ActivityLogResponse])
async def get_project_logs(
    project_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[ActivityLogResponse]:
    project = await ProjectService.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    offset = (page - 1) * limit
    result = await db.execute(
        select(ActivityLog)
        .filter(ActivityLog.project_id == project_id)
        .order_by(ActivityLog.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    logs = result.scalars().all()
    return logs

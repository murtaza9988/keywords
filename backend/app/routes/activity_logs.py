from datetime import datetime
from math import ceil
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.activity_log import ActivityLogResponse, ActivityLogListResponse, ActivityLogPagination
from app.services.activity_log import ActivityLogService
from app.services.project import ProjectService
from app.utils.security import get_current_user

router = APIRouter(tags=["activity-logs"])


@router.get("/projects/{project_id}/logs", response_model=ActivityLogListResponse)
async def get_project_logs(
    project_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ActivityLogListResponse:
    project = await ProjectService.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    logs, total = await ActivityLogService.list_logs(
        db,
        project_id=project_id,
        page=page,
        limit=limit,
    )
    pages = ceil(total / limit) if total else 0
    return ActivityLogListResponse(
        logs=logs,
        pagination=ActivityLogPagination(
            total=total,
            page=page,
            limit=limit,
            pages=pages,
        ),
    )


@router.get("/logs", response_model=ActivityLogListResponse)
async def get_logs(
    project_id: Optional[int] = Query(None, alias="projectId", ge=1),
    user: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None, alias="startDate"),
    end_date: Optional[datetime] = Query(None, alias="endDate"),
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ActivityLogListResponse:
    logs, total = await ActivityLogService.list_logs(
        db,
        project_id=project_id,
        user=user,
        action=action,
        start_date=start_date,
        end_date=end_date,
        page=page,
        limit=limit,
    )
    pages = ceil(total / limit) if total else 0
    return ActivityLogListResponse(
        logs=logs,
        pagination=ActivityLogPagination(
            total=total,
            page=page,
            limit=limit,
            pages=pages,
        ),
    )

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.project_activity_log import (
    ProjectActivityLogListResponse,
    ProjectActivityLogPagination,
    ProjectActivityLogResponse,
)
from app.services.project import ProjectService
from app.services.project_activity_log import ProjectActivityLogService
from app.utils.security import get_current_user

router = APIRouter(prefix="/projects", tags=["project-logs"])


@router.get("/{project_id}/logs", response_model=ProjectActivityLogListResponse)
async def get_project_logs(
    project_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    sort: str = Query("created_at", enum=["created_at", "username", "action", "entity_type"]),
    direction: str = Query("desc", enum=["asc", "desc"]),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await ProjectService.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    logs, total = await ProjectActivityLogService.list_logs(
        db=db,
        project_id=project_id,
        page=page,
        limit=limit,
        sort=sort,
        direction=direction,
    )
    pages = max(1, (total + limit - 1) // limit)
    return ProjectActivityLogListResponse(
        logs=[ProjectActivityLogResponse.from_orm(log) for log in logs],
        pagination=ProjectActivityLogPagination(
            total=total,
            page=page,
            limit=limit,
            pages=pages,
        ),
    )

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.project import ProjectCreate, ProjectResponse
from app.services.activity_log import ActivityLogService
from app.services.project import ProjectService
from app.utils.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    """Create a new project."""
    project = await ProjectService.create(db, project_data.name)
    await ActivityLogService.log_activity(
        db,
        project_id=project.id,
        action="project.create",
        details={"name": project.name},
        user=current_user.get("username", "admin"),
    )
    return ProjectResponse.from_orm(project)


@router.get("", response_model=List[ProjectResponse])
async def get_projects(
    current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> List[ProjectResponse]:
    """Get all projects."""
    projects = await ProjectService.get_all(db)
    return [ProjectResponse.from_orm(project) for project in projects]


@router.get("/with-stats")
async def get_projects_with_stats(
    current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get all projects with their stats in a single optimized query."""
    try:
        # Get all projects
        projects = await ProjectService.get_all(db)

        if not projects:
            return {"projects": [], "stats": {}}

        # Get all project IDs
        project_ids = [project.id for project in projects]

        # Single optimized query to get stats for all projects
        # Using MySQL-compatible syntax (SUM with CASE instead of COUNT FILTER)
        stats_query = text(
            """
            SELECT
                k.project_id,
                SUM(CASE WHEN k.is_parent = 1 AND k.status = 'ungrouped'
                    THEN 1 ELSE 0 END) as ungrouped_count,
                SUM(CASE WHEN k.is_parent = 1 AND k.status = 'grouped'
                    THEN 1 ELSE 0 END) as grouped_pages,
                SUM(CASE WHEN k.is_parent = 1 AND k.status = 'confirmed'
                    THEN 1 ELSE 0 END) as confirmed_pages,
                SUM(CASE WHEN k.is_parent = 1 AND k.status = 'blocked'
                    THEN 1 ELSE 0 END) as blocked_count,
                SUM(CASE WHEN k.is_parent = 1
                    THEN 1 ELSE 0 END) as total_parent_keywords,
                SUM(CASE WHEN k.is_parent = 0 AND k.status = 'grouped'
                    AND (k.blocked_by IS NULL OR k.blocked_by != 'merge_hidden')
                    THEN 1 ELSE 0 END) as grouped_children_count,
                SUM(CASE WHEN k.is_parent = 0 AND k.status = 'confirmed'
                    AND (k.blocked_by IS NULL OR k.blocked_by != 'merge_hidden')
                    THEN 1 ELSE 0 END) as confirmed_children_count
            FROM keywords k
            WHERE k.project_id IN :project_ids
            GROUP BY k.project_id
            """
        ).bindparams(bindparam("project_ids", expanding=True))

        result = await db.execute(stats_query, {"project_ids": project_ids})
        stats_rows = result.fetchall()

        # Convert to dictionary for easy lookup
        def calc_pct(count: int, total: int) -> float:
            return round((count / total * 100) if total > 0 else 0, 2)

        stats_dict = {}
        for row in stats_rows:
            row_data = row._mapping
            ungrouped_count = int(row_data["ungrouped_count"] or 0)
            grouped_pages = int(row_data["grouped_pages"] or 0)
            confirmed_pages = int(row_data["confirmed_pages"] or 0)
            blocked_count = int(row_data["blocked_count"] or 0)
            total_parent_keywords = int(row_data["total_parent_keywords"] or 0)
            grouped_children_count = int(row_data["grouped_children_count"] or 0)
            confirmed_children_count = int(row_data["confirmed_children_count"] or 0)

            grouped_keywords_count = grouped_pages + grouped_children_count
            confirmed_keywords_count = confirmed_pages + confirmed_children_count
            total_keywords = (
                ungrouped_count
                + grouped_keywords_count
                + confirmed_keywords_count
                + blocked_count
            )

            stats_dict[row_data["project_id"]] = {
                "ungroupedCount": ungrouped_count,
                "groupedKeywordsCount": grouped_keywords_count,
                "groupedPages": grouped_pages,
                "confirmedKeywordsCount": confirmed_keywords_count,
                "confirmedPages": confirmed_pages,
                "blockedCount": blocked_count,
                "totalKeywords": total_keywords,
                "totalParentKeywords": total_parent_keywords,
                "ungroupedPercent": calc_pct(ungrouped_count, total_keywords),
                "groupedPercent": calc_pct(grouped_keywords_count, total_keywords),
                "confirmedPercent": calc_pct(confirmed_keywords_count, total_keywords),
                "blockedPercent": calc_pct(blocked_count, total_keywords),
            }

        # Add projects with their stats
        projects_with_stats = []
        for project in projects:
            project_data = ProjectResponse.from_orm(project).dict()
            project_data["stats"] = stats_dict.get(
                project.id,
                {
                    "ungroupedCount": 0,
                    "groupedKeywordsCount": 0,
                    "groupedPages": 0,
                    "confirmedKeywordsCount": 0,
                    "confirmedPages": 0,
                    "blockedCount": 0,
                    "totalKeywords": 0,
                    "totalParentKeywords": 0,
                    "ungroupedPercent": 0,
                    "groupedPercent": 0,
                    "confirmedPercent": 0,
                    "blockedPercent": 0,
                },
            )
            projects_with_stats.append(project_data)

        return {"projects": projects_with_stats}
    except Exception as e:
        logger.error(f"Error fetching project stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch project stats: {str(e)}",
        )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    """Get a project by ID."""
    project = await ProjectService.get_by_id(db, project_id)

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    return ProjectResponse.from_orm(project)


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    project_data: ProjectCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    """Update a project."""
    existing_project = await ProjectService.get_by_id(db, project_id)
    if not existing_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    previous_name = existing_project.name
    project = await ProjectService.update(db, project_id, project_data.name)

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    await ActivityLogService.log_activity(
        db,
        project_id=project_id,
        action="project.rename",
        details={"from": previous_name, "to": project.name},
        user=current_user.get("username", "admin"),
    )

    return ProjectResponse.from_orm(project)


@router.delete("/{project_id}", status_code=status.HTTP_202_ACCEPTED)
async def delete_project(
    project_id: int,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, str]:
    """Delete a project in the background."""
    project = await ProjectService.get_by_id(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    await ActivityLogService.log_activity(
        db,
        project_id=project_id,
        action="project.delete",
        details={"name": project.name},
        user=current_user.get("username", "admin"),
    )
    background_tasks.add_task(ProjectService.delete, db, project_id)
    return {"message": "Deletion in progress"}

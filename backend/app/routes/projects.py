from fastapi import APIRouter, Depends, HTTPException, status,BackgroundTasks
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.database import get_db
from app.models.project import Project
from app.models.keyword import Keyword, KeywordStatus
from app.schemas.project import ProjectCreate, ProjectResponse
from app.services.project import ProjectService
from app.services.project_activity_log import ProjectActivityLogService
from app.utils.security import get_current_user

router = APIRouter(prefix="/projects", tags=["projects"])

@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new project."""
    project = await ProjectService.create(db, project_data.name)
    await ProjectActivityLogService.record_action(
        db=db,
        project_id=project.id,
        username=current_user["username"],
        action="project_created",
        entity_type="project",
        entity_id=str(project.id),
        details={"name": project.name},
    )
    return ProjectResponse.from_orm(project)

@router.get("", response_model=List[ProjectResponse])
async def get_projects(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all projects."""
    projects = await ProjectService.get_all(db)
    return [ProjectResponse.from_orm(project) for project in projects]

@router.get("/with-stats")
async def get_projects_with_stats(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all projects with their stats in a single optimized query."""
    # Get all projects
    projects = await ProjectService.get_all(db)
    
    if not projects:
        return {"projects": [], "stats": {}}
    
    # Get all project IDs
    project_ids = [project.id for project in projects]
    
    # Single optimized query to get stats for all projects
    stats_query = text("""
        WITH project_stats AS (
            SELECT 
                project_id,
                COUNT(*) FILTER (WHERE is_parent = TRUE AND status = 'ungrouped') as ungrouped_count,
                COUNT(*) FILTER (WHERE is_parent = TRUE AND status = 'grouped') as grouped_pages,
                COUNT(*) FILTER (WHERE is_parent = TRUE AND status = 'confirmed') as confirmed_pages,
                COUNT(*) FILTER (WHERE is_parent = TRUE AND status = 'blocked') as blocked_count,
                COUNT(*) FILTER (WHERE is_parent = TRUE) as total_parent_keywords,
                -- Count children for grouped keywords
                (
                    SELECT COUNT(*) 
                    FROM keywords k2 
                    WHERE k2.project_id = keywords.project_id 
                    AND k2.status = 'grouped' 
                    AND k2.is_parent = FALSE
                    AND (k2.blocked_by IS NULL OR k2.blocked_by != 'merge_hidden')
                ) as grouped_children_count,
                -- Count children for confirmed keywords
                (
                    SELECT COUNT(*) 
                    FROM keywords k3 
                    WHERE k3.project_id = keywords.project_id 
                    AND k3.status = 'confirmed' 
                    AND k3.is_parent = FALSE
                    AND (k3.blocked_by IS NULL OR k3.blocked_by != 'merge_hidden')
                ) as confirmed_children_count
            FROM keywords 
            WHERE project_id = ANY(:project_ids)
            GROUP BY project_id
        )
        SELECT 
            project_id,
            ungrouped_count,
            grouped_pages,
            (grouped_pages + grouped_children_count) as grouped_keywords_count,
            confirmed_pages,
            (confirmed_pages + confirmed_children_count) as confirmed_keywords_count,
            blocked_count,
            total_parent_keywords,
            (ungrouped_count + grouped_pages + grouped_children_count + confirmed_pages + confirmed_children_count + blocked_count) as total_keywords
        FROM project_stats
    """)
    
    result = await db.execute(stats_query, {"project_ids": project_ids})
    stats_rows = result.fetchall()
    
    # Convert to dictionary for easy lookup
    stats_dict = {}
    for row in stats_rows:
        total_keywords = row.total_keywords or 0
        stats_dict[row.project_id] = {
            "ungroupedCount": row.ungrouped_count or 0,
            "groupedKeywordsCount": row.grouped_keywords_count or 0,
            "groupedPages": row.grouped_pages or 0,
            "confirmedKeywordsCount": row.confirmed_keywords_count or 0,
            "confirmedPages": row.confirmed_pages or 0,
            "blockedCount": row.blocked_count or 0,
            "totalKeywords": total_keywords,
            "totalParentKeywords": row.total_parent_keywords or 0,
            "ungroupedPercent": round(((row.ungrouped_count or 0) / total_keywords * 100) if total_keywords > 0 else 0, 2),
            "groupedPercent": round(((row.grouped_keywords_count or 0) / total_keywords * 100) if total_keywords > 0 else 0, 2),
            "confirmedPercent": round(((row.confirmed_keywords_count or 0) / total_keywords * 100) if total_keywords > 0 else 0, 2),
            "blockedPercent": round(((row.blocked_count or 0) / total_keywords * 100) if total_keywords > 0 else 0, 2)
        }
    
    # Add projects with their stats
    projects_with_stats = []
    for project in projects:
        project_data = ProjectResponse.from_orm(project).dict()
        project_data["stats"] = stats_dict.get(project.id, {
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
            "blockedPercent": 0
        })
        projects_with_stats.append(project_data)
    
    return {"projects": projects_with_stats}

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a project by ID."""
    project = await ProjectService.get_by_id(db, project_id)
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    return ProjectResponse.from_orm(project)

@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    project_data: ProjectCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a project."""
    existing_project = await ProjectService.get_by_id(db, project_id)
    if not existing_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    project = await ProjectService.update(db, project_id, project_data.name)
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    if existing_project.name != project.name:
        await ProjectActivityLogService.record_action(
            db=db,
            project_id=project.id,
            username=current_user["username"],
            action="project_renamed",
            entity_type="project",
            entity_id=str(project.id),
            details={"from": existing_project.name, "to": project.name},
        )
    return ProjectResponse.from_orm(project)

@router.delete("/{project_id}", status_code=status.HTTP_202_ACCEPTED)
async def delete_project(
    project_id: int,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a project in the background."""
    project = await ProjectService.get_by_id(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    await ProjectActivityLogService.record_action(
        db=db,
        project_id=project_id,
        username=current_user["username"],
        action="project_delete_requested",
        entity_type="project",
        entity_id=str(project_id),
        details={"name": project.name},
    )
    background_tasks.add_task(ProjectService.delete, db, project_id)
    return {"message": "Deletion in progress"}

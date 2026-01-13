from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.models.project import Project

class ProjectService:
    """Project service."""

    @staticmethod
    async def create(db: AsyncSession, name: str) -> Project:
        """Create a new project."""
        project = Project(name=name)
        db.add(project)
        await db.commit()
        await db.refresh(project)
        return project

    @staticmethod
    async def get_all(db: AsyncSession) -> List[Project]:
        """Get all projects with optimized query."""
        query = select(Project).order_by(Project.id.asc())
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def get_by_id(db: AsyncSession, project_id: int) -> Optional[Project]:
        """Get a project by ID with optimized fetch."""
        query = select(Project).where(Project.id == project_id)
        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def update(db: AsyncSession, project_id: int, name: str) -> Optional[Project]:
        """Update a project."""
        project = await ProjectService.get_by_id(db, project_id)
        if project:
            project.name = name
            await db.commit()
            await db.refresh(project)
        return project

    @staticmethod
    async def delete(db: AsyncSession, project_id: int) -> bool:
        """Delete a project and its associated keywords (via cascade)."""
        project = await ProjectService.get_by_id(db, project_id)
        if project:
            await db.delete(project)
            await db.commit()
            return True
        return False
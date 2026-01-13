from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.models.notes import Note
from app.models.project import Project

class NoteService:
    """Service for note-related operations."""

    @staticmethod
    async def get_by_project_id(db: AsyncSession, project_id: int) -> Optional[Note]:
        """Get note by project_id."""
        query = select(Note).where(Note.project_id == project_id)
        result = await db.execute(query)
        return result.scalars().first()

    @staticmethod
    async def create_or_update(db: AsyncSession, project_id: int, note1: Optional[str] = None, note2: Optional[str] = None) -> Note:
        """Create a new note or update existing one for a project."""
        project_query = select(Project).where(Project.id == project_id)
        project_result = await db.execute(project_query)
        project = project_result.scalars().first()
        
        if not project:
            raise ValueError(f"Project with ID {project_id} not found")
        
        note_query = select(Note).where(Note.project_id == project_id)
        note_result = await db.execute(note_query)
        note = note_result.scalars().first()
        
        if note:
            if note1 is not None:
                note.note1 = note1
            if note2 is not None:
                note.note2 = note2
            await db.commit()
            await db.refresh(note)
        else:
            note = Note(project_id=project_id, note1=note1, note2=note2)
            db.add(note)
            await db.commit()
            await db.refresh(note)
            
        return note
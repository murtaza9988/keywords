
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.database import get_db
from app.schemas.notes import NoteCreate, NoteResponse
from app.services.notes import NoteService
from app.services.activity_log import ActivityLogService
from app.utils.security import get_current_user

router = APIRouter(tags=["notes"])

@router.get("/projects/{project_id}/notes", response_model=NoteResponse)
async def get_project_notes(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> NoteResponse:
    """Get notes for a specific project."""
    note = await NoteService.get_by_project_id(db, project_id)
    
    if not note:
        current_time = datetime.now()
        return {
            "id": 0, 
            "project_id": project_id, 
            "note1": "", 
            "note2": "", 
            "created_at": current_time, 
            "updated_at": current_time
        }
    
    return NoteResponse.from_orm(note)

@router.post("/projects/{project_id}/notes", response_model=NoteResponse)
async def create_or_update_notes(
    project_id: int,
    note_data: NoteCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> NoteResponse:
    """Create or update notes for a specific project."""
    try:
        existing_note = await NoteService.get_by_project_id(db, project_id)
        note = await NoteService.create_or_update(
            db=db,
            project_id=project_id,
            note1=note_data.note1,
            note2=note_data.note2
        )
        action = "note.create" if existing_note is None else "note.update"
        updated_fields = []
        if note_data.note1 is not None:
            updated_fields.append("note1")
        if note_data.note2 is not None:
            updated_fields.append("note2")
        await ActivityLogService.log_activity(
            db,
            project_id=project_id,
            action=action,
            details={"updated_fields": updated_fields},
            user=current_user.get("username", "admin"),
        )
        return NoteResponse.from_orm(note)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred: {str(e)}"
        )

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class NoteBase(BaseModel):
    """Base schema for notes."""
    note1: Optional[str] = None
    note2: Optional[str] = None

class NoteCreate(NoteBase):
    """Schema for creating a note."""
    pass

class NoteUpdate(NoteBase):
    """Schema for updating a note."""
    pass

class NoteResponse(NoteBase):
    """Schema for note responses."""
    id: int
    project_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        from_attributes = True
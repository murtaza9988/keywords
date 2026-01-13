from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class ProjectBase(BaseModel):
    """Base project schema."""
    name: str

class ProjectCreate(ProjectBase):
    """Project creation schema."""
    pass

class ProjectResponse(ProjectBase):
    """Project response schema."""
    id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = {
        "from_attributes": True
    }
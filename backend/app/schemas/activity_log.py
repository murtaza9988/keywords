from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class ActivityLogResponse(BaseModel):
    id: int
    project_id: int = Field(..., alias="projectId")
    user: str
    action: str
    details: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(..., alias="createdAt")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,
    }

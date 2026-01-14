from datetime import datetime
from typing import Any, Dict, Optional, List

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
        "serialize_by_alias": True,
    }


class ActivityLogPagination(BaseModel):
    total: int
    page: int
    limit: int
    pages: int


class ActivityLogListResponse(BaseModel):
    logs: List[ActivityLogResponse] = Field(default_factory=list)
    pagination: ActivityLogPagination

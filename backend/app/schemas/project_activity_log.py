from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from datetime import datetime


class ProjectActivityLogResponse(BaseModel):
    id: int
    project_id: int
    username: str
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = {
        "from_attributes": True,
    }


class ProjectActivityLogPagination(BaseModel):
    total: int
    page: int
    limit: int
    pages: int


class ProjectActivityLogListResponse(BaseModel):
    logs: List[ProjectActivityLogResponse]
    pagination: ProjectActivityLogPagination

from pydantic import BaseModel
from datetime import datetime

class CSVUploadResponse(BaseModel):
    id: int
    project_id: int
    file_name: str
    storage_path: str | None = None
    uploaded_at: datetime

    class Config:
        from_attributes = True
from pydantic import BaseModel
from datetime import datetime

class CSVUploadResponse(BaseModel):
    id: int
    project_id: int
    file_name: str
    uploaded_at: datetime

    class Config:
        from_attributes = True
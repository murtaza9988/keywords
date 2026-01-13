from sqlalchemy import Column, Integer, String, ForeignKey, JSON, Index
from app.models.base import BaseModel


class ProjectActivityLog(BaseModel):
    __tablename__ = "project_activity_logs"

    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    username = Column(String(255), nullable=False)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(100), nullable=True)
    entity_id = Column(String(255), nullable=True)
    details = Column(JSON, nullable=True)

    __table_args__ = (
        Index("ix_project_activity_logs_project_id_created_at", "project_id", "created_at"),
    )

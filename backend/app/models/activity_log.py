from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import relationship

from app.database import Base


class ActivityLog(Base):
    """Activity log model."""

    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(
        Integer,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user = Column(String(255), nullable=False, default="admin")
    action = Column(String(100), nullable=False, index=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False, index=True)

    project = relationship("Project", back_populates="activity_logs")

    def __repr__(self) -> str:
        return (
            f"<ActivityLog(id={self.id}, project_id={self.project_id}, action='{self.action}')>"
        )

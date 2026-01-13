from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Note(Base):
    """Notes model for projects."""
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    note1 = Column(Text, nullable=True)
    note2 = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    
    project = relationship("Project", back_populates="notes")

    def __repr__(self):
        return f"<Note(id={self.id}, project_id={self.project_id})>"
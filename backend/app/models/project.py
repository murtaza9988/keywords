from sqlalchemy import Column, String, Integer, DateTime, func
from sqlalchemy.orm import relationship
from app.database import Base

class Project(Base):
    """Project model."""
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    keywords = relationship("Keyword", back_populates="project", cascade="all, delete-orphan")
    merge_operations = relationship("MergeOperation", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="project", cascade="all, delete-orphan")
    csv_uploads = relationship("CSVUpload", back_populates="project", cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="project", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Project(id={self.id}, name='{self.name}')>"

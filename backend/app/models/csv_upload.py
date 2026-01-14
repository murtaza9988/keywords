from sqlalchemy import Column, String, Integer, DateTime, func, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class CSVUpload(Base):
    """CSV Upload model."""
    __tablename__ = "csv_uploads"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    # Path relative to settings.UPLOAD_DIR (or absolute path if legacy).
    storage_path = Column(String(1024), nullable=True)
    uploaded_at = Column(DateTime, default=func.now(), nullable=False)
    project = relationship("Project", back_populates="csv_uploads")

    def __repr__(self):
        return (
            f"<CSVUpload(id={self.id}, project_id={self.project_id}, "
            f"file_name='{self.file_name}', storage_path='{self.storage_path}', "
            f"uploaded_at={self.uploaded_at})>"
        )
from sqlalchemy import Column, DateTime, Integer, String, func

from app.database import Base


class ProjectProcessingLease(Base):
    __tablename__ = "project_processing_leases"

    project_id = Column(Integer, primary_key=True)
    lease_owner = Column(String(length=128), nullable=False)
    lease_expires_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

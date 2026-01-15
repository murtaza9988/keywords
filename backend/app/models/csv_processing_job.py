import enum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped

from app.database import Base


class CsvProcessingJobStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"


class CsvProcessingJob(Base):
    __tablename__ = "csv_processing_jobs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    csv_upload_id = Column(Integer, ForeignKey("csv_uploads.id", ondelete="SET NULL"), nullable=True)
    storage_path = Column(String(length=1024), nullable=True)
    source_filename = Column(String(length=512), nullable=True)
    status: Mapped[CsvProcessingJobStatus] = Column(
        Enum(CsvProcessingJobStatus, name="csv_processing_job_status", native_enum=True),
        default=CsvProcessingJobStatus.queued,
        nullable=False,
    )
    idempotency_key = Column(String(length=128), unique=True, nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)

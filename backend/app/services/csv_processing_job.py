from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, Optional

from sqlalchemy import and_, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.csv_processing_job import CsvProcessingJob, CsvProcessingJobStatus


class CsvProcessingJobService:
    @staticmethod
    async def enqueue_upload(
        db: AsyncSession,
        *,
        project_id: int,
        csv_upload_id: Optional[int],
        storage_path: Optional[str],
        source_filename: Optional[str],
        idempotency_key: str,
    ) -> tuple[CsvProcessingJob, bool]:
        stmt = (
            insert(CsvProcessingJob)
            .values(
                project_id=project_id,
                csv_upload_id=csv_upload_id,
                storage_path=storage_path,
                source_filename=source_filename,
                idempotency_key=idempotency_key,
                status=CsvProcessingJobStatus.queued,
            )
            .on_conflict_do_nothing(index_elements=["idempotency_key"])
            .returning(CsvProcessingJob.id)
        )
        result = await db.execute(stmt)
        job_id = result.scalar_one_or_none()
        if job_id is None:
            existing = await db.execute(
                select(CsvProcessingJob).where(CsvProcessingJob.idempotency_key == idempotency_key)
            )
            return existing.scalar_one(), False
        await db.commit()
        created = await db.execute(select(CsvProcessingJob).where(CsvProcessingJob.id == job_id))
        return created.scalar_one(), True

    @staticmethod
    async def has_pending_jobs(db: AsyncSession, project_id: int) -> bool:
        result = await db.execute(
            select(func.count())
            .select_from(CsvProcessingJob)
            .where(
                and_(
                    CsvProcessingJob.project_id == project_id,
                    CsvProcessingJob.status.in_(
                        [CsvProcessingJobStatus.queued, CsvProcessingJobStatus.running]
                    ),
                )
            )
        )
        return int(result.scalar_one() or 0) > 0

    @staticmethod
    async def has_queued_jobs(db: AsyncSession, project_id: int) -> bool:
        result = await db.execute(
            select(func.count())
            .select_from(CsvProcessingJob)
            .where(
                and_(
                    CsvProcessingJob.project_id == project_id,
                    CsvProcessingJob.status == CsvProcessingJobStatus.queued,
                )
            )
        )
        return int(result.scalar_one() or 0) > 0

    @staticmethod
    async def claim_next_job(db: AsyncSession, project_id: int) -> Optional[CsvProcessingJob]:
        result = await db.execute(
            select(CsvProcessingJob)
            .where(
                and_(
                    CsvProcessingJob.project_id == project_id,
                    CsvProcessingJob.status == CsvProcessingJobStatus.queued,
                )
            )
            .order_by(CsvProcessingJob.created_at.asc())
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        job = result.scalar_one_or_none()
        if not job:
            return None
        now = datetime.now(timezone.utc)
        await db.execute(
            update(CsvProcessingJob)
            .where(CsvProcessingJob.id == job.id)
            .values(status=CsvProcessingJobStatus.running, started_at=now)
        )
        await db.commit()
        return job

    @staticmethod
    async def mark_succeeded(db: AsyncSession, job_id: int) -> None:
        now = datetime.now(timezone.utc)
        await db.execute(
            update(CsvProcessingJob)
            .where(CsvProcessingJob.id == job_id)
            .values(
                status=CsvProcessingJobStatus.succeeded,
                finished_at=now,
                error=None,
            )
        )
        await db.commit()

    @staticmethod
    async def mark_failed(db: AsyncSession, job_id: int, error: str) -> None:
        now = datetime.now(timezone.utc)
        await db.execute(
            update(CsvProcessingJob)
            .where(CsvProcessingJob.id == job_id)
            .values(
                status=CsvProcessingJobStatus.failed,
                finished_at=now,
                error=error,
            )
        )
        await db.commit()

    @staticmethod
    async def counts_by_status(db: AsyncSession, project_id: int) -> dict[str, int]:
        result = await db.execute(
            select(CsvProcessingJob.status, func.count())
            .where(CsvProcessingJob.project_id == project_id)
            .group_by(CsvProcessingJob.status)
        )
        counts = {status.value: count for status, count in result.all()}
        return {
            "queued": counts.get("queued", 0),
            "running": counts.get("running", 0),
            "succeeded": counts.get("succeeded", 0),
            "failed": counts.get("failed", 0),
        }

    @staticmethod
    async def get_running_job(
        db: AsyncSession,
        project_id: int,
    ) -> Optional[CsvProcessingJob]:
        result = await db.execute(
            select(CsvProcessingJob)
            .where(
                and_(
                    CsvProcessingJob.project_id == project_id,
                    CsvProcessingJob.status == CsvProcessingJobStatus.running,
                )
            )
            .order_by(CsvProcessingJob.started_at.desc(), CsvProcessingJob.created_at.asc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def list_file_names_by_status(
        db: AsyncSession,
        project_id: int,
        statuses: Iterable[CsvProcessingJobStatus],
    ) -> list[str]:
        result = await db.execute(
            select(CsvProcessingJob.source_filename, CsvProcessingJob.storage_path)
            .where(
                and_(
                    CsvProcessingJob.project_id == project_id,
                    CsvProcessingJob.status.in_(list(statuses)),
                )
            )
            .order_by(CsvProcessingJob.created_at.asc())
        )
        names: list[str] = []
        for source_filename, storage_path in result.all():
            candidate = source_filename or storage_path
            if candidate:
                names.append(candidate)
        return names

    @staticmethod
    async def list_failed_jobs(db: AsyncSession, project_id: int) -> list[dict[str, str]]:
        result = await db.execute(
            select(
                CsvProcessingJob.source_filename,
                CsvProcessingJob.storage_path,
                CsvProcessingJob.error,
            )
            .where(
                and_(
                    CsvProcessingJob.project_id == project_id,
                    CsvProcessingJob.status == CsvProcessingJobStatus.failed,
                )
            )
            .order_by(CsvProcessingJob.finished_at.asc())
        )
        failures: list[dict[str, str]] = []
        for source_filename, storage_path, error in result.all():
            candidate = source_filename or storage_path
            if candidate:
                failures.append(
                    {
                        "file_name": candidate,
                        "message": error or "Processing failed.",
                    }
                )
        return failures

    @staticmethod
    async def recovery_sweep(db: AsyncSession, project_id: int, *, max_attempts: int) -> int:
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(CsvProcessingJob)
            .where(
                and_(
                    CsvProcessingJob.project_id == project_id,
                    CsvProcessingJob.status == CsvProcessingJobStatus.running,
                )
            )
        )
        jobs = result.scalars().all()
        reset_count = 0
        for job in jobs:
            attempts = (job.attempts or 0) + 1
            if attempts > max_attempts:
                await db.execute(
                    update(CsvProcessingJob)
                    .where(CsvProcessingJob.id == job.id)
                    .values(
                        status=CsvProcessingJobStatus.failed,
                        attempts=attempts,
                        finished_at=now,
                        error="Lease expired; max retries exceeded.",
                    )
                )
            else:
                await db.execute(
                    update(CsvProcessingJob)
                    .where(CsvProcessingJob.id == job.id)
                    .values(
                        status=CsvProcessingJobStatus.queued,
                        attempts=attempts,
                        started_at=None,
                        finished_at=None,
                    )
                )
                reset_count += 1
        if jobs:
            await db.commit()
        return reset_count

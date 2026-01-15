from __future__ import annotations

import asyncio
import socket
import uuid
from typing import Optional, cast

from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_context
from app.services.csv_processing_job import CsvProcessingJobService
from app.services.project_processing_lease import ProjectProcessingLeaseService
from app.services.processing_queue import processing_queue_service


class ProjectCsvRunnerService:
    def __init__(self, *, lease_ttl_seconds: int = 300, max_attempts: int = 3) -> None:
        self.lease_ttl_seconds = lease_ttl_seconds
        self.max_attempts = max_attempts

    def _owner_id(self) -> str:
        return f"{socket.gethostname()}-{uuid.uuid4().hex}"

    async def kick(self, project_id: int) -> None:
        owner = self._owner_id()
        async with get_db_context() as db:
            acquired = await ProjectProcessingLeaseService.try_acquire(
                db,
                project_id=project_id,
                owner=owner,
                ttl_seconds=self.lease_ttl_seconds,
            )
        if not acquired:
            return
        asyncio.create_task(self.run(project_id, owner=owner))

    async def run(self, project_id: int, *, owner: str) -> None:
        from app.routes.keyword_processing import process_csv_file, group_remaining_ungrouped_keywords

        async with get_db_context() as db:
            await CsvProcessingJobService.recovery_sweep(
                db,
                project_id,
                max_attempts=self.max_attempts,
            )

        try:
            while True:
                async with get_db_context() as db:
                    await ProjectProcessingLeaseService.renew(
                        db,
                        project_id=project_id,
                        owner=owner,
                        ttl_seconds=self.lease_ttl_seconds,
                    )
                    job = await CsvProcessingJobService.claim_next_job(db, project_id)

                if not job:
                    break

                file_path = cast(str, job.storage_path or "")
                file_name = cast(Optional[str], job.source_filename or None)
                display_name = file_name or "CSV file"

                processing_queue_service.set_current_file(
                    project_id,
                    file_path=file_path,
                    file_name=display_name,
                )

                try:
                    await process_csv_file(
                        file_path,
                        project_id,
                        display_name,
                        run_grouping=False,
                        finalize_project=False,
                    )
                    async with get_db_context() as db:
                        await CsvProcessingJobService.mark_succeeded(db, cast(int, job.id))
                except Exception as exc:
                    async with get_db_context() as db:
                        await CsvProcessingJobService.mark_failed(db, cast(int, job.id), str(exc))
                    processing_queue_service.mark_error(
                        project_id,
                        message=f"Failed processing {file_name or 'CSV'}",
                        file_name=file_name,
                    )

            async with get_db_context() as db:
                pending = await CsvProcessingJobService.has_pending_jobs(db, project_id)
                if not pending:
                    await group_remaining_ungrouped_keywords(db, project_id)
                    processing_queue_service.mark_complete(
                        project_id,
                        message="Completed processing all queued files.",
                        file_name=None,
                        file_names=None,
                        has_more_in_queue=False,
                    )
        finally:
            async with get_db_context() as db:
                await ProjectProcessingLeaseService.release(
                    db,
                    project_id=project_id,
                    owner=owner,
                )

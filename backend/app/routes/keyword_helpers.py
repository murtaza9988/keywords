"""
Shared helper functions and utilities for keyword routes.

This module contains common utilities used across the keyword route modules:
- keyword_query_routes
- keyword_mutation_routes
- csv_routes
- keyword_export_routes
- keyword_admin_routes
"""

import glob
import hashlib
import os
import re
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.csv_upload import CSVUpload
from app.services.csv_processing_job import CsvProcessingJobService
from app.services.project_processing_lease import ProjectProcessingLeaseService


def sanitize_segment(value: str) -> str:
    """Sanitize a string segment for use in file paths."""
    return re.sub(r"[^a-zA-Z0-9._-]", "_", value)


def rel_upload_path(path: str) -> str:
    """Return path relative to UPLOAD_DIR (best effort)."""
    try:
        return os.path.relpath(path, settings.UPLOAD_DIR)
    except Exception:
        return path


def format_file_errors(file_errors: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Format file errors for API response."""
    return [
        {
            "fileName": entry.get("file_name"),
            "message": entry.get("message"),
            "stage": entry.get("stage"),
            "stageDetail": entry.get("stage_detail"),
        }
        for entry in file_errors
        if isinstance(entry, dict)
    ]


async def ensure_grouping_unlocked(db: AsyncSession, project_id: int) -> None:
    """
    Ensure that grouping operations are not locked for the project.

    Raises HTTPException with 409 status if CSV processing is in progress.
    """
    if os.getenv("TESTING") == "True":
        return
    locked = await CsvProcessingJobService.has_pending_jobs(db, project_id)
    if not locked:
        locked = await ProjectProcessingLeaseService.is_locked(db, project_id=project_id)
    if locked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "processing_locked",
                "message": (
                    "CSV processing in progress. Grouping is temporarily locked until import completes."
                ),
                "project_id": project_id,
            },
        )


def resolve_csv_upload_path(project_id: int, upload: CSVUpload) -> Optional[str]:
    """
    Resolve the stored file path for a CSVUpload.

    Supports legacy rows where storage_path is NULL by probing known patterns.
    """
    if upload.storage_path:
        candidate = (
            upload.storage_path
            if os.path.isabs(upload.storage_path)
            else os.path.join(settings.UPLOAD_DIR, upload.storage_path)
        )
        return candidate if os.path.exists(candidate) else None

    # Legacy fallback patterns:
    # 1) Combined batch file: uploads/{project_id}_combined_batch_<id>.csv
    direct = os.path.join(settings.UPLOAD_DIR, f"{project_id}_{upload.file_name}")
    if os.path.exists(direct):
        return direct

    # 2) Upload file: uploads/{project_id}_<uploadId>_<originalFilename>
    glob_candidates: List[str] = []
    glob_candidates.extend(
        glob.glob(os.path.join(settings.UPLOAD_DIR, f"{project_id}_*_{upload.file_name}"))
    )
    glob_candidates.extend(
        glob.glob(
            os.path.join(
                settings.UPLOAD_DIR, f"{project_id}_batch_*", f"{project_id}_*_{upload.file_name}"
            )
        )
    )
    if not glob_candidates:
        return None
    glob_candidates.sort(key=lambda p: os.path.getmtime(p), reverse=True)
    return glob_candidates[0]


def sha256_file(path: str) -> str:
    """Compute sha256 for a file without loading into memory."""
    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def build_idempotency_key(path: str, file_name: Optional[str]) -> str:
    """Generate a stable idempotency key that is unique per uploaded file."""
    content_hash = sha256_file(path)
    combined = f"{content_hash}:{file_name or ''}"
    return hashlib.sha256(combined.encode("utf-8")).hexdigest()

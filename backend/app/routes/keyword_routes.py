import asyncio
import time
import json
import re
import os
import uuid
import hashlib
from typing import Any, Dict, List, Optional, Tuple
from fastapi import APIRouter, Depends, Form, HTTPException, status, UploadFile, File, BackgroundTasks, Query, Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text as sql_text
from enum import Enum
from app.config import settings
from app.database import get_db, get_db_context
from app.models.csv_upload import CSVUpload
from app.schemas.csv_upload import CSVUploadResponse
from app.services.merge_token import TokenMergeService
from app.services.project import ProjectService
from app.services.keyword import KeywordService
from app.services.activity_log import ActivityLogService
from app.schemas.keyword import (
    KeywordListResponse, GroupRequest, ProcessingStatus,
    BlockTokenRequest,  UnblockRequest, KeywordResponse,
    KeywordChildrenResponse, KeywordsCacheResponse
)
from app.utils.security import get_current_user
from app.models.keyword import Keyword, KeywordStatus
from app.routes.keyword_processing import (
    enqueue_processing_file,
    start_next_processing,
)
from app.services.processing_queue import processing_queue_service
from app.utils.keyword_utils import keyword_cache
from fastapi.responses import StreamingResponse
import io
import csv
from fastapi.responses import FileResponse
import glob

router = APIRouter(tags=["keywords"])
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)


def _sanitize_segment(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]", "_", value)


def _rel_upload_path(path: str) -> str:
    """Return path relative to UPLOAD_DIR (best effort)."""
    try:
        return os.path.relpath(path, settings.UPLOAD_DIR)
    except Exception:
        return path


def _resolve_csv_upload_path(project_id: int, upload: CSVUpload) -> Optional[str]:
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


def _sha256_file(path: str) -> str:
    """Compute sha256 for a file without loading into memory."""
    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


async def _find_duplicate_csv_upload(
    db: AsyncSession,
    *,
    project_id: int,
    file_name: str,
    candidate_path: str,
) -> Optional[Tuple[int, str]]:
    """
    Detect if the uploaded CSV is identical to a previously uploaded CSV for this project.

    Returns (existing_upload_id, existing_path) if a match is found; otherwise None.
    """
    try:
        candidate_size = os.path.getsize(candidate_path)
    except Exception:
        return None

    # Only compare against recent uploads with same display filename.
    result = await db.execute(
        select(CSVUpload)
        .where(CSVUpload.project_id == project_id, CSVUpload.file_name == file_name)
        .order_by(CSVUpload.uploaded_at.desc())
        .limit(25)
    )
    # SQLAlchemy returns a synchronous ScalarResult for .scalars(), but in tests
    # we often use AsyncMock objects where .scalars() may itself be awaitable.
    scalars_result = result.scalars()
    if asyncio.iscoroutine(scalars_result):
        scalars_result = await scalars_result
    existing_uploads = scalars_result.all()
    if asyncio.iscoroutine(existing_uploads):
        existing_uploads = await existing_uploads
    if not existing_uploads:
        return None

    try:
        candidate_hash = _sha256_file(candidate_path)
    except Exception:
        return None

    for upload in existing_uploads:
        resolved = _resolve_csv_upload_path(project_id, upload)
        if not resolved:
            continue
        try:
            if os.path.getsize(resolved) != candidate_size:
                continue
            if _sha256_file(resolved) == candidate_hash:
                return upload.id, resolved
        except Exception:
            continue

    return None
@router.post("/projects/{project_id}/reset-processing", status_code=status.HTTP_200_OK)
async def reset_processing_status(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Reset stuck processing state for a project."""
    project = await ProjectService.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    cleared_info = processing_queue_service.reset_processing(project_id)
    
    await ActivityLogService.log_activity(
        db,
        project_id=project_id,
        action="reset_processing",
        details={
            "previous_status": cleared_info.get("had_status"),
            "had_queued_files": cleared_info.get("had_queue", 0),
            "had_current_file": cleared_info.get("had_current_file"),
        },
        user=current_user.get("username", "admin"),
    )
    
    return {
        "message": "Processing state reset successfully",
        "cleared": cleared_info,
    }


@router.post("/projects/{project_id}/run-grouping", status_code=status.HTTP_200_OK)
async def run_manual_grouping(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Manually trigger keyword grouping for a project.
    Use this if processing got stuck before grouping completed.
    """
    from app.routes.keyword_processing import group_remaining_ungrouped_keywords
    
    project = await ProjectService.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Count ungrouped keywords before
    count_query = sql_text("""
        SELECT COUNT(*) FROM keywords 
        WHERE project_id = :project_id AND status = 'ungrouped'
    """)
    result = await db.execute(count_query, {"project_id": project_id})
    before_count = result.scalar() or 0
    
    # Run grouping
    await group_remaining_ungrouped_keywords(db, project_id)
    
    # Count ungrouped keywords after
    result = await db.execute(count_query, {"project_id": project_id})
    after_count = result.scalar() or 0
    
    grouped_count = before_count - after_count
    
    await ActivityLogService.log_activity(
        db,
        project_id=project_id,
        action="manual_grouping",
        details={
            "ungrouped_before": before_count,
            "ungrouped_after": after_count,
            "keywords_grouped": grouped_count,
        },
        user=current_user.get("username", "admin"),
    )
    
    return {
        "message": f"Grouping complete. {grouped_count} keywords were grouped.",
        "ungrouped_before": before_count,
        "ungrouped_after": after_count,
        "keywords_grouped": grouped_count,
    }


@router.get("/projects/{project_id}/processing-status", response_model=ProcessingStatus)
async def get_processing_status(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    status = processing_queue_service.get_status(project_id)
    if status == "not_started":
        status = "idle"
    result = processing_queue_service.get_result(project_id)

    progress = max(0, min(100, result.get("progress", 0.0)))
    queue = processing_queue_service.get_queue(project_id)
    current_file = processing_queue_service.get_current_file(project_id)
    queued_files = [item.get("file_name") for item in queue] if queue else []
    uploaded_files = result.get("uploaded_files", [])
    processed_files = result.get("processed_files", [])
    file_errors = result.get("file_errors", [])
    formatted_file_errors = [
        {
            "fileName": entry.get("file_name") or entry.get("fileName"),
            "message": entry.get("message"),
            "stage": entry.get("stage"),
            "stageDetail": entry.get("stage_detail") or entry.get("stageDetail"),
        }
        for entry in file_errors
        if isinstance(entry, dict)
    ]
    uploaded_count = len(uploaded_files)
    processed_count = len(processed_files)
    validation_error = None

    if (
        status in {"complete", "idle"}
        and uploaded_count > 0
        and processed_count < uploaded_count
        and not queued_files
        and not current_file
    ):
        missing_count = uploaded_count - processed_count
        validation_error = f"{missing_count} CSV file(s) did not finish processing."
        status = "error"

    if validation_error:
        return {
            "status": "error",
            "keywordCount": result.get("processed_count", 0),
            "processedCount": result.get("processed_count", 0),
            "skippedCount": result.get("skipped_count", 0),
            "keywords": result.get("keywords", []),
            "complete": False,
            "totalRows": result.get("total_rows", 0),
            "progress": progress,
            "message": validation_error,
            "stage": result.get("stage"),
            "stageDetail": result.get("stage_detail"),
            "currentFileName": current_file.get("file_name") if current_file else None,
            "queuedFiles": queued_files,
            "queueLength": len(queued_files),
            "uploadedFiles": uploaded_files,
            "processedFiles": processed_files,
            "uploadedFileCount": uploaded_count,
            "processedFileCount": processed_count,
            "validationError": validation_error,
            "fileErrors": formatted_file_errors,
        }

    if status == "complete" and uploaded_count == processed_count:
        keyword_count = await KeywordService.count_total_by_project(db, project_id)
        return {
            "status": "complete",
            "keywordCount": keyword_count,
            "processedCount": result.get("processed_count", 0),
            "skippedCount": result.get("skipped_count", 0),
            "keywords": result.get("keywords", []),
            "complete": True,
            "totalRows": result.get("total_rows", 0),
            "progress": 100.0,
            "message": result.get("message", ""),
            "stage": result.get("stage"),
            "stageDetail": result.get("stage_detail"),
            "currentFileName": current_file.get("file_name") if current_file else None,
            "queuedFiles": queued_files,
            "queueLength": len(queued_files),
            "uploadedFiles": uploaded_files,
            "processedFiles": processed_files,
            "uploadedFileCount": uploaded_count,
            "processedFileCount": processed_count,
            "validationError": validation_error,
            "fileErrors": formatted_file_errors,
        }
    return {
        "status": status,
        "keywordCount": result.get("processed_count", 0),
        "processedCount": result.get("processed_count", 0),
        "skippedCount": result.get("skipped_count", 0),
        "keywords": result.get("keywords", []),
        "complete": result.get("complete", False),
        "totalRows": result.get("total_rows", 0),
        "progress": progress,
        "message": result.get("message", ""),
        "stage": result.get("stage"),
        "stageDetail": result.get("stage_detail"),
        "currentFileName": current_file.get("file_name") if current_file else None,
        "queuedFiles": queued_files,
        "queueLength": len(queued_files),
        "uploadedFiles": uploaded_files,
        "processedFiles": processed_files,
        "uploadedFileCount": uploaded_count,
        "processedFileCount": processed_count,
        "validationError": validation_error,
        "fileErrors": formatted_file_errors,
    }
@router.post("/projects/{project_id}/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload_keywords(
    project_id: int,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(..., alias="file"),
    chunkIndex: int = Form(None),
    totalChunks: int = Form(None),
    originalFilename: str = Form(None),
    uploadId: str = Form(None),
    batchId: str = Form(None),
    fileIndex: int = Form(None),
    totalFiles: int = Form(None),
    fileSize: int = Form(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    project = await ProjectService.get_by_id(db, project_id)
    if not project: 
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Signal upload starting - this handles all state reset logic internally
    # If there's stale/error state, it will be cleared automatically
    processing_queue_service.begin_upload(project_id)
    
    if not files:
        raise HTTPException(status_code=400, detail="No files provided for upload")

    invalid_files = [
        upload_file
        for upload_file in files
        if not upload_file.filename
        or not upload_file.filename.lower().endswith(".csv")
    ]
    if invalid_files:
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    is_chunked_upload = chunkIndex is not None and totalChunks is not None and originalFilename is not None
    safe_batch_id = _sanitize_segment(batchId) if batchId else None
    resolved_file_index = int(fileIndex) if fileIndex is not None else None
    resolved_total_files = int(totalFiles) if totalFiles is not None else None

    if len(files) > 1:
        if is_chunked_upload:
            raise HTTPException(
                status_code=400,
                detail="Chunked uploads must send a single file per request.",
            )
        if resolved_file_index is not None:
            raise HTTPException(
                status_code=400,
                detail="fileIndex is not supported when uploading multiple files in one request.",
            )
        if resolved_total_files is not None and resolved_total_files != len(files):
            raise HTTPException(
                status_code=400,
                detail="totalFiles must match the number of uploaded files.",
            )

        resolved_total_files = len(files)
        if not safe_batch_id:
            safe_batch_id = _sanitize_segment(f"multi_{uuid.uuid4().hex}")

        batch_dir = os.path.join(settings.UPLOAD_DIR, f"{project_id}_batch_{safe_batch_id}")
        os.makedirs(batch_dir, exist_ok=True)
        processable_entries = []
        duplicate_files = []

        for index, upload_file in enumerate(files):
            safe_original_filename = _sanitize_segment(upload_file.filename or "upload.csv")
            safe_upload_id = _sanitize_segment(f"{uploadId or uuid.uuid4().hex}_{index}")
            file_storage_name = f"{project_id}_{safe_upload_id}_{safe_original_filename}"
            file_path = os.path.join(batch_dir, file_storage_name)

            try:
                buffer_size = 256 * 1024
                with open(file_path, "wb") as buffer:
                    while True:
                        chunk = await upload_file.read(buffer_size)
                        if not chunk:
                            break
                        buffer.write(chunk)
                        await asyncio.sleep(0.0005)
            except Exception as e:
                if os.path.exists(file_path):
                    os.remove(file_path)
                raise HTTPException(status_code=500, detail=f"Error saving uploaded file: {str(e)}")
            finally:
                await upload_file.close()

            duplicate_info: Optional[Tuple[int, str]] = None
            if upload_file.filename:
                duplicate_info = await _find_duplicate_csv_upload(
                    db,
                    project_id=project_id,
                    file_name=upload_file.filename,
                    candidate_path=file_path,
                )

            if duplicate_info:
                duplicate_files.append(upload_file.filename)
                duplicate_size = None
                if os.path.exists(file_path):
                    try:
                        duplicate_size = os.path.getsize(file_path)
                    except Exception:
                        duplicate_size = None
                try:
                    if os.path.exists(file_path):
                        os.remove(file_path)
                except Exception:
                    pass

                await ActivityLogService.log_activity(
                    db,
                    project_id=project_id,
                    action="csv_upload_duplicate",
                    details={
                        "file_name": upload_file.filename,
                        "existing_upload_id": duplicate_info[0],
                        "chunked": False,
                        "file_size": duplicate_size,
                    },
                    user=current_user.get("username", "admin"),
                )
                await db.commit()
                continue

            csv_upload = CSVUpload(project_id=project_id, file_name=upload_file.filename)
            csv_upload.storage_path = _rel_upload_path(file_path)
            db.add(csv_upload)
            await db.commit()

            await ActivityLogService.log_activity(
                db,
                project_id=project_id,
                action="csv_upload",
                details={
                    "file_name": upload_file.filename,
                    "chunked": False,
                    "file_size": os.path.getsize(file_path) if os.path.exists(file_path) else None,
                },
                user=current_user.get("username", "admin"),
            )
            await db.commit()

            processing_queue_service.register_upload(project_id, upload_file.filename)
            processable_entries.append(
                {"file_path": file_path, "file_name": upload_file.filename}
            )

        if not processable_entries:
            processing_queue_service.set_status(project_id, "complete")
            return {
                "message": "All uploaded CSVs were duplicates and were skipped.",
                "status": "complete",
                "file_name": None,
            }

        await ActivityLogService.log_activity(
            db,
            project_id=project_id,
            action="batch_processing_queue",
            details={
                "batch_id": safe_batch_id,
                "file_count": len(processable_entries),
                "strategy": "sequential",
            },
            user=current_user.get("username", "admin"),
        )
        await db.commit()

        for entry in processable_entries:
            enqueue_processing_file(
                project_id,
                entry["file_path"],
                entry.get("file_name") or "CSV file",
            )
        await start_next_processing(project_id)

        return {
            "message": "Batch upload complete. Files queued for sequential processing.",
            "status": processing_queue_service.get_status(project_id),
            "file_name": None,
            "duplicateFiles": duplicate_files,
        }

    file = files[0]
    safe_original_filename = _sanitize_segment(originalFilename or file.filename)
    safe_upload_id = _sanitize_segment(uploadId or originalFilename or file.filename)

    if batchId and resolved_total_files is None:
        raise HTTPException(status_code=400, detail="Batch uploads require totalFiles.")
    
    if is_chunked_upload:
        chunks_dir = os.path.join(
            settings.UPLOAD_DIR,
            f"{project_id}_chunks",
            safe_batch_id or "single",
            safe_upload_id,
        )
        os.makedirs(chunks_dir, exist_ok=True)
        
        chunk_filename = f"{safe_upload_id}.part{chunkIndex}"
        chunk_path = os.path.join(chunks_dir, chunk_filename)
        
        try:
            buffer_size = 256 * 1024
            with open(chunk_path, "wb") as buffer:
                while True:
                    chunk_data = await file.read(buffer_size)
                    if not chunk_data:
                        break
                    buffer.write(chunk_data)
                    await asyncio.sleep(0.0005)
        except Exception as e:
            if os.path.exists(chunk_path):
                os.remove(chunk_path)
            raise HTTPException(status_code=500, detail=f"Error saving uploaded chunk: {str(e)}")
        finally:
            await file.close()
            
        if int(chunkIndex) < int(totalChunks) - 1:
            return {
                "message": f"Chunk {int(chunkIndex) + 1} of {totalChunks} received.",
                "status": "uploading"
            }
            
        try:
            if processing_queue_service.get_status(project_id) not in {"processing", "queued"}:
                processing_queue_service.set_status(project_id, "combining")
            file_storage_name = f"{project_id}_{safe_upload_id}_{safe_original_filename}"
            batch_dir = None
            if safe_batch_id:
                batch_dir = os.path.join(settings.UPLOAD_DIR, f"{project_id}_batch_{safe_batch_id}")
                os.makedirs(batch_dir, exist_ok=True)
            final_path = os.path.join(batch_dir or settings.UPLOAD_DIR, file_storage_name)
            
            with open(final_path, "wb") as outfile:
                for i in range(int(totalChunks)):
                    part_filename = f"{safe_upload_id}.part{i}"
                    part_path = os.path.join(chunks_dir, part_filename)
                    
                    if not os.path.exists(part_path):
                        raise HTTPException(
                            status_code=500, 
                            detail=f"Missing chunk {i+1} of {totalChunks}"
                        )
                    
                    with open(part_path, "rb") as infile:
                        while True:
                            chunk_data = infile.read(buffer_size)
                            if not chunk_data:
                                break
                            outfile.write(chunk_data)
                    
                    os.remove(part_path)
                    
            if os.path.exists(chunks_dir):
                os.rmdir(chunks_dir)
            parent_chunks_dir = os.path.dirname(chunks_dir)
            if parent_chunks_dir and os.path.exists(parent_chunks_dir) and not os.listdir(parent_chunks_dir):
                os.rmdir(parent_chunks_dir)

            # Detect duplicate uploads (same filename + identical content).
            # If duplicate, do NOT create a new CSVUpload row and do NOT enqueue processing.
            duplicate_info: Optional[Tuple[int, str]] = None
            if originalFilename:
                duplicate_info = await _find_duplicate_csv_upload(
                    db,
                    project_id=project_id,
                    file_name=originalFilename,
                    candidate_path=final_path,
                )

            if duplicate_info:
                existing_upload_id, _existing_path = duplicate_info
                try:
                    if os.path.exists(final_path):
                        os.remove(final_path)
                except Exception:
                    pass

                await ActivityLogService.log_activity(
                    db,
                    project_id=project_id,
                    action="csv_upload_duplicate",
                    details={
                        "file_name": originalFilename,
                        "existing_upload_id": existing_upload_id,
                        "chunked": True,
                        "total_chunks": int(totalChunks),
                        "file_size": fileSize,
                    },
                    user=current_user.get("username", "admin"),
                )
                await db.commit()

            else:
                csv_upload = CSVUpload(
                    project_id=project_id,
                    file_name=originalFilename,
                    storage_path=_rel_upload_path(final_path),
                )
                db.add(csv_upload)
                await db.commit()

            if not duplicate_info:
                await ActivityLogService.log_activity(
                    db,
                    project_id=project_id,
                    action="csv_upload",
                    details={
                        "file_name": originalFilename,
                        "chunked": True,
                        "total_chunks": int(totalChunks),
                        "file_size": fileSize,
                    },
                    user=current_user.get("username", "admin"),
                )
                await db.commit()

            if originalFilename and not duplicate_info:
                processing_queue_service.register_upload(project_id, originalFilename)

            if batchId and resolved_total_files:
                processing_queue_service.register_batch_upload(
                    project_id,
                    batchId,
                    resolved_total_files,
                )
                batch_info = processing_queue_service.add_batch_file(
                    project_id,
                    batchId,
                    file_name=originalFilename,
                    file_path=final_path,
                    file_index=resolved_file_index,
                    is_duplicate=bool(duplicate_info),
                )
                if len(batch_info["received"]) < batch_info["total_files"]:
                    return {
                        "message": (
                            f"Duplicate '{originalFilename}' skipped. Waiting for remaining files."
                            if duplicate_info
                            else "Batch upload in progress. Waiting for remaining files."
                        ),
                        "status": "uploading",
                        "file_name": originalFilename,
                    }
                batch_info = processing_queue_service.pop_batch(project_id, batchId) or batch_info
                file_entries = list(batch_info["files"].values())
                file_entries.sort(
                    key=lambda entry: entry.get("file_index")
                    if entry.get("file_index") is not None
                    else entry.get("file_name", "")
                )

                # Only process non-duplicate files from this batch.
                processable_entries = [e for e in file_entries if not e.get("is_duplicate")]
                if not processable_entries:
                    processing_queue_service.set_status(project_id, "complete")
                    return {
                        "message": "All uploaded CSVs were duplicates and were skipped.",
                        "status": "complete",
                        "file_name": None,
                    }

                await ActivityLogService.log_activity(
                    db,
                    project_id=project_id,
                    action="batch_processing_queue",
                    details={
                        "batch_id": batchId,
                        "file_count": len(processable_entries),
                        "strategy": "sequential",
                    },
                    user=current_user.get("username", "admin"),
                )
                await db.commit()

                # Enqueue each file separately to ensure sequential processing.
                for entry in processable_entries:
                    enqueue_processing_file(
                        project_id,
                        entry["file_path"],
                        entry.get("file_name") or "CSV file",
                    )
                await start_next_processing(project_id)

                return {
                    "message": "Batch upload complete. Files queued for sequential processing.",
                    "status": processing_queue_service.get_status(project_id),
                    "file_name": originalFilename,
                }

            if duplicate_info and originalFilename and not batchId:
                # Avoid leaving the project stuck in "uploading" when we skipped processing.
                if processing_queue_service.get_status(project_id) == "uploading":
                    processing_queue_service.set_status(project_id, "complete")
                return {
                    "message": f"'{originalFilename}' already uploaded (upload #{duplicate_info[0]}). Skipping duplicate.",
                    "status": processing_queue_service.get_status(project_id),
                    "file_name": originalFilename,
                }

            if originalFilename and not duplicate_info:
                enqueue_processing_file(project_id, final_path, originalFilename)
                await start_next_processing(project_id)
            
            return {
                "message": "Upload complete. Processing queued.",
                "status": processing_queue_service.get_status(project_id),
                "file_name": originalFilename
            }
        except Exception as e:
            if os.path.exists(chunks_dir):
                for file in os.listdir(chunks_dir):
                    os.remove(os.path.join(chunks_dir, file))
                os.rmdir(chunks_dir)
            await db.rollback()
            raise HTTPException(status_code=500, detail=f"Error combining chunks: {str(e)}")

    else:
        file_storage_name = f"{project_id}_{safe_upload_id}_{safe_original_filename}"
        batch_dir = None
        if safe_batch_id:
            batch_dir = os.path.join(settings.UPLOAD_DIR, f"{project_id}_batch_{safe_batch_id}")
            os.makedirs(batch_dir, exist_ok=True)
        file_path = os.path.join(batch_dir or settings.UPLOAD_DIR, file_storage_name)
        
        try:
            buffer_size = 256 * 1024
            with open(file_path, "wb") as buffer:
                while True:
                    chunk = await file.read(buffer_size)
                    if not chunk:
                        break
                    buffer.write(chunk)
                    await asyncio.sleep(0.0005)
        except Exception as e:
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(status_code=500, detail=f"Error saving uploaded file: {str(e)}")
        finally:
            await file.close()

        # Best-effort duplicate detection for non-chunked uploads.
        duplicate_info: Optional[Tuple[int, str]] = None
        if file.filename:
            duplicate_info = await _find_duplicate_csv_upload(
                db,
                project_id=project_id,
                file_name=file.filename,
                candidate_path=file_path,
            )

        if duplicate_info:
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception:
                pass

            await ActivityLogService.log_activity(
                db,
                project_id=project_id,
                action="csv_upload_duplicate",
                details={
                    "file_name": file.filename,
                    "existing_upload_id": duplicate_info[0],
                    "chunked": False,
                    "file_size": fileSize,
                },
                user=current_user.get("username", "admin"),
            )
            await db.commit()
        else:
            csv_upload = CSVUpload(project_id=project_id, file_name=file.filename)
            csv_upload.storage_path = _rel_upload_path(file_path)
            db.add(csv_upload)
            await db.commit()

            await ActivityLogService.log_activity(
                db,
                project_id=project_id,
                action="csv_upload",
                details={
                    "file_name": file.filename,
                    "chunked": False,
                    "file_size": fileSize,
                },
                user=current_user.get("username", "admin"),
            )
            await db.commit()

            processing_queue_service.register_upload(project_id, file.filename)

        if batchId and resolved_total_files:
            processing_queue_service.register_batch_upload(
                project_id,
                batchId,
                resolved_total_files,
            )
            batch_info = processing_queue_service.add_batch_file(
                project_id,
                batchId,
                file_name=file.filename,
                file_path=file_path,
                file_index=resolved_file_index,
                is_duplicate=bool(duplicate_info),
            )
            if len(batch_info["received"]) < batch_info["total_files"]:
                return {
                    "message": (
                        f"Duplicate '{file.filename}' skipped. Waiting for remaining files."
                        if duplicate_info
                        else "Batch upload in progress. Waiting for remaining files."
                    ),
                    "status": "uploading",
                    "file_name": file.filename,
                }
            if processing_queue_service.get_status(project_id) not in {"processing", "queued"}:
                processing_queue_service.set_status(project_id, "combining")
            batch_info = processing_queue_service.pop_batch(project_id, batchId) or batch_info
            file_entries = list(batch_info["files"].values())
            file_entries.sort(
                key=lambda entry: entry.get("file_index")
                if entry.get("file_index") is not None
                else entry.get("file_name", "")
            )
            processable_entries = [e for e in file_entries if not e.get("is_duplicate")]
            if not processable_entries:
                processing_queue_service.set_status(project_id, "complete")
                return {
                    "message": "All uploaded CSVs were duplicates and were skipped.",
                    "status": "complete",
                    "file_name": None,
                }
            # Enqueue each file separately to avoid brittle header-combine failures.
            for entry in processable_entries:
                enqueue_processing_file(
                    project_id,
                    entry["file_path"],
                    entry.get("file_name") or "CSV file",
                )
            await start_next_processing(project_id)
            return {
                "message": "Batch upload complete. Processing queued.",
                "status": processing_queue_service.get_status(project_id),
                "file_name": file.filename,
            }

        if duplicate_info:
            if processing_queue_service.get_status(project_id) == "uploading":
                processing_queue_service.set_status(project_id, "complete")
            return {
                "message": f"'{file.filename}' already uploaded (upload #{duplicate_info[0]}). Skipping duplicate.",
                "status": processing_queue_service.get_status(project_id),
                "file_name": file.filename,
            }

        enqueue_processing_file(project_id, file_path, file.filename)
        await start_next_processing(project_id)
        
        return {
            "message": "Upload complete. Processing queued.",
            "status": processing_queue_service.get_status(project_id),
            "file_name": file.filename
        }
    
@router.get("/projects/{project_id}/csv-uploads", response_model=List[CSVUploadResponse])
async def get_csv_uploads(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> List[CSVUploadResponse]:
    """Get all CSV uploads for a project."""
    project = await ProjectService.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(CSVUpload).filter_by(project_id=project_id).order_by(CSVUpload.uploaded_at.desc())
    )
    csv_uploads = result.scalars().all()
    
    return csv_uploads


@router.get(
    "/projects/{project_id}/csv-uploads/{upload_id}/download",
    response_class=FileResponse,
    status_code=status.HTTP_200_OK,
)
async def download_csv_upload(
    project_id: int,
    upload_id: int = Path(..., ge=1),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    """Download a previously uploaded (or combined) CSV for a project."""
    project = await ProjectService.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(CSVUpload).where(CSVUpload.id == upload_id, CSVUpload.project_id == project_id)
    )
    upload = result.scalar_one_or_none()
    if not upload:
        raise HTTPException(status_code=404, detail="CSV upload not found")

    resolved_path = _resolve_csv_upload_path(project_id, upload)
    if not resolved_path:
        raise HTTPException(
            status_code=404,
            detail=(
                "Uploaded CSV file is missing on the server. "
                "This can happen if it was deleted by an older version of the system."
            ),
        )

    # Best-effort: if this row is missing storage_path, backfill it.
    if not upload.storage_path:
        upload.storage_path = _rel_upload_path(resolved_path)
        db.add(upload)
        await db.commit()

    return FileResponse(
        resolved_path,
        media_type="text/csv",
        filename=upload.file_name,
    )
@router.get("/projects/{project_id}/keywords", response_model=KeywordListResponse)
async def get_keywords(
    project_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=0, le=10000),
    status: KeywordStatus = Query(KeywordStatus.ungrouped),
    tokens: Optional[List[str]] = Query(None),
    include: Optional[str] = Query(None),
    exclude: Optional[str] = Query(None),
    includeMatchType: str = Query("any", enum=["any", "all"]),
    excludeMatchType: str = Query("any", enum=["any", "all"]),
    minVolume: Optional[int] = Query(None),
    maxVolume: Optional[int] = Query(None),
    minLength: Optional[int] = Query(None),
    maxLength: Optional[int] = Query(None),
    minDifficulty: Optional[float] = Query(None),
    maxDifficulty: Optional[float] = Query(None),
    minRating: Optional[int] = Query(None),
    maxRating: Optional[int] = Query(None),
    serpFeatures: Optional[List[str]] = Query(None),
    sort: str = Query("volume", description="Sort by: keyword, length, volume, difficulty, rating, childCount"),
    direction: str = Query("desc", enum=["asc", "desc"]),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    background_tasks: BackgroundTasks = None
) -> KeywordListResponse:
    """Get keywords with optimized server-side pagination, filtering, and sorting across full records."""
    project = await ProjectService.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if any(
        [
            tokens,
            include,
            exclude,
            serpFeatures,
            minVolume is not None,
            maxVolume is not None,
            minLength is not None,
            maxLength is not None,
            minDifficulty is not None,
            maxDifficulty is not None,
            minRating is not None,
            maxRating is not None,
        ]
    ):
        await ActivityLogService.log_activity(
            db,
            project_id=project_id,
            action="search",
            details={
                "status": status.value,
                "tokens": tokens,
                "include": include,
                "exclude": exclude,
                "include_match_type": includeMatchType,
                "exclude_match_type": excludeMatchType,
                "serp_features": serpFeatures,
                "min_volume": minVolume,
                "max_volume": maxVolume,
                "min_length": minLength,
                "max_length": maxLength,
                "min_difficulty": minDifficulty,
                "max_difficulty": maxDifficulty,
                "min_rating": minRating,
                "max_rating": maxRating,
            },
            user=current_user.get("username", "admin"),
        )

    include_terms = []
    if include:
        include_terms = [term.strip().lower() for term in include.split(',') if term.strip()]
    
    exclude_terms = []
    if exclude:
        exclude_terms = [term.strip().lower() for term in exclude.split(',') if term.strip()]
    db_include_filter = None
    db_exclude_filter = None
    if include and ',' not in include:
        db_include_filter = include.strip().lower()
    
    if exclude and ',' not in exclude:
        db_exclude_filter = exclude.strip().lower()
    
    fetch_limit = None if (limit == 0 or include_terms or exclude_terms or serpFeatures) else limit
    skip = (page - 1) * limit if fetch_limit is not None else 0

    total_parents_task = asyncio.create_task(
        KeywordService.count_parents_by_project(
            db, project_id, 
            status=status, 
            tokens=tokens,
            minVolume=minVolume,
            maxVolume=maxVolume,
            minLength=minLength,
            maxLength=maxLength,
            minDifficulty=minDifficulty,
            maxDifficulty=maxDifficulty,
            minRating=minRating,
            maxRating=maxRating
        )
    )
    
    parent_keywords_data_task = asyncio.create_task(
        KeywordService.get_parents_by_project(
            db, project_id, skip=skip, limit=fetch_limit,
            status=status, tokens=tokens, 
            include=db_include_filter, 
            exclude=db_exclude_filter,
            minVolume=minVolume, maxVolume=maxVolume,
            minLength=minLength, maxLength=maxLength,
            minDifficulty=minDifficulty, maxDifficulty=maxDifficulty,
            minRating=minRating, maxRating=maxRating,
            sort=sort, direction=direction
        )
    )

    total_parents, parent_keywords_data = await asyncio.gather(total_parents_task, parent_keywords_data_task)

    filtered_keywords = []
    serp_filtered = False
    if serpFeatures and len(serpFeatures) > 0:
        serp_filtered = True
        
    if (status == KeywordStatus.grouped or status == KeywordStatus.confirmed) and (include_terms or exclude_terms or serp_filtered):
        grouped = {}
        for kw in parent_keywords_data:
            key = kw["group_id"] if kw.get("group_id") is not None else f"_noGroup_{kw['id']}"
            grouped.setdefault(key, []).append(kw)

        def matches(kw: Dict[str, Any]) -> bool:
            keyword_lower = kw["keyword"].lower()
            search_text = keyword_lower
            if kw.get("group_name"):
                search_text += " " + kw["group_name"].lower()
            inc_match = True
            if include_terms:
                if includeMatchType == "any":
                    inc_match = any(term in search_text for term in include_terms)
                else:
                    inc_match = all(term in search_text for term in include_terms)
                    
            exc_match = False
            if exclude_terms:
                if excludeMatchType == "any":
                    exc_match = any(term in search_text for term in exclude_terms)
                else:
                    exc_match = all(term in search_text for term in exclude_terms)
                   
            volume_match = True
            if minVolume is not None and (kw.get("volume") is None or kw.get("volume") < minVolume):
                volume_match = False
            if maxVolume is not None and (kw.get("volume") is None or kw.get("volume") > maxVolume):
                volume_match = False
                
            length_match = True
            if minLength is not None and (kw.get("length") is None or kw.get("length") < minLength):
                length_match = False
            if maxLength is not None and (kw.get("length") is None or kw.get("length") > maxLength):
                length_match = False
                
            difficulty_match = True
            if minDifficulty is not None and (kw.get("difficulty") is None or kw.get("difficulty") < minDifficulty):
                difficulty_match = False
            if maxDifficulty is not None and (kw.get("difficulty") is None or kw.get("difficulty") > maxDifficulty):
                difficulty_match = False
                
            rating_match = True
            if minRating is not None and (kw.get("rating") is None or kw.get("rating") < minRating):
                rating_match = False
            if maxRating is not None and (kw.get("rating") is None or kw.get("rating") > maxRating):
                rating_match = False
                
            serp_match = True
            if serpFeatures and len(serpFeatures) > 0:
                kw_serp_features = []
                try:
                    serp_data = kw.get("serp_features")
                    if isinstance(serp_data, str):
                        kw_serp_features = json.loads(serp_data)
                    elif isinstance(serp_data, list):
                        kw_serp_features = serp_data
                except Exception:
                    kw_serp_features = []
                
                serp_match = all(feature in kw_serp_features for feature in serpFeatures)
                
            return inc_match and not exc_match and volume_match and length_match and difficulty_match and rating_match and serp_match

        all_matches = []
        for group in grouped.values():
            children = [x for x in group if not x.get("is_parent")]
            matching_children = [child for child in children if matches(child)]
            if matching_children:
                all_matches.extend(matching_children)
                for child in matching_children:
                    child["matches_filter"] = True
                parent = next((x for x in group if x.get("is_parent")), None)
                if parent and parent not in all_matches:
                    parent["has_matching_children"] = True
                    all_matches.append(parent)
            else:
                parent = next((x for x in group if x.get("is_parent")), None)
                if parent and matches(parent):
                    all_matches.append(parent)
        
        total_filtered = len(all_matches)
        if limit > 0:
            start_idx = (page - 1) * limit
            end_idx = start_idx + limit
            filtered_keywords = all_matches[start_idx:end_idx] if start_idx < len(all_matches) else []
        else:
            filtered_keywords = all_matches
        total_parents = total_filtered
    else:
        for kw in parent_keywords_data:
            keyword_lower = kw["keyword"].lower()
            group_name_lower = (kw.get("group_name") or "").lower() if (status == KeywordStatus.grouped or status == KeywordStatus.confirmed) else ""
            search_text = keyword_lower
            if (status == KeywordStatus.grouped or status == KeywordStatus.confirmed) and group_name_lower:
                search_text += " " + group_name_lower
            include_match = True
            if include_terms and (len(include_terms) > 1 or db_include_filter is None):
                if includeMatchType == "any":
                    include_match = any(term in search_text for term in include_terms)
                elif includeMatchType == "all":
                    include_match = all(term in search_text for term in include_terms)

            exclude_match = False
            if exclude_terms and (len(exclude_terms) > 1 or db_exclude_filter is None):
                if excludeMatchType == "any":
                    exclude_match = any(term in search_text for term in exclude_terms)
                elif excludeMatchType == "all":
                    exclude_match = all(term in search_text for term in exclude_terms)
            
            serp_match = True
            if serpFeatures and len(serpFeatures) > 0:
                kw_serp_features = []
                try:
                    serp_data = kw.get("serp_features")
                    if isinstance(serp_data, str):
                        kw_serp_features = json.loads(serp_data)
                    elif isinstance(serp_data, list):
                        kw_serp_features = serp_data
                except Exception:
                    kw_serp_features = []
                
                serp_match = all(feature in kw_serp_features for feature in serpFeatures)

            if include_match and not exclude_match and serp_match:
                filtered_keywords.append(kw)
                
        if include_terms or exclude_terms or (serpFeatures and len(serpFeatures) > 0):
            total_parents = len(filtered_keywords)
            if limit > 0:
                start_idx = (page - 1) * limit
                end_idx = start_idx + limit
                filtered_keywords = filtered_keywords[start_idx:end_idx] if start_idx < len(filtered_keywords) else []

    for kw in filtered_keywords:
        kw["is_parent"] = True

    parent_keyword_responses = []
    for kw_data in filtered_keywords:
        try:
            response = KeywordResponse.model_validate(kw_data)
            parent_keyword_responses.append(response)
        except Exception as e:
            print(f"Error validating keyword data: {e}")
            print(f"Problematic data: {kw_data}")
            # Skip this keyword if validation fails
            continue
    pages = (total_parents + limit - 1) // limit if limit > 0 else 1
    if pages == 0:
        pages = 1

    response_data = {
        "pagination": {
            "total": total_parents,
            "page": page,
            "limit": limit,
            "pages": pages
        },
        "ungroupedKeywords": [],
        "groupedKeywords": [],
        "confirmedKeywords": [],
        "blockedKeywords": [],
    }

    if status == KeywordStatus.ungrouped:
        response_data["ungroupedKeywords"] = parent_keyword_responses
    elif status == KeywordStatus.grouped:
        response_data["groupedKeywords"] = parent_keyword_responses
    elif status == KeywordStatus.confirmed:
        response_data["confirmedKeywords"] = parent_keyword_responses
    elif status == KeywordStatus.blocked:
        response_data["blockedKeywords"] = parent_keyword_responses
    
    return response_data

@router.get("/projects/{project_id}/initial-data")
async def get_project_initial_data(
    project_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(250, ge=0, le=1000),
    status: KeywordStatus = Query(KeywordStatus.ungrouped),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get initial data for a project including first page of data and stats."""
    project = await ProjectService.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    stats_query = text("""
        WITH project_stats AS (
            SELECT 
                project_id,
                COUNT(*) FILTER (WHERE is_parent = TRUE AND status = 'ungrouped') as ungrouped_count,
                COUNT(*) FILTER (WHERE is_parent = TRUE AND status = 'grouped') as grouped_pages,
                COUNT(*) FILTER (WHERE is_parent = TRUE AND status = 'confirmed') as confirmed_pages,
                COUNT(*) FILTER (WHERE is_parent = TRUE AND status = 'blocked') as blocked_count,
                COUNT(*) FILTER (WHERE is_parent = TRUE) as total_parent_keywords,
                COUNT(*) FILTER (
                    WHERE is_parent = FALSE
                      AND (blocked_by IS NULL OR blocked_by != 'merge_hidden')
                ) as total_child_keywords,
                COUNT(DISTINCT group_id) FILTER (WHERE group_id IS NOT NULL) as group_count,
                (
                    SELECT COUNT(*) 
                    FROM keywords k2 
                    WHERE k2.project_id = keywords.project_id 
                    AND k2.status = 'grouped' 
                    AND k2.is_parent = FALSE
                    AND (k2.blocked_by IS NULL OR k2.blocked_by != 'merge_hidden')
                ) as grouped_children_count,
                (
                    SELECT COUNT(*) 
                    FROM keywords k3 
                    WHERE k3.project_id = keywords.project_id 
                    AND k3.status = 'confirmed' 
                    AND k3.is_parent = FALSE
                    AND (k3.blocked_by IS NULL OR k3.blocked_by != 'merge_hidden')
                ) as confirmed_children_count,
                (
                    SELECT COUNT(DISTINCT tok)
                    FROM keywords kp,
                         jsonb_array_elements_text(kp.tokens) AS tok
                    WHERE kp.project_id = keywords.project_id
                      AND kp.is_parent = TRUE
                      AND (kp.blocked_by IS NULL OR kp.blocked_by != 'merge_hidden')
                ) as parent_token_count,
                (
                    SELECT COUNT(DISTINCT tok)
                    FROM keywords kc,
                         jsonb_array_elements_text(kc.tokens) AS tok
                    WHERE kc.project_id = keywords.project_id
                      AND kc.is_parent = FALSE
                      AND (kc.blocked_by IS NULL OR kc.blocked_by != 'merge_hidden')
                ) as child_token_count
            FROM keywords 
            WHERE project_id = :project_id
            GROUP BY project_id
        )
        SELECT 
            project_id,
            ungrouped_count,
            grouped_pages,
            (grouped_pages + grouped_children_count) as grouped_keywords_count,
            confirmed_pages,
            (confirmed_pages + confirmed_children_count) as confirmed_keywords_count,
            blocked_count,
            total_parent_keywords,
            total_child_keywords,
            group_count,
            parent_token_count,
            child_token_count,
            (ungrouped_count + grouped_pages + grouped_children_count + confirmed_pages + confirmed_children_count + blocked_count) as total_keywords
        FROM project_stats
    """)

    tasks = [
        db.execute(stats_query, {"project_id": project_id}),
        KeywordService.get_parents_by_project(
            db,
            project_id,
            skip=(page - 1) * limit,
            limit=limit,
            status=status,
            sort="volume",
            direction="desc",
        ),
    ]

    stats_result, current_view_keywords = await asyncio.gather(*tasks)
    stats_row = stats_result.fetchone()
    if stats_row:
        ungrouped_count = stats_row.ungrouped_count or 0
        grouped_pages = stats_row.grouped_pages or 0
        confirmed_pages = stats_row.confirmed_pages or 0
        confirmed_keywords_count = stats_row.confirmed_keywords_count or 0
        blocked_count = stats_row.blocked_count or 0
        total_parent_keywords = stats_row.total_parent_keywords or 0
        total_child_keywords = stats_row.total_child_keywords or 0
        group_count = stats_row.group_count or 0
        parent_token_count = stats_row.parent_token_count or 0
        child_token_count = stats_row.child_token_count or 0
        grouped_keywords_count = stats_row.grouped_keywords_count or 0
        total_keywords = stats_row.total_keywords or 0
    else:
        ungrouped_count = 0
        grouped_pages = 0
        confirmed_pages = 0
        confirmed_keywords_count = 0
        blocked_count = 0
        total_parent_keywords = 0
        total_child_keywords = 0
        group_count = 0
        parent_token_count = 0
        child_token_count = 0
        grouped_keywords_count = 0
        total_keywords = 0

    ungrouped_percent = ((ungrouped_count / total_keywords) * 100) if total_keywords > 0 else 0.0
    grouped_percent = ((grouped_keywords_count / total_keywords) * 100) if total_keywords > 0 else 0.0
    confirmed_percent = ((confirmed_keywords_count / total_keywords) * 100) if total_keywords > 0 else 0.0
    blocked_percent = ((blocked_count / total_keywords) * 100) if total_keywords > 0 else 0.0
    if status == KeywordStatus.ungrouped:
        total_current = ungrouped_count
    elif status == KeywordStatus.grouped:
        total_current = grouped_pages
    elif status == KeywordStatus.confirmed:
        total_current = confirmed_pages
    else:
        total_current = blocked_count
    pages = (total_current + limit - 1) // limit if limit > 0 else 1
    if pages == 0:
        pages = 1
    current_view_responses = [KeywordResponse.model_validate(kw) for kw in current_view_keywords]
    processing_result = processing_queue_service.get_result(project_id)
    formatted_file_errors = [
        {
            "fileName": entry.get("file_name") or entry.get("fileName"),
            "message": entry.get("message"),
            "stage": entry.get("stage"),
            "stageDetail": entry.get("stage_detail") or entry.get("stageDetail"),
        }
        for entry in processing_result.get("file_errors", [])
        if isinstance(entry, dict)
    ]
    response = {
        "project": project.to_dict(),
        "stats": {
            "ungroupedCount": ungrouped_count,
            "groupedKeywordsCount": grouped_keywords_count,
            "groupedPages": grouped_pages,
            "confirmedKeywordsCount": confirmed_keywords_count,
            "confirmedPages": confirmed_pages,
            "blockedCount": blocked_count,
            "totalKeywords": total_keywords,
            "totalParentKeywords": total_parent_keywords,
            "totalChildKeywords": total_child_keywords,
            "groupCount": group_count,
            "parentTokenCount": parent_token_count,
            "childTokenCount": child_token_count,
            "ungroupedPercent": round(ungrouped_percent, 2),
            "groupedPercent": round(grouped_percent, 2),
            "confirmedPercent": round(confirmed_percent, 2),
            "blockedPercent": round(blocked_percent, 2),
        },
        "pagination": {
            "total": total_current,
            "page": page,
            "limit": limit,
            "pages": pages
        },
        "currentView": {
            "status": status.value,
            "keywords": current_view_responses
        },
        "processingStatus": {
            "status": "idle"
            if processing_queue_service.get_status(project_id) == "not_started"
            else processing_queue_service.get_status(project_id),
            "progress": processing_result.get("progress", 100.0),
            "complete": processing_result.get("complete", True),
            "message": processing_result.get("message", ""),
            "currentFileName": processing_queue_service.get_current_file(project_id).get("file_name")
            if processing_queue_service.get_current_file(project_id)
            else None,
            "queuedFiles": [
                item.get("file_name") for item in processing_queue_service.get_queue(project_id)
            ],
            "queueLength": len(processing_queue_service.get_queue(project_id)),
            "uploadedFiles": processing_result.get("uploaded_files", []),
            "processedFiles": processing_result.get("processed_files", []),
            "uploadedFileCount": len(
                processing_result.get("uploaded_files", [])
            ),
            "processedFileCount": len(
                processing_result.get("processed_files", [])
            ),
            "validationError": processing_result.get("validation_error"),
            "fileErrors": formatted_file_errors,
        }
    }
    
    return response

@router.get("/projects/{project_id}/keywords-for-cache", response_model=KeywordsCacheResponse)
async def get_keywords_for_cache(
    project_id: int,
    status: KeywordStatus = Query(KeywordStatus.ungrouped),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> KeywordsCacheResponse:
    """Get all keywords for client-side caching when filtering should happen on client."""
    project = await ProjectService.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    parent_keywords_data = await KeywordService.get_parents_by_project(
        db, project_id, skip=0, limit=None, status=status
    )
    
    parent_keyword_responses = [KeywordResponse.model_validate(kw_data) for kw_data in parent_keywords_data]
    return {
        "timestamp": time.time(),
        "status": status.value
    }

@router.get("/projects/{project_id}/groups/{group_id}/children", response_model=KeywordChildrenResponse)
async def get_keyword_children(
    project_id: int = Path(...),
    group_id: str = Path(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> KeywordChildrenResponse:
    """Get children keywords with optimized query."""
    project = await ProjectService.get_by_id(db, project_id)
    if not project: 
        raise HTTPException(status_code=404, detail="Project not found")
    children_data = await KeywordService.get_children_by_group(db, project_id, group_id)
    children_responses = [KeywordResponse.model_validate(child.to_dict()) for child in children_data]

    return {"children": children_responses}

@router.post("/projects/{project_id}/group", status_code=status.HTTP_200_OK)
async def group_keywords(
    project_id: int,
    group_request: GroupRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Group selected keywords into a new group or add them to an existing group.
    """
    if not group_request.keyword_ids:
        raise HTTPException(status_code=400, detail="No keywords selected")
    if not group_request.group_name or len(group_request.group_name.strip()) == 0:
        raise HTTPException(status_code=400, detail="Group name required")
    
    keywords_to_group = await KeywordService.find_by_ids_and_status(
        db, project_id, group_request.keyword_ids, KeywordStatus.ungrouped
    )
    if not keywords_to_group:
        raise HTTPException(status_code=404, detail="No 'ungrouped' keywords found for IDs")

    keywords_to_group.sort(key=lambda k: (k.volume or 0, -(k.difficulty or 0)), reverse=True)
    group_representative = keywords_to_group[0]

    existing_group = await KeywordService.find_group_by_name(db, project_id, group_request.group_name)
    
    if existing_group:
        group_id = existing_group.group_id
        existing_parent_query = text("""
            SELECT id, volume, difficulty FROM keywords 
            WHERE project_id = :project_id 
            AND group_id = :group_id 
            AND is_parent = true
        """)
        existing_parent_result = await db.execute(existing_parent_query, {
            "project_id": project_id,
            "group_id": group_id
        })
        existing_parent = existing_parent_result.mappings().first()
        
        if not existing_parent:
            raise HTTPException(status_code=400, detail="Existing group has no parent keyword")
        
        new_keywords_volume = sum(kw.volume or 0 for kw in keywords_to_group)
        new_total_volume = (existing_parent['volume'] or 0) + new_keywords_volume
        
        all_keywords_for_difficulty = keywords_to_group.copy()
        existing_difficulties = [existing_parent['difficulty']] if existing_parent['difficulty'] else []
        new_difficulties = [kw.difficulty for kw in keywords_to_group if kw.difficulty is not None]
        all_difficulties = existing_difficulties + new_difficulties
        avg_difficulty = sum(all_difficulties) / len(all_difficulties) if all_difficulties else 0.0
        
    else:
        group_id = f"custom_group_{project_id}_{uuid.uuid4().hex}"
        
        new_total_volume = sum(kw.volume or 0 for kw in keywords_to_group)
        difficulties = [kw.difficulty for kw in keywords_to_group if kw.difficulty is not None]
        avg_difficulty = sum(difficulties) / len(difficulties) if difficulties else 0.0

    try:
        updated_count = 0
        
        for kw in keywords_to_group:
            # Store complete original state with all fields
            original_state = {
                "keyword": kw.keyword,
                "volume": kw.volume,
                "original_volume": kw.original_volume,
                "difficulty": kw.difficulty,
                "tokens": kw.tokens,
                "is_parent": kw.is_parent,
                "group_id": kw.group_id,
                "group_name": kw.group_name,
                "status": kw.status,
                "serp_features": kw.serp_features,
                "timestamp": time.time(),  # Add timestamp for debugging
                "operation": "grouped"     # Track what operation created this state
            }
            if kw.id == group_representative.id and not existing_group:
                original_state["child_ids"] = [k.id for k in keywords_to_group if k.id != kw.id]
            
            # Store original state using direct SQL to ensure it's saved
            store_state_query = text("""
                UPDATE keywords 
                SET original_state = :original_state
                WHERE id = :keyword_id
            """)

            await db.execute(store_state_query, {
                "keyword_id": kw.id,
                "original_state": json.dumps(original_state)
            })
            
        
        # Commit the original state storage to ensure it's persisted
        await db.commit()
            
        for kw in keywords_to_group:
            if existing_group:
                is_representative = False
            else:
                is_representative = (kw.id == group_representative.id)
            
            # Use direct SQL to avoid ORM issues
            update_query = text("""
                UPDATE keywords 
                SET status = :status,
                    group_id = :group_id,
                    group_name = :group_name,
                    is_parent = :is_parent
                WHERE id = :keyword_id
            """)
            
            update_params = {
                "status": KeywordStatus.grouped.value,
                "group_id": group_id,
                "group_name": group_request.group_name,
                "is_parent": is_representative,
                "keyword_id": kw.id
            }
            
            if is_representative and not existing_group:
                update_query = text("""
                    UPDATE keywords 
                    SET status = :status,
                        group_id = :group_id,
                        group_name = :group_name,
                        is_parent = :is_parent,
                        volume = :volume,
                        difficulty = :difficulty
                    WHERE id = :keyword_id
                """)
                update_params.update({
                    "volume": new_total_volume,
                    "difficulty": round(avg_difficulty, 2)
                })
            
            await db.execute(update_query, update_params)
            updated_count += 1
        
        if existing_group:
            update_parent_query = text("""
                UPDATE keywords 
                SET volume = :new_volume, 
                    difficulty = :new_difficulty
                WHERE id = :parent_id
            """)
            
            await db.execute(update_parent_query, {
                "parent_id": existing_parent['id'],
                "new_volume": new_total_volume,
                "new_difficulty": round(avg_difficulty, 2)
            })
            
        
        for kw in keywords_to_group:
            verify_query = text("""
                SELECT keyword, status, group_id, group_name, original_state
                FROM keywords WHERE id = :keyword_id
            """)
            verify_result = await db.execute(verify_query, {"keyword_id": kw.id})
            row = verify_result.mappings().first()
            
            if not row or not row['original_state']:
                raise Exception(f"Verification failed for keyword {kw.keyword}")
        
        await db.commit()

        await ActivityLogService.log_activity(
            db,
            project_id=project_id,
            action="group",
            details={
                "group_name": group_request.group_name,
                "group_id": group_id,
                "keyword_ids": group_request.keyword_ids,
                "keyword_count": updated_count,
                "added_to_existing": existing_group is not None,
            },
            user=current_user.get("username", "admin"),
        )
        
        return {
            "message": f"Successfully {'added to existing' if existing_group else 'created new'} group with {updated_count} keywords",
            "groupName": group_request.group_name,
            "groupId": group_id,
            "count": updated_count,
            "totalVolume": new_total_volume,
            "addedToExisting": existing_group is not None
        }
        
    except Exception as e:
        await db.rollback()
        print(f"ERROR during grouping: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to group keywords: {str(e)}")
from sqlalchemy import text 
@router.post("/projects/{project_id}/regroup", status_code=status.HTTP_200_OK)
async def regroup_keywords(
    project_id: int,
    group_request: GroupRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Regroup selected keywords from multiple groups into a new or existing group."""
    if not group_request.keyword_ids:
        raise HTTPException(status_code=400, detail="No keywords selected")
    
    if not group_request.group_name or len(group_request.group_name.strip()) == 0:
        raise HTTPException(status_code=400, detail="Group name required")
    
    keywords_to_process = await KeywordService.find_by_ids_and_status(
        db, project_id, group_request.keyword_ids, KeywordStatus.grouped
    )
    
    if not keywords_to_process:
        raise HTTPException(status_code=404, detail="No 'grouped' keywords found for the provided IDs")
    parent_keywords = [kw for kw in keywords_to_process if kw.is_parent]
    group_ids_from_parents = [parent.group_id for parent in parent_keywords if parent.group_id]
    total_volume = 0
    child_count = 0
    all_keywords_to_process = list(keywords_to_process)
    for keyword in keywords_to_process:
        if keyword.is_parent:
            pass  # Parent keyword
        else:
            total_volume += keyword.volume or 0
            child_count += 1
    
    for group_id in group_ids_from_parents:
        children = await KeywordService.find_children_by_group_id(db, group_id)
        for child in children:
            if child.id not in [kw.id for kw in all_keywords_to_process]:
                all_keywords_to_process.append(child)
                total_volume += child.volume or 0
                child_count += 1
              
    difficulties = []
    for kw in all_keywords_to_process:
        if not kw.is_parent and kw.difficulty is not None:
            difficulties.append(kw.difficulty)
    
    avg_difficulty = sum(difficulties) / len(difficulties) if difficulties else 0.0
    existing_group = await KeywordService.find_group_by_name(db, project_id, group_request.group_name)
    affected_group_ids = set()
    for keyword in all_keywords_to_process:
        if keyword.group_id:
            affected_group_ids.add(keyword.group_id)
    keywords_to_process.sort(key=lambda k: (k.is_parent, k.volume or 0, -(k.difficulty or 0), k.id), reverse=True)
    parent_keyword = keywords_to_process[0]
    if existing_group:
        group_id = existing_group.group_id
        existing_parent = await KeywordService.find_parent_by_group_id(db, group_id)
        
        if not existing_parent:
            group_id = f"custom_group_{project_id}_{uuid.uuid4().hex}"
            existing_group = None
            new_parent_volume = total_volume
        else:
            existing_children = await KeywordService.find_children_by_group_id(db, group_id)
            for child in existing_children:
                if child.id not in [kw.id for kw in all_keywords_to_process]:
                    total_volume += child.volume or 0
                    child_count += 1
            
            new_parent_volume = total_volume
    else:
        group_id = f"custom_group_{project_id}_{uuid.uuid4().hex}"
        new_parent_volume = total_volume
    
    updated_count = 0
    new_parent_id = None
    
    try:
        if existing_group and 'existing_parent' in locals() and existing_parent:
            parent_update = {
                "difficulty": round(avg_difficulty, 2),
                "group_name": group_request.group_name
            }
            await KeywordService.update(db, existing_parent.id, parent_update)
            new_parent_id = existing_parent.id
        for keyword in all_keywords_to_process:
            await KeywordService.store_original_state(db, keyword)
            is_new_parent = False
            if not existing_group and keyword.id == parent_keyword.id:
                is_new_parent = True
                new_parent_id = keyword.id
            update_data = {
                "status": KeywordStatus.grouped.value,
                "group_id": group_id,
                "is_parent": is_new_parent,
                "group_name": group_request.group_name
            }
            
            await KeywordService.update(db, keyword.id, update_data)
            updated_count += 1
        if new_parent_id is not None:
            direct_update = text("""
                UPDATE keywords SET volume = :volume WHERE id = :id
            """)
            await db.execute(direct_update, {"id": new_parent_id, "volume": new_parent_volume})
            verify_query = text("SELECT volume FROM keywords WHERE id = :id")
            result = await db.execute(verify_query, {"id": new_parent_id})
            updated_volume = result.scalar_one_or_none()
        for affected_group_id in affected_group_ids:
            remaining_keywords = await KeywordService.find_by_group_id(db, project_id, affected_group_id)
            if remaining_keywords:
                await KeywordService.update_group_parent(db, project_id, affected_group_id)
        
        await ActivityLogService.log_activity(
            db,
            project_id=project_id,
            action="regroup",
            details={
                "group_name": group_request.group_name,
                "group_id": group_id,
                "keyword_ids": group_request.keyword_ids,
                "keyword_count": updated_count,
                "affected_group_ids": sorted(affected_group_ids),
                "added_to_existing": existing_group is not None,
            },
            user=current_user.get("username", "admin"),
        )
        await db.commit()
        
        if keyword_cache is not None:
            for affected_group_id in affected_group_ids:
                cache_key = f"group_children_{project_id}_{affected_group_id}"
                if cache_key in keyword_cache:
                    del keyword_cache[cache_key]
            new_cache_key = f"group_children_{project_id}_{group_id}"
            if new_cache_key in keyword_cache:
                del keyword_cache[new_cache_key]
        
    except Exception as e:
        await db.rollback()
        print(f"Error regrouping keywords: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to update keywords during regrouping.")
    
    return {
        "message": "Keywords regrouped successfully",
        "groupName": group_request.group_name,
        "groupId": group_id,
        "count": updated_count,
        "added_to_existing": existing_group is not None
    }

@router.post("/projects/{project_id}/block-token", status_code=status.HTTP_200_OK)
async def block_keywords_by_token(
    project_id: int,
    block_request: BlockTokenRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    if not block_request.token or not block_request.token.strip():
        raise HTTPException(status_code=400, detail="Token required")
    
    token_to_block = block_request.token.strip().lower()
    try:
        update_query = sql_text("""
            UPDATE keywords
            SET status = 'blocked',
                blocked_by = 'user',
                blocked_token = :blocked_token
            WHERE project_id = :project_id
            AND status IN ('ungrouped', 'grouped')
            AND (
                CASE
                    WHEN jsonb_typeof(tokens) = 'array' THEN
                        EXISTS (
                            SELECT 1 FROM jsonb_array_elements_text(tokens) t
                            WHERE t = :token
                        )
                    ELSE
                        tokens::text = :token
                END
            )
            RETURNING id
        """)

        try:
            result = await db.execute(
                update_query,
                {
                    "project_id": project_id,
                    "token": token_to_block,
                    "blocked_token": token_to_block,
                },
            )
            updated_count = len(result.fetchall())
        except Exception:
            # Backwards-compatible fallback for environments without `blocked_token`.
            updated_count = await TokenMergeService.update_status_by_token(
                db, project_id, token_to_block, new_status=KeywordStatus.blocked,
                current_statuses=[KeywordStatus.ungrouped, KeywordStatus.grouped],
                blocked_by="user"
            )

        await ActivityLogService.log_activity(
            db,
            project_id=project_id,
            action="block",
            details={
                "token": token_to_block,
                "count": updated_count,
            },
            user=current_user.get("username", "admin"),
        )

        await db.commit()
        return {"message": f"Blocked {updated_count} keywords containing token '{token_to_block}'", "count": updated_count}
    except Exception as e:
        await db.rollback()
        print(f"Error blocking token '{token_to_block}': {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to block keywords by token: {str(e)}")

@router.post("/projects/{project_id}/unblock", status_code=status.HTTP_200_OK)
async def unblock_keywords(
    project_id: int,
    unblock_request: UnblockRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    if not unblock_request.keyword_ids:
        raise HTTPException(status_code=400, detail="No keywords selected")
    
    try:
        update_query = sql_text("""
            UPDATE keywords
            SET status = 'ungrouped',
                blocked_by = NULL,
                blocked_token = NULL
            WHERE project_id = :project_id
            AND status = 'blocked'
            AND id = ANY(:keyword_ids)
            RETURNING id
        """)

        try:
            result = await db.execute(
                update_query,
                {
                    "project_id": project_id,
                    "keyword_ids": unblock_request.keyword_ids,
                },
            )
            updated_ids = result.fetchall()
            updated_count = len(updated_ids)
        except Exception:
            # Backwards-compatible fallback for environments without `blocked_token`.
            update_data = {"status": KeywordStatus.ungrouped.value, "blocked_by": None}
            updated_count = await KeywordService.update_status_by_ids_batched(
                db,
                project_id,
                unblock_request.keyword_ids,
                update_data,
                required_current_status=KeywordStatus.blocked,
            )

        await ActivityLogService.log_activity(
            db,
            project_id=project_id,
            action="unblock",
            details={
                "keyword_ids": unblock_request.keyword_ids,
                "count": updated_count,
            },
            user=current_user.get("username", "admin"),
        )

        await db.commit()
        return {"message": f"Unblocked {updated_count} keywords", "count": updated_count}
    except Exception as e:
        await db.rollback()
        print(f"Error unblocking keywords: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to unblock keywords: {str(e)}")

@router.post("/projects/{project_id}/ungroup", status_code=status.HTTP_200_OK)
async def ungroup_keywords(
    project_id: int,
    unblock_request: UnblockRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Ungroup only the specifically selected keywords and restore their original parent-child relationships, prioritizing merged_token over original tokens.
    """
    if not unblock_request.keyword_ids:
        raise HTTPException(status_code=400, detail="No keywords selected")
    
    try:
        keywords_to_ungroup = await KeywordService.find_by_ids_and_status(
            db, project_id, unblock_request.keyword_ids, KeywordStatus.grouped
        )
        if not keywords_to_ungroup:
            raise HTTPException(status_code=404, detail="No grouped keywords found for the provided IDs")

        # Only ungroup the specifically selected keywords, not entire groups
        all_keywords_in_groups = keywords_to_ungroup
            
        updated_count = 0
        children_restored = 0
        
        # First, collect all children that need to be restored
        all_children_to_restore = []
        
        for kw in all_keywords_in_groups:
            # If this is a parent keyword, find all its children
            if kw.is_parent and kw.group_id:
                # More robust child discovery - look for children that were part of this group
                # This handles cases where children might have been moved or partially ungrouped
                ungrouping_ids = [kw.id for kw in all_keywords_in_groups]
                ungrouping_ids_str = ','.join(map(str, ungrouping_ids)) if ungrouping_ids else 'NULL'
                
                children_query = text(f"""
                    SELECT id, keyword, is_parent, group_id, status, volume, original_volume, 
                           difficulty, tokens, serp_features, original_state
                    FROM keywords 
                    WHERE project_id = :project_id 
                    AND (group_id = :group_id OR original_state::json->>'group_id' = :group_id)
                    AND is_parent = false
                    AND id NOT IN ({ungrouping_ids_str})
                """)
                children_result = await db.execute(children_query, {
                    "project_id": project_id,
                    "group_id": kw.group_id
                })
                children_rows = children_result.fetchall()
                all_children_to_restore.extend(children_rows)
                
        
        # Collect group IDs before ungrouping
        group_ids_to_update = set()
        for kw in all_keywords_in_groups:
            if kw.group_id:
                group_ids_to_update.add(kw.group_id)
        
        # Debug output removed for production
        
        # Process selected keywords for ungrouping
        for kw in all_keywords_in_groups:
            if not kw.original_state:
                # No original state - simple ungroup
                await KeywordService.update(db, kw.id, {
                    "status": KeywordStatus.ungrouped.value,
                    "is_parent": True,
                    "group_id": None,
                    "group_name": None,
                    "volume": kw.original_volume if kw.original_volume is not None else kw.volume,
                    "difficulty": kw.difficulty,
                    "tokens": kw.tokens,
                    "serp_features": kw.serp_features,
                    "original_state": None
                })
                updated_count += 1
                continue
            
            try:
                original = json.loads(kw.original_state)
                
                # Complete restoration with all original fields
                # Ensure tokens and serp_features are JSON strings
                tokens = original.get("tokens", kw.tokens)
                serp_features = original.get("serp_features", kw.serp_features)
                
                # Convert to JSON strings if they're lists
                if isinstance(tokens, list):
                    tokens = json.dumps(tokens)
                if isinstance(serp_features, list):
                    serp_features = json.dumps(serp_features)
                
                restore_data = {
                    "keyword": original.get("keyword", kw.keyword),
                    "volume": original.get("volume", kw.original_volume if kw.original_volume is not None else kw.volume),
                    "original_volume": original.get("original_volume", kw.original_volume),
                    "difficulty": original.get("difficulty", kw.difficulty),
                    "tokens": tokens,
                    "is_parent": original.get("is_parent", True),
                    "group_id": original.get("group_id"),
                    "group_name": original.get("group_name"),
                    "status": KeywordStatus.ungrouped.value,
                    "serp_features": serp_features,
                    "original_state": None
                }
                
                await KeywordService.update(db, kw.id, restore_data)
                updated_count += 1
                
            except Exception as e:
                print(f"ERROR parsing original state for {kw.keyword}: {e}")
                # Fallback restoration
                await KeywordService.update(db, kw.id, {
                    "status": KeywordStatus.ungrouped.value,
                    "is_parent": True,
                    "group_id": None,
                    "group_name": None,
                    "volume": kw.original_volume if kw.original_volume is not None else kw.volume,
                    "difficulty": kw.difficulty,
                    "tokens": kw.tokens,
                    "serp_features": kw.serp_features,
                    "original_state": None
                })
                updated_count += 1

        # Process all children for restoration
        
        # Additional safety check: if we found no children but we're ungrouping a parent,
        # try to find any ungrouped children that might have been missed
        if len(all_children_to_restore) == 0:
            for kw in all_keywords_in_groups:
                if kw.is_parent and kw.original_state:
                    try:
                        original = json.loads(kw.original_state)
                        child_ids = original.get("child_ids", [])
                        if child_ids:
                            print(f"Found {len(child_ids)} child IDs in original state for {kw.keyword}")
                            # Try to restore these children
                            for child_id in child_ids:
                                child_query = text("""
                                    SELECT id, keyword, is_parent, group_id, status, volume, original_volume, 
                                           difficulty, tokens, serp_features, original_state
                                    FROM keywords 
                                    WHERE id = :child_id AND project_id = :project_id
                                """)
                                child_result = await db.execute(child_query, {
                                    "child_id": child_id,
                                    "project_id": project_id
                                })
                                child_row = child_result.fetchone()
                                if child_row and child_row.status != KeywordStatus.ungrouped.value:
                                    all_children_to_restore.append(child_row)
                                    print(f"Added missing child: {child_row.keyword}")
                    except Exception as e:
                        print(f"Error checking original state for child IDs: {e}")
        
        for child_row in all_children_to_restore:
            if child_row.status != KeywordStatus.ungrouped.value:
                if child_row.original_state:
                    try:
                        original = json.loads(child_row.original_state)
                        
                        # Complete child restoration
                        # Ensure tokens and serp_features are JSON strings
                        tokens = original.get("tokens", child_row.tokens)
                        serp_features = original.get("serp_features", child_row.serp_features)
                        
                        # Convert to JSON strings if they're lists
                        if isinstance(tokens, list):
                            tokens = json.dumps(tokens)
                        if isinstance(serp_features, list):
                            serp_features = json.dumps(serp_features)
                        
                        restore_data = {
                            "status": KeywordStatus.ungrouped.value,
                            "volume": original.get("volume", child_row.original_volume if child_row.original_volume is not None else child_row.volume),
                            "original_volume": original.get("original_volume", child_row.original_volume),
                            "difficulty": original.get("difficulty", child_row.difficulty),
                            "tokens": tokens,
                            "is_parent": original.get("is_parent", False),
                            "group_id": original.get("group_id"),
                            "group_name": original.get("group_name"),
                            "serp_features": serp_features,
                            "original_state": None
                        }
                        
                        await db.execute(
                            text("""
                                UPDATE keywords 
                                SET status = :status, 
                                    volume = :volume,
                                    original_volume = :original_volume,
                                    difficulty = :difficulty,
                                    tokens = :tokens,
                                    is_parent = :is_parent,
                                    group_id = :group_id,
                                    group_name = :group_name,
                                    serp_features = :serp_features,
                                    original_state = :original_state
                                WHERE id = :child_id
                            """),
                            {
                                "status": restore_data["status"],
                                "volume": restore_data["volume"],
                                "original_volume": restore_data["original_volume"],
                                "difficulty": restore_data["difficulty"],
                                "tokens": restore_data["tokens"],
                                "is_parent": restore_data["is_parent"],
                                "group_id": restore_data["group_id"],
                                "group_name": restore_data["group_name"],
                                "serp_features": restore_data["serp_features"],
                                "original_state": None,
                                "child_id": child_row.id
                            }
                        )
                        children_restored += 1
                        
                    except json.JSONDecodeError as e:
                        print(f"ERROR parsing original state for child {child_row.keyword}: {e}")
                        # Fallback child restoration
                        await db.execute(
                            text("""
                                UPDATE keywords 
                                SET status = :status, 
                                    volume = :volume,
                                    group_id = NULL,
                                    group_name = NULL,
                                    is_parent = FALSE,
                                    original_state = NULL
                                WHERE id = :child_id
                            """),
                            {
                                "status": KeywordStatus.ungrouped.value,
                                "volume": child_row.original_volume if child_row.original_volume is not None else child_row.volume,
                                "child_id": child_row.id
                            }
                        )
                        children_restored += 1
                else:
                    # No original state - simple ungroup
                    await db.execute(
                        text("""
                            UPDATE keywords 
                            SET status = :status, 
                                volume = :volume,
                                group_id = NULL,
                                group_name = NULL,
                                is_parent = FALSE,
                                original_state = NULL
                            WHERE id = :child_id
                        """),
                        {
                            "status": KeywordStatus.ungrouped.value,
                            "volume": child_row.original_volume if child_row.original_volume is not None else child_row.volume,
                            "child_id": child_row.id
                        }
                    )
                    children_restored += 1
        
        # Recalculate group volumes for remaining grouped keywords
        
        for group_id in group_ids_to_update:
            # Find remaining keywords in this group
            remaining_keywords_query = text("""
                SELECT id, keyword, volume, difficulty, is_parent
                FROM keywords 
                WHERE project_id = :project_id 
                AND group_id = :group_id 
                AND status = 'grouped'
            """)
            
            remaining_result = await db.execute(remaining_keywords_query, {
                "project_id": project_id,
                "group_id": group_id
            })
            remaining_keywords = remaining_result.mappings().all()
            
            # Debug output removed for production
            
            if remaining_keywords:
                    # Find the parent keyword
                    parent_keyword = None
                    child_volume_sum = 0
                    
                    for kw in remaining_keywords:
                        if kw['is_parent']:
                            parent_keyword = kw
                        else:
                            # For children, use their current volume (which should be their original volume)
                            child_volume_sum += kw['volume'] or 0
                    
                    if parent_keyword:
                        # Update parent volume to sum of remaining children only
                        new_parent_volume = child_volume_sum
                        # Debug output removed for production
                    
                    # Calculate new average difficulty
                    difficulties = [kw['difficulty'] for kw in remaining_keywords if kw['difficulty'] is not None]
                    new_avg_difficulty = sum(difficulties) / len(difficulties) if difficulties else 0.0
                    
                    update_parent_query = text("""
                        UPDATE keywords 
                        SET volume = :new_volume, 
                            difficulty = :new_difficulty
                        WHERE id = :parent_id
                    """)
                    
                    await db.execute(update_parent_query, {
                        "new_volume": new_parent_volume,
                        "new_difficulty": round(new_avg_difficulty, 2),
                        "parent_id": parent_keyword['id']
                    })
                    
        
        await db.commit()

        await ActivityLogService.log_activity(
            db,
            project_id=project_id,
            action="ungroup",
            details={
                "keyword_ids": unblock_request.keyword_ids,
                "updated_count": updated_count,
                "children_restored": children_restored,
            },
            user=current_user.get("username", "admin"),
        )

        # Final verification
        final_keywords = await KeywordService.get_all_by_project(db, project_id)
        final_parents = [kw for kw in final_keywords if kw.is_parent and kw.status == KeywordStatus.ungrouped.value]
        final_children = [kw for kw in final_keywords if not kw.is_parent and kw.status == KeywordStatus.ungrouped.value]
        
        
        return {
            "message": f"Successfully ungrouped {updated_count} keywords and restored {children_restored} children to their original state",
            "count": updated_count,
            "childrenRestored": children_restored,
            "finalState": {
                "parents": len(final_parents),
                "children": len(final_children)
            }
        }
        
    except Exception as e:
        await db.rollback()
        print(f"Error during ungrouping: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to ungroup keywords")

@router.get("/projects/{project_id}/block-token-count", status_code=status.HTTP_200_OK)
async def get_block_token_count(
    project_id: int,
    token: str = Query(..., description="The token to count keywords for"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, int]:
    if not token or len(token.strip()) == 0:
        raise HTTPException(status_code=400, detail="Token required")
    
    token_to_check = token.strip().lower()
    keyword_count = await TokenMergeService.count_by_token(
        db, 
        project_id, 
        token_to_check,
        statuses=[KeywordStatus.ungrouped, KeywordStatus.grouped]
    )
    return {"count": keyword_count}

@router.get("/projects/{project_id}/stats", status_code=status.HTTP_200_OK)
async def get_project_stats(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get stats for a single project."""
    project = await ProjectService.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Single optimized query for one project
    stats_query = text("""
        WITH project_stats AS (
            SELECT 
                project_id,
                COUNT(*) FILTER (WHERE is_parent = TRUE AND status = 'ungrouped') as ungrouped_count,
                COUNT(*) FILTER (WHERE is_parent = TRUE AND status = 'grouped') as grouped_pages,
                COUNT(*) FILTER (WHERE is_parent = TRUE AND status = 'confirmed') as confirmed_pages,
                COUNT(*) FILTER (WHERE is_parent = TRUE AND status = 'blocked') as blocked_count,
                COUNT(*) FILTER (WHERE is_parent = TRUE) as total_parent_keywords,
                COUNT(*) FILTER (
                    WHERE is_parent = FALSE
                      AND (blocked_by IS NULL OR blocked_by != 'merge_hidden')
                ) as total_child_keywords,
                COUNT(DISTINCT group_id) FILTER (WHERE group_id IS NOT NULL) as group_count,
                -- Count children for grouped keywords
                (
                    SELECT COUNT(*) 
                    FROM keywords k2 
                    WHERE k2.project_id = keywords.project_id 
                    AND k2.status = 'grouped' 
                    AND k2.is_parent = FALSE
                    AND (k2.blocked_by IS NULL OR k2.blocked_by != 'merge_hidden')
                ) as grouped_children_count,
                -- Count children for confirmed keywords
                (
                    SELECT COUNT(*) 
                    FROM keywords k3 
                    WHERE k3.project_id = keywords.project_id 
                    AND k3.status = 'confirmed' 
                    AND k3.is_parent = FALSE
                    AND (k3.blocked_by IS NULL OR k3.blocked_by != 'merge_hidden')
                ) as confirmed_children_count,
                -- Token stats (distinct tokens)
                (
                    SELECT COUNT(DISTINCT tok)
                    FROM keywords kp,
                         jsonb_array_elements_text(kp.tokens) AS tok
                    WHERE kp.project_id = keywords.project_id
                      AND kp.is_parent = TRUE
                      AND (kp.blocked_by IS NULL OR kp.blocked_by != 'merge_hidden')
                ) as parent_token_count,
                (
                    SELECT COUNT(DISTINCT tok)
                    FROM keywords kc,
                         jsonb_array_elements_text(kc.tokens) AS tok
                    WHERE kc.project_id = keywords.project_id
                      AND kc.is_parent = FALSE
                      AND (kc.blocked_by IS NULL OR kc.blocked_by != 'merge_hidden')
                ) as child_token_count
            FROM keywords 
            WHERE project_id = :project_id
            GROUP BY project_id
        )
        SELECT 
            project_id,
            ungrouped_count,
            grouped_pages,
            (grouped_pages + grouped_children_count) as grouped_keywords_count,
            confirmed_pages,
            (confirmed_pages + confirmed_children_count) as confirmed_keywords_count,
            blocked_count,
            total_parent_keywords,
            total_child_keywords,
            group_count,
            parent_token_count,
            child_token_count,
            (ungrouped_count + grouped_pages + grouped_children_count + confirmed_pages + confirmed_children_count + blocked_count) as total_keywords
        FROM project_stats
    """)
    
    result = await db.execute(stats_query, {"project_id": project_id})
    row = result.fetchone()
    
    if not row:
        return {
            "ungroupedCount": 0,
            "groupedKeywordsCount": 0,
            "groupedPages": 0,
            "confirmedKeywordsCount": 0,
            "confirmedPages": 0,
            "blockedCount": 0,
            "totalKeywords": 0,
            "totalParentKeywords": 0,
            "totalChildKeywords": 0,
            "groupCount": 0,
            "parentTokenCount": 0,
            "childTokenCount": 0,
            "ungroupedPercent": 0,
            "groupedPercent": 0,
            "confirmedPercent": 0,
            "blockedPercent": 0
        }
    
    total_keywords = row.total_keywords or 0
    return {
        "ungroupedCount": row.ungrouped_count or 0,
        "groupedKeywordsCount": row.grouped_keywords_count or 0,
        "groupedPages": row.grouped_pages or 0,
        "confirmedKeywordsCount": row.confirmed_keywords_count or 0,
        "confirmedPages": row.confirmed_pages or 0,
        "blockedCount": row.blocked_count or 0,
        "totalKeywords": total_keywords,
        "totalParentKeywords": row.total_parent_keywords or 0,
        "totalChildKeywords": row.total_child_keywords or 0,
        "groupCount": row.group_count or 0,
        "parentTokenCount": row.parent_token_count or 0,
        "childTokenCount": row.child_token_count or 0,
        "ungroupedPercent": round(((row.ungrouped_count or 0) / total_keywords * 100) if total_keywords > 0 else 0, 2),
        "groupedPercent": round(((row.grouped_keywords_count or 0) / total_keywords * 100) if total_keywords > 0 else 0, 2),
        "confirmedPercent": round(((row.confirmed_keywords_count or 0) / total_keywords * 100) if total_keywords > 0 else 0, 2),
        "blockedPercent": round(((row.blocked_count or 0) / total_keywords * 100) if total_keywords > 0 else 0, 2)
    }

@router.get("/projects/{project_id}/export-csv", status_code=status.HTTP_200_OK)
async def export_keywords_csv(
    project_id: int,
    view: str = "grouped",
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> StreamingResponse:
    """Export grouped or confirmed keywords to CSV with server-side generation"""
    project = await ProjectService.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if view not in ["grouped", "confirmed"]:
        raise HTTPException(status_code=400, detail="Invalid view parameter. Must be 'grouped' or 'confirmed'")
    
    if view == "confirmed":
        all_keywords_query = text("""
            SELECT 
                id, 
                keyword,
                volume,
                difficulty,
                group_id,
                group_name,
                is_parent
            FROM keywords
            WHERE project_id = :project_id 
            AND status = 'confirmed'
            ORDER BY group_name, is_parent DESC, volume DESC NULLS LAST
        """)
    else:
        all_keywords_query = text("""
            SELECT 
                id, 
                keyword,
                volume,
                difficulty,
                group_id,
                group_name,
                is_parent
            FROM keywords
            WHERE project_id = :project_id 
            AND status = 'grouped'
            ORDER BY group_name, is_parent DESC, volume DESC NULLS LAST
        """)
    
    result = await db.execute(all_keywords_query, {"project_id": project_id})
    all_keywords = result.fetchall()
    
    keywords_by_group_name = {}
    for row in all_keywords:
        group_name = row.group_name
        if not group_name:
            continue
            
        if group_name not in keywords_by_group_name:
            keywords_by_group_name[group_name] = []
            
        keywords_by_group_name[group_name].append({
            "keyword": row.keyword,
            "volume": row.volume,
            "difficulty": row.difficulty,
            "is_parent": row.is_parent
        })
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow(['Group name', 'Keyword', 'Volume', 'Difficulty'])
    for group_name, keywords in keywords_by_group_name.items():
        keywords.sort(key=lambda k: (not k["is_parent"], -(k["volume"] or 0)))
        
        for kw in keywords:
            writer.writerow([
                group_name,
                kw["keyword"],
                str(kw["volume"] or 0),
                str(round(kw["difficulty"] or 0, 1))
            ])
    
    output.seek(0)
    
    from datetime import datetime
    timestamp = datetime.now().strftime("%Y-%m-%d")
    filename = f"{view}_keywords_{project_id}_{timestamp}.csv"
    
    await ActivityLogService.log_activity(
        db,
        project_id=project_id,
        action="export_csv",
        details={
            "view": view,
            "group_count": len(keywords_by_group_name),
            "keyword_count": len(all_keywords),
            "filename": filename,
        },
        user=current_user.get("username", "admin"),
    )
    await db.commit()

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

@router.post("/projects/{project_id}/confirm", status_code=status.HTTP_200_OK)
async def confirm_keywords(
    project_id: int,
    confirm_request: UnblockRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    if not confirm_request.keyword_ids:
        raise HTTPException(status_code=400, detail="No keywords selected")
    
    try:
        keywords = await KeywordService.find_by_ids_and_status(
            db, project_id, confirm_request.keyword_ids, KeywordStatus.grouped
        )
        
        if not keywords:
            raise HTTPException(status_code=404, detail="No grouped keywords found for the provided IDs")

        updated_count = 0
        groups_to_update = set()
        
        for keyword in keywords:
            if keyword.group_id:
                groups_to_update.add(keyword.group_id)
                
                await KeywordService.store_original_state(db, keyword)
                await KeywordService.update(db, keyword.id, {"status": "confirmed"})
                updated_count += 1
        
        for group_id in groups_to_update:
            children = await KeywordService.find_children_by_group_id(db, group_id)
            for child in children:
                if child.status != "confirmed":
                    await KeywordService.store_original_state(db, child)
                    await KeywordService.update(db, child.id, {"status": "confirmed"})
                    updated_count += 1
        
        await ActivityLogService.log_activity(
            db,
            project_id=project_id,
            action="confirm",
            details={
                "keyword_ids": confirm_request.keyword_ids,
                "group_ids": sorted(groups_to_update),
                "count": updated_count,
            },
            user=current_user.get("username", "admin"),
        )
        await db.commit()
        
        if updated_count == 0:
            raise HTTPException(status_code=400, detail="No keywords were confirmed")
            
        return {"message": f"Confirmed {updated_count} keywords", "count": updated_count}
    
    except Exception as e:
        await db.rollback()
        print(f"Error confirming keywords: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to confirm keywords: {str(e)}")
        
@router.post("/projects/{project_id}/unconfirm", status_code=status.HTTP_200_OK)
async def unconfirm_keywords(
    project_id: int,
    unconfirm_request: UnblockRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    if not unconfirm_request.keyword_ids:
        raise HTTPException(status_code=400, detail="No keywords selected")
    
    try:
        keywords = await KeywordService.find_by_ids_and_status(
            db, project_id, unconfirm_request.keyword_ids, KeywordStatus.confirmed
        )
        
        if not keywords:
            raise HTTPException(status_code=404, detail="No confirmed keywords found for the provided IDs")

        updated_count = 0
        groups_to_update = set()
        
        for keyword in keywords:
            if keyword.group_id:
                groups_to_update.add(keyword.group_id)
                
                await KeywordService.update(db, keyword.id, {"status": "grouped"})
                updated_count += 1
        
        for group_id in groups_to_update:
            children = await KeywordService.find_children_by_group_id(
                db, group_id, "confirmed"
            )
            for child in children:
                await KeywordService.update(db, child.id, {"status": "grouped"})
                updated_count += 1
        
        await ActivityLogService.log_activity(
            db,
            project_id=project_id,
            action="unconfirm",
            details={
                "keyword_ids": unconfirm_request.keyword_ids,
                "group_ids": sorted(groups_to_update),
                "count": updated_count,
            },
            user=current_user.get("username", "admin"),
        )
        await db.commit()
        
        if updated_count == 0:
            raise HTTPException(status_code=400, detail="No keywords were unconfirmed")
            
        return {"message": f"Unconfirmed {updated_count} keywords", "count": updated_count}
    
    except Exception as e:
        await db.rollback()
        print(f"Error unconfirming keywords: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to unconfirm keywords: {str(e)}")

@router.get("/projects/{project_id}/export-parent-keywords", status_code=status.HTTP_200_OK)
async def export_parent_keywords_csv(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> StreamingResponse:
    """Export parent keywords from ungrouped and grouped views to CSV"""
    project = await ProjectService.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    parent_keywords_query = text("""
        SELECT 
            keyword,
            rating,
            volume,
            difficulty
        FROM keywords
        WHERE project_id = :project_id 
        AND is_parent = true
        AND status IN ('ungrouped', 'grouped')
        ORDER BY status, volume DESC NULLS LAST
    """)
    
    result = await db.execute(parent_keywords_query, {"project_id": project_id})
    parent_keywords = result.fetchall()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow(['parent keyword', 'rating', 'volume', 'difficulty'])
    for kw in parent_keywords:
        writer.writerow([
            kw.keyword,
            kw.rating or '',
            str(kw.volume or 0),
            str(round(kw.difficulty or 0, 1))
        ])
    
    output.seek(0)
    
    from datetime import datetime
    timestamp = datetime.now().strftime("%Y-%m-%d")
    filename = f"parent_keywords_{project_id}_{timestamp}.csv"
    
    await ActivityLogService.log_activity(
        db,
        project_id=project_id,
        action="export_parent_keywords",
        details={
            "keyword_count": len(parent_keywords),
            "filename": filename,
        },
        user=current_user.get("username", "admin"),
    )
    await db.commit()

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

@router.post("/projects/{project_id}/import-parent-keywords", status_code=status.HTTP_200_OK)
async def import_parent_keywords_csv(
    project_id: int,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Import parent keywords with ratings from CSV"""
    project = await ProjectService.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if not file.filename or not file.filename.lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    try:
        content = await file.read()
        csv_content = content.decode('utf-8')
        
        reader = csv.DictReader(io.StringIO(csv_content))
        updates_count = 0
        
        for row in reader:
            keyword_text = row.get('parent keyword', '').strip()
            rating_str = row.get('rating', '').strip()
            
            if not keyword_text:
                continue
                
            try:
                rating_value = int(rating_str) if rating_str else None
            except ValueError:
                rating_value = None
            
            if rating_value is not None:
                update_query = text("""
                    UPDATE keywords
                    SET rating = :rating
                    WHERE project_id = :project_id
                    AND keyword = :keyword
                    AND is_parent = true
                    AND status IN ('ungrouped', 'grouped')
                """)
                
                result = await db.execute(update_query, {
                    "project_id": project_id,
                    "keyword": keyword_text,
                    "rating": rating_value
                })
                
                if result.rowcount > 0:
                    updates_count += 1
        
        await ActivityLogService.log_activity(
            db,
            project_id=project_id,
            action="import_parent_keywords",
            details={
                "file_name": file.filename,
                "updated_count": updates_count,
            },
            user=current_user.get("username", "admin"),
        )
        await db.commit()
        
        return {
            "message": f"Successfully updated ratings for {updates_count} parent keywords",
            "updates_count": updates_count
        }
        
    except Exception as e:
        await db.rollback()
        print(f"Error importing parent keywords: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to import parent keywords: {str(e)}")
    finally:
        await file.close()

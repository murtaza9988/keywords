"""
CSV routes - Endpoints for CSV upload and download operations.

Endpoints:
- POST /projects/{project_id}/upload - Upload CSV files
- GET /projects/{project_id}/csv-uploads - List CSV uploads for a project
- GET /projects/{project_id}/csv-uploads/{upload_id}/download - Download a CSV upload
"""

import asyncio
import os
import uuid
from typing import Any, Dict, List, Optional, Tuple

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Path,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.csv_upload import CSVUpload
from app.routes.keyword_helpers import (
    build_idempotency_key,
    rel_upload_path,
    resolve_csv_upload_path,
    sanitize_segment,
    sha256_file,
)
from app.routes.keyword_processing import (
    enqueue_processing_file,
    start_next_processing,
)
from app.schemas.csv_upload import CSVUploadResponse
from app.services.activity_log import ActivityLogService
from app.services.processing_queue import processing_queue_service
from app.services.project import ProjectService
from app.utils.security import get_current_user

router = APIRouter(tags=["keywords"])

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)


async def _find_duplicate_csv_upload(
    db: AsyncSession,
    *,
    project_id: int,
    file_name: str,
    candidate_path: str,
) -> Optional[Tuple[int, str]]:
    """
    Detect if the uploaded CSV is identical to a previously uploaded one.

    Returns (existing_upload_id, existing_path) if found; otherwise None.
    """
    try:
        candidate_size = os.path.getsize(candidate_path)
    except Exception:
        return None

    # Compare against recent uploads for this project (same content, even if renamed).
    result = await db.execute(
        select(CSVUpload)
        .where(CSVUpload.project_id == project_id)
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
        candidate_hash = sha256_file(candidate_path)
    except Exception:
        return None

    for upload in existing_uploads:
        resolved = resolve_csv_upload_path(project_id, upload)
        if not resolved:
            continue
        try:
            if os.path.getsize(resolved) != candidate_size:
                continue
            if sha256_file(resolved) == candidate_hash:
                return upload.id, resolved
        except Exception:
            continue

    return None


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

    # Check if processing is already active
    current_status = processing_queue_service.get_status(project_id)
    if current_status in ("processing", "queued"):
        raise HTTPException(
            status_code=409,
            detail=(
                "A file is already being processed for this project. "
                "Please wait for processing to complete before uploading."
            )
        )

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

    is_chunked_upload = (
        chunkIndex is not None
        and totalChunks is not None
        and originalFilename is not None
    )
    safe_batch_id = sanitize_segment(batchId) if batchId else None
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
                detail=(
                    "fileIndex is not supported when uploading "
                    "multiple files in one request."
                ),
            )
        if resolved_total_files is not None and resolved_total_files != len(files):
            raise HTTPException(
                status_code=400,
                detail="totalFiles must match the number of uploaded files.",
            )

        resolved_total_files = len(files)
        if not safe_batch_id:
            safe_batch_id = sanitize_segment(f"multi_{uuid.uuid4().hex}")

        batch_dir = os.path.join(
            settings.UPLOAD_DIR, f"{project_id}_batch_{safe_batch_id}"
        )
        os.makedirs(batch_dir, exist_ok=True)
        processable_entries = []
        duplicate_files = []

        for index, upload_file in enumerate(files):
            safe_original_filename = sanitize_segment(
                upload_file.filename or "upload.csv"
            )
            safe_upload_id = sanitize_segment(
                f"{uploadId or uuid.uuid4().hex}_{index}"
            )
            file_storage_name = (
                f"{project_id}_{safe_upload_id}_{safe_original_filename}"
            )
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
                raise HTTPException(
                    status_code=500,
                    detail=f"Error saving uploaded file: {str(e)}"
                )
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

            csv_upload = CSVUpload(
                project_id=project_id, file_name=upload_file.filename
            )
            csv_upload.storage_path = rel_upload_path(file_path)
            db.add(csv_upload)
            await db.commit()

            await ActivityLogService.log_activity(
                db,
                project_id=project_id,
                action="csv_upload",
                details={
                    "file_name": upload_file.filename,
                    "chunked": False,
                    "file_size": (
                        os.path.getsize(file_path)
                        if os.path.exists(file_path)
                        else None
                    ),
                },
                user=current_user.get("username", "admin"),
            )
            await db.commit()

            processing_queue_service.register_upload(project_id, upload_file.filename)
            idempotency_key = (
                build_idempotency_key(file_path, upload_file.filename)
                if os.path.exists(file_path)
                else None
            )
            processable_entries.append(
                {
                    "file_path": file_path,
                    "file_name": upload_file.filename,
                    "csv_upload_id": csv_upload.id,
                    "idempotency_key": idempotency_key,
                }
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
            await enqueue_processing_file(
                db,
                project_id,
                entry["file_path"],
                entry.get("file_name") or "CSV file",
                csv_upload_id=entry.get("csv_upload_id"),
                idempotency_key=entry.get("idempotency_key"),
            )
        try:
            await start_next_processing(project_id)
        except Exception as e:
            # Log but don't fail - files are queued and will be picked up
            print(f"[WARN] Failed to start processing for project {project_id}: {e}")

        return {
            "message": "Batch upload complete. Files queued for sequential processing.",
            "status": processing_queue_service.get_status(project_id),
            "file_name": None,
            "duplicateFiles": duplicate_files,
        }

    file = files[0]
    safe_original_filename = sanitize_segment(originalFilename or file.filename)
    safe_upload_id = sanitize_segment(uploadId or originalFilename or file.filename)

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
            raise HTTPException(
                status_code=500,
                detail=f"Error saving uploaded chunk: {str(e)}"
            )
        finally:
            await file.close()

        if int(chunkIndex) < int(totalChunks) - 1:
            return {
                "message": f"Chunk {int(chunkIndex) + 1} of {totalChunks} received.",
                "status": "uploading"
            }

        try:
            status = processing_queue_service.get_status(project_id)
            if status not in {"processing", "queued"}:
                processing_queue_service.set_status(project_id, "combining")
            file_storage_name = (
                f"{project_id}_{safe_upload_id}_{safe_original_filename}"
            )
            batch_dir = None
            if safe_batch_id:
                batch_dir = os.path.join(
            settings.UPLOAD_DIR, f"{project_id}_batch_{safe_batch_id}"
        )
                os.makedirs(batch_dir, exist_ok=True)
            final_path = os.path.join(
                batch_dir or settings.UPLOAD_DIR, file_storage_name
            )

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
            if (
                parent_chunks_dir
                and os.path.exists(parent_chunks_dir)
                and not os.listdir(parent_chunks_dir)
            ):
                os.rmdir(parent_chunks_dir)

            # Detect duplicate uploads (same filename + identical content).
            # If duplicate, skip creating CSVUpload row and enqueue processing.
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
                    storage_path=rel_upload_path(final_path),
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
                            f"Duplicate '{originalFilename}' skipped. Waiting."
                            if duplicate_info
                            else "Batch upload in progress. Waiting."
                        ),
                        "status": "uploading",
                        "file_name": originalFilename,
                    }
                batch_info = (
                    processing_queue_service.pop_batch(project_id, batchId)
                    or batch_info
                )
                file_entries = list(batch_info["files"].values())
                file_entries.sort(
                    key=lambda entry: entry.get("file_index")
                    if entry.get("file_index") is not None
                    else entry.get("file_name", "")
                )

                # Only process non-duplicate files from this batch.
                processable_entries = [
                    e for e in file_entries if not e.get("is_duplicate")
                ]
                if not processable_entries:
                    processing_queue_service.set_status(project_id, "complete")
                    return {
                        "message": "All CSVs were duplicates and were skipped.",
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
                    entry_path = entry["file_path"]
                    idempotency_key = (
                        build_idempotency_key(entry_path, entry.get("file_name"))
                        if os.path.exists(entry_path)
                        else None
                    )
                    await enqueue_processing_file(
                        db,
                        project_id,
                        entry_path,
                        entry.get("file_name") or "CSV file",
                        idempotency_key=idempotency_key,
                    )
                try:
                    await start_next_processing(project_id)
                except Exception as e:
                    print(f"[WARN] Failed to start processing: {e}")

                return {
                    "message": "Batch upload complete. Files queued.",
                    "status": processing_queue_service.get_status(project_id),
                    "file_name": originalFilename,
                }

            if duplicate_info and originalFilename and not batchId:
                # Avoid leaving project stuck in "uploading" when skipped.
                if processing_queue_service.get_status(project_id) == "uploading":
                    processing_queue_service.set_status(project_id, "complete")
                return {
                    "message": (
                        f"'{originalFilename}' already uploaded "
                        f"(#{duplicate_info[0]}). Skipping."
                    ),
                    "status": processing_queue_service.get_status(project_id),
                    "file_name": originalFilename,
                }

            if originalFilename and not duplicate_info:
                idempotency_key = (
                    build_idempotency_key(final_path, originalFilename)
                    if os.path.exists(final_path)
                    else None
                )
                await enqueue_processing_file(
                    db,
                    project_id,
                    final_path,
                    originalFilename,
                    idempotency_key=idempotency_key,
                )
                try:
                    await start_next_processing(project_id)
                except Exception as e:
                    print(f"[WARN] Failed to start processing: {e}")

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
            raise HTTPException(
                status_code=500, detail=f"Error combining chunks: {str(e)}"
            )

    else:
        file_storage_name = f"{project_id}_{safe_upload_id}_{safe_original_filename}"
        batch_dir = None
        if safe_batch_id:
            batch_dir = os.path.join(
            settings.UPLOAD_DIR, f"{project_id}_batch_{safe_batch_id}"
        )
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
            raise HTTPException(
                status_code=500,
                detail=f"Error saving uploaded file: {str(e)}"
            )
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
            csv_upload.storage_path = rel_upload_path(file_path)
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
                        f"Duplicate '{file.filename}' skipped. Waiting."
                        if duplicate_info
                        else "Batch upload in progress. Waiting."
                    ),
                    "status": "uploading",
                    "file_name": file.filename,
                }
            status = processing_queue_service.get_status(project_id)
            if status not in {"processing", "queued"}:
                processing_queue_service.set_status(project_id, "combining")
            batch_info = (
                processing_queue_service.pop_batch(project_id, batchId)
                or batch_info
            )
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
                entry_path = entry["file_path"]
                idempotency_key = (
                    build_idempotency_key(entry_path, entry.get("file_name"))
                    if os.path.exists(entry_path)
                    else None
                )
                await enqueue_processing_file(
                    db,
                    project_id,
                    entry_path,
                    entry.get("file_name") or "CSV file",
                    idempotency_key=idempotency_key,
                )
            try:
                await start_next_processing(project_id)
            except Exception as e:
                print(f"[WARN] Failed to start processing: {e}")

            return {
                "message": "Batch upload complete. Processing queued.",
                "status": processing_queue_service.get_status(project_id),
                "file_name": file.filename,
            }

        if duplicate_info:
            if processing_queue_service.get_status(project_id) == "uploading":
                processing_queue_service.set_status(project_id, "complete")
            return {
                "message": (
                    f"'{file.filename}' already uploaded "
                    f"(#{duplicate_info[0]}). Skipping."
                ),
                "status": processing_queue_service.get_status(project_id),
                "file_name": file.filename,
            }

        idempotency_key = (
            build_idempotency_key(file_path, file.filename)
            if os.path.exists(file_path)
            else None
        )
        await enqueue_processing_file(
            db,
            project_id,
            file_path,
            file.filename,
            csv_upload_id=csv_upload.id if not duplicate_info else None,
            idempotency_key=idempotency_key,
        )
        try:
            await start_next_processing(project_id)
        except Exception as e:
            print(f"[WARN] Failed to start processing for project {project_id}: {e}")

        return {
            "message": "Upload complete. Processing queued.",
            "status": processing_queue_service.get_status(project_id),
            "file_name": file.filename
        }


@router.get(
    "/projects/{project_id}/csv-uploads", response_model=List[CSVUploadResponse]
)
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
        select(CSVUpload).where(
            CSVUpload.id == upload_id, CSVUpload.project_id == project_id
        )
    )
    upload = result.scalar_one_or_none()
    if not upload:
        raise HTTPException(status_code=404, detail="CSV upload not found")

    resolved_path = resolve_csv_upload_path(project_id, upload)
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
        upload.storage_path = rel_upload_path(resolved_path)
        db.add(upload)
        await db.commit()

    return FileResponse(
        resolved_path,
        media_type="text/csv",
        filename=upload.file_name,
    )

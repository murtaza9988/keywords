"""
Keyword admin routes - Endpoints for admin operations, stats, and processing status.

Endpoints:
- POST /projects/{project_id}/reset-processing - Reset stuck processing state
- POST /projects/{project_id}/run-grouping - Manually trigger keyword grouping
- GET /projects/{project_id}/processing-status - Get processing status
- GET /projects/{project_id}/stats - Get project stats
- GET /projects/{project_id}/block-token-count - Get count of keywords matching a token
"""

import os
import traceback
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.csv_processing_job import CsvProcessingJobStatus
from app.models.keyword import KeywordStatus
from app.routes.keyword_helpers import ensure_grouping_unlocked, format_file_errors
from app.schemas.keyword import ProcessingStatus
from app.services.activity_log import ActivityLogService
from app.services.csv_processing_job import CsvProcessingJobService
from app.services.keyword import KeywordService
from app.services.merge_token import TokenMergeService
from app.services.processing_queue import processing_queue_service
from app.services.project import ProjectService
from app.services.project_processing_lease import ProjectProcessingLeaseService
from app.utils.security import get_current_user

router = APIRouter(tags=["keywords"])


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
    cancelled_jobs = await CsvProcessingJobService.cancel_pending_jobs(
        db,
        project_id=project_id,
        error="Reset by user",
    )
    await ProjectProcessingLeaseService.clear_for_project(db, project_id=project_id)

    await ActivityLogService.log_activity(
        db,
        project_id=project_id,
        action="reset_processing",
        details={
            "previous_status": cleared_info.get("had_status"),
            "had_queued_files": cleared_info.get("had_queue", 0),
            "had_current_file": cleared_info.get("had_current_file"),
            "cancelled_jobs": cancelled_jobs,
        },
        user=current_user.get("username", "admin"),
    )

    return {
        "message": "Processing state reset successfully",
        "cleared": cleared_info,
        "cancelledJobs": cancelled_jobs,
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
    await ensure_grouping_unlocked(db, project_id)
    from app.routes.keyword_processing import group_remaining_ungrouped_keywords

    project = await ProjectService.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Count ungrouped keywords before
    count_query = text("""
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
    try:
        status = processing_queue_service.get_status(project_id)
        if status == "not_started":
            status = "idle"
        result = processing_queue_service.get_result(project_id)

        progress = max(0, min(100, result.get("progress", 0.0)))
        testing_mode = os.getenv("TESTING") == "True"
        if testing_mode:
            counts = {"queued": 0, "running": 0, "succeeded": 0, "failed": 0}
            locked = False
            queue = processing_queue_service.get_queue(project_id)
            current_file = processing_queue_service.get_current_file(project_id)
            queued_files = [item.get("file_name") for item in queue] if queue else []
            processed_files = result.get("processed_files", [])
            formatted_file_errors = format_file_errors(result.get("file_errors", []))
        else:
            counts = await CsvProcessingJobService.counts_by_status(db, project_id)
            locked = await CsvProcessingJobService.has_pending_jobs(db, project_id)
            if not locked:
                locked = await ProjectProcessingLeaseService.is_locked(
                    db, project_id=project_id
                )
            running_job = await CsvProcessingJobService.get_running_job(db, project_id)
            current_file = (
                {"file_name": running_job.source_filename or running_job.storage_path}
                if running_job
                else None
            )
            queued_files = await CsvProcessingJobService.list_file_names_by_status(
                db,
                project_id,
                statuses=[CsvProcessingJobStatus.queued],
            )
            processed_files = await CsvProcessingJobService.list_file_names_by_status(
                db,
                project_id,
                statuses=[
                    CsvProcessingJobStatus.succeeded, CsvProcessingJobStatus.failed
                ],
            )
            formatted_file_errors = format_file_errors(
                await CsvProcessingJobService.list_failed_jobs(db, project_id)
            )
        if testing_mode:
            uploaded_files = result.get("uploaded_files", [])
        else:
            uploaded_files = await CsvProcessingJobService.list_file_names_by_status(
                db,
                project_id,
                statuses=[
                    CsvProcessingJobStatus.queued,
                    CsvProcessingJobStatus.running,
                    CsvProcessingJobStatus.succeeded,
                    CsvProcessingJobStatus.failed,
                ],
            )

        uploaded_count = len(uploaded_files)
        processed_count = len(processed_files)
        validation_error = None

        if not testing_mode:
            if counts["running"] > 0:
                status = "processing"
            elif counts["queued"] > 0:
                status = "queued"
            elif status in {"processing", "queued"}:
                if uploaded_count > 0 and processed_count == uploaded_count:
                    status = "complete"
                else:
                    status = "idle"

        # In production, the DB job table is authoritative; do not declare a
        # "missing files" validation error based on ephemeral in-memory state.
        if testing_mode:
            if (
                status in {"complete", "idle"}
                and uploaded_count > 0
                and processed_count < uploaded_count
                and not queued_files
                and not current_file
            ):
                missing_count = uploaded_count - processed_count
                validation_error = (
                    f"{missing_count} CSV file(s) did not finish processing."
                )
                status = "error"

        if validation_error:
            return {
                "status": "error",
                "locked": locked,
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
                "currentFileName": (
                    current_file.get("file_name") if current_file else None
                ),
                "queuedFiles": queued_files,
                "queueLength": len(queued_files),
                "uploadedFiles": uploaded_files,
                "processedFiles": processed_files,
                "uploadedFileCount": uploaded_count,
                "processedFileCount": processed_count,
                "queuedJobs": counts["queued"],
                "runningJobs": counts["running"],
                "succeededJobs": counts["succeeded"],
                "failedJobs": counts["failed"],
                "validationError": validation_error,
                "fileErrors": formatted_file_errors,
            }

        if status == "complete" and uploaded_count == processed_count:
            keyword_count = await KeywordService.count_total_by_project(db, project_id)
            return {
                "status": "complete",
                "locked": locked,
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
                "currentFileName": (
                    current_file.get("file_name") if current_file else None
                ),
                "queuedFiles": queued_files,
                "queueLength": len(queued_files),
                "uploadedFiles": uploaded_files,
                "processedFiles": processed_files,
                "uploadedFileCount": uploaded_count,
                "processedFileCount": processed_count,
                "queuedJobs": counts["queued"],
                "runningJobs": counts["running"],
                "succeededJobs": counts["succeeded"],
                "failedJobs": counts["failed"],
                "validationError": validation_error,
                "fileErrors": formatted_file_errors,
            }
        return {
            "status": status,
            "locked": locked,
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
            "queuedJobs": counts["queued"],
            "runningJobs": counts["running"],
            "succeededJobs": counts["succeeded"],
            "failedJobs": counts["failed"],
            "validationError": validation_error,
            "fileErrors": formatted_file_errors,
        }
    except Exception as e:
        # Return a graceful error response instead of 500
        # This prevents error toast flooding on the frontend
        print(f"[ERROR] Processing status check failed for project {project_id}: {e}")
        traceback.print_exc()

        # Return an error status that the frontend can handle gracefully
        return {
            "status": "error",
            "locked": False,
            "keywordCount": 0,
            "processedCount": 0,
            "skippedCount": 0,
            "keywords": [],
            "complete": False,
            "totalRows": 0,
            "progress": 0,
            "message": f"Failed to check processing status: {str(e)}",
            "stage": None,
            "stageDetail": None,
            "currentFileName": None,
            "queuedFiles": [],
            "queueLength": 0,
            "uploadedFiles": [],
            "processedFiles": [],
            "uploadedFileCount": 0,
            "processedFileCount": 0,
            "queuedJobs": 0,
            "runningJobs": 0,
            "succeededJobs": 0,
            "failedJobs": 0,
            "validationError": f"Status check error: {str(e)}",
            "fileErrors": [],
        }


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

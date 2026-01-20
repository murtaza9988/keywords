"""
Keyword query routes - GET endpoints for retrieving keyword data.

Endpoints:
- GET /projects/{project_id}/keywords - Get keywords with pagination and filtering
- GET /projects/{project_id}/initial-data - Get initial project data with stats
- GET /projects/{project_id}/keywords-for-cache - Get keywords for client-side caching
- GET /projects/{project_id}/groups/{group_id}/children - Get children keywords by group
"""

import asyncio
import json
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Path, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.keyword import KeywordStatus
from app.routes.keyword_helpers import format_file_errors
from app.schemas.keyword import (
    KeywordChildrenResponse,
    KeywordListResponse,
    KeywordResponse,
    KeywordsCacheResponse,
)
from app.services.activity_log import ActivityLogService
from app.services.keyword import KeywordService
from app.services.processing_queue import processing_queue_service
from app.services.project import ProjectService
from app.utils.security import get_current_user

router = APIRouter(tags=["keywords"])


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
    formatted_file_errors = format_file_errors(processing_result.get("file_errors", []))
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

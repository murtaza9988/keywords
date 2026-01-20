"""
Keyword export routes - Endpoints for exporting and importing keyword data.

Endpoints:
- GET /projects/{project_id}/export-csv - Export keywords to CSV
- GET /projects/{project_id}/export-parent-keywords - Export parent keywords to CSV
- POST /projects/{project_id}/import-parent-keywords - Import parent keywords from CSV
"""

import csv
import io
from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.activity_log import ActivityLogService
from app.services.project import ProjectService
from app.utils.security import get_current_user

router = APIRouter(tags=["keywords"])


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

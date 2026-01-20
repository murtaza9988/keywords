"""
Keyword mutation routes - Endpoints for grouping and blocking operations.

Endpoints:
- POST /projects/{project_id}/group - Group keywords
- POST /projects/{project_id}/regroup - Regroup keywords
- POST /projects/{project_id}/ungroup - Ungroup keywords
- POST /projects/{project_id}/block-token - Block keywords by token
- POST /projects/{project_id}/unblock - Unblock keywords
- POST /projects/{project_id}/confirm - Confirm grouped keywords
- POST /projects/{project_id}/unconfirm - Unconfirm keywords
"""

import json
import time
import uuid
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.keyword import KeywordStatus
from app.routes.keyword_helpers import ensure_grouping_unlocked
from app.schemas.keyword import BlockTokenRequest, GroupRequest, UnblockRequest
from app.services.activity_log import ActivityLogService
from app.services.keyword import KeywordService
from app.services.merge_token import TokenMergeService
from app.utils.keyword_utils import keyword_cache
from app.utils.security import get_current_user

router = APIRouter(tags=["keywords"])


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
    await ensure_grouping_unlocked(db, project_id)
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


@router.post("/projects/{project_id}/regroup", status_code=status.HTTP_200_OK)
async def regroup_keywords(
    project_id: int,
    group_request: GroupRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Regroup selected keywords from multiple groups into a new or existing group."""
    await ensure_grouping_unlocked(db, project_id)
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
    await ensure_grouping_unlocked(db, project_id)
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


@router.post("/projects/{project_id}/confirm", status_code=status.HTTP_200_OK)
async def confirm_keywords(
    project_id: int,
    confirm_request: UnblockRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    await ensure_grouping_unlocked(db, project_id)
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
    await ensure_grouping_unlocked(db, project_id)
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

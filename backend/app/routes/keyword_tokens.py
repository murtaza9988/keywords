import asyncio
import json
import hashlib
import time
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text as sql_text
from app.database import get_db
from app.services.keyword import KeywordService
from app.services.merge_token import TokenMergeService
from app.services.project import ProjectService
from app.utils.security import get_current_user
from app.models.keyword import KeywordStatus
from app.schemas.keyword import (
    BlockTokensRequest, CreateTokenRequest, TokenData, TokenListResponse, UnblockTokensRequest, 
    MergeTokensRequest, UnmergeTokenRequest, PaginationInfo
)

# Cache configuration
_token_cache = {}
_CACHE_TTL = 300  # 5 minutes
_MAX_CACHE_SIZE = 1000

router = APIRouter(tags=["token"])

def _get_cache_key(project_id: int, view: str, page: int, limit: int, sort: str, 
                   direction: str, search: Optional[str], show_merged: bool, 
                   blocked_by: Optional[str]) -> str:
    """Generate cache key for token search results."""
    cache_data = {
        "project_id": project_id,
        "view": view,
        "page": page,
        "limit": limit,
        "sort": sort,
        "direction": direction,
        "search": search,
        "show_merged": show_merged,
        "blocked_by": blocked_by
    }
    cache_string = json.dumps(cache_data, sort_keys=True)
    return hashlib.md5(cache_string.encode()).hexdigest()

def _get_cached_result(cache_key: str) -> Optional[TokenListResponse]:
    """Get cached token search result if valid."""
    global _token_cache
    if cache_key in _token_cache:
        cached_data, timestamp, project_id = _token_cache[cache_key]
        if time.time() - timestamp < _CACHE_TTL:
            return cached_data
        else:
            del _token_cache[cache_key]
    return None

def _cache_result(cache_key: str, result: TokenListResponse, project_id: int):
    """Cache token search result."""
    global _token_cache
    _token_cache[cache_key] = (result, time.time(), project_id)
    
    # Cleanup old entries when cache gets too large
    if len(_token_cache) > _MAX_CACHE_SIZE:
        current_time = time.time()
        expired_keys = [
            key for key, (_, timestamp, _) in _token_cache.items()
            if current_time - timestamp >= _CACHE_TTL
        ]
        for key in expired_keys:
            _token_cache.pop(key, None)

def _invalidate_token_cache(project_id: int):
    """Invalidate all cached token results for a project."""
    global _token_cache
    keys_to_remove = []
    
    # Find all cache entries for this project
    for key, (_, _, cached_project_id) in _token_cache.items():
        if cached_project_id == project_id:
            keys_to_remove.append(key)
    
    # Remove all matching keys
    for key in keys_to_remove:
        _token_cache.pop(key, None)
    
    print(f"Invalidated {len(keys_to_remove)} cache entries for project {project_id}")

@router.get("/projects/{project_id}/tokens", response_model=TokenListResponse)
async def get_tokens(
    project_id: int,
    view: str = Query("all", enum=["current", "all", "blocked"]),
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=1000),
    sort: str = Query("volume", enum=["tokenName", "volume", "difficulty"]),
    direction: str = Query("desc", enum=["asc", "desc"]),
    search: Optional[str] = Query(None),
    show_merged: bool = Query(False),
    blocked_by: Optional[str] = Query(None, enum=["user", "system"]),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get tokens with precise parent-child relationships using optimized queries.
    Supports multiple token searches (comma-separated) with exact token matching.
    Includes caching for improved performance.
    """
    # Check cache first
    cache_key = _get_cache_key(project_id, view, page, limit, sort, direction, 
                              search, show_merged, blocked_by)
    cached_result = _get_cached_result(cache_key)
    if cached_result:
        return cached_result
    if view == "blocked":
        try:
            check_column_query = sql_text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'keywords' AND column_name = 'blocked_token'
                )
            """)
            column_exists_result = await db.execute(check_column_query)
            column_exists = column_exists_result.scalar_one()
            
            if column_exists:
                search_condition = ""
                query_params = {
                    "project_id": project_id,
                    "blocked_by": "user",
                    "limit": limit,
                    "offset": (page - 1) * limit
                }
                
                if search:
                    search_terms = [term.strip().lower() for term in search.split(",") if term.strip()]
                    if search_terms:
                        search_conditions = [f"blocked_token ILIKE :search_term_{i}" for i in range(len(search_terms))]
                        search_condition = f"AND ({' OR '.join(search_conditions)})"
                        for i, term in enumerate(search_terms):
                            query_params[f"search_term_{i}"] = f"%{term}%"
                            
                count_query = sql_text(f"""
                    SELECT COUNT(DISTINCT blocked_token)
                    FROM keywords
                    WHERE project_id = :project_id
                    AND status = 'blocked'
                    AND blocked_by = :blocked_by
                    AND blocked_token IS NOT NULL
                    {search_condition}
                """)
                
                count_result = await db.execute(count_query, query_params)
                total = count_result.scalar_one() or 0
                
                if total == 0:
                    return TokenListResponse(
                        tokens=[],
                        pagination=PaginationInfo(total=0, page=page, limit=limit, pages=0)
                    )
                    
                sort_mapping = {
                    "tokenName": "blocked_token",
                    "volume": "total_volume",
                    "difficulty": "avg_difficulty",
                    "count": "token_count"
                }
                sort_column = sort_mapping.get(sort, "total_volume")
                
                tokens_query = sql_text(f"""
                    WITH blocked_tokens AS (
                        SELECT DISTINCT blocked_token as token
                        FROM keywords
                        WHERE project_id = :project_id
                        AND status = 'blocked'
                        AND blocked_by = :blocked_by
                        AND blocked_token IS NOT NULL
                        {search_condition}
                        ORDER BY blocked_token
                        LIMIT :limit OFFSET :offset
                    ),
                    token_stats AS (
                        SELECT 
                            bt.token,
                            COUNT(DISTINCT k.id) AS token_count,
                            SUM(k.volume) AS total_volume,
                            AVG(k.difficulty) AS avg_difficulty
                        FROM blocked_tokens bt
                        LEFT JOIN keywords k ON 
                            k.project_id = :project_id 
                            AND k.status = 'blocked'
                            AND k.blocked_token = bt.token
                        GROUP BY bt.token
                    )
                    SELECT 
                        token,
                        token_count,
                        total_volume,
                        avg_difficulty
                    FROM token_stats
                    ORDER BY {sort_column} {direction}
                """)
                
                tokens_result = await db.execute(tokens_query, query_params)
                token_rows = tokens_result.fetchall()
                
                token_list = []
                for row in token_rows:
                    token, count, volume, difficulty = row
                    token_list.append(TokenData(
                        tokenName=token,
                        count=count or 0,
                        volume=volume or 0,
                        difficulty=difficulty or 0,
                        isParent=False,
                        hasChildren=False,
                        childTokens=[]
                    ))
                
                pages = (total + limit - 1) // limit if limit > 0 else 1
                return TokenListResponse(
                    tokens=token_list,
                    pagination=PaginationInfo(total=total, page=page, limit=limit, pages=pages)
                )
        except Exception as e:
            print(f"Error checking for blocked_token column: {e}")
            import traceback
            traceback.print_exc()
    
    # Handle non-blocked view with optimized queries
    statuses = [KeywordStatus.blocked] if view == "blocked" else [KeywordStatus.ungrouped, KeywordStatus.grouped]
    
    if view == "blocked" and blocked_by is None:
        blocked_by_filter = "user"
    else:
        blocked_by_filter = blocked_by
    
    # Get token relationships from merge operations using TokenMergeService
    token_relationships = await TokenMergeService.get_token_relationships(db, project_id)
    parent_tokens = set(token_relationships.keys())

    search_terms = []
    if search:
        search_terms = [
            term.strip().lower() for term in search.split(",")
            if term.strip()
        ]

    # Build base query conditions
    base_where_conditions = [
        "project_id = :project_id",
        "status = ANY(:statuses)"
    ]

    if view == "blocked" and blocked_by_filter:
        base_where_conditions.append("blocked_by = :blocked_by")

    base_where_clause = "WHERE " + " AND ".join(base_where_conditions)

    # Initialize query parameters
    query_params = {
        "project_id": project_id,
        "statuses": [s.value for s in statuses],
        "limit": limit,
        "offset": (page - 1) * limit
    }
    
    if view == "blocked" and blocked_by_filter:
        query_params["blocked_by"] = blocked_by_filter

    # Build search conditions for partial token matching
    search_conditions = []
    if search_terms:
        for i, term in enumerate(search_terms):
            search_conditions.append(
                f"EXISTS (SELECT 1 FROM jsonb_array_elements_text(tokens) AS token WHERE token ILIKE :keyword_search_token_{i})"
            )
            query_params[f"keyword_search_token_{i}"] = f"%{term}%"
        
        if search_conditions:
            base_where_clause += " AND (" + " OR ".join(search_conditions) + ")"

    # Define sort mapping first
    sort_mapping = {
        "tokenName": "token",
        "volume": "total_volume",
        "difficulty": "avg_difficulty",
        "count": "token_count"
    }
    
    # Build token filtering condition for partial matches
    token_filter_condition = ""
    if search_terms:
        token_filter_conditions = [
            f"token ILIKE :token_search_term_{i}" for i in range(len(search_terms))
        ]
        token_filter_condition = "WHERE (" + " OR ".join(token_filter_conditions) + ")"
        
        # Add search terms with wildcards for partial matching
        for i, term in enumerate(search_terms):
            query_params[f"token_search_term_{i}"] = f"%{term}%"

    # Optimized count query using GIN index
    count_query = f"""
        SELECT COUNT(DISTINCT token) AS total
        FROM (
            SELECT jsonb_array_elements_text(tokens) AS token
            FROM keywords
            {base_where_clause}
            AND jsonb_typeof(tokens) = 'array'
        ) token_list
        {token_filter_condition}
    """
    
    # Optimized token stats query with better performance
    token_stats_query = f"""
        WITH token_data AS (
            SELECT 
                jsonb_array_elements_text(tokens) AS token,
                id,
                volume,
                difficulty
            FROM keywords
            {base_where_clause}
            AND jsonb_typeof(tokens) = 'array'
        ),
        filtered_tokens AS (
            SELECT token, id, volume, difficulty
            FROM token_data
            {token_filter_condition}
        ),
        token_stats AS (
            SELECT 
                token,
                COUNT(DISTINCT id) AS token_count,
                SUM(COALESCE(volume, 0)) AS total_volume,
                AVG(COALESCE(difficulty, 0)) AS avg_difficulty
            FROM filtered_tokens
            GROUP BY token
        )
        SELECT 
            token,
            token_count,
            total_volume,
            avg_difficulty
        FROM token_stats
        ORDER BY {sort_mapping.get(sort, "total_volume")} {direction.upper()}, token
        LIMIT :limit OFFSET :offset
    """
    
    count_result = await db.execute(sql_text(count_query), query_params)
    total = count_result.scalar_one() or 0
    stats_result = await db.execute(sql_text(token_stats_query), query_params)
    token_rows = stats_result.fetchall()
    
    token_map = {}
    
    # Build token map with parent-child relationships from merge operations
    for row in token_rows:
        token, count, volume, difficulty = row
        is_parent = token in parent_tokens
        children = token_relationships.get(token, [])
        
        token_map[token] = {
            "tokenName": token,
            "volume": volume or 0,
            "difficulty": difficulty,
            "count": count,
            "isParent": is_parent,
            "hasChildren": len(children) > 0,
            "childTokens": children
        }

    token_list = [
        TokenData(
            tokenName=td["tokenName"],
            volume=td["volume"],
            difficulty=td["difficulty"],
            count=td["count"],
            isParent=td["isParent"],
            hasChildren=td["hasChildren"],
            childTokens=td["childTokens"]
        )
        for td in token_map.values()
        if (show_merged and td["isParent"]) or (not show_merged and (not td["isParent"] or td["hasChildren"]))
    ]
    
    pages = (total + limit - 1) // limit if limit > 0 else 1
    result = TokenListResponse(
        tokens=token_list,
        pagination=PaginationInfo(total=total, page=page, limit=limit, pages=pages)
    )
    
    # Cache the result
    _cache_result(cache_key, result, project_id)
    return result

@router.post("/projects/{project_id}/block-tokens", status_code=status.HTTP_200_OK)
async def block_tokens(
    project_id: int,
    block_request: BlockTokensRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not block_request.tokens or not all(t.strip() for t in block_request.tokens):
        raise HTTPException(status_code=400, detail="At least one valid token is required")

    tokens_to_block = [t.strip().lower() for t in block_request.tokens if t.strip()]
    try:
        total_updated = 0
        for token in tokens_to_block:
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
            
            result = await db.execute(update_query, {
                "project_id": project_id,
                "token": token,
                "blocked_token": token
            })
            
            updated_count = len(result.fetchall())
            total_updated += updated_count
        
        await db.commit()
        
        # Invalidate cache for this project
        _invalidate_token_cache(project_id)
        
        return {
            "message": f"Blocked {total_updated} keywords across {len(tokens_to_block)} tokens",
            "count": total_updated
        }
    except Exception as e:
        await db.rollback()
        print(f"Error blocking tokens: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to block tokens: {str(e)}")
@router.post("/projects/{project_id}/unblock-tokens", status_code=status.HTTP_200_OK)
async def unblock_tokens(
    project_id: int,
    unblock_request: UnblockTokensRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Unblock specific tokens."""
    if not unblock_request.tokens or not all(t.strip() for t in unblock_request.tokens):
        raise HTTPException(status_code=400, detail="At least one valid token is required")

    tokens_to_unblock = [t.strip().lower() for t in unblock_request.tokens if t.strip()]
    try:
        check_column_query = sql_text("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'keywords' AND column_name = 'blocked_token'
            )
        """)
        column_exists_result = await db.execute(check_column_query)
        column_exists = column_exists_result.scalar_one()
        
        total_updated = 0
        if column_exists:
            for token in tokens_to_unblock:
                unblock_query = sql_text("""
                    UPDATE keywords
                    SET status = 'ungrouped', 
                        blocked_by = NULL,
                        blocked_token = NULL
                    WHERE project_id = :project_id
                    AND status = 'blocked'
                    AND blocked_token = :token
                    RETURNING id
                """)
                
                result = await db.execute(unblock_query, {
                    "project_id": project_id,
                    "token": token
                })
                
                updated_count = len(result.fetchall())
                total_updated += updated_count
        else:
            for token in tokens_to_unblock:
                updated_count = await KeywordService.update_status_by_token(
                    db, 
                    project_id, 
                    token, 
                    new_status=KeywordStatus.ungrouped,
                    current_statuses=[KeywordStatus.blocked]
                )
                total_updated += updated_count
        
        await db.commit()
        
        # Invalidate cache for this project
        _invalidate_token_cache(project_id)
        
        return {
            "message": f"Unblocked {total_updated} keywords for {len(tokens_to_unblock)} tokens",
            "count": total_updated
        }
    except Exception as e:
        await db.rollback()
        print(f"Error unblocking tokens: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to unblock tokens: {str(e)}")
@router.post("/projects/{project_id}/merge-tokens", status_code=200)
async def merge_tokens_endpoint(
    project_id: int,
    merge_request: MergeTokensRequest,
    run_in_background: bool = Query(False),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Merge tokens using the new relational merge operations structure.
    Keywords can now participate in multiple merge operations.
    
    Enhanced with validation:
    - Prevents making existing parent tokens into child tokens (throws error)
    - Allows adding child tokens to existing parent tokens
    - Tracks all merge operations with full history
    """
    if not merge_request.child_tokens or not merge_request.parent_token:
        raise HTTPException(status_code=400, detail="Parent token and at least one child token are required")

    parent_token = merge_request.parent_token
    child_tokens = merge_request.child_tokens
    user_id = current_user.get("user_id") if current_user else None
    
    token_counts = []
    total_count = 0
    for token in child_tokens + [parent_token]:
        count = await TokenMergeService.count_by_token(db, project_id, token)
        count = count or 0  # Handle None case
        token_counts.append({"token": token, "count": count})
        total_count += count
    
    is_large_operation = total_count > 1000 or len(child_tokens) > 5
    if run_in_background or is_large_operation:
        from app.services.background_task import BackgroundTaskManager, merge_tokens_background
        import uuid
        
        task_id = f"merge_tokens_{uuid.uuid4()}"
        BackgroundTaskManager.start_task(
            task_id,
            merge_tokens_background(project_id, parent_token, child_tokens, user_id)
        )
        
        return {
            "message": f"Merging {len(child_tokens)} tokens into '{parent_token}' in background",
            "task_id": task_id,
            "background": True,
            "token_counts": token_counts
        }
    
    try:
        affected_count, grouped_count = await TokenMergeService.merge_tokens(
            db, project_id, parent_token, child_tokens, user_id
        )
        await db.commit()
        
        # Invalidate cache for this project
        _invalidate_token_cache(project_id)

        # Check if any keywords were actually affected
        if affected_count == 0:
            return {
                "message": f"No keywords found containing the specified tokens. Merge operation created for tracking purposes.",
                "count": len(child_tokens),
                "parent_token": parent_token,
                "affected_keywords": affected_count,
                "grouped_keywords": grouped_count,
                "token_counts": token_counts,
                "warning": "No keywords were actually modified"
            }
        else:
            return {
                "message": f"Successfully merged {len(child_tokens)} tokens into '{parent_token}' affecting {affected_count} keywords",
                "count": len(child_tokens),
                "parent_token": parent_token,
                "affected_keywords": affected_count,
                "grouped_keywords": grouped_count,
                "token_counts": token_counts
            }
    except ValueError as ve:
        # Handle validation errors (like trying to make parent token a child)
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        await db.rollback()
        print(f"Error merging tokens: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to merge tokens: {str(e)}")

@router.post("/projects/{project_id}/unmerge-token", status_code=200)
async def unmerge_token_endpoint(
    project_id: int,
    unmerge_request: UnmergeTokenRequest,
    run_in_background: bool = Query(False),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Unmerge a token and reset all keywords that use it back to their original state.
    Supports running in background for large operations.
    """
    if not unmerge_request.tokenName:
        raise HTTPException(status_code=400, detail="Token name is required")
    
    parent_token = unmerge_request.tokenName
    
    # Check count using merge operations table
    query = sql_text("""
        SELECT COUNT(*) 
        FROM keyword_merge_operations kmo
        JOIN merge_operations mo ON kmo.merge_operation_id = mo.id
        WHERE mo.project_id = :project_id 
        AND mo.parent_token = :parent_token
    """)
    
    result = await db.execute(query, {
        "project_id": project_id,
        "parent_token": parent_token
    })
    
    affected_count = result.scalar_one() or 0
    
    if affected_count == 0:
        raise HTTPException(
            status_code=404, 
            detail=f"No merged tokens found with parent '{parent_token}'"
        )
    
    if run_in_background or affected_count > 1000:
        from app.services.background_task import BackgroundTaskManager, unmerge_token_background
        import uuid
        
        task_id = f"unmerge_token_{uuid.uuid4()}"
        BackgroundTaskManager.start_task(
            task_id,
            unmerge_token_background(project_id, parent_token)
        )
        
        return {
            "message": f"Unmerging token '{parent_token}' in background",
            "task_id": task_id,
            "background": True,
            "affected_count": affected_count
        }
    
    try:
        affected_count, unmerged_groups = await TokenMergeService.unmerge_token(
            db, project_id, parent_token
        )
        
        await db.commit()
        
        # Invalidate cache for this project
        _invalidate_token_cache(project_id)

        return {
            "message": f"Successfully unmerged token '{parent_token}'",
            "affected_keywords": affected_count,
            "unmerged_groups": unmerged_groups
        }
    except Exception as e:
        await db.rollback()
        print(f"Error unmerging token: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to unmerge token: {str(e)}")

@router.post("/projects/{project_id}/unmerge-individual-token", status_code=200)
async def unmerge_individual_token_endpoint(
    project_id: int,
    parent_token: str = Query(..., description="The parent token of the merge group"),
    child_token: str = Query(..., description="The individual child token to unmerge"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Unmerge an individual child token from a parent token using the same logic as full unmerge.
    This will restore the child token in keywords that contain it and remove them from the merge operation.
    If this is the last child token, it will completely destroy the merge operation and restore everything.
    """
    if not parent_token or not child_token:
        raise HTTPException(status_code=400, detail="Both parent token and child token are required")
    
    try:
        find_merge_op_query = sql_text("""
            SELECT id, child_tokens
            FROM merge_operations
            WHERE project_id = :project_id 
            AND parent_token = :parent_token
            ORDER BY created_at DESC
            LIMIT 1
        """)
        
        result = await db.execute(find_merge_op_query, {
            "project_id": project_id,
            "parent_token": parent_token
        })
        
        merge_op = result.fetchone()
        if not merge_op:
            raise HTTPException(
                status_code=404, 
                detail=f"No merge operation found for parent token '{parent_token}'"
            )
        
        merge_op_id, child_tokens_json = merge_op
        child_tokens = json.loads(child_tokens_json) if isinstance(child_tokens_json, str) else child_tokens_json
        
        if child_token not in child_tokens:
            raise HTTPException(
                status_code=404,
                detail=f"Child token '{child_token}' not found in merge operation for parent '{parent_token}'"
            )
        
        remaining_child_tokens = [t for t in child_tokens if t != child_token]
        
        if not remaining_child_tokens:
            all_affected_tokens = [parent_token] + child_tokens
            affected_count = await TokenMergeService._unmerge_single_operation(db, merge_op_id)
            unhidden_count = await TokenMergeService._unhide_children_of_grouped_parents(
                db, project_id, all_affected_tokens
            )
            delete_merge_op_query = sql_text("""
                DELETE FROM merge_operations
                WHERE id = :merge_op_id
            """)
            await db.execute(delete_merge_op_query, {"merge_op_id": merge_op_id})
            grouped_count = await TokenMergeService._restructure_affected_keywords(
                db, project_id, all_affected_tokens
            )
            
            await db.commit()
            
            # Invalidate cache for this project
            _invalidate_token_cache(project_id)
            
            return {
                "message": f"Successfully unmerged last token '{child_token}' from '{parent_token}' - fully restored merge operation",
                "affected_keywords": affected_count + unhidden_count,
                "unmerged_groups": grouped_count,
                "remaining_child_tokens": [],
                "operation_destroyed": True
            }
        
        else:
            
            temp_merge_op_id = f"temp_{merge_op_id}_{child_token}"
            
            find_affected_keywords_query = sql_text("""
                SELECT kmo.keyword_id, kmo.original_tokens_snapshot, k.keyword
                FROM keyword_merge_operations kmo
                JOIN keywords k ON kmo.keyword_id = k.id
                WHERE kmo.merge_operation_id = :merge_op_id
                AND EXISTS (
                    SELECT 1 
                    FROM jsonb_array_elements_text(kmo.original_tokens_snapshot) AS original_token
                    WHERE original_token = :child_token
                )
            """)
            
            result = await db.execute(find_affected_keywords_query, {
                "merge_op_id": merge_op_id,
                "child_token": child_token
            })
            
            affected_keywords = result.fetchall()
            
            if not affected_keywords:
                raise HTTPException(
                    status_code=404,
                    detail=f"No keywords found containing '{child_token}' in this merge operation"
                )
            
            affected_count = 0
            affected_tokens = [child_token, parent_token]
            
            for keyword_id, original_tokens, keyword_text in affected_keywords:
                if original_tokens:
                    if isinstance(original_tokens, list):
                        original_tokens_list = original_tokens
                    else:
                        original_tokens_list = json.loads(original_tokens) if isinstance(original_tokens, str) else original_tokens
                    
                    if child_token in [str(token).lower().strip() for token in original_tokens_list]:
                        restore_query = sql_text("""
                            UPDATE keywords
                            SET tokens = :original_tokens
                            WHERE id = :keyword_id
                        """)
                        
                        await db.execute(restore_query, {
                            "keyword_id": keyword_id,
                            "original_tokens": json.dumps(original_tokens_list)
                        })
                        
                        delete_kmo_query = sql_text("""
                            DELETE FROM keyword_merge_operations
                            WHERE keyword_id = :keyword_id 
                            AND merge_operation_id = :merge_op_id
                        """)
                        
                        await db.execute(delete_kmo_query, {
                            "keyword_id": keyword_id,
                            "merge_op_id": merge_op_id
                        })
                        
                        affected_count += 1
            
            unhidden_count = await TokenMergeService._unhide_children_of_grouped_parents(
                db, project_id, affected_tokens
            )
            
            update_merge_op_query = sql_text("""
                UPDATE merge_operations
                SET child_tokens = :updated_child_tokens
                WHERE id = :merge_op_id
            """)
            
            await db.execute(update_merge_op_query, {
                "merge_op_id": merge_op_id,
                "updated_child_tokens": json.dumps(remaining_child_tokens)
            })
            
            grouped_count = await TokenMergeService._restructure_affected_keywords(
                db, project_id, affected_tokens
            )
            
            await db.commit()

            # Invalidate cache for this project
            _invalidate_token_cache(project_id)

            return {
                "message": f"Successfully unmerged token '{child_token}' from '{parent_token}'",
                "affected_keywords": affected_count + unhidden_count,
                "unmerged_groups": grouped_count,
                "remaining_child_tokens": remaining_child_tokens,
                "operation_destroyed": False
            }
        
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        print(f"Error unmerging individual token: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to unmerge token: {str(e)}")
@router.post("/projects/{project_id}/create-token", status_code=200)
async def create_token(
    project_id: int,
    request: CreateTokenRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new token from a search term and add it to all keywords containing that term.
    """
    if not request.search_term or not request.token_name:
        raise HTTPException(status_code=400, detail="Search term and token name are required")
    
    try:
        import time
        start_time = time.time()
        step1_start = time.time()
        affected_keywords = await KeywordService.find_keywords_by_text(db, project_id, request.search_term)
        step1_duration = time.time() - step1_start
        print(f"Step 1 (find_keywords_by_text) took {step1_duration:.2f} seconds, found {len(affected_keywords)} keywords")
        
        if not affected_keywords:
            raise HTTPException(status_code=404, detail=f"No keywords found containing '{request.search_term}'")
        step2_start = time.time()
        affected_count = await KeywordService.add_token_to_keywords(
            db, project_id, request.token_name, affected_keywords
        )
        step2_duration = time.time() - step2_start
        print(f"Step 2 (add_token_to_keywords) took {step2_duration:.2f} seconds, affected {affected_count} rows")
        
        commit_start = time.time()
        await db.commit()
        commit_duration = time.time() - commit_start
        print(f"Commit took {commit_duration:.2f} seconds")
        
        total_duration = time.time() - start_time
        print(f"Total execution time: {total_duration:.2f} seconds")
        
        return {
            "message": f"Successfully created token '{request.token_name}' from '{request.search_term}'",
            "affected_keywords": affected_count
        }
    except Exception as e:
        rollback_start = time.time()
        await db.rollback()
        rollback_duration = time.time() - rollback_start
        print(f"Rollback took {rollback_duration:.2f} seconds")
        print(f"Error creating token: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create token: {str(e)}")
    
@router.get("/projects/{project_id}/group-suggestions", response_model=List[str])
async def get_group_suggestions(
    project_id: int,
    search: str = Query("", min_length=1),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get group name suggestions based on input search term."""
    
    if not search or len(search.strip()) == 0:
        return []
    
    project = await ProjectService.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    search_term = search.strip().lower()
    query = sql_text("""
        WITH ranked_groups AS (
            SELECT 
                group_name,
                CASE WHEN LOWER(group_name) = :exact_match THEN 0
                     WHEN LOWER(group_name) LIKE :start_pattern THEN 1
                     ELSE 2
                END AS match_rank,
                LENGTH(group_name) AS name_length
            FROM keywords
            WHERE 
                project_id = :project_id
                AND status IN ('grouped', 'confirmed')
                AND is_parent = true
                AND group_name IS NOT NULL
                AND LOWER(group_name) LIKE :search_pattern
            GROUP BY group_name
        )
        SELECT group_name
        FROM ranked_groups
        ORDER BY match_rank, name_length, group_name
        LIMIT 10
    """)
    
    try:
        result = await db.execute(
            query,
            {
                "project_id": project_id,
                "search_pattern": f"%{search_term}%",
                "exact_match": search_term,
                "start_pattern": f"{search_term}%"
            }
        )
        
        suggestions = [row[0] for row in result.fetchall()]
        return suggestions
    except Exception as e:
        print(f"Error fetching group suggestions: {e}")
        return []
from sqlalchemy import text
@router.get("/projects/{project_id}/serp-features", status_code=status.HTTP_200_OK)
async def get_serp_features(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get unique SERP features for a project."""
    project = await ProjectService.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    try:
        # Get all serp_features values - use a safer approach
        query = text("""
            SELECT serp_features
            FROM keywords
            WHERE project_id = :project_id
            AND serp_features IS NOT NULL
        """)
        
        result = await db.execute(query, {"project_id": project_id})
        rows = result.fetchall()
        
        # Process in Python to handle JSONB data gracefully
        all_features = set()
        for row in rows:
            serp_features = row[0]
            if serp_features:
                try:
                    # Handle JSONB data (could be dict, list, or string)
                    if isinstance(serp_features, (list, dict)):
                        features_list = serp_features
                    elif isinstance(serp_features, str):
                        features_list = json.loads(serp_features)
                    else:
                        continue
                    
                    # Extract features from list
                    if isinstance(features_list, list):
                        for feature in features_list:
                            if feature and isinstance(feature, str):
                                all_features.add(feature)
                    # Handle case where it might be a dict
                    elif isinstance(features_list, dict):
                        # If it's a dict, try to extract values
                        for value in features_list.values():
                            if isinstance(value, str):
                                all_features.add(value)
                            elif isinstance(value, list):
                                for item in value:
                                    if isinstance(item, str):
                                        all_features.add(item)
                except (json.JSONDecodeError, TypeError, AttributeError):
                    # Skip invalid data
                    print(f"Skipping invalid serp_features: {serp_features}")
                    continue
        
        features = sorted(list(all_features))
        return {"features": features}
    except Exception as e:
        print(f"Error fetching SERP features: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch SERP features: {str(e)}")
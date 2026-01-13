import json
import uuid
from typing import List, Dict, Tuple, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, insert, update
from app.models.keyword import KeywordStatus
from app.models.merge_operation import KeywordMergeOperation, MergeOperation

class TokenMergeService:
    @staticmethod
    async def merge_tokens(
        db: AsyncSession, 
        project_id: int, 
        parent_token: str, 
        child_tokens: List[str],
        user_id: Optional[str] = None
    ) -> Tuple[int, int]:
        """
        Enhanced merge tokens function - PRESERVES all keyword statuses and parent relationships.
        Only modifies the tokens field, then restructures parent-child groups.
        """
        if not child_tokens or not parent_token:
            return 0, 0

        try:
            # 1. Handle Existing Parent Operations (Recursion check/Cleanup)
            # Find any operations where current child_tokens were parent_tokens
            existing_parent_query = text("""
                SELECT id, parent_token, child_tokens FROM merge_operations
                WHERE project_id = :project_id
                AND parent_token = ANY(:child_tokens)
            """)
            result = await db.execute(existing_parent_query, {
                "project_id": project_id,
                "child_tokens": child_tokens
            })
            existing_ops = result.fetchall()

            all_child_tokens = set(child_tokens)
            ops_to_delete = []

            for op_id, old_parent_token, existing_child_tokens_json in existing_ops:
                if existing_child_tokens_json:
                    existing_children = existing_child_tokens_json if isinstance(existing_child_tokens_json, list) else json.loads(existing_child_tokens_json)
                    all_child_tokens.update(existing_children)
                
                # Add the old parent token itself to the new child list
                all_child_tokens.add(old_parent_token)
                ops_to_delete.append(op_id)
            
            if ops_to_delete:
                await db.execute(text("DELETE FROM merge_operations WHERE id = ANY(:op_ids)"), {"op_ids": ops_to_delete})

            final_child_tokens = list(all_child_tokens)
            
            # 2. Get or Create Merge Operation
            operation_id = f"merge_{parent_token}_{uuid.uuid4().hex[:8]}"

            existing_merge_query = text("""
                SELECT id, child_tokens FROM merge_operations
                WHERE project_id = :project_id 
                AND parent_token = :parent_token
                ORDER BY created_at DESC
                LIMIT 1
            """)
            result = await db.execute(existing_merge_query, {
                "project_id": project_id,
                "parent_token": parent_token
            })
            existing_merge = result.fetchone()

            if existing_merge:
                merge_operation_id, existing_child_tokens_json = existing_merge
                existing_children = existing_child_tokens_json if isinstance(existing_child_tokens_json, list) else (json.loads(existing_child_tokens_json) if existing_child_tokens_json else [])
                
                # Merge lists
                final_child_tokens = list(set(existing_children + final_child_tokens))
                
                await db.execute(
                    text("UPDATE merge_operations SET child_tokens = :child_tokens WHERE id = :id"),
                    {"id": merge_operation_id, "child_tokens": json.dumps(final_child_tokens)}
                )
            else:
                merge_op = MergeOperation(
                    project_id=project_id,
                    parent_token=parent_token,
                    child_tokens=final_child_tokens,
                    operation_id=operation_id,
                    created_by=user_id
                )
                db.add(merge_op)
                await db.flush()
                merge_operation_id = merge_op.id

            # 3. Find Keywords to Update
            # Use GIN index to find keywords containing any child tokens
            find_keywords_query = text("""
                SELECT id, tokens
                FROM keywords
                WHERE project_id = :project_id
                AND tokens ?| :child_tokens
            """)
            result = await db.execute(find_keywords_query, {
                "project_id": project_id,
                "child_tokens": final_child_tokens
            })
            keywords_to_process = result.fetchall()

            if not keywords_to_process:
                return 0, 0

            # 4. Filter out keywords that already have this operation recorded
            keyword_ids = [k[0] for k in keywords_to_process]
            existing_ops_query = text("""
                SELECT keyword_id FROM keyword_merge_operations
                WHERE merge_operation_id = :merge_operation_id
                AND keyword_id = ANY(:keyword_ids)
            """)
            result = await db.execute(existing_ops_query, {
                "merge_operation_id": merge_operation_id,
                "keyword_ids": keyword_ids
            })
            existing_keyword_ids = set(r[0] for r in result.fetchall())

            new_keyword_ops = []
            keywords_to_update_ids = []

            for kw_id, current_tokens in keywords_to_process:
                if kw_id in existing_keyword_ids:
                    continue

                new_keyword_ops.append({
                    "keyword_id": kw_id,
                    "merge_operation_id": merge_operation_id,
                    "original_tokens_snapshot": current_tokens
                })
                keywords_to_update_ids.append(kw_id)

            if new_keyword_ops:
                # Bulk Insert Keyword Operations
                await db.execute(insert(KeywordMergeOperation), new_keyword_ops)

                # Bulk Update Keywords
                # We use a SQL-based update to avoid python loops for token replacement
                # This complex query replaces occurrences of any child_token with parent_token
                update_query = text("""
                    UPDATE keywords
                    SET tokens = (
                        SELECT jsonb_agg(
                            CASE
                                WHEN elem::text = ANY(:child_tokens_quoted) THEN :parent_token
                                ELSE elem::text
                            END
                        )
                        FROM jsonb_array_elements_text(tokens) AS elem
                    )
                    WHERE id = ANY(:keyword_ids)
                """)

                # Format tokens for SQL array (text comparison needs quotes effectively handled by parameter binding)
                # But here we are comparing against raw text values from jsonb_array_elements_text
                await db.execute(update_query, {
                    "child_tokens_quoted": final_child_tokens, # SQLAlchemy handles list -> ARRAY conversion
                    "parent_token": parent_token,
                    "keyword_ids": keywords_to_update_ids
                })

            affected_count = len(keywords_to_update_ids)

            # 5. Restructure Groups (Optimized)
            grouped_count = await TokenMergeService._restructure_affected_keywords(db, project_id, final_child_tokens + [parent_token])

            # 6. Handle hidden parents
            hidden_count = await TokenMergeService._handle_ungrouped_matching_grouped_parents(db, project_id, final_child_tokens + [parent_token])

            return affected_count, grouped_count

        except ValueError as ve:
            raise ve
        except Exception as e:
            await db.rollback()
            print(f"Error in merge_tokens: {e}")
            import traceback
            traceback.print_exc()
            return 0, 0

    @staticmethod
    async def unmerge_token(
        db: AsyncSession, 
        project_id: int, 
        parent_token: str
    ) -> Tuple[int, int]:
        """
        Unmerge all operations for a specific parent token, then restructure parent-child groups.
        Ensures complete restoration of all affected keywords.
        """
        try:
            # STEP 1: Get merge operations
            merge_ops_query = text("""
                SELECT id, child_tokens FROM merge_operations
                WHERE project_id = :project_id 
                AND parent_token = :parent_token
            """)
            result = await db.execute(merge_ops_query, {
                "project_id": project_id,
                "parent_token": parent_token
            })
            merge_operations = result.fetchall()
            
            if not merge_operations:
                return 0, 0

            # STEP 2: Collect ALL affected tokens
            all_affected_tokens = [parent_token]
            merge_operation_ids = []
            
            for merge_op_id, child_tokens_json in merge_operations:
                merge_operation_ids.append(merge_op_id)
                if child_tokens_json:
                    child_tokens = child_tokens_json if isinstance(child_tokens_json, list) else json.loads(child_tokens_json)
                    all_affected_tokens.extend(child_tokens)
            
            all_affected_tokens = list(set(all_affected_tokens))

            # STEP 3: Bulk Restore Tokens
            # Update keywords table directly from keyword_merge_operations
            bulk_restore_query = text("""
                UPDATE keywords k
                SET tokens = kmo.original_tokens_snapshot
                FROM keyword_merge_operations kmo
                WHERE k.id = kmo.keyword_id
                AND kmo.merge_operation_id = ANY(:merge_op_ids)
                AND kmo.original_tokens_snapshot IS NOT NULL
            """)

            result = await db.execute(bulk_restore_query, {
                "merge_op_ids": merge_operation_ids
            })
            total_restored = result.rowcount

            # STEP 4: Clean up operation records
            await db.execute(
                text("DELETE FROM keyword_merge_operations WHERE merge_operation_id = ANY(:merge_op_ids)"),
                {"merge_op_ids": merge_operation_ids}
            )

            # STEP 5: Restore hidden children
            unhidden_count = await TokenMergeService._unhide_children_of_grouped_parents(db, project_id, all_affected_tokens)

            # STEP 6: Delete the merge operations
            await db.execute(
                text("DELETE FROM merge_operations WHERE id = ANY(:merge_op_ids)"),
                {"merge_op_ids": merge_operation_ids}
            )

            # STEP 7: Restructure affected keywords
            grouped_count = await TokenMergeService._restructure_affected_keywords(db, project_id, all_affected_tokens)

            return total_restored + unhidden_count, grouped_count

        except Exception as e:
            print(f"Error during token unmerging: {e}")
            await db.rollback()
            return 0, 0

    # Deprecated single operation unmerge (kept for interface compatibility if needed, but not used in optimized flow)
    @staticmethod
    async def _unmerge_single_operation(db: AsyncSession, merge_operation_id: int) -> int:
        return 0

    @staticmethod
    async def _restructure_affected_keywords(db: AsyncSession, project_id: int, affected_tokens: List[str]) -> int:
        """
        Restructure only keywords that contain any of the specified tokens.
        Optimized to fetch only relevant keywords using GIN index.
        """
        try:
            # 1. Fetch only relevant keywords using Index
            keywords_query = text("""
                SELECT id, keyword, tokens, volume, difficulty, serp_features, original_volume, status
                FROM keywords 
                WHERE project_id = :project_id
                AND tokens ?| :affected_tokens
                AND status != 'grouped'
            """)
            result = await db.execute(keywords_query, {
                "project_id": project_id,
                "affected_tokens": affected_tokens
            })
            affected_keywords = result.fetchall()

            if not affected_keywords:
                return 0

            # 2. Group by Token Sets (Python side)
            token_groups = {}
            for kw in affected_keywords:
                if not kw.tokens: continue

                try:
                    tokens_list = kw.tokens if isinstance(kw.tokens, list) else json.loads(kw.tokens)
                    normalized_tokens = sorted(list(set([str(token).lower().strip() for token in tokens_list])))
                    token_key = json.dumps(normalized_tokens)
                    
                    if token_key not in token_groups:
                        token_groups[token_key] = []
                    
                    token_groups[token_key].append({
                        'id': kw.id,
                        'keyword': kw.keyword,
                        'tokens': normalized_tokens,
                        'volume': kw.volume or 0,
                        'difficulty': kw.difficulty or 0.0,
                        'original_volume': kw.original_volume or kw.volume or 0,
                        'status': kw.status
                    })
                except Exception:
                    continue

            updates_to_apply = []
            group_count = 0

            # 3. Process Groups
            for token_key, group_members in token_groups.items():
                if len(group_members) < 1: continue

                new_group_id = f"group_{project_id}_{uuid.uuid4().hex}"
                unique_sorted_tokens = json.loads(token_key)

                # We need global volume for this token set
                # (Optimized: we could cache this if called frequently, but single SQL query is fast enough)
                all_group_keywords_query = text("""
                    SELECT SUM(COALESCE(original_volume, volume, 0)) as total_vol
                    FROM keywords
                    WHERE project_id = :project_id
                    AND tokens = :tokens_json
                """)
                vol_result = await db.execute(all_group_keywords_query, {
                    "project_id": project_id,
                    "tokens_json": json.dumps(unique_sorted_tokens)
                })
                total_volume = vol_result.scalar() or 0
                
                if len(group_members) == 1:
                    # Single keyword -> Parent
                    kw = group_members[0]
                    updates_to_apply.append({
                        'id': kw['id'],
                        'group_id': new_group_id,
                        'group_name': kw['keyword'],
                        'is_parent': True,
                        'volume': total_volume,
                        'difficulty': kw['difficulty'],
                        'status': kw['status']
                    })
                    group_count += 1
                else:
                    # Multiple keywords -> Parent + Children
                    group_members.sort(key=lambda k: (-k['original_volume'], k['difficulty']))
                    difficulties = [k['difficulty'] for k in group_members if k['difficulty'] is not None and k['difficulty'] > 0]
                    avg_difficulty = round(sum(difficulties) / len(difficulties), 2) if difficulties else 0.0
                    
                    for i, kw in enumerate(group_members):
                        is_parent = (i == 0)
                        updates_to_apply.append({
                            'id': kw['id'],
                            'group_id': new_group_id,
                            'group_name': kw['keyword'] if is_parent else None,
                            'is_parent': is_parent,
                            'volume': total_volume if is_parent else kw['original_volume'],
                            'difficulty': avg_difficulty if is_parent else kw['difficulty'],
                            'status': kw['status']
                        })
                    group_count += 1

            # 4. Bulk Update
            if updates_to_apply:
                batch_size = 500
                for i in range(0, len(updates_to_apply), batch_size):
                    batch = updates_to_apply[i:i + batch_size]
                    
                    # We can use executemany with a bound parameter list for UPDATE
                    # But SQLAlchemy 'update' with bind params is cleaner
                    await db.execute(
                        text("""
                            UPDATE keywords 
                            SET group_id = :group_id,
                                group_name = :group_name,
                                is_parent = :is_parent,
                                volume = :volume,
                                difficulty = :difficulty,
                                status = :status
                            WHERE id = :id
                        """),
                        batch
                    )
            
            return group_count

        except Exception as e:
            print(f"Error during affected keyword restructuring: {e}")
            import traceback
            traceback.print_exc()
            return 0

    @staticmethod
    async def _handle_ungrouped_matching_grouped_parents(db: AsyncSession, project_id: int, affected_tokens: List[str]) -> int:
        """
        Find ungrouped keywords that now have the same tokens as grouped parent keywords
        and make them completely invisible children.
        """
        try:
            # Optimize: Join logic into a single UPDATE from SELECT
            # Find ungrouped keywords that share tokens with a grouped parent

            # This is complex to do in pure SQL due to JSONB equality checks on arrays that might be ordered differently
            # But we can try to find candidates first

            grouped_parents_query = text("""
                SELECT id, tokens, group_id, group_name
                FROM keywords 
                WHERE project_id = :project_id
                AND status = 'grouped'
                AND is_parent = true
                AND tokens ?| :affected_tokens
            """)
            result = await db.execute(grouped_parents_query, {
                "project_id": project_id,
                "affected_tokens": affected_tokens
            })
            grouped_parents = result.fetchall()

            if not grouped_parents:
                return 0

            count = 0
            for parent_id, parent_tokens, parent_group_id, parent_group_name in grouped_parents:
                # Match ungrouped keywords with SAME tokens
                # We assume tokens are sorted/normalized in DB, but let's be safe
                if not parent_tokens: continue

                # Logic: Update ungrouped keywords that have exactly these tokens

                # Prepare original state json
                # We can't do this purely in SQL easily because we need to snapshot the CURRENT state of the ungrouped keyword

                matching_query = text("""
                    SELECT id, keyword, volume, difficulty, original_volume, status, tokens
                    FROM keywords
                    WHERE project_id = :project_id
                    AND status = 'ungrouped'
                    AND tokens = :parent_tokens
                    AND id != :parent_id
                """)

                matches = await db.execute(matching_query, {
                    "project_id": project_id,
                    "parent_tokens": parent_tokens if isinstance(parent_tokens, str) else json.dumps(parent_tokens),
                    "parent_id": parent_id
                })

                keywords_to_hide = matches.fetchall()
                if not keywords_to_hide: continue

                ids_to_hide = []
                volume_sum = 0

                for kw in keywords_to_hide:
                    ids_to_hide.append(kw.id)
                    volume = kw.original_volume or kw.volume or 0
                    volume_sum += volume

                    # Store state individually
                    original_state = {
                        "keyword": kw.keyword,
                        "volume": volume,
                        "difficulty": kw.difficulty,
                        "tokens": kw.tokens,
                        "is_parent": False,
                        "group_id": None,
                        "group_name": None,
                        "status": kw.status,
                        "merge_hidden": True
                    }

                    await db.execute(text("UPDATE keywords SET original_state = :os WHERE id = :id"), {
                        "os": json.dumps(original_state),
                        "id": kw.id
                    })

                # Bulk update to hide
                if ids_to_hide:
                    await db.execute(text("""
                        UPDATE keywords
                        SET group_id = :group_id,
                            group_name = NULL,
                            is_parent = false,
                            status = 'grouped',
                            blocked_by = 'merge_hidden'
                        WHERE id = ANY(:ids)
                    """), {
                        "group_id": parent_group_id,
                        "ids": ids_to_hide
                    })

                    # Update parent volume
                    await db.execute(text("""
                        UPDATE keywords
                        SET volume = volume + :vol
                        WHERE id = :parent_id
                    """), {
                        "vol": volume_sum,
                        "parent_id": parent_id
                    })

                    count += len(ids_to_hide)

            return count

        except Exception as e:
            print(f"Error handling ungrouped matching grouped parents: {e}")
            return 0

    @staticmethod
    async def _unhide_children_of_grouped_parents(db: AsyncSession, project_id: int, affected_tokens: List[str]) -> int:
        """
        Find merge-hidden children and restore them to their original ungrouped state.
        """
        try:
            # Find hidden children that contain affected tokens
            hidden_children_query = text("""
                SELECT k.id, k.original_state, k.original_volume, k.volume, k.group_id
                FROM keywords k
                WHERE k.project_id = :project_id
                AND k.blocked_by = 'merge_hidden'
                AND k.tokens ?| :affected_tokens
            """)
            result = await db.execute(hidden_children_query, {
                "project_id": project_id,
                "affected_tokens": affected_tokens
            })
            hidden_children = result.fetchall()

            if not hidden_children:
                return 0

            count = 0

            # Group by parent to update volumes efficiently
            parent_volume_reductions = {} # group_id -> volume_reduction

            for kw_id, original_state_json, orig_vol, curr_vol, group_id in hidden_children:
                vol_to_reduce = orig_vol or curr_vol or 0

                if group_id:
                    parent_volume_reductions[group_id] = parent_volume_reductions.get(group_id, 0) + vol_to_reduce

                # Restore keyword
                try:
                    if original_state_json:
                        state = json.loads(original_state_json)
                        # Only restore if it was merge_hidden
                        if state.get("merge_hidden"):
                             await db.execute(text("""
                                UPDATE keywords 
                                SET group_id = :gid,
                                    group_name = :gn,
                                    is_parent = :ip,
                                    status = :st,
                                    volume = :vol,
                                    difficulty = :diff,
                                    original_state = NULL,
                                    blocked_by = NULL
                                WHERE id = :id
                            """), {
                                "id": kw_id,
                                "gid": state.get("group_id"),
                                "gn": state.get("group_name"),
                                "ip": state.get("is_parent", False),
                                "st": state.get("status", "ungrouped"),
                                "vol": state.get("volume", vol_to_reduce),
                                "diff": state.get("difficulty", 0.0)
                            })
                             count += 1
                except:
                    # Fallback
                    await db.execute(text("""
                        UPDATE keywords
                        SET group_id = NULL, group_name = NULL, is_parent = false, status = 'ungrouped', blocked_by = NULL
                        WHERE id = :id
                    """), {"id": kw_id})
                    count += 1

            # Update parent volumes
            for group_id, reduction in parent_volume_reductions.items():
                await db.execute(text("""
                    UPDATE keywords
                    SET volume = GREATEST(0, volume - :reduction)
                    WHERE group_id = :group_id AND is_parent = true
                """), {
                    "reduction": reduction,
                    "group_id": group_id
                })

            return count

        except Exception as e:
            print(f"Error unhiding children: {e}")
            return 0

    # Helper methods (get_token_relationships, etc.) remain the same
    @staticmethod
    async def get_token_relationships(db: AsyncSession, project_id: int) -> Dict[str, List[str]]:
        """Get parent-child token relationships for the tokens API."""
        query = text("""
            SELECT DISTINCT 
                mo.parent_token,
                jsonb_array_elements_text(mo.child_tokens) as child_token
            FROM merge_operations mo
            WHERE mo.project_id = :project_id
        """)
        result = await db.execute(query, {"project_id": project_id})
        relationships = {}
        for row in result.fetchall():
            parent_token, child_token = row
            if parent_token not in relationships:
                relationships[parent_token] = []
            if child_token not in relationships[parent_token]:
                relationships[parent_token].append(child_token)
        return relationships

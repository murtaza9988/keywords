import json
import uuid
from typing import List, Dict, Tuple, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.models.keyword import  KeywordStatus

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
            existing_parent_operations = {}
            for child_token in child_tokens:
                existing_parent_query = text("""
                    SELECT id, child_tokens FROM merge_operations
                    WHERE project_id = :project_id
                    AND parent_token = :child_token
                """)
                result = await db.execute(existing_parent_query, {
                    "project_id": project_id,
                    "child_token": child_token
                })
                existing_ops = result.fetchall()
                if existing_ops:
                    existing_parent_operations[child_token] = existing_ops

            all_child_tokens = child_tokens.copy()
            for old_parent_token, operations in existing_parent_operations.items():
                for op_id, existing_child_tokens_json in operations:
                    if existing_child_tokens_json:
                        if isinstance(existing_child_tokens_json, list):
                            existing_children = existing_child_tokens_json
                        else:
                            existing_children = json.loads(existing_child_tokens_json)
                        all_child_tokens.extend(existing_children)
                    
                    delete_old_parent_query = text("""
                        DELETE FROM merge_operations WHERE id = :op_id
                    """)
                    await db.execute(delete_old_parent_query, {"op_id": op_id})
                
                if old_parent_token not in all_child_tokens:
                    all_child_tokens.append(old_parent_token)
            
            all_child_tokens = list(set(all_child_tokens))
            
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
                
                if existing_child_tokens_json:
                    if isinstance(existing_child_tokens_json, list):
                        existing_child_tokens = existing_child_tokens_json
                    else:
                        existing_child_tokens = json.loads(existing_child_tokens_json)
                else:
                    existing_child_tokens = []
                
                combined_child_tokens = list(set(existing_child_tokens + all_child_tokens))
                update_merge_query = text("""
                    UPDATE merge_operations
                    SET child_tokens = :child_tokens
                    WHERE id = :merge_operation_id
                """)
                await db.execute(update_merge_query, {
                    "merge_operation_id": merge_operation_id,
                    "child_tokens": json.dumps(combined_child_tokens)
                })
                final_child_tokens = combined_child_tokens
            else:
                # Use ORM model to create merge operation
                from app.models.merge_operation import MergeOperation
                merge_operation = MergeOperation(
                    project_id=project_id,
                    parent_token=parent_token,
                    child_tokens=all_child_tokens,
                    operation_id=operation_id,
                    created_by=user_id
                )
                db.add(merge_operation)
                await db.flush()  # This will generate the ID
                merge_operation_id = merge_operation.id
                final_child_tokens = all_child_tokens

            find_keywords_query = text("""
                SELECT DISTINCT k.id, k.tokens
                FROM keywords k
                WHERE k.project_id = :project_id
                AND k.tokens ?| :child_tokens
            """)
            result = await db.execute(find_keywords_query, {
                "project_id": project_id,
                "child_tokens": final_child_tokens
            })
            keywords_to_process = result.fetchall()
            affected_count = 0

            for keyword_id, current_tokens in keywords_to_process:
                existing_entry_query = text("""
                    SELECT id FROM keyword_merge_operations
                    WHERE keyword_id = :keyword_id 
                    AND merge_operation_id = :merge_operation_id
                """)
                existing_result = await db.execute(existing_entry_query, {
                    "keyword_id": keyword_id,
                    "merge_operation_id": merge_operation_id
                })
                if existing_result.fetchone():
                    continue
                
                # Use ORM model to create keyword merge operation
                from app.models.merge_operation import KeywordMergeOperation
                keyword_merge_op = KeywordMergeOperation(
                    keyword_id=keyword_id,
                    merge_operation_id=merge_operation_id,
                    original_tokens_snapshot=current_tokens
                )
                db.add(keyword_merge_op)

                if isinstance(current_tokens, list):
                    tokens_list = current_tokens
                else:
                    tokens_list = json.loads(current_tokens) if current_tokens else []
                updated_tokens = [parent_token if token in final_child_tokens else token for token in tokens_list]
                update_keyword_query = text("""
                    UPDATE keywords
                    SET tokens = :updated_tokens
                    WHERE id = :keyword_id
                """)
                await db.execute(update_keyword_query, {
                    "keyword_id": keyword_id,
                    "updated_tokens": json.dumps(updated_tokens)
                })
                affected_count += 1

            grouped_count = await TokenMergeService._restructure_affected_keywords(db, project_id, final_child_tokens + [parent_token])
            hidden_count = await TokenMergeService._handle_ungrouped_matching_grouped_parents(db, project_id, final_child_tokens + [parent_token])

            return affected_count, grouped_count

        except ValueError as ve:
            raise ve
        except Exception as e:
            await db.rollback()
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
            # STEP 1: Get merge operations AND their child tokens BEFORE deleting anything
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

            # STEP 2: Collect ALL affected tokens before any deletion
            all_affected_tokens = [parent_token]
            merge_operation_ids = []
            
            for merge_op_id, child_tokens_json in merge_operations:
                merge_operation_ids.append(merge_op_id)
                if child_tokens_json:
                    if isinstance(child_tokens_json, list):
                        child_tokens = child_tokens_json
                    else:
                        child_tokens = json.loads(child_tokens_json)
                    all_affected_tokens.extend(child_tokens)
            
            # Remove duplicates
            all_affected_tokens = list(set(all_affected_tokens))
            print(f"All affected tokens: {all_affected_tokens}")

            # STEP 3: Restore original tokens for all affected keywords
            total_affected = 0
            for merge_op_id in merge_operation_ids:
                affected_count = await TokenMergeService._unmerge_single_operation(db, merge_op_id)
                total_affected += affected_count

            # STEP 4: Restore hidden children to their original state
            unhidden_count = await TokenMergeService._unhide_children_of_grouped_parents(db, project_id, all_affected_tokens)
            print(f"Restored {unhidden_count} hidden children")

            # STEP 5: Now delete the merge operations (after restoration is complete)
            delete_merge_ops_query = text("""
                DELETE FROM merge_operations
                WHERE project_id = :project_id 
                AND parent_token = :parent_token
            """)
            await db.execute(delete_merge_ops_query, {
                "project_id": project_id,
                "parent_token": parent_token
            })

            # STEP 6: Restructure affected keywords
            grouped_count = await TokenMergeService._restructure_affected_keywords(db, project_id, all_affected_tokens)

            print(f"Unmerge completed: {total_affected} tokens restored, {unhidden_count} hidden children restored, {grouped_count} groups restructured")
            
            return total_affected + unhidden_count, grouped_count

        except Exception as e:
            print(f"Error during token unmerging: {e}")
            await db.rollback()
            return 0, 0
    @staticmethod
    async def _unmerge_single_operation(db: AsyncSession, merge_operation_id: int) -> int:
        """Helper method to unmerge a single merge operation."""
        keyword_ops_query = text("""
            SELECT kmo.keyword_id, kmo.original_tokens_snapshot
            FROM keyword_merge_operations kmo
            WHERE kmo.merge_operation_id = :merge_operation_id
        """)
        result = await db.execute(keyword_ops_query, {
            "merge_operation_id": merge_operation_id
        })
        keyword_operations = result.fetchall()
        affected_count = 0

        for keyword_id, original_tokens in keyword_operations:
            if original_tokens:
                update_query = text("""
                    UPDATE keywords
                    SET tokens = :original_tokens
                    WHERE id = :keyword_id
                """)
                await db.execute(update_query, {
                    "keyword_id": keyword_id,
                    "original_tokens": json.dumps(original_tokens)
                })
                affected_count += 1

        delete_keyword_ops_query = text("""
            DELETE FROM keyword_merge_operations
            WHERE merge_operation_id = :merge_operation_id
        """)
        await db.execute(delete_keyword_ops_query, {
            "merge_operation_id": merge_operation_id
        })

        return affected_count

    @staticmethod
    async def _restructure_affected_keywords(db: AsyncSession, project_id: int, affected_tokens: List[str]) -> int:
        """
        Restructure only keywords that contain any of the specified tokens.
        EXCLUDES keywords with 'grouped' status to preserve existing parent-child relationships.
        """
        try:
            keywords_query = text("""
                SELECT id, keyword, tokens, volume, difficulty, serp_features, original_volume, status
                FROM keywords 
                WHERE project_id = :project_id
                AND tokens IS NOT NULL
                AND tokens != '[]'
                AND tokens != 'null'
                AND status != 'grouped'
            """)
            result = await db.execute(keywords_query, {"project_id": project_id})
            all_keywords = result.fetchall()

            # Filter keywords that contain any of the affected tokens
            affected_keywords = []
            for kw in all_keywords:
                if kw.tokens:
                    try:
                        if isinstance(kw.tokens, list):
                            tokens_list = kw.tokens
                        else:
                            tokens_list = json.loads(kw.tokens) if isinstance(kw.tokens, str) else []
                        
                        # Check if any of the affected tokens are in this keyword's tokens
                        if any(token.lower().strip() in [t.lower().strip() for t in tokens_list] for token in affected_tokens):
                            affected_keywords.append(kw)
                    except (json.JSONDecodeError, TypeError):
                        continue

            if not affected_keywords:
                return 0

            token_groups = {}
            for kw in affected_keywords:
                if kw.tokens:
                    if isinstance(kw.tokens, list):
                        normalized_tokens = [str(token).lower().strip() for token in kw.tokens]
                    else:
                        tokens_list = json.loads(kw.tokens) if isinstance(kw.tokens, str) else kw.tokens
                        normalized_tokens = [str(token).lower().strip() for token in tokens_list]
                    
                    unique_sorted_tokens = sorted(list(set(normalized_tokens)))
                    
                    token_key = json.dumps(unique_sorted_tokens)
                    
                    if token_key not in token_groups:
                        token_groups[token_key] = []
                    
                    token_groups[token_key].append({
                        'id': kw.id,
                        'keyword': kw.keyword,
                        'tokens': unique_sorted_tokens,
                        'volume': kw.volume or 0,
                        'difficulty': kw.difficulty or 0.0,
                        'serp_features': kw.serp_features,
                        'original_volume': kw.original_volume or kw.volume or 0,
                        'status': kw.status
                    })

            updates_to_apply = []
            group_count = 0

            for token_key, group_members in token_groups.items():
                new_group_id = f"group_{project_id}_{uuid.uuid4().hex}"
                unique_sorted_tokens = json.loads(token_key)
                # Query all keywords (grouped or not) with the same tokens
                all_group_keywords_query = text("""
                    SELECT original_volume, volume
                    FROM keywords
                    WHERE project_id = :project_id
                    AND tokens = :tokens_json
                """)
                all_group_keywords_result = await db.execute(all_group_keywords_query, {
                    "project_id": project_id,
                    "tokens_json": json.dumps(unique_sorted_tokens)
                })
                all_group_keywords = all_group_keywords_result.fetchall()
                total_volume = sum((row.original_volume or row.volume or 0) for row in all_group_keywords)
                
                if len(group_members) == 1:
                    keyword_data = group_members[0]
                    updates_to_apply.append({
                        'id': keyword_data['id'],
                        'group_id': new_group_id,
                        'group_name': keyword_data['keyword'],
                        'is_parent': True,
                        'volume': total_volume,  # Use the correct total_volume
                        'difficulty': keyword_data['difficulty'],
                        'status': keyword_data['status']
                    })
                    group_count += 1
                    
                else:
                    group_members.sort(key=lambda k: (-k['original_volume'], k['difficulty']))
                    difficulties = [k['difficulty'] for k in group_members if k['difficulty'] is not None and k['difficulty'] > 0]
                    avg_difficulty = round(sum(difficulties) / len(difficulties), 2) if difficulties else 0.0
                    
                    for i, keyword_data in enumerate(group_members):
                        is_parent = (i == 0) 
                        
                        if is_parent:
                            volume_to_use = total_volume  # Use the correct total_volume
                            difficulty_to_use = avg_difficulty
                            group_name = keyword_data['keyword']
                        else:
                            volume_to_use = keyword_data['original_volume']
                            difficulty_to_use = keyword_data['difficulty']
                            group_name = None
                        
                        updates_to_apply.append({
                            'id': keyword_data['id'],
                            'group_id': new_group_id,
                            'group_name': group_name,
                            'is_parent': is_parent,
                            'volume': volume_to_use,
                            'difficulty': difficulty_to_use,
                            'status': keyword_data['status']
                        })
                    
                    group_count += 1

            if updates_to_apply:
                batch_size = 100
                for i in range(0, len(updates_to_apply), batch_size):
                    batch = updates_to_apply[i:i + batch_size]
                    
                    for update in batch:
                        update_query = text("""
                            UPDATE keywords 
                            SET group_id = :group_id,
                                group_name = :group_name,
                                is_parent = :is_parent,
                                volume = :volume,
                                difficulty = :difficulty,
                                status = :status
                            WHERE id = :id
                        """)
                        await db.execute(update_query, {
                            'id': update['id'],
                            'group_id': update['group_id'],
                            'group_name': update['group_name'],
                            'is_parent': update['is_parent'],
                            'volume': update['volume'],
                            'difficulty': update['difficulty'],
                            'status': update['status']
                        })
            
            return group_count

        except Exception as e:
            print(f"Error during affected keyword restructuring: {e}")
            return 0

    @staticmethod
    async def _handle_ungrouped_matching_grouped_parents(db: AsyncSession, project_id: int, affected_tokens: List[str]) -> int:
        """
        Find ungrouped keywords that now have the same tokens as grouped parent keywords
        and make them completely invisible children (similar to manual grouping where children disappear).
        These children will NOT appear even when the group is expanded.
        """
        try:
            grouped_parents_query = text("""
                SELECT id, tokens, group_id, group_name, volume
                FROM keywords 
                WHERE project_id = :project_id
                AND status = 'grouped'
                AND is_parent = true
                AND tokens IS NOT NULL
                AND tokens ?| :affected_tokens
            """)
            result = await db.execute(grouped_parents_query, {
                "project_id": project_id,
                "affected_tokens": affected_tokens
            })
            grouped_parents = result.fetchall()

            if not grouped_parents:
                return 0

            hidden_count = 0
            
            for parent_id, parent_tokens, parent_group_id, parent_group_name, parent_volume in grouped_parents:
                if isinstance(parent_tokens, list):
                    parent_normalized_tokens = sorted(list(set([str(token).lower().strip() for token in parent_tokens])))
                else:
                    parent_tokens_list = json.loads(parent_tokens) if isinstance(parent_tokens, str) else parent_tokens
                    parent_normalized_tokens = sorted(list(set([str(token).lower().strip() for token in parent_tokens_list])))

                matching_ungrouped_query = text("""
                    SELECT id, keyword, tokens, volume, difficulty, original_volume, status
                    FROM keywords 
                    WHERE project_id = :project_id
                    AND status = 'ungrouped'
                    AND tokens IS NOT NULL
                    AND id != :parent_id
                """)
                result = await db.execute(matching_ungrouped_query, {
                    "project_id": project_id,
                    "parent_id": parent_id
                })
                ungrouped_keywords = result.fetchall()

                for ungrouped_id, ungrouped_keyword, ungrouped_tokens, ungrouped_volume, ungrouped_difficulty, ungrouped_original_volume, ungrouped_status in ungrouped_keywords:
                    # Normalize ungrouped tokens
                    if isinstance(ungrouped_tokens, list):
                        ungrouped_normalized_tokens = sorted(list(set([str(token).lower().strip() for token in ungrouped_tokens])))
                    else:
                        ungrouped_tokens_list = json.loads(ungrouped_tokens) if isinstance(ungrouped_tokens, str) else ungrouped_tokens
                        ungrouped_normalized_tokens = sorted(list(set([str(token).lower().strip() for token in ungrouped_tokens_list])))

                    if ungrouped_normalized_tokens == parent_normalized_tokens:
                        original_state = {
                            "keyword": ungrouped_keyword,
                            "volume": ungrouped_original_volume or ungrouped_volume,
                            "difficulty": ungrouped_difficulty,
                            "tokens": ungrouped_tokens,
                            "is_parent": False,
                            "group_id": None,
                            "group_name": None,
                            "status": ungrouped_status,
                            "merge_hidden": True 
                        }
                        
                        store_state_query = text("""
                            UPDATE keywords 
                            SET original_state = :original_state
                            WHERE id = :ungrouped_id
                        """)
                        await db.execute(store_state_query, {
                            "ungrouped_id": ungrouped_id,
                            "original_state": json.dumps(original_state)
                        })
                        
                        update_to_invisible_child_query = text("""
                            UPDATE keywords 
                            SET group_id = :group_id,
                                group_name = NULL,
                                is_parent = false,
                                status = 'grouped',
                                volume = :original_volume,
                                difficulty = :difficulty,
                                blocked_by = 'merge_hidden'
                            WHERE id = :ungrouped_id
                        """)
                        await db.execute(update_to_invisible_child_query, {
                            "group_id": parent_group_id,
                            "ungrouped_id": ungrouped_id,
                            "original_volume": ungrouped_original_volume or ungrouped_volume,
                            "difficulty": ungrouped_difficulty
                        })
                        
                        update_parent_volume_query = text("""
                            UPDATE keywords 
                            SET volume = volume + :child_volume
                            WHERE id = :parent_id
                        """)
                        await db.execute(update_parent_volume_query, {
                            "parent_id": parent_id,
                            "child_volume": ungrouped_original_volume or ungrouped_volume or 0
                        })
                        
                        hidden_count += 1

            return hidden_count

        except Exception as e:
            print(f"Error handling ungrouped matching grouped parents: {e}")
            return 0

    @staticmethod
    async def _unhide_children_of_grouped_parents(db: AsyncSession, project_id: int, affected_tokens: List[str]) -> int:
        """
        Find merge-hidden children and restore them to their original ungrouped state.
        Only affects keywords that were automatically hidden due to token merging.
        """
        try:
            hidden_children_query = text("""
                SELECT k.id, k.keyword, k.tokens, k.volume, k.difficulty, k.original_volume, k.group_id,
                       k.original_state, parent.id as parent_id, parent.volume as parent_volume
                FROM keywords k
                JOIN keywords parent ON k.group_id = parent.group_id AND parent.is_parent = true
                WHERE k.project_id = :project_id
                AND k.status = 'grouped'
                AND k.is_parent = false
                AND k.blocked_by = 'merge_hidden'
                AND k.tokens IS NOT NULL
                AND k.tokens ?| :affected_tokens
                AND k.original_state IS NOT NULL
                AND parent.status = 'grouped'
            """)
            result = await db.execute(hidden_children_query, {
                "project_id": project_id,
                "affected_tokens": affected_tokens
            })
            hidden_children = result.fetchall()

            if not hidden_children:
                return 0

            unhidden_count = 0

            for child_id, child_keyword, child_tokens, child_volume, child_difficulty, child_original_volume, child_group_id, original_state_json, parent_id, parent_volume in hidden_children:
                try:
                    if original_state_json:
                        original_state = json.loads(original_state_json)
                        if original_state.get("merge_hidden"):
                            restore_query = text("""
                                UPDATE keywords 
                                SET group_id = :group_id,
                                    group_name = :group_name,
                                    is_parent = :is_parent,
                                    status = :status,
                                    volume = :volume,
                                    difficulty = :difficulty,
                                    original_state = NULL,
                                    blocked_by = NULL
                                WHERE id = :child_id
                            """)
                            await db.execute(restore_query, {
                                "child_id": child_id,
                                "group_id": original_state.get("group_id"),
                                "group_name": original_state.get("group_name"),
                                "is_parent": original_state.get("is_parent", False),
                                "status": original_state.get("status", "ungrouped"),
                                "volume": original_state.get("volume", child_original_volume or child_volume),
                                "difficulty": original_state.get("difficulty", child_difficulty)
                            })
                            
                            update_parent_volume_query = text("""
                                UPDATE keywords 
                                SET volume = GREATEST(0, volume - :child_volume)
                                WHERE id = :parent_id
                            """)
                            await db.execute(update_parent_volume_query, {
                                "parent_id": parent_id,
                                "child_volume": child_original_volume or child_volume or 0
                            })
                            
                            unhidden_count += 1
                    
                except json.JSONDecodeError:
                    # Fallback for old format that only stored tokens
                    # Try to preserve original status if we can determine it
                    try:
                        # If the keyword was grouped (has group_id), it was probably a child
                        # Try to restore it to grouped status to avoid creating extra ungrouped keywords
                        if child_group_id:
                            fallback_query = text("""
                                UPDATE keywords 
                                SET group_id = :group_id,
                                    group_name = :group_name,
                                    is_parent = false,
                                    status = 'grouped',  # Preserve grouped status to avoid extra ungrouped
                                    volume = :original_volume,
                                    difficulty = :difficulty,
                                    original_state = NULL,
                                    blocked_by = NULL
                                WHERE id = :child_id
                            """)
                            await db.execute(fallback_query, {
                                "child_id": child_id,
                                "group_id": child_group_id,
                                "group_name": None,  # Child doesn't have group name
                                "original_volume": child_original_volume or child_volume,
                                "difficulty": child_difficulty
                            })
                        else:
                            # If no group_id, it was probably ungrouped originally
                            fallback_query = text("""
                                UPDATE keywords 
                                SET group_id = NULL,
                                    group_name = NULL,
                                    is_parent = false,
                                    status = 'ungrouped',
                                    volume = :original_volume,
                                    difficulty = :difficulty,
                                    original_state = NULL,
                                    blocked_by = NULL
                                WHERE id = :child_id
                            """)
                            await db.execute(fallback_query, {
                                "child_id": child_id,
                                "original_volume": child_original_volume or child_volume,
                                "difficulty": child_difficulty
                            })
                    except:
                        # If all else fails, use the original fallback
                        fallback_query = text("""
                            UPDATE keywords 
                            SET group_id = NULL,
                                group_name = NULL,
                                is_parent = false,
                                status = 'ungrouped',
                                volume = :original_volume,
                                difficulty = :difficulty,
                                original_state = NULL,
                                blocked_by = NULL
                            WHERE id = :child_id
                        """)
                        await db.execute(fallback_query, {
                            "child_id": child_id,
                            "original_volume": child_original_volume or child_volume,
                            "difficulty": child_difficulty
                        })

            return unhidden_count

        except Exception as e:
            print(f"Error unhiding children of grouped parents: {e}")
            return 0

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

    @staticmethod
    async def count_by_token(
        db: AsyncSession, 
        project_id: int, 
        token: str,
        statuses: List[KeywordStatus] = [KeywordStatus.ungrouped, KeywordStatus.grouped]
    ) -> int:
        """Count keywords containing a specific token."""
        status_values = [status.value for status in statuses]
        count_query = text("""
            SELECT COUNT(DISTINCT id)
            FROM keywords
            WHERE project_id = :project_id
            AND status = ANY(:status_values)
            AND tokens ? :token
        """)
        result = await db.execute(count_query, {
            "project_id": project_id,
            "status_values": status_values,
            "token": token
        })
        count = result.scalar_one() or 0
        return count

    @staticmethod
    async def update_status_by_token(
        db: AsyncSession,
        project_id: int,
        token: str,
        new_status: KeywordStatus,
        current_statuses: List[KeywordStatus],
        blocked_by: Optional[str] = None
    ) -> int:
        """Update the status of keywords containing a specific token."""
        if not token:
            return 0

        status_values = [status.value for status in current_statuses]
        stmt = text("""
            WITH keywords_to_update AS (
                SELECT id FROM keywords
                WHERE project_id = :project_id 
                AND status = ANY(:status_values)
                AND tokens::jsonb ? :token
            )
            UPDATE keywords
            SET status = :new_status,
                blocked_by = :blocked_by
            FROM keywords_to_update
            WHERE keywords.id = keywords_to_update.id
            RETURNING keywords.id
        """)
        result = await db.execute(
            stmt, 
            {
                "project_id": project_id, 
                "status_values": status_values,
                "token": token,
                "new_status": new_status.value,
                "blocked_by": blocked_by
            }
        )
        affected_rows = len(result.fetchall())
        return affected_rows
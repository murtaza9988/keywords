#!/usr/bin/env python3
"""
Script to update project ID 19 to properly arrange keywords with the same tokens.
This script will:
1. Fetch all keywords from project 19
2. Normalize and sort tokens consistently
3. Group keywords with identical token sets
4. Update the database with proper grouping
"""

import asyncio
import json
import sys
import os
from typing import List, Dict, Tuple, Set
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'SeoUploads-backend'))

from app.database import get_db_context
from app.services.merge_token import TokenMergeService
from app.models.keyword import KeywordStatus

class Project19Updater:
    def __init__(self):
        self.project_id = 19
        
    async def analyze_current_state(self, db: AsyncSession) -> Dict:
        """Analyze the current state of project 19 keywords."""
        print("🔍 Analyzing current state of project 19...")
        
        # Get all keywords for project 19
        query = text("""
            SELECT id, keyword, tokens, volume, difficulty, status, group_id, is_parent, original_volume
            FROM keywords 
            WHERE project_id = :project_id
            ORDER BY id
        """)
        
        result = await db.execute(query, {"project_id": self.project_id})
        keywords = result.fetchall()
        
        print(f"📊 Found {len(keywords)} keywords in project 19")
        
        # Analyze token patterns
        token_groups = {}
        ungrouped_count = 0
        grouped_count = 0
        
        for kw in keywords:
            if kw.tokens:
                try:
                    if isinstance(kw.tokens, list):
                        tokens_list = kw.tokens
                    else:
                        tokens_list = json.loads(kw.tokens) if kw.tokens else []
                    
                    # Normalize and sort tokens (same logic as in processing)
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
                        'status': kw.status,
                        'group_id': kw.group_id,
                        'is_parent': kw.is_parent,
                        'original_volume': kw.original_volume or kw.volume or 0
                    })
                    
                    if kw.status == 'ungrouped':
                        ungrouped_count += 1
                    elif kw.status == 'grouped':
                        grouped_count += 1
                        
                except (json.JSONDecodeError, TypeError) as e:
                    print(f"⚠️  Error processing keyword {kw.id}: {e}")
                    continue
        
        # Find groups that need restructuring
        groups_needing_update = []
        for token_key, group_members in token_groups.items():
            if len(group_members) > 1:
                # Check if all members have the same group_id and proper parent/child structure
                group_ids = set(member['group_id'] for member in group_members if member['group_id'])
                parent_count = sum(1 for member in group_members if member['is_parent'])
                
                if len(group_ids) != 1 or parent_count != 1:
                    groups_needing_update.append({
                        'token_key': token_key,
                        'members': group_members,
                        'current_groups': list(group_ids),
                        'parent_count': parent_count
                    })
        
        analysis = {
            'total_keywords': len(keywords),
            'ungrouped_count': ungrouped_count,
            'grouped_count': grouped_count,
            'token_groups': len(token_groups),
            'groups_needing_update': len(groups_needing_update),
            'problematic_groups': groups_needing_update[:10]  # Show first 10 for review
        }
        
        return analysis
    
    async def update_keyword_groups(self, db: AsyncSession) -> Tuple[int, int]:
        """Update keyword groups to ensure proper token arrangement."""
        print("🔄 Updating keyword groups...")
        
        # Use the existing restructure logic from TokenMergeService
        # First, get all unique tokens from project 19
        tokens_query = text("""
            SELECT DISTINCT jsonb_array_elements_text(tokens) as token
            FROM keywords 
            WHERE project_id = :project_id
            AND tokens IS NOT NULL
            AND tokens != '[]'
            AND tokens != 'null'
        """)
        
        result = await db.execute(tokens_query, {"project_id": self.project_id})
        all_tokens = [row.token for row in result.fetchall()]
        
        print(f"📝 Found {len(all_tokens)} unique tokens to process")
        
        # Use the restructure method to fix all affected keywords
        grouped_count = await TokenMergeService._restructure_affected_keywords(
            db, self.project_id, all_tokens
        )
        
        # Handle ungrouped keywords that should be grouped with existing parents
        hidden_count = await TokenMergeService._handle_ungrouped_matching_grouped_parents(
            db, self.project_id, all_tokens
        )
        
        return grouped_count, hidden_count
    
    async def verify_updates(self, db: AsyncSession) -> Dict:
        """Verify that the updates were applied correctly."""
        print("✅ Verifying updates...")
        
        # Get updated statistics
        stats_query = text("""
            SELECT 
                status,
                COUNT(*) as count,
                COUNT(CASE WHEN is_parent = true THEN 1 END) as parent_count
            FROM keywords 
            WHERE project_id = :project_id
            GROUP BY status
        """)
        
        result = await db.execute(stats_query, {"project_id": self.project_id})
        status_stats = {row.status: {'count': row.count, 'parents': row.parent_count} for row in result.fetchall()}
        
        # Check for any remaining inconsistencies
        inconsistency_query = text("""
            SELECT 
                jsonb_array_elements_text(tokens) as token,
                COUNT(*) as keyword_count,
                COUNT(DISTINCT group_id) as group_count
            FROM keywords 
            WHERE project_id = :project_id
            AND status = 'grouped'
            AND tokens IS NOT NULL
            GROUP BY token
            HAVING COUNT(DISTINCT group_id) > 1
        """)
        
        result = await db.execute(inconsistency_query, {"project_id": self.project_id})
        inconsistencies = result.fetchall()
        
        verification = {
            'status_stats': status_stats,
            'inconsistencies_found': len(inconsistencies),
            'inconsistencies': inconsistencies[:5] if inconsistencies else []
        }
        
        return verification
    
    async def run_update(self):
        """Run the complete update process."""
        print("🚀 Starting Project 19 Update Process")
        print("=" * 50)
        
        async with get_db_context() as db:
            try:
                # Step 1: Analyze current state
                analysis = await self.analyze_current_state(db)
                
                print(f"\n📈 Current State Analysis:")
                print(f"   Total keywords: {analysis['total_keywords']}")
                print(f"   Ungrouped: {analysis['ungrouped_count']}")
                print(f"   Grouped: {analysis['grouped_count']}")
                print(f"   Token groups: {analysis['token_groups']}")
                print(f"   Groups needing update: {analysis['groups_needing_update']}")
                
                if analysis['problematic_groups']:
                    print(f"\n🔍 Sample problematic groups:")
                    for i, group in enumerate(analysis['problematic_groups'][:3]):
                        print(f"   Group {i+1}: {len(group['members'])} keywords")
                        print(f"     Tokens: {json.loads(group['token_key'])}")
                        print(f"     Current groups: {group['current_groups']}")
                        print(f"     Parent count: {group['parent_count']}")
                
                # Step 2: Update keyword groups
                if analysis['groups_needing_update'] > 0:
                    print(f"\n🔄 Updating {analysis['groups_needing_update']} groups...")
                    grouped_count, hidden_count = await self.update_keyword_groups(db)
                    print(f"   ✅ Restructured {grouped_count} groups")
                    print(f"   ✅ Hidden {hidden_count} matching keywords")
                else:
                    print("\n✅ No groups need updating - all keywords are properly arranged!")
                
                # Step 3: Verify updates
                verification = await self.verify_updates(db)
                
                print(f"\n📊 Final Statistics:")
                for status, stats in verification['status_stats'].items():
                    print(f"   {status}: {stats['count']} keywords ({stats['parents']} parents)")
                
                if verification['inconsistencies_found'] > 0:
                    print(f"\n⚠️  Found {verification['inconsistencies_found']} inconsistencies")
                    for inc in verification['inconsistencies']:
                        print(f"   Token '{inc.token}': {inc.keyword_count} keywords in {inc.group_count} groups")
                else:
                    print(f"\n✅ No inconsistencies found - all keywords properly grouped!")
                
                print(f"\n🎉 Project 19 update completed successfully!")
                
            except Exception as e:
                print(f"\n❌ Error during update: {e}")
                await db.rollback()
                raise

async def main():
    """Main function to run the update script."""
    updater = Project19Updater()
    await updater.run_update()

if __name__ == "__main__":
    asyncio.run(main())

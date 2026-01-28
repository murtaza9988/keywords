"""
Script to create a unique index on (project_id, keyword) and remove duplicates.
This should be run BEFORE create_keyword_constraint.py if duplicates exist.

Run this script on both development and production databases:
    python -m app.scripts.create_keyword_unique_index
"""
import asyncio
from sqlalchemy import text
from app.database import get_db_context


async def create_unique_index_if_missing():
    """Create a unique index if it doesn't exist, removing duplicates first."""
    async with get_db_context() as db:
        # Check if index exists
        check_stmt = text("""
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'keywords' 
            AND indexname = 'uq_keywords_project_keyword_idx'
        """)
        result = await db.execute(check_stmt)
        exists = result.rowcount > 0
        
        if exists:
            print("Index 'uq_keywords_project_keyword_idx' already exists.")
            return
        
        # First, let's check for duplicates and remove them (keep the one with highest id)
        print("Checking for duplicate keywords...")
        dup_check = text("""
            SELECT project_id, keyword, COUNT(*) as cnt, array_agg(id ORDER BY id DESC) as ids
            FROM keywords
            GROUP BY project_id, keyword
            HAVING COUNT(*) > 1
        """)
        dup_result = await db.execute(dup_check)
        duplicates = dup_result.fetchall()
        
        if duplicates:
            print(f"Found {len(duplicates)} duplicate keyword groups. Removing duplicates...")
            for row in duplicates:
                project_id, keyword, cnt, ids = row
                # Keep the first (highest) ID, delete the rest
                ids_to_delete = ids[1:] if len(ids) > 1 else []
                if ids_to_delete:
                    delete_stmt = text("""
                        DELETE FROM keywords 
                        WHERE id = ANY(:ids_to_delete)
                    """)
                    await db.execute(delete_stmt, {"ids_to_delete": ids_to_delete})
                    print(f"  Removed {len(ids_to_delete)} duplicate(s) for project_id={project_id}, keyword='{keyword}'")
            await db.commit()
            print("✓ Duplicates removed.")
        else:
            print("No duplicates found.")
        
        # Create the unique index
        print("Creating unique index 'uq_keywords_project_keyword_idx'...")
        create_stmt = text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_keywords_project_keyword_idx 
            ON keywords (project_id, keyword)
        """)
        
        try:
            await db.execute(create_stmt)
            await db.commit()
            print("✓ Unique index created successfully!")
        except Exception as e:
            await db.rollback()
            print(f"✗ Error creating index: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(create_unique_index_if_missing())

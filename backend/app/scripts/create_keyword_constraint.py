"""
Script to create the uq_keywords_project_keyword constraint if it doesn't exist.
This fixes the issue where the constraint is missing from the database.

Run this script on both development and production databases:
    python -m app.scripts.create_keyword_constraint
"""
import asyncio
from sqlalchemy import text
from app.database import get_db_context


async def create_constraint_if_missing():
    """Create the unique constraint if it doesn't exist."""
    async with get_db_context() as db:
        # Check if constraint exists
        check_stmt = text("""
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'keywords' 
            AND constraint_name = 'uq_keywords_project_keyword'
        """)
        result = await db.execute(check_stmt)
        exists = result.rowcount > 0
        
        if exists:
            print("Constraint 'uq_keywords_project_keyword' already exists.")
            return
        
        # Create the constraint
        print("Creating constraint 'uq_keywords_project_keyword'...")
        create_stmt = text("""
            ALTER TABLE keywords 
            ADD CONSTRAINT uq_keywords_project_keyword 
            UNIQUE (project_id, keyword)
        """)
        
        try:
            await db.execute(create_stmt)
            await db.commit()
            print("✓ Constraint created successfully!")
        except Exception as e:
            await db.rollback()
            print(f"✗ Error creating constraint: {e}")
            print("\nNote: If you see a 'duplicated key' error, you need to remove")
            print("duplicate keywords first. See create_keyword_unique_index.py for")
            print("a script that handles duplicates before creating the constraint.")
            raise


if __name__ == "__main__":
    asyncio.run(create_constraint_if_missing())

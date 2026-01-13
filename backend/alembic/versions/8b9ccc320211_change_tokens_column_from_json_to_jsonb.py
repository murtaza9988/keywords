"""Change tokens column from JSON to JSONB

Revision ID: 8b9ccc320211
Revises: 
Create Date: 2025-04-02 12:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON, JSONB

revision = '8b9ccc320211'
down_revision = None  # Set to previous revision ID if this isn't the first migration
branch_labels = None
depends_on = None

def upgrade():
    # Alter the column type from JSON to JSONB
    op.alter_column(
        'keywords',
        'tokens',
        existing_type=JSON(),
        type_=JSONB(),
        postgresql_using='tokens::jsonb',  # Cast existing data to JSONB
        nullable=False,
        server_default='[]'
    )
    # Add a GIN index for better performance with JSONB queries
    op.create_index('idx_keywords_tokens', 'keywords', ['tokens'], postgresql_using='gin')

def downgrade():
    # Revert back to JSON
    op.drop_index('idx_keywords_tokens', table_name='keywords')
    op.alter_column(
        'keywords',
        'tokens',
        existing_type=JSONB(),
        type_=JSON(),
        postgresql_using='tokens::json',  # Cast back to JSON
        nullable=False,
        server_default='[]'
    )
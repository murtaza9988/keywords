"""add storage_path to csv_uploads

Revision ID: 20260114_000001
Revises: 9f6b1db676b4
Create Date: 2026-01-14
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260114_000001"
down_revision = "9f6b1db676b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("csv_uploads", sa.Column("storage_path", sa.String(length=1024), nullable=True))


def downgrade() -> None:
    op.drop_column("csv_uploads", "storage_path")


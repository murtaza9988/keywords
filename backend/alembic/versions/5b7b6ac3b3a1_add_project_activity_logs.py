"""add project activity logs

Revision ID: 5b7b6ac3b3a1
Revises: 8b9ccc320211
Create Date: 2025-09-27 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "5b7b6ac3b3a1"
down_revision = "8b9ccc320211"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "project_activity_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=255), nullable=False),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("entity_type", sa.String(length=100), nullable=True),
        sa.Column("entity_id", sa.String(length=255), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_project_activity_logs_project_id_created_at",
        "project_activity_logs",
        ["project_id", "created_at"],
    )
    op.create_index(
        "ix_project_activity_logs_project_id",
        "project_activity_logs",
        ["project_id"],
    )


def downgrade():
    op.drop_index("ix_project_activity_logs_project_id_created_at", table_name="project_activity_logs")
    op.drop_index("ix_project_activity_logs_project_id", table_name="project_activity_logs")
    op.drop_table("project_activity_logs")

"""add activity logs table

Revision ID: 9f6b1db676b4
Revises: 8b9ccc320211
Create Date: 2025-02-16 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "9f6b1db676b4"
down_revision = "8b9ccc320211"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "activity_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column(
            "user",
            sa.String(length=255),
            nullable=False,
            server_default=sa.text("'admin'"),
        ),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_activity_logs_action", "activity_logs", ["action"])
    op.create_index("ix_activity_logs_created_at", "activity_logs", ["created_at"])
    op.create_index("ix_activity_logs_project_id", "activity_logs", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_activity_logs_project_id", table_name="activity_logs")
    op.drop_index("ix_activity_logs_created_at", table_name="activity_logs")
    op.drop_index("ix_activity_logs_action", table_name="activity_logs")
    op.drop_table("activity_logs")

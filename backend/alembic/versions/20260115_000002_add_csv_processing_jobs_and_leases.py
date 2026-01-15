"""Add CSV processing jobs and project leases tables.

Revision ID: 20260115_000002
Revises: 20260114_000001
Create Date: 2026-01-15 12:05:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260115_000002"
down_revision = "20260114_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    job_status_enum = sa.Enum(
        "queued",
        "running",
        "succeeded",
        "failed",
        name="csv_processing_job_status",
    )
    job_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "csv_processing_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("csv_upload_id", sa.Integer(), sa.ForeignKey("csv_uploads.id", ondelete="SET NULL")),
        sa.Column("storage_path", sa.String(length=1024)),
        sa.Column("source_filename", sa.String(length=512)),
        sa.Column("status", job_status_enum, nullable=False, server_default="queued"),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False, unique=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error", sa.Text()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime()),
        sa.Column("finished_at", sa.DateTime()),
    )
    op.create_index("ix_csv_processing_jobs_project_id", "csv_processing_jobs", ["project_id"])

    op.create_table(
        "project_processing_leases",
        sa.Column("project_id", sa.Integer(), primary_key=True),
        sa.Column("lease_owner", sa.String(length=128), nullable=False),
        sa.Column("lease_expires_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_unique_constraint(
        "uq_keywords_project_keyword",
        "keywords",
        ["project_id", "keyword"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_keywords_project_keyword", "keywords", type_="unique")
    op.drop_table("project_processing_leases")
    op.drop_index("ix_csv_processing_jobs_project_id", table_name="csv_processing_jobs")
    op.drop_table("csv_processing_jobs")
    op.execute("DROP TYPE IF EXISTS csv_processing_job_status")

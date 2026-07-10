"""job claim lease

Revision ID: 0006_job_claim_lease
Revises: 0005_transcription_jobs
Create Date: 2026-07-10
"""
from alembic import op
import sqlalchemy as sa

revision = "0006_job_claim_lease"
down_revision = "0005_transcription_jobs"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("transcription_jobs", sa.Column("lease_owner_id", sa.String(length=128), nullable=True))
    op.add_column("transcription_jobs", sa.Column("lease_generation", sa.Integer(), server_default="0", nullable=False))
    op.add_column("transcription_jobs", sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("transcription_jobs", sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(
        "ix_transcription_jobs_status_lease_expires_created",
        "transcription_jobs",
        ["status", "lease_expires_at", "created_at"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_transcription_jobs_status_lease_expires_created", table_name="transcription_jobs")
    op.drop_column("transcription_jobs", "lease_expires_at")
    op.drop_column("transcription_jobs", "claimed_at")
    op.drop_column("transcription_jobs", "lease_generation")
    op.drop_column("transcription_jobs", "lease_owner_id")

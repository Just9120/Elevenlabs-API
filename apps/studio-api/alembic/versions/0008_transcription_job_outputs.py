"""transcription job outputs

Revision ID: 0008_transcription_job_outputs
Revises: 0007_job_processing_lifecycle
Create Date: 2026-07-10
"""
from alembic import op
import sqlalchemy as sa

revision = "0008_transcription_job_outputs"
down_revision = "0007_job_processing_lifecycle"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "transcription_job_outputs",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("job_id", sa.String(length=36), sa.ForeignKey("transcription_jobs.id"), nullable=False),
        sa.Column("job_source_id", sa.String(length=36), sa.ForeignKey("transcription_job_sources.id"), nullable=False),
        sa.Column("document_id", sa.String(length=256), nullable=False),
        sa.Column("web_view_url", sa.Text(), nullable=False),
        sa.Column("output_drive_folder_id", sa.String(length=256), nullable=False),
        sa.Column("output_kind", sa.String(length=80), nullable=False),
        sa.Column("transcript_standard", sa.String(length=80), nullable=False),
        sa.Column("document_character_count", sa.Integer(), nullable=False),
        sa.Column("document_created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("persisted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lease_generation", sa.Integer(), nullable=False),
        sa.CheckConstraint("document_character_count >= 0", name="ck_transcription_job_outputs_character_count_nonnegative"),
        sa.UniqueConstraint("job_source_id", name="uq_transcription_job_outputs_job_source"),
        sa.UniqueConstraint("document_id", name="uq_transcription_job_outputs_document_id"),
    )
    op.create_index("ix_transcription_job_outputs_job_id", "transcription_job_outputs", ["job_id"])


def downgrade():
    op.drop_index("ix_transcription_job_outputs_job_id", table_name="transcription_job_outputs")
    op.drop_table("transcription_job_outputs")

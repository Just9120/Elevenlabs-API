"""output reconciliation cases

Revision ID: 0012_output_reconciliation_cases
Revises: 0011_diagnostic_debug_sessions
Create Date: 2026-07-19
"""
from alembic import op
import sqlalchemy as sa

revision = "0012_output_reconciliation_cases"
down_revision = "0011_diagnostic_debug_sessions"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind(); inspector = sa.inspect(bind)
    if "transcription_output_reconciliations" in inspector.get_table_names():
        return
    op.create_table(
        "transcription_output_reconciliations",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column("owner_user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("job_id", sa.String(36), sa.ForeignKey("transcription_jobs.id"), nullable=False),
        sa.Column("job_source_id", sa.String(36), sa.ForeignKey("transcription_job_sources.id"), nullable=False),
        sa.Column("reconciliation_token", sa.String(128), nullable=False),
        sa.Column("lease_generation", sa.Integer(), nullable=False),
        sa.Column("attempt_number", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("status", sa.Enum("prepared","creation_returned","reconciliation_required","resolved","conflict", name="outputreconciliationstatus"), nullable=False),
        sa.Column("uncertainty_reason", sa.String(80), nullable=True),
        sa.Column("expected_output_drive_folder_id", sa.String(256), nullable=False),
        sa.Column("expected_document_title", sa.String(160), nullable=True),
        sa.Column("expected_document_title_hash", sa.String(64), nullable=True),
        sa.Column("expected_document_character_count", sa.Integer(), nullable=False),
        sa.Column("prepared_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("creation_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("returned_document_id", sa.String(256), nullable=True),
        sa.Column("returned_web_view_url", sa.Text(), nullable=True),
        sa.Column("returned_document_created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_output_id", sa.String(36), sa.ForeignKey("transcription_job_outputs.id"), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("expected_document_character_count >= 0", name="ck_output_reconciliations_character_count_nonnegative"),
        sa.UniqueConstraint("job_source_id", name="uq_output_reconciliations_job_source"),
        sa.UniqueConstraint("reconciliation_token", name="uq_output_reconciliations_token"),
        sa.UniqueConstraint("returned_document_id", name="uq_output_reconciliations_returned_document_id"),
        sa.UniqueConstraint("resolved_output_id", name="uq_output_reconciliations_resolved_output_id"),
        sa.UniqueConstraint("owner_user_id","project_id","job_id","job_source_id", name="uq_output_reconciliations_scope"),
    )
    op.create_index("ix_output_reconciliations_owner_user_id", "transcription_output_reconciliations", ["owner_user_id"])
    op.create_index("ix_output_reconciliations_project_id", "transcription_output_reconciliations", ["project_id"])
    op.create_index("ix_output_reconciliations_job_id", "transcription_output_reconciliations", ["job_id"])
    op.create_index("ix_output_reconciliations_status", "transcription_output_reconciliations", ["status"])
    op.create_index("ix_output_reconciliations_job_status", "transcription_output_reconciliations", ["job_id", "status"])


def downgrade():
    bind = op.get_bind(); inspector = sa.inspect(bind)
    if "transcription_output_reconciliations" in inspector.get_table_names():
        op.drop_table("transcription_output_reconciliations")
    op.execute("DROP TYPE IF EXISTS outputreconciliationstatus")

"""add durable transcript maintenance runs

Revision ID: 0028_transcript_maintenance_runs
Revises: 0027_query_bounds
Create Date: 2026-08-29
"""

from alembic import op
import sqlalchemy as sa


revision = "0028_transcript_maintenance_runs"
down_revision = "0027_query_bounds"
branch_labels = None
depends_on = None
release_safety = "additive"


def _table_names(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def upgrade():
    bind = op.get_bind()
    if "transcript_maintenance_runs" in _table_names(bind):
        return
    op.create_table(
        "transcript_maintenance_runs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("owner_user_id", sa.String(length=36), nullable=False),
        sa.Column("workflow", sa.String(length=32), nullable=False),
        sa.Column("operation", sa.String(length=16), nullable=False),
        sa.Column("selection_mode", sa.String(length=32), nullable=False),
        sa.Column("folder_id", sa.String(length=256), nullable=True),
        sa.Column("document_id", sa.String(length=256), nullable=True),
        sa.Column("target_name", sa.String(length=512), nullable=False),
        sa.Column("preview_run_id", sa.String(length=36), nullable=True),
        sa.Column("idempotency_key", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=16), server_default=sa.text("'queued'"), nullable=False),
        sa.Column("current_stage", sa.String(length=32), server_default=sa.text("'queued'"), nullable=False),
        sa.Column("progress_completed", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("progress_total", sa.Integer(), nullable=True),
        sa.Column("result_json", sa.Text(), nullable=True),
        sa.Column("error_code", sa.String(length=80), nullable=True),
        sa.Column("error_retryable", sa.Boolean(), nullable=True),
        sa.Column("attempt_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("lease_owner_id", sa.String(length=128), nullable=True),
        sa.Column("lease_generation", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("workflow IN ('standardization','catalog_import')", name="ck_transcript_maintenance_runs_workflow"),
        sa.CheckConstraint("operation IN ('dry_run','apply')", name="ck_transcript_maintenance_runs_operation"),
        sa.CheckConstraint("selection_mode IN ('folder_tree','single_document')", name="ck_transcript_maintenance_runs_selection_mode"),
        sa.CheckConstraint("((selection_mode = 'folder_tree' AND folder_id IS NOT NULL AND document_id IS NULL) OR (selection_mode = 'single_document' AND folder_id IS NULL AND document_id IS NOT NULL))", name="ck_transcript_maintenance_runs_target"),
        sa.CheckConstraint("((operation = 'dry_run' AND preview_run_id IS NULL) OR (operation = 'apply' AND preview_run_id IS NOT NULL))", name="ck_transcript_maintenance_runs_preview"),
        sa.CheckConstraint("progress_completed >= 0", name="ck_transcript_maintenance_runs_progress_completed"),
        sa.CheckConstraint("progress_total IS NULL OR progress_total >= progress_completed", name="ck_transcript_maintenance_runs_progress_bounded"),
        sa.CheckConstraint("attempt_count >= 0", name="ck_transcript_maintenance_runs_attempt_count"),
        sa.CheckConstraint("lease_generation >= 0", name="ck_transcript_maintenance_runs_lease_generation"),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["preview_run_id"], ["transcript_maintenance_runs.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("owner_user_id", "idempotency_key", name="uq_transcript_maintenance_runs_owner_idempotency"),
    )
    op.create_index("ix_transcript_maintenance_runs_owner_user_id", "transcript_maintenance_runs", ["owner_user_id"], unique=False)
    op.create_index("ix_transcript_maintenance_runs_status", "transcript_maintenance_runs", ["status"], unique=False)
    op.create_index("ix_transcript_maintenance_runs_owner_workflow_created", "transcript_maintenance_runs", ["owner_user_id", "workflow", "created_at", "id"], unique=False)
    op.create_index("ix_transcript_maintenance_runs_claim", "transcript_maintenance_runs", ["status", "lease_expires_at", "created_at"], unique=False)


def downgrade():
    bind = op.get_bind()
    if "transcript_maintenance_runs" not in _table_names(bind):
        return
    op.drop_index("ix_transcript_maintenance_runs_claim", table_name="transcript_maintenance_runs")
    op.drop_index("ix_transcript_maintenance_runs_owner_workflow_created", table_name="transcript_maintenance_runs")
    op.drop_index("ix_transcript_maintenance_runs_status", table_name="transcript_maintenance_runs")
    op.drop_index("ix_transcript_maintenance_runs_owner_user_id", table_name="transcript_maintenance_runs")
    op.drop_table("transcript_maintenance_runs")

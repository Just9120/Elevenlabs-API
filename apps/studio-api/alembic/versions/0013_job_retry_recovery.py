"""job retry recovery

Revision ID: 0013_job_retry_recovery
Revises: 0012_output_reconciliation_cases
Create Date: 2026-07-20
"""
from alembic import op
import sqlalchemy as sa

revision = "0013_job_retry_recovery"
down_revision = "0012_output_reconciliation_cases"
branch_labels = None
depends_on = None

stage_enum = sa.Enum("prepared","provider_request_started","provider_response_returned","google_handoff","output_persisted","failed", name="sourceattemptstage")
disp_enum = sa.Enum("undetermined","retry_safe","provider_outcome_uncertain","provider_result_lost","output_reconciliation_required","non_retryable","completed", name="sourceattemptretrydisposition")

def upgrade():
    bind = op.get_bind(); inspector = sa.inspect(bind)
    if "transcription_job_source_attempts" in inspector.get_table_names():
        return
    stage_enum.create(bind, checkfirst=True); disp_enum.create(bind, checkfirst=True)
    op.create_table(
        "transcription_job_source_attempts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner_user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("job_id", sa.String(36), sa.ForeignKey("transcription_jobs.id"), nullable=False),
        sa.Column("job_source_id", sa.String(36), sa.ForeignKey("transcription_job_sources.id"), nullable=False),
        sa.Column("attempt_number", sa.Integer(), nullable=False),
        sa.Column("stage", stage_enum, nullable=False),
        sa.Column("retry_disposition", disp_enum, nullable=False),
        sa.Column("failure_code", sa.String(80)),
        sa.Column("provider_request_started_at", sa.DateTime(timezone=True)),
        sa.Column("provider_response_returned_at", sa.DateTime(timezone=True)),
        sa.Column("failed_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("job_source_id", "attempt_number", name="uq_source_attempt_job_source_attempt"),
        sa.CheckConstraint("attempt_number >= 1", name="ck_source_attempt_attempt_number_positive"),
    )
    op.create_index("ix_source_attempts_job_id", "transcription_job_source_attempts", ["job_id"])
    op.create_index("ix_source_attempts_job_source_id", "transcription_job_source_attempts", ["job_source_id"])
    op.create_index("ix_source_attempts_retry_disposition", "transcription_job_source_attempts", ["retry_disposition"])
    op.create_index("ix_source_attempts_job_retry_disposition", "transcription_job_source_attempts", ["job_id", "retry_disposition"])

def downgrade():
    bind = op.get_bind(); inspector = sa.inspect(bind)
    if "transcription_job_source_attempts" in inspector.get_table_names():
        op.drop_table("transcription_job_source_attempts")
    disp_enum.drop(bind, checkfirst=True); stage_enum.drop(bind, checkfirst=True)

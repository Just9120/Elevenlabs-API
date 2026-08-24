"""add durable audio preparation jobs

Revision ID: 0025_audio_preparation
Revises: 0024_speaker_identity
Create Date: 2026-08-24
"""

from alembic import op
import sqlalchemy as sa


revision = "0025_audio_preparation"
down_revision = "0024_speaker_identity"
branch_labels = None
depends_on = None
release_safety = "additive"


def _table_names(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def upgrade():
    bind = op.get_bind()
    tables = _table_names(bind)
    if "audio_preparation_jobs" not in tables:
        op.create_table(
            "audio_preparation_jobs",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("project_id", sa.String(length=36), nullable=False),
            sa.Column("owner_user_id", sa.String(length=36), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("title", sa.String(length=160), nullable=False),
            sa.Column("options_json", sa.Text(), nullable=False),
            sa.Column("output_destination", sa.String(length=24), server_default=sa.text("'download'"), nullable=False),
            sa.Column("output_drive_folder_id", sa.String(length=256), nullable=True),
            sa.Column("output_drive_folder_url", sa.Text(), nullable=True),
            sa.Column("output_drive_folder_name", sa.String(length=512), nullable=True),
            sa.Column("output_source_id", sa.String(length=36), nullable=True),
            sa.Column("output_drive_file_id", sa.String(length=256), nullable=True),
            sa.Column("output_drive_web_view_url", sa.Text(), nullable=True),
            sa.Column("total_input_duration_ms", sa.Integer(), nullable=True),
            sa.Column("estimated_output_duration_ms", sa.Integer(), nullable=True),
            sa.Column("output_duration_ms", sa.Integer(), nullable=True),
            sa.Column("copy_compatible", sa.Boolean(), nullable=True),
            sa.Column("current_stage", sa.String(length=40), server_default=sa.text("'queued'"), nullable=False),
            sa.Column("progress_percent", sa.Integer(), server_default=sa.text("0"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("cancel_requested_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("error_code", sa.String(length=80), nullable=True),
            sa.Column("lease_owner_id", sa.String(length=128), nullable=True),
            sa.Column("lease_generation", sa.Integer(), server_default=sa.text("0"), nullable=False),
            sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["output_source_id"], ["sources.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("output_source_id", name="uq_audio_preparation_jobs_output_source_id"),
            sa.UniqueConstraint("output_drive_file_id", name="uq_audio_preparation_jobs_output_drive_file_id"),
            sa.CheckConstraint("status IN ('preview_queued','analyzing','preview_ready','queued','processing','cancelled','failed','completed')", name="ck_audio_preparation_jobs_status"),
            sa.CheckConstraint("output_destination IN ('download','google_drive')", name="ck_audio_preparation_jobs_destination"),
            sa.CheckConstraint("progress_percent >= 0 AND progress_percent <= 100", name="ck_audio_preparation_jobs_progress"),
            sa.CheckConstraint("total_input_duration_ms IS NULL OR total_input_duration_ms > 0", name="ck_audio_preparation_jobs_input_duration"),
            sa.CheckConstraint("estimated_output_duration_ms IS NULL OR estimated_output_duration_ms >= 0", name="ck_audio_preparation_jobs_estimated_duration"),
            sa.CheckConstraint("output_duration_ms IS NULL OR output_duration_ms > 0", name="ck_audio_preparation_jobs_output_duration"),
            sa.CheckConstraint("lease_generation >= 0", name="ck_audio_preparation_jobs_lease_generation"),
            sa.CheckConstraint("((output_destination = 'download' AND output_drive_folder_id IS NULL AND output_drive_folder_url IS NULL AND output_drive_folder_name IS NULL) OR (output_destination = 'google_drive' AND output_drive_folder_id IS NOT NULL AND output_drive_folder_url IS NOT NULL AND output_drive_folder_name IS NOT NULL))", name="ck_audio_preparation_jobs_destination_snapshot"),
            sa.CheckConstraint("((output_drive_file_id IS NULL AND output_drive_web_view_url IS NULL) OR (output_drive_file_id IS NOT NULL AND output_drive_web_view_url IS NOT NULL))", name="ck_audio_preparation_jobs_drive_output_complete"),
        )
        op.create_index("ix_audio_preparation_jobs_project_id", "audio_preparation_jobs", ["project_id"], unique=False)
        op.create_index("ix_audio_preparation_jobs_owner_user_id", "audio_preparation_jobs", ["owner_user_id"], unique=False)
        op.create_index("ix_audio_preparation_jobs_status", "audio_preparation_jobs", ["status"], unique=False)
        op.create_index("ix_audio_preparation_jobs_owner_created", "audio_preparation_jobs", ["owner_user_id", "created_at"], unique=False)
        op.create_index("ix_audio_preparation_jobs_claim", "audio_preparation_jobs", ["status", "lease_expires_at", "created_at"], unique=False)

    tables = _table_names(bind)
    if "audio_preparation_job_inputs" not in tables:
        op.create_table(
            "audio_preparation_job_inputs",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("job_id", sa.String(length=36), nullable=False),
            sa.Column("source_id", sa.String(length=36), nullable=False),
            sa.Column("position", sa.Integer(), nullable=False),
            sa.Column("ephemeral_reference", sa.Boolean(), server_default=sa.text("false"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["job_id"], ["audio_preparation_jobs.id"]),
            sa.ForeignKeyConstraint(["source_id"], ["sources.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("job_id", "source_id", name="uq_audio_preparation_job_inputs_source"),
            sa.UniqueConstraint("job_id", "position", name="uq_audio_preparation_job_inputs_position"),
            sa.CheckConstraint("position >= 0 AND position < 50", name="ck_audio_preparation_job_inputs_position"),
        )
        op.create_index("ix_audio_preparation_job_inputs_job_id", "audio_preparation_job_inputs", ["job_id"], unique=False)
        op.create_index("ix_audio_preparation_job_inputs_source_id", "audio_preparation_job_inputs", ["source_id"], unique=False)
        op.create_index("ix_audio_preparation_job_inputs_job_position", "audio_preparation_job_inputs", ["job_id", "position"], unique=False)


def downgrade():
    bind = op.get_bind()
    tables = _table_names(bind)
    if "audio_preparation_job_inputs" in tables:
        op.drop_index("ix_audio_preparation_job_inputs_job_position", table_name="audio_preparation_job_inputs")
        op.drop_index("ix_audio_preparation_job_inputs_source_id", table_name="audio_preparation_job_inputs")
        op.drop_index("ix_audio_preparation_job_inputs_job_id", table_name="audio_preparation_job_inputs")
        op.drop_table("audio_preparation_job_inputs")
    if "audio_preparation_jobs" in tables:
        op.drop_index("ix_audio_preparation_jobs_claim", table_name="audio_preparation_jobs")
        op.drop_index("ix_audio_preparation_jobs_owner_created", table_name="audio_preparation_jobs")
        op.drop_index("ix_audio_preparation_jobs_status", table_name="audio_preparation_jobs")
        op.drop_index("ix_audio_preparation_jobs_owner_user_id", table_name="audio_preparation_jobs")
        op.drop_index("ix_audio_preparation_jobs_project_id", table_name="audio_preparation_jobs")
        op.drop_table("audio_preparation_jobs")

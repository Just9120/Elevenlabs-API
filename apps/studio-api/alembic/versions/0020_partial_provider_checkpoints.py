"""add encrypted checkpoints for completed provider parts

Revision ID: 0020_partial_provider_checkpoints
Revises: 0019_job_media_clip
Create Date: 2026-08-08
"""

from alembic import op
import sqlalchemy as sa


revision = "0020_partial_provider_checkpoints"
down_revision = "0019_job_media_clip"
branch_labels = None
depends_on = None
release_safety = "additive"


def _table_names(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def _column_names(bind, table_name: str) -> set[str]:
    if table_name not in _table_names(bind):
        return set()
    return {
        column["name"]
        for column in sa.inspect(bind).get_columns(table_name)
    }


def upgrade():
    bind = op.get_bind()
    if "provider_failure_code" not in _column_names(
        bind, "transcription_job_source_attempts"
    ):
        op.add_column(
            "transcription_job_source_attempts",
            sa.Column("provider_failure_code", sa.String(length=80), nullable=True),
        )
    if "transcription_provider_part_checkpoints" not in _table_names(bind):
        op.create_table(
            "transcription_provider_part_checkpoints",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("owner_user_id", sa.String(length=36), nullable=False),
            sa.Column("project_id", sa.String(length=36), nullable=False),
            sa.Column("job_id", sa.String(length=36), nullable=False),
            sa.Column("job_source_id", sa.String(length=36), nullable=False),
            sa.Column("part_index", sa.Integer(), nullable=False),
            sa.Column("total_parts", sa.Integer(), nullable=False),
            sa.Column("timeline_offset_seconds", sa.Float(), nullable=False),
            sa.Column("duration_seconds", sa.Float(), nullable=False),
            sa.Column("provider", sa.String(length=40), nullable=False),
            sa.Column("model", sa.String(length=80), nullable=False),
            sa.Column("ciphertext", sa.LargeBinary(), nullable=False),
            sa.Column("nonce", sa.LargeBinary(), nullable=False),
            sa.Column("key_id", sa.String(length=80), nullable=False),
            sa.Column("payload_hmac", sa.String(length=64), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.CheckConstraint("duration_seconds > 0", name="ck_provider_part_checkpoint_duration_positive"),
            sa.CheckConstraint("part_index < total_parts", name="ck_provider_part_checkpoint_index_bounded"),
            sa.CheckConstraint("part_index >= 0", name="ck_provider_part_checkpoint_index_nonnegative"),
            sa.CheckConstraint("length(payload_hmac) = 64", name="ck_provider_part_checkpoint_hmac_length"),
            sa.CheckConstraint("timeline_offset_seconds >= 0", name="ck_provider_part_checkpoint_offset_nonnegative"),
            sa.CheckConstraint("total_parts > 1", name="ck_provider_part_checkpoint_total_parts_multiple"),
            sa.ForeignKeyConstraint(["job_id"], ["transcription_jobs.id"]),
            sa.ForeignKeyConstraint(["job_source_id"], ["transcription_job_sources.id"]),
            sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("job_source_id", "part_index", name="uq_provider_part_checkpoint_source_part"),
        )
        op.create_index("ix_provider_part_checkpoints_expiry", "transcription_provider_part_checkpoints", ["expires_at"], unique=False)
        op.create_index("ix_provider_part_checkpoints_job", "transcription_provider_part_checkpoints", ["job_id"], unique=False)
        op.create_index("ix_provider_part_checkpoints_job_source", "transcription_provider_part_checkpoints", ["job_source_id", "part_index"], unique=False)


def downgrade():
    bind = op.get_bind()
    if "transcription_provider_part_checkpoints" in _table_names(bind):
        op.drop_index("ix_provider_part_checkpoints_job_source", table_name="transcription_provider_part_checkpoints")
        op.drop_index("ix_provider_part_checkpoints_job", table_name="transcription_provider_part_checkpoints")
        op.drop_index("ix_provider_part_checkpoints_expiry", table_name="transcription_provider_part_checkpoints")
        op.drop_table("transcription_provider_part_checkpoints")
    if "provider_failure_code" in _column_names(
        bind, "transcription_job_source_attempts"
    ):
        op.drop_column("transcription_job_source_attempts", "provider_failure_code")

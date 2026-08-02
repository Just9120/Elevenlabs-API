"""add immutable per-job media clip bounds

Revision ID: 0019_job_media_clip
Revises: 0018_job_part_progress
Create Date: 2026-08-02
"""

from alembic import op
import sqlalchemy as sa


revision = "0019_job_media_clip"
down_revision = "0018_job_part_progress"
branch_labels = None
depends_on = None
release_safety = "additive"


def _column_names(bind) -> set[str]:
    inspector = sa.inspect(bind)
    if "transcription_jobs" not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns("transcription_jobs")}


def _check_names(bind) -> set[str]:
    inspector = sa.inspect(bind)
    if "transcription_jobs" not in inspector.get_table_names():
        return set()
    return {
        check["name"]
        for check in inspector.get_check_constraints("transcription_jobs")
        if check.get("name")
    }


def upgrade():
    bind = op.get_bind()
    columns = _column_names(bind)
    if "media_clip_start_seconds" not in columns:
        op.add_column(
            "transcription_jobs",
            sa.Column("media_clip_start_seconds", sa.Integer(), nullable=True),
        )
    if "media_clip_end_seconds" not in columns:
        op.add_column(
            "transcription_jobs",
            sa.Column("media_clip_end_seconds", sa.Integer(), nullable=True),
        )

    if "ck_transcription_jobs_media_clip_range" not in _check_names(bind):
        op.create_check_constraint(
            "ck_transcription_jobs_media_clip_range",
            "transcription_jobs",
            "((media_clip_start_seconds IS NULL AND media_clip_end_seconds IS NULL) "
            "OR (COALESCE(media_clip_start_seconds, 0) >= 0 "
            "AND COALESCE(media_clip_start_seconds, 0) <= 604800 "
            "AND (media_clip_end_seconds IS NULL OR "
            "(media_clip_end_seconds > COALESCE(media_clip_start_seconds, 0) "
            "AND media_clip_end_seconds <= 604800)) "
            "AND NOT (media_clip_start_seconds = 0 AND media_clip_end_seconds IS NULL)))",
        )


def downgrade():
    bind = op.get_bind()
    if "ck_transcription_jobs_media_clip_range" in _check_names(bind):
        op.drop_constraint(
            "ck_transcription_jobs_media_clip_range",
            "transcription_jobs",
            type_="check",
        )
    columns = _column_names(bind)
    if "media_clip_end_seconds" in columns:
        op.drop_column("transcription_jobs", "media_clip_end_seconds")
    if "media_clip_start_seconds" in columns:
        op.drop_column("transcription_jobs", "media_clip_start_seconds")

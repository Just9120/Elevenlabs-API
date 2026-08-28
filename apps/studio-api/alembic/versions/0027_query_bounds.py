"""add indexes for bounded collection queries

Revision ID: 0027_query_bounds
Revises: 0026_runtime_component_status
Create Date: 2026-08-28
"""

from alembic import op
from sqlalchemy import inspect


revision = "0027_query_bounds"
down_revision = "0026_runtime_component_status"
branch_labels = None
depends_on = None
release_safety = "additive"


INDEXES = (
    ("ix_projects_owner_active_updated_id", "projects", ("owner_user_id", "archived_at", "updated_at", "id")),
    ("ix_sources_project_deleted_created_id", "sources", ("project_id", "deleted_at", "created_at", "id")),
    ("ix_transcription_jobs_project_owner_created_id", "transcription_jobs", ("project_id", "owner_user_id", "created_at", "id")),
    ("ix_audit_events_subject_created_id", "audit_events", ("subject_user_id", "created_at", "id")),
    ("ix_provider_part_checkpoints_expiry_id", "transcription_provider_part_checkpoints", ("expires_at", "id")),
    ("ix_realtime_drafts_expiry_id", "realtime_transcript_drafts", ("expires_at", "id")),
    ("ix_audio_preparation_jobs_owner_project_created_id", "audio_preparation_jobs", ("owner_user_id", "project_id", "created_at", "id")),
)


def upgrade():
    inspector = inspect(op.get_bind())
    for name, table, columns in INDEXES:
        existing = {index["name"] for index in inspector.get_indexes(table)}
        if name not in existing:
            op.create_index(name, table, list(columns), unique=False)


def downgrade():
    inspector = inspect(op.get_bind())
    for name, table, _columns in reversed(INDEXES):
        existing = {index["name"] for index in inspector.get_indexes(table)}
        if name in existing:
            op.drop_index(name, table_name=table)

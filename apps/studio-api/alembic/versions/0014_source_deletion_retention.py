"""source deletion retention

Revision ID: 0014_source_deletion_retention
Revises: 0013_job_retry_recovery
Create Date: 2026-07-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0014_source_deletion_retention"
down_revision = "0013_job_retry_recovery"
branch_labels = None
depends_on = None

cleanup_enum = postgresql.ENUM("not_requested", "not_applicable", "pending", "completed", "failed", name="sourcestoragecleanupstatus", create_type=False)

COLS = (
    ("storage_cleanup_status", None, "'not_requested'"),
    ("storage_cleanup_requested_at", sa.DateTime(timezone=True), None),
    ("storage_cleanup_not_before_at", sa.DateTime(timezone=True), None),
    ("storage_cleanup_completed_at", sa.DateTime(timezone=True), None),
    ("storage_cleanup_attempt_count", sa.Integer(), "0"),
    ("storage_cleanup_error_code", sa.String(80), None),
    ("storage_cleanup_owner_id", sa.String(128), None),
    ("storage_cleanup_generation", sa.Integer(), "0"),
    ("storage_cleanup_claimed_at", sa.DateTime(timezone=True), None),
    ("storage_cleanup_lease_expires_at", sa.DateTime(timezone=True), None),
)


def _cols(inspector):
    return {c["name"] for c in inspector.get_columns("sources")}


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "sources" not in inspector.get_table_names():
        return
    if bind.dialect.name == "postgresql":
        cleanup_enum.create(bind, checkfirst=True)
    existing = _cols(inspector)
    for name, typ, default in COLS:
        if name not in existing:
            typ = cleanup_enum if name == "storage_cleanup_status" and bind.dialect.name == "postgresql" else (sa.String(32) if name == "storage_cleanup_status" else typ)
            op.add_column("sources", sa.Column(name, typ, server_default=sa.text(default) if default is not None else None))
    inspector = sa.inspect(bind)
    indexes = {i["name"] for i in inspector.get_indexes("sources")}
    if "ix_sources_storage_cleanup_selection" not in indexes:
        op.create_index("ix_sources_storage_cleanup_selection", "sources", ["storage_cleanup_status", "storage_cleanup_not_before_at", "storage_cleanup_lease_expires_at"])
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TABLE sources ADD CONSTRAINT IF NOT EXISTS ck_sources_storage_cleanup_attempt_count_nonnegative CHECK (storage_cleanup_attempt_count >= 0)")
        op.execute("ALTER TABLE sources ADD CONSTRAINT IF NOT EXISTS ck_sources_storage_cleanup_generation_nonnegative CHECK (storage_cleanup_generation >= 0)")
    op.execute("UPDATE sources SET storage_cleanup_status = 'not_applicable' WHERE source_type = 'google_drive'")
    op.execute("UPDATE sources SET storage_cleanup_status = 'pending', storage_cleanup_requested_at = COALESCE(storage_cleanup_requested_at, CURRENT_TIMESTAMP), storage_cleanup_not_before_at = COALESCE(storage_cleanup_not_before_at, CURRENT_TIMESTAMP) WHERE source_type = 'local_upload' AND (deleted_at IS NOT NULL OR upload_status IN ('deleted','expired'))")
    op.execute("UPDATE sources SET storage_cleanup_status = 'not_requested' WHERE source_type = 'local_upload' AND deleted_at IS NULL AND upload_status NOT IN ('deleted','expired')")


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "sources" not in inspector.get_table_names():
        return
    indexes = {i["name"] for i in inspector.get_indexes("sources")}
    if "ix_sources_storage_cleanup_selection" in indexes:
        op.drop_index("ix_sources_storage_cleanup_selection", table_name="sources")
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TABLE sources DROP CONSTRAINT IF EXISTS ck_sources_storage_cleanup_attempt_count_nonnegative")
        op.execute("ALTER TABLE sources DROP CONSTRAINT IF EXISTS ck_sources_storage_cleanup_generation_nonnegative")
    existing = _cols(inspector)
    for name, _typ, _default in reversed(COLS):
        if name in existing:
            op.drop_column("sources", name)
    if bind.dialect.name == "postgresql":
        cleanup_enum.drop(bind, checkfirst=True)

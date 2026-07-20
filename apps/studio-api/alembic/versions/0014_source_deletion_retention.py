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
    ("storage_cleanup_status", None, "'not_requested'", False),
    ("storage_cleanup_requested_at", sa.DateTime(timezone=True), None, True),
    ("storage_cleanup_not_before_at", sa.DateTime(timezone=True), None, True),
    ("storage_cleanup_completed_at", sa.DateTime(timezone=True), None, True),
    ("storage_cleanup_attempt_count", sa.Integer(), "0", False),
    ("storage_cleanup_error_code", sa.String(80), None, True),
    ("storage_cleanup_owner_id", sa.String(128), None, True),
    ("storage_cleanup_generation", sa.Integer(), "0", False),
    ("storage_cleanup_claimed_at", sa.DateTime(timezone=True), None, True),
    ("storage_cleanup_lease_expires_at", sa.DateTime(timezone=True), None, True),
)


def _cols(inspector):
    return {c["name"] for c in inspector.get_columns("sources")}


def _checks(inspector):
    return {c["name"] for c in inspector.get_check_constraints("sources")}


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "sources" not in inspector.get_table_names():
        return
    if bind.dialect.name == "postgresql":
        cleanup_enum.create(bind, checkfirst=True)
    existing = _cols(inspector)
    for name, typ, default, nullable in COLS:
        if name not in existing:
            typ = cleanup_enum if name == "storage_cleanup_status" and bind.dialect.name == "postgresql" else (sa.String(32) if name == "storage_cleanup_status" else typ)
            op.add_column("sources", sa.Column(name, typ, nullable=nullable, server_default=sa.text(default) if default is not None else None))
    inspector = sa.inspect(bind)
    indexes = {i["name"] for i in inspector.get_indexes("sources")}
    if "ix_sources_storage_cleanup_selection" not in indexes:
        op.create_index("ix_sources_storage_cleanup_selection", "sources", ["storage_cleanup_status", "storage_cleanup_not_before_at", "storage_cleanup_lease_expires_at"])
    checks = _checks(sa.inspect(bind))
    if "ck_sources_storage_cleanup_attempt_count_nonnegative" not in checks:
        op.create_check_constraint("ck_sources_storage_cleanup_attempt_count_nonnegative", "sources", "storage_cleanup_attempt_count >= 0")
    if "ck_sources_storage_cleanup_generation_nonnegative" not in checks:
        op.create_check_constraint("ck_sources_storage_cleanup_generation_nonnegative", "sources", "storage_cleanup_generation >= 0")
    op.execute("UPDATE sources SET storage_cleanup_status = 'not_applicable', storage_cleanup_requested_at = NULL, storage_cleanup_not_before_at = NULL, storage_cleanup_completed_at = NULL WHERE source_type = 'google_drive'")
    op.execute("UPDATE sources SET upload_status = 'expired', delete_reason = COALESCE(delete_reason, 'retention_expired'), storage_cleanup_status = 'pending', storage_cleanup_requested_at = COALESCE(storage_cleanup_requested_at, CURRENT_TIMESTAMP), storage_cleanup_not_before_at = COALESCE(storage_cleanup_not_before_at, CURRENT_TIMESTAMP) WHERE source_type = 'local_upload' AND deleted_at IS NULL AND (upload_status = 'expired' OR expires_at <= CURRENT_TIMESTAMP)")
    op.execute("UPDATE sources SET storage_cleanup_status = 'pending', storage_cleanup_requested_at = COALESCE(storage_cleanup_requested_at, CURRENT_TIMESTAMP), storage_cleanup_not_before_at = COALESCE(storage_cleanup_not_before_at, CASE WHEN upload_status = 'pending' AND expires_at IS NOT NULL AND expires_at > CURRENT_TIMESTAMP THEN expires_at ELSE CURRENT_TIMESTAMP END) WHERE source_type = 'local_upload' AND deleted_at IS NOT NULL")
    op.execute("UPDATE sources SET storage_cleanup_status = 'not_requested' WHERE source_type = 'local_upload' AND deleted_at IS NULL AND upload_status NOT IN ('deleted','expired') AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)")
    for name in ("storage_cleanup_status", "storage_cleanup_attempt_count", "storage_cleanup_generation"):
        op.alter_column("sources", name, nullable=False)


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "sources" not in inspector.get_table_names():
        return
    indexes = {i["name"] for i in inspector.get_indexes("sources")}
    if "ix_sources_storage_cleanup_selection" in indexes:
        op.drop_index("ix_sources_storage_cleanup_selection", table_name="sources")
    checks = _checks(inspector)
    if "ck_sources_storage_cleanup_attempt_count_nonnegative" in checks:
        op.drop_constraint("ck_sources_storage_cleanup_attempt_count_nonnegative", "sources", type_="check")
    if "ck_sources_storage_cleanup_generation_nonnegative" in checks:
        op.drop_constraint("ck_sources_storage_cleanup_generation_nonnegative", "sources", type_="check")
    existing = _cols(inspector)
    for name, _typ, _default, _nullable in reversed(COLS):
        if name in existing:
            op.drop_column("sources", name)
    if bind.dialect.name == "postgresql":
        cleanup_enum.drop(bind, checkfirst=True)

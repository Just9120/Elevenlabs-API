"""Add owner-scoped, revocable trusted-browser capabilities.

Revision ID: 0038_trusted_devices
Revises: 0037_ux_audit_controls
Create Date: 2026-09-27
"""

from alembic import op
import sqlalchemy as sa


revision = "0038_trusted_devices"
down_revision = "0037_ux_audit_controls"
branch_labels = None
depends_on = None
release_safety = "additive"

TABLE = "trusted_devices"
COLUMNS = {"id", "user_id", "token_hash", "created_at", "expires_at", "revoked_at"}


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if TABLE in inspector.get_table_names():
        existing = {column["name"] for column in inspector.get_columns(TABLE)}
        if existing != COLUMNS:
            raise RuntimeError("partial trusted-device schema")
        return
    op.create_table(
        TABLE,
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_trusted_devices_user_id", TABLE, ["user_id"])
    op.create_index("ix_trusted_devices_expires_at", TABLE, ["expires_at"])


def downgrade():
    if TABLE in sa.inspect(op.get_bind()).get_table_names():
        op.drop_table(TABLE)

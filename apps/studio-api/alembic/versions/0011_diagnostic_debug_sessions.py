"""diagnostic debug sessions

Revision ID: 0011_diagnostic_debug_sessions
Revises: 0010_diagnostic_events
Create Date: 2026-07-17
"""
from alembic import op
import sqlalchemy as sa

revision = "0011_diagnostic_debug_sessions"
down_revision = "0010_diagnostic_events"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "diagnostic_debug_sessions" in inspector.get_table_names():
        return
    op.create_table(
        "diagnostic_debug_sessions",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("owner_user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("expires_at > started_at", name="ck_diagnostic_debug_sessions_expires_after_start"),
    )
    op.create_index("ix_diagnostic_debug_sessions_owner_user_id", "diagnostic_debug_sessions", ["owner_user_id"])
    op.create_index("ix_diagnostic_debug_sessions_owner_active", "diagnostic_debug_sessions", ["owner_user_id", "ended_at", "expires_at"])


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "diagnostic_debug_sessions" not in inspector.get_table_names():
        return
    op.drop_index("ix_diagnostic_debug_sessions_owner_active", table_name="diagnostic_debug_sessions")
    op.drop_index("ix_diagnostic_debug_sessions_owner_user_id", table_name="diagnostic_debug_sessions")
    op.drop_table("diagnostic_debug_sessions")

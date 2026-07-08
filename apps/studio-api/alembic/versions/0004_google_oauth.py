"""google oauth connections

Revision ID: 0004_google_oauth
Revises: 0003_project_sources
Create Date: 2026-07-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0004_google_oauth"
down_revision = "0003_project_sources"
branch_labels = None
depends_on = None

google_provider = postgresql.ENUM("google", name="googleprovider", create_type=False)
google_status = postgresql.ENUM("active", "revoked", "error", name="googleconnectionstatus", create_type=False)


def upgrade():
    bind = op.get_bind()
    google_provider.create(bind, checkfirst=True)
    google_status.create(bind, checkfirst=True)
    inspector = sa.inspect(bind)
    if "google_connections" not in inspector.get_table_names():
        op.create_table(
            "google_connections",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("user_id", sa.String(length=36), nullable=False),
            sa.Column("provider", google_provider, nullable=False),
            sa.Column("status", google_status, nullable=False),
            sa.Column("google_subject", sa.String(length=255), nullable=True),
            sa.Column("google_email", sa.String(length=320), nullable=True),
            sa.Column("scopes", sa.Text(), nullable=True),
            sa.Column("refresh_token_ciphertext", sa.LargeBinary(), nullable=True),
            sa.Column("refresh_token_nonce", sa.LargeBinary(), nullable=True),
            sa.Column("key_id", sa.String(length=80), nullable=True),
            sa.Column("connected_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", "provider", name="uq_google_connection_user_provider"),
        )
    if "google_oauth_states" not in inspector.get_table_names():
        op.create_table(
            "google_oauth_states",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("user_id", sa.String(length=36), nullable=False),
            sa.Column("session_id", sa.String(length=36), nullable=True),
            sa.Column("state_hash", sa.String(length=64), nullable=False),
            sa.Column("redirect_after", sa.Text(), nullable=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("state_hash"),
        )
    for table, indexes in {
        "google_connections": {op.f("ix_google_connections_user_id"): ["user_id"], op.f("ix_google_connections_status"): ["status"]},
        "google_oauth_states": {op.f("ix_google_oauth_states_user_id"): ["user_id"], op.f("ix_google_oauth_states_session_id"): ["session_id"], op.f("ix_google_oauth_states_state_hash"): ["state_hash"], op.f("ix_google_oauth_states_expires_at"): ["expires_at"], op.f("ix_google_oauth_states_used_at"): ["used_at"]},
    }.items():
        existing = {idx["name"] for idx in sa.inspect(bind).get_indexes(table)}
        for name, cols in indexes.items():
            if name not in existing:
                op.create_index(name, table, cols, unique=False)


def downgrade():
    op.drop_table("google_oauth_states")
    op.drop_table("google_connections")
    google_status.drop(op.get_bind(), checkfirst=True)
    google_provider.drop(op.get_bind(), checkfirst=True)

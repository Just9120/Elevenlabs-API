"""separate server-only Google maintenance OAuth grant

Revision ID: 0017_google_maintenance_oauth
Revises: 0016_transcript_catalog_entries
Create Date: 2026-07-28
"""

from alembic import op
import sqlalchemy as sa


revision = "0017_google_maintenance_oauth"
down_revision = "0016_transcript_catalog_entries"
branch_labels = None
depends_on = None
release_safety = "additive"

PRIMARY_OAUTH_PURPOSE = "primary"

MAINTENANCE_CONNECTION_COLUMNS = (
    sa.Column(
        "maintenance_google_subject",
        sa.String(length=255),
        nullable=True,
    ),
    sa.Column(
        "maintenance_google_email",
        sa.String(length=320),
        nullable=True,
    ),
    sa.Column("maintenance_scopes", sa.Text(), nullable=True),
    sa.Column(
        "maintenance_refresh_token_ciphertext",
        sa.LargeBinary(),
        nullable=True,
    ),
    sa.Column(
        "maintenance_refresh_token_nonce",
        sa.LargeBinary(),
        nullable=True,
    ),
    sa.Column(
        "maintenance_key_id",
        sa.String(length=80),
        nullable=True,
    ),
    sa.Column(
        "maintenance_connected_at",
        sa.DateTime(timezone=True),
        nullable=True,
    ),
    sa.Column(
        "maintenance_revoked_at",
        sa.DateTime(timezone=True),
        nullable=True,
    ),
)


def _column_names(bind, table_name: str) -> set[str]:
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return set()
    return {
        column["name"]
        for column in inspector.get_columns(table_name)
    }


def upgrade():
    bind = op.get_bind()
    connection_columns = _column_names(bind, "google_connections")
    for column in MAINTENANCE_CONNECTION_COLUMNS:
        if column.name not in connection_columns:
            op.add_column("google_connections", column)

    state_columns = _column_names(bind, "google_oauth_states")
    if state_columns and "purpose" not in state_columns:
        op.add_column(
            "google_oauth_states",
            sa.Column(
                "purpose",
                sa.String(length=32),
                nullable=False,
                server_default=PRIMARY_OAUTH_PURPOSE,
            ),
        )


def downgrade():
    bind = op.get_bind()
    state_columns = _column_names(bind, "google_oauth_states")
    if "purpose" in state_columns:
        op.drop_column("google_oauth_states", "purpose")

    connection_columns = _column_names(bind, "google_connections")
    for column in reversed(MAINTENANCE_CONNECTION_COLUMNS):
        if column.name in connection_columns:
            op.drop_column("google_connections", column.name)

"""user source retention preference

Revision ID: 0015_user_source_retention
Revises: 0014_source_deletion_retention
Create Date: 2026-07-22
"""
from alembic import op
import sqlalchemy as sa

revision = "0015_user_source_retention"
down_revision = "0014_source_deletion_retention"
branch_labels = None
depends_on = None

DEFAULT_RETENTION_SECONDS = 86400
CHECK_NAME = "ck_users_source_retention_ttl_allowed"


def _columns(inspector):
    return {column["name"] for column in inspector.get_columns("users")}


def _checks(inspector):
    return {constraint["name"] for constraint in inspector.get_check_constraints("users")}


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "users" not in inspector.get_table_names():
        return
    if "source_retention_ttl_seconds" not in _columns(inspector):
        op.add_column(
            "users",
            sa.Column(
                "source_retention_ttl_seconds",
                sa.Integer(),
                nullable=False,
                server_default=sa.text(str(DEFAULT_RETENTION_SECONDS)),
            ),
        )
    if CHECK_NAME not in _checks(sa.inspect(bind)):
        op.create_check_constraint(
            CHECK_NAME,
            "users",
            "source_retention_ttl_seconds IN (3600, 86400, 259200, 604800, 2592000)",
        )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "users" not in inspector.get_table_names():
        return
    if CHECK_NAME in _checks(inspector):
        op.drop_constraint(CHECK_NAME, "users", type_="check")
    if "source_retention_ttl_seconds" in _columns(sa.inspect(bind)):
        op.drop_column("users", "source_retention_ttl_seconds")

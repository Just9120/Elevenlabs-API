"""add account and project operability preferences

Revision ID: 0022_account_operability
Revises: 0021_source_creation_favorites
Create Date: 2026-08-21
"""

from alembic import op
import sqlalchemy as sa


revision = "0022_account_operability"
down_revision = "0021_source_creation_favorites"
branch_labels = None
depends_on = None
release_safety = "additive"


def _table_names(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def _column_names(bind, table_name: str) -> set[str]:
    if table_name not in _table_names(bind):
        return set()
    return {column["name"] for column in sa.inspect(bind).get_columns(table_name)}


def _check_names(bind, table_name: str) -> set[str]:
    if table_name not in _table_names(bind):
        return set()
    return {
        check["name"]
        for check in sa.inspect(bind).get_check_constraints(table_name)
        if check.get("name")
    }


def upgrade():
    bind = op.get_bind()
    user_columns = _column_names(bind, "users")
    if "accent_color" not in user_columns:
        op.add_column(
            "users",
            sa.Column(
                "accent_color",
                sa.String(length=20),
                server_default="blue",
                nullable=False,
            ),
        )
    if "manifest_reset_at" not in user_columns:
        op.add_column(
            "users",
            sa.Column("manifest_reset_at", sa.DateTime(timezone=True), nullable=True),
        )
    if "ck_users_accent_color_allowed" not in _check_names(bind, "users"):
        op.create_check_constraint(
            "ck_users_accent_color_allowed",
            "users",
            "accent_color IN ('blue', 'violet', 'teal', 'rose')",
        )

    project_columns = _column_names(bind, "projects")
    if "history_reset_at" not in project_columns:
        op.add_column(
            "projects",
            sa.Column("history_reset_at", sa.DateTime(timezone=True), nullable=True),
        )
    if "analytics_reset_at" not in project_columns:
        op.add_column(
            "projects",
            sa.Column("analytics_reset_at", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade():
    bind = op.get_bind()
    project_columns = _column_names(bind, "projects")
    if "analytics_reset_at" in project_columns:
        op.drop_column("projects", "analytics_reset_at")
    if "history_reset_at" in project_columns:
        op.drop_column("projects", "history_reset_at")

    if "ck_users_accent_color_allowed" in _check_names(bind, "users"):
        op.drop_constraint("ck_users_accent_color_allowed", "users", type_="check")
    user_columns = _column_names(bind, "users")
    if "manifest_reset_at" in user_columns:
        op.drop_column("users", "manifest_reset_at")
    if "accent_color" in user_columns:
        op.drop_column("users", "accent_color")

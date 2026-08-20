"""add source creation authority and output folder favorites

Revision ID: 0021_source_creation_favorites
Revises: 0020_provider_part_checkpoints
Create Date: 2026-08-20
"""

from alembic import op
import sqlalchemy as sa


revision = "0021_source_creation_favorites"
down_revision = "0020_provider_part_checkpoints"
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
    source_columns = _column_names(bind, "sources")
    if "source_created_at" not in source_columns:
        op.add_column(
            "sources",
            sa.Column("source_created_at", sa.DateTime(timezone=True), nullable=True),
        )
    if "source_created_at_provenance" not in source_columns:
        op.add_column(
            "sources",
            sa.Column("source_created_at_provenance", sa.String(length=40), nullable=True),
        )
    if "ck_sources_creation_authority" not in _check_names(bind, "sources"):
        op.create_check_constraint(
            "ck_sources_creation_authority",
            "sources",
            "((source_created_at IS NULL AND source_created_at_provenance IS NULL) "
            "OR (source_created_at IS NOT NULL AND source_created_at_provenance "
            "IN ('google_drive_created_time', 'embedded_media_metadata')))",
        )

    if "output_folder_favorites" not in _table_names(bind):
        op.create_table(
            "output_folder_favorites",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("owner_user_id", sa.String(length=36), nullable=False),
            sa.Column("drive_folder_id", sa.String(length=256), nullable=False),
            sa.Column("name", sa.String(length=512), nullable=False),
            sa.Column("web_view_url", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "owner_user_id",
                "drive_folder_id",
                name="uq_output_folder_favorites_owner_folder",
            ),
        )
        op.create_index(
            "ix_output_folder_favorites_owner_user_id",
            "output_folder_favorites",
            ["owner_user_id"],
            unique=False,
        )
        op.create_index(
            "ix_output_folder_favorites_owner_updated",
            "output_folder_favorites",
            ["owner_user_id", "updated_at"],
            unique=False,
        )


def downgrade():
    bind = op.get_bind()
    if "output_folder_favorites" in _table_names(bind):
        op.drop_index(
            "ix_output_folder_favorites_owner_updated",
            table_name="output_folder_favorites",
        )
        op.drop_index(
            "ix_output_folder_favorites_owner_user_id",
            table_name="output_folder_favorites",
        )
        op.drop_table("output_folder_favorites")
    if "ck_sources_creation_authority" in _check_names(bind, "sources"):
        op.drop_constraint(
            "ck_sources_creation_authority",
            "sources",
            type_="check",
        )
    source_columns = _column_names(bind, "sources")
    if "source_created_at_provenance" in source_columns:
        op.drop_column("sources", "source_created_at_provenance")
    if "source_created_at" in source_columns:
        op.drop_column("sources", "source_created_at")

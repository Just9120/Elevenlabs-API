"""user owned projects

Revision ID: 0002_user_projects
Revises: 0001_platform_core
Create Date: 2026-07-01
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_user_projects"
down_revision = "0001_platform_core"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "projects" not in inspector.get_table_names():
        op.create_table(
            "projects",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("owner_user_id", sa.String(length=36), nullable=False),
            sa.Column("title", sa.String(length=160), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    indexes = {idx["name"] for idx in inspector.get_indexes("projects")}
    if op.f("ix_projects_owner_user_id") not in indexes:
        op.create_index(op.f("ix_projects_owner_user_id"), "projects", ["owner_user_id"], unique=False)
    if op.f("ix_projects_updated_at") not in indexes:
        op.create_index(op.f("ix_projects_updated_at"), "projects", ["updated_at"], unique=False)
    if op.f("ix_projects_archived_at") not in indexes:
        op.create_index(op.f("ix_projects_archived_at"), "projects", ["archived_at"], unique=False)
    if "ix_projects_owner_active_updated" not in indexes:
        op.create_index("ix_projects_owner_active_updated", "projects", ["owner_user_id", "archived_at", "updated_at"], unique=False)


def downgrade():
    op.drop_index("ix_projects_owner_active_updated", table_name="projects")
    op.drop_index(op.f("ix_projects_archived_at"), table_name="projects")
    op.drop_index(op.f("ix_projects_updated_at"), table_name="projects")
    op.drop_index(op.f("ix_projects_owner_user_id"), table_name="projects")
    op.drop_table("projects")

"""project sources and output drive folder

Revision ID: 0003_project_sources
Revises: 0002_user_projects
Create Date: 2026-07-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003_project_sources"
down_revision = "0002_user_projects"
branch_labels = None
depends_on = None

source_type = postgresql.ENUM(
    "local_upload",
    "google_drive",
    name="sourcetype",
    create_type=False,
)
upload_status = postgresql.ENUM(
    "pending",
    "uploaded",
    "deleted",
    "expired",
    "failed",
    name="sourceuploadstatus",
    create_type=False,
)


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("projects")}
    if "output_drive_folder_id" not in columns:
        op.add_column("projects", sa.Column("output_drive_folder_id", sa.String(length=256), nullable=True))
    if "output_drive_folder_url" not in columns:
        op.add_column("projects", sa.Column("output_drive_folder_url", sa.Text(), nullable=True))
    if "output_drive_folder_name" not in columns:
        op.add_column("projects", sa.Column("output_drive_folder_name", sa.String(length=512), nullable=True))
    source_type.create(bind, checkfirst=True)
    upload_status.create(bind, checkfirst=True)
    if "sources" not in inspector.get_table_names():
        op.create_table(
            "sources",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("project_id", sa.String(length=36), nullable=False),
            sa.Column("source_type", source_type, nullable=False),
            sa.Column("original_filename", sa.String(length=255), nullable=False),
            sa.Column("mime_type", sa.String(length=255), nullable=True),
            sa.Column("size_bytes", sa.Integer(), nullable=True),
            sa.Column("drive_file_id", sa.String(length=256), nullable=True),
            sa.Column("drive_file_url", sa.Text(), nullable=True),
            sa.Column("s3_bucket", sa.String(length=255), nullable=True),
            sa.Column("s3_object_key", sa.Text(), nullable=True),
            sa.Column("upload_status", upload_status, nullable=False),
            sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("delete_reason", sa.String(length=80), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    inspector = sa.inspect(bind)
    indexes = {idx["name"] for idx in inspector.get_indexes("sources")}
    for name, cols in {
        op.f("ix_sources_project_id"): ["project_id"],
        op.f("ix_sources_source_type"): ["source_type"],
        op.f("ix_sources_upload_status"): ["upload_status"],
        op.f("ix_sources_expires_at"): ["expires_at"],
        op.f("ix_sources_deleted_at"): ["deleted_at"],
        "ix_sources_project_status": ["project_id", "upload_status", "created_at"],
    }.items():
        if name not in indexes:
            op.create_index(name, "sources", cols, unique=False)


def downgrade():
    op.drop_index("ix_sources_project_status", table_name="sources")
    op.drop_index(op.f("ix_sources_deleted_at"), table_name="sources")
    op.drop_index(op.f("ix_sources_expires_at"), table_name="sources")
    op.drop_index(op.f("ix_sources_upload_status"), table_name="sources")
    op.drop_index(op.f("ix_sources_source_type"), table_name="sources")
    op.drop_index(op.f("ix_sources_project_id"), table_name="sources")
    op.drop_table("sources")
    upload_status.drop(op.get_bind(), checkfirst=True)
    source_type.drop(op.get_bind(), checkfirst=True)
    op.drop_column("projects", "output_drive_folder_name")
    op.drop_column("projects", "output_drive_folder_url")
    op.drop_column("projects", "output_drive_folder_id")

"""persist source multipart upload authority

Revision ID: 0032_source_multipart_authority
Revises: 0031_provider_account_snapshots
Create Date: 2026-09-01
"""

from alembic import op
import sqlalchemy as sa


revision = "0032_source_multipart_authority"
down_revision = "0031_provider_account_snapshots"
branch_labels = None
depends_on = None
release_safety = "additive"


TABLE = "sources"
COLUMNS = {
    "upload_protocol",
    "multipart_upload_id",
    "multipart_part_size_bytes",
    "multipart_part_count",
    "multipart_completed_at",
}


def _present_columns(bind) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(TABLE)}


def _require_clean_boundary(bind) -> bool:
    present = _present_columns(bind)
    found = present & COLUMNS
    if not found:
        return True
    if found == COLUMNS:
        return False
    raise RuntimeError("partial source multipart authority schema")


def upgrade():
    bind = op.get_bind()
    if not _require_clean_boundary(bind):
        return
    op.add_column(
        TABLE,
        sa.Column(
            "upload_protocol",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'single_put'"),
        ),
    )
    op.add_column(TABLE, sa.Column("multipart_upload_id", sa.Text()))
    op.add_column(TABLE, sa.Column("multipart_part_size_bytes", sa.Integer()))
    op.add_column(TABLE, sa.Column("multipart_part_count", sa.Integer()))
    op.add_column(TABLE, sa.Column("multipart_completed_at", sa.DateTime(timezone=True)))
    op.create_check_constraint(
        "ck_sources_upload_protocol",
        TABLE,
        "upload_protocol IN ('single_put','multipart')",
    )
    op.create_check_constraint(
        "ck_sources_multipart_authority",
        TABLE,
        "((upload_protocol = 'single_put' AND multipart_upload_id IS NULL "
        "AND multipart_part_size_bytes IS NULL AND multipart_part_count IS NULL "
        "AND multipart_completed_at IS NULL) OR "
        "(upload_protocol = 'multipart' AND multipart_upload_id IS NOT NULL "
        "AND multipart_part_size_bytes >= 5242880 AND multipart_part_count >= 1))",
    )


def downgrade():
    bind = op.get_bind()
    if not (_present_columns(bind) & COLUMNS):
        return
    _require_clean_boundary(bind)
    op.drop_constraint("ck_sources_multipart_authority", TABLE, type_="check")
    op.drop_constraint("ck_sources_upload_protocol", TABLE, type_="check")
    op.drop_column(TABLE, "multipart_completed_at")
    op.drop_column(TABLE, "multipart_part_count")
    op.drop_column(TABLE, "multipart_part_size_bytes")
    op.drop_column(TABLE, "multipart_upload_id")
    op.drop_column(TABLE, "upload_protocol")

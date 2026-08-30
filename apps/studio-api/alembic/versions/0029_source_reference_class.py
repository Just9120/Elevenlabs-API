"""separate source reference storage classes

Revision ID: 0029_source_reference_class
Revises: 0028_transcript_maintenance_runs
Create Date: 2026-08-30
"""

from alembic import op
import sqlalchemy as sa


revision = "0029_source_reference_class"
down_revision = "0028_transcript_maintenance_runs"
branch_labels = None
depends_on = None
release_safety = "additive"


def _columns(bind) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns("sources")}


def upgrade():
    bind = op.get_bind()
    if "reference_class" in _columns(bind):
        return
    op.add_column(
        "sources",
        sa.Column(
            "reference_class",
            sa.String(length=32),
            server_default=sa.text("'transcription'"),
            nullable=False,
        ),
    )
    op.create_check_constraint(
        "ck_sources_reference_class",
        "sources",
        "reference_class IN ('transcription','audio_processing')",
    )
    op.create_index(
        "ix_sources_reference_class",
        "sources",
        ["reference_class"],
        unique=False,
    )


def downgrade():
    bind = op.get_bind()
    if "reference_class" not in _columns(bind):
        return
    op.drop_index("ix_sources_reference_class", table_name="sources")
    op.drop_constraint("ck_sources_reference_class", "sources", type_="check")
    op.drop_column("sources", "reference_class")

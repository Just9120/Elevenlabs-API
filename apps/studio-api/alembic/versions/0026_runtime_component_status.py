"""add authoritative runtime component status

Revision ID: 0026_runtime_component_status
Revises: 0025_audio_preparation
Create Date: 2026-08-28
"""

from alembic import op
import sqlalchemy as sa


revision = "0026_runtime_component_status"
down_revision = "0025_audio_preparation"
branch_labels = None
depends_on = None
release_safety = "additive"


def upgrade():
    bind = op.get_bind()
    if "runtime_component_status" in set(sa.inspect(bind).get_table_names()):
        return
    op.create_table(
        "runtime_component_status",
        sa.Column("component", sa.String(length=20), nullable=False),
        sa.Column("instance_id", sa.String(length=128), nullable=False),
        sa.Column("release_version", sa.String(length=120), nullable=False),
        sa.Column("build_id", sa.String(length=120), nullable=False),
        sa.Column("commit_sha", sa.String(length=40), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("component IN ('worker')", name="ck_runtime_component_status_component"),
        sa.PrimaryKeyConstraint("component"),
    )


def downgrade():
    bind = op.get_bind()
    if "runtime_component_status" not in set(sa.inspect(bind).get_table_names()):
        return
    op.drop_table("runtime_component_status")

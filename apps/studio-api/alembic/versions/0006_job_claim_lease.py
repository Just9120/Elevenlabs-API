"""job claim lease

Revision ID: 0006_job_claim_lease
Revises: 0005_transcription_jobs
Create Date: 2026-07-10
"""
from alembic import op
import sqlalchemy as sa

revision = "0006_job_claim_lease"
down_revision = "0005_transcription_jobs"
branch_labels = None
depends_on = None

LEASE_INDEX_NAME = "ix_transcription_jobs_status_lease_expires_created"
LEASE_COLUMNS = {
    "lease_owner_id": sa.Column("lease_owner_id", sa.String(length=128), nullable=True),
    "lease_generation": sa.Column("lease_generation", sa.Integer(), server_default=sa.text("0"), nullable=False),
    "claimed_at": sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
    "lease_expires_at": sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
}


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("transcription_jobs")}
    for name, column in LEASE_COLUMNS.items():
        if name not in columns:
            op.add_column("transcription_jobs", column)

    indexes = {idx["name"] for idx in sa.inspect(bind).get_indexes("transcription_jobs")}
    if LEASE_INDEX_NAME not in indexes:
        op.create_index(
            LEASE_INDEX_NAME,
            "transcription_jobs",
            ["status", "lease_expires_at", "created_at"],
            unique=False,
        )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = {idx["name"] for idx in inspector.get_indexes("transcription_jobs")}
    if LEASE_INDEX_NAME in indexes:
        op.drop_index(LEASE_INDEX_NAME, table_name="transcription_jobs")

    columns = {column["name"] for column in sa.inspect(bind).get_columns("transcription_jobs")}
    for name in reversed(LEASE_COLUMNS):
        if name in columns:
            op.drop_column("transcription_jobs", name)

"""job processing lifecycle

Revision ID: 0007_job_processing_lifecycle
Revises: 0006_job_claim_lease
Create Date: 2026-07-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0007_job_processing_lifecycle"
down_revision = "0006_job_claim_lease"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE jobstatus ADD VALUE IF NOT EXISTS 'processing'")
    columns = {column["name"] for column in inspector.get_columns("transcription_jobs")}
    if "attempt_count" not in columns:
        op.add_column("transcription_jobs", sa.Column("attempt_count", sa.Integer(), server_default=sa.text("0"), nullable=False))
    if "cancel_requested_at" not in columns:
        op.add_column("transcription_jobs", sa.Column("cancel_requested_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("transcription_jobs")}
    if "cancel_requested_at" in columns:
        op.drop_column("transcription_jobs", "cancel_requested_at")
    if "attempt_count" in columns:
        op.drop_column("transcription_jobs", "attempt_count")
    if bind.dialect.name == "postgresql":
        # PostgreSQL cannot drop a single enum label. Convert processing rows back
        # to queued for downgrade compatibility, then rebuild the enum without it.
        op.execute("UPDATE transcription_jobs SET status = 'queued' WHERE status = 'processing'")
        old = postgresql.ENUM("queued", "processing", "cancelled", "failed", "completed", name="jobstatus")
        new = postgresql.ENUM("queued", "cancelled", "failed", "completed", name="jobstatus_new")
        new.create(bind, checkfirst=False)
        op.execute("ALTER TABLE transcription_jobs ALTER COLUMN status TYPE jobstatus_new USING status::text::jobstatus_new")
        old.drop(bind, checkfirst=False)
        op.execute("ALTER TYPE jobstatus_new RENAME TO jobstatus")

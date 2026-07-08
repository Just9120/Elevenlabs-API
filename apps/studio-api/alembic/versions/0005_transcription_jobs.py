"""transcription jobs

Revision ID: 0005_transcription_jobs
Revises: 0004_google_oauth
Create Date: 2026-07-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005_transcription_jobs"
down_revision = "0004_google_oauth"
branch_labels = None
depends_on = None

job_status = postgresql.ENUM("queued", "cancelled", "failed", "completed", name="jobstatus", create_type=False)
job_source_status = postgresql.ENUM("queued", "skipped", name="jobsourcestatus", create_type=False)


def upgrade():
    bind = op.get_bind()
    job_status.create(bind, checkfirst=True)
    job_source_status.create(bind, checkfirst=True)
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()
    if "transcription_jobs" not in tables:
        op.create_table(
            "transcription_jobs",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("project_id", sa.String(length=36), nullable=False),
            sa.Column("owner_user_id", sa.String(length=36), nullable=False),
            sa.Column("status", job_status, nullable=False),
            sa.Column("provider", sa.String(length=40), nullable=True),
            sa.Column("provider_credential_id", sa.String(length=36), nullable=True),
            sa.Column("title", sa.String(length=160), nullable=True),
            sa.Column("language", sa.String(length=40), nullable=True),
            sa.Column("options_json", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("error_code", sa.String(length=80), nullable=True),
            sa.Column("error_message", sa.String(length=512), nullable=True),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["provider_credential_id"], ["provider_credentials.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    if "transcription_job_sources" not in tables:
        op.create_table(
            "transcription_job_sources",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("job_id", sa.String(length=36), nullable=False),
            sa.Column("source_id", sa.String(length=36), nullable=False),
            sa.Column("position", sa.Integer(), nullable=False),
            sa.Column("status", job_source_status, nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["job_id"], ["transcription_jobs.id"]),
            sa.ForeignKeyConstraint(["source_id"], ["sources.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("job_id", "source_id", name="uq_transcription_job_source"),
        )
    for table, indexes in {
        "transcription_jobs": {
            op.f("ix_transcription_jobs_project_id"): ["project_id"],
            op.f("ix_transcription_jobs_owner_user_id"): ["owner_user_id"],
            op.f("ix_transcription_jobs_status"): ["status"],
            op.f("ix_transcription_jobs_provider_credential_id"): ["provider_credential_id"],
            "ix_transcription_jobs_project_status_created": ["project_id", "status", "created_at"],
        },
        "transcription_job_sources": {
            op.f("ix_transcription_job_sources_job_id"): ["job_id"],
            op.f("ix_transcription_job_sources_source_id"): ["source_id"],
            "ix_transcription_job_sources_job_position": ["job_id", "position"],
        },
    }.items():
        existing = {idx["name"] for idx in sa.inspect(bind).get_indexes(table)}
        for name, cols in indexes.items():
            if name not in existing:
                op.create_index(name, table, cols, unique=False)


def downgrade():
    op.drop_table("transcription_job_sources")
    op.drop_table("transcription_jobs")
    job_source_status.drop(op.get_bind(), checkfirst=True)
    job_status.drop(op.get_bind(), checkfirst=True)

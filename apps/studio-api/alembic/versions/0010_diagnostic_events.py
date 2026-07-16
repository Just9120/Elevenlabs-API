"""diagnostic events

Revision ID: 0010_diagnostic_events
Revises: 0009_job_output_destinations
Create Date: 2026-07-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0010_diagnostic_events"
down_revision = "0009_job_output_destinations"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "diagnostic_events" in inspector.get_table_names():
        return
    op.create_table(
        "diagnostic_events",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("owner_user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("project_id", sa.String(length=36), sa.ForeignKey("projects.id"), nullable=True),
        sa.Column("job_id", sa.String(length=36), sa.ForeignKey("transcription_jobs.id"), nullable=True),
        sa.Column("level", sa.Enum("ERROR", "WARNING", "INFO", "DEBUG", name="diagnosticlevel"), nullable=False),
        sa.Column("component", sa.Enum("web", "api", "worker", name="diagnosticcomponent"), nullable=False),
        sa.Column("event_code", sa.String(length=80), nullable=False),
        sa.Column("correlation_id", sa.String(length=128), nullable=True),
        sa.Column("request_id", sa.String(length=128), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("first_occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("occurrence_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("dedup_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("dedup_bucket", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("level IN ('ERROR','WARNING','INFO','DEBUG')", name="ck_diagnostic_events_level"),
        sa.CheckConstraint("component IN ('web','api','worker')", name="ck_diagnostic_events_component"),
        sa.CheckConstraint("occurrence_count >= 1", name="ck_diagnostic_events_occurrence_count"),
        sa.UniqueConstraint("dedup_fingerprint", name="uq_diagnostic_events_dedup_fingerprint"),
    )
    op.create_index("ix_diagnostic_events_owner_time", "diagnostic_events", ["owner_user_id", "first_occurred_at"])
    op.create_index("ix_diagnostic_events_owner_project_time", "diagnostic_events", ["owner_user_id", "project_id", "first_occurred_at"])
    op.create_index("ix_diagnostic_events_owner_job_time", "diagnostic_events", ["owner_user_id", "job_id", "first_occurred_at"])
    op.create_index("ix_diagnostic_events_owner_component_level_time", "diagnostic_events", ["owner_user_id", "component", "level", "first_occurred_at"])
    op.create_index("ix_diagnostic_events_expires_at", "diagnostic_events", ["expires_at"])


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "diagnostic_events" not in inspector.get_table_names():
        return
    op.drop_index("ix_diagnostic_events_expires_at", table_name="diagnostic_events")
    op.drop_index("ix_diagnostic_events_owner_component_level_time", table_name="diagnostic_events")
    op.drop_index("ix_diagnostic_events_owner_job_time", table_name="diagnostic_events")
    op.drop_index("ix_diagnostic_events_owner_project_time", table_name="diagnostic_events")
    op.drop_index("ix_diagnostic_events_owner_time", table_name="diagnostic_events")
    op.drop_table("diagnostic_events")
    if bind.dialect.name == "postgresql":
        op.execute("DROP TYPE IF EXISTS diagnosticcomponent")
        op.execute("DROP TYPE IF EXISTS diagnosticlevel")

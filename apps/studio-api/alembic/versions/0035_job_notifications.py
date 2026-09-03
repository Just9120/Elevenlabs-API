"""durable job notifications and bounded automatic retry

Revision ID: 0035_job_notifications
Revises: 0034_personal_security
Create Date: 2026-09-03
"""

from alembic import op
import sqlalchemy as sa


revision = "0035_job_notifications"
down_revision = "0034_personal_security"
branch_labels = None
depends_on = None
release_safety = "additive"


def upgrade():
    op.add_column("transcription_jobs", sa.Column("retry_not_before_at", sa.DateTime(timezone=True)))
    op.add_column("transcription_jobs", sa.Column("automatic_retry_reason", sa.String(80)))
    op.create_index("ix_transcription_jobs_retry_schedule", "transcription_jobs", ["status", "retry_not_before_at", "created_at"])

    op.create_table(
        "user_notification_preferences",
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("web_push_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("email_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("telegram_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "web_push_subscriptions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner_user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("endpoint_fingerprint", sa.String(64), nullable=False),
        sa.Column("ciphertext", sa.LargeBinary(), nullable=False),
        sa.Column("nonce", sa.LargeBinary(), nullable=False),
        sa.Column("key_id", sa.String(80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("owner_user_id", "endpoint_fingerprint", name="uq_web_push_subscription_owner_endpoint"),
    )
    op.create_index("ix_web_push_subscriptions_owner_active", "web_push_subscriptions", ["owner_user_id", "revoked_at", "created_at"])
    op.create_table(
        "job_notification_deliveries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner_user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("job_id", sa.String(36), sa.ForeignKey("transcription_jobs.id"), nullable=False),
        sa.Column("terminal_status", sa.String(16), nullable=False),
        sa.Column("attempt_number", sa.Integer(), nullable=False),
        sa.Column("channel", sa.String(24), nullable=False),
        sa.Column("destination_id", sa.String(64), nullable=False),
        sa.Column("state", sa.String(16), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("claim_token", sa.String(64)),
        sa.Column("claim_expires_at", sa.DateTime(timezone=True)),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True)),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True)),
        sa.Column("delivered_at", sa.DateTime(timezone=True)),
        sa.Column("error_code", sa.String(80)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("job_id", "terminal_status", "attempt_number", "channel", "destination_id", name="uq_job_notification_delivery_terminal_destination"),
        sa.CheckConstraint("terminal_status IN ('completed','failed')", name="ck_job_notification_deliveries_terminal_status"),
        sa.CheckConstraint("channel IN ('web_push','email','telegram')", name="ck_job_notification_deliveries_channel"),
        sa.CheckConstraint("state IN ('pending','claimed','delivered','failed','suppressed')", name="ck_job_notification_deliveries_state"),
        sa.CheckConstraint("attempt_number >= 1", name="ck_job_notification_deliveries_attempt_number"),
        sa.CheckConstraint("attempt_count >= 0 AND attempt_count <= 5", name="ck_job_notification_deliveries_attempt_count"),
    )
    op.create_index("ix_job_notification_deliveries_claim", "job_notification_deliveries", ["state", "next_attempt_at", "claim_expires_at", "created_at"])
    op.create_index("ix_job_notification_deliveries_owner_created", "job_notification_deliveries", ["owner_user_id", "created_at", "id"])


def downgrade():
    op.drop_table("job_notification_deliveries")
    op.drop_table("web_push_subscriptions")
    op.drop_table("user_notification_preferences")
    op.drop_index("ix_transcription_jobs_retry_schedule", table_name="transcription_jobs")
    op.drop_column("transcription_jobs", "automatic_retry_reason")
    op.drop_column("transcription_jobs", "retry_not_before_at")

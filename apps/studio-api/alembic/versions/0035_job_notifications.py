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

JOB_TABLE = "transcription_jobs"
JOB_COLUMNS = {"retry_not_before_at", "automatic_retry_reason"}
PREFERENCES_TABLE = "user_notification_preferences"
WEB_PUSH_TABLE = "web_push_subscriptions"
DELIVERY_TABLE = "job_notification_deliveries"
TABLE_COLUMNS = {
    PREFERENCES_TABLE: {
        "user_id",
        "web_push_enabled",
        "email_enabled",
        "telegram_enabled",
        "created_at",
        "updated_at",
    },
    WEB_PUSH_TABLE: {
        "id",
        "owner_user_id",
        "endpoint_fingerprint",
        "ciphertext",
        "nonce",
        "key_id",
        "created_at",
        "updated_at",
        "revoked_at",
    },
    DELIVERY_TABLE: {
        "id",
        "owner_user_id",
        "job_id",
        "terminal_status",
        "attempt_number",
        "channel",
        "destination_id",
        "state",
        "attempt_count",
        "claim_token",
        "claim_expires_at",
        "next_attempt_at",
        "last_attempt_at",
        "delivered_at",
        "error_code",
        "created_at",
        "updated_at",
    },
}


def _tables(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def _columns(bind, table: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table)}


def _table_needs_create(bind, table: str) -> bool:
    if table not in _tables(bind):
        return True
    missing = TABLE_COLUMNS[table] - _columns(bind, table)
    if missing:
        raise RuntimeError(f"partial job notification schema for {table}: missing {sorted(missing)}")
    return False


def _job_columns_need_create(bind) -> bool:
    present = _columns(bind, JOB_TABLE) & JOB_COLUMNS
    if not present:
        return True
    if present == JOB_COLUMNS:
        return False
    raise RuntimeError("partial automatic job retry schema")


def _ensure_index(bind, name: str, table: str, columns: list[str]) -> None:
    existing = {index["name"] for index in sa.inspect(bind).get_indexes(table)}
    if name not in existing:
        op.create_index(name, table, columns)


def upgrade():
    bind = op.get_bind()
    if _job_columns_need_create(bind):
        op.add_column(JOB_TABLE, sa.Column("retry_not_before_at", sa.DateTime(timezone=True)))
        op.add_column(JOB_TABLE, sa.Column("automatic_retry_reason", sa.String(80)))
    _ensure_index(
        bind,
        "ix_transcription_jobs_retry_schedule",
        JOB_TABLE,
        ["status", "retry_not_before_at", "created_at"],
    )

    if _table_needs_create(bind, PREFERENCES_TABLE):
        op.create_table(
            PREFERENCES_TABLE,
            sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), primary_key=True),
            sa.Column("web_push_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("email_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("telegram_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
    if _table_needs_create(bind, WEB_PUSH_TABLE):
        op.create_table(
            WEB_PUSH_TABLE,
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
    _ensure_index(
        bind,
        "ix_web_push_subscriptions_owner_active",
        WEB_PUSH_TABLE,
        ["owner_user_id", "revoked_at", "created_at"],
    )
    if _table_needs_create(bind, DELIVERY_TABLE):
        op.create_table(
            DELIVERY_TABLE,
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
    _ensure_index(
        bind,
        "ix_job_notification_deliveries_claim",
        DELIVERY_TABLE,
        ["state", "next_attempt_at", "claim_expires_at", "created_at"],
    )
    _ensure_index(
        bind,
        "ix_job_notification_deliveries_owner_created",
        DELIVERY_TABLE,
        ["owner_user_id", "created_at", "id"],
    )


def downgrade():
    bind = op.get_bind()
    tables = _tables(bind)
    for table in (DELIVERY_TABLE, WEB_PUSH_TABLE, PREFERENCES_TABLE):
        if table in tables:
            op.drop_table(table)
    present = _columns(bind, JOB_TABLE) & JOB_COLUMNS
    if not present:
        return
    if present != JOB_COLUMNS:
        raise RuntimeError("partial automatic job retry schema")
    indexes = {index["name"] for index in sa.inspect(bind).get_indexes(JOB_TABLE)}
    if "ix_transcription_jobs_retry_schedule" in indexes:
        op.drop_index("ix_transcription_jobs_retry_schedule", table_name=JOB_TABLE)
    op.drop_column(JOB_TABLE, "automatic_retry_reason")
    op.drop_column(JOB_TABLE, "retry_not_before_at")

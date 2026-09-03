"""provider-neutral STT, Yandex operations and owner dictionaries

Revision ID: 0036_stt_multiprovider
Revises: 0035_job_notifications
Create Date: 2026-09-03
"""

from alembic import op
import sqlalchemy as sa


revision = "0036_stt_multiprovider"
down_revision = "0035_job_notifications"
branch_labels = None
depends_on = None
release_safety = "additive"


def _tables(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def _columns(bind, table: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table)}


def _ensure_column(bind, table: str, column: sa.Column) -> None:
    if column.name not in _columns(bind, table):
        op.add_column(table, column)


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE credentialprovider ADD VALUE IF NOT EXISTS 'yandex'")

    _ensure_column(bind, "provider_credentials", sa.Column("config_json", sa.Text()))
    _ensure_column(
        bind,
        "transcription_jobs",
        sa.Column(
            "operating_mode",
            sa.String(24),
            nullable=False,
            server_default=sa.text("'standard'"),
        ),
    )
    existing_job_checks = {
        check.get("name") for check in sa.inspect(bind).get_check_constraints("transcription_jobs")
    }
    if bind.dialect.name != "sqlite" and "ck_transcription_jobs_operating_mode" not in existing_job_checks:
        op.create_check_constraint(
            "ck_transcription_jobs_operating_mode",
            "transcription_jobs",
            "operating_mode IN ('economic','standard','premium')",
        )

    tables = _tables(bind)
    if "stt_dictionaries" not in tables:
        op.create_table(
            "stt_dictionaries",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("owner_user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("name", sa.String(120), nullable=False),
            sa.Column("normalized_name", sa.String(120), nullable=False),
            sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("owner_user_id", "normalized_name", name="uq_stt_dictionaries_owner_name"),
            sa.CheckConstraint("length(trim(name)) > 0", name="ck_stt_dictionaries_name_nonempty"),
            sa.CheckConstraint("length(trim(normalized_name)) > 0", name="ck_stt_dictionaries_normalized_name_nonempty"),
        )
        op.create_index("ix_stt_dictionaries_owner_active_updated", "stt_dictionaries", ["owner_user_id", "active", "updated_at"])
    if "stt_dictionary_entries" not in tables:
        op.create_table(
            "stt_dictionary_entries",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("dictionary_id", sa.String(36), sa.ForeignKey("stt_dictionaries.id", ondelete="CASCADE"), nullable=False),
            sa.Column("owner_user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("kind", sa.String(24), nullable=False),
            sa.Column("value", sa.String(160), nullable=False),
            sa.Column("normalized_value", sa.String(160), nullable=False),
            sa.Column("position", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("dictionary_id", "kind", "normalized_value", name="uq_stt_dictionary_entries_kind_value"),
            sa.UniqueConstraint("dictionary_id", "position", name="uq_stt_dictionary_entries_position"),
            sa.CheckConstraint("kind IN ('term','surname','name','abbreviation')", name="ck_stt_dictionary_entries_kind"),
            sa.CheckConstraint("length(trim(value)) > 0", name="ck_stt_dictionary_entries_value_nonempty"),
            sa.CheckConstraint("position >= 0 AND position < 500", name="ck_stt_dictionary_entries_position"),
        )
        op.create_index("ix_stt_dictionary_entries_owner_dictionary", "stt_dictionary_entries", ["owner_user_id", "dictionary_id", "position"])
    if "stt_provider_operations" not in tables:
        op.create_table(
            "stt_provider_operations",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("owner_user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id"), nullable=False),
            sa.Column("job_id", sa.String(36), sa.ForeignKey("transcription_jobs.id"), nullable=False),
            sa.Column("job_source_id", sa.String(36), sa.ForeignKey("transcription_job_sources.id"), nullable=False),
            sa.Column("attempt_number", sa.Integer(), nullable=False),
            sa.Column("provider", sa.String(40), nullable=False),
            sa.Column("operating_mode", sa.String(24), nullable=False),
            sa.Column("model", sa.String(80), nullable=False),
            sa.Column("operation_id", sa.String(256), nullable=False),
            sa.Column("status", sa.String(24), nullable=False, server_default=sa.text("'pending'")),
            sa.Column("result_ciphertext", sa.LargeBinary()),
            sa.Column("result_nonce", sa.LargeBinary()),
            sa.Column("result_key_id", sa.String(80)),
            sa.Column("result_hmac", sa.String(64)),
            sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("last_polled_at", sa.DateTime(timezone=True)),
            sa.Column("completed_at", sa.DateTime(timezone=True)),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("job_source_id", "attempt_number", name="uq_stt_provider_operations_source_attempt"),
            sa.UniqueConstraint("provider", "operation_id", name="uq_stt_provider_operations_provider_operation"),
            sa.CheckConstraint("attempt_number >= 1", name="ck_stt_provider_operations_attempt_positive"),
            sa.CheckConstraint("provider IN ('yandex')", name="ck_stt_provider_operations_provider"),
            sa.CheckConstraint("operating_mode IN ('economic','standard','premium')", name="ck_stt_provider_operations_mode"),
            sa.CheckConstraint("status IN ('pending','completed','failed')", name="ck_stt_provider_operations_status"),
            sa.CheckConstraint("((result_ciphertext IS NULL AND result_nonce IS NULL AND result_key_id IS NULL AND result_hmac IS NULL) OR (result_ciphertext IS NOT NULL AND result_nonce IS NOT NULL AND result_key_id IS NOT NULL AND length(result_hmac) = 64))", name="ck_stt_provider_operations_result_shape"),
        )
        op.create_index("ix_stt_provider_operations_job_source", "stt_provider_operations", ["job_source_id", "attempt_number"])
        op.create_index("ix_stt_provider_operations_pending", "stt_provider_operations", ["status", "last_polled_at", "created_at"])
    if "stt_provider_health" not in tables:
        op.create_table(
            "stt_provider_health",
            sa.Column("provider", sa.String(40), primary_key=True),
            sa.Column("operating_mode", sa.String(24), primary_key=True),
            sa.Column("consecutive_failures", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("circuit_open_until", sa.DateTime(timezone=True)),
            sa.Column("last_failure_code", sa.String(80)),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.CheckConstraint("provider IN ('elevenlabs','yandex')", name="ck_stt_provider_health_provider"),
            sa.CheckConstraint("operating_mode IN ('economic','standard','premium','realtime')", name="ck_stt_provider_health_mode"),
            sa.CheckConstraint("consecutive_failures >= 0", name="ck_stt_provider_health_failures_nonnegative"),
        )
        op.execute(
            "INSERT INTO stt_provider_health "
            "(provider, operating_mode, consecutive_failures, updated_at) VALUES "
            "('elevenlabs','economic',0,CURRENT_TIMESTAMP),"
            "('elevenlabs','standard',0,CURRENT_TIMESTAMP),"
            "('elevenlabs','premium',0,CURRENT_TIMESTAMP),"
            "('elevenlabs','realtime',0,CURRENT_TIMESTAMP),"
            "('yandex','economic',0,CURRENT_TIMESTAMP),"
            "('yandex','standard',0,CURRENT_TIMESTAMP),"
            "('yandex','premium',0,CURRENT_TIMESTAMP),"
            "('yandex','realtime',0,CURRENT_TIMESTAMP)"
        )


def downgrade():
    bind = op.get_bind()
    tables = _tables(bind)
    for table in ("stt_provider_health", "stt_provider_operations", "stt_dictionary_entries", "stt_dictionaries"):
        if table in tables:
            op.drop_table(table)
    if "operating_mode" in _columns(bind, "transcription_jobs"):
        if bind.dialect.name != "sqlite":
            checks = {check.get("name") for check in sa.inspect(bind).get_check_constraints("transcription_jobs")}
            if "ck_transcription_jobs_operating_mode" in checks:
                op.drop_constraint("ck_transcription_jobs_operating_mode", "transcription_jobs", type_="check")
        op.drop_column("transcription_jobs", "operating_mode")
    if "config_json" in _columns(bind, "provider_credentials"):
        op.drop_column("provider_credentials", "config_json")
    # PostgreSQL enum values are intentionally not removed during downgrade.

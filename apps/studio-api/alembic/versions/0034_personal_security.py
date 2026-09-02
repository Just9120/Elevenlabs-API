"""personal security and long-transcription policy

Revision ID: 0034_personal_security
Revises: 0033_observability_alerts_audit
Create Date: 2026-09-02
"""

from alembic import op
import sqlalchemy as sa


revision = "0034_personal_security"
down_revision = "0033_observability_alerts_audit"
branch_labels = None
depends_on = None
release_safety = "additive"


SESSION_COLUMN = "reauthenticated_at"
TRANSCRIPTION_JOB_COLUMN = "long_duration_cost_confirmed"
TOTP_FACTOR_TABLE = "user_totp_factors"
TOTP_RECOVERY_TABLE = "user_totp_recovery_codes"
PASSWORD_RESET_TABLE = "password_reset_challenges"

TABLE_COLUMNS = {
    TOTP_FACTOR_TABLE: {
        "user_id",
        "secret_ciphertext",
        "secret_nonce",
        "key_id",
        "confirmed_at",
        "disabled_at",
        "created_at",
        "updated_at",
    },
    TOTP_RECOVERY_TABLE: {
        "id",
        "user_id",
        "code_hash",
        "created_at",
        "used_at",
    },
    PASSWORD_RESET_TABLE: {
        "id",
        "user_id",
        "token_hash",
        "request_fingerprint",
        "created_at",
        "expires_at",
        "used_at",
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
        raise RuntimeError(
            f"partial personal security schema for {table}: missing {sorted(missing)}"
        )
    return False


def upgrade():
    bind = op.get_bind()
    if SESSION_COLUMN not in _columns(bind, "sessions"):
        op.add_column("sessions", sa.Column(SESSION_COLUMN, sa.DateTime(timezone=True)))
    if TRANSCRIPTION_JOB_COLUMN not in _columns(bind, "transcription_jobs"):
        op.add_column(
            "transcription_jobs",
            sa.Column(
                TRANSCRIPTION_JOB_COLUMN,
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
        )
    if _table_needs_create(bind, TOTP_FACTOR_TABLE):
        op.create_table(
            TOTP_FACTOR_TABLE,
            sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), primary_key=True),
            sa.Column("secret_ciphertext", sa.LargeBinary(), nullable=False),
            sa.Column("secret_nonce", sa.LargeBinary(), nullable=False),
            sa.Column("key_id", sa.String(80), nullable=False),
            sa.Column("confirmed_at", sa.DateTime(timezone=True)),
            sa.Column("disabled_at", sa.DateTime(timezone=True)),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
    if _table_needs_create(bind, TOTP_RECOVERY_TABLE):
        op.create_table(
            TOTP_RECOVERY_TABLE,
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("code_hash", sa.String(64), nullable=False, unique=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("used_at", sa.DateTime(timezone=True)),
        )
        op.create_index(
            "ix_user_totp_recovery_codes_user_id",
            TOTP_RECOVERY_TABLE,
            ["user_id"],
        )
    if _table_needs_create(bind, PASSWORD_RESET_TABLE):
        op.create_table(
            PASSWORD_RESET_TABLE,
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("token_hash", sa.String(64), nullable=False),
            sa.Column("request_fingerprint", sa.String(64), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("used_at", sa.DateTime(timezone=True)),
        )
        op.create_index(
            "ix_password_reset_challenges_user_id",
            PASSWORD_RESET_TABLE,
            ["user_id"],
        )
        op.create_index(
            "ix_password_reset_challenges_token_hash",
            PASSWORD_RESET_TABLE,
            ["token_hash"],
            unique=True,
        )
        op.create_index(
            "ix_password_reset_challenges_expires_at",
            PASSWORD_RESET_TABLE,
            ["expires_at"],
        )


def downgrade():
    bind = op.get_bind()
    tables = _tables(bind)
    if PASSWORD_RESET_TABLE in tables:
        op.drop_table(PASSWORD_RESET_TABLE)
    if TOTP_RECOVERY_TABLE in tables:
        op.drop_table(TOTP_RECOVERY_TABLE)
    if TOTP_FACTOR_TABLE in tables:
        op.drop_table(TOTP_FACTOR_TABLE)
    if TRANSCRIPTION_JOB_COLUMN in _columns(bind, "transcription_jobs"):
        op.drop_column("transcription_jobs", TRANSCRIPTION_JOB_COLUMN)
    if SESSION_COLUMN in _columns(bind, "sessions"):
        op.drop_column("sessions", SESSION_COLUMN)

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


def upgrade():
    op.add_column("sessions", sa.Column("reauthenticated_at", sa.DateTime(timezone=True)))
    op.add_column(
        "transcription_jobs",
        sa.Column("long_duration_cost_confirmed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_table(
        "user_totp_factors",
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("secret_ciphertext", sa.LargeBinary(), nullable=False),
        sa.Column("secret_nonce", sa.LargeBinary(), nullable=False),
        sa.Column("key_id", sa.String(80), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True)),
        sa.Column("disabled_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "user_totp_recovery_codes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("code_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_user_totp_recovery_codes_user_id", "user_totp_recovery_codes", ["user_id"])
    op.create_table(
        "password_reset_challenges",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("request_fingerprint", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_password_reset_challenges_user_id", "password_reset_challenges", ["user_id"])
    op.create_index("ix_password_reset_challenges_token_hash", "password_reset_challenges", ["token_hash"], unique=True)
    op.create_index("ix_password_reset_challenges_expires_at", "password_reset_challenges", ["expires_at"])


def downgrade():
    op.drop_table("password_reset_challenges")
    op.drop_table("user_totp_recovery_codes")
    op.drop_table("user_totp_factors")
    op.drop_column("transcription_jobs", "long_duration_cost_confirmed")
    op.drop_column("sessions", "reauthenticated_at")

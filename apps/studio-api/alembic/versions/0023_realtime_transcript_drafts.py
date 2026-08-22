"""add encrypted temporary realtime transcript drafts

Revision ID: 0023_realtime_drafts
Revises: 0022_account_operability
Create Date: 2026-08-22
"""

from alembic import op
import sqlalchemy as sa


revision = "0023_realtime_drafts"
down_revision = "0022_account_operability"
branch_labels = None
depends_on = None
release_safety = "additive"


def _table_names(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def upgrade():
    bind = op.get_bind()
    if "realtime_transcript_drafts" in _table_names(bind):
        return
    op.create_table(
        "realtime_transcript_drafts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("owner_user_id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("client_session_id", sa.String(length=64), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("ciphertext", sa.LargeBinary(), nullable=False),
        sa.Column("nonce", sa.LargeBinary(), nullable=False),
        sa.Column("key_id", sa.String(length=80), nullable=False),
        sa.Column("payload_hmac", sa.String(length=64), nullable=False),
        sa.Column("committed_segment_count", sa.Integer(), nullable=False),
        sa.Column("committed_character_count", sa.Integer(), nullable=False),
        sa.Column("partial_character_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "owner_user_id",
            "client_session_id",
            name="uq_realtime_drafts_owner_client_session",
        ),
        sa.CheckConstraint("revision >= 1", name="ck_realtime_drafts_revision_positive"),
        sa.CheckConstraint(
            "committed_segment_count >= 0",
            name="ck_realtime_drafts_segment_count_nonnegative",
        ),
        sa.CheckConstraint(
            "committed_character_count >= 0",
            name="ck_realtime_drafts_committed_chars_nonnegative",
        ),
        sa.CheckConstraint(
            "partial_character_count >= 0",
            name="ck_realtime_drafts_partial_chars_nonnegative",
        ),
        sa.CheckConstraint(
            "length(payload_hmac) = 64",
            name="ck_realtime_drafts_hmac_length",
        ),
    )
    op.create_index(
        "ix_realtime_drafts_owner_project_updated",
        "realtime_transcript_drafts",
        ["owner_user_id", "project_id", "updated_at"],
        unique=False,
    )
    op.create_index(
        "ix_realtime_drafts_expiry",
        "realtime_transcript_drafts",
        ["expires_at"],
        unique=False,
    )


def downgrade():
    bind = op.get_bind()
    if "realtime_transcript_drafts" not in _table_names(bind):
        return
    op.drop_index(
        "ix_realtime_drafts_expiry",
        table_name="realtime_transcript_drafts",
    )
    op.drop_index(
        "ix_realtime_drafts_owner_project_updated",
        table_name="realtime_transcript_drafts",
    )
    op.drop_table("realtime_transcript_drafts")

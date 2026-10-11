"""Personal media context and security mail; preserve existing source expiries."""

from alembic import op
import sqlalchemy as sa

revision = "0041_source_retention_default"
down_revision = "0040_text_lifecycle"
branch_labels = None
depends_on = None
release_safety = "additive"


def _set_default(seconds: int) -> None:
    with op.batch_alter_table("users") as batch:
        batch.alter_column(
            "source_retention_ttl_seconds", existing_type=sa.Integer(),
            existing_nullable=False, server_default=sa.text(str(seconds)),
        )


FIELDS = (("sources", "prepared_audio_context_json"),
          ("transcription_job_source_attempts", "provider_media_plan_json"))


def upgrade() -> None:
    _set_default(259200)
    inspector = sa.inspect(op.get_bind())
    for table, name in FIELDS:
        if name not in {column["name"] for column in inspector.get_columns(table)}:
            op.add_column(table, sa.Column(name, sa.Text(), nullable=True))

    if "security_email_deliveries" not in sa.inspect(op.get_bind()).get_table_names():
        op.create_table("security_email_deliveries",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("owner_user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("dedup_key", sa.String(128), nullable=False, unique=True),
            sa.Column("kind", sa.String(64), nullable=False),
            sa.Column("payload_ciphertext", sa.LargeBinary()), sa.Column("payload_nonce", sa.LargeBinary()),
            sa.Column("state", sa.String(24), nullable=False), sa.Column("attempt_count", sa.Integer(), nullable=False),
            sa.Column("claim_token", sa.String(64)), sa.Column("claim_expires_at", sa.DateTime(timezone=True)),
            sa.Column("next_attempt_at", sa.DateTime(timezone=True)),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("finished_at", sa.DateTime(timezone=True)), sa.Column("error_code", sa.String(64)),
            sa.CheckConstraint("attempt_count >= 0 AND attempt_count <= 3", name="ck_security_email_attempts"))
        op.create_index("ix_security_email_dispatch", "security_email_deliveries", ["state", "next_attempt_at", "created_at"])



def downgrade() -> None:
    if "security_email_deliveries" in sa.inspect(op.get_bind()).get_table_names():
        op.drop_table("security_email_deliveries")
    inspector = sa.inspect(op.get_bind())
    for table, name in reversed(FIELDS):
        if name in {column["name"] for column in inspector.get_columns(table)}:
            op.drop_column(table, name)
    _set_default(86400)

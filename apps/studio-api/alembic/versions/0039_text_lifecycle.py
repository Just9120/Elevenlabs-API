"""Preserve Live and unfinished STT text until explicit retirement.

No ciphertext is removed or re-encrypted. Null expiry also prevents the old
worker expiry selection from collecting existing rows during rollout. Existing
single-part progress becomes eligible for durable restore only when a complete
checkpoint actually exists; missing historical text is never fabricated.
"""

from alembic import op
import sqlalchemy as sa

revision = "0039_text_lifecycle"
down_revision = "0038_trusted_devices"
branch_labels = None
depends_on = None
release_safety = "additive"


def upgrade():
    for table in ("realtime_transcript_drafts", "transcription_provider_part_checkpoints"):
        op.alter_column(table, "expires_at", existing_type=sa.DateTime(timezone=True), nullable=True)
        # Data-preserving metadata change; payload HMAC/AAD do not use expiry.
        op.execute(sa.text(f"UPDATE {table} SET expires_at = NULL WHERE expires_at IS NOT NULL"))
    op.drop_constraint("ck_provider_part_checkpoint_total_parts_multiple", "transcription_provider_part_checkpoints", type_="check")
    op.create_check_constraint("ck_provider_part_checkpoint_total_parts_multiple", "transcription_provider_part_checkpoints", "total_parts >= 1")


def downgrade():
    # Reintroducing TTL and rejecting preserved single-part text is destructive.
    # Recovery is a compatible application rollout, never loss of retained text.
    raise RuntimeError("text lifecycle downgrade requires an explicit data-preserving recovery plan")

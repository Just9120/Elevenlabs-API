"""Preserve text until explicit retirement and bound storage identity lookup.

No ciphertext is removed or re-encrypted. Null expiry also prevents the old
worker expiry selection from collecting existing rows during rollout. Existing
single-part progress becomes eligible for durable restore only when a complete
checkpoint actually exists; missing historical text is never fabricated.
"""

from alembic import op
import sqlalchemy as sa

revision = "0040_text_lifecycle"
down_revision = "0039_audio_diagnostics"
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
    op.create_index("ix_sources_storage_identity", "sources", ["reference_class", "s3_bucket", "s3_object_key"])
    op.add_column("sources", sa.Column("audio_retention_days", sa.Integer(), nullable=True))
    op.create_check_constraint("ck_sources_audio_retention_days", "sources", "audio_retention_days IS NULL OR audio_retention_days IN (3,7,30)")
    # No historical source is enrolled into the new automatic retirement policy.
    op.add_column("sources", sa.Column("delete_after_transcripts", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("audio_preparation_jobs", sa.Column("output_filename", sa.String(255), nullable=True))
    op.add_column("audio_preparation_jobs", sa.Column("output_mime_type", sa.String(255), nullable=True))
    op.add_column("audio_preparation_jobs", sa.Column("output_size_bytes", sa.Integer(), nullable=True))
    op.add_column("audio_preparation_jobs", sa.Column("visual_analysis_json", sa.Text(), nullable=True))
    op.add_column("audio_preparation_jobs", sa.Column("download_slot", sa.Integer(), nullable=True))
    op.add_column("audio_preparation_jobs", sa.Column("download_preview", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("audio_preparation_jobs", sa.Column("download_size_bytes", sa.Integer(), nullable=True))
    op.add_column("audio_preparation_jobs", sa.Column("download_request_id", sa.String(36), nullable=True))
    op.add_column("audio_preparation_jobs", sa.Column("download_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("audio_preparation_jobs", sa.Column("download_previous_stage", sa.String(40), nullable=True))
    op.add_column("audio_preparation_jobs", sa.Column("download_error_code", sa.String(80), nullable=True))
    op.create_check_constraint("ck_audio_download_slot", "audio_preparation_jobs", "download_slot IS NULL OR download_slot = 1")
    op.create_index("uq_audio_download_slot", "audio_preparation_jobs", ["download_slot"], unique=True)
    op.create_index("ix_audio_download_expiry", "audio_preparation_jobs", ["download_expires_at"])


def downgrade():
    # Reintroducing TTL and rejecting preserved single-part text is destructive.
    # Recovery is a compatible application rollout, never loss of retained text.
    raise RuntimeError("text lifecycle downgrade requires an explicit data-preserving recovery plan")

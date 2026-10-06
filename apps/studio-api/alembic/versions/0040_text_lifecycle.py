"""Preserve text until explicit retirement and bound storage identity lookup.

No ciphertext is removed or re-encrypted. Null expiry also prevents the old
worker expiry selection from collecting existing rows during rollout. Existing
single-part progress becomes eligible for durable restore only when a complete
checkpoint actually exists; missing historical text is never fabricated.
"""

from alembic import op
import re
import sqlalchemy as sa

revision = "0040_text_lifecycle"
down_revision = "0039_audio_diagnostics"
branch_labels = None
depends_on = None
release_safety = "additive"


NEW_COLUMNS = {
    "transcription_jobs": [sa.Column("long_duration_preflight_json", sa.Text(), nullable=True)],
    "sources": [
        sa.Column("audio_retention_days", sa.Integer(), nullable=True),
        # No historical source is enrolled into automatic retirement.
        sa.Column("delete_after_transcripts", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    ],
    "audio_preparation_jobs": [
        sa.Column("output_filename", sa.String(255), nullable=True),
        sa.Column("output_mime_type", sa.String(255), nullable=True),
        sa.Column("output_size_bytes", sa.Integer(), nullable=True),
        sa.Column("visual_analysis_json", sa.Text(), nullable=True),
        sa.Column("download_slot", sa.Integer(), nullable=True),
        sa.Column("download_preview", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("download_size_bytes", sa.Integer(), nullable=True),
        sa.Column("download_request_id", sa.String(36), nullable=True),
        sa.Column("download_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("download_previous_stage", sa.String(40), nullable=True),
        sa.Column("download_error_code", sa.String(80), nullable=True),
    ],
}
NEW_CHECKS = {
    "sources": {"ck_sources_audio_retention_days": "audio_retention_days IS NULL OR audio_retention_days IN (3,7,30)"},
    "audio_preparation_jobs": {"ck_audio_download_slot": "download_slot IS NULL OR download_slot = 1"},
}
NEW_INDEXES = {
    "sources": {"ix_sources_storage_identity": (["reference_class", "s3_bucket", "s3_object_key"], False)},
    "audio_preparation_jobs": {
        "uq_audio_download_slot": (["download_slot"], True),
        "ix_audio_download_expiry": (["download_expires_at"], False),
    },
}


def _check_matches(actual, expected):
    def normalized(expression):
        return re.sub(r'[\s()"]', "", expression).lower()

    # PostgreSQL reflects integer IN as = ANY (ARRAY[...]).
    return normalized(actual) in {
        normalized(expected), normalized(expected.replace("IN (3,7,30)", "= ANY (ARRAY[3,7,30])")),
    }


def _schema_boundary(bind):
    """0001 creates current metadata; only a complete bootstrap may skip DDL."""
    inspector = sa.inspect(bind)
    expected = {(table, column.name) for table, columns in NEW_COLUMNS.items() for column in columns}
    reflected = {table: {c["name"]: c for c in inspector.get_columns(table)} for table in NEW_COLUMNS}
    present = {(table, name) for table, name in expected if name in reflected[table]}
    if present and present != expected:
        raise RuntimeError("partial text lifecycle schema")
    for table, indexes in NEW_INDEXES.items():
        actual = {i["name"]: i for i in inspector.get_indexes(table)}
        for name, (columns, unique) in indexes.items():
            if (name in actual) != bool(present) or (name in actual and (
                actual[name]["column_names"] != columns or bool(actual[name]["unique"]) != unique
            )):
                raise RuntimeError("partial text lifecycle schema: index")
    for table, checks in NEW_CHECKS.items():
        actual = {c["name"]: c for c in inspector.get_check_constraints(table)}
        if any((name in actual) != bool(present) or (
            name in actual and not _check_matches(actual[name]["sqltext"], expression)
        ) for name, expression in checks.items()):
            raise RuntimeError("partial text lifecycle schema: constraint")
    if present:
        for table, columns in NEW_COLUMNS.items():
            for column in columns:
                actual = reflected[table][column.name]
                if (actual["nullable"] != column.nullable
                    or actual["type"]._type_affinity is not column.type._type_affinity
                    or getattr(actual["type"], "length", None) != getattr(column.type, "length", None)):
                    raise RuntimeError("incompatible text lifecycle column")
    return not present


def upgrade():
    bind = op.get_bind()
    if _schema_boundary(bind):
        for table, columns in NEW_COLUMNS.items():
            with op.batch_alter_table(table) as batch:
                for column in columns:
                    batch.add_column(sa.Column(
                        column.name, column.type, nullable=column.nullable,
                        server_default=column.server_default.arg if column.server_default is not None else None,
                    ))
                for name, expression in NEW_CHECKS.get(table, {}).items():
                    batch.create_check_constraint(name, expression)
        for table, indexes in NEW_INDEXES.items():
            for name, (columns, unique) in indexes.items():
                op.create_index(name, table, columns, unique=unique)
    for table in ("realtime_transcript_drafts", "transcription_provider_part_checkpoints"):
        with op.batch_alter_table(table) as batch:
            batch.alter_column("expires_at", existing_type=sa.DateTime(timezone=True), nullable=True)
            if table == "transcription_provider_part_checkpoints":
                batch.drop_constraint("ck_provider_part_checkpoint_total_parts_multiple", type_="check")
                batch.create_check_constraint("ck_provider_part_checkpoint_total_parts_multiple", "total_parts >= 1")
        # Data-preserving metadata change; payload HMAC/AAD do not use expiry.
        op.execute(sa.text(f"UPDATE {table} SET expires_at = NULL WHERE expires_at IS NOT NULL"))


def downgrade():
    # Reintroducing TTL and rejecting preserved single-part text is destructive.
    # Recovery is a compatible application rollout, never loss of retained text.
    raise RuntimeError("text lifecycle downgrade requires an explicit data-preserving recovery plan")

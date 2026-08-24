"""add owner-scoped manual speaker identities

Revision ID: 0024_speaker_identity
Revises: 0023_realtime_drafts
Create Date: 2026-08-24
"""

from alembic import op
import sqlalchemy as sa


revision = "0024_speaker_identity"
down_revision = "0023_realtime_drafts"
branch_labels = None
depends_on = None
release_safety = "additive"


def _table_names(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def upgrade():
    bind = op.get_bind()
    tables = _table_names(bind)
    if "speaker_profiles" not in tables:
        op.create_table(
            "speaker_profiles",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("owner_user_id", sa.String(length=36), nullable=False),
            sa.Column("display_name", sa.String(length=160), nullable=False),
            sa.Column("normalized_name", sa.String(length=160), nullable=False),
            sa.Column("role", sa.String(length=120), nullable=False),
            sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "owner_user_id",
                "normalized_name",
                name="uq_speaker_profiles_owner_normalized_name",
            ),
            sa.CheckConstraint(
                "length(trim(display_name)) > 0",
                name="ck_speaker_profiles_display_name_nonempty",
            ),
            sa.CheckConstraint(
                "length(trim(normalized_name)) > 0",
                name="ck_speaker_profiles_normalized_name_nonempty",
            ),
            sa.CheckConstraint(
                "length(trim(role)) > 0",
                name="ck_speaker_profiles_role_nonempty",
            ),
        )
        op.create_index(
            "ix_speaker_profiles_owner_active_updated",
            "speaker_profiles",
            ["owner_user_id", "active", "updated_at"],
            unique=False,
        )

    tables = _table_names(bind)
    if "transcription_job_speakers" not in tables:
        op.create_table(
            "transcription_job_speakers",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("owner_user_id", sa.String(length=36), nullable=False),
            sa.Column("job_id", sa.String(length=36), nullable=False),
            sa.Column("job_source_id", sa.String(length=36), nullable=False),
            sa.Column("provider_speaker_label", sa.String(length=160), nullable=False),
            sa.Column("display_ordinal", sa.Integer(), nullable=False),
            sa.Column("sample_start_ms", sa.Integer(), nullable=False),
            sa.Column("sample_end_ms", sa.Integer(), nullable=False),
            sa.Column("speaker_profile_id", sa.String(length=36), nullable=True),
            sa.Column("applied_display_name", sa.String(length=160), nullable=True),
            sa.Column("applied_role", sa.String(length=120), nullable=True),
            sa.Column("applied_document_label", sa.String(length=320), nullable=True),
            sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["job_id"], ["transcription_jobs.id"]),
            sa.ForeignKeyConstraint(["job_source_id"], ["transcription_job_sources.id"]),
            sa.ForeignKeyConstraint(["speaker_profile_id"], ["speaker_profiles.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "job_source_id",
                "provider_speaker_label",
                name="uq_transcription_job_speakers_source_provider_label",
            ),
            sa.UniqueConstraint(
                "job_source_id",
                "display_ordinal",
                name="uq_transcription_job_speakers_source_ordinal",
            ),
            sa.CheckConstraint(
                "display_ordinal >= 1",
                name="ck_transcription_job_speakers_ordinal_positive",
            ),
            sa.CheckConstraint(
                "sample_start_ms >= 0 AND sample_end_ms > sample_start_ms "
                "AND sample_end_ms - sample_start_ms <= 8000",
                name="ck_transcription_job_speakers_sample_bounded",
            ),
            sa.CheckConstraint(
                "((speaker_profile_id IS NULL AND applied_display_name IS NULL "
                "AND applied_role IS NULL AND applied_document_label IS NULL AND assigned_at IS NULL) "
                "OR (speaker_profile_id IS NOT NULL AND applied_display_name IS NOT NULL "
                "AND applied_role IS NOT NULL AND applied_document_label IS NOT NULL "
                "AND assigned_at IS NOT NULL))",
                name="ck_transcription_job_speakers_assignment_complete",
            ),
        )
        op.create_index(
            "ix_transcription_job_speakers_owner_job",
            "transcription_job_speakers",
            ["owner_user_id", "job_id", "display_ordinal"],
            unique=False,
        )
        op.create_index(
            "ix_transcription_job_speakers_profile",
            "transcription_job_speakers",
            ["speaker_profile_id"],
            unique=False,
        )


def downgrade():
    bind = op.get_bind()
    tables = _table_names(bind)
    if "transcription_job_speakers" in tables:
        op.drop_index(
            "ix_transcription_job_speakers_profile",
            table_name="transcription_job_speakers",
        )
        op.drop_index(
            "ix_transcription_job_speakers_owner_job",
            table_name="transcription_job_speakers",
        )
        op.drop_table("transcription_job_speakers")
    if "speaker_profiles" in tables:
        op.drop_index(
            "ix_speaker_profiles_owner_active_updated",
            table_name="speaker_profiles",
        )
        op.drop_table("speaker_profiles")

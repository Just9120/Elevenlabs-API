"""transcript catalog entries

Revision ID: 0016_transcript_catalog_entries
Revises: 0015_user_source_retention
Create Date: 2026-07-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0016_transcript_catalog_entries"
down_revision = "0015_user_source_retention"
branch_labels = None
depends_on = None

standard_status_enum = postgresql.ENUM(
    "current",
    "outdated",
    "unstructured",
    "unreadable",
    name="transcriptcatalogdocumentstandardstatus",
    create_type=False,
)
settings_status_enum = postgresql.ENUM(
    "exact",
    "indeterminate",
    name="transcriptcatalogsettingsstatus",
    create_type=False,
)
source_identity_kind_enum = postgresql.ENUM(
    "google_drive_file",
    "studio_source",
    name="transcriptcatalogsourceidentitykind",
    create_type=False,
)


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "transcript_catalog_entries" in inspector.get_table_names():
        return
    if bind.dialect.name == "postgresql":
        standard_status_enum.create(bind, checkfirst=True)
        settings_status_enum.create(bind, checkfirst=True)
        source_identity_kind_enum.create(bind, checkfirst=True)
        standard_type = standard_status_enum
        settings_type = settings_status_enum
        source_kind_type = source_identity_kind_enum
    else:
        standard_type = sa.String(32)
        settings_type = sa.String(32)
        source_kind_type = sa.String(32)

    op.create_table(
        "transcript_catalog_entries",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column(
            "owner_user_id",
            sa.String(36),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("document_id", sa.String(256), nullable=False),
        sa.Column("document_name", sa.String(240), nullable=False),
        sa.Column("transcript_standard", sa.String(80), nullable=False),
        sa.Column("standard_status", standard_type, nullable=False),
        sa.Column("settings_status", settings_type, nullable=False),
        sa.Column("provider", sa.String(40), nullable=True),
        sa.Column("model", sa.String(80), nullable=True),
        sa.Column("language_mode", sa.String(40), nullable=True),
        sa.Column("diarization_enabled", sa.Boolean(), nullable=True),
        sa.Column("source_identity_kind", source_kind_type, nullable=True),
        sa.Column("source_identity_value", sa.String(256), nullable=True),
        sa.Column(
            "imported_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.CheckConstraint(
            "length(trim(document_id)) > 0",
            name="ck_transcript_catalog_document_id_nonempty",
        ),
        sa.CheckConstraint(
            "length(trim(document_name)) > 0",
            name="ck_transcript_catalog_document_name_nonempty",
        ),
        sa.CheckConstraint(
            "length(trim(transcript_standard)) > 0",
            name="ck_transcript_catalog_standard_nonempty",
        ),
        sa.CheckConstraint(
            "((source_identity_kind IS NULL AND "
            "source_identity_value IS NULL) OR "
            "(source_identity_kind IS NOT NULL AND "
            "source_identity_value IS NOT NULL AND "
            "length(trim(source_identity_value)) > 0))",
            name="ck_transcript_catalog_source_authority",
        ),
        sa.CheckConstraint(
            "((settings_status = 'indeterminate' AND provider IS NULL "
            "AND model IS NULL AND language_mode IS NULL AND "
            "diarization_enabled IS NULL) OR "
            "(settings_status = 'exact' AND provider IS NOT NULL AND "
            "length(trim(provider)) > 0 AND model IS NOT NULL AND "
            "length(trim(model)) > 0 AND language_mode IS NOT NULL AND "
            "length(trim(language_mode)) > 0 AND "
            "diarization_enabled IS NOT NULL))",
            name="ck_transcript_catalog_settings_authority",
        ),
        sa.UniqueConstraint(
            "owner_user_id",
            "document_id",
            name="uq_transcript_catalog_owner_document",
        ),
    )
    op.create_index(
        "ix_transcript_catalog_owner_updated",
        "transcript_catalog_entries",
        ["owner_user_id", "updated_at"],
    )
    op.create_index(
        "ix_transcript_catalog_owner_source_settings",
        "transcript_catalog_entries",
        [
            "owner_user_id",
            "source_identity_kind",
            "source_identity_value",
            "provider",
            "model",
            "language_mode",
            "diarization_enabled",
        ],
    )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "transcript_catalog_entries" in inspector.get_table_names():
        op.drop_table("transcript_catalog_entries")
    if bind.dialect.name == "postgresql":
        source_identity_kind_enum.drop(bind, checkfirst=True)
        settings_status_enum.drop(bind, checkfirst=True)
        standard_status_enum.drop(bind, checkfirst=True)

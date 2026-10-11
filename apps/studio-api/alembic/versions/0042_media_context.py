"""Add content-free prepared media context and immutable provider part plan."""
from alembic import op
import sqlalchemy as sa

revision = "0042_media_context"
down_revision = "0041_source_retention_default"
branch_labels = None
depends_on = None
release_safety = "additive"

FIELDS = (("sources", "prepared_audio_context_json"),
          ("transcription_job_source_attempts", "provider_media_plan_json"))


def upgrade():
    inspector = sa.inspect(op.get_bind())
    for table, name in FIELDS:
        if name not in {column["name"] for column in inspector.get_columns(table)}:
            op.add_column(table, sa.Column(name, sa.Text(), nullable=True))


def downgrade():
    inspector = sa.inspect(op.get_bind())
    for table, name in reversed(FIELDS):
        if name in {column["name"] for column in inspector.get_columns(table)}:
            op.drop_column(table, name)

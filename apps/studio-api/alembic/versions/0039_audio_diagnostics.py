"""Add a separate foreign key for audio-preparation diagnostics.

Revision ID: 0039_audio_diagnostics
Revises: 0038_trusted_devices
Create Date: 2026-10-05
"""

from alembic import op
import sqlalchemy as sa

revision = "0039_audio_diagnostics"
down_revision = "0038_trusted_devices"
branch_labels = None
depends_on = None
release_safety = "additive"

TABLE = "diagnostic_events"
COLUMN = "audio_preparation_job_id"
FOREIGN_KEY = "fk_diagnostic_events_audio_job"
CHECK = "ck_diagnostic_events_one_job"
INDEX = "ix_diagnostic_events_owner_audio_job_time"


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if COLUMN in {column["name"] for column in inspector.get_columns(TABLE)}:
        if (FOREIGN_KEY not in {fk["name"] for fk in inspector.get_foreign_keys(TABLE)}
                or CHECK not in {c["name"] for c in inspector.get_check_constraints(TABLE)}
                or INDEX not in {i["name"] for i in inspector.get_indexes(TABLE)}):
            raise RuntimeError("partial audio-diagnostic schema")
        return
    with op.batch_alter_table(TABLE) as batch:
        batch.add_column(sa.Column(COLUMN, sa.String(36), nullable=True))
        batch.create_foreign_key(FOREIGN_KEY, "audio_preparation_jobs", [COLUMN], ["id"])
        batch.create_check_constraint(CHECK, "job_id IS NULL OR audio_preparation_job_id IS NULL")
    op.create_index(INDEX, TABLE, ["owner_user_id", COLUMN, "first_occurred_at"])


def downgrade():
    # Never silently discard persisted diagnostics for audio operations.
    if op.get_bind().execute(sa.text(f"SELECT 1 FROM {TABLE} WHERE {COLUMN} IS NOT NULL LIMIT 1")).first():
        raise RuntimeError("audio diagnostics must be preserved before downgrade")
    op.drop_index(INDEX, table_name=TABLE)
    with op.batch_alter_table(TABLE) as batch:
        batch.drop_constraint(FOREIGN_KEY, type_="foreignkey")
        batch.drop_constraint(CHECK, type_="check")
        batch.drop_column(COLUMN)

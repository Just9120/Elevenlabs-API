"""job output destinations

Revision ID: 0009_job_output_destinations
Revises: 0008_transcription_job_outputs
Create Date: 2026-07-13
"""
from alembic import op
import sqlalchemy as sa

revision = "0009_job_output_destinations"
down_revision = "0008_transcription_job_outputs"
branch_labels = None
depends_on = None


def _cols(inspector, table):
    return {c["name"] for c in inspector.get_columns(table)}


def upgrade():
    bind = op.get_bind(); inspector = sa.inspect(bind); cols = _cols(inspector, "transcription_jobs")
    for name, typ in (
        ("output_drive_folder_id", sa.String(length=256)),
        ("output_drive_folder_url", sa.Text()),
        ("output_drive_folder_name", sa.String(length=512)),
        ("batch_idempotency_key", sa.String(length=128)),
        ("batch_request_hash", sa.String(length=64)),
        ("batch_position", sa.Integer()),
    ):
        if name not in cols:
            op.add_column("transcription_jobs", sa.Column(name, typ, nullable=True))
    op.execute(sa.text("""
        UPDATE transcription_jobs AS j
        SET output_drive_folder_id = p.output_drive_folder_id,
            output_drive_folder_url = p.output_drive_folder_url,
            output_drive_folder_name = p.output_drive_folder_name
        FROM projects AS p
        WHERE j.project_id = p.id
          AND j.output_drive_folder_id IS NULL
          AND j.output_drive_folder_url IS NULL
          AND j.output_drive_folder_name IS NULL
    """))
    constraints = {c["name"] for c in inspector.get_check_constraints("transcription_jobs")} | {c["name"] for c in inspector.get_unique_constraints("transcription_jobs")}
    if "ck_transcription_jobs_batch_fields_all_or_none" not in constraints:
        op.create_check_constraint("ck_transcription_jobs_batch_fields_all_or_none", "transcription_jobs", "((batch_idempotency_key IS NULL AND batch_request_hash IS NULL AND batch_position IS NULL) OR (batch_idempotency_key IS NOT NULL AND batch_request_hash IS NOT NULL AND batch_position IS NOT NULL AND batch_position >= 0))")
    if "uq_transcription_jobs_batch_position" not in constraints:
        op.create_unique_constraint("uq_transcription_jobs_batch_position", "transcription_jobs", ["owner_user_id", "project_id", "batch_idempotency_key", "batch_position"])


def downgrade():
    op.drop_constraint("uq_transcription_jobs_batch_position", "transcription_jobs", type_="unique")
    op.drop_constraint("ck_transcription_jobs_batch_fields_all_or_none", "transcription_jobs", type_="check")
    for name in ["batch_position", "batch_request_hash", "batch_idempotency_key", "output_drive_folder_name", "output_drive_folder_url", "output_drive_folder_id"]:
        op.drop_column("transcription_jobs", name)

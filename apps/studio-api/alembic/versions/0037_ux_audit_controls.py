"""persist explicit resolution of uncertain transcription outcomes

Revision ID: 0037_ux_audit_controls
Revises: 0036_stt_multiprovider
Create Date: 2026-09-04
"""

from alembic import op
import sqlalchemy as sa


revision = "0037_ux_audit_controls"
down_revision = "0036_stt_multiprovider"
branch_labels = None
depends_on = None
release_safety = "additive"

TABLE = "transcription_jobs"
COLUMNS = {
    "history_attention_resolved_at",
    "history_attention_resolution",
    "history_attention_linked_job_id",
}
CONSTRAINT = "ck_transcription_jobs_history_attention_resolution"


def _columns(bind) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(TABLE)}


def _require_clean_boundary(bind) -> bool:
    present = _columns(bind) & COLUMNS
    if not present:
        return True
    if present == COLUMNS:
        return False
    raise RuntimeError("partial job attention resolution schema")


def upgrade():
    bind = op.get_bind()
    if _require_clean_boundary(bind):
        op.add_column(TABLE, sa.Column("history_attention_resolved_at", sa.DateTime(timezone=True)))
        op.add_column(TABLE, sa.Column("history_attention_resolution", sa.String(40)))
        op.add_column(TABLE, sa.Column("history_attention_linked_job_id", sa.String(36)))
    checks = {check.get("name") for check in sa.inspect(bind).get_check_constraints(TABLE)}
    if bind.dialect.name != "sqlite" and CONSTRAINT not in checks:
        op.create_check_constraint(
            CONSTRAINT,
            TABLE,
            "((history_attention_resolved_at IS NULL AND history_attention_resolution IS NULL AND history_attention_linked_job_id IS NULL) OR "
            "(history_attention_resolved_at IS NOT NULL AND history_attention_resolution = 'acknowledged_no_result' AND history_attention_linked_job_id IS NULL) OR "
            "(history_attention_resolved_at IS NOT NULL AND history_attention_resolution = 'linked_later_result' AND history_attention_linked_job_id IS NOT NULL))",
        )


def downgrade():
    bind = op.get_bind()
    if not (_columns(bind) & COLUMNS):
        return
    _require_clean_boundary(bind)
    checks = {check.get("name") for check in sa.inspect(bind).get_check_constraints(TABLE)}
    if bind.dialect.name != "sqlite" and CONSTRAINT in checks:
        op.drop_constraint(CONSTRAINT, TABLE, type_="check")
    op.drop_column(TABLE, "history_attention_linked_job_id")
    op.drop_column(TABLE, "history_attention_resolution")
    op.drop_column(TABLE, "history_attention_resolved_at")

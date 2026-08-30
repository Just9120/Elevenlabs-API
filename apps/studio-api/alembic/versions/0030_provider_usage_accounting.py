"""persist confirmed provider usage and cost accounting

Revision ID: 0030_provider_usage_accounting
Revises: 0029_source_reference_class
Create Date: 2026-08-30
"""

from alembic import op
import sqlalchemy as sa


revision = "0030_provider_usage_accounting"
down_revision = "0029_source_reference_class"
branch_labels = None
depends_on = None
release_safety = "additive"


JOB_COLUMNS = (
    "provider_billed_duration_ms",
    "provider_cost_amount",
    "provider_cost_currency",
    "provider_rate_per_hour",
    "provider_rate_effective_date",
    "provider_rate_source",
    "provider_accounting_complete",
    "provider_accounting_uncertain",
)
ATTEMPT_COLUMNS = (
    "provider_accounting_status",
    "provider_pending_part_index",
    "provider_pending_duration_ms",
    "provider_billed_duration_ms",
    "provider_cost_amount",
    "provider_cost_currency",
    "provider_rate_per_hour",
    "provider_rate_effective_date",
    "provider_rate_source",
)


def _columns(bind, table: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table)}


def _require_clean_boundary(bind) -> bool:
    job_present = set(JOB_COLUMNS) & _columns(bind, "transcription_jobs")
    attempt_present = set(ATTEMPT_COLUMNS) & _columns(
        bind, "transcription_job_source_attempts"
    )
    if job_present == set(JOB_COLUMNS) and attempt_present == set(ATTEMPT_COLUMNS):
        return False
    if job_present or attempt_present:
        raise RuntimeError("partial provider usage accounting schema")
    return True


def upgrade():
    bind = op.get_bind()
    if not _require_clean_boundary(bind):
        return

    for column in (
        sa.Column("provider_billed_duration_ms", sa.BigInteger(), nullable=True),
        sa.Column("provider_cost_amount", sa.Numeric(18, 8), nullable=True),
        sa.Column("provider_cost_currency", sa.String(3), nullable=True),
        sa.Column("provider_rate_per_hour", sa.Numeric(12, 6), nullable=True),
        sa.Column("provider_rate_effective_date", sa.Date(), nullable=True),
        sa.Column("provider_rate_source", sa.String(80), nullable=True),
        sa.Column("provider_accounting_complete", sa.Boolean(), nullable=True),
        sa.Column("provider_accounting_uncertain", sa.Boolean(), nullable=True),
    ):
        op.add_column("transcription_jobs", column)

    op.create_check_constraint(
        "ck_transcription_jobs_provider_duration_nonnegative",
        "transcription_jobs",
        "provider_billed_duration_ms IS NULL OR provider_billed_duration_ms >= 0",
    )
    op.create_check_constraint(
        "ck_transcription_jobs_provider_cost_nonnegative",
        "transcription_jobs",
        "provider_cost_amount IS NULL OR provider_cost_amount >= 0",
    )
    op.create_check_constraint(
        "ck_transcription_jobs_provider_currency",
        "transcription_jobs",
        "provider_cost_currency IS NULL OR provider_cost_currency = 'USD'",
    )
    op.create_check_constraint(
        "ck_transcription_jobs_provider_rate_positive",
        "transcription_jobs",
        "provider_rate_per_hour IS NULL OR provider_rate_per_hour > 0",
    )
    op.create_check_constraint(
        "ck_transcription_jobs_provider_accounting_consistent",
        "transcription_jobs",
        "NOT (provider_accounting_complete IS TRUE AND provider_accounting_uncertain IS TRUE)",
    )

    for column in (
        sa.Column("provider_accounting_status", sa.String(24), nullable=True),
        sa.Column("provider_pending_part_index", sa.Integer(), nullable=True),
        sa.Column("provider_pending_duration_ms", sa.BigInteger(), nullable=True),
        sa.Column("provider_billed_duration_ms", sa.BigInteger(), nullable=True),
        sa.Column("provider_cost_amount", sa.Numeric(18, 8), nullable=True),
        sa.Column("provider_cost_currency", sa.String(3), nullable=True),
        sa.Column("provider_rate_per_hour", sa.Numeric(12, 6), nullable=True),
        sa.Column("provider_rate_effective_date", sa.Date(), nullable=True),
        sa.Column("provider_rate_source", sa.String(80), nullable=True),
    ):
        op.add_column("transcription_job_source_attempts", column)

    for name, expression in (
        (
            "ck_source_attempt_provider_accounting_status",
            "provider_accounting_status IS NULL OR provider_accounting_status IN ('not_started','pending','confirmed','uncertain')",
        ),
        (
            "ck_source_attempt_provider_pending_part_nonnegative",
            "provider_pending_part_index IS NULL OR provider_pending_part_index >= 0",
        ),
        (
            "ck_source_attempt_provider_pending_duration_positive",
            "provider_pending_duration_ms IS NULL OR provider_pending_duration_ms > 0",
        ),
        (
            "ck_source_attempt_provider_pending_shape",
            "((provider_pending_part_index IS NULL AND provider_pending_duration_ms IS NULL) OR (provider_pending_part_index IS NOT NULL AND provider_pending_duration_ms IS NOT NULL))",
        ),
        (
            "ck_source_attempt_provider_duration_nonnegative",
            "provider_billed_duration_ms IS NULL OR provider_billed_duration_ms >= 0",
        ),
        (
            "ck_source_attempt_provider_cost_nonnegative",
            "provider_cost_amount IS NULL OR provider_cost_amount >= 0",
        ),
        (
            "ck_source_attempt_provider_currency",
            "provider_cost_currency IS NULL OR provider_cost_currency = 'USD'",
        ),
        (
            "ck_source_attempt_provider_rate_positive",
            "provider_rate_per_hour IS NULL OR provider_rate_per_hour > 0",
        ),
    ):
        op.create_check_constraint(
            name, "transcription_job_source_attempts", expression
        )


def downgrade():
    bind = op.get_bind()
    job_columns = _columns(bind, "transcription_jobs")
    attempt_columns = _columns(bind, "transcription_job_source_attempts")
    if not (set(JOB_COLUMNS) & job_columns or set(ATTEMPT_COLUMNS) & attempt_columns):
        return
    if not (
        set(JOB_COLUMNS) <= job_columns and set(ATTEMPT_COLUMNS) <= attempt_columns
    ):
        raise RuntimeError("partial provider usage accounting schema")

    for name in (
        "ck_source_attempt_provider_rate_positive",
        "ck_source_attempt_provider_currency",
        "ck_source_attempt_provider_cost_nonnegative",
        "ck_source_attempt_provider_duration_nonnegative",
        "ck_source_attempt_provider_pending_shape",
        "ck_source_attempt_provider_pending_duration_positive",
        "ck_source_attempt_provider_pending_part_nonnegative",
        "ck_source_attempt_provider_accounting_status",
    ):
        op.drop_constraint(
            name, "transcription_job_source_attempts", type_="check"
        )
    for name in reversed(ATTEMPT_COLUMNS):
        op.drop_column("transcription_job_source_attempts", name)

    for name in (
        "ck_transcription_jobs_provider_accounting_consistent",
        "ck_transcription_jobs_provider_rate_positive",
        "ck_transcription_jobs_provider_currency",
        "ck_transcription_jobs_provider_cost_nonnegative",
        "ck_transcription_jobs_provider_duration_nonnegative",
    ):
        op.drop_constraint(name, "transcription_jobs", type_="check")
    for name in reversed(JOB_COLUMNS):
        op.drop_column("transcription_jobs", name)

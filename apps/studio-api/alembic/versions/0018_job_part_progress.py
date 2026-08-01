"""add durable provider part progress counters

Revision ID: 0018_job_part_progress
Revises: 0017_google_maintenance_oauth
Create Date: 2026-08-02
"""

from alembic import op
import sqlalchemy as sa


revision = "0018_job_part_progress"
down_revision = "0017_google_maintenance_oauth"
branch_labels = None
depends_on = None
release_safety = "additive"


def _column_names(bind) -> set[str]:
    inspector = sa.inspect(bind)
    if "transcription_job_source_attempts" not in inspector.get_table_names():
        return set()
    return {
        column["name"]
        for column in inspector.get_columns("transcription_job_source_attempts")
    }


def _check_names(bind) -> set[str]:
    inspector = sa.inspect(bind)
    if "transcription_job_source_attempts" not in inspector.get_table_names():
        return set()
    return {
        check["name"]
        for check in inspector.get_check_constraints(
            "transcription_job_source_attempts"
        )
        if check.get("name")
    }


def upgrade():
    bind = op.get_bind()
    columns = _column_names(bind)
    if "provider_total_parts" not in columns:
        op.add_column(
            "transcription_job_source_attempts",
            sa.Column("provider_total_parts", sa.Integer(), nullable=True),
        )
    if "provider_completed_parts" not in columns:
        op.add_column(
            "transcription_job_source_attempts",
            sa.Column(
                "provider_completed_parts",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("0"),
            ),
        )

    checks = _check_names(bind)
    if "ck_source_attempt_provider_total_parts_positive" not in checks:
        op.create_check_constraint(
            "ck_source_attempt_provider_total_parts_positive",
            "transcription_job_source_attempts",
            "provider_total_parts IS NULL OR provider_total_parts > 0",
        )
    if "ck_source_attempt_provider_completed_parts_nonnegative" not in checks:
        op.create_check_constraint(
            "ck_source_attempt_provider_completed_parts_nonnegative",
            "transcription_job_source_attempts",
            "provider_completed_parts >= 0",
        )
    if "ck_source_attempt_provider_parts_bounded" not in checks:
        op.create_check_constraint(
            "ck_source_attempt_provider_parts_bounded",
            "transcription_job_source_attempts",
            "provider_total_parts IS NULL OR provider_completed_parts <= provider_total_parts",
        )


def downgrade():
    bind = op.get_bind()
    checks = _check_names(bind)
    for name in (
        "ck_source_attempt_provider_parts_bounded",
        "ck_source_attempt_provider_completed_parts_nonnegative",
        "ck_source_attempt_provider_total_parts_positive",
    ):
        if name in checks:
            op.drop_constraint(
                name,
                "transcription_job_source_attempts",
                type_="check",
            )

    columns = _column_names(bind)
    if "provider_completed_parts" in columns:
        op.drop_column(
            "transcription_job_source_attempts",
            "provider_completed_parts",
        )
    if "provider_total_parts" in columns:
        op.drop_column(
            "transcription_job_source_attempts",
            "provider_total_parts",
        )

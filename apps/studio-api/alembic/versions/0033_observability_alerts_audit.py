"""persist trace, protected audit outcomes, and operational alerts

Revision ID: 0033_observability_alerts_audit
Revises: 0032_source_multipart_authority
Create Date: 2026-09-01
"""

from alembic import op
import sqlalchemy as sa


revision = "0033_observability_alerts_audit"
down_revision = "0032_source_multipart_authority"
branch_labels = None
depends_on = None
release_safety = "additive"


TRACE_COLUMNS = {
    "transcription_jobs": "trace_id",
    "audio_preparation_jobs": "trace_id",
    "diagnostic_events": "trace_id",
}
AUDIT_COLUMNS = {"outcome", "trace_id"}
INCIDENT_TABLE = "operational_incidents"
DELIVERY_TABLE = "operational_alert_deliveries"
AUDIT_TRIGGER = "trg_audit_events_append_only"
AUDIT_FUNCTION = "studio_reject_audit_event_mutation"


def _columns(bind, table: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table)}


def _tables(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def _add_trace_column(bind, table: str) -> None:
    if TRACE_COLUMNS[table] in _columns(bind, table):
        return
    op.add_column(table, sa.Column("trace_id", sa.String(128)))
    op.create_index(f"ix_{table}_trace_id", table, ["trace_id"])


def _protect_audit_events(bind) -> None:
    if bind.dialect.name != "postgresql":
        return
    op.execute(
        f"""
        CREATE OR REPLACE FUNCTION {AUDIT_FUNCTION}()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $audit_append_only$
        BEGIN
            RAISE EXCEPTION 'audit_events is append-only'
                USING ERRCODE = '55000';
        END
        $audit_append_only$
        """
    )
    op.execute(f"DROP TRIGGER IF EXISTS {AUDIT_TRIGGER} ON audit_events")
    op.execute(
        f"""
        CREATE TRIGGER {AUDIT_TRIGGER}
        BEFORE UPDATE OR DELETE ON audit_events
        FOR EACH ROW EXECUTE FUNCTION {AUDIT_FUNCTION}()
        """
    )


def upgrade():
    bind = op.get_bind()
    tables = _tables(bind)
    for table in TRACE_COLUMNS:
        _add_trace_column(bind, table)

    audit_columns = _columns(bind, "audit_events")
    if "outcome" not in audit_columns:
        op.add_column("audit_events", sa.Column("outcome", sa.String(16)))
        op.create_check_constraint(
            "ck_audit_events_outcome",
            "audit_events",
            "outcome IS NULL OR outcome IN ('success','rejected','failed','partial')",
        )
        op.create_index("ix_audit_events_outcome", "audit_events", ["outcome"])
    if "trace_id" not in audit_columns:
        op.add_column("audit_events", sa.Column("trace_id", sa.String(128)))
        op.create_index("ix_audit_events_trace_id", "audit_events", ["trace_id"])

    if INCIDENT_TABLE not in tables:
        op.create_table(
            INCIDENT_TABLE,
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("owner_user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("incident_kind", sa.String(48), nullable=False),
            sa.Column("severity", sa.String(16), nullable=False),
            sa.Column("status", sa.String(16), nullable=False, server_default=sa.text("'pending'")),
            sa.Column("summary_code", sa.String(80), nullable=False),
            sa.Column("trace_id", sa.String(128)),
            sa.Column("lifecycle_generation", sa.Integer(), nullable=False, server_default=sa.text("1")),
            sa.Column("occurrence_count", sa.Integer(), nullable=False, server_default=sa.text("1")),
            sa.Column("evidence_count", sa.Integer(), nullable=False, server_default=sa.text("1")),
            sa.Column("first_detected_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("last_detected_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("last_transition_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("acknowledged_at", sa.DateTime(timezone=True)),
            sa.Column("resolved_at", sa.DateTime(timezone=True)),
            sa.Column("cooldown_until", sa.DateTime(timezone=True)),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.CheckConstraint("severity IN ('warning','critical')", name="ck_operational_incidents_severity"),
            sa.CheckConstraint("status IN ('pending','firing','acknowledged','resolved')", name="ck_operational_incidents_status"),
            sa.CheckConstraint("lifecycle_generation >= 1", name="ck_operational_incidents_generation"),
            sa.CheckConstraint("occurrence_count >= 1", name="ck_operational_incidents_occurrence_count"),
            sa.CheckConstraint("evidence_count >= 0", name="ck_operational_incidents_evidence_count"),
            sa.UniqueConstraint("owner_user_id", "incident_kind", name="uq_operational_incidents_owner_kind"),
        )
        op.create_index("ix_operational_incidents_owner_user_id", INCIDENT_TABLE, ["owner_user_id"])
        op.create_index("ix_operational_incidents_owner_status_updated", INCIDENT_TABLE, ["owner_user_id", "status", "updated_at"])

    tables = _tables(bind)
    if DELIVERY_TABLE not in tables:
        op.create_table(
            DELIVERY_TABLE,
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("owner_user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("incident_id", sa.String(36), sa.ForeignKey(f"{INCIDENT_TABLE}.id"), nullable=False),
            sa.Column("lifecycle_generation", sa.Integer(), nullable=False),
            sa.Column("notification_kind", sa.String(16), nullable=False),
            sa.Column("channel", sa.String(24), nullable=False),
            sa.Column("state", sa.String(16), nullable=False, server_default=sa.text("'pending'")),
            sa.Column("attempt_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("claim_token", sa.String(64)),
            sa.Column("claim_expires_at", sa.DateTime(timezone=True)),
            sa.Column("next_attempt_at", sa.DateTime(timezone=True)),
            sa.Column("last_attempt_at", sa.DateTime(timezone=True)),
            sa.Column("delivered_at", sa.DateTime(timezone=True)),
            sa.Column("error_code", sa.String(80)),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.CheckConstraint("channel IN ('telegram')", name="ck_operational_alert_deliveries_channel"),
            sa.CheckConstraint("notification_kind IN ('firing','recovery')", name="ck_operational_alert_deliveries_notification_kind"),
            sa.CheckConstraint("state IN ('pending','claimed','delivered','failed','suppressed')", name="ck_operational_alert_deliveries_state"),
            sa.CheckConstraint("lifecycle_generation >= 1", name="ck_operational_alert_deliveries_generation"),
            sa.CheckConstraint("attempt_count >= 0 AND attempt_count <= 5", name="ck_operational_alert_deliveries_attempt_count"),
            sa.UniqueConstraint("incident_id", "lifecycle_generation", "notification_kind", "channel", name="uq_operational_alert_delivery_generation"),
        )
        op.create_index("ix_operational_alert_deliveries_owner_user_id", DELIVERY_TABLE, ["owner_user_id"])
        op.create_index("ix_operational_alert_deliveries_incident_id", DELIVERY_TABLE, ["incident_id"])
        op.create_index("ix_operational_alert_deliveries_claim", DELIVERY_TABLE, ["state", "next_attempt_at", "claim_expires_at", "created_at"])

    _protect_audit_events(bind)


def downgrade():
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(f"DROP TRIGGER IF EXISTS {AUDIT_TRIGGER} ON audit_events")
        op.execute(f"DROP FUNCTION IF EXISTS {AUDIT_FUNCTION}()")
    tables = _tables(bind)
    if DELIVERY_TABLE in tables:
        op.drop_table(DELIVERY_TABLE)
    if INCIDENT_TABLE in tables:
        op.drop_table(INCIDENT_TABLE)
    audit_columns = _columns(bind, "audit_events")
    if "trace_id" in audit_columns:
        op.drop_index("ix_audit_events_trace_id", table_name="audit_events")
        op.drop_column("audit_events", "trace_id")
    if "outcome" in audit_columns:
        op.drop_index("ix_audit_events_outcome", table_name="audit_events")
        op.drop_constraint("ck_audit_events_outcome", "audit_events", type_="check")
        op.drop_column("audit_events", "outcome")
    for table in reversed(tuple(TRACE_COLUMNS)):
        if TRACE_COLUMNS[table] in _columns(bind, table):
            op.drop_index(f"ix_{table}_trace_id", table_name=table)
            op.drop_column(table, "trace_id")

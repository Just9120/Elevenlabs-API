"""persist bounded ElevenLabs account snapshots

Revision ID: 0031_provider_account_snapshots
Revises: 0030_provider_usage_accounting
Create Date: 2026-08-30
"""

from alembic import op
import sqlalchemy as sa


revision = "0031_provider_account_snapshots"
down_revision = "0030_provider_usage_accounting"
branch_labels = None
depends_on = None
release_safety = "additive"


TABLE = "provider_account_snapshots"
COLUMNS = (
    "id",
    "owner_user_id",
    "credential_id",
    "credential_version_id",
    "provider",
    "subscription_tier",
    "subscription_status",
    "period_usage",
    "period_limit",
    "period_remaining",
    "period_unit",
    "max_credit_limit_extension",
    "usage_based_billing_enabled",
    "current_overage_amount",
    "current_overage_currency",
    "open_invoice_count",
    "open_invoice_total_due_cents",
    "has_open_invoices",
    "next_invoice_amount_due_cents",
    "next_invoice_subtotal_cents",
    "next_invoice_tax_cents",
    "next_payment_attempt_at",
    "subscription_currency",
    "billing_period",
    "refresh_period",
    "reset_at",
    "pending_change_present",
    "subscription_fetched_at",
    "last_attempt_at",
    "last_error_code",
    "workspace_usage_total_credits",
    "workspace_usage_unit",
    "workspace_usage_products_json",
    "workspace_usage_window_start",
    "workspace_usage_window_end",
    "workspace_usage_window_basis",
    "workspace_usage_fetched_at",
    "workspace_usage_error_code",
    "created_at",
    "updated_at",
)


def _require_clean_boundary(bind) -> bool:
    inspector = sa.inspect(bind)
    if not inspector.has_table(TABLE):
        return True
    present = {column["name"] for column in inspector.get_columns(TABLE)}
    if set(COLUMNS) <= present:
        return False
    raise RuntimeError("partial provider account snapshot schema")


def upgrade():
    bind = op.get_bind()
    if not _require_clean_boundary(bind):
        return
    op.create_table(
        TABLE,
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner_user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("credential_id", sa.String(36), sa.ForeignKey("provider_credentials.id"), nullable=False),
        sa.Column("credential_version_id", sa.String(36), sa.ForeignKey("provider_credential_versions.id"), nullable=False),
        sa.Column("provider", sa.String(40), nullable=False),
        sa.Column("subscription_tier", sa.String(80)),
        sa.Column("subscription_status", sa.String(80)),
        sa.Column("period_usage", sa.BigInteger()),
        sa.Column("period_limit", sa.BigInteger()),
        sa.Column("period_remaining", sa.BigInteger()),
        sa.Column("period_unit", sa.String(24)),
        sa.Column("max_credit_limit_extension", sa.String(32)),
        sa.Column("usage_based_billing_enabled", sa.Boolean()),
        sa.Column("current_overage_amount", sa.Numeric(18, 8)),
        sa.Column("current_overage_currency", sa.String(3)),
        sa.Column("open_invoice_count", sa.Integer()),
        sa.Column("open_invoice_total_due_cents", sa.BigInteger()),
        sa.Column("has_open_invoices", sa.Boolean()),
        sa.Column("next_invoice_amount_due_cents", sa.BigInteger()),
        sa.Column("next_invoice_subtotal_cents", sa.BigInteger()),
        sa.Column("next_invoice_tax_cents", sa.BigInteger()),
        sa.Column("next_payment_attempt_at", sa.DateTime(timezone=True)),
        sa.Column("subscription_currency", sa.String(3)),
        sa.Column("billing_period", sa.String(80)),
        sa.Column("refresh_period", sa.String(80)),
        sa.Column("reset_at", sa.DateTime(timezone=True)),
        sa.Column("pending_change_present", sa.Boolean()),
        sa.Column("subscription_fetched_at", sa.DateTime(timezone=True)),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True)),
        sa.Column("last_error_code", sa.String(80)),
        sa.Column("workspace_usage_total_credits", sa.Numeric(24, 8)),
        sa.Column("workspace_usage_unit", sa.String(24)),
        sa.Column("workspace_usage_products_json", sa.Text()),
        sa.Column("workspace_usage_window_start", sa.DateTime(timezone=True)),
        sa.Column("workspace_usage_window_end", sa.DateTime(timezone=True)),
        sa.Column("workspace_usage_window_basis", sa.String(40)),
        sa.Column("workspace_usage_fetched_at", sa.DateTime(timezone=True)),
        sa.Column("workspace_usage_error_code", sa.String(80)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("owner_user_id", "credential_id", name="uq_provider_account_snapshot_owner_credential"),
        sa.CheckConstraint("provider = 'elevenlabs'", name="ck_provider_account_snapshot_provider"),
        sa.CheckConstraint("period_usage IS NULL OR period_usage >= 0", name="ck_provider_account_snapshot_period_usage"),
        sa.CheckConstraint("period_limit IS NULL OR period_limit >= 0", name="ck_provider_account_snapshot_period_limit"),
        sa.CheckConstraint("period_remaining IS NULL OR period_remaining >= 0", name="ck_provider_account_snapshot_period_remaining"),
        sa.CheckConstraint("period_unit IS NULL OR period_unit = 'characters'", name="ck_provider_account_snapshot_period_unit"),
        sa.CheckConstraint("current_overage_amount IS NULL OR current_overage_amount >= 0", name="ck_provider_account_snapshot_overage"),
        sa.CheckConstraint("open_invoice_count IS NULL OR open_invoice_count >= 0", name="ck_provider_account_snapshot_invoice_count"),
        sa.CheckConstraint("open_invoice_total_due_cents IS NULL OR open_invoice_total_due_cents >= 0", name="ck_provider_account_snapshot_invoice_total"),
        sa.CheckConstraint("next_invoice_amount_due_cents IS NULL OR next_invoice_amount_due_cents >= 0", name="ck_provider_account_snapshot_next_invoice"),
        sa.CheckConstraint("next_invoice_subtotal_cents IS NULL OR next_invoice_subtotal_cents >= 0", name="ck_provider_account_snapshot_next_invoice_subtotal"),
        sa.CheckConstraint("next_invoice_tax_cents IS NULL OR next_invoice_tax_cents >= 0", name="ck_provider_account_snapshot_next_invoice_tax"),
        sa.CheckConstraint("workspace_usage_total_credits IS NULL OR workspace_usage_total_credits >= 0", name="ck_provider_account_snapshot_workspace_usage"),
        sa.CheckConstraint("workspace_usage_unit IS NULL OR workspace_usage_unit = 'credits'", name="ck_provider_account_snapshot_workspace_usage_unit"),
    )
    op.create_index("ix_provider_account_snapshots_owner_user_id", TABLE, ["owner_user_id"])
    op.create_index("ix_provider_account_snapshots_credential_id", TABLE, ["credential_id"])
    op.create_index("ix_provider_account_snapshots_subscription_fetched_at", TABLE, ["subscription_fetched_at"])


def downgrade():
    bind = op.get_bind()
    if not sa.inspect(bind).has_table(TABLE):
        return
    _require_clean_boundary(bind)
    op.drop_index("ix_provider_account_snapshots_subscription_fetched_at", table_name=TABLE)
    op.drop_index("ix_provider_account_snapshots_credential_id", table_name=TABLE)
    op.drop_index("ix_provider_account_snapshots_owner_user_id", table_name=TABLE)
    op.drop_table(TABLE)

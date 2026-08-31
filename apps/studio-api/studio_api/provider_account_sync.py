from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session

from .elevenlabs_account import (
    ElevenLabsAccountError,
    ElevenLabsAccountTransport,
    SubscriptionSnapshot,
    WorkspaceUsageSnapshot,
)
from .models import ProviderAccountSnapshot, ProviderCredential


PROVIDER = "elevenlabs"
DEFAULT_FRESH_SECONDS = 300
MAX_STORED_PRODUCTS_JSON_BYTES = 16_384


def sync_elevenlabs_account(
    db: Session,
    *,
    owner_user_id: str,
    credential: ProviderCredential,
    credential_version_id: str,
    api_key: str,
    now: datetime,
    fresh_seconds: int = DEFAULT_FRESH_SECONDS,
    force: bool = False,
    transport: ElevenLabsAccountTransport | None = None,
) -> ProviderAccountSnapshot:
    current = _aware_utc(now)
    _lock_snapshot_key(db, owner_user_id=owner_user_id, credential_id=credential.id)
    row = (
        db.query(ProviderAccountSnapshot)
        .filter(
            ProviderAccountSnapshot.owner_user_id == owner_user_id,
            ProviderAccountSnapshot.credential_id == credential.id,
        )
        .one_or_none()
    )
    if row is None:
        row = ProviderAccountSnapshot(
            owner_user_id=owner_user_id,
            credential_id=credential.id,
            credential_version_id=credential_version_id,
            provider=PROVIDER,
            created_at=current,
            updated_at=current,
        )
        db.add(row)
    elif row.credential_version_id != credential_version_id:
        _clear_success(row)
        row.credential_version_id = credential_version_id
        row.updated_at = current

    if not force and _has_recent_attempt(row, current, fresh_seconds):
        return row

    row.last_attempt_at = current
    account_transport = transport or ElevenLabsAccountTransport()
    try:
        subscription = account_transport.fetch_subscription(api_key)
    except ElevenLabsAccountError as exc:
        row.last_error_code = exc.reason.value
        row.updated_at = current
        db.flush()
        return row

    _apply_subscription(row, subscription, current)
    try:
        usage = account_transport.fetch_workspace_usage(
            api_key, subscription=subscription, now=current
        )
    except ElevenLabsAccountError as exc:
        row.workspace_usage_error_code = exc.reason.value
    else:
        _apply_workspace_usage(row, usage, current)
    row.updated_at = current
    db.flush()
    return row


def provider_account_payload(
    row: ProviderAccountSnapshot,
    *,
    credential: ProviderCredential,
    active_version: int,
    now: datetime,
    fresh_seconds: int = DEFAULT_FRESH_SECONDS,
) -> dict:
    current = _aware_utc(now)
    state = _snapshot_state(
        row.subscription_fetched_at,
        row.last_error_code,
        now=current,
        fresh_seconds=fresh_seconds,
    )
    subscription = None
    if row.subscription_fetched_at is not None:
        subscription = {
            "tier": row.subscription_tier,
            "status": row.subscription_status,
            "period_usage": int(row.period_usage or 0),
            "period_limit": int(row.period_limit or 0),
            "period_remaining": int(row.period_remaining or 0),
            "period_unit": row.period_unit,
            "reset_at": _iso(row.reset_at),
            "billing_period": row.billing_period,
            "refresh_period": row.refresh_period,
            "usage_based_billing": {
                "enabled": bool(row.usage_based_billing_enabled),
                "max_extra_credits": row.max_credit_limit_extension,
            },
            "current_overage": {
                "amount": _decimal_string(row.current_overage_amount),
                "currency": row.current_overage_currency,
            },
            "open_invoices": {
                "present": bool(row.has_open_invoices),
                "count": int(row.open_invoice_count or 0),
                "total_due_cents": int(row.open_invoice_total_due_cents or 0),
                "currency": row.subscription_currency
                or row.current_overage_currency,
            },
            "next_invoice": (
                {
                    "amount_due_cents": int(row.next_invoice_amount_due_cents),
                    "subtotal_cents": (
                        int(row.next_invoice_subtotal_cents)
                        if row.next_invoice_subtotal_cents is not None
                        else None
                    ),
                    "tax_cents": (
                        int(row.next_invoice_tax_cents)
                        if row.next_invoice_tax_cents is not None
                        else None
                    ),
                    "currency": row.subscription_currency
                    or row.current_overage_currency,
                    "payment_attempt_at": _iso(row.next_payment_attempt_at),
                }
                if row.next_invoice_amount_due_cents is not None
                else None
            ),
            "pending_change_present": bool(row.pending_change_present),
        }

    usage_state = _snapshot_state(
        row.workspace_usage_fetched_at,
        row.workspace_usage_error_code,
        now=current,
        fresh_seconds=fresh_seconds,
    )
    products = _stored_products(row.workspace_usage_products_json)
    workspace_usage = {
        "state": usage_state,
        "fetched_at": _iso(row.workspace_usage_fetched_at),
        "error_code": row.workspace_usage_error_code,
        "window": (
            {
                "start": _iso(row.workspace_usage_window_start),
                "end": _iso(row.workspace_usage_window_end),
                "basis": row.workspace_usage_window_basis,
            }
            if row.workspace_usage_fetched_at is not None
            else None
        ),
        "unit": row.workspace_usage_unit,
        "total": (
            _decimal_string(row.workspace_usage_total_credits)
            if row.workspace_usage_fetched_at is not None
            else None
        ),
        "products": products,
    }
    return {
        "credential": {
            "id": credential.id,
            "label": credential.label,
            "active_version": active_version,
        },
        "state": state,
        "fetched_at": _iso(row.subscription_fetched_at),
        "last_attempt_at": _iso(row.last_attempt_at),
        "error_code": row.last_error_code,
        "subscription": subscription,
        "workspace_usage": workspace_usage,
    }


def unavailable_provider_account_payload(
    *,
    credential: ProviderCredential,
    active_version: int | None,
    now: datetime,
    error_code: str,
) -> dict:
    return {
        "credential": {
            "id": credential.id,
            "label": credential.label,
            "active_version": active_version,
        },
        "state": "unavailable",
        "fetched_at": None,
        "last_attempt_at": _iso(now),
        "error_code": error_code,
        "subscription": None,
        "workspace_usage": {
            "state": "unavailable",
            "fetched_at": None,
            "error_code": error_code,
            "window": None,
            "unit": None,
            "total": None,
            "products": [],
        },
    }


def _apply_subscription(
    row: ProviderAccountSnapshot,
    snapshot: SubscriptionSnapshot,
    now: datetime,
) -> None:
    row.subscription_tier = snapshot.tier
    row.subscription_status = snapshot.status
    row.period_usage = snapshot.period_usage
    row.period_limit = snapshot.period_limit
    row.period_remaining = snapshot.period_remaining
    row.period_unit = snapshot.period_unit
    row.max_credit_limit_extension = snapshot.max_credit_limit_extension
    row.usage_based_billing_enabled = snapshot.usage_based_billing_enabled
    row.current_overage_amount = snapshot.current_overage_amount
    row.current_overage_currency = snapshot.current_overage_currency
    row.open_invoice_count = snapshot.open_invoice_count
    row.open_invoice_total_due_cents = snapshot.open_invoice_total_due_cents
    row.has_open_invoices = snapshot.has_open_invoices
    row.next_invoice_amount_due_cents = snapshot.next_invoice_amount_due_cents
    row.next_invoice_subtotal_cents = snapshot.next_invoice_subtotal_cents
    row.next_invoice_tax_cents = snapshot.next_invoice_tax_cents
    row.next_payment_attempt_at = snapshot.next_payment_attempt_at
    row.subscription_currency = snapshot.subscription_currency
    row.billing_period = snapshot.billing_period
    row.refresh_period = snapshot.refresh_period
    row.reset_at = snapshot.reset_at
    row.pending_change_present = snapshot.pending_change_present
    row.subscription_fetched_at = now
    row.last_error_code = None


def _apply_workspace_usage(
    row: ProviderAccountSnapshot,
    snapshot: WorkspaceUsageSnapshot,
    now: datetime,
) -> None:
    products = [
        {"product_type": product.product_type, "credits": str(product.credits)}
        for product in snapshot.products
    ]
    encoded = json.dumps(products, ensure_ascii=True, separators=(",", ":"))
    if len(encoded.encode("utf-8")) > MAX_STORED_PRODUCTS_JSON_BYTES:
        raise ValueError("provider usage product snapshot exceeds storage boundary")
    row.workspace_usage_total_credits = snapshot.total_credits
    row.workspace_usage_unit = snapshot.unit
    row.workspace_usage_products_json = encoded
    row.workspace_usage_window_start = snapshot.window_start
    row.workspace_usage_window_end = snapshot.window_end
    row.workspace_usage_window_basis = snapshot.window_basis
    row.workspace_usage_fetched_at = now
    row.workspace_usage_error_code = None


def _clear_success(row: ProviderAccountSnapshot) -> None:
    for name in (
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
        "last_error_code",
        "workspace_usage_total_credits",
        "workspace_usage_unit",
        "workspace_usage_products_json",
        "workspace_usage_window_start",
        "workspace_usage_window_end",
        "workspace_usage_window_basis",
        "workspace_usage_fetched_at",
        "workspace_usage_error_code",
    ):
        setattr(row, name, None)


def _has_recent_attempt(
    row: ProviderAccountSnapshot, now: datetime, fresh_seconds: int
) -> bool:
    if row.last_attempt_at is None:
        return False
    attempted = _aware_utc(row.last_attempt_at)
    return attempted >= now - timedelta(seconds=fresh_seconds)


def _lock_snapshot_key(
    db: Session, *, owner_user_id: str, credential_id: str
) -> None:
    """Serialize first-refresh/upsert work for one account snapshot on PostgreSQL."""
    if db.get_bind().dialect.name != "postgresql":
        return
    db.execute(
        text("SELECT pg_advisory_xact_lock(hashtextextended(:snapshot_key, 0))"),
        {"snapshot_key": f"{owner_user_id}:{credential_id}"},
    )


def _snapshot_state(
    fetched_at: datetime | None,
    error_code: str | None,
    *,
    now: datetime,
    fresh_seconds: int,
) -> str:
    if fetched_at is None:
        return "unavailable"
    if error_code is not None:
        return "stale"
    fetched = _aware_utc(fetched_at)
    return "current" if fetched >= now - timedelta(seconds=fresh_seconds) else "stale"


def _stored_products(value: str | None) -> list[dict[str, str]]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    output: list[dict[str, str]] = []
    for item in parsed[:64]:
        if (
            isinstance(item, dict)
            and isinstance(item.get("product_type"), str)
            and isinstance(item.get("credits"), str)
        ):
            output.append(
                {
                    "product_type": item["product_type"],
                    "credits": item["credits"],
                }
            )
    return output


def _decimal_string(value: Decimal | None) -> str:
    return format(Decimal(str(value or 0)).quantize(Decimal("0.00000001")), "f")


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return _aware_utc(value).isoformat().replace("+00:00", "Z")


def _aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)

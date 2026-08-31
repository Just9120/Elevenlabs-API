from __future__ import annotations

import calendar
import json
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from enum import Enum
from typing import Any

import httpx


SUBSCRIPTION_ENDPOINT = "https://api.elevenlabs.io/v1/user/subscription"
WORKSPACE_USAGE_ENDPOINT = (
    "https://api.elevenlabs.io/v1/workspace/analytics/query/usage-by-product-over-time"
)
MAX_RESPONSE_BYTES = 1_048_576
MAX_USAGE_ROWS = 5_000
MAX_USAGE_PRODUCTS = 64
MAX_SAFE_INTEGER = 9_007_199_254_740_991
DECIMAL_QUANTUM = Decimal("0.00000001")
SAFE_PROVIDER_VALUE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_. -]{0,79}$")


class ElevenLabsAccountReason(str, Enum):
    provider_authentication_rejected = "provider_authentication_rejected"
    provider_scope_rejected = "provider_scope_rejected"
    provider_request_rejected = "provider_request_rejected"
    provider_rate_limited = "provider_rate_limited"
    provider_timeout = "provider_timeout"
    provider_unavailable = "provider_unavailable"
    malformed_provider_response = "malformed_provider_response"


class ElevenLabsAccountError(RuntimeError):
    def __init__(self, reason: ElevenLabsAccountReason):
        self.reason = reason
        super().__init__(reason.value)


@dataclass(frozen=True)
class SubscriptionSnapshot:
    tier: str
    status: str
    period_usage: int
    period_limit: int
    period_remaining: int
    period_unit: str
    max_credit_limit_extension: str
    usage_based_billing_enabled: bool
    current_overage_amount: Decimal
    current_overage_currency: str
    open_invoice_count: int
    open_invoice_total_due_cents: int
    has_open_invoices: bool
    next_invoice_amount_due_cents: int | None
    next_invoice_subtotal_cents: int | None
    next_invoice_tax_cents: int | None
    next_payment_attempt_at: datetime | None
    subscription_currency: str | None
    billing_period: str | None
    refresh_period: str | None
    reset_at: datetime | None
    pending_change_present: bool


@dataclass(frozen=True)
class ProductCreditUsage:
    product_type: str
    credits: Decimal


@dataclass(frozen=True)
class WorkspaceUsageSnapshot:
    window_start: datetime
    window_end: datetime
    window_basis: str
    unit: str
    total_credits: Decimal
    products: tuple[ProductCreditUsage, ...]


class ElevenLabsAccountTransport:
    def __init__(
        self,
        *,
        client: httpx.Client | None = None,
        timeout_seconds: float = 10.0,
    ) -> None:
        self._client = client
        self._timeout_seconds = timeout_seconds

    def fetch_subscription(self, api_key: str) -> SubscriptionSnapshot:
        payload = self._request_json("GET", SUBSCRIPTION_ENDPOINT, api_key=api_key)
        return normalize_subscription(payload)

    def fetch_workspace_usage(
        self,
        api_key: str,
        *,
        subscription: SubscriptionSnapshot,
        now: datetime,
    ) -> WorkspaceUsageSnapshot:
        window_start, window_end, window_basis = workspace_usage_window(
            subscription, now
        )
        payload = self._request_json(
            "POST",
            WORKSPACE_USAGE_ENDPOINT,
            api_key=api_key,
            body={
                "start_time": round(window_start.timestamp() * 1000),
                "end_time": round(window_end.timestamp() * 1000),
                "interval_seconds": 86_400,
                "group_by": ["product_type"],
                "time_zone": "UTC",
            },
        )
        return normalize_workspace_usage(
            payload,
            window_start=window_start,
            window_end=window_end,
            window_basis=window_basis,
        )

    def _request_json(
        self,
        method: str,
        url: str,
        *,
        api_key: str,
        body: dict[str, Any] | None = None,
    ) -> Any:
        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "xi-api-key": api_key,
        }
        try:
            if self._client is None:
                response = httpx.request(
                    method,
                    url,
                    headers=headers,
                    json=body,
                    timeout=self._timeout_seconds,
                    follow_redirects=False,
                )
            else:
                response = self._client.request(
                    method,
                    url,
                    headers=headers,
                    json=body,
                    timeout=self._timeout_seconds,
                    follow_redirects=False,
                )
        except httpx.TimeoutException as exc:
            raise ElevenLabsAccountError(
                ElevenLabsAccountReason.provider_timeout
            ) from exc
        except httpx.HTTPError as exc:
            raise ElevenLabsAccountError(
                ElevenLabsAccountReason.provider_unavailable
            ) from exc

        reason = {
            401: ElevenLabsAccountReason.provider_authentication_rejected,
            403: ElevenLabsAccountReason.provider_scope_rejected,
            429: ElevenLabsAccountReason.provider_rate_limited,
        }.get(response.status_code)
        if reason is not None:
            raise ElevenLabsAccountError(reason)
        if response.status_code in {400, 404, 405, 409, 422}:
            raise ElevenLabsAccountError(
                ElevenLabsAccountReason.provider_request_rejected
            )
        if response.status_code >= 500:
            raise ElevenLabsAccountError(
                ElevenLabsAccountReason.provider_unavailable
            )
        if response.status_code < 200 or response.status_code >= 300:
            raise ElevenLabsAccountError(
                ElevenLabsAccountReason.malformed_provider_response
            )
        content = response.content
        if not content or len(content) > MAX_RESPONSE_BYTES:
            raise ElevenLabsAccountError(
                ElevenLabsAccountReason.malformed_provider_response
            )
        try:
            return json.loads(content)
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ElevenLabsAccountError(
                ElevenLabsAccountReason.malformed_provider_response
            ) from exc


def normalize_subscription(payload: Any) -> SubscriptionSnapshot:
    if not isinstance(payload, dict):
        _malformed()
    tier = _provider_value(payload.get("tier"))
    status = _provider_value(payload.get("status"))
    period_usage = _nonnegative_int(payload.get("character_count"))
    period_limit = _nonnegative_int(payload.get("character_limit"))
    max_extension = payload.get("max_credit_limit_extension")
    if max_extension == "unlimited":
        normalized_extension = "unlimited"
        usage_based_billing_enabled = True
    else:
        normalized_extension = str(_nonnegative_int(max_extension))
        usage_based_billing_enabled = int(normalized_extension) > 0

    overage = payload.get("current_overage")
    if not isinstance(overage, dict):
        _malformed()
    overage_amount = _money(overage.get("amount"))
    overage_currency = _currency(overage.get("currency"), required=True)

    raw_invoices = payload.get("open_invoices")
    if not isinstance(raw_invoices, list) or len(raw_invoices) > 100:
        _malformed()
    open_invoice_total = 0
    for invoice in raw_invoices:
        if not isinstance(invoice, dict):
            _malformed()
        open_invoice_total += _nonnegative_int(invoice.get("amount_due_cents"))
        if open_invoice_total > MAX_SAFE_INTEGER:
            _malformed()

    has_open_invoices = payload.get("has_open_invoices")
    if not isinstance(has_open_invoices, bool):
        _malformed()
    next_invoice = payload.get("next_invoice")
    if next_invoice is not None and not isinstance(next_invoice, dict):
        _malformed()

    reset_at = _optional_unix_datetime(payload.get("next_character_count_reset_unix"))
    return SubscriptionSnapshot(
        tier=tier,
        status=status,
        period_usage=period_usage,
        period_limit=period_limit,
        period_remaining=max(period_limit - period_usage, 0),
        period_unit="characters",
        max_credit_limit_extension=normalized_extension,
        usage_based_billing_enabled=usage_based_billing_enabled,
        current_overage_amount=overage_amount,
        current_overage_currency=overage_currency,
        open_invoice_count=len(raw_invoices),
        open_invoice_total_due_cents=open_invoice_total,
        has_open_invoices=has_open_invoices,
        next_invoice_amount_due_cents=(
            _nonnegative_int(next_invoice.get("amount_due_cents"))
            if next_invoice is not None
            else None
        ),
        next_invoice_subtotal_cents=(
            _optional_nonnegative_int(next_invoice.get("subtotal_cents"))
            if next_invoice is not None
            else None
        ),
        next_invoice_tax_cents=(
            _optional_nonnegative_int(next_invoice.get("tax_cents"))
            if next_invoice is not None
            else None
        ),
        next_payment_attempt_at=(
            _optional_payment_attempt_datetime(next_invoice.get("next_payment_attempt_unix"))
            if next_invoice is not None
            else None
        ),
        subscription_currency=_currency(payload.get("currency"), required=False),
        billing_period=_optional_provider_value(payload.get("billing_period")),
        refresh_period=_optional_provider_value(
            payload.get("character_refresh_period")
        ),
        reset_at=reset_at,
        pending_change_present=payload.get("pending_change") is not None,
    )


def workspace_usage_window(
    subscription: SubscriptionSnapshot, now: datetime
) -> tuple[datetime, datetime, str]:
    current = _aware_utc(now)
    reset = subscription.reset_at
    if reset is not None and reset > current:
        period = subscription.refresh_period or subscription.billing_period
        previous = _previous_period(reset, period)
        if previous is not None and previous < current:
            return previous, current, "provider_reset_period"
    return current - timedelta(days=30), current, "rolling_30_days"


def normalize_workspace_usage(
    payload: Any,
    *,
    window_start: datetime,
    window_end: datetime,
    window_basis: str,
) -> WorkspaceUsageSnapshot:
    if not isinstance(payload, dict):
        _malformed()
    columns = payload.get("columns")
    rows = payload.get("rows")
    units = payload.get("column_units")
    if (
        not isinstance(columns, list)
        or not isinstance(rows, list)
        or not isinstance(units, list)
        or len(columns) == 0
        or len(columns) > 20
        or len(units) != len(columns)
        or len(rows) > MAX_USAGE_ROWS
        or len(set(columns)) != len(columns)
    ):
        _malformed()
    try:
        product_index = columns.index("product_type")
        credits_index = columns.index("credits_used")
    except ValueError:
        _malformed()
    if units[credits_index] not in {None, "", "credits"}:
        _malformed()

    product_totals: dict[str, Decimal] = {}
    for row in rows:
        if not isinstance(row, list) or len(row) != len(columns):
            _malformed()
        product = _provider_value(row[product_index])
        credits = _decimal(row[credits_index])
        product_totals[product] = product_totals.get(product, Decimal("0")) + credits
        if len(product_totals) > MAX_USAGE_PRODUCTS:
            _malformed()
    products = tuple(
        ProductCreditUsage(product, amount.quantize(DECIMAL_QUANTUM))
        for product, amount in sorted(product_totals.items())
    )
    total = sum((product.credits for product in products), Decimal("0"))
    return WorkspaceUsageSnapshot(
        window_start=_aware_utc(window_start),
        window_end=_aware_utc(window_end),
        window_basis=window_basis,
        unit="credits",
        total_credits=total.quantize(DECIMAL_QUANTUM),
        products=products,
    )


def _previous_period(value: datetime, period: str | None) -> datetime | None:
    if period in {"monthly_period", "month"}:
        year = value.year - (1 if value.month == 1 else 0)
        month = 12 if value.month == 1 else value.month - 1
        day = min(value.day, calendar.monthrange(year, month)[1])
        return value.replace(year=year, month=month, day=day)
    if period in {"annual_period", "yearly_period", "year"}:
        day = min(value.day, calendar.monthrange(value.year - 1, value.month)[1])
        return value.replace(year=value.year - 1, day=day)
    if period in {"weekly_period", "week"}:
        return value - timedelta(days=7)
    if period in {"daily_period", "day"}:
        return value - timedelta(days=1)
    return None


def _provider_value(value: Any) -> str:
    if not isinstance(value, str) or not SAFE_PROVIDER_VALUE.fullmatch(value):
        _malformed()
    return value


def _optional_provider_value(value: Any) -> str | None:
    if value is None:
        return None
    return _provider_value(value)


def _nonnegative_int(value: Any) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        _malformed()
    if value < 0 or value > MAX_SAFE_INTEGER:
        _malformed()
    return value


def _optional_nonnegative_int(value: Any) -> int | None:
    return None if value is None else _nonnegative_int(value)


def _decimal(value: Any) -> Decimal:
    if isinstance(value, bool):
        _malformed()
    try:
        normalized = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        _malformed()
    if not normalized.is_finite() or normalized < 0 or normalized > Decimal("1e18"):
        _malformed()
    return normalized


def _money(value: Any) -> Decimal:
    return _decimal(value).quantize(DECIMAL_QUANTUM)


def _currency(value: Any, *, required: bool) -> str | None:
    if value is None and not required:
        return None
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z]{3}", value):
        _malformed()
    return value.upper()


def _optional_unix_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    raw = _nonnegative_int(value)
    try:
        return datetime.fromtimestamp(raw, tz=timezone.utc)
    except (OverflowError, OSError, ValueError) as exc:
        raise ElevenLabsAccountError(
            ElevenLabsAccountReason.malformed_provider_response
        ) from exc


def _optional_payment_attempt_datetime(value: Any) -> datetime | None:
    # InvoiceResponse uses integer -1 for no scheduled attempt, not a date.
    # Keep this exception local to invoices; reset timestamps remain nonnegative.
    if type(value) is int and value == -1:
        return None
    return _optional_unix_datetime(value)


def _aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _malformed() -> None:
    raise ElevenLabsAccountError(
        ElevenLabsAccountReason.malformed_provider_response
    )

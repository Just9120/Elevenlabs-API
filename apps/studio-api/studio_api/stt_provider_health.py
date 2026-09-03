from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from .models import SttProviderHealth


HEALTH_FAILURE_CODES = frozenset({
    "malformed_provider_response",
    "provider_rate_limited",
    "provider_unavailable",
    "provider_timeout",
})


@dataclass(frozen=True)
class ProviderHealthState:
    available: bool
    consecutive_failures: int
    retry_after_seconds: int | None


def _naive_utc(value: datetime) -> datetime:
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def provider_health(db, *, provider: str, operating_mode: str, now: datetime) -> ProviderHealthState:
    row = db.get(SttProviderHealth, (provider, operating_mode))
    current = _naive_utc(now)
    open_until = _naive_utc(row.circuit_open_until) if row and row.circuit_open_until else None
    if row is None or open_until is None or open_until <= current:
        return ProviderHealthState(True, int(row.consecutive_failures or 0) if row else 0, None)
    seconds = max(1, int((open_until - current).total_seconds()))
    return ProviderHealthState(False, int(row.consecutive_failures or 0), seconds)


def record_provider_success(db, *, provider: str, operating_mode: str, now: datetime) -> None:
    now = _naive_utc(now)
    row = db.execute(
        select(SttProviderHealth)
        .where(SttProviderHealth.provider == provider, SttProviderHealth.operating_mode == operating_mode)
        .with_for_update()
    ).scalar_one_or_none()
    if row is None:
        db.add(SttProviderHealth(provider=provider, operating_mode=operating_mode, updated_at=now))
        return
    row.consecutive_failures = 0
    row.circuit_open_until = None
    row.last_failure_code = None
    row.updated_at = now


def record_provider_failure(
    db,
    *,
    provider: str,
    operating_mode: str,
    failure_code: str,
    threshold: int,
    cooldown_seconds: int,
    now: datetime,
) -> None:
    if failure_code not in HEALTH_FAILURE_CODES:
        return
    now = _naive_utc(now)
    row = db.execute(
        select(SttProviderHealth)
        .where(SttProviderHealth.provider == provider, SttProviderHealth.operating_mode == operating_mode)
        .with_for_update()
    ).scalar_one_or_none()
    if row is None:
        row = SttProviderHealth(provider=provider, operating_mode=operating_mode, updated_at=now)
        db.add(row)
    row.consecutive_failures = int(row.consecutive_failures or 0) + 1
    row.last_failure_code = failure_code
    row.updated_at = now
    if row.consecutive_failures >= threshold:
        row.circuit_open_until = now + timedelta(seconds=cooldown_seconds)

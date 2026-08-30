from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from enum import Enum

from sqlalchemy import select
from sqlalchemy.orm import Session

from .job_claim_lease import is_lease_active
from .models import (
    JobStatus,
    SourceAttemptStage,
    TranscriptionJob,
    TranscriptionJobSource,
    TranscriptionJobSourceAttempt,
)


CURRENCY = "USD"
COST_BASIS = "confirmed_audio_duration_x_rate_snapshot"
COST_QUANTUM = Decimal("0.00000001")
MAX_BILLED_PART_SECONDS = 604800


class ProviderUsageAccountingReason(str, Enum):
    pricing_unavailable = "provider_pricing_unavailable"
    pricing_snapshot_conflict = "provider_pricing_snapshot_conflict"
    invalid_duration = "provider_usage_duration_invalid"
    context_invalid = "provider_usage_context_invalid"
    progress_invalid = "provider_usage_progress_invalid"
    outcome_uncertain = "provider_usage_outcome_uncertain"


class ProviderUsageAccountingError(RuntimeError):
    def __init__(self, reason: ProviderUsageAccountingReason):
        self.reason = reason
        super().__init__(reason.value)


@dataclass(frozen=True)
class ProviderPricingSnapshot:
    rate_per_hour: Decimal
    effective_date: date
    source: str
    currency: str = CURRENCY


@dataclass(frozen=True)
class ConfirmedProviderUsage:
    duration_ms: int
    cost_amount: Decimal
    currency: str
    cost_basis: str = COST_BASIS


def pricing_snapshot(settings) -> ProviderPricingSnapshot:
    raw_rate = getattr(settings, "elevenlabs_scribe_v2_rate_per_hour_usd", None)
    effective_date = getattr(settings, "elevenlabs_pricing_effective_date", None)
    source = getattr(settings, "elevenlabs_pricing_source", None)
    try:
        rate = Decimal(str(raw_rate))
    except (InvalidOperation, TypeError, ValueError):
        raise ProviderUsageAccountingError(
            ProviderUsageAccountingReason.pricing_unavailable
        ) from None
    if (
        not rate.is_finite()
        or rate <= 0
        or not isinstance(effective_date, date)
        or source != "elevenlabs_public_api_pricing"
    ):
        raise ProviderUsageAccountingError(
            ProviderUsageAccountingReason.pricing_unavailable
        )
    return ProviderPricingSnapshot(
        rate.quantize(Decimal("0.000001")), effective_date, source
    )


def begin_provider_part_usage(
    db: Session,
    *,
    job_id: str,
    job_source_id: str,
    lease_owner_id: str,
    lease_generation: int,
    part_index: int,
    duration_seconds: float,
    settings,
    now: datetime,
) -> None:
    snapshot = pricing_snapshot(settings)
    duration_ms = _duration_ms(duration_seconds)
    job, attempt = _locked_context(
        db,
        job_id=job_id,
        job_source_id=job_source_id,
        lease_owner_id=lease_owner_id,
        lease_generation=lease_generation,
        now=now,
    )
    index = int(part_index)
    if (
        attempt.stage != SourceAttemptStage.provider_request_started
        or attempt.provider_total_parts is None
        or index != int(attempt.provider_completed_parts or 0)
        or index < 0
        or index >= int(attempt.provider_total_parts)
    ):
        raise ProviderUsageAccountingError(
            ProviderUsageAccountingReason.progress_invalid
        )
    if attempt.provider_pending_part_index is not None or attempt.provider_accounting_status in {
        "pending",
        "uncertain",
    }:
        raise ProviderUsageAccountingError(
            ProviderUsageAccountingReason.outcome_uncertain
        )

    _initialize_job_accounting(job)
    _initialize_attempt_accounting(attempt)
    _apply_snapshot(job, snapshot)
    _apply_snapshot(attempt, snapshot)
    attempt.provider_pending_part_index = index
    attempt.provider_pending_duration_ms = duration_ms
    attempt.provider_accounting_status = "pending"
    attempt.updated_at = now
    job.provider_accounting_complete = False
    job.updated_at = now
    db.flush()


def confirm_provider_part_usage(
    db: Session,
    *,
    job_id: str,
    job_source_id: str,
    lease_owner_id: str,
    lease_generation: int,
    part_index: int,
    now: datetime,
) -> ConfirmedProviderUsage:
    job, attempt = _locked_context(
        db,
        job_id=job_id,
        job_source_id=job_source_id,
        lease_owner_id=lease_owner_id,
        lease_generation=lease_generation,
        now=now,
        allow_cancel=True,
    )
    if (
        attempt.provider_accounting_status != "pending"
        or attempt.provider_pending_part_index != int(part_index)
        or attempt.provider_pending_duration_ms is None
        or attempt.provider_rate_per_hour is None
        or attempt.provider_cost_currency != CURRENCY
    ):
        raise ProviderUsageAccountingError(
            ProviderUsageAccountingReason.progress_invalid
        )

    duration_ms = int(attempt.provider_pending_duration_ms)
    cost = _cost_for(duration_ms, Decimal(str(attempt.provider_rate_per_hour)))
    _initialize_job_accounting(job)
    _initialize_attempt_accounting(attempt)
    attempt.provider_billed_duration_ms = int(
        attempt.provider_billed_duration_ms or 0
    ) + duration_ms
    attempt.provider_cost_amount = _amount(attempt.provider_cost_amount) + cost
    attempt.provider_pending_part_index = None
    attempt.provider_pending_duration_ms = None
    attempt.provider_accounting_status = "confirmed"
    attempt.updated_at = now
    job.provider_billed_duration_ms = int(job.provider_billed_duration_ms or 0) + duration_ms
    job.provider_cost_amount = _amount(job.provider_cost_amount) + cost
    job.provider_accounting_complete = False
    job.updated_at = now
    db.flush()
    return ConfirmedProviderUsage(duration_ms, cost, CURRENCY)


def mark_pending_provider_usage_uncertain(
    db: Session,
    *,
    job_id: str,
    job_source_id: str,
    now: datetime,
) -> bool:
    job = db.execute(
        select(TranscriptionJob)
        .where(TranscriptionJob.id == job_id)
        .with_for_update()
    ).scalar_one_or_none()
    if job is None:
        return False
    attempt = db.execute(
        select(TranscriptionJobSourceAttempt)
        .where(
            TranscriptionJobSourceAttempt.job_id == job.id,
            TranscriptionJobSourceAttempt.job_source_id == job_source_id,
            TranscriptionJobSourceAttempt.attempt_number == int(job.attempt_count or 0),
        )
        .with_for_update()
    ).scalar_one_or_none()
    if attempt is None or attempt.provider_accounting_status != "pending":
        return False
    attempt.provider_accounting_status = "uncertain"
    attempt.updated_at = now
    _initialize_job_accounting(job)
    job.provider_accounting_uncertain = True
    job.provider_accounting_complete = False
    job.updated_at = now
    db.flush()
    return True


def finalize_job_provider_accounting(
    db: Session, *, job: TranscriptionJob, now: datetime
) -> None:
    if job.provider_billed_duration_ms is None:
        # Pre-migration jobs stay explicitly unavailable; zero is not fabricated.
        return
    uncertain = db.execute(
        select(TranscriptionJobSourceAttempt.id)
        .where(
            TranscriptionJobSourceAttempt.job_id == job.id,
            TranscriptionJobSourceAttempt.provider_accounting_status.in_(
                ("pending", "uncertain")
            ),
        )
        .limit(1)
    ).first()
    job.provider_accounting_uncertain = uncertain is not None
    job.provider_accounting_complete = uncertain is None
    job.updated_at = now


def accounting_status(job: TranscriptionJob) -> str:
    if job.provider_billed_duration_ms is None:
        return "unavailable"
    if job.provider_accounting_uncertain:
        return "uncertain"
    if job.provider_accounting_complete:
        return "complete"
    if int(job.provider_billed_duration_ms or 0) > 0:
        return "confirmed_partial"
    return "not_started"


def _locked_context(
    db: Session,
    *,
    job_id: str,
    job_source_id: str,
    lease_owner_id: str,
    lease_generation: int,
    now: datetime,
    allow_cancel: bool = False,
) -> tuple[TranscriptionJob, TranscriptionJobSourceAttempt]:
    job = db.execute(
        select(TranscriptionJob)
        .where(TranscriptionJob.id == job_id)
        .with_for_update()
    ).scalar_one_or_none()
    relation = db.get(TranscriptionJobSource, job_source_id)
    if (
        job is None
        or relation is None
        or relation.job_id != job.id
        or job.status != JobStatus.processing
        or job.lease_owner_id != lease_owner_id
        or job.lease_generation != lease_generation
        or not is_lease_active(job, now)
        or (job.cancel_requested_at is not None and not allow_cancel)
    ):
        raise ProviderUsageAccountingError(
            ProviderUsageAccountingReason.context_invalid
        )
    attempt = db.execute(
        select(TranscriptionJobSourceAttempt)
        .where(
            TranscriptionJobSourceAttempt.job_id == job.id,
            TranscriptionJobSourceAttempt.job_source_id == relation.id,
            TranscriptionJobSourceAttempt.attempt_number == int(job.attempt_count or 0),
        )
        .with_for_update()
    ).scalar_one_or_none()
    if attempt is None:
        raise ProviderUsageAccountingError(
            ProviderUsageAccountingReason.context_invalid
        )
    return job, attempt


def _duration_ms(value: float) -> int:
    try:
        duration = float(value)
    except (TypeError, ValueError):
        raise ProviderUsageAccountingError(
            ProviderUsageAccountingReason.invalid_duration
        ) from None
    if not math.isfinite(duration) or duration <= 0 or duration > MAX_BILLED_PART_SECONDS:
        raise ProviderUsageAccountingError(
            ProviderUsageAccountingReason.invalid_duration
        )
    return max(1, round(duration * 1000))


def _cost_for(duration_ms: int, rate_per_hour: Decimal) -> Decimal:
    return (
        rate_per_hour * Decimal(duration_ms) / Decimal(3_600_000)
    ).quantize(COST_QUANTUM, rounding=ROUND_HALF_UP)


def _amount(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(COST_QUANTUM)


def _initialize_job_accounting(job: TranscriptionJob) -> None:
    if job.provider_billed_duration_ms is None:
        job.provider_billed_duration_ms = 0
        job.provider_cost_amount = Decimal("0")
        job.provider_cost_currency = CURRENCY
        job.provider_accounting_complete = False
        job.provider_accounting_uncertain = False


def _initialize_attempt_accounting(attempt: TranscriptionJobSourceAttempt) -> None:
    if attempt.provider_accounting_status is None:
        attempt.provider_accounting_status = "not_started"
        attempt.provider_billed_duration_ms = 0
        attempt.provider_cost_amount = Decimal("0")
        attempt.provider_cost_currency = CURRENCY


def _apply_snapshot(target, snapshot: ProviderPricingSnapshot) -> None:
    existing = (
        target.provider_rate_per_hour,
        target.provider_rate_effective_date,
        target.provider_rate_source,
        target.provider_cost_currency,
    )
    expected = (
        snapshot.rate_per_hour,
        snapshot.effective_date,
        snapshot.source,
        snapshot.currency,
    )
    if all(value is None for value in existing[:3]):
        target.provider_rate_per_hour = snapshot.rate_per_hour
        target.provider_rate_effective_date = snapshot.effective_date
        target.provider_rate_source = snapshot.source
        target.provider_cost_currency = snapshot.currency
        return
    normalized = (
        Decimal(str(existing[0])).quantize(Decimal("0.000001"))
        if existing[0] is not None
        else None,
        existing[1],
        existing[2],
        existing[3],
    )
    if normalized != expected:
        raise ProviderUsageAccountingError(
            ProviderUsageAccountingReason.pricing_snapshot_conflict
        )

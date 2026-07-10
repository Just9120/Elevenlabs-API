from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum

from sqlalchemy import select
from sqlalchemy.orm import Session

from .job_claim_readiness import build_claim_readiness
from .models import JobStatus, TranscriptionJob

MAX_LEASE_OWNER_ID_LENGTH = 128
MAX_LEASE_TTL = timedelta(hours=24)


class JobLeaseFailureReason(str, Enum):
    invalid_owner = "invalid_owner"
    invalid_ttl = "invalid_ttl"
    job_not_found = "job_not_found"
    job_not_queued = "job_not_queued"
    job_not_ready = "job_not_ready"
    lease_active = "lease_active"
    lease_not_owned = "lease_not_owned"
    lease_not_active = "lease_not_active"


class JobLeaseError(RuntimeError):
    def __init__(self, reason: JobLeaseFailureReason):
        self.reason = reason
        super().__init__(reason.value)


@dataclass(frozen=True)
class JobLeaseHandle:
    job_id: str
    lease_owner_id: str
    lease_generation: int
    claimed_at: datetime
    lease_expires_at: datetime


def is_lease_active(job: TranscriptionJob, now: datetime) -> bool:
    return bool(job.lease_owner_id and job.lease_expires_at and job.lease_expires_at > now)


def acquire_job_lease(
    db: Session,
    *,
    job_id: str,
    lease_owner_id: str,
    now: datetime,
    lease_ttl: timedelta,
) -> JobLeaseHandle:
    owner = _validated_owner(lease_owner_id)
    expires_at = now + _validated_ttl(lease_ttl)
    job = _locked_job(db, job_id)
    if job is None:
        raise JobLeaseError(JobLeaseFailureReason.job_not_found)
    if job.status != JobStatus.queued:
        raise JobLeaseError(JobLeaseFailureReason.job_not_queued)
    if not build_claim_readiness(job)["ready_for_future_claim"]:
        raise JobLeaseError(JobLeaseFailureReason.job_not_ready)
    if is_lease_active(job, now):
        raise JobLeaseError(JobLeaseFailureReason.lease_active)

    job.lease_generation = (job.lease_generation or 0) + 1
    job.lease_owner_id = owner
    job.claimed_at = now
    job.lease_expires_at = expires_at
    db.flush()
    return _handle(job)


def renew_job_lease(
    db: Session,
    *,
    job_id: str,
    lease_owner_id: str,
    lease_generation: int,
    now: datetime,
    lease_ttl: timedelta,
) -> JobLeaseHandle:
    owner = _validated_owner(lease_owner_id)
    expires_at = now + _validated_ttl(lease_ttl)
    job = _locked_job(db, job_id)
    if job is None:
        raise JobLeaseError(JobLeaseFailureReason.job_not_found)
    if job.status != JobStatus.queued:
        raise JobLeaseError(JobLeaseFailureReason.job_not_queued)
    _require_current_owner(job, owner, lease_generation)
    if not is_lease_active(job, now):
        raise JobLeaseError(JobLeaseFailureReason.lease_not_active)

    job.lease_expires_at = expires_at
    db.flush()
    return _handle(job)


def release_job_lease(
    db: Session, *, job_id: str, lease_owner_id: str, lease_generation: int) -> bool:
    owner = _validated_owner(lease_owner_id)
    job = _locked_job(db, job_id)
    if job is None:
        raise JobLeaseError(JobLeaseFailureReason.job_not_found)
    if job.lease_owner_id is None and job.lease_expires_at is None and job.lease_generation == lease_generation:
        return False
    _require_current_owner(job, owner, lease_generation)
    job.lease_owner_id = None
    job.lease_expires_at = None
    db.flush()
    return True


def invalidate_job_lease(job: TranscriptionJob) -> None:
    job.lease_owner_id = None
    job.lease_expires_at = None


def _locked_job(db: Session, job_id: str) -> TranscriptionJob | None:
    return db.execute(select(TranscriptionJob).where(TranscriptionJob.id == job_id).with_for_update()).scalar_one_or_none()


def _validated_owner(value: str) -> str:
    owner = value.strip() if isinstance(value, str) else ""
    if not owner or len(owner) > MAX_LEASE_OWNER_ID_LENGTH:
        raise JobLeaseError(JobLeaseFailureReason.invalid_owner)
    return owner


def _validated_ttl(value: timedelta) -> timedelta:
    if value <= timedelta(0) or value > MAX_LEASE_TTL:
        raise JobLeaseError(JobLeaseFailureReason.invalid_ttl)
    return value


def _require_current_owner(job: TranscriptionJob, owner: str, generation: int) -> None:
    if job.lease_owner_id != owner or job.lease_generation != generation:
        raise JobLeaseError(JobLeaseFailureReason.lease_not_owned)


def _handle(job: TranscriptionJob) -> JobLeaseHandle:
    if not job.lease_owner_id or not job.claimed_at or not job.lease_expires_at:
        raise JobLeaseError(JobLeaseFailureReason.lease_not_active)
    return JobLeaseHandle(
        job_id=job.id,
        lease_owner_id=job.lease_owner_id,
        lease_generation=job.lease_generation,
        claimed_at=job.claimed_at,
        lease_expires_at=job.lease_expires_at,
    )

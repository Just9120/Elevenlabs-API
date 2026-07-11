from __future__ import annotations

from datetime import datetime, timedelta
from enum import Enum
from typing import Callable

from sqlalchemy.orm import Session

from .job_claim_lease import JobLeaseError, acquire_job_lease
from .job_processing_orchestrator import (
    JobProcessingOrchestrationError,
    JobProcessingOrchestrationResult,
    orchestrate_processing_job,
)
from .security import utcnow


class JobProcessingRunnerReason(str, Enum):
    claim_failed = "claim_failed"
    claim_commit_failed = "claim_commit_failed"
    orchestration_failed = "orchestration_failed"


class JobProcessingRunnerError(RuntimeError):
    def __init__(self, reason: JobProcessingRunnerReason):
        self.reason = reason
        super().__init__(reason.value)


def claim_and_orchestrate_processing_job(
    db: Session,
    *,
    job_id: str,
    lease_owner_id: str,
    lease_ttl: timedelta,
    settings,
    clock: Callable[[], datetime] | None = None,
    lease_acquirer: Callable = acquire_job_lease,
    orchestrator: Callable = orchestrate_processing_job,
) -> JobProcessingOrchestrationResult:
    """Claim one explicit queued job, commit the lease, then run the orchestrator once."""

    clock = clock or (lambda: utcnow().replace(tzinfo=None))
    now = clock()
    try:
        handle = lease_acquirer(
            db,
            job_id=job_id,
            lease_owner_id=lease_owner_id,
            now=now,
            lease_ttl=lease_ttl,
        )
    except JobLeaseError:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise JobProcessingRunnerError(JobProcessingRunnerReason.claim_failed) from exc

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise JobProcessingRunnerError(JobProcessingRunnerReason.claim_commit_failed) from exc

    try:
        return orchestrator(
            db,
            job_id=handle.job_id,
            lease_owner_id=handle.lease_owner_id,
            lease_generation=handle.lease_generation,
            settings=settings,
            clock=clock,
        )
    except JobProcessingOrchestrationError:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise JobProcessingRunnerError(JobProcessingRunnerReason.orchestration_failed) from exc

from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from .job_claim_lease import is_lease_active, invalidate_job_lease
from .job_claim_readiness import build_claim_readiness
from .models import (JobSourceStatus, JobStatus, OutputReconciliationStatus, SourceAttemptRetryDisposition as Disp, SourceAttemptStage as Stage, TranscriptionJob, TranscriptionJobOutput, TranscriptionJobSource, TranscriptionJobSourceAttempt, TranscriptionOutputReconciliation)

MAX_PROCESSING_ATTEMPTS = 3
SAFE_PROVIDER_FAILURES = {"provider_authentication_rejected", "provider_request_rejected", "provider_rate_limited"}
UNCERTAIN_PROVIDER_FAILURES = {"provider_timeout", "provider_unavailable", "malformed_provider_response", "lifecycle_changed_after_provider_call", "lease_heartbeat_failed", "lease_heartbeat_not_owned", "lease_heartbeat_expired", "lease_heartbeat_commit_failed", "lease_heartbeat_stop_timeout", "context_closed", "unknown"}
PRE_PROVIDER_SAFE_FAILURES = {"prerequisites_unavailable", "source_materialization_unavailable", "lifecycle_changed_before_provider_call", "credential_or_output_identity_changed_before_provider_call", "pipeline_retry_state_prepare_failed", "pipeline_retry_state_persistence_failed", "pipeline_transcription_failed", "pipeline_output_reconciliation_prepare_failed"}

class RetryReason(str, Enum):
    available="available"; job_not_failed="job_not_failed"; cancelled="cancelled"; completed="completed"; attempt_limit_reached="attempt_limit_reached"; provider_outcome_uncertain="provider_outcome_uncertain"; provider_result_lost="provider_result_lost"; output_reconciliation_required="output_reconciliation_required"; legacy_or_unknown_execution_state="legacy_or_unknown_execution_state"; prerequisites_unavailable="prerequisites_unavailable"; non_retryable="non_retryable"

@dataclass(frozen=True)
class RetryReadiness:
    available: bool; reason: RetryReason; attempt_count: int; max_attempts: int; missing_output_count: int; retry_safe_source_count: int
    def payload(self, job):
        return {"job_id": job.id, "job_status": job.status.value, "available": self.available, "reason": self.reason.value, "attempt_count": self.attempt_count, "max_attempts": self.max_attempts, "missing_output_count": self.missing_output_count, "retry_safe_source_count": self.retry_safe_source_count}

def latest_attempt(db, job_source_id):
    return db.execute(select(TranscriptionJobSourceAttempt).where(TranscriptionJobSourceAttempt.job_source_id==job_source_id).order_by(TranscriptionJobSourceAttempt.attempt_number.desc(), TranscriptionJobSourceAttempt.created_at.desc())).scalars().first()

def prepare_source_attempt(db: Session, *, job_id, job_source_id, lease_owner_id, lease_generation, now: datetime):
    job=db.get(TranscriptionJob, job_id); rel=db.get(TranscriptionJobSource, job_source_id)
    if not job or not rel or rel.job_id!=job.id or job.status!=JobStatus.processing or job.lease_owner_id!=lease_owner_id or job.lease_generation!=lease_generation or not is_lease_active(job, now) or job.cancel_requested_at is not None:
        raise RuntimeError("retry_state_prepare_not_allowed")
    if db.execute(select(TranscriptionJobOutput.id).where(TranscriptionJobOutput.job_source_id==rel.id)).first():
        return None
    if db.execute(select(TranscriptionOutputReconciliation.id).where(TranscriptionOutputReconciliation.job_source_id==rel.id, TranscriptionOutputReconciliation.status != OutputReconciliationStatus.resolved)).first():
        raise RuntimeError("retry_state_reconciliation_exists")
    n=job.attempt_count or 0
    row=db.execute(select(TranscriptionJobSourceAttempt).where(TranscriptionJobSourceAttempt.job_source_id==rel.id, TranscriptionJobSourceAttempt.attempt_number==n)).scalar_one_or_none()
    if row:
        if row.owner_user_id!=job.owner_user_id or row.project_id!=job.project_id or row.job_id!=job.id:
            raise RuntimeError("retry_state_scope_conflict")
        return row
    row=TranscriptionJobSourceAttempt(owner_user_id=job.owner_user_id, project_id=job.project_id, job_id=job.id, job_source_id=rel.id, attempt_number=n, stage=Stage.prepared, retry_disposition=Disp.undetermined, created_at=now, updated_at=now)
    db.add(row); db.flush(); return row

def mark_attempt_provider_started(db, *, job_id, job_source_id, lease_owner_id, lease_generation, now):
    row=prepare_source_attempt(db, job_id=job_id, job_source_id=job_source_id, lease_owner_id=lease_owner_id, lease_generation=lease_generation, now=now)
    if row is None: return None
    if row.stage != Stage.prepared: raise RuntimeError("retry_state_not_prepared")
    row.stage=Stage.provider_request_started; row.provider_request_started_at=now; row.retry_disposition=Disp.undetermined; row.updated_at=now; db.flush(); return row

def mark_attempt_provider_returned(db, *, job_source_id, now):
    row=latest_attempt(db, job_source_id)
    if row: row.stage=Stage.provider_response_returned; row.provider_response_returned_at=now; row.retry_disposition=Disp.provider_result_lost; row.updated_at=now; db.flush()
    return row

def classify_source_attempt_failure(db, *, job_source_id, failure_code, now):
    row=latest_attempt(db, job_source_id)
    if not row: return None
    code=str(failure_code or "unknown")
    row.stage=Stage.failed; row.failure_code=code; row.failed_at=now; row.updated_at=now
    if code in SAFE_PROVIDER_FAILURES or (row.provider_request_started_at is None and code in PRE_PROVIDER_SAFE_FAILURES): row.retry_disposition=Disp.retry_safe
    elif code in {"output_reconciliation_required", "existing_reconciliation_case"}: row.retry_disposition=Disp.output_reconciliation_required
    elif row.provider_response_returned_at is not None: row.retry_disposition=Disp.provider_result_lost
    elif row.provider_request_started_at is not None: row.retry_disposition=Disp.provider_outcome_uncertain
    else: row.retry_disposition=Disp.non_retryable
    db.flush(); return row

def mark_attempt_google_handoff(db, *, job_source_id, now):
    row=latest_attempt(db, job_source_id)
    if row: row.stage=Stage.google_handoff; row.retry_disposition=Disp.provider_result_lost; row.updated_at=now; db.flush()

def mark_attempt_output_reconciliation_required(db, *, job_source_id, failure_code, now):
    row=latest_attempt(db, job_source_id)
    if row: row.failure_code=str(failure_code or "output_reconciliation_required"); row.retry_disposition=Disp.output_reconciliation_required; row.updated_at=now; db.flush()

def mark_attempt_completed(db, *, job_source_id, now):
    row=latest_attempt(db, job_source_id)
    if row: row.stage=Stage.output_persisted; row.retry_disposition=Disp.completed; row.completed_at=now; row.updated_at=now; db.flush()

def compute_retry_readiness(db, job):
    if job.status==JobStatus.completed: return RetryReadiness(False, RetryReason.completed, job.attempt_count or 0, MAX_PROCESSING_ATTEMPTS, 0, 0)
    if job.cancel_requested_at or job.status==JobStatus.cancelled: return RetryReadiness(False, RetryReason.cancelled, job.attempt_count or 0, MAX_PROCESSING_ATTEMPTS, 0, 0)
    if job.status not in {JobStatus.failed, JobStatus.queued}: return RetryReadiness(False, RetryReason.job_not_failed, job.attempt_count or 0, MAX_PROCESSING_ATTEMPTS, 0, 0)
    rels=db.execute(select(TranscriptionJobSource).where(TranscriptionJobSource.job_id==job.id, TranscriptionJobSource.status!=JobSourceStatus.skipped)).scalars().all()
    missing=[]; safe=0; reason=None
    for rel in rels:
        if db.execute(select(TranscriptionJobOutput.id).where(TranscriptionJobOutput.job_source_id==rel.id)).first(): continue
        missing.append(rel)
        if db.execute(select(TranscriptionOutputReconciliation.id).where(TranscriptionOutputReconciliation.job_source_id==rel.id, TranscriptionOutputReconciliation.status != OutputReconciliationStatus.resolved)).first(): reason=RetryReason.output_reconciliation_required; continue
        att=latest_attempt(db, rel.id)
        if not att:
            if job.error_code=="pipeline_retry_state_prepare_failed": safe+=1
            else: reason=reason or RetryReason.legacy_or_unknown_execution_state
        elif att.retry_disposition==Disp.retry_safe and (att.provider_request_started_at is None or att.failure_code in SAFE_PROVIDER_FAILURES): safe+=1
        elif att.retry_disposition==Disp.provider_outcome_uncertain: reason=reason or RetryReason.provider_outcome_uncertain
        elif att.retry_disposition==Disp.provider_result_lost: reason=reason or RetryReason.provider_result_lost
        elif att.retry_disposition==Disp.output_reconciliation_required: reason=reason or RetryReason.output_reconciliation_required
        else: reason=reason or RetryReason.non_retryable
    if (job.attempt_count or 0) >= MAX_PROCESSING_ATTEMPTS: return RetryReadiness(False, RetryReason.attempt_limit_reached, job.attempt_count or 0, MAX_PROCESSING_ATTEMPTS, len(missing), safe)
    if job.status==JobStatus.queued: return RetryReadiness(True, RetryReason.available, job.attempt_count or 0, MAX_PROCESSING_ATTEMPTS, len(missing), safe)
    if not missing: return RetryReadiness(False, RetryReason.completed, job.attempt_count or 0, MAX_PROCESSING_ATTEMPTS, 0, safe)
    if safe==len(missing) and build_claim_readiness(job)["ready_for_future_claim"]: return RetryReadiness(True, RetryReason.available, job.attempt_count or 0, MAX_PROCESSING_ATTEMPTS, len(missing), safe)
    return RetryReadiness(False, reason or RetryReason.prerequisites_unavailable, job.attempt_count or 0, MAX_PROCESSING_ATTEMPTS, len(missing), safe)

def queue_retry(db, *, owner_user_id, job_id, now):
    job=db.execute(select(TranscriptionJob).where(TranscriptionJob.id==job_id, TranscriptionJob.owner_user_id==owner_user_id).with_for_update()).scalar_one_or_none()
    if not job: return None, None
    ready=compute_retry_readiness(db, job)
    if job.status==JobStatus.queued: return job, ready
    if ready.available and not is_lease_active(job, now):
        job.status=JobStatus.queued; job.finished_at=None; job.error_code=None; job.error_message=None; job.updated_at=now; invalidate_job_lease(job); db.flush(); return job, compute_retry_readiness(db, job)
    return job, ready

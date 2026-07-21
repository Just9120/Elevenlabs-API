from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Literal
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from .job_claim_lease import is_lease_active, invalidate_job_lease
from .job_claim_readiness import build_claim_readiness_from_preflight
from .job_processing_preflight import build_processing_preflight
from .models import (JobSourceStatus, JobStatus, OutputReconciliationStatus, SourceAttemptRetryDisposition as Disp, SourceAttemptStage as Stage, TranscriptionJob, TranscriptionJobOutput, TranscriptionJobSource, TranscriptionJobSourceAttempt, TranscriptionOutputReconciliation)

MAX_PROCESSING_ATTEMPTS = 3
SAFE_PROVIDER_FAILURES = {"provider_authentication_rejected", "provider_request_rejected", "provider_rate_limited"}
UNCERTAIN_PROVIDER_FAILURES = {"provider_timeout", "provider_unavailable", "malformed_provider_response", "lifecycle_changed_after_provider_call", "lease_heartbeat_failed", "lease_heartbeat_not_owned", "lease_heartbeat_expired", "lease_heartbeat_commit_failed", "lease_heartbeat_stop_timeout", "context_closed", "unknown"}
PRE_PROVIDER_SAFE_FAILURES = {"prerequisites_unavailable", "source_materialization_unavailable", "lifecycle_changed_before_provider_call", "credential_or_output_identity_changed_before_provider_call", "pipeline_retry_state_prepare_failed", "pipeline_retry_state_persistence_failed", "retry_state_persistence_failed", "pipeline_transcription_failed", "pipeline_output_reconciliation_prepare_failed"}

class RetryReason(str, Enum):
    available="available"; job_not_failed="job_not_failed"; cancelled="cancelled"; completed="completed"; attempt_limit_reached="attempt_limit_reached"; provider_outcome_uncertain="provider_outcome_uncertain"; provider_result_lost="provider_result_lost"; output_reconciliation_required="output_reconciliation_required"; legacy_or_unknown_execution_state="legacy_or_unknown_execution_state"; prerequisites_unavailable="prerequisites_unavailable"; non_retryable="non_retryable"

@dataclass(frozen=True)
class RetryReadiness:
    available: bool; reason: RetryReason; attempt_count: int; max_attempts: int; missing_output_count: int; retry_safe_source_count: int
    def payload(self, job):
        return {"job_id": job.id, "job_status": job.status.value, "available": self.available, "reason": self.reason.value, "attempt_count": self.attempt_count, "max_attempts": self.max_attempts, "missing_output_count": self.missing_output_count, "retry_safe_source_count": self.retry_safe_source_count}

@dataclass(frozen=True)
class RetryQueueResult:
    job: TranscriptionJob
    readiness: RetryReadiness
    transitioned: bool

def latest_attempt(db, job_source_id):
    return db.execute(select(TranscriptionJobSourceAttempt).where(TranscriptionJobSourceAttempt.job_source_id==job_source_id).order_by(TranscriptionJobSourceAttempt.attempt_number.desc(), TranscriptionJobSourceAttempt.created_at.desc())).scalars().first()

def current_attempt_for_relation(db, *, job_source_id, attempt_number):
    return db.execute(select(TranscriptionJobSourceAttempt).where(TranscriptionJobSourceAttempt.job_source_id==job_source_id, TranscriptionJobSourceAttempt.attempt_number==attempt_number)).scalar_one_or_none()

def _required(db, job_id):
    return db.execute(select(TranscriptionJobSource).where(TranscriptionJobSource.job_id==job_id, TranscriptionJobSource.status!=JobSourceStatus.skipped).order_by(TranscriptionJobSource.position, TranscriptionJobSource.id)).scalars().all()

def _has_output(db, rel_id):
    return db.execute(select(TranscriptionJobOutput.id).where(TranscriptionJobOutput.job_source_id==rel_id)).first() is not None

def _has_unresolved_reconciliation(db, rel_id):
    return db.execute(select(TranscriptionOutputReconciliation.id).where(TranscriptionOutputReconciliation.job_source_id==rel_id, TranscriptionOutputReconciliation.status != OutputReconciliationStatus.resolved)).first() is not None

def _require_active_processing(job, owner, generation, now, *, allow_cancel=False):
    if job.status!=JobStatus.processing or job.lease_owner_id!=owner or job.lease_generation!=generation or not is_lease_active(job, now) or (job.cancel_requested_at is not None and not allow_cancel):
        raise RuntimeError("retry_state_processing_context_invalid")

def _current_attempt(db: Session, *, job_id, job_source_id, lease_owner_id=None, lease_generation=None, now: datetime|None=None, require_processing_lease=False, allow_cancel=False):
    job=db.get(TranscriptionJob, job_id); rel=db.get(TranscriptionJobSource, job_source_id)
    if not job or not rel or rel.job_id!=job.id:
        raise RuntimeError("retry_state_scope_conflict")
    attempt_number=int(job.attempt_count or 0)
    if attempt_number < 1:
        raise RuntimeError("retry_state_invalid_attempt_number")
    if require_processing_lease:
        if now is None or lease_owner_id is None or lease_generation is None:
            raise RuntimeError("retry_state_processing_context_required")
        _require_active_processing(job, lease_owner_id, lease_generation, now, allow_cancel=allow_cancel)
    row=db.execute(select(TranscriptionJobSourceAttempt).where(TranscriptionJobSourceAttempt.job_source_id==rel.id, TranscriptionJobSourceAttempt.attempt_number==attempt_number)).scalar_one_or_none()
    if row is None:
        raise RuntimeError("retry_state_current_attempt_missing")
    if row.job_id!=job.id or row.owner_user_id!=job.owner_user_id or row.project_id!=job.project_id:
        raise RuntimeError("retry_state_scope_conflict")
    return job, rel, row

def prepare_source_attempt(db: Session, *, job_id, job_source_id, lease_owner_id, lease_generation, now: datetime):
    job=db.get(TranscriptionJob, job_id); rel=db.get(TranscriptionJobSource, job_source_id)
    if not job or not rel or rel.job_id!=job.id:
        raise RuntimeError("retry_state_prepare_not_allowed")
    _require_active_processing(job, lease_owner_id, lease_generation, now)
    n=int(job.attempt_count or 0)
    if n < 1:
        raise RuntimeError("retry_state_invalid_attempt_number")
    if _has_output(db, rel.id):
        return None
    if _has_unresolved_reconciliation(db, rel.id):
        raise RuntimeError("retry_state_reconciliation_exists")
    row=db.execute(select(TranscriptionJobSourceAttempt).where(TranscriptionJobSourceAttempt.job_source_id==rel.id, TranscriptionJobSourceAttempt.attempt_number==n)).scalar_one_or_none()
    if row:
        if row.owner_user_id!=job.owner_user_id or row.project_id!=job.project_id or row.job_id!=job.id:
            raise RuntimeError("retry_state_scope_conflict")
        return row
    row=TranscriptionJobSourceAttempt(owner_user_id=job.owner_user_id, project_id=job.project_id, job_id=job.id, job_source_id=rel.id, attempt_number=n, stage=Stage.prepared, retry_disposition=Disp.undetermined, created_at=now, updated_at=now)
    db.add(row); db.flush(); return row

def prepare_current_attempt_sources(db: Session, *, job_id, lease_owner_id, lease_generation, now: datetime):
    job=db.get(TranscriptionJob, job_id)
    if job is None:
        raise RuntimeError("retry_state_prepare_not_allowed")
    _require_active_processing(job, lease_owner_id, lease_generation, now)
    n=int(job.attempt_count or 0)
    if n < 1:
        raise RuntimeError("retry_state_invalid_attempt_number")
    created=[]
    for rel in _required(db, job.id):
        if _has_output(db, rel.id):
            continue
        if _has_unresolved_reconciliation(db, rel.id):
            raise RuntimeError("retry_state_reconciliation_exists")
        row=current_attempt_for_relation(db, job_source_id=rel.id, attempt_number=n)
        if row is None:
            row=TranscriptionJobSourceAttempt(owner_user_id=job.owner_user_id, project_id=job.project_id, job_id=job.id, job_source_id=rel.id, attempt_number=n, stage=Stage.prepared, retry_disposition=Disp.undetermined, created_at=now, updated_at=now)
            db.add(row); created.append(row)
            continue
        if row.owner_user_id!=job.owner_user_id or row.project_id!=job.project_id or row.job_id!=job.id:
            raise RuntimeError("retry_state_scope_conflict")
        if row.stage != Stage.prepared:
            raise RuntimeError("retry_state_not_prepared")
    db.flush(); return tuple(created)

def _transition(row, *, allowed_from, to_stage, disposition, now, idempotent=True):
    if row.stage == to_stage and idempotent:
        row.retry_disposition = disposition
        row.updated_at = now; return row
    if row.stage in {Stage.failed, Stage.output_persisted}:
        raise RuntimeError("retry_state_terminal_attempt")
    if row.stage not in allowed_from:
        raise RuntimeError("retry_state_invalid_transition")
    row.stage=to_stage; row.retry_disposition=disposition; row.updated_at=now; return row

def mark_attempt_provider_started(db, *, job_id, job_source_id, lease_owner_id, lease_generation, now):
    _job,_rel,row=_current_attempt(db, job_id=job_id, job_source_id=job_source_id, lease_owner_id=lease_owner_id, lease_generation=lease_generation, now=now, require_processing_lease=True)
    _transition(row, allowed_from={Stage.prepared}, to_stage=Stage.provider_request_started, disposition=Disp.undetermined, now=now)
    row.provider_request_started_at = row.provider_request_started_at or now
    db.flush(); return row

def mark_attempt_provider_returned(db, *, job_id, job_source_id, lease_owner_id=None, lease_generation=None, now):
    _job,_rel,row=_current_attempt(db, job_id=job_id, job_source_id=job_source_id, lease_owner_id=lease_owner_id, lease_generation=lease_generation, now=now, require_processing_lease=lease_owner_id is not None, allow_cancel=True)
    _transition(row, allowed_from={Stage.provider_request_started}, to_stage=Stage.provider_response_returned, disposition=Disp.provider_result_lost, now=now)
    row.provider_response_returned_at = row.provider_response_returned_at or now
    db.flush(); return row

def classify_source_attempt_failure(db, *, job_source_id, failure_code, now, job_id=None, lease_owner_id=None, lease_generation=None):
    try:
        if job_id is not None:
            _job,_rel,row=_current_attempt(db, job_id=job_id, job_source_id=job_source_id, lease_owner_id=lease_owner_id, lease_generation=lease_generation, now=now, require_processing_lease=lease_owner_id is not None)
        else:
            row=latest_attempt(db, job_source_id)
    except RuntimeError:
        raise
    if not row: return None
    if row.retry_disposition == Disp.completed:
        return row
    code=str(failure_code or "unknown")
    row.stage=Stage.failed; row.failure_code=code; row.failed_at=row.failed_at or now; row.updated_at=now
    if code in SAFE_PROVIDER_FAILURES or (row.provider_request_started_at is None and code in PRE_PROVIDER_SAFE_FAILURES): row.retry_disposition=Disp.retry_safe
    elif code in {"output_reconciliation_required", "existing_reconciliation_case"}: row.retry_disposition=Disp.output_reconciliation_required
    elif row.provider_response_returned_at is not None: row.retry_disposition=Disp.provider_result_lost
    elif row.provider_request_started_at is not None: row.retry_disposition=Disp.provider_outcome_uncertain
    else: row.retry_disposition=Disp.non_retryable
    db.flush(); return row

def mark_attempt_google_handoff(db, *, job_source_id, now, job_id=None):
    row = _current_attempt(db, job_id=job_id, job_source_id=job_source_id)[2] if job_id else latest_attempt(db, job_source_id)
    if row:
        _transition(row, allowed_from={Stage.provider_response_returned}, to_stage=Stage.google_handoff, disposition=Disp.provider_result_lost, now=now); db.flush()
    return row

def mark_attempt_output_reconciliation_required(db, *, job_source_id, failure_code, now, job_id=None):
    row = _current_attempt(db, job_id=job_id, job_source_id=job_source_id)[2] if job_id else latest_attempt(db, job_source_id)
    if row and row.retry_disposition != Disp.completed:
        row.failure_code=str(failure_code or "output_reconciliation_required"); row.retry_disposition=Disp.output_reconciliation_required; row.updated_at=now; db.flush()
    return row

def mark_attempt_completed(db, *, job_source_id, now, job_id=None):
    row = _current_attempt(db, job_id=job_id, job_source_id=job_source_id)[2] if job_id else latest_attempt(db, job_source_id)
    if row:
        if row.stage not in {Stage.google_handoff, Stage.output_persisted, Stage.provider_response_returned}:
            raise RuntimeError("retry_state_invalid_transition")
        row.stage=Stage.output_persisted; row.retry_disposition=Disp.completed; row.completed_at=row.completed_at or now; row.updated_at=now; db.flush()
    return row

def mark_latest_attempt_completed_for_output(db, *, job_source_id, now):
    row=latest_attempt(db, job_source_id)
    if row and row.retry_disposition != Disp.completed:
        row.stage=Stage.output_persisted; row.retry_disposition=Disp.completed; row.completed_at=row.completed_at or now; row.updated_at=now; db.flush()
    return row

def _projected_queued_ready(job, *, now=None) -> bool:
    preflight = build_processing_preflight(job, now=now)
    projected = dict(preflight); projected["status"] = "queued"; projected["blocking_reasons"] = [r for r in preflight["blocking_reasons"] if r != "job_status_not_queued"]
    projected["eligible"] = not projected["blocking_reasons"]
    return bool(build_claim_readiness_from_preflight(projected)["ready_for_future_claim"])

def _evaluate(db, job, *, mode: Literal["explicit", "recovery"], now: datetime|None=None):
    attempts=int(job.attempt_count or 0)
    if job.status==JobStatus.completed: return RetryReadiness(False, RetryReason.completed, attempts, MAX_PROCESSING_ATTEMPTS, 0, 0)
    if job.cancel_requested_at or job.status==JobStatus.cancelled: return RetryReadiness(False, RetryReason.cancelled, attempts, MAX_PROCESSING_ATTEMPTS, 0, 0)
    if mode=="explicit":
        if job.status==JobStatus.queued: return RetryReadiness(True, RetryReason.available, attempts, MAX_PROCESSING_ATTEMPTS, 0, 0)
        if job.status!=JobStatus.failed: return RetryReadiness(False, RetryReason.job_not_failed, attempts, MAX_PROCESSING_ATTEMPTS, 0, 0)
        if now is not None and is_lease_active(job, now): return RetryReadiness(False, RetryReason.non_retryable, attempts, MAX_PROCESSING_ATTEMPTS, 0, 0)
    else:
        if job.status!=JobStatus.processing: return RetryReadiness(False, RetryReason.job_not_failed, attempts, MAX_PROCESSING_ATTEMPTS, 0, 0)
        if now is not None and is_lease_active(job, now): return RetryReadiness(False, RetryReason.non_retryable, attempts, MAX_PROCESSING_ATTEMPTS, 0, 0)
    rels=_required(db, job.id); missing=[]; safe=0; reason=None
    for rel in rels:
        if _has_output(db, rel.id): continue
        missing.append(rel)
        if _has_unresolved_reconciliation(db, rel.id): reason=RetryReason.output_reconciliation_required; continue
        att=current_attempt_for_relation(db, job_source_id=rel.id, attempt_number=attempts)
        if not att:
            if job.error_code in {"pipeline_retry_state_prepare_failed", "pipeline_retry_state_persistence_failed"}: safe+=1
            else: reason=reason or RetryReason.legacy_or_unknown_execution_state
        elif att.stage==Stage.prepared and att.provider_request_started_at is None: safe+=1
        elif att.retry_disposition==Disp.retry_safe and (att.provider_request_started_at is None or att.failure_code in SAFE_PROVIDER_FAILURES): safe+=1
        elif att.retry_disposition==Disp.provider_outcome_uncertain or att.stage==Stage.provider_request_started: reason=reason or RetryReason.provider_outcome_uncertain
        elif att.retry_disposition==Disp.provider_result_lost or att.stage in {Stage.provider_response_returned, Stage.google_handoff}: reason=reason or RetryReason.provider_result_lost
        elif att.retry_disposition==Disp.output_reconciliation_required: reason=reason or RetryReason.output_reconciliation_required
        else: reason=reason or RetryReason.non_retryable
    if attempts >= MAX_PROCESSING_ATTEMPTS: return RetryReadiness(False, RetryReason.attempt_limit_reached, attempts, MAX_PROCESSING_ATTEMPTS, len(missing), safe)
    if not missing: return RetryReadiness(False, RetryReason.completed, attempts, MAX_PROCESSING_ATTEMPTS, 0, safe)
    if safe==len(missing) and _projected_queued_ready(job, now=now): return RetryReadiness(True, RetryReason.available, attempts, MAX_PROCESSING_ATTEMPTS, len(missing), safe)
    return RetryReadiness(False, reason or RetryReason.prerequisites_unavailable, attempts, MAX_PROCESSING_ATTEMPTS, len(missing), safe)

def compute_explicit_retry_readiness(db, job, *, now: datetime|None=None):
    return _evaluate(db, job, mode="explicit", now=now)

def compute_expired_recovery_readiness(db, job, *, now: datetime):
    return _evaluate(db, job, mode="recovery", now=now)

def compute_retry_readiness(db, job):
    return compute_explicit_retry_readiness(db, job)

def queue_retry(db, *, owner_user_id, job_id, now):
    job=db.execute(select(TranscriptionJob).where(TranscriptionJob.id==job_id, TranscriptionJob.owner_user_id==owner_user_id).with_for_update()).scalar_one_or_none()
    if not job: return None
    ready=compute_explicit_retry_readiness(db, job, now=now)
    if job.status==JobStatus.queued:
        return RetryQueueResult(job=job, readiness=ready, transitioned=False)
    if ready.available and not is_lease_active(job, now):
        job.status=JobStatus.queued; job.finished_at=None; job.error_code=None; job.error_message=None; job.updated_at=now; invalidate_job_lease(job); db.flush()
        return RetryQueueResult(job=job, readiness=compute_explicit_retry_readiness(db, job, now=now), transitioned=True)
    return RetryQueueResult(job=job, readiness=ready, transitioned=False)

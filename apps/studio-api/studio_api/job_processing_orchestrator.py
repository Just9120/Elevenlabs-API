from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Callable

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .job_claim_lease import is_lease_active
from .job_elevenlabs_transcription import (
    JobElevenLabsTranscriptionError,
    transcribe_processing_job_source_with_elevenlabs,
)
from .job_google_docs_output import (
    JobGoogleDocsOutputError,
    JobGoogleDocsOutputReason,
    create_processing_job_google_doc_from_transcript,
)
from .job_output_persistence import persist_processing_job_source_output_and_maybe_complete
from .job_processing_lifecycle import (
    acknowledge_job_cancellation,
    begin_job_processing,
    fail_job_processing,
)
from .models import JobSourceStatus, JobStatus, TranscriptionJob, TranscriptionJobOutput, TranscriptionJobSource
from .security import utcnow


class JobProcessingOrchestrationReason(str, Enum):
    job_not_found = "job_not_found"
    job_not_processable = "job_not_processable"
    lease_not_owned = "lease_not_owned"
    lease_not_active = "lease_not_active"
    no_required_sources = "no_required_sources"
    processing_start_failed = "processing_start_failed"
    transcription_failed = "transcription_failed"
    google_docs_failed = "google_docs_failed"
    output_reconciliation_required = "output_reconciliation_required"
    incomplete_output_coverage = "incomplete_output_coverage"
    commit_failed = "commit_failed"


class JobProcessingOrchestrationError(RuntimeError):
    def __init__(self, reason: JobProcessingOrchestrationReason):
        self.reason = reason
        super().__init__(reason.value)


@dataclass(frozen=True)
class JobProcessingOrchestrationResult:
    job_id: str
    final_job_status: JobStatus
    attempt_count: int
    required_source_count: int
    persisted_output_count: int
    processed_source_count: int
    completion_occurred: bool


_UNCERTAIN_GOOGLE_REASONS = {
    JobGoogleDocsOutputReason.google_docs_timeout,
    JobGoogleDocsOutputReason.google_docs_unavailable,
    JobGoogleDocsOutputReason.malformed_google_docs_response,
    JobGoogleDocsOutputReason.lifecycle_changed_after_output_creation,
}


def orchestrate_processing_job(
    db: Session,
    *,
    job_id: str,
    lease_owner_id: str,
    lease_generation: int,
    settings,
    clock: Callable[[], datetime] | None = None,
    transcription_opener: Callable = transcribe_processing_job_source_with_elevenlabs,
    google_docs_opener: Callable = create_processing_job_google_doc_from_transcript,
    output_persister: Callable = persist_processing_job_source_output_and_maybe_complete,
) -> JobProcessingOrchestrationResult:
    clock = clock or (lambda: utcnow().replace(tzinfo=None))
    processed = 0
    _enter_processing(db, job_id, lease_owner_id, lease_generation, clock)

    required = _required_relations(db, job_id)
    if not required:
        try:
            _safe_fail(db, job_id, lease_owner_id, lease_generation, clock, "pipeline_no_required_sources", "no_required_sources")
        except Exception as exc:
            raise JobProcessingOrchestrationError(JobProcessingOrchestrationReason.no_required_sources) from exc
        raise JobProcessingOrchestrationError(JobProcessingOrchestrationReason.no_required_sources)

    for rel in required:
        outcome = _checkpoint(db, job_id, lease_owner_id, lease_generation, clock, processed)
        if outcome is not None:
            return outcome
        if _has_output(db, rel.id):
            continue

        transcript_cm = None
        google_cm = None
        artifact_created = False
        try:
            transcript_cm = transcription_opener(
                db,
                job_id=job_id,
                job_source_id=rel.id,
                lease_owner_id=lease_owner_id,
                lease_generation=lease_generation,
                settings=settings,
                now=clock(),
                clock=clock,
            )
            transcript = transcript_cm.__enter__()
        except Exception as exc:
            if transcript_cm is not None:
                transcript_cm.__exit__(type(exc), exc, exc.__traceback__)
            result = _handle_pre_output_failure(
                db,
                job_id,
                lease_owner_id,
                lease_generation,
                clock,
                "pipeline_transcription_failed",
                _safe_reason(exc),
            )
            if result is not None:
                return result
            raise JobProcessingOrchestrationError(JobProcessingOrchestrationReason.transcription_failed) from exc

        try:
            before_google = _checkpoint(db, job_id, lease_owner_id, lease_generation, clock, processed)
            if before_google is not None:
                return before_google
            try:
                google_cm = google_docs_opener(
                    db,
                    job_id=job_id,
                    job_source_id=rel.id,
                    lease_owner_id=lease_owner_id,
                    lease_generation=lease_generation,
                    transcript=transcript,
                    settings=settings,
                    now=clock(),
                    clock=clock,
                )
                artifact = google_cm.__enter__()
                artifact_created = True
            except JobGoogleDocsOutputError as exc:
                if google_cm is not None:
                    google_cm.__exit__(type(exc), exc, exc.__traceback__)
                if exc.reason == JobGoogleDocsOutputReason.output_already_persisted:
                    db.rollback()
                    existing = _after_existing_output_race(db, job_id, lease_owner_id, lease_generation, clock, processed)
                    if existing is not None:
                        return existing
                    continue
                if exc.reason in _UNCERTAIN_GOOGLE_REASONS:
                    _record_output_uncertainty(db, job_id, lease_owner_id, lease_generation, clock, exc.reason.value)
                    raise JobProcessingOrchestrationError(JobProcessingOrchestrationReason.output_reconciliation_required) from exc
                result = _handle_pre_output_failure(
                    db,
                    job_id,
                    lease_owner_id,
                    lease_generation,
                    clock,
                    "pipeline_google_docs_failed",
                    exc.reason.value,
                )
                if result is not None:
                    return result
                raise JobProcessingOrchestrationError(JobProcessingOrchestrationReason.google_docs_failed) from exc
            try:
                after_google = _checkpoint(db, job_id, lease_owner_id, lease_generation, clock, processed, after_output_side_effect=True)
                if after_google is not None:
                    _record_output_uncertainty(db, job_id, lease_owner_id, lease_generation, clock, "cancellation_requested")
                    raise JobProcessingOrchestrationError(JobProcessingOrchestrationReason.output_reconciliation_required)
                persisted = output_persister(
                    db,
                    job_id=job_id,
                    job_source_id=rel.id,
                    lease_owner_id=lease_owner_id,
                    lease_generation=lease_generation,
                    artifact=artifact,
                    now=clock(),
                )
                try:
                    _commit(db, JobProcessingOrchestrationReason.output_reconciliation_required)
                except JobProcessingOrchestrationError as exc:
                    _record_output_uncertainty(db, job_id, lease_owner_id, lease_generation, clock, "commit_failed")
                    raise
            except JobProcessingOrchestrationError:
                raise
            except Exception as exc:
                _record_output_uncertainty(db, job_id, lease_owner_id, lease_generation, clock, _safe_reason(exc))
                raise JobProcessingOrchestrationError(JobProcessingOrchestrationReason.output_reconciliation_required) from exc
            processed += 1
            if persisted.completed:
                return _result(db, job_id, processed, completed=True)
        finally:
            if google_cm is not None and artifact_created:
                google_cm.__exit__(None, None, None)
            if transcript_cm is not None:
                transcript_cm.__exit__(None, None, None)

    final = _result(db, job_id, processed, completed=False)
    if final.final_job_status == JobStatus.processing and final.persisted_output_count == final.required_source_count:
        try:
            _safe_fail(db, job_id, lease_owner_id, lease_generation, clock, "incomplete_output_coverage", "incomplete_output_coverage")
        except Exception as exc:
            raise JobProcessingOrchestrationError(JobProcessingOrchestrationReason.incomplete_output_coverage) from exc
        raise JobProcessingOrchestrationError(JobProcessingOrchestrationReason.incomplete_output_coverage)
    return final


def _enter_processing(db, job_id, owner, generation, clock) -> None:
    db.expire_all()
    job = db.get(TranscriptionJob, job_id)
    if job is None:
        raise JobProcessingOrchestrationError(JobProcessingOrchestrationReason.job_not_found)
    if job.lease_owner_id != owner or job.lease_generation != generation:
        raise JobProcessingOrchestrationError(JobProcessingOrchestrationReason.lease_not_owned)
    if not is_lease_active(job, clock()):
        raise JobProcessingOrchestrationError(JobProcessingOrchestrationReason.lease_not_active)
    if job.status == JobStatus.queued:
        try:
            begin_job_processing(db, job_id=job_id, lease_owner_id=owner, lease_generation=generation, now=clock())
            _commit(db, JobProcessingOrchestrationReason.processing_start_failed)
        except JobProcessingOrchestrationError:
            raise
        except Exception as exc:
            db.rollback()
            raise JobProcessingOrchestrationError(JobProcessingOrchestrationReason.processing_start_failed) from exc
    elif job.status == JobStatus.processing:
        return
    else:
        raise JobProcessingOrchestrationError(JobProcessingOrchestrationReason.job_not_processable)


def _checkpoint(db, job_id, owner, generation, clock, processed, *, after_output_side_effect=False):
    db.expire_all()
    job = db.get(TranscriptionJob, job_id)
    if job is None:
        raise JobProcessingOrchestrationError(JobProcessingOrchestrationReason.job_not_found)
    if job.status == JobStatus.completed:
        return _result(db, job_id, processed, completed=True)
    if job.status in {JobStatus.failed, JobStatus.cancelled}:
        return _result(db, job_id, processed, completed=False)
    if job.status != JobStatus.processing:
        raise JobProcessingOrchestrationError(JobProcessingOrchestrationReason.job_not_processable)
    if job.lease_owner_id != owner or job.lease_generation != generation:
        if after_output_side_effect:
            return None
        raise JobProcessingOrchestrationError(JobProcessingOrchestrationReason.lease_not_owned)
    if not is_lease_active(job, clock()):
        if after_output_side_effect:
            return None
        raise JobProcessingOrchestrationError(JobProcessingOrchestrationReason.lease_not_active)
    if job.cancel_requested_at is not None:
        if after_output_side_effect:
            return None
        try:
            acknowledge_job_cancellation(db, job_id=job_id, lease_owner_id=owner, lease_generation=generation, now=clock())
            _commit(db, JobProcessingOrchestrationReason.commit_failed)
        except Exception as exc:
            db.rollback()
            raise JobProcessingOrchestrationError(JobProcessingOrchestrationReason.commit_failed) from exc
        return _result(db, job_id, processed, completed=False)
    return None


def _required_relations(db, job_id):
    return tuple(db.execute(select(TranscriptionJobSource).where(TranscriptionJobSource.job_id == job_id, TranscriptionJobSource.status != JobSourceStatus.skipped).order_by(TranscriptionJobSource.position, TranscriptionJobSource.id)).scalars().all())


def _has_output(db, rel_id) -> bool:
    return db.execute(select(TranscriptionJobOutput.id).where(TranscriptionJobOutput.job_source_id == rel_id)).first() is not None


def _counts(db, job_id):
    required_ids = [r.id for r in _required_relations(db, job_id)]
    if not required_ids:
        return 0, 0
    count = db.execute(select(func.count(TranscriptionJobOutput.id)).where(TranscriptionJobOutput.job_id == job_id, TranscriptionJobOutput.job_source_id.in_(required_ids))).scalar_one()
    return len(required_ids), int(count)


def _result(db, job_id, processed, *, completed=False):
    db.expire_all()
    job = db.get(TranscriptionJob, job_id)
    if job is None:
        raise JobProcessingOrchestrationError(JobProcessingOrchestrationReason.job_not_found)
    required, persisted = _counts(db, job_id)
    return JobProcessingOrchestrationResult(job.id, job.status, job.attempt_count or 0, required, persisted, processed, completed or job.status == JobStatus.completed)


def _safe_reason(exc: BaseException) -> str:
    reason = getattr(exc, "reason", None)
    return getattr(reason, "value", None) or "unknown"


def _handle_pre_output_failure(db, job_id, owner, generation, clock, code, message):
    db.rollback()
    try:
        result = _checkpoint(db, job_id, owner, generation, clock, 0)
        if result is not None and result.final_job_status == JobStatus.cancelled:
            return result
    except JobProcessingOrchestrationError:
        raise
    try:
        _safe_fail(db, job_id, owner, generation, clock, code, message)
    except Exception:
        db.rollback()
    return None


def _safe_fail(db, job_id, owner, generation, clock, code, message):
    fail_job_processing(db, job_id=job_id, lease_owner_id=owner, lease_generation=generation, now=clock(), error_code=code, error_message=message)
    _commit(db, JobProcessingOrchestrationReason.commit_failed)


def _record_output_uncertainty(db, job_id, owner, generation, clock, message):
    db.rollback()
    try:
        db.expire_all()
        job = db.get(TranscriptionJob, job_id)
        if job is not None and job.status == JobStatus.processing and job.cancel_requested_at is None and job.lease_owner_id == owner and job.lease_generation == generation and is_lease_active(job, clock()):
            fail_job_processing(db, job_id=job_id, lease_owner_id=owner, lease_generation=generation, now=clock(), error_code="output_reconciliation_required", error_message=message)
            db.commit()
    except Exception:
        db.rollback()


def _after_existing_output_race(db, job_id, owner, generation, clock, processed):
    result = _checkpoint(db, job_id, owner, generation, clock, processed)
    if result is not None:
        return result
    return None


def _commit(db, reason):
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise JobProcessingOrchestrationError(reason) from exc

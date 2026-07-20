from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from uuid import uuid4

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .audit import audit
from .diagnostics import write_diagnostic_event
from .job_retry_recovery import compute_explicit_retry_readiness
from .models import (
    JobSourceStatus,
    JobStatus,
    Project,
    Source,
    SourceStorageCleanupStatus,
    SourceType,
    SourceUploadStatus,
    TranscriptionJob,
    TranscriptionJobSource,
)

SOURCE_CLEANUP_LEASE_TTL = timedelta(minutes=5)
SOURCE_CLEANUP_RETRY_DELAY = timedelta(minutes=10)


class SourceDeletionReason(str, Enum):
    available = "available"
    queued_job_uses_source = "queued_job_uses_source"
    processing_job_uses_source = "processing_job_uses_source"
    retryable_failed_job_uses_source = "retryable_failed_job_uses_source"
    project_unavailable = "project_unavailable"
    source_already_deleted = "source_already_deleted"
    unsupported_source_state = "unsupported_source_state"


@dataclass(frozen=True)
class SourceDeletionResult:
    ok: bool
    reason: SourceDeletionReason
    source_state: str
    storage_cleanup: str


@dataclass(frozen=True)
class SourceCleanupClaim:
    source_id: str
    owner_id: str
    generation: int
    s3_bucket: str | None
    s3_object_key: str
    attempt_count: int


def _aware(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def is_source_expired(source: Source, now: datetime) -> bool:
    return bool(source.source_type == SourceType.local_upload and source.expires_at is not None and _aware(source.expires_at) <= _aware(now))


def browser_cleanup_status(source: Source) -> str:
    status = source.storage_cleanup_status
    if status == SourceStorageCleanupStatus.not_applicable:
        return "not_applicable"
    if status == SourceStorageCleanupStatus.completed:
        return "completed"
    return "pending"


def _lock_source(db: Session, source_id: str) -> Source | None:
    return db.execute(select(Source).where(Source.id == source_id).with_for_update()).scalar_one_or_none()


def _referencing_jobs(db: Session, source_id: str, *, lock: bool) -> list[TranscriptionJob]:
    stmt = (
        select(TranscriptionJob)
        .join(TranscriptionJobSource, TranscriptionJobSource.job_id == TranscriptionJob.id)
        .where(TranscriptionJobSource.source_id == source_id, TranscriptionJobSource.status != JobSourceStatus.skipped)
        .order_by(TranscriptionJob.created_at.asc(), TranscriptionJob.id.asc())
    )
    if lock:
        stmt = stmt.with_for_update()
    return list(db.execute(stmt).scalars().all())


def _project_owner_id(db: Session, project_id: str) -> str | None:
    project = db.get(Project, project_id)
    return project.owner_user_id if project is not None else None


def deletion_readiness(db: Session, source: Source, *, now: datetime, locked_jobs: list[TranscriptionJob] | None = None) -> SourceDeletionReason:
    if source.deleted_at is not None or source.upload_status == SourceUploadStatus.deleted:
        return SourceDeletionReason.source_already_deleted
    if source.source_type not in {SourceType.local_upload, SourceType.google_drive}:
        return SourceDeletionReason.unsupported_source_state
    for job in locked_jobs if locked_jobs is not None else _referencing_jobs(db, source.id, lock=False):
        if job.status == JobStatus.queued:
            return SourceDeletionReason.queued_job_uses_source
        if job.status == JobStatus.processing:
            return SourceDeletionReason.processing_job_uses_source
        if job.status == JobStatus.failed and compute_explicit_retry_readiness(db, job, now=now).available:
            return SourceDeletionReason.retryable_failed_job_uses_source
    return SourceDeletionReason.available


def request_source_deletion(db: Session, *, owner_user_id: str, source_id: str, now: datetime) -> SourceDeletionResult | None:
    source = _lock_source(db, source_id)
    if source is None:
        return None
    project = db.get(Project, source.project_id)
    if project is None or project.owner_user_id != owner_user_id or project.archived_at is not None:
        return None
    jobs = _referencing_jobs(db, source.id, lock=True)
    already_deleted = source.deleted_at is not None or source.upload_status == SourceUploadStatus.deleted
    reason = deletion_readiness(db, source, now=now, locked_jobs=jobs)
    if reason not in {SourceDeletionReason.available, SourceDeletionReason.source_already_deleted}:
        audit(db, "source.deletion_blocked", actor_user_id=owner_user_id, subject_user_id=owner_user_id, project_id=project.id, blocker=reason.value)
        write_diagnostic_event(owner_user_id=owner_user_id, component="api", event_code="SOURCE_DELETION_BLOCKED", project_id=project.id, metadata={"blocker": reason.value, "source_type": source.source_type.value, "boundary": "source_deletion"})
        db.flush()
        return SourceDeletionResult(False, reason, source.upload_status.value, browser_cleanup_status(source))
    prior_upload_status = source.upload_status
    if not already_deleted:
        source.deleted_at = now
        source.delete_reason = "user_deleted"
        source.upload_status = SourceUploadStatus.deleted
        source.updated_at = now
    elif source.delete_reason is None:
        source.delete_reason = "user_deleted"
    if source.source_type == SourceType.google_drive:
        source.storage_cleanup_status = SourceStorageCleanupStatus.not_applicable
        source.storage_cleanup_not_before_at = None
    else:
        source.storage_cleanup_status = SourceStorageCleanupStatus.pending if source.storage_cleanup_status != SourceStorageCleanupStatus.completed else SourceStorageCleanupStatus.completed
        source.storage_cleanup_requested_at = source.storage_cleanup_requested_at or now
        not_before = now
        if prior_upload_status == SourceUploadStatus.pending and source.expires_at is not None:
            not_before = max(_aware(now), _aware(source.expires_at)).replace(tzinfo=now.tzinfo)
        source.storage_cleanup_not_before_at = source.storage_cleanup_not_before_at or not_before
        source.storage_cleanup_error_code = None
    if not already_deleted:
        audit(db, "source.deletion_requested", actor_user_id=owner_user_id, subject_user_id=owner_user_id, project_id=project.id, deletion_reason="user_deleted")
        audit(db, "source.deleted", actor_user_id=owner_user_id, subject_user_id=owner_user_id, project_id=project.id, deletion_reason="user_deleted")
        write_diagnostic_event(owner_user_id=owner_user_id, component="api", event_code="SOURCE_DELETION_REQUESTED", project_id=project.id, metadata={"source_type": source.source_type.value, "deletion_reason": "user_deleted", "boundary": "source_deletion"})
        write_diagnostic_event(owner_user_id=owner_user_id, component="api", event_code="SOURCE_DELETION_COMPLETED", project_id=project.id, metadata={"source_type": source.source_type.value, "deletion_reason": "user_deleted", "cleanup_outcome": browser_cleanup_status(source), "boundary": "source_deletion"})
    db.flush()
    return SourceDeletionResult(True, SourceDeletionReason.available, source.upload_status.value, browser_cleanup_status(source))


def mark_one_expired_source_for_cleanup(db: Session, *, now: datetime, max_scan: int = 50) -> bool:
    excluded: set[str] = set()
    src = None
    for _ in range(max_scan):
        filters = [Source.source_type == SourceType.local_upload, Source.deleted_at.is_(None), Source.expires_at.is_not(None), Source.expires_at <= now, Source.upload_status != SourceUploadStatus.expired]
        if excluded:
            filters.append(Source.id.not_in(excluded))
        candidate = db.execute(select(Source).where(*filters).order_by(Source.expires_at.asc(), Source.id.asc()).limit(1).with_for_update(skip_locked=True)).scalar_one_or_none()
        if candidate is None:
            return False
        if any(job.status == JobStatus.processing for job in _referencing_jobs(db, candidate.id, lock=True)):
            excluded.add(candidate.id)
            continue
        src = candidate
        break
    if src is None:
        return False
    src.upload_status = SourceUploadStatus.expired
    src.delete_reason = "retention_expired"
    src.storage_cleanup_status = SourceStorageCleanupStatus.pending
    src.storage_cleanup_requested_at = src.storage_cleanup_requested_at or now
    src.storage_cleanup_not_before_at = src.storage_cleanup_not_before_at or now
    src.updated_at = now
    audit(db, "source.retention_expired", project_id=src.project_id, deletion_reason="retention_expired")
    owner_id = _project_owner_id(db, src.project_id)
    if owner_id:
        write_diagnostic_event(owner_user_id=owner_id, component="worker", event_code="SOURCE_RETENTION_EXPIRED", project_id=src.project_id, metadata={"source_type": src.source_type.value, "deletion_reason": "retention_expired", "boundary": "source_cleanup"})
    db.flush()
    return True


def claim_next_source_cleanup(db: Session, *, owner_id: str, now: datetime) -> SourceCleanupClaim | None:
    owner = (owner_id or "")[:128] or f"source-cleanup-{uuid4().hex}"
    stale = or_(Source.storage_cleanup_owner_id.is_(None), Source.storage_cleanup_lease_expires_at.is_(None), Source.storage_cleanup_lease_expires_at <= now)
    excluded: set[str] = set()
    src = None
    for _ in range(50):
        filters = [
            Source.source_type == SourceType.local_upload,
            Source.storage_cleanup_status.in_([SourceStorageCleanupStatus.pending, SourceStorageCleanupStatus.failed]),
            Source.storage_cleanup_not_before_at <= now,
            stale,
            or_(Source.deleted_at.is_not(None), Source.expires_at <= now),
        ]
        if excluded:
            filters.append(Source.id.not_in(excluded))
        candidate = db.execute(select(Source).where(*filters).order_by(Source.storage_cleanup_not_before_at.asc(), Source.created_at.asc(), Source.id.asc()).limit(1).with_for_update(skip_locked=True)).scalar_one_or_none()
        if candidate is None:
            return None
        if any(job.status == JobStatus.processing for job in _referencing_jobs(db, candidate.id, lock=True)):
            excluded.add(candidate.id)
            continue
        src = candidate
        break
    if src is None:
        return None
    src.storage_cleanup_generation = int(src.storage_cleanup_generation or 0) + 1
    src.storage_cleanup_owner_id = owner
    src.storage_cleanup_claimed_at = now
    src.storage_cleanup_lease_expires_at = now + SOURCE_CLEANUP_LEASE_TTL
    src.storage_cleanup_attempt_count = int(src.storage_cleanup_attempt_count or 0) + 1
    src.storage_cleanup_status = SourceStorageCleanupStatus.pending
    src.storage_cleanup_error_code = None
    owner_user_id = _project_owner_id(db, src.project_id)
    if owner_user_id:
        write_diagnostic_event(owner_user_id=owner_user_id, component="worker", event_code="SOURCE_STORAGE_CLEANUP_STARTED", project_id=src.project_id, metadata={"source_type": src.source_type.value, "cleanup_attempt": src.storage_cleanup_attempt_count, "boundary": "source_cleanup"})
    db.flush()
    return SourceCleanupClaim(src.id, owner, src.storage_cleanup_generation, src.s3_bucket, src.s3_object_key or "", src.storage_cleanup_attempt_count)


def finalize_source_cleanup(db: Session, *, claim: SourceCleanupClaim, now: datetime, success: bool, error_code: str | None = None) -> bool:
    src = _lock_source(db, claim.source_id)
    if src is None or src.storage_cleanup_owner_id != claim.owner_id or src.storage_cleanup_generation != claim.generation:
        return False
    if success:
        src.storage_cleanup_status = SourceStorageCleanupStatus.completed
        src.storage_cleanup_completed_at = now
        src.storage_cleanup_error_code = None
        src.s3_bucket = None
        src.s3_object_key = None
        audit(db, "source.storage_cleanup_completed", project_id=src.project_id, cleanup_outcome="completed", cleanup_attempt=src.storage_cleanup_attempt_count)
        owner_user_id = _project_owner_id(db, src.project_id)
        if owner_user_id:
            write_diagnostic_event(owner_user_id=owner_user_id, component="worker", event_code="SOURCE_STORAGE_CLEANUP_COMPLETED", project_id=src.project_id, metadata={"cleanup_outcome": "completed", "cleanup_attempt": src.storage_cleanup_attempt_count, "boundary": "source_cleanup"})
    else:
        src.storage_cleanup_status = SourceStorageCleanupStatus.failed
        src.storage_cleanup_error_code = error_code if error_code in {"storage_unavailable", "storage_delete_failed"} else "storage_delete_failed"
        src.storage_cleanup_not_before_at = now + SOURCE_CLEANUP_RETRY_DELAY
        audit(db, "source.storage_cleanup_failed", project_id=src.project_id, cleanup_outcome="failed", cleanup_attempt=src.storage_cleanup_attempt_count)
        owner_user_id = _project_owner_id(db, src.project_id)
        if owner_user_id:
            write_diagnostic_event(owner_user_id=owner_user_id, component="worker", event_code="SOURCE_STORAGE_CLEANUP_FAILED", project_id=src.project_id, metadata={"cleanup_outcome": "failed", "cleanup_attempt": src.storage_cleanup_attempt_count, "boundary": "source_cleanup"})
    src.storage_cleanup_owner_id = None
    src.storage_cleanup_claimed_at = None
    src.storage_cleanup_lease_expires_at = None
    src.updated_at = now
    db.flush()
    return True


def run_one_source_cleanup(db: Session, *, settings, owner_id: str, now: datetime, storage_factory=None, should_stop=None) -> bool:
    if should_stop and should_stop():
        return False
    mark_one_expired_source_for_cleanup(db, now=now)
    db.commit()
    if should_stop and should_stop():
        return False
    claim = claim_next_source_cleanup(db, owner_id=owner_id, now=now)
    if claim is None:
        db.rollback()
        return False
    db.commit()
    ok = True
    code = None
    try:
        if claim.s3_bucket and claim.s3_object_key:
            (storage_factory or __import__("studio_api.source_storage", fromlist=["get_source_storage"]).get_source_storage)(settings).delete_object(claim.s3_object_key, bucket=claim.s3_bucket)
    except Exception as exc:
        ok = False
        code = "storage_unavailable" if type(exc).__name__ in {"SourceStorageError", "EndpointConnectionError"} else "storage_delete_failed"
    finalize_source_cleanup(db, claim=claim, now=now, success=ok, error_code=code)
    db.commit()
    return True

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from .google_docs_output import GoogleDocsOutputError, GoogleDocsOutputReason, GoogleDocsTranscriptArtifact
from .job_claim_lease import invalidate_job_lease, is_lease_active
from .models import JobSourceStatus, JobStatus, Project, SourceUploadStatus, TranscriptionJob, TranscriptionJobOutput, TranscriptionJobSource

GOOGLE_DOCS_TRANSCRIPT_OUTPUT_KIND = "google_docs_transcript"
TRANSCRIPT_STANDARD = "transcript_doc_v1.2"


class JobOutputPersistenceReason(str, Enum):
    job_not_found = "job_not_found"
    job_not_processing = "job_not_processing"
    lease_not_owned = "lease_not_owned"
    lease_not_active = "lease_not_active"
    cancellation_requested = "cancellation_requested"
    project_unavailable = "project_unavailable"
    output_folder_changed = "output_folder_changed"
    job_source_not_found = "job_source_not_found"
    job_source_not_processable = "job_source_not_processable"
    artifact_context_closed = "artifact_context_closed"
    output_already_persisted = "output_already_persisted"
    output_conflict = "output_conflict"
    persistence_failure = "persistence_failure"


class JobOutputPersistenceError(RuntimeError):
    def __init__(self, reason: JobOutputPersistenceReason):
        self.reason = reason
        super().__init__(reason.value)


@dataclass(frozen=True)
class JobOutputPersistenceResult:
    job_id: str
    job_source_id: str
    output_id: str = field(repr=False)
    job_status: JobStatus
    persisted_output_count: int
    required_output_count: int
    completed: bool
    lease_generation: int


def persist_processing_job_source_output_and_maybe_complete(
    db: Session,
    *,
    job_id: str,
    job_source_id: str,
    lease_owner_id: str,
    lease_generation: int,
    artifact: GoogleDocsTranscriptArtifact,
    now: datetime,
) -> JobOutputPersistenceResult:
    try:
        document_id = artifact.document_id
        web_view_url = artifact.web_view_link
        output_folder_id = artifact.output_folder_id
    except GoogleDocsOutputError as exc:
        if exc.reason == GoogleDocsOutputReason.context_closed:
            raise JobOutputPersistenceError(JobOutputPersistenceReason.artifact_context_closed) from exc
        raise

    job = db.execute(select(TranscriptionJob).where(TranscriptionJob.id == job_id).with_for_update()).scalar_one_or_none()
    if job is None:
        raise JobOutputPersistenceError(JobOutputPersistenceReason.job_not_found)
    _require_job_boundary(db, job, lease_owner_id, lease_generation, now)
    project = _require_project(db, job)
    if project.output_drive_folder_id != output_folder_id:
        raise JobOutputPersistenceError(JobOutputPersistenceReason.output_folder_changed)
    rel = db.execute(select(TranscriptionJobSource).options(selectinload(TranscriptionJobSource.source)).where(TranscriptionJobSource.id == job_source_id)).scalar_one_or_none()
    if rel is None or rel.job_id != job.id:
        raise JobOutputPersistenceError(JobOutputPersistenceReason.job_source_not_found)
    if rel.status == JobSourceStatus.skipped:
        raise JobOutputPersistenceError(JobOutputPersistenceReason.job_source_not_processable)
    if rel.source is None or rel.source.project_id != job.project_id or rel.source.upload_status != SourceUploadStatus.uploaded or rel.source.deleted_at is not None:
        raise JobOutputPersistenceError(JobOutputPersistenceReason.job_source_not_processable)

    existing = db.execute(select(TranscriptionJobOutput).where(TranscriptionJobOutput.job_source_id == job_source_id)).scalar_one_or_none()
    if existing is None:
        output = TranscriptionJobOutput(
            job_id=job.id,
            job_source_id=rel.id,
            document_id=document_id,
            web_view_url=web_view_url,
            output_drive_folder_id=output_folder_id,
            output_kind=GOOGLE_DOCS_TRANSCRIPT_OUTPUT_KIND,
            transcript_standard=TRANSCRIPT_STANDARD,
            document_character_count=artifact.character_count,
            document_created_at=artifact.created_at,
            persisted_at=now,
            lease_generation=lease_generation,
        )
        db.add(output)
        try:
            db.flush()
        except IntegrityError as exc:
            raise JobOutputPersistenceError(JobOutputPersistenceReason.output_conflict) from exc
    else:
        output = existing
        if not _same_output(existing, document_id, web_view_url, output_folder_id, artifact, lease_generation):
            raise JobOutputPersistenceError(JobOutputPersistenceReason.output_conflict)

    required_ids = [row[0] for row in db.execute(select(TranscriptionJobSource.id).where(TranscriptionJobSource.job_id == job.id, TranscriptionJobSource.status != JobSourceStatus.skipped)).all()]
    persisted_count = db.execute(select(func.count(TranscriptionJobOutput.id)).where(TranscriptionJobOutput.job_id == job.id, TranscriptionJobOutput.job_source_id.in_(required_ids or ["__none__"]))).scalar_one()
    required_count = len(required_ids)
    completed = required_count > 0 and persisted_count == required_count
    if completed:
        _require_job_boundary(db, job, lease_owner_id, lease_generation, now)
        job.status = JobStatus.completed
        job.finished_at = now
        job.updated_at = now
        job.error_code = None
        job.error_message = None
        invalidate_job_lease(job)
        db.flush()
    return JobOutputPersistenceResult(job.id, rel.id, output.id, job.status, int(persisted_count), required_count, completed, lease_generation)


def _require_job_boundary(db: Session, job: TranscriptionJob, owner: str, generation: int, now: datetime) -> None:
    if job.status != JobStatus.processing:
        raise JobOutputPersistenceError(JobOutputPersistenceReason.job_not_processing)
    if job.lease_owner_id != owner or job.lease_generation != generation:
        raise JobOutputPersistenceError(JobOutputPersistenceReason.lease_not_owned)
    if not is_lease_active(job, now):
        raise JobOutputPersistenceError(JobOutputPersistenceReason.lease_not_active)
    if job.cancel_requested_at is not None:
        raise JobOutputPersistenceError(JobOutputPersistenceReason.cancellation_requested)


def _require_project(db: Session, job: TranscriptionJob) -> Project:
    project = db.get(Project, job.project_id)
    if project is None or project.owner_user_id != job.owner_user_id or project.archived_at is not None or not project.output_drive_folder_id:
        raise JobOutputPersistenceError(JobOutputPersistenceReason.project_unavailable)
    return project


def _same_output(existing: TranscriptionJobOutput, document_id: str, web_view_url: str, output_folder_id: str, artifact: GoogleDocsTranscriptArtifact, generation: int) -> bool:
    return (
        existing.document_id == document_id
        and existing.web_view_url == web_view_url
        and existing.output_drive_folder_id == output_folder_id
        and existing.output_kind == GOOGLE_DOCS_TRANSCRIPT_OUTPUT_KIND
        and existing.transcript_standard == TRANSCRIPT_STANDARD
        and existing.document_character_count == artifact.character_count
        and existing.document_created_at == artifact.created_at
        and existing.lease_generation == generation
    )

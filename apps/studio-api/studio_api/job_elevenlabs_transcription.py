from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Callable, Iterator

from sqlalchemy.orm import Session

from .elevenlabs_transcription import (
    ElevenLabsTranscriptResult,
    ElevenLabsTranscriptionError,
    ElevenLabsTranscriptionReason,
    ElevenLabsTranscriptionTransport,
)
from .job_claim_lease import is_lease_active
from .job_execution_context import (
    JobExecutionContextError,
    ProcessingJobExecutionPrerequisites,
    open_processing_job_execution_prerequisites,
)
from .job_output_destination import _load_snapshot as _load_output_snapshot
from .job_source_materialization import (
    MaterializedJobSource,
    SourceMaterializationError,
    _load_selected_snapshot,
    materialize_processing_job_source,
)
from .models import CredentialStatus, JobStatus, Project, ProviderCredential, ProviderCredentialVersion, TranscriptionJob
from .security import utcnow
from .source_storage import safe_filename


class JobElevenLabsTranscriptionReason(str, Enum):
    provider_mismatch = "provider_mismatch"
    prerequisites_unavailable = "prerequisites_unavailable"
    source_materialization_unavailable = "source_materialization_unavailable"
    lifecycle_changed_before_provider_call = "lifecycle_changed_before_provider_call"
    credential_or_output_identity_changed_before_provider_call = "credential_or_output_identity_changed_before_provider_call"
    provider_authentication_rejected = "provider_authentication_rejected"
    provider_request_rejected = "provider_request_rejected"
    provider_rate_limited = "provider_rate_limited"
    provider_unavailable = "provider_unavailable"
    provider_timeout = "provider_timeout"
    malformed_provider_response = "malformed_provider_response"
    lifecycle_changed_after_provider_call = "lifecycle_changed_after_provider_call"
    context_closed = "context_closed"


class JobElevenLabsTranscriptionError(RuntimeError):
    def __init__(self, reason: JobElevenLabsTranscriptionReason):
        self.reason = reason
        super().__init__(reason.value)


@dataclass(frozen=True)
class _LifecycleSnapshot:
    job_id: str
    owner_user_id: str
    project_id: str
    lease_owner_id: str | None
    lease_generation: int
    lease_expires_at: datetime | None
    cancel_requested_at: datetime | None
    project_archived_at: datetime | None


@contextmanager
def transcribe_processing_job_source_with_elevenlabs(
    db: Session,
    *,
    job_id: str,
    job_source_id: str,
    lease_owner_id: str,
    lease_generation: int,
    settings,
    now: datetime | None = None,
    clock: Callable[[], datetime] | None = None,
    prerequisites_opener: Callable = open_processing_job_execution_prerequisites,
    source_materializer: Callable = materialize_processing_job_source,
    elevenlabs_transport: ElevenLabsTranscriptionTransport | Callable[..., ElevenLabsTranscriptResult] | None = None,
    **kwargs,
) -> Iterator[ElevenLabsTranscriptResult]:
    clock = clock or (lambda: utcnow().replace(tzinfo=None))
    transport = elevenlabs_transport or ElevenLabsTranscriptionTransport()
    result: ElevenLabsTranscriptResult | None = None
    try:
        try:
            prereq_cm = prerequisites_opener(
                db,
                job_id=job_id,
                lease_owner_id=lease_owner_id,
                lease_generation=lease_generation,
                settings=settings,
                now=now,
                clock=clock,
                **kwargs,
            )
            prereq: ProcessingJobExecutionPrerequisites = prereq_cm.__enter__()
        except JobExecutionContextError as exc:
            raise JobElevenLabsTranscriptionError(JobElevenLabsTranscriptionReason.prerequisites_unavailable) from exc
        try:
            if prereq.provider != "elevenlabs":
                raise JobElevenLabsTranscriptionError(JobElevenLabsTranscriptionReason.provider_mismatch)
            try:
                source_cm = source_materializer(
                    db,
                    job_id=job_id,
                    job_source_id=job_source_id,
                    lease_owner_id=lease_owner_id,
                    lease_generation=lease_generation,
                    settings=settings,
                    now=now,
                    clock=clock,
                    **_source_kwargs(kwargs),
                )
                source: MaterializedJobSource = source_cm.__enter__()
            except SourceMaterializationError as exc:
                raise JobElevenLabsTranscriptionError(JobElevenLabsTranscriptionReason.source_materialization_unavailable) from exc
            try:
                language = _final_pre_provider_revalidate(db, job_id, job_source_id, lease_owner_id, lease_generation, settings, clock(), prereq, source)
                try:
                    result = _call_transport(
                        transport,
                        api_key=prereq.raw_credential_secret,
                        stream=source.stream,
                        filename=safe_filename(source.original_filename),
                        mime_type=source.mime_type,
                        language_code=language,
                    )
                except ElevenLabsTranscriptionError as exc:
                    raise JobElevenLabsTranscriptionError(_map_provider_reason(exc.reason)) from exc
                _post_provider_lifecycle_revalidate(db, job_id, lease_owner_id, lease_generation, clock())
                yield result
            finally:
                source_cm.__exit__(None, None, None)
        finally:
            prereq_cm.__exit__(None, None, None)
    finally:
        if result is not None:
            result.revoke()


def _source_kwargs(kwargs):
    allowed = {"storage_factory", "drive_token_resolver", "drive_content_fetcher", "drive_metadata_fetcher"}
    return {k: v for k, v in kwargs.items() if k in allowed}


def _call_transport(transport, **kwargs):
    if hasattr(transport, "transcribe"):
        return transport.transcribe(**kwargs)
    return transport(**kwargs)


def _final_pre_provider_revalidate(
    db, job_id, job_source_id, owner, generation, settings, now, prereq, source
) -> str | None:
    try:
        cred_snap = _load_credential_db_only(db, job_id, owner, generation, now, settings)
        out_snap = _load_output_snapshot(db, job_id, owner, generation, now)
        src_snap = _load_selected_snapshot(db, job_id, job_source_id, owner, generation, now, settings)
    except JobElevenLabsTranscriptionError:
        raise
    except Exception as exc:
        raise JobElevenLabsTranscriptionError(JobElevenLabsTranscriptionReason.lifecycle_changed_before_provider_call) from exc
    credential_identity_changed = (
        cred_snap["provider"] != "elevenlabs"
        or cred_snap["credential_id"] != getattr(prereq, "_credential").credential_id
        or cred_snap["version_id"] != prereq.credential_version_id
    )
    if credential_identity_changed or out_snap.output_drive_folder_id != prereq.output_drive_folder_id:
        raise JobElevenLabsTranscriptionError(
            JobElevenLabsTranscriptionReason.credential_or_output_identity_changed_before_provider_call
        )
    if src_snap.job_source_id != source.identity.job_source_id or src_snap.source_id != source.identity.source_id:
        raise JobElevenLabsTranscriptionError(JobElevenLabsTranscriptionReason.lifecycle_changed_before_provider_call)
    return cred_snap["language"]


def _load_credential_db_only(db, job_id, owner, generation, now, settings):
    db.expire_all()
    job = db.get(TranscriptionJob, job_id)
    lifecycle_changed = (
        job is None
        or job.status != JobStatus.processing
        or job.lease_owner_id != owner
        or job.lease_generation != generation
        or not is_lease_active(job, now)
        or job.cancel_requested_at is not None
    )
    if lifecycle_changed:
        raise JobElevenLabsTranscriptionError(JobElevenLabsTranscriptionReason.lifecycle_changed_before_provider_call)
    project = db.get(Project, job.project_id)
    if project is None or project.owner_user_id != job.owner_user_id or project.archived_at is not None:
        raise JobElevenLabsTranscriptionError(JobElevenLabsTranscriptionReason.lifecycle_changed_before_provider_call)
    cred = db.get(ProviderCredential, job.provider_credential_id) if job.provider_credential_id else None
    if cred is None or cred.user_id != job.owner_user_id or cred.status != CredentialStatus.active or cred.deleted_at is not None:
        raise JobElevenLabsTranscriptionError(
            JobElevenLabsTranscriptionReason.credential_or_output_identity_changed_before_provider_call
        )
    provider = str(getattr(cred.provider, "value", cred.provider))
    if provider != "elevenlabs" or (job.provider is not None and job.provider != provider):
        raise JobElevenLabsTranscriptionError(
            JobElevenLabsTranscriptionReason.credential_or_output_identity_changed_before_provider_call
        )
    ver = db.get(ProviderCredentialVersion, cred.active_version_id) if cred.active_version_id else None
    credential_unusable = (
        ver is None
        or ver.credential_id != cred.id
        or ver.revoked_at is not None
        or ver.deleted_at is not None
        or not ver.ciphertext
        or not ver.nonce
        or ver.key_id != settings.credential_key_id
    )
    if credential_unusable:
        raise JobElevenLabsTranscriptionError(
            JobElevenLabsTranscriptionReason.credential_or_output_identity_changed_before_provider_call
        )
    return {"credential_id": cred.id, "version_id": ver.id, "provider": provider, "language": job.language}


def _post_provider_lifecycle_revalidate(db, job_id, owner, generation, now) -> None:
    try:
        snap = _load_lifecycle(db, job_id, owner, generation, now)
    except Exception as exc:
        raise JobElevenLabsTranscriptionError(JobElevenLabsTranscriptionReason.lifecycle_changed_after_provider_call) from exc
    if snap.cancel_requested_at is not None:
        raise JobElevenLabsTranscriptionError(JobElevenLabsTranscriptionReason.lifecycle_changed_after_provider_call)


def _load_lifecycle(db, job_id, owner, generation, now) -> _LifecycleSnapshot:
    db.expire_all()
    job = db.get(TranscriptionJob, job_id)
    lifecycle_changed = (
        job is None
        or job.status != JobStatus.processing
        or job.lease_owner_id != owner
        or job.lease_generation != generation
        or not is_lease_active(job, now)
    )
    if lifecycle_changed:
        raise JobElevenLabsTranscriptionError(JobElevenLabsTranscriptionReason.lifecycle_changed_after_provider_call)
    project = db.get(Project, job.project_id)
    if project is None or project.owner_user_id != job.owner_user_id or project.archived_at is not None:
        raise JobElevenLabsTranscriptionError(JobElevenLabsTranscriptionReason.lifecycle_changed_after_provider_call)
    return _LifecycleSnapshot(
        job.id,
        job.owner_user_id,
        job.project_id,
        job.lease_owner_id,
        job.lease_generation,
        job.lease_expires_at,
        job.cancel_requested_at,
        project.archived_at,
    )


def _map_provider_reason(reason: ElevenLabsTranscriptionReason) -> JobElevenLabsTranscriptionReason:
    return JobElevenLabsTranscriptionReason(reason.value)

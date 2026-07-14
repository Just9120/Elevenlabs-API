from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from pathlib import PurePath
from typing import Callable, Iterator, Protocol

from sqlalchemy.orm import Session

from .elevenlabs_transcription import ElevenLabsTranscriptionError
from .google_connection_access import GoogleConnectionAccessError, refresh_user_google_drive_access_token
from .google_docs_output import (
    GoogleDocsOutputError,
    GoogleDocsOutputReason,
    GoogleDocsTranscriptArtifact,
    GoogleDocsTranscriptTransport,
    new_google_docs_transcript_artifact,
)
from .job_claim_lease import is_lease_active
from .job_output_destination import DriveFolderAuthorizationMetadata, OutputDestinationError, _fetch_drive_folder_authorization_metadata, _validate_metadata
from .job_source_materialization import SourceMaterializationError, _load_selected_snapshot
from .models import JobStatus, Project, TranscriptionJob, TranscriptionJobOutput
from .security import utcnow


class TranscriptResultProtocol(Protocol):
    text_length: int
    detected_language_code: str | None
    @property
    def text(self) -> str: ...


class JobGoogleDocsOutputReason(str, Enum):
    job_not_found = "job_not_found"
    job_not_processing = "job_not_processing"
    lease_not_owned = "lease_not_owned"
    lease_not_active = "lease_not_active"
    cancellation_requested = "cancellation_requested"
    project_unavailable = "project_unavailable"
    output_folder_missing = "output_folder_missing"
    google_connection_unavailable = "google_connection_unavailable"
    output_folder_unavailable = "output_folder_unavailable"
    output_identity_mismatch = "output_identity_mismatch"
    output_not_folder = "output_not_folder"
    output_folder_not_writable = "output_folder_not_writable"
    job_source_not_found = "job_source_not_found"
    job_source_not_processable = "job_source_not_processable"
    selected_source_changed = "selected_source_changed"
    lifecycle_changed_before_output_creation = "lifecycle_changed_before_output_creation"
    output_identity_changed_before_output_creation = "output_identity_changed_before_output_creation"
    transcript_context_closed = "transcript_context_closed"
    google_docs_authentication_rejected = "google_docs_authentication_rejected"
    google_docs_request_rejected = "google_docs_request_rejected"
    google_docs_rate_limited = "google_docs_rate_limited"
    google_docs_unavailable = "google_docs_unavailable"
    google_docs_timeout = "google_docs_timeout"
    malformed_google_docs_response = "malformed_google_docs_response"
    lifecycle_changed_after_output_creation = "lifecycle_changed_after_output_creation"
    context_closed = "context_closed"
    output_already_persisted = "output_already_persisted"


class JobGoogleDocsOutputError(RuntimeError):
    def __init__(self, reason: JobGoogleDocsOutputReason):
        self.reason = reason
        super().__init__(reason.value)


@dataclass(frozen=True)
class FormattedTranscriptDocument:
    title: str
    body: str
    language: str
    created_at: datetime


@dataclass(frozen=True)
class _OutputJobSnapshot:
    job_id: str
    owner_user_id: str
    project_id: str
    title: str | None
    language: str | None
    output_drive_folder_id: str
    lease_owner_id: str | None
    lease_generation: int
    lease_expires_at: datetime | None
    cancel_requested_at: datetime | None
    project_archived_at: datetime | None
    project_owner_user_id: str | None


@contextmanager
def create_processing_job_google_doc_from_transcript(
    db: Session,
    *,
    job_id: str,
    job_source_id: str,
    lease_owner_id: str,
    lease_generation: int,
    transcript: TranscriptResultProtocol,
    settings,
    now: datetime | None = None,
    clock: Callable[[], datetime] | None = None,
    token_resolver: Callable = refresh_user_google_drive_access_token,
    metadata_fetcher: Callable[[str, str], DriveFolderAuthorizationMetadata] | None = None,
    google_docs_transport: GoogleDocsTranscriptTransport | Callable[..., object] | None = None,
) -> Iterator[GoogleDocsTranscriptArtifact]:
    clock = clock or (lambda: utcnow().replace(tzinfo=None))
    check_now = now or clock()
    artifact: GoogleDocsTranscriptArtifact | None = None
    _require_no_persisted_output(db, job_source_id)
    snap = _load_output_job_snapshot(db, job_id, lease_owner_id, lease_generation, check_now)
    source_snap = _load_source_snapshot(db, job_id, job_source_id, lease_owner_id, lease_generation, check_now, settings)
    try:
        try:
            token = token_resolver(db, user_id=snap.owner_user_id, settings=settings)
        except GoogleConnectionAccessError as exc:
            raise JobGoogleDocsOutputError(JobGoogleDocsOutputReason.google_connection_unavailable) from exc
        try:
            meta = metadata_fetcher(token, snap.output_drive_folder_id) if metadata_fetcher else _fetch_drive_folder_authorization_metadata(token, snap.output_drive_folder_id)
            _validate_metadata(meta, snap.output_drive_folder_id)
        except OutputDestinationError as exc:
            raise JobGoogleDocsOutputError(_map_output_folder_reason(exc.reason.value)) from exc
        except Exception as exc:
            raise JobGoogleDocsOutputError(JobGoogleDocsOutputReason.output_folder_unavailable) from exc
        _compare_or_before(_load_output_job_snapshot(db, job_id, lease_owner_id, lease_generation, clock()), snap)
        _compare_source_or_before(_load_source_snapshot(db, job_id, job_source_id, lease_owner_id, lease_generation, clock(), settings), source_snap)
        try:
            transcript_text = transcript.text
        except (ElevenLabsTranscriptionError, GoogleDocsOutputError) as exc:
            raise JobGoogleDocsOutputError(JobGoogleDocsOutputReason.transcript_context_closed) from exc
        title = choose_transcript_document_title(job_title=snap.title, original_filename=source_snap.original_filename)
        created_at = clock()
        formatted = format_transcript_doc_v1_2(
            title=title,
            transcript_text=transcript_text,
            job_language=snap.language,
            detected_language_code=transcript.detected_language_code,
            created_at=created_at,
        )
        _compare_or_before(_load_output_job_snapshot(db, job_id, lease_owner_id, lease_generation, clock()), snap)
        _compare_source_or_before(_load_source_snapshot(db, job_id, job_source_id, lease_owner_id, lease_generation, clock(), settings), source_snap)
        _require_no_persisted_output(db, job_source_id)
        transport = google_docs_transport or GoogleDocsTranscriptTransport()
        try:
            result = _call_transport(transport, access_token=token, folder_id=snap.output_drive_folder_id, title=formatted.title, document_text=formatted.body)
        except GoogleDocsOutputError as exc:
            raise JobGoogleDocsOutputError(_map_docs_reason(exc.reason)) from exc
        # PWA-OUTPUT-01B intentionally owns persistence/reconciliation of this irreversible output side effect.
        try:
            _compare_or_after(_load_output_job_snapshot(db, job_id, lease_owner_id, lease_generation, clock()), snap)
            _compare_source_or_after(_load_source_snapshot(db, job_id, job_source_id, lease_owner_id, lease_generation, clock(), settings), source_snap)
        except Exception as exc:
            raise JobGoogleDocsOutputError(JobGoogleDocsOutputReason.lifecycle_changed_after_output_creation) from exc
        artifact = new_google_docs_transcript_artifact(result=result, created_at=clock(), character_count=len(formatted.body))
        yield artifact
    finally:
        if artifact is not None:
            artifact.revoke()


def format_transcript_doc_v1_2(*, title: str, transcript_text: str, job_language: str | None, detected_language_code: str | None, created_at: datetime) -> FormattedTranscriptDocument:
    safe_title = normalize_document_title(title)
    lang = _first_nonblank(job_language, detected_language_code) or "unknown"
    ts = _utc_iso(created_at)
    body = f"{safe_title}\n\nTranscript metadata\nProvider: ElevenLabs\nModel: scribe_v2\nLanguage: {lang}\nSpeakers: no\nCreated at: {ts}\n\nTranscript\n\n{transcript_text}"
    return FormattedTranscriptDocument(title=safe_title, body=body, language=lang, created_at=created_at)


def choose_transcript_document_title(*, job_title: str | None, original_filename: str | None) -> str:
    candidate = _first_nonblank(job_title)
    if candidate is None and original_filename:
        name = PurePath(original_filename).name.strip()
        stem = PurePath(name).stem.strip() if name else ""
        candidate = stem or name
    return normalize_document_title(candidate or "Transcript")


def normalize_document_title(value: str) -> str:
    cleaned = " ".join(value.replace("\x00", " ").split())
    return cleaned[:160] if cleaned else "Transcript"


def _load_output_job_snapshot(db: Session, job_id: str, owner: str, generation: int, now: datetime) -> _OutputJobSnapshot:
    db.expire_all()
    job = db.get(TranscriptionJob, job_id)
    if job is None:
        raise JobGoogleDocsOutputError(JobGoogleDocsOutputReason.job_not_found)
    if job.status != JobStatus.processing:
        raise JobGoogleDocsOutputError(JobGoogleDocsOutputReason.job_not_processing)
    if job.lease_owner_id != owner or job.lease_generation != generation:
        raise JobGoogleDocsOutputError(JobGoogleDocsOutputReason.lease_not_owned)
    if not is_lease_active(job, now):
        raise JobGoogleDocsOutputError(JobGoogleDocsOutputReason.lease_not_active)
    if job.cancel_requested_at is not None:
        raise JobGoogleDocsOutputError(JobGoogleDocsOutputReason.cancellation_requested)
    project = db.get(Project, job.project_id)
    if project is None or project.owner_user_id != job.owner_user_id or project.archived_at is not None:
        raise JobGoogleDocsOutputError(JobGoogleDocsOutputReason.project_unavailable)
    if not job.output_drive_folder_id:
        raise JobGoogleDocsOutputError(JobGoogleDocsOutputReason.output_folder_missing)
    return _OutputJobSnapshot(job.id, job.owner_user_id, project.id, job.title, job.language, job.output_drive_folder_id, job.lease_owner_id, job.lease_generation, job.lease_expires_at, job.cancel_requested_at, project.archived_at, project.owner_user_id)


def _load_source_snapshot(db, job_id, job_source_id, owner, generation, now, settings):
    try:
        return _load_selected_snapshot(db, job_id, job_source_id, owner, generation, now, settings)
    except SourceMaterializationError as exc:
        value = exc.reason.value
        mapped = {
            "job_source_not_found": JobGoogleDocsOutputReason.job_source_not_found,
            "job_source_not_processable": JobGoogleDocsOutputReason.job_source_not_processable,
            "selected_source_changed": JobGoogleDocsOutputReason.selected_source_changed,
            "job_not_processing": JobGoogleDocsOutputReason.job_not_processing,
            "lease_not_owned": JobGoogleDocsOutputReason.lease_not_owned,
            "lease_not_active": JobGoogleDocsOutputReason.lease_not_active,
            "cancellation_requested": JobGoogleDocsOutputReason.cancellation_requested,
        }.get(value, JobGoogleDocsOutputReason.lifecycle_changed_before_output_creation)
        raise JobGoogleDocsOutputError(mapped) from exc


def _compare_or_before(current, expected) -> None:
    if current != expected:
        if current.output_drive_folder_id != expected.output_drive_folder_id:
            raise JobGoogleDocsOutputError(JobGoogleDocsOutputReason.output_identity_changed_before_output_creation)
        raise JobGoogleDocsOutputError(JobGoogleDocsOutputReason.lifecycle_changed_before_output_creation)


def _compare_source_or_before(current, expected) -> None:
    if current != expected:
        raise JobGoogleDocsOutputError(JobGoogleDocsOutputReason.lifecycle_changed_before_output_creation)


def _compare_or_after(current, expected) -> None:
    if current != expected:
        raise JobGoogleDocsOutputError(JobGoogleDocsOutputReason.lifecycle_changed_after_output_creation)


def _compare_source_or_after(current, expected) -> None:
    if current != expected:
        raise JobGoogleDocsOutputError(JobGoogleDocsOutputReason.lifecycle_changed_after_output_creation)


def _call_transport(transport, **kwargs):
    if hasattr(transport, "create_transcript_document"):
        return transport.create_transcript_document(**kwargs)
    return transport(**kwargs)


def _map_output_folder_reason(value: str) -> JobGoogleDocsOutputReason:
    return {
        "output_identity_mismatch": JobGoogleDocsOutputReason.output_identity_mismatch,
        "output_not_folder": JobGoogleDocsOutputReason.output_not_folder,
        "output_folder_not_writable": JobGoogleDocsOutputReason.output_folder_not_writable,
        "metadata_unavailable": JobGoogleDocsOutputReason.output_folder_unavailable,
        "output_folder_missing": JobGoogleDocsOutputReason.output_folder_missing,
    }.get(value, JobGoogleDocsOutputReason.output_folder_unavailable)


def _map_docs_reason(reason: GoogleDocsOutputReason) -> JobGoogleDocsOutputReason:
    return {
        GoogleDocsOutputReason.authentication_rejected: JobGoogleDocsOutputReason.google_docs_authentication_rejected,
        GoogleDocsOutputReason.request_rejected: JobGoogleDocsOutputReason.google_docs_request_rejected,
        GoogleDocsOutputReason.rate_limited: JobGoogleDocsOutputReason.google_docs_rate_limited,
        GoogleDocsOutputReason.unavailable: JobGoogleDocsOutputReason.google_docs_unavailable,
        GoogleDocsOutputReason.timeout: JobGoogleDocsOutputReason.google_docs_timeout,
        GoogleDocsOutputReason.malformed_response: JobGoogleDocsOutputReason.malformed_google_docs_response,
        GoogleDocsOutputReason.context_closed: JobGoogleDocsOutputReason.context_closed,
    }[reason]


def _first_nonblank(*values: str | None) -> str | None:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _utc_iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")



def _require_no_persisted_output(db: Session, job_source_id: str) -> None:
    if db.query(TranscriptionJobOutput.id).filter(TranscriptionJobOutput.job_source_id == job_source_id).first() is not None:
        raise JobGoogleDocsOutputError(JobGoogleDocsOutputReason.output_already_persisted)

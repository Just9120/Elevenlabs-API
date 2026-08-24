from __future__ import annotations

import json
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from enum import Enum

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session, selectinload

from .audio_preparation import MAX_AUDIO_INPUTS, AudioPreparationOptions, normalize_options
from .models import (
    AudioPreparationJob,
    AudioPreparationJobInput,
    AudioPreparationStatus,
    Project,
    Source,
    SourceType,
    SourceUploadStatus,
)
from .source_policy import is_source_expired, is_supported_source_mime_type
from .source_storage import normalize_source_display_filename


EPHEMERAL_REFERENCE_TTL = timedelta(hours=24)
TERMINAL_AUDIO_PREPARATION_STATUSES = {
    AudioPreparationStatus.completed,
    AudioPreparationStatus.failed,
    AudioPreparationStatus.cancelled,
}
CLAIMABLE_AUDIO_PREPARATION_STATUSES = {
    AudioPreparationStatus.preview_queued,
    AudioPreparationStatus.queued,
    AudioPreparationStatus.analyzing,
    AudioPreparationStatus.processing,
}


class AudioPreparationServiceReason(str, Enum):
    not_found = "not_found"
    project_unavailable = "project_unavailable"
    invalid_sources = "invalid_sources"
    source_unavailable = "source_unavailable"
    invalid_state = "invalid_state"
    invalid_destination = "invalid_destination"
    lease_unavailable = "lease_unavailable"
    cancellation_requested = "cancellation_requested"


class AudioPreparationServiceError(RuntimeError):
    def __init__(self, reason: AudioPreparationServiceReason):
        self.reason = reason
        super().__init__(reason.value)


def create_audio_preparation_job(
    db: Session,
    *,
    owner_user_id: str,
    project_id: str,
    title: str,
    source_ids: list[str],
    ephemeral_source_ids: set[str],
    manual_order: bool,
    options_payload: dict[str, object],
    output_destination: str,
    output_folder: object | None,
    now: datetime,
) -> AudioPreparationJob:
    project = _owned_project(db, owner_user_id, project_id)
    clean_title = normalize_source_display_filename(title, max_length=160).rsplit(".", 1)[0].strip()
    if not clean_title:
        raise AudioPreparationServiceError(AudioPreparationServiceReason.invalid_sources)
    if not source_ids or len(source_ids) > MAX_AUDIO_INPUTS or len(source_ids) != len(set(source_ids)):
        raise AudioPreparationServiceError(AudioPreparationServiceReason.invalid_sources)
    if not ephemeral_source_ids.issubset(set(source_ids)):
        raise AudioPreparationServiceError(AudioPreparationServiceReason.invalid_sources)
    sources = list(db.execute(select(Source).where(Source.id.in_(source_ids))).scalars().all())
    by_id = {source.id: source for source in sources}
    if len(by_id) != len(source_ids):
        raise AudioPreparationServiceError(AudioPreparationServiceReason.source_unavailable)
    ordered = [by_id[source_id] for source_id in source_ids]
    for source in ordered:
        if not _source_available(source, project_id=project.id, now=now):
            raise AudioPreparationServiceError(AudioPreparationServiceReason.source_unavailable)
        if source.id in ephemeral_source_ids:
            if source.source_type is not SourceType.local_upload:
                raise AudioPreparationServiceError(AudioPreparationServiceReason.invalid_sources)
            hard_expiry = _naive_utc(now) + EPHEMERAL_REFERENCE_TTL
            if source.expires_at is None or _naive_utc(source.expires_at) > hard_expiry:
                source.expires_at = hard_expiry
    if not manual_order:
        ordered.sort(key=lambda source: (_creation_sort_key(source), source.original_filename.casefold(), source.id))
    options = normalize_options(options_payload)
    destination, folder_snapshot = _destination_snapshot(output_destination, output_folder)
    job = AudioPreparationJob(
        project_id=project.id,
        owner_user_id=owner_user_id,
        status=AudioPreparationStatus.preview_queued,
        title=clean_title,
        options_json=serialize_options(options),
        output_destination=destination,
        output_drive_folder_id=folder_snapshot[0],
        output_drive_folder_url=folder_snapshot[1],
        output_drive_folder_name=folder_snapshot[2],
        current_stage="preview_queued",
        progress_percent=0,
    )
    db.add(job)
    db.flush()
    for position, source in enumerate(ordered):
        db.add(
            AudioPreparationJobInput(
                job_id=job.id,
                source_id=source.id,
                position=position,
                ephemeral_reference=source.id in ephemeral_source_ids,
            )
        )
    db.flush()
    db.refresh(job)
    return load_owned_audio_preparation_job(db, owner_user_id=owner_user_id, job_id=job.id)


def load_owned_audio_preparation_job(db: Session, *, owner_user_id: str, job_id: str) -> AudioPreparationJob:
    job = db.execute(
        select(AudioPreparationJob)
        .options(selectinload(AudioPreparationJob.inputs).selectinload(AudioPreparationJobInput.source))
        .where(AudioPreparationJob.id == job_id, AudioPreparationJob.owner_user_id == owner_user_id)
    ).scalar_one_or_none()
    if job is None:
        raise AudioPreparationServiceError(AudioPreparationServiceReason.not_found)
    return job


def list_owned_audio_preparation_jobs(
    db: Session, *, owner_user_id: str, project_id: str, limit: int = 50
) -> list[AudioPreparationJob]:
    _owned_project(db, owner_user_id, project_id)
    return list(
        db.execute(
            select(AudioPreparationJob)
            .options(selectinload(AudioPreparationJob.inputs).selectinload(AudioPreparationJobInput.source))
            .where(
                AudioPreparationJob.owner_user_id == owner_user_id,
                AudioPreparationJob.project_id == project_id,
            )
            .order_by(AudioPreparationJob.created_at.desc(), AudioPreparationJob.id.desc())
            .limit(max(1, min(limit, 100)))
        ).scalars().all()
    )


def start_audio_preparation_job(
    db: Session, *, owner_user_id: str, job_id: str
) -> AudioPreparationJob:
    job = _locked_owned_job(db, owner_user_id, job_id)
    if job.status is not AudioPreparationStatus.preview_ready:
        raise AudioPreparationServiceError(AudioPreparationServiceReason.invalid_state)
    job.status = AudioPreparationStatus.queued
    job.current_stage = "queued"
    job.progress_percent = 0
    job.error_code = None
    job.lease_owner_id = None
    job.lease_expires_at = None
    db.flush()
    return job


def cancel_audio_preparation_job(
    db: Session, *, owner_user_id: str, job_id: str, now: datetime
) -> AudioPreparationJob:
    job = _locked_owned_job(db, owner_user_id, job_id)
    if job.status in TERMINAL_AUDIO_PREPARATION_STATUSES:
        return job
    job.cancel_requested_at = _naive_utc(now)
    if job.status in {
        AudioPreparationStatus.preview_queued,
        AudioPreparationStatus.preview_ready,
        AudioPreparationStatus.queued,
    }:
        job.status = AudioPreparationStatus.cancelled
        job.current_stage = "cancelled"
        job.cancelled_at = _naive_utc(now)
        job.finished_at = _naive_utc(now)
        job.lease_owner_id = None
        job.lease_expires_at = None
    db.flush()
    return job


def claim_next_audio_preparation_job(
    db: Session,
    *,
    lease_owner_id: str,
    now: datetime,
    lease_ttl: timedelta,
) -> AudioPreparationJob | None:
    owner = lease_owner_id.strip() if isinstance(lease_owner_id, str) else ""
    if not owner or len(owner) > 128 or lease_ttl <= timedelta(0) or lease_ttl > timedelta(hours=24):
        raise AudioPreparationServiceError(AudioPreparationServiceReason.lease_unavailable)
    claimable = tuple(CLAIMABLE_AUDIO_PREPARATION_STATUSES)
    active = (AudioPreparationStatus.analyzing, AudioPreparationStatus.processing)
    job = db.execute(
        select(AudioPreparationJob)
        .options(selectinload(AudioPreparationJob.inputs).selectinload(AudioPreparationJobInput.source))
        .where(
            AudioPreparationJob.status.in_(claimable),
            or_(
                AudioPreparationJob.status.not_in(active),
                and_(
                    AudioPreparationJob.status.in_(active),
                    or_(
                        AudioPreparationJob.lease_owner_id.is_(None),
                        AudioPreparationJob.lease_expires_at.is_(None),
                        AudioPreparationJob.lease_expires_at <= _naive_utc(now),
                    ),
                ),
            ),
        )
        .order_by(AudioPreparationJob.created_at.asc(), AudioPreparationJob.id.asc())
        .limit(1)
        .with_for_update(skip_locked=True)
    ).scalar_one_or_none()
    if job is None:
        return None
    job.lease_generation = (job.lease_generation or 0) + 1
    job.lease_owner_id = owner
    job.claimed_at = _naive_utc(now)
    job.lease_expires_at = _naive_utc(now + lease_ttl)
    if job.status in {AudioPreparationStatus.preview_queued, AudioPreparationStatus.analyzing}:
        job.status = AudioPreparationStatus.analyzing
        job.current_stage = "validating"
        job.progress_percent = 5
    else:
        job.status = AudioPreparationStatus.processing
        job.current_stage = "materializing"
        job.progress_percent = 5
        job.started_at = job.started_at or _naive_utc(now)
    db.flush()
    return job


def complete_audio_preview(
    db: Session,
    *,
    job_id: str,
    lease_owner_id: str,
    lease_generation: int,
    total_input_duration_ms: int,
    estimated_output_duration_ms: int,
    copy_compatible: bool,
) -> AudioPreparationJob:
    job = _locked_leased_job(db, job_id, lease_owner_id, lease_generation)
    if job.status is not AudioPreparationStatus.analyzing:
        raise AudioPreparationServiceError(AudioPreparationServiceReason.invalid_state)
    job.total_input_duration_ms = total_input_duration_ms
    job.estimated_output_duration_ms = estimated_output_duration_ms
    job.copy_compatible = copy_compatible
    job.status = AudioPreparationStatus.preview_ready
    job.current_stage = "preview_ready"
    job.progress_percent = 100
    job.lease_owner_id = None
    job.lease_expires_at = None
    db.flush()
    return job


def fail_audio_preparation_job(
    db: Session,
    *,
    job_id: str,
    lease_owner_id: str,
    lease_generation: int,
    error_code: str,
    now: datetime,
) -> AudioPreparationJob:
    job = _locked_leased_job(db, job_id, lease_owner_id, lease_generation)
    job.status = AudioPreparationStatus.failed
    job.current_stage = "failed"
    job.error_code = (error_code or "processing_failed")[:80]
    job.finished_at = _naive_utc(now)
    job.lease_owner_id = None
    job.lease_expires_at = None
    db.flush()
    return job


def finalize_cancelled_audio_preparation_job(
    db: Session,
    *,
    job_id: str,
    lease_owner_id: str,
    lease_generation: int,
    now: datetime,
) -> AudioPreparationJob:
    job = _locked_leased_job(db, job_id, lease_owner_id, lease_generation)
    if job.cancel_requested_at is None:
        raise AudioPreparationServiceError(AudioPreparationServiceReason.invalid_state)
    job.status = AudioPreparationStatus.cancelled
    job.current_stage = "cancelled"
    job.cancelled_at = _naive_utc(now)
    job.finished_at = _naive_utc(now)
    job.lease_owner_id = None
    job.lease_expires_at = None
    db.flush()
    return job


def renew_audio_preparation_lease(
    db: Session,
    *,
    job_id: str,
    lease_owner_id: str,
    lease_generation: int,
    now: datetime,
    lease_ttl: timedelta,
) -> AudioPreparationJob:
    job = _locked_leased_job(db, job_id, lease_owner_id, lease_generation)
    if job.status not in {AudioPreparationStatus.analyzing, AudioPreparationStatus.processing}:
        raise AudioPreparationServiceError(AudioPreparationServiceReason.lease_unavailable)
    if job.lease_expires_at is None or _naive_utc(job.lease_expires_at) <= _naive_utc(now):
        raise AudioPreparationServiceError(AudioPreparationServiceReason.lease_unavailable)
    job.lease_expires_at = _naive_utc(now + lease_ttl)
    db.flush()
    return job


def audio_preparation_payload(job: AudioPreparationJob) -> dict[str, object]:
    status = _value(job.status)
    return {
        "id": job.id,
        "project_id": job.project_id,
        "status": status,
        "title": job.title,
        "options": json.loads(job.options_json),
        "output_destination": job.output_destination,
        "output_folder": (
            {
                "name": job.output_drive_folder_name,
                "web_view_url": job.output_drive_folder_url,
            }
            if job.output_destination == "google_drive"
            else None
        ),
        "input_count": len(job.inputs),
        "inputs": [
            {
                "position": item.position,
                "filename": item.source.original_filename,
                "source_type": _value(item.source.source_type),
                "ephemeral_reference": bool(item.ephemeral_reference),
            }
            for item in job.inputs
        ],
        "preview": (
            {
                "input_duration_seconds": job.total_input_duration_ms / 1000,
                "estimated_output_duration_seconds": job.estimated_output_duration_ms / 1000,
                "copy_compatible": bool(job.copy_compatible),
            }
            if job.total_input_duration_ms is not None
            and job.estimated_output_duration_ms is not None
            and job.copy_compatible is not None
            else None
        ),
        "progress": {
            "percent": job.progress_percent,
            "stage": job.current_stage,
        },
        "output": (
            {
                "download_ready": job.output_source_id is not None,
                "source_id": job.output_source_id,
                "google_drive_url": job.output_drive_web_view_url,
                "duration_seconds": job.output_duration_ms / 1000 if job.output_duration_ms else None,
            }
            if job.output_source_id is not None
            else None
        ),
        "error_code": job.error_code,
        "cancel_requested": job.cancel_requested_at is not None,
        "created_at": _iso(job.created_at),
        "updated_at": _iso(job.updated_at),
        "finished_at": _iso(job.finished_at),
    }


def serialize_options(options: AudioPreparationOptions) -> str:
    payload = asdict(options)
    payload["output_format"] = options.output_format.value
    payload["mono_mode"] = options.mono_mode.value
    payload["preset"] = options.preset.value
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def deserialize_options(job: AudioPreparationJob) -> AudioPreparationOptions:
    try:
        payload = json.loads(job.options_json)
    except (TypeError, json.JSONDecodeError) as exc:
        raise AudioPreparationServiceError(AudioPreparationServiceReason.invalid_state) from exc
    return normalize_options(payload)


def _owned_project(db: Session, owner_user_id: str, project_id: str) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.owner_user_id != owner_user_id or project.archived_at is not None:
        raise AudioPreparationServiceError(AudioPreparationServiceReason.project_unavailable)
    return project


def _locked_owned_job(db: Session, owner_user_id: str, job_id: str) -> AudioPreparationJob:
    job = db.execute(
        select(AudioPreparationJob)
        .where(AudioPreparationJob.id == job_id, AudioPreparationJob.owner_user_id == owner_user_id)
        .with_for_update()
    ).scalar_one_or_none()
    if job is None:
        raise AudioPreparationServiceError(AudioPreparationServiceReason.not_found)
    return job


def _locked_leased_job(db: Session, job_id: str, owner: str, generation: int) -> AudioPreparationJob:
    job = db.execute(select(AudioPreparationJob).where(AudioPreparationJob.id == job_id).with_for_update()).scalar_one_or_none()
    if job is None:
        raise AudioPreparationServiceError(AudioPreparationServiceReason.not_found)
    if job.lease_owner_id != owner or job.lease_generation != generation:
        raise AudioPreparationServiceError(AudioPreparationServiceReason.lease_unavailable)
    return job


def _source_available(source: Source, *, project_id: str, now: datetime) -> bool:
    return bool(
        source.project_id == project_id
        and source.source_type in {SourceType.local_upload, SourceType.google_drive}
        and source.upload_status is SourceUploadStatus.uploaded
        and source.deleted_at is None
        and not is_source_expired(source.expires_at, now)
        and is_supported_source_mime_type(source.mime_type)
    )


def _destination_snapshot(destination: str, folder: object | None) -> tuple[str, tuple[str | None, str | None, str | None]]:
    if destination == "download":
        if folder is not None:
            raise AudioPreparationServiceError(AudioPreparationServiceReason.invalid_destination)
        return destination, (None, None, None)
    if destination != "google_drive" or folder is None:
        raise AudioPreparationServiceError(AudioPreparationServiceReason.invalid_destination)
    folder_id = getattr(folder, "folder_id", None) or getattr(folder, "id", None)
    folder_url = getattr(folder, "folder_url", None) or getattr(folder, "web_view_url", None)
    folder_name = getattr(folder, "folder_name", None) or getattr(folder, "name", None) or "Папка Google Drive"
    if not all(isinstance(value, str) and value.strip() for value in (folder_id, folder_url, folder_name)):
        raise AudioPreparationServiceError(AudioPreparationServiceReason.invalid_destination)
    return destination, (folder_id.strip(), folder_url.strip(), folder_name.strip())


def _creation_sort_key(source: Source) -> tuple[int, datetime]:
    if source.source_created_at is not None:
        return (0, _naive_utc(source.source_created_at))
    return (1, datetime.max)


def _naive_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return _naive_utc(value).replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


def _value(value) -> str:
    return str(getattr(value, "value", value))

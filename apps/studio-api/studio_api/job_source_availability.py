from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Callable

from sqlalchemy.orm import Session, selectinload

from .google_connection_access import GoogleConnectionAccessError, refresh_user_google_drive_access_token
from .google_drive import GOOGLE_FOLDER_MIME_TYPE, GoogleDriveMetadataError, GoogleDriveMetadataReason, fetch_drive_file_metadata
from .job_claim_lease import is_lease_active
from .models import JobStatus, Project, Source, SourceType, SourceUploadStatus, TranscriptionJob, TranscriptionJobSource
from .source_policy import is_supported_source_mime_type, normalize_source_mime_type, validate_source_size
from .source_storage import get_source_storage


@dataclass(frozen=True)
class ProcessingSourceAvailabilitySourceSummary:
    source_id: str | None
    position: int
    source_type: str | None
    original_filename: str | None
    mime_type: str | None
    size_bytes: int | None
    available: bool
    blocking_reasons: list[str]


@dataclass(frozen=True)
class ProcessingSourceAvailabilitySummary:
    job_id: str
    project_id: str | None
    verified_at: datetime
    lease_generation: int
    ready: bool
    blocking_reasons: list[str]
    sources: list[ProcessingSourceAvailabilitySourceSummary]


def verify_processing_job_sources(
    db: Session,
    *,
    job_id: str,
    lease_owner_id: str,
    lease_generation: int,
    now: datetime,
    settings,
    storage_factory: Callable = get_source_storage,
    drive_token_resolver: Callable = refresh_user_google_drive_access_token,
    drive_metadata_fetcher: Callable = fetch_drive_file_metadata,
) -> ProcessingSourceAvailabilitySummary:
    job = _load_job(db, job_id)
    initial_reasons = _job_boundary_reasons(job, lease_owner_id, lease_generation, now)
    project = db.get(Project, job.project_id) if job else None
    if job and (project is None or project.owner_user_id != job.owner_user_id):
        initial_reasons.append("project_missing")
    if project and project.archived_at is not None:
        initial_reasons.append("project_archived")
    job_sources = sorted(job.sources, key=lambda item: item.position) if job else []
    if job and not job_sources:
        initial_reasons.append("job_has_no_sources")

    if initial_reasons:
        return _summary(job_id, job.project_id if job else None, now, lease_generation, initial_reasons, [])

    boundary_snapshot = _boundary_snapshot(job, project, job_sources)
    snapshots = [_snapshot(job, js) for js in job_sources]
    token: str | None = None
    token_failed_reason: str | None = None
    source_summaries: list[ProcessingSourceAvailabilitySourceSummary] = []
    for snap in snapshots:
        reasons = list(snap["reasons"])
        if not validate_source_size(snap["size_bytes"], settings.source_max_upload_bytes):
            reasons.append("source_too_large")
        effective_mime = snap["mime_type"]
        effective_size = snap["size_bytes"]
        if not reasons:
            if snap["source_type"] == SourceType.local_upload.value:
                mime, size, more = _verify_local(snap, now, settings, storage_factory)
                effective_mime = mime if mime is not None else effective_mime
                effective_size = size if size is not None else effective_size
                reasons.extend(more)
            elif snap["source_type"] == SourceType.google_drive.value:
                if token is None and token_failed_reason is None:
                    try:
                        token = drive_token_resolver(db, user_id=job.owner_user_id, settings=settings)
                    except GoogleConnectionAccessError as exc:
                        token_failed_reason = "google_token_unavailable" if exc.reason.value == "google_config_unavailable" else exc.reason.value
                    except Exception:
                        token_failed_reason = "google_token_unavailable"
                if token_failed_reason:
                    reasons.append(token_failed_reason)
                else:
                    mime, size, more = _verify_drive(snap, token, settings, drive_metadata_fetcher)
                    effective_mime = mime if mime is not None else effective_mime
                    effective_size = size if size is not None else effective_size
                    reasons.extend(more)
            else:
                reasons.append("unsupported_source_type")
        source_summaries.append(_source_summary(snap, effective_mime, effective_size, reasons))

    recheck_reasons, source_state_changed = _revalidate(db, boundary_snapshot, lease_owner_id, lease_generation, now)
    if source_state_changed:
        source_summaries = [_with_extra_reason(s, "source_state_changed") for s in source_summaries]
    all_reasons = _dedupe([r for s in source_summaries for r in s.blocking_reasons] + recheck_reasons)
    return _summary(job.id, job.project_id, now, lease_generation, all_reasons, source_summaries)


def _load_job(db: Session, job_id: str):
    return db.query(TranscriptionJob).options(selectinload(TranscriptionJob.sources).selectinload(TranscriptionJobSource.source)).filter(TranscriptionJob.id == job_id).first()


def _job_boundary_reasons(job, owner, generation, now):
    if job is None:
        return ["job_not_found"]
    reasons = []
    if job.status != JobStatus.processing:
        reasons.append("job_not_processing")
    if job.lease_owner_id != owner or job.lease_generation != generation:
        reasons.append("lease_not_owned")
    if not is_lease_active(job, now):
        reasons.append("lease_not_active")
    if job.cancel_requested_at is not None:
        reasons.append("cancellation_requested")
    return reasons


def _snapshot(job, js):
    src = js.source
    reasons = []
    if src is None:
        return {"source_id": None, "position": js.position, "source_type": None, "original_filename": None, "mime_type": None, "size_bytes": None, "reasons": ["source_missing"]}
    source_type = str(src.source_type.value)
    mime = normalize_source_mime_type(src.mime_type)
    if src.project_id != job.project_id:
        reasons.append("source_project_mismatch")
    if src.deleted_at is not None or src.upload_status == SourceUploadStatus.deleted:
        reasons.append("source_deleted")
    if src.upload_status != SourceUploadStatus.uploaded:
        reasons.append("source_not_uploaded")
    if source_type not in {SourceType.local_upload.value, SourceType.google_drive.value}:
        reasons.append("unsupported_source_type")
    if not is_supported_source_mime_type(mime):
        reasons.append("unsupported_mime_type")
    return {"source_id": src.id, "position": js.position, "source_type": source_type, "original_filename": src.original_filename, "mime_type": mime, "size_bytes": src.size_bytes, "project_id": src.project_id, "upload_status": str(src.upload_status.value), "deleted_at": src.deleted_at, "expires_at": src.expires_at, "s3_bucket": src.s3_bucket, "s3_object_key": src.s3_object_key, "drive_file_id": src.drive_file_id, "reasons": reasons}


def _verify_local(snap, now, settings, storage_factory):
    reasons = []
    if snap["expires_at"] is not None and snap["expires_at"] <= now:
        reasons.append("source_expired")
    if not snap["s3_bucket"] or not snap["s3_object_key"]:
        reasons.append("source_missing_required_identity")
    if not settings.source_storage_configured():
        reasons.append("source_storage_not_configured")
    if snap["s3_bucket"] != settings.source_s3_bucket:
        reasons.append("source_bucket_mismatch")
    if reasons:
        return None, None, reasons
    try:
        head = storage_factory(settings).head_object(snap["s3_object_key"])
    except FileNotFoundError:
        return None, None, ["storage_object_missing"]
    except Exception:
        return None, None, ["external_metadata_unavailable"]
    actual_mime = normalize_source_mime_type(head.content_type) or snap["mime_type"]
    actual_size = head.size_bytes if head.size_bytes is not None else snap["size_bytes"]
    if not is_supported_source_mime_type(actual_mime):
        reasons.append("unsupported_mime_type")
    if not validate_source_size(actual_size, settings.source_max_upload_bytes):
        reasons.append("source_too_large")
    if snap["size_bytes"] is not None and head.size_bytes is not None and snap["size_bytes"] != head.size_bytes:
        reasons.append("source_size_mismatch")
    if snap["mime_type"] and head.content_type and snap["mime_type"] != actual_mime:
        reasons.append("source_mime_mismatch")
    return actual_mime, actual_size, reasons


def _verify_drive(snap, token, settings, fetcher):
    if not snap["drive_file_id"]:
        return None, None, ["source_missing_required_identity"]
    try:
        meta = fetcher(token, snap["drive_file_id"])
    except GoogleDriveMetadataError as exc:
        if exc.reason == GoogleDriveMetadataReason.not_found:
            return None, None, ["drive_file_missing"]
        return None, None, ["drive_metadata_unavailable"]
    except FileNotFoundError:
        return None, None, ["drive_file_missing"]
    except Exception:
        return None, None, ["drive_metadata_unavailable"]
    reasons = []
    mime = normalize_source_mime_type(meta.mime_type)
    if meta.id != snap["drive_file_id"]:
        reasons.append("drive_file_identity_mismatch")
    if getattr(meta, "is_folder", False) or mime == GOOGLE_FOLDER_MIME_TYPE:
        reasons.append("drive_file_is_folder")
    if not is_supported_source_mime_type(mime):
        reasons.append("unsupported_mime_type")
    if not validate_source_size(meta.size_bytes, settings.source_max_upload_bytes):
        reasons.append("source_too_large")
    return mime, meta.size_bytes, reasons


def _boundary_snapshot(job, project, job_sources):
    return {
        "job": {
            "id": job.id,
            "owner_user_id": job.owner_user_id,
            "project_id": job.project_id,
            "status": _enum_value(job.status),
            "lease_owner_id": job.lease_owner_id,
            "lease_generation": job.lease_generation,
            "lease_expires_at": job.lease_expires_at,
            "cancel_requested_at": job.cancel_requested_at,
        },
        "project": {
            "id": project.id if project else None,
            "owner_user_id": project.owner_user_id if project else None,
            "archived_at": project.archived_at if project else None,
        },
        "relations": [_relation_source_identity(js) for js in sorted(job_sources, key=lambda item: item.position)],
    }


def _relation_source_identity(job_source):
    src = job_source.source
    return {
        "job_source_id": job_source.id,
        "source_id": job_source.source_id,
        "position": job_source.position,
        "job_source_status": _enum_value(job_source.status),
        "source_type": _enum_value(src.source_type) if src else None,
        "project_id": src.project_id if src else None,
        "drive_file_id": src.drive_file_id if src else None,
        "s3_bucket": src.s3_bucket if src else None,
        "s3_object_key": src.s3_object_key if src else None,
        "mime_type": normalize_source_mime_type(src.mime_type) if src else None,
        "size_bytes": src.size_bytes if src else None,
        "upload_status": _enum_value(src.upload_status) if src else None,
        "deleted_at": src.deleted_at if src else None,
        "expires_at": src.expires_at if src else None,
    }


def _revalidate(db, snapshot, owner, generation, now):
    db.expire_all()
    job = _load_job(db, snapshot["job"]["id"])
    lifecycle_reasons = _job_boundary_reasons(job, owner, generation, now)
    if job is None:
        return lifecycle_reasons, True

    project = db.get(Project, job.project_id)
    if project is None or project.owner_user_id != job.owner_user_id:
        lifecycle_reasons.append("project_missing")
    elif project.archived_at is not None:
        lifecycle_reasons.append("project_archived")

    current_boundary = _current_job_project_snapshot(job, project)
    expected_boundary = snapshot["job"] | {
        "project_owner_user_id": snapshot["project"]["owner_user_id"],
        "project_archived_at": snapshot["project"]["archived_at"],
    }
    if current_boundary != expected_boundary:
        if _job_or_project_identity_changed(job, project, snapshot):
            lifecycle_reasons.append("project_missing")
        if job.lease_expires_at != snapshot["job"]["lease_expires_at"] and "lease_not_active" not in lifecycle_reasons:
            lifecycle_reasons.append("lease_not_active")

    current_relations = [_relation_source_identity(js) for js in sorted(job.sources, key=lambda item: item.position)]
    source_state_changed = current_relations != snapshot["relations"]
    if not source_state_changed:
        for relation in current_relations:
            if relation["upload_status"] != SourceUploadStatus.uploaded.value:
                source_state_changed = True
                break
            if relation["deleted_at"] is not None:
                source_state_changed = True
                break
            if relation["expires_at"] is not None and relation["expires_at"] <= now:
                source_state_changed = True
                break
    if source_state_changed and "source_state_changed" not in lifecycle_reasons:
        return _dedupe(lifecycle_reasons + ["source_state_changed"]), True
    return _dedupe(lifecycle_reasons), False


def _current_job_project_snapshot(job, project):
    return {
        "id": job.id,
        "owner_user_id": job.owner_user_id,
        "project_id": job.project_id,
        "status": _enum_value(job.status),
        "lease_owner_id": job.lease_owner_id,
        "lease_generation": job.lease_generation,
        "lease_expires_at": job.lease_expires_at,
        "cancel_requested_at": job.cancel_requested_at,
        "project_owner_user_id": project.owner_user_id if project else None,
        "project_archived_at": project.archived_at if project else None,
    }


def _job_or_project_identity_changed(job, project, snapshot):
    return (
        job.owner_user_id != snapshot["job"]["owner_user_id"]
        or job.project_id != snapshot["job"]["project_id"]
        or project is None
        or project.owner_user_id != snapshot["project"]["owner_user_id"]
    )


def _enum_value(value):
    return str(getattr(value, "value", value))


def _source_summary(snap, mime, size, reasons):
    deduped = _dedupe(reasons)
    return ProcessingSourceAvailabilitySourceSummary(snap["source_id"], snap["position"], snap["source_type"], snap["original_filename"], normalize_source_mime_type(mime), size, not deduped, deduped)


def _with_extra_reason(summary, reason):
    reasons = _dedupe(summary.blocking_reasons + [reason])
    return ProcessingSourceAvailabilitySourceSummary(summary.source_id, summary.position, summary.source_type, summary.original_filename, summary.mime_type, summary.size_bytes, False, reasons)


def _summary(job_id, project_id, now, generation, reasons, sources):
    deduped = _dedupe(reasons)
    return ProcessingSourceAvailabilitySummary(job_id, project_id, now, generation, not deduped, deduped, sources)


def _dedupe(values):
    out = []
    for value in values:
        if value not in out:
            out.append(value)
    return out

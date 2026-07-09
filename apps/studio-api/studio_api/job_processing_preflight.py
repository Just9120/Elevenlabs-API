from __future__ import annotations

from typing import Any, TypedDict


QUEUED_JOB_STATUS = "queued"
GOOGLE_DRIVE_SOURCE_TYPE = "google_drive"
LOCAL_UPLOAD_SOURCE_TYPE = "local_upload"
UPLOADED_SOURCE_STATUS = "uploaded"
DELETED_SOURCE_STATUS = "deleted"


class PreflightSourceSummary(TypedDict):
    source_id: str | None
    source_type: str | None
    upload_status: str | None
    project_matches_job: bool
    is_deleted: bool
    has_required_identity: bool
    is_uploaded: bool
    ready: bool
    blocking_reasons: list[str]


class ProcessingPreflightSummary(TypedDict):
    job_id: str
    project_id: str
    status: str
    eligible: bool
    blocking_reasons: list[str]
    sources: list[PreflightSourceSummary]
    provider_credential_present: bool
    output_folder_configured: bool


def build_processing_preflight(job: Any) -> ProcessingPreflightSummary:
    """Build a read-only, safe metadata snapshot for future job processing.

    The snapshot is deliberately conservative. It does not claim, mutate, or
    process the job; does not access source bytes; does not decrypt or inspect
    provider credentials; and omits private storage identities such as object
    keys and presigned URLs.

    The helper intentionally uses only duck-typed ORM attributes so importing
    this module stays side-effect free in unit tests and does not initialize the
    database/settings layer.
    """

    job_status = _enum_value(job.status)
    blocking_reasons: list[str] = []
    if job_status != QUEUED_JOB_STATUS:
        blocking_reasons.append("job_status_not_queued")

    ordered_job_sources = sorted(job.sources, key=lambda item: item.position)
    if not ordered_job_sources:
        blocking_reasons.append("job_has_no_sources")

    source_summaries = [_summarize_source(job, job_source) for job_source in ordered_job_sources]
    for source_summary in source_summaries:
        for reason in source_summary["blocking_reasons"]:
            if reason not in blocking_reasons:
                blocking_reasons.append(reason)

    return {
        "job_id": job.id,
        "project_id": job.project_id,
        "status": job_status,
        "eligible": not blocking_reasons,
        "blocking_reasons": blocking_reasons,
        "sources": source_summaries,
        "provider_credential_present": bool(job.provider_credential_id),
        "output_folder_configured": _project_output_folder_configured(job),
    }


def _summarize_source(job: Any, job_source: Any) -> PreflightSourceSummary:
    source = job_source.source
    blocking_reasons: list[str] = []

    if source is None:
        return {
            "source_id": None,
            "source_type": None,
            "upload_status": None,
            "project_matches_job": False,
            "is_deleted": False,
            "has_required_identity": False,
            "is_uploaded": False,
            "ready": False,
            "blocking_reasons": ["source_missing"],
        }

    source_type = _enum_value(source.source_type)
    upload_status = _enum_value(source.upload_status)
    project_matches_job = source.project_id == job.project_id
    if not project_matches_job:
        blocking_reasons.append("source_project_mismatch")

    is_deleted = source.deleted_at is not None or upload_status == DELETED_SOURCE_STATUS
    if is_deleted:
        blocking_reasons.append("source_deleted")

    is_uploaded = upload_status == UPLOADED_SOURCE_STATUS
    if not is_uploaded:
        blocking_reasons.append("source_not_uploaded")

    has_required_identity = _source_has_required_identity(source, source_type)
    if not has_required_identity:
        blocking_reasons.append("source_missing_required_identity")

    return {
        "source_id": source.id,
        "source_type": source_type,
        "upload_status": upload_status,
        "project_matches_job": project_matches_job,
        "is_deleted": is_deleted,
        "has_required_identity": has_required_identity,
        "is_uploaded": is_uploaded,
        "ready": not blocking_reasons,
        "blocking_reasons": blocking_reasons,
    }


def _source_has_required_identity(source: Any, source_type: str) -> bool:
    if source_type == GOOGLE_DRIVE_SOURCE_TYPE:
        return bool(source.drive_file_id)
    if source_type == LOCAL_UPLOAD_SOURCE_TYPE:
        return bool(source.s3_bucket) and bool(source.s3_object_key)
    return False


def _project_output_folder_configured(job: Any) -> bool:
    project = job.project
    if project is None:
        return False
    return bool(getattr(project, "output_drive_folder_id", None))


def _enum_value(value: Any) -> str:
    return str(getattr(value, "value", value))

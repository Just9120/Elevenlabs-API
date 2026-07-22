from __future__ import annotations

from enum import Enum

SUPPORTED_SOURCE_MIME_PREFIXES = ("audio/", "video/")
SUPPORTED_SOURCE_MIME_TYPES = {"application/ogg"}
DEFAULT_SOURCE_RETENTION_TTL_SECONDS = 86400
SOURCE_RETENTION_TTL_OPTIONS_SECONDS = (3600, 86400, 259200, 604800, 2592000)


def browser_source_upload_policy(
    max_upload_bytes: int, *, local_upload_enabled: bool
) -> dict[str, object]:
    return {
        "local_upload_enabled": local_upload_enabled,
        "max_upload_bytes": max_upload_bytes,
        "supported_mime_prefixes": list(SUPPORTED_SOURCE_MIME_PREFIXES),
        "supported_mime_types": sorted(SUPPORTED_SOURCE_MIME_TYPES),
    }


class UploadedObjectMetadataIssue(str, Enum):
    metadata_unavailable = "metadata_unavailable"
    source_too_large = "source_too_large"
    unsupported_mime_type = "unsupported_mime_type"
    source_size_mismatch = "source_size_mismatch"
    source_mime_mismatch = "source_mime_mismatch"


def normalize_source_mime_type(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    return normalized or None


def is_supported_source_mime_type(value: str | None) -> bool:
    normalized = normalize_source_mime_type(value)
    if not normalized:
        return False
    return normalized.startswith(SUPPORTED_SOURCE_MIME_PREFIXES) or normalized in SUPPORTED_SOURCE_MIME_TYPES


def validate_source_size(size_bytes: int | None, max_bytes: int) -> bool:
    if size_bytes is None:
        return True
    return 0 <= size_bytes <= max_bytes


def uploaded_object_metadata_issue(
    *,
    expected_size_bytes: int | None,
    expected_mime_type: str | None,
    actual_size_bytes: int | None,
    actual_mime_type: str | None,
    max_bytes: int,
) -> UploadedObjectMetadataIssue | None:
    expected_mime = normalize_source_mime_type(expected_mime_type)
    actual_mime = normalize_source_mime_type(actual_mime_type)
    if (
        expected_size_bytes is None
        or expected_mime is None
        or actual_size_bytes is None
        or actual_size_bytes < 0
        or actual_mime is None
    ):
        return UploadedObjectMetadataIssue.metadata_unavailable
    if actual_size_bytes > max_bytes:
        return UploadedObjectMetadataIssue.source_too_large
    if not is_supported_source_mime_type(actual_mime):
        return UploadedObjectMetadataIssue.unsupported_mime_type
    if actual_size_bytes != expected_size_bytes:
        return UploadedObjectMetadataIssue.source_size_mismatch
    if actual_mime != expected_mime:
        return UploadedObjectMetadataIssue.source_mime_mismatch
    return None

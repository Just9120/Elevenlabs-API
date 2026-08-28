from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

from .signed_cursor import decode_signed_cursor_payload, encode_signed_cursor
from .source_policy import (
    SUPPORTED_SOURCE_MIME_PREFIXES,
    SUPPORTED_SOURCE_MIME_TYPES,
    is_supported_source_mime_type,
    normalize_source_mime_type,
)


DIRECT_DRIVE_UPLOAD_APP_PROPERTY = "studioDirectUploadId"
DIRECT_DRIVE_UPLOAD_MAX_FILES = 20
DIRECT_DRIVE_UPLOAD_MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024
DIRECT_DRIVE_UPLOAD_CAPABILITY_SECONDS = 3600
DIRECT_DRIVE_UPLOAD_CAPABILITY_NAMESPACE = "studio-direct-drive-upload-v1"
DIRECT_DRIVE_UPLOAD_CAPABILITY_MAX_LENGTH = 1200
DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files"
DIRECT_DRIVE_UPLOAD_FIELDS = (
    "id,name,mimeType,size,webViewLink,parents,appProperties,trashed"
)
DRIVE_IDENTIFIER_RE = re.compile(r"^[A-Za-z0-9_-]{1,256}$")
OPERATION_ID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
)


@dataclass(frozen=True)
class DirectDriveUploadDescriptor:
    operation_id: str
    original_filename: str
    mime_type: str
    size_bytes: int


@dataclass(frozen=True)
class DirectDriveUploadCapability:
    operation_id: str
    owner_user_id: str
    project_id: str
    folder_id: str
    descriptor_digest: str
    expires_at: datetime


@dataclass(frozen=True)
class DirectDriveUploadResult:
    name: str
    mime_type: str
    size_bytes: int
    web_view_url: str


class DirectDriveUploadReason(str, Enum):
    not_found = "not_found"
    authentication_rejected = "authentication_rejected"
    unavailable = "unavailable"
    malformed_response = "malformed_response"
    metadata_mismatch = "metadata_mismatch"


class DirectDriveUploadError(RuntimeError):
    def __init__(self, reason: DirectDriveUploadReason):
        self.reason = reason
        super().__init__(reason.value)


def direct_drive_upload_policy(max_file_bytes: int) -> dict[str, object]:
    if not isinstance(max_file_bytes, int) or isinstance(max_file_bytes, bool) or max_file_bytes < 1:
        raise ValueError("invalid direct upload file limit")
    return {
        "max_files": DIRECT_DRIVE_UPLOAD_MAX_FILES,
        "max_file_bytes": max_file_bytes,
        "max_total_bytes": DIRECT_DRIVE_UPLOAD_MAX_TOTAL_BYTES,
        "supported_mime_prefixes": list(SUPPORTED_SOURCE_MIME_PREFIXES),
        "supported_mime_types": sorted(SUPPORTED_SOURCE_MIME_TYPES),
    }


def normalize_direct_drive_upload_descriptor(
    operation_id: str,
    original_filename: str,
    mime_type: str,
    size_bytes: int,
    *,
    max_file_bytes: int,
) -> DirectDriveUploadDescriptor:
    operation = operation_id.strip().lower() if isinstance(operation_id, str) else ""
    if not OPERATION_ID_RE.fullmatch(operation):
        raise ValueError("invalid direct upload operation")
    if (
        not isinstance(original_filename, str)
        or not original_filename
        or len(original_filename) > 255
        or original_filename in {".", ".."}
        or any(ord(char) < 32 for char in original_filename)
        or "/" in original_filename
        or "\\" in original_filename
    ):
        raise ValueError("invalid direct upload filename")
    normalized_mime = normalize_source_mime_type(mime_type)
    if not normalized_mime or not is_supported_source_mime_type(normalized_mime):
        raise ValueError("unsupported direct upload mime type")
    if (
        not isinstance(size_bytes, int)
        or isinstance(size_bytes, bool)
        or size_bytes < 1
        or size_bytes > max_file_bytes
    ):
        raise ValueError("invalid direct upload size")
    return DirectDriveUploadDescriptor(
        operation_id=operation,
        original_filename=original_filename,
        mime_type=normalized_mime,
        size_bytes=size_bytes,
    )


def validate_direct_drive_upload_batch(
    descriptors: list[DirectDriveUploadDescriptor],
) -> None:
    if not descriptors or len(descriptors) > DIRECT_DRIVE_UPLOAD_MAX_FILES:
        raise ValueError("invalid direct upload file count")
    operation_ids = [item.operation_id for item in descriptors]
    if len(operation_ids) != len(set(operation_ids)):
        raise ValueError("duplicate direct upload operation")
    total_bytes = sum(item.size_bytes for item in descriptors)
    if total_bytes < 1 or total_bytes > DIRECT_DRIVE_UPLOAD_MAX_TOTAL_BYTES:
        raise ValueError("invalid direct upload total size")


def direct_drive_upload_descriptor_digest(
    descriptor: DirectDriveUploadDescriptor,
) -> str:
    payload = json.dumps(
        {
            "operation_id": descriptor.operation_id,
            "original_filename": descriptor.original_filename,
            "mime_type": descriptor.mime_type,
            "size_bytes": descriptor.size_bytes,
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def encode_direct_drive_upload_capability(
    descriptor: DirectDriveUploadDescriptor,
    *,
    owner_user_id: str,
    project_id: str,
    folder_id: str,
    secret: str,
    now: datetime,
) -> str:
    if not DRIVE_IDENTIFIER_RE.fullmatch(folder_id):
        raise ValueError("invalid direct upload folder")
    expires_at = _as_utc_naive(now) + timedelta(
        seconds=DIRECT_DRIVE_UPLOAD_CAPABILITY_SECONDS
    )
    return encode_signed_cursor(
        expires_at,
        descriptor.operation_id,
        {
            "owner": owner_user_id,
            "project": project_id,
            "folder": folder_id,
            "descriptor": direct_drive_upload_descriptor_digest(descriptor),
        },
        secret,
        namespace=DIRECT_DRIVE_UPLOAD_CAPABILITY_NAMESPACE,
    )


def decode_direct_drive_upload_capability(
    value: str,
    *,
    secret: str,
    now: datetime,
) -> DirectDriveUploadCapability | None:
    decoded = decode_signed_cursor_payload(
        value,
        secret,
        namespace=DIRECT_DRIVE_UPLOAD_CAPABILITY_NAMESPACE,
        max_length=DIRECT_DRIVE_UPLOAD_CAPABILITY_MAX_LENGTH,
    )
    if decoded is None:
        return None
    expires_at, operation_id, context = decoded
    if expires_at <= _as_utc_naive(now) or not OPERATION_ID_RE.fullmatch(operation_id):
        return None
    owner = context.get("owner")
    project = context.get("project")
    folder = context.get("folder")
    digest = context.get("descriptor")
    if (
        not isinstance(owner, str)
        or not owner
        or not isinstance(project, str)
        or not project
        or not isinstance(folder, str)
        or not DRIVE_IDENTIFIER_RE.fullmatch(folder)
        or not isinstance(digest, str)
        or not re.fullmatch(r"[0-9a-f]{64}", digest)
    ):
        return None
    return DirectDriveUploadCapability(
        operation_id=operation_id,
        owner_user_id=owner,
        project_id=project,
        folder_id=folder,
        descriptor_digest=digest,
        expires_at=expires_at,
    )


def verify_direct_drive_upload_result(
    access_token: str,
    *,
    file_id: str,
    folder_id: str,
    descriptor: DirectDriveUploadDescriptor,
    metadata_fetcher: Callable[[str, str], dict] | None = None,
) -> DirectDriveUploadResult:
    if not DRIVE_IDENTIFIER_RE.fullmatch(file_id) or not DRIVE_IDENTIFIER_RE.fullmatch(folder_id):
        raise DirectDriveUploadError(DirectDriveUploadReason.metadata_mismatch)
    payload = (metadata_fetcher or fetch_direct_drive_upload_metadata)(
        access_token, file_id
    )
    if not isinstance(payload, dict):
        raise DirectDriveUploadError(DirectDriveUploadReason.malformed_response)
    size_bytes = _strict_drive_size(payload.get("size"))
    raw_mime_type = payload.get("mimeType")
    actual_mime_type = (
        normalize_source_mime_type(raw_mime_type)
        if isinstance(raw_mime_type, str)
        else None
    )
    app_properties = payload.get("appProperties")
    parents = payload.get("parents")
    web_view_url = payload.get("webViewLink")
    if (
        payload.get("id") != file_id
        or payload.get("name") != descriptor.original_filename
        or actual_mime_type != descriptor.mime_type
        or size_bytes != descriptor.size_bytes
        or parents != [folder_id]
        or payload.get("trashed") is not False
        or not isinstance(app_properties, dict)
        or app_properties.get(DIRECT_DRIVE_UPLOAD_APP_PROPERTY)
        != descriptor.operation_id
        or not _safe_drive_file_url(web_view_url)
    ):
        raise DirectDriveUploadError(DirectDriveUploadReason.metadata_mismatch)
    return DirectDriveUploadResult(
        name=descriptor.original_filename,
        mime_type=descriptor.mime_type,
        size_bytes=descriptor.size_bytes,
        web_view_url=web_view_url,
    )


def fetch_direct_drive_upload_metadata(access_token: str, file_id: str) -> dict:
    params = urlencode(
        {"fields": DIRECT_DRIVE_UPLOAD_FIELDS, "supportsAllDrives": "true"}
    )
    request = Request(
        f"{DRIVE_FILES_URL}/{file_id}?{params}",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
        },
    )
    try:
        with urlopen(request, timeout=10) as response:  # nosec - exact Google endpoint.
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        if exc.code == 404:
            reason = DirectDriveUploadReason.not_found
        elif exc.code in {401, 403}:
            reason = DirectDriveUploadReason.authentication_rejected
        else:
            reason = DirectDriveUploadReason.unavailable
        raise DirectDriveUploadError(reason) from exc
    except (URLError, OSError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise DirectDriveUploadError(DirectDriveUploadReason.unavailable) from exc
    if not isinstance(payload, dict):
        raise DirectDriveUploadError(DirectDriveUploadReason.malformed_response)
    return payload


def _safe_drive_file_url(value: object) -> bool:
    if not isinstance(value, str) or len(value) > 2000:
        return False
    parsed = urlparse(value)
    return (
        parsed.scheme == "https"
        and parsed.hostname == "drive.google.com"
        and parsed.path.startswith("/file/d/")
        and parsed.username is None
        and parsed.password is None
        and parsed.port is None
    )


def _strict_drive_size(value: object) -> int:
    if isinstance(value, bool):
        return -1
    if isinstance(value, int):
        return value if value >= 0 else -1
    if isinstance(value, str) and re.fullmatch(r"0|[1-9][0-9]*", value):
        return int(value)
    return -1


def _as_utc_naive(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)

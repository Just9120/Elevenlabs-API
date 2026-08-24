from __future__ import annotations

import json
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from urllib.parse import urlencode, urlparse

import httpx


DRIVE_RESUMABLE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files"
DRIVE_UPLOAD_FIELDS = "id,name,mimeType,webViewLink,parents,appProperties"
DRIVE_UPLOAD_CHUNK_SIZE = 8 * 1024 * 1024
DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files"


class GoogleDriveUploadReason(str, Enum):
    authentication_rejected = "authentication_rejected"
    unavailable = "unavailable"
    malformed_response = "malformed_response"


class GoogleDriveUploadError(RuntimeError):
    def __init__(self, reason: GoogleDriveUploadReason):
        self.reason = reason
        super().__init__(reason.value)


@dataclass(frozen=True)
class GoogleDriveUploadResult:
    file_id: str
    web_view_url: str
    name: str


def upload_file_resumable(
    access_token: str,
    *,
    folder_id: str,
    path: Path,
    filename: str,
    mime_type: str,
    idempotency_key: str,
    client_factory=httpx.Client,
) -> GoogleDriveUploadResult:
    size = path.stat().st_size
    metadata = {
        "name": filename,
        "parents": [folder_id],
        "appProperties": {"studioAudioPreparationJobId": idempotency_key},
    }
    params = urlencode(
        {
            "uploadType": "resumable",
            "supportsAllDrives": "true",
            "fields": DRIVE_UPLOAD_FIELDS,
        }
    )
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mime_type,
        "X-Upload-Content-Length": str(size),
    }
    try:
        with client_factory(timeout=httpx.Timeout(60.0, read=1800.0)) as client:
            existing = _find_existing_upload(
                client,
                access_token=access_token,
                folder_id=folder_id,
                idempotency_key=idempotency_key,
            )
            if existing is not None:
                return existing
            start = client.post(
                f"{DRIVE_RESUMABLE_UPLOAD_URL}?{params}",
                headers=headers,
                content=json.dumps(metadata, ensure_ascii=False).encode("utf-8"),
            )
            _raise_status(start)
            location = start.headers.get("Location")
            if not _safe_upload_location(location):
                raise GoogleDriveUploadError(GoogleDriveUploadReason.malformed_response)
            with path.open("rb") as stream:
                result = client.put(
                    location,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": mime_type,
                        "Content-Length": str(size),
                    },
                    content=_iter_file(stream),
                )
            _raise_status(result)
            payload = result.json()
    except GoogleDriveUploadError:
        raise
    except (OSError, httpx.HTTPError, json.JSONDecodeError) as exc:
        raise GoogleDriveUploadError(GoogleDriveUploadReason.unavailable) from exc
    return _normalize_result(payload)


def _find_existing_upload(client, *, access_token: str, folder_id: str, idempotency_key: str) -> GoogleDriveUploadResult | None:
    if not _safe_drive_identifier(folder_id) or not _safe_drive_identifier(idempotency_key):
        raise GoogleDriveUploadError(GoogleDriveUploadReason.malformed_response)
    query = (
        f"'{folder_id}' in parents and trashed = false and "
        f"appProperties has {{ key='studioAudioPreparationJobId' and value='{idempotency_key}' }}"
    )
    response = client.get(
        DRIVE_FILES_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        params={
            "q": query,
            "spaces": "drive",
            "pageSize": "2",
            "fields": f"files({DRIVE_UPLOAD_FIELDS}),nextPageToken",
            "supportsAllDrives": "true",
            "includeItemsFromAllDrives": "true",
        },
    )
    _raise_status(response)
    try:
        payload = response.json()
    except json.JSONDecodeError as exc:
        raise GoogleDriveUploadError(GoogleDriveUploadReason.malformed_response) from exc
    files = payload.get("files") if isinstance(payload, dict) else None
    if not isinstance(files, list) or len(files) > 1:
        raise GoogleDriveUploadError(GoogleDriveUploadReason.malformed_response)
    return _normalize_result(files[0]) if files else None


def _safe_drive_identifier(value: str) -> bool:
    return isinstance(value, str) and bool(value) and len(value) <= 256 and all(ch.isalnum() or ch in "-_" for ch in value)


def _iter_file(stream):
    while True:
        chunk = stream.read(DRIVE_UPLOAD_CHUNK_SIZE)
        if not chunk:
            return
        yield chunk


def _raise_status(response) -> None:
    if response.status_code in {401, 403}:
        raise GoogleDriveUploadError(GoogleDriveUploadReason.authentication_rejected)
    if response.status_code < 200 or response.status_code >= 300:
        raise GoogleDriveUploadError(GoogleDriveUploadReason.unavailable)


def _safe_upload_location(value: str | None) -> bool:
    if not isinstance(value, str) or len(value) > 4096:
        return False
    parsed = urlparse(value)
    return (
        parsed.scheme == "https"
        and parsed.hostname == "www.googleapis.com"
        and parsed.path == "/upload/drive/v3/files"
        and "upload_id=" in parsed.query
        and parsed.username is None
        and parsed.password is None
        and parsed.port is None
    )


def _normalize_result(payload) -> GoogleDriveUploadResult:
    if not isinstance(payload, dict):
        raise GoogleDriveUploadError(GoogleDriveUploadReason.malformed_response)
    file_id = payload.get("id")
    web_view_url = payload.get("webViewLink")
    name = payload.get("name")
    parents = payload.get("parents")
    if (
        not isinstance(file_id, str)
        or not file_id
        or len(file_id) > 256
        or not isinstance(web_view_url, str)
        or not web_view_url.startswith("https://drive.google.com/")
        or len(web_view_url) > 2000
        or not isinstance(name, str)
        or not name
        or len(name) > 255
        or not isinstance(parents, list)
        or len(parents) != 1
        or not isinstance(parents[0], str)
    ):
        raise GoogleDriveUploadError(GoogleDriveUploadReason.malformed_response)
    return GoogleDriveUploadResult(file_id=file_id, web_view_url=web_view_url, name=name)

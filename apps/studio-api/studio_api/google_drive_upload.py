from __future__ import annotations

import json
import re
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from urllib.parse import urlencode, urlparse

import httpx


DRIVE_RESUMABLE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files"
DRIVE_UPLOAD_FIELDS = "id,name,mimeType,size,webViewLink,parents,appProperties"
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
    check_cancelled=None,
    progress_callback=None,
) -> GoogleDriveUploadResult:
    size = path.stat().st_size
    if size <= 0:
        raise GoogleDriveUploadError(GoogleDriveUploadReason.malformed_response)
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
        with client_factory(timeout=httpx.Timeout(60.0), follow_redirects=False) as client:
            if check_cancelled:
                check_cancelled()
            existing = _find_existing_upload(
                client,
                access_token=access_token,
                folder_id=folder_id,
                idempotency_key=idempotency_key,
                expected_size=size,
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
                offset = 0
                interruptions = 0
                stalled = 0
                while offset < size:
                    if check_cancelled:
                        check_cancelled()
                    stream.seek(offset)
                    chunk = stream.read(min(DRIVE_UPLOAD_CHUNK_SIZE, size - offset))
                    if not chunk:
                        raise GoogleDriveUploadError(GoogleDriveUploadReason.malformed_response)
                    end = offset + len(chunk)
                    try:
                        result = client.put(location, headers={
                            "Authorization": f"Bearer {access_token}",
                            "Content-Type": mime_type,
                            "Content-Length": str(len(chunk)),
                            "Content-Range": f"bytes {offset}-{end - 1}/{size}",
                        }, content=chunk)
                    except httpx.HTTPError:
                        result = None
                    if result is None or result.status_code >= 500:
                        interruptions += 1
                        if interruptions > 3:
                            raise GoogleDriveUploadError(GoogleDriveUploadReason.unavailable)
                        if check_cancelled:
                            check_cancelled()
                        # The last chunk may have arrived even if its response
                        # was lost. Query the same session before sending bytes.
                        result = client.put(location, headers={
                            "Authorization": f"Bearer {access_token}",
                            "Content-Length": "0", "Content-Range": f"bytes */{size}",
                        }, content=b"")
                    if result.status_code in {200, 201}:
                        # Preserve confirmed success even if cancellation was
                        # requested while the final request was in flight.
                        return _normalize_result(result.json(), expected_parent=folder_id, expected_size=size)
                    if result.status_code != 308:
                        _raise_status(result)
                        raise GoogleDriveUploadError(GoogleDriveUploadReason.malformed_response)
                    received = _received_offset(result.headers.get("Range"), size=size)
                    if received < offset or received > end:
                        raise GoogleDriveUploadError(GoogleDriveUploadReason.malformed_response)
                    stalled = stalled + 1 if received == offset else 0
                    if stalled >= 3:
                        raise GoogleDriveUploadError(GoogleDriveUploadReason.unavailable)
                    offset = received
                    if progress_callback and offset:
                        progress_callback(offset, size)
                raise GoogleDriveUploadError(GoogleDriveUploadReason.malformed_response)
    except GoogleDriveUploadError:
        raise
    except (OSError, httpx.HTTPError, json.JSONDecodeError) as exc:
        raise GoogleDriveUploadError(GoogleDriveUploadReason.unavailable) from exc


def _find_existing_upload(client, *, access_token: str, folder_id: str, idempotency_key: str, expected_size: int) -> GoogleDriveUploadResult | None:
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
    if not isinstance(files, list) or len(files) > 1 or payload.get("nextPageToken"):
        raise GoogleDriveUploadError(GoogleDriveUploadReason.malformed_response)
    return _normalize_result(files[0], expected_parent=folder_id, expected_size=expected_size) if files else None


def _safe_drive_identifier(value: str) -> bool:
    return isinstance(value, str) and bool(value) and len(value) <= 256 and all(ch.isalnum() or ch in "-_" for ch in value)


def _received_offset(value: str | None, *, size: int) -> int:
    if value is None:
        return 0
    match = re.fullmatch(r"bytes=0-(\d+)", value)
    if match is None:
        raise GoogleDriveUploadError(GoogleDriveUploadReason.malformed_response)
    offset = int(match.group(1)) + 1
    if offset >= size:
        raise GoogleDriveUploadError(GoogleDriveUploadReason.malformed_response)
    return offset


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


def _normalize_result(payload, *, expected_parent: str | None = None, expected_size: int) -> GoogleDriveUploadResult:
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
        or (expected_parent is not None and parents[0] != expected_parent)
        or str(payload.get("size")) != str(expected_size)
    ):
        raise GoogleDriveUploadError(GoogleDriveUploadReason.malformed_response)
    return GoogleDriveUploadResult(file_id=file_id, web_view_url=web_view_url, name=name)

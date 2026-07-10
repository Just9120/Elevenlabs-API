import json
from dataclasses import dataclass
from enum import Enum
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .google_oauth import GoogleOAuthConfig, TOKEN_URL

DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files"
GOOGLE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"
SAFE_DRIVE_METADATA_FIELDS = "id,name,mimeType,size,webViewLink,createdTime,modifiedTime"
SAFE_DRIVE_CHILDREN_FIELDS = f"nextPageToken,files({SAFE_DRIVE_METADATA_FIELDS})"
DEFAULT_DRIVE_FOLDER_CHILDREN_PAGE_SIZE = 50
MAX_DRIVE_FOLDER_CHILDREN_PAGE_SIZE = 100


@dataclass(frozen=True)
class GoogleDriveMetadata:
    id: str
    name: str | None
    mime_type: str | None
    size_bytes: int | None
    web_view_link: str | None
    created_time: str | None
    modified_time: str | None
    is_folder: bool


class GoogleDriveMetadataReason(str, Enum):
    not_found = "not_found"
    unavailable = "unavailable"


class GoogleDriveMetadataError(RuntimeError):
    def __init__(self, reason: GoogleDriveMetadataReason):
        self.reason = reason
        super().__init__(reason.value)



@dataclass(frozen=True)
class GoogleDriveFolderChildren:
    folder_id: str
    items: list[GoogleDriveMetadata]
    next_page_token: str | None


def refresh_access_token(config: GoogleOAuthConfig, refresh_token: str) -> str:
    form = urlencode({
        "client_id": config.client_id,
        "client_secret": config.client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }).encode()
    req = Request(TOKEN_URL, data=form, method="POST", headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urlopen(req, timeout=10) as resp:  # nosec - Google OAuth endpoint; tests monkeypatch urlopen/helper.
        payload = json.loads(resp.read().decode("utf-8"))
    access_token = payload.get("access_token")
    if not isinstance(access_token, str) or not access_token:
        raise RuntimeError("Google token refresh failed")
    return access_token


def fetch_drive_file_metadata(access_token: str, drive_file_id: str) -> GoogleDriveMetadata:
    params = urlencode({"fields": SAFE_DRIVE_METADATA_FIELDS, "supportsAllDrives": "true"})
    req = Request(
        f"{DRIVE_FILES_URL}/{drive_file_id}?{params}",
        headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
    )
    try:
        with urlopen(req, timeout=10) as resp:  # nosec - Google Drive endpoint; tests monkeypatch urlopen/helper.
            payload = json.loads(resp.read().decode("utf-8"))
    except HTTPError as exc:
        if exc.code == 404:
            raise GoogleDriveMetadataError(GoogleDriveMetadataReason.not_found) from exc
        raise GoogleDriveMetadataError(GoogleDriveMetadataReason.unavailable) from exc
    except (URLError, OSError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise GoogleDriveMetadataError(GoogleDriveMetadataReason.unavailable) from exc
    if not isinstance(payload, dict):
        raise GoogleDriveMetadataError(GoogleDriveMetadataReason.unavailable)
    return normalize_drive_metadata(payload)


def list_drive_folder_children(
    access_token: str,
    folder_id: str,
    page_size: int = DEFAULT_DRIVE_FOLDER_CHILDREN_PAGE_SIZE,
    page_token: str | None = None,
) -> GoogleDriveFolderChildren:
    safe_page_size = max(1, min(page_size, MAX_DRIVE_FOLDER_CHILDREN_PAGE_SIZE))
    params = {
        "q": f"'{folder_id}' in parents and trashed = false",
        "fields": SAFE_DRIVE_CHILDREN_FIELDS,
        "pageSize": str(safe_page_size),
        "supportsAllDrives": "true",
        "includeItemsFromAllDrives": "true",
    }
    if page_token:
        params["pageToken"] = page_token
    req = Request(
        f"{DRIVE_FILES_URL}?{urlencode(params)}",
        headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
    )
    with urlopen(req, timeout=10) as resp:  # nosec - Google Drive endpoint; tests monkeypatch urlopen/helper.
        payload = json.loads(resp.read().decode("utf-8"))
    files = payload.get("files") if isinstance(payload, dict) else None
    token = payload.get("nextPageToken") if isinstance(payload, dict) else None
    return GoogleDriveFolderChildren(
        folder_id=folder_id,
        items=[normalize_drive_metadata(item) for item in files if isinstance(item, dict)] if isinstance(files, list) else [],
        next_page_token=token if isinstance(token, str) and token else None,
    )


def normalize_drive_metadata(payload: dict) -> GoogleDriveMetadata:
    mime_type = payload.get("mimeType")
    raw_size = payload.get("size")
    size_bytes = None
    if raw_size is not None:
        try:
            size_bytes = int(raw_size)
        except (TypeError, ValueError):
            size_bytes = None
    return GoogleDriveMetadata(
        id=str(payload.get("id") or ""),
        name=payload.get("name") if isinstance(payload.get("name"), str) else None,
        mime_type=mime_type if isinstance(mime_type, str) else None,
        size_bytes=size_bytes,
        web_view_link=payload.get("webViewLink") if isinstance(payload.get("webViewLink"), str) else None,
        created_time=payload.get("createdTime") if isinstance(payload.get("createdTime"), str) else None,
        modified_time=payload.get("modifiedTime") if isinstance(payload.get("modifiedTime"), str) else None,
        is_folder=mime_type == GOOGLE_FOLDER_MIME_TYPE,
    )

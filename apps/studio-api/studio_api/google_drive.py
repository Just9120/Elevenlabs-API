import json
from dataclasses import dataclass
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .google_oauth import GoogleOAuthConfig, TOKEN_URL

DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files"
GOOGLE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"
SAFE_DRIVE_METADATA_FIELDS = "id,name,mimeType,size,webViewLink,createdTime,modifiedTime"


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
    with urlopen(req, timeout=10) as resp:  # nosec - Google Drive endpoint; tests monkeypatch urlopen/helper.
        payload = json.loads(resp.read().decode("utf-8"))
    return normalize_drive_metadata(payload)


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

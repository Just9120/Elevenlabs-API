import json
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import HTTPException, status

from .google_scopes import (
    has_maintenance_server_scope_boundary,
    has_picker_browser_scope_boundary,
)

AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
PRIMARY_OAUTH_PURPOSE = "primary"
MAINTENANCE_OAUTH_PURPOSE = "maintenance"
GOOGLE_OAUTH_PURPOSES = {
    PRIMARY_OAUTH_PURPOSE,
    MAINTENANCE_OAUTH_PURPOSE,
}


@dataclass(frozen=True)
class GoogleOAuthConfig:
    client_id: str
    client_secret: str
    redirect_uri: str
    scopes: str


@dataclass(frozen=True)
class GoogleTokenResult:
    refresh_token: str | None
    access_token: str | None
    id_token: str | None
    scope: str | None
    google_subject: str | None = None
    google_email: str | None = None


class GoogleOAuthConfigError(RuntimeError):
    pass


def _load_google_oauth_config(
    *,
    client_id: str | None,
    client_secret_file: str | None,
    redirect_uri: str | None,
    scopes: str | None,
    scope_boundary,
) -> GoogleOAuthConfig:
    clean_client_id = (client_id or "").strip()
    clean_redirect_uri = (redirect_uri or "").strip()
    if not clean_client_id or not clean_redirect_uri:
        raise GoogleOAuthConfigError("Google OAuth is not configured")
    if not client_secret_file:
        raise GoogleOAuthConfigError("Google OAuth is not configured")
    try:
        client_secret = Path(client_secret_file).read_text(
            encoding="utf-8",
        ).strip()
    except OSError as exc:
        raise GoogleOAuthConfigError("Google OAuth is not configured") from exc
    if not client_secret:
        raise GoogleOAuthConfigError("Google OAuth is not configured")
    clean_scopes = (scopes or "").strip()
    if not scope_boundary(clean_scopes):
        raise GoogleOAuthConfigError("Google OAuth is not configured")
    return GoogleOAuthConfig(
        client_id=clean_client_id,
        client_secret=client_secret,
        redirect_uri=clean_redirect_uri,
        scopes=clean_scopes,
    )


def load_google_oauth_config(settings) -> GoogleOAuthConfig:
    return _load_google_oauth_config(
        client_id=settings.google_oauth_client_id,
        client_secret_file=settings.google_oauth_client_secret_file,
        redirect_uri=settings.google_oauth_redirect_uri,
        scopes=settings.google_oauth_scopes,
        scope_boundary=has_picker_browser_scope_boundary,
    )


def load_google_maintenance_oauth_config(settings) -> GoogleOAuthConfig:
    return _load_google_oauth_config(
        client_id=settings.google_maintenance_oauth_client_id,
        client_secret_file=settings.google_maintenance_oauth_client_secret_file,
        redirect_uri=settings.google_maintenance_oauth_redirect_uri,
        scopes=settings.google_maintenance_oauth_scopes,
        scope_boundary=has_maintenance_server_scope_boundary,
    )


def config_unavailable() -> HTTPException:
    return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google OAuth is not configured")


def authorization_url(config: GoogleOAuthConfig, state: str) -> str:
    params = {
        "client_id": config.client_id,
        "redirect_uri": config.redirect_uri,
        "response_type": "code",
        "scope": config.scopes,
        "state": state,
        "access_type": "offline",
        "prompt": "consent",
    }
    return AUTHORIZE_URL + "?" + urlencode(params)


def exchange_code_for_tokens(config: GoogleOAuthConfig, code: str) -> GoogleTokenResult:
    form = urlencode({
        "client_id": config.client_id,
        "client_secret": config.client_secret,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": config.redirect_uri,
    }).encode()
    req = Request(TOKEN_URL, data=form, method="POST", headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urlopen(req, timeout=10) as resp:  # nosec - production OAuth endpoint; tests monkeypatch this function.
        payload = json.loads(resp.read().decode("utf-8"))
    userinfo = {}
    access_token = payload.get("access_token")
    if access_token:
        info_req = Request(USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
        with urlopen(info_req, timeout=10) as info_resp:  # nosec
            userinfo = json.loads(info_resp.read().decode("utf-8"))
    return GoogleTokenResult(
        refresh_token=payload.get("refresh_token"),
        access_token=access_token,
        id_token=payload.get("id_token"),
        scope=payload.get("scope"),
        google_subject=userinfo.get("sub"),
        google_email=userinfo.get("email"),
    )

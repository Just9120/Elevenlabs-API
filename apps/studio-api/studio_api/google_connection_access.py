from __future__ import annotations

from enum import Enum
from sqlalchemy.orm import Session

from .google_oauth import GoogleOAuthConfigError, load_google_oauth_config
from .models import GoogleConnection, GoogleConnectionStatus, GoogleProvider
from .google_scopes import has_drive_file_scope, has_picker_browser_scope_boundary
from .google_drive import (
    GoogleAccessTokenRefreshError,
    GoogleAccessTokenRefreshReason,
    refresh_access_token,
)
from .security import aad, decrypt, master_key_from_b64


class GoogleConnectionAccessReason(str, Enum):
    missing = "google_connection_missing"
    inactive = "google_connection_inactive"
    reauthorization_required = "google_reauthorization_required"
    token_unavailable = "google_token_unavailable"
    config_unavailable = "google_config_unavailable"
    scope_unavailable = "google_scope_unavailable"


class GoogleConnectionAccessError(RuntimeError):
    def __init__(self, reason: GoogleConnectionAccessReason):
        self.reason = reason
        super().__init__(reason.value)



def active_google_connection_for_user(db: Session, *, user_id: str) -> GoogleConnection:
    conn = db.query(GoogleConnection).filter_by(user_id=user_id, provider=GoogleProvider.google).first()
    if conn is None:
        raise GoogleConnectionAccessError(GoogleConnectionAccessReason.missing)
    if conn.status != GoogleConnectionStatus.active:
        raise GoogleConnectionAccessError(GoogleConnectionAccessReason.inactive)
    return conn


def require_drive_file_scope(conn: GoogleConnection) -> None:
    if not has_drive_file_scope(conn.scopes):
        raise GoogleConnectionAccessError(GoogleConnectionAccessReason.scope_unavailable)


def require_picker_browser_scope_boundary(conn: GoogleConnection) -> None:
    if not has_picker_browser_scope_boundary(conn.scopes):
        raise GoogleConnectionAccessError(GoogleConnectionAccessReason.scope_unavailable)

def google_token_aad(user_id: str, connection_id: str) -> bytes:
    return aad(user_id, connection_id, "refresh", "google")


def refresh_user_google_drive_access_token(db: Session, *, user_id: str, settings) -> str:
    conn = active_google_connection_for_user(db, user_id=user_id)
    if not conn.refresh_token_ciphertext or not conn.refresh_token_nonce or not conn.key_id:
        raise GoogleConnectionAccessError(GoogleConnectionAccessReason.inactive)
    try:
        cfg = load_google_oauth_config(settings)
        refresh_token = decrypt(
            conn.refresh_token_ciphertext,
            conn.refresh_token_nonce,
            master_key_from_b64(settings.master_key_b64()),
            google_token_aad(user_id, conn.id),
        )
        return refresh_access_token(cfg, refresh_token)
    except GoogleAccessTokenRefreshError as exc:
        reason = (
            GoogleConnectionAccessReason.reauthorization_required
            if exc.reason == GoogleAccessTokenRefreshReason.authentication_rejected
            else GoogleConnectionAccessReason.token_unavailable
        )
        raise GoogleConnectionAccessError(reason) from exc
    except GoogleConnectionAccessError:
        raise
    except GoogleOAuthConfigError as exc:
        raise GoogleConnectionAccessError(GoogleConnectionAccessReason.config_unavailable) from exc
    except Exception as exc:
        raise GoogleConnectionAccessError(GoogleConnectionAccessReason.token_unavailable) from exc

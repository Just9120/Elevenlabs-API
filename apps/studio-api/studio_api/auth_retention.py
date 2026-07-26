from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import logging

from sqlalchemy import or_

from .config import Settings, get_settings
from .db import SessionLocal
from .models import GoogleOAuthState, LoginContext, Session
from .security import utcnow


LOGGER = logging.getLogger("studio_api.auth_retention")
_LAST_CLEANUP_SUCCESS: datetime | None = None


@dataclass(frozen=True)
class AuthStateCleanupResult:
    succeeded: bool
    login_contexts: int = 0
    google_oauth_states: int = 0
    sessions: int = 0


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _delete_candidates(db, model, condition, *, limit: int) -> int:
    ids = [
        row[0]
        for row in (
            db.query(model.id)
            .filter(condition)
            .order_by(model.expires_at.asc(), model.id.asc())
            .limit(limit)
            .all()
        )
    ]
    if ids:
        db.query(model).filter(model.id.in_(ids)).delete(synchronize_session=False)
    return len(ids)


def cleanup_expired_auth_state(
    *,
    session_factory=SessionLocal,
    settings: Settings | None = None,
    now: datetime | None = None,
    force: bool = False,
) -> AuthStateCleanupResult:
    global _LAST_CLEANUP_SUCCESS
    settings = settings or get_settings()
    now_dt = now or utcnow()
    interval = max(60, min(int(settings.auth_cleanup_interval_seconds), 86400))
    if (
        not force
        and _LAST_CLEANUP_SUCCESS is not None
        and _utc(now_dt) - _utc(_LAST_CLEANUP_SUCCESS) < timedelta(seconds=interval)
    ):
        return AuthStateCleanupResult(succeeded=True)

    db = None
    try:
        db = session_factory()
        limit = max(1, min(int(settings.auth_cleanup_batch_size), 1000))
        login_contexts = _delete_candidates(
            db,
            LoginContext,
            or_(LoginContext.expires_at <= now_dt, LoginContext.used_at.is_not(None)),
            limit=limit,
        )
        google_oauth_states = _delete_candidates(
            db,
            GoogleOAuthState,
            or_(GoogleOAuthState.expires_at <= now_dt, GoogleOAuthState.used_at.is_not(None)),
            limit=limit,
        )
        sessions = _delete_candidates(
            db,
            Session,
            or_(Session.expires_at <= now_dt, Session.revoked_at.is_not(None)),
            limit=limit,
        )
        db.commit()
        _LAST_CLEANUP_SUCCESS = now_dt
        return AuthStateCleanupResult(
            succeeded=True,
            login_contexts=login_contexts,
            google_oauth_states=google_oauth_states,
            sessions=sessions,
        )
    except Exception:
        if db is not None:
            db.rollback()
        LOGGER.warning("auth_state_cleanup_failed")
        return AuthStateCleanupResult(succeeded=False)
    finally:
        if db is not None:
            db.close()

from __future__ import annotations

from datetime import datetime

from sqlalchemy import case
from sqlalchemy.orm import Session as OrmSession

from .models import Session


MAX_ACTIVE_SESSIONS = 100


def _session_payload(row: Session, *, current_session_id: str) -> dict:
    return {
        "id": row.id,
        "is_current": row.id == current_session_id,
        "created_at": row.created_at.isoformat(),
        "last_seen_at": row.last_seen_at.isoformat() if row.last_seen_at else None,
        "expires_at": row.expires_at.isoformat(),
    }


def list_active_sessions(
    db: OrmSession,
    *,
    owner_user_id: str,
    current_session_id: str,
    now: datetime,
    limit: int = MAX_ACTIVE_SESSIONS,
) -> dict:
    rows = (
        db.query(Session)
        .filter(
            Session.user_id == owner_user_id,
            Session.revoked_at.is_(None),
            Session.expires_at > now,
        )
        .order_by(
            case((Session.id == current_session_id, 0), else_=1),
            Session.last_seen_at.desc().nullslast(),
            Session.created_at.desc(),
            Session.id.asc(),
        )
        .limit(limit + 1)
        .all()
    )
    return {
        "sessions": [
            _session_payload(row, current_session_id=current_session_id)
            for row in rows[:limit]
        ],
        "truncated": len(rows) > limit,
        "limit": limit,
    }


def revoke_owned_other_session(
    db: OrmSession,
    *,
    owner_user_id: str,
    current_session_id: str,
    target_session_id: str,
    now: datetime,
) -> bool:
    if target_session_id == current_session_id:
        return False
    target = (
        db.query(Session)
        .filter(
            Session.id == target_session_id,
            Session.user_id == owner_user_id,
            Session.revoked_at.is_(None),
            Session.expires_at > now,
        )
        .with_for_update()
        .first()
    )
    if target is None:
        return False
    target.revoked_at = now
    return True


def revoke_all_owned_other_sessions(
    db: OrmSession,
    *,
    owner_user_id: str,
    current_session_id: str,
    now: datetime,
) -> int:
    return (
        db.query(Session)
        .filter(
            Session.user_id == owner_user_id,
            Session.id != current_session_id,
            Session.revoked_at.is_(None),
            Session.expires_at > now,
        )
        .update({"revoked_at": now}, synchronize_session=False)
    )

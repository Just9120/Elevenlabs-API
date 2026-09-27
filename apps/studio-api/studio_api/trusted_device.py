"""Revocable browser trust for step-up actions, never for login or TOTP changes."""

from datetime import datetime, timedelta, timezone

from fastapi import Request, Response
from sqlalchemy.orm import Session

from .config import Settings
from .models import TrustedDevice
from .security import new_token, token_hash


COOKIE_NAME = "__Host-studio_trusted_device"
TRUST_DAYS = 30
TRUST_SECONDS = TRUST_DAYS * 86400


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def current_trusted_device(
    db: Session, *, request: Request, user_id: str, now: datetime
) -> TrustedDevice | None:
    raw = request.cookies.get(COOKIE_NAME)
    if not raw or len(raw) > 256:
        return None
    device = db.query(TrustedDevice).filter_by(token_hash=token_hash(raw), user_id=user_id).first()
    if not device or device.revoked_at is not None or _utc(device.expires_at) <= _utc(now):
        return None
    return device


def remember_current_browser(
    db: Session, *, request: Request, response: Response, user_id: str,
    now: datetime, settings: Settings,
) -> TrustedDevice:
    previous = current_trusted_device(db, request=request, user_id=user_id, now=now)
    if previous:
        previous.revoked_at = now
    raw = new_token()
    device = TrustedDevice(
        user_id=user_id, token_hash=token_hash(raw), created_at=now,
        expires_at=now + timedelta(seconds=TRUST_SECONDS),
    )
    db.add(device)
    response.set_cookie(
        COOKIE_NAME, raw, max_age=TRUST_SECONDS, httponly=True,
        secure=settings.cookie_secure, samesite="lax", path="/",
    )
    return device


def revoke_current_browser(
    db: Session, *, request: Request, response: Response, user_id: str, now: datetime,
    settings: Settings,
) -> bool:
    device = current_trusted_device(db, request=request, user_id=user_id, now=now)
    if device:
        device.revoked_at = now
    clear_trusted_device_cookie(response, settings=settings)
    return device is not None


def clear_trusted_device_cookie(response: Response, *, settings: Settings) -> None:
    response.delete_cookie(
        COOKIE_NAME, path="/", secure=settings.cookie_secure, httponly=True,
        samesite="lax",
    )


def revoke_all_browsers(db: Session, *, user_id: str, now: datetime) -> int:
    return db.query(TrustedDevice).filter(
        TrustedDevice.user_id == user_id,
        TrustedDevice.revoked_at.is_(None),
    ).update({TrustedDevice.revoked_at: now}, synchronize_session=False)

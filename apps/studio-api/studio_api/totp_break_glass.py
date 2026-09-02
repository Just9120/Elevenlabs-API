"""Audited operator-only recovery when the personal owner loses every TOTP factor.

This module intentionally has no HTTP route.  It must be invoked explicitly by
an operator inside the API runtime after independently confirming the owner.
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from .audit import audit
from .db import SessionLocal
from .models import (
    Session as UserSession,
    User,
    UserRole,
    UserStatus,
    UserTotpFactor,
    UserTotpRecoveryCode,
)
from .security import utcnow


ALLOWED_REASONS = ("lost-authenticator", "recovery-codes-unavailable")


class TotpBreakGlassError(RuntimeError):
    pass


@dataclass(frozen=True)
class TotpBreakGlassResult:
    revoked_sessions: int


def disable_owner_totp(
    db: Session,
    *,
    owner_email: str,
    reason: str,
    now: datetime | None = None,
) -> TotpBreakGlassResult:
    """Disable one verified owner's TOTP and revoke every active session."""

    normalized_email = owner_email.strip().lower()
    if reason not in ALLOWED_REASONS:
        raise TotpBreakGlassError("unsupported break-glass reason")
    if not normalized_email:
        raise TotpBreakGlassError("eligible owner not found")

    user = (
        db.query(User)
        .filter(
            func.lower(User.email) == normalized_email,
            User.role == UserRole.admin,
            User.status == UserStatus.active,
        )
        .with_for_update()
        .one_or_none()
    )
    if user is None:
        raise TotpBreakGlassError("eligible owner not found")

    factor = db.get(UserTotpFactor, user.id)
    if factor is None or factor.disabled_at is not None:
        raise TotpBreakGlassError("active TOTP factor not found")

    disabled_at = now or utcnow()
    factor.disabled_at = disabled_at
    factor.updated_at = disabled_at
    db.query(UserTotpRecoveryCode).filter(
        UserTotpRecoveryCode.user_id == user.id,
        UserTotpRecoveryCode.used_at.is_(None),
    ).delete(synchronize_session=False)
    revoked_sessions = db.query(UserSession).filter(
        UserSession.user_id == user.id,
        UserSession.revoked_at.is_(None),
    ).update({UserSession.revoked_at: disabled_at}, synchronize_session=False)
    audit(
        db,
        "auth.totp_break_glass_disabled",
        subject_user_id=user.id,
        reason=reason,
    )
    db.commit()
    return TotpBreakGlassResult(revoked_sessions=int(revoked_sessions))


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Disable personal-owner TOTP with an immutable audit event.",
    )
    parser.add_argument("--owner-email", required=True)
    parser.add_argument("--confirm-owner-email", required=True)
    parser.add_argument("--reason", required=True, choices=ALLOWED_REASONS)
    parser.add_argument("--confirm-revoke-all-sessions", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.owner_email.strip().lower() != args.confirm_owner_email.strip().lower():
        print("BLOCKED: owner confirmation does not match", file=sys.stderr)
        return 2
    if not args.confirm_revoke_all_sessions:
        print("BLOCKED: explicit all-session revocation confirmation is required", file=sys.stderr)
        return 2

    db = SessionLocal()
    try:
        result = disable_owner_totp(
            db,
            owner_email=args.owner_email,
            reason=args.reason,
        )
    except TotpBreakGlassError as exc:
        db.rollback()
        print(f"BLOCKED: {exc}", file=sys.stderr)
        return 2
    except Exception:
        db.rollback()
        print("ERROR: TOTP break-glass transaction failed", file=sys.stderr)
        return 1
    finally:
        db.close()

    print(
        "STUDIO_TOTP_BREAK_GLASS_OK "
        f"revoked_sessions={result.revoked_sessions} audit=recorded"
    )
    return 0


if __name__ == "__main__":  # pragma: no cover - exercised by operator invocation
    raise SystemExit(main())

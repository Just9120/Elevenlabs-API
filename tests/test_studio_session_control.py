import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


def test_session_control_is_bounded_owner_scoped_and_idempotent(monkeypatch):
    monkeypatch.setenv("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")
    from studio_api.config import get_settings

    get_settings.cache_clear()
    from studio_api.db import Base
    from studio_api.models import Session, User, UserRole, UserStatus
    from studio_api.session_control import (
        list_active_sessions,
        revoke_all_owned_other_sessions,
        revoke_owned_other_session,
    )

    local_engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(
        local_engine,
        tables=[User.__table__, Session.__table__],
    )
    LocalSession = sessionmaker(bind=local_engine)
    db = LocalSession()
    try:
        now = datetime(2026, 8, 28, 7, 0, tzinfo=timezone.utc)
        owner = User(
            id="00000000-0000-0000-0000-000000000001",
            email="session-owner@example.com",
            role=UserRole.user,
            status=UserStatus.active,
        )
        outsider = User(
            id="00000000-0000-0000-0000-000000000002",
            email="session-outsider@example.com",
            role=UserRole.user,
            status=UserStatus.active,
        )
        current = Session(
            id="00000000-0000-0000-0000-000000000011",
            user_id=owner.id,
            token_hash="1" * 64,
            csrf_hash="2" * 64,
            created_at=now - timedelta(hours=3),
            last_seen_at=now - timedelta(minutes=1),
            expires_at=now + timedelta(days=1),
        )
        other = Session(
            id="00000000-0000-0000-0000-000000000012",
            user_id=owner.id,
            token_hash="3" * 64,
            csrf_hash="4" * 64,
            created_at=now - timedelta(hours=2),
            expires_at=now + timedelta(days=1),
        )
        extra = Session(
            id="00000000-0000-0000-0000-000000000013",
            user_id=owner.id,
            token_hash="5" * 64,
            csrf_hash="6" * 64,
            created_at=now - timedelta(hours=1),
            expires_at=now + timedelta(days=1),
        )
        expired = Session(
            id="00000000-0000-0000-0000-000000000014",
            user_id=owner.id,
            token_hash="7" * 64,
            csrf_hash="8" * 64,
            expires_at=now - timedelta(minutes=1),
        )
        outsider_session = Session(
            id="00000000-0000-0000-0000-000000000015",
            user_id=outsider.id,
            token_hash="9" * 64,
            csrf_hash="a" * 64,
            expires_at=now + timedelta(days=1),
        )
        db.add_all(
            [owner, outsider, current, other, extra, expired, outsider_session]
        )
        db.commit()

        listed = list_active_sessions(
            db,
            owner_user_id=owner.id,
            current_session_id=current.id,
            now=now,
            limit=2,
        )
        assert listed["truncated"] is True
        assert listed["limit"] == 2
        assert listed["sessions"][0]["id"] == current.id
        assert listed["sessions"][0]["is_current"] is True
        assert all(
            set(row)
            == {"id", "is_current", "created_at", "last_seen_at", "expires_at"}
            for row in listed["sessions"]
        )
        assert outsider_session.id not in {
            row["id"] for row in listed["sessions"]
        }

        assert (
            revoke_owned_other_session(
                db,
                owner_user_id=owner.id,
                current_session_id=current.id,
                target_session_id=current.id,
                now=now,
            )
            is False
        )
        assert (
            revoke_owned_other_session(
                db,
                owner_user_id=owner.id,
                current_session_id=current.id,
                target_session_id=outsider_session.id,
                now=now,
            )
            is False
        )
        assert revoke_owned_other_session(
            db,
            owner_user_id=owner.id,
            current_session_id=current.id,
            target_session_id=other.id,
            now=now,
        )
        db.commit()
        assert (
            revoke_owned_other_session(
                db,
                owner_user_id=owner.id,
                current_session_id=current.id,
                target_session_id=other.id,
                now=now,
            )
            is False
        )

        assert (
            revoke_all_owned_other_sessions(
                db,
                owner_user_id=owner.id,
                current_session_id=current.id,
                now=now,
            )
            == 1
        )
        db.commit()
        assert (
            revoke_all_owned_other_sessions(
                db,
                owner_user_id=owner.id,
                current_session_id=current.id,
                now=now,
            )
            == 0
        )
        assert db.get(Session, current.id).revoked_at is None
        assert db.get(Session, expired.id).revoked_at is None
        assert db.get(Session, outsider_session.id).revoked_at is None
    finally:
        db.close()
        local_engine.dispose()
        get_settings.cache_clear()

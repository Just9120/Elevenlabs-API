from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
import sys

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


@pytest.fixture
def auth_retention_contract(monkeypatch):
    monkeypatch.setenv("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("STUDIO_APP_ORIGIN", "https://studio.test")
    monkeypatch.setenv("STUDIO_COOKIE_SECURE", "false")

    from studio_api.config import get_settings

    get_settings.cache_clear()
    from studio_api.auth_retention import cleanup_expired_auth_state
    from studio_api.db import Base
    from studio_api.models import GoogleOAuthState, LoginContext, Session, User

    try:
        yield cleanup_expired_auth_state, Base, GoogleOAuthState, LoginContext, Session, User
    finally:
        get_settings.cache_clear()


def test_auth_state_cleanup_is_terminal_only_and_batch_bounded(auth_retention_contract):
    cleanup_expired_auth_state, Base, GoogleOAuthState, LoginContext, Session, User = auth_retention_contract
    engine=create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    SessionFactory=sessionmaker(bind=engine, expire_on_commit=False)
    now=datetime(2026, 7, 26, 12, 0, tzinfo=timezone.utc)
    with SessionFactory() as db:
        user=User(id="auth-retention-user", email="retention@example.com")
        db.add(user)
        db.add_all([
            LoginContext(id="login-active", csrf_hash="login-active", expires_at=now+timedelta(hours=1)),
            LoginContext(id="login-expired", csrf_hash="login-expired", expires_at=now-timedelta(seconds=1)),
            LoginContext(id="login-used", csrf_hash="login-used", expires_at=now+timedelta(hours=1), used_at=now),
            GoogleOAuthState(id="oauth-active", user_id=user.id, state_hash="oauth-active", expires_at=now+timedelta(hours=1)),
            GoogleOAuthState(id="oauth-expired", user_id=user.id, state_hash="oauth-expired", expires_at=now-timedelta(seconds=1)),
            GoogleOAuthState(id="oauth-used", user_id=user.id, state_hash="oauth-used", expires_at=now+timedelta(hours=1), used_at=now),
            Session(id="session-active", user_id=user.id, token_hash="session-active", csrf_hash="csrf", expires_at=now+timedelta(hours=1)),
            Session(id="session-expired", user_id=user.id, token_hash="session-expired", csrf_hash="csrf", expires_at=now-timedelta(seconds=1)),
            Session(id="session-revoked", user_id=user.id, token_hash="session-revoked", csrf_hash="csrf", expires_at=now+timedelta(hours=1), revoked_at=now),
        ])
        db.commit()

    settings=SimpleNamespace(auth_cleanup_interval_seconds=3600, auth_cleanup_batch_size=1)
    first=cleanup_expired_auth_state(
        session_factory=SessionFactory,
        settings=settings,
        now=now,
        force=True,
    )
    assert first.succeeded
    assert (first.login_contexts, first.google_oauth_states, first.sessions) == (1, 1, 1)

    second=cleanup_expired_auth_state(
        session_factory=SessionFactory,
        settings=settings,
        now=now,
        force=True,
    )
    assert second.succeeded
    assert (second.login_contexts, second.google_oauth_states, second.sessions) == (1, 1, 1)

    with SessionFactory() as db:
        assert {row.id for row in db.query(LoginContext).all()} == {"login-active"}
        assert {row.id for row in db.query(GoogleOAuthState).all()} == {"oauth-active"}
        assert {row.id for row in db.query(Session).all()} == {"session-active"}
    Base.metadata.drop_all(engine)
    engine.dispose()

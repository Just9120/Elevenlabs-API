import base64
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/studio-api"))
os.environ.setdefault("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")
from studio_api.db import Base
from studio_api.models import User, UserStatus, LocalIdentity, PasswordResetChallenge, SecurityEmailDelivery
from studio_api.security import decrypt, master_key_from_b64
from studio_api.security_email import request_reset_delivery, process_one_security_email, enqueue_security_event

NOW = datetime(2026, 10, 11, 12)
KEY = base64.b64encode(b"s" * 32).decode()


def test_security_mail_configuration_requires_explicit_domain_and_tls():
    from studio_api.config import Settings
    settings = Settings(security_email_enabled=True, security_email_sender_domain="example.com",
        job_smtp_host="smtp.example.com", job_smtp_from_email="security@example.com",
        job_smtp_starttls=True, job_smtp_use_ssl=False)
    assert settings.security_email_configured()
    settings.security_email_sender_domain = "other.example.com"
    assert not settings.security_email_configured()
    settings.security_email_sender_domain = "example.com"
    settings.job_smtp_starttls = False
    assert not settings.security_email_configured()
    settings.job_smtp_starttls = True
    settings.security_email_enabled = False
    assert not settings.security_email_configured()


@pytest.fixture
def fixture():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    settings = SimpleNamespace(security_email_configured=lambda: True, master_key_b64=lambda: KEY,
        app_origin="https://studio.example.test", job_smtp_from_email="security@example.test",
        security_email_sender_domain="example.test", job_smtp_host="smtp.example.test", job_smtp_port=587,
        job_smtp_timeout_seconds=10, job_smtp_use_ssl=False, job_smtp_starttls=True, job_smtp_username=None)
    with factory() as db:
        user = User(email="synthetic@example.test", status=UserStatus.active)
        db.add(user); db.flush()
        db.add(LocalIdentity(user_id=user.id, password_hash="synthetic-hash")); db.commit()
        user_id = user.id
    yield factory, settings, user_id
    engine.dispose()


def payload(row):
    return json.loads(decrypt(row.payload_ciphertext, row.payload_nonce, master_key_from_b64(KEY),
        f"studio:security-email:{row.owner_user_id}:{row.id}".encode()))


def test_reset_is_atomic_hash_only_single_use_and_latest_request_wins(fixture):
    factory, settings, user_id = fixture
    with factory() as db:
        assert not request_reset_delivery(db, settings=settings, user=None, fingerprint="synthetic", now=NOW)
        assert request_reset_delivery(db, settings=settings, user=db.get(User, user_id), fingerprint="synthetic", now=NOW)
        db.rollback()
        assert db.scalars(select(PasswordResetChallenge)).all() == []
        assert db.scalars(select(SecurityEmailDelivery)).all() == []
        for offset in (0, 1):
            request_reset_delivery(db, settings=settings, user=db.get(User, user_id), fingerprint="synthetic", now=NOW + timedelta(seconds=offset))
            db.commit()
        challenges = db.scalars(select(PasswordResetChallenge).order_by(PasswordResetChallenge.created_at)).all()
        assert challenges[0].used_at and challenges[1].used_at is None
        assert challenges[1].expires_at == NOW + timedelta(minutes=15, seconds=1)
        rows = db.scalars(select(SecurityEmailDelivery).order_by(SecurityEmailDelivery.created_at)).all()
        assert rows[0].state == "cancelled" and rows[0].payload_ciphertext is None
        assert "#password-reset=" in payload(rows[1])["body"]
        assert challenges[1].token_hash.encode() not in rows[1].payload_ciphertext


def test_security_event_dedup_delivery_and_plaintext_erasure(fixture):
    factory, settings, user_id = fixture
    with factory() as db:
        for _ in range(2):
            enqueue_security_event(db, settings=settings, user_id=user_id,
                event_type="auth.totp_enabled", event_id="same-event", now=NOW)
        db.commit()
        assert len(db.scalars(select(SecurityEmailDelivery)).all()) == 1
    sent = []
    class SMTP:
        def __init__(self, host, port, *, timeout):
            assert (host, port, timeout) == ("smtp.example.test", 587, 10)
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def starttls(self, *, context): assert context.check_hostname
        def send_message(self, message): sent.append(message)
    assert process_one_security_email(session_factory=factory, settings=settings, now=NOW, smtp_factory=SMTP)
    assert not process_one_security_email(session_factory=factory, settings=settings, now=NOW, smtp_factory=SMTP)
    assert len(sent) == 1 and sent[0]["From"] == "security@example.test"
    with factory() as db:
        row = db.scalar(select(SecurityEmailDelivery))
        assert row.state == "sent" and row.payload_ciphertext is None and row.payload_nonce is None


def test_email_retry_is_bounded_and_expired_links_never_send(fixture):
    factory, settings, user_id = fixture
    with factory() as db:
        request_reset_delivery(db, settings=settings, user=db.get(User, user_id), fingerprint="synthetic", now=NOW)
        db.commit()
    def timeout(*args, **kwargs): raise TimeoutError("synthetic transport failure")
    for seconds in (0, 60, 180):
        assert process_one_security_email(session_factory=factory, settings=settings, now=NOW+timedelta(seconds=seconds), smtp_factory=timeout)
    with factory() as db:
        row = db.scalar(select(SecurityEmailDelivery))
        assert (row.state, row.attempt_count, row.error_code) == ("exhausted", 3, "transport_timeout")
        assert row.payload_ciphertext is None
        request_reset_delivery(db, settings=settings, user=db.get(User, user_id), fingerprint="synthetic", now=NOW)
        db.commit()
    assert process_one_security_email(session_factory=factory, settings=settings, now=NOW+timedelta(minutes=16), smtp_factory=lambda *a, **k: pytest.fail("expired link sent"))
    with factory() as db:
        row = db.scalars(select(SecurityEmailDelivery).where(SecurityEmailDelivery.state == "expired")).one()
        assert row.payload_ciphertext is None and row.attempt_count == 0

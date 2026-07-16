from __future__ import annotations

import json, sys, threading
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))

@pytest.fixture(autouse=True)
def env(monkeypatch):
    monkeypatch.setenv("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("STUDIO_COOKIE_SECURE", "false")
    monkeypatch.setenv("STUDIO_APP_ORIGIN", "https://studio.test")

@pytest.fixture()
def db():
    from studio_api.db import Base
    import studio_api.models  # noqa
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    session = Session()
    try:
        yield session
    finally:
        session.close(); Base.metadata.drop_all(engine); engine.dispose()

def user_project_job(db):
    from studio_api import models as m
    u=m.User(email="u@example.com", role=m.UserRole.user, status=m.UserStatus.active); db.add(u); db.flush()
    p=m.Project(owner_user_id=u.id, title="Secret Project"); db.add(p); db.flush()
    j=m.TranscriptionJob(project_id=p.id, owner_user_id=u.id, status=m.JobStatus.queued); db.add(j); db.commit()
    return u,p,j

def test_model_table_constraints_and_audit_separate(db):
    from studio_api import models as m
    names=set(inspect(db.bind).get_table_names())
    assert "diagnostic_events" in names and "audit_events" in names
    assert {c.name for c in m.DiagnosticEvent.__table__.columns} >= {"owner_user_id","project_id","job_id","level","component","event_code","metadata_json","dedup_fingerprint","expires_at"}
    assert "dedup_fingerprint" not in {c.name for c in m.AuditEvent.__table__.columns}

def test_writer_sanitizes_retains_and_deduplicates(db):
    from studio_api import models as m
    from studio_api.diagnostics import write_diagnostic_event
    u,p,j=user_project_job(db)
    Session=sessionmaker(bind=db.bind, expire_on_commit=False)
    now=datetime(2026,7,16,12,0,0)
    assert write_diagnostic_event(owner_user_id=u.id, component="api", event_code="UNKNOWN", session_factory=Session).accepted is False
    assert write_diagnostic_event(owner_user_id=u.id, component="api", event_code="JOB_CREATED", project_id=p.id, job_id=j.id, metadata={"source_count": 1, "token": "secret"}, session_factory=Session).accepted is False
    assert write_diagnostic_event(owner_user_id=u.id, component="api", event_code="JOB_CREATED", project_id=p.id, job_id=j.id, metadata={"source_count": 1, "credential_selected": True}, session_factory=Session, now=now).persisted
    assert write_diagnostic_event(owner_user_id=u.id, component="api", event_code="JOB_CREATED", project_id=p.id, job_id=j.id, metadata={"source_count": 1, "credential_selected": True}, session_factory=Session, now=now+timedelta(minutes=1)).persisted
    db.expire_all(); row=db.query(m.DiagnosticEvent).one(); db.refresh(row)
    assert row.occurrence_count == 2 and json.loads(row.metadata_json) == {"credential_selected": True, "source_count": 1}
    assert timedelta(days=13, hours=23) < row.expires_at - now <= timedelta(days=14)
    from studio_api.diagnostics import expiry_for
    assert expiry_for("DEBUG", now) - now <= timedelta(hours=24)

def test_event_registry_is_event_specific_and_redacts_values(db):
    from studio_api.diagnostics import sanitize_metadata, write_diagnostic_event
    u,p,j=user_project_job(db)
    Session=sessionmaker(bind=db.bind, expire_on_commit=False)
    assert sanitize_metadata("JOB_CREATED", {"source_count": 1, "credential_selected": False, "attempt_number": 1}) is None
    assert sanitize_metadata("PROCESSING_STARTED", {"attempt_number": 1, "source_count": 1}) is None
    assert sanitize_metadata("PROVIDER_REQUEST_FAILED", {"boundary": "provider_transport", "error_code": "provider_timeout", "retryable": True, "attempt_number": 1})
    bad_values = [
        "sk_live_secret_123",
        "Bearer abcdef",
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig",
        "user@example.com",
        "https://example.invalid/path",
        "folder/object/key",
        "secret.mp3",
        "first line\nsecond line",
        "Traceback (most recent call last)",
    ]
    for value in bad_values:
        assert sanitize_metadata("PROVIDER_REQUEST_FAILED", {"boundary": "provider_transport", "error_code": value, "retryable": False, "attempt_number": 1}) is None
        assert write_diagnostic_event(owner_user_id=u.id, component="worker", event_code="PROVIDER_REQUEST_FAILED", project_id=p.id, job_id=j.id, metadata={"boundary": value, "error_code": "unknown", "retryable": False, "attempt_number": 1}, session_factory=Session).accepted is False

def test_writer_scope_ownership_and_project_job_coherence(db):
    from studio_api import models as m
    from studio_api.diagnostics import write_diagnostic_event
    u,p,j=user_project_job(db)
    other=m.User(email="other-scope@example.com", role=m.UserRole.user, status=m.UserStatus.active); db.add(other); db.flush()
    other_project=m.Project(owner_user_id=other.id, title="Other"); db.add(other_project); db.flush()
    other_job=m.TranscriptionJob(project_id=other_project.id, owner_user_id=other.id, status=m.JobStatus.queued); db.add(other_job); db.commit()
    Session=sessionmaker(bind=db.bind, expire_on_commit=False)
    meta={"source_count": 1, "credential_selected": False}
    assert write_diagnostic_event(owner_user_id=u.id, component="api", event_code="JOB_CREATED", project_id=other_project.id, job_id=j.id, metadata=meta, session_factory=Session).accepted is False
    assert write_diagnostic_event(owner_user_id=u.id, component="api", event_code="JOB_CREATED", project_id=p.id, job_id=other_job.id, metadata=meta, session_factory=Session).accepted is False
    assert write_diagnostic_event(owner_user_id=u.id, component="api", event_code="JOB_CREATED", project_id=other_project.id, job_id=other_job.id, metadata=meta, session_factory=Session).accepted is False
    assert db.query(m.DiagnosticEvent).count() == 0

def test_concurrent_dedup_increments_are_not_lost(tmp_path):
    from studio_api.db import Base
    import studio_api.models as m
    from studio_api.diagnostics import write_diagnostic_event
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path/'diag.db'}", connect_args={"check_same_thread": False, "timeout": 30})
    Base.metadata.create_all(engine)
    Session=sessionmaker(bind=engine, expire_on_commit=False)
    with Session() as setup:
        u=m.User(email="concurrent@example.com", role=m.UserRole.user, status=m.UserStatus.active); setup.add(u); setup.flush()
        p=m.Project(owner_user_id=u.id, title="P"); setup.add(p); setup.flush()
        j=m.TranscriptionJob(project_id=p.id, owner_user_id=u.id, status=m.JobStatus.queued); setup.add(j); setup.commit()
        uid,pid,jid=u.id,p.id,j.id
    results=[]
    def write_one():
        results.append(write_diagnostic_event(owner_user_id=uid, component="api", event_code="JOB_CREATED", project_id=pid, job_id=jid, metadata={"source_count": 1, "credential_selected": False}, session_factory=Session, now=datetime(2026,7,16,12,0,0)).persisted)
    threads=[threading.Thread(target=write_one) for _ in range(8)]
    for t in threads: t.start()
    for t in threads: t.join()
    with Session() as check:
        row=check.query(m.DiagnosticEvent).one()
        assert all(results)
        assert row.occurrence_count == 8
    Base.metadata.drop_all(engine); engine.dispose()

def test_writer_failure_does_not_raise_or_commit_caller(db):
    from studio_api import models as m
    from studio_api.diagnostics import write_diagnostic_event
    u,p,j=user_project_job(db)
    pending=m.Project(owner_user_id=u.id, title="caller state"); db.add(pending)
    class BadSession:
        def query(self, *a, **k): raise RuntimeError("boom secret-token")
        def rollback(self): pass
        def close(self): pass
    result=write_diagnostic_event(owner_user_id=u.id, component="api", event_code="JOB_CREATED", project_id=p.id, job_id=j.id, metadata={"source_count": 1, "credential_selected": False}, session_factory=lambda: BadSession())
    assert result.accepted and not result.persisted
    db.rollback()
    assert db.query(m.Project).filter_by(title="caller state").count() == 0

def test_request_ids_headers(monkeypatch, db):
    from fastapi.testclient import TestClient
    import studio_api.main as main
    monkeypatch.setattr(main.limiter, "check", lambda *a, **k: None)
    monkeypatch.setattr(main.limiter, "check", lambda *a, **k: None)
    monkeypatch.setattr(main, "cleanup_expired_diagnostics", lambda *a, **k: None)
    def override_db(): yield db
    main.app.dependency_overrides[main.get_db]=override_db
    client=TestClient(main.app)
    r=client.get("/api/auth/bootstrap-status", headers={"X-Correlation-ID":"bad https://evil.test/token"})
    assert r.headers["X-Request-ID"].startswith("req_")
    assert r.headers["X-Correlation-ID"].startswith("corr_") and "evil" not in r.headers["X-Correlation-ID"]
    good="corr_Abcdefgh1234567890"
    r=client.get("/api/auth/bootstrap-status", headers={"X-Correlation-ID":good})
    assert r.headers["X-Correlation-ID"] == good
    r=client.get("/api/diagnostics/events?page_size=999", headers={"X-Correlation-ID":"Bearer abc"})
    assert r.status_code in {401, 422}
    assert r.headers["X-Request-ID"].startswith("req_")
    assert r.headers["X-Correlation-ID"].startswith("corr_") and "Bearer" not in r.headers["X-Correlation-ID"]
    if not any(route.path == "/__diagnostics_test_boom" for route in main.app.routes):
        @main.app.get("/__diagnostics_test_boom")
        def _diagnostics_test_boom():
            raise RuntimeError("secret stack trace should not escape")
    r=client.get("/__diagnostics_test_boom")
    assert r.status_code == 500 and r.json() == {"detail": "Internal server error"}
    assert r.headers["X-Request-ID"].startswith("req_") and r.headers["X-Correlation-ID"].startswith("corr_")
    assert "secret" not in r.text
    main.app.dependency_overrides.clear()

def test_query_cursor_system_and_markdown_report(db, monkeypatch):
    from fastapi.testclient import TestClient
    import studio_api.main as main
    from studio_api import models as m
    from studio_api.diagnostics import write_diagnostic_event
    u,p,j=user_project_job(db)
    other=m.User(email="other@example.com", role=m.UserRole.user, status=m.UserStatus.active); db.add(other); db.commit()
    Session=sessionmaker(bind=db.bind, expire_on_commit=False)
    for i in range(3):
        write_diagnostic_event(owner_user_id=u.id, component="api", event_code="JOB_CREATED", project_id=p.id, job_id=j.id, metadata={"source_count": i+1, "credential_selected": False}, session_factory=Session, now=datetime(2026,7,16,12,i,0))
    write_diagnostic_event(owner_user_id=other.id, component="api", event_code="JOB_CREATED", metadata={"source_count": 1, "credential_selected": False}, session_factory=Session)
    sess=m.Session(user_id=u.id, token_hash="hash", csrf_hash="csrf", expires_at=datetime(2027,1,1)); db.add(sess); db.commit()
    def override_db(): yield db
    def override_current(): return sess,u
    def override_csrf(): return sess,u
    main.app.dependency_overrides[main.get_db]=override_db
    main.app.dependency_overrides[main.current_session]=override_current
    main.app.dependency_overrides[main.require_csrf]=override_csrf
    monkeypatch.setattr(main.limiter, "check", lambda *a, **k: None)
    monkeypatch.setattr(main, "cleanup_expired_diagnostics", lambda *a, **k: None)
    client=TestClient(main.app)
    db.expire_all()
    r=client.get("/api/diagnostics/events?page_size=2&start=2026-07-16T00:00:00&end=2026-07-17T00:00:00")
    assert r.status_code == 200 and len(r.json()["events"]) == 2 and r.json()["next_cursor"]
    cursor = r.json()["next_cursor"]
    second=client.get(f"/api/diagnostics/events?page_size=2&start=2026-07-16T00:00:00&end=2026-07-17T00:00:00&cursor={cursor}")
    assert second.status_code == 200 and {e["id"] for e in second.json()["events"]}.isdisjoint({e["id"] for e in r.json()["events"]})
    assert client.get(f"/api/diagnostics/events?page_size=2&start=2026-07-16T00:00:00&end=2026-07-17T00:00:00&cursor={cursor[:-1]}A").status_code == 422
    assert client.get(f"/api/diagnostics/events?page_size=2&start=2026-07-16T00:00:00&end=2026-07-17T00:00:00&level=ERROR&cursor={cursor}").status_code == 422
    assert client.get("/api/diagnostics/events?cursor=" + ("a"*1201)).status_code == 422
    assert "dedup_fingerprint" not in str(r.json()) and "expires_at" not in str(r.json()) and "other@example.com" not in str(r.json())
    assert client.get("/api/diagnostics/events?start=2026-01-01T00:00:00&end=2026-01-10T00:00:00").status_code == 422
    sysr=client.get("/api/diagnostics/system").json()
    assert set(sysr["build"]) == {"web","api","worker"} and "sqlite" not in str(sysr) and "example.com" not in str(sysr)
    report=client.post("/api/diagnostics/report.md", json={"start":"2026-07-16T00:00:00","end":"2026-07-17T00:00:00","project_id":p.id,"job_id":j.id}, headers={"Origin":"https://studio.test", "X-CSRF-Token":"x"})
    assert report.status_code == 200
    assert report.headers["content-type"].startswith("text/markdown") and "studio-diagnostics-report.md" in report.headers["content-disposition"]
    text=report.text
    assert "Chronological diagnostic timeline" in text and "Event counts by level" in text and "Secret Project" not in text and "<script" not in text and "http://" not in text and "https://" not in text
    main.app.dependency_overrides.clear()

def test_report_requires_real_same_origin_and_csrf(db, monkeypatch):
    from fastapi.testclient import TestClient
    import studio_api.main as main
    from studio_api import models as m
    from studio_api.security import token_hash
    u,p,j=user_project_job(db)
    sess=m.Session(user_id=u.id, token_hash="hash", csrf_hash=token_hash("csrf-raw"), expires_at=datetime(2027,1,1)); db.add(sess); db.commit()
    def override_db(): yield db
    def override_current(): return sess,u
    main.app.dependency_overrides[main.get_db]=override_db
    main.app.dependency_overrides[main.current_session]=override_current
    monkeypatch.setattr(main.limiter, "check", lambda *a, **k: None)
    client=TestClient(main.app)
    payload={"start":"2026-07-16T00:00:00","end":"2026-07-17T00:00:00","project_id":p.id,"job_id":j.id}
    assert client.post("/api/diagnostics/report.md", json=payload, headers={"Origin":"https://evil.test", "X-CSRF-Token":"csrf-raw"}).status_code == 403
    assert client.post("/api/diagnostics/report.md", json=payload, headers={"Origin":"https://studio.test", "X-CSRF-Token":"wrong"}).status_code == 403
    ok=client.post("/api/diagnostics/report.md", json=payload, headers={"Origin":"https://studio.test", "X-CSRF-Token":"csrf-raw"})
    assert ok.status_code == 200
    assert ok.headers["content-type"] == "text/markdown; charset=utf-8"
    assert ok.headers["cache-control"] == "no-store"
    main.app.dependency_overrides.clear()

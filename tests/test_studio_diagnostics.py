from __future__ import annotations

import json, sys
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
    now=datetime(2026,1,1,12,0,0)
    assert write_diagnostic_event(owner_user_id=u.id, component="api", event_code="UNKNOWN", session_factory=Session).accepted is False
    assert write_diagnostic_event(owner_user_id=u.id, component="api", event_code="JOB_CREATED", project_id=p.id, job_id=j.id, metadata={"source_count": 1, "token": "secret"}, session_factory=Session).accepted is False
    assert write_diagnostic_event(owner_user_id=u.id, component="api", event_code="JOB_CREATED", project_id=p.id, job_id=j.id, metadata={"source_count": 1, "credential_selected": True}, session_factory=Session, now=now).persisted
    assert write_diagnostic_event(owner_user_id=u.id, component="api", event_code="JOB_CREATED", project_id=p.id, job_id=j.id, metadata={"source_count": 1, "credential_selected": True}, session_factory=Session, now=now+timedelta(minutes=1)).persisted
    row=db.query(m.DiagnosticEvent).one(); db.refresh(row)
    assert row.occurrence_count == 2 and json.loads(row.metadata_json) == {"credential_selected": True, "source_count": 1}
    assert timedelta(days=13, hours=23) < row.expires_at - now <= timedelta(days=14)
    assert write_diagnostic_event(owner_user_id=u.id, component="worker", event_code="PROVIDER_REQUEST_FAILED", level="DEBUG", metadata={"error_code":"provider_timeout","retryable": True}, session_factory=Session, now=now).persisted
    debug=db.query(m.DiagnosticEvent).filter_by(level=m.DiagnosticLevel.DEBUG).one()
    assert debug.expires_at - now <= timedelta(hours=24)

def test_writer_failure_does_not_raise_or_commit_caller(db):
    from studio_api import models as m
    from studio_api.diagnostics import write_diagnostic_event
    u,p,j=user_project_job(db)
    pending=m.Project(owner_user_id=u.id, title="caller state"); db.add(pending)
    class BadSession:
        def query(self, *a, **k): raise RuntimeError("boom secret-token")
        def rollback(self): pass
        def close(self): pass
    result=write_diagnostic_event(owner_user_id=u.id, component="api", event_code="JOB_CREATED", project_id=p.id, job_id=j.id, session_factory=lambda: BadSession())
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
    good="corr_Abcdefgh1234"
    r=client.get("/api/auth/bootstrap-status", headers={"X-Correlation-ID":good})
    assert r.headers["X-Correlation-ID"] == good
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
        write_diagnostic_event(owner_user_id=u.id, component="api", event_code="JOB_CREATED", project_id=p.id, job_id=j.id, metadata={"source_count": i+1}, session_factory=Session, now=datetime(2026,1,1,12,i,0))
    write_diagnostic_event(owner_user_id=other.id, component="api", event_code="JOB_CREATED", metadata={"source_count": 1}, session_factory=Session)
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
    r=client.get("/api/diagnostics/events?page_size=2&start=2026-01-01T00:00:00&end=2026-01-02T00:00:00")
    assert r.status_code == 200 and len(r.json()["events"]) == 2 and r.json()["next_cursor"]
    assert "dedup_fingerprint" not in str(r.json()) and "expires_at" not in str(r.json()) and "other@example.com" not in str(r.json())
    assert client.get("/api/diagnostics/events?start=2026-01-01T00:00:00&end=2026-01-10T00:00:00").status_code == 422
    sysr=client.get("/api/diagnostics/system").json()
    assert set(sysr["build"]) == {"web","api","worker"} and "sqlite" not in str(sysr) and "example.com" not in str(sysr)
    report=client.post("/api/diagnostics/report.md", json={"start":"2026-01-01T00:00:00","end":"2026-01-02T00:00:00","project_id":p.id,"job_id":j.id}, headers={"Origin":"https://studio.test", "X-CSRF-Token":"x"})
    assert report.status_code == 200
    assert report.headers["content-type"].startswith("text/markdown") and "studio-diagnostics-report.md" in report.headers["content-disposition"]
    text=report.text
    assert "Chronological diagnostic timeline" in text and "Event counts by level" in text and "Secret Project" not in text and "<script" not in text and "http://" not in text and "https://" not in text
    main.app.dependency_overrides.clear()

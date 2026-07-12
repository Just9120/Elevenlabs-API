import base64
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))
os.environ.setdefault("STUDIO_DATABASE_SCHEME", "postgresql+psycopg")
os.environ.setdefault("STUDIO_DATABASE_HOST", "127.0.0.1")
os.environ.setdefault("STUDIO_DATABASE_PORT", "5432")
os.environ.setdefault("STUDIO_DATABASE_NAME", "studio_test")
os.environ.setdefault("STUDIO_DATABASE_USER", "studio_test")
os.environ.setdefault("STUDIO_POSTGRES_PASSWORD_FILE", str(Path(tempfile.gettempdir()) / "studio_test_pg_password"))
os.environ.setdefault("STUDIO_REDIS_URL", "redis://127.0.0.1:6379/0")
os.environ.setdefault("STUDIO_APP_ORIGIN", "https://studio.test")
os.environ.setdefault("STUDIO_COOKIE_SECURE", "false")
os.environ.setdefault("STUDIO_CREDENTIAL_MASTER_KEY_FILE", str(Path(tempfile.gettempdir()) / "studio_test_master_key"))
Path(os.environ["STUDIO_POSTGRES_PASSWORD_FILE"]).write_text(os.environ.get("STUDIO_TEST_POSTGRES_PASSWORD", "studio_test_password"), encoding="utf-8")
Path(os.environ["STUDIO_CREDENTIAL_MASTER_KEY_FILE"]).write_text(base64.b64encode(b"1" * 32).decode(), encoding="utf-8")

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi.testclient import TestClient
from starlette.requests import Request
from sqlalchemy import inspect, select, text
from sqlalchemy.exc import OperationalError
from studio_api.config import Settings
from studio_api.db import SessionLocal, engine
from studio_api.deps import get_client_ip
from studio_api.main import app, limiter
from studio_api.models import AuditEvent, JobStatus, LocalIdentity, Project, ProviderCredentialVersion, Source, SourceType, SourceUploadStatus, TranscriptionJob, TranscriptionJobOutput, TranscriptionJobSource, User, UserRole, UserStatus
from studio_api.security import aad, decrypt, encrypt, hash_password, master_key_from_b64, utcnow, verify_password
from studio_api.job_claim_lease import JobLeaseError, JobLeaseFailureReason, acquire_job_lease, acquire_next_ready_job_lease, is_lease_active, release_job_lease, renew_job_lease
from studio_api.job_processing_lifecycle import JobProcessingError, JobProcessingFailureReason, acknowledge_job_cancellation, begin_job_processing, fail_job_processing, recover_expired_processing_job
from studio_api.google_docs_output import GoogleDocsCreateResult, new_google_docs_transcript_artifact
from studio_api.job_output_persistence import JobOutputPersistenceError, JobOutputPersistenceReason, _load_locked_output_authority, persist_processing_job_source_output_and_maybe_complete

ALEMBIC = ROOT / "apps/studio-api/alembic.ini"

@pytest.fixture(scope="session", autouse=True)
def migrated_database():
    subprocess.run([sys.executable, "-m", "alembic", "-c", str(ALEMBIC), "upgrade", "head"], cwd=ROOT, check=True)
    yield

@pytest.fixture(autouse=True)
def clean_state(migrated_database):
    try:
        limiter.redis.flushdb()
    except Exception as exc:
        pytest.skip(f"Redis unavailable for platform tests: {exc}")
    with engine.begin() as conn:
        tables = ["audit_events", "google_oauth_states", "google_connections", "provider_credential_versions", "provider_credentials", "transcription_job_outputs", "transcription_job_sources", "transcription_jobs", "sources", "projects", "sessions", "login_contexts", "local_identities", "users"]
        conn.execute(text("TRUNCATE " + ", ".join(tables) + " RESTART IDENTITY CASCADE"))
    yield


def admin(email="a@example.com", password="correct horse battery"):
    db = SessionLocal()
    u = User(email=email, role=UserRole.admin, status=UserStatus.active)
    db.add(u); db.flush(); db.add(LocalIdentity(user_id=u.id, password_hash=hash_password(password))); db.commit(); db.close()
    return password


def login(c, password, email="a@example.com"):
    r = c.post("/api/auth/login-context", headers={"origin": "https://studio.test"}); assert r.status_code == 200
    token = r.json()["login_csrf_token"]
    r = c.post("/api/auth/login", json={"email": email, "password": password, "login_csrf_token": token}, headers={"origin": "https://studio.test"}); assert r.status_code == 200
    return r.json()["csrf_token"]


def test_password_hashing_argon2id():
    h = hash_password("secret-password-123")
    assert "argon2id" in h
    assert verify_password(h, "secret-password-123")
    assert not verify_password(h, "bad")


def test_alembic_upgrade_and_readiness_current():
    c = TestClient(app)
    r = c.get("/api/healthz")
    assert r.status_code == 200
    assert r.json() == {"ok": True, "database": "reachable", "migrations": "current"}


def test_readiness_non_200_when_migrations_pending():
    cfg = Config(str(ALEMBIC)); head = ScriptDirectory.from_config(cfg).get_current_head()
    with engine.begin() as conn:
        conn.execute(text("UPDATE alembic_version SET version_num='pending_test'"))
    try:
        assert TestClient(app).get("/api/healthz").status_code == 503
    finally:
        with engine.begin() as conn:
            conn.execute(text("UPDATE alembic_version SET version_num=:head"), {"head": head})


def test_login_refresh_csrf_session_cookie_and_logout_after_refresh():
    pw = admin(); c = TestClient(app)
    assert c.post("/api/auth/login", json={"email": "a@example.com", "password": pw, "login_csrf_token": "bad"}, headers={"origin": "https://studio.test"}).status_code == 403
    csrf = login(c, pw)
    assert c.get("/api/auth/session").json()["authenticated"] is True
    refreshed = c.post("/api/auth/csrf", headers={"origin": "https://studio.test"})
    assert refreshed.status_code == 200 and refreshed.json()["csrf_token"] != csrf
    assert c.post("/api/auth/logout", headers={"origin": "https://studio.test", "x-csrf-token": refreshed.json()["csrf_token"]}).status_code == 200
    assert c.get("/api/auth/session").status_code == 401


def test_same_origin_and_authenticated_csrf_required():
    pw = admin(); c = TestClient(app); csrf = login(c, pw)
    assert c.post("/api/auth/logout", headers={"origin": "https://evil.test", "x-csrf-token": csrf}).status_code == 403
    assert c.post("/api/auth/logout", headers={"origin": "https://studio.test", "x-csrf-token": "bad"}).status_code == 403


def test_credential_lifecycle_no_raw_secret_echo_and_audit_safe():
    pw = admin(); raw = "sk-test-secret-value-123456"
    with TestClient(app) as c:
        csrf = login(c, pw)
        r = c.post("/api/credentials", json={"provider": "openai", "label": "main", "raw_value": raw}, headers={"origin": "https://studio.test", "x-csrf-token": csrf}); assert r.status_code == 200; cid = r.json()["id"]; assert raw not in r.text
        r = c.get("/api/credentials"); assert raw not in r.text and "••••" in r.text
        r = c.post(f"/api/credentials/{cid}/replace", json={"provider": "openai", "label": "main", "raw_value": "sk-test-new-secret-abcdef"}, headers={"origin": "https://studio.test", "x-csrf-token": csrf}); assert r.status_code == 200
        r = c.post(f"/api/credentials/{cid}/revoke", headers={"origin": "https://studio.test", "x-csrf-token": csrf}); assert r.status_code == 200
        r = c.delete(f"/api/credentials/{cid}", headers={"origin": "https://studio.test", "x-csrf-token": csrf}); assert r.status_code == 200
    db = SessionLocal()
    try:
        assert raw not in "\n".join(a.metadata_json for a in db.query(AuditEvent).all())
        assert all(v.ciphertext is None for v in db.query(ProviderCredentialVersion).all())
    finally:
        db.close()


def test_aes_gcm_unique_nonce_and_aad_binding():
    key = master_key_from_b64(base64.b64encode(b"2" * 32).decode()); associated = aad("u", "c", "v", "openai")
    c1, n1 = encrypt("secret", key, associated); c2, n2 = encrypt("secret", key, associated)
    assert n1 != n2 and c1 != c2 and decrypt(c1, n1, key, associated) == "secret"
    with pytest.raises(Exception): decrypt(c1, n1, key, aad("u", "c", "other", "openai"))


def test_bootstrap_status():
    c = TestClient(app); assert c.get("/api/auth/bootstrap-status").json()["bootstrap_required"] is True; admin(); assert c.get("/api/auth/bootstrap-status").json()["bootstrap_required"] is False


def request_with_peer(peer: tuple[str, int], forwarded_for: str) -> Request:
    return Request({"type": "http", "method": "GET", "path": "/", "headers": [(b"x-forwarded-for", forwarded_for.encode())], "client": peer})


def test_spoofed_forwarded_for_ignored_without_trusted_proxy():
    settings = Settings(trusted_proxy_ip="127.0.0.1")
    spoofed = request_with_peer(("8.8.8.8", 12345), "1.2.3.4")
    trusted = request_with_peer(("127.0.0.1", 12345), "1.2.3.4")

    assert get_client_ip(spoofed, settings) == "8.8.8.8"
    assert get_client_ip(trusted, settings) == "1.2.3.4"


def test_secret_boundary_static_assertions():
    compose = (ROOT / "deploy/studio/compose.platform.yml").read_text(encoding="utf-8")
    deploy = (ROOT / "scripts/deploy_studio_platform.sh").read_text(encoding="utf-8")
    migrate = (ROOT / "scripts/migrate_studio_platform.sh").read_text(encoding="utf-8")
    assert "STUDIO_POSTGRES_PASSWORD:" not in compose
    assert "postgresql+psycopg://studio:${" not in compose
    assert "export STUDIO_POSTGRES_PASSWORD" not in deploy + migrate



def test_projects_require_authentication():
    c = TestClient(app)
    assert c.get("/api/projects").status_code == 401
    assert c.post("/api/projects", json={"title": "Project"}, headers={"origin": "https://studio.test", "x-csrf-token": "bad"}).status_code == 401


def test_project_create_list_update_archive_lifecycle_and_archived_excluded():
    pw = admin(); c = TestClient(app); csrf = login(c, pw)
    r = c.post("/api/projects", json={"title": "  First project  ", "description": "  Notes  "}, headers={"origin": "https://studio.test", "x-csrf-token": csrf})
    assert r.status_code == 200
    created = r.json()
    assert created["title"] == "First project"
    assert created["description"] == "Notes"
    assert created["owner_user_id"]
    assert created["archived_at"] is None

    r = c.patch(f"/api/projects/{created['id']}", json={"title": "Renamed", "description": ""}, headers={"origin": "https://studio.test", "x-csrf-token": csrf})
    assert r.status_code == 200
    assert r.json()["title"] == "Renamed"
    assert r.json()["description"] is None

    r = c.get("/api/projects")
    assert r.status_code == 200
    assert [p["id"] for p in r.json()["projects"]] == [created["id"]]

    r = c.post(f"/api/projects/{created['id']}/archive", headers={"origin": "https://studio.test", "x-csrf-token": csrf})
    assert r.status_code == 200
    assert c.get("/api/projects").json()["projects"] == []
    assert c.patch(f"/api/projects/{created['id']}", json={"title": "Nope"}, headers={"origin": "https://studio.test", "x-csrf-token": csrf}).status_code == 404


def test_project_ownership_isolation_between_users():
    pw1 = admin("owner@example.com")
    pw2 = admin("other@example.com")
    c1 = TestClient(app); c2 = TestClient(app)
    csrf1 = login(c1, pw1, "owner@example.com")
    csrf2 = login(c2, pw2, "other@example.com")
    r = c1.post("/api/projects", json={"title": "Owner only"}, headers={"origin": "https://studio.test", "x-csrf-token": csrf1})
    pid = r.json()["id"]
    assert c2.get("/api/projects").json()["projects"] == []
    assert c2.patch(f"/api/projects/{pid}", json={"title": "Stolen"}, headers={"origin": "https://studio.test", "x-csrf-token": csrf2}).status_code == 404
    assert c2.post(f"/api/projects/{pid}/archive", headers={"origin": "https://studio.test", "x-csrf-token": csrf2}).status_code == 404
    assert c1.get("/api/projects").json()["projects"][0]["title"] == "Owner only"


def test_project_validation_failures():
    pw = admin(); c = TestClient(app); csrf = login(c, pw)
    headers = {"origin": "https://studio.test", "x-csrf-token": csrf}
    assert c.post("/api/projects", json={"title": "   "}, headers=headers).status_code == 422
    assert c.post("/api/projects", json={"title": "x" * 161}, headers=headers).status_code == 422
    assert c.post("/api/projects", json={"title": "Ok", "description": "x" * 2001}, headers=headers).status_code == 422

class FakeStorage:
    def __init__(self):
        self.deleted = []
        self.head_size = 123
        self.head_type = "audio/mpeg"
        self.missing = False
    def presigned_put_url(self, key, content_type, expires_seconds):
        return f"https://upload.test/{key}?signature=fake"
    def head_object(self, key):
        if self.missing:
            raise FileNotFoundError(key)
        from studio_api.source_storage import ObjectHead
        return ObjectHead(size_bytes=self.head_size, content_type=self.head_type)
    def delete_object(self, key):
        self.deleted.append(key)


def enable_fake_storage(monkeypatch):
    from studio_api import main as main_mod
    fake = FakeStorage()
    main_mod.settings.source_s3_endpoint_url = "https://r2.example"
    main_mod.settings.source_s3_region = "auto"
    main_mod.settings.source_s3_bucket = "studio-temp"
    main_mod.settings.source_s3_access_key_id_file = "/tmp/no-secret-id"
    main_mod.settings.source_s3_secret_access_key_file = "/tmp/no-secret-key"
    main_mod.settings.source_max_upload_bytes = 1000
    main_mod.settings.source_upload_ttl_seconds = 3600
    main_mod.settings.source_presign_ttl_seconds = 900
    monkeypatch.setattr(main_mod, "get_source_storage", lambda settings: fake)
    return fake


def create_logged_in_project(email="sources@example.com"):
    pw = admin(email)
    c = TestClient(app)
    csrf = login(c, pw, email)
    headers = {"origin": "https://studio.test", "x-csrf-token": csrf}
    r = c.post("/api/projects", json={"title": "Sources"}, headers=headers)
    assert r.status_code == 200
    return c, headers, r.json()["id"]



def create_gdrive_source(c, headers, pid, name="meeting.mp4"):
    r = c.post(f"/api/projects/{pid}/sources/google-drive", json={"drive_file_id": f"file_{name.replace('.', '_')}", "drive_file_url":"https://drive.google.com/file/d/file_123/view", "original_filename":name, "mime_type":"video/mp4", "size_bytes":42}, headers=headers)
    assert r.status_code == 200
    return r.json()["id"]


def add_local_source(pid, status=SourceUploadStatus.uploaded, deleted=False):
    db = SessionLocal()
    try:
        src = Source(project_id=pid, source_type=SourceType.local_upload, original_filename="local.mp3", mime_type="audio/mpeg", size_bytes=10, s3_bucket="studio-temp", s3_object_key="safe/object", upload_status=status, uploaded_at=utcnow() if status == SourceUploadStatus.uploaded else None, deleted_at=utcnow() if deleted else None, delete_reason="test" if deleted else None)
        db.add(src); db.commit(); return src.id
    finally:
        db.close()


def assert_job_response_safe(text):
    forbidden = ["raw-provider-secret", "ciphertext", "refresh-token", "oauth-state", "oauth-code", "raw_google", "presigned", "no-secret-key", "temporary-object-bytes", "safe/object"]
    lowered = text.lower()
    for value in forbidden:
        assert value.lower() not in lowered


def test_transcription_jobs_auth_and_csrf_required():
    c, headers, pid = create_logged_in_project("jobs-auth@example.com")
    sid = create_gdrive_source(c, headers, pid)
    anon = TestClient(app)
    assert anon.get(f"/api/projects/{pid}/jobs").status_code == 401
    assert anon.post(f"/api/projects/{pid}/jobs", json={"source_ids":[sid]}).status_code == 401
    assert c.post(f"/api/projects/{pid}/jobs", json={"source_ids":[sid]}).status_code == 403
    r = c.post(f"/api/projects/{pid}/jobs", json={"source_ids":[sid]}, headers=headers)
    assert r.status_code == 200
    jid = r.json()["id"]
    assert anon.get(f"/api/jobs/{jid}").status_code == 401
    assert anon.post(f"/api/jobs/{jid}/cancel").status_code == 401
    assert c.post(f"/api/jobs/{jid}/cancel").status_code == 403


def test_create_job_normalizes_blank_provider_credential_id_to_null():
    c, headers, pid = create_logged_in_project("jobs-blank-credential@example.com")
    sid = create_gdrive_source(c, headers, pid)
    for value in ["", "   "]:
        r = c.post(f"/api/projects/{pid}/jobs", json={"source_ids":[sid], "provider_credential_id":value}, headers=headers)
        assert r.status_code == 200
        assert r.json()["provider_credential_id"] is None
        assert_job_response_safe(r.text)
        assert "raw-provider-secret" not in r.text


def test_create_job_from_google_drive_and_local_sources_preserves_order_and_safe_metadata():
    c, headers, pid = create_logged_in_project("jobs-create@example.com")
    sid1 = create_gdrive_source(c, headers, pid, "first.mp4")
    sid2 = add_local_source(pid)
    raw = "raw-provider-secret"
    cred = c.post("/api/credentials", json={"provider":"openai", "label":"jobs", "raw_value":raw}, headers=headers).json()["id"]
    r = c.post(f"/api/projects/{pid}/jobs", json={"source_ids":[sid1, sid2], "provider_credential_id":cred, "title":" Batch ", "language":"EN_us", "options":{"diarize":False}}, headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "queued"
    assert body["source_count"] == 2
    assert [s["id"] for s in body["sources"]] == [sid1, sid2]
    assert [s["position"] for s in body["sources"]] == [0, 1]
    assert body["provider_credential_id"] == cred
    assert "drive_file_url" not in body["sources"][0]
    assert_job_response_safe(r.text)
    assert raw not in r.text
    detail = c.get(f"/api/jobs/{body['id']}")
    assert detail.status_code == 200
    assert [s["id"] for s in detail.json()["sources"]] == [sid1, sid2]
    listed = c.get(f"/api/projects/{pid}/jobs")
    assert listed.status_code == 200 and listed.json()["jobs"][0]["id"] == body["id"]



def test_job_creation_is_record_only_and_response_omits_processing_outputs():
    c, headers, pid = create_logged_in_project("jobs-record-only@example.com")
    sid = create_gdrive_source(c, headers, pid)
    r = c.post(f"/api/projects/{pid}/jobs", json={"source_ids":[sid]}, headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "queued"
    assert body["started_at"] is None
    assert body["finished_at"] is None
    assert body["cancelled_at"] is None
    assert body["error_code"] is None
    assert body["error_message"] is None
    assert "output" not in body
    assert "transcript" not in r.text.lower()
    assert "google_doc" not in r.text.lower()
    assert_job_response_safe(r.text)


def test_job_failure_metadata_response_redacts_sensitive_internal_values():
    c, headers, pid = create_logged_in_project("jobs-failure-safe@example.com")
    sid = create_gdrive_source(c, headers, pid)
    jid = c.post(f"/api/projects/{pid}/jobs", json={"source_ids":[sid]}, headers=headers).json()["id"]
    db = SessionLocal()
    try:
        job = db.get(TranscriptionJob, jid)
        job.status = JobStatus.failed
        job.error_code = "raw_provider_token"
        job.error_message = "Provider returned bearer token, transcript body, and /run/secrets/file-mounted-value"
        job.finished_at = utcnow()
        db.commit()
    finally:
        db.close()

    detail = c.get(f"/api/jobs/{jid}")
    assert detail.status_code == 200
    body = detail.json()
    assert body["status"] == "failed"
    assert body["error_code"] == "Недоступно"
    assert body["error_message"] == "Недоступно"
    assert "bearer" not in detail.text.lower()
    assert "transcript body" not in detail.text.lower()
    assert "file-mounted" not in detail.text.lower()
    assert_job_response_safe(detail.text)


def test_cancel_only_transitions_queued_jobs_and_leaves_terminal_jobs_unchanged():
    c, headers, pid = create_logged_in_project("jobs-cancel-terminal@example.com")
    queued_sid = create_gdrive_source(c, headers, pid, "queued.mp4")
    completed_sid = create_gdrive_source(c, headers, pid, "completed.mp4")
    failed_sid = create_gdrive_source(c, headers, pid, "failed.mp4")
    queued_id = c.post(f"/api/projects/{pid}/jobs", json={"source_ids":[queued_sid]}, headers=headers).json()["id"]
    completed_id = c.post(f"/api/projects/{pid}/jobs", json={"source_ids":[completed_sid]}, headers=headers).json()["id"]
    failed_id = c.post(f"/api/projects/{pid}/jobs", json={"source_ids":[failed_sid]}, headers=headers).json()["id"]

    db = SessionLocal()
    try:
        completed = db.get(TranscriptionJob, completed_id)
        completed.status = JobStatus.completed
        completed.finished_at = utcnow()
        failed = db.get(TranscriptionJob, failed_id)
        failed.status = JobStatus.failed
        failed.finished_at = utcnow()
        failed.error_code = "provider_unavailable"
        failed.error_message = "Provider unavailable"
        db.commit()
    finally:
        db.close()

    assert c.post(f"/api/jobs/{queued_id}/cancel", headers=headers).json()["status"] == "cancelled"
    completed_cancel = c.post(f"/api/jobs/{completed_id}/cancel", headers=headers)
    failed_cancel = c.post(f"/api/jobs/{failed_id}/cancel", headers=headers)
    assert completed_cancel.status_code == 200
    assert failed_cancel.status_code == 200
    assert completed_cancel.json()["status"] == "completed"
    assert completed_cancel.json()["cancelled_at"] is None
    assert failed_cancel.json()["status"] == "failed"
    assert failed_cancel.json()["cancelled_at"] is None
    assert failed_cancel.json()["error_message"] == "Provider unavailable"

    db = SessionLocal()
    try:
        events = [e.event_type for e in db.query(AuditEvent).filter(AuditEvent.event_type == "job.cancelled").all()]
        assert events == ["job.cancelled"]
    finally:
        db.close()

def test_create_job_rejects_invalid_source_sets_and_archived_project():
    c, headers, pid = create_logged_in_project("jobs-invalid@example.com")
    sid = create_gdrive_source(c, headers, pid)
    assert c.post(f"/api/projects/{pid}/jobs", json={"source_ids":[]}, headers=headers).status_code == 422
    assert c.post(f"/api/projects/{pid}/jobs", json={"source_ids":[sid, sid]}, headers=headers).status_code == 422
    c2, h2, pid2 = create_logged_in_project("jobs-other@example.com")
    sid_other = create_gdrive_source(c2, h2, pid2)
    assert c.post(f"/api/projects/{pid}/jobs", json={"source_ids":[sid_other]}, headers=headers).status_code == 422
    db = SessionLocal(); src = db.get(Source, sid); src.deleted_at = utcnow(); src.upload_status = SourceUploadStatus.deleted; db.commit(); db.close()
    assert c.post(f"/api/projects/{pid}/jobs", json={"source_ids":[sid]}, headers=headers).status_code == 422
    c.post(f"/api/projects/{pid}/archive", headers=headers)
    assert c.post(f"/api/projects/{pid}/jobs", json={"source_ids":[sid]}, headers=headers).status_code == 404


def test_create_job_rejects_unusable_local_upload_statuses():
    for status in [SourceUploadStatus.pending, SourceUploadStatus.expired, SourceUploadStatus.deleted, SourceUploadStatus.failed]:
        c, headers, pid = create_logged_in_project(f"jobs-{status.value}@example.com")
        sid = add_local_source(pid, status=status, deleted=(status == SourceUploadStatus.deleted))
        r = c.post(f"/api/projects/{pid}/jobs", json={"source_ids":[sid]}, headers=headers)
        assert r.status_code == 422


def test_job_list_owner_scope_and_cancel_idempotent_with_audit():
    c1, h1, pid1 = create_logged_in_project("jobs-owner1@example.com")
    c2, h2, pid2 = create_logged_in_project("jobs-owner2@example.com")
    sid1 = create_gdrive_source(c1, h1, pid1)
    sid2 = create_gdrive_source(c2, h2, pid2)
    jid1 = c1.post(f"/api/projects/{pid1}/jobs", json={"source_ids":[sid1]}, headers=h1).json()["id"]
    jid2 = c2.post(f"/api/projects/{pid2}/jobs", json={"source_ids":[sid2]}, headers=h2).json()["id"]
    assert [j["id"] for j in c1.get(f"/api/projects/{pid1}/jobs").json()["jobs"]] == [jid1]
    assert c1.get(f"/api/jobs/{jid2}").status_code == 404
    assert c1.post(f"/api/jobs/{jid2}/cancel", headers=h1).status_code == 404
    r1 = c1.post(f"/api/jobs/{jid1}/cancel", headers=h1)
    r2 = c1.post(f"/api/jobs/{jid1}/cancel", headers=h1)
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["status"] == "cancelled" and r2.json()["status"] == "cancelled"
    assert r1.json()["cancelled_at"] is not None
    db = SessionLocal()
    try:
        events = [e.event_type for e in db.query(AuditEvent).order_by(AuditEvent.created_at).all()]
        assert "job.created" in events and "job.cancelled" in events
        assert events.count("job.cancelled") == 1
    finally:
        db.close()

def test_project_drive_folder_binding_update_and_clear():
    c, headers, pid = create_logged_in_project("folder@example.com")
    payload = {"output_drive_folder_id": "abc_123-XYZ", "output_drive_folder_url": "https://drive.google.com/drive/folders/abc_123-XYZ", "output_drive_folder_name": " Results "}
    r = c.patch(f"/api/projects/{pid}", json=payload, headers=headers)
    assert r.status_code == 200
    assert r.json()["output_drive_folder_id"] == "abc_123-XYZ"
    assert r.json()["output_drive_folder_name"] == "Results"
    r = c.patch(f"/api/projects/{pid}", json={"output_drive_folder_id": None, "output_drive_folder_url": None, "output_drive_folder_name": None}, headers=headers)
    assert r.status_code == 200
    assert r.json()["output_drive_folder_id"] is None
    assert c.patch(f"/api/projects/{pid}", json={"output_drive_folder_url": "https://evil.test/x"}, headers=headers).status_code == 422


def test_google_drive_source_metadata_lifecycle_owner_scoped():
    c, headers, pid = create_logged_in_project("gdrive@example.com")
    r = c.post(f"/api/projects/{pid}/sources/google-drive", json={"drive_file_id":"file_123", "drive_file_url":"https://drive.google.com/file/d/file_123/view", "original_filename":"meeting.mp4", "mime_type":"video/mp4", "size_bytes":42}, headers=headers)
    assert r.status_code == 200
    sid = r.json()["id"]
    assert r.json()["source_type"] == "google_drive"
    assert "s3" not in r.text.lower()
    assert c.get(f"/api/projects/{pid}/sources").json()["sources"][0]["id"] == sid
    assert c.delete(f"/api/sources/{sid}", headers=headers).status_code == 200
    assert c.delete(f"/api/sources/{sid}", headers=headers).status_code == 200


def test_local_upload_initiate_requires_auth_ownership_and_validates(monkeypatch):
    fake = enable_fake_storage(monkeypatch)
    c, headers, pid = create_logged_in_project("local@example.com")
    assert TestClient(app).post(f"/api/projects/{pid}/sources/local-upload/initiate", json={"original_filename":"a.mp3","mime_type":"audio/mpeg","size_bytes":10}).status_code == 401
    assert c.post(f"/api/projects/{pid}/sources/local-upload/initiate", json={"original_filename":"a.txt","mime_type":"text/plain","size_bytes":10}, headers=headers).status_code == 422
    assert c.post(f"/api/projects/{pid}/sources/local-upload/initiate", json={"original_filename":"a.mp3","mime_type":"audio/mpeg","size_bytes":1001}, headers=headers).status_code == 422
    r = c.post(f"/api/projects/{pid}/sources/local-upload/initiate", json={"original_filename":"../secret song.mp3","mime_type":"audio/mpeg","size_bytes":10}, headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["source_id"]
    assert body["upload"]["method"] == "PUT"
    assert body["upload"]["expires_in"] == 900
    assert "/secret%20song" not in r.text and "secret song.mp3" not in r.text and "secret%20song.mp3" not in r.text
    assert "no-secret-id" not in r.text and "no-secret-key" not in r.text
    db = SessionLocal(); src = db.get(Source, body["source_id"]); object_key = src.s3_object_key; source_id = src.id; original_filename = src.original_filename; db.close()
    assert original_filename == "secret song.mp3"
    assert object_key.endswith(f"/projects/{pid}/sources/{source_id}/source")
    assert original_filename not in object_key


def test_local_upload_initiate_fails_closed_without_storage(monkeypatch):
    from studio_api import main as main_mod
    c, headers, pid = create_logged_in_project("nostorage@example.com")
    main_mod.settings.source_s3_endpoint_url = None
    main_mod.settings.source_s3_bucket = None
    r = c.post(f"/api/projects/{pid}/sources/local-upload/initiate", json={"original_filename":"a.mp3","mime_type":"audio/mpeg","size_bytes":10}, headers=headers)
    assert r.status_code == 503


def test_complete_local_upload_missing_object_returns_conflict(monkeypatch):
    fake = enable_fake_storage(monkeypatch)
    c, headers, pid = create_logged_in_project("missing-object@example.com")
    r = c.post(f"/api/projects/{pid}/sources/local-upload/initiate", json={"original_filename":"missing.mp3","mime_type":"audio/mpeg","size_bytes":10}, headers=headers)
    sid = r.json()["source_id"]
    fake.missing = True
    r = c.post(f"/api/sources/{sid}/local-upload/complete", headers=headers)
    assert r.status_code == 409
    db = SessionLocal(); src = db.get(Source, sid); db.close()
    assert src.upload_status.value == "pending"
    assert src.uploaded_at is None


def test_complete_local_upload_and_delete_owner_isolation(monkeypatch):
    fake = enable_fake_storage(monkeypatch)
    c1, h1, pid = create_logged_in_project("owner2@example.com")
    c2, h2, _ = create_logged_in_project("other2@example.com")
    r = c1.post(f"/api/projects/{pid}/sources/local-upload/initiate", json={"original_filename":"a.mp3","mime_type":"audio/mpeg","size_bytes":10}, headers=h1)
    sid = r.json()["source_id"]
    assert c2.post(f"/api/sources/{sid}/local-upload/complete", headers=h2).status_code == 404
    assert c1.post(f"/api/sources/{sid}/local-upload/complete", headers=h1).status_code == 200
    assert c2.delete(f"/api/sources/{sid}", headers=h2).status_code == 404
    assert c1.delete(f"/api/sources/{sid}", headers=h1).status_code == 200
    assert c1.delete(f"/api/sources/{sid}", headers=h1).status_code == 200
    assert fake.deleted


def test_expired_local_upload_cleanup_marks_deleted_and_deletes(monkeypatch):
    fake = enable_fake_storage(monkeypatch)
    from studio_api import source_cleanup
    from studio_api.models import Source, SourceType, SourceUploadStatus
    monkeypatch.setattr(source_cleanup, "get_source_storage", lambda settings: fake)
    c, headers, pid = create_logged_in_project("cleanup@example.com")
    db = SessionLocal()
    try:
        src = Source(project_id=pid, source_type=SourceType.local_upload, original_filename="old.mp3", mime_type="audio/mpeg", size_bytes=10, s3_bucket="studio-temp", s3_object_key="old/key", upload_status=SourceUploadStatus.pending, expires_at=utcnow()-timedelta(seconds=1))
        db.add(src); db.commit()
        assert source_cleanup.cleanup_expired_local_uploads(db, __import__("studio_api.main", fromlist=["settings"]).settings) == 1
        db.refresh(src)
        assert src.upload_status == SourceUploadStatus.expired
        assert src.deleted_at is not None and src.delete_reason == "expired"
        assert fake.deleted == ["old/key"]
    finally:
        db.close()


def configure_google_oauth(monkeypatch, tmp_path):
    from studio_api import main as main_mod
    secret = tmp_path / "google_client_secret"
    secret.write_text("google-client-secret-test", encoding="utf-8")
    main_mod.settings.google_oauth_client_id = "google-client-id-test.apps.googleusercontent.com"
    main_mod.settings.google_oauth_client_secret_file = str(secret)
    main_mod.settings.google_oauth_redirect_uri = "https://studio.test/api/google/oauth/callback"
    main_mod.settings.google_oauth_scopes = "openid email https://www.googleapis.com/auth/drive.file"
    main_mod.settings.google_oauth_state_ttl_seconds = 600
    return secret


def test_google_connection_requires_authentication():
    c = TestClient(app)
    assert c.get("/api/google/connection").status_code == 401


def test_google_connection_status_no_connection():
    pw = admin("google-empty@example.com"); c = TestClient(app); login(c, pw, "google-empty@example.com")
    r = c.get("/api/google/connection")
    assert r.status_code == 200
    assert r.json() == {"connected": False, "status": None, "google_email": None, "scopes": None, "connected_at": None, "revoked_at": None}


def test_google_oauth_start_requires_csrf_and_fails_closed_when_missing_config(monkeypatch):
    from studio_api import main as main_mod
    pw = admin("google-start@example.com"); c = TestClient(app); csrf = login(c, pw, "google-start@example.com")
    assert c.post("/api/google/oauth/start", headers={"origin": "https://studio.test"}).status_code == 403
    main_mod.settings.google_oauth_client_id = None
    main_mod.settings.google_oauth_client_secret_file = None
    main_mod.settings.google_oauth_redirect_uri = None
    r = c.post("/api/google/oauth/start", headers={"origin": "https://studio.test", "x-csrf-token": csrf})
    assert r.status_code == 503
    assert "secret" not in r.text.lower()


def test_google_oauth_start_returns_safe_url_and_stores_hashed_state(monkeypatch, tmp_path):
    configure_google_oauth(monkeypatch, tmp_path)
    pw = admin("google-url@example.com"); c = TestClient(app); csrf = login(c, pw, "google-url@example.com")
    r = c.post("/api/google/oauth/start", headers={"origin": "https://studio.test", "x-csrf-token": csrf})
    assert r.status_code == 200
    body = r.json(); url = body["authorization_url"]
    assert "client_id=google-client-id-test" in url
    assert "access_type=offline" in url
    assert "prompt=consent" in url
    assert "google-client-secret-test" not in r.text
    assert "refresh_token" not in r.text and "access_token" not in r.text and "id_token" not in r.text
    from urllib.parse import parse_qs, urlparse
    state = parse_qs(urlparse(url).query)["state"][0]
    db = SessionLocal()
    try:
        from studio_api.models import GoogleOAuthState
        rows = db.query(GoogleOAuthState).all()
        assert len(rows) == 1
        assert rows[0].state_hash != state
        assert rows[0].expires_at > utcnow()
    finally:
        db.close()


def test_google_oauth_callback_rejects_missing_invalid_expired_and_used_state(monkeypatch, tmp_path):
    configure_google_oauth(monkeypatch, tmp_path)
    pw = admin("google-state@example.com"); c = TestClient(app); csrf = login(c, pw, "google-state@example.com")
    assert c.get("/api/google/oauth/callback").status_code == 400
    assert c.get("/api/google/oauth/callback?state=bad&code=code").status_code == 400
    r = c.post("/api/google/oauth/start", headers={"origin": "https://studio.test", "x-csrf-token": csrf})
    from urllib.parse import parse_qs, urlparse
    state = parse_qs(urlparse(r.json()["authorization_url"]).query)["state"][0]
    db = SessionLocal()
    try:
        from studio_api.models import GoogleOAuthState
        row = db.query(GoogleOAuthState).first(); row.expires_at = utcnow() - timedelta(seconds=1); db.commit()
    finally:
        db.close()
    assert c.get(f"/api/google/oauth/callback?state={state}&code=code").status_code == 400

    r = c.post("/api/google/oauth/start", headers={"origin": "https://studio.test", "x-csrf-token": csrf})
    state = parse_qs(urlparse(r.json()["authorization_url"]).query)["state"][0]
    from studio_api.google_oauth import GoogleTokenResult
    monkeypatch.setattr("studio_api.google_oauth.exchange_code_for_tokens", lambda cfg, code: GoogleTokenResult("refresh-safe", None, None, "openid email", "sub", "g@example.com"))
    assert c.get(f"/api/google/oauth/callback?state={state}&code=code").status_code == 200
    assert c.get(f"/api/google/oauth/callback?state={state}&code=code").status_code == 400


def test_google_oauth_callback_stores_encrypted_token_and_safe_metadata_disconnect_wipes(monkeypatch, tmp_path):
    configure_google_oauth(monkeypatch, tmp_path)
    from studio_api.google_oauth import GoogleTokenResult
    raw_refresh = "refresh-token-raw-test-value"
    raw_access = "access-token-raw-test-value"
    raw_id = "id-token-raw-test-value"
    called = {"count": 0}
    def fake_exchange(cfg, code):
        called["count"] += 1
        return GoogleTokenResult(raw_refresh, raw_access, raw_id, "openid email https://www.googleapis.com/auth/drive.file", "google-sub-1", "user@gmail.com")
    monkeypatch.setattr("studio_api.google_oauth.exchange_code_for_tokens", fake_exchange)
    pw = admin("google-connect@example.com"); c = TestClient(app); csrf = login(c, pw, "google-connect@example.com")
    r = c.post("/api/google/oauth/start", headers={"origin": "https://studio.test", "x-csrf-token": csrf})
    from urllib.parse import parse_qs, urlparse
    state = parse_qs(urlparse(r.json()["authorization_url"]).query)["state"][0]
    r = c.get(f"/api/google/oauth/callback?state={state}&code=auth-code")
    assert r.status_code == 200
    assert raw_refresh not in r.text and raw_access not in r.text and raw_id not in r.text
    assert called["count"] == 1
    r = c.get("/api/google/connection")
    assert r.status_code == 200
    assert r.json()["connected"] is True
    assert r.json()["google_email"] == "user@gmail.com"
    assert raw_refresh not in r.text and raw_access not in r.text and raw_id not in r.text
    db = SessionLocal()
    try:
        from studio_api.models import GoogleConnection
        conn = db.query(GoogleConnection).one()
        assert conn.refresh_token_ciphertext and conn.refresh_token_nonce
        assert raw_refresh.encode() not in conn.refresh_token_ciphertext
        assert decrypt(conn.refresh_token_ciphertext, conn.refresh_token_nonce, master_key_from_b64(base64.b64encode(b"1" * 32).decode()), aad(conn.user_id, conn.id, "refresh", "google")) == raw_refresh
    finally:
        db.close()
    r = c.delete("/api/google/connection", headers={"origin": "https://studio.test", "x-csrf-token": csrf})
    assert r.status_code == 200
    assert r.json()["connected"] is False and r.json()["status"] == "revoked"
    db = SessionLocal()
    try:
        from studio_api.models import GoogleConnection
        conn = db.query(GoogleConnection).one()
        assert conn.refresh_token_ciphertext is None and conn.refresh_token_nonce is None and conn.key_id is None
    finally:
        db.close()


def test_google_connection_user_isolation(monkeypatch, tmp_path):
    configure_google_oauth(monkeypatch, tmp_path)
    from studio_api.models import GoogleConnection, GoogleConnectionStatus, GoogleProvider
    db = SessionLocal()
    try:
        u1 = User(email="g1@example.com", role=UserRole.admin, status=UserStatus.active)
        u2 = User(email="g2@example.com", role=UserRole.admin, status=UserStatus.active)
        db.add_all([u1, u2]); db.flush()
        db.add_all([LocalIdentity(user_id=u1.id, password_hash=hash_password("password-one-long")), LocalIdentity(user_id=u2.id, password_hash=hash_password("password-two-long"))])
        db.add(GoogleConnection(user_id=u1.id, provider=GoogleProvider.google, status=GoogleConnectionStatus.active, google_email="g1@gmail.com", scopes="openid email", connected_at=utcnow()))
        db.commit()
    finally:
        db.close()
    c1 = TestClient(app); c2 = TestClient(app)
    login(c1, "password-one-long", "g1@example.com")
    login(c2, "password-two-long", "g2@example.com")
    assert c1.get("/api/google/connection").json()["google_email"] == "g1@gmail.com"
    assert c2.get("/api/google/connection").json()["connected"] is False


def add_google_connection_for_user(email: str, refresh_token: str, status="active"):
    from studio_api.models import GoogleConnection, GoogleConnectionStatus, GoogleProvider
    db = SessionLocal()
    try:
        user = db.query(User).filter_by(email=email).one()
        conn = GoogleConnection(user_id=user.id, provider=GoogleProvider.google, status=GoogleConnectionStatus(status), google_email="drive-user@gmail.com", scopes="openid email https://www.googleapis.com/auth/drive.file", connected_at=utcnow())
        db.add(conn); db.flush()
        ct, nonce = encrypt(refresh_token, master_key_from_b64(base64.b64encode(b"1" * 32).decode()), aad(user.id, conn.id, "refresh", "google"))
        conn.refresh_token_ciphertext = ct
        conn.refresh_token_nonce = nonce
        conn.key_id = "studio-v1"
        db.commit()
        return conn.id
    finally:
        db.close()


def test_google_drive_metadata_requires_authentication():
    c = TestClient(app)
    assert c.get("/api/google/drive/files/file_123/metadata").status_code == 401


def test_google_drive_metadata_no_connection_safe_error(monkeypatch, tmp_path):
    configure_google_oauth(monkeypatch, tmp_path)
    pw = admin("drive-none@example.com"); c = TestClient(app); login(c, pw, "drive-none@example.com")
    r = c.get("/api/google/drive/files/file_123/metadata")
    assert r.status_code == 404
    assert "refresh" not in r.text.lower() and "access" not in r.text.lower() and str(tmp_path) not in r.text


def test_google_drive_metadata_revoked_connection_safe_error(monkeypatch, tmp_path):
    configure_google_oauth(monkeypatch, tmp_path)
    pw = admin("drive-revoked@example.com"); c = TestClient(app); login(c, pw, "drive-revoked@example.com")
    add_google_connection_for_user("drive-revoked@example.com", "fake-refresh-token-revoked", status="revoked")
    r = c.get("/api/google/drive/files/file_123/metadata")
    assert r.status_code == 409
    assert "fake-refresh-token-revoked" not in r.text and str(tmp_path) not in r.text


def test_google_drive_metadata_missing_runtime_config_fails_closed(monkeypatch):
    from studio_api import main as main_mod
    pw = admin("drive-noconfig@example.com"); c = TestClient(app); login(c, pw, "drive-noconfig@example.com")
    add_google_connection_for_user("drive-noconfig@example.com", "fake-refresh-token-config")
    main_mod.settings.google_oauth_client_id = None
    main_mod.settings.google_oauth_client_secret_file = None
    main_mod.settings.google_oauth_redirect_uri = None
    r = c.get("/api/google/drive/files/file_123/metadata")
    assert r.status_code == 503
    assert "fake-refresh-token-config" not in r.text and "secret" not in r.text.lower()


def test_google_drive_metadata_active_connection_returns_safe_metadata(monkeypatch, tmp_path):
    configure_google_oauth(monkeypatch, tmp_path)
    raw_refresh = "fake-refresh-token-success"
    raw_access = "fake-access-token-success"
    pw = admin("drive-success@example.com"); c = TestClient(app); login(c, pw, "drive-success@example.com")
    add_google_connection_for_user("drive-success@example.com", raw_refresh)
    calls = {}
    def fake_refresh(cfg, refresh_token):
        calls["refresh_token"] = refresh_token
        return raw_access
    def fake_fetch(access_token, drive_file_id):
        calls["access_token"] = access_token
        calls["drive_file_id"] = drive_file_id
        from studio_api.google_drive import GoogleDriveMetadata
        return GoogleDriveMetadata("file_123", "Meeting.mp4", "video/mp4", 42, "https://drive.google.com/file/d/file_123/view", "2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z", False)
    monkeypatch.setattr("studio_api.google_drive.refresh_access_token", fake_refresh)
    monkeypatch.setattr("studio_api.google_drive.fetch_drive_file_metadata", fake_fetch)
    r = c.get("/api/google/drive/files/file_123/metadata")
    assert r.status_code == 200
    assert r.json() == {"id":"file_123", "name":"Meeting.mp4", "mime_type":"video/mp4", "size_bytes":42, "web_view_link":"https://drive.google.com/file/d/file_123/view", "created_time":"2026-01-01T00:00:00.000Z", "modified_time":"2026-01-02T00:00:00.000Z", "is_folder":False}
    assert calls == {"refresh_token": raw_refresh, "access_token": raw_access, "drive_file_id": "file_123"}
    forbidden = [raw_refresh, raw_access, "google-client-secret-test", str(tmp_path), "rawPayload", "owners", "permissions"]
    assert all(value not in r.text for value in forbidden)


def test_google_drive_metadata_drive_failure_safe_no_raw_leak(monkeypatch, tmp_path):
    configure_google_oauth(monkeypatch, tmp_path)
    raw_refresh = "fake-refresh-token-failure"
    raw_access = "fake-access-token-failure"
    raw_google_body = "raw google body with permissions and token fake-access-token-failure"
    pw = admin("drive-failure@example.com"); c = TestClient(app); login(c, pw, "drive-failure@example.com")
    add_google_connection_for_user("drive-failure@example.com", raw_refresh)
    monkeypatch.setattr("studio_api.google_drive.refresh_access_token", lambda cfg, refresh_token: raw_access)
    def fake_fetch(access_token, drive_file_id):
        raise RuntimeError(raw_google_body)
    monkeypatch.setattr("studio_api.google_drive.fetch_drive_file_metadata", fake_fetch)
    r = c.get("/api/google/drive/files/file_123/metadata")
    assert r.status_code == 502
    assert raw_refresh not in r.text and raw_access not in r.text and raw_google_body not in r.text and str(tmp_path) not in r.text


def test_google_drive_metadata_user_isolation(monkeypatch, tmp_path):
    configure_google_oauth(monkeypatch, tmp_path)
    pw1 = admin("drive-owner@example.com", "password-one-long")
    pw2 = admin("drive-other@example.com", "password-two-long")
    add_google_connection_for_user("drive-owner@example.com", "fake-refresh-token-owner")
    c1 = TestClient(app); c2 = TestClient(app)
    login(c1, pw1, "drive-owner@example.com")
    login(c2, pw2, "drive-other@example.com")
    monkeypatch.setattr("studio_api.google_drive.refresh_access_token", lambda cfg, refresh_token: "fake-access-token-owner")
    def fake_fetch(access_token, drive_file_id):
        from studio_api.google_drive import GoogleDriveMetadata
        return GoogleDriveMetadata(drive_file_id, "Owner file", "application/vnd.google-apps.folder", None, None, None, None, True)
    monkeypatch.setattr("studio_api.google_drive.fetch_drive_file_metadata", fake_fetch)
    assert c1.get("/api/google/drive/files/folder_123/metadata").status_code == 200
    r = c2.get("/api/google/drive/files/folder_123/metadata")
    assert r.status_code == 404
    assert "fake-refresh-token-owner" not in r.text and "fake-access-token-owner" not in r.text


def test_google_drive_folder_children_requires_authentication():
    c = TestClient(app)
    assert c.get("/api/google/drive/folders/folder_123/children").status_code == 401


def test_google_drive_folder_children_no_connection_safe_error(monkeypatch, tmp_path):
    configure_google_oauth(monkeypatch, tmp_path)
    pw = admin("drive-children-none@example.com"); c = TestClient(app); login(c, pw, "drive-children-none@example.com")
    r = c.get("/api/google/drive/folders/folder_123/children")
    assert r.status_code == 404
    assert "refresh" not in r.text.lower() and "access" not in r.text.lower() and str(tmp_path) not in r.text


def test_google_drive_folder_children_revoked_connection_safe_error(monkeypatch, tmp_path):
    configure_google_oauth(monkeypatch, tmp_path)
    pw = admin("drive-children-revoked@example.com"); c = TestClient(app); login(c, pw, "drive-children-revoked@example.com")
    add_google_connection_for_user("drive-children-revoked@example.com", "fake-refresh-token-children-revoked", status="revoked")
    r = c.get("/api/google/drive/folders/folder_123/children")
    assert r.status_code == 409
    assert "fake-refresh-token-children-revoked" not in r.text and str(tmp_path) not in r.text


def test_google_drive_folder_children_missing_runtime_config_fails_closed(monkeypatch):
    from studio_api import main as main_mod
    pw = admin("drive-children-noconfig@example.com"); c = TestClient(app); login(c, pw, "drive-children-noconfig@example.com")
    add_google_connection_for_user("drive-children-noconfig@example.com", "fake-refresh-token-children-config")
    main_mod.settings.google_oauth_client_id = None
    main_mod.settings.google_oauth_client_secret_file = None
    main_mod.settings.google_oauth_redirect_uri = None
    r = c.get("/api/google/drive/folders/folder_123/children")
    assert r.status_code == 503
    assert "fake-refresh-token-children-config" not in r.text and "secret" not in r.text.lower()


def test_google_drive_folder_children_active_connection_returns_safe_items_and_pagination(monkeypatch, tmp_path):
    configure_google_oauth(monkeypatch, tmp_path)
    raw_refresh = "fake-refresh-token-children-success"
    raw_access = "fake-access-token-children-success"
    pw = admin("drive-children-success@example.com"); c = TestClient(app); login(c, pw, "drive-children-success@example.com")
    add_google_connection_for_user("drive-children-success@example.com", raw_refresh)
    calls = {}
    def fake_refresh(cfg, refresh_token):
        calls["refresh_token"] = refresh_token
        return raw_access
    def fake_list(access_token, folder_id, page_size=50, page_token=None):
        calls.update({"access_token": access_token, "folder_id": folder_id, "page_size": page_size, "page_token": page_token})
        from studio_api.google_drive import GoogleDriveFolderChildren, GoogleDriveMetadata
        return GoogleDriveFolderChildren(folder_id, [
            GoogleDriveMetadata("file_123", "Meeting.mp4", "video/mp4", 42, "https://drive.google.com/file/d/file_123/view", "2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z", False),
            GoogleDriveMetadata("folder_child", "Nested", "application/vnd.google-apps.folder", None, "https://drive.google.com/drive/folders/folder_child", "2026-01-03T00:00:00.000Z", "2026-01-04T00:00:00.000Z", True),
        ], "safe-next-page-token")
    monkeypatch.setattr("studio_api.google_drive.refresh_access_token", fake_refresh)
    monkeypatch.setattr("studio_api.google_drive.list_drive_folder_children", fake_list)
    r = c.get("/api/google/drive/folders/folder_123/children?page_size=25&page_token=safe-page-token")
    assert r.status_code == 200
    assert r.json() == {"folder_id":"folder_123", "items":[
        {"id":"file_123", "name":"Meeting.mp4", "mime_type":"video/mp4", "size_bytes":42, "web_view_link":"https://drive.google.com/file/d/file_123/view", "created_time":"2026-01-01T00:00:00.000Z", "modified_time":"2026-01-02T00:00:00.000Z", "is_folder":False},
        {"id":"folder_child", "name":"Nested", "mime_type":"application/vnd.google-apps.folder", "size_bytes":None, "web_view_link":"https://drive.google.com/drive/folders/folder_child", "created_time":"2026-01-03T00:00:00.000Z", "modified_time":"2026-01-04T00:00:00.000Z", "is_folder":True},
    ], "next_page_token":"safe-next-page-token"}
    assert calls == {"refresh_token": raw_refresh, "access_token": raw_access, "folder_id": "folder_123", "page_size": 25, "page_token": "safe-page-token"}
    forbidden = [raw_refresh, raw_access, "google-client-secret-test", str(tmp_path), "rawPayload", "owners", "permissions", "labels", "thumbnail"]
    assert all(value not in r.text for value in forbidden)


def test_google_drive_folder_children_drive_failure_safe_no_raw_leak(monkeypatch, tmp_path):
    configure_google_oauth(monkeypatch, tmp_path)
    raw_refresh = "fake-refresh-token-children-failure"
    raw_access = "fake-access-token-children-failure"
    raw_google_body = "raw google body with owners permissions labels thumbnails and token fake-access-token-children-failure"
    pw = admin("drive-children-failure@example.com"); c = TestClient(app); login(c, pw, "drive-children-failure@example.com")
    add_google_connection_for_user("drive-children-failure@example.com", raw_refresh)
    monkeypatch.setattr("studio_api.google_drive.refresh_access_token", lambda cfg, refresh_token: raw_access)
    def fake_list(access_token, folder_id, page_size=50, page_token=None):
        raise RuntimeError(raw_google_body)
    monkeypatch.setattr("studio_api.google_drive.list_drive_folder_children", fake_list)
    r = c.get("/api/google/drive/folders/folder_123/children")
    assert r.status_code == 502
    assert raw_refresh not in r.text and raw_access not in r.text and raw_google_body not in r.text and str(tmp_path) not in r.text


def test_google_drive_folder_children_user_isolation(monkeypatch, tmp_path):
    configure_google_oauth(monkeypatch, tmp_path)
    pw1 = admin("drive-children-owner@example.com", "password-one-long")
    pw2 = admin("drive-children-other@example.com", "password-two-long")
    add_google_connection_for_user("drive-children-owner@example.com", "fake-refresh-token-children-owner")
    c1 = TestClient(app); c2 = TestClient(app)
    login(c1, pw1, "drive-children-owner@example.com")
    login(c2, pw2, "drive-children-other@example.com")
    monkeypatch.setattr("studio_api.google_drive.refresh_access_token", lambda cfg, refresh_token: "fake-access-token-children-owner")
    def fake_list(access_token, folder_id, page_size=50, page_token=None):
        from studio_api.google_drive import GoogleDriveFolderChildren
        return GoogleDriveFolderChildren(folder_id, [], None)
    monkeypatch.setattr("studio_api.google_drive.list_drive_folder_children", fake_list)
    assert c1.get("/api/google/drive/folders/folder_123/children").status_code == 200
    r = c2.get("/api/google/drive/folders/folder_123/children")
    assert r.status_code == 404
    assert "fake-refresh-token-children-owner" not in r.text and "fake-access-token-children-owner" not in r.text


def test_google_drive_folder_children_invalid_folder_id_returns_422(monkeypatch, tmp_path):
    configure_google_oauth(monkeypatch, tmp_path)
    pw = admin("drive-children-invalid@example.com"); c = TestClient(app); login(c, pw, "drive-children-invalid@example.com")
    add_google_connection_for_user("drive-children-invalid@example.com", "fake-refresh-token-children-invalid")
    r = c.get("/api/google/drive/folders/bad:id/children")
    assert r.status_code == 422
    assert "fake-refresh-token-children-invalid" not in r.text


LEASE_TEST_NOW = datetime(2026, 7, 10, 12, 0, tzinfo=timezone.utc)
LEASE_TEST_TTL = timedelta(minutes=15)


def lease_test_job(status=JobStatus.queued, ready=True):
    db = SessionLocal()
    try:
        user = User(email=f"lease-{utcnow().timestamp()}@example.com", role=UserRole.admin, status=UserStatus.active)
        db.add(user); db.flush(); db.add(LocalIdentity(user_id=user.id, password_hash=hash_password("correct horse battery")))
        project = Project(owner_user_id=user.id, title="Lease Project", output_drive_folder_id="folder-1")
        db.add(project); db.flush()
        if ready:
            source = Source(project_id=project.id, source_type=SourceType.google_drive, original_filename="a.mp3", upload_status=SourceUploadStatus.uploaded, drive_file_id="drive-file-1")
        else:
            source = Source(project_id=project.id, source_type=SourceType.google_drive, original_filename="a.mp3", upload_status=SourceUploadStatus.pending)
        db.add(source); db.flush()
        job = TranscriptionJob(project_id=project.id, owner_user_id=user.id, status=status, title="Lease Job")
        db.add(job); db.flush()
        db.add(TranscriptionJobSource(job_id=job.id, source_id=source.id, position=0))
        db.commit()
        return user.id, job.id
    finally:
        db.close()


def assert_lease_reason(exc, reason):
    assert exc.value.reason == reason


def jobstatus_enum_values():
    with engine.connect() as conn:
        return conn.execute(text(
            "SELECT e.enumlabel FROM pg_enum e "
            "JOIN pg_type t ON t.oid = e.enumtypid "
            "WHERE t.typname = 'jobstatus' "
            "ORDER BY e.enumsortorder"
        )).scalars().all()


def assert_jobstatus_enum_order():
    assert jobstatus_enum_values() == ["queued", "processing", "cancelled", "failed", "completed"]


def test_job_lease_migration_clean_chain_shape_and_defaults():
    inspector = inspect(engine)
    cols = {c["name"]: c for c in inspector.get_columns("transcription_jobs")}
    assert {"lease_owner_id", "lease_generation", "claimed_at", "lease_expires_at", "attempt_count", "cancel_requested_at"}.issubset(cols)
    assert cols["lease_owner_id"]["nullable"] is True
    assert cols["lease_generation"]["nullable"] is False
    assert cols["attempt_count"]["nullable"] is False
    assert cols["cancel_requested_at"]["nullable"] is True
    indexes = [idx["name"] for idx in inspector.get_indexes("transcription_jobs")]
    assert indexes.count("ix_transcription_jobs_status_lease_expires_created") == 1
    assert_jobstatus_enum_order()
    _, job_id = lease_test_job()
    db = SessionLocal()
    try:
        job = db.get(TranscriptionJob, job_id)
        assert job.lease_generation == 0
        assert job.lease_owner_id is None
        assert job.claimed_at is None
        assert job.lease_expires_at is None
        assert job.attempt_count == 0
    finally:
        db.close()


def test_job_lease_migration_real_0005_shape_upgrades_to_head():
    subprocess.run([sys.executable, "-m", "alembic", "-c", str(ALEMBIC), "downgrade", "0005_transcription_jobs"], cwd=ROOT, check=True)
    try:
        cols_at_0005 = {c["name"] for c in inspect(engine).get_columns("transcription_jobs")}
        assert "lease_owner_id" not in cols_at_0005
        subprocess.run([sys.executable, "-m", "alembic", "-c", str(ALEMBIC), "upgrade", "head"], cwd=ROOT, check=True)
        inspector = inspect(engine)
        cols = {c["name"] for c in inspector.get_columns("transcription_jobs")}
        assert {"lease_owner_id", "lease_generation", "claimed_at", "lease_expires_at", "attempt_count", "cancel_requested_at"}.issubset(cols)
        indexes = [idx["name"] for idx in inspector.get_indexes("transcription_jobs")]
        assert indexes.count("ix_transcription_jobs_status_lease_expires_created") == 1
        assert_jobstatus_enum_order()
    finally:
        subprocess.run([sys.executable, "-m", "alembic", "-c", str(ALEMBIC), "upgrade", "head"], cwd=ROOT, check=True)



def test_job_output_migration_clean_chain_constraints_and_0007_roundtrip():
    inspector = inspect(engine)
    assert "transcription_job_outputs" in inspector.get_table_names()
    cols = {c["name"]: c for c in inspector.get_columns("transcription_job_outputs")}
    assert {"id", "job_id", "job_source_id", "document_id", "web_view_url", "output_drive_folder_id", "output_kind", "transcript_standard", "document_character_count", "document_created_at", "persisted_at", "lease_generation"}.issubset(cols)
    uniques = {tuple(u["column_names"]) for u in inspector.get_unique_constraints("transcription_job_outputs")}
    assert ("job_source_id",) in uniques and ("document_id",) in uniques
    indexes = {idx["name"] for idx in inspector.get_indexes("transcription_job_outputs")}
    assert "ix_transcription_job_outputs_job_id" in indexes
    fks = {tuple(fk["constrained_columns"]): fk["referred_table"] for fk in inspector.get_foreign_keys("transcription_job_outputs")}
    assert fks[("job_id",)] == "transcription_jobs" and fks[("job_source_id",)] == "transcription_job_sources"
    subprocess.run([sys.executable, "-m", "alembic", "-c", str(ALEMBIC), "downgrade", "0007_job_processing_lifecycle"], cwd=ROOT, check=True)
    try:
        assert "transcription_job_outputs" not in inspect(engine).get_table_names()
        assert "transcription_job_sources" in inspect(engine).get_table_names()
        subprocess.run([sys.executable, "-m", "alembic", "-c", str(ALEMBIC), "upgrade", "head"], cwd=ROOT, check=True)
        assert "transcription_job_outputs" in inspect(engine).get_table_names()
    finally:
        subprocess.run([sys.executable, "-m", "alembic", "-c", str(ALEMBIC), "upgrade", "head"], cwd=ROOT, check=True)


def output_persistence_artifact(doc_id="doc-fresh"):
    return new_google_docs_transcript_artifact(
        result=GoogleDocsCreateResult(
            doc_id,
            "Secret Title",
            "application/vnd.google-apps.document",
            f"https://docs.example/{doc_id}",
            ("folder-1",),
        ),
        created_at=LEASE_TEST_NOW,
        character_count=12,
    )


@pytest.mark.parametrize("mutate,reason", [
    (lambda job, project, rel, source: setattr(job, "cancel_requested_at", LEASE_TEST_NOW), JobOutputPersistenceReason.cancellation_requested),
    (lambda job, project, rel, source: setattr(job, "lease_owner_id", "other-owner"), JobOutputPersistenceReason.lease_not_owned),
    (lambda job, project, rel, source: setattr(job, "lease_generation", job.lease_generation + 1), JobOutputPersistenceReason.lease_not_owned),
    (lambda job, project, rel, source: setattr(project, "output_drive_folder_id", "folder-changed"), JobOutputPersistenceReason.output_folder_changed),
    (lambda job, project, rel, source: setattr(project, "archived_at", LEASE_TEST_NOW), JobOutputPersistenceReason.project_unavailable),
])
def test_output_persistence_refreshes_stale_identity_map_before_authorizing(mutate, reason):
    _, job_id = lease_test_job(status=JobStatus.queued, ready=True)
    setup = SessionLocal()
    try:
        handle = acquire_job_lease(setup, job_id=job_id, lease_owner_id="owner-1", now=LEASE_TEST_NOW, lease_ttl=LEASE_TEST_TTL)
        begin_job_processing(setup, job_id=job_id, lease_owner_id=handle.lease_owner_id, lease_generation=handle.lease_generation, now=LEASE_TEST_NOW)
        setup.commit()
    finally:
        setup.close()

    session_a = SessionLocal()
    session_b = SessionLocal()
    try:
        job_a = session_a.get(TranscriptionJob, job_id)
        project_a = session_a.get(Project, job_a.project_id)
        rel_a = session_a.query(TranscriptionJobSource).filter_by(job_id=job_id).one()
        source_a = session_a.get(Source, rel_a.source_id)
        assert job_a.status == JobStatus.processing and project_a.output_drive_folder_id == "folder-1" and source_a.upload_status == SourceUploadStatus.uploaded

        job_b = session_b.get(TranscriptionJob, job_id)
        project_b = session_b.get(Project, job_b.project_id)
        rel_b = session_b.query(TranscriptionJobSource).filter_by(job_id=job_id).one()
        source_b = session_b.get(Source, rel_b.source_id)
        mutate(job_b, project_b, rel_b, source_b)
        session_b.commit()

        with pytest.raises(JobOutputPersistenceError) as exc:
            persist_processing_job_source_output_and_maybe_complete(
                session_a,
                job_id=job_id,
                job_source_id=rel_a.id,
                lease_owner_id="owner-1",
                lease_generation=handle.lease_generation,
                artifact=output_persistence_artifact(),
                now=LEASE_TEST_NOW,
            )
        assert exc.value.reason == reason
        session_a.rollback()

        verifier = SessionLocal()
        try:
            assert verifier.query(TranscriptionJobOutput).filter_by(job_id=job_id).count() == 0
            assert verifier.get(TranscriptionJob, job_id).status == JobStatus.processing
        finally:
            verifier.close()
    finally:
        session_a.close(); session_b.close()


@pytest.mark.parametrize("mutate", [
    lambda job, project, rel, source: setattr(project, "output_drive_folder_id", "folder-blocked"),
    lambda job, project, rel, source: setattr(project, "archived_at", LEASE_TEST_NOW),
    lambda job, project, rel, source: (setattr(source, "deleted_at", LEASE_TEST_NOW), setattr(source, "upload_status", SourceUploadStatus.deleted)),
])
def test_output_persistence_authority_locks_block_concurrent_mutations(mutate):
    _, job_id = lease_test_job(status=JobStatus.queued, ready=True)
    setup = SessionLocal()
    try:
        handle = acquire_job_lease(setup, job_id=job_id, lease_owner_id="owner-1", now=LEASE_TEST_NOW, lease_ttl=LEASE_TEST_TTL)
        begin_job_processing(setup, job_id=job_id, lease_owner_id=handle.lease_owner_id, lease_generation=handle.lease_generation, now=LEASE_TEST_NOW)
        rel_id = setup.execute(select(TranscriptionJobSource.id).where(TranscriptionJobSource.job_id == job_id)).scalar_one()
        setup.commit()
    finally:
        setup.close()

    session_a = SessionLocal()
    session_b = SessionLocal()
    try:
        _load_locked_output_authority(
            session_a,
            job_id=job_id,
            job_source_id=rel_id,
            lease_owner_id="owner-1",
            lease_generation=handle.lease_generation,
            output_folder_id="folder-1",
            now=LEASE_TEST_NOW,
        )

        session_b.execute(text("SET LOCAL lock_timeout = '100ms'"))
        job_b = session_b.get(TranscriptionJob, job_id)
        project_b = session_b.get(Project, job_b.project_id)
        rel_b = session_b.query(TranscriptionJobSource).filter_by(job_id=job_id).one()
        source_b = session_b.get(Source, rel_b.source_id)
        mutate(job_b, project_b, rel_b, source_b)
        with pytest.raises(OperationalError):
            session_b.flush()
        session_b.rollback()

        assert session_b.query(TranscriptionJobOutput).filter_by(job_id=job_id).count() == 0
        assert session_b.get(TranscriptionJob, job_id).status == JobStatus.processing
    finally:
        session_a.rollback(); session_a.close(); session_b.close()

def test_acquire_active_reclaim_stale_fencing_and_no_commit():
    _, job_id = lease_test_job()
    db = SessionLocal()
    try:
        job = db.get(TranscriptionJob, job_id)
        handle = acquire_job_lease(db, job_id=job.id, lease_owner_id="owner-1", now=LEASE_TEST_NOW, lease_ttl=LEASE_TEST_TTL)
        assert handle.lease_generation == 1
        assert handle.claimed_at == LEASE_TEST_NOW
        assert handle.lease_expires_at == LEASE_TEST_NOW + LEASE_TEST_TTL
        assert job.status == JobStatus.queued
        assert job.started_at is None
        other = SessionLocal()
        try:
            assert other.get(TranscriptionJob, job.id).lease_owner_id is None
        finally:
            other.close()
        db.commit()

        with pytest.raises(JobLeaseError) as exc:
            acquire_job_lease(db, job_id=job.id, lease_owner_id="owner-2", now=LEASE_TEST_NOW + timedelta(minutes=1), lease_ttl=LEASE_TEST_TTL)
        assert_lease_reason(exc, JobLeaseFailureReason.lease_active)
        db.rollback(); job = db.get(TranscriptionJob, job.id)
        assert job.lease_owner_id == "owner-1" and job.lease_generation == 1

        reclaimed = acquire_job_lease(db, job_id=job.id, lease_owner_id="owner-2", now=LEASE_TEST_NOW + timedelta(minutes=16), lease_ttl=LEASE_TEST_TTL)
        assert reclaimed.lease_generation == 2
        assert job.lease_owner_id == "owner-2"
        with pytest.raises(JobLeaseError) as exc:
            renew_job_lease(db, job_id=job.id, lease_owner_id="owner-1", lease_generation=1, now=LEASE_TEST_NOW + timedelta(minutes=17), lease_ttl=LEASE_TEST_TTL)
        assert_lease_reason(exc, JobLeaseFailureReason.lease_not_owned)
        with pytest.raises(JobLeaseError) as exc:
            release_job_lease(db, job_id=job.id, lease_owner_id="owner-1", lease_generation=1)
        assert_lease_reason(exc, JobLeaseFailureReason.lease_not_owned)
    finally:
        db.close()


def test_two_sessions_cannot_both_claim_active_lease():
    _, job_id = lease_test_job()
    first = SessionLocal(); second = SessionLocal()
    try:
        first_handle = acquire_job_lease(first, job_id=job_id, lease_owner_id="owner-1", now=LEASE_TEST_NOW, lease_ttl=LEASE_TEST_TTL)
        first.commit()
        with pytest.raises(JobLeaseError) as exc:
            acquire_job_lease(second, job_id=job_id, lease_owner_id="owner-2", now=LEASE_TEST_NOW + timedelta(minutes=1), lease_ttl=LEASE_TEST_TTL)
        assert_lease_reason(exc, JobLeaseFailureReason.lease_active)
        second.rollback()
        stored = second.get(TranscriptionJob, job_id)
        assert stored.lease_owner_id == "owner-1"
        assert stored.lease_generation == first_handle.lease_generation
    finally:
        first.close(); second.close()



def test_claim_next_skip_locked_claims_next_unlocked_job():
    _, oldest_id = lease_test_job()
    _, next_id = lease_test_job()
    setup = SessionLocal()
    try:
        setup.get(TranscriptionJob, oldest_id).created_at = LEASE_TEST_NOW
        setup.get(TranscriptionJob, next_id).created_at = LEASE_TEST_NOW + timedelta(seconds=1)
        setup.commit()
    finally:
        setup.close()

    locker = SessionLocal(); claimer = SessionLocal(); verifier = SessionLocal()
    try:
        locker.execute(
            select(TranscriptionJob)
            .where(TranscriptionJob.id == oldest_id)
            .with_for_update()
        ).scalar_one()

        handle = acquire_next_ready_job_lease(
            claimer,
            lease_owner_id="owner-b",
            now=LEASE_TEST_NOW + timedelta(minutes=1),
            lease_ttl=LEASE_TEST_TTL,
        )
        assert handle is not None
        assert handle.job_id == next_id
        assert handle.lease_owner_id == "owner-b"
        assert handle.lease_generation == 1
        claimer.commit()

        stored = verifier.get(TranscriptionJob, next_id)
        assert stored.lease_owner_id == handle.lease_owner_id
        assert stored.lease_generation == handle.lease_generation
        assert verifier.get(TranscriptionJob, oldest_id).lease_owner_id is None
    finally:
        locker.rollback(); claimer.rollback(); verifier.close(); locker.close(); claimer.close()


def test_concurrent_claim_next_callers_do_not_receive_same_job():
    _, first_id = lease_test_job()
    _, second_id = lease_test_job()
    setup = SessionLocal()
    try:
        setup.get(TranscriptionJob, first_id).created_at = LEASE_TEST_NOW
        setup.get(TranscriptionJob, second_id).created_at = LEASE_TEST_NOW + timedelta(seconds=1)
        setup.commit()
    finally:
        setup.close()

    first = SessionLocal(); second = SessionLocal(); verifier = SessionLocal()
    try:
        first_handle = acquire_next_ready_job_lease(first, lease_owner_id="owner-1", now=LEASE_TEST_NOW + timedelta(minutes=1), lease_ttl=LEASE_TEST_TTL)
        second_handle = acquire_next_ready_job_lease(second, lease_owner_id="owner-2", now=LEASE_TEST_NOW + timedelta(minutes=1), lease_ttl=LEASE_TEST_TTL)
        assert first_handle is not None and second_handle is not None
        assert first_handle.job_id != second_handle.job_id
        first.commit(); second.commit()
        for handle in (first_handle, second_handle):
            stored = verifier.get(TranscriptionJob, handle.job_id)
            assert stored.lease_owner_id == handle.lease_owner_id
            assert stored.lease_generation == handle.lease_generation
    finally:
        first.rollback(); second.rollback(); verifier.close(); first.close(); second.close()


def test_claim_next_with_unready_oldest_does_not_prelock_later_ready_candidate():
    _, unready_id = lease_test_job(ready=False)
    _, first_ready_id = lease_test_job()
    _, second_ready_id = lease_test_job()
    setup = SessionLocal()
    try:
        setup.get(TranscriptionJob, unready_id).created_at = LEASE_TEST_NOW
        setup.get(TranscriptionJob, first_ready_id).created_at = LEASE_TEST_NOW + timedelta(seconds=1)
        setup.get(TranscriptionJob, second_ready_id).created_at = LEASE_TEST_NOW + timedelta(seconds=2)
        setup.commit()
    finally:
        setup.close()

    first = SessionLocal(); second = SessionLocal(); verifier = SessionLocal()
    try:
        first_handle = acquire_next_ready_job_lease(
            first,
            lease_owner_id="owner-1",
            now=LEASE_TEST_NOW + timedelta(minutes=1),
            lease_ttl=LEASE_TEST_TTL,
        )
        assert first_handle is not None
        assert first_handle.job_id == first_ready_id

        second_handle = acquire_next_ready_job_lease(
            second,
            lease_owner_id="owner-2",
            now=LEASE_TEST_NOW + timedelta(minutes=1),
            lease_ttl=LEASE_TEST_TTL,
        )
        assert second_handle is not None
        assert second_handle.job_id == second_ready_id
        assert second_handle.job_id != first_handle.job_id

        first.commit(); second.commit()
        for handle in (first_handle, second_handle):
            stored = verifier.get(TranscriptionJob, handle.job_id)
            assert stored.lease_owner_id == handle.lease_owner_id
            assert stored.lease_generation == handle.lease_generation
        assert verifier.get(TranscriptionJob, unready_id).lease_owner_id is None
    finally:
        first.rollback(); second.rollback(); verifier.close(); first.close(); second.close()

def test_renew_and_strict_release_semantics():
    _, job_id = lease_test_job()
    db = SessionLocal()
    try:
        job = db.get(TranscriptionJob, job_id)
        handle = acquire_job_lease(db, job_id=job.id, lease_owner_id="owner", now=LEASE_TEST_NOW, lease_ttl=LEASE_TEST_TTL)
        renewed = renew_job_lease(db, job_id=job.id, lease_owner_id="owner", lease_generation=handle.lease_generation, now=LEASE_TEST_NOW + timedelta(minutes=5), lease_ttl=timedelta(minutes=30))
        assert renewed.lease_generation == handle.lease_generation
        assert renewed.lease_expires_at == LEASE_TEST_NOW + timedelta(minutes=35)
        assert release_job_lease(db, job_id=job.id, lease_owner_id="owner", lease_generation=handle.lease_generation) is True
        assert job.lease_owner_id is None and job.lease_expires_at is None and job.lease_generation == 1
        with pytest.raises(JobLeaseError) as exc:
            release_job_lease(db, job_id=job.id, lease_owner_id="owner", lease_generation=handle.lease_generation)
        assert_lease_reason(exc, JobLeaseFailureReason.lease_not_owned)
    finally:
        db.close()


def test_expired_terminal_unready_and_invalid_leases_fail_closed():
    _, job_id = lease_test_job(ready=False)
    db = SessionLocal()
    try:
        with pytest.raises(JobLeaseError) as exc:
            acquire_job_lease(db, job_id=job_id, lease_owner_id="owner", now=LEASE_TEST_NOW, lease_ttl=LEASE_TEST_TTL)
        assert_lease_reason(exc, JobLeaseFailureReason.job_not_ready)
        with pytest.raises(JobLeaseError) as exc:
            acquire_job_lease(db, job_id=job_id, lease_owner_id=" ", now=LEASE_TEST_NOW, lease_ttl=LEASE_TEST_TTL)
        assert_lease_reason(exc, JobLeaseFailureReason.invalid_owner)
        with pytest.raises(JobLeaseError) as exc:
            acquire_job_lease(db, job_id=job_id, lease_owner_id="owner", now=LEASE_TEST_NOW, lease_ttl=timedelta(0))
        assert_lease_reason(exc, JobLeaseFailureReason.invalid_ttl)
    finally:
        db.close()

    _, terminal_job_id = lease_test_job(status=JobStatus.completed)
    db = SessionLocal()
    try:
        with pytest.raises(JobLeaseError) as exc:
            acquire_job_lease(db, job_id=terminal_job_id, lease_owner_id="owner", now=LEASE_TEST_NOW, lease_ttl=LEASE_TEST_TTL)
        assert_lease_reason(exc, JobLeaseFailureReason.job_not_queued)
    finally:
        db.close()

    _, expiring_job_id = lease_test_job()
    db = SessionLocal()
    try:
        handle = acquire_job_lease(db, job_id=expiring_job_id, lease_owner_id="owner", now=LEASE_TEST_NOW, lease_ttl=LEASE_TEST_TTL)
        with pytest.raises(JobLeaseError) as exc:
            renew_job_lease(db, job_id=expiring_job_id, lease_owner_id="owner", lease_generation=handle.lease_generation, now=LEASE_TEST_NOW + timedelta(minutes=16), lease_ttl=LEASE_TEST_TTL)
        assert_lease_reason(exc, JobLeaseFailureReason.lease_not_active)
    finally:
        db.close()


def test_cancel_clears_lease_and_public_payloads_are_safe():
    user_id, job_id = lease_test_job()
    db = SessionLocal()
    try:
        job = db.get(TranscriptionJob, job_id)
        user = db.get(User, user_id)
        handle = acquire_job_lease(db, job_id=job.id, lease_owner_id="internal-owner", now=LEASE_TEST_NOW, lease_ttl=LEASE_TEST_TTL)
        db.commit()
        client = TestClient(app); csrf = login(client, "correct horse battery", user.email)
        headers = {"origin": "https://studio.test", "x-csrf-token": csrf}
        r = client.post(f"/api/jobs/{job.id}/cancel", headers=headers)
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "cancelled"
        for key in ["lease_owner_id", "lease_generation", "claimed_at", "lease_expires_at"]:
            assert key not in body
        db.refresh(job)
        generation = handle.lease_generation
        assert job.lease_owner_id is None and job.lease_expires_at is None and job.lease_generation == generation

        stale = SessionLocal()
        try:
            with pytest.raises(JobLeaseError) as exc:
                renew_job_lease(stale, job_id=job_id, lease_owner_id="internal-owner", lease_generation=generation, now=LEASE_TEST_NOW, lease_ttl=LEASE_TEST_TTL)
            assert_lease_reason(exc, JobLeaseFailureReason.job_not_queued)
            stale.rollback()
        finally:
            stale.close()

        stale = SessionLocal()
        try:
            with pytest.raises(JobLeaseError) as exc:
                release_job_lease(stale, job_id=job_id, lease_owner_id="internal-owner", lease_generation=generation)
            assert_lease_reason(exc, JobLeaseFailureReason.lease_not_owned)
            stale.rollback()
        finally:
            stale.close()

        assert client.post(f"/api/jobs/{job_id}/cancel", headers=headers).status_code == 200
        db.rollback()
        audit_text = "\n".join(event.metadata_json for event in db.query(AuditEvent).all())
        assert "internal-owner" not in audit_text
    finally:
        db.close()


def test_active_lease_helper():
    _, job_id = lease_test_job()
    db = SessionLocal()
    try:
        job = db.get(TranscriptionJob, job_id)
        acquire_job_lease(db, job_id=job.id, lease_owner_id="owner", now=LEASE_TEST_NOW, lease_ttl=LEASE_TEST_TTL)
        assert is_lease_active(job, LEASE_TEST_NOW + timedelta(minutes=14)) is True
        assert is_lease_active(job, LEASE_TEST_NOW + timedelta(minutes=15)) is False
    finally:
        db.close()


def test_begin_processing_cancellation_failure_and_recovery_lifecycle():
    _, job_id = lease_test_job()
    db = SessionLocal()
    try:
        job = db.get(TranscriptionJob, job_id)
        handle = acquire_job_lease(db, job_id=job.id, lease_owner_id="owner", now=LEASE_TEST_NOW, lease_ttl=LEASE_TEST_TTL)
        result = begin_job_processing(db, job_id=job.id, lease_owner_id="owner", lease_generation=handle.lease_generation, now=LEASE_TEST_NOW + timedelta(minutes=1))
        assert result.status == JobStatus.processing
        assert job.status == JobStatus.processing
        assert job.attempt_count == 1
        assert job.started_at == LEASE_TEST_NOW + timedelta(minutes=1)
        assert job.lease_owner_id == "owner" and job.lease_generation == handle.lease_generation
        other = SessionLocal()
        try:
            assert other.get(TranscriptionJob, job.id).status == JobStatus.queued
        finally:
            other.close()
        with pytest.raises(JobLeaseError) as exc:
            release_job_lease(db, job_id=job.id, lease_owner_id="owner", lease_generation=handle.lease_generation)
        assert_lease_reason(exc, JobLeaseFailureReason.lease_not_releasable)
        renewed = renew_job_lease(db, job_id=job.id, lease_owner_id="owner", lease_generation=handle.lease_generation, now=LEASE_TEST_NOW + timedelta(minutes=2), lease_ttl=LEASE_TEST_TTL)
        assert renewed.lease_generation == handle.lease_generation
        db.commit()

        client = TestClient(app)
        user = db.get(User, job.owner_user_id)
        csrf = login(client, "correct horse battery", user.email)
        headers = {"origin": "https://studio.test", "x-csrf-token": csrf}
        response = client.post(f"/api/jobs/{job.id}/cancel", headers=headers)
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "processing"
        assert body["cancel_requested_at"] is not None
        assert body["attempt_count"] == 1
        for key in ["lease_owner_id", "lease_generation", "claimed_at", "lease_expires_at"]:
            assert key not in body
        db.refresh(job)
        original_requested_at = job.cancel_requested_at
        assert job.lease_owner_id == "owner"
        assert client.post(f"/api/jobs/{job.id}/cancel", headers=headers).json()["cancel_requested_at"] == original_requested_at.isoformat()
        events = [e.event_type for e in db.query(AuditEvent).filter(AuditEvent.event_type == "job.cancel_requested").all()]
        assert events == ["job.cancel_requested"]
        with pytest.raises(JobProcessingError) as exc:
            fail_job_processing(db, job_id=job.id, lease_owner_id="owner", lease_generation=handle.lease_generation, now=LEASE_TEST_NOW + timedelta(minutes=3), error_code="provider", error_message="safe")
        assert exc.value.reason == JobProcessingFailureReason.cancellation_requested
        ack = acknowledge_job_cancellation(db, job_id=job.id, lease_owner_id="owner", lease_generation=handle.lease_generation, now=LEASE_TEST_NOW + timedelta(minutes=4))
        assert ack.status == JobStatus.cancelled
        assert job.finished_at == LEASE_TEST_NOW + timedelta(minutes=4)
        assert job.lease_owner_id is None and job.lease_expires_at is None
    finally:
        db.close()


def test_processing_failure_and_expired_recovery_paths():
    _, job_id = lease_test_job()
    db = SessionLocal()
    try:
        job = db.get(TranscriptionJob, job_id)
        handle = acquire_job_lease(db, job_id=job.id, lease_owner_id="owner", now=LEASE_TEST_NOW, lease_ttl=LEASE_TEST_TTL)
        begin_job_processing(db, job_id=job.id, lease_owner_id="owner", lease_generation=handle.lease_generation, now=LEASE_TEST_NOW + timedelta(minutes=1))
        with pytest.raises(JobProcessingError):
            fail_job_processing(db, job_id=job.id, lease_owner_id="stale", lease_generation=handle.lease_generation, now=LEASE_TEST_NOW + timedelta(minutes=2), error_code="x", error_message="x")
        fail_job_processing(db, job_id=job.id, lease_owner_id="owner", lease_generation=handle.lease_generation, now=LEASE_TEST_NOW + timedelta(minutes=2), error_code="raw_provider", error_message="token leaked")
        assert job.status == JobStatus.failed
        assert job.error_code == "Недоступно" and job.error_message == "Недоступно"
        assert job.lease_owner_id is None
    finally:
        db.close()

    _, recover_id = lease_test_job()
    db = SessionLocal()
    try:
        job = db.get(TranscriptionJob, recover_id)
        h = acquire_job_lease(db, job_id=job.id, lease_owner_id="owner", now=LEASE_TEST_NOW, lease_ttl=timedelta(minutes=1))
        begin_job_processing(db, job_id=job.id, lease_owner_id="owner", lease_generation=h.lease_generation, now=LEASE_TEST_NOW)
        started_at = job.started_at
        with pytest.raises(JobProcessingError) as exc:
            recover_expired_processing_job(db, job_id=job.id, now=LEASE_TEST_NOW + timedelta(seconds=30))
        assert exc.value.reason == JobProcessingFailureReason.lease_active
        recover_expired_processing_job(db, job_id=job.id, now=LEASE_TEST_NOW + timedelta(minutes=2))
        assert job.status == JobStatus.queued
        assert job.attempt_count == 1 and job.started_at == started_at
        next_handle = acquire_job_lease(db, job_id=job.id, lease_owner_id="owner-2", now=LEASE_TEST_NOW + timedelta(minutes=3), lease_ttl=LEASE_TEST_TTL)
        begin_job_processing(db, job_id=job.id, lease_owner_id="owner-2", lease_generation=next_handle.lease_generation, now=LEASE_TEST_NOW + timedelta(minutes=4))
        assert job.attempt_count == 2 and job.started_at == started_at
        job.cancel_requested_at = LEASE_TEST_NOW + timedelta(minutes=5)
        job.lease_expires_at = LEASE_TEST_NOW + timedelta(minutes=5)
        recover_expired_processing_job(db, job_id=job.id, now=LEASE_TEST_NOW + timedelta(minutes=6))
        assert job.status == JobStatus.cancelled and job.finished_at == LEASE_TEST_NOW + timedelta(minutes=6)
    finally:
        db.close()

JOB_OUTPUT_TOP_KEYS = {"job_id", "job_status", "output_count", "outputs"}
JOB_OUTPUT_ENTRY_KEYS = {"source_id", "source_position", "source_name", "source_type", "output_kind", "transcript_standard", "web_view_url", "link_available", "document_character_count", "document_created_at", "persisted_at"}


def create_job_with_sources(email="job-output@example.com", names=("one.mp4",)):
    c, headers, pid = create_logged_in_project(email)
    source_ids = [create_gdrive_source(c, headers, pid, name) for name in names]
    r = c.post(f"/api/projects/{pid}/jobs", json={"source_ids": source_ids}, headers=headers)
    assert r.status_code == 200
    return c, headers, pid, r.json()["id"], source_ids


def add_output_row(job_id, source_id, *, url="https://docs.google.com/document/d/doc/edit", doc_id=None, persisted_at=None, output_id=None):
    db = SessionLocal()
    try:
        rel = db.query(TranscriptionJobSource).filter_by(job_id=job_id, source_id=source_id).one()
        now = persisted_at or utcnow()
        values = {"id": output_id} if output_id is not None else {}
        output = TranscriptionJobOutput(
            **values,
            job_id=job_id,
            job_source_id=rel.id,
            document_id=doc_id or f"doc-{job_id}-{source_id}",
            web_view_url=url,
            output_drive_folder_id="folder-secret-marker",
            output_kind="google_doc_transcript",
            transcript_standard="transcript_doc_v1.2",
            document_character_count=42,
            document_created_at=now,
            persisted_at=now,
            lease_generation=3,
        )
        db.add(output)
        db.commit()
        return output.id
    finally:
        db.close()


def test_job_output_authentication_and_no_csrf_required():
    c, headers, _pid, jid, source_ids = create_job_with_sources("job-output-auth@example.com")
    add_output_row(jid, source_ids[0], doc_id="doc-output-auth")
    anon = TestClient(app)
    assert anon.get(f"/api/jobs/{jid}/outputs").status_code == 401
    r = c.get(f"/api/jobs/{jid}/outputs")
    assert r.status_code == 200
    assert r.json()["output_count"] == 1


def test_job_output_owner_scoped_success_exact_shapes():
    c1, _h1, _pid1, jid1, source_ids1 = create_job_with_sources("job-output-owner1@example.com")
    c2, _h2, _pid2, jid2, source_ids2 = create_job_with_sources("job-output-owner2@example.com")
    add_output_row(jid1, source_ids1[0], url="https://docs.google.com/document/d/own/edit", doc_id="doc-output-owner-1")
    add_output_row(jid2, source_ids2[0], url="https://docs.google.com/document/d/other/edit", doc_id="doc-output-owner-2")
    body = c1.get(f"/api/jobs/{jid1}/outputs").json()
    assert set(body) == JOB_OUTPUT_TOP_KEYS
    assert body["job_id"] == jid1 and body["job_status"] == "queued" and body["output_count"] == 1
    assert set(body["outputs"][0]) == JOB_OUTPUT_ENTRY_KEYS
    assert body["outputs"][0]["source_id"] == source_ids1[0]
    assert "other" not in repr(body)
    assert c1.get(f"/api/jobs/{jid2}/outputs").status_code == 404


def test_job_output_missing_and_cross_owner_are_generic_404():
    c1, _h1, _pid1, _jid1, _source_ids1 = create_job_with_sources("job-output-404-owner@example.com")
    c2, _h2, _pid2, jid2, _source_ids2 = create_job_with_sources("job-output-404-other@example.com")
    missing = c1.get("/api/jobs/00000000-0000-0000-0000-000000000000/outputs")
    cross = c1.get(f"/api/jobs/{jid2}/outputs")
    assert missing.status_code == 404 and cross.status_code == 404
    assert missing.text == cross.text


def test_job_output_empty_owned_queued_job():
    c, _headers, _pid, jid, _source_ids = create_job_with_sources("job-output-empty@example.com")
    r = c.get(f"/api/jobs/{jid}/outputs")
    assert r.status_code == 200
    assert r.json() == {"job_id": jid, "job_status": "queued", "output_count": 0, "outputs": []}


@pytest.mark.parametrize("status_value", [JobStatus.processing, JobStatus.failed, JobStatus.cancelled, JobStatus.completed])
def test_job_output_partial_outputs_for_non_queued_statuses(status_value):
    c, _headers, _pid, jid, source_ids = create_job_with_sources(f"job-output-partial-{status_value.value}@example.com")
    add_output_row(jid, source_ids[0], doc_id=f"doc-output-partial-{status_value.value}")
    db = SessionLocal()
    try:
        job = db.get(TranscriptionJob, jid)
        job.status = status_value
        db.commit()
    finally:
        db.close()
    body = c.get(f"/api/jobs/{jid}/outputs").json()
    assert body["job_status"] == status_value.value
    assert body["output_count"] == 1


def test_job_output_deterministic_ordering_and_hidden_output_id():
    c, _headers, _pid, jid, source_ids = create_job_with_sources(
        "job-output-order@example.com",
        ("position-primary.mp4", "timestamp-late.mp4", "timestamp-early.mp4", "id-b.mp4", "id-a.mp4"),
    )
    db = SessionLocal()
    try:
        relations = db.query(TranscriptionJobSource).filter_by(job_id=jid).all()
        by_source_id = {rel.source_id: rel for rel in relations}
        by_source_id[source_ids[0]].position = 0
        by_source_id[source_ids[1]].position = 1
        by_source_id[source_ids[2]].position = 1
        by_source_id[source_ids[3]].position = 2
        by_source_id[source_ids[4]].position = 2
        db.commit()
    finally:
        db.close()

    base = datetime(2026, 7, 11, 10, 0, tzinfo=timezone.utc)
    id_position_primary = add_output_row(
        jid,
        source_ids[0],
        doc_id="doc-output-order-position",
        persisted_at=base + timedelta(hours=1),
        output_id="order-output-position-primary",
    )
    id_timestamp_late = add_output_row(
        jid,
        source_ids[1],
        doc_id="doc-output-order-timestamp-late",
        persisted_at=base + timedelta(minutes=2),
        output_id="order-output-timestamp-late",
    )
    id_timestamp_early = add_output_row(
        jid,
        source_ids[2],
        doc_id="doc-output-order-timestamp-early",
        persisted_at=base + timedelta(minutes=1),
        output_id="order-output-timestamp-early",
    )
    id_tiebreaker_b = add_output_row(
        jid,
        source_ids[3],
        doc_id="doc-output-order-id-b",
        persisted_at=base + timedelta(minutes=3),
        output_id="order-output-id-b",
    )
    id_tiebreaker_a = add_output_row(
        jid,
        source_ids[4],
        doc_id="doc-output-order-id-a",
        persisted_at=base + timedelta(minutes=3),
        output_id="order-output-id-a",
    )

    response = c.get(f"/api/jobs/{jid}/outputs")
    body = response.json()
    assert [o["source_id"] for o in body["outputs"]] == [
        source_ids[0],
        source_ids[2],
        source_ids[1],
        source_ids[4],
        source_ids[3],
    ]
    assert [o["source_position"] for o in body["outputs"]] == [0, 1, 1, 2, 2]
    assert [o["source_name"] for o in body["outputs"]] == [
        "position-primary.mp4",
        "timestamp-early.mp4",
        "timestamp-late.mp4",
        "id-a.mp4",
        "id-b.mp4",
    ]
    assert all("id" not in o and "output_id" not in o for o in body["outputs"])
    for output_id in [id_position_primary, id_timestamp_late, id_timestamp_early, id_tiebreaker_a, id_tiebreaker_b]:
        assert output_id not in response.text


def test_job_output_mixed_url_safety_preserves_entries_and_hides_secret_url():
    c, _headers, _pid, jid, source_ids = create_job_with_sources("job-output-url@example.com", ("safe.mp4", "unsafe.mp4"))
    safe = "https://docs.google.com/document/d/safe/edit?tab=t#h"
    unsafe = "https://user:secret-output-token@docs.google.com/document/d/unsafe/edit"
    add_output_row(jid, source_ids[0], url=safe, doc_id="doc-output-url-safe")
    add_output_row(jid, source_ids[1], url=unsafe, doc_id="doc-output-url-unsafe")
    r = c.get(f"/api/jobs/{jid}/outputs")
    body = r.json()
    assert body["output_count"] == 2
    assert body["outputs"][0]["web_view_url"] == safe
    assert body["outputs"][0]["link_available"] is True
    assert body["outputs"][1]["web_view_url"] is None
    assert body["outputs"][1]["link_available"] is False
    assert unsafe not in r.text and "secret-output-token" not in r.text


def test_job_output_forbidden_fields_and_secret_markers_absent():
    c, _headers, _pid, jid, source_ids = create_job_with_sources("job-output-forbidden@example.com")
    add_output_row(jid, source_ids[0], doc_id="secret-doc-marker", url="https://docs.google.com/document/d/safe/edit")
    db = SessionLocal()
    try:
        source = db.get(Source, source_ids[0])
        source.drive_file_id = "secret-drive-id-marker"
        source.drive_file_url = "https://drive.google.com/secret-drive-url-marker"
        source.s3_bucket = "secret-bucket-marker"
        source.s3_object_key = "secret-object-key-marker"
        output = db.query(TranscriptionJobOutput).filter_by(job_id=jid).one()
        output.output_drive_folder_id = "secret-folder-marker"
        output.lease_generation = 123
        db.commit()
    finally:
        db.close()
    r = c.get(f"/api/jobs/{jid}/outputs")
    for marker in ["secret-doc-marker", "secret-drive-id-marker", "secret-drive-url-marker", "secret-bucket-marker", "secret-object-key-marker", "secret-folder-marker", "lease_generation", "job_source_id"]:
        assert marker not in r.text


def test_job_output_existing_job_payloads_remain_unchanged_after_outputs_exist():
    c, _headers, pid, jid, source_ids = create_job_with_sources("job-output-compat@example.com")
    add_output_row(jid, source_ids[0], doc_id="doc-output-compat", url="https://docs.google.com/document/d/compat/edit")
    detail = c.get(f"/api/jobs/{jid}")
    listed = c.get(f"/api/projects/{pid}/jobs")
    for response in [detail, listed]:
        assert response.status_code == 200
        assert "outputs" not in response.text
        assert "web_view_url" not in response.text
        assert "compat/edit" not in response.text


def test_job_output_archived_project_matches_existing_job_detail_authority():
    c, headers, pid, jid, source_ids = create_job_with_sources("job-output-archived@example.com")
    add_output_row(jid, source_ids[0], doc_id="doc-output-archived")
    c.post(f"/api/projects/{pid}/archive", headers=headers)
    detail = c.get(f"/api/jobs/{jid}")
    outputs = c.get(f"/api/jobs/{jid}/outputs")
    assert detail.status_code == outputs.status_code == 200
    assert outputs.json()["output_count"] == 1


def test_job_output_unexpected_query_failure_is_generic(monkeypatch):
    c, _headers, _pid, jid, _source_ids = create_job_with_sources("job-output-failure@example.com")
    secret = "secret-sql-url-token traceback SELECT * FROM transcription_job_outputs"
    def fail(_db, _job_id):
        raise RuntimeError(secret)
    monkeypatch.setattr("studio_api.main.load_browser_job_output_rows", fail)
    client = TestClient(app, raise_server_exceptions=False)
    client.cookies.update(c.cookies)
    r = client.get(f"/api/jobs/{jid}/outputs")
    assert r.status_code == 500
    assert secret not in r.text
    for marker in ["secret-sql-url-token", "traceback", "SELECT", jid, "transcription_job_outputs"]:
        assert marker not in r.text


def test_google_scope_parser_exact_drive_file_only():
    from studio_api.google_scopes import has_drive_file_scope
    assert has_drive_file_scope("openid email https://www.googleapis.com/auth/drive.file")
    assert has_drive_file_scope("  https://www.googleapis.com/auth/drive.file   openid ")
    assert not has_drive_file_scope("openid email")
    assert not has_drive_file_scope("https://www.googleapis.com/auth/drive.file.extra")


def _connect_google_for_test(user_id: str, scopes: str = "openid email https://www.googleapis.com/auth/drive.file"):
    from studio_api.models import GoogleConnection, GoogleConnectionStatus, GoogleProvider
    from studio_api.google_connection_access import google_token_aad
    db = SessionLocal()
    try:
        conn = GoogleConnection(user_id=user_id, provider=GoogleProvider.google, status=GoogleConnectionStatus.active, google_email="g@example.com", scopes=scopes, created_at=utcnow(), connected_at=utcnow())
        db.add(conn); db.flush()
        ct, nonce = encrypt("refresh-token-test", master_key_from_b64(Path(os.environ["STUDIO_CREDENTIAL_MASTER_KEY_FILE"]).read_text()), google_token_aad(user_id, conn.id))
        conn.refresh_token_ciphertext = ct; conn.refresh_token_nonce = nonce; conn.key_id = "studio-v1"
        db.commit(); return conn.id
    finally:
        db.close()


def test_google_picker_session_csrf_scope_config_and_safe_response(monkeypatch):
    import studio_api.main as main
    pw = admin(); c = TestClient(app); csrf = login(c, pw)
    db = SessionLocal(); user = db.query(User).first(); uid = user.id; db.close()
    headers = {"origin": "https://studio.test", "x-csrf-token": csrf}
    assert c.post("/api/google/picker/session", headers={"origin": "https://evil.test", "x-csrf-token": csrf}).status_code == 403
    assert c.post("/api/google/picker/session", headers={"origin": "https://studio.test", "x-csrf-token": "bad"}).status_code == 403
    assert c.post("/api/google/picker/session", headers=headers).status_code == 503
    monkeypatch.setattr(main.settings, "google_picker_api_key", "public-key")
    monkeypatch.setattr(main.settings, "google_picker_app_id", "123456")
    assert c.post("/api/google/picker/session", headers=headers).status_code == 404
    _connect_google_for_test(uid, "openid email")
    assert c.post("/api/google/picker/session", headers=headers).status_code == 409
    with engine.begin() as conn:
        conn.execute(text("UPDATE google_connections SET scopes='openid email https://www.googleapis.com/auth/drive.file'"))
    monkeypatch.setattr(main, "refresh_user_google_drive_access_token", lambda *a, **k: "short-access-token")
    r = c.post("/api/google/picker/session", headers=headers)
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-store"
    assert r.headers["pragma"] == "no-cache"
    body = r.json()
    assert body == {"access_token": "short-access-token", "api_key": "public-key", "app_id": "123456", "scope_ready": True}
    assert "refresh" not in r.text and "cipher" not in r.text and "key_id" not in r.text


def test_google_picker_source_and_output_selection_revalidates_server_metadata(monkeypatch):
    import studio_api.main as main
    from studio_api.google_drive import GoogleDriveMetadata, GOOGLE_FOLDER_MIME_TYPE
    pw = admin(); c = TestClient(app); csrf = login(c, pw)
    db = SessionLocal(); uid = db.query(User).first().id; db.close(); _connect_google_for_test(uid)
    monkeypatch.setattr(main, "refresh_user_google_drive_access_token", lambda *a, **k: "access")
    metas = {
        "file-a": GoogleDriveMetadata("file-a", "Backend A.mp3", "audio/mpeg", 10, "https://drive.google.com/file/d/file-a/view", None, None, False),
        "file-b": GoogleDriveMetadata("file-b", "Backend B.mp4", "video/mp4", 20, "https://drive.google.com/file/d/file-b/view", None, None, False),
        "folder": GoogleDriveMetadata("folder", "Results", GOOGLE_FOLDER_MIME_TYPE, None, "https://drive.google.com/drive/folders/folder", None, None, True),
        "bad": GoogleDriveMetadata("bad", "Doc", "application/pdf", 5, "https://drive.google.com/file/d/bad/view", None, None, False),
    }
    monkeypatch.setattr("studio_api.google_drive.fetch_drive_file_metadata", lambda token, did: metas[did])
    headers = {"origin": "https://studio.test", "x-csrf-token": csrf}
    pid = c.post("/api/projects", json={"title":"Picker"}, headers=headers).json()["id"]
    assert c.post(f"/api/projects/{pid}/sources/google-picker", json={"file_ids": []}, headers=headers).status_code == 422
    assert c.post(f"/api/projects/{pid}/sources/google-picker", json={"file_ids": ["file-a", "file-a"]}, headers=headers).status_code == 422
    assert c.post(f"/api/projects/{pid}/sources/google-picker", json={"file_ids": ["folder"]}, headers=headers).status_code == 422
    assert c.post(f"/api/projects/{pid}/sources/google-picker", json={"file_ids": ["bad"]}, headers=headers).status_code == 422
    r = c.post(f"/api/projects/{pid}/sources/google-picker", json={"file_ids": ["file-b", "file-a"]}, headers=headers)
    assert r.status_code == 200
    assert [s["original_filename"] for s in r.json()["sources"]] == ["Backend B.mp4", "Backend A.mp3"]
    assert "client" not in r.text.lower()
    assert c.post(f"/api/projects/{pid}/output-folder/google-picker", json={"folder_id":"file-a"}, headers=headers).status_code == 422
    r = c.post(f"/api/projects/{pid}/output-folder/google-picker", json={"folder_id":"folder"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["output_drive_folder_id"] == "folder"
    assert r.json()["output_drive_folder_name"] == "Results"

import base64
import os
import subprocess
import sys
import tempfile
import uuid
from contextlib import contextmanager
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
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import OperationalError
from studio_api.config import Settings
from studio_api.db import SessionLocal, engine
from studio_api.deps import get_client_ip
from studio_api.main import app, limiter
from studio_api.models import AuditEvent, DiagnosticDebugSession, DiagnosticEvent, TranscriptionOutputReconciliation, TranscriptionJobSourceAttempt, OutputReconciliationStatus, SourceAttemptRetryDisposition, SourceAttemptStage, CredentialProvider, CredentialStatus, JobSourceStatus, JobStatus, LocalIdentity, Project, ProviderCredential, ProviderCredentialVersion, Source, SourceStorageCleanupStatus, SourceType, SourceUploadStatus, TranscriptionJob, TranscriptionJobOutput, TranscriptionJobSource, User, UserRole, UserStatus
from studio_api.security import aad, decrypt, encrypt, hash_password, master_key_from_b64, utcnow, verify_password
from studio_api.job_claim_lease import JobLeaseError, JobLeaseFailureReason, acquire_job_lease, acquire_next_ready_job_lease, invalidate_job_lease, is_lease_active, release_job_lease, renew_job_lease
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
        tables = ["transcription_job_source_attempts", "transcription_output_reconciliations", "diagnostic_debug_sessions", "diagnostic_events", "audit_events", "google_oauth_states", "google_connections", "provider_credential_versions", "provider_credentials", "transcription_job_outputs", "transcription_job_sources", "transcription_jobs", "sources", "projects", "sessions", "login_contexts", "local_identities", "users"]
        required_tables = set(tables)
        missing = required_tables - set(inspect(conn).get_table_names())
        assert not missing, f"shared test database schema is not at current head: {sorted(missing)}"
        conn.execute(text("TRUNCATE " + ", ".join(tables) + " RESTART IDENTITY CASCADE"))
    yield


@contextmanager
def isolated_migration_database(prefix: str):
    temp_db = f"{prefix}_{uuid.uuid4().hex}"
    base_url = make_url(engine.url)
    admin_url = base_url.set(database="postgres")
    temp_url = base_url.set(database=temp_db)
    admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    try:
        with admin_engine.connect() as conn:
            conn.execute(text(f'CREATE DATABASE "{temp_db}"'))
    except OperationalError as exc:
        admin_engine.dispose()
        pytest.skip(f"PostgreSQL database creation unavailable for isolated migration test: {exc}")
    finally:
        admin_engine.dispose()

    env = os.environ.copy()
    env.pop("STUDIO_DATABASE_URL", None)
    env["STUDIO_DATABASE_NAME"] = temp_db
    temp_engine = create_engine(temp_url)
    try:
        yield temp_engine, env
    finally:
        temp_engine.dispose()
        cleanup_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
        try:
            with cleanup_engine.connect() as conn:
                conn.execute(text(f'DROP DATABASE IF EXISTS "{temp_db}" WITH (FORCE)'))
        finally:
            cleanup_engine.dispose()


def run_alembic(target: str, *, env: dict[str, str], command: str = "upgrade") -> None:
    subprocess.run([sys.executable, "-m", "alembic", "-c", str(ALEMBIC), command, target], cwd=ROOT, env=env, check=True)


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


def test_account_source_retention_preferences_are_server_authoritative():
    email = "retention-preferences@example.com"
    pw = admin(email)
    anonymous = TestClient(app)
    assert anonymous.get("/api/account/preferences").status_code == 401

    c = TestClient(app)
    csrf = login(c, pw, email)
    headers = {"origin": "https://studio.test", "x-csrf-token": csrf}
    expected_options = [3600, 86400, 259200, 604800, 2592000]
    current = c.get("/api/account/preferences")
    assert current.status_code == 200
    assert current.json() == {
        "source_retention_ttl_seconds": 86400,
        "allowed_source_retention_ttl_seconds": expected_options,
    }
    assert c.patch("/api/account/preferences", json={"source_retention_ttl_seconds": 604800}).status_code == 403
    assert c.patch("/api/account/preferences", json={"source_retention_ttl_seconds": 7200}, headers=headers).status_code == 422
    assert c.patch("/api/account/preferences", json={"source_retention_ttl_seconds": 604800, "unknown": True}, headers=headers).status_code == 422

    updated = c.patch("/api/account/preferences", json={"source_retention_ttl_seconds": 604800}, headers=headers)
    assert updated.status_code == 200
    assert updated.json() == {
        "source_retention_ttl_seconds": 604800,
        "allowed_source_retention_ttl_seconds": expected_options,
    }
    assert c.patch("/api/account/preferences", json={"source_retention_ttl_seconds": 604800}, headers=headers).status_code == 200
    db = SessionLocal()
    try:
        user = db.query(User).filter_by(email=email).one()
        assert user.source_retention_ttl_seconds == 604800
        assert db.query(AuditEvent).filter_by(event_type="account.preferences_updated", actor_user_id=user.id).count() == 1
    finally:
        db.close()


def test_source_upload_policy_is_authenticated_safe_and_not_cached(monkeypatch):
    email = "source-upload-policy@example.com"
    pw = admin(email)
    anonymous = TestClient(app)
    assert anonymous.get("/api/sources/upload-policy").status_code == 401

    from studio_api import main as main_mod
    monkeypatch.setattr(main_mod.settings, "source_max_upload_bytes", 123456)
    monkeypatch.setattr(
        type(main_mod.settings), "source_storage_configured", lambda self: True
    )
    c = TestClient(app)
    login(c, pw, email)
    response = c.get("/api/sources/upload-policy")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["pragma"] == "no-cache"
    assert response.json() == {
        "local_upload_enabled": True,
        "max_upload_bytes": 123456,
        "supported_mime_prefixes": ["audio/", "video/"],
        "supported_mime_types": ["application/ogg"],
    }
    forbidden = ["bucket", "object", "presigned", "endpoint", "access_key", "secret"]
    assert all(value not in response.text.lower() for value in forbidden)


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
    assert "owner_user_id" not in created
    assert created["archived_at"] is None

    r = c.patch(f"/api/projects/{created['id']}", json={"title": "Renamed", "description": ""}, headers={"origin": "https://studio.test", "x-csrf-token": csrf})
    assert r.status_code == 200
    assert r.json()["title"] == "Renamed"
    assert r.json()["description"] is None
    assert "owner_user_id" not in r.json()

    r = c.get("/api/projects")
    assert r.status_code == 200
    assert [p["id"] for p in r.json()["projects"]] == [created["id"]]
    assert all("owner_user_id" not in project for project in r.json()["projects"])

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
        self.head_size = 10
        self.head_type = "audio/mpeg"
        self.missing = False
    def presigned_put_url(self, key, content_type, expires_seconds):
        return f"https://upload.test/{key}?signature=fake"
    def head_object(self, key):
        if self.missing:
            raise FileNotFoundError(key)
        from studio_api.source_storage import ObjectHead
        return ObjectHead(size_bytes=self.head_size, content_type=self.head_type)
    def delete_object(self, key, *, bucket=None):
        self.deleted.append((bucket, key))


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



def create_gdrive_source(_c, _headers, pid, name="meeting.mp4"):
    db = SessionLocal()
    try:
        src = Source(project_id=pid, source_type=SourceType.google_drive, original_filename=name, mime_type="video/mp4", size_bytes=42, drive_file_id=f"file_{name.replace('.', '_')}", drive_file_url="https://drive.google.com/file/d/file_123/view", upload_status=SourceUploadStatus.uploaded, uploaded_at=utcnow(), storage_cleanup_status=SourceStorageCleanupStatus.not_applicable)
        db.add(src); db.commit(); return src.id
    finally:
        db.close()


def prepare_legacy_job_authority(c, headers, pid):
    db = SessionLocal()
    try:
        project = db.get(Project, pid)
        project.output_drive_folder_id = "folder-test"
        project.output_drive_folder_url = "https://drive.google.com/drive/folders/folder-test"
        project.output_drive_folder_name = "Test results"
        db.commit()
    finally:
        db.close()
    r = c.post("/api/credentials", json={"provider":"elevenlabs", "label":f"legacy-{pid}", "raw_value":"test-elevenlabs-key"}, headers=headers)
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
    assert '"provider_credential_id"' not in lowered


def test_transcription_jobs_auth_and_csrf_required():
    c, headers, pid = create_logged_in_project("jobs-auth@example.com")
    sid = create_gdrive_source(c, headers, pid)
    prepare_legacy_job_authority(c, headers, pid)
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


def test_legacy_job_selects_sole_active_elevenlabs_credential_for_blank_id():
    c, headers, pid = create_logged_in_project("jobs-blank-credential@example.com")
    sid = create_gdrive_source(c, headers, pid)
    missing_authority = c.post(f"/api/projects/{pid}/jobs", json={"source_ids":[sid]}, headers=headers)
    assert missing_authority.status_code == 422
    assert missing_authority.json()["detail"] == "Выберите папку Google Drive для результатов."
    db = SessionLocal()
    try:
        assert db.query(TranscriptionJob).filter_by(project_id=pid).count() == 0
    finally:
        db.close()
    credential_id = prepare_legacy_job_authority(c, headers, pid)
    for value in ["", "   "]:
        r = c.post(f"/api/projects/{pid}/jobs", json={"source_ids":[sid], "provider_credential_id":value}, headers=headers)
        assert r.status_code == 200
        assert app.openapi()["paths"][f"/api/projects/{{project_id}}/jobs"]["post"]["deprecated"] is True
        assert "provider_credential_id" not in r.json()
        assert r.json()["output_folder"] == {"name":"Test results", "web_view_url":"https://drive.google.com/drive/folders/folder-test"}
        assert r.headers["deprecation"] == "true"
        assert r.headers["link"] == f'</api/projects/{pid}/jobs/batch>; rel="successor-version"'
        assert_job_response_safe(r.text)
        assert "raw-provider-secret" not in r.text


def test_legacy_create_job_rejects_openai_and_preserves_source_order_and_safe_metadata():
    c, headers, pid = create_logged_in_project("jobs-create@example.com")
    sid1 = create_gdrive_source(c, headers, pid, "first.mp4")
    sid2 = add_local_source(pid)
    raw = "raw-provider-secret"
    openai_cred = c.post("/api/credentials", json={"provider":"openai", "label":"jobs-openai", "raw_value":raw}, headers=headers).json()["id"]
    cred = prepare_legacy_job_authority(c, headers, pid)
    rejected = c.post(f"/api/projects/{pid}/jobs", json={"source_ids":[sid1, sid2], "provider_credential_id":openai_cred}, headers=headers)
    assert rejected.status_code == 422
    r = c.post(f"/api/projects/{pid}/jobs", json={"source_ids":[sid1, sid2], "provider_credential_id":cred, "title":" Batch ", "language":"EN_us", "options":{"diarize":False}}, headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "queued"
    assert body["source_count"] == 2
    assert body["language_mode"] == "en_us"
    assert body["diarization_enabled"] is False
    assert [s["id"] for s in body["sources"]] == [sid1, sid2]
    assert [s["position"] for s in body["sources"]] == [0, 1]
    assert "provider_credential_id" not in body
    assert "drive_file_url" not in body["sources"][0]
    assert_job_response_safe(r.text)
    assert raw not in r.text
    detail = c.get(f"/api/jobs/{body['id']}")
    assert detail.status_code == 200
    assert [s["id"] for s in detail.json()["sources"]] == [sid1, sid2]
    blocked_delete = c.delete(f"/api/sources/{sid1}", headers=headers)
    assert blocked_delete.status_code == 409
    assert blocked_delete.json()["detail"]["reason"] == "queued_job_uses_source"
    active_sources = c.get(f"/api/projects/{pid}/sources")
    assert active_sources.status_code == 200
    assert sid1 in [s["id"] for s in active_sources.json()["sources"]]
    db = SessionLocal()
    try:
        src = db.get(Source, sid1)
        queued = db.get(TranscriptionJob, body["id"])
        assert src.deleted_at is None
        assert src.upload_status == SourceUploadStatus.uploaded
        assert queued.status == JobStatus.queued
        assert queued.language == "en_us"
        assert queued.provider_credential_id == cred
    finally:
        db.close()

    cancel = c.post(f"/api/jobs/{body['id']}/cancel", headers=headers)
    assert cancel.status_code == 200
    assert cancel.json()["status"] == "cancelled"
    deleted = c.delete(f"/api/sources/{sid1}", headers=headers)
    assert deleted.status_code == 200
    assert sid1 not in [s["id"] for s in c.get(f"/api/projects/{pid}/sources").json()["sources"]]
    historical = c.get(f"/api/jobs/{body['id']}")
    assert historical.status_code == 200
    assert [s["id"] for s in historical.json()["sources"]] == [sid1, sid2]
    first_source = historical.json()["sources"][0]
    assert first_source["upload_status"] == "deleted"
    assert first_source["original_filename"] == "first.mp4"
    assert "drive_file_id" not in first_source
    assert "s3_bucket" not in first_source
    assert "s3_object_key" not in first_source
    listed = c.get(f"/api/projects/{pid}/jobs")
    assert listed.status_code == 200 and listed.json()["jobs"][0]["id"] == body["id"]



def test_legacy_job_creation_queues_without_processing_inline():
    c, headers, pid = create_logged_in_project("jobs-record-only@example.com")
    sid = create_gdrive_source(c, headers, pid)
    prepare_legacy_job_authority(c, headers, pid)
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
    prepare_legacy_job_authority(c, headers, pid)
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
    prepare_legacy_job_authority(c, headers, pid)
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
    prepare_legacy_job_authority(c1, h1, pid1)
    prepare_legacy_job_authority(c2, h2, pid2)
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

def test_project_patch_rejects_unverified_output_folder_binding_fields():
    c, headers, pid = create_logged_in_project("folder@example.com")
    r = c.patch(f"/api/projects/{pid}", json={"title": " Renamed ", "description": " Safe metadata "}, headers=headers)
    assert r.status_code == 200
    assert r.json()["title"] == "Renamed"
    assert r.json()["description"] == "Safe metadata"
    for payload in [
        {"output_drive_folder_id": "abc_123-XYZ"},
        {"output_drive_folder_url": "https://drive.google.com/drive/folders/abc_123-XYZ"},
        {"output_drive_folder_name": "Results"},
        {"unexpected_project_field": "ignored-before-hardening"},
    ]:
        assert c.patch(f"/api/projects/{pid}", json=payload, headers=headers).status_code == 422
    project = next(item for item in c.get("/api/projects").json()["projects"] if item["id"] == pid)
    assert project["output_drive_folder_id"] is None
    assert project["output_drive_folder_url"] is None
    assert project["output_drive_folder_name"] is None




def test_source_display_filename_normalization_preserves_unicode_and_extension():
    from studio_api.source_storage import normalize_source_display_filename
    cyrillic = "Лекция 1. Личность как психологическое явление.flac"
    assert normalize_source_display_filename(cyrillic) == cyrillic
    assert normalize_source_display_filename(" Mix Лекция-01_(draft).mp3 ") == "Mix Лекция-01_(draft).mp3"
    assert normalize_source_display_filename("../дир/файл.mp3") == ".._дир_файл.mp3"
    assert normalize_source_display_filename("bad\nname\r\x00.mp3") == "badname.mp3"
    assert normalize_source_display_filename("\x00\n") == "source"
    long_name = "Л" * 300 + ".flac"
    normalized = normalize_source_display_filename(long_name)
    assert len(normalized) == 255
    assert normalized.endswith(".flac")

def test_google_drive_source_metadata_lifecycle_owner_scoped(monkeypatch):
    import studio_api.main as main_mod
    from studio_api.google_drive import GoogleDriveMetadata

    def fail_storage(*_args, **_kwargs):
        raise AssertionError("Google Drive source removal must not delete Studio storage")

    monkeypatch.setattr(main_mod, "get_source_storage", fail_storage)
    c, headers, pid = create_logged_in_project("gdrive@example.com")
    db = SessionLocal()
    user_id = db.query(User).filter_by(email="gdrive@example.com").one().id
    db.close()
    _connect_google_for_test(user_id)
    monkeypatch.setattr(
        main_mod, "refresh_user_google_drive_access_token", lambda *a, **k: "access"
    )
    metadata = {
        "file_123": GoogleDriveMetadata(
            "file_123",
            "Лекция 1. Личность как психологическое явление.flac",
            "audio/flac",
            42,
            "https://drive.google.com/file/d/file_123/view",
            None,
            None,
            False,
        ),
        "file_456": GoogleDriveMetadata(
            "file_456",
            "active.mp4",
            "video/mp4",
            43,
            "https://drive.google.com/file/d/file_456/view",
            None,
            None,
            False,
        ),
    }
    monkeypatch.setattr(
        "studio_api.google_drive.fetch_drive_file_metadata",
        lambda token, drive_file_id: metadata[drive_file_id],
    )
    r = c.post(
        f"/api/projects/{pid}/sources/google-picker",
        json={"file_ids": ["file_123"]},
        headers=headers,
    )
    assert r.status_code == 200
    created = r.json()["sources"][0]
    sid = created["id"]
    assert created["source_type"] == "google_drive"
    assert created["original_filename"] == "Лекция 1. Личность как психологическое явление.flac"
    assert "s3" not in r.text.lower()
    r2 = c.post(
        f"/api/projects/{pid}/sources/google-picker",
        json={"file_ids": ["file_456"]},
        headers=headers,
    )
    assert r2.status_code == 200
    active_sid = r2.json()["sources"][0]["id"]
    assert [s["id"] for s in c.get(f"/api/projects/{pid}/sources").json()["sources"]] == [active_sid, sid]
    assert c.delete(f"/api/sources/{sid}", headers=headers).status_code == 200
    assert [s["id"] for s in c.get(f"/api/projects/{pid}/sources").json()["sources"]] == [active_sid]
    db = SessionLocal(); src = db.get(Source, sid); db.close()
    assert src is not None
    assert src.deleted_at is not None
    assert src.upload_status == SourceUploadStatus.deleted
    assert src.drive_file_id == "file_123"
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
    assert r.headers["cache-control"] == "no-store"
    assert r.headers["pragma"] == "no-cache"
    assert "/secret%20song" not in r.text and "secret song.mp3" not in r.text and "secret%20song.mp3" not in r.text
    assert "no-secret-id" not in r.text and "no-secret-key" not in r.text
    db = SessionLocal(); src = db.get(Source, body["source_id"]); object_key = src.s3_object_key; source_id = src.id; original_filename = src.original_filename; db.close()
    assert original_filename == ".._secret song.mp3"
    assert object_key.endswith(f"/projects/{pid}/sources/{source_id}/source")
    assert original_filename not in object_key

    unicode_name = "Лекция 1. Личность как психологическое явление.flac"
    r = c.post(f"/api/projects/{pid}/sources/local-upload/initiate", json={"original_filename": unicode_name,"mime_type":"audio/mpeg","size_bytes":10}, headers=headers)
    assert r.status_code == 200
    db = SessionLocal(); src = db.get(Source, r.json()["source_id"]); db.close()
    assert src.original_filename == unicode_name


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


@pytest.mark.parametrize(
    ("head_size", "head_type", "expected_status"),
    [
        (None, "audio/mpeg", 409),
        (10, None, 409),
        (11, "audio/mpeg", 409),
        (10, "audio/wav", 409),
        (1001, "audio/mpeg", 422),
        (10, "text/plain", 422),
    ],
)
def test_complete_local_upload_requires_exact_verified_metadata(monkeypatch, head_size, head_type, expected_status):
    fake = enable_fake_storage(monkeypatch)
    fake.head_size = head_size
    fake.head_type = head_type
    size_label = "missing" if head_size is None else str(head_size)
    c, headers, pid = create_logged_in_project(f"upload-metadata-{size_label}-{expected_status}@example.com")
    initiated = c.post(
        f"/api/projects/{pid}/sources/local-upload/initiate",
        json={"original_filename":"metadata.mp3", "mime_type":"audio/mpeg", "size_bytes":10},
        headers=headers,
    )
    sid = initiated.json()["source_id"]
    pending_expires_at = initiated.json()["expires_at"]

    response = c.post(f"/api/sources/{sid}/local-upload/complete", headers=headers)

    assert response.status_code == expected_status
    db = SessionLocal()
    try:
        src = db.get(Source, sid)
        assert src.upload_status == SourceUploadStatus.pending
        assert src.uploaded_at is None
        assert src.expires_at.isoformat() == pending_expires_at
    finally:
        db.close()


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
    assert fake.deleted == []



@pytest.mark.parametrize(
    "mutation",
    ["deleted", "expired", "archived_project", "project_owner", "source_project", "bucket", "key"],
)
def test_complete_local_upload_revalidates_after_head_race(monkeypatch, mutation):
    fake = enable_fake_storage(monkeypatch)
    from studio_api import models as m
    from studio_api.source_storage import ObjectHead

    c, headers, pid = create_logged_in_project(f"complete-race-{mutation}@example.com")
    r = c.post(f"/api/projects/{pid}/sources/local-upload/initiate", json={"original_filename":"race.mp3","mime_type":"audio/mpeg","size_bytes":10}, headers=headers)
    sid = r.json()["source_id"]
    db = SessionLocal()
    try:
        src = db.get(Source, sid)
        original_bucket = src.s3_bucket
        original_key = src.s3_object_key
        if mutation in {"project_owner", "source_project"}:
            other = User(email=f"other-{mutation}@example.com", role=UserRole.user, status=UserStatus.active)
            db.add(other); db.flush()
            other_project = Project(owner_user_id=other.id, title="Other")
            db.add(other_project); db.flush()
            other_project_id = other_project.id
        else:
            other_project_id = None
        db.commit()
    finally:
        db.close()

    def mutate_during_head(key):
        assert key == original_key
        race_db = SessionLocal()
        try:
            src = race_db.get(Source, sid)
            if mutation == "deleted":
                src.deleted_at = utcnow(); src.upload_status = SourceUploadStatus.deleted
            elif mutation == "expired":
                src.expires_at = utcnow() - timedelta(seconds=1)
            elif mutation == "archived_project":
                race_db.get(Project, pid).archived_at = utcnow()
            elif mutation == "project_owner":
                race_db.get(Project, pid).owner_user_id = race_db.get(Project, other_project_id).owner_user_id
            elif mutation == "source_project":
                src.project_id = other_project_id
            elif mutation == "bucket":
                src.s3_bucket = "changed-bucket"
            elif mutation == "key":
                src.s3_object_key = "changed-key"
            race_db.commit()
        finally:
            race_db.close()
        return ObjectHead(size_bytes=10, content_type="audio/mpeg")

    fake.head_object = mutate_during_head
    response = c.post(f"/api/sources/{sid}/local-upload/complete", headers=headers)
    assert response.status_code == 404
    db = SessionLocal()
    try:
        src = db.get(Source, sid)
        assert src.uploaded_at is None
        if mutation not in {"deleted"}:
            assert src.upload_status != SourceUploadStatus.uploaded
    finally:
        db.close()


def test_complete_local_upload_revalidates_successful_unchanged_source(monkeypatch):
    enable_fake_storage(monkeypatch)
    c, headers, pid = create_logged_in_project("complete-race-success@example.com")
    preference = c.patch(
        "/api/account/preferences",
        json={"source_retention_ttl_seconds": 604800},
        headers=headers,
    )
    assert preference.status_code == 200
    r = c.post(f"/api/projects/{pid}/sources/local-upload/initiate", json={"original_filename":"success.mp3","mime_type":"audio/mpeg","size_bytes":10}, headers=headers)
    pending_expires_at = datetime.fromisoformat(r.json()["expires_at"])
    sid = r.json()["source_id"]
    response = c.post(f"/api/sources/{sid}/local-upload/complete", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["upload_status"] == "uploaded"
    uploaded_at = datetime.fromisoformat(body["uploaded_at"])
    retained_until = datetime.fromisoformat(body["expires_at"])
    assert retained_until - uploaded_at == timedelta(seconds=604800)
    assert retained_until > pending_expires_at
    assert "s3_bucket" not in body and "s3_object_key" not in body

def test_expired_local_upload_cleanup_marks_deleted_and_deletes(monkeypatch):
    fake = enable_fake_storage(monkeypatch)
    from studio_api import source_cleanup
    from studio_api.models import Source, SourceType, SourceUploadStatus
    import studio_api.source_storage as source_storage
    monkeypatch.setattr(source_storage, "get_source_storage", lambda settings: fake)
    c, headers, pid = create_logged_in_project("cleanup@example.com")
    db = SessionLocal()
    try:
        src = Source(project_id=pid, source_type=SourceType.local_upload, original_filename="old.mp3", mime_type="audio/mpeg", size_bytes=10, s3_bucket="studio-temp", s3_object_key="old/key", upload_status=SourceUploadStatus.pending, expires_at=utcnow()-timedelta(seconds=1))
        db.add(src); db.commit()
        assert source_cleanup.cleanup_expired_local_uploads(db, __import__("studio_api.main", fromlist=["settings"]).settings) == 1
        db.refresh(src)
        assert src.upload_status == SourceUploadStatus.expired
        assert src.deleted_at is None and src.delete_reason == "retention_expired"
        assert fake.deleted == [("studio-temp", "old/key")]
    finally:
        db.close()


def configure_google_oauth(monkeypatch, tmp_path):
    from studio_api import main as main_mod
    secret = tmp_path / "google_client_secret"
    secret.write_text("google-client-secret-test", encoding="utf-8")
    main_mod.settings.google_oauth_client_id = "google-client-id-test.apps.googleusercontent.com"
    main_mod.settings.google_oauth_client_secret_file = str(secret)
    main_mod.settings.app_origin = "https://studio.test"
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
    assert r.json() == {"connected": False, "status": None, "google_email": None, "scopes": None, "connected_at": None, "revoked_at": None, "picker_configured": False, "picker_scope_ready": False, "picker_ready": False, "reconnect_required": False}


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
    assert r.headers["cache-control"] == "no-store"
    assert r.headers["pragma"] == "no-cache"
    body = r.json(); url = body["authorization_url"]
    assert "client_id=google-client-id-test" in url
    assert "access_type=offline" in url
    assert "prompt=consent" in url
    from urllib.parse import parse_qs, urlparse
    query = parse_qs(urlparse(url).query)
    assert "include_granted_scopes" not in query
    assert "google-client-secret-test" not in r.text
    assert "refresh_token" not in r.text and "access_token" not in r.text and "id_token" not in r.text
    state = query["state"][0]
    db = SessionLocal()
    try:
        from studio_api.models import GoogleOAuthState
        rows = db.query(GoogleOAuthState).all()
        assert len(rows) == 1
        assert rows[0].state_hash != state
        assert rows[0].expires_at > utcnow()
    finally:
        db.close()


def assert_oauth_redirect(response, result, forbidden_values=None):
    assert response.status_code == 303
    assert response.headers["cache-control"] == "no-store"
    location = response.headers["location"]
    assert location == f"https://studio.test/?google_oauth={result}"
    forbidden = [
        "code=",
        "state=",
        "access_token=",
        "refresh_token=",
        "id_token=",
        "auth-code",
        "user@gmail.com",
        "google-sub",
        "id-token-raw-test-value",
        "access-token-raw-test-value",
        "refresh-token-raw-test-value",
    ]
    forbidden.extend(forbidden_values or [])
    assert all(value not in location for value in forbidden)

def test_google_oauth_callback_rejects_missing_invalid_expired_and_used_state(monkeypatch, tmp_path):
    configure_google_oauth(monkeypatch, tmp_path)
    pw = admin("google-state@example.com"); c = TestClient(app, follow_redirects=False); csrf = login(c, pw, "google-state@example.com")
    assert_oauth_redirect(c.get("/api/google/oauth/callback"), "invalid_callback")
    assert_oauth_redirect(c.get("/api/google/oauth/callback?state=bad&code=code"), "invalid_state")
    r = c.post("/api/google/oauth/start", headers={"origin": "https://studio.test", "x-csrf-token": csrf})
    from urllib.parse import parse_qs, urlparse
    state = parse_qs(urlparse(r.json()["authorization_url"]).query)["state"][0]
    db = SessionLocal()
    try:
        from studio_api.models import GoogleOAuthState
        row = db.query(GoogleOAuthState).first(); row.expires_at = utcnow() - timedelta(seconds=1); db.commit()
    finally:
        db.close()
    assert_oauth_redirect(c.get(f"/api/google/oauth/callback?state={state}&code=code"), "invalid_state")

    r = c.post("/api/google/oauth/start", headers={"origin": "https://studio.test", "x-csrf-token": csrf})
    state = parse_qs(urlparse(r.json()["authorization_url"]).query)["state"][0]
    from studio_api.google_oauth import GoogleTokenResult
    monkeypatch.setattr("studio_api.google_oauth.exchange_code_for_tokens", lambda cfg, code: GoogleTokenResult("refresh-safe", None, None, "openid email", "sub", "g@example.com"))
    assert_oauth_redirect(c.get(f"/api/google/oauth/callback?state={state}&code=code"), "connected")
    assert_oauth_redirect(c.get(f"/api/google/oauth/callback?state={state}&code=code"), "invalid_state")


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
    pw = admin("google-connect@example.com"); c = TestClient(app, follow_redirects=False); csrf = login(c, pw, "google-connect@example.com")
    r = c.post("/api/google/oauth/start", headers={"origin": "https://studio.test", "x-csrf-token": csrf})
    from urllib.parse import parse_qs, urlparse
    state = parse_qs(urlparse(r.json()["authorization_url"]).query)["state"][0]
    r = c.get(f"/api/google/oauth/callback?state={state}&code=auth-code&return_url=https://evil.test&next=https://evil.test", headers={"host":"evil.test", "origin":"https://evil.test", "referer":"https://evil.test/path"})
    assert_oauth_redirect(r, "connected")
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



def test_google_oauth_callback_safe_expected_error_redirects(monkeypatch, tmp_path):
    configure_google_oauth(monkeypatch, tmp_path)
    pw = admin("google-errors@example.com"); c = TestClient(app, follow_redirects=False); csrf = login(c, pw, "google-errors@example.com")
    raw_description = "raw_google_denied_secret"
    r = c.get(f"/api/google/oauth/callback?error=access_denied&error_description={raw_description}")
    assert_oauth_redirect(r, "cancelled", [raw_description])

    from urllib.parse import parse_qs, urlparse
    from studio_api.google_oauth import GoogleTokenResult

    r = c.post("/api/google/oauth/start", headers={"origin": "https://studio.test", "x-csrf-token": csrf})
    state = parse_qs(urlparse(r.json()["authorization_url"]).query)["state"][0]
    raw_exception = "raw exchange secret"
    monkeypatch.setattr("studio_api.google_oauth.exchange_code_for_tokens", lambda cfg, code: (_ for _ in ()).throw(RuntimeError(raw_exception)))
    assert_oauth_redirect(c.get(f"/api/google/oauth/callback?state={state}&code=auth-code"), "exchange_failed", [raw_exception])

    r = c.post("/api/google/oauth/start", headers={"origin": "https://studio.test", "x-csrf-token": csrf})
    state = parse_qs(urlparse(r.json()["authorization_url"]).query)["state"][0]
    monkeypatch.setattr("studio_api.google_oauth.exchange_code_for_tokens", lambda cfg, code: GoogleTokenResult(None, "access-token-test-value", "id-token-test-value", "openid email", "google-sub", "user@gmail.com"))
    assert_oauth_redirect(c.get(f"/api/google/oauth/callback?state={state}&code=auth-code"), "offline_access_missing", ["access-token-test-value", "id-token-test-value"])
    db = SessionLocal()
    try:
        from studio_api.models import GoogleConnection
        assert db.query(GoogleConnection).count() == 0
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
        job = TranscriptionJob(project_id=project.id, owner_user_id=user.id, status=status, title="Lease Job", output_drive_folder_id="folder-1", output_drive_folder_url="https://drive.google.com/drive/folders/folder-1", output_drive_folder_name="Lease folder")
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
    with isolated_migration_database("studio_migration_0005") as (temp_engine, env):
        run_alembic("0005_transcription_jobs", env=env)
        with temp_engine.begin() as conn:
            # 0001 reflects current metadata; strip 0006-owned lease fields to
            # create a genuine 0005 shape before upgrading through head.
            conn.execute(text("DROP INDEX IF EXISTS ix_transcription_jobs_status_lease_expires_created"))
            for col in ["lease_owner_id", "lease_generation", "claimed_at", "lease_expires_at", "attempt_count", "cancel_requested_at"]:
                conn.execute(text(f"ALTER TABLE transcription_jobs DROP COLUMN IF EXISTS {col}"))
            conn.execute(text("UPDATE alembic_version SET version_num='0005_transcription_jobs'"))
            cols_at_0005 = {c["name"] for c in inspect(conn).get_columns("transcription_jobs")}
            assert "lease_owner_id" not in cols_at_0005
        run_alembic("head", env=env)
        with temp_engine.begin() as conn:
            inspector = inspect(conn)
            cols = {c["name"] for c in inspector.get_columns("transcription_jobs")}
            assert {"lease_owner_id", "lease_generation", "claimed_at", "lease_expires_at", "attempt_count", "cancel_requested_at"}.issubset(cols)
            indexes = [idx["name"] for idx in inspector.get_indexes("transcription_jobs")]
            assert indexes.count("ix_transcription_jobs_status_lease_expires_created") == 1
            assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "0015_user_source_retention"



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
    with isolated_migration_database("studio_migration_0007") as (temp_engine, env):
        run_alembic("0007_job_processing_lifecycle", env=env)
        with temp_engine.begin() as conn:
            # 0001 reflects current metadata; strip post-0007 dependent
            # objects in dependency order to create a genuine 0007 shape.
            conn.execute(text("DROP TABLE IF EXISTS transcription_job_source_attempts"))
            conn.execute(text("DROP TABLE IF EXISTS transcription_output_reconciliations"))
            conn.execute(text("DROP TABLE IF EXISTS transcription_job_outputs"))
            conn.execute(text("DROP TYPE IF EXISTS sourceattemptretrydisposition"))
            conn.execute(text("DROP TYPE IF EXISTS sourceattemptstage"))
            conn.execute(text("DROP TYPE IF EXISTS outputreconciliationstatus"))
            conn.execute(text("UPDATE alembic_version SET version_num='0007_job_processing_lifecycle'"))
            tables = set(inspect(conn).get_table_names())
            assert "transcription_job_outputs" not in tables
            assert "transcription_output_reconciliations" not in tables
            assert "transcription_job_source_attempts" not in tables
            assert "transcription_job_sources" in tables
        run_alembic("head", env=env)
        with temp_engine.begin() as conn:
            assert "transcription_job_outputs" in inspect(conn).get_table_names()
            assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "0015_user_source_retention"



def _assert_output_reconciliation_schema(inspector):
    assert "transcription_output_reconciliations" in inspector.get_table_names()
    cols = {c["name"]: c for c in inspector.get_columns("transcription_output_reconciliations")}
    assert {"id", "owner_user_id", "project_id", "job_id", "job_source_id", "reconciliation_token", "lease_generation", "attempt_number", "status", "uncertainty_reason", "expected_output_drive_folder_id", "expected_document_title", "expected_document_title_hash", "expected_document_character_count", "prepared_at", "creation_started_at", "returned_document_id", "returned_web_view_url", "returned_document_created_at", "last_checked_at", "resolved_output_id", "resolved_at", "created_at", "updated_at"}.issubset(cols)
    uniques = {tuple(u["column_names"]) for u in inspector.get_unique_constraints("transcription_output_reconciliations")}
    assert ("job_source_id",) in uniques
    assert ("reconciliation_token",) in uniques
    assert ("returned_document_id",) in uniques
    assert ("resolved_output_id",) in uniques
    assert ("owner_user_id", "project_id", "job_id", "job_source_id") in uniques
    checks = {c["name"] for c in inspector.get_check_constraints("transcription_output_reconciliations")}
    assert "ck_output_reconciliations_character_count_nonnegative" in checks
    indexes = {idx["name"]: tuple(idx["column_names"]) for idx in inspector.get_indexes("transcription_output_reconciliations")}
    assert indexes["ix_output_reconciliations_owner_user_id"] == ("owner_user_id",)
    assert indexes["ix_output_reconciliations_project_id"] == ("project_id",)
    assert indexes["ix_output_reconciliations_job_id"] == ("job_id",)
    assert indexes["ix_output_reconciliations_status"] == ("status",)
    assert indexes["ix_output_reconciliations_job_status"] == ("job_id", "status")
    fks = {tuple(fk["constrained_columns"]): fk["referred_table"] for fk in inspector.get_foreign_keys("transcription_output_reconciliations")}
    assert fks[("owner_user_id",)] == "users"
    assert fks[("project_id",)] == "projects"
    assert fks[("job_id",)] == "transcription_jobs"
    assert fks[("job_source_id",)] == "transcription_job_sources"
    assert fks[("resolved_output_id",)] == "transcription_job_outputs"


def test_output_reconciliation_current_schema_indexes_match_migration():
    _assert_output_reconciliation_schema(inspect(engine))


def test_output_reconciliation_0012_upgrade_downgrade_roundtrip_and_metadata_table(tmp_path):
    from studio_api.db import Base

    with isolated_migration_database("studio_migration_0012") as (temp_engine, env):
        run_alembic("0011_diagnostic_debug_sessions", env=env)
        with temp_engine.begin() as conn:
            # 0001 uses the current SQLAlchemy metadata baseline, so strip
            # 0012-owned reconciliation objects to create a genuine historical
            # revision-0011 shape before testing the 0012 migration itself.
            conn.execute(text("DROP TABLE IF EXISTS transcription_output_reconciliations"))
            conn.execute(text("DROP TYPE IF EXISTS outputreconciliationstatus"))
            assert "transcription_output_reconciliations" not in inspect(conn).get_table_names()
            assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "0011_diagnostic_debug_sessions"
        run_alembic("0012_output_reconciliation_cases", env=env)
        with temp_engine.begin() as conn:
            _assert_output_reconciliation_schema(inspect(conn))
            assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "0012_output_reconciliation_cases"
        run_alembic("0011_diagnostic_debug_sessions", env=env, command="downgrade")
        with temp_engine.begin() as conn:
            assert "transcription_output_reconciliations" not in inspect(conn).get_table_names()
            assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "0011_diagnostic_debug_sessions"
        run_alembic("0012_output_reconciliation_cases", env=env)
        with temp_engine.begin() as conn:
            _assert_output_reconciliation_schema(inspect(conn))
            assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "0012_output_reconciliation_cases"

    with isolated_migration_database("studio_migration_0012_metadata") as (temp_engine, env):
        Base.metadata.create_all(temp_engine)
        run_alembic("0012_output_reconciliation_cases", env=env, command="stamp")
        run_alembic("0011_diagnostic_debug_sessions", env=env, command="downgrade")
        with temp_engine.begin() as conn:
            assert "transcription_output_reconciliations" not in inspect(conn).get_table_names()
            assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "0011_diagnostic_debug_sessions"


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
    (lambda job, project, rel, source: setattr(job, "output_drive_folder_id", "folder-changed"), JobOutputPersistenceReason.output_folder_changed),
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
    lambda job, project, rel, source: setattr(job, "output_drive_folder_id", "folder-blocked"),
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


def test_invalidate_job_lease_preserves_claim_history_and_generation():
    _, job_id = lease_test_job()
    db = SessionLocal()
    try:
        job = db.get(TranscriptionJob, job_id)
        handle = acquire_job_lease(db, job_id=job.id, lease_owner_id="owner", now=LEASE_TEST_NOW, lease_ttl=LEASE_TEST_TTL)
        original_claimed_at = job.claimed_at
        original_generation = job.lease_generation
        assert original_claimed_at == handle.claimed_at
        assert original_generation == handle.lease_generation

        invalidate_job_lease(job)
        db.flush()

        assert job.lease_owner_id is None
        assert job.lease_expires_at is None
        assert job.claimed_at == original_claimed_at
        assert job.lease_generation == original_generation
    finally:
        db.close()


def test_active_lease_helper():
    _, job_id = lease_test_job()
    db = SessionLocal()
    try:
        job = db.get(TranscriptionJob, job_id)
        acquire_job_lease(db, job_id=job.id, lease_owner_id="owner", now=LEASE_TEST_NOW, lease_ttl=LEASE_TEST_TTL)
        assert is_lease_active(job, LEASE_TEST_NOW + timedelta(minutes=14)) is True
        assert is_lease_active(job, (LEASE_TEST_NOW + timedelta(minutes=14)).replace(tzinfo=None)) is True
        assert is_lease_active(job, (LEASE_TEST_NOW + timedelta(minutes=14)).astimezone(timezone(timedelta(hours=3)))) is True
        assert is_lease_active(job, LEASE_TEST_NOW + timedelta(minutes=15)) is False
        assert is_lease_active(job, (LEASE_TEST_NOW + timedelta(minutes=15)).astimezone(timezone(timedelta(hours=3)))) is False
        assert is_lease_active(job, LEASE_TEST_NOW + timedelta(minutes=16)) is False

        job.lease_owner_id = None
        assert is_lease_active(job, LEASE_TEST_NOW + timedelta(minutes=14)) is False
        job.lease_owner_id = "owner"
        job.lease_expires_at = None
        assert is_lease_active(job, LEASE_TEST_NOW + timedelta(minutes=14)) is False
    finally:
        db.close()


def test_reloaded_aware_lease_accepts_naive_worker_clock_for_processing():
    _, job_id = lease_test_job(status=JobStatus.queued, ready=True)
    naive_now = LEASE_TEST_NOW.replace(tzinfo=None)
    db = SessionLocal()
    try:
        handle = acquire_job_lease(db, job_id=job_id, lease_owner_id="owner", now=naive_now, lease_ttl=LEASE_TEST_TTL)
        assert handle.lease_expires_at.tzinfo is None
        db.commit()
        db.expire_all()

        reloaded_job = db.get(TranscriptionJob, job_id)
        assert reloaded_job.lease_expires_at.tzinfo is not None
        assert reloaded_job.lease_expires_at.utcoffset() == timedelta(0)
        assert is_lease_active(reloaded_job, naive_now) is True

        result = begin_job_processing(db, job_id=job_id, lease_owner_id="owner", lease_generation=handle.lease_generation, now=naive_now)
        assert result.status == JobStatus.processing
        assert reloaded_job.status == JobStatus.processing
        assert result.attempt_count == 1
        assert reloaded_job.attempt_count == 1
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


def test_expired_processing_recovery_fails_closed_without_current_attempt_evidence():
    _, recover_id = lease_test_job()
    db = SessionLocal()
    try:
        job = db.get(TranscriptionJob, recover_id)
        h = acquire_job_lease(db, job_id=job.id, lease_owner_id="owner", now=LEASE_TEST_NOW, lease_ttl=timedelta(minutes=1))
        begin_job_processing(db, job_id=job.id, lease_owner_id="owner", lease_generation=h.lease_generation, now=LEASE_TEST_NOW)
        started_at = job.started_at
        original_claimed_at = job.claimed_at
        original_generation = job.lease_generation
        with pytest.raises(JobProcessingError) as exc:
            recover_expired_processing_job(db, job_id=job.id, now=LEASE_TEST_NOW + timedelta(seconds=30))
        assert exc.value.reason == JobProcessingFailureReason.lease_active
        recover_expired_processing_job(db, job_id=job.id, now=LEASE_TEST_NOW + timedelta(minutes=2))
        assert job.status == JobStatus.failed
        assert job.error_code == "retry_recovery_state_unknown"
        assert job.error_message == "retry_recovery_state_unknown"
        assert job.lease_owner_id is None
        assert job.lease_expires_at is None
        assert job.claimed_at == original_claimed_at
        assert job.lease_generation == original_generation
        assert job.attempt_count == 1 and job.started_at == started_at
    finally:
        db.close()


def test_expired_processing_recovery_requeues_with_current_prepared_attempt_evidence():
    _, recover_id = lease_test_job()
    db = SessionLocal()
    try:
        job = db.get(TranscriptionJob, recover_id)
        h = acquire_job_lease(db, job_id=job.id, lease_owner_id="owner", now=LEASE_TEST_NOW, lease_ttl=timedelta(minutes=1))
        begin_job_processing(db, job_id=job.id, lease_owner_id="owner", lease_generation=h.lease_generation, now=LEASE_TEST_NOW)
        rel = db.query(TranscriptionJobSource).filter_by(job_id=job.id).one()
        db.add(TranscriptionJobSourceAttempt(owner_user_id=job.owner_user_id, project_id=job.project_id, job_id=job.id, job_source_id=rel.id, attempt_number=1, stage=SourceAttemptStage.prepared, retry_disposition=SourceAttemptRetryDisposition.undetermined, created_at=LEASE_TEST_NOW, updated_at=LEASE_TEST_NOW))
        db.commit()
        started_at = job.started_at
        original_claimed_at = job.claimed_at
        original_generation = job.lease_generation
        recover_expired_processing_job(db, job_id=job.id, now=LEASE_TEST_NOW + timedelta(minutes=2))
        assert job.status == JobStatus.queued
        assert job.finished_at is None and job.error_code is None and job.error_message is None
        assert job.lease_owner_id is None
        assert job.lease_expires_at is None
        assert job.claimed_at == original_claimed_at
        assert job.lease_generation == original_generation
        assert job.attempt_count == 1 and job.started_at == started_at
        next_claimed_at = LEASE_TEST_NOW + timedelta(minutes=3)
        next_handle = acquire_job_lease(db, job_id=job.id, lease_owner_id="owner-2", now=next_claimed_at, lease_ttl=LEASE_TEST_TTL)
        assert job.claimed_at == next_claimed_at
        assert job.claimed_at != original_claimed_at
        assert job.lease_owner_id == "owner-2"
        assert job.lease_expires_at == next_claimed_at + LEASE_TEST_TTL
        assert job.lease_generation == original_generation + 1
        begin_job_processing(db, job_id=job.id, lease_owner_id="owner-2", lease_generation=next_handle.lease_generation, now=LEASE_TEST_NOW + timedelta(minutes=4))
        assert job.attempt_count == 2 and job.started_at == started_at
    finally:
        db.close()

JOB_OUTPUT_TOP_KEYS = {"job_id", "job_status", "output_count", "outputs"}
JOB_OUTPUT_ENTRY_KEYS = {"source_id", "source_position", "source_name", "source_type", "output_kind", "transcript_standard", "web_view_url", "link_available", "document_character_count", "document_created_at", "persisted_at"}


def create_job_with_sources(email="job-output@example.com", names=("one.mp4",)):
    c, headers, pid = create_logged_in_project(email)
    source_ids = [create_gdrive_source(c, headers, pid, name) for name in names]
    prepare_legacy_job_authority(c, headers, pid)
    r = c.post(f"/api/projects/{pid}/jobs", json={"source_ids": source_ids}, headers=headers)
    assert r.status_code == 200
    return c, headers, pid, r.json()["id"], source_ids


JOB_PROGRESS_TOP_KEYS = {
    "job_id",
    "job_status",
    "tracking_precision",
    "completed_source_count",
    "total_source_count",
    "active_source_position",
    "current_stage",
    "sources",
}
JOB_PROGRESS_SOURCE_KEYS = {"position", "name", "status", "stages"}
JOB_PROGRESS_STAGE_KEYS = {"key", "status", "applicability"}


def test_project_job_progress_is_owner_scoped_no_store_and_browser_safe():
    c1, _h1, pid1, jid1, _source_ids1 = create_job_with_sources(
        "job-progress-owner@example.com",
        ("progress-video.mp4",),
    )
    c2, _h2, pid2, _jid2, _source_ids2 = create_job_with_sources(
        "job-progress-other@example.com",
        ("other-private.mp4",),
    )

    response = c1.get(f"/api/projects/{pid1}/jobs/progress")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["pragma"] == "no-cache"
    body = response.json()
    assert set(body) == {"jobs"}
    assert len(body["jobs"]) == 1
    progress = body["jobs"][0]
    assert set(progress) == JOB_PROGRESS_TOP_KEYS
    assert progress["job_id"] == jid1
    assert progress["job_status"] == "queued"
    assert progress["tracking_precision"] == "checkpoint"
    assert progress["active_source_position"] is None
    assert progress["current_stage"] is None
    assert set(progress["sources"][0]) == JOB_PROGRESS_SOURCE_KEYS
    assert progress["sources"][0]["name"] == "progress-video.mp4"
    assert all(
        set(stage) == JOB_PROGRESS_STAGE_KEYS
        for stage in progress["sources"][0]["stages"]
    )
    assert "other-private.mp4" not in response.text
    for marker in (
        "lease_owner_id",
        "lease_generation",
        "claimed_at",
        "provider_credential_id",
        "s3_bucket",
        "s3_object_key",
        "drive_file_id",
        "drive_file_url",
        "failure_code",
    ):
        assert marker not in response.text

    anon = TestClient(app)
    assert anon.get(f"/api/projects/{pid1}/jobs/progress").status_code == 401
    assert c1.get(f"/api/projects/{pid2}/jobs/progress").status_code == 404


def test_project_transcription_analytics_is_owner_scoped_no_store_and_aggregate_only():
    c1, _h1, pid1, _jid1, _source_ids1 = create_job_with_sources(
        "analytics-owner@example.com",
        ("analytics-private-source.mp4",),
    )
    _c2, _h2, pid2, _jid2, _source_ids2 = create_job_with_sources(
        "analytics-other@example.com",
        ("other-private-source.mp4",),
    )

    response = c1.get(f"/api/projects/{pid1}/transcription-analytics")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["pragma"] == "no-cache"
    body = response.json()
    assert set(body) == {
        "scope",
        "totals",
        "outcomes",
        "configuration",
        "durations",
    }
    assert body["scope"] == "project_all_time"
    assert body["totals"] == {"jobs": 1, "sources": 1, "outputs": 0}
    assert body["outcomes"] == {
        "queued": 1,
        "processing": 0,
        "completed": 0,
        "failed": 0,
        "cancelled": 0,
    }
    assert body["configuration"] == {
        "provider_model": {
            "elevenlabs_scribe_v2": 1,
            "unknown": 0,
        },
        "language_mode": {"ru": 0, "detect": 1, "other": 0},
        "diarization": {"enabled": 0, "disabled": 1},
    }
    assert all(
        summary == {
            "sample_count": 0,
            "average_seconds": None,
            "p50_seconds": None,
            "p95_seconds": None,
        }
        for summary in body["durations"].values()
    )
    for private_marker in (
        pid1,
        "analytics-private-source.mp4",
        "other-private-source.mp4",
        "folder-test",
        "provider_credential_id",
        "document_id",
        "web_view_url",
        "provider_request_started_at",
        "failure_code",
    ):
        assert private_marker not in response.text

    anon = TestClient(app)
    assert (
        anon.get(f"/api/projects/{pid1}/transcription-analytics").status_code
        == 401
    )
    assert (
        c1.get(f"/api/projects/{pid2}/transcription-analytics").status_code
        == 404
    )


def add_output_row(job_id, source_id, *, url="https://docs.google.com/document/d/doc/edit", doc_id=None, persisted_at=None, output_id=None, output_kind="google_doc_transcript"):
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
            output_kind=output_kind,
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


def test_transcript_catalog_query_is_owner_scoped_and_uses_accepted_output_authority():
    from studio_api.transcript_catalog import (
        ExistingResultMatchStatus,
        current_effective_settings,
        load_existing_result_matches,
    )

    _c1, _h1, _pid1, jid1, source_ids1 = create_job_with_sources(
        "catalog-query-owner@example.com",
        ("shared-drive-source.mp4",),
    )
    _c2, _h2, _pid2, jid2, source_ids2 = create_job_with_sources(
        "catalog-query-other@example.com",
        ("shared-drive-source.mp4",),
    )
    add_output_row(
        jid1,
        source_ids1[0],
        doc_id="catalog-owner-doc",
        output_kind="google_docs_transcript",
    )
    add_output_row(
        jid2,
        source_ids2[0],
        doc_id="catalog-other-doc",
        output_kind="google_docs_transcript",
    )

    db = SessionLocal()
    try:
        source_row = db.get(Source, source_ids1[0])
        match = load_existing_result_matches(
            db,
            owner_user_id=db.get(TranscriptionJob, jid1).owner_user_id,
            sources=[source_row],
            target_settings=current_effective_settings(
                language_mode="detect",
                diarization_enabled=False,
            ),
        )[source_ids1[0]]
    finally:
        db.close()

    assert match.status == ExistingResultMatchStatus.accepted_match
    assert match.accepted_output_count == 1
    assert match.matching_settings_count == 1


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
        assert "outputs" not in response.json()
        assert "doc-output-compat" not in response.text
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
    from studio_api.google_scopes import has_drive_file_scope, has_picker_browser_scope_boundary
    assert has_drive_file_scope("openid email https://www.googleapis.com/auth/drive.file")
    assert has_drive_file_scope("  https://www.googleapis.com/auth/drive.file   openid ")
    assert not has_drive_file_scope("openid email")
    assert not has_drive_file_scope("https://www.googleapis.com/auth/drive.file.extra")
    assert has_picker_browser_scope_boundary("openid email https://www.googleapis.com/auth/drive.file")
    assert has_picker_browser_scope_boundary("openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.file")
    assert not has_picker_browser_scope_boundary("openid email")
    assert not has_picker_browser_scope_boundary("openid email https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly")
    assert not has_picker_browser_scope_boundary("openid email https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.readonly")


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
    unavailable = c.post("/api/google/picker/session", headers=headers)
    assert unavailable.status_code == 503
    assert unavailable.json() == {"detail": "google_picker_not_configured"}
    monkeypatch.setattr(main.settings, "google_picker_api_key", "public-key")
    monkeypatch.setattr(main.settings, "google_picker_app_id", "123456")
    assert c.post("/api/google/picker/session", headers=headers).status_code == 404
    _connect_google_for_test(uid, "openid email")
    assert c.post("/api/google/picker/session", headers=headers).status_code == 409
    with engine.begin() as conn:
        conn.execute(text("UPDATE google_connections SET scopes='openid email https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly'"))
    assert c.post("/api/google/picker/session", headers=headers).status_code == 409
    with engine.begin() as conn:
        conn.execute(text("UPDATE google_connections SET scopes='openid email https://www.googleapis.com/auth/drive.file'"))
    from studio_api.google_connection_access import GoogleConnectionAccessError, GoogleConnectionAccessReason
    monkeypatch.setattr(
        main,
        "refresh_user_google_drive_access_token",
        lambda *a, **k: (_ for _ in ()).throw(
            GoogleConnectionAccessError(
                GoogleConnectionAccessReason.reauthorization_required
            )
        ),
    )
    reconnect = c.post("/api/google/picker/session", headers=headers)
    assert reconnect.status_code == 409
    assert reconnect.json() == {"detail": "google_reauthorization_required"}
    monkeypatch.setattr(
        main,
        "refresh_user_google_drive_access_token",
        lambda *a, **k: (_ for _ in ()).throw(
            GoogleConnectionAccessError(GoogleConnectionAccessReason.token_unavailable)
        ),
    )
    transient = c.post("/api/google/picker/session", headers=headers)
    assert transient.status_code == 502
    assert transient.json() == {"detail": "google_token_unavailable"}
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
    from studio_api.job_output_destination import DriveFolderAuthorizationMetadata
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
    folder_metas = {
        "folder": DriveFolderAuthorizationMetadata("folder", GOOGLE_FOLDER_MIME_TYPE, False, True, "Results", "https://drive.google.com/drive/folders/folder"),
        "file-a": DriveFolderAuthorizationMetadata("file-a", "audio/mpeg", False, True, "Backend A.mp3", "https://drive.google.com/file/d/file-a/view"),
        "mismatch": DriveFolderAuthorizationMetadata("other-folder", GOOGLE_FOLDER_MIME_TYPE, False, True, "Mismatch", "https://drive.google.com/drive/folders/other-folder"),
        "trashed": DriveFolderAuthorizationMetadata("trashed", GOOGLE_FOLDER_MIME_TYPE, True, True, "Trashed", "https://drive.google.com/drive/folders/trashed"),
        "readonly": DriveFolderAuthorizationMetadata("readonly", GOOGLE_FOLDER_MIME_TYPE, False, False, "Read only", "https://drive.google.com/drive/folders/readonly"),
    }
    monkeypatch.setattr("studio_api.job_output_folder_selection._fetch_drive_folder_authorization_metadata", lambda token, did: folder_metas[did])
    headers = {"origin": "https://studio.test", "x-csrf-token": csrf}
    pid = c.post("/api/projects", json={"title":"Picker"}, headers=headers).json()["id"]
    assert c.post(f"/api/projects/{pid}/sources/google-picker", json={"file_ids": []}, headers=headers).status_code == 422
    assert c.post(f"/api/projects/{pid}/sources/google-picker", json={"file_ids": ["file-a", "file-a"]}, headers=headers).status_code == 422
    assert c.post(f"/api/projects/{pid}/sources/google-picker", json={"file_ids": ["folder"]}, headers=headers).status_code == 422
    assert c.post(f"/api/projects/{pid}/sources/google-picker", json={"file_ids": ["bad"]}, headers=headers).status_code == 422
    r = c.post(f"/api/projects/{pid}/sources/google-picker", json={"file_ids": ["file-b", "file-a"]}, headers=headers)
    assert r.status_code == 200
    assert [s["original_filename"] for s in r.json()["sources"]] == ["Backend B.mp4", "Backend A.mp3"]
    metas["file-c"] = GoogleDriveMetadata("file-c", "Лекция 1. Личность как психологическое явление.flac", "audio/flac", 30, "https://drive.google.com/file/d/file-c/view", None, None, False)
    r = c.post(f"/api/projects/{pid}/sources/google-picker", json={"file_ids": ["file-c"]}, headers=headers)
    assert r.status_code == 200
    body = r.json()["sources"][0]
    assert body["original_filename"] == "Лекция 1. Личность как психологическое явление.flac"
    assert "drive_file_id" not in body
    assert "s3_bucket" not in body
    assert "s3_object_key" not in body
    for private_key in ["storage_cleanup_owner_id", "storage_cleanup_generation", "storage_cleanup_claimed_at", "storage_cleanup_lease_expires_at", "storage_cleanup_attempt_count", "storage_cleanup_error_code"]:
        assert private_key not in body
    assert body["drive_file_url"] == "https://drive.google.com/file/d/file-c/view"
    assert body["mime_type"] == "audio/flac"
    assert body["size_bytes"] == 30
    assert "client" not in r.text.lower()
    assert c.post(f"/api/projects/{pid}/output-folder/google-picker", json={"folder_id":"file-a"}, headers=headers).status_code == 422
    assert c.post(f"/api/projects/{pid}/output-folder/google-picker", json={"folder_id":"mismatch"}, headers=headers).status_code == 422
    assert c.post(f"/api/projects/{pid}/output-folder/google-picker", json={"folder_id":"trashed"}, headers=headers).status_code == 422
    assert c.post(f"/api/projects/{pid}/output-folder/google-picker", json={"folder_id":"readonly"}, headers=headers).status_code == 422
    r = c.post(f"/api/projects/{pid}/output-folder/google-picker", json={"folder_id":"folder"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["output_drive_folder_id"] == "folder"
    assert r.json()["output_drive_folder_name"] == "Results"
    assert r.json()["output_drive_folder_url"] == "https://drive.google.com/drive/folders/folder"
    assert "access" not in r.text and "canAddChildren" not in r.text and "capabilities" not in r.text


def test_legacy_google_drive_source_ignores_browser_metadata_and_uses_verified_metadata(monkeypatch):
    import studio_api.main as main
    from studio_api.google_drive import GoogleDriveMetadata

    pw = admin("drive-source-compat@example.com")
    c = TestClient(app)
    csrf = login(c, pw, "drive-source-compat@example.com")
    db = SessionLocal()
    uid = db.query(User).first().id
    db.close()
    _connect_google_for_test(uid)
    monkeypatch.setattr(main, "refresh_user_google_drive_access_token", lambda *a, **k: "access")
    verified = GoogleDriveMetadata(
        "verified-file",
        "Verified meeting.mp4",
        "video/mp4",
        42,
        "https://drive.google.com/file/d/verified-file/view",
        None,
        None,
        False,
    )
    calls = []

    def fake_fetch(token, drive_file_id):
        calls.append((token, drive_file_id))
        return verified

    monkeypatch.setattr("studio_api.google_drive.fetch_drive_file_metadata", fake_fetch)
    headers = {"origin": "https://studio.test", "x-csrf-token": csrf}
    pid = c.post("/api/projects", json={"title": "Compatibility"}, headers=headers).json()["id"]
    payload = {
        "drive_file_id": "verified-file",
        "drive_file_url": "https://evil.example/spoofed",
        "original_filename": "Spoofed.pdf",
        "mime_type": "application/pdf",
        "size_bytes": main.settings.source_max_upload_bytes + 1,
    }
    r = c.post(f"/api/projects/{pid}/sources/google-drive", json=payload, headers=headers)
    assert r.status_code == 200
    assert app.openapi()["paths"][f"/api/projects/{{project_id}}/sources/google-drive"]["post"]["deprecated"] is True
    assert r.headers["deprecation"] == "true"
    assert r.headers["link"] == f'</api/projects/{pid}/sources/google-picker>; rel="successor-version"'
    assert calls == [("access", "verified-file")]
    body = r.json()
    assert body["original_filename"] == "Verified meeting.mp4"
    assert body["mime_type"] == "video/mp4"
    assert body["size_bytes"] == 42
    assert body["drive_file_url"] == "https://drive.google.com/file/d/verified-file/view"
    assert "Spoofed.pdf" not in r.text and "evil.example" not in r.text
    db = SessionLocal()
    try:
        src = db.get(Source, body["id"])
        assert src.drive_file_id == "verified-file"
    finally:
        db.close()

    mismatched = GoogleDriveMetadata("other-file", "Other.mp4", "video/mp4", 1, None, None, None, False)
    monkeypatch.setattr("studio_api.google_drive.fetch_drive_file_metadata", lambda *_: mismatched)
    mismatch = c.post(f"/api/projects/{pid}/sources/google-drive", json=payload, headers=headers)
    assert mismatch.status_code == 502
    db = SessionLocal()
    try:
        assert db.query(Source).filter_by(project_id=pid).count() == 1
    finally:
        db.close()


def _batch_headers(csrf):
    return {"origin": "https://studio.test", "x-csrf-token": csrf, "Idempotency-Key": "batch-key-1"}


def _create_uploaded_source(db, project_id, name="source.mp3"):
    src = Source(project_id=project_id, source_type=SourceType.local_upload, original_filename=name, mime_type="audio/mpeg", size_bytes=12, s3_bucket="bucket", s3_object_key=f"objects/{name}", upload_status=SourceUploadStatus.uploaded, uploaded_at=utcnow())
    db.add(src); db.flush(); return src


def _create_active_credential(db, user_id, label="main"):
    cred = ProviderCredential(user_id=user_id, provider=CredentialProvider.elevenlabs, label=label, status=CredentialStatus.active)
    db.add(cred); db.flush(); return cred


def _batch_setup(email="batch@example.com"):
    pw = admin(email); c = TestClient(app); csrf = login(c, pw, email)
    db = SessionLocal()
    try:
        user = db.query(User).filter_by(email=email).one()
        project = Project(owner_user_id=user.id, title="Batch project")
        db.add(project); db.flush()
        source_a = _create_uploaded_source(db, project.id, "a.mp3")
        source_b = _create_uploaded_source(db, project.id, "b.mp3")
        cred = _create_active_credential(db, user.id)
        db.commit()
        return c, csrf, user.id, project.id, source_a.id, source_b.id, cred.id
    finally:
        db.close()


def _install_batch_folder_mocks(monkeypatch, calls=None, invalid=None):
    import studio_api.main as main
    from studio_api.google_drive import GOOGLE_FOLDER_MIME_TYPE
    from studio_api.job_output_destination import DriveFolderAuthorizationMetadata
    calls = calls if calls is not None else []
    invalid = invalid or {}
    monkeypatch.setattr(main, "refreshed_google_drive_access_token", lambda db, user: calls.append(("token", user.id)) or "access")
    def fetch(token, folder_id):
        calls.append(("folder", folder_id))
        if folder_id in invalid:
            kind = invalid[folder_id]
            if kind == "missing":
                raise RuntimeError("missing")
            if kind == "file":
                return DriveFolderAuthorizationMetadata(folder_id, "audio/mpeg", False, True, "Not folder", "https://drive.google.com/file/d/x/view")
            if kind == "trashed":
                return DriveFolderAuthorizationMetadata(folder_id, GOOGLE_FOLDER_MIME_TYPE, True, True, "Trashed", "https://drive.google.com/drive/folders/trashed")
            if kind == "readonly":
                return DriveFolderAuthorizationMetadata(folder_id, GOOGLE_FOLDER_MIME_TYPE, False, False, "Read only", "https://drive.google.com/drive/folders/readonly")
        return DriveFolderAuthorizationMetadata(folder_id, GOOGLE_FOLDER_MIME_TYPE, False, True, f"Folder {folder_id}", f"https://drive.google.com/drive/folders/{folder_id}")
    monkeypatch.setattr("studio_api.job_output_folder_selection._fetch_drive_folder_authorization_metadata", fetch)
    return calls


def _batch_body(source_a, source_b=None, folder_a="folder-a", folder_b="folder-b", credential_id=None):
    items = [{"source_id": source_a, "output_folder_id": folder_a, "title": "First"}]
    if source_b is not None:
        items.append({"source_id": source_b, "output_folder_id": folder_b, "title": "Second"})
    body = {"language": "ru", "options": {"diarize": True}, "items": items}
    if credential_id:
        body["provider_credential_id"] = credential_id
    return body



def _count_batch_rows():
    db = SessionLocal()
    try:
        return db.query(TranscriptionJob).count(), db.query(TranscriptionJobSource).count()
    finally:
        db.close()


def _add_accepted_batch_output(user_id, project_id, source_id, credential_id):
    db = SessionLocal()
    try:
        now = utcnow()
        job = TranscriptionJob(
            project_id=project_id,
            owner_user_id=user_id,
            status=JobStatus.completed,
            provider_credential_id=credential_id,
            language="ru",
            options_json='{"diarize":true}',
            finished_at=now,
        )
        db.add(job); db.flush()
        rel = TranscriptionJobSource(
            job_id=job.id,
            source_id=source_id,
            position=0,
            status=JobSourceStatus.queued,
        )
        db.add(rel); db.flush()
        db.add(
            TranscriptionJobOutput(
                job_id=job.id,
                job_source_id=rel.id,
                document_id=f"accepted-{job.id}",
                web_view_url=f"https://docs.google.com/document/d/accepted-{job.id}/edit",
                output_drive_folder_id="accepted-folder",
                output_kind="google_docs_transcript",
                transcript_standard="transcript_doc_v1.2",
                document_character_count=42,
                document_created_at=now,
                persisted_at=now,
                lease_generation=1,
            )
        )
        db.commit()
        return job.id
    finally:
        db.close()


def test_legacy_create_cannot_bypass_existing_result_decision_or_set_authority():
    c, headers, pid = create_logged_in_project("legacy-existing-result@example.com")
    sid = create_gdrive_source(c, headers, pid)
    credential_id = prepare_legacy_job_authority(c, headers, pid)
    db = SessionLocal()
    try:
        user_id = db.get(Project, pid).owner_user_id
    finally:
        db.close()
    accepted_job_id = _add_accepted_batch_output(
        user_id,
        pid,
        sid,
        credential_id,
    )
    before = _count_batch_rows()

    blocked = c.post(
        f"/api/projects/{pid}/jobs",
        json={
            "source_ids": [sid],
            "language": "ru",
            "options": {"diarize": True},
        },
        headers=headers,
    )
    assert blocked.status_code == 409
    assert blocked.json()["detail"] == (
        "Используйте пакетную проверку для явного решения"
    )
    assert accepted_job_id not in blocked.text
    assert _count_batch_rows() == before

    reserved = c.post(
        f"/api/projects/{pid}/jobs",
        json={
            "source_ids": [sid],
            "options": {"_existing_result_reprocess_authorized": True},
        },
        headers=headers,
    )
    assert reserved.status_code == 422
    assert reserved.json()["detail"] == (
        "Параметры задания содержат служебное поле"
    )
    assert _count_batch_rows() == before


def test_batch_preflight_is_safe_ordered_and_does_not_create_rows(monkeypatch):
    calls = _install_batch_folder_mocks(monkeypatch)
    c, csrf, _user_id, pid, source_a, source_b, cred_id = _batch_setup(
        "batch-preflight@example.com"
    )
    body = _batch_body(
        source_a,
        source_b,
        folder_a="shared",
        folder_b="shared",
        credential_id=cred_id,
    )
    before = _count_batch_rows()

    r = c.post(
        f"/api/projects/{pid}/jobs/batch/preflight",
        json=body,
        headers={"origin": "https://studio.test", "x-csrf-token": csrf},
    )

    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-store"
    data = r.json()
    assert data["language_mode"] == "ru"
    assert data["diarization_enabled"] is True
    assert data["summary"] == {
        "process_count": 2,
        "skip_count": 0,
        "blocked_count": 0,
    }
    assert data["existing_result_authority"] == {
        "status": "partial",
        "reason_code": "studio_outputs_only",
    }
    assert [item["source"]["name"] for item in data["items"]] == [
        "a.mp3",
        "b.mp3",
    ]
    assert [item["output_destination"]["name"] for item in data["items"]] == [
        "Folder shared",
        "Folder shared",
    ]
    assert all(
        item["existing_result_match"] == {
            "status": "no_match",
            "accepted_output_count": 0,
            "resolution": "not_required",
        }
        and item["planned_outcome"] == "process"
        and item["source"]["duration_seconds"] is None
        for item in data["items"]
    )
    assert calls.count(("folder", "shared")) == 1
    assert _count_batch_rows() == before
    for private_value in (
        source_a,
        source_b,
        cred_id,
        "objects/a.mp3",
        "objects/b.mp3",
        "https://drive.google.com/drive/folders/shared",
    ):
        assert private_value not in r.text


def test_batch_create_rechecks_existing_result_and_requires_explicit_reprocessing(monkeypatch):
    _install_batch_folder_mocks(monkeypatch)
    c, csrf, user_id, pid, source_a, _source_b, cred_id = _batch_setup(
        "batch-existing-result@example.com"
    )
    body = _batch_body(source_a, credential_id=cred_id)
    preflight_headers = {
        "origin": "https://studio.test",
        "x-csrf-token": csrf,
    }

    initial = c.post(
        f"/api/projects/{pid}/jobs/batch/preflight",
        json=body,
        headers=preflight_headers,
    )
    assert initial.status_code == 200
    assert initial.json()["items"][0]["existing_result_match"]["status"] == "no_match"

    accepted_job_id = _add_accepted_batch_output(
        user_id,
        pid,
        source_a,
        cred_id,
    )
    before_blocked_create = _count_batch_rows()
    blocked_create = c.post(
        f"/api/projects/{pid}/jobs/batch",
        json=body,
        headers=_batch_headers(csrf),
    )
    assert blocked_create.status_code == 409
    assert _count_batch_rows() == before_blocked_create
    assert accepted_job_id not in blocked_create.text

    blocked_preview = c.post(
        f"/api/projects/{pid}/jobs/batch/preflight",
        json=body,
        headers=preflight_headers,
    )
    assert blocked_preview.status_code == 200
    assert blocked_preview.json()["summary"] == {
        "process_count": 0,
        "skip_count": 0,
        "blocked_count": 1,
    }
    assert blocked_preview.json()["items"][0]["existing_result_match"] == {
        "status": "accepted_match",
        "accepted_output_count": 1,
        "resolution": "required",
    }
    assert blocked_preview.json()["items"][0]["planned_outcome"] == "blocked"
    assert accepted_job_id not in blocked_preview.text

    body["items"][0]["reprocess_existing"] = True
    approved_preview = c.post(
        f"/api/projects/{pid}/jobs/batch/preflight",
        json=body,
        headers=preflight_headers,
    )
    assert approved_preview.status_code == 200
    assert approved_preview.json()["summary"] == {
        "process_count": 1,
        "skip_count": 0,
        "blocked_count": 0,
    }
    assert approved_preview.json()["items"][0]["existing_result_match"]["resolution"] == "reprocess"
    assert approved_preview.json()["items"][0]["planned_outcome"] == "process"

    created = c.post(
        f"/api/projects/{pid}/jobs/batch",
        json=body,
        headers=_batch_headers(csrf),
    )
    assert created.status_code == 200
    assert created.json()["created_count"] == 1
    assert _count_batch_rows() == (
        before_blocked_create[0] + 1,
        before_blocked_create[1] + 1,
    )
    assert "_existing_result_reprocess_authorized" not in created.text
    db = SessionLocal()
    try:
        created_job = (
            db.query(TranscriptionJob)
            .filter(
                TranscriptionJob.project_id == pid,
                TranscriptionJob.id != accepted_job_id,
            )
            .one()
        )
        assert created_job.options_json == (
            '{"_existing_result_reprocess_authorized":true,"diarize":true}'
        )
    finally:
        db.close()


def test_batch_preflight_requires_csrf_and_rejects_invalid_targets_without_rows(monkeypatch):
    _install_batch_folder_mocks(monkeypatch)
    c, csrf, _user_id, pid, source_a, _source_b, _cred_id = _batch_setup(
        "batch-preflight-reject@example.com"
    )
    body = _batch_body(source_a)
    before = _count_batch_rows()

    assert c.post(f"/api/projects/{pid}/jobs/batch/preflight", json=body).status_code == 403
    assert c.post(
        f"/api/projects/{pid}/jobs/batch/preflight",
        json={"items": [body["items"][0], body["items"][0]]},
        headers={"origin": "https://studio.test", "x-csrf-token": csrf},
    ).status_code == 422
    assert c.post(
        f"/api/projects/{pid}/jobs/batch/preflight",
        json={"items": [{"source_id": "missing-source", "output_folder_id": "folder-a"}]},
        headers={"origin": "https://studio.test", "x-csrf-token": csrf},
    ).status_code == 422
    assert _count_batch_rows() == before


def test_batch_explicit_active_owner_elevenlabs_credential_saved(monkeypatch):
    _install_batch_folder_mocks(monkeypatch)
    c, csrf, user_id, pid, source_a, source_b, cred_id = _batch_setup("batch-explicit-eleven@example.com")
    body = _batch_body(source_a, credential_id=cred_id)
    body["language"] = "detect"
    r = c.post(f"/api/projects/{pid}/jobs/batch", json=body, headers=_batch_headers(csrf))
    assert r.status_code == 200
    assert all("provider_credential_id" not in job for job in r.json()["jobs"])
    assert r.json()["jobs"][0]["language_mode"] == "detect"
    db = SessionLocal()
    try:
        job = db.query(TranscriptionJob).filter_by(project_id=pid).one()
        assert job.provider_credential_id == cred_id
        assert job.language == "detect"
    finally:
        db.close()


def test_batch_null_credential_auto_resolves_single_active_elevenlabs(monkeypatch):
    _install_batch_folder_mocks(monkeypatch)
    c, csrf, user_id, pid, source_a, source_b, cred_id = _batch_setup("batch-auto-eleven@example.com")
    r = c.post(f"/api/projects/{pid}/jobs/batch", json=_batch_body(source_a), headers=_batch_headers(csrf))
    assert r.status_code == 200
    db = SessionLocal()
    try:
        job = db.query(TranscriptionJob).filter_by(project_id=pid).one()
        assert job.provider_credential_id == cred_id
    finally:
        db.close()


def test_batch_null_credential_rejects_zero_active_elevenlabs_without_partial_rows(monkeypatch):
    _install_batch_folder_mocks(monkeypatch)
    c, csrf, user_id, pid, source_a, source_b, cred_id = _batch_setup("batch-zero-eleven@example.com")
    db = SessionLocal()
    try:
        db.get(ProviderCredential, cred_id).status = CredentialStatus.revoked
        db.commit()
    finally:
        db.close()
    before = _count_batch_rows()
    r = c.post(f"/api/projects/{pid}/jobs/batch", json=_batch_body(source_a), headers=_batch_headers(csrf))
    assert r.status_code == 422
    assert _count_batch_rows() == before


def test_batch_null_credential_rejects_multiple_active_elevenlabs_without_partial_rows(monkeypatch):
    _install_batch_folder_mocks(monkeypatch)
    c, csrf, user_id, pid, source_a, source_b, cred_id = _batch_setup("batch-multi-eleven@example.com")
    db = SessionLocal()
    try:
        _create_active_credential(db, user_id, "second")
        db.commit()
    finally:
        db.close()
    before = _count_batch_rows()
    r = c.post(f"/api/projects/{pid}/jobs/batch", json=_batch_body(source_a), headers=_batch_headers(csrf))
    assert r.status_code == 422
    assert _count_batch_rows() == before


@pytest.mark.parametrize("case", ["inactive", "deleted", "foreign", "openai", "missing"])
def test_batch_explicit_credential_rejections_without_partial_rows(monkeypatch, case):
    _install_batch_folder_mocks(monkeypatch)
    c, csrf, user_id, pid, source_a, source_b, cred_id = _batch_setup(f"batch-reject-{case}@example.com")
    requested = cred_id
    db = SessionLocal()
    try:
        if case == "inactive":
            db.get(ProviderCredential, cred_id).status = CredentialStatus.revoked
        elif case == "deleted":
            cred = db.get(ProviderCredential, cred_id)
            cred.status = CredentialStatus.active
            cred.deleted_at = utcnow()
        elif case == "foreign":
            other = User(email=f"foreign-{case}@example.com", role=UserRole.admin, status=UserStatus.active)
            db.add(other); db.flush()
            requested = _create_active_credential(db, other.id, "foreign").id
        elif case == "openai":
            cred = db.get(ProviderCredential, cred_id)
            cred.provider = CredentialProvider.openai
        elif case == "missing":
            requested = "00000000-0000-0000-0000-000000000000"
        db.commit()
    finally:
        db.close()
    before = _count_batch_rows()
    r = c.post(f"/api/projects/{pid}/jobs/batch", json=_batch_body(source_a, credential_id=requested), headers=_batch_headers(csrf))
    assert r.status_code == 422
    assert _count_batch_rows() == before


def test_batch_exact_replay_with_missing_request_credential_uses_existing_id_and_skips_validation(monkeypatch):
    calls = _install_batch_folder_mocks(monkeypatch)
    c, csrf, user_id, pid, source_a, source_b, cred_id = _batch_setup("batch-replay-auto-existing@example.com")
    body = _batch_body(source_a)
    r1 = c.post(f"/api/projects/{pid}/jobs/batch", json=body, headers=_batch_headers(csrf))
    assert r1.status_code == 200 and r1.json()["replayed"] is False
    first_ids = [job["id"] for job in r1.json()["jobs"]]
    db = SessionLocal()
    try:
        db.get(ProviderCredential, cred_id).status = CredentialStatus.revoked
        db.commit()
    finally:
        db.close()
    calls.clear()
    r2 = c.post(f"/api/projects/{pid}/jobs/batch", json=body, headers=_batch_headers(csrf))
    assert r2.status_code == 200 and r2.json()["replayed"] is True
    assert [job["id"] for job in r2.json()["jobs"]] == first_ids
    assert calls == []


def test_batch_jobs_create_two_one_source_jobs_safe_payload_and_same_source_different_folders(monkeypatch):
    calls = _install_batch_folder_mocks(monkeypatch)
    c, csrf, user_id, pid, source_a, source_b, cred_id = _batch_setup("batch-happy@example.com")
    body = _batch_body(source_a, source_b, credential_id=cred_id)
    r = c.post(f"/api/projects/{pid}/jobs/batch", json=body, headers=_batch_headers(csrf))
    assert r.status_code == 200
    data = r.json(); assert data["created_count"] == 2 and data["replayed"] is False
    assert [job["title"] for job in data["jobs"]] == ["First", "Second"]
    assert [job["language_mode"] for job in data["jobs"]] == ["ru", "ru"]
    assert [job["diarization_enabled"] for job in data["jobs"]] == [True, True]
    assert "output_drive_folder_id" not in r.text and "batch-key-1" not in r.text and "batch_request_hash" not in r.text and "batch_position" not in r.text
    assert data["jobs"][0]["output_folder"] == {"name": "Folder folder-a", "web_view_url": "https://drive.google.com/drive/folders/folder-a"}
    db = SessionLocal()
    try:
        jobs = db.query(TranscriptionJob).filter_by(project_id=pid).order_by(TranscriptionJob.batch_position).all()
        assert len(jobs) == 2
        assert [j.output_drive_folder_id for j in jobs] == ["folder-a", "folder-b"]
        assert [j.options_json for j in jobs] == ['{"diarize":true}', '{"diarize":true}']
        assert all(len(j.sources) == 1 and j.sources[0].position == 0 for j in jobs)
    finally:
        db.close()
    same_source_body = _batch_body(source_a, source_a, folder_a="folder-c", folder_b="folder-d")
    headers = _batch_headers(csrf) | {"Idempotency-Key": "batch-key-2"}
    r = c.post(f"/api/projects/{pid}/jobs/batch", json=same_source_body, headers=headers)
    assert r.status_code == 200 and r.json()["created_count"] == 2
    assert calls.count(("folder", "folder-c")) == 1 and calls.count(("folder", "folder-d")) == 1


def test_batch_jobs_duplicate_pair_and_atomic_validation_failures(monkeypatch):
    _install_batch_folder_mocks(monkeypatch, invalid={"bad-folder": "file", "trashed": "trashed", "readonly": "readonly", "missing": "missing"})
    c, csrf, user_id, pid, source_a, source_b, cred_id = _batch_setup("batch-fail@example.com")
    headers = _batch_headers(csrf)
    dup = {"items": [{"source_id": source_a, "output_folder_id": "folder-a"}, {"source_id": source_a, "output_folder_id": "folder-a"}]}
    before = SessionLocal(); job_count = before.query(TranscriptionJob).count(); rel_count = before.query(TranscriptionJobSource).count(); audit_count = before.query(AuditEvent).filter_by(event_type="job.batch_created").count(); before.close()
    assert c.post(f"/api/projects/{pid}/jobs/batch", json=dup, headers=headers).status_code == 422
    after = SessionLocal()
    try:
        assert after.query(TranscriptionJob).count() == job_count
        assert after.query(TranscriptionJobSource).count() == rel_count
        assert after.query(AuditEvent).filter_by(event_type="job.batch_created").count() == audit_count
    finally:
        after.close()
    cases = [
        ({"language": "fr", "items": [{"source_id": source_a, "output_folder_id": "folder-a"}]}, "bad-key-language"),
        ({"options": {"diarize": "yes"}, "items": [{"source_id": source_a, "output_folder_id": "folder-a"}]}, "bad-key-diarize-type"),
        ({"options": {"diarize": True, "keyterms": ["deferred"]}, "items": [{"source_id": source_a, "output_folder_id": "folder-a"}]}, "bad-key-options-extra"),
        ({"items": [{"source_id": source_a, "output_folder_id": "folder-a", "reprocess_existing": "yes"}]}, "bad-key-reprocess-type"),
        ({"items": [{"source_id": source_a, "output_folder_id": "folder-a", "unexpected": True}]}, "bad-key-item-extra"),
        ({"items": [{"source_id": "missing-source", "output_folder_id": "folder-a"}]}, "bad-key-1"),
        ({"provider_credential_id": "missing-cred", "items": [{"source_id": source_a, "output_folder_id": "folder-a"}]}, "bad-key-2"),
        ({"items": [{"source_id": source_a, "output_folder_id": "bad-folder"}]}, "bad-key-3"),
        ({"items": [{"source_id": source_a, "output_folder_id": "trashed"}]}, "bad-key-4"),
        ({"items": [{"source_id": source_a, "output_folder_id": "readonly"}]}, "bad-key-5"),
        ({"items": [{"source_id": source_a, "output_folder_id": "folder-a"}, {"source_id": source_b, "output_folder_id": "missing"}]}, "bad-key-6"),
    ]
    db = SessionLocal();
    try:
        db.get(Source, source_b).deleted_at = utcnow(); db.commit()
    finally:
        db.close()
    cases.append(({"items": [{"source_id": source_b, "output_folder_id": "folder-a"}]}, "bad-key-7"))
    for payload, key in cases:
        before = SessionLocal(); job_count = before.query(TranscriptionJob).count(); rel_count = before.query(TranscriptionJobSource).count(); before.close()
        r = c.post(f"/api/projects/{pid}/jobs/batch", json=payload, headers=headers | {"Idempotency-Key": key})
        assert r.status_code in {422, 502}
        after = SessionLocal();
        try:
            assert after.query(TranscriptionJob).count() == job_count
            assert after.query(TranscriptionJobSource).count() == rel_count
        finally:
            after.close()


def test_batch_jobs_exact_replay_skips_current_validation_and_conflicts_skip_google(monkeypatch):
    calls = _install_batch_folder_mocks(monkeypatch)
    c, csrf, user_id, pid, source_a, source_b, cred_id = _batch_setup("batch-replay@example.com")
    body = _batch_body(source_a, source_b, folder_a="shared", folder_b="shared", credential_id=cred_id)
    r1 = c.post(f"/api/projects/{pid}/jobs/batch", json=body, headers=_batch_headers(csrf))
    assert r1.status_code == 200 and r1.json()["replayed"] is False
    assert [call for call in calls if call == ("folder", "shared")] == [("folder", "shared")]
    first_ids = [j["id"] for j in r1.json()["jobs"]]
    db = SessionLocal()
    try:
        db.get(ProviderCredential, cred_id).status = CredentialStatus.revoked
        db.get(Source, source_a).deleted_at = utcnow()
        db.commit()
    finally:
        db.close()
    calls.clear()
    r2 = c.post(f"/api/projects/{pid}/jobs/batch", json=body, headers=_batch_headers(csrf))
    assert r2.status_code == 200 and r2.json()["replayed"] is True
    assert [j["id"] for j in r2.json()["jobs"]] == first_ids
    assert calls == []
    db = SessionLocal()
    try:
        assert db.query(TranscriptionJob).filter_by(project_id=pid).count() == 2
        assert db.query(TranscriptionJobSource).join(TranscriptionJob).filter(TranscriptionJob.project_id == pid).count() == 2
        assert db.query(AuditEvent).filter_by(event_type="job.batch_created").count() == 1
    finally:
        db.close()
    conflict_bodies = [
        {**body, "items": [{"source_id": source_b, "output_folder_id": "shared", "title": "Dup"}, {"source_id": source_b, "output_folder_id": "shared", "title": "Dup"}]},
        _batch_body(source_b, source_b, folder_a="shared", folder_b="shared", credential_id=cred_id),
        _batch_body(source_a, source_b, folder_a="changed", folder_b="shared", credential_id=cred_id),
        {**body, "language": "detect"},
        {**body, "options": {"diarize": False}},
        {**body, "items": list(reversed(body["items"]))},
        {**body, "items": [{**body["items"][0], "title": "Changed"}, body["items"][1]]},
        {**body, "items": [{**body["items"][0], "reprocess_existing": True}, body["items"][1]]},
    ]
    for idx, conflict in enumerate(conflict_bodies):
        calls.clear()
        r = c.post(f"/api/projects/{pid}/jobs/batch", json=conflict, headers=_batch_headers(csrf))
        assert r.status_code == 409, idx
        assert calls == []


def test_batch_jobs_key_scoped_by_project_and_integrity_replay_guards(monkeypatch):
    _install_batch_folder_mocks(monkeypatch)
    c, csrf, user_id, pid, source_a, source_b, cred_id = _batch_setup("batch-scope@example.com")
    body = _batch_body(source_a, None, folder_a="folder-a")
    assert c.post(f"/api/projects/{pid}/jobs/batch", json=body, headers=_batch_headers(csrf)).status_code == 200
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        p2 = Project(owner_user_id=user.id, title="Second")
        db.add(p2); db.flush(); s2 = _create_uploaded_source(db, p2.id, "second.mp3"); db.commit(); p2_id = p2.id; s2_id = s2.id
    finally:
        db.close()
    assert c.post(f"/api/projects/{p2_id}/jobs/batch", json=_batch_body(s2_id, None, folder_a="folder-a"), headers=_batch_headers(csrf)).status_code == 200
    from studio_api.main import _existing_batch_is_complete, _batch_hash
    db = SessionLocal()
    try:
        existing = db.query(TranscriptionJob).filter_by(project_id=pid, batch_idempotency_key="batch-key-1").order_by(TranscriptionJob.batch_position).all()
        request_hash = existing[0].batch_request_hash
        assert _existing_batch_is_complete(existing, request_hash, 1) is True
        assert _existing_batch_is_complete(existing, "bad", 1) is False
        existing[0].batch_position = 2
        assert _existing_batch_is_complete(existing, request_hash, 1) is False
    finally:
        db.rollback(); db.close()



def test_batch_jobs_integrity_error_replays_concurrent_winner(monkeypatch):
    calls = _install_batch_folder_mocks(monkeypatch)
    c, csrf, user_id, pid, source_a, source_b, cred_id = _batch_setup("batch-race@example.com")
    body = _batch_body(source_a, source_b, credential_id=cred_id)
    import studio_api.main as main
    from sqlalchemy.exc import IntegrityError
    from sqlalchemy.orm import Session as OrmSession
    original_flush = OrmSession.flush
    injected = {"done": False}

    def fake_flush(self, *args, **kwargs):
        if not injected["done"] and any(isinstance(obj, TranscriptionJob) and obj.batch_idempotency_key == "batch-key-1" for obj in self.new):
            injected["done"] = True
            options_json = main.safe_job_options(body["options"])
            language = main.clean_job_language(body["language"])
            hash_items = [{"source_id": item["source_id"], "output_folder_id": item["output_folder_id"], "title": main.clean_job_title(item.get("title"))} for item in body["items"]]
            request_hash = main._batch_hash(pid, cred_id, language, options_json, hash_items)
            winner = SessionLocal()
            try:
                winner.execute(text("SET LOCAL lock_timeout = '3s'"))
                for idx, item in enumerate(body["items"]):
                    job = TranscriptionJob(project_id=pid, owner_user_id=user_id, status=JobStatus.queued, provider_credential_id=cred_id, language=language, options_json=options_json, batch_idempotency_key="batch-key-1", batch_request_hash=request_hash, batch_position=idx)
                    job.apply_output_folder_snapshot(folder_id=item["output_folder_id"], folder_url=f"https://drive.google.com/drive/folders/{item['output_folder_id']}", folder_name=f"Folder {item['output_folder_id']}")
                    winner.add(job); original_flush(winner)
                    winner.add(TranscriptionJobSource(job_id=job.id, source_id=item["source_id"], position=0, status=JobSourceStatus.queued)); original_flush(winner)
                winner.add(AuditEvent(actor_user_id=user_id, subject_user_id=user_id, event_type="job.batch_created", metadata_json='{"count":2}'))
                winner.commit()
            finally:
                winner.close()
            raise IntegrityError("insert", {}, Exception("duplicate"))
        return original_flush(self, *args, **kwargs)

    monkeypatch.setattr(OrmSession, "flush", fake_flush)
    r = c.post(f"/api/projects/{pid}/jobs/batch", json=body, headers=_batch_headers(csrf))
    assert r.status_code == 200
    assert r.json()["replayed"] is True
    assert r.json()["created_count"] == 2
    assert calls.count(("folder", "folder-a")) == 1 and calls.count(("folder", "folder-b")) == 1
    db = SessionLocal()
    try:
        assert db.query(TranscriptionJob).filter_by(project_id=pid).count() == 2
        assert db.query(TranscriptionJobSource).join(TranscriptionJob).filter(TranscriptionJob.project_id == pid).count() == 2
        assert db.query(AuditEvent).filter_by(event_type="job.batch_created").count() == 1
    finally:
        db.close()


def _attempt_enum_values(conn, enum_name: str) -> list[str]:
    return conn.execute(text(
        "SELECT e.enumlabel FROM pg_enum e "
        "JOIN pg_type t ON t.oid = e.enumtypid "
        "WHERE t.typname = :enum_name "
        "ORDER BY e.enumsortorder"
    ), {"enum_name": enum_name}).scalars().all()


def _assert_attempt_enums_absent(conn):
    assert conn.execute(text("SELECT count(*) FROM pg_type WHERE typname IN ('sourceattemptretrydisposition', 'sourceattemptstage')")).scalar_one() == 0


def _assert_job_retry_recovery_schema(inspector, conn):
    assert "transcription_job_source_attempts" in inspector.get_table_names()
    assert "transcription_output_reconciliations" in inspector.get_table_names()
    cols = {c["name"]: c for c in inspector.get_columns("transcription_job_source_attempts")}
    assert set(TranscriptionJobSourceAttempt.__table__.c.keys()).issubset(cols)
    assert {"id", "owner_user_id", "project_id", "job_id", "job_source_id", "attempt_number", "stage", "retry_disposition", "failure_code", "provider_request_started_at", "provider_response_returned_at", "failed_at", "completed_at", "created_at", "updated_at"}.issubset(cols)
    uniques = {tuple(u["column_names"]) for u in inspector.get_unique_constraints("transcription_job_source_attempts")}
    assert ("job_source_id", "attempt_number") in uniques
    checks = {c["name"] for c in inspector.get_check_constraints("transcription_job_source_attempts")}
    assert "ck_source_attempt_attempt_number_positive" in checks
    indexes = {idx["name"]: tuple(idx["column_names"]) for idx in inspector.get_indexes("transcription_job_source_attempts")}
    assert indexes["ix_source_attempts_job_id"] == ("job_id",)
    assert indexes["ix_source_attempts_job_source_id"] == ("job_source_id",)
    assert indexes["ix_source_attempts_retry_disposition"] == ("retry_disposition",)
    assert indexes["ix_source_attempts_job_retry_disposition"] == ("job_id", "retry_disposition")
    fks = {tuple(fk["constrained_columns"]): fk["referred_table"] for fk in inspector.get_foreign_keys("transcription_job_source_attempts")}
    assert fks[("owner_user_id",)] == "users"
    assert fks[("project_id",)] == "projects"
    assert fks[("job_id",)] == "transcription_jobs"
    assert fks[("job_source_id",)] == "transcription_job_sources"
    assert _attempt_enum_values(conn, "sourceattemptstage") == [e.value for e in SourceAttemptStage]
    assert _attempt_enum_values(conn, "sourceattemptretrydisposition") == [e.value for e in SourceAttemptRetryDisposition]



def _source_cleanup_enum_values(conn) -> list[str]:
    return conn.execute(text(
        "SELECT e.enumlabel FROM pg_enum e "
        "JOIN pg_type t ON t.oid = e.enumtypid "
        "WHERE t.typname = 'sourcestoragecleanupstatus' "
        "ORDER BY e.enumsortorder"
    )).scalars().all()


def _strip_0014_source_cleanup_schema(conn) -> None:
    conn.execute(text("DROP INDEX IF EXISTS ix_sources_storage_cleanup_selection"))
    conn.execute(text("ALTER TABLE sources DROP CONSTRAINT IF EXISTS ck_sources_storage_cleanup_attempt_count_nonnegative"))
    conn.execute(text("ALTER TABLE sources DROP CONSTRAINT IF EXISTS ck_sources_storage_cleanup_generation_nonnegative"))
    for col in [
        "storage_cleanup_status",
        "storage_cleanup_requested_at",
        "storage_cleanup_not_before_at",
        "storage_cleanup_completed_at",
        "storage_cleanup_attempt_count",
        "storage_cleanup_error_code",
        "storage_cleanup_owner_id",
        "storage_cleanup_generation",
        "storage_cleanup_claimed_at",
        "storage_cleanup_lease_expires_at",
    ]:
        conn.execute(text(f"ALTER TABLE sources DROP COLUMN IF EXISTS {col}"))
    conn.execute(text("DROP TYPE IF EXISTS sourcestoragecleanupstatus"))


def _assert_source_deletion_0014_schema(inspector, conn):
    cols = {c["name"]: c for c in inspector.get_columns("sources")}
    expected = {
        "storage_cleanup_status",
        "storage_cleanup_requested_at",
        "storage_cleanup_not_before_at",
        "storage_cleanup_completed_at",
        "storage_cleanup_attempt_count",
        "storage_cleanup_error_code",
        "storage_cleanup_owner_id",
        "storage_cleanup_generation",
        "storage_cleanup_claimed_at",
        "storage_cleanup_lease_expires_at",
    }
    assert expected.issubset(cols)
    assert cols["storage_cleanup_status"]["nullable"] is False
    assert cols["storage_cleanup_attempt_count"]["nullable"] is False
    assert cols["storage_cleanup_generation"]["nullable"] is False
    assert str(cols["storage_cleanup_status"].get("default", "")).strip("'::character varying")
    assert str(cols["storage_cleanup_attempt_count"].get("default", "")).startswith("0")
    assert str(cols["storage_cleanup_generation"].get("default", "")).startswith("0")
    checks = {c["name"] for c in inspector.get_check_constraints("sources")}
    assert "ck_sources_storage_cleanup_attempt_count_nonnegative" in checks
    assert "ck_sources_storage_cleanup_generation_nonnegative" in checks
    indexes = {idx["name"]: tuple(idx["column_names"]) for idx in inspector.get_indexes("sources")}
    assert indexes["ix_sources_storage_cleanup_selection"] == ("storage_cleanup_status", "storage_cleanup_not_before_at", "storage_cleanup_lease_expires_at")
    assert "ix_sources_storage_cleanup_status" not in indexes
    assert "ix_sources_storage_cleanup_not_before_at" not in indexes
    assert _source_cleanup_enum_values(conn) == [e.value for e in SourceStorageCleanupStatus]
    model_cols = Source.__table__.c
    for name in expected:
        assert name in model_cols
        assert model_cols[name].nullable == cols[name]["nullable"]


def _assert_source_deletion_0014_absent(inspector, conn):
    cols = {c["name"] for c in inspector.get_columns("sources")}
    assert not {
        "storage_cleanup_status",
        "storage_cleanup_requested_at",
        "storage_cleanup_not_before_at",
        "storage_cleanup_completed_at",
        "storage_cleanup_attempt_count",
        "storage_cleanup_error_code",
        "storage_cleanup_owner_id",
        "storage_cleanup_generation",
        "storage_cleanup_claimed_at",
        "storage_cleanup_lease_expires_at",
    } & cols
    indexes = {idx["name"] for idx in inspector.get_indexes("sources")}
    assert "ix_sources_storage_cleanup_selection" not in indexes
    checks = {c["name"] for c in inspector.get_check_constraints("sources")}
    assert "ck_sources_storage_cleanup_attempt_count_nonnegative" not in checks
    assert "ck_sources_storage_cleanup_generation_nonnegative" not in checks
    assert conn.execute(text("SELECT count(*) FROM pg_type WHERE typname = 'sourcestoragecleanupstatus'")).scalar_one() == 0


def _assert_user_source_retention_0015_absent(inspector):
    assert "source_retention_ttl_seconds" not in {c["name"] for c in inspector.get_columns("users")}
    assert "ck_users_source_retention_ttl_allowed" not in {c["name"] for c in inspector.get_check_constraints("users")}


def test_user_source_retention_0015_upgrade_downgrade_roundtrip_and_metadata_table():
    from studio_api.db import Base

    with isolated_migration_database("studio_migration_0015") as (temp_engine, env):
        run_alembic("0014_source_deletion_retention", env=env)
        with temp_engine.begin() as conn:
            conn.execute(text("ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_source_retention_ttl_allowed"))
            conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS source_retention_ttl_seconds"))
            conn.execute(text("UPDATE alembic_version SET version_num='0014_source_deletion_retention'"))
            _assert_user_source_retention_0015_absent(inspect(conn))
            conn.execute(text("INSERT INTO users (id, email, role, status, created_at, updated_at) VALUES ('user-0015', 'migration-0015@example.com', 'user', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"))

        run_alembic("0015_user_source_retention", env=env)
        with temp_engine.begin() as conn:
            inspector = inspect(conn)
            columns = {c["name"]: c for c in inspector.get_columns("users")}
            assert columns["source_retention_ttl_seconds"]["nullable"] is False
            assert "ck_users_source_retention_ttl_allowed" in {c["name"] for c in inspector.get_check_constraints("users")}
            assert conn.execute(text("SELECT source_retention_ttl_seconds FROM users WHERE id='user-0015'")).scalar_one() == 86400
            assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "0015_user_source_retention"
        for allowed in (3600, 86400, 259200, 604800, 2592000):
            with temp_engine.begin() as conn:
                conn.execute(text("UPDATE users SET source_retention_ttl_seconds=:allowed WHERE id='user-0015'"), {"allowed": allowed})
        with pytest.raises(Exception):
            with temp_engine.begin() as conn:
                conn.execute(text("UPDATE users SET source_retention_ttl_seconds=7200 WHERE id='user-0015'"))

        run_alembic("0014_source_deletion_retention", env=env, command="downgrade")
        with temp_engine.begin() as conn:
            _assert_user_source_retention_0015_absent(inspect(conn))
            assert conn.execute(text("SELECT count(*) FROM users WHERE id='user-0015'")).scalar_one() == 1
            assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "0014_source_deletion_retention"

    with isolated_migration_database("studio_migration_0015_metadata") as (temp_engine, env):
        Base.metadata.create_all(temp_engine)
        run_alembic("0015_user_source_retention", env=env, command="stamp")
        run_alembic("0014_source_deletion_retention", env=env, command="downgrade")
        with temp_engine.begin() as conn:
            _assert_user_source_retention_0015_absent(inspect(conn))


def test_source_deletion_0014_upgrade_downgrade_roundtrip_and_metadata_table(tmp_path):
    from studio_api.db import Base

    with isolated_migration_database("studio_migration_0014") as (temp_engine, env):
        run_alembic("0013_job_retry_recovery", env=env)
        with temp_engine.begin() as conn:
            _strip_0014_source_cleanup_schema(conn)
            assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "0013_job_retry_recovery"
            conn.execute(text("INSERT INTO users (id, email, role, status, created_at, updated_at) VALUES ('user-0014', 'migration-0014@example.com', 'user', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"))
            conn.execute(text("INSERT INTO projects (id, owner_user_id, title, created_at, updated_at) VALUES ('project-0014', 'user-0014', 'Migration 0014', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"))
            conn.execute(text("""
                INSERT INTO sources (id, project_id, source_type, original_filename, mime_type, size_bytes, drive_file_id, drive_file_url, s3_bucket, s3_object_key, upload_status, uploaded_at, expires_at, deleted_at, delete_reason, created_at, updated_at)
                VALUES
                ('source-active-local', 'project-0014', 'local_upload', 'active.mp3', 'audio/mpeg', 1, NULL, NULL, 'bucket', 'active/key', 'uploaded', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 day', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                ('source-deleted-local', 'project-0014', 'local_upload', 'deleted.mp3', 'audio/mpeg', 1, NULL, NULL, 'bucket', 'deleted/key', 'deleted', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP, 'user_deleted', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                ('source-expired-local', 'project-0014', 'local_upload', 'expired.mp3', 'audio/mpeg', 1, NULL, NULL, 'bucket', 'expired/key', 'uploaded', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '1 day', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                ('source-pending-deleted-local', 'project-0014', 'local_upload', 'pending.mp3', 'audio/mpeg', 1, NULL, NULL, 'bucket', 'pending/key', 'pending', NULL, CURRENT_TIMESTAMP + INTERVAL '2 days', CURRENT_TIMESTAMP, 'user_deleted', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                ('source-drive', 'project-0014', 'google_drive', 'drive.mp3', 'audio/mpeg', 1, 'drive-id-0014', 'https://drive.google.com/file/d/drive-id-0014/view', NULL, NULL, 'uploaded', CURRENT_TIMESTAMP, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """))
        run_alembic("0014_source_deletion_retention", env=env)
        with temp_engine.begin() as conn:
            assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "0014_source_deletion_retention"
            _assert_source_deletion_0014_schema(inspect(conn), conn)
            rows = {r["id"]: r for r in conn.execute(text("SELECT id, upload_status, deleted_at, delete_reason, s3_bucket, s3_object_key, storage_cleanup_status, storage_cleanup_requested_at, storage_cleanup_not_before_at, storage_cleanup_completed_at, storage_cleanup_attempt_count, storage_cleanup_generation, expires_at FROM sources WHERE project_id='project-0014' ORDER BY id")).mappings().all()}
            assert rows["source-drive"]["storage_cleanup_status"] == "not_applicable"
            assert rows["source-drive"]["storage_cleanup_requested_at"] is None
            assert rows["source-active-local"]["storage_cleanup_status"] == "not_requested"
            assert rows["source-deleted-local"]["storage_cleanup_status"] == "pending"
            assert rows["source-deleted-local"]["s3_bucket"] == "bucket" and rows["source-deleted-local"]["s3_object_key"] == "deleted/key"
            assert rows["source-expired-local"]["upload_status"] == "expired"
            assert rows["source-expired-local"]["delete_reason"] == "retention_expired"
            assert rows["source-expired-local"]["deleted_at"] is None
            assert rows["source-expired-local"]["storage_cleanup_status"] == "pending"
            assert rows["source-pending-deleted-local"]["storage_cleanup_status"] == "pending"
            assert rows["source-pending-deleted-local"]["storage_cleanup_not_before_at"] >= rows["source-pending-deleted-local"]["expires_at"]
            assert {row["storage_cleanup_attempt_count"] for row in rows.values()} == {0}
            assert {row["storage_cleanup_generation"] for row in rows.values()} == {0}
        run_alembic("0013_job_retry_recovery", env=env, command="downgrade")
        with temp_engine.begin() as conn:
            _assert_source_deletion_0014_absent(inspect(conn), conn)
            assert "sources" in inspect(conn).get_table_names()
            assert conn.execute(text("SELECT count(*) FROM sources WHERE project_id='project-0014'")).scalar_one() == 5
            assert conn.execute(text("SELECT s3_bucket, s3_object_key FROM sources WHERE id='source-deleted-local'")).one() == ("bucket", "deleted/key")
            assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "0013_job_retry_recovery"
        run_alembic("0014_source_deletion_retention", env=env)
        with temp_engine.begin() as conn:
            _assert_source_deletion_0014_schema(inspect(conn), conn)

    with isolated_migration_database("studio_migration_0014_metadata") as (temp_engine, env):
        Base.metadata.create_all(temp_engine)
        run_alembic("0014_source_deletion_retention", env=env, command="stamp")
        run_alembic("0013_job_retry_recovery", env=env, command="downgrade")
        with temp_engine.begin() as conn:
            _assert_source_deletion_0014_absent(inspect(conn), conn)
            assert "sources" in inspect(conn).get_table_names()
            assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "0013_job_retry_recovery"


def test_job_retry_recovery_0013_upgrade_downgrade_roundtrip_and_metadata_table(tmp_path):
    from studio_api.db import Base

    with isolated_migration_database("studio_migration_0013") as (temp_engine, env):
        run_alembic("0012_output_reconciliation_cases", env=env)
        with temp_engine.begin() as conn:
            # 0001 uses current metadata, so strip only 0013-owned objects to
            # create a genuine historical 0012 shape.
            conn.execute(text("DROP TABLE IF EXISTS transcription_job_source_attempts"))
            conn.execute(text("DROP TYPE IF EXISTS sourceattemptretrydisposition"))
            conn.execute(text("DROP TYPE IF EXISTS sourceattemptstage"))
            assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "0012_output_reconciliation_cases"
            assert "transcription_output_reconciliations" in inspect(conn).get_table_names()
            assert "transcription_job_source_attempts" not in inspect(conn).get_table_names()
            _assert_attempt_enums_absent(conn)
        run_alembic("0014_source_deletion_retention", env=env)
        with temp_engine.begin() as conn:
            _assert_job_retry_recovery_schema(inspect(conn), conn)
            assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "0014_source_deletion_retention"
        run_alembic("0012_output_reconciliation_cases", env=env, command="downgrade")
        with temp_engine.begin() as conn:
            assert "transcription_job_source_attempts" not in inspect(conn).get_table_names()
            assert "transcription_output_reconciliations" in inspect(conn).get_table_names()
            _assert_attempt_enums_absent(conn)
            assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "0012_output_reconciliation_cases"
        run_alembic("0014_source_deletion_retention", env=env)
        with temp_engine.begin() as conn:
            _assert_job_retry_recovery_schema(inspect(conn), conn)
            assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "0014_source_deletion_retention"

    with isolated_migration_database("studio_migration_0013_metadata") as (temp_engine, env):
        Base.metadata.create_all(temp_engine)
        run_alembic("0014_source_deletion_retention", env=env, command="stamp")
        run_alembic("0012_output_reconciliation_cases", env=env, command="downgrade")
        with temp_engine.begin() as conn:
            assert "transcription_job_source_attempts" not in inspect(conn).get_table_names()
            assert "transcription_output_reconciliations" in inspect(conn).get_table_names()
            _assert_attempt_enums_absent(conn)
            assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "0012_output_reconciliation_cases"


def test_job_destination_migration_0008_0009_upgrade_downgrade_backfill(tmp_path):
    from sqlalchemy import create_engine
    from sqlalchemy.engine import make_url
    import uuid

    temp_db = f"studio_migration_0009_{uuid.uuid4().hex}"
    base_url = make_url(engine.url)
    admin_url = base_url.set(database="postgres")
    temp_url = base_url.set(database=temp_db)
    admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    try:
        with admin_engine.connect() as conn:
            conn.execute(text(f'CREATE DATABASE "{temp_db}"'))
    except OperationalError as exc:
        pytest.skip(f"PostgreSQL database creation unavailable for isolated migration test: {exc}")
    finally:
        admin_engine.dispose()

    env = os.environ.copy()
    env.pop("STUDIO_DATABASE_URL", None)
    env["STUDIO_DATABASE_NAME"] = temp_db
    temp_engine = create_engine(temp_url)
    try:
        subprocess.run([sys.executable, "-m", "alembic", "-c", str(ALEMBIC), "upgrade", "0008_transcription_job_outputs"], cwd=ROOT, env=env, check=True)
        with temp_engine.begin() as conn:
            # The repository's 0001 baseline reflects current metadata, so strip
            # the 0009 additions to create a genuine revision-0008 shape before
            # inserting legacy rows and upgrading through 0009.
            conn.execute(text("ALTER TABLE transcription_jobs DROP CONSTRAINT IF EXISTS uq_transcription_jobs_batch_position"))
            conn.execute(text("ALTER TABLE transcription_jobs DROP CONSTRAINT IF EXISTS ck_transcription_jobs_batch_fields_all_or_none"))
            for col in ["batch_position", "batch_request_hash", "batch_idempotency_key", "output_drive_folder_name", "output_drive_folder_url", "output_drive_folder_id"]:
                conn.execute(text(f"ALTER TABLE transcription_jobs DROP COLUMN IF EXISTS {col}"))
            conn.execute(text("UPDATE alembic_version SET version_num='0008_transcription_job_outputs'"))
            conn.execute(text("""
                INSERT INTO users (id, email, role, status, created_at, updated_at)
                VALUES ('user-0009', 'migration-0009-isolated@example.com', 'user', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
            """))
            conn.execute(text("""
                INSERT INTO projects (id, owner_user_id, title, description, created_at, updated_at, archived_at, output_drive_folder_id, output_drive_folder_url, output_drive_folder_name)
                VALUES
                ('project-with-folder', 'user-0009', 'With folder', NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, 'folder-0009', 'https://drive.google.com/drive/folders/folder-0009', 'Migration folder'),
                ('project-without-folder', 'user-0009', 'Without folder', NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL, NULL, NULL)
            """))
            conn.execute(text("""
                INSERT INTO sources (id, project_id, source_type, original_filename, mime_type, size_bytes, drive_file_id, drive_file_url, s3_bucket, s3_object_key, upload_status, uploaded_at, expires_at, deleted_at, delete_reason, created_at, updated_at)
                VALUES
                ('source-with-folder', 'project-with-folder', 'local_upload', 'with.mp3', 'audio/mpeg', 10, NULL, NULL, 'bucket', 'objects/with', 'uploaded', '2026-01-01T00:00:00Z', NULL, NULL, NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
                ('source-without-folder', 'project-without-folder', 'local_upload', 'without.mp3', 'audio/mpeg', 10, NULL, NULL, 'bucket', 'objects/without', 'uploaded', '2026-01-01T00:00:00Z', NULL, NULL, NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
            """))
            conn.execute(text("""
                INSERT INTO transcription_jobs (id, project_id, owner_user_id, status, provider, provider_credential_id, title, language, options_json, created_at, updated_at, cancelled_at, started_at, finished_at, error_code, error_message, lease_owner_id, lease_generation, claimed_at, lease_expires_at, attempt_count, cancel_requested_at)
                VALUES
                ('job-with-folder', 'project-with-folder', 'user-0009', 'queued', NULL, NULL, 'Job with folder', 'en', NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, 0, NULL),
                ('job-without-folder', 'project-without-folder', 'user-0009', 'queued', NULL, NULL, 'Job without folder', 'en', NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, 0, NULL)
            """))
            conn.execute(text("""
                INSERT INTO transcription_job_sources (id, job_id, source_id, position, status, created_at)
                VALUES
                ('rel-with-folder', 'job-with-folder', 'source-with-folder', 0, 'queued', '2026-01-01T00:00:00Z'),
                ('rel-without-folder', 'job-without-folder', 'source-without-folder', 0, 'queued', '2026-01-01T00:00:00Z')
            """))
            conn.execute(text("""
                INSERT INTO transcription_job_outputs (id, job_id, job_source_id, document_id, web_view_url, output_drive_folder_id, output_kind, transcript_standard, document_character_count, document_created_at, persisted_at, lease_generation)
                VALUES ('output-with-folder', 'job-with-folder', 'rel-with-folder', 'doc-0009', 'https://docs.google.com/document/d/doc-0009/edit', 'folder-0009', 'google_docs_transcript', 'transcript_doc_v1.2', 12, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 0)
            """))

        subprocess.run([sys.executable, "-m", "alembic", "-c", str(ALEMBIC), "upgrade", "0009_job_output_destinations"], cwd=ROOT, env=env, check=True)
        with temp_engine.begin() as conn:
            cols = {c["name"] for c in inspect(conn).get_columns("transcription_jobs")}
            assert {"output_drive_folder_id", "output_drive_folder_url", "output_drive_folder_name", "batch_idempotency_key", "batch_request_hash", "batch_position"}.issubset(cols)
            rows = conn.execute(text("SELECT id, project_id, owner_user_id, status, output_drive_folder_id, output_drive_folder_url, output_drive_folder_name, batch_idempotency_key, batch_request_hash, batch_position FROM transcription_jobs ORDER BY id")).mappings().all()
            by_id = {row["id"]: row for row in rows}
            assert by_id["job-with-folder"]["output_drive_folder_id"] == "folder-0009"
            assert by_id["job-with-folder"]["output_drive_folder_url"] == "https://drive.google.com/drive/folders/folder-0009"
            assert by_id["job-with-folder"]["output_drive_folder_name"] == "Migration folder"
            assert by_id["job-without-folder"]["output_drive_folder_id"] is None
            assert all(row["batch_idempotency_key"] is None and row["batch_request_hash"] is None and row["batch_position"] is None for row in rows)
            assert conn.execute(text("SELECT count(*) FROM transcription_job_sources WHERE id IN ('rel-with-folder', 'rel-without-folder')")).scalar_one() == 2
            assert conn.execute(text("SELECT output_drive_folder_id, web_view_url FROM transcription_job_outputs WHERE id='output-with-folder'")).one() == ("folder-0009", "https://docs.google.com/document/d/doc-0009/edit")
            conn.execute(text("INSERT INTO transcription_jobs (id, project_id, owner_user_id, status, created_at, updated_at, lease_generation, attempt_count) VALUES ('legacy-null-batch', 'project-with-folder', 'user-0009', 'queued', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 0, 0)"))
            conn.execute(text("INSERT INTO transcription_jobs (id, project_id, owner_user_id, status, created_at, updated_at, lease_generation, attempt_count, batch_idempotency_key, batch_request_hash, batch_position) VALUES ('batch-valid', 'project-with-folder', 'user-0009', 'queued', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 0, 0, 'key', :hash, 0)"), {"hash": "a"*64})
        invalid_inserts = [
            ("INSERT INTO transcription_jobs (id, project_id, owner_user_id, status, created_at, updated_at, lease_generation, attempt_count, batch_idempotency_key) VALUES ('batch-partial', 'project-with-folder', 'user-0009', 'queued', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 0, 0, 'partial')", {}),
            ("INSERT INTO transcription_jobs (id, project_id, owner_user_id, status, created_at, updated_at, lease_generation, attempt_count, batch_idempotency_key, batch_request_hash, batch_position) VALUES ('batch-negative', 'project-with-folder', 'user-0009', 'queued', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 0, 0, 'neg', :hash, -1)", {"hash": "b"*64}),
            ("INSERT INTO transcription_jobs (id, project_id, owner_user_id, status, created_at, updated_at, lease_generation, attempt_count, batch_idempotency_key, batch_request_hash, batch_position) VALUES ('batch-duplicate', 'project-with-folder', 'user-0009', 'queued', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 0, 0, 'key', :hash, 0)", {"hash": "c"*64}),
        ]
        for stmt, params in invalid_inserts:
            with pytest.raises(Exception):
                with temp_engine.begin() as conn:
                    conn.execute(text(stmt), params)
        subprocess.run([sys.executable, "-m", "alembic", "-c", str(ALEMBIC), "downgrade", "0008_transcription_job_outputs"], cwd=ROOT, env=env, check=True)
        with temp_engine.begin() as conn:
            cols = {c["name"] for c in inspect(conn).get_columns("transcription_jobs")}
            assert not {"output_drive_folder_id", "output_drive_folder_url", "output_drive_folder_name", "batch_idempotency_key", "batch_request_hash", "batch_position"} & cols
            constraints = {c["name"] for c in inspect(conn).get_check_constraints("transcription_jobs")} | {c["name"] for c in inspect(conn).get_unique_constraints("transcription_jobs")}
            assert "ck_transcription_jobs_batch_fields_all_or_none" not in constraints
            assert "uq_transcription_jobs_batch_position" not in constraints
            assert conn.execute(text("SELECT count(*) FROM transcription_jobs WHERE id IN ('job-with-folder', 'job-without-folder')")).scalar_one() == 2
            assert conn.execute(text("SELECT count(*) FROM transcription_job_sources WHERE id IN ('rel-with-folder', 'rel-without-folder')")).scalar_one() == 2
            assert conn.execute(text("SELECT count(*) FROM transcription_job_outputs WHERE id='output-with-folder'")).scalar_one() == 1
        subprocess.run([sys.executable, "-m", "alembic", "-c", str(ALEMBIC), "upgrade", "0009_job_output_destinations"], cwd=ROOT, env=env, check=True)
        with temp_engine.begin() as conn:
            assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "0009_job_output_destinations"
        cfg = Config(str(ALEMBIC))
        assert ScriptDirectory.from_config(cfg).get_current_head() == "0015_user_source_retention"
    finally:
        temp_engine.dispose()
        cleanup_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
        try:
            with cleanup_engine.connect() as conn:
                conn.execute(text(f'DROP DATABASE IF EXISTS "{temp_db}" WITH (FORCE)'))
        finally:
            cleanup_engine.dispose()

def test_job_destination_0009_current_schema_constraints():
    inspector = inspect(engine)
    cols = {c["name"]: c for c in inspector.get_columns("transcription_jobs")}
    assert {"output_drive_folder_id", "output_drive_folder_url", "output_drive_folder_name", "batch_idempotency_key", "batch_request_hash", "batch_position"}.issubset(cols)
    constraints = {c["name"] for c in inspector.get_check_constraints("transcription_jobs")} | {c["name"] for c in inspector.get_unique_constraints("transcription_jobs")}
    assert "ck_transcription_jobs_batch_fields_all_or_none" in constraints
    assert "uq_transcription_jobs_batch_position" in constraints
    db = SessionLocal()
    try:
        user = User(email="migration-0009@example.com", role=UserRole.user, status=UserStatus.active); db.add(user); db.flush()
        p1 = Project(owner_user_id=user.id, title="With folder", output_drive_folder_id="folder-m", output_drive_folder_url="https://drive.google.com/drive/folders/folder-m", output_drive_folder_name="Migrated")
        p2 = Project(owner_user_id=user.id, title="Without folder")
        db.add_all([p1, p2]); db.flush()
        j1 = TranscriptionJob(project_id=p1.id, owner_user_id=user.id, status=JobStatus.queued)
        j1.apply_output_folder_snapshot(folder_id=p1.output_drive_folder_id, folder_url=p1.output_drive_folder_url, folder_name=p1.output_drive_folder_name)
        j2 = TranscriptionJob(project_id=p2.id, owner_user_id=user.id, status=JobStatus.queued)
        batch_ok = TranscriptionJob(project_id=p1.id, owner_user_id=user.id, status=JobStatus.queued, batch_idempotency_key="key", batch_request_hash="a"*64, batch_position=0)
        db.add_all([j1, j2, batch_ok]); db.flush(); db.commit()
        assert j1.output_drive_folder_id == "folder-m" and j1.batch_idempotency_key is None
        assert j2.output_drive_folder_id is None and j2.batch_idempotency_key is None
        db.add(TranscriptionJob(project_id=p1.id, owner_user_id=user.id, status=JobStatus.queued, batch_idempotency_key="partial"));
        with pytest.raises(Exception): db.commit()
        db.rollback()
        db.add(TranscriptionJob(project_id=p1.id, owner_user_id=user.id, status=JobStatus.queued, batch_idempotency_key="neg", batch_request_hash="b"*64, batch_position=-1));
        with pytest.raises(Exception): db.commit()
        db.rollback()
        db.add(TranscriptionJob(project_id=p1.id, owner_user_id=user.id, status=JobStatus.queued, batch_idempotency_key="key", batch_request_hash="c"*64, batch_position=0));
        with pytest.raises(Exception): db.commit()
        db.rollback()
        db.add_all([TranscriptionJob(project_id=p1.id, owner_user_id=user.id, status=JobStatus.queued), TranscriptionJob(project_id=p1.id, owner_user_id=user.id, status=JobStatus.queued)])
        db.commit()
    finally:
        db.close()


def test_diagnostics_debug_session_auth_csrf_bounds_conflict_and_stop_idempotent():
    pw = admin("debug-owner@example.com"); c = TestClient(app)
    assert c.get("/api/diagnostics/debug-session").status_code == 401
    csrf = login(c, pw, "debug-owner@example.com")
    assert c.post("/api/diagnostics/debug-session", json={"duration_minutes": 5}, headers={"origin": "https://evil.test", "x-csrf-token": csrf}).status_code == 403
    assert c.delete("/api/diagnostics/debug-session", headers={"origin": "https://evil.test", "x-csrf-token": csrf}).status_code == 403
    assert c.post("/api/diagnostics/debug-session", json={"duration_minutes": 5}, headers={"origin": "https://studio.test", "x-csrf-token": "bad"}).status_code == 403
    assert c.post("/api/diagnostics/debug-session", json={"duration_minutes": 0}, headers={"origin": "https://studio.test", "x-csrf-token": csrf}).status_code == 422
    assert c.post("/api/diagnostics/debug-session", json={"duration_minutes": 31}, headers={"origin": "https://studio.test", "x-csrf-token": csrf}).status_code == 422
    r = c.post("/api/diagnostics/debug-session", json={"duration_minutes": 5}, headers={"origin": "https://studio.test", "x-csrf-token": csrf})
    assert r.status_code == 200
    body = r.json(); assert body["active"] is True and body["max_duration_minutes"] == 30 and "id" not in body
    first_expiry = body["expires_at"]
    conflict = c.post("/api/diagnostics/debug-session", json={"duration_minutes": 30}, headers={"origin": "https://studio.test", "x-csrf-token": csrf})
    assert conflict.status_code == 409 and conflict.json()["detail"]["expires_at"] == first_expiry
    assert c.delete("/api/diagnostics/debug-session", headers={"origin": "https://studio.test", "x-csrf-token": csrf}).json() == {"active": False, "max_duration_minutes": 30}
    assert c.delete("/api/diagnostics/debug-session", headers={"origin": "https://studio.test", "x-csrf-token": csrf}).json() == {"active": False, "max_duration_minutes": 30}


def test_diagnostics_debug_session_owner_scope_and_expired_inactive():
    pw1 = admin("debug-a@example.com"); pw2 = admin("debug-b@example.com")
    c1 = TestClient(app); c2 = TestClient(app)
    csrf1 = login(c1, pw1, "debug-a@example.com"); csrf2 = login(c2, pw2, "debug-b@example.com")
    r = c1.post("/api/diagnostics/debug-session", json={"duration_minutes": 1}, headers={"origin": "https://studio.test", "x-csrf-token": csrf1})
    assert r.status_code == 200
    assert c2.get("/api/diagnostics/debug-session").json() == {"active": False, "max_duration_minutes": 30}
    assert c2.post("/api/diagnostics/debug-session", json={"duration_minutes": 1}, headers={"origin": "https://studio.test", "x-csrf-token": csrf2}).status_code == 200
    db = SessionLocal(); owner = db.query(User).filter_by(email="debug-a@example.com").one(); assert db.query(DiagnosticDebugSession).count() == 2; row = db.query(DiagnosticDebugSession).filter_by(owner_user_id=owner.id).one(); past_start = utcnow() - timedelta(minutes=2); row.started_at = past_start; row.expires_at = past_start + timedelta(minutes=1); db.commit(); db.close()
    assert c1.get("/api/diagnostics/debug-session").json() == {"active": False, "max_duration_minutes": 30}
    assert c1.post("/api/diagnostics/debug-session", json={"duration_minutes": 2}, headers={"origin": "https://studio.test", "x-csrf-token": csrf1}).status_code == 200
    db = SessionLocal(); assert db.query(DiagnosticDebugSession).count() == 2; db.close()


def test_pwa_diagnostics_ingestion_security_validation_and_visibility():
    pw = admin("pwa@example.com"); c = TestClient(app); csrf = login(c, pw, "pwa@example.com")
    payload = {"events": [{"event_code": "PWA_API_REQUEST_FAILED", "metadata": {"endpoint_group": "jobs", "http_status_category": "5xx", "duration_ms": 123, "retryable": True}}]}
    db = SessionLocal(); audit_count = db.query(AuditEvent).count(); db.close()
    assert TestClient(app).post("/api/diagnostics/pwa-events", json=payload).status_code == 401
    assert c.post("/api/diagnostics/pwa-events", json=payload, headers={"origin": "https://evil.test", "x-csrf-token": csrf}).status_code == 403
    assert c.post("/api/diagnostics/pwa-events", json=payload, headers={"origin": "https://studio.test", "x-csrf-token": "bad"}).status_code == 403
    ok = c.post("/api/diagnostics/pwa-events", json=payload, headers={"origin": "https://studio.test", "x-csrf-token": csrf})
    assert ok.status_code == 200 and ok.json()["accepted"] == 1
    db = SessionLocal(); row = db.query(DiagnosticEvent).one(); assert row.owner_user_id and row.component.value == "web" and row.event_code == "PWA_API_REQUEST_FAILED" and row.level.value == "WARNING" and row.request_id.startswith("req_"); db.close()
    events = c.get("/api/diagnostics/events?component=web&event_code=PWA_API_REQUEST_FAILED").json()["events"]
    assert len(events) == 1 and events[0]["metadata"]["endpoint_group"] == "jobs"
    db = SessionLocal(); audit_rows = db.query(AuditEvent).all(); assert len(audit_rows) == audit_count; assert all("PWA_" not in row.event_type and "PWA_" not in row.metadata_json for row in audit_rows); db.close()


def test_pwa_diagnostics_rejects_unknown_nested_oversized_forbidden_and_debug_without_session():
    pw = admin("pwa-reject@example.com"); c = TestClient(app); csrf = login(c, pw, "pwa-reject@example.com")
    headers={"origin": "https://studio.test", "x-csrf-token": csrf}
    from studio_api.diagnostics import write_diagnostic_event
    db = SessionLocal(); user = db.query(User).filter_by(email="pwa-reject@example.com").one(); user_id = user.id; db.close()
    assert write_diagnostic_event(owner_user_id=user_id, component="web", event_code="PWA_APP_ERROR", level="DEBUG", metadata={"error_code": "unknown"}).accepted is False
    bad_payloads = [
        {"events": [{"event_code": "NOPE", "metadata": {}}]},
        {"events": [{"event_code": "PWA_APP_ERROR", "metadata": {"unknown": "x"}}]},
        {"events": [{"event_code": "PWA_APP_ERROR", "metadata": {"error_code": {"nested": "x"}}}]},
        {"events": [{"event_code": "PWA_APP_ERROR", "metadata": {"duration_ms": 86400001}}]},
        {"events": [{"event_code": "PWA_APP_ERROR", "metadata": {"error_code": "https://example.test/file.mp3?token=value"}}]},
        {"events": [{"event_code": "PWA_APP_ERROR", "level": "DEBUG", "metadata": {"error_code": "unknown"}}]},
    ]
    for payload in bad_payloads:
        assert c.post("/api/diagnostics/pwa-events", json=payload, headers=headers).status_code in {403, 422}
    db=SessionLocal(); assert db.query(DiagnosticEvent).count() == 0; db.close()


def test_pwa_debug_ingestion_requires_active_session_and_does_not_extend_expiry():
    pw = admin("pwa-debug@example.com"); c = TestClient(app); csrf = login(c, pw, "pwa-debug@example.com")
    headers={"origin": "https://studio.test", "x-csrf-token": csrf}
    payload={"events": [{"event_code": "PWA_APP_ERROR", "level": "DEBUG", "metadata": {"error_code": "unknown"}}]}
    assert c.post("/api/diagnostics/pwa-events", json=payload, headers=headers).status_code == 403
    started=c.post("/api/diagnostics/debug-session", json={"duration_minutes": 10}, headers=headers).json(); expiry=started["expires_at"]
    assert c.post("/api/diagnostics/pwa-events", json=payload, headers=headers).status_code == 200
    assert c.get("/api/diagnostics/debug-session").json()["expires_at"] == expiry
    db=SessionLocal(); row=db.query(DiagnosticDebugSession).one(); past_start=utcnow() - timedelta(minutes=2); row.started_at=past_start; row.expires_at=past_start + timedelta(minutes=1); db.commit(); db.close()
    assert c.post("/api/diagnostics/pwa-events", json=payload, headers=headers).status_code == 403

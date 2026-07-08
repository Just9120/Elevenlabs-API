import base64
import os
import subprocess
import sys
import tempfile
from datetime import timedelta
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
from sqlalchemy import text
from studio_api.config import Settings
from studio_api.db import SessionLocal, engine
from studio_api.deps import get_client_ip
from studio_api.main import app, limiter
from studio_api.models import AuditEvent, LocalIdentity, Project, ProviderCredentialVersion, Source, SourceType, SourceUploadStatus, User, UserRole, UserStatus
from studio_api.security import aad, decrypt, encrypt, hash_password, master_key_from_b64, utcnow, verify_password

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
        tables = ["audit_events", "google_oauth_states", "google_connections", "provider_credential_versions", "provider_credentials", "transcription_job_sources", "transcription_jobs", "sources", "projects", "sessions", "login_contexts", "local_identities", "users"]
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

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
from fastapi.testclient import TestClient
from sqlalchemy import inspect, text

from studio_api.db import SessionLocal, engine
from studio_api.job_claim_lease import (
    JobLeaseError,
    JobLeaseFailureReason,
    acquire_job_lease,
    is_lease_active,
    release_job_lease,
    renew_job_lease,
)
from studio_api.main import app, limiter
from studio_api.models import (
    AuditEvent,
    JobStatus,
    LocalIdentity,
    Project,
    Source,
    SourceType,
    SourceUploadStatus,
    TranscriptionJob,
    TranscriptionJobSource,
    User,
    UserRole,
    UserStatus,
)
from studio_api.security import hash_password

ALEMBIC = ROOT / "apps/studio-api/alembic.ini"
NOW = datetime(2026, 7, 10, 12, 0, tzinfo=timezone.utc)
TTL = timedelta(minutes=15)


@pytest.fixture(scope="session", autouse=True)
def migrated_database():
    try:
        subprocess.run([sys.executable, "-m", "alembic", "-c", str(ALEMBIC), "upgrade", "head"], cwd=ROOT, check=True)
    except Exception as exc:
        pytest.skip(f"PostgreSQL/Alembic unavailable for lease tests: {exc}")
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


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def make_job(db, *, status=JobStatus.queued, ready=True):
    user = User(email=f"u-{id(db)}@example.com", role=UserRole.admin, status=UserStatus.active)
    db.add(user); db.flush(); db.add(LocalIdentity(user_id=user.id, password_hash=hash_password("correct horse battery")))
    project = Project(owner_user_id=user.id, title="Project", output_drive_folder_id="folder-1")
    db.add(project); db.flush()
    if ready:
        source = Source(project_id=project.id, source_type=SourceType.google_drive, original_filename="a.mp3", upload_status=SourceUploadStatus.uploaded, drive_file_id="drive-file-1")
    else:
        source = Source(project_id=project.id, source_type=SourceType.google_drive, original_filename="a.mp3", upload_status=SourceUploadStatus.pending)
    db.add(source); db.flush()
    job = TranscriptionJob(project_id=project.id, owner_user_id=user.id, status=status, title="Job")
    db.add(job); db.flush()
    db.add(TranscriptionJobSource(job_id=job.id, source_id=source.id, position=0))
    db.commit(); db.refresh(job)
    return user, job


def login(client, user):
    r = client.post("/api/auth/login-context", headers={"origin": "https://studio.test"}); assert r.status_code == 200
    r = client.post("/api/auth/login", json={"email": user.email, "password": "correct horse battery", "login_csrf_token": r.json()["login_csrf_token"]}, headers={"origin": "https://studio.test"}); assert r.status_code == 200
    return r.json()["csrf_token"]


def assert_reason(exc, reason):
    assert exc.value.reason == reason


def test_migration_model_fields_shape_and_defaults(db):
    cols = {c["name"]: c for c in inspect(engine).get_columns("transcription_jobs")}
    assert cols["lease_owner_id"]["nullable"] is True
    assert cols["lease_generation"]["nullable"] is False
    assert cols["claimed_at"]["nullable"] is True
    assert cols["lease_expires_at"]["nullable"] is True
    _, job = make_job(db)
    assert job.lease_owner_id is None
    assert job.lease_generation == 0
    assert job.claimed_at is None
    assert job.lease_expires_at is None


def test_acquire_active_reclaim_stale_fencing_and_no_commit(db):
    _, job = make_job(db)
    handle = acquire_job_lease(db, job_id=job.id, lease_owner_id="owner-1", now=NOW, lease_ttl=TTL)
    assert handle.lease_generation == 1
    assert handle.claimed_at == NOW
    assert handle.lease_expires_at == NOW + TTL
    assert job.status == JobStatus.queued
    assert job.started_at is None
    other = SessionLocal()
    try:
        assert other.get(TranscriptionJob, job.id).lease_owner_id is None
    finally:
        other.close()
    db.commit()

    with pytest.raises(JobLeaseError) as exc:
        acquire_job_lease(db, job_id=job.id, lease_owner_id="owner-2", now=NOW + timedelta(minutes=1), lease_ttl=TTL)
    assert_reason(exc, JobLeaseFailureReason.lease_active)
    db.rollback(); job = db.get(TranscriptionJob, job.id)
    assert job.lease_owner_id == "owner-1" and job.lease_generation == 1

    reclaimed = acquire_job_lease(db, job_id=job.id, lease_owner_id="owner-2", now=NOW + timedelta(minutes=16), lease_ttl=TTL)
    assert reclaimed.lease_generation == 2
    assert job.lease_owner_id == "owner-2"
    with pytest.raises(JobLeaseError) as exc:
        renew_job_lease(db, job_id=job.id, lease_owner_id="owner-1", lease_generation=1, now=NOW + timedelta(minutes=17), lease_ttl=TTL)
    assert_reason(exc, JobLeaseFailureReason.lease_not_owned)
    with pytest.raises(JobLeaseError) as exc:
        release_job_lease(db, job_id=job.id, lease_owner_id="owner-1", lease_generation=1)
    assert_reason(exc, JobLeaseFailureReason.lease_not_owned)


def test_renew_and_release_semantics(db):
    _, job = make_job(db)
    handle = acquire_job_lease(db, job_id=job.id, lease_owner_id="owner", now=NOW, lease_ttl=TTL)
    renewed = renew_job_lease(db, job_id=job.id, lease_owner_id="owner", lease_generation=handle.lease_generation, now=NOW + timedelta(minutes=5), lease_ttl=timedelta(minutes=30))
    assert renewed.lease_generation == handle.lease_generation
    assert renewed.lease_expires_at == NOW + timedelta(minutes=35)
    assert release_job_lease(db, job_id=job.id, lease_owner_id="owner", lease_generation=handle.lease_generation) is True
    assert job.lease_owner_id is None and job.lease_expires_at is None and job.lease_generation == 1
    assert release_job_lease(db, job_id=job.id, lease_owner_id="owner", lease_generation=handle.lease_generation) is False


def test_expired_and_terminal_leases_fail_closed(db):
    _, job = make_job(db)
    handle = acquire_job_lease(db, job_id=job.id, lease_owner_id="owner", now=NOW, lease_ttl=TTL)
    with pytest.raises(JobLeaseError) as exc:
        renew_job_lease(db, job_id=job.id, lease_owner_id="owner", lease_generation=handle.lease_generation, now=NOW + timedelta(minutes=16), lease_ttl=TTL)
    assert_reason(exc, JobLeaseFailureReason.lease_not_active)
    job.status = JobStatus.completed; db.commit()
    with pytest.raises(JobLeaseError) as exc:
        acquire_job_lease(db, job_id=job.id, lease_owner_id="next", now=NOW + timedelta(hours=1), lease_ttl=TTL)
    assert_reason(exc, JobLeaseFailureReason.job_not_queued)


def test_unready_job_and_invalid_inputs_cannot_claim(db):
    _, job = make_job(db, ready=False)
    with pytest.raises(JobLeaseError) as exc:
        acquire_job_lease(db, job_id=job.id, lease_owner_id="owner", now=NOW, lease_ttl=TTL)
    assert_reason(exc, JobLeaseFailureReason.job_not_ready)
    with pytest.raises(JobLeaseError) as exc:
        acquire_job_lease(db, job_id=job.id, lease_owner_id=" ", now=NOW, lease_ttl=TTL)
    assert_reason(exc, JobLeaseFailureReason.invalid_owner)
    with pytest.raises(JobLeaseError) as exc:
        acquire_job_lease(db, job_id=job.id, lease_owner_id="owner", now=NOW, lease_ttl=timedelta(0))
    assert_reason(exc, JobLeaseFailureReason.invalid_ttl)


def test_cancel_clears_lease_and_public_payloads_are_safe(db):
    user, job = make_job(db)
    handle = acquire_job_lease(db, job_id=job.id, lease_owner_id="internal-owner", now=NOW, lease_ttl=TTL)
    db.commit()
    client = TestClient(app); csrf = login(client, user)
    r = client.post(f"/api/jobs/{job.id}/cancel", headers={"origin": "https://studio.test", "x-csrf-token": csrf})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "cancelled"
    for key in ["lease_owner_id", "lease_generation", "claimed_at", "lease_expires_at"]:
        assert key not in body
    db.refresh(job)
    assert job.lease_owner_id is None and job.lease_expires_at is None and job.lease_generation == handle.lease_generation
    with pytest.raises(JobLeaseError):
        renew_job_lease(db, job_id=job.id, lease_owner_id="internal-owner", lease_generation=handle.lease_generation, now=NOW, lease_ttl=TTL)
    assert client.post(f"/api/jobs/{job.id}/cancel", headers={"origin": "https://studio.test", "x-csrf-token": csrf}).status_code == 200
    audit_text = "\n".join(event.metadata_json for event in db.query(AuditEvent).all())
    assert "internal-owner" not in audit_text


def test_active_lease_helper(db):
    _, job = make_job(db)
    acquire_job_lease(db, job_id=job.id, lease_owner_id="owner", now=NOW, lease_ttl=TTL)
    assert is_lease_active(job, NOW + timedelta(minutes=14)) is True
    assert is_lease_active(job, NOW + timedelta(minutes=15)) is False

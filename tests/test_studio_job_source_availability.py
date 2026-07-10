import base64
import os
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
os.environ.setdefault("STUDIO_CREDENTIAL_MASTER_KEY_FILE", str(Path(tempfile.gettempdir()) / "studio_test_master_key"))
Path(os.environ["STUDIO_POSTGRES_PASSWORD_FILE"]).write_text(os.environ.get("STUDIO_TEST_POSTGRES_PASSWORD", "studio_test_password"), encoding="utf-8")
Path(os.environ["STUDIO_CREDENTIAL_MASTER_KEY_FILE"]).write_text(base64.b64encode(b"1" * 32).decode(), encoding="utf-8")

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from studio_api.config import Settings
from studio_api.db import Base
from studio_api.google_drive import GoogleDriveMetadata
from studio_api.models import JobStatus, LocalIdentity, Project, Source, SourceType, SourceUploadStatus, TranscriptionJob, TranscriptionJobSource, User, UserRole, UserStatus
from studio_api.security import hash_password, utcnow
from studio_api.source_policy import is_supported_source_mime_type, normalize_source_mime_type
from studio_api.source_storage import ObjectHead
from studio_api.job_source_availability import verify_processing_job_sources

ENGINE = create_engine("sqlite+pysqlite:///:memory:")
SessionLocal = sessionmaker(bind=ENGINE)
Base.metadata.create_all(ENGINE)

@pytest.fixture(autouse=True)
def clean_state():
    Base.metadata.drop_all(ENGINE)
    Base.metadata.create_all(ENGINE)

class FakeStorage:
    def __init__(self, head=None, exc=None):
        self.head = head or ObjectHead(size_bytes=100, content_type="audio/mpeg")
        self.exc = exc
    def head_object(self, key):
        if self.exc:
            raise self.exc
        return self.head


def settings():
    return Settings(source_s3_endpoint_url="https://r2.test", source_s3_bucket="studio-temp", source_s3_access_key_id_file="/tmp/id", source_s3_secret_access_key_file="/tmp/key", source_max_upload_bytes=1000)


def make_processing_job(db, *, source_type=SourceType.local_upload, source_kwargs=None, status=JobStatus.processing, lease_owner="worker-1", lease_generation=1, expires_delta=timedelta(minutes=5), email="worker@example.com"):
    now = utcnow().replace(tzinfo=None)
    user = User(email=email, role=UserRole.admin, status=UserStatus.active)
    db.add(user); db.flush(); db.add(LocalIdentity(user_id=user.id, password_hash=hash_password("password-123")))
    project = Project(owner_user_id=user.id, title="Project")
    db.add(project); db.flush()
    kwargs = dict(project_id=project.id, source_type=source_type, original_filename="meeting.mp3", mime_type="audio/mpeg", size_bytes=100, upload_status=SourceUploadStatus.uploaded, uploaded_at=now)
    if source_type == SourceType.local_upload:
        kwargs.update(s3_bucket="studio-temp", s3_object_key="private/key", expires_at=now + timedelta(hours=1))
    else:
        kwargs.update(drive_file_id="drive-1")
    kwargs.update(source_kwargs or {})
    src = Source(**kwargs)
    db.add(src); db.flush()
    job = TranscriptionJob(project_id=project.id, owner_user_id=user.id, status=status, lease_owner_id=lease_owner, lease_generation=lease_generation, claimed_at=now, lease_expires_at=now + expires_delta, started_at=now)
    db.add(job); db.flush(); db.add(TranscriptionJobSource(job_id=job.id, source_id=src.id, position=0)); db.commit()
    return job.id, src.id, now, user.id


def test_source_policy_normalizes_and_accepts_only_media_and_ogg():
    assert normalize_source_mime_type(" Audio/MPEG ") == "audio/mpeg"
    assert is_supported_source_mime_type("audio/wav")
    assert is_supported_source_mime_type("video/mp4")
    assert is_supported_source_mime_type("application/ogg")
    assert not is_supported_source_mime_type("application/pdf")
    assert not is_supported_source_mime_type("application/vnd.google-apps.folder")


def test_processing_job_local_upload_head_ready_and_safe():
    db = SessionLocal()
    try:
        job_id, _, now, _ = make_processing_job(db)
        summary = verify_processing_job_sources(db, job_id=job_id, lease_owner_id="worker-1", lease_generation=1, now=now, settings=settings(), storage_factory=lambda _: FakeStorage())
        assert summary.ready is True
        assert [s.position for s in summary.sources] == [0]
        text = str(summary)
        assert "private/key" not in text and "studio-temp" not in text and "presigned" not in text
    finally:
        db.close()


def test_processing_job_rejects_wrong_lifecycle_and_lease_boundaries():
    cases = [
        {"status": JobStatus.queued, "reason": "job_not_processing"},
        {"lease_owner": "worker-1", "call_owner": "stale", "reason": "lease_not_owned"},
        {"lease_generation": 2, "call_generation": 1, "reason": "lease_not_owned"},
        {"expires_delta": timedelta(seconds=-1), "reason": "lease_not_active"},
    ]
    for index, case in enumerate(cases):
        db = SessionLocal()
        try:
            job_id, _, now, _ = make_processing_job(db, email=f"worker-{index}-{case['reason']}@example.com", status=case.get("status", JobStatus.processing), lease_owner=case.get("lease_owner", "worker-1"), lease_generation=case.get("lease_generation", 1), expires_delta=case.get("expires_delta", timedelta(minutes=5)))
            summary = verify_processing_job_sources(db, job_id=job_id, lease_owner_id=case.get("call_owner", "worker-1"), lease_generation=case.get("call_generation", 1), now=now, settings=settings())
            assert summary.ready is False
            assert case["reason"] in summary.blocking_reasons
        finally:
            db.close()


def test_google_drive_uses_one_token_for_multiple_sources_and_rejects_folder():
    db = SessionLocal()
    try:
        job_id, src_id, now, user_id = make_processing_job(db, source_type=SourceType.google_drive)
        job = db.get(TranscriptionJob, job_id)
        project_id = job.project_id
        s2 = Source(project_id=project_id, source_type=SourceType.google_drive, original_filename="two.mp4", mime_type="video/mp4", size_bytes=200, drive_file_id="drive-2", upload_status=SourceUploadStatus.uploaded, uploaded_at=now)
        db.add(s2); db.flush(); db.add(TranscriptionJobSource(job_id=job_id, source_id=s2.id, position=1)); db.commit()
        calls = {"token": 0}
        def token_resolver(db, *, user_id, settings):
            calls["token"] += 1
            return "access-token-secret"
        def fetcher(token, drive_file_id):
            if drive_file_id == "drive-2":
                return GoogleDriveMetadata(id=drive_file_id, name="folder", mime_type="application/vnd.google-apps.folder", size_bytes=None, web_view_link="raw", created_time=None, modified_time=None, is_folder=True)
            return GoogleDriveMetadata(id=drive_file_id, name="one", mime_type="audio/mpeg", size_bytes=100, web_view_link="raw", created_time=None, modified_time=None, is_folder=False)
        summary = verify_processing_job_sources(db, job_id=job_id, lease_owner_id="worker-1", lease_generation=1, now=now, settings=settings(), drive_token_resolver=token_resolver, drive_metadata_fetcher=fetcher)
        assert calls["token"] == 1
        assert summary.ready is False
        assert [s.position for s in summary.sources] == [0, 1]
        assert summary.sources[0].available is True
        assert "drive_file_is_folder" in summary.sources[1].blocking_reasons
        assert "access-token-secret" not in str(summary) and "drive-1" not in str(summary)
    finally:
        db.close()


def test_post_external_revalidation_blocks_source_deletion():
    db = SessionLocal()
    try:
        job_id, src_id, now, _ = make_processing_job(db)
        def storage_factory(_):
            src = db.get(Source, src_id)
            src.deleted_at = now
            db.flush()
            return FakeStorage()
        summary = verify_processing_job_sources(db, job_id=job_id, lease_owner_id="worker-1", lease_generation=1, now=now, settings=settings(), storage_factory=storage_factory)
        assert summary.ready is False
        assert "source_state_changed" in summary.blocking_reasons
    finally:
        db.close()

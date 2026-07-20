from datetime import datetime, timedelta, timezone
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


@pytest.fixture
def sqlite_db(monkeypatch):
    monkeypatch.setenv("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")
    from studio_api.config import get_settings

    get_settings.cache_clear()
    from studio_api.db import Base
    import studio_api.models  # noqa

    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


def _owner_project(db):
    from studio_api import models as m

    user = m.User(email="source-deletion@example.com", role=m.UserRole.user, status=m.UserStatus.active)
    db.add(user)
    db.flush()
    project = m.Project(owner_user_id=user.id, title="p")
    db.add(project)
    db.flush()
    return m, user, project


def test_google_drive_source_deletion_is_logical_and_not_applicable(sqlite_db):
    from studio_api.source_deletion import request_source_deletion

    m, user, project = _owner_project(sqlite_db)
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    src = m.Source(
        project_id=project.id,
        source_type=m.SourceType.google_drive,
        original_filename="drive.mp3",
        drive_file_id="drive-file",
        drive_file_url="https://drive.google.com/file/d/drive-file/view",
        upload_status=m.SourceUploadStatus.uploaded,
        uploaded_at=now,
        storage_cleanup_status=m.SourceStorageCleanupStatus.not_applicable,
    )
    sqlite_db.add(src)
    sqlite_db.commit()

    result = request_source_deletion(sqlite_db, owner_user_id=user.id, source_id=src.id, now=now)

    assert result and result.ok
    assert src.deleted_at == now
    assert src.upload_status == m.SourceUploadStatus.deleted
    assert src.storage_cleanup_status == m.SourceStorageCleanupStatus.not_applicable
    assert src.drive_file_id == "drive-file"


def test_queued_job_blocks_source_deletion_without_cleanup_state_change(sqlite_db):
    from studio_api.source_deletion import SourceDeletionReason, request_source_deletion

    m, user, project = _owner_project(sqlite_db)
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    src = m.Source(project_id=project.id, source_type=m.SourceType.local_upload, original_filename="local.mp3", s3_bucket="b", s3_object_key="k", upload_status=m.SourceUploadStatus.uploaded, uploaded_at=now, expires_at=now + timedelta(hours=1))
    sqlite_db.add(src)
    sqlite_db.flush()
    job = m.TranscriptionJob(project_id=project.id, owner_user_id=user.id, status=m.JobStatus.queued)
    sqlite_db.add(job)
    sqlite_db.flush()
    sqlite_db.add(m.TranscriptionJobSource(job_id=job.id, source_id=src.id, position=0, status=m.JobSourceStatus.queued))
    sqlite_db.commit()

    result = request_source_deletion(sqlite_db, owner_user_id=user.id, source_id=src.id, now=now)

    assert result and not result.ok
    assert result.reason == SourceDeletionReason.queued_job_uses_source
    assert src.deleted_at is None
    assert src.storage_cleanup_status == m.SourceStorageCleanupStatus.not_requested


def test_cleanup_claim_and_success_finalization_clears_private_object_identity(sqlite_db):
    from studio_api.source_deletion import claim_next_source_cleanup, finalize_source_cleanup, request_source_deletion

    m, user, project = _owner_project(sqlite_db)
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    src = m.Source(project_id=project.id, source_type=m.SourceType.local_upload, original_filename="local.mp3", s3_bucket="b", s3_object_key="k", upload_status=m.SourceUploadStatus.uploaded, uploaded_at=now, expires_at=now + timedelta(hours=1))
    sqlite_db.add(src)
    sqlite_db.commit()
    assert request_source_deletion(sqlite_db, owner_user_id=user.id, source_id=src.id, now=now).ok
    sqlite_db.commit()

    claim = claim_next_source_cleanup(sqlite_db, owner_id="worker", now=now)
    assert claim is not None
    assert claim.s3_object_key == "k"
    sqlite_db.commit()

    assert finalize_source_cleanup(sqlite_db, claim=claim, now=now + timedelta(seconds=1), success=True)
    assert src.storage_cleanup_status == m.SourceStorageCleanupStatus.completed
    assert src.s3_bucket is None
    assert src.s3_object_key is None
    assert src.original_filename == "local.mp3"

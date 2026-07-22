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


def _local_source(db, m, project, now, *, key="k", bucket="b", status=None, expires_delta=timedelta(hours=1), cleanup_status=None):
    src = m.Source(
        project_id=project.id,
        source_type=m.SourceType.local_upload,
        original_filename=f"{key}.mp3",
        s3_bucket=bucket,
        s3_object_key=key,
        upload_status=status or m.SourceUploadStatus.uploaded,
        uploaded_at=now,
        expires_at=now + expires_delta if expires_delta is not None else None,
        storage_cleanup_status=cleanup_status or m.SourceStorageCleanupStatus.not_requested,
    )
    db.add(src)
    db.flush()
    return src


class FakeStorageSettings:
    source_s3_bucket = "persisted-bucket"

    def source_storage_configured(self):
        return True


def _job_for_source(db, m, user, project, src, *, status, relation_status=None, attempt_count=1):
    job = m.TranscriptionJob(project_id=project.id, owner_user_id=user.id, status=status, provider="elevenlabs", provider_credential_id="cred", output_drive_folder_id="folder", attempt_count=attempt_count)
    db.add(job)
    db.flush()
    rel = m.TranscriptionJobSource(job_id=job.id, source_id=src.id, position=0, status=relation_status or m.JobSourceStatus.queued)
    db.add(rel)
    db.flush()
    return job, rel


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


@pytest.mark.parametrize(
    ("job_status", "allowed"),
    [
        ("processing", False),
        ("completed", True),
        ("cancelled", True),
        ("failed", True),
    ],
)
def test_deletion_blockers_and_terminal_history(sqlite_db, job_status, allowed):
    from studio_api.source_deletion import SourceDeletionReason, request_source_deletion

    m, user, project = _owner_project(sqlite_db)
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    src = _local_source(sqlite_db, m, project, now)
    _job_for_source(sqlite_db, m, user, project, src, status=getattr(m.JobStatus, job_status))
    sqlite_db.commit()

    result = request_source_deletion(sqlite_db, owner_user_id=user.id, source_id=src.id, now=now)

    assert result is not None
    assert result.ok is allowed
    if allowed:
        assert src.deleted_at == now
    else:
        assert result.reason == SourceDeletionReason.processing_job_uses_source
        assert src.deleted_at is None


def test_retryable_failed_job_blocks_but_skipped_relation_is_ignored(sqlite_db):
    from studio_api.source_deletion import SourceDeletionReason, request_source_deletion

    m, user, project = _owner_project(sqlite_db)
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    blocked = _local_source(sqlite_db, m, project, now, key="blocked")
    job, rel = _job_for_source(sqlite_db, m, user, project, blocked, status=m.JobStatus.failed)
    attempt = m.TranscriptionJobSourceAttempt(owner_user_id=user.id, project_id=project.id, job_id=job.id, job_source_id=rel.id, attempt_number=1, stage=m.SourceAttemptStage.prepared, retry_disposition=m.SourceAttemptRetryDisposition.undetermined, created_at=now, updated_at=now)
    sqlite_db.add(attempt)
    skipped = _local_source(sqlite_db, m, project, now, key="skipped")
    _job_for_source(sqlite_db, m, user, project, skipped, status=m.JobStatus.queued, relation_status=m.JobSourceStatus.skipped)
    sqlite_db.commit()

    blocked_result = request_source_deletion(sqlite_db, owner_user_id=user.id, source_id=blocked.id, now=now)
    skipped_result = request_source_deletion(sqlite_db, owner_user_id=user.id, source_id=skipped.id, now=now)

    assert blocked_result and not blocked_result.ok
    assert blocked_result.reason == SourceDeletionReason.retryable_failed_job_uses_source
    assert skipped_result and skipped_result.ok


def test_retention_expiry_and_candidate_starvation(sqlite_db):
    from studio_api.source_deletion import claim_next_source_cleanup, mark_one_expired_source_for_cleanup

    m, user, project = _owner_project(sqlite_db)
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    blocked = _local_source(sqlite_db, m, project, now, key="blocked", expires_delta=timedelta(seconds=0))
    _job_for_source(sqlite_db, m, user, project, blocked, status=m.JobStatus.processing)
    eligible = _local_source(sqlite_db, m, project, now, key="eligible", expires_delta=timedelta(seconds=0))
    sqlite_db.commit()

    assert mark_one_expired_source_for_cleanup(sqlite_db, now=now)
    assert blocked.upload_status == m.SourceUploadStatus.uploaded
    assert eligible.upload_status == m.SourceUploadStatus.expired
    assert eligible.deleted_at is None
    sqlite_db.commit()
    claim = claim_next_source_cleanup(sqlite_db, owner_id="worker", now=now)
    assert claim and claim.source_id == eligible.id
    assert claim.source_id != blocked.id


def test_cleanup_lease_fencing_reclaim_failure_and_missing_identity(sqlite_db):
    from studio_api.source_deletion import SourceCleanupClaim, claim_next_source_cleanup, finalize_source_cleanup, run_one_source_cleanup

    class Storage:
        def __init__(self, fail=False):
            self.calls = []
            self.fail = fail

        def delete_object(self, key, *, bucket=None):
            self.calls.append((bucket, key))
            if self.fail:
                raise RuntimeError("boom")

    m, user, project = _owner_project(sqlite_db)
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    src = _local_source(sqlite_db, m, project, now, bucket="old-bucket", cleanup_status=m.SourceStorageCleanupStatus.pending)
    src.deleted_at = now
    src.storage_cleanup_not_before_at = now
    sqlite_db.commit()

    first = claim_next_source_cleanup(sqlite_db, owner_id="worker-a", now=now)
    assert first and first.s3_bucket == "old-bucket"
    assert claim_next_source_cleanup(sqlite_db, owner_id="worker-b", now=now) is None
    assert not finalize_source_cleanup(sqlite_db, claim=SourceCleanupClaim(first.source_id, "stale", first.generation, first.s3_bucket, first.s3_object_key, first.attempt_count), now=now, success=True)
    src.storage_cleanup_lease_expires_at = now - timedelta(seconds=1)
    sqlite_db.commit()
    second = claim_next_source_cleanup(sqlite_db, owner_id="worker-b", now=now)
    assert second and second.generation == first.generation + 1
    storage = Storage(fail=True)
    assert run_one_source_cleanup(sqlite_db, settings=FakeStorageSettings(), owner_id="worker-c", now=now, storage_factory=lambda _: storage) is False or src.s3_object_key == "k"
    # Direct failure finalization preserves identity.
    finalize_source_cleanup(sqlite_db, claim=second, now=now, success=False, error_code="storage_delete_failed")
    assert src.s3_bucket == "old-bucket" and src.s3_object_key == "k"

    src.storage_cleanup_lease_expires_at = now - timedelta(seconds=1)
    sqlite_db.commit()
    third = claim_next_source_cleanup(sqlite_db, owner_id="worker-c", now=now + timedelta(minutes=11))
    assert third
    storage = Storage()
    finalize_source_cleanup(sqlite_db, claim=third, now=now + timedelta(minutes=11), success=True)
    assert src.s3_bucket is None and src.s3_object_key is None


def test_run_one_cleanup_uses_persisted_bucket_and_missing_identity_success(sqlite_db):
    from studio_api.source_deletion import run_one_source_cleanup

    class Storage:
        def __init__(self):
            self.calls = []

        def delete_object(self, key, *, bucket=None):
            self.calls.append((bucket, key))

    m, user, project = _owner_project(sqlite_db)
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    src = _local_source(sqlite_db, m, project, now, key="persisted-key", bucket="persisted-bucket", cleanup_status=m.SourceStorageCleanupStatus.pending)
    src.deleted_at = now
    src.storage_cleanup_not_before_at = now
    sqlite_db.commit()
    storage = Storage()
    assert run_one_source_cleanup(sqlite_db, settings=FakeStorageSettings(), owner_id="worker", now=now, storage_factory=lambda _: storage)
    assert storage.calls == [("persisted-bucket", "persisted-key")]
    assert src.s3_bucket is None and src.s3_object_key is None



def test_cleanup_bucket_mismatch_fails_without_delete_and_missing_identity_is_unclaimed(sqlite_db):
    from studio_api.source_deletion import claim_next_source_cleanup, run_one_source_cleanup

    class Storage:
        def __init__(self):
            self.calls = []

        def delete_object(self, key, *, bucket=None):
            self.calls.append((bucket, key))

    m, user, project = _owner_project(sqlite_db)
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    mismatch = _local_source(sqlite_db, m, project, now, key="persisted-key", bucket="other-bucket", cleanup_status=m.SourceStorageCleanupStatus.pending)
    mismatch.deleted_at = now
    mismatch.storage_cleanup_not_before_at = now
    sqlite_db.commit()
    storage = Storage()
    assert run_one_source_cleanup(sqlite_db, settings=FakeStorageSettings(), owner_id="worker", now=now, storage_factory=lambda _: storage)
    assert storage.calls == []
    assert mismatch.storage_cleanup_status == m.SourceStorageCleanupStatus.failed
    assert mismatch.storage_cleanup_error_code == "storage_identity_mismatch"
    assert mismatch.s3_bucket == "other-bucket" and mismatch.s3_object_key == "persisted-key"

    missing = _local_source(sqlite_db, m, project, now, key=None, bucket=None, cleanup_status=m.SourceStorageCleanupStatus.pending)
    missing.deleted_at = now
    missing.s3_bucket = None
    missing.s3_object_key = None
    missing.storage_cleanup_not_before_at = now
    mismatch.storage_cleanup_not_before_at = now + timedelta(days=1)
    sqlite_db.commit()
    assert claim_next_source_cleanup(sqlite_db, owner_id="worker", now=now) is None
    assert missing.storage_cleanup_status == m.SourceStorageCleanupStatus.pending


def test_repeated_delete_is_idempotent_for_audit_and_diagnostics(sqlite_db, monkeypatch):
    import studio_api.source_deletion as deletion
    from studio_api.source_deletion import request_source_deletion

    m, user, project = _owner_project(sqlite_db)
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    src = _local_source(sqlite_db, m, project, now)
    diagnostics = []
    monkeypatch.setattr(deletion, "write_diagnostic_event", lambda **kwargs: diagnostics.append(kwargs))
    sqlite_db.commit()
    assert request_source_deletion(sqlite_db, owner_user_id=user.id, source_id=src.id, now=now).ok
    sqlite_db.commit()
    deleted_at = src.deleted_at
    requested_at = src.storage_cleanup_requested_at
    first_audits = sqlite_db.query(m.AuditEvent).count()
    first_diagnostics = len(diagnostics)
    assert request_source_deletion(sqlite_db, owner_user_id=user.id, source_id=src.id, now=now + timedelta(minutes=1)).ok
    sqlite_db.commit()
    assert src.deleted_at == deleted_at
    assert src.storage_cleanup_requested_at == requested_at
    assert sqlite_db.query(m.AuditEvent).count() == first_audits
    assert len(diagnostics) == first_diagnostics


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


def test_source_diagnostics_registry_accepts_only_safe_metadata(sqlite_db):
    import json
    from sqlalchemy.orm import sessionmaker
    from studio_api.diagnostics import write_diagnostic_event

    m, user, project = _owner_project(sqlite_db)
    sqlite_db.commit()
    SessionLocal = sessionmaker(bind=sqlite_db.get_bind(), expire_on_commit=False)
    now = datetime(2026, 7, 20, tzinfo=timezone.utc)

    valid = write_diagnostic_event(
        owner_user_id=user.id,
        component="api",
        event_code="SOURCE_DELETION_REQUESTED",
        project_id=project.id,
        metadata={"source_type": "local_upload", "deletion_reason": "user_deleted", "boundary": "source_deletion"},
        session_factory=SessionLocal,
        now=now,
    )
    assert valid.accepted and valid.persisted
    row = sqlite_db.query(m.DiagnosticEvent).filter_by(event_code="SOURCE_DELETION_REQUESTED").one()
    persisted = json.loads(row.metadata_json)
    assert persisted == {"source_type": "local_upload", "deletion_reason": "user_deleted", "boundary": "source_deletion"}
    assert "source_id" not in persisted and "job_id" not in persisted
    assert "bucket" not in persisted and "object_key" not in persisted and "filename" not in persisted

    bad_boundary = write_diagnostic_event(
        owner_user_id=user.id,
        component="api",
        event_code="SOURCE_DELETION_REQUESTED",
        project_id=project.id,
        metadata={"source_type": "local_upload", "deletion_reason": "user_deleted", "boundary": "storage/s3"},
        session_factory=SessionLocal,
        now=now,
    )
    assert not bad_boundary.accepted and bad_boundary.reason == "invalid_metadata"

    forbidden = write_diagnostic_event(
        owner_user_id=user.id,
        component="worker",
        event_code="SOURCE_STORAGE_CLEANUP_STARTED",
        project_id=project.id,
        metadata={"source_type": "local_upload", "cleanup_attempt": 1, "boundary": "source_cleanup", "bucket": "private-bucket"},
        session_factory=SessionLocal,
        now=now,
    )
    assert not forbidden.accepted and forbidden.reason == "invalid_metadata"
    assert sqlite_db.query(m.DiagnosticEvent).count() == 1


@pytest.mark.parametrize(
    "mutation",
    ["owner", "generation", "status", "bucket", "key"],
)
def test_cleanup_finalization_requires_full_claim_identity(sqlite_db, mutation):
    from studio_api.source_deletion import SourceCleanupClaim, claim_next_source_cleanup, finalize_source_cleanup

    m, user, project = _owner_project(sqlite_db)
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    src = _local_source(sqlite_db, m, project, now, key="claimed-key", bucket="claimed-bucket", cleanup_status=m.SourceStorageCleanupStatus.pending)
    src.deleted_at = now
    src.storage_cleanup_not_before_at = now
    sqlite_db.commit()

    claim = claim_next_source_cleanup(sqlite_db, owner_id="worker-a", now=now)
    assert claim is not None
    bad_claim = claim
    if mutation == "owner":
        bad_claim = SourceCleanupClaim(claim.source_id, "other-worker", claim.generation, claim.s3_bucket, claim.s3_object_key, claim.attempt_count)
    elif mutation == "generation":
        bad_claim = SourceCleanupClaim(claim.source_id, claim.owner_id, claim.generation + 1, claim.s3_bucket, claim.s3_object_key, claim.attempt_count)
    elif mutation == "status":
        src.storage_cleanup_status = m.SourceStorageCleanupStatus.failed
    elif mutation == "bucket":
        src.s3_bucket = "changed-bucket"
    elif mutation == "key":
        src.s3_object_key = "changed-key"
    sqlite_db.commit()

    assert not finalize_source_cleanup(sqlite_db, claim=bad_claim, now=now, success=True)
    assert src.storage_cleanup_completed_at is None
    assert src.s3_bucket is not None
    assert src.s3_object_key is not None
    if mutation not in {"owner", "generation"}:
        assert src.storage_cleanup_owner_id == claim.owner_id
        assert src.storage_cleanup_lease_expires_at is not None


def test_cleanup_exact_failure_preserves_identity_and_success_clears_identity(sqlite_db):
    from studio_api.source_deletion import claim_next_source_cleanup, finalize_source_cleanup

    m, user, project = _owner_project(sqlite_db)
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    failing = _local_source(sqlite_db, m, project, now, key="failure-key", bucket="failure-bucket", cleanup_status=m.SourceStorageCleanupStatus.pending)
    failing.deleted_at = now
    failing.storage_cleanup_not_before_at = now
    succeeding = _local_source(sqlite_db, m, project, now, key="success-key", bucket="success-bucket", cleanup_status=m.SourceStorageCleanupStatus.pending)
    succeeding.deleted_at = now
    succeeding.storage_cleanup_not_before_at = now + timedelta(seconds=1)
    sqlite_db.commit()

    failure_claim = claim_next_source_cleanup(sqlite_db, owner_id="worker", now=now)
    assert failure_claim and failure_claim.source_id == failing.id
    assert finalize_source_cleanup(sqlite_db, claim=failure_claim, now=now, success=False, error_code="storage_delete_failed")
    assert failing.storage_cleanup_status == m.SourceStorageCleanupStatus.failed
    assert failing.s3_bucket == "failure-bucket" and failing.s3_object_key == "failure-key"
    assert failing.storage_cleanup_owner_id is None

    success_claim = claim_next_source_cleanup(sqlite_db, owner_id="worker", now=now + timedelta(seconds=1))
    assert success_claim and success_claim.source_id == succeeding.id
    assert finalize_source_cleanup(sqlite_db, claim=success_claim, now=now + timedelta(seconds=1), success=True)
    assert succeeding.storage_cleanup_status == m.SourceStorageCleanupStatus.completed
    assert succeeding.s3_bucket is None and succeeding.s3_object_key is None


def test_audit_source_lifecycle_metadata_contract(sqlite_db):
    import json
    from studio_api.audit import audit

    m, user, project = _owner_project(sqlite_db)
    audit(
        sqlite_db,
        "source.deletion_blocked",
        actor_user_id=user.id,
        subject_user_id=user.id,
        blocker="queued_job_uses_source",
        deletion_reason="user_deleted",
        cleanup_outcome="completed",
        cleanup_attempt=7,
        source_id="private-source",
        job_id="private-job",
        project_id="private-project",
        bucket="private-bucket",
        object_key="private/key",
        filename="secret.mp3",
        url="https://example.invalid/secret",
        owner="worker",
        generation=3,
        exception="Traceback secret-token",
        token="secret-token",
    )
    audit(
        sqlite_db,
        "source.storage_cleanup_failed",
        blocker="not-a-safe-blocker",
        deletion_reason="hard_deleted",
        cleanup_outcome="raw_failure",
        cleanup_attempt=-1,
    )
    audit(sqlite_db, "source.storage_cleanup_failed", cleanup_attempt=100001)
    audit(sqlite_db, "source.storage_cleanup_failed", cleanup_attempt=True)
    # Existing legacy safe keys still persist.
    audit(sqlite_db, "credential.updated", provider="openai", credential_id="cred-safe", session_id="sess-safe", reason="rotation")
    sqlite_db.commit()

    rows = sqlite_db.query(m.AuditEvent).all()
    blocked = [row for row in rows if row.event_type == "source.deletion_blocked"]
    cleanup_failures = [row for row in rows if row.event_type == "source.storage_cleanup_failed"]
    credential_updates = [row for row in rows if row.event_type == "credential.updated"]

    assert len(rows) == 5
    assert len(blocked) == 1
    assert len(cleanup_failures) == 3
    assert len(credential_updates) == 1
    persisted = json.loads(blocked[0].metadata_json)
    assert persisted == {
        "blocker": "queued_job_uses_source",
        "deletion_reason": "user_deleted",
        "cleanup_outcome": "completed",
        "cleanup_attempt": 7,
    }
    assert all(json.loads(row.metadata_json) == {} for row in cleanup_failures)
    assert json.loads(credential_updates[0].metadata_json) == {"credential_id": "cred-safe", "provider": "openai", "reason": "rotation", "session_id": "sess-safe"}


def test_cleanup_sql_selection_skips_more_than_100_processing_blocked_sources(sqlite_db):
    from studio_api.source_deletion import claim_next_source_cleanup, mark_one_expired_source_for_cleanup

    m, user, project = _owner_project(sqlite_db)
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for idx in range(105):
        src = _local_source(sqlite_db, m, project, now - timedelta(minutes=idx + 2), key=f"blocked-{idx}", expires_delta=timedelta(seconds=0))
        _job_for_source(sqlite_db, m, user, project, src, status=m.JobStatus.processing)
    skipped = _local_source(sqlite_db, m, project, now - timedelta(minutes=1), key="skipped-processing", expires_delta=timedelta(seconds=0))
    _job_for_source(sqlite_db, m, user, project, skipped, status=m.JobStatus.processing, relation_status=m.JobSourceStatus.skipped)
    eligible = _local_source(sqlite_db, m, project, now, key="eligible-later", expires_delta=timedelta(seconds=0))
    sqlite_db.commit()

    assert mark_one_expired_source_for_cleanup(sqlite_db, now=now)
    assert skipped.upload_status == m.SourceUploadStatus.expired
    assert eligible.upload_status == m.SourceUploadStatus.uploaded
    sqlite_db.commit()

    skipped.deleted_at = now
    skipped.storage_cleanup_not_before_at = now
    eligible.upload_status = m.SourceUploadStatus.expired
    eligible.deleted_at = now
    eligible.storage_cleanup_status = m.SourceStorageCleanupStatus.pending
    eligible.storage_cleanup_not_before_at = now + timedelta(seconds=1)
    sqlite_db.commit()
    claim = claim_next_source_cleanup(sqlite_db, owner_id="worker", now=now)
    assert claim is not None
    assert claim.source_id == skipped.id
    assert claim.source_id != eligible.id
    assert claim_next_source_cleanup(sqlite_db, owner_id="worker-2", now=now) is None


def test_job_source_final_validation_compiles_to_no_key_update(monkeypatch):
    from sqlalchemy import select
    from sqlalchemy.dialects import postgresql
    from studio_api.models import Source

    stmt = select(Source).where(Source.id.in_(["source-a"])).order_by(Source.id.asc()).with_for_update(key_share=True)
    compiled = str(stmt.compile(dialect=postgresql.dialect()))
    assert "FOR NO KEY UPDATE" in compiled
    assert "FOR UPDATE" not in compiled.replace("FOR NO KEY UPDATE", "")

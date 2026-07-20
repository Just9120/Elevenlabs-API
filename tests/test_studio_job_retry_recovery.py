import base64
import os
import sys
from pathlib import Path

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


@pytest.fixture
def studio_model_modules(monkeypatch, tmp_path):
    password_file = tmp_path / "studio_test_pg_password"
    master_key_file = tmp_path / "studio_test_master_key"
    password_file.write_text(os.environ.get("STUDIO_TEST_POSTGRES_PASSWORD", "studio_test_password"), encoding="utf-8")
    master_key_file.write_text(base64.b64encode(b"1" * 32).decode(), encoding="utf-8")
    monkeypatch.setenv("STUDIO_DATABASE_SCHEME", "postgresql+psycopg")
    monkeypatch.setenv("STUDIO_DATABASE_HOST", "127.0.0.1")
    monkeypatch.setenv("STUDIO_DATABASE_PORT", "5432")
    monkeypatch.setenv("STUDIO_DATABASE_NAME", "studio_test")
    monkeypatch.setenv("STUDIO_DATABASE_USER", "studio_test")
    monkeypatch.setenv("STUDIO_POSTGRES_PASSWORD_FILE", str(password_file))
    monkeypatch.setenv("STUDIO_CREDENTIAL_MASTER_KEY_FILE", str(master_key_file))
    from studio_api.job_retry_recovery import MAX_PROCESSING_ATTEMPTS, SAFE_PROVIDER_FAILURES, UNCERTAIN_PROVIDER_FAILURES
    from studio_api.models import SourceAttemptRetryDisposition, SourceAttemptStage, TranscriptionJobSourceAttempt
    return {
        "MAX_PROCESSING_ATTEMPTS": MAX_PROCESSING_ATTEMPTS,
        "SAFE_PROVIDER_FAILURES": SAFE_PROVIDER_FAILURES,
        "UNCERTAIN_PROVIDER_FAILURES": UNCERTAIN_PROVIDER_FAILURES,
        "SourceAttemptRetryDisposition": SourceAttemptRetryDisposition,
        "SourceAttemptStage": SourceAttemptStage,
        "TranscriptionJobSourceAttempt": TranscriptionJobSourceAttempt,
    }


def test_retry_recovery_model_metadata_contract(studio_model_modules):
    table = studio_model_modules["TranscriptionJobSourceAttempt"].__table__
    assert table.name == "transcription_job_source_attempts"
    assert studio_model_modules["MAX_PROCESSING_ATTEMPTS"] == 3
    assert {e.value for e in studio_model_modules["SourceAttemptStage"]} == {
        "prepared", "provider_request_started", "provider_response_returned", "google_handoff", "output_persisted", "failed"
    }
    assert {e.value for e in studio_model_modules["SourceAttemptRetryDisposition"]} == {
        "undetermined", "retry_safe", "provider_outcome_uncertain", "provider_result_lost", "output_reconciliation_required", "non_retryable", "completed"
    }
    assert {"provider_authentication_rejected", "provider_request_rejected", "provider_rate_limited"} <= studio_model_modules["SAFE_PROVIDER_FAILURES"]
    assert {"provider_timeout", "provider_unavailable", "malformed_provider_response", "unknown"} <= studio_model_modules["UNCERTAIN_PROVIDER_FAILURES"]
    assert {"owner_user_id", "project_id", "job_id", "job_source_id", "attempt_number", "stage", "retry_disposition"} <= set(table.c.keys())
    assert {tuple(c.name for c in constraint.columns) for constraint in table.constraints if getattr(constraint, "columns", None)} >= {("job_source_id", "attempt_number")}
    indexes = {idx.name: tuple(col.name for col in idx.columns) for idx in table.indexes}
    assert indexes["ix_source_attempts_job_id"] == ("job_id",)
    assert indexes["ix_source_attempts_job_source_id"] == ("job_source_id",)
    assert indexes["ix_source_attempts_retry_disposition"] == ("retry_disposition",)
    assert indexes["ix_source_attempts_job_retry_disposition"] == ("job_id", "retry_disposition")


def test_alembic_single_head_is_retry_recovery():
    cfg = Config("apps/studio-api/alembic.ini")
    script = ScriptDirectory.from_config(cfg)
    assert script.get_heads() == ["0014_source_deletion_retention"]
    assert script.get_current_head() == "0014_source_deletion_retention"

from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


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
        db.close(); Base.metadata.drop_all(engine); engine.dispose()


def _job_with_sources(db, *, source_count=2, status="processing", attempt_count=1, expired=False):
    from studio_api import models as m
    now = datetime(2026, 1, 2, 3, 4, 5)
    user = m.User(email=f"retry-{id(db)}-{source_count}-{attempt_count}-{status}@example.com", role=m.UserRole.user, status=m.UserStatus.active)
    db.add(user); db.flush()
    project = m.Project(owner_user_id=user.id, title="p", output_drive_folder_id="folder")
    db.add(project); db.flush()
    job = m.TranscriptionJob(project_id=project.id, owner_user_id=user.id, status=getattr(m.JobStatus, status), provider="elevenlabs", provider_credential_id="cred", output_drive_folder_id="folder", lease_owner_id="worker", lease_generation=7, claimed_at=now, lease_expires_at=now + (-timedelta(seconds=1) if expired else timedelta(minutes=10)), attempt_count=attempt_count, started_at=now)
    db.add(job); db.flush()
    rels=[]
    for idx in range(source_count):
        src = m.Source(project_id=project.id, source_type=m.SourceType.local_upload, original_filename=f"s{idx}.mp3", mime_type="audio/mpeg", size_bytes=1, s3_bucket="bucket", s3_object_key=f"key-{idx}", upload_status=m.SourceUploadStatus.uploaded, uploaded_at=now, expires_at=now+timedelta(hours=1))
        db.add(src); db.flush()
        rel = m.TranscriptionJobSource(job_id=job.id, source_id=src.id, position=idx, status=m.JobSourceStatus.queued)
        db.add(rel); db.flush(); rels.append(rel)
    db.commit(); return m, now, user, project, job, rels


def _attempt(db, m, job, rel, *, number=None, stage=None, disposition=None, started=False, returned=False):
    now = datetime(2026, 1, 2, 3, 4, 5)
    row = m.TranscriptionJobSourceAttempt(owner_user_id=job.owner_user_id, project_id=job.project_id, job_id=job.id, job_source_id=rel.id, attempt_number=number or job.attempt_count, stage=stage or m.SourceAttemptStage.prepared, retry_disposition=disposition or m.SourceAttemptRetryDisposition.undetermined, provider_request_started_at=now if started else None, provider_response_returned_at=now if returned else None, created_at=now, updated_at=now)
    db.add(row); db.commit(); return row


def test_prepare_current_attempt_sources_creates_all_missing_and_is_idempotent(sqlite_db):
    from studio_api.job_retry_recovery import prepare_current_attempt_sources
    m, now, _user, _project, job, rels = _job_with_sources(sqlite_db, source_count=2)
    created = prepare_current_attempt_sources(sqlite_db, job_id=job.id, lease_owner_id="worker", lease_generation=7, now=now)
    sqlite_db.commit()
    assert [row.job_source_id for row in created] == [rel.id for rel in rels]
    assert sqlite_db.query(m.TranscriptionJobSourceAttempt).count() == 2
    assert prepare_current_attempt_sources(sqlite_db, job_id=job.id, lease_owner_id="worker", lease_generation=7, now=now) == ()
    sqlite_db.commit()
    assert sqlite_db.query(m.TranscriptionJobSourceAttempt).count() == 2


def test_prepare_current_attempt_sources_skips_outputs_blocks_reconciliation_and_later_stage(sqlite_db):
    from studio_api.job_retry_recovery import prepare_current_attempt_sources
    m, now, _user, _project, job, rels = _job_with_sources(sqlite_db, source_count=3)
    sqlite_db.add(m.TranscriptionJobOutput(job_id=job.id, job_source_id=rels[0].id, document_id="doc-1", web_view_url="https://docs.example/doc-1", output_drive_folder_id="folder", output_kind="google_docs_transcript", transcript_standard="transcript_doc_v1.2", document_character_count=1, document_created_at=now, persisted_at=now, lease_generation=7))
    _attempt(sqlite_db, m, job, rels[2], stage=m.SourceAttemptStage.provider_request_started, disposition=m.SourceAttemptRetryDisposition.undetermined, started=True)
    with pytest.raises(RuntimeError, match="retry_state_not_prepared"):
        prepare_current_attempt_sources(sqlite_db, job_id=job.id, lease_owner_id="worker", lease_generation=7, now=now)
    sqlite_db.rollback()
    sqlite_db.query(m.TranscriptionJobSourceAttempt).delete(); sqlite_db.flush()
    sqlite_db.add(m.TranscriptionOutputReconciliation(owner_user_id=job.owner_user_id, project_id=job.project_id, job_id=job.id, job_source_id=rels[1].id, reconciliation_token="tok", lease_generation=7, attempt_number=1, status=m.OutputReconciliationStatus.reconciliation_required, expected_output_drive_folder_id="folder", expected_document_character_count=1, prepared_at=now, created_at=now, updated_at=now))
    sqlite_db.commit()
    with pytest.raises(RuntimeError, match="retry_state_reconciliation_exists"):
        prepare_current_attempt_sources(sqlite_db, job_id=job.id, lease_owner_id="worker", lease_generation=7, now=now)


def test_prepare_current_attempt_sources_requires_exact_processing_context_and_attempt_number(sqlite_db):
    from studio_api.job_retry_recovery import prepare_current_attempt_sources
    m, now, _user, _project, job, _rels = _job_with_sources(sqlite_db, source_count=1, attempt_count=0)
    with pytest.raises(RuntimeError, match="retry_state_invalid_attempt_number"):
        prepare_current_attempt_sources(sqlite_db, job_id=job.id, lease_owner_id="worker", lease_generation=7, now=now)
    job.attempt_count = 1; sqlite_db.commit()
    with pytest.raises(RuntimeError, match="retry_state_processing_context_invalid"):
        prepare_current_attempt_sources(sqlite_db, job_id=job.id, lease_owner_id="wrong", lease_generation=7, now=now)
    with pytest.raises(RuntimeError, match="retry_state_processing_context_invalid"):
        prepare_current_attempt_sources(sqlite_db, job_id=job.id, lease_owner_id="worker", lease_generation=8, now=now)


def test_multisource_prepared_rows_allow_recovery_and_explicit_retry(sqlite_db):
    from studio_api.job_processing_lifecycle import recover_expired_processing_job
    from studio_api.job_retry_recovery import compute_explicit_retry_readiness
    m, now, _user, _project, job, rels = _job_with_sources(sqlite_db, source_count=2, expired=True)
    for rel in rels: _attempt(sqlite_db, m, job, rel)
    result = recover_expired_processing_job(sqlite_db, job_id=job.id, now=now)
    assert result.status == m.JobStatus.queued
    job.status = m.JobStatus.failed; job.lease_owner_id = None; job.lease_expires_at = None; sqlite_db.commit()
    assert compute_explicit_retry_readiness(sqlite_db, job, now=now).available is True


def test_partial_output_preserved_and_prepared_next_source_is_safe(sqlite_db):
    from studio_api.job_retry_recovery import compute_explicit_retry_readiness, prepare_current_attempt_sources
    m, now, _user, _project, job, rels = _job_with_sources(sqlite_db, source_count=2, status="failed")
    job.lease_owner_id = None; job.lease_expires_at = None
    sqlite_db.add(m.TranscriptionJobOutput(job_id=job.id, job_source_id=rels[0].id, document_id="doc-1", web_view_url="https://docs.example/doc-1", output_drive_folder_id="folder", output_kind="google_docs_transcript", transcript_standard="transcript_doc_v1.2", document_character_count=1, document_created_at=now, persisted_at=now, lease_generation=7))
    _attempt(sqlite_db, m, job, rels[1])
    assert compute_explicit_retry_readiness(sqlite_db, job, now=now).available is True
    job.status = m.JobStatus.processing; job.lease_owner_id = "worker"; job.lease_expires_at = now + timedelta(minutes=1); sqlite_db.commit()
    assert prepare_current_attempt_sources(sqlite_db, job_id=job.id, lease_owner_id="worker", lease_generation=7, now=now) == ()
    assert sqlite_db.query(m.TranscriptionJobSourceAttempt).filter_by(job_source_id=rels[0].id).count() == 0


@pytest.mark.parametrize("stage,disp,reason", [
    ("provider_request_started", "provider_outcome_uncertain", "provider_outcome_uncertain"),
    ("provider_response_returned", "provider_result_lost", "provider_result_lost"),
])
def test_any_unsafe_current_source_blocks_later_prepared_source(sqlite_db, stage, disp, reason):
    from studio_api.job_retry_recovery import compute_explicit_retry_readiness
    m, now, _user, _project, job, rels = _job_with_sources(sqlite_db, source_count=2, status="failed")
    job.lease_owner_id = None; job.lease_expires_at = None; sqlite_db.commit()
    _attempt(sqlite_db, m, job, rels[0], stage=getattr(m.SourceAttemptStage, stage), disposition=getattr(m.SourceAttemptRetryDisposition, disp), started=True, returned=stage == "provider_response_returned")
    _attempt(sqlite_db, m, job, rels[1])
    ready = compute_explicit_retry_readiness(sqlite_db, job, now=now)
    assert ready.available is False and ready.reason.value == reason


def test_missing_current_row_ignores_older_retry_safe_attempt(sqlite_db):
    from studio_api.job_retry_recovery import compute_explicit_retry_readiness
    m, now, _user, _project, job, rels = _job_with_sources(sqlite_db, source_count=1, status="failed", attempt_count=2)
    job.lease_owner_id = None; job.lease_expires_at = None; sqlite_db.commit()
    _attempt(sqlite_db, m, job, rels[0], number=1, stage=m.SourceAttemptStage.failed, disposition=m.SourceAttemptRetryDisposition.retry_safe)
    ready = compute_explicit_retry_readiness(sqlite_db, job, now=now)
    assert ready.available is False and ready.reason.value == "legacy_or_unknown_execution_state"


def test_reconciliation_and_attempt_limit_override_prepared_sources(sqlite_db):
    from studio_api.job_retry_recovery import compute_explicit_retry_readiness
    m, now, _user, _project, job, rels = _job_with_sources(sqlite_db, source_count=2, status="failed")
    job.lease_owner_id = None; job.lease_expires_at = None; sqlite_db.commit()
    for rel in rels: _attempt(sqlite_db, m, job, rel)
    sqlite_db.add(m.TranscriptionOutputReconciliation(owner_user_id=job.owner_user_id, project_id=job.project_id, job_id=job.id, job_source_id=rels[0].id, reconciliation_token="tok", lease_generation=7, attempt_number=1, status=m.OutputReconciliationStatus.reconciliation_required, expected_output_drive_folder_id="folder", expected_document_character_count=1, prepared_at=now, created_at=now, updated_at=now))
    sqlite_db.commit()
    ready = compute_explicit_retry_readiness(sqlite_db, job, now=now)
    assert ready.available is False and ready.reason.value == "output_reconciliation_required"
    sqlite_db.query(m.TranscriptionOutputReconciliation).delete(); job.attempt_count = 3; sqlite_db.commit()
    ready = compute_explicit_retry_readiness(sqlite_db, job, now=now)
    assert ready.available is False and ready.reason.value == "attempt_limit_reached"


def test_all_outputs_recovery_completes_without_new_attempt_rows(sqlite_db):
    from studio_api.job_processing_lifecycle import recover_expired_processing_job
    m, now, _user, _project, job, rels = _job_with_sources(sqlite_db, source_count=2, expired=True)
    for idx, rel in enumerate(rels):
        sqlite_db.add(m.TranscriptionJobOutput(job_id=job.id, job_source_id=rel.id, document_id=f"doc-{idx}", web_view_url=f"https://docs.example/doc-{idx}", output_drive_folder_id="folder", output_kind="google_docs_transcript", transcript_standard="transcript_doc_v1.2", document_character_count=1, document_created_at=now, persisted_at=now, lease_generation=7))
    sqlite_db.commit()
    result = recover_expired_processing_job(sqlite_db, job_id=job.id, now=now)
    assert result.status == m.JobStatus.completed
    assert sqlite_db.query(m.TranscriptionJobSourceAttempt).count() == 0

from __future__ import annotations

import sys
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


@dataclass(frozen=True)
class Settings:
    source_max_upload_bytes: int = 1000
    source_s3_bucket: str = "bucket"


@pytest.fixture(autouse=True)
def isolated_studio_database_url(monkeypatch):
    monkeypatch.setenv("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")


@pytest.fixture()
def db():
    from studio_api.db import Base
    import studio_api.models  # noqa
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close(); Base.metadata.drop_all(engine); engine.dispose()


def make_job(db, m, *, sources=1, skipped=()):
    now = datetime(2026, 1, 2, 3, 4, 5)
    user = m.User(email=f"{id(db)}@example.com", role=m.UserRole.user, status=m.UserStatus.active)
    db.add(user); db.flush()
    project = m.Project(owner_user_id=user.id, title="p", output_drive_folder_id="folder-private")
    db.add(project); db.flush()
    job = m.TranscriptionJob(project_id=project.id, owner_user_id=user.id, status=m.JobStatus.processing, provider="elevenlabs", title="Job", language="en", lease_owner_id="worker", lease_generation=7, claimed_at=now, lease_expires_at=now + timedelta(minutes=5), started_at=now, error_code="old", error_message="old")
    db.add(job); db.flush()
    rels=[]
    for i in range(sources):
        src = m.Source(project_id=project.id, source_type=m.SourceType.local_upload, original_filename=f"a{i}.mp3", mime_type="audio/mpeg", size_bytes=5, s3_bucket="bucket", s3_object_key=f"private/{i}", upload_status=m.SourceUploadStatus.uploaded, uploaded_at=now, expires_at=now + timedelta(hours=1))
        db.add(src); db.flush()
        rel = m.TranscriptionJobSource(job_id=job.id, source_id=src.id, position=i, status=m.JobSourceStatus.skipped if i in skipped else m.JobSourceStatus.queued)
        db.add(rel); db.flush(); rels.append(rel)
    db.commit()
    return user, project, job, rels, now


def artifact(doc="doc-private", folder="folder-private", chars=42):
    from studio_api.google_docs_output import GoogleDocsCreateResult, new_google_docs_transcript_artifact
    return new_google_docs_transcript_artifact(result=GoogleDocsCreateResult(doc, "Secret Title", "application/vnd.google-apps.document", f"https://docs.example/{doc}", (folder,)), created_at=datetime(2026,1,2,3,4,6), character_count=chars)


def test_one_active_artifact_persists_safe_row_and_completes_one_source(db):
    from studio_api import models as m
    from studio_api.job_output_persistence import persist_processing_job_source_output_and_maybe_complete
    _, _, job, rels, now = make_job(db, m)
    a = artifact()
    result = persist_processing_job_source_output_and_maybe_complete(db, job_id=job.id, job_source_id=rels[0].id, lease_owner_id="worker", lease_generation=7, artifact=a, now=now)
    row = db.query(m.TranscriptionJobOutput).one()
    assert row.job_id == job.id and row.job_source_id == rels[0].id
    assert row.output_kind == "google_docs_transcript" and row.transcript_standard == "transcript_doc_v1.2" and row.document_character_count == 42
    persisted = "\n".join(str(getattr(row, c.name)) for c in row.__table__.columns)
    assert all(secret not in persisted for secret in ["Secret Title", "Привет", "token-secret", "body"])
    assert result.completed is True and job.status == m.JobStatus.completed and job.finished_at == now and job.error_code is None and job.error_message is None and job.lease_owner_id is None and job.lease_expires_at is None
    assert all(secret not in repr(result) for secret in ["doc-private", "https://docs.example", "folder-private"])


def test_same_artifact_idempotent_and_different_document_conflicts(db):
    from studio_api import models as m
    from studio_api.job_output_persistence import JobOutputPersistenceError, persist_processing_job_source_output_and_maybe_complete
    _, _, job, rels, now = make_job(db, m, sources=2)
    a = artifact()
    r1 = persist_processing_job_source_output_and_maybe_complete(db, job_id=job.id, job_source_id=rels[0].id, lease_owner_id="worker", lease_generation=7, artifact=a, now=now)
    r2 = persist_processing_job_source_output_and_maybe_complete(db, job_id=job.id, job_source_id=rels[0].id, lease_owner_id="worker", lease_generation=7, artifact=a, now=now)
    assert r1.output_id == r2.output_id and db.query(m.TranscriptionJobOutput).count() == 1 and job.status == m.JobStatus.processing and job.lease_owner_id == "worker"
    with pytest.raises(JobOutputPersistenceError, match="output_conflict"):
        persist_processing_job_source_output_and_maybe_complete(db, job_id=job.id, job_source_id=rels[0].id, lease_owner_id="worker", lease_generation=7, artifact=artifact("other-doc"), now=now)
    with pytest.raises(JobOutputPersistenceError, match="output_conflict"):
        persist_processing_job_source_output_and_maybe_complete(db, job_id=job.id, job_source_id=rels[1].id, lease_owner_id="worker", lease_generation=7, artifact=a, now=now)


def test_multi_source_completion_and_skipped_coverage(db):
    from studio_api import models as m
    from studio_api.job_output_persistence import persist_processing_job_source_output_and_maybe_complete
    _, _, job, rels, now = make_job(db, m, sources=3, skipped={2})
    r1 = persist_processing_job_source_output_and_maybe_complete(db, job_id=job.id, job_source_id=rels[0].id, lease_owner_id="worker", lease_generation=7, artifact=artifact("doc1"), now=now)
    assert not r1.completed and r1.persisted_output_count == 1 and r1.required_output_count == 2 and job.status == m.JobStatus.processing and job.lease_owner_id == "worker"
    r2 = persist_processing_job_source_output_and_maybe_complete(db, job_id=job.id, job_source_id=rels[1].id, lease_owner_id="worker", lease_generation=7, artifact=artifact("doc2"), now=now)
    assert r2.completed and job.status == m.JobStatus.completed
    assert [r.status for r in rels] == [m.JobSourceStatus.queued, m.JobSourceStatus.queued, m.JobSourceStatus.skipped]


@pytest.mark.parametrize("mutate,reason", [
    (lambda m,p,j,r,n: setattr(j,"lease_owner_id","other"), "lease_not_owned"),
    (lambda m,p,j,r,n: setattr(j,"lease_expires_at",n-timedelta(seconds=1)), "lease_not_active"),
    (lambda m,p,j,r,n: setattr(j,"cancel_requested_at",n), "cancellation_requested"),
    (lambda m,p,j,r,n: setattr(p,"archived_at",n), "project_unavailable"),
    (lambda m,p,j,r,n: setattr(p,"owner_user_id","other"), "project_unavailable"),
    (lambda m,p,j,r,n: setattr(p,"output_drive_folder_id","changed"), "output_folder_changed"),
    (lambda m,p,j,r,n: setattr(r[0],"status",m.JobSourceStatus.skipped), "job_source_not_processable"),
])
def test_invalid_boundaries_do_not_persist(db, mutate, reason):
    from studio_api import models as m
    from studio_api.job_output_persistence import JobOutputPersistenceError, persist_processing_job_source_output_and_maybe_complete
    _, project, job, rels, now = make_job(db, m)
    mutate(m, project, job, rels, now); db.flush()
    with pytest.raises(JobOutputPersistenceError, match=reason):
        persist_processing_job_source_output_and_maybe_complete(db, job_id=job.id, job_source_id=rels[0].id, lease_owner_id="worker", lease_generation=7, artifact=artifact(), now=now)
    assert db.query(m.TranscriptionJobOutput).count() == 0


def test_closed_artifact_and_transaction_rollback_no_mutation(db):
    from studio_api import models as m
    from studio_api.job_output_persistence import JobOutputPersistenceError, persist_processing_job_source_output_and_maybe_complete
    _, _, job, rels, now = make_job(db, m)
    a = artifact(); a.revoke()
    with pytest.raises(JobOutputPersistenceError, match="artifact_context_closed"):
        persist_processing_job_source_output_and_maybe_complete(db, job_id=job.id, job_source_id=rels[0].id, lease_owner_id="worker", lease_generation=7, artifact=a, now=now)
    assert db.query(m.TranscriptionJobOutput).count() == 0 and job.status == m.JobStatus.processing
    a = artifact("doc-rollback")
    persist_processing_job_source_output_and_maybe_complete(db, job_id=job.id, job_source_id=rels[0].id, lease_owner_id="worker", lease_generation=7, artifact=a, now=now)
    db.rollback()
    assert db.query(m.TranscriptionJobOutput).count() == 0 and db.get(m.TranscriptionJob, job.id).status == m.JobStatus.processing

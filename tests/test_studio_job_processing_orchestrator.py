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
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close(); Base.metadata.drop_all(engine); engine.dispose()


class Clock:
    def __init__(self): self.t = datetime(2026,1,2,3,4,5)
    def __call__(self): self.t += timedelta(seconds=1); return self.t


class Transcript:
    text_length = 6
    detected_language_code = "en"
    text = "SECRET_TRANSCRIPT"


class Artifact:
    document_id = "SECRET_DOC_ID"
    web_view_link = "https://docs.example/SECRET_DOC_ID"
    output_folder_id = "SECRET_FOLDER"
    character_count = 10
    created_at = datetime(2026,1,2,3,4,6)


class FakeCM:
    def __init__(self, value, events, enter_event, exit_event):
        self.value=value; self.events=events; self.enter_event=enter_event; self.exit_event=exit_event
    def __enter__(self): self.events.append(self.enter_event); return self.value
    def __exit__(self, *args): self.events.append(self.exit_event); return False


def make_job(db, m, *, status=None, sources=1, skipped=(), positions=None, lease_owner="worker", lease_generation=7, expired=False):
    now = datetime(2026,1,2,3,4,5)
    user = m.User(email=f"{id(db)}-{sources}@example.com", role=m.UserRole.user, status=m.UserStatus.active)
    db.add(user); db.flush()
    project = m.Project(owner_user_id=user.id, title="p", output_drive_folder_id="SECRET_FOLDER")
    db.add(project); db.flush()
    job = m.TranscriptionJob(project_id=project.id, owner_user_id=user.id, status=status or m.JobStatus.queued, provider="elevenlabs", title="Job", language="en", provider_credential_id="cred", lease_owner_id=lease_owner, lease_generation=lease_generation, claimed_at=now, lease_expires_at=now + (-timedelta(seconds=1) if expired else timedelta(minutes=30)), attempt_count=2 if status == m.JobStatus.processing else 0)
    db.add(job); db.flush()
    rels=[]
    for i in range(sources):
        src = m.Source(project_id=project.id, source_type=m.SourceType.local_upload, original_filename=f"s{i}.mp3", mime_type="audio/mpeg", size_bytes=1, s3_bucket="bucket", s3_object_key=f"SECRET_KEY_{i}", upload_status=m.SourceUploadStatus.uploaded, uploaded_at=now, expires_at=now+timedelta(hours=1))
        db.add(src); db.flush()
        rel = m.TranscriptionJobSource(job_id=job.id, source_id=src.id, position=(positions or list(range(sources)))[i], status=m.JobSourceStatus.skipped if i in skipped else m.JobSourceStatus.queued)
        db.add(rel); db.flush(); rels.append(rel)
    db.commit(); return job, rels


def persist_real(db, m, completed_on):
    calls=[]
    def _persist(db_, *, job_id, job_source_id, lease_owner_id, lease_generation, artifact, now):
        from studio_api.job_output_persistence import JobOutputPersistenceResult
        calls.append(job_source_id)
        db_.add(m.TranscriptionJobOutput(job_id=job_id, job_source_id=job_source_id, document_id=f"doc-{len(calls)}", web_view_url=f"url-{len(calls)}", output_drive_folder_id="SECRET_FOLDER", output_kind="google_docs_transcript", transcript_standard="transcript_doc_v1.2", document_character_count=1, document_created_at=now, persisted_at=now, lease_generation=lease_generation))
        job = db_.get(m.TranscriptionJob, job_id)
        completed = len(calls) >= completed_on
        if completed:
            from studio_api.job_claim_lease import invalidate_job_lease
            job.status=m.JobStatus.completed; job.finished_at=now; invalidate_job_lease(job)
        return JobOutputPersistenceResult(job_id, job_source_id, "SECRET_OUTPUT", job.status, len(calls), completed_on, completed, lease_generation)
    _persist.calls=calls
    return _persist


def fakes(events, *, transcribe_exc=None, google_exc=None):
    def transcriber(*args, **kwargs):
        events.append(("transcribe", kwargs["job_source_id"]))
        if transcribe_exc: raise transcribe_exc
        return FakeCM(Transcript(), events, "transcript_enter", "transcript_exit")
    def googler(*args, **kwargs):
        events.append(("google", kwargs["job_source_id"]))
        if google_exc: raise google_exc
        return FakeCM(Artifact(), events, "google_enter", "google_exit")
    return transcriber, googler


def test_queued_single_source_success_commits_before_external_and_completes(db):
    from studio_api import models as m
    from studio_api.job_processing_orchestrator import orchestrate_processing_job
    job, rels = make_job(db, m)
    events=[]; transcriber, googler = fakes(events); persister = persist_real(db, m, 1)
    r = orchestrate_processing_job(db, job_id=job.id, lease_owner_id="worker", lease_generation=7, settings=Settings(), clock=Clock(), transcription_opener=transcriber, google_docs_opener=googler, output_persister=persister)
    assert events[:2] == [("transcribe", rels[0].id), "transcript_enter"]
    assert r.final_job_status == m.JobStatus.completed and r.completion_occurred and r.processed_source_count == 1
    assert db.get(m.TranscriptionJob, job.id).lease_owner_id is None and db.get(m.TranscriptionJob, job.id).attempt_count == 1


def test_already_processing_does_not_increment_attempt(db):
    from studio_api import models as m
    from studio_api.job_processing_orchestrator import orchestrate_processing_job
    job, _ = make_job(db, m, status=m.JobStatus.processing)
    events=[]; t,g=fakes(events)
    r=orchestrate_processing_job(db, job_id=job.id, lease_owner_id="worker", lease_generation=7, settings=Settings(), clock=Clock(), transcription_opener=t, google_docs_opener=g, output_persister=persist_real(db,m,1))
    assert r.attempt_count == 2


def test_deterministic_order_existing_output_and_skipped_sources(db):
    from studio_api import models as m
    from studio_api.job_processing_orchestrator import orchestrate_processing_job
    job, rels = make_job(db, m, status=m.JobStatus.processing, sources=4, skipped={3}, positions=[2,1,1,0])
    first = sorted([rels[1], rels[2]], key=lambda r: (r.position, r.id))[0]
    db.add(m.TranscriptionJobOutput(job_id=job.id, job_source_id=first.id, document_id="existing", web_view_url="url", output_drive_folder_id="SECRET_FOLDER", output_kind="google_docs_transcript", transcript_standard="transcript_doc_v1.2", document_character_count=1, document_created_at=Clock()(), persisted_at=Clock()(), lease_generation=7)); db.commit()
    events=[]; t,g=fakes(events); p=persist_real(db,m,3)
    with pytest.raises(Exception, match="incomplete_output_coverage"):
        orchestrate_processing_job(db, job_id=job.id, lease_owner_id="worker", lease_generation=7, settings=Settings(), clock=Clock(), transcription_opener=t, google_docs_opener=g, output_persister=p)
    expected_missing=[r.id for r in sorted(rels[:3], key=lambda r:(r.position,r.id)) if r.id != first.id]
    assert [e[1] for e in events if isinstance(e, tuple) and e[0] == "transcribe"] == expected_missing
    assert [e[1] for e in events if isinstance(e, tuple) and e[0] == "google"] == expected_missing


def test_no_required_sources_fails_safely_without_external(db):
    from studio_api import models as m
    from studio_api.job_processing_orchestrator import JobProcessingOrchestrationError, orchestrate_processing_job
    job, _ = make_job(db, m, sources=1, skipped={0})
    events=[]; t,g=fakes(events)
    with pytest.raises(JobProcessingOrchestrationError, match="no_required_sources"):
        orchestrate_processing_job(db, job_id=job.id, lease_owner_id="worker", lease_generation=7, settings=Settings(), clock=Clock(), transcription_opener=t, google_docs_opener=g, output_persister=persist_real(db,m,1))
    j=db.get(m.TranscriptionJob, job.id)
    assert j.status == m.JobStatus.failed and events == [] and j.error_message == "no_required_sources"


def test_cancellation_before_first_source_acknowledges_no_external(db):
    from studio_api import models as m
    from studio_api.job_processing_orchestrator import orchestrate_processing_job
    job, _ = make_job(db, m, status=m.JobStatus.processing); job.cancel_requested_at=Clock()(); db.commit()
    events=[]; t,g=fakes(events)
    r=orchestrate_processing_job(db, job_id=job.id, lease_owner_id="worker", lease_generation=7, settings=Settings(), clock=Clock(), transcription_opener=t, google_docs_opener=g, output_persister=persist_real(db,m,1))
    assert r.final_job_status == m.JobStatus.cancelled and events == []


def test_cancellation_after_transcription_before_google_closes_transcript(db):
    from studio_api import models as m
    from studio_api.job_processing_orchestrator import orchestrate_processing_job
    job, _ = make_job(db, m, status=m.JobStatus.processing); events=[]
    def transcriber(*args, **kwargs):
        events.append("transcribe"); db.get(m.TranscriptionJob, job.id).cancel_requested_at=Clock()(); db.commit(); return FakeCM(Transcript(), events, "transcript_enter", "transcript_exit")
    _, g = fakes(events)
    r=orchestrate_processing_job(db, job_id=job.id, lease_owner_id="worker", lease_generation=7, settings=Settings(), clock=Clock(), transcription_opener=transcriber, google_docs_opener=g, output_persister=persist_real(db,m,1))
    assert r.final_job_status == m.JobStatus.cancelled and "transcript_exit" in events and not any(isinstance(e, tuple) and e[0] == "google" for e in events)


@pytest.mark.parametrize("boundary", ["transcription", "google_definite"])
def test_pre_output_failures_are_normalized_safe_and_no_retry(db, boundary):
    from studio_api import models as m
    from studio_api.job_elevenlabs_transcription import JobElevenLabsTranscriptionError, JobElevenLabsTranscriptionReason
    from studio_api.job_google_docs_output import JobGoogleDocsOutputError, JobGoogleDocsOutputReason
    from studio_api.job_processing_orchestrator import JobProcessingOrchestrationError, orchestrate_processing_job
    job, _ = make_job(db, m, status=m.JobStatus.processing); events=[]
    exc = JobElevenLabsTranscriptionError(JobElevenLabsTranscriptionReason.provider_timeout) if boundary == "transcription" else None
    gexc = JobGoogleDocsOutputError(JobGoogleDocsOutputReason.google_docs_request_rejected) if boundary == "google_definite" else None
    t,g=fakes(events, transcribe_exc=exc, google_exc=gexc)
    with pytest.raises(JobProcessingOrchestrationError, match="transcription_failed|google_docs_failed"):
        orchestrate_processing_job(db, job_id=job.id, lease_owner_id="worker", lease_generation=7, settings=Settings(), clock=Clock(), transcription_opener=t, google_docs_opener=g, output_persister=persist_real(db,m,1))
    j=db.get(m.TranscriptionJob, job.id)
    assert j.status == m.JobStatus.failed and "SECRET" not in (j.error_message or "")
    assert len([e for e in events if isinstance(e, tuple) and e[0] == "transcribe"]) == 1


@pytest.mark.parametrize("mode", ["uncertain_google", "persistence", "commit"])
def test_output_uncertainty_no_retry_and_redacted(db, mode, monkeypatch):
    from studio_api import models as m
    from studio_api.job_google_docs_output import JobGoogleDocsOutputError, JobGoogleDocsOutputReason
    from studio_api.job_processing_orchestrator import JobProcessingOrchestrationError, orchestrate_processing_job
    job, _ = make_job(db, m, status=m.JobStatus.processing); events=[]
    gexc = JobGoogleDocsOutputError(JobGoogleDocsOutputReason.google_docs_timeout) if mode == "uncertain_google" else None
    t,g=fakes(events, google_exc=gexc)
    def bad_persist(*args, **kwargs): raise RuntimeError("SECRET_DOC_ID raw payload")
    p = bad_persist if mode == "persistence" else persist_real(db,m,1)
    if mode == "commit":
        original = db.commit; calls={"n":0}
        def flaky():
            calls["n"] += 1
            if calls["n"] == 1: raise RuntimeError("SECRET_DOC_ID commit")
            return original()
        monkeypatch.setattr(db, "commit", flaky)
    with pytest.raises(JobProcessingOrchestrationError) as excinfo:
        orchestrate_processing_job(db, job_id=job.id, lease_owner_id="worker", lease_generation=7, settings=Settings(), clock=Clock(), transcription_opener=t, google_docs_opener=g, output_persister=p)
    assert excinfo.value.reason.value == "output_reconciliation_required"
    assert "SECRET_DOC_ID" not in str(excinfo.value) + repr(excinfo.value)
    assert len([e for e in events if isinstance(e, tuple) and e[0] == "transcribe"]) == 1
    assert len([e for e in events if isinstance(e, tuple) and e[0] == "google"]) == 1


def test_output_already_persisted_race_treats_existing_as_authoritative(db):
    from studio_api import models as m
    from studio_api.job_google_docs_output import JobGoogleDocsOutputError, JobGoogleDocsOutputReason
    from studio_api.job_processing_orchestrator import orchestrate_processing_job
    job, rels = make_job(db, m, status=m.JobStatus.processing); events=[]
    def googler(*args, **kwargs):
        db.add(m.TranscriptionJobOutput(job_id=job.id, job_source_id=rels[0].id, document_id="existing", web_view_url="url", output_drive_folder_id="SECRET_FOLDER", output_kind="google_docs_transcript", transcript_standard="transcript_doc_v1.2", document_character_count=1, document_created_at=Clock()(), persisted_at=Clock()(), lease_generation=7)); db.commit()
        raise JobGoogleDocsOutputError(JobGoogleDocsOutputReason.output_already_persisted)
    t,_=fakes(events)
    with pytest.raises(Exception, match="incomplete_output_coverage"):
        orchestrate_processing_job(db, job_id=job.id, lease_owner_id="worker", lease_generation=7, settings=Settings(), clock=Clock(), transcription_opener=t, google_docs_opener=googler, output_persister=persist_real(db,m,1))
    assert db.query(m.TranscriptionJobOutput).count() == 1
    assert len([e for e in events if isinstance(e, tuple) and e[0] == "google"]) == 0


@pytest.mark.parametrize("kw", [{"lease_owner":"other"},{"lease_generation":8},{"expired":True}])
def test_stale_lease_fails_closed_no_external(db, kw):
    from studio_api import models as m
    from studio_api.job_processing_orchestrator import JobProcessingOrchestrationError, orchestrate_processing_job
    job, _ = make_job(db, m, status=m.JobStatus.processing, **kw); events=[]; t,g=fakes(events)
    with pytest.raises(JobProcessingOrchestrationError):
        orchestrate_processing_job(db, job_id=job.id, lease_owner_id="worker", lease_generation=7, settings=Settings(), clock=Clock(), transcription_opener=t, google_docs_opener=g, output_persister=persist_real(db,m,1))
    assert events == []


def test_result_and_error_repr_redaction():
    from studio_api.job_processing_orchestrator import JobProcessingOrchestrationError, JobProcessingOrchestrationReason, JobProcessingOrchestrationResult
    from studio_api.models import JobStatus
    r=JobProcessingOrchestrationResult("job", JobStatus.completed, 1, 1, 1, 1, True)
    e=JobProcessingOrchestrationError(JobProcessingOrchestrationReason.output_reconciliation_required)
    leaked="SECRET_TRANSCRIPT SECRET_DOC_ID SECRET_FOLDER token credential SECRET_KEY raw payload"
    assert all(part not in repr(r)+repr(e)+str(e) for part in leaked.split())

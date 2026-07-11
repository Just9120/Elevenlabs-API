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
    from studio_api.config import get_settings
    get_settings.cache_clear()


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




def recording_renewer(events, *, fail=None):
    calls = []

    def _renew(db_, *, job_id, lease_owner_id, lease_generation, now, lease_ttl):
        calls.append(
            {
                "job_id": job_id,
                "lease_owner_id": lease_owner_id,
                "lease_generation": lease_generation,
                "now": now,
                "lease_ttl": lease_ttl,
            }
        )
        events.append(("renew", job_id, lease_owner_id, lease_generation, now, lease_ttl))
        if fail is not None:
            raise fail

    _renew.calls = calls
    return _renew


def record_commits(db, events, monkeypatch, *, fail_when=None):
    original_commit = db.commit
    original_rollback = db.rollback
    rollbacks = []

    def commit():
        if fail_when is not None and fail_when():
            raise RuntimeError("SECRET commit failed")
        events.append("commit")
        return original_commit()

    def rollback():
        rollbacks.append("rollback")
        events.append("rollback")
        return original_rollback()

    monkeypatch.setattr(db, "commit", commit)
    monkeypatch.setattr(db, "rollback", rollback)
    return rollbacks


def test_first_source_renewal_commits_before_transcription_with_exact_context(db, monkeypatch):
    from studio_api import models as m
    from studio_api.job_processing_orchestrator import orchestrate_processing_job

    job, rels = make_job(db, m, status=m.JobStatus.processing)
    events = []
    rollbacks = record_commits(db, events, monkeypatch)
    lease_ttl = timedelta(minutes=11)
    renewer = recording_renewer(events)

    def transcriber(*args, **kwargs):
        events.append(("transcribe", kwargs["job_source_id"]))
        return FakeCM(Transcript(), events, "transcript_enter", "transcript_exit")

    _, googler = fakes(events)
    orchestrate_processing_job(
        db,
        job_id=job.id,
        lease_owner_id="worker",
        lease_generation=7,
        settings=Settings(),
        clock=Clock(),
        lease_ttl=lease_ttl,
        lease_renewer=renewer,
        transcription_opener=transcriber,
        google_docs_opener=googler,
        output_persister=persist_real(db, m, 1),
    )

    assert renewer.calls[0] == {
        "job_id": job.id,
        "lease_owner_id": "worker",
        "lease_generation": 7,
        "now": datetime(2026, 1, 2, 3, 4, 8),
        "lease_ttl": lease_ttl,
    }
    assert events.index("commit") < events.index(("transcribe", rels[0].id))


def test_post_provider_renewal_commits_before_google(db, monkeypatch):
    from studio_api import models as m
    from studio_api.job_processing_orchestrator import orchestrate_processing_job

    job, rels = make_job(db, m, status=m.JobStatus.processing)
    events = []
    record_commits(db, events, monkeypatch)
    renewer = recording_renewer(events)

    def transcriber(*args, **kwargs):
        events.append(("transcribe", kwargs["job_source_id"]))
        return FakeCM(Transcript(), events, "transcript_enter", "transcript_exit")

    def googler(*args, **kwargs):
        events.append(("google", kwargs["job_source_id"]))
        return FakeCM(Artifact(), events, "google_enter", "google_exit")

    orchestrate_processing_job(
        db,
        job_id=job.id,
        lease_owner_id="worker",
        lease_generation=7,
        settings=Settings(),
        clock=Clock(),
        lease_ttl=timedelta(minutes=5),
        lease_renewer=renewer,
        transcription_opener=transcriber,
        google_docs_opener=googler,
        output_persister=persist_real(db, m, 1),
    )

    first_google = events.index(("google", rels[0].id))
    second_renew = [i for i, event in enumerate(events) if isinstance(event, tuple) and event[0] == "renew"][1]
    commits_after_second_renew = [i for i, event in enumerate(events) if event == "commit" and i > second_renew]
    assert events.index("transcript_enter") < second_renew
    assert commits_after_second_renew[0] < first_google


def test_multi_source_next_renewal_after_first_output_commit_before_second_transcription(db, monkeypatch):
    from studio_api import models as m
    from studio_api.job_processing_orchestrator import orchestrate_processing_job

    job, rels = make_job(db, m, status=m.JobStatus.processing, sources=2)
    events = []
    record_commits(db, events, monkeypatch)
    renewer = recording_renewer(events)
    real_persist = persist_real(db, m, 2)

    def persister(*args, **kwargs):
        events.append(("persist", kwargs["job_source_id"]))
        return real_persist(*args, **kwargs)

    t, g = fakes(events)
    orchestrate_processing_job(
        db,
        job_id=job.id,
        lease_owner_id="worker",
        lease_generation=7,
        settings=Settings(),
        clock=Clock(),
        lease_ttl=timedelta(minutes=5),
        lease_renewer=renewer,
        transcription_opener=t,
        google_docs_opener=g,
        output_persister=persister,
    )

    first_persist = events.index(("persist", rels[0].id))
    first_output_commit = next(i for i, event in enumerate(events) if event == "commit" and i > first_persist)
    second_renew = next(i for i, event in enumerate(events) if isinstance(event, tuple) and event[0] == "renew" and i > first_output_commit)
    second_renew_commit = next(i for i, event in enumerate(events) if event == "commit" and i > second_renew)
    second_transcribe = events.index(("transcribe", rels[1].id))
    assert first_output_commit < second_renew < second_renew_commit < second_transcribe


def test_existing_output_relation_skips_without_renewal_or_external_work(db, monkeypatch):
    from studio_api import models as m
    from studio_api.job_processing_orchestrator import orchestrate_processing_job

    job, rels = make_job(db, m, status=m.JobStatus.processing, sources=2)
    db.add(m.TranscriptionJobOutput(job_id=job.id, job_source_id=rels[0].id, document_id="existing", web_view_url="url", output_drive_folder_id="SECRET_FOLDER", output_kind="google_docs_transcript", transcript_standard="transcript_doc_v1.2", document_character_count=1, document_created_at=Clock()(), persisted_at=Clock()(), lease_generation=7)); db.commit()
    events = []
    record_commits(db, events, monkeypatch)
    renewer = recording_renewer(events)
    t, g = fakes(events)

    orchestrate_processing_job(
        db,
        job_id=job.id,
        lease_owner_id="worker",
        lease_generation=7,
        settings=Settings(),
        clock=Clock(),
        lease_ttl=timedelta(minutes=5),
        lease_renewer=renewer,
        transcription_opener=t,
        google_docs_opener=g,
        output_persister=persist_real(db, m, 1),
    )

    assert len(renewer.calls) == 2
    assert [(e[0], e[1]) for e in events if isinstance(e, tuple) and e[0] in {"transcribe", "google"}] == [("transcribe", rels[1].id), ("google", rels[1].id)]


@pytest.mark.parametrize(
    "lease_reason,expected_reason",
    [
        ("job_not_found", "job_not_found"),
        ("lease_not_owned", "lease_not_owned"),
        ("lease_not_active", "lease_not_active"),
        ("job_not_queued", "job_not_processable"),
    ],
)
def test_renewal_job_lease_errors_map_and_stop_before_external_work(db, monkeypatch, lease_reason, expected_reason):
    from studio_api import models as m
    from studio_api.job_claim_lease import JobLeaseError, JobLeaseFailureReason
    from studio_api.job_processing_orchestrator import JobProcessingOrchestrationError, orchestrate_processing_job

    job, _ = make_job(db, m, status=m.JobStatus.processing)
    events = []
    record_commits(db, events, monkeypatch)
    renewer = recording_renewer(events, fail=JobLeaseError(JobLeaseFailureReason(lease_reason)))
    t, g = fakes(events)

    with pytest.raises(JobProcessingOrchestrationError) as excinfo:
        orchestrate_processing_job(
            db,
            job_id=job.id,
            lease_owner_id="worker",
            lease_generation=7,
            settings=Settings(),
            clock=Clock(),
            lease_ttl=timedelta(minutes=5),
            lease_renewer=renewer,
            transcription_opener=t,
            google_docs_opener=g,
            output_persister=persist_real(db, m, 1),
        )

    assert excinfo.value.reason.value == expected_reason
    assert renewer.calls and len(renewer.calls) == 1
    assert not any(isinstance(e, tuple) and e[0] in {"transcribe", "google"} for e in events)


def test_unexpected_renewal_failure_rolls_back_redacts_and_does_not_retry_or_continue(db, monkeypatch):
    from studio_api import models as m
    from studio_api.job_processing_orchestrator import JobProcessingOrchestrationError, orchestrate_processing_job

    job, _ = make_job(db, m, status=m.JobStatus.processing)
    events = []
    rollbacks = record_commits(db, events, monkeypatch)
    renewer = recording_renewer(events, fail=RuntimeError("SECRET renewal token raw payload"))
    t, g = fakes(events)

    with pytest.raises(JobProcessingOrchestrationError) as excinfo:
        orchestrate_processing_job(
            db,
            job_id=job.id,
            lease_owner_id="worker",
            lease_generation=7,
            settings=Settings(),
            clock=Clock(),
            lease_ttl=timedelta(minutes=5),
            lease_renewer=renewer,
            transcription_opener=t,
            google_docs_opener=g,
            output_persister=persist_real(db, m, 1),
        )

    assert excinfo.value.reason.value == "lease_renewal_failed"
    assert "SECRET" not in str(excinfo.value) + repr(excinfo.value)
    assert rollbacks
    assert len(renewer.calls) == 1
    assert not any(isinstance(e, tuple) and e[0] in {"transcribe", "google"} for e in events)


def test_renewal_commit_failure_rolls_back_and_stops_before_next_external_stage(db, monkeypatch):
    from studio_api import models as m
    from studio_api.job_processing_orchestrator import JobProcessingOrchestrationError, orchestrate_processing_job

    job, _ = make_job(db, m, status=m.JobStatus.processing)
    events = []
    fail_next_commit = {"value": False}
    rollbacks = record_commits(db, events, monkeypatch, fail_when=lambda: fail_next_commit["value"])

    def renewer(*args, **kwargs):
        events.append(("renew", kwargs["job_id"]))
        fail_next_commit["value"] = True

    t, g = fakes(events)
    with pytest.raises(JobProcessingOrchestrationError) as excinfo:
        orchestrate_processing_job(
            db,
            job_id=job.id,
            lease_owner_id="worker",
            lease_generation=7,
            settings=Settings(),
            clock=Clock(),
            lease_ttl=timedelta(minutes=5),
            lease_renewer=renewer,
            transcription_opener=t,
            google_docs_opener=g,
            output_persister=persist_real(db, m, 1),
        )

    assert excinfo.value.reason.value == "commit_failed"
    assert rollbacks
    assert events.count(("renew", job.id)) == 1
    assert not any(isinstance(e, tuple) and e[0] in {"transcribe", "google"} for e in events)


def test_completion_has_no_renewal_after_final_output(db, monkeypatch):
    from studio_api import models as m
    from studio_api.job_processing_orchestrator import orchestrate_processing_job

    job, _ = make_job(db, m, status=m.JobStatus.processing)
    events = []
    record_commits(db, events, monkeypatch)
    renewer = recording_renewer(events)
    t, g = fakes(events)

    result = orchestrate_processing_job(
        db,
        job_id=job.id,
        lease_owner_id="worker",
        lease_generation=7,
        settings=Settings(),
        clock=Clock(),
        lease_ttl=timedelta(minutes=5),
        lease_renewer=renewer,
        transcription_opener=t,
        google_docs_opener=g,
        output_persister=persist_real(db, m, 1),
    )

    assert result.completion_occurred
    final_output_commit = max(i for i, event in enumerate(events) if event == "commit")
    assert not any(isinstance(event, tuple) and event[0] == "renew" for event in events[final_output_commit + 1:])
    assert len(renewer.calls) == 2


def test_two_missing_sources_receive_exact_four_renewals_without_duplicate_boundary(db, monkeypatch):
    from studio_api import models as m
    from studio_api.job_processing_orchestrator import orchestrate_processing_job

    job, _ = make_job(db, m, status=m.JobStatus.processing, sources=2)
    events = []
    record_commits(db, events, monkeypatch)
    renewer = recording_renewer(events)
    t, g = fakes(events)

    orchestrate_processing_job(
        db,
        job_id=job.id,
        lease_owner_id="worker",
        lease_generation=7,
        settings=Settings(),
        clock=Clock(),
        lease_ttl=timedelta(minutes=5),
        lease_renewer=renewer,
        transcription_opener=t,
        google_docs_opener=g,
        output_persister=persist_real(db, m, 2),
    )

    assert [event[0] for event in events if isinstance(event, tuple) and event[0] == "renew"] == ["renew", "renew", "renew", "renew"]
    assert len(renewer.calls) == 4


def test_queued_single_source_success_commits_before_external_and_completes(db):
    from studio_api import models as m
    from studio_api.job_processing_orchestrator import orchestrate_processing_job
    job, rels = make_job(db, m)
    events=[]; transcriber, googler = fakes(events); persister = persist_real(db, m, 1)
    r = orchestrate_processing_job(db, job_id=job.id, lease_owner_id="worker", lease_generation=7, settings=Settings(), clock=Clock(), lease_ttl=timedelta(minutes=5), transcription_opener=transcriber, google_docs_opener=googler, output_persister=persister)
    assert events[:2] == [("transcribe", rels[0].id), "transcript_enter"]
    assert r.final_job_status == m.JobStatus.completed and r.completion_occurred and r.processed_source_count == 1
    assert db.get(m.TranscriptionJob, job.id).lease_owner_id is None and db.get(m.TranscriptionJob, job.id).attempt_count == 1


def test_already_processing_does_not_increment_attempt(db):
    from studio_api import models as m
    from studio_api.job_processing_orchestrator import orchestrate_processing_job
    job, _ = make_job(db, m, status=m.JobStatus.processing)
    events=[]; t,g=fakes(events)
    r=orchestrate_processing_job(db, job_id=job.id, lease_owner_id="worker", lease_generation=7, settings=Settings(), clock=Clock(), lease_ttl=timedelta(minutes=5), transcription_opener=t, google_docs_opener=g, output_persister=persist_real(db,m,1))
    assert r.attempt_count == 2


def test_deterministic_order_existing_output_and_skipped_sources(db):
    from studio_api import models as m
    from studio_api.job_processing_orchestrator import orchestrate_processing_job
    job, rels = make_job(db, m, status=m.JobStatus.processing, sources=4, skipped={3}, positions=[2,1,1,0])
    first = sorted([rels[1], rels[2]], key=lambda r: (r.position, r.id))[0]
    db.add(m.TranscriptionJobOutput(job_id=job.id, job_source_id=first.id, document_id="existing", web_view_url="url", output_drive_folder_id="SECRET_FOLDER", output_kind="google_docs_transcript", transcript_standard="transcript_doc_v1.2", document_character_count=1, document_created_at=Clock()(), persisted_at=Clock()(), lease_generation=7)); db.commit()
    events=[]; t,g=fakes(events); p=persist_real(db,m,3)
    with pytest.raises(Exception, match="incomplete_output_coverage"):
        orchestrate_processing_job(db, job_id=job.id, lease_owner_id="worker", lease_generation=7, settings=Settings(), clock=Clock(), lease_ttl=timedelta(minutes=5), transcription_opener=t, google_docs_opener=g, output_persister=p)
    expected_missing=[r.id for r in sorted(rels[:3], key=lambda r:(r.position,r.id)) if r.id != first.id]
    assert [e[1] for e in events if isinstance(e, tuple) and e[0] == "transcribe"] == expected_missing
    assert [e[1] for e in events if isinstance(e, tuple) and e[0] == "google"] == expected_missing


def test_no_required_sources_fails_safely_without_external(db):
    from studio_api import models as m
    from studio_api.job_processing_orchestrator import JobProcessingOrchestrationError, orchestrate_processing_job
    job, _ = make_job(db, m, sources=1, skipped={0})
    events=[]; t,g=fakes(events)
    with pytest.raises(JobProcessingOrchestrationError, match="no_required_sources"):
        orchestrate_processing_job(db, job_id=job.id, lease_owner_id="worker", lease_generation=7, settings=Settings(), clock=Clock(), lease_ttl=timedelta(minutes=5), transcription_opener=t, google_docs_opener=g, output_persister=persist_real(db,m,1))
    j=db.get(m.TranscriptionJob, job.id)
    assert j.status == m.JobStatus.failed and events == [] and j.error_message == "no_required_sources"


def test_cancellation_before_first_source_acknowledges_no_external(db):
    from studio_api import models as m
    from studio_api.job_processing_orchestrator import orchestrate_processing_job
    job, _ = make_job(db, m, status=m.JobStatus.processing); job.cancel_requested_at=Clock()(); db.commit()
    events=[]; t,g=fakes(events)
    r=orchestrate_processing_job(db, job_id=job.id, lease_owner_id="worker", lease_generation=7, settings=Settings(), clock=Clock(), lease_ttl=timedelta(minutes=5), transcription_opener=t, google_docs_opener=g, output_persister=persist_real(db,m,1))
    assert r.final_job_status == m.JobStatus.cancelled and events == []


def test_cancellation_after_transcription_before_google_closes_transcript(db):
    from studio_api import models as m
    from studio_api.job_processing_orchestrator import orchestrate_processing_job
    job, _ = make_job(db, m, status=m.JobStatus.processing); events=[]
    def transcriber(*args, **kwargs):
        events.append("transcribe"); db.get(m.TranscriptionJob, job.id).cancel_requested_at=Clock()(); db.commit(); return FakeCM(Transcript(), events, "transcript_enter", "transcript_exit")
    _, g = fakes(events)
    r=orchestrate_processing_job(db, job_id=job.id, lease_owner_id="worker", lease_generation=7, settings=Settings(), clock=Clock(), lease_ttl=timedelta(minutes=5), transcription_opener=transcriber, google_docs_opener=g, output_persister=persist_real(db,m,1))
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
        orchestrate_processing_job(db, job_id=job.id, lease_owner_id="worker", lease_generation=7, settings=Settings(), clock=Clock(), lease_ttl=timedelta(minutes=5), transcription_opener=t, google_docs_opener=g, output_persister=persist_real(db,m,1))
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
        original = db.commit
        fail_output_commit = {"value": False}
        def flaky():
            if fail_output_commit["value"]:
                raise RuntimeError("SECRET_DOC_ID commit")
            return original()
        monkeypatch.setattr(db, "commit", flaky)
        real_p = p
        def fail_at_output_commit(*args, **kwargs):
            result = real_p(*args, **kwargs)
            fail_output_commit["value"] = True
            return result
        p = fail_at_output_commit
    with pytest.raises(JobProcessingOrchestrationError) as excinfo:
        orchestrate_processing_job(db, job_id=job.id, lease_owner_id="worker", lease_generation=7, settings=Settings(), clock=Clock(), lease_ttl=timedelta(minutes=5), transcription_opener=t, google_docs_opener=g, output_persister=p)
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
        orchestrate_processing_job(db, job_id=job.id, lease_owner_id="worker", lease_generation=7, settings=Settings(), clock=Clock(), lease_ttl=timedelta(minutes=5), transcription_opener=t, google_docs_opener=googler, output_persister=persist_real(db,m,1))
    assert db.query(m.TranscriptionJobOutput).count() == 1
    assert len([e for e in events if isinstance(e, tuple) and e[0] == "google"]) == 0


@pytest.mark.parametrize("kw", [{"lease_owner":"other"},{"lease_generation":8},{"expired":True}])
def test_stale_lease_fails_closed_no_external(db, kw):
    from studio_api import models as m
    from studio_api.job_processing_orchestrator import JobProcessingOrchestrationError, orchestrate_processing_job
    job, _ = make_job(db, m, status=m.JobStatus.processing, **kw); events=[]; t,g=fakes(events)
    with pytest.raises(JobProcessingOrchestrationError):
        orchestrate_processing_job(db, job_id=job.id, lease_owner_id="worker", lease_generation=7, settings=Settings(), clock=Clock(), lease_ttl=timedelta(minutes=5), transcription_opener=t, google_docs_opener=g, output_persister=persist_real(db,m,1))
    assert events == []


def test_result_and_error_repr_redaction():
    from studio_api.job_processing_orchestrator import JobProcessingOrchestrationError, JobProcessingOrchestrationReason, JobProcessingOrchestrationResult
    from studio_api.models import JobStatus
    r=JobProcessingOrchestrationResult("job", JobStatus.completed, 1, 1, 1, 1, True)
    e=JobProcessingOrchestrationError(JobProcessingOrchestrationReason.output_reconciliation_required)
    leaked="SECRET_TRANSCRIPT SECRET_DOC_ID SECRET_FOLDER token credential SECRET_KEY raw payload"
    assert all(part not in repr(r)+repr(e)+str(e) for part in leaked.split())


@pytest.mark.parametrize(
    "mutate,reason",
    [
        (lambda m, job, now: setattr(job, "cancel_requested_at", now), "output_reconciliation_required"),
        (lambda m, job, now: setattr(job, "lease_owner_id", "other"), "output_reconciliation_required"),
        (lambda m, job, now: setattr(job, "lease_generation", 99), "output_reconciliation_required"),
        (lambda m, job, now: setattr(job, "lease_expires_at", now - timedelta(seconds=1)), "output_reconciliation_required"),
    ],
)
def test_post_output_state_change_prevents_persistence_and_normalizes(db, mutate, reason):
    from studio_api import models as m
    from studio_api.job_processing_orchestrator import JobProcessingOrchestrationError, orchestrate_processing_job

    job, _ = make_job(db, m, status=m.JobStatus.processing)
    events = []
    t, _ = fakes(events)
    persist_calls = []

    def googler(*args, **kwargs):
        events.append(("google", kwargs["job_source_id"]))

        class MutatingGoogleCM(FakeCM):
            def __enter__(self):
                value = super().__enter__()
                mutate(m, db.get(m.TranscriptionJob, job.id), Clock()())
                db.commit()
                return value

        return MutatingGoogleCM(Artifact(), events, "google_enter", "google_exit")

    def persister(*args, **kwargs):
        persist_calls.append(kwargs)
        raise AssertionError("persister should not be called after unsafe post-output state")

    with pytest.raises(JobProcessingOrchestrationError) as excinfo:
        orchestrate_processing_job(
            db,
            job_id=job.id,
            lease_owner_id="worker",
            lease_generation=7,
            settings=Settings(),
            clock=Clock(),
            lease_ttl=timedelta(minutes=5),
            transcription_opener=t,
            google_docs_opener=googler,
            output_persister=persister,
        )

    assert excinfo.value.reason.value == reason
    assert persist_calls == []
    assert len([e for e in events if isinstance(e, tuple) and e[0] == "transcribe"]) == 1
    assert len([e for e in events if isinstance(e, tuple) and e[0] == "google"]) == 1
    leaked = "SECRET_DOC_ID SECRET_FOLDER SECRET_TRANSCRIPT token credential raw payload"
    assert all(part not in repr(excinfo.value) + str(excinfo.value) for part in leaked.split())


@pytest.mark.parametrize("boundary", ["transcription", "google_definite"])
def test_safe_failure_commit_failure_surfaces_commit_failed(db, monkeypatch, boundary):
    from studio_api import models as m
    from studio_api.job_elevenlabs_transcription import JobElevenLabsTranscriptionError, JobElevenLabsTranscriptionReason
    from studio_api.job_google_docs_output import JobGoogleDocsOutputError, JobGoogleDocsOutputReason
    from studio_api.job_processing_orchestrator import JobProcessingOrchestrationError, orchestrate_processing_job

    job, _ = make_job(db, m, status=m.JobStatus.processing)
    events = []
    fail_safe_commit = {"value": False}

    def t(*args, **kwargs):
        events.append(("transcribe", kwargs["job_source_id"]))
        if boundary == "transcription":
            fail_safe_commit["value"] = True
            raise JobElevenLabsTranscriptionError(JobElevenLabsTranscriptionReason.provider_timeout)
        return FakeCM(Transcript(), events, "transcript_enter", "transcript_exit")

    def g(*args, **kwargs):
        events.append(("google", kwargs["job_source_id"]))
        fail_safe_commit["value"] = True
        raise JobGoogleDocsOutputError(JobGoogleDocsOutputReason.google_docs_request_rejected)

    original_commit = db.commit
    original_rollback = db.rollback
    rollbacks = []

    def fail_commit():
        if fail_safe_commit["value"]:
            raise RuntimeError("SECRET commit failed")
        return original_commit()

    def count_rollback():
        rollbacks.append("rollback")
        return original_rollback()

    monkeypatch.setattr(db, "commit", fail_commit)
    monkeypatch.setattr(db, "rollback", count_rollback)

    with pytest.raises(JobProcessingOrchestrationError) as excinfo:
        orchestrate_processing_job(
            db,
            job_id=job.id,
            lease_owner_id="worker",
            lease_generation=7,
            settings=Settings(),
            clock=Clock(),
            lease_ttl=timedelta(minutes=5),
            transcription_opener=t,
            google_docs_opener=g,
            output_persister=persist_real(db, m, 1),
        )

    assert excinfo.value.reason.value == "commit_failed"
    assert rollbacks
    assert len([e for e in events if isinstance(e, tuple) and e[0] == "transcribe"]) == 1
    if boundary == "transcription":
        assert not any(isinstance(e, tuple) and e[0] == "google" for e in events)
    else:
        assert len([e for e in events if isinstance(e, tuple) and e[0] == "google"]) == 1
    assert "provider_timeout" not in str(excinfo.value)
    assert "google_docs_request_rejected" not in str(excinfo.value)
    monkeypatch.setattr(db, "commit", original_commit)


class FailingEnterCM:
    def __init__(self, events, name):
        self.events = events
        self.name = name
    def __enter__(self):
        self.events.append(f"{self.name}_enter")
        raise RuntimeError("SECRET raw payload token credential document folder transcript")
    def __exit__(self, *args):
        self.events.append(f"{self.name}_exit")
        return False


@pytest.mark.parametrize("boundary", ["transcription", "google"])
def test_unexpected_context_entry_errors_are_normalized_and_do_not_exit_unentered(db, boundary):
    from studio_api import models as m
    from studio_api.job_processing_orchestrator import JobProcessingOrchestrationError, orchestrate_processing_job

    job, _ = make_job(db, m, status=m.JobStatus.processing)
    events = []

    def transcriber(*args, **kwargs):
        events.append(("transcribe", kwargs["job_source_id"]))
        if boundary == "transcription":
            return FailingEnterCM(events, "transcript")
        return FakeCM(Transcript(), events, "transcript_enter", "transcript_exit")

    def googler(*args, **kwargs):
        events.append(("google", kwargs["job_source_id"]))
        return FailingEnterCM(events, "google")

    with pytest.raises(JobProcessingOrchestrationError) as excinfo:
        orchestrate_processing_job(
            db,
            job_id=job.id,
            lease_owner_id="worker",
            lease_generation=7,
            settings=Settings(),
            clock=Clock(),
            lease_ttl=timedelta(minutes=5),
            transcription_opener=transcriber,
            google_docs_opener=googler,
            output_persister=persist_real(db, m, 1),
        )

    if boundary == "transcription":
        assert excinfo.value.reason.value == "transcription_failed"
        assert not any(isinstance(e, tuple) and e[0] == "google" for e in events)
        assert "transcript_exit" not in events
    else:
        assert excinfo.value.reason.value == "output_reconciliation_required"
        assert len([e for e in events if isinstance(e, tuple) and e[0] == "google"]) == 1
        assert "google_exit" not in events
        assert "transcript_exit" in events
    assert len([e for e in events if isinstance(e, tuple) and e[0] == "transcribe"]) == 1
    leaked = "SECRET raw payload token credential document folder"
    assert all(part not in repr(excinfo.value) + str(excinfo.value) for part in leaked.split())


def test_processed_count_preserved_when_later_transcription_failure_observes_cancellation(db):
    from studio_api import models as m
    from studio_api.job_elevenlabs_transcription import JobElevenLabsTranscriptionError, JobElevenLabsTranscriptionReason
    from studio_api.job_processing_orchestrator import orchestrate_processing_job

    job, rels = make_job(db, m, status=m.JobStatus.processing, sources=2)
    events = []
    persister = persist_real(db, m, 2)

    def transcriber(*args, **kwargs):
        events.append(("transcribe", kwargs["job_source_id"]))
        if kwargs["job_source_id"] == rels[1].id:
            db.get(m.TranscriptionJob, job.id).cancel_requested_at = Clock()()
            db.commit()
            raise JobElevenLabsTranscriptionError(JobElevenLabsTranscriptionReason.provider_timeout)
        return FakeCM(Transcript(), events, "transcript_enter", "transcript_exit")

    _, g = fakes(events)
    result = orchestrate_processing_job(
        db,
        job_id=job.id,
        lease_owner_id="worker",
        lease_generation=7,
        settings=Settings(),
        clock=Clock(),
        lease_ttl=timedelta(minutes=5),
        transcription_opener=transcriber,
        google_docs_opener=g,
        output_persister=persister,
    )

    assert result.final_job_status == m.JobStatus.cancelled
    assert result.processed_source_count == 1
    assert db.query(m.TranscriptionJobOutput).count() == 1
    assert len([e for e in events if isinstance(e, tuple) and e[0] == "transcribe"]) == 2
    assert len([e for e in events if isinstance(e, tuple) and e[0] == "google"]) == 1

from __future__ import annotations

import sys
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import timedelta
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


@dataclass(frozen=True)
class Settings:
    credential_key_id: str = "credential-key-v1"
    source_max_upload_bytes: int = 1000
    source_s3_bucket: str = "bucket"


@pytest.fixture()
def db(monkeypatch):
    monkeypatch.setenv("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")
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


@pytest.fixture()
def models():
    from studio_api import models as m
    return m


def make_job(db, m, *, provider="elevenlabs", language="en"):
    from studio_api.security import utcnow
    now = utcnow().replace(tzinfo=None)
    user = m.User(email=f"{id(db)}-{provider}-{language}@example.com", role=m.UserRole.user, status=m.UserStatus.active)
    db.add(user); db.flush()
    project = m.Project(owner_user_id=user.id, title="p", output_drive_folder_id="folder-private")
    db.add(project); db.flush()
    cred = m.ProviderCredential(user_id=user.id, provider=m.CredentialProvider(provider), label="k", status=m.CredentialStatus.active)
    db.add(cred); db.flush()
    version = m.ProviderCredentialVersion(credential_id=cred.id, version=1, ciphertext=b"ct", nonce=b"nonce", key_id="credential-key-v1", masked_value="masked", fingerprint="fp")
    db.add(version); db.flush(); cred.active_version_id = version.id
    src = m.Source(project_id=project.id, source_type=m.SourceType.local_upload, original_filename="secret meeting.mp3", mime_type="audio/mpeg", size_bytes=5, s3_bucket="bucket", s3_object_key="private/object", upload_status=m.SourceUploadStatus.uploaded, uploaded_at=now, expires_at=now + timedelta(hours=1))
    db.add(src); db.flush()
    job = m.TranscriptionJob(project_id=project.id, owner_user_id=user.id, status=m.JobStatus.processing, provider=provider, provider_credential_id=cred.id, language=language, output_drive_folder_id="folder-private", output_drive_folder_url="https://drive.google.com/drive/folders/folder-private", output_drive_folder_name="Private", lease_owner_id="worker", lease_generation=7, claimed_at=now, lease_expires_at=now + timedelta(minutes=5), started_at=now)
    db.add(job); db.flush()
    rel = m.TranscriptionJobSource(job_id=job.id, source_id=src.id, position=0)
    db.add(rel); db.commit()
    return user, project, cred, version, src, job, rel, now


class Secret:
    provider = "elevenlabs"
    credential_version_id = ""
    output_drive_folder_id = "folder-private"
    lease_generation = 7
    def __init__(self, credential_id, version_id, provider="elevenlabs"):
        self.provider = provider; self.credential_version_id = version_id
        self._credential = type("Cred", (), {"credential_id": credential_id})()
        self._closed = False
    @property
    def raw_credential_secret(self):
        if self._closed:
            raise RuntimeError("context_closed")
        return "super-secret-key"
    def close(self):
        self._closed = True
    def __repr__(self):
        return "Secret(<redacted>)"


@contextmanager
def fake_prereq(db, *, job_id, lease_owner_id, lease_generation, settings, now=None, clock=None, **kw):
    job = db.get(kw["models"].TranscriptionJob, job_id)
    handle = Secret(job.provider_credential_id, db.get(kw["models"].ProviderCredential, job.provider_credential_id).active_version_id, provider=job.provider)
    try:
        yield handle
    finally:
        handle.close()


@contextmanager
def fake_source(db, *, job_id, job_source_id, lease_owner_id, lease_generation, settings, now=None, clock=None, **kw):
    from studio_api import models as m
    from studio_api.job_source_materialization import MaterializedJobSource, MaterializedSourceIdentity
    rel = db.get(m.TranscriptionJobSource, job_source_id)
    src = rel.source
    stream = BytesIO(b"audio")
    try:
        yield MaterializedJobSource(MaterializedSourceIdentity(job_id, rel.id, src.id), rel.position, src.original_filename, src.mime_type, 5, stream)
    finally:
        stream.close()


class CaptureTransport:
    def __init__(self, mutate=None):
        self.calls = []
        self.mutate = mutate
    def transcribe(self, **kwargs):
        self.calls.append(kwargs)
        if self.mutate:
            self.mutate()
        from studio_api.elevenlabs_transcription import normalize_elevenlabs_transcript_response
        return normalize_elevenlabs_transcript_response({"text": "hello", "words": [{"text": "hello", "start": 0, "end": 1, "type": "word", "speaker_id": "speaker_0"}]})


def run_boundary(db, m, job, rel, transport, now):
    from studio_api.job_elevenlabs_transcription import transcribe_processing_job_source_with_elevenlabs
    return transcribe_processing_job_source_with_elevenlabs(db, job_id=job.id, job_source_id=rel.id, lease_owner_id="worker", lease_generation=7, settings=Settings(), now=now, prerequisites_opener=fake_prereq, source_materializer=fake_source, elevenlabs_transport=transport, models=m)


def test_request_construction_language_and_redaction():
    from studio_api.elevenlabs_transcription import ElevenLabsTranscriptionTransport
    calls = []
    def post(url, **kwargs):
        calls.append((url, kwargs))
        return httpx.Response(200, json={"text": "ok"})
    stream = BytesIO(b"abc")
    result = ElevenLabsTranscriptionTransport(post=post).transcribe(api_key="secret-key", stream=stream, filename="safe.mp3", mime_type="audio/mpeg", language_code="en")
    assert result.text == "ok"
    assert calls[0][0] == "https://api.elevenlabs.io/v1/speech-to-text"
    kwargs = calls[0][1]
    assert kwargs["headers"] == {"xi-api-key": "secret-key"}
    assert kwargs["files"]["file"] == ("safe.mp3", stream, "audio/mpeg")
    assert kwargs["data"] == {"model_id": "scribe_v2", "no_verbatim": "false", "temperature": "0", "tag_audio_events": "false", "diarize": "false", "use_multi_channel": "false", "language_code": "en"}
    assert "secret-key" not in repr(ElevenLabsTranscriptionTransport(post=post)) and "ok" not in repr(result)
    calls.clear(); ElevenLabsTranscriptionTransport(post=post).transcribe(api_key="k", stream=BytesIO(b"x"), filename="a.mp3", mime_type="audio/mpeg")
    assert "language_code" not in calls[0][1]["data"]


def test_successful_single_source_flow_lifetime_and_one_call(db, models):
    *_, job, rel, now = make_job(db, models)
    transport = CaptureTransport()
    with run_boundary(db, models, job, rel, transport, now) as result:
        retained = result; word = result.words[0]
        assert result.text == "hello" and word.text == "hello" and word.start == 0
        assert "hello" not in repr(result) and "super-secret-key" not in repr(result)
    assert len(transport.calls) == 1
    from studio_api.elevenlabs_transcription import ElevenLabsTranscriptionError
    with pytest.raises(ElevenLabsTranscriptionError, match="context_closed"):
        retained.text
    with pytest.raises(ElevenLabsTranscriptionError, match="context_closed"):
        word.text
    assert transport.calls[0]["language_code"] == "en"
    assert transport.calls[0]["filename"] == "secret meeting.mp3"


def test_diagnostics_source_provider_success_order_and_correlation(monkeypatch, db, models):
    import studio_api.job_elevenlabs_transcription as mod
    *_, job, rel, now = make_job(db, models)
    job.attempt_count = 1; db.commit()
    events = []
    monkeypatch.setattr(mod, "resolve_job_correlation_id", lambda **kw: "corr_abcdefghijklmnop")
    monkeypatch.setattr(mod, "write_diagnostic_event", lambda **kw: events.append(kw) or SimpleNamespace(accepted=True, persisted=True))
    with run_boundary(db, models, job, rel, CaptureTransport(), now):
        pass
    assert [e["event_code"] for e in events] == ["SOURCE_VALIDATION_STARTED", "SOURCE_READY", "PROVIDER_REQUEST_STARTED", "PROVIDER_REQUEST_COMPLETED"]
    assert all(e["correlation_id"] == "corr_abcdefghijklmnop" and e.get("request_id") is None for e in events)


def test_diagnostics_provider_mapped_and_unexpected_failures(monkeypatch, db, models):
    import studio_api.job_elevenlabs_transcription as mod
    from studio_api.elevenlabs_transcription import ElevenLabsTranscriptionError, ElevenLabsTranscriptionReason
    from studio_api.job_elevenlabs_transcription import JobElevenLabsTranscriptionError
    *_, job, rel, now = make_job(db, models)
    job.attempt_count = 1; db.commit()
    events = []
    monkeypatch.setattr(mod, "resolve_job_correlation_id", lambda **kw: "corr_abcdefghijklmnop")
    monkeypatch.setattr(mod, "write_diagnostic_event", lambda **kw: events.append(kw) or SimpleNamespace(accepted=True, persisted=True))
    class MappedFailure:
        def transcribe(self, **kwargs):
            raise ElevenLabsTranscriptionError(ElevenLabsTranscriptionReason.provider_timeout)
    with pytest.raises(JobElevenLabsTranscriptionError, match="provider_timeout"):
        with run_boundary(db, models, job, rel, MappedFailure(), now):
            pass
    assert [e["event_code"] for e in events] == ["SOURCE_VALIDATION_STARTED", "SOURCE_READY", "PROVIDER_REQUEST_STARTED", "PROVIDER_REQUEST_FAILED"]
    assert events[-1]["metadata"] == {"boundary": "provider_transport", "error_code": "provider_timeout", "retryable": True, "attempt_number": job.attempt_count or 0}
    events.clear()
    class UnexpectedFailure:
        def transcribe(self, **kwargs):
            raise RuntimeError("raw secret provider payload")
    with pytest.raises(JobElevenLabsTranscriptionError, match="provider_unavailable"):
        with run_boundary(db, models, job, rel, UnexpectedFailure(), now):
            pass
    assert [e["event_code"] for e in events] == ["SOURCE_VALIDATION_STARTED", "SOURCE_READY", "PROVIDER_REQUEST_STARTED", "PROVIDER_REQUEST_FAILED"]
    assert events[-1]["metadata"]["error_code"] == "unknown"


@pytest.mark.parametrize("mutate,reason", [
    (lambda m, project, cred, version, src, job, rel, now: setattr(job, "lease_owner_id", "other"), "lifecycle_changed_before_provider_call"),
    (lambda m, project, cred, version, src, job, rel, now: setattr(job, "cancel_requested_at", now), "lifecycle_changed_before_provider_call"),
    (lambda m, project, cred, version, src, job, rel, now: setattr(cred, "active_version_id", "replaced"), "credential_or_output_identity_changed_before_provider_call"),
    (lambda m, project, cred, version, src, job, rel, now: setattr(job, "output_drive_folder_id", "changed"), "credential_or_output_identity_changed_before_provider_call"),
    (lambda m, project, cred, version, src, job, rel, now: setattr(rel, "status", m.JobSourceStatus.skipped), "lifecycle_changed_before_provider_call"),
])
def test_pre_provider_revalidation_blocks_transport(db, models, mutate, reason):
    user, project, cred, version, src, job, rel, now = make_job(db, models)
    def materializer(*args, **kwargs):
        cm = fake_source(*args, **kwargs)
        class Wrapper:
            def __enter__(self):
                handle = cm.__enter__(); mutate(models, project, cred, version, src, job, rel, now); db.flush(); return handle
            def __exit__(self, *exc):
                return cm.__exit__(*exc)
        return Wrapper()
    from studio_api.job_elevenlabs_transcription import JobElevenLabsTranscriptionError, transcribe_processing_job_source_with_elevenlabs
    transport = CaptureTransport()
    with pytest.raises(JobElevenLabsTranscriptionError, match=reason):
        with transcribe_processing_job_source_with_elevenlabs(db, job_id=job.id, job_source_id=rel.id, lease_owner_id="worker", lease_generation=7, settings=Settings(), now=now, prerequisites_opener=fake_prereq, source_materializer=materializer, elevenlabs_transport=transport, models=models):
            pass
    assert transport.calls == []


def test_provider_mismatch_blocks_before_transport(db, models):
    *_, job, rel, now = make_job(db, models, provider="openai")
    transport = CaptureTransport()
    from studio_api.job_elevenlabs_transcription import JobElevenLabsTranscriptionError
    with pytest.raises(JobElevenLabsTranscriptionError, match="provider_mismatch"):
        with run_boundary(db, models, job, rel, transport, now):
            pass
    assert transport.calls == []


def test_post_provider_lifecycle_change_discards_result_and_no_retry(db, models):
    user, project, cred, version, src, job, rel, now = make_job(db, models)
    transport = CaptureTransport(mutate=lambda: (setattr(job, "cancel_requested_at", now), db.flush()))
    from studio_api.job_elevenlabs_transcription import JobElevenLabsTranscriptionError
    with pytest.raises(JobElevenLabsTranscriptionError, match="lifecycle_changed_after_provider_call"):
        with run_boundary(db, models, job, rel, transport, now):
            pass
    assert len(transport.calls) == 1


def test_caller_exception_propagates_unchanged(db, models):
    *_, job, rel, now = make_job(db, models)
    sentinel = RuntimeError("caller-secret-transcript")
    with pytest.raises(RuntimeError) as exc:
        with run_boundary(db, models, job, rel, CaptureTransport(), now):
            raise sentinel
    assert exc.value is sentinel


@pytest.mark.parametrize("payload", [
    {"text": "", "language_probability": 0},
    {"text": "hi", "language_code": "en", "language_probability": 1, "words": [{"text": "hi", "start": 0.1, "end": 0.2}]},
])
def test_valid_response_shapes(payload):
    from studio_api.elevenlabs_transcription import normalize_elevenlabs_transcript_response
    result = normalize_elevenlabs_transcript_response(payload)
    assert result.text == payload["text"]
    assert result.word_count == len(payload.get("words", []))


@pytest.mark.parametrize("payload", [[], {"text": 1}, {"text": "x", "language_probability": 2}, {"text": "x", "words": {}}, {"text": "x", "words": [1]}, {"text": "x", "words": [{"text": "w", "start": 2, "end": 1}]}, {"text": "x", "words": [{"text": "w", "start": -1}]}, {"text": "x", "words": [{"text": 3}] }])
def test_malformed_success_responses(payload):
    from studio_api.elevenlabs_transcription import ElevenLabsTranscriptionError, normalize_elevenlabs_transcript_response
    with pytest.raises(ElevenLabsTranscriptionError, match="malformed_provider_response"):
        normalize_elevenlabs_transcript_response(payload)


@pytest.mark.parametrize("status,reason", [(401, "provider_authentication_rejected"), (403, "provider_authentication_rejected"), (400, "provider_request_rejected"), (404, "provider_request_rejected"), (409, "provider_request_rejected"), (422, "provider_request_rejected"), (429, "provider_rate_limited"), (500, "provider_unavailable")])
def test_http_error_mapping_redacts_body(status, reason):
    from studio_api.elevenlabs_transcription import ElevenLabsTranscriptionError, ElevenLabsTranscriptionTransport
    def post(*a, **k):
        return httpx.Response(status, content=b"raw secret provider body")
    with pytest.raises(ElevenLabsTranscriptionError, match=reason) as exc:
        ElevenLabsTranscriptionTransport(post=post).transcribe(api_key="key", stream=BytesIO(b"a"), filename="secret.mp3", mime_type="audio/mpeg")
    assert "raw secret" not in str(exc.value) and "key" not in str(exc.value)


@pytest.mark.parametrize("exc_obj,reason", [(httpx.TimeoutException("url secret"), "provider_timeout"), (httpx.ConnectError("network secret"), "provider_unavailable")])
def test_network_error_mapping_redacts(exc_obj, reason):
    from studio_api.elevenlabs_transcription import ElevenLabsTranscriptionError, ElevenLabsTranscriptionTransport
    def post(*a, **k):
        raise exc_obj
    with pytest.raises(ElevenLabsTranscriptionError, match=reason) as exc:
        ElevenLabsTranscriptionTransport(post=post).transcribe(api_key="key", stream=BytesIO(b"a"), filename="secret.mp3", mime_type="audio/mpeg")
    assert "secret" not in str(exc.value)


def test_malformed_json_mapping_redacts_body():
    from studio_api.elevenlabs_transcription import ElevenLabsTranscriptionError, ElevenLabsTranscriptionTransport
    def post(*a, **k):
        return httpx.Response(200, content=b"not json raw transcript")
    with pytest.raises(ElevenLabsTranscriptionError, match="malformed_provider_response") as exc:
        ElevenLabsTranscriptionTransport(post=post).transcribe(api_key="key", stream=BytesIO(b"a"), filename="secret.mp3", mime_type="audio/mpeg")
    assert "raw transcript" not in str(exc.value)

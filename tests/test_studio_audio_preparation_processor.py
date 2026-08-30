from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
import json
import os
import sys

import pytest

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))
if "STUDIO_DATABASE_HOST" not in os.environ:
    os.environ.setdefault("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")

from studio_api.audio_preparation_processor import process_claimed_audio_preparation_job
from studio_api.audio_preparation_service import (
    AudioPreparationServiceError,
    claim_next_audio_preparation_job,
    create_audio_preparation_job,
    start_audio_preparation_job,
)
from studio_api.db import Base
from studio_api.models import AudioPreparationJob, AudioPreparationStatus, Project, Source, SourceType, SourceUploadStatus, User
from studio_api.security import utcnow


class Stream:
    def __init__(self, payload: bytes): self.body = BytesIO(payload)
    def iter_chunks(self, size):
        while chunk := self.body.read(size): yield chunk
    def close(self): self.body.close()


class Storage:
    def __init__(self, payload: bytes): self.payload = payload; self.puts = []
    def open_read(self, _key): return Stream(self.payload)
    def put_file(self, key, path, content_type): self.puts.append((key, Path(path).read_bytes(), content_type))


def isolated_storage_settings():
    return SimpleNamespace(
        source_s3_endpoint_url="https://r2.test",
        source_s3_region="auto",
        source_s3_bucket="private",
        source_s3_access_key_id_file="transcription-access",
        source_s3_secret_access_key_file="transcription-secret",
        source_s3_lifecycle_rule_id="transcription-retention",
        audio_reference_s3_endpoint_url="https://r2.test",
        audio_reference_s3_region="auto",
        audio_reference_s3_bucket="audio-private",
        audio_reference_s3_access_key_id_file="audio-access",
        audio_reference_s3_secret_access_key_file="audio-secret",
        audio_reference_s3_lifecycle_rule_id="audio-retention",
        source_max_upload_bytes=1024 * 1024,
    )


def runner(command, **_kwargs):
    if command[0] == "ffprobe":
        payload = {"streams": [{"codec_type": "audio", "duration": "60", "codec_name": "flac", "sample_rate": "48000", "channels": 2, "channel_layout": "stereo"}], "format": {"duration": "60", "format_name": "flac"}}
        return SimpleNamespace(stdout=json.dumps(payload), stderr="")
    if command[-1] != "-":
        Path(command[-1]).write_bytes(b"processed-audio")
    return SimpleNamespace(stdout="", stderr="")


def test_preview_processing_storage_and_ephemeral_cleanup_are_durable(tmp_path, monkeypatch):
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    now = datetime(2026, 8, 24, 20, 0, tzinfo=timezone.utc)
    monkeypatch.setattr("studio_api.audio_preparation_processor.utcnow", lambda: now)
    payload = b"reference-audio"
    storage = Storage(payload)
    settings = isolated_storage_settings()

    @contextmanager
    def temp_directory_factory(prefix):
        root = tmp_path / prefix
        root.mkdir(exist_ok=True)
        yield str(root)

    with session_factory() as db:
        user = User(id="owner", email="owner@example.test", source_retention_ttl_seconds=86400)
        project = Project(id="project", owner_user_id=user.id, title="Материалы")
        source = Source(id="source", project_id=project.id, source_type=SourceType.local_upload, original_filename="input.flac", mime_type="audio/flac", size_bytes=len(payload), s3_bucket="private", s3_object_key="input", upload_status=SourceUploadStatus.uploaded, source_created_at=datetime(2026, 8, 20, 10, 0), source_created_at_provenance="embedded_media_metadata", expires_at=datetime(2026, 8, 30))
        db.add_all([user, project, source]); db.commit()
        job = create_audio_preparation_job(db, owner_user_id=user.id, project_id=project.id, title="Готовая запись", source_ids=[source.id], ephemeral_source_ids={source.id}, manual_order=True, options_payload={"preset": "processing_only", "output_format": "flac"}, output_destination="download", output_folder=None, now=now)
        db.commit()

        preview_claim = claim_next_audio_preparation_job(db, lease_owner_id="worker", now=now, lease_ttl=timedelta(minutes=10)); db.commit()
        result = process_claimed_audio_preparation_job(db, job_id=job.id, lease_owner_id="worker", lease_generation=preview_claim.lease_generation, settings=settings, now=now, storage_factory=lambda _settings: storage, runner=runner, temp_directory_factory=temp_directory_factory)
        assert result.status == "preview_ready"
        assert db.get(AudioPreparationJob, job.id).total_input_duration_ms == 60_000

        start_audio_preparation_job(db, owner_user_id=user.id, job_id=job.id); db.commit()
        process_claim = claim_next_audio_preparation_job(db, lease_owner_id="worker", now=now + timedelta(minutes=1), lease_ttl=timedelta(minutes=10)); db.commit()
        result = process_claimed_audio_preparation_job(db, job_id=job.id, lease_owner_id="worker", lease_generation=process_claim.lease_generation, settings=settings, now=now + timedelta(minutes=1), storage_factory=lambda _settings: storage, runner=runner, temp_directory_factory=temp_directory_factory)

        persisted = db.get(AudioPreparationJob, job.id)
        assert result.output_created is True
        assert persisted.status is AudioPreparationStatus.completed
        assert persisted.output_source_id is not None
        assert storage.puts[0][1] == b"processed-audio"
        output_source = db.get(Source, persisted.output_source_id)
        assert output_source.reference_class == "audio_processing"
        assert output_source.s3_bucket == "audio-private"
        db.refresh(source)
        assert source.upload_status is SourceUploadStatus.deleted
        assert source.storage_cleanup_status.value == "pending"


def test_processing_reuses_preview_validation_instead_of_decoding_inputs_again(tmp_path):
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 8, 25, 18, 0, tzinfo=timezone.utc)
    payload = b"reference-audio"
    storage = Storage(payload)
    settings = isolated_storage_settings()
    calls = []

    def recording_runner(command, **kwargs):
        calls.append(command)
        return runner(command, **kwargs)

    @contextmanager
    def temp_directory_factory(prefix):
        root = tmp_path / prefix
        root.mkdir(exist_ok=True)
        yield str(root)

    with Session(engine) as db:
        user = User(id="owner", email="owner@example.test")
        project = Project(id="project", owner_user_id=user.id, title="Материалы")
        source = Source(id="source", project_id=project.id, source_type=SourceType.local_upload, original_filename="input.flac", mime_type="audio/flac", size_bytes=len(payload), s3_bucket="private", s3_object_key="input", upload_status=SourceUploadStatus.uploaded, expires_at=datetime(2099, 8, 30))
        db.add_all([user, project, source]); db.commit()
        job = create_audio_preparation_job(db, owner_user_id=user.id, project_id=project.id, title="Запись", source_ids=[source.id], ephemeral_source_ids=set(), manual_order=True, options_payload={"preset": "processing_only", "output_format": "flac"}, output_destination="download", output_folder=None, now=now)
        db.commit()

        preview_claim = claim_next_audio_preparation_job(db, lease_owner_id="worker", now=now, lease_ttl=timedelta(minutes=10)); db.commit()
        process_claimed_audio_preparation_job(db, job_id=job.id, lease_owner_id="worker", lease_generation=preview_claim.lease_generation, settings=settings, now=now, storage_factory=lambda _settings: storage, runner=recording_runner, temp_directory_factory=temp_directory_factory)
        preview_integrity_calls = sum(command[-1] == "-" for command in calls if command[0] == "ffmpeg")
        assert preview_integrity_calls == 1

        start_audio_preparation_job(db, owner_user_id=user.id, job_id=job.id); db.commit()
        process_claim = claim_next_audio_preparation_job(db, lease_owner_id="worker", now=now + timedelta(minutes=1), lease_ttl=timedelta(minutes=10)); db.commit()
        calls.clear()
        process_claimed_audio_preparation_job(db, job_id=job.id, lease_owner_id="worker", lease_generation=process_claim.lease_generation, settings=settings, now=now + timedelta(minutes=1), storage_factory=lambda _settings: storage, runner=recording_runner, temp_directory_factory=temp_directory_factory)

        assert sum(command[-1] == "-" for command in calls if command[0] == "ffmpeg") == 0
        assert sum(command[-1] != "-" for command in calls if command[0] == "ffmpeg") == 1


def test_expired_active_lease_is_reclaimed():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 8, 24, 20, 0)
    with Session(engine) as db:
        user = User(id="owner", email="owner@example.test")
        project = Project(id="project", owner_user_id=user.id, title="Материалы")
        source = Source(id="source", project_id=project.id, source_type=SourceType.local_upload, original_filename="input.wav", mime_type="audio/wav", size_bytes=10, s3_bucket="private", s3_object_key="input", upload_status=SourceUploadStatus.uploaded, expires_at=datetime(2026, 8, 30))
        db.add_all([user, project, source]); db.commit()
        job = create_audio_preparation_job(db, owner_user_id=user.id, project_id=project.id, title="Запись", source_ids=[source.id], ephemeral_source_ids=set(), manual_order=True, options_payload={}, output_destination="download", output_folder=None, now=now)
        db.commit()
        first = claim_next_audio_preparation_job(db, lease_owner_id="dead-worker", now=now, lease_ttl=timedelta(minutes=5)); first_generation = first.lease_generation; db.commit()
        reclaimed = claim_next_audio_preparation_job(db, lease_owner_id="new-worker", now=now + timedelta(minutes=6), lease_ttl=timedelta(minutes=5))
        assert reclaimed.id == first.id
        assert reclaimed.lease_owner_id == "new-worker"
        assert reclaimed.lease_generation == first_generation + 1


def test_processing_cancellation_finishes_cancelled_and_cleans_ephemeral_reference(tmp_path, monkeypatch):
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    payload = b"reference-audio"
    storage = Storage(payload)
    settings = isolated_storage_settings()
    now = datetime(2026, 8, 24, 20, 0, tzinfo=timezone.utc)
    monkeypatch.setattr("studio_api.audio_preparation_processor.utcnow", lambda: now)

    @contextmanager
    def temp_directory_factory(prefix):
        root = tmp_path / prefix
        root.mkdir(exist_ok=True)
        yield str(root)

    with Session(engine) as db:
        user = User(id="owner", email="owner@example.test")
        project = Project(id="project", owner_user_id=user.id, title="Материалы")
        source = Source(id="source", project_id=project.id, source_type=SourceType.local_upload, original_filename="input.flac", mime_type="audio/flac", size_bytes=len(payload), s3_bucket="private", s3_object_key="input", upload_status=SourceUploadStatus.uploaded, expires_at=datetime(2026, 8, 30))
        db.add_all([user, project, source]); db.commit()
        job = create_audio_preparation_job(db, owner_user_id=user.id, project_id=project.id, title="Запись", source_ids=[source.id], ephemeral_source_ids={source.id}, manual_order=True, options_payload={"output_format": "flac"}, output_destination="download", output_folder=None, now=now)
        job.status = AudioPreparationStatus.preview_ready; job.current_stage = "preview_ready"; db.commit()
        start_audio_preparation_job(db, owner_user_id=user.id, job_id=job.id); db.commit()
        claimed = claim_next_audio_preparation_job(db, lease_owner_id="worker", now=now, lease_ttl=timedelta(minutes=10)); db.commit()

        def cancelling_runner(command, **kwargs):
            result = runner(command, **kwargs)
            if command[0] == "ffmpeg" and command[-1] != "-":
                current = db.get(AudioPreparationJob, job.id)
                current.cancel_requested_at = utcnow()
                db.commit()
            return result

        with pytest.raises(AudioPreparationServiceError):
            process_claimed_audio_preparation_job(db, job_id=job.id, lease_owner_id="worker", lease_generation=claimed.lease_generation, settings=settings, now=now, storage_factory=lambda _settings: storage, runner=cancelling_runner, temp_directory_factory=temp_directory_factory)
        persisted = db.get(AudioPreparationJob, job.id)
        db.refresh(source)
        assert persisted.status is AudioPreparationStatus.cancelled
        assert source.upload_status is SourceUploadStatus.deleted
        assert storage.puts == []

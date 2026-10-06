from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sys
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/studio-api"))

from studio_api.db import Base
from studio_api.models import User, Project, Source, SourceType, TranscriptionJob, TranscriptionJobSource, TranscriptionJobOutput
from studio_api import transcript_manifest_export as manifest
from studio_api.transcript_catalog import GOOGLE_DOCS_TRANSCRIPT_OUTPUT_KIND


@pytest.fixture
def db():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        yield db
    engine.dispose()


def completed(db, owner, document, *, count=10, at=None):
    at = at or datetime(2026, 10, 5, tzinfo=timezone.utc)
    if db.get(User, owner) is None:
        db.add(User(id=owner, email=owner + "@example.test"))
    project = Project(owner_user_id=owner, title="Synthetic")
    db.add(project)
    db.flush()
    source = Source(project_id=project.id, source_type=SourceType.local_upload,
        original_filename="synthetic.wav", s3_object_key="NEVER_EXPORT_STORAGE_KEY")
    job = TranscriptionJob(project_id=project.id, owner_user_id=owner, provider="elevenlabs",
        language="ru", options_json='{"diarize":true}')
    db.add_all([source, job])
    db.flush()
    relation = TranscriptionJobSource(job_id=job.id, source_id=source.id, position=0)
    db.add(relation)
    db.flush()
    db.add(TranscriptionJobOutput(job_id=job.id, job_source_id=relation.id,
        document_id=document, web_view_url="https://docs.google.com/document/d/" + document,
        output_drive_folder_id="folder", output_kind=GOOGLE_DOCS_TRANSCRIPT_OUTPUT_KIND,
        transcript_standard="transcript_doc", document_character_count=count,
        document_created_at=at, persisted_at=at, lease_generation=1))
    db.commit()


def test_snapshot_owner_scope_clear_cutoff_and_no_private_storage_content(db):
    completed(db, "owner", "old")
    completed(db, "other", "other-private")
    completed(db, "owner", "empty", count=0)
    payload, count = manifest.manifest_snapshot(db, user_id="owner")
    assert count == 1
    entry = json.loads(payload)["entries"][0]
    assert entry["document_id"] == "old" and entry["diarization_enabled"] is True
    assert b"NEVER_EXPORT" not in payload and b"other-private" not in payload
    user = db.get(User, "owner")
    user.manifest_reset_at = datetime(2026, 10, 6, tzinfo=timezone.utc)
    db.commit()
    assert manifest.manifest_snapshot(db, user_id="owner")[1] == 0
    completed(db, "owner", "new", at=user.manifest_reset_at + timedelta(seconds=1))
    assert manifest.manifest_snapshot(db, user_id="owner")[1] == 1


def test_snapshot_limit_fails_instead_of_exporting_partial_selection(db, monkeypatch):
    completed(db, "owner", "first")
    completed(db, "owner", "second")
    monkeypatch.setattr(manifest, "MAX_ENTRIES", 1)
    with pytest.raises(ValueError, match="manifest_export_limit"):
        manifest.manifest_snapshot(db, user_id="owner")


@pytest.mark.parametrize("fail", [False, True])
def test_export_checks_folder_reuses_snapshot_identity_and_removes_temp_bytes(db, monkeypatch, fail):
    completed(db, "owner", "document")
    conn = SimpleNamespace(scopes="https://www.googleapis.com/auth/drive.file")
    monkeypatch.setattr(manifest, "active_google_connection_for_user", lambda *a, **k: conn)
    monkeypatch.setattr(manifest, "refresh_user_google_drive_access_token", lambda *a, **k: "synthetic-token")
    meta = SimpleNamespace(id="folder", mime_type="application/vnd.google-apps.folder", trashed=False, can_add_children=True)
    monkeypatch.setattr(manifest, "_fetch_drive_folder_authorization_metadata", lambda *a: meta)
    calls = []
    def upload(token, **kwargs):
        calls.append(kwargs)
        assert kwargs["path"].read_bytes().startswith(b'{"entries":')
        assert kwargs["app_property_key"] == "studioManifestSnapshot"
        if fail:
            raise RuntimeError("synthetic upload failure")
        return SimpleNamespace(file_id="synthetic", web_view_url="https://drive.google.com/file/d/synthetic/view")
    monkeypatch.setattr(manifest, "upload_file_resumable", upload)
    if fail:
        with pytest.raises(RuntimeError):
            manifest.export_manifest(db, user_id="owner", folder_id="folder", settings=None)
    else:
        assert manifest.export_manifest(db, user_id="owner", folder_id="folder", settings=None)["entry_count"] == 1
        manifest.export_manifest(db, user_id="owner", folder_id="folder", settings=None)
        assert calls[0]["idempotency_key"] == calls[1]["idempotency_key"]
    assert all(not call["path"].exists() for call in calls)


def test_readonly_folder_never_receives_export(db, monkeypatch):
    completed(db, "owner", "document")
    monkeypatch.setattr(manifest, "active_google_connection_for_user", lambda *a, **k: SimpleNamespace(scopes="https://www.googleapis.com/auth/drive.file"))
    monkeypatch.setattr(manifest, "refresh_user_google_drive_access_token", lambda *a, **k: "synthetic-token")
    monkeypatch.setattr(manifest, "_fetch_drive_folder_authorization_metadata", lambda *a: SimpleNamespace(
        id="folder", mime_type="application/vnd.google-apps.folder", trashed=False, can_add_children=False))
    from studio_api.job_output_destination import OutputDestinationError
    with pytest.raises(OutputDestinationError):
        manifest.export_manifest(db, user_id="owner", folder_id="folder", settings=None)

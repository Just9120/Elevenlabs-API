from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


def isolated_settings(**overrides):
    values = {
        "source_s3_endpoint_url": "https://storage.test",
        "source_s3_region": "auto",
        "source_s3_bucket": "transcription-private",
        "source_s3_access_key_id_file": "/run/secrets/transcription-id",
        "source_s3_secret_access_key_file": "/run/secrets/transcription-secret",
        "source_s3_lifecycle_rule_id": "transcription-reference-retention",
        "audio_reference_s3_endpoint_url": "https://storage.test",
        "audio_reference_s3_region": "auto",
        "audio_reference_s3_bucket": "audio-private",
        "audio_reference_s3_access_key_id_file": "/run/secrets/audio-id",
        "audio_reference_s3_secret_access_key_file": "/run/secrets/audio-secret",
        "audio_reference_s3_lifecycle_rule_id": "audio-reference-retention",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_reference_storage_selects_exact_boundary_without_fallback():
    from studio_api.source_storage import (
        AUDIO_PROCESSING_REFERENCE_CLASS,
        TRANSCRIPTION_REFERENCE_CLASS,
        SourceStorageError,
        reference_storage_settings,
    )

    settings = isolated_settings()
    transcription = reference_storage_settings(
        settings, TRANSCRIPTION_REFERENCE_CLASS
    )
    audio = reference_storage_settings(settings, AUDIO_PROCESSING_REFERENCE_CLASS)

    assert transcription.source_s3_bucket == "transcription-private"
    assert transcription.source_s3_access_key_id_file.endswith("transcription-id")
    assert audio.source_s3_bucket == "audio-private"
    assert audio.source_s3_access_key_id_file.endswith("audio-id")

    missing_audio = isolated_settings(audio_reference_s3_bucket=None)
    assert (
        reference_storage_settings(
            missing_audio, AUDIO_PROCESSING_REFERENCE_CLASS
        ).source_s3_bucket
        is None
    )
    with pytest.raises(SourceStorageError):
        reference_storage_settings(settings, "unknown")


@pytest.mark.parametrize(
    "overrides",
    [
        {"source_s3_bucket": None},
        {"audio_reference_s3_bucket": None},
        {"audio_reference_s3_bucket": "transcription-private"},
        {
            "audio_reference_s3_access_key_id_file": "/run/secrets/transcription-id"
        },
        {
            "audio_reference_s3_secret_access_key_file": "/run/secrets/transcription-secret"
        },
        {"source_s3_lifecycle_rule_id": None},
        {"audio_reference_s3_lifecycle_rule_id": None},
        {
            "audio_reference_s3_lifecycle_rule_id": "transcription-reference-retention"
        },
    ],
)
def test_reference_storage_isolation_fails_closed(overrides):
    from studio_api.source_storage import reference_storage_isolation_configured

    assert reference_storage_isolation_configured(isolated_settings()) is True
    assert (
        reference_storage_isolation_configured(isolated_settings(**overrides))
        is False
    )


def test_reference_class_schema_defaults_legacy_rows_and_rejects_unknown_values(
    monkeypatch,
):
    monkeypatch.setenv("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")
    from studio_api.db import Base
    from studio_api.models import Project, Source, SourceType, User

    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    try:
        columns = {column["name"]: column for column in inspect(engine).get_columns("sources")}
        assert columns["reference_class"]["nullable"] is False
        with Session(engine) as db:
            user = User(email="storage-schema@example.com")
            db.add(user)
            db.flush()
            project = Project(owner_user_id=user.id, title="Storage schema")
            db.add(project)
            db.flush()
            legacy = Source(
                project_id=project.id,
                source_type=SourceType.local_upload,
                original_filename="legacy.mp3",
                mime_type="audio/mpeg",
                size_bytes=10,
            )
            db.add(legacy)
            db.flush()
            assert legacy.reference_class == "transcription"
            invalid = Source(
                project_id=project.id,
                source_type=SourceType.local_upload,
                original_filename="invalid.mp3",
                mime_type="audio/mpeg",
                size_bytes=10,
                reference_class="unknown",
            )
            db.add(invalid)
            with pytest.raises(IntegrityError):
                db.flush()
    finally:
        engine.dispose()


def test_reference_class_migration_is_additive_repository_head():
    scripts = ScriptDirectory.from_config(
        Config(str(ROOT / "apps/studio-api/alembic.ini"))
    )
    assert scripts.get_heads() == ["0030_provider_usage_accounting"]
    revision = scripts.get_revision("0029_source_reference_class")
    assert revision.down_revision == "0028_transcript_maintenance_runs"
    assert revision.module.release_safety == "additive"
    source = (
        ROOT
        / "apps/studio-api/alembic/versions/0029_source_reference_class.py"
    ).read_text(encoding="utf-8")
    assert "server_default=sa.text(\"'transcription'\")" in source
    assert "audio_processing" in source
    assert "create_index" in source

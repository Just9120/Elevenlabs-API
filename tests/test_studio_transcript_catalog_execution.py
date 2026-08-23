from __future__ import annotations

import base64
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


@pytest.fixture
def catalog_db(monkeypatch, tmp_path):
    password_file = tmp_path / "studio_test_pg_password"
    master_key_file = tmp_path / "studio_test_master_key"
    password_file.write_text(
        os.environ.get(
            "STUDIO_TEST_POSTGRES_PASSWORD",
            "studio_test_password",
        ),
        encoding="utf-8",
    )
    master_key_file.write_text(
        base64.b64encode(b"1" * 32).decode(),
        encoding="utf-8",
    )
    monkeypatch.setenv("STUDIO_DATABASE_SCHEME", "postgresql+psycopg")
    monkeypatch.setenv("STUDIO_DATABASE_HOST", "127.0.0.1")
    monkeypatch.setenv("STUDIO_DATABASE_PORT", "5432")
    monkeypatch.setenv("STUDIO_DATABASE_NAME", "studio_test")
    monkeypatch.setenv("STUDIO_DATABASE_USER", "studio_test")
    monkeypatch.setenv(
        "STUDIO_POSTGRES_PASSWORD_FILE",
        str(password_file),
    )
    monkeypatch.setenv(
        "STUDIO_CREDENTIAL_MASTER_KEY_FILE",
        str(master_key_file),
    )

    from studio_api.models import TranscriptCatalogEntry, User

    engine = create_engine("sqlite+pysqlite:///:memory:")

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_connection, _connection_record):
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    User.__table__.create(engine)
    TranscriptCatalogEntry.__table__.create(engine)
    with Session(engine) as db:
        db.add(User(id="owner-a", email="owner-a@example.com"))
        db.commit()
    with Session(engine) as db:
        yield db
    engine.dispose()


def _candidate(
    document_id: str,
    *,
    name: str = "Document",
    standard: str = "current",
    imported: str = "not_imported",
    settings: str = "indeterminate",
):
    from studio_api.transcript_catalog_migration import (
        CatalogDocumentStandardStatus,
        CatalogImportAuthorityStatus,
        CatalogMigrationCandidate,
        CatalogSettingsAuthorityStatus,
    )

    return CatalogMigrationCandidate(
        drive_document_id=document_id,
        name=name,
        standard_status=CatalogDocumentStandardStatus(standard),
        import_status=CatalogImportAuthorityStatus(imported),
        settings_status=CatalogSettingsAuthorityStatus(settings),
    )


class StatefulStandardizer:
    def __init__(self, document_text_by_id):
        self.document_text_by_id = dict(document_text_by_id)
        self.writes = []

    def read_document(self, *, access_token, document_id):
        from studio_api.transcript_catalog_standardize import (
            CatalogGoogleDocumentSnapshot,
        )

        assert access_token == "private-access-token"
        text = self.document_text_by_id[document_id]
        return CatalogGoogleDocumentSnapshot(
            document_id=document_id,
            revision_id=f"revision-{len(self.writes)}",
            tab_id="private-tab",
            document_text=text,
            end_index=len(text) + 2,
        )

    def replace_document_text(
        self,
        *,
        access_token,
        snapshot,
        document_text,
    ):
        assert access_token == "private-access-token"
        self.writes.append(snapshot.document_id)
        self.document_text_by_id[snapshot.document_id] = document_text


def test_catalog_execution_converges_mixed_apply_without_private_payloads(
    catalog_db,
):
    from studio_api.models import TranscriptCatalogEntry
    from studio_api.transcript_catalog_execution import (
        execute_catalog_migration_apply,
    )

    candidates = (
        _candidate("private-current", name="Current"),
        _candidate(
            "private-outdated",
            name="Outdated",
            standard="outdated",
        ),
        _candidate(
            "private-existing-output",
            name="Existing output",
            standard="unstructured",
            imported="imported_exact",
            settings="exact",
        ),
        _candidate(
            "private-unreadable",
            name="Unreadable",
            standard="unreadable",
        ),
    )
    standardizer = StatefulStandardizer(
        {
            "private-outdated": (
                "Outdated\n\nTranscript metadata\n"
                "Source file: private.mp3\n"
                "Provider: unknown\n"
                "Model: unknown\n"
                "Language: unknown\n"
                "Speakers: unknown\n"
                "Created at: unknown\n\n"
                "Transcript\n\nPrivate legacy body"
            ),
            "private-existing-output": (
                "Existing output\n\nPrivate existing body"
            ),
        }
    )

    result = execute_catalog_migration_apply(
        catalog_db,
        owner_user_id="owner-a",
        access_token="private-access-token",
        candidates=candidates,
        created_time_by_document_id={
            "private-outdated": "2026-07-01T00:00:00Z",
            "private-existing-output": "2026-07-01T00:00:00Z",
        },
        applied_at=datetime(2026, 7, 26, 10, 0, tzinfo=timezone.utc),
        standardizer=standardizer,
    )
    catalog_db.commit()

    assert [
        (
            item["action"],
            item["outcome"],
            item["standardization_outcome"],
        )
        for item in result["items"]
    ] == [
        ("import_metadata", "imported", "not_required"),
        ("standardize_and_import", "imported", "changed"),
        ("standardize_document", "unchanged", "changed"),
        ("blocked", "blocked", "not_required"),
    ]
    assert result["summary"]["imported_count"] == 2
    assert result["summary"]["document_standardized_count"] == 2
    assert result["summary"]["document_already_current_count"] == 0
    assert (
        result["summary"]["document_standardization_blocked_count"]
        == 0
    )
    assert standardizer.writes == [
        "private-outdated",
        "private-existing-output",
    ]
    rows = catalog_db.execute(
        select(TranscriptCatalogEntry).order_by(
            TranscriptCatalogEntry.document_id
        )
    ).scalars().all()
    assert [row.document_id for row in rows] == [
        "private-current",
        "private-outdated",
    ]

    encoded = json.dumps(result, ensure_ascii=False)
    for private_value in (
        "private-access-token",
        "private-current",
        "private-outdated",
        "private-existing-output",
        "Private legacy body",
        "Private existing body",
    ):
        assert private_value not in encoded


def test_catalog_execution_blocks_metadata_conflict_before_google_write(
    catalog_db,
):
    from studio_api.transcript_catalog import (
        elevenlabs_effective_settings,
    )
    from studio_api.transcript_catalog_apply import (
        CatalogApplyMetadata,
        apply_catalog_migration_metadata,
    )
    from studio_api.transcript_catalog_execution import (
        execute_catalog_migration_apply,
    )

    apply_catalog_migration_metadata(
        catalog_db,
        owner_user_id="owner-a",
        candidates=(
            _candidate(
                "private-conflict",
                settings="exact",
            ),
        ),
        metadata_by_document_id={
            "private-conflict": CatalogApplyMetadata(
                settings=elevenlabs_effective_settings(
                    language_mode="ru",
                    diarization_enabled=True,
                )
            )
        },
    )
    catalog_db.commit()
    standardizer = StatefulStandardizer(
        {"private-conflict": "Conflict\n\nPrivate body"}
    )

    result = execute_catalog_migration_apply(
        catalog_db,
        owner_user_id="owner-a",
        access_token="private-access-token",
        candidates=(
            _candidate(
                "private-conflict",
                standard="unstructured",
            ),
        ),
        standardizer=standardizer,
    )

    assert result["items"] == [
        {
            "position": 0,
            "name": "Document",
            "action": "standardize_and_import",
            "outcome": "conflict",
            "reason_code": "catalog_metadata_conflict",
            "standardization_outcome": "blocked",
        }
    ]
    assert (
        result["summary"]["document_standardization_blocked_count"]
        == 1
    )
    assert standardizer.writes == []


def test_catalog_execution_retry_finishes_import_without_second_google_write(
    catalog_db,
    monkeypatch,
):
    from studio_api.models import TranscriptCatalogEntry
    from studio_api import transcript_catalog_execution as execution

    candidate = _candidate(
        "private-retry",
        name="Retry",
        standard="unstructured",
    )
    standardizer = StatefulStandardizer(
        {"private-retry": "Retry\n\nPrivate body"}
    )
    real_apply = execution.apply_catalog_migration_metadata
    calls = 0

    def fail_after_final_flush(*args, **kwargs):
        nonlocal calls
        calls += 1
        result = real_apply(*args, **kwargs)
        if calls == 2:
            raise RuntimeError("simulated database response loss")
        return result

    monkeypatch.setattr(
        execution,
        "apply_catalog_migration_metadata",
        fail_after_final_flush,
    )
    with pytest.raises(RuntimeError, match="response loss"):
        execution.execute_catalog_migration_apply(
            catalog_db,
            owner_user_id="owner-a",
            access_token="private-access-token",
            candidates=(candidate,),
            created_time_by_document_id={
                "private-retry": "2026-07-01T00:00:00Z"
            },
            standardizer=standardizer,
        )
    catalog_db.rollback()
    assert catalog_db.execute(
        select(TranscriptCatalogEntry)
    ).scalars().all() == []
    assert standardizer.writes == ["private-retry"]

    monkeypatch.setattr(
        execution,
        "apply_catalog_migration_metadata",
        real_apply,
    )
    repeated = execution.execute_catalog_migration_apply(
        catalog_db,
        owner_user_id="owner-a",
        access_token="private-access-token",
        candidates=(candidate,),
        created_time_by_document_id={
            "private-retry": "2026-07-01T00:00:00Z"
        },
        standardizer=standardizer,
    )
    catalog_db.commit()

    assert repeated["items"][0]["outcome"] == "imported"
    assert (
        repeated["items"][0]["standardization_outcome"]
        == "already_current"
    )
    assert standardizer.writes == ["private-retry"]
    assert catalog_db.execute(
        select(TranscriptCatalogEntry)
    ).scalars().one().document_id == "private-retry"


def test_catalog_execution_rejects_out_of_scope_metadata_before_side_effects(
    catalog_db,
):
    from studio_api.transcript_catalog_execution import (
        execute_catalog_migration_apply,
    )

    standardizer = StatefulStandardizer(
        {"private-document": "Document\n\nPrivate body"}
    )
    with pytest.raises(ValueError, match="out of scope"):
        execute_catalog_migration_apply(
            catalog_db,
            owner_user_id="owner-a",
            access_token="private-access-token",
            candidates=(
                _candidate(
                    "private-document",
                    standard="unstructured",
                ),
            ),
            created_time_by_document_id={
                "other-private-document": "2026-07-01T00:00:00Z",
            },
            standardizer=standardizer,
        )

    assert standardizer.writes == []

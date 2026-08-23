from __future__ import annotations

import base64
import json
import os
import sys
from datetime import datetime, timedelta, timezone
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

    from studio_api.models import (
        ProviderCredential,
        TranscriptCatalogEntry,
        TranscriptionJob,
        TranscriptionJobOutput,
        User,
    )

    engine = create_engine("sqlite+pysqlite:///:memory:")

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_connection, _connection_record):
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    User.__table__.create(engine)
    ProviderCredential.__table__.create(engine)
    TranscriptionJob.__table__.create(engine)
    TranscriptionJobOutput.__table__.create(engine)
    TranscriptCatalogEntry.__table__.create(engine)
    with Session(engine) as db:
        db.add_all(
            [
                User(id="owner-a", email="owner-a@example.com"),
                User(id="owner-b", email="owner-b@example.com"),
            ]
        )
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


def test_catalog_metadata_apply_is_idempotent_and_browser_safe(catalog_db):
    from studio_api.models import TranscriptCatalogEntry
    from studio_api.transcript_catalog_apply import (
        apply_catalog_migration_metadata,
    )

    first_at = datetime(2026, 7, 26, 8, 0, tzinfo=timezone.utc)
    first = apply_catalog_migration_metadata(
        catalog_db,
        owner_user_id="owner-a",
        candidates=(
            _candidate(
                "private-document",
                name="Imported document",
            ),
        ),
        applied_at=first_at,
    )
    catalog_db.commit()
    row = catalog_db.execute(select(TranscriptCatalogEntry)).scalar_one()
    first_id = row.id
    first_imported_at = row.imported_at

    second = apply_catalog_migration_metadata(
        catalog_db,
        owner_user_id="owner-a",
        candidates=(
            _candidate(
                "private-document",
                name="Renamed document",
            ),
        ),
        applied_at=first_at + timedelta(minutes=5),
    )
    catalog_db.commit()
    repeated = catalog_db.execute(
        select(TranscriptCatalogEntry)
    ).scalar_one()

    assert first["summary"]["imported_count"] == 1
    assert first["items"][0]["outcome"] == "imported"
    assert second["summary"]["already_applied_count"] == 1
    assert second["items"][0]["outcome"] == "already_applied"
    assert repeated.id == first_id
    assert repeated.imported_at == first_imported_at
    assert repeated.document_name == "Renamed document"
    encoded = json.dumps((first, second), ensure_ascii=False)
    assert "private-document" not in encoded
    assert "owner-a" not in encoded


def test_catalog_import_dry_run_is_unchanged_after_committed_apply(
    catalog_db,
):
    from studio_api.models import TranscriptCatalogEntry
    from studio_api.transcript_catalog_apply import (
        apply_transcript_catalog_import_metadata,
    )
    from studio_api.transcript_catalog_scan import (
        CatalogGoogleDocumentMetadata,
    )
    from studio_api.transcript_maintenance_dry_run import (
        TranscriptMaintenanceSelectionMode,
        build_transcript_catalog_import_dry_run,
        inspect_transcript_catalog_import_selection,
    )

    document_id = "private-lifecycle-document"
    current_text = (
        "Current\n\nTranscript metadata\n"
        "Provider: ElevenLabs\n"
        "Model: scribe_v2\n"
        "Language: ru\n"
        "Speakers: yes\n"
        "Created at: 2026-07-01T10:00:00Z\n\n"
        "Transcript\n\nprivate-body"
    )

    class Reader:
        def inspect_document(self, **kwargs):
            assert kwargs["document_id"] == document_id
            return CatalogGoogleDocumentMetadata(
                document_id,
                "Lifecycle document",
                "2026-07-01T10:00:00Z",
                "2026-07-02T10:00:00Z",
            )

        def read_document_text(self, **kwargs):
            assert kwargs["document_id"] == document_id
            return current_text

    target = {
        "owner_user_id": "owner-a",
        "access_token": "private-access-token",
        "selection_mode": TranscriptMaintenanceSelectionMode.single_document,
        "document_id": document_id,
        "reader": Reader(),
    }
    before = build_transcript_catalog_import_dry_run(
        catalog_db,
        **target,
    )
    inspection = inspect_transcript_catalog_import_selection(
        catalog_db,
        **target,
    )

    applied = apply_transcript_catalog_import_metadata(
        catalog_db,
        owner_user_id="owner-a",
        candidates=inspection.candidates,
    )
    catalog_db.commit()

    with Session(catalog_db.get_bind()) as fresh_db:
        after = build_transcript_catalog_import_dry_run(
            fresh_db,
            **target,
        )
        persisted_rows = fresh_db.execute(
            select(TranscriptCatalogEntry)
        ).scalars().all()

    assert before["items"][0]["action"] == "import_metadata"
    assert applied["items"][0]["outcome"] == "imported"
    assert after["items"][0] == {
        "position": 0,
        "name": "Lifecycle document",
        "standard_status": "current",
        "import_status": "imported_exact",
        "settings_status": "indeterminate",
        "action": "unchanged",
        "reason_code": None,
    }
    assert after["summary"]["import_metadata_count"] == 0
    assert after["summary"]["unchanged_count"] == 1
    assert len(persisted_rows) == 1
    encoded = json.dumps(after, ensure_ascii=False)
    assert document_id not in encoded
    assert "private-access-token" not in encoded


def test_catalog_metadata_apply_leaves_transaction_control_to_caller(
    catalog_db,
):
    from studio_api.models import TranscriptCatalogEntry
    from studio_api.transcript_catalog_apply import (
        apply_catalog_migration_metadata,
    )

    apply_catalog_migration_metadata(
        catalog_db,
        owner_user_id="owner-a",
        candidates=(_candidate("rollback-document"),),
    )
    assert catalog_db.execute(
        select(TranscriptCatalogEntry)
    ).scalar_one().document_id == "rollback-document"

    catalog_db.rollback()

    assert (
        catalog_db.execute(
            select(TranscriptCatalogEntry)
        ).scalars().all()
        == []
    )


def test_catalog_metadata_apply_persists_only_explicit_exact_authority(
    catalog_db,
):
    from studio_api.models import TranscriptCatalogEntry
    from studio_api.transcript_catalog import (
        CatalogSourceIdentity,
        CatalogSourceIdentityKind,
        elevenlabs_effective_settings,
    )
    from studio_api.transcript_catalog_apply import (
        CatalogApplyMetadata,
        apply_catalog_migration_metadata,
    )

    result = apply_catalog_migration_metadata(
        catalog_db,
        owner_user_id="owner-a",
        candidates=(
            _candidate(
                "exact-document",
                settings="exact",
            ),
        ),
        metadata_by_document_id={
            "exact-document": CatalogApplyMetadata(
                settings=elevenlabs_effective_settings(
                    language_mode="ru",
                    diarization_enabled=True,
                ),
                source_identity=CatalogSourceIdentity(
                    CatalogSourceIdentityKind.google_drive_file,
                    "exact-source-file",
                ),
            )
        },
    )
    apply_catalog_migration_metadata(
        catalog_db,
        owner_user_id="owner-b",
        candidates=(_candidate("exact-document"),),
    )
    catalog_db.commit()

    rows = catalog_db.execute(
        select(TranscriptCatalogEntry).order_by(
            TranscriptCatalogEntry.owner_user_id
        )
    ).scalars().all()
    assert result["items"][0]["outcome"] == "imported"
    assert len(rows) == 2
    exact = rows[0]
    assert (
        exact.provider,
        exact.model,
        exact.language_mode,
        exact.diarization_enabled,
        exact.source_identity_kind.value,
        exact.source_identity_value,
    ) == (
        "elevenlabs",
        "scribe_v2",
        "ru",
        True,
        "google_drive_file",
        "exact-source-file",
    )
    assert rows[1].settings_status.value == "indeterminate"
    assert rows[1].source_identity_kind is None


def test_catalog_metadata_apply_does_not_overwrite_authority(catalog_db):
    from studio_api.transcript_catalog import (
        elevenlabs_effective_settings,
    )
    from studio_api.transcript_catalog_apply import (
        CatalogApplyMetadata,
        apply_catalog_migration_metadata,
    )

    apply_catalog_migration_metadata(
        catalog_db,
        owner_user_id="owner-a",
        candidates=(_candidate("conflict-document"),),
    )
    catalog_db.commit()

    result = apply_catalog_migration_metadata(
        catalog_db,
        owner_user_id="owner-a",
        candidates=(
            _candidate(
                "conflict-document",
                settings="exact",
            ),
        ),
        metadata_by_document_id={
            "conflict-document": CatalogApplyMetadata(
                settings=elevenlabs_effective_settings(
                    language_mode="detect",
                    diarization_enabled=False,
                )
            )
        },
    )
    catalog_db.commit()

    assert result["items"] == [
        {
            "position": 0,
            "name": "Document",
            "action": "import_metadata",
            "outcome": "conflict",
            "reason_code": "catalog_metadata_conflict",
        }
    ]
    assert result["summary"]["conflict_count"] == 1


def test_catalog_metadata_apply_detects_stale_conflict_before_standardization(
    catalog_db,
):
    from studio_api.transcript_catalog import (
        elevenlabs_effective_settings,
    )
    from studio_api.transcript_catalog_apply import (
        CatalogApplyMetadata,
        apply_catalog_migration_metadata,
    )

    apply_catalog_migration_metadata(
        catalog_db,
        owner_user_id="owner-a",
        candidates=(_candidate("stale-legacy-document"),),
    )
    catalog_db.commit()

    result = apply_catalog_migration_metadata(
        catalog_db,
        owner_user_id="owner-a",
        candidates=(
            _candidate(
                "stale-legacy-document",
                standard="outdated",
                settings="exact",
            ),
        ),
        metadata_by_document_id={
            "stale-legacy-document": CatalogApplyMetadata(
                settings=elevenlabs_effective_settings(
                    language_mode="ru",
                    diarization_enabled=True,
                )
            )
        },
    )

    assert result["items"][0] == {
        "position": 0,
        "name": "Document",
        "action": "standardize_and_import",
        "outcome": "conflict",
        "reason_code": "catalog_metadata_conflict",
    }


def test_catalog_metadata_apply_defers_standardization_and_blocks_unsafe_rows(
    catalog_db,
):
    from studio_api.models import TranscriptCatalogEntry
    from studio_api.transcript_catalog_apply import (
        apply_catalog_migration_metadata,
    )

    result = apply_catalog_migration_metadata(
        catalog_db,
        owner_user_id="owner-a",
        candidates=(
            _candidate(
                "legacy-unimported",
                standard="outdated",
            ),
            _candidate(
                "legacy-output",
                standard="unstructured",
                imported="imported_exact",
            ),
            _candidate(
                "unreadable",
                standard="unreadable",
            ),
            _candidate(
                "accepted-current",
                imported="imported_exact",
                settings="exact",
            ),
        ),
    )

    assert [
        (item["outcome"], item["reason_code"])
        for item in result["items"]
    ] == [
        ("standardization_required", "standardization_required"),
        ("standardization_required", "standardization_required"),
        ("blocked", "document_unreadable"),
        ("unchanged", None),
    ]
    assert result["summary"]["standardization_required_count"] == 2
    assert result["summary"]["blocked_count"] == 1
    assert result["summary"]["unchanged_count"] == 1
    assert (
        catalog_db.execute(
            select(TranscriptCatalogEntry)
        ).scalars().all()
        == []
    )


def test_catalog_metadata_apply_rejects_missing_or_out_of_scope_authority(
    catalog_db,
):
    from studio_api.transcript_catalog import (
        elevenlabs_effective_settings,
    )
    from studio_api.transcript_catalog_apply import (
        CatalogApplyMetadata,
        apply_catalog_migration_metadata,
    )

    exact_candidate = _candidate(
        "exact-document",
        settings="exact",
    )
    with pytest.raises(ValueError, match="Exact catalog settings"):
        apply_catalog_migration_metadata(
            catalog_db,
            owner_user_id="owner-a",
            candidates=(exact_candidate,),
        )
    with pytest.raises(ValueError, match="out of scope"):
        apply_catalog_migration_metadata(
            catalog_db,
            owner_user_id="owner-a",
            candidates=(exact_candidate,),
            metadata_by_document_id={
                "other-document": CatalogApplyMetadata()
            },
        )
    with pytest.raises(ValueError, match="cannot include exact"):
        apply_catalog_migration_metadata(
            catalog_db,
            owner_user_id="owner-a",
            candidates=(_candidate("indeterminate-document"),),
            metadata_by_document_id={
                "indeterminate-document": CatalogApplyMetadata(
                    settings=elevenlabs_effective_settings(
                        language_mode="ru",
                        diarization_enabled=False,
                    )
                )
            },
        )


def test_split_catalog_import_apply_persists_only_eligible_current_metadata(
    catalog_db,
):
    from studio_api.models import TranscriptCatalogEntry
    from studio_api.transcript_catalog_apply import (
        apply_transcript_catalog_import_metadata,
    )

    result = apply_transcript_catalog_import_metadata(
        catalog_db,
        owner_user_id="owner-a",
        candidates=(
            _candidate("private-current", name="Current"),
            _candidate(
                "private-outdated",
                name="Outdated",
                standard="outdated",
            ),
            _candidate(
                "private-unreadable",
                name="Unreadable",
                standard="unreadable",
            ),
            _candidate(
                "private-existing-output",
                name="Existing",
                imported="imported_exact",
                settings="exact",
            ),
        ),
        applied_at=datetime(2026, 7, 27, 10, 0, tzinfo=timezone.utc),
    )

    assert result["workflow"] == "catalog_import"
    assert result["operation"] == "apply"
    assert [
        (
            item["action"],
            item["outcome"],
            item["reason_code"],
        )
        for item in result["items"]
    ] == [
        ("import_metadata", "imported", None),
        ("blocked", "blocked", "standardization_required"),
        ("blocked", "blocked", "document_unreadable"),
        ("unchanged", "unchanged", None),
    ]
    assert result["summary"]["imported_count"] == 1
    assert result["summary"]["blocked_count"] == 2
    assert result["summary"]["unchanged_count"] == 1
    rows = catalog_db.execute(
        select(TranscriptCatalogEntry)
    ).scalars().all()
    assert [row.document_id for row in rows] == ["private-current"]
    encoded = json.dumps(result, ensure_ascii=False)
    assert "standardize_document" not in encoded
    assert "standardize_and_import" not in encoded
    for private in (
        "private-current",
        "private-outdated",
        "private-unreadable",
        "private-existing-output",
    ):
        assert private not in encoded


def test_split_catalog_import_apply_is_idempotent_without_google_capability(
    catalog_db,
):
    import inspect

    from studio_api.transcript_catalog_apply import (
        apply_transcript_catalog_import_metadata,
    )

    parameters = inspect.signature(
        apply_transcript_catalog_import_metadata
    ).parameters
    assert "access_token" not in parameters
    assert "standardizer" not in parameters

    candidate = _candidate("private-repeat", name="Repeat")
    first = apply_transcript_catalog_import_metadata(
        catalog_db,
        owner_user_id="owner-a",
        candidates=(candidate,),
    )
    second = apply_transcript_catalog_import_metadata(
        catalog_db,
        owner_user_id="owner-a",
        candidates=(candidate,),
    )

    assert first["items"][0]["outcome"] == "imported"
    assert second["items"][0]["outcome"] == "already_applied"

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


def test_catalog_import_authority_is_owner_scoped_and_fail_closed():
    from studio_api.transcript_catalog_dry_run import (
        classify_catalog_import_authorities,
    )

    authorities = classify_catalog_import_authorities(
        owner_user_id="owner-user",
        document_ids=(
            "owner-current",
            "owner-unknown-settings",
            "other-owner",
            "not-imported",
            "duplicate-evidence",
        ),
        rows=(
            (
                "owner-current",
                "owner-user",
                "elevenlabs",
                "elevenlabs",
                "ru",
                '{"diarize":true}',
            ),
            (
                "owner-unknown-settings",
                "owner-user",
                "unknown-provider",
                None,
                "ru",
                None,
            ),
            (
                "other-owner",
                "other-user",
                "elevenlabs",
                "elevenlabs",
                "ru",
                None,
            ),
            (
                "duplicate-evidence",
                "owner-user",
                "elevenlabs",
                "elevenlabs",
                "ru",
                None,
            ),
            (
                "duplicate-evidence",
                "owner-user",
                "elevenlabs",
                "elevenlabs",
                "ru",
                None,
            ),
        ),
    )

    assert {
        key: (
            value.import_status.value,
            value.settings_status.value,
        )
        for key, value in authorities.items()
    } == {
        "owner-current": ("imported_exact", "exact"),
        "owner-unknown-settings": (
            "imported_exact",
            "indeterminate",
        ),
        "other-owner": ("conflict", "indeterminate"),
        "not-imported": ("not_imported", "indeterminate"),
        "duplicate-evidence": ("conflict", "indeterminate"),
    }


def test_persisted_catalog_authority_makes_repeated_dry_run_unchanged():
    from studio_api.transcript_catalog_dry_run import (
        classify_catalog_import_authorities,
        classify_persisted_catalog_authorities,
        reconcile_catalog_import_authorities,
    )

    document_ids = ("private-imported-document",)
    output_authorities = classify_catalog_import_authorities(
        owner_user_id="owner-user",
        document_ids=document_ids,
        rows=(),
    )
    catalog_authorities = classify_persisted_catalog_authorities(
        owner_user_id="owner-user",
        document_ids=document_ids,
        rows=(
            (
                "private-imported-document",
                "owner-user",
                "indeterminate",
                None,
                None,
                None,
                None,
            ),
        ),
    )

    reconciled = reconcile_catalog_import_authorities(
        document_ids=document_ids,
        output_authorities=output_authorities,
        catalog_authorities=catalog_authorities,
    )

    authority = reconciled["private-imported-document"]
    assert authority.import_status.value == "imported_exact"
    assert authority.settings_status.value == "indeterminate"


def test_catalog_and_output_authority_disagreement_fails_closed():
    from studio_api.transcript_catalog import EffectiveTranscriptionSettings
    from studio_api.transcript_catalog_dry_run import (
        CatalogImportAuthority,
        reconcile_catalog_import_authorities,
    )
    from studio_api.transcript_catalog_migration import (
        CatalogImportAuthorityStatus,
        CatalogSettingsAuthorityStatus,
    )

    document_ids = ("private-conflicting-document",)
    output_authorities = {
        "private-conflicting-document": CatalogImportAuthority(
            CatalogImportAuthorityStatus.imported_exact,
            CatalogSettingsAuthorityStatus.exact,
            EffectiveTranscriptionSettings(
                provider="elevenlabs",
                model="scribe_v2",
                language_mode="ru",
                diarization_enabled=True,
            ),
        )
    }
    catalog_authorities = {
        "private-conflicting-document": CatalogImportAuthority(
            CatalogImportAuthorityStatus.imported_exact,
            CatalogSettingsAuthorityStatus.exact,
            EffectiveTranscriptionSettings(
                provider="elevenlabs",
                model="scribe_v2",
                language_mode="detect",
                diarization_enabled=True,
            ),
        )
    }

    reconciled = reconcile_catalog_import_authorities(
        document_ids=document_ids,
        output_authorities=output_authorities,
        catalog_authorities=catalog_authorities,
    )

    authority = reconciled["private-conflicting-document"]
    assert authority.import_status.value == "conflict"
    assert authority.settings_status.value == "indeterminate"


def test_incoherent_catalog_authority_fails_closed():
    from studio_api.transcript_catalog_dry_run import (
        CatalogImportAuthority,
        reconcile_catalog_import_authorities,
    )
    from studio_api.transcript_catalog_migration import (
        CatalogImportAuthorityStatus,
        CatalogSettingsAuthorityStatus,
    )

    document_ids = ("private-incoherent-document",)
    reconciled = reconcile_catalog_import_authorities(
        document_ids=document_ids,
        output_authorities={
            "private-incoherent-document": CatalogImportAuthority(
                CatalogImportAuthorityStatus.not_imported,
                CatalogSettingsAuthorityStatus.indeterminate,
            )
        },
        catalog_authorities={
            "private-incoherent-document": CatalogImportAuthority(
                CatalogImportAuthorityStatus.imported_exact,
                CatalogSettingsAuthorityStatus.exact,
            )
        },
    )

    authority = reconciled["private-incoherent-document"]
    assert authority.import_status.value == "conflict"
    assert authority.settings_status.value == "indeterminate"


def test_persisted_catalog_authority_rejects_ambiguous_or_malformed_rows():
    from studio_api.transcript_catalog_dry_run import (
        classify_persisted_catalog_authorities,
    )

    authorities = classify_persisted_catalog_authorities(
        owner_user_id="owner-user",
        document_ids=("duplicate", "malformed", "other-owner"),
        rows=(
            ("duplicate", "owner-user", "indeterminate", None, None, None, None),
            ("duplicate", "owner-user", "indeterminate", None, None, None, None),
            (
                "malformed",
                "owner-user",
                "indeterminate",
                "unexpected-provider",
                None,
                None,
                None,
            ),
            (
                "other-owner",
                "other-user",
                "indeterminate",
                None,
                None,
                None,
                None,
            ),
        ),
    )

    assert {
        document_id: authority.import_status.value
        for document_id, authority in authorities.items()
    } == {
        "duplicate": "conflict",
        "malformed": "conflict",
        "other-owner": "conflict",
    }


def test_catalog_dry_run_combines_scan_authority_and_safe_payload():
    from studio_api.transcript_catalog_dry_run import (
        CatalogImportAuthority,
        build_catalog_migration_dry_run,
    )
    from studio_api.transcript_catalog_migration import (
        CatalogImportAuthorityStatus,
        CatalogSettingsAuthorityStatus,
    )
    from studio_api.transcript_catalog_scan import (
        CatalogGoogleDocumentMetadata,
        CatalogGoogleFolderScan,
        CatalogGoogleReadError,
        CatalogGoogleReadReason,
    )

    current_text = (
        "Current\n\nTranscript metadata\n"
        "Provider: ElevenLabs\n"
        "Model: scribe_v2\n"
        "Language: ru\n"
        "Speakers: yes\n"
        "Created at: 2026-07-01 10:00 UTC\n\n"
        "Transcript\n\nprivate-current-body"
    )
    outdated_text = (
        "Legacy\n\nTranscript metadata\n"
        "Source file: legacy.mp3\n"
        "Provider: ElevenLabs\n\n"
        "Transcript\n\nprivate-legacy-body"
    )

    class Reader:
        def scan_folder(self, **kwargs):
            assert kwargs == {
                "access_token": "private-access-token",
                "folder_id": "private-folder-id",
            }
            return CatalogGoogleFolderScan(
                documents=(
                    CatalogGoogleDocumentMetadata(
                        "current-document",
                        "Current",
                        None,
                        None,
                    ),
                    CatalogGoogleDocumentMetadata(
                        "legacy-document",
                        "Legacy",
                        None,
                        None,
                    ),
                    CatalogGoogleDocumentMetadata(
                        "missing-document",
                        "Missing",
                        None,
                        None,
                    ),
                ),
                nested_folder_count=2,
                skipped_non_document_count=3,
                pages_scanned=1,
            )

        def read_document_text(self, **kwargs):
            assert kwargs["access_token"] == "private-access-token"
            if kwargs["document_id"] == "current-document":
                return current_text
            if kwargs["document_id"] == "legacy-document":
                return outdated_text
            raise CatalogGoogleReadError(
                CatalogGoogleReadReason.document_not_found
            )

    authority_calls = []

    def authority_loader(db, *, owner_user_id, document_ids):
        authority_calls.append((db, owner_user_id, document_ids))
        return {
            "current-document": CatalogImportAuthority(
                CatalogImportAuthorityStatus.imported_exact,
                CatalogSettingsAuthorityStatus.exact,
            ),
            "legacy-document": CatalogImportAuthority(
                CatalogImportAuthorityStatus.not_imported,
                CatalogSettingsAuthorityStatus.indeterminate,
            ),
            "missing-document": CatalogImportAuthority(
                CatalogImportAuthorityStatus.not_imported,
                CatalogSettingsAuthorityStatus.indeterminate,
            ),
        }

    db = object()
    payload = build_catalog_migration_dry_run(
        db,
        owner_user_id="owner-user",
        access_token="private-access-token",
        folder_id="private-folder-id",
        reader=Reader(),
        authority_loader=authority_loader,
    )

    assert authority_calls == [
        (
            db,
            "owner-user",
            (
                "current-document",
                "legacy-document",
                "missing-document",
            ),
        )
    ]
    assert payload["operation"] == "dry_run"
    assert [
        (
            item["name"],
            item["standard_status"],
            item["import_status"],
            item["settings_status"],
            item["action"],
            item["reason_code"],
        )
        for item in payload["items"]
    ] == [
        (
            "Current",
            "current",
            "imported_exact",
            "exact",
            "unchanged",
            None,
        ),
        (
            "Legacy",
            "outdated",
            "not_imported",
            "indeterminate",
            "standardize_and_import",
            None,
        ),
        (
            "Missing",
            "unreadable",
            "not_imported",
            "indeterminate",
            "blocked",
            "document_unreadable",
        ),
    ]
    assert payload["scan_summary"] == {
        "google_document_count": 3,
        "nested_folder_count": 2,
        "skipped_non_document_count": 3,
        "unreadable_document_count": 1,
        "pages_scanned": 1,
    }
    encoded = json.dumps(payload, ensure_ascii=False)
    for forbidden in (
        "current-document",
        "legacy-document",
        "missing-document",
        "private-current-body",
        "private-legacy-body",
        "private-access-token",
        "private-folder-id",
        "owner-user",
    ):
        assert forbidden not in encoded


def test_catalog_dry_run_aborts_on_connection_wide_google_failure():
    from studio_api.transcript_catalog_dry_run import (
        CatalogImportAuthority,
        build_catalog_migration_dry_run,
    )
    from studio_api.transcript_catalog_migration import (
        CatalogImportAuthorityStatus,
        CatalogSettingsAuthorityStatus,
    )
    from studio_api.transcript_catalog_scan import (
        CatalogGoogleDocumentMetadata,
        CatalogGoogleFolderScan,
        CatalogGoogleReadError,
        CatalogGoogleReadReason,
    )

    class Reader:
        def scan_folder(self, **kwargs):
            return CatalogGoogleFolderScan(
                documents=(
                    CatalogGoogleDocumentMetadata(
                        "private-document",
                        "Document",
                        None,
                        None,
                    ),
                ),
                nested_folder_count=0,
                skipped_non_document_count=0,
                pages_scanned=1,
            )

        def read_document_text(self, **kwargs):
            raise CatalogGoogleReadError(
                CatalogGoogleReadReason.authentication_rejected
            )

    authority = CatalogImportAuthority(
        CatalogImportAuthorityStatus.not_imported,
        CatalogSettingsAuthorityStatus.indeterminate,
    )

    with pytest.raises(CatalogGoogleReadError) as raised:
        build_catalog_migration_dry_run(
            object(),
            owner_user_id="owner-user",
            access_token="private-access-token",
            folder_id="private-folder-id",
            reader=Reader(),
            authority_loader=lambda *args, **kwargs: {
                "private-document": authority
            },
        )

    assert (
        raised.value.reason
        == CatalogGoogleReadReason.authentication_rejected
    )


def test_catalog_dry_run_requires_exact_authority_coverage():
    from studio_api.transcript_catalog_dry_run import (
        build_catalog_migration_dry_run,
    )
    from studio_api.transcript_catalog_scan import (
        CatalogGoogleDocumentMetadata,
        CatalogGoogleFolderScan,
    )

    class Reader:
        def scan_folder(self, **kwargs):
            return CatalogGoogleFolderScan(
                documents=(
                    CatalogGoogleDocumentMetadata(
                        "private-document",
                        "Document",
                        None,
                        None,
                    ),
                ),
                nested_folder_count=0,
                skipped_non_document_count=0,
                pages_scanned=1,
            )

    with pytest.raises(ValueError, match="coverage"):
        build_catalog_migration_dry_run(
            object(),
            owner_user_id="owner-user",
            access_token="private-access-token",
            folder_id="private-folder-id",
            reader=Reader(),
            authority_loader=lambda *args, **kwargs: {},
        )


def test_catalog_folder_inspection_repr_redacts_private_evidence():
    from studio_api.transcript_catalog_dry_run import (
        CatalogMigrationFolderInspection,
    )

    inspection = CatalogMigrationFolderInspection(
        candidates=("private-candidate",),
        created_time_by_document_id={
            "private-document": "2026-07-01T00:00:00Z"
        },
        scan_summary={"google_document_count": 1},
    )

    rendered = repr(inspection)
    assert "candidate_count=1" in rendered
    assert "google_document_count" in rendered
    assert "private-candidate" not in rendered
    assert "private-document" not in rendered

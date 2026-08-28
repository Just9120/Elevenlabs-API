from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


def candidate(
    document_id: str,
    *,
    name: str | None = "Safe document",
    standard: str = "current",
    imported: str = "not_imported",
    settings: str = "exact",
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


def test_catalog_migration_contract_is_explicit_ordered_and_browser_safe():
    from studio_api.transcript_catalog_migration import (
        CatalogMigrationOperation,
        build_catalog_migration_payload,
    )

    candidates = (
        candidate("private-current", name="Current"),
        candidate(
            "private-outdated",
            name="Outdated",
            standard="outdated",
            settings="indeterminate",
        ),
        candidate(
            "private-unstructured-imported",
            name="Unstructured",
            standard="unstructured",
            imported="imported_exact",
            settings="indeterminate",
        ),
        candidate(
            "private-unchanged",
            name="Already imported",
            imported="imported_exact",
        ),
        candidate(
            "private-conflict",
            name="Conflict",
            imported="conflict",
        ),
        candidate(
            "private-unreadable",
            name=None,
            standard="unreadable",
            settings="indeterminate",
        ),
    )

    payload = build_catalog_migration_payload(
        operation=CatalogMigrationOperation.dry_run,
        candidates=candidates,
    )

    assert payload == {
        "operation": "dry_run",
        "target_standard": "transcript_doc",
        "items": [
            {
                "position": 0,
                "name": "Current",
                "standard_status": "current",
                "import_status": "not_imported",
                "settings_status": "exact",
                "action": "import_metadata",
                "reason_code": None,
            },
            {
                "position": 1,
                "name": "Outdated",
                "standard_status": "outdated",
                "import_status": "not_imported",
                "settings_status": "indeterminate",
                "action": "standardize_and_import",
                "reason_code": None,
            },
            {
                "position": 2,
                "name": "Unstructured",
                "standard_status": "unstructured",
                "import_status": "imported_exact",
                "settings_status": "indeterminate",
                "action": "standardize_document",
                "reason_code": None,
            },
            {
                "position": 3,
                "name": "Already imported",
                "standard_status": "current",
                "import_status": "imported_exact",
                "settings_status": "exact",
                "action": "unchanged",
                "reason_code": None,
            },
            {
                "position": 4,
                "name": "Conflict",
                "standard_status": "current",
                "import_status": "conflict",
                "settings_status": "exact",
                "action": "blocked",
                "reason_code": "catalog_conflict",
            },
            {
                "position": 5,
                "name": "Документ Google Docs",
                "standard_status": "unreadable",
                "import_status": "not_imported",
                "settings_status": "indeterminate",
                "action": "blocked",
                "reason_code": "document_unreadable",
            },
        ],
        "summary": {
            "import_metadata_count": 1,
            "standardize_and_import_count": 1,
            "standardize_document_count": 1,
            "unchanged_count": 1,
            "blocked_count": 2,
        },
    }
    encoded = json.dumps(payload, ensure_ascii=False)
    for private_id in (
        "private-current",
        "private-outdated",
        "private-unstructured-imported",
        "private-unchanged",
        "private-conflict",
        "private-unreadable",
    ):
        assert private_id not in encoded
    assert "drive_document_id" not in encoded


def test_catalog_migration_apply_uses_same_allowlisted_plan_shape():
    from studio_api.transcript_catalog_migration import (
        CatalogMigrationOperation,
        build_catalog_migration_payload,
    )

    payload = build_catalog_migration_payload(
        operation=CatalogMigrationOperation.apply,
        candidates=(candidate("private-document"),),
    )

    assert payload["operation"] == "apply"
    assert payload["items"][0]["action"] == "import_metadata"
    assert set(payload["items"][0]) == {
        "position",
        "name",
        "standard_status",
        "import_status",
        "settings_status",
        "action",
        "reason_code",
    }


def test_catalog_migration_contract_rejects_duplicate_or_missing_identity():
    from studio_api.transcript_catalog_migration import (
        CatalogMigrationOperation,
        build_catalog_migration_payload,
    )

    with pytest.raises(ValueError, match="unique"):
        build_catalog_migration_payload(
            operation=CatalogMigrationOperation.dry_run,
            candidates=(candidate("same"), candidate("same")),
        )
    with pytest.raises(ValueError, match="identity"):
        build_catalog_migration_payload(
            operation=CatalogMigrationOperation.dry_run,
            candidates=(candidate(" "),),
        )


def test_catalog_migration_contract_rejects_untyped_authority_values():
    from dataclasses import replace

    from studio_api.transcript_catalog_migration import (
        CatalogMigrationOperation,
        build_catalog_migration_payload,
    )

    invalid = replace(candidate("private-document"), standard_status="current")

    with pytest.raises(ValueError, match="StandardStatus"):
        build_catalog_migration_payload(
            operation=CatalogMigrationOperation.dry_run,
            candidates=(invalid,),
        )
    with pytest.raises(ValueError, match="Operation"):
        build_catalog_migration_payload(
            operation="dry_run",
            candidates=(candidate("private-document"),),
        )


def test_catalog_migration_candidate_repr_hides_private_drive_identity():
    projection = candidate("private-drive-document")

    assert "private-drive-document" not in repr(projection)


def test_standardization_plan_contains_no_catalog_action_or_private_identity():
    from studio_api.transcript_catalog_migration import (
        CatalogDocumentStandardStatus,
        CatalogMigrationOperation,
        TranscriptStandardizationCandidate,
        build_transcript_standardization_payload,
    )
    from studio_api.source_creation_authority import (
        SourceCreationAuthorityStatus,
    )

    payload = build_transcript_standardization_payload(
        operation=CatalogMigrationOperation.dry_run,
        candidates=(
            TranscriptStandardizationCandidate(
                drive_document_id="private-outdated",
                name="Outdated",
                standard_status=CatalogDocumentStandardStatus.outdated,
                source_creation_status=(
                    SourceCreationAuthorityStatus.authoritative
                ),
            ),
            TranscriptStandardizationCandidate(
                drive_document_id="private-current",
                name="Current",
                standard_status=CatalogDocumentStandardStatus.current,
                source_creation_status=(
                    SourceCreationAuthorityStatus.authoritative
                ),
            ),
            TranscriptStandardizationCandidate(
                drive_document_id="private-unreadable",
                name="Unreadable",
                standard_status=CatalogDocumentStandardStatus.unreadable,
                source_creation_status=(
                    SourceCreationAuthorityStatus.unavailable
                ),
            ),
        ),
    )

    assert payload["workflow"] == "standardization"
    assert [item["action"] for item in payload["items"]] == [
        "standardize_document",
        "unchanged",
        "blocked",
    ]
    assert payload["summary"] == {
        "standardize_document_count": 1,
        "unchanged_count": 1,
        "blocked_count": 1,
    }
    encoded = json.dumps(payload, ensure_ascii=False)
    assert "import_metadata" not in encoded
    assert "standardize_and_import" not in encoded
    assert "private-outdated" not in encoded


def test_catalog_import_plan_requires_current_docs_and_has_no_google_action():
    from studio_api.transcript_catalog_migration import (
        CatalogMigrationOperation,
        build_transcript_catalog_import_payload,
    )

    payload = build_transcript_catalog_import_payload(
        operation=CatalogMigrationOperation.dry_run,
        candidates=(
            candidate("private-current", name="Current"),
            candidate(
                "private-outdated",
                name="Outdated",
                standard="outdated",
            ),
            candidate(
                "private-existing",
                name="Existing",
                imported="imported_exact",
            ),
            candidate(
                "private-conflict",
                name="Conflict",
                imported="conflict",
            ),
        ),
    )

    assert payload["workflow"] == "catalog_import"
    assert [
        (item["action"], item["reason_code"])
        for item in payload["items"]
    ] == [
        ("import_metadata", None),
        ("blocked", "standardization_required"),
        ("unchanged", None),
        ("blocked", "catalog_conflict"),
    ]
    assert payload["summary"] == {
        "import_metadata_count": 1,
        "unchanged_count": 1,
        "blocked_count": 2,
    }
    encoded = json.dumps(payload, ensure_ascii=False)
    assert "standardize_document" not in encoded
    assert "standardize_and_import" not in encoded
    assert "private-current" not in encoded


@pytest.mark.parametrize(
    "unsafe_name",
    (
        "private-drive-document",
        "https://docs.google.com/document/d/private-drive-document/edit",
        "https://drive.google.com/open?id=private-drive-document",
    ),
)
def test_catalog_migration_payload_rejects_private_identity_as_display_name(
    unsafe_name,
):
    from studio_api.transcript_catalog_migration import (
        CatalogMigrationOperation,
        build_catalog_migration_payload,
    )

    payload = build_catalog_migration_payload(
        operation=CatalogMigrationOperation.dry_run,
        candidates=(candidate("private-drive-document", name=unsafe_name),),
    )

    assert payload["items"][0]["name"] == "Документ Google Docs"
    assert "private-drive-document" not in json.dumps(payload, ensure_ascii=False)

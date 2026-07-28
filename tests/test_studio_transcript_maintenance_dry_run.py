from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


def _current_text(marker: str) -> str:
    return (
        "Current\n\nTranscript metadata\n"
        "Provider: ElevenLabs\n"
        "Model: scribe_v2\n"
        "Language: ru\n"
        "Speakers: yes\n"
        "Created at: 2026-07-01 10:00 UTC\n\n"
        f"Transcript\n\n{marker}"
    )


def _outdated_text(marker: str) -> str:
    return (
        "Legacy\n\nTranscript metadata\n"
        "Source file: legacy.mp3\n"
        "Provider: ElevenLabs\n\n"
        f"Transcript\n\n{marker}"
    )


class RecursiveReader:
    def __init__(
        self,
        *,
        documents,
        texts,
        nested_folder_count=2,
        skipped_non_document_count=1,
        pages_scanned=3,
    ):
        self.documents = documents
        self.texts = texts
        self.nested_folder_count = nested_folder_count
        self.skipped_non_document_count = skipped_non_document_count
        self.pages_scanned = pages_scanned
        self.calls = []

    def scan_folder(self, **kwargs):
        from studio_api.transcript_catalog_scan import (
            CatalogGoogleFolderScan,
        )

        self.calls.append(("scan", kwargs))
        return CatalogGoogleFolderScan(
            documents=self.documents,
            nested_folder_count=self.nested_folder_count,
            skipped_non_document_count=self.skipped_non_document_count,
            pages_scanned=self.pages_scanned,
        )

    def read_document_text(self, **kwargs):
        self.calls.append(("read", kwargs))
        value = self.texts[kwargs["document_id"]]
        if isinstance(value, Exception):
            raise value
        return value

    def inspect_document(self, **kwargs):
        from studio_api.transcript_catalog_scan import (
            CatalogGoogleReadError,
            CatalogGoogleReadReason,
        )

        self.calls.append(("inspect", kwargs))
        for document in self.documents:
            if document.drive_document_id == kwargs["document_id"]:
                return document
        raise CatalogGoogleReadError(
            CatalogGoogleReadReason.document_not_found
        )


def _document(document_id: str, name: str):
    from studio_api.transcript_catalog_scan import (
        CatalogGoogleDocumentMetadata,
    )

    return CatalogGoogleDocumentMetadata(
        document_id,
        name,
        "2026-07-01T10:00:00Z",
        "2026-07-02T10:00:00Z",
    )


def test_standardization_dry_run_has_no_catalog_authority_or_import_action():
    from studio_api.transcript_catalog_scan import (
        CatalogGoogleReadError,
        CatalogGoogleReadReason,
    )
    from studio_api.transcript_maintenance_dry_run import (
        build_transcript_standardization_dry_run,
    )

    reader = RecursiveReader(
        documents=(
            _document("private-current", "Current"),
            _document("private-outdated", "Outdated"),
            _document("private-unreadable", "Unreadable"),
        ),
        texts={
            "private-current": _current_text("private-current-body"),
            "private-outdated": _outdated_text("private-outdated-body"),
            "private-unreadable": CatalogGoogleReadError(
                CatalogGoogleReadReason.document_not_found
            ),
        },
    )

    payload = build_transcript_standardization_dry_run(
        access_token="private-access-token",
        selection_mode="folder_tree",
        folder_id="private-folder",
        reader=reader,
    )

    assert payload["workflow"] == "standardization"
    assert [item["action"] for item in payload["items"]] == [
        "unchanged",
        "standardize_document",
        "blocked",
    ]
    assert payload["selection_summary"] == {
        "google_document_count": 3,
        "nested_folder_count": 2,
        "skipped_non_document_count": 1,
        "pages_scanned": 3,
        "unreadable_document_count": 1,
    }
    assert reader.calls[0] == (
        "scan",
        {
            "access_token": "private-access-token",
            "folder_id": "private-folder",
        },
    )
    encoded = json.dumps(payload, ensure_ascii=False)
    assert "import_metadata" not in encoded
    assert "settings_status" not in encoded
    for private in (
        "private-access-token",
        "private-folder",
        "private-current",
        "private-outdated",
        "private-unreadable",
        "private-current-body",
        "private-outdated-body",
    ):
        assert private not in encoded


def test_catalog_import_dry_run_is_recursive_and_has_no_google_action():
    from studio_api.transcript_catalog_dry_run import (
        CatalogImportAuthority,
    )
    from studio_api.transcript_catalog_migration import (
        CatalogImportAuthorityStatus,
        CatalogSettingsAuthorityStatus,
    )
    from studio_api.transcript_maintenance_dry_run import (
        build_transcript_catalog_import_dry_run,
    )

    reader = RecursiveReader(
        documents=(
            _document("private-current", "Current"),
            _document("private-outdated", "Outdated"),
        ),
        texts={
            "private-current": _current_text("private-current-body"),
            "private-outdated": _outdated_text("private-outdated-body"),
        },
    )
    authority_calls = []

    def load_authority(db, *, owner_user_id, document_ids):
        authority_calls.append((db, owner_user_id, document_ids))
        return {
            "private-current": CatalogImportAuthority(
                CatalogImportAuthorityStatus.not_imported,
                CatalogSettingsAuthorityStatus.indeterminate,
            ),
            "private-outdated": CatalogImportAuthority(
                CatalogImportAuthorityStatus.not_imported,
                CatalogSettingsAuthorityStatus.indeterminate,
            ),
        }

    db = object()
    payload = build_transcript_catalog_import_dry_run(
        db,
        owner_user_id="private-owner",
        access_token="private-access-token",
        selection_mode="folder_tree",
        folder_id="private-folder",
        reader=reader,
        authority_loader=load_authority,
    )

    assert authority_calls == [
        (
            db,
            "private-owner",
            ("private-current", "private-outdated"),
        )
    ]
    assert payload["workflow"] == "catalog_import"
    assert [
        (item["action"], item["reason_code"])
        for item in payload["items"]
    ] == [
        ("import_metadata", None),
        ("blocked", "standardization_required"),
    ]
    assert payload["selection_summary"] == {
        "google_document_count": 2,
        "nested_folder_count": 2,
        "skipped_non_document_count": 1,
        "pages_scanned": 3,
        "unreadable_document_count": 0,
    }
    encoded = json.dumps(payload, ensure_ascii=False)
    assert "standardize_document" not in encoded
    assert "standardize_and_import" not in encoded
    for private in (
        "private-owner",
        "private-access-token",
        "private-folder",
        "private-current",
        "private-outdated",
        "private-current-body",
        "private-outdated-body",
    ):
        assert private not in encoded


def test_catalog_import_requires_exact_selected_authority_coverage():
    from studio_api.transcript_maintenance_dry_run import (
        build_transcript_catalog_import_dry_run,
    )

    reader = RecursiveReader(
        documents=(_document("private-document", "Document"),),
        texts={"private-document": _current_text("private-body")},
    )

    with pytest.raises(ValueError, match="coverage"):
        build_transcript_catalog_import_dry_run(
            object(),
            owner_user_id="private-owner",
            access_token="private-access-token",
            selection_mode="folder_tree",
            folder_id="private-folder",
            reader=reader,
            authority_loader=lambda *args, **kwargs: {},
        )


def test_dry_run_rejects_duplicate_recursive_scan_evidence():
    from studio_api.transcript_maintenance_dry_run import (
        build_transcript_standardization_dry_run,
    )

    reader = RecursiveReader(
        documents=(
            _document("private-first", "First"),
            _document("private-first", "Duplicate"),
        ),
        texts={"private-first": _current_text("private-body")},
    )

    with pytest.raises(ValueError, match="scan evidence"):
        build_transcript_standardization_dry_run(
            access_token="private-access-token",
            selection_mode="folder_tree",
            folder_id="private-folder",
            reader=reader,
        )


def test_empty_recursive_document_is_blocked_without_aborting_siblings():
    from studio_api.transcript_maintenance_dry_run import (
        build_transcript_standardization_dry_run,
    )

    reader = RecursiveReader(
        documents=(
            _document("private-empty", "Empty"),
            _document("private-current", "Current"),
        ),
        texts={
            "private-empty": "",
            "private-current": _current_text("private-body"),
        },
    )

    payload = build_transcript_standardization_dry_run(
        access_token="private-access-token",
        selection_mode="folder_tree",
        folder_id="private-folder",
        reader=reader,
    )

    assert [item["action"] for item in payload["items"]] == [
        "blocked",
        "unchanged",
    ]
    assert payload["selection_summary"]["unreadable_document_count"] == 1


def test_single_document_standardization_revalidates_only_selected_doc():
    from studio_api.transcript_maintenance_dry_run import (
        build_transcript_standardization_dry_run,
    )

    reader = RecursiveReader(
        documents=(_document("private-document", "Document"),),
        texts={"private-document": _outdated_text("private-body")},
    )

    payload = build_transcript_standardization_dry_run(
        access_token="private-access-token",
        selection_mode="single_document",
        document_id="private-document",
        reader=reader,
    )

    assert [item["action"] for item in payload["items"]] == [
        "standardize_document"
    ]
    assert payload["selection_summary"] == {
        "google_document_count": 1,
        "nested_folder_count": 0,
        "skipped_non_document_count": 0,
        "pages_scanned": 0,
        "unreadable_document_count": 0,
    }
    assert reader.calls == [
        (
            "inspect",
            {
                "access_token": "private-access-token",
                "document_id": "private-document",
            },
        ),
        (
            "read",
            {
                "access_token": "private-access-token",
                "document_id": "private-document",
            },
        ),
    ]
    encoded = json.dumps(payload, ensure_ascii=False)
    for private in (
        "private-access-token",
        "private-document",
        "private-body",
    ):
        assert private not in encoded


def test_single_document_catalog_import_uses_exact_selected_authority():
    from studio_api.transcript_catalog_dry_run import CatalogImportAuthority
    from studio_api.transcript_catalog_migration import (
        CatalogImportAuthorityStatus,
        CatalogSettingsAuthorityStatus,
    )
    from studio_api.transcript_maintenance_dry_run import (
        build_transcript_catalog_import_dry_run,
    )

    reader = RecursiveReader(
        documents=(_document("private-document", "Document"),),
        texts={"private-document": _current_text("private-body")},
    )
    authority_calls = []

    def load_authority(db, *, owner_user_id, document_ids):
        authority_calls.append((db, owner_user_id, document_ids))
        return {
            "private-document": CatalogImportAuthority(
                CatalogImportAuthorityStatus.not_imported,
                CatalogSettingsAuthorityStatus.indeterminate,
            )
        }

    db = object()
    payload = build_transcript_catalog_import_dry_run(
        db,
        owner_user_id="private-owner",
        access_token="private-access-token",
        selection_mode="single_document",
        document_id="private-document",
        reader=reader,
        authority_loader=load_authority,
    )

    assert authority_calls == [
        (db, "private-owner", ("private-document",))
    ]
    assert [item["action"] for item in payload["items"]] == [
        "import_metadata"
    ]
    assert payload["selection_summary"]["google_document_count"] == 1
    assert payload["selection_summary"]["pages_scanned"] == 0


@pytest.mark.parametrize(
    ("selection_mode", "folder_id", "document_id"),
    (
        ("folder_tree", None, None),
        ("folder_tree", "private-folder", "private-document"),
        ("single_document", None, None),
        ("single_document", "private-folder", "private-document"),
        ("unknown", "private-folder", None),
    ),
)
def test_maintenance_target_modes_fail_closed(
    selection_mode,
    folder_id,
    document_id,
):
    from studio_api.transcript_maintenance_dry_run import (
        build_transcript_standardization_dry_run,
    )

    reader = RecursiveReader(documents=(), texts={})

    with pytest.raises(ValueError, match="maintenance"):
        build_transcript_standardization_dry_run(
            access_token="private-access-token",
            selection_mode=selection_mode,
            folder_id=folder_id,
            document_id=document_id,
            reader=reader,
        )


def test_unavailable_single_document_is_one_safe_blocked_candidate():
    from studio_api.transcript_maintenance_dry_run import (
        build_transcript_standardization_dry_run,
    )

    reader = RecursiveReader(documents=(), texts={})

    payload = build_transcript_standardization_dry_run(
        access_token="private-access-token",
        selection_mode="single_document",
        document_id="private-document",
        reader=reader,
    )

    assert [item["action"] for item in payload["items"]] == ["blocked"]
    assert payload["selection_summary"] == {
        "google_document_count": 1,
        "nested_folder_count": 0,
        "skipped_non_document_count": 0,
        "pages_scanned": 0,
        "unreadable_document_count": 1,
    }


def test_selection_inspection_repr_redacts_private_evidence():
    from studio_api.transcript_maintenance_dry_run import (
        TranscriptCatalogImportSelectionInspection,
        TranscriptStandardizationSelectionInspection,
    )

    standardization = TranscriptStandardizationSelectionInspection(
        candidates=("private-candidate",),
        created_time_by_document_id={"private-document": "private-time"},
        selection_summary={"google_document_count": 1},
    )
    catalog_import = TranscriptCatalogImportSelectionInspection(
        candidates=("private-candidate",),
        selection_summary={"google_document_count": 1},
    )

    rendered = repr((standardization, catalog_import))
    assert "candidate_count=1" in rendered
    assert "google_document_count" in rendered
    assert "private-candidate" not in rendered
    assert "private-document" not in rendered
    assert "private-time" not in rendered

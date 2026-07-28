from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


def _candidate(
    document_id: str,
    *,
    name: str,
    standard: str,
):
    from studio_api.transcript_catalog_migration import (
        CatalogDocumentStandardStatus,
        TranscriptStandardizationCandidate,
    )

    return TranscriptStandardizationCandidate(
        drive_document_id=document_id,
        name=name,
        standard_status=CatalogDocumentStandardStatus(standard),
    )


class StatefulStandardizer:
    def __init__(self, document_text_by_id):
        self.document_text_by_id = dict(document_text_by_id)
        self.reads = []
        self.writes = []

    def read_document(self, *, access_token, document_id):
        from studio_api.transcript_catalog_standardize import (
            CatalogGoogleDocumentSnapshot,
        )

        assert access_token == "private-access-token"
        self.reads.append(document_id)
        text = self.document_text_by_id[document_id]
        return CatalogGoogleDocumentSnapshot(
            document_id=document_id,
            revision_id=f"private-revision-{len(self.reads)}",
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


def test_standardization_apply_mutates_only_eligible_selected_docs():
    from studio_api.transcript_maintenance_apply import (
        execute_transcript_standardization_apply,
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
                "Transcript\n\nPrivate outdated body"
            ),
            "private-unstructured": (
                "Unstructured\n\nPrivate unstructured body"
            ),
        }
    )
    candidates = (
        _candidate(
            "private-current",
            name="Current",
            standard="current",
        ),
        _candidate(
            "private-outdated",
            name="Outdated",
            standard="outdated",
        ),
        _candidate(
            "private-unstructured",
            name="Unstructured",
            standard="unstructured",
        ),
        _candidate(
            "private-unreadable",
            name="Unreadable",
            standard="unreadable",
        ),
    )

    payload = execute_transcript_standardization_apply(
        access_token="private-access-token",
        candidates=candidates,
        created_time_by_document_id={
            "private-outdated": "2026-07-01T00:00:00Z",
            "private-unstructured": None,
        },
        standardizer=standardizer,
    )

    assert payload["workflow"] == "standardization"
    assert payload["operation"] == "apply"
    assert [
        (
            item["action"],
            item["outcome"],
            item["reason_code"],
        )
        for item in payload["items"]
    ] == [
        ("unchanged", "already_current", None),
        ("standardize_document", "standardized", None),
        ("standardize_document", "standardized", None),
        ("blocked", "blocked", "document_unreadable"),
    ]
    assert payload["summary"] == {
        "standardized_count": 2,
        "already_current_count": 1,
        "blocked_count": 1,
    }
    assert standardizer.reads == [
        "private-outdated",
        "private-unstructured",
    ]
    assert standardizer.writes == [
        "private-outdated",
        "private-unstructured",
    ]
    encoded = json.dumps(payload, ensure_ascii=False)
    assert "import_metadata" not in encoded
    assert "catalog_import" not in encoded
    for private in (
        "private-access-token",
        "private-current",
        "private-outdated",
        "private-unstructured",
        "private-unreadable",
        "Private outdated body",
        "Private unstructured body",
    ):
        assert private not in encoded


def test_standardization_apply_retry_does_not_rewrite_current_document():
    from studio_api.transcript_maintenance_apply import (
        execute_transcript_standardization_apply,
    )

    current_text = (
        "Retry\n\nTranscript metadata\n"
        "Provider: unknown\n"
        "Model: unknown\n"
        "Language: unknown\n"
        "Speakers: unknown\n"
        "Created at: unknown\n\n"
        "Transcript\n\nPrivate body"
    )
    standardizer = StatefulStandardizer(
        {"private-retry": current_text}
    )

    payload = execute_transcript_standardization_apply(
        access_token="private-access-token",
        candidates=(
            _candidate(
                "private-retry",
                name="Retry",
                standard="outdated",
            ),
        ),
        standardizer=standardizer,
    )

    assert payload["items"][0]["outcome"] == "already_current"
    assert standardizer.reads == ["private-retry"]
    assert standardizer.writes == []


def test_standardization_apply_rejects_out_of_scope_metadata_before_write():
    from studio_api.transcript_maintenance_apply import (
        execute_transcript_standardization_apply,
    )

    standardizer = StatefulStandardizer(
        {"private-document": "Document\n\nPrivate body"}
    )

    with pytest.raises(ValueError, match="out of scope"):
        execute_transcript_standardization_apply(
            access_token="private-access-token",
            candidates=(
                _candidate(
                    "private-document",
                    name="Document",
                    standard="unstructured",
                ),
            ),
            created_time_by_document_id={
                "private-other": "2026-07-01T00:00:00Z"
            },
            standardizer=standardizer,
        )

    assert standardizer.reads == []
    assert standardizer.writes == []


def test_standardization_apply_rejects_duplicate_documents_before_write():
    from studio_api.transcript_maintenance_apply import (
        execute_transcript_standardization_apply,
    )

    standardizer = StatefulStandardizer(
        {"private-document": "Document\n\nPrivate body"}
    )
    candidate = _candidate(
        "private-document",
        name="Document",
        standard="unstructured",
    )

    with pytest.raises(ValueError, match="unique"):
        execute_transcript_standardization_apply(
            access_token="private-access-token",
            candidates=(candidate, candidate),
            standardizer=standardizer,
        )

    assert standardizer.reads == []
    assert standardizer.writes == []


def test_standardization_apply_rejects_invalid_created_time_mapping():
    from studio_api.transcript_maintenance_apply import (
        execute_transcript_standardization_apply,
    )

    standardizer = StatefulStandardizer({})

    with pytest.raises(ValueError, match="mapping"):
        execute_transcript_standardization_apply(
            access_token="private-access-token",
            candidates=(),
            created_time_by_document_id=[],
            standardizer=standardizer,
        )

    assert standardizer.reads == []
    assert standardizer.writes == []

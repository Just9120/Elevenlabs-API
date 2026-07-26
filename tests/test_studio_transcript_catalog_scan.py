from __future__ import annotations

import json
import sys
from pathlib import Path

import httpx
import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


def response(status_code: int, payload) -> httpx.Response:
    request = httpx.Request("GET", "https://google.invalid")
    return httpx.Response(
        status_code,
        request=request,
        json=payload,
    )


def google_doc_payload(text: str) -> dict:
    return {
        "body": {
            "content": [
                {
                    "paragraph": {
                        "elements": [
                            {"textRun": {"content": text}},
                        ]
                    }
                }
            ]
        }
    }


def current_document(*, optional_metadata: str = "") -> str:
    return (
        "Lecture\n\n"
        "Transcript metadata\n"
        "Provider: ElevenLabs\n"
        "Model: scribe_v2\n"
        "Language: ru\n"
        "Speakers: yes\n"
        "Created at: 2026-07-01 10:00 UTC\n"
        f"{optional_metadata}"
        "\nTranscript\n\n"
        "Private transcript body"
    )


def test_catalog_reader_scans_selected_folder_with_minimal_metadata():
    from studio_api.google_docs_output import GOOGLE_DOC_MIME_TYPE
    from studio_api.google_drive import GOOGLE_FOLDER_MIME_TYPE
    from studio_api.transcript_catalog_scan import (
        CATALOG_DRIVE_FIELDS,
        GoogleTranscriptCatalogReader,
    )

    calls = []

    def get(url, *, headers, params, timeout):
        calls.append((url, headers, params, timeout))
        if params.get("pageToken") == "private-next-page":
            return response(
                200,
                {
                    "files": [
                        {
                            "id": "doc-a",
                            "name": "Alpha",
                            "mimeType": GOOGLE_DOC_MIME_TYPE,
                            "createdTime": "2026-07-01T00:00:00Z",
                            "modifiedTime": "2026-07-02T00:00:00Z",
                        }
                    ]
                },
            )
        return response(
            200,
            {
                "files": [
                    {
                        "id": "doc-z",
                        "name": "Zulu",
                        "mimeType": GOOGLE_DOC_MIME_TYPE,
                    },
                    {
                        "id": "nested-folder",
                        "name": "Nested",
                        "mimeType": GOOGLE_FOLDER_MIME_TYPE,
                    },
                    {
                        "id": "audio-file",
                        "name": "Audio",
                        "mimeType": "audio/mpeg",
                    },
                ],
                "nextPageToken": "private-next-page",
            },
        )

    scan = GoogleTranscriptCatalogReader(get=get).scan_folder(
        access_token="private-access-token",
        folder_id="private-folder-id",
    )

    assert [item.name for item in scan.documents] == ["Alpha", "Zulu"]
    assert scan.nested_folder_count == 1
    assert scan.skipped_non_document_count == 1
    assert scan.pages_scanned == 2
    assert calls[0][0].endswith("/drive/v3/files")
    assert calls[0][1] == {
        "Authorization": "Bearer private-access-token",
        "Accept": "application/json",
    }
    assert calls[0][2]["q"] == (
        "'private-folder-id' in parents and trashed = false"
    )
    assert calls[0][2]["fields"] == CATALOG_DRIVE_FIELDS
    assert "webViewLink" not in calls[0][2]["fields"]
    assert "pageToken" not in calls[0][2]
    assert calls[1][2]["pageToken"] == "private-next-page"

    encoded = json.dumps(
        {
            "names": [item.name for item in scan.documents],
            "nested": scan.nested_folder_count,
            "skipped": scan.skipped_non_document_count,
        }
    )
    assert "private-folder-id" not in encoded
    assert "doc-a" not in repr(scan.documents[0])
    assert "private-next-page" not in repr(scan)


def test_catalog_reader_reads_only_plain_text_needed_for_classification():
    from studio_api.transcript_catalog_scan import (
        CATALOG_DOCS_TEXT_FIELDS,
        GoogleTranscriptCatalogReader,
    )

    calls = []
    body = current_document()

    def get(url, *, headers, params, timeout):
        calls.append((url, headers, params, timeout))
        return response(200, google_doc_payload(body))

    reader = GoogleTranscriptCatalogReader(get=get)
    text = reader.read_document_text(
        access_token="private-access-token",
        document_id="private-document-id",
    )

    assert text == body
    assert calls[0][0].endswith("/documents/private-document-id")
    assert calls[0][2] == {
        "fields": CATALOG_DOCS_TEXT_FIELDS,
        "includeTabsContent": "false",
    }
    assert "Private transcript body" not in repr(reader)
    assert "private-access-token" not in repr(reader)


@pytest.mark.parametrize(
    ("document_text", "expected"),
    (
        (current_document(), "current"),
        (
            current_document(
                optional_metadata=(
                    "Segment project: Course\n"
                    "Segment time range: 00:00-12:00\n"
                    "Original source: lecture.mp4\n"
                )
            ),
            "current",
        ),
        (
            "Lecture\n\nTranscript metadata\n"
            "Source file: lecture.mp4\n"
            "Source mode: Google Drive\n"
            "Provider: ElevenLabs\n"
            "Model: scribe_v2\n"
            "Language: ru\n"
            "Speakers: yes\n"
            "Created at: unknown\n\n"
            "Transcript\n\nBody",
            "outdated",
        ),
        (
            "Lecture\n\nTranscript metadata\n"
            "Provider: ElevenLabs\n"
            "Unexpected: value\n\nTranscript\n\nBody",
            "outdated",
        ),
        ("Lecture\n\nUnstructured body", "unstructured"),
        ("", "unstructured"),
    ),
)
def test_catalog_standard_classifier_matches_current_migration_contract(
    document_text,
    expected,
):
    from studio_api.transcript_catalog_scan import (
        classify_transcript_document_standard,
    )

    assert classify_transcript_document_standard(document_text).value == expected


@pytest.mark.parametrize(
    ("status_code", "expected_reason"),
    (
        (401, "authentication_rejected"),
        (403, "authentication_rejected"),
        (404, "document_not_found"),
        (429, "rate_limited"),
        (503, "unavailable"),
    ),
)
def test_catalog_reader_normalizes_google_failures_without_raw_payload(
    status_code,
    expected_reason,
):
    from studio_api.transcript_catalog_scan import (
        CatalogGoogleReadError,
        GoogleTranscriptCatalogReader,
    )

    def get(*args, **kwargs):
        return response(
            status_code,
            {
                "error": (
                    "private-document-id private-access-token "
                    "Private transcript body"
                )
            },
        )

    with pytest.raises(CatalogGoogleReadError) as raised:
        GoogleTranscriptCatalogReader(get=get).read_document_text(
            access_token="private-access-token",
            document_id="private-document-id",
        )

    assert raised.value.reason.value == expected_reason
    rendered = str(raised.value)
    assert "private-document-id" not in rendered
    assert "private-access-token" not in rendered
    assert "Private transcript body" not in rendered


def test_catalog_reader_fails_closed_on_incomplete_or_unbounded_scan():
    from studio_api.transcript_catalog_scan import (
        CatalogGoogleReadError,
        CatalogGoogleReadReason,
        GoogleTranscriptCatalogReader,
    )

    reader = GoogleTranscriptCatalogReader(
        get=lambda *args, **kwargs: response(
            200,
            {"files": [], "incompleteSearch": True},
        )
    )

    with pytest.raises(CatalogGoogleReadError) as raised:
        reader.scan_folder(
            access_token="private-access-token",
            folder_id="private-folder-id",
        )
    assert raised.value.reason == CatalogGoogleReadReason.incomplete_search

    with pytest.raises(ValueError, match="items"):
        reader.scan_folder(
            access_token="private-access-token",
            folder_id="private-folder-id",
            max_items=5_001,
        )


def test_catalog_reader_rejects_repeated_page_tokens_and_duplicate_items():
    from studio_api.google_docs_output import GOOGLE_DOC_MIME_TYPE
    from studio_api.transcript_catalog_scan import (
        CatalogGoogleReadError,
        CatalogGoogleReadReason,
        GoogleTranscriptCatalogReader,
    )

    responses = iter(
        (
            response(
                200,
                {
                    "files": [
                        {
                            "id": "same-document",
                            "name": "One",
                            "mimeType": GOOGLE_DOC_MIME_TYPE,
                        }
                    ],
                    "nextPageToken": "same-page",
                },
            ),
            response(
                200,
                {
                    "files": [
                        {
                            "id": "same-document",
                            "name": "Duplicate",
                            "mimeType": GOOGLE_DOC_MIME_TYPE,
                        }
                    ]
                },
            ),
        )
    )
    reader = GoogleTranscriptCatalogReader(
        get=lambda *args, **kwargs: next(responses)
    )

    with pytest.raises(CatalogGoogleReadError) as raised:
        reader.scan_folder(
            access_token="private-access-token",
            folder_id="private-folder-id",
        )
    assert raised.value.reason == CatalogGoogleReadReason.malformed_response


def test_catalog_document_parser_rejects_raw_or_malformed_responses():
    from studio_api.transcript_catalog_scan import (
        CatalogGoogleReadError,
        CatalogGoogleReadReason,
        extract_google_document_plain_text,
    )

    with pytest.raises(CatalogGoogleReadError) as raised:
        extract_google_document_plain_text(
            {"body": {"content": [{"paragraph": {"elements": "private"}}]}}
        )

    assert raised.value.reason == CatalogGoogleReadReason.malformed_response
    assert "private" not in str(raised.value)


@pytest.mark.parametrize(
    "payload",
    (
        {"files": [{"name": "Missing identity", "mimeType": "text/plain"}]},
        {"files": [], "incompleteSearch": "true"},
    ),
)
def test_catalog_folder_scan_normalizes_malformed_google_metadata(payload):
    from studio_api.transcript_catalog_scan import (
        CatalogGoogleReadError,
        CatalogGoogleReadReason,
        GoogleTranscriptCatalogReader,
    )

    reader = GoogleTranscriptCatalogReader(
        get=lambda *args, **kwargs: response(200, payload)
    )

    with pytest.raises(CatalogGoogleReadError) as raised:
        reader.scan_folder(
            access_token="private-access-token",
            folder_id="private-folder-id",
        )

    assert raised.value.reason == CatalogGoogleReadReason.malformed_response
    assert "Missing identity" not in str(raised.value)

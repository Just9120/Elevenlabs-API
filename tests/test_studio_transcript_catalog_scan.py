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


def selected_folder_payload(folder_id: str = "private-folder-id") -> dict:
    return {
        "id": folder_id,
        "name": "Selected root",
        "mimeType": "application/vnd.google-apps.folder",
        "parents": ["root"],
        "trashed": False,
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


def test_catalog_reader_recursively_scans_selected_folder_with_minimal_metadata():
    from studio_api.google_docs_output import GOOGLE_DOC_MIME_TYPE
    from studio_api.google_drive import GOOGLE_FOLDER_MIME_TYPE
    from studio_api.transcript_catalog_scan import (
        CATALOG_DRIVE_FIELDS,
        CATALOG_SELECTED_DRIVE_FIELDS,
        GoogleTranscriptCatalogReader,
    )

    calls = []

    def get(url, *, headers, params, timeout):
        calls.append((url, headers, params, timeout))
        if url.endswith("/private-folder-id"):
            return response(200, selected_folder_payload())
        query = params["q"]
        if "'private-folder-id'" in query and params.get(
            "pageToken"
        ) == "private-next-page":
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
        if "'nested-folder'" in query:
            return response(
                200,
                {
                    "files": [
                        {
                            "id": "doc-b",
                            "name": "Beta",
                            "mimeType": GOOGLE_DOC_MIME_TYPE,
                        },
                        {
                            "id": "deep-folder",
                            "name": "Deep",
                            "mimeType": GOOGLE_FOLDER_MIME_TYPE,
                        },
                    ]
                },
            )
        if "'deep-folder'" in query:
            return response(
                200,
                {
                    "files": [
                        {
                            "id": "doc-c",
                            "name": "Gamma",
                            "mimeType": GOOGLE_DOC_MIME_TYPE,
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

    assert [item.name for item in scan.documents] == [
        "Alpha",
        "Beta",
        "Gamma",
        "Zulu",
    ]
    assert scan.nested_folder_count == 2
    assert scan.skipped_non_document_count == 1
    assert scan.pages_scanned == 4
    assert calls[0][0].endswith(
        "/drive/v3/files/private-folder-id"
    )
    assert calls[0][2] == {
        "fields": CATALOG_SELECTED_DRIVE_FIELDS,
        "supportsAllDrives": "true",
    }
    assert calls[1][0].endswith("/drive/v3/files")
    assert calls[1][1] == {
        "Authorization": "Bearer private-access-token",
        "Accept": "application/json",
    }
    assert calls[1][2]["q"] == (
        "'private-folder-id' in parents and trashed = false"
    )
    assert calls[1][2]["fields"] == CATALOG_DRIVE_FIELDS
    assert "webViewLink" not in calls[1][2]["fields"]
    assert "pageToken" not in calls[1][2]
    assert calls[2][2]["pageToken"] == "private-next-page"
    assert calls[3][2]["q"] == (
        "'nested-folder' in parents and trashed = false"
    )
    assert calls[4][2]["q"] == (
        "'deep-folder' in parents and trashed = false"
    )

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


def test_explicit_document_selection_revalidates_folder_and_each_google_doc():
    from studio_api.google_docs_output import GOOGLE_DOC_MIME_TYPE
    from studio_api.google_drive import GOOGLE_FOLDER_MIME_TYPE
    from studio_api.transcript_catalog_scan import (
        CATALOG_SELECTED_DRIVE_FIELDS,
        GoogleTranscriptCatalogReader,
    )

    calls = []

    def get(url, *, headers, params, timeout):
        calls.append((url, headers, params, timeout))
        item_id = url.rsplit("/", 1)[-1]
        if item_id == "private-folder":
            return response(
                200,
                {
                    "id": item_id,
                    "name": "Approved folder",
                    "mimeType": GOOGLE_FOLDER_MIME_TYPE,
                    "parents": ["root"],
                    "trashed": False,
                },
            )
        return response(
            200,
            {
                "id": item_id,
                "name": "Zulu" if item_id == "doc-z" else "Alpha",
                "mimeType": GOOGLE_DOC_MIME_TYPE,
                "parents": ["private-folder"],
                "trashed": False,
                "createdTime": "2026-07-01T00:00:00Z",
                "modifiedTime": "2026-07-02T00:00:00Z",
            },
        )

    selected = GoogleTranscriptCatalogReader(
        get=get
    ).inspect_selected_documents(
        access_token="private-access-token",
        folder_id="private-folder",
        document_ids=("doc-z", "doc-a"),
    )

    assert [item.name for item in selected.documents] == ["Alpha", "Zulu"]
    assert [call[0].rsplit("/", 1)[-1] for call in calls] == [
        "private-folder",
        "doc-z",
        "doc-a",
    ]
    assert all(
        call[2]
        == {
            "fields": CATALOG_SELECTED_DRIVE_FIELDS,
            "supportsAllDrives": "true",
        }
        for call in calls
    )
    assert all("q" not in call[2] for call in calls)
    assert "private-folder" not in repr(selected)
    assert "doc-a" not in repr(selected)
    assert "doc-z" not in repr(selected)


@pytest.mark.parametrize(
    ("payload", "expected_reason"),
    (
        (
            {
                "id": "private-document",
                "name": "Wrong type",
                "mimeType": "application/pdf",
                "parents": ["private-folder"],
                "trashed": False,
            },
            "document_not_google_doc",
        ),
        (
            {
                "id": "private-document",
                "name": "Wrong parent",
                "mimeType": "application/vnd.google-apps.document",
                "parents": ["other-folder"],
                "trashed": False,
            },
            "document_out_of_folder",
        ),
        (
            {
                "id": "private-document",
                "name": "Trashed",
                "mimeType": "application/vnd.google-apps.document",
                "parents": ["private-folder"],
                "trashed": True,
            },
            "document_trashed",
        ),
    ),
)
def test_explicit_document_selection_fails_closed_on_invalid_metadata(
    payload,
    expected_reason,
):
    from studio_api.google_drive import GOOGLE_FOLDER_MIME_TYPE
    from studio_api.transcript_catalog_scan import GoogleTranscriptCatalogReader
    from studio_api.transcript_document_selection import (
        TranscriptDocumentSelectionError,
    )

    def get(url, **kwargs):
        if url.endswith("/private-folder"):
            return response(
                200,
                {
                    "id": "private-folder",
                    "name": "Approved folder",
                    "mimeType": GOOGLE_FOLDER_MIME_TYPE,
                    "parents": ["root"],
                    "trashed": False,
                },
            )
        return response(200, payload)

    with pytest.raises(TranscriptDocumentSelectionError) as raised:
        GoogleTranscriptCatalogReader(
            get=get
        ).inspect_selected_documents(
            access_token="private-access-token",
            folder_id="private-folder",
            document_ids=("private-document",),
        )

    assert raised.value.reason.value == expected_reason
    assert "private-folder" not in str(raised.value)
    assert "private-document" not in str(raised.value)


@pytest.mark.parametrize(
    "folder_payload",
    (
        {
            "id": "private-folder",
            "name": "Not a folder",
            "mimeType": "application/pdf",
            "trashed": False,
        },
        {
            "id": "private-folder",
            "name": "Trashed folder",
            "mimeType": "application/vnd.google-apps.folder",
            "trashed": True,
        },
        {
            "id": "different-folder",
            "name": "Mismatched folder",
            "mimeType": "application/vnd.google-apps.folder",
            "trashed": False,
        },
    ),
)
def test_explicit_document_selection_requires_the_picker_selected_folder(
    folder_payload,
):
    from studio_api.transcript_catalog_scan import GoogleTranscriptCatalogReader
    from studio_api.transcript_document_selection import (
        TranscriptDocumentSelectionError,
        TranscriptDocumentSelectionReason,
    )

    with pytest.raises(TranscriptDocumentSelectionError) as raised:
        GoogleTranscriptCatalogReader(
            get=lambda *args, **kwargs: response(200, folder_payload)
        ).inspect_selected_documents(
            access_token="private-access-token",
            folder_id="private-folder",
            document_ids=("private-document",),
        )

    assert (
        raised.value.reason
        == TranscriptDocumentSelectionReason.folder_invalid
    )
    assert "private-folder" not in str(raised.value)


@pytest.mark.parametrize(
    ("folder_id", "document_ids", "expected_reason"),
    (
        ("private-folder", (), "empty"),
        ("private-folder", ("same", "same"), "duplicate"),
        ("not valid!", ("document",), "folder_invalid"),
        ("private-folder", ("not valid!",), "document_invalid"),
        (
            "private-folder",
            tuple(f"document-{index}" for index in range(51)),
            "limit_exceeded",
        ),
    ),
)
def test_explicit_document_selection_is_bounded_and_private(
    folder_id,
    document_ids,
    expected_reason,
):
    from studio_api.transcript_document_selection import (
        TranscriptDocumentSelectionError,
        normalize_transcript_document_selection,
    )

    with pytest.raises(TranscriptDocumentSelectionError) as raised:
        normalize_transcript_document_selection(
            folder_id=folder_id,
            document_ids=document_ids,
        )

    assert raised.value.reason.value == expected_reason
    assert "private-folder" not in str(raised.value)
    assert "document-0" not in str(raised.value)


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
        (403, "request_rejected"),
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


def test_recursive_folder_forbidden_still_aborts_as_authentication_failure():
    from studio_api.transcript_catalog_scan import (
        CatalogGoogleReadError,
        CatalogGoogleReadReason,
        GoogleTranscriptCatalogReader,
    )

    with pytest.raises(CatalogGoogleReadError) as raised:
        GoogleTranscriptCatalogReader(
            get=lambda *args, **kwargs: response(
                403,
                {"error": "private-google-response"},
            )
        ).scan_folder(
            access_token="private-access-token",
            folder_id="private-folder-id",
        )

    assert (
        raised.value.reason
        == CatalogGoogleReadReason.authentication_rejected
    )
    assert "private-google-response" not in str(raised.value)


def test_catalog_reader_fails_closed_on_incomplete_or_unbounded_scan():
    from studio_api.transcript_catalog_scan import (
        CatalogGoogleReadError,
        CatalogGoogleReadReason,
        GoogleTranscriptCatalogReader,
    )

    reader = GoogleTranscriptCatalogReader(
        get=lambda url, **kwargs: (
            response(200, selected_folder_payload())
            if url.endswith("/private-folder-id")
            else response(
                200,
                {"files": [], "incompleteSearch": True},
            )
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
        get=lambda url, **kwargs: (
            response(200, selected_folder_payload())
            if url.endswith("/private-folder-id")
            else next(responses)
        )
    )

    with pytest.raises(CatalogGoogleReadError) as raised:
        reader.scan_folder(
            access_token="private-access-token",
            folder_id="private-folder-id",
        )
    assert raised.value.reason == CatalogGoogleReadReason.malformed_response


def test_recursive_scan_blocks_folder_cycles_and_global_page_overflow():
    from studio_api.google_drive import GOOGLE_FOLDER_MIME_TYPE
    from studio_api.transcript_catalog_scan import (
        CatalogGoogleReadError,
        CatalogGoogleReadReason,
        GoogleTranscriptCatalogReader,
    )

    def get(url, *, params, **kwargs):
        if url.endswith("/private-folder-id"):
            return response(200, selected_folder_payload())
        if "'private-folder-id'" in params["q"]:
            return response(
                200,
                {
                    "files": [
                        {
                            "id": "nested-folder",
                            "name": "Nested",
                            "mimeType": GOOGLE_FOLDER_MIME_TYPE,
                        }
                    ]
                },
            )
        return response(
            200,
            {
                "files": [
                    {
                        "id": "private-folder-id",
                        "name": "Cycle",
                        "mimeType": GOOGLE_FOLDER_MIME_TYPE,
                    }
                ]
            },
        )

    reader = GoogleTranscriptCatalogReader(get=get)
    with pytest.raises(CatalogGoogleReadError) as cycle:
        reader.scan_folder(
            access_token="private-access-token",
            folder_id="private-folder-id",
        )
    assert cycle.value.reason == CatalogGoogleReadReason.malformed_response

    with pytest.raises(CatalogGoogleReadError) as page_limit:
        reader.scan_folder(
            access_token="private-access-token",
            folder_id="private-folder-id",
            max_pages=1,
        )
    assert page_limit.value.reason == CatalogGoogleReadReason.limit_exceeded


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
        get=lambda url, **kwargs: (
            response(200, selected_folder_payload())
            if url.endswith("/private-folder-id")
            else response(200, payload)
        )
    )

    with pytest.raises(CatalogGoogleReadError) as raised:
        reader.scan_folder(
            access_token="private-access-token",
            folder_id="private-folder-id",
        )

    assert raised.value.reason == CatalogGoogleReadReason.malformed_response
    assert "Missing identity" not in str(raised.value)

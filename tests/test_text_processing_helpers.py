"""Unit tests for pure text-processing helpers in the Colab workflow.

The canonical runtime file is a Colab-exported script with top-level shell magic,
Colab auth, widget setup, and Google service initialization.  Importing it in a
normal pytest process would either be invalid Python or trigger runtime side
effects, so these tests execute only the helper function definitions extracted
from the source file.
"""

from __future__ import annotations

import ast
import hashlib
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CANONICAL_SOURCE = ROOT / "elevenlabs_api.py"
HELPER_NAMES = {
    "build_transcript_metadata_lines",
    "build_structured_transcript_document_text",
    "build_backfilled_transcript_document_text",
    "chunk_text_for_docs",
    "extract_unstructured_transcript_body_for_backfill",
    "format_transcript_metadata_value",
    "is_structured_transcript_document_text",
    "normalize_doc_plain_text",
    "segment_plain_transcript_for_docs",
    "normalize_text_for_overlap_match",
    "trim_duplicate_prefix_by_token_overlap",
    "merge_transcript_parts_with_overlap",
    "get_openai_diarize_chunking_preflight_warning",
    "collect_existing_google_docs_for_standardization",
    "build_docs_only_standardized_transcript_document_text",
    "standardize_existing_google_docs_in_folder",
    "json_sha256",
    "load_manifest_read_only",
    "normalize_manifest_data",
    "make_manifest_default",
    "should_skip_by_manifest",
    "parse_iso_datetime",
    "build_existing_google_doc_manifest_signature",
    "get_manifest_entry",
    "classify_existing_google_doc_transcript_standard",
    "build_existing_google_doc_link",
    "extract_google_doc_id_from_url",
    "is_existing_google_doc_registry_entry",
    "find_manifest_entries_referencing_google_doc",
    "build_existing_google_doc_manifest_entry",
    "existing_google_doc_manifest_entry_needs_update",
    "upsert_existing_google_doc_manifest_entry",
    "register_existing_google_docs_in_manifest",
}


def load_text_helpers() -> dict[str, object]:
    """Load selected pure helper definitions without importing Colab runtime code."""

    source = CANONICAL_SOURCE.read_text(encoding="utf-8")
    python_source = "\n".join(
        line for line in source.splitlines() if not line.lstrip().startswith("!")
    )
    module = ast.parse(python_source, filename=str(CANONICAL_SOURCE))

    selected_nodes: list[ast.stmt] = []
    for node in module.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in {
                    "DOC_INSERT_CHUNK_SIZE",
                    "STRUCTURED_TRANSCRIPT_METADATA_LABEL",
                    "STRUCTURED_TRANSCRIPT_BODY_LABEL",
                    "STRUCTURED_TRANSCRIPT_REQUIRED_METADATA_PREFIXES",
                    "STRUCTURED_TRANSCRIPT_LEGACY_METADATA_PREFIXES",
                    "FOLDER_MIME",
                    "DOC_MIME",
                    "DOCS_ONLY_STANDARDIZATION_SOURCE_FILE",
                    "DOCS_ONLY_STANDARDIZATION_SOURCE_MODE",
                    "DOCS_ONLY_STANDARDIZATION_DEFAULT_MAX_FOLDERS_SCANNED",
                    "DOCS_ONLY_STANDARDIZATION_DEFAULT_MAX_GOOGLE_DOCS_SCANNED",
                    "DOCS_ONLY_STANDARDIZATION_NESTED_FOLDER_HINT",
                    "MANIFEST_CACHE",
                    "MANIFEST_FILE_NAME",
                    "MANIFEST_FOLDER_NAME",
                    "STATE_FOLDER_NAME",
                    "EXISTING_GOOGLE_DOC_MANIFEST_NOTICE",
                    "EXISTING_GOOGLE_DOC_REGISTRATION_MODE",
                    "EXISTING_GOOGLE_DOC_MANIFEST_STATUS",
                    "EXISTING_GOOGLE_DOC_MANIFEST_STANDARD",
                    "EXISTING_GOOGLE_DOC_STRUCTURED_UNREADABLE",
                    "EXISTING_GOOGLE_DOC_STRUCTURED_UNSTRUCTURED",
                    "EXISTING_GOOGLE_DOC_STRUCTURED_OUTDATED",
                    "EXISTING_GOOGLE_DOC_STRUCTURED_CURRENT",
                }:
                    selected_nodes.append(node)
                    break
        elif isinstance(node, ast.FunctionDef) and node.name in HELPER_NAMES:
            selected_nodes.append(node)

    found_names = {
        node.name for node in selected_nodes if isinstance(node, ast.FunctionDef)
    }
    assert found_names == HELPER_NAMES

    helper_module = ast.Module(body=selected_nodes, type_ignores=[])
    ast.fix_missing_locations(helper_module)

    namespace: dict[str, object] = {
        "hashlib": hashlib,
        "json": json,
        "datetime": datetime,
        "timedelta": timedelta,
        "timezone": timezone,
        "re": re,
        # These globals are runtime tuning knobs used by the overlap helper.
        # They are injected here so the pure function can be tested in isolation
        # from the Colab runtime configuration surface.
        "OPENAI_MERGE_MAX_OVERLAP_TOKENS": 12,
        "OPENAI_MERGE_MIN_OVERLAP_TOKENS": 3,
        "MANIFEST_IN_PROGRESS_TTL_HOURS": 12,
        "list_drive_folder_children": lambda _folder_id: [],
        "find_file_in_folder": lambda _folder_id, _file_name: None,
        "read_manifest_file_by_id": lambda _file_id: {"version": 1, "entries": {}},
        "get_or_create_manifest_file": lambda: (_ for _ in ()).throw(AssertionError("get_or_create_manifest_file called")),
        "extract_google_doc_plain_text": lambda _document_id: "",
        "write_title_and_text_to_doc": lambda **_kwargs: None,
        "load_manifest": lambda: {"version": 1, "entries": {}},
        "save_manifest": lambda _manifest: None,
        "utc_now_iso": lambda: "2026-06-01T00:00:00+00:00",
    }
    exec(compile(helper_module, str(CANONICAL_SOURCE), "exec"), namespace)
    return namespace


HELPERS = load_text_helpers()
build_transcript_metadata_lines = HELPERS["build_transcript_metadata_lines"]
build_structured_transcript_document_text = HELPERS["build_structured_transcript_document_text"]
build_backfilled_transcript_document_text = HELPERS["build_backfilled_transcript_document_text"]
chunk_text_for_docs = HELPERS["chunk_text_for_docs"]
extract_unstructured_transcript_body_for_backfill = HELPERS["extract_unstructured_transcript_body_for_backfill"]
format_transcript_metadata_value = HELPERS["format_transcript_metadata_value"]
is_structured_transcript_document_text = HELPERS["is_structured_transcript_document_text"]
normalize_doc_plain_text = HELPERS["normalize_doc_plain_text"]
segment_plain_transcript_for_docs = HELPERS["segment_plain_transcript_for_docs"]
trim_duplicate_prefix_by_token_overlap = HELPERS["trim_duplicate_prefix_by_token_overlap"]
merge_transcript_parts_with_overlap = HELPERS["merge_transcript_parts_with_overlap"]
get_openai_diarize_chunking_preflight_warning = HELPERS[
    "get_openai_diarize_chunking_preflight_warning"
]
collect_existing_google_docs_for_standardization = HELPERS[
    "collect_existing_google_docs_for_standardization"
]
build_docs_only_standardized_transcript_document_text = HELPERS[
    "build_docs_only_standardized_transcript_document_text"
]
standardize_existing_google_docs_in_folder = HELPERS["standardize_existing_google_docs_in_folder"]

build_existing_google_doc_manifest_signature = HELPERS["build_existing_google_doc_manifest_signature"]
classify_existing_google_doc_transcript_standard = HELPERS["classify_existing_google_doc_transcript_standard"]
register_existing_google_docs_in_manifest = HELPERS["register_existing_google_docs_in_manifest"]
extract_google_doc_id_from_url = HELPERS["extract_google_doc_id_from_url"]
find_manifest_entries_referencing_google_doc = HELPERS["find_manifest_entries_referencing_google_doc"]
load_manifest_read_only = HELPERS["load_manifest_read_only"]
ORIGINAL_LOAD_MANIFEST_READ_ONLY = load_manifest_read_only
should_skip_by_manifest = HELPERS["should_skip_by_manifest"]
DOC_MIME = HELPERS["DOC_MIME"]
FOLDER_MIME = HELPERS["FOLDER_MIME"]


def build_legacy_standard_document(title: str = "Call", body: str = "Hello world.") -> str:
    return (
        f"{title}\n\n"
        "Transcript metadata\n"
        "Source file: not available\n"
        "Source mode: existing_google_doc_standardization\n"
        "Provider: unknown\n"
        "Model: unknown\n"
        "Language: unknown\n"
        "Speakers: unknown\n"
        "Created at: 2026-06-02T10:26:40.369268+00:00\n\n"
        "Transcript\n\n"
        f"{body}"
    )


def test_format_transcript_metadata_value_normalizes_blank_values() -> None:
    assert format_transcript_metadata_value(None) == "unknown"
    assert format_transcript_metadata_value("  alpha\n beta  ") == "alpha beta"


def test_build_transcript_metadata_lines_supports_unknown_speakers_for_backfill() -> None:
    lines = build_transcript_metadata_lines(
        source_name="legacy.mp3",
        source_mode="Google Drive: папка",
        provider="unknown",
        provider_model="unknown",
        language="unknown",
        speakers_enabled=None,
        created_at="2026-06-01T00:00:00+00:00",
    )

    assert "Speakers: unknown" in lines


def test_build_transcript_metadata_lines_uses_stable_labels() -> None:
    lines = build_transcript_metadata_lines(
        source_name="lecture.mp3",
        source_mode="Google Drive: 1 файл",
        provider="ElevenLabs",
        provider_model="scribe_v2",
        language="Русский (ru)",
        speakers_enabled=True,
        created_at="2026-06-01T00:00:00+00:00",
    )

    assert "Source file: lecture.mp3" not in lines
    assert "Source mode: Google Drive: 1 файл" not in lines
    assert lines == [
        "Provider: ElevenLabs",
        "Model: scribe_v2",
        "Language: Русский (ru)",
        "Speakers: yes",
        "Created at: 2026-06-01T00:00:00+00:00",
    ]


def test_segment_plain_transcript_for_docs_splits_long_single_block_without_losing_text() -> None:
    text = "First sentence. Second sentence. Third sentence. Fourth sentence."

    segmented = segment_plain_transcript_for_docs(text, target_chars=25)

    assert segmented == "First sentence.\n\nSecond sentence.\n\nThird sentence.\n\nFourth sentence."
    assert segmented.replace("\n\n", " ") == text


def test_segment_plain_transcript_for_docs_preserves_speaker_labeled_blocks() -> None:
    text = "Спикер 1:\nПривет.\nСпикер 2:\nЗдравствуйте."

    assert segment_plain_transcript_for_docs(text, target_chars=10) == text


def test_build_structured_transcript_document_text_has_llm_readable_sections() -> None:
    metadata = [
        "Provider: OpenAI",
        "Model: gpt-4o-transcribe",
        "Language: Автоопределение",
        "Speakers: no",
        "Created at: 2026-06-01T00:00:00+00:00",
    ]

    document_text = build_structured_transcript_document_text(
        document_title="call",
        transcript_text="Hello world.",
        metadata_lines=metadata,
    )

    assert document_text == (
        "call\n\n"
        "Transcript metadata\n"
        "Provider: OpenAI\n"
        "Model: gpt-4o-transcribe\n"
        "Language: Автоопределение\n"
        "Speakers: no\n"
        "Created at: 2026-06-01T00:00:00+00:00\n\n"
        "Transcript\n\n"
        "Hello world."
    )
    assert "Source file:" not in document_text
    assert "Source mode:" not in document_text


def test_openai_diarize_chunking_preflight_warning_is_limited_to_risky_configuration() -> None:
    warning = get_openai_diarize_chunking_preflight_warning(
        provider="openai",
        separate_speakers=True,
        source_mode="drive_file",
    )

    assert warning is not None
    assert "experimental/high-risk" in warning
    assert "speaker labels may be inconsistent across chunks" in warning
    assert "text-based, not speaker-aware" in warning
    assert get_openai_diarize_chunking_preflight_warning("elevenlabs", True, "drive_file") is None
    assert get_openai_diarize_chunking_preflight_warning("openai", False, "drive_file") is None
    assert get_openai_diarize_chunking_preflight_warning("openai", True, "unknown") is None


def test_openai_diarize_chunking_preflight_warning_covers_supported_source_modes() -> None:
    source_modes = ["local_file", "local_multi", "drive_file", "drive_folder"]

    for source_mode in source_modes:
        assert get_openai_diarize_chunking_preflight_warning("openai", True, source_mode)


def test_chunk_text_for_docs_returns_empty_chunk_for_empty_text() -> None:
    assert chunk_text_for_docs("", max_chars=10) == [""]


def test_chunk_text_for_docs_keeps_small_text_and_normalizes_newlines() -> None:
    assert chunk_text_for_docs("first\r\nsecond\rthird", max_chars=100) == [
        "first\nsecond\nthird"
    ]


def test_chunk_text_for_docs_splits_large_text_without_losing_content_order() -> None:
    text = "alpha beta gamma delta epsilon zeta eta theta iota kappa"

    chunks = chunk_text_for_docs(text, max_chars=18)

    assert len(chunks) > 1
    assert "".join(chunks) == text
    assert chunks == ["alpha beta gamma ", "delta epsilon ", "zeta eta theta ", "iota kappa"]


def test_chunk_text_for_docs_hard_splits_when_no_good_boundary_exists() -> None:
    text = "abcdefghijklmnopqrstuvwxyz"

    chunks = chunk_text_for_docs(text, max_chars=10)

    assert chunks == ["abcdefghij", "klmnopqrst", "uvwxyz"]
    assert "".join(chunks) == text


def test_chunk_text_for_docs_preserves_unicode_cyrillic_content_across_chunks() -> None:
    text = "Первый абзац с текстом.\n\nВторой абзац продолжается без потерь."

    chunks = chunk_text_for_docs(text, max_chars=32)

    assert len(chunks) > 1
    assert "".join(chunks) == text
    assert chunks[0].startswith("Первый")
    assert chunks[-1].endswith("потерь.")


def test_trim_duplicate_prefix_by_token_overlap_removes_overlapping_prefix() -> None:
    overlap = "alpha beta gamma delta epsilon"
    previous_text = f"Earlier transcript context. {overlap}"
    current_text = f"{overlap} unique continuation"

    assert (
        trim_duplicate_prefix_by_token_overlap(previous_text, current_text)
        == "unique continuation"
    )


def test_trim_duplicate_prefix_by_token_overlap_preserves_text_without_overlap() -> None:
    previous_text = "alpha beta gamma delta epsilon"
    current_text = "zeta eta theta iota kappa"

    assert trim_duplicate_prefix_by_token_overlap(previous_text, current_text) == current_text


def test_trim_duplicate_prefix_by_token_overlap_handles_cyrillic_case_and_spacing() -> None:
    previous_text = "Вступление. Привет большой мир сегодня снова"
    current_text = "привет   большой\nмир сегодня снова продолжаем расшифровку"

    assert (
        trim_duplicate_prefix_by_token_overlap(previous_text, current_text)
        == "продолжаем расшифровку"
    )


def test_merge_transcript_parts_with_overlap_trims_duplicate_boundary_text() -> None:
    first = "Segment one. alpha beta gamma delta epsilon"
    second = "alpha beta gamma delta epsilon segment two continues"

    assert merge_transcript_parts_with_overlap([first, second]) == (
        "Segment one. alpha beta gamma delta epsilon\n\nsegment two continues"
    )


def test_merge_transcript_parts_with_overlap_preserves_parts_without_overlap() -> None:
    assert merge_transcript_parts_with_overlap(["first part", "second part"]) == (
        "first part\n\nsecond part"
    )


def test_merge_transcript_parts_with_overlap_ignores_blank_parts() -> None:
    assert merge_transcript_parts_with_overlap(["  ", "first", "", "second  "]) == (
        "first\n\nsecond"
    )


def test_is_structured_transcript_document_text_requires_pr19_sections() -> None:
    structured = build_structured_transcript_document_text(
        document_title="call",
        transcript_text="Hello world.",
        metadata_lines=build_transcript_metadata_lines(
            source_name="call.flac",
            source_mode="Google Drive: 1 файл",
            provider="unknown",
            provider_model="unknown",
            language="unknown",
            speakers_enabled=None,
            created_at="2026-06-01T00:00:00+00:00",
        ),
    )

    assert is_structured_transcript_document_text(structured)
    assert not is_structured_transcript_document_text("call\n\nHello world.")
    assert not is_structured_transcript_document_text("Transcript metadata\nTranscript\nHello world.")



def test_is_structured_transcript_document_text_rejects_legacy_metadata_standard() -> None:
    legacy = build_legacy_standard_document()

    assert not is_structured_transcript_document_text(legacy)


def test_is_structured_transcript_document_text_requires_exact_v12_metadata_block() -> None:
    valid_metadata = [
        "Provider: unknown",
        "Model: unknown",
        "Language: unknown",
        "Speakers: unknown",
        "Created at: 2026-06-01T00:00:00+00:00",
    ]

    def build_with(metadata_lines: list[str]) -> str:
        return build_structured_transcript_document_text(
            document_title="Call",
            transcript_text="Hello world.",
            metadata_lines=metadata_lines,
        )

    assert is_structured_transcript_document_text(build_with(valid_metadata))

    invalid_cases = [
        valid_metadata[:-1],
        [valid_metadata[1], valid_metadata[0], *valid_metadata[2:]],
        [*valid_metadata, valid_metadata[-1]],
        [*valid_metadata, "Duration: unknown"],
        ["Source file: call.mp3", *valid_metadata],
        ["Source mode: Google Drive: 1 файл", *valid_metadata],
    ]
    for metadata_lines in invalid_cases:
        assert not is_structured_transcript_document_text(build_with(metadata_lines))


def test_extract_unstructured_transcript_body_for_backfill_drops_duplicate_title() -> None:
    text = "Legacy Call\n\nFirst line.\nSecond line."

    assert extract_unstructured_transcript_body_for_backfill(text, "Legacy Call") == "First line.\nSecond line."
    assert extract_unstructured_transcript_body_for_backfill("First line.", "Legacy Call") == "First line."


def test_build_backfilled_transcript_document_text_uses_unknown_metadata_without_llm_fields() -> None:
    document_text = build_backfilled_transcript_document_text(
        document_title="Legacy Call",
        source_name="Legacy Call.mp3",
        source_mode="Google Drive: папка",
        existing_document_text="Legacy Call\n\nHello world.",
        created_at="2026-06-01T00:00:00+00:00",
    )

    assert document_text == (
        "Legacy Call\n\n"
        "Transcript metadata\n"
        "Provider: unknown\n"
        "Model: unknown\n"
        "Language: unknown\n"
        "Speakers: unknown\n"
        "Created at: 2026-06-01T00:00:00+00:00\n\n"
        "Transcript\n\n"
        "Hello world."
    )
    assert is_structured_transcript_document_text(document_text)


def test_docs_only_scan_indexes_google_docs() -> None:
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-1", "name": "Call", "mimeType": DOC_MIME, "webViewLink": "https://docs/1"},
    ]

    docs, scan = collect_existing_google_docs_for_standardization("root", recursive=False)

    assert scan["skipped_non_google_docs"] == 0
    assert docs == [
        {
            "id": "doc-1",
            "name": "Call",
            "mimeType": DOC_MIME,
            "webViewLink": "https://docs/1",
            "display_name": "Call",
        }
    ]


def test_recursive_docs_scan_finds_nested_google_docs() -> None:
    children = {
        "root": [{"id": "folder-1", "name": "Nested", "mimeType": FOLDER_MIME}],
        "folder-1": [{"id": "doc-1", "name": "Nested Call", "mimeType": DOC_MIME}],
    }
    HELPERS["list_drive_folder_children"] = lambda folder_id: children[folder_id]

    docs, scan = collect_existing_google_docs_for_standardization("root", recursive=True)

    assert scan["skipped_non_google_docs"] == 0
    assert [(doc["id"], doc["display_name"]) for doc in docs] == [("doc-1", "Nested/Nested Call")]


def test_docs_only_scan_ignores_pdfs_audio_video_and_other_files() -> None:
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-1", "name": "Call", "mimeType": DOC_MIME},
        {"id": "pdf-1", "name": "Call.pdf", "mimeType": "application/pdf"},
        {"id": "aud-1", "name": "Call.mp3", "mimeType": "audio/mpeg"},
        {"id": "vid-1", "name": "Call.mp4", "mimeType": "video/mp4"},
        {"id": "txt-1", "name": "Call.txt", "mimeType": "text/plain"},
    ]

    docs, scan = collect_existing_google_docs_for_standardization("root", recursive=False)

    assert [doc["id"] for doc in docs] == ["doc-1"]
    assert scan["skipped_non_google_docs"] == 4



def test_docs_only_scan_counts_nested_folders_when_not_recursive() -> None:
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "folder-1", "name": "Nested", "mimeType": FOLDER_MIME},
        {"id": "doc-1", "name": "Top Call", "mimeType": DOC_MIME},
    ]

    docs, scan = collect_existing_google_docs_for_standardization("root", recursive=False)

    assert [doc["id"] for doc in docs] == ["doc-1"]
    assert scan["folders_seen"] == 1
    assert scan["skipped_non_google_docs"] == 0


def test_docs_only_top_level_only_nested_folders_exposes_hint() -> None:
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "folder-1", "name": "Module 1", "mimeType": FOLDER_MIME},
        {"id": "folder-2", "name": "Module 2", "mimeType": FOLDER_MIME},
    ]

    report = standardize_existing_google_docs_in_folder("root", recursive=False, dry_run=True)

    assert report["google_docs_scanned"] == 0
    assert report["folders_seen"] == 2
    assert report["skipped_non_google_docs"] == 0
    assert "В выбранной папке верхнего уровня Google Docs не найдены" in report["hint"]


def test_recursive_docs_scan_uses_visited_folder_ids() -> None:
    calls = []
    children = {
        "root": [
            {"id": "folder-a", "name": "A", "mimeType": FOLDER_MIME},
            {"id": "folder-a", "name": "A Shortcut", "mimeType": FOLDER_MIME},
        ],
        "folder-a": [
            {"id": "root", "name": "Back To Root", "mimeType": FOLDER_MIME},
            {"id": "doc-1", "name": "Nested Call", "mimeType": DOC_MIME},
        ],
    }

    def list_children(folder_id):
        calls.append(folder_id)
        return children[folder_id]

    HELPERS["list_drive_folder_children"] = list_children

    docs, scan = collect_existing_google_docs_for_standardization("root", recursive=True)

    assert calls == ["root", "folder-a"]
    assert scan["folders_seen"] == 3
    assert [(doc["id"], doc["display_name"]) for doc in docs] == [("doc-1", "A/Nested Call")]


def test_recursive_docs_scan_stops_when_folder_limit_exceeded() -> None:
    children = {
        "root": [{"id": "folder-a", "name": "A", "mimeType": FOLDER_MIME}],
        "folder-a": [{"id": "doc-1", "name": "Nested Call", "mimeType": DOC_MIME}],
    }
    HELPERS["list_drive_folder_children"] = lambda folder_id: children[folder_id]

    report = standardize_existing_google_docs_in_folder(
        "root", recursive=True, dry_run=True, max_folders_scanned=1
    )

    assert report["google_docs_scanned"] == 0
    assert report["errors"]
    assert "лимит сканирования папок" in report["errors"][0]["reason"]


def test_docs_only_scan_stops_when_doc_limit_exceeded() -> None:
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-1", "name": "Call 1", "mimeType": DOC_MIME},
        {"id": "doc-2", "name": "Call 2", "mimeType": DOC_MIME},
    ]

    report = standardize_existing_google_docs_in_folder(
        "root", recursive=False, dry_run=True, max_google_docs_scanned=1
    )

    assert report["google_docs_scanned"] == 1
    assert report["errors"]
    assert "лимит сканирования Google Docs" in report["errors"][0]["reason"]

def test_docs_only_already_structured_docs_are_skipped() -> None:
    structured = build_structured_transcript_document_text(
        document_title="Call",
        transcript_text="Hello world.",
        metadata_lines=build_transcript_metadata_lines(
            source_name="call.mp3",
            source_mode="Google Drive: 1 файл",
            provider="unknown",
            provider_model="unknown",
            language="unknown",
            speakers_enabled=None,
            created_at="2026-06-01T00:00:00+00:00",
        ),
    )
    writes = []
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-1", "name": "Call", "mimeType": DOC_MIME},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: structured
    HELPERS["write_title_and_text_to_doc"] = lambda **kwargs: writes.append(kwargs)

    report = standardize_existing_google_docs_in_folder("root", dry_run=False)

    assert report["google_docs_scanned"] == 1
    assert len(report["already_structured"]) == 1
    assert report["standardized"] == []
    assert writes == []


def test_docs_only_dry_run_counts_would_standardize_without_writing() -> None:
    writes = []
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-1", "name": "Call", "mimeType": DOC_MIME},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: "Call\n\nHello world."
    HELPERS["write_title_and_text_to_doc"] = lambda **kwargs: writes.append(kwargs)

    report = standardize_existing_google_docs_in_folder("root", dry_run=True)

    assert report["would_standardize"] == [{"doc_name": "Call", "link": ""}]
    assert report["standardized"] == []
    assert writes == []



def test_docs_only_dry_run_counts_old_standard_as_would_standardize() -> None:
    writes = []
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-1", "name": "Call", "mimeType": DOC_MIME},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_legacy_standard_document()
    HELPERS["write_title_and_text_to_doc"] = lambda **kwargs: writes.append(kwargs)

    report = standardize_existing_google_docs_in_folder("root", dry_run=True)

    assert report["would_standardize"] == [{"doc_name": "Call", "link": ""}]
    assert report["already_structured"] == []
    assert report["standardized"] == []
    assert writes == []


def test_docs_only_apply_rewrites_old_standard_to_v12_and_preserves_body() -> None:
    title = "Бонусный урок. Личные финансы для помогающего практика"
    body = (
        "Сегодня поговорим о личных финансах помогающего практика.\n\n"
        "Важно сохранять опору, не переписывать смысл и не терять исходные слова."
    )
    legacy = build_legacy_standard_document(title=title, body=body)
    writes = []
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-1", "name": title, "mimeType": DOC_MIME},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: legacy
    HELPERS["write_title_and_text_to_doc"] = lambda **kwargs: writes.append(kwargs)

    report = standardize_existing_google_docs_in_folder("root", dry_run=False)

    assert [item["doc_name"] for item in report["standardized"]] == [title]
    assert report["already_structured"] == []
    assert len(writes) == 1
    rewritten_text = writes[0]["transcript_text"]
    assert "Source file:" not in rewritten_text
    assert "Source mode:" not in rewritten_text
    assert "Provider: unknown" in rewritten_text
    assert "Model: unknown" in rewritten_text
    assert "Language: unknown" in rewritten_text
    assert "Speakers: unknown" in rewritten_text
    assert "Created at: 2026-06-01T00:00:00+00:00" in rewritten_text
    assert body in rewritten_text
    assert is_structured_transcript_document_text(rewritten_text)

    HELPERS["extract_google_doc_plain_text"] = lambda document_id: rewritten_text
    subsequent_dry_run = standardize_existing_google_docs_in_folder("root", dry_run=True)
    assert subsequent_dry_run["would_standardize"] == []
    assert [item["doc_name"] for item in subsequent_dry_run["already_structured"]] == [title]


def test_docs_only_apply_rewrites_only_not_yet_structured_google_docs() -> None:
    structured = build_structured_transcript_document_text(
        document_title="Done",
        transcript_text="Already done.",
        metadata_lines=build_transcript_metadata_lines(
            source_name="not available",
            source_mode="existing_google_doc_standardization",
            provider="unknown",
            provider_model="unknown",
            language="unknown",
            speakers_enabled=None,
            created_at="2026-06-01T00:00:00+00:00",
        ),
    )
    texts = {"doc-1": "Todo\n\nHello world.", "doc-2": structured}
    writes = []
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-1", "name": "Todo", "mimeType": DOC_MIME},
        {"id": "doc-2", "name": "Done", "mimeType": DOC_MIME},
        {"id": "pdf-1", "name": "Ignored.pdf", "mimeType": "application/pdf"},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: texts[document_id]
    HELPERS["write_title_and_text_to_doc"] = lambda **kwargs: writes.append(kwargs)

    report = standardize_existing_google_docs_in_folder("root", dry_run=False)

    assert report["google_docs_scanned"] == 2
    assert report["skipped_non_google_docs"] == 1
    assert [item["doc_name"] for item in report["standardized"]] == ["Todo"]
    assert [item["doc_name"] for item in report["already_structured"]] == ["Done"]
    assert len(writes) == 1
    assert writes[0]["document_id"] == "doc-1"
    assert writes[0]["title"] == "Todo"
    assert writes[0]["clear_first"] is True
    assert "Hello world." in writes[0]["transcript_text"]


def test_docs_only_metadata_is_honest_and_conservative() -> None:
    document_text = build_docs_only_standardized_transcript_document_text(
        document_title="Existing Doc",
        existing_document_text="Existing Doc\n\nHello world.",
        created_at="2026-06-01T00:00:00+00:00",
    )

    assert "Source file:" not in document_text
    assert "Source mode:" not in document_text
    assert "Provider: unknown" in document_text
    assert "Model: unknown" in document_text
    assert "Language: unknown" in document_text
    assert "Speakers: unknown" in document_text


def test_docs_only_flow_does_not_call_provider_create_doc_or_manifest_helpers() -> None:
    forbidden_calls = []
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-1", "name": "Call", "mimeType": DOC_MIME},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: "Call\n\nHello world."
    HELPERS["write_title_and_text_to_doc"] = lambda **kwargs: None
    for name in [
        "transcribe_fileobj",
        "transcribe_openai_fileobj",
        "transcribe_media_path",
        "create_google_doc",
        "save_manifest",
        "mark_manifest_done",
        "mark_manifest_failed",
    ]:
        HELPERS[name] = lambda *args, _name=name, **kwargs: forbidden_calls.append(_name)

    standardize_existing_google_docs_in_folder("root", dry_run=False)

    assert forbidden_calls == []


def build_current_standard_document(title: str = "Call", body: str = "Hello world.") -> str:
    return build_structured_transcript_document_text(
        document_title=title,
        transcript_text=body,
        metadata_lines=build_transcript_metadata_lines(
            source_name="ignored.mp3",
            source_mode="Google Drive: 1 файл",
            provider="unknown",
            provider_model="unknown",
            language="unknown",
            speakers_enabled=None,
            created_at="2026-06-01T00:00:00+00:00",
        ),
    )


def test_existing_google_doc_manifest_signature_is_stable_doc_id_based_and_name_independent() -> None:
    first = build_existing_google_doc_manifest_signature("doc-1")
    second = build_existing_google_doc_manifest_signature("doc-1")
    other = build_existing_google_doc_manifest_signature("doc-2")

    assert first == second
    assert first != other
    assert first == HELPERS["json_sha256"]({"source_type": "existing_google_doc", "doc_id": "doc-1"})


def test_classify_existing_google_doc_transcript_standard_current_outdated_unstructured() -> None:
    assert classify_existing_google_doc_transcript_standard(build_current_standard_document()) == "current_standard"
    assert classify_existing_google_doc_transcript_standard(build_legacy_standard_document()) == "outdated_standard"
    assert classify_existing_google_doc_transcript_standard("Meeting notes without transcript headings") == "unstructured"



def test_extract_google_doc_id_from_url_parses_google_docs_links() -> None:
    assert extract_google_doc_id_from_url("https://docs.google.com/document/d/doc-123/edit") == "doc-123"
    assert extract_google_doc_id_from_url("https://docs.google.com/document/d/doc-123/edit?usp=drivesdk") == "doc-123"
    assert extract_google_doc_id_from_url("") == ""
    assert extract_google_doc_id_from_url("not a google doc url") == ""
    assert extract_google_doc_id_from_url("https://example.com/document/d/doc-123/edit") == ""


def test_find_manifest_entries_referencing_google_doc_finds_source_entries_by_doc_link() -> None:
    manifest = {
        "version": 1,
        "entries": {
            "source-a": {
                "status": "done",
                "source_name": "Lecture.mp3",
                "doc_name": "Lecture",
                "doc_link": "https://docs.google.com/document/d/doc-123/edit?usp=drivesdk",
            },
            "source-b": {
                "status": "done",
                "source_name": "Other.mp3",
                "doc_link": "https://docs.google.com/document/d/doc-999/edit",
            },
        },
    }

    matches = find_manifest_entries_referencing_google_doc(manifest, "doc-123")

    assert len(matches) == 1
    assert matches[0]["source_signature"] == "source-a"
    assert matches[0]["source_linked_manifest_match_type"] == "doc_id_from_doc_link"


def test_find_manifest_entries_referencing_google_doc_finds_source_entries_by_explicit_doc_id() -> None:
    manifest = {
        "version": 1,
        "entries": {
            "source-a": {
                "status": "done",
                "source_name": "Lecture.mp3",
                "doc_id": "doc-123",
            },
        },
    }

    matches = find_manifest_entries_referencing_google_doc(manifest, "doc-123")

    assert len(matches) == 1
    assert matches[0]["source_linked_manifest_match_type"] == "doc_id"


def test_find_manifest_entries_referencing_google_doc_excludes_doc_registry_entries() -> None:
    signature = build_existing_google_doc_manifest_signature("doc-123")
    manifest = {
        "version": 1,
        "entries": {
            signature: {
                "source_signature": signature,
                "source_type": "existing_google_doc",
                "status": "doc_registered",
                "doc_id": "doc-123",
                "doc_link": "https://docs.google.com/document/d/doc-123/edit",
                "source_meta": {"registration_mode": "existing_google_doc_manifest_registration"},
            },
            "source-a": {
                "status": "doc_registered",
                "doc_id": "doc-123",
            },
            "source-b": {
                "status": "done",
                "source_meta": {"registration_mode": "existing_google_doc_manifest_registration"},
                "doc_id": "doc-123",
            },
        },
    }

    assert find_manifest_entries_referencing_google_doc(manifest, "doc-123") == []


def test_manifest_registration_dry_run_reports_source_linked_manifest_match_without_already_registered() -> None:
    manifest = {
        "version": 1,
        "entries": {
            "old-source": {
                "status": "done",
                "source_name": "Lecture.mp3",
                "doc_name": "Lecture",
                "doc_link": "https://docs.google.com/document/d/doc-123/edit",
            },
        },
    }
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-123", "name": "Lecture", "mimeType": DOC_MIME, "webViewLink": "https://docs.google.com/document/d/doc-123/edit"},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_current_standard_document(title="Lecture")
    HELPERS["load_manifest_read_only"] = lambda: manifest

    report = register_existing_google_docs_in_manifest("folder-root", dry_run=True)

    assert len(report["would_register"]) == 1
    assert report["already_registered"] == []
    assert report["source_linked_manifest_matches"] == 1
    assert len(report["docs_with_source_linked_manifest_matches"]) == 1
    assert len(report["would_register_with_source_linked_match"]) == 1
    assert report["would_register_without_source_linked_match"] == []
    result_item = report["would_register"][0]
    assert result_item["source_linked_manifest_match_count"] == 1
    assert result_item["source_linked_manifest_statuses"] == ["done"]
    assert result_item["source_linked_manifest_doc_names"] == ["Lecture"]
    assert result_item["source_linked_manifest_match_type"] == "doc_id_from_doc_link"


def test_manifest_registration_dry_run_reports_no_source_linked_manifest_match() -> None:
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-123", "name": "Lecture", "mimeType": DOC_MIME},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_current_standard_document(title="Lecture")
    HELPERS["load_manifest_read_only"] = lambda: {"version": 1, "entries": {}}

    report = register_existing_google_docs_in_manifest("folder-root", dry_run=True)

    assert len(report["would_register"]) == 1
    assert report["source_linked_manifest_matches"] == 0
    assert report["docs_with_source_linked_manifest_matches"] == []
    assert report["would_register_with_source_linked_match"] == []
    assert len(report["would_register_without_source_linked_match"]) == 1


def test_manifest_registration_already_registered_is_only_existing_google_doc_registry_entry() -> None:
    source_manifest = {
        "version": 1,
        "entries": {
            "old-source": {
                "status": "done",
                "source_name": "Lecture.mp3",
                "doc_link": "https://docs.google.com/document/d/doc-123/edit",
            },
        },
    }
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-123", "name": "Lecture", "mimeType": DOC_MIME},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_current_standard_document(title="Lecture")
    HELPERS["load_manifest_read_only"] = lambda: source_manifest

    source_only = register_existing_google_docs_in_manifest("folder-root", dry_run=True)

    assert len(source_only["would_register"]) == 1
    assert source_only["already_registered"] == []

    signature = build_existing_google_doc_manifest_signature("doc-123")
    registry_manifest = {"version": 1, "entries": dict(source_manifest["entries"])}
    registry_manifest["entries"][signature] = {
        "source_signature": signature,
        "source_type": "existing_google_doc",
        "status": "doc_registered",
        "standard": "transcript_doc_v1.2",
        "doc_id": "doc-123",
        "doc_name": "Lecture",
        "doc_link": "https://docs.google.com/document/d/doc-123/edit",
        "doc_path": "Lecture",
        "doc_mime_type": DOC_MIME,
        "structured_status": "current_standard",
        "source_name": "Lecture",
        "note": "",
        "updated_at": "2026-06-01T00:00:00+00:00",
        "source_meta": {
            "folder_id": "folder-root",
            "folder_path": "",
            "recursive_scan": False,
            "registration_mode": "existing_google_doc_manifest_registration",
        },
    }
    HELPERS["load_manifest_read_only"] = lambda: registry_manifest

    registered = register_existing_google_docs_in_manifest("folder-root", dry_run=True)

    assert [item["doc_id"] for item in registered["already_registered"]] == ["doc-123"]
    assert registered["source_linked_manifest_matches"] == 1
    assert len(registered["already_registered_with_source_linked_match"]) == 1


def test_manifest_registration_apply_creates_registry_entry_and_preserves_source_linked_entry() -> None:
    saved = []
    manifest = {
        "version": 1,
        "entries": {
            "old-source": {
                "status": "done",
                "source_name": "Lecture.mp3",
                "doc_name": "Lecture",
                "doc_link": "https://docs.google.com/document/d/doc-123/edit",
            },
        },
    }
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-123", "name": "Lecture", "mimeType": DOC_MIME, "webViewLink": "https://docs.google.com/document/d/doc-123/edit"},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_current_standard_document(title="Lecture")
    HELPERS["load_manifest"] = lambda: manifest
    HELPERS["save_manifest"] = lambda incoming: saved.append(json.loads(json.dumps(incoming)))

    report = register_existing_google_docs_in_manifest("folder-root", dry_run=False)

    assert [item["doc_id"] for item in report["registered"]] == ["doc-123"]
    assert report["source_linked_manifest_matches"] == 1
    signature = build_existing_google_doc_manifest_signature("doc-123")
    assert set(manifest["entries"]) == {"old-source", signature}
    assert manifest["entries"]["old-source"]["status"] == "done"
    assert manifest["entries"][signature]["source_type"] == "existing_google_doc"
    assert manifest["entries"][signature]["status"] == "doc_registered"
    assert len([entry for entry in manifest["entries"].values() if entry.get("source_type") == "existing_google_doc"]) == 1
    assert saved


def test_manifest_registration_dry_run_does_not_call_manifest_write_docs_or_provider_helpers() -> None:
    calls = []
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-123", "name": "Lecture", "mimeType": DOC_MIME},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_current_standard_document(title="Lecture")
    HELPERS["load_manifest_read_only"] = lambda: {"version": 1, "entries": {}}
    HELPERS["get_or_create_manifest_file"] = lambda: calls.append("get_or_create_manifest_file")
    HELPERS["save_manifest"] = lambda manifest: calls.append("save_manifest")
    HELPERS["write_title_and_text_to_doc"] = lambda **kwargs: calls.append("write_title_and_text_to_doc")
    for name in [
        "transcribe_fileobj",
        "transcribe_openai_fileobj",
        "transcribe_media_path",
        "create_google_doc",
    ]:
        HELPERS[name] = lambda *args, _name=name, **kwargs: calls.append(_name)

    register_existing_google_docs_in_manifest("folder-root", dry_run=True)

    assert calls == []

def test_manifest_registration_dry_run_scans_classifies_and_does_not_save_or_mutate_docs() -> None:
    calls = []
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-1", "name": "Current", "mimeType": DOC_MIME, "webViewLink": "https://docs/doc-1"},
        {"id": "pdf-1", "name": "Ignored.pdf", "mimeType": "application/pdf"},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_current_standard_document()
    HELPERS["load_manifest"] = lambda: {"version": 1, "entries": {}}
    HELPERS["save_manifest"] = lambda manifest: calls.append("save_manifest")
    HELPERS["write_title_and_text_to_doc"] = lambda **kwargs: calls.append("write_title_and_text_to_doc")
    for name in [
        "transcribe_fileobj",
        "transcribe_openai_fileobj",
        "transcribe_media_path",
        "create_google_doc",
    ]:
        HELPERS[name] = lambda *args, _name=name, **kwargs: calls.append(_name)

    report = register_existing_google_docs_in_manifest(
        "folder-root", output_folder_path="MyDrive/Transcripts", dry_run=True
    )

    assert report["google_docs_scanned"] == 1
    assert report["skipped_non_google_docs"] == 1
    assert report["current_standard"] == 1
    assert [item["doc_id"] for item in report["would_register"]] == ["doc-1"]
    assert report["registered"] == []
    assert calls == []
    assert report["notice"] == "Manifest registration does not change Google Docs content."


def test_manifest_registration_apply_writes_existing_google_doc_manifest_entry_without_docs_mutation() -> None:
    saved = []
    writes = []
    manifest = {"version": 1, "entries": {}}
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-1", "name": "Call", "mimeType": DOC_MIME, "webViewLink": "https://docs/doc-1"},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_current_standard_document(title="Call")
    HELPERS["load_manifest"] = lambda: manifest
    HELPERS["save_manifest"] = lambda incoming: saved.append(json.loads(json.dumps(incoming)))
    HELPERS["write_title_and_text_to_doc"] = lambda **kwargs: writes.append(kwargs)

    report = register_existing_google_docs_in_manifest(
        "folder-root", output_folder_path="MyDrive/Transcripts", dry_run=False
    )

    assert [item["doc_id"] for item in report["registered"]] == ["doc-1"]
    assert saved
    assert writes == []
    signature = build_existing_google_doc_manifest_signature("doc-1")
    entry = saved[-1]["entries"][signature]
    assert entry["source_signature"] == signature
    assert entry["source_type"] == "existing_google_doc"
    assert entry["status"] == "doc_registered"
    assert entry["doc_id"] == "doc-1"
    assert entry["doc_name"] == "Call"
    assert entry["doc_link"] == "https://docs/doc-1"
    assert entry["doc_path"] == "MyDrive/Transcripts/Call"
    assert entry["structured_status"] == "current_standard"
    assert entry["source_meta"]["registration_mode"] == "existing_google_doc_manifest_registration"


def test_manifest_registration_apply_twice_does_not_duplicate_and_detects_already_registered() -> None:
    saved = []
    manifest = {"version": 1, "entries": {}}
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-1", "name": "Call", "mimeType": DOC_MIME, "webViewLink": "https://docs/doc-1"},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_current_standard_document(title="Call")
    HELPERS["load_manifest"] = lambda: manifest
    HELPERS["load_manifest_read_only"] = lambda: manifest
    HELPERS["save_manifest"] = lambda incoming: saved.append(json.loads(json.dumps(incoming)))

    first = register_existing_google_docs_in_manifest("folder-root", dry_run=False)
    second = register_existing_google_docs_in_manifest("folder-root", dry_run=False)
    dry_run = register_existing_google_docs_in_manifest("folder-root", dry_run=True)
    HELPERS["load_manifest_read_only"] = ORIGINAL_LOAD_MANIFEST_READ_ONLY

    assert len(manifest["entries"]) == 1
    assert len(first["registered"]) == 1
    assert second["registered"] == []
    assert [item["doc_id"] for item in second["already_registered"]] == ["doc-1"]
    assert [item["doc_id"] for item in dry_run["already_registered"]] == ["doc-1"]


def test_manifest_registration_records_outdated_current_and_unstructured_status_without_changing_content() -> None:
    original_texts = {
        "doc-old": build_legacy_standard_document(title="Old"),
        "doc-current": build_current_standard_document(title="Current"),
        "doc-plain": "Plain notes only",
    }
    texts = dict(original_texts)
    manifest = {"version": 1, "entries": {}}
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-old", "name": "Old", "mimeType": DOC_MIME},
        {"id": "doc-current", "name": "Current", "mimeType": DOC_MIME},
        {"id": "doc-plain", "name": "Plain", "mimeType": DOC_MIME},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: texts[document_id]
    HELPERS["load_manifest"] = lambda: manifest
    HELPERS["save_manifest"] = lambda incoming: None
    HELPERS["write_title_and_text_to_doc"] = lambda **kwargs: texts.__setitem__(kwargs["document_id"], kwargs["transcript_text"])

    report = register_existing_google_docs_in_manifest("folder-root", dry_run=False)

    statuses = {entry["doc_id"]: entry["structured_status"] for entry in manifest["entries"].values()}
    assert statuses == {
        "doc-current": "current_standard",
        "doc-old": "outdated_standard",
        "doc-plain": "unstructured",
    }
    assert report["current_standard"] == 1
    assert report["outdated_standard"] == 1
    assert report["unstructured"] == 1
    assert texts == original_texts


def test_manifest_registration_recursive_scan_uses_visited_folders_and_reports_limits() -> None:
    calls = []
    children = {
        "root": [
            {"id": "folder-a", "name": "A", "mimeType": FOLDER_MIME},
            {"id": "folder-a", "name": "A Shortcut", "mimeType": FOLDER_MIME},
        ],
        "folder-a": [
            {"id": "root", "name": "Back", "mimeType": FOLDER_MIME},
            {"id": "doc-1", "name": "Nested", "mimeType": DOC_MIME},
        ],
    }

    def list_children(folder_id):
        calls.append(folder_id)
        return children[folder_id]

    HELPERS["list_drive_folder_children"] = list_children
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_current_standard_document()
    HELPERS["load_manifest"] = lambda: {"version": 1, "entries": {}}

    report = register_existing_google_docs_in_manifest("root", recursive=True, dry_run=True)
    assert calls == ["root", "folder-a"]
    assert report["folders_seen"] == 3
    assert [item["doc_name"] for item in report["would_register"]] == ["A/Nested"]

    HELPERS["list_drive_folder_children"] = lambda folder_id: children[folder_id]
    limited = register_existing_google_docs_in_manifest("root", recursive=True, dry_run=True, max_folders=1)
    assert limited["errors"]
    assert "лимит сканирования папок" in limited["errors"][0]["reason"]

    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-1", "name": "One", "mimeType": DOC_MIME},
        {"id": "doc-2", "name": "Two", "mimeType": DOC_MIME},
    ]
    doc_limited = register_existing_google_docs_in_manifest("root", dry_run=True, max_docs=1)
    assert doc_limited["google_docs_scanned"] == 1
    assert "лимит сканирования Google Docs" in doc_limited["errors"][0]["reason"]


def test_normal_transcription_manifest_skip_behavior_remains_unchanged() -> None:
    now = datetime.now(timezone.utc).isoformat()
    old = (datetime.now(timezone.utc) - timedelta(hours=13)).isoformat()
    manifest = {
        "version": 1,
        "entries": {
            "done": {"status": "done", "settings_signature": "settings-a"},
            "imported": {"status": "imported_done", "settings_signature": "other"},
            "fresh": {"status": "in_progress", "started_at": now},
            "stale": {"status": "in_progress", "started_at": old},
        },
    }

    assert should_skip_by_manifest(manifest, "done", "settings-a")[0] is True
    assert should_skip_by_manifest(manifest, "done", "settings-b")[0] is False
    assert should_skip_by_manifest(manifest, "imported", "settings-b")[0] is True
    assert should_skip_by_manifest(manifest, "fresh", "settings-b")[0] is True
    assert should_skip_by_manifest(manifest, "stale", "settings-b")[0] is False


def reset_manifest_cache_for_test() -> None:
    HELPERS["load_manifest_read_only"] = ORIGINAL_LOAD_MANIFEST_READ_ONLY
    HELPERS["MANIFEST_CACHE"].update({
        "state_folder_id": None,
        "manifest_folder_id": None,
        "file_id": None,
        "data": None,
    })


def test_manifest_registration_dry_run_read_only_loader_does_not_create_or_save_when_manifest_missing() -> None:
    reset_manifest_cache_for_test()
    calls = []
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-new", "name": "New", "mimeType": DOC_MIME},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_current_standard_document(title="New")
    HELPERS["find_file_in_folder"] = lambda folder_id, file_name: calls.append(("find", folder_id, file_name)) or None
    HELPERS["get_or_create_manifest_file"] = lambda: calls.append(("get_or_create",))
    HELPERS["load_manifest"] = lambda: calls.append(("load_manifest",)) or {"version": 1, "entries": {}}
    HELPERS["save_manifest"] = lambda manifest: calls.append(("save_manifest",))

    report = register_existing_google_docs_in_manifest("folder-root", dry_run=True)

    assert [item["doc_id"] for item in report["would_register"]] == ["doc-new"]
    assert ("get_or_create",) not in calls
    assert ("load_manifest",) not in calls
    assert ("save_manifest",) not in calls
    assert calls == [("find", "root", "VoiceOps Workspace")]


def test_manifest_registration_dry_run_reads_existing_manifest_without_creation() -> None:
    reset_manifest_cache_for_test()
    calls = []
    signature = build_existing_google_doc_manifest_signature("doc-1")
    existing_entry = {
        "source_signature": signature,
        "source_type": "existing_google_doc",
        "status": "doc_registered",
        "standard": "transcript_doc_v1.2",
        "doc_id": "doc-1",
        "doc_name": "Call",
        "doc_link": "https://docs/doc-1",
        "doc_path": "Call",
        "doc_mime_type": DOC_MIME,
        "structured_status": "current_standard",
        "source_name": "Call",
        "note": "",
        "updated_at": "2026-06-01T00:00:00+00:00",
        "source_meta": {
            "folder_id": "folder-root",
            "folder_path": "",
            "recursive_scan": False,
            "registration_mode": "existing_google_doc_manifest_registration",
        },
    }
    existing_manifest = {"version": 1, "entries": {signature: existing_entry}}

    def find_file(folder_id, file_name):
        calls.append(("find", folder_id, file_name))
        found = {
            ("root", "VoiceOps Workspace"): {"id": "state-id", "name": "VoiceOps Workspace"},
            ("state-id", "manifest"): {"id": "manifest-folder-id", "name": "manifest"},
            ("manifest-folder-id", "elevenlabs_transcription_manifest.json"): {
                "id": "manifest-file-id",
                "name": "elevenlabs_transcription_manifest.json",
            },
        }
        return found.get((folder_id, file_name))

    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-1", "name": "Call", "mimeType": DOC_MIME, "webViewLink": "https://docs/doc-1"},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_current_standard_document(title="Call")
    HELPERS["find_file_in_folder"] = find_file
    HELPERS["read_manifest_file_by_id"] = lambda file_id: calls.append(("read", file_id)) or existing_manifest
    HELPERS["get_or_create_manifest_file"] = lambda: calls.append(("get_or_create",))
    HELPERS["save_manifest"] = lambda manifest: calls.append(("save_manifest",))

    report = register_existing_google_docs_in_manifest("folder-root", dry_run=True)

    assert [item["doc_id"] for item in report["already_registered"]] == ["doc-1"]
    assert ("read", "manifest-file-id") in calls
    assert ("get_or_create",) not in calls
    assert ("save_manifest",) not in calls


def test_manifest_registration_apply_uses_existing_load_and_save_behavior() -> None:
    reset_manifest_cache_for_test()
    calls = []
    manifest = {"version": 1, "entries": {}}
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-apply", "name": "Apply", "mimeType": DOC_MIME},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_current_standard_document(title="Apply")
    HELPERS["load_manifest"] = lambda: calls.append(("load_manifest",)) or manifest
    HELPERS["load_manifest_read_only"] = lambda: calls.append(("load_manifest_read_only",)) or manifest
    HELPERS["save_manifest"] = lambda incoming: calls.append(("save_manifest", json.loads(json.dumps(incoming))))

    report = register_existing_google_docs_in_manifest("folder-root", dry_run=False)

    assert [item["doc_id"] for item in report["registered"]] == ["doc-apply"]
    assert [call[0] for call in calls] == ["load_manifest", "save_manifest"]
    assert "load_manifest_read_only" not in [call[0] for call in calls]

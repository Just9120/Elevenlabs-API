"""Unit tests for pure text-processing helpers in the Colab workflow.

The canonical runtime file is a Colab-exported script with top-level shell magic,
Colab auth, widget setup, and Google service initialization.  Importing it in a
normal pytest process would either be invalid Python or trigger runtime side
effects, so these tests execute only the helper function definitions extracted
from the source file.
"""

from __future__ import annotations

import ast
import re
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
                    "FOLDER_MIME",
                    "DOC_MIME",
                    "DOCS_ONLY_STANDARDIZATION_SOURCE_FILE",
                    "DOCS_ONLY_STANDARDIZATION_SOURCE_MODE",
                    "DOCS_ONLY_STANDARDIZATION_DEFAULT_MAX_FOLDERS_SCANNED",
                    "DOCS_ONLY_STANDARDIZATION_DEFAULT_MAX_GOOGLE_DOCS_SCANNED",
                    "DOCS_ONLY_STANDARDIZATION_NESTED_FOLDER_HINT",
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
        "re": re,
        # These globals are runtime tuning knobs used by the overlap helper.
        # They are injected here so the pure function can be tested in isolation
        # from the Colab runtime configuration surface.
        "OPENAI_MERGE_MAX_OVERLAP_TOKENS": 12,
        "OPENAI_MERGE_MIN_OVERLAP_TOKENS": 3,
        "list_drive_folder_children": lambda _folder_id: [],
        "extract_google_doc_plain_text": lambda _document_id: "",
        "write_title_and_text_to_doc": lambda **_kwargs: None,
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
DOC_MIME = HELPERS["DOC_MIME"]
FOLDER_MIME = HELPERS["FOLDER_MIME"]


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

    assert lines == [
        "Source file: lecture.mp3",
        "Source mode: Google Drive: 1 файл",
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
        "Source file: call.flac",
        "Source mode: Google Drive: 1 файл",
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
        "Source file: call.flac\n"
        "Source mode: Google Drive: 1 файл\n"
        "Provider: OpenAI\n"
        "Model: gpt-4o-transcribe\n"
        "Language: Автоопределение\n"
        "Speakers: no\n"
        "Created at: 2026-06-01T00:00:00+00:00\n\n"
        "Transcript\n\n"
        "Hello world."
    )


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
        "Source file: Legacy Call.mp3\n"
        "Source mode: Google Drive: папка\n"
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

    assert "Source file: not available" in document_text
    assert "Source mode: existing_google_doc_standardization" in document_text
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

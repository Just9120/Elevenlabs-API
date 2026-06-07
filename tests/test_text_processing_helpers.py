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
from typing import Optional
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
    "get_existing_google_doc_created_at_source",
    "resolve_existing_google_doc_created_at",
    "extract_existing_transcript_created_at",
    "format_visible_transcript_timestamp",
    "existing_google_doc_backfill_metadata_needs_refresh",
    "extract_structured_transcript_metadata_values",
    "is_visible_transcript_timestamp",
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
    "read_manifest_file_raw_by_id",
    "read_manifest_file_by_id",
    "load_manifest_read_only",
    "normalize_manifest_data",
    "make_manifest_default",
    "make_manifest_v2_default",
    "is_manifest_v2",
    "should_skip_by_manifest",
    "parse_iso_datetime",
    "build_existing_google_doc_manifest_signature",
    "get_manifest_entry",
    "classify_existing_google_doc_transcript_standard",
    "build_existing_google_doc_link",
    "extract_google_doc_id_from_url",
    "build_transcript_standard_check",
    "standard_check_from_structured_status",
    "build_manifest_v2_document_entry",
    "normalize_manifest_source_entry",
    "put_manifest_source_entry",
    "with_output_folder_context",
    "upsert_manifest_v2_document_for_completed_source",
    "link_manifest_v2_source_to_document",
    "refresh_manifest_v2_summary",
    "build_manifest_v2_from_existing_manifest_and_docs",
    "comparable_manifest_v2_for_material_change",
    "manifest_v2_material_changes_needed",
    "create_manifest_backup",
    "write_active_manifest_v2",
    "standardize_manifest_to_v2_for_existing_google_docs",
    "is_existing_google_doc_registry_entry",
    "find_manifest_entries_referencing_google_doc",
    "build_existing_google_doc_manifest_entry",
    "build_existing_google_doc_manifest_document_entry",
    "existing_google_doc_manifest_document_needs_update",
    "comparable_standard_check_observation",
    "comparable_manifest_source_meta",
    "existing_google_doc_manifest_entry_needs_update",
    "upsert_existing_google_doc_manifest_entry",
    "register_existing_google_docs_in_manifest",
    "set_manifest_entry",
    "mark_manifest_in_progress",
    "mark_manifest_done",
    "mark_manifest_failed",
    "merge_manifest_data",
    "save_manifest",
    "summarize_manifest_catalog_for_report",
    "comparable_manifest_v2_document_for_report",
    "build_standardize_existing_docs_report_text",
    "print_standardize_existing_docs_report",
    "yes_no",
    "build_standardize_manifest_v2_report_text",
    "print_standardize_manifest_v2_report",
    "is_supported_filename",
    "validate_drive_multi_selected_items",
    "summarize_drive_multi_selection",
    "get_drive_source_double_click_action",
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
                    "EXISTING_DOCS_BACKFILL_METADATA_DEFAULTS_SOURCE",
                    "EXISTING_DOCS_BACKFILL_SPEAKERS_ENABLED",
                    "EXISTING_DOCS_BACKFILL_LANGUAGE",
                    "EXISTING_DOCS_BACKFILL_PROVIDER_MODEL",
                    "EXISTING_DOCS_BACKFILL_PROVIDER",
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
                    "TRANSCRIPT_STANDARD_CHECKER_VERSION",
                    "TRANSCRIPT_STANDARD_TARGET",
                    "MANIFEST_BACKUP_FOLDER_NAME",
                    "MANIFEST_V2_TARGET_VERSION",
                    "MANIFEST_V2_SCHEMA",
                    "AUDIO_EXTENSIONS",
                    "VIDEO_EXTENSIONS",
                    "SUPPORTED_EXTENSIONS",
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
        "Optional": Optional,
        "Path": Path,
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
format_visible_transcript_timestamp = HELPERS["format_visible_transcript_timestamp"]
existing_google_doc_backfill_metadata_needs_refresh = HELPERS["existing_google_doc_backfill_metadata_needs_refresh"]
extract_existing_transcript_created_at = HELPERS["extract_existing_transcript_created_at"]
resolve_existing_google_doc_created_at = HELPERS["resolve_existing_google_doc_created_at"]
get_existing_google_doc_created_at_source = HELPERS["get_existing_google_doc_created_at_source"]
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

build_standardize_existing_docs_report_text = HELPERS["build_standardize_existing_docs_report_text"]
print_standardize_existing_docs_report = HELPERS["print_standardize_existing_docs_report"]
build_standardize_manifest_v2_report_text = HELPERS["build_standardize_manifest_v2_report_text"]
print_standardize_manifest_v2_report = HELPERS["print_standardize_manifest_v2_report"]

build_existing_google_doc_manifest_signature = HELPERS["build_existing_google_doc_manifest_signature"]
classify_existing_google_doc_transcript_standard = HELPERS["classify_existing_google_doc_transcript_standard"]
register_existing_google_docs_in_manifest = HELPERS["register_existing_google_docs_in_manifest"]
extract_google_doc_id_from_url = HELPERS["extract_google_doc_id_from_url"]
find_manifest_entries_referencing_google_doc = HELPERS["find_manifest_entries_referencing_google_doc"]
load_manifest_read_only = HELPERS["load_manifest_read_only"]
ORIGINAL_LOAD_MANIFEST_READ_ONLY = load_manifest_read_only
should_skip_by_manifest = HELPERS["should_skip_by_manifest"]

make_manifest_v2_default = HELPERS["make_manifest_v2_default"]
build_transcript_standard_check = HELPERS["build_transcript_standard_check"]
build_manifest_v2_from_existing_manifest_and_docs = HELPERS["build_manifest_v2_from_existing_manifest_and_docs"]
standardize_manifest_to_v2_for_existing_google_docs = HELPERS["standardize_manifest_to_v2_for_existing_google_docs"]
comparable_manifest_v2_for_material_change = HELPERS["comparable_manifest_v2_for_material_change"]
manifest_v2_material_changes_needed = HELPERS["manifest_v2_material_changes_needed"]
mark_manifest_in_progress = HELPERS["mark_manifest_in_progress"]
mark_manifest_done = HELPERS["mark_manifest_done"]
mark_manifest_failed = HELPERS["mark_manifest_failed"]
get_manifest_entry = HELPERS["get_manifest_entry"]
save_manifest = HELPERS["save_manifest"]
DOC_MIME = HELPERS["DOC_MIME"]
FOLDER_MIME = HELPERS["FOLDER_MIME"]
validate_drive_multi_selected_items = HELPERS["validate_drive_multi_selected_items"]
summarize_drive_multi_selection = HELPERS["summarize_drive_multi_selection"]
get_drive_source_double_click_action = HELPERS["get_drive_source_double_click_action"]


def test_validate_drive_multi_selected_items_preserves_order_and_normalizes() -> None:
    items = [
        {
            "id": "file-1",
            "name": "Lecture.mp3",
            "mimeType": "audio/mpeg",
            "webViewLink": "https://drive/file-1",
            "modifiedTime": "2026-06-01T00:00:00Z",
            "size": "123",
        },
        {"id": "file-2", "name": "Demo.MP4", "mimeType": "video/mp4", "display_name": "Folder/Demo.MP4"},
    ]

    normalized = validate_drive_multi_selected_items(items)

    assert [item["id"] for item in normalized] == ["file-1", "file-2"]
    assert normalized[0]["display_name"] == "Lecture.mp3"
    assert normalized[1]["display_name"] == "Folder/Demo.MP4"
    assert normalized[0]["size"] == "123"


def test_validate_drive_multi_selected_items_rejects_empty_folders_and_unsupported() -> None:
    for items, expected in [
        ([], "Выбери один или несколько файлов"),
        ([{"id": "folder-1", "name": "Nested", "mimeType": FOLDER_MIME}], "Папку нельзя выбрать"),
        ([{"id": "txt-1", "name": "notes.txt", "mimeType": "text/plain"}], "Неподдерживаемое расширение"),
    ]:
        try:
            validate_drive_multi_selected_items(items)
        except ValueError as error:
            assert expected in str(error)
        else:
            raise AssertionError("Expected ValueError")


def test_summarize_drive_multi_selection_is_compact_and_limits_names() -> None:
    items = [{"id": str(idx), "name": f"file-{idx}.mp3", "mimeType": "audio/mpeg"} for idx in range(12)]

    summary = summarize_drive_multi_selection(items, limit=10)

    assert summary.startswith("Выбрано файлов: 12")
    assert "- file-0.mp3" in summary
    assert "- file-9.mp3" in summary
    assert "file-10.mp3" not in summary
    assert "... ещё 2" in summary


def test_drive_source_double_click_action_mapping_is_conservative() -> None:
    assert get_drive_source_double_click_action("drive_file", True) == "open"
    assert get_drive_source_double_click_action("drive_file", False) == "select"
    assert get_drive_source_double_click_action("drive_folder", True) == "open"
    assert get_drive_source_double_click_action("drive_folder", False) == "none"
    assert get_drive_source_double_click_action("drive_multi", True) == "open"
    assert get_drive_source_double_click_action("drive_multi", False) == "none"
    assert get_drive_source_double_click_action("local_file", True) == "none"
    assert get_drive_source_double_click_action("local_file", False) == "none"
    assert get_drive_source_double_click_action("local_multi", True) == "none"
    assert get_drive_source_double_click_action("local_multi", False) == "none"



def test_drive_multi_source_double_click_navigation_is_folder_only() -> None:
    source = CANONICAL_SOURCE.read_text(encoding="utf-8")

    assert "elevenlabs-drive-source-select-multi" in source
    assert "const MULTI_CLASS = 'elevenlabs-drive-source-select-multi';" in source
    assert "[SINGLE_CLASS, MULTI_CLASS].forEach" in source

    double_click_callback = source.split("def on_source_item_double_clicked", 1)[1].split(
        "def install_drive_source_double_click_js",
        1,
    )[0]
    drive_multi_block = double_click_callback.split('if mode == "drive_multi":', 1)[1].split(
        'if selected_id and selected_id in source_picker_state["item_map"]:',
        1,
    )[0]

    assert 'source_items_select_multi.value = (selected_id,)' in drive_multi_block
    assert "on_source_open_clicked(None)" in drive_multi_block
    assert "on_source_select_clicked(None)" not in drive_multi_block
    assert "В режиме Google Drive: несколько файлов двойной клик может открыть папку" in source
    assert "выбор файлов и запуск набора остаются явными через кнопку «Выбрать файлы»" in source

def test_destination_folder_double_click_navigation_is_conservative() -> None:
    source = CANONICAL_SOURCE.read_text(encoding="utf-8")

    assert "elevenlabs.destinationFolderDoubleClick" in source
    assert "elevenlabs-destination-folder-picker" in source
    assert "elevenlabs-destination-folder-select" in source
    assert "data-elevenlabs-destination-folder-dblclick-bound" in source
    double_click_callback = source.split("def on_picker_folder_double_clicked", 1)[1].split(
        "def install_destination_folder_double_click_js",
        1,
    )[0]

    assert "on_picker_open_clicked(None)" in double_click_callback
    assert "on_picker_select_clicked(None)" not in double_click_callback
    assert "двойной клик по папке в списке может открыть" in source
    assert "Выбор папки назначения остаётся явным" in source


def test_source_input_ui_uses_picker_only_internal_drive_value() -> None:
    source = CANONICAL_SOURCE.read_text(encoding="utf-8")

    assert "source_input_mode_widget" not in source
    assert "Путь / ссылка" not in source
    assert 'description="Служебный источник:"' in source


def test_get_source_input_value_guards_against_stale_drive_mode_selection() -> None:
    source = CANONICAL_SOURCE.read_text(encoding="utf-8")

    expected = '''def get_source_input_value() -> str:
    current_mode = mode_widget.value
    if current_mode in {"drive_file", "drive_multi", "drive_folder"}:
        if source_picker_state.get("selected_mode") != current_mode:
            return ""
        return source_picker_state["selected_input"].strip()
    return ""
'''
    assert expected in source


def test_conflict_mode_widget_defaults_to_safe_skip() -> None:
    source = CANONICAL_SOURCE.read_text(encoding="utf-8")

    conflict_options = re.search(r"CONFLICT_MODE_OPTIONS = \[([\s\S]*?)\n\]", source)
    assert conflict_options is not None
    for mode in ['"skip"', '"update"', '"archive_recreate"', '"copy_suffix"']:
        assert mode in conflict_options.group(1)

    conflict_widget = re.search(r"conflict_mode_widget = widgets\.Dropdown\(([\s\S]*?)\n\)", source)
    assert conflict_widget is not None
    assert 'options=CONFLICT_MODE_OPTIONS' in conflict_widget.group(1)
    assert 'value="skip"' in conflict_widget.group(1)
    assert 'value="update"' not in conflict_widget.group(1)


def test_drive_source_selected_html_uses_dark_theme_readable_colors() -> None:
    source = CANONICAL_SOURCE.read_text(encoding="utf-8")

    selected_source_block = re.search(
        r'source_selected_html\.value = f?"""([\s\S]*?<b>Выбран источник:</b>[\s\S]*?</div>)',
        source,
    )
    assert selected_source_block is not None
    selected_html = selected_source_block.group(1)

    assert "background:#eef6ff;" in selected_html
    assert "color:#202124;" in selected_html
    assert '<code style="' in selected_html
    assert "color:#202124;" in selected_html.split("<code", 1)[1].split(">", 1)[0]
    assert "white-space:pre-wrap;" in selected_html.split("<code", 1)[1].split(">", 1)[0]
    assert "format_drive_multi_summary_html" in source


def test_docs_do_not_describe_drive_multi_as_unavailable() -> None:
    docs_text = "\n".join(
        path.read_text(encoding="utf-8")
        for path in [Path("README.md"), Path("docs/project-spec.md"), Path("VALIDATION_MATRIX.md")]
    )

    stale_phrases = [
        "drive_multi not added",
        "drive_multi не добав",
        "drive_multi planned",
        "drive_multi план",
    ]
    assert not any(phrase.casefold() in docs_text.casefold() for phrase in stale_phrases)


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


def test_format_visible_transcript_timestamp_handles_iso_and_visible_values() -> None:
    assert format_visible_transcript_timestamp("2026-06-03T11:46:04.472894+00:00") == "2026-06-03 11:46 UTC"
    assert format_visible_transcript_timestamp("2026-06-03T11:46:04Z") == "2026-06-03 11:46 UTC"
    assert format_visible_transcript_timestamp("2026-06-03T14:46:04+03:00") == "2026-06-03 11:46 UTC"
    assert format_visible_transcript_timestamp("2026-06-03 11:46 UTC") == "2026-06-03 11:46 UTC"
    assert format_visible_transcript_timestamp("") == "unknown"
    assert format_visible_transcript_timestamp("  not a timestamp  ") == "not a timestamp"


def test_extract_existing_transcript_created_at_reads_current_and_legacy_metadata_only() -> None:
    current = build_structured_transcript_document_text(
        document_title="Call",
        transcript_text="Body",
        metadata_lines=build_transcript_metadata_lines(
            source_name="ignored",
            source_mode="ignored",
            provider="ElevenLabs",
            provider_model="scribe_v2",
            language="Русский",
            speakers_enabled=None,
            created_at="2026-06-03 11:46 UTC",
        ),
    )
    legacy = build_legacy_standard_document()

    assert extract_existing_transcript_created_at(current) == "2026-06-03 11:46 UTC"
    assert extract_existing_transcript_created_at(legacy) == "2026-06-02T10:26:40.369268+00:00"
    assert extract_existing_transcript_created_at("Call\n\nTranscript metadata\nProvider: ElevenLabs\n\nTranscript\n\nBody") == ""
    assert extract_existing_transcript_created_at("Call\n\nCreated at: 2026-06-03T11:46:04Z\nBody") == ""
    assert extract_existing_transcript_created_at(
        "Call\n\nTranscript metadata\nProvider: ElevenLabs\nModel: scribe_v2\nLanguage: Русский\n"
        "Speakers: unknown\nCreated at: 2026-06-01T00:00:00+00:00\n\nTranscript\n\n"
        "Created at: 2099-01-01T00:00:00+00:00"
    ) == "2026-06-01T00:00:00+00:00"


def test_resolve_existing_google_doc_created_at_priority_and_no_now_fallback() -> None:
    existing = build_legacy_standard_document()

    assert resolve_existing_google_doc_created_at(
        existing,
        {"createdTime": "2026-06-03T11:46:04Z"},
    ) == "2026-06-02 10:26 UTC"
    assert resolve_existing_google_doc_created_at(
        existing,
        {"createdTime": "2026-06-03T11:46:04Z"},
        prefer_drive_created_time_for_metadata_refresh=True,
    ) == "2026-06-03 11:46 UTC"
    assert get_existing_google_doc_created_at_source(existing, {"createdTime": "2026-06-03T11:46:04Z"}) == "existing_metadata"
    assert get_existing_google_doc_created_at_source(
        existing,
        {"createdTime": "2026-06-03T11:46:04Z"},
        prefer_drive_created_time_for_metadata_refresh=True,
    ) == "drive_createdTime"
    assert resolve_existing_google_doc_created_at("Call\n\nBody", {"createdTime": "2026-06-03T11:46:04Z"}) == "2026-06-03 11:46 UTC"
    assert get_existing_google_doc_created_at_source("Call\n\nBody", {"createdTime": "2026-06-03T11:46:04Z"}) == "drive_createdTime"
    assert resolve_existing_google_doc_created_at("Call\n\nBody", {}) == "unknown"
    assert get_existing_google_doc_created_at_source("Call\n\nBody", {}) == "unknown"
    assert resolve_existing_google_doc_created_at("Call\n\nBody", {}) != HELPERS["utc_now_iso"]()


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


def test_build_backfilled_transcript_document_text_uses_temporary_existing_docs_defaults() -> None:
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
        "Provider: ElevenLabs\n"
        "Model: scribe_v2\n"
        "Language: Русский\n"
        "Speakers: unknown\n"
        "Created at: 2026-06-01 00:00 UTC\n\n"
        "Transcript\n\n"
        "Hello world."
    )
    assert "Source file:" not in document_text
    assert "Source mode:" not in document_text
    assert "Standardized at:" not in document_text
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
            provider="ElevenLabs",
            provider_model="scribe_v2",
            language="Русский",
            speakers_enabled=None,
            created_at="2026-06-01 00:00 UTC",
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

    assert report["would_standardize"] == [{
        "doc_name": "Call",
        "link": "",
        "structured_status": "unstructured",
        "created_at_source": "unknown",
        "metadata_defaults_source": "temporary_existing_docs_backfill_defaults",
    }]
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

    assert report["would_standardize"] == [{
        "doc_name": "Call",
        "link": "",
        "structured_status": "outdated",
        "created_at_source": "existing_metadata",
        "metadata_defaults_source": "temporary_existing_docs_backfill_defaults",
    }]
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
    assert "Provider: ElevenLabs" in rewritten_text
    assert "Model: scribe_v2" in rewritten_text
    assert "Language: Русский" in rewritten_text
    assert "Speakers: unknown" in rewritten_text
    assert "Created at: 2026-06-02 10:26 UTC" in rewritten_text
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
            provider="ElevenLabs",
            provider_model="scribe_v2",
            language="Русский",
            speakers_enabled=None,
            created_at="2026-06-01 00:00 UTC",
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
    assert "Provider: ElevenLabs" in document_text
    assert "Model: scribe_v2" in document_text
    assert "Language: Русский" in document_text
    assert "Speakers: unknown" in document_text
    assert "Created at: 2026-06-01 00:00 UTC" in document_text


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


def test_current_shaped_old_backfill_metadata_needs_refresh() -> None:
    document_text = build_old_backfill_current_standard_document(title="Old Backfill", body="Original body.")

    assert is_structured_transcript_document_text(document_text)
    assert existing_google_doc_backfill_metadata_needs_refresh(document_text)


def test_docs_only_dry_run_refreshes_current_shaped_old_backfill_without_writing() -> None:
    writes = []
    document_text = build_old_backfill_current_standard_document(title="Old Backfill", body="Original body.")
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-1", "name": "Old Backfill", "mimeType": DOC_MIME, "createdTime": "2026-06-03T11:46:04Z"},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: document_text
    HELPERS["write_title_and_text_to_doc"] = lambda **kwargs: writes.append(kwargs)

    report = standardize_existing_google_docs_in_folder("root", dry_run=True)

    assert report["would_standardize"] == [{
        "doc_name": "Old Backfill",
        "link": "",
        "structured_status": "current_metadata_refresh",
        "created_at_source": "drive_createdTime",
        "metadata_defaults_source": "temporary_existing_docs_backfill_defaults",
    }]
    assert report["already_structured"] == []
    assert writes == []


def test_docs_only_apply_refreshes_current_shaped_old_backfill_and_prefers_drive_created_time() -> None:
    body = "First line.\n\nSecond line stays exactly the same."
    document_text = build_old_backfill_current_standard_document(title="Old Backfill", body=body)
    writes = []
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {
            "id": "doc-1",
            "name": "Old Backfill",
            "mimeType": DOC_MIME,
            "createdTime": "2026-06-03T11:46:04Z",
        },
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: document_text
    HELPERS["write_title_and_text_to_doc"] = lambda **kwargs: writes.append(kwargs)

    report = standardize_existing_google_docs_in_folder("root", dry_run=False)

    assert [item["structured_status"] for item in report["standardized"]] == ["current_metadata_refresh"]
    assert len(writes) == 1
    rewritten_text = writes[0]["transcript_text"]
    assert "Provider: ElevenLabs" in rewritten_text
    assert "Model: scribe_v2" in rewritten_text
    assert "Language: Русский" in rewritten_text
    assert "Speakers: unknown" in rewritten_text
    assert "Created at: 2026-06-03 11:46 UTC" in rewritten_text
    assert "Created at: 2026-06-01 00:00 UTC" not in rewritten_text
    assert "Source file:" not in rewritten_text
    assert "Source mode:" not in rewritten_text
    assert "Standardized at:" not in rewritten_text
    assert body in rewritten_text
    assert is_structured_transcript_document_text(rewritten_text)


def test_current_shaped_correct_backfill_and_openai_docs_are_already_current() -> None:
    correct_backfill = build_structured_transcript_document_text(
        document_title="Correct Backfill",
        transcript_text="Backfill body.",
        metadata_lines=build_transcript_metadata_lines(
            source_name="ignored",
            source_mode="ignored",
            provider="ElevenLabs",
            provider_model="scribe_v2",
            language="Русский",
            speakers_enabled=None,
            created_at="2026-06-03 11:46 UTC",
        ),
    )
    openai_doc = build_structured_transcript_document_text(
        document_title="OpenAI Doc",
        transcript_text="OpenAI body.",
        metadata_lines=build_transcript_metadata_lines(
            source_name="ignored",
            source_mode="ignored",
            provider="OpenAI",
            provider_model="gpt-4o-transcribe",
            language="Автоопределение",
            speakers_enabled=False,
            created_at="2026-06-03T11:46:04Z",
        ),
    )
    texts = {"doc-1": correct_backfill, "doc-2": openai_doc}
    writes = []
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-1", "name": "Correct Backfill", "mimeType": DOC_MIME},
        {"id": "doc-2", "name": "OpenAI Doc", "mimeType": DOC_MIME},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: texts[document_id]
    HELPERS["write_title_and_text_to_doc"] = lambda **kwargs: writes.append(kwargs)

    report = standardize_existing_google_docs_in_folder("root", dry_run=False)

    assert not existing_google_doc_backfill_metadata_needs_refresh(correct_backfill)
    assert not existing_google_doc_backfill_metadata_needs_refresh(openai_doc)
    assert report["would_standardize"] == []
    assert report["standardized"] == []
    assert [item["doc_name"] for item in report["already_structured"]] == ["Correct Backfill", "OpenAI Doc"]
    assert writes == []

def build_old_backfill_current_standard_document(title: str = "Call", body: str = "Hello world.") -> str:
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


def build_current_standard_document(title: str = "Call", body: str = "Hello world.") -> str:
    return build_structured_transcript_document_text(
        document_title=title,
        transcript_text=body,
        metadata_lines=build_transcript_metadata_lines(
            source_name="ignored.mp3",
            source_mode="Google Drive: 1 файл",
            provider="ElevenLabs",
            provider_model="scribe_v2",
            language="Русский",
            speakers_enabled=None,
            created_at="2026-06-01 00:00 UTC",
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


def test_manifest_v2_default_schema_has_decoupled_summary_standard_check() -> None:
    manifest = make_manifest_v2_default(updated_at="2026-06-01T00:00:00+00:00")

    assert manifest["version"] == 2
    assert manifest["schema"] == "voiceops_manifest_v2"
    assert manifest["documents"] == {}
    assert manifest["sources"] == {}
    assert manifest["summary"]["standard_check"]["target_standard"] == "transcript_doc_v1.2"
    assert "transcript_standard" not in manifest
    assert "structured_status" not in manifest


def test_build_transcript_standard_check_current_legacy_unstructured_and_unreadable() -> None:
    checked_at = "2026-06-01T00:00:00+00:00"

    current = build_transcript_standard_check(build_current_standard_document(), checked_at)
    legacy = build_transcript_standard_check(build_legacy_standard_document(), checked_at)
    plain = build_transcript_standard_check("Just plain notes", checked_at)
    unreadable = build_transcript_standard_check("", checked_at, unreadable=True)
    future = build_transcript_standard_check(build_current_standard_document(), checked_at, target_standard="transcript_doc_v1.3")
    manifest = make_manifest_v2_default(updated_at=checked_at)

    assert current["status"] == "current"
    assert current["detected_standard"] == "transcript_doc_v1.2"
    assert legacy["status"] == "outdated"
    assert legacy["detected_standard"] == "legacy_v1"
    assert plain["status"] == "unstructured"
    assert unreadable["status"] == "unreadable"
    assert future["target_standard"] == "transcript_doc_v1.3"
    assert manifest["version"] == 2


def test_v1_to_v2_migration_separates_documents_sources_links_and_omits_text() -> None:
    checked_at = "2026-06-01T00:00:00+00:00"
    registry_sig = build_existing_google_doc_manifest_signature("doc-a")
    manifest_v1 = {
        "version": 1,
        "entries": {
            registry_sig: {
                "source_signature": registry_sig,
                "source_type": "existing_google_doc",
                "status": "doc_registered",
                "doc_id": "doc-a",
                "doc_name": "Doc A",
                "doc_link": "https://docs.google.com/document/d/doc-a/edit",
                "structured_status": "current_standard",
                "transcript_text": "SHOULD_NOT_BE_COPIED_TO_DOCUMENT",
                "source_meta": {"folder_id": "old-folder", "folder_path": "Old"},
            },
            "source-by-link": {
                "source_signature": "source-by-link",
                "source_type": "drive",
                "source_name": "Audio A",
                "settings_signature": "settings",
                "status": "done",
                "doc_name": "Doc A",
                "doc_link": "https://docs.google.com/document/d/doc-a/edit",
                "source_meta": {"file_id": "file-a"},
                "transcript_text": "SHOULD_NOT_BE_COPIED_TO_SOURCE",
            },
            "source-by-id": {
                "source_signature": "source-by-id",
                "source_type": "drive",
                "source_name": "Audio B",
                "status": "done",
                "doc_id": "doc-b",
            },
            "orphan": {
                "source_signature": "orphan",
                "source_type": "local_path",
                "source_name": "No match",
                "status": "done",
            },
        },
    }
    docs = [
        {"id": "doc-a", "name": "Doc A", "mimeType": DOC_MIME, "display_name": "Doc A"},
        {"id": "doc-b", "name": "Doc B", "mimeType": DOC_MIME, "display_name": "Doc B"},
    ]
    checks = {
        "doc-a": build_transcript_standard_check(build_current_standard_document("Doc A"), checked_at),
        "doc-b": build_transcript_standard_check("plain", checked_at),
    }

    manifest_v2, counters = build_manifest_v2_from_existing_manifest_and_docs(
        manifest_v1, docs, checks, "folder-root", "MyDrive/Psych", False, checked_at
    )

    assert manifest_v2["version"] == 2
    assert manifest_v2["schema"] == "voiceops_manifest_v2"
    assert "entries" not in manifest_v2
    assert set(manifest_v2["documents"]) == {"doc-a", "doc-b"}
    assert set(manifest_v2["sources"]) == {"source-by-link", "source-by-id", "orphan"}
    assert manifest_v2["sources"]["source-by-link"]["doc_id"] == "doc-a"
    assert manifest_v2["sources"]["source-by-id"]["doc_id"] == "doc-b"
    assert manifest_v2["sources"]["orphan"]["doc_id"] == ""
    assert "source-by-link" in manifest_v2["documents"]["doc-a"]["source_signatures"]
    assert "source-by-id" in manifest_v2["documents"]["doc-b"]["source_signatures"]
    assert counters == {"source_entries_migrated": 3, "doc_registry_entries_migrated": 1}
    serialized = json.dumps(manifest_v2)
    assert "SHOULD_NOT_BE_COPIED" not in serialized


def test_existing_v2_rebuild_is_idempotent_preserves_sources_and_updates_standard_check() -> None:
    checked_at = "2026-06-01T00:00:00+00:00"
    v2 = make_manifest_v2_default(updated_at="old")
    v2["documents"]["doc-a"] = {
        "doc_id": "doc-a",
        "doc_name": "Doc A",
        "doc_link": "https://docs.google.com/document/d/doc-a/edit",
        "doc_path": "Doc A",
        "doc_mime_type": DOC_MIME,
        "document_type": "google_doc_transcript",
        "registration_status": "registered",
        "source_signatures": ["source-a"],
        "standard_check": {"target_standard": "transcript_doc_v1.2", "detected_standard": "unknown", "status": "unstructured", "checked_at": "old", "checker_version": "transcript_standard_checker_v1"},
        "updated_at": "old",
        "source_meta": {},
    }
    v2["sources"]["source-a"] = {"source_signature": "source-a", "source_type": "drive", "source_name": "Audio", "status": "done", "doc_id": "doc-a", "doc_link": "https://docs.google.com/document/d/doc-a/edit", "source_meta": {}, "updated_at": "old"}
    HELPERS["refresh_manifest_v2_summary"](v2)

    rebuilt, counters = build_manifest_v2_from_existing_manifest_and_docs(
        v2,
        [{"id": "doc-a", "name": "Doc A", "mimeType": DOC_MIME}],
        {"doc-a": build_transcript_standard_check(build_current_standard_document("Doc A"), checked_at)},
        "folder-root",
        "",
        False,
        checked_at,
    )

    assert counters == {"source_entries_migrated": 0, "doc_registry_entries_migrated": 0}
    assert list(rebuilt["documents"]) == ["doc-a"]
    assert list(rebuilt["sources"]) == ["source-a"]
    assert rebuilt["documents"]["doc-a"]["standard_check"]["status"] == "current"
    assert rebuilt["sources"]["source-a"]["doc_id"] == "doc-a"


def test_manifest_v2_compatibility_helpers_update_sources_and_skip_logic() -> None:
    now = datetime.now(timezone.utc).isoformat()
    old = (datetime.now(timezone.utc) - timedelta(hours=13)).isoformat()
    manifest = make_manifest_v2_default(updated_at=now)
    manifest["sources"].update({
        "done": {"source_signature": "done", "status": "done", "settings_signature": "settings-a"},
        "imported": {"source_signature": "imported", "status": "imported_done"},
        "fresh": {"source_signature": "fresh", "status": "in_progress", "started_at": now},
        "stale": {"source_signature": "stale", "status": "in_progress", "started_at": old},
    })
    manifest["documents"]["doc-1"] = {
        "doc_id": "doc-1",
        "doc_name": "Doc",
        "doc_link": "https://docs.google.com/document/d/doc-1/edit",
        "doc_path": "Doc",
        "doc_mime_type": DOC_MIME,
        "document_type": "google_doc_transcript",
        "registration_status": "registered",
        "source_signatures": [],
        "standard_check": build_transcript_standard_check("plain", now),
        "updated_at": now,
        "source_meta": {},
    }
    saved = []
    HELPERS["save_manifest"] = lambda incoming: saved.append(json.loads(json.dumps(incoming)))

    assert get_manifest_entry(manifest, "done")["status"] == "done"
    assert should_skip_by_manifest({"version": 1, "entries": {"v1": {"status": "done", "settings_signature": "x"}}}, "v1", "x")[0] is True
    assert should_skip_by_manifest(manifest, "done", "settings-a")[0] is True
    assert should_skip_by_manifest(manifest, "done", "settings-b")[0] is False
    assert should_skip_by_manifest(manifest, "imported", "settings-b")[0] is True
    assert should_skip_by_manifest(manifest, "fresh", "settings-b")[0] is True
    assert should_skip_by_manifest(manifest, "stale", "settings-b")[0] is False

    mark_manifest_in_progress(manifest, "new", "settings", "New Source")
    mark_manifest_done(manifest, "new", "settings", "New Source", "Doc", "https://docs.google.com/document/d/doc-1/edit")
    mark_manifest_failed(manifest, "failed", "settings", "Failed Source", "boom")

    assert manifest["sources"]["new"]["status"] == "done"
    assert manifest["sources"]["new"]["doc_id"] == "doc-1"
    assert "new" in manifest["documents"]["doc-1"]["source_signatures"]
    assert manifest["sources"]["failed"]["status"] == "failed"
    assert saved


def test_mark_manifest_done_v2_upserts_document_and_summary_immediately() -> None:
    manifest = make_manifest_v2_default(updated_at="2026-06-01T00:00:00+00:00")
    saved = []
    HELPERS["save_manifest"] = lambda incoming: saved.append(json.loads(json.dumps(incoming)))

    mark_manifest_done(
        manifest,
        "source-new",
        "settings",
        "Audio.mp3",
        "Transcript Doc",
        "https://docs.google.com/document/d/doc-new/edit",
        {"type": "drive", "output_folder_id": "folder-root", "output_folder_path": "MyDrive/Calls"},
    )

    source = manifest["sources"]["source-new"]
    document = manifest["documents"]["doc-new"]
    assert source["status"] == "done"
    assert source["doc_id"] == "doc-new"
    assert document["doc_id"] == "doc-new"
    assert document["doc_name"] == "Transcript Doc"
    assert document["doc_link"] == "https://docs.google.com/document/d/doc-new/edit"
    assert "source-new" in document["source_signatures"]
    assert document["standard_check"]["status"] == "current"
    assert document["source_meta"]["folder_id"] == "folder-root"
    assert document["source_meta"]["folder_path"] == "MyDrive/Calls"
    assert document["source_meta"]["registration_mode"] == "transcription_completion"
    assert manifest["summary"]["documents_total"] == 1
    assert manifest["summary"]["sources_total"] == 1
    assert manifest["summary"]["documents_with_sources"] == 1
    assert manifest["summary"]["orphan_sources"] == 0
    assert saved


def test_mark_manifest_done_v2_preserves_existing_document_source_signatures() -> None:
    manifest = make_manifest_v2_default(updated_at="2026-06-01T00:00:00+00:00")
    manifest["documents"]["doc-keep"] = make_registered_v2_document(doc_id="doc-keep", doc_name="Doc Keep")
    manifest["documents"]["doc-keep"]["source_signatures"] = ["source-existing"]
    HELPERS["refresh_manifest_v2_summary"](manifest)
    HELPERS["save_manifest"] = lambda incoming: None

    mark_manifest_done(manifest, "source-new", "settings", "Audio", "Doc Keep", "https://docs.google.com/document/d/doc-keep/edit")

    assert manifest["documents"]["doc-keep"]["source_signatures"] == ["source-existing", "source-new"]


def test_mark_manifest_done_v1_does_not_create_documents_catalog() -> None:
    manifest = {"version": 1, "entries": {}}
    saved = []
    HELPERS["save_manifest"] = lambda incoming: saved.append(json.loads(json.dumps(incoming)))

    mark_manifest_done(manifest, "source-v1", "settings", "Audio", "Doc", "https://docs.google.com/document/d/doc-v1/edit")

    assert manifest["entries"]["source-v1"]["status"] == "done"
    assert "documents" not in manifest
    assert saved


def test_mark_manifest_done_without_doc_link_saves_source_without_document() -> None:
    manifest = make_manifest_v2_default(updated_at="2026-06-01T00:00:00+00:00")
    HELPERS["save_manifest"] = lambda incoming: None

    mark_manifest_done(manifest, "source-no-doc", "settings", "Audio", "", "")

    assert manifest["sources"]["source-no-doc"]["status"] == "done"
    assert manifest["sources"]["source-no-doc"]["doc_id"] == ""
    assert manifest["documents"] == {}
    assert manifest["summary"]["sources_total"] == 1
    assert manifest["summary"]["orphan_sources"] == 1


def test_manifest_maintenance_does_not_count_transcription_created_document_as_add() -> None:
    manifest = make_manifest_v2_default(updated_at="2026-06-01T00:00:00+00:00")
    HELPERS["save_manifest"] = lambda incoming: None
    mark_manifest_done(
        manifest,
        "source-a",
        "settings",
        "Audio",
        "Doc A",
        "https://docs.google.com/document/d/doc-a/edit",
        {"type": "drive", "output_folder_id": "folder-root", "output_folder_path": ""},
    )
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-a", "name": "Doc A", "mimeType": DOC_MIME, "webViewLink": "https://docs.google.com/document/d/doc-a/edit"},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_current_standard_document(title="Doc A")
    HELPERS["load_manifest_read_only"] = lambda: manifest

    report = standardize_manifest_to_v2_for_existing_google_docs("folder-root", dry_run=True)

    assert report["selected_would_add_documents"] == 0


def test_completed_source_document_entry_does_not_store_transcript_text() -> None:
    manifest = make_manifest_v2_default(updated_at="2026-06-01T00:00:00+00:00")
    HELPERS["save_manifest"] = lambda incoming: None

    mark_manifest_done(
        manifest,
        "source-text",
        "settings",
        "Audio",
        "Doc",
        "https://docs.google.com/document/d/doc-text/edit",
        {"type": "drive", "transcript_text": "SHOULD_NOT_STORE", "document_text": "SHOULD_NOT_STORE"},
    )

    document_json = json.dumps(manifest["documents"]["doc-text"], ensure_ascii=False)
    assert "SHOULD_NOT_STORE" not in document_json
    assert "transcript_text" not in document_json
    assert "document_text" not in document_json


def test_save_manifest_v2_merge_does_not_reintroduce_entries() -> None:
    calls = []
    latest = make_manifest_v2_default(updated_at="old")
    latest["documents"]["doc-old"] = {"doc_id": "doc-old", "standard_check": build_transcript_standard_check("plain", "old"), "source_signatures": []}
    incoming = make_manifest_v2_default(updated_at="new")
    incoming["sources"]["source-new"] = {"source_signature": "source-new", "status": "done", "doc_id": ""}

    HELPERS["get_or_create_manifest_file"] = lambda: ("manifest-folder", "manifest-file")
    HELPERS["load_manifest"] = lambda force_reload=False: latest
    class DummyMedia:
        def __init__(self, *args, **kwargs):
            pass
    class DummyUpdate:
        def update(self, **kwargs):
            calls.append(("update", kwargs))
            return object()
    class DummyDrive:
        def files(self):
            return DummyUpdate()
    HELPERS["MediaInMemoryUpload"] = DummyMedia
    HELPERS["drive_service"] = DummyDrive()
    HELPERS["execute_google_request_with_retry"] = lambda request, operation_label: calls.append(("execute", operation_label))

    save_manifest(incoming)

    merged = HELPERS["MANIFEST_CACHE"]["data"]
    assert merged["version"] == 2
    assert "entries" not in merged
    assert "doc-old" in merged["documents"]
    assert "source-new" in merged["sources"]
    assert ("execute", "drive_file_update") in calls


def test_manifest_v2_migration_flow_dry_run_is_read_only_and_apply_backs_up_and_writes() -> None:
    calls = []
    manifest_v1 = {
        "version": 1,
        "entries": {
            "source-a": {"source_signature": "source-a", "source_type": "drive", "status": "done", "doc_link": "https://docs.google.com/document/d/doc-a/edit"},
            "orphan": {"source_signature": "orphan", "source_type": "drive", "status": "done"},
        },
    }
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-a", "name": "Doc A", "mimeType": DOC_MIME, "webViewLink": "https://docs.google.com/document/d/doc-a/edit"},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_current_standard_document("Doc A")
    HELPERS["load_manifest_read_only"] = lambda: calls.append(("load_read_only",)) or manifest_v1
    HELPERS["load_manifest"] = lambda: calls.append(("load",)) or manifest_v1
    HELPERS["save_manifest"] = lambda manifest: calls.append(("save",))
    HELPERS["get_or_create_manifest_file"] = lambda: calls.append(("get_or_create",)) or ("folder", "file")
    HELPERS["create_manifest_backup"] = lambda manifest, timestamp: calls.append(("backup", json.loads(json.dumps(manifest)))) or {"file_id": "backup"}
    HELPERS["write_active_manifest_v2"] = lambda manifest: calls.append(("write_v2", json.loads(json.dumps(manifest))))

    dry = standardize_manifest_to_v2_for_existing_google_docs("folder-root", dry_run=True)

    assert dry["dry_run"] is True
    assert dry["current_manifest_version"] == 1
    assert dry["target_manifest_version"] == 2
    assert dry["would_backup_manifest"] is True
    assert dry["would_write_manifest_v2"] is True
    assert dry["manifest_v2_written"] is False
    assert "Старый формат manifest будет обновлён до актуального." in dry["notice"]
    assert dry["google_docs_scanned"] == 1
    assert dry["documents_total"] == 1
    assert dry["sources_total"] == 2
    assert dry["orphan_sources"] == 1
    assert ("load_read_only",) in calls
    assert not any(call[0] in {"save", "get_or_create", "backup", "write_v2"} for call in calls)

    calls.clear()
    applied = standardize_manifest_to_v2_for_existing_google_docs("folder-root", dry_run=False)

    assert applied["backup_created"] is True
    assert applied["manifest_v2_written"] is True
    assert calls[0][0] == "load"
    assert calls[1][0] == "backup"
    assert calls[2][0] == "write_v2"
    written = calls[2][1]
    assert written["version"] == 2
    assert written["schema"] == "voiceops_manifest_v2"
    assert written["sources"]["source-a"]["doc_id"] == "doc-a"
    assert written["sources"]["orphan"]["doc_id"] == ""

    calls.clear()
    HELPERS["load_manifest_read_only"] = lambda: calls.append(("load_read_only",)) or written
    second = standardize_manifest_to_v2_for_existing_google_docs("folder-root", dry_run=True)
    assert second["current_manifest_version"] == 2
    assert second["target_manifest_version"] == 2
    assert second["source_entries_migrated"] == 0
    assert second["doc_registry_entries_migrated"] == 0
    assert second["documents_total"] == 1
    assert second["sources_total"] == 2
    assert second["would_backup_manifest"] is False
    assert second["would_refresh_manifest_v2"] is False
    assert second["would_write_manifest_v2"] is False
    assert second["manifest_v2_up_to_date"] is True
    assert "Manifest уже в актуальном формате" in second["notice"]
    assert "entries" not in second["manifest_v2_preview"]



def test_manifest_v2_dry_run_checked_at_only_change_is_up_to_date() -> None:
    manifest = make_manifest_v2_default(updated_at="2026-05-01T00:00:00+00:00")
    manifest["documents"]["doc-v2"] = make_registered_v2_document(checked_at="2026-05-01T00:00:00+00:00")
    HELPERS["refresh_manifest_v2_summary"](manifest)
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-v2", "name": "Doc V2", "mimeType": DOC_MIME, "webViewLink": "https://docs.google.com/document/d/doc-v2/edit"},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_current_standard_document(title="Doc V2")
    HELPERS["load_manifest_read_only"] = lambda: manifest

    report = standardize_manifest_to_v2_for_existing_google_docs("folder-root", dry_run=True)

    assert report["current_manifest_version"] == 2
    assert report["target_manifest_version"] == 2
    assert report["would_backup_manifest"] is False
    assert report["backup_created"] is False
    assert report["would_refresh_manifest_v2"] is False
    assert report["would_write_manifest_v2"] is False
    assert report["manifest_v2_written"] is False
    assert report["manifest_v2_up_to_date"] is True
    assert "мигр" not in report["notice"].lower()
    assert "entries" not in report["manifest_v2_preview"]


def test_manifest_v2_apply_refreshes_material_changes_without_mixed_entries_or_backup() -> None:
    calls = []
    manifest = make_manifest_v2_default(updated_at="2026-05-01T00:00:00+00:00")
    manifest["documents"]["doc-v2"] = make_registered_v2_document(doc_name="Old Name", doc_path="Old Name")
    manifest["entries"] = {"legacy": {"status": "done"}}
    HELPERS["refresh_manifest_v2_summary"](manifest)
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-v2", "name": "Doc V2", "mimeType": DOC_MIME, "webViewLink": "https://docs.google.com/document/d/doc-v2/edit"},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_current_standard_document(title="Doc V2")
    HELPERS["load_manifest"] = lambda: calls.append(("load",)) or manifest
    HELPERS["create_manifest_backup"] = lambda manifest, timestamp: (_ for _ in ()).throw(AssertionError("backup should not be created for v2 refresh"))
    HELPERS["write_active_manifest_v2"] = lambda incoming: calls.append(("write_v2", json.loads(json.dumps(incoming))))
    HELPERS["write_title_and_text_to_doc"] = lambda **kwargs: (_ for _ in ()).throw(AssertionError("Google Docs mutation called"))
    HELPERS["create_google_doc"] = lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("create_google_doc called"))
    HELPERS["transcribe_fileobj"] = lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("provider called"))

    report = standardize_manifest_to_v2_for_existing_google_docs("folder-root", dry_run=False)

    assert report["current_manifest_version"] == 2
    assert report["backup_created"] is False
    assert report["manifest_v2_written"] is True
    written = calls[-1][1]
    assert written["documents"]["doc-v2"]["doc_name"] == "Doc V2"
    assert written["documents"]["doc-v2"]["standard_check"]["status"] == "current"
    assert "entries" not in written


def test_manifest_ui_exposes_single_unified_manifest_action() -> None:
    source = CANONICAL_SOURCE.read_text(encoding="utf-8")

    assert "Проверить / зарегистрировать существующие Google Docs в manifest" not in source
    assert "Регистрация существующих Google Docs в manifest" not in source
    assert source.count("Проверить / обновить manifest") == 1
    assert source.count("Только проверить manifest, не изменять") == 1
    assert "Manifest" in source
    assert "standardize_manifest_to_v2_for_existing_google_docs" in source
    assert "register_existing_docs_manifest_button.on_click" not in source


def test_unified_manifest_handler_uses_v2_standardization_flow() -> None:
    source = CANONICAL_SOURCE.read_text(encoding="utf-8")
    handler_match = re.search(r"def on_standardize_manifest_v2_clicked\(_\):(?P<body>.*?)(?:\ndef |\nclass |\Z)", source, re.S)
    assert handler_match is not None
    body = handler_match.group("body")

    assert "standardize_manifest_to_v2_for_existing_google_docs" in body
    assert "register_existing_google_docs_in_manifest" not in body
    assert "standardize_manifest_v2_dry_run_widget.value" in body

def test_manifest_v2_migration_flow_does_not_call_docs_or_provider_mutators() -> None:
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-a", "name": "Doc A", "mimeType": DOC_MIME},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: "plain"
    HELPERS["load_manifest_read_only"] = lambda: {"version": 1, "entries": {}}
    HELPERS["write_title_and_text_to_doc"] = lambda **kwargs: (_ for _ in ()).throw(AssertionError("write_title_and_text_to_doc called"))
    HELPERS["create_google_doc"] = lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("create_google_doc called"))
    HELPERS["transcribe_fileobj"] = lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("provider called"))
    HELPERS["save_manifest"] = lambda manifest: (_ for _ in ()).throw(AssertionError("save_manifest called"))
    HELPERS["create_manifest_backup"] = lambda manifest, timestamp: (_ for _ in ()).throw(AssertionError("backup called"))

    report = standardize_manifest_to_v2_for_existing_google_docs("folder-root", dry_run=True)

    assert report["standard_check"]["unstructured"] == 1
    assert report["manifest_v2_written"] is False


def make_registered_v2_document(
    doc_id: str = "doc-v2",
    doc_name: str = "Doc V2",
    doc_path: str = "Doc V2",
    status: str = "current",
    checked_at: str = "2026-05-01T00:00:00+00:00",
) -> dict:
    detected = "transcript_doc_v1.2" if status == "current" else ("legacy_v1" if status == "outdated" else "unknown")
    return {
        "doc_id": doc_id,
        "doc_name": doc_name,
        "doc_link": f"https://docs.google.com/document/d/{doc_id}/edit",
        "doc_path": doc_path,
        "doc_mime_type": DOC_MIME,
        "document_type": "google_doc_transcript",
        "registration_status": "registered",
        "source_signatures": [],
        "standard_check": {
            "target_standard": "transcript_doc_v1.2",
            "detected_standard": detected,
            "status": status,
            "checked_at": checked_at,
            "checker_version": "transcript_standard_checker_v1",
        },
        "updated_at": checked_at,
        "source_meta": {
            "folder_id": "folder-root",
            "folder_path": "",
            "recursive_scan": False,
            "registration_mode": "manifest_v2_migration",
        },
    }


def test_manifest_registration_v2_document_already_registered_ignores_checked_at_only_change() -> None:
    manifest = make_manifest_v2_default(updated_at="2026-05-01T00:00:00+00:00")
    manifest["documents"]["doc-v2"] = make_registered_v2_document(checked_at="2026-05-01T00:00:00+00:00")
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-v2", "name": "Doc V2", "mimeType": DOC_MIME, "webViewLink": "https://docs.google.com/document/d/doc-v2/edit"},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_current_standard_document(title="Doc V2")
    HELPERS["load_manifest_read_only"] = lambda: manifest

    report = register_existing_google_docs_in_manifest("folder-root", dry_run=True)

    assert [item["doc_id"] for item in report["already_registered"]] == ["doc-v2"]
    assert report["would_update"] == []
    assert "entries" not in manifest


def test_manifest_registration_v2_document_changed_doc_name_or_path_reports_would_update() -> None:
    manifest = make_manifest_v2_default(updated_at="2026-05-01T00:00:00+00:00")
    manifest["documents"]["doc-v2"] = make_registered_v2_document(doc_name="Old Name", doc_path="Old Name")
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-v2", "name": "Doc V2", "mimeType": DOC_MIME, "webViewLink": "https://docs.google.com/document/d/doc-v2/edit"},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_current_standard_document(title="Doc V2")
    HELPERS["load_manifest_read_only"] = lambda: manifest

    report = register_existing_google_docs_in_manifest("folder-root", dry_run=True)

    assert [item["doc_id"] for item in report["would_update"]] == ["doc-v2"]
    assert report["already_registered"] == []


def test_manifest_registration_v2_document_changed_standard_status_reports_would_update() -> None:
    manifest = make_manifest_v2_default(updated_at="2026-05-01T00:00:00+00:00")
    manifest["documents"]["doc-v2"] = make_registered_v2_document(status="unstructured")
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-v2", "name": "Doc V2", "mimeType": DOC_MIME, "webViewLink": "https://docs.google.com/document/d/doc-v2/edit"},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_current_standard_document(title="Doc V2")
    HELPERS["load_manifest_read_only"] = lambda: manifest

    report = register_existing_google_docs_in_manifest("folder-root", dry_run=True)

    assert [item["doc_id"] for item in report["would_update"]] == ["doc-v2"]
    assert report["already_registered"] == []


def test_manifest_registration_v2_apply_updates_documents_without_recreating_entries() -> None:
    calls = []
    manifest = make_manifest_v2_default(updated_at="2026-05-01T00:00:00+00:00")
    manifest["documents"]["doc-v2"] = make_registered_v2_document(doc_name="Old Name", doc_path="Old Name")
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-v2", "name": "Doc V2", "mimeType": DOC_MIME, "webViewLink": "https://docs.google.com/document/d/doc-v2/edit"},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_current_standard_document(title="Doc V2")
    HELPERS["load_manifest"] = lambda: manifest
    HELPERS["save_manifest"] = lambda incoming: calls.append(json.loads(json.dumps(incoming)))

    report = register_existing_google_docs_in_manifest("folder-root", dry_run=False)

    assert [item["doc_id"] for item in report["updated"]] == ["doc-v2"]
    assert manifest["documents"]["doc-v2"]["doc_name"] == "Doc V2"
    assert manifest["documents"]["doc-v2"]["standard_check"]["status"] == "current"
    assert "entries" not in manifest
    assert calls and "entries" not in calls[0]


def test_manifest_registration_v2_document_already_registered_same_identity_and_status() -> None:
    manifest = make_manifest_v2_default(updated_at="2026-06-01T00:00:00+00:00")
    manifest["documents"]["doc-v2"] = make_registered_v2_document(checked_at="2026-06-01T00:00:00+00:00")
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-v2", "name": "Doc V2", "mimeType": DOC_MIME, "webViewLink": "https://docs.google.com/document/d/doc-v2/edit"},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_current_standard_document(title="Doc V2")
    HELPERS["load_manifest_read_only"] = lambda: manifest

    report = register_existing_google_docs_in_manifest("folder-root", dry_run=True)

    assert [item["doc_id"] for item in report["already_registered"]] == ["doc-v2"]
    assert report["would_update"] == []


def test_manifest_report_separates_selected_scan_from_global_totals() -> None:
    manifest = make_manifest_v2_default(updated_at="2026-05-01T00:00:00+00:00")
    for index in range(81):
        doc_id = f"existing-{index}"
        manifest["documents"][doc_id] = make_registered_v2_document(
            doc_id=doc_id,
            doc_name=f"Existing {index}",
            status="unstructured",
        )
    HELPERS["refresh_manifest_v2_summary"](manifest)
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": f"selected-{index}", "name": f"Selected {index}", "mimeType": DOC_MIME, "webViewLink": f"https://docs.google.com/document/d/selected-{index}/edit"}
        for index in range(5)
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_current_standard_document(title=document_id)
    HELPERS["load_manifest_read_only"] = lambda: manifest

    report = standardize_manifest_to_v2_for_existing_google_docs("folder-root", dry_run=True)
    text = build_standardize_manifest_v2_report_text(report)

    assert report["selected_google_docs_scanned"] == 5
    assert report["manifest_before"]["documents_total"] == 81
    assert report["manifest_after"]["documents_total"] == 86
    assert report["selected_would_add_documents"] == 5
    assert "МАНИФЕСТ — ВЫБРАННАЯ ПАПКА" in text
    assert "ГЛОБАЛЬНЫЙ MANIFEST — СПРАВОЧНО" in text
    assert "Проверка стандарта по глобальному каталогу" in text
    assert "Манифест после применения" not in text
    assert "entire Drive" not in text
    assert "Google Docs в выбранной папке: 5" in text
    assert "Будет добавлено документов: 5" in text
    assert "Документов всего: 86" in text


def test_manifest_report_text_is_localized_to_russian() -> None:
    report = {
        "dry_run": False,
        "current_manifest_version": 2,
        "target_manifest_version": 2,
        "selected_google_docs_scanned": 1,
        "selected_folders_seen": 0,
        "selected_skipped_non_google_docs": 0,
        "manifest_before": {"version": 2},
        "manifest_after": {"version": 2},
        "standard_check": {"target_standard": "transcript_doc_v1.2", "current": 1, "outdated": 0, "unstructured": 0, "unreadable": 0},
        "manifest_v2_up_to_date": True,
        "errors": [],
    }

    text = build_standardize_manifest_v2_report_text(report)

    for expected in (
        "МАНИФЕСТ — ВЫБРАННАЯ ПАПКА",
        "ГЛОБАЛЬНЫЙ MANIFEST — СПРАВОЧНО",
        "БЕЗОПАСНОСТЬ",
        "Скан выбранной папки",
        "Изменения по выбранной папке",
        "Проверка стандарта по глобальному каталогу",
    ):
        assert expected in text
    for old_label in (
        "Selected folder scan",
        "Manifest before",
        "Changes from selected folder",
        "Safety",
        "Манифест до изменений",
        "Манифест после применения",
        "Проверка стандарта после применения",
    ):
        assert old_label not in text


def test_docs_standardization_report_text_is_localized_to_russian() -> None:
    report = {
        "dry_run": True,
        "google_docs_scanned": 1,
        "folders_seen": 0,
        "skipped_non_google_docs": 0,
        "current_standard": 1,
        "outdated_standard": 0,
        "unstructured": 0,
        "unreadable": 0,
        "already_structured": [{"doc_name": "Doc", "structured_status": "current", "link": "https://docs.google.com/document/d/doc/edit"}],
        "would_standardize": [],
        "errors": [],
    }

    text = build_standardize_existing_docs_report_text(report)

    for expected in ("СТАНДАРТИЗАЦИЯ GOOGLE DOCS", "Скан выбранной папки", "Текущий статус стандарта", "Влияние apply", "Безопасность"):
        assert expected in text
    for old_label in ("Current standard status", "Apply impact", "First 20 documents"):
        assert old_label not in text


def test_manifest_report_v2_no_material_changes_says_up_to_date() -> None:
    manifest = make_manifest_v2_default(updated_at="2026-05-01T00:00:00+00:00")
    manifest["documents"]["doc-v2"] = make_registered_v2_document(checked_at="2026-05-01T00:00:00+00:00")
    HELPERS["refresh_manifest_v2_summary"](manifest)
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-v2", "name": "Doc V2", "mimeType": DOC_MIME, "webViewLink": "https://docs.google.com/document/d/doc-v2/edit"},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_current_standard_document(title="Doc V2")
    HELPERS["load_manifest_read_only"] = lambda: manifest

    report = standardize_manifest_to_v2_for_existing_google_docs("folder-root", dry_run=True)
    text = build_standardize_manifest_v2_report_text(report)

    assert report["manifest_v2_up_to_date"] is True
    assert report["would_write_manifest_v2"] is False
    assert "выбранная папка уже актуальна" in text
    assert "Требуется запись: нет" in text
    assert "Manifest актуален: да" in text
    assert "Manifest уже актуален, запись не требуется" in text
    for forbidden in ("manifest v2", "Manifest v2", "v2 catalog", "будет мигрирован в v2", "уже v2"):
        assert forbidden not in text
    assert "would migrate" not in text.lower()


def test_manifest_report_v2_selected_adds_records_in_global_manifest() -> None:
    manifest = make_manifest_v2_default(updated_at="2026-05-01T00:00:00+00:00")
    HELPERS["refresh_manifest_v2_summary"](manifest)
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "new-doc", "name": "New Doc", "mimeType": DOC_MIME, "webViewLink": "https://docs.google.com/document/d/new-doc/edit"},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_current_standard_document(title="New Doc")
    HELPERS["load_manifest_read_only"] = lambda: manifest

    report = standardize_manifest_to_v2_for_existing_google_docs("folder-root", dry_run=True)
    text = build_standardize_manifest_v2_report_text(report)

    assert report["would_refresh_manifest_v2"] is True
    assert report["would_write_manifest_v2"] is True
    assert report["would_backup_manifest"] is False
    assert "есть изменения" in text
    assert "Требуется запись: да" in text
    assert "Документов всего:" in text
    assert "Содержимое Google Docs изменено: нет" in text
    assert "STT/LLM/provider API вызваны: нет" in text


def test_manifest_report_v1_migration_mentions_backup_and_apply_creates_backup() -> None:
    backups = []
    writes = []
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "doc-a", "name": "Doc A", "mimeType": DOC_MIME, "webViewLink": "https://docs.google.com/document/d/doc-a/edit"},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: "plain"
    HELPERS["load_manifest_read_only"] = lambda: {"version": 1, "entries": {}}

    dry = standardize_manifest_to_v2_for_existing_google_docs("folder-root", dry_run=True)
    dry_text = build_standardize_manifest_v2_report_text(dry)

    assert "Старый формат manifest будет обновлён до актуального" in dry_text
    assert "manifest v2" not in dry_text
    assert "уже v2" not in dry_text
    assert dry["would_backup_manifest"] is True

    HELPERS["load_manifest"] = lambda: {"version": 1, "entries": {}}
    HELPERS["create_manifest_backup"] = lambda manifest, timestamp: backups.append((manifest, timestamp)) or {"name": "backup.json"}
    HELPERS["write_active_manifest_v2"] = lambda manifest: writes.append(manifest)

    applied = standardize_manifest_to_v2_for_existing_google_docs("folder-root", dry_run=False)

    assert applied["backup_created"] is True
    assert backups
    assert writes and writes[0]["version"] == 2


def test_docs_standardization_report_groups_dry_run_sections_and_safety() -> None:
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "old", "name": "Old", "mimeType": DOC_MIME, "webViewLink": "https://docs.google.com/document/d/old/edit"},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: build_legacy_standard_document(title="Old")
    HELPERS["write_title_and_text_to_doc"] = lambda **kwargs: (_ for _ in ()).throw(AssertionError("dry-run wrote a doc"))

    report = standardize_existing_google_docs_in_folder("folder-root", dry_run=True)
    text = build_standardize_existing_docs_report_text(report)

    assert "Скан выбранной папки" in text
    assert "Текущий статус стандарта" in text
    assert "Влияние apply" in text
    assert "Dry-run: документы не изменяются" in text
    assert "Будет вызвано STT/LLM/provider API: 0" in text
    assert "Будет создано новых Google Docs: 0" in text
    assert "Будет изменён manifest: 0" in text


def test_docs_standardization_apply_report_states_in_place_no_external_mutation() -> None:
    writes = []
    HELPERS["list_drive_folder_children"] = lambda folder_id: [
        {"id": "plain", "name": "Plain", "mimeType": DOC_MIME, "webViewLink": "https://docs.google.com/document/d/plain/edit"},
    ]
    HELPERS["extract_google_doc_plain_text"] = lambda document_id: "Plain\n\nBody"
    HELPERS["write_title_and_text_to_doc"] = lambda **kwargs: writes.append(kwargs)

    report = standardize_existing_google_docs_in_folder("folder-root", dry_run=False)
    text = build_standardize_existing_docs_report_text(report)

    assert writes and writes[0]["document_id"] == "plain"
    assert "Apply: переписывает только выбранные Google Docs на месте" in text
    assert "Будет создано новых Google Docs: 0" in text
    assert "Будет вызвано STT/LLM/provider API: 0" in text
    assert "Будет изменён manifest: 0" in text


def test_docs_standardization_report_first_20_includes_status_labels() -> None:
    docs = [
        {"id": "current", "name": "Current", "mimeType": DOC_MIME, "webViewLink": "https://docs.google.com/document/d/current/edit"},
        {"id": "outdated", "name": "Outdated", "mimeType": DOC_MIME, "webViewLink": "https://docs.google.com/document/d/outdated/edit"},
        {"id": "unstructured", "name": "Unstructured", "mimeType": DOC_MIME, "webViewLink": "https://docs.google.com/document/d/unstructured/edit"},
        {"id": "unreadable", "name": "Unreadable", "mimeType": DOC_MIME, "webViewLink": "https://docs.google.com/document/d/unreadable/edit"},
    ]
    HELPERS["list_drive_folder_children"] = lambda folder_id: docs

    def extract(document_id: str) -> str:
        if document_id == "current":
            return build_current_standard_document(title="Current")
        if document_id == "outdated":
            return build_legacy_standard_document(title="Outdated")
        if document_id == "unreadable":
            raise RuntimeError("cannot read")
        return "Unstructured\n\nBody"

    HELPERS["extract_google_doc_plain_text"] = extract
    report = standardize_existing_google_docs_in_folder("folder-root", dry_run=True)
    text = build_standardize_existing_docs_report_text(report)

    assert "[current]" in text
    assert "[outdated]" in text
    assert "[unstructured]" in text
    assert "[unreadable/error]" in text


def test_ui_help_text_distinguishes_manifest_and_docs_standardization() -> None:
    source = CANONICAL_SOURCE.read_text(encoding="utf-8")

    assert source.count("Проверить / обновить manifest") == 1
    assert source.count("Проверить / стандартизировать существующие Google Docs") == 1
    assert "Manifest — глобальный каталог. Если выбрать другую папку" in source
    assert "Старые записи из других папок не удаляются" in source
    assert "Стандартизация Google Docs в apply-режиме переписывает выбранные документы на месте" in source
    assert "Сначала запускайте dry-run на маленькой подпапке" in source
    assert "Manifest — глобальный каталог" in source
    assert "переписывает выбранные документы на месте" in source

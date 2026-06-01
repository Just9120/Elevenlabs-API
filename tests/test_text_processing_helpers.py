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
    "chunk_text_for_docs",
    "normalize_text_for_overlap_match",
    "trim_duplicate_prefix_by_token_overlap",
    "merge_transcript_parts_with_overlap",
    "get_openai_diarize_chunking_preflight_warning",
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
                if isinstance(target, ast.Name) and target.id == "DOC_INSERT_CHUNK_SIZE":
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
    }
    exec(compile(helper_module, str(CANONICAL_SOURCE), "exec"), namespace)
    return namespace


HELPERS = load_text_helpers()
chunk_text_for_docs = HELPERS["chunk_text_for_docs"]
trim_duplicate_prefix_by_token_overlap = HELPERS["trim_duplicate_prefix_by_token_overlap"]
merge_transcript_parts_with_overlap = HELPERS["merge_transcript_parts_with_overlap"]
get_openai_diarize_chunking_preflight_warning = HELPERS[
    "get_openai_diarize_chunking_preflight_warning"
]


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

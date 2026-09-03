from __future__ import annotations

import os
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest


ROOT = Path(__file__).resolve().parents[1]
STUDIO_API = ROOT / "apps" / "studio-api"
if str(STUDIO_API) not in sys.path:
    sys.path.insert(0, str(STUDIO_API))
os.environ.setdefault("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")

from studio_api.stt_dictionaries import (  # noqa: E402
    DictionaryEntryKind,
    dictionary_terms_from_options,
    normalize_dictionary_entries,
    normalize_dictionary_name,
    snapshot_dictionary_terms,
)


def test_dictionary_normalizes_all_supported_entry_kinds():
    assert normalize_dictionary_name("  Команда   проекта ") == (
        "Команда проекта",
        "команда проекта",
    )
    entries = normalize_dictionary_entries(
        [
            {"kind": "term", "value": " VoiceOps "},
            {"kind": "surname", "value": "Иванов"},
            {"kind": "name", "value": "Алёна"},
            {"kind": "abbreviation", "value": " API "},
        ]
    )
    assert [entry.kind for entry in entries] == list(DictionaryEntryKind)
    assert [entry.value for entry in entries] == ["VoiceOps", "Иванов", "Алёна", "API"]


def test_dictionary_rejects_duplicates_and_snapshots_bounded_terms():
    with pytest.raises(ValueError, match="duplicate_dictionary_entry"):
        normalize_dictionary_entries(
            [
                {"kind": "term", "value": "API"},
                {"kind": "term", "value": "api"},
            ]
        )
    rows = [
        SimpleNamespace(
            entries=[
                SimpleNamespace(value="VoiceOps", normalized_value="voiceops"),
                SimpleNamespace(value="VOICEOPS", normalized_value="voiceops"),
                SimpleNamespace(value="SpeechKit", normalized_value="speechkit"),
            ]
        )
    ]
    assert snapshot_dictionary_terms(rows) == ["VoiceOps", "SpeechKit"]
    assert dictionary_terms_from_options(
        '{"dictionary_terms":["VoiceOps","SpeechKit"]}'
    ) == ("VoiceOps", "SpeechKit")
    assert dictionary_terms_from_options('{"dictionary_terms":[1]}') == ()

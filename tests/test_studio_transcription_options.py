from __future__ import annotations

import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


def test_language_modes_are_typed_and_default_to_russian():
    from studio_api.transcription_options import (
        TranscriptionLanguageMode,
        stored_language_mode,
    )

    assert stored_language_mode(None) == "ru"
    assert stored_language_mode(TranscriptionLanguageMode.auto_detect) == "detect"
    with pytest.raises(ValueError):
        stored_language_mode("fr")


def test_language_modes_map_safely_at_provider_and_display_boundaries():
    from studio_api.transcription_options import (
        browser_language_mode,
        document_language,
        provider_language_code,
    )

    assert provider_language_code("detect") is None
    assert provider_language_code(None) is None
    assert provider_language_code("EN") == "en"
    assert browser_language_mode(None) == "detect"
    assert browser_language_mode("ru") == "ru"
    assert document_language("detect", "en") == "en"
    assert document_language("ru", "en") == "ru"
    assert document_language(None, None) == "unknown"

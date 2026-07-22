from __future__ import annotations

from enum import Enum


class TranscriptionLanguageMode(str, Enum):
    russian = "ru"
    auto_detect = "detect"


DEFAULT_TRANSCRIPTION_LANGUAGE_MODE = TranscriptionLanguageMode.russian


def stored_language_mode(value: TranscriptionLanguageMode | str | None) -> str:
    if isinstance(value, TranscriptionLanguageMode):
        return value.value
    return TranscriptionLanguageMode(value or DEFAULT_TRANSCRIPTION_LANGUAGE_MODE.value).value


def provider_language_code(value: str | None) -> str | None:
    normalized = (value or "").strip().lower()
    if not normalized or normalized == TranscriptionLanguageMode.auto_detect.value:
        return None
    return normalized


def browser_language_mode(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    return normalized or TranscriptionLanguageMode.auto_detect.value


def document_language(value: str | None, detected_language_code: str | None) -> str:
    explicit = provider_language_code(value)
    detected = (detected_language_code or "").strip()
    return explicit or detected or "unknown"

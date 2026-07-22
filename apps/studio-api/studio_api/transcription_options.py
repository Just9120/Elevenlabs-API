from __future__ import annotations

import json
from dataclasses import dataclass
from enum import Enum


class TranscriptionLanguageMode(str, Enum):
    russian = "ru"
    auto_detect = "detect"


DEFAULT_TRANSCRIPTION_LANGUAGE_MODE = TranscriptionLanguageMode.russian


@dataclass(frozen=True)
class TranscriptionProviderSettings:
    language_code: str | None
    diarize: bool


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


def stored_transcription_options(diarize: bool) -> str | None:
    if not diarize:
        return None
    return json.dumps({"diarize": True}, sort_keys=True, separators=(",", ":"))


def job_diarization_enabled(options_json: str | None) -> bool:
    if not options_json:
        return False
    try:
        payload = json.loads(options_json)
    except (TypeError, ValueError):
        return False
    return isinstance(payload, dict) and payload.get("diarize") is True


def provider_transcription_settings(
    language: str | None,
    options_json: str | None,
) -> TranscriptionProviderSettings:
    return TranscriptionProviderSettings(
        language_code=provider_language_code(language),
        diarize=job_diarization_enabled(options_json),
    )

from __future__ import annotations

import json
from dataclasses import dataclass
from enum import Enum


class TranscriptionLanguageMode(str, Enum):
    russian = "ru"
    auto_detect = "detect"


DEFAULT_TRANSCRIPTION_LANGUAGE_MODE = TranscriptionLanguageMode.russian
EXISTING_RESULT_REPROCESS_AUTHORITY_OPTION = (
    "_existing_result_reprocess_authorized"
)


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


def stored_transcription_options(
    diarize: bool,
    *,
    existing_result_reprocess_authorized: bool = False,
) -> str | None:
    payload = {}
    if diarize:
        payload["diarize"] = True
    if existing_result_reprocess_authorized:
        payload[EXISTING_RESULT_REPROCESS_AUTHORITY_OPTION] = True
    if not payload:
        return None
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def job_diarization_enabled(options_json: str | None) -> bool:
    payload = _stored_options(options_json)
    return payload is not None and payload.get("diarize") is True


def job_existing_result_reprocess_authorized(
    options_json: str | None,
) -> bool:
    payload = _stored_options(options_json)
    return (
        payload is not None
        and payload.get(EXISTING_RESULT_REPROCESS_AUTHORITY_OPTION) is True
    )


def _stored_options(options_json: str | None) -> dict | None:
    if not options_json:
        return None
    try:
        payload = json.loads(options_json)
    except (TypeError, ValueError):
        return None
    return payload if isinstance(payload, dict) else None


def provider_transcription_settings(
    language: str | None,
    options_json: str | None,
) -> TranscriptionProviderSettings:
    return TranscriptionProviderSettings(
        language_code=provider_language_code(language),
        diarize=job_diarization_enabled(options_json),
    )

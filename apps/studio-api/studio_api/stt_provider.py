from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Mapping


class SttProvider(str, Enum):
    elevenlabs = "elevenlabs"
    yandex = "yandex"


class SttOperatingMode(str, Enum):
    economic = "economic"
    standard = "standard"
    premium = "premium"
    realtime = "realtime"


class SttCapabilityReason(str, Enum):
    provider_disabled = "provider_disabled"
    mode_unsupported = "mode_unsupported"
    language_unsupported = "language_unsupported"
    diarization_unsupported = "diarization_unsupported"
    dictionaries_unsupported = "dictionaries_unsupported"
    file_too_large = "file_too_large"
    duration_too_long = "duration_too_long"


class SttCapabilityError(ValueError):
    def __init__(self, reason: SttCapabilityReason):
        self.reason = reason
        super().__init__(reason.value)


@dataclass(frozen=True)
class SttFileConstraints:
    max_bytes: int | None
    max_duration_seconds: int
    audio_channels: tuple[int, ...]


@dataclass(frozen=True)
class SttModeCapability:
    mode: SttOperatingMode
    model: str
    transport: str
    languages: tuple[str, ...]
    diarization: bool
    dictionaries: bool
    file_constraints: SttFileConstraints

    def browser_payload(self) -> dict[str, Any]:
        return {
            "mode": self.mode.value,
            "model": self.model,
            "transport": self.transport,
            "languages": list(self.languages),
            "diarization": self.diarization,
            "dictionaries": self.dictionaries,
            "file_constraints": {
                "max_bytes": self.file_constraints.max_bytes,
                "max_duration_seconds": self.file_constraints.max_duration_seconds,
                "audio_channels": list(self.file_constraints.audio_channels),
            },
        }


@dataclass(frozen=True)
class SttProviderCapability:
    provider: SttProvider
    display_name: str
    byok_enabled: bool
    modes: Mapping[SttOperatingMode, SttModeCapability]

    def browser_payload(self) -> dict[str, Any]:
        return {
            "provider": self.provider.value,
            "display_name": self.display_name,
            "byok_enabled": self.byok_enabled,
            "modes": [self.modes[mode].browser_payload() for mode in SttOperatingMode if mode in self.modes],
        }


_LANGUAGES = ("ru", "en", "detect")


def provider_catalog(settings) -> dict[SttProvider, SttProviderCapability]:
    eleven_batch = SttFileConstraints(
        max_bytes=25 * 1024 * 1024,
        max_duration_seconds=int(settings.media_max_duration_seconds),
        audio_channels=(1, 2),
    )
    eleven_realtime = SttFileConstraints(
        max_bytes=None,
        max_duration_seconds=1800,
        audio_channels=(1,),
    )
    yandex_batch = SttFileConstraints(
        max_bytes=60 * 1024 * 1024,
        max_duration_seconds=14400,
        audio_channels=(1,),
    )
    yandex_realtime = SttFileConstraints(
        max_bytes=10 * 1024 * 1024,
        max_duration_seconds=300,
        audio_channels=(1,),
    )
    return {
        SttProvider.elevenlabs: SttProviderCapability(
            provider=SttProvider.elevenlabs,
            display_name="ElevenLabs",
            byok_enabled=bool(settings.elevenlabs_byok_enabled),
            modes={
                SttOperatingMode.economic: SttModeCapability(SttOperatingMode.economic, settings.elevenlabs_economic_model, "batch", _LANGUAGES, True, True, eleven_batch),
                SttOperatingMode.standard: SttModeCapability(SttOperatingMode.standard, settings.elevenlabs_standard_model, "batch", _LANGUAGES, True, True, eleven_batch),
                SttOperatingMode.premium: SttModeCapability(SttOperatingMode.premium, settings.elevenlabs_premium_model, "batch", _LANGUAGES, True, True, eleven_batch),
                SttOperatingMode.realtime: SttModeCapability(SttOperatingMode.realtime, settings.elevenlabs_realtime_model, "websocket", _LANGUAGES, False, False, eleven_realtime),
            },
        ),
        SttProvider.yandex: SttProviderCapability(
            provider=SttProvider.yandex,
            display_name="Yandex SpeechKit",
            byok_enabled=bool(settings.yandex_byok_enabled),
            modes={
                SttOperatingMode.economic: SttModeCapability(SttOperatingMode.economic, settings.yandex_economic_model, "deferred", _LANGUAGES, False, False, yandex_batch),
                SttOperatingMode.standard: SttModeCapability(SttOperatingMode.standard, settings.yandex_standard_model, "batch", _LANGUAGES, True, False, yandex_batch),
                SttOperatingMode.premium: SttModeCapability(SttOperatingMode.premium, settings.yandex_premium_model, "batch", _LANGUAGES, True, False, yandex_batch),
                SttOperatingMode.realtime: SttModeCapability(SttOperatingMode.realtime, settings.yandex_realtime_model, "grpc_relay", _LANGUAGES, True, False, yandex_realtime),
            },
        ),
    }


def resolve_capability(settings, provider: str | SttProvider, mode: str | SttOperatingMode) -> SttModeCapability:
    try:
        selected_provider = SttProvider(provider)
        selected_mode = SttOperatingMode(mode)
    except ValueError as exc:
        raise SttCapabilityError(SttCapabilityReason.mode_unsupported) from exc
    entry = provider_catalog(settings).get(selected_provider)
    if entry is None or not entry.byok_enabled:
        raise SttCapabilityError(SttCapabilityReason.provider_disabled)
    capability = entry.modes.get(selected_mode)
    if capability is None:
        raise SttCapabilityError(SttCapabilityReason.mode_unsupported)
    return capability


def validate_selection(
    settings,
    *,
    provider: str | SttProvider,
    mode: str | SttOperatingMode,
    language: str,
    diarization: bool,
    dictionary_count: int = 0,
    size_bytes: int | None = None,
    duration_seconds: float | None = None,
) -> SttModeCapability:
    capability = resolve_capability(settings, provider, mode)
    if language not in capability.languages:
        raise SttCapabilityError(SttCapabilityReason.language_unsupported)
    if diarization and not capability.diarization:
        raise SttCapabilityError(SttCapabilityReason.diarization_unsupported)
    if dictionary_count and not capability.dictionaries:
        raise SttCapabilityError(SttCapabilityReason.dictionaries_unsupported)
    limit = capability.file_constraints
    if size_bytes is not None and limit.max_bytes is not None and size_bytes > limit.max_bytes:
        raise SttCapabilityError(SttCapabilityReason.file_too_large)
    if duration_seconds is not None and duration_seconds > limit.max_duration_seconds:
        raise SttCapabilityError(SttCapabilityReason.duration_too_long)
    return capability


def catalog_payload(settings) -> dict[str, Any]:
    return {"providers": [provider_catalog(settings)[provider].browser_payload() for provider in SttProvider]}

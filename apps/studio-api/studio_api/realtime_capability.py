from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable
from urllib.parse import urlencode

import httpx


REALTIME_TOKEN_URL = (
    "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe"
)
REALTIME_WEBSOCKET_URL = (
    "wss://api.elevenlabs.io/v1/speech-to-text/realtime"
)
REALTIME_MODEL_ID = "scribe_v2_realtime"
REALTIME_AUDIO_FORMAT = "pcm_16000"
REALTIME_COMMIT_STRATEGY = "vad"
REALTIME_TOKEN_EXPIRES_IN_SECONDS = 900


class RealtimeCapabilityReason(str, Enum):
    provider_authentication_rejected = "provider_authentication_rejected"
    provider_request_rejected = "provider_request_rejected"
    provider_rate_limited = "provider_rate_limited"
    provider_unavailable = "provider_unavailable"
    provider_timeout = "provider_timeout"
    malformed_provider_response = "malformed_provider_response"


class RealtimeCapabilityError(RuntimeError):
    def __init__(self, reason: RealtimeCapabilityReason):
        self.reason = reason
        super().__init__(reason.value)


@dataclass(frozen=True)
class RealtimeCapability:
    websocket_url: str = field(repr=False)
    expires_in_seconds: int = REALTIME_TOKEN_EXPIRES_IN_SECONDS
    model_id: str = REALTIME_MODEL_ID
    audio_format: str = REALTIME_AUDIO_FORMAT
    commit_strategy: str = REALTIME_COMMIT_STRATEGY

    def browser_payload(self) -> dict[str, str | int]:
        return {
            "websocket_url": self.websocket_url,
            "expires_in_seconds": self.expires_in_seconds,
            "model_id": self.model_id,
            "audio_format": self.audio_format,
            "commit_strategy": self.commit_strategy,
        }

    def __repr__(self) -> str:
        return (
            "RealtimeCapability(websocket_url=<redacted>, "
            f"expires_in_seconds={self.expires_in_seconds!r}, "
            f"model_id={self.model_id!r}, "
            f"audio_format={self.audio_format!r}, "
            f"commit_strategy={self.commit_strategy!r})"
        )


def _extract_single_use_token(payload: Any) -> str:
    if not isinstance(payload, dict):
        raise RealtimeCapabilityError(
            RealtimeCapabilityReason.malformed_provider_response,
        )
    token = payload.get("token")
    if (
        not isinstance(token, str)
        or not token
        or len(token) > 4096
        or token != token.strip()
        or any(character.isspace() or ord(character) < 33 for character in token)
    ):
        raise RealtimeCapabilityError(
            RealtimeCapabilityReason.malformed_provider_response,
        )
    return token


def build_realtime_websocket_url(
    token: str,
    *,
    language_code: str | None,
) -> str:
    normalized_token = _extract_single_use_token({"token": token})
    query: dict[str, str] = {
        "model_id": REALTIME_MODEL_ID,
        "token": normalized_token,
        "audio_format": REALTIME_AUDIO_FORMAT,
        "commit_strategy": REALTIME_COMMIT_STRATEGY,
    }
    if language_code:
        query["language_code"] = language_code
    return f"{REALTIME_WEBSOCKET_URL}?{urlencode(query)}"


def create_realtime_capability(
    api_key: str,
    *,
    language_code: str | None,
    post: Callable[..., httpx.Response] | None = None,
    timeout_seconds: float = 20.0,
) -> RealtimeCapability:
    normalized_key = api_key.strip() if isinstance(api_key, str) else ""
    if not normalized_key:
        raise RealtimeCapabilityError(
            RealtimeCapabilityReason.provider_authentication_rejected,
        )

    post_fn = post or httpx.post
    try:
        response = post_fn(
            REALTIME_TOKEN_URL,
            headers={
                "xi-api-key": normalized_key,
                "accept": "application/json",
            },
            timeout=timeout_seconds,
        )
    except httpx.TimeoutException as exc:
        raise RealtimeCapabilityError(
            RealtimeCapabilityReason.provider_timeout,
        ) from exc
    except httpx.HTTPError as exc:
        raise RealtimeCapabilityError(
            RealtimeCapabilityReason.provider_unavailable,
        ) from exc

    if response.status_code in {401, 403}:
        raise RealtimeCapabilityError(
            RealtimeCapabilityReason.provider_authentication_rejected,
        )
    if response.status_code == 429:
        raise RealtimeCapabilityError(
            RealtimeCapabilityReason.provider_rate_limited,
        )
    if response.status_code in {400, 404, 409, 422}:
        raise RealtimeCapabilityError(
            RealtimeCapabilityReason.provider_request_rejected,
        )
    if response.status_code >= 500:
        raise RealtimeCapabilityError(
            RealtimeCapabilityReason.provider_unavailable,
        )
    if not 200 <= response.status_code < 300:
        raise RealtimeCapabilityError(
            RealtimeCapabilityReason.provider_unavailable,
        )

    try:
        token = _extract_single_use_token(response.json())
    except RealtimeCapabilityError:
        raise
    except Exception as exc:
        raise RealtimeCapabilityError(
            RealtimeCapabilityReason.malformed_provider_response,
        ) from exc

    return RealtimeCapability(
        websocket_url=build_realtime_websocket_url(
            token,
            language_code=language_code,
        ),
    )

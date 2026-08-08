from __future__ import annotations

import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import httpx
import pytest


ROOT = Path(__file__).resolve().parents[1]
STUDIO_API = ROOT / "apps" / "studio-api"
if str(STUDIO_API) not in sys.path:
    sys.path.insert(0, str(STUDIO_API))

from studio_api.realtime_capability import (  # noqa: E402
    REALTIME_TOKEN_URL,
    RealtimeCapabilityError,
    RealtimeCapabilityReason,
    build_realtime_websocket_url,
    create_realtime_capability,
)


def response(status_code: int, payload: object) -> httpx.Response:
    return httpx.Response(
        status_code,
        json=payload,
        request=httpx.Request("POST", REALTIME_TOKEN_URL),
    )


def test_capability_uses_main_key_only_server_side_and_returns_bounded_config():
    calls = []

    def post(url, **kwargs):
        calls.append((url, kwargs))
        return response(200, {"token": "sutkn_short_lived"})

    capability = create_realtime_capability(
        "  sk_main_secret  ",
        language_code="ru",
        post=post,
    )
    payload = capability.browser_payload()
    parsed = urlparse(payload["websocket_url"])
    query = parse_qs(parsed.query)

    assert calls == [
        (
            REALTIME_TOKEN_URL,
            {
                "headers": {
                    "xi-api-key": "sk_main_secret",
                    "accept": "application/json",
                },
                "timeout": 20.0,
            },
        ),
    ]
    assert parsed.scheme == "wss"
    assert parsed.netloc == "api.elevenlabs.io"
    assert parsed.path == "/v1/speech-to-text/realtime"
    assert query == {
        "audio_format": ["pcm_16000"],
        "commit_strategy": ["vad"],
        "language_code": ["ru"],
        "model_id": ["scribe_v2_realtime"],
        "token": ["sutkn_short_lived"],
    }
    assert payload["expires_in_seconds"] == 900
    assert "sk_main_secret" not in repr(capability)
    assert "sutkn_short_lived" not in repr(capability)


def test_auto_detect_omits_language_code():
    parsed = urlparse(
        build_realtime_websocket_url(
            "sutkn_short_lived",
            language_code=None,
        ),
    )
    assert "language_code" not in parse_qs(parsed.query)


@pytest.mark.parametrize(
    ("status_code", "reason"),
    [
        (400, RealtimeCapabilityReason.provider_request_rejected),
        (401, RealtimeCapabilityReason.provider_authentication_rejected),
        (403, RealtimeCapabilityReason.provider_authentication_rejected),
        (429, RealtimeCapabilityReason.provider_rate_limited),
        (500, RealtimeCapabilityReason.provider_unavailable),
    ],
)
def test_provider_status_is_reduced_to_safe_reason(status_code, reason):
    with pytest.raises(RealtimeCapabilityError) as error:
        create_realtime_capability(
            "sk_secret",
            language_code=None,
            post=lambda *_args, **_kwargs: response(
                status_code,
                {"detail": "raw provider text must not escape"},
            ),
        )
    assert error.value.reason is reason
    assert "raw provider text" not in str(error.value)


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"token": ""},
        {"token": " has-outer-space"},
        {"token": "contains space"},
        {"token": 123},
        ["sutkn_not_a_mapping"],
    ],
)
def test_malformed_token_response_fails_closed(payload):
    with pytest.raises(RealtimeCapabilityError) as error:
        create_realtime_capability(
            "sk_secret",
            language_code=None,
            post=lambda *_args, **_kwargs: response(200, payload),
        )
    assert (
        error.value.reason
        is RealtimeCapabilityReason.malformed_provider_response
    )


def test_network_and_timeout_errors_are_safe():
    def timeout(*_args, **_kwargs):
        raise httpx.ReadTimeout("private timeout detail")

    with pytest.raises(RealtimeCapabilityError) as timeout_error:
        create_realtime_capability(
            "sk_secret",
            language_code=None,
            post=timeout,
        )
    assert timeout_error.value.reason is RealtimeCapabilityReason.provider_timeout
    assert "private timeout detail" not in str(timeout_error.value)

    def network(*_args, **_kwargs):
        raise httpx.ConnectError("private network detail")

    with pytest.raises(RealtimeCapabilityError) as network_error:
        create_realtime_capability(
            "sk_secret",
            language_code=None,
            post=network,
        )
    assert network_error.value.reason is RealtimeCapabilityReason.provider_unavailable
    assert "private network detail" not in str(network_error.value)

from __future__ import annotations

import sys
from pathlib import Path

import httpx
import pytest


ROOT = Path(__file__).resolve().parents[1]
STUDIO_API = ROOT / "apps" / "studio-api"
if str(STUDIO_API) not in sys.path:
    sys.path.insert(0, str(STUDIO_API))

from studio_api.realtime_consumers import (  # noqa: E402
    RealtimeConsumerError,
    RealtimeConsumerKind,
    RealtimeConsumerTarget,
    deliver_realtime_caption,
    validate_realtime_consumer_target,
)


def test_consumer_targets_are_https_public_and_allowlisted():
    public = lambda _hostname: True
    youtube = validate_realtime_consumer_target(
        "youtube_live",
        "https://upload.youtube.com/closedcaption?cid=opaque",
        resolve_public_addresses=public,
    )
    webhook = validate_realtime_consumer_target(
        "webhook",
        "https://captions.example/live",
        webhook_allowed_hosts="captions.example",
        resolve_public_addresses=public,
    )
    assert youtube.kind.value == "youtube_live"
    assert webhook.url == "https://captions.example/live"

    for endpoint in (
        "http://upload.youtube.com/closedcaption?cid=x",
        "https://127.0.0.1/closedcaption?cid=x",
        "https://evil.example/closedcaption?cid=x",
    ):
        with pytest.raises(RealtimeConsumerError):
            validate_realtime_consumer_target(
                "youtube_live", endpoint, resolve_public_addresses=public
            )
    with pytest.raises(RealtimeConsumerError, match="webhook_host_not_allowed"):
        validate_realtime_consumer_target(
            "webhook",
            "https://captions.example/live",
            webhook_allowed_hosts="",
            resolve_public_addresses=public,
        )


def test_delivery_uses_consumer_specific_payloads_and_rejects_failure():
    public = lambda _hostname: True
    youtube = validate_realtime_consumer_target(
        "youtube_live",
        "https://upload.youtube.com/closedcaption?cid=opaque",
        resolve_public_addresses=public,
    )
    calls = []

    def post(url, **kwargs):
        calls.append((url, kwargs))
        return httpx.Response(204, request=httpx.Request("POST", url))

    deliver_realtime_caption(youtube, text="Готово", sequence=7, post=post)
    assert "seq=7" in calls[0][0]
    assert calls[0][1]["content"] == "Готово\n".encode()

    webhook = validate_realtime_consumer_target(
        "webhook",
        "https://captions.example/live",
        webhook_allowed_hosts="captions.example",
        resolve_public_addresses=public,
    )
    deliver_realtime_caption(webhook, text="Ready", sequence=8, post=post)
    assert calls[1][1]["json"] == {"text": "Ready", "sequence": 8}

    with pytest.raises(RealtimeConsumerError, match="consumer_delivery_rejected"):
        deliver_realtime_caption(
            webhook,
            text="Ready",
            sequence=9,
            post=lambda url, **_kwargs: httpx.Response(
                503, request=httpx.Request("POST", url)
            ),
        )


@pytest.mark.parametrize(
    ("text", "sequence", "reason"),
    [
        ("   ", 1, "invalid_caption_text"),
        ("x" * 2001, 1, "invalid_caption_text"),
        ("caption", -1, "invalid_caption_sequence"),
        ("caption", True, "invalid_caption_sequence"),
    ],
)
def test_delivery_revalidates_bounded_caption_payload(text, sequence, reason):
    target = RealtimeConsumerTarget(
        RealtimeConsumerKind.webhook,
        "https://captions.example.test/hook",
    )

    with pytest.raises(RealtimeConsumerError, match=reason):
        deliver_realtime_caption(target, text=text, sequence=sequence)

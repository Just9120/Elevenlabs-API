from __future__ import annotations

import base64
import asyncio
import io
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest


ROOT = Path(__file__).resolve().parents[1]
STUDIO_API = ROOT / "apps" / "studio-api"
if str(STUDIO_API) not in sys.path:
    sys.path.insert(0, str(STUDIO_API))
os.environ.setdefault("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")

from studio_api.yandex_realtime_relay import (  # noqa: E402
    MAX_AUDIO_CHUNK_BYTES,
    MAX_SESSION_AUDIO_BYTES,
    YandexRealtimeCapabilityError,
    _realtime_health_failure_code,
    _realtime_user_failure_code,
    _session_options,
    _validated_audio_chunk,
    create_yandex_realtime_capability,
    decode_yandex_realtime_capability,
    relay_yandex_realtime,
)
from studio_api.elevenlabs_transcription import (  # noqa: E402
    ElevenLabsTranscriptionError,
    ElevenLabsTranscriptionReason,
)
from studio_api.yandex_transcription import (  # noqa: E402
    YandexTranscriptionTransport,
    normalize_yandex_transcript_response,
)

import grpc  # noqa: E402
from studio_api import yandex_realtime_relay as realtime_relay  # noqa: E402


class Settings:
    app_origin = "https://studio.example"
    credential_key_id = "studio-v1"

    @staticmethod
    def master_key_b64():
        return base64.urlsafe_b64encode(b"k" * 32).decode("ascii")


@pytest.mark.parametrize(
    ("status_code", "failure_code"),
    [
        (grpc.StatusCode.RESOURCE_EXHAUSTED, "provider_rate_limited"),
        (grpc.StatusCode.DEADLINE_EXCEEDED, "provider_timeout"),
        (grpc.StatusCode.UNAVAILABLE, "provider_unavailable"),
        (grpc.StatusCode.INTERNAL, "provider_unavailable"),
        (grpc.StatusCode.UNKNOWN, "provider_unavailable"),
        (grpc.StatusCode.UNAUTHENTICATED, None),
        (grpc.StatusCode.PERMISSION_DENIED, None),
        (grpc.StatusCode.INVALID_ARGUMENT, None),
    ],
)
def test_yandex_realtime_health_uses_only_systemic_provider_failures(
    status_code,
    failure_code,
):
    assert _realtime_health_failure_code(status_code) == failure_code


@pytest.mark.parametrize(
    ("status_code", "failure_code"),
    [
        (grpc.StatusCode.RESOURCE_EXHAUSTED, "provider_rate_limited"),
        (grpc.StatusCode.DEADLINE_EXCEEDED, "provider_timeout"),
        (grpc.StatusCode.UNAVAILABLE, "provider_unavailable"),
        (grpc.StatusCode.UNAUTHENTICATED, "provider_authentication_rejected"),
        (grpc.StatusCode.PERMISSION_DENIED, "provider_authentication_rejected"),
        (grpc.StatusCode.INVALID_ARGUMENT, "provider_request_rejected"),
        (grpc.StatusCode.CANCELLED, "provider_unavailable"),
    ],
)
def test_yandex_realtime_maps_grpc_status_to_safe_user_failure(
    status_code,
    failure_code,
):
    assert _realtime_user_failure_code(status_code) == failure_code


def test_yandex_realtime_health_write_is_bounded_and_best_effort(monkeypatch):
    calls = []

    class HealthDb:
        def commit(self):
            calls.append("commit")

        def rollback(self):
            calls.append("rollback")

        def close(self):
            calls.append("close")

    monkeypatch.setattr(realtime_relay, "SessionLocal", HealthDb)
    monkeypatch.setattr(
        realtime_relay,
        "record_provider_failure",
        lambda _db, **kwargs: calls.append(kwargs),
    )
    settings = SimpleNamespace(
        stt_health_failure_threshold=3,
        stt_health_cooldown_seconds=300,
    )

    realtime_relay._record_realtime_provider_health(
        settings=settings,
        failure_code="provider_timeout",
    )

    assert calls[0]["provider"] == "yandex"
    assert calls[0]["operating_mode"] == "realtime"
    assert calls[0]["failure_code"] == "provider_timeout"
    assert calls[0]["threshold"] == 3
    assert calls[0]["cooldown_seconds"] == 300
    assert calls[1:] == ["commit", "close"]


class _ScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class _YandexDb:
    def __init__(self):
        self.job = SimpleNamespace(
            id="job",
            owner_user_id="owner",
            project_id="project",
            attempt_count=1,
            operating_mode="standard",
        )
        self.operation = None
        self.commits = 0

    def get(self, _model, row_id):
        return self.job if row_id == self.job.id else None

    def execute(self, _statement):
        return _ScalarResult(self.operation)

    def add(self, operation):
        operation.id = str(uuid.uuid4())
        self.operation = operation

    def commit(self):
        self.commits += 1


class _YandexClient:
    def __init__(self, db: _YandexDb):
        self.db = db
        self.calls = []

    def request(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs))
        if method == "POST":
            return httpx.Response(200, json={"id": "operation-safe"})
        assert self.db.operation is not None
        assert self.db.operation.operation_id == "operation-safe"
        assert self.db.operation.status == "pending"
        assert self.db.commits >= 1
        if "/operations/" in url:
            return httpx.Response(200, json={"done": True})
        return httpx.Response(
            200,
            json={
                "streamingResponses": [
                    {
                        "final": {
                            "alternatives": [
                                {
                                    "text": "Проверка завершена",
                                    "words": [
                                        {
                                            "text": "Проверка",
                                            "startTimeMs": 0,
                                            "endTimeMs": 400,
                                        },
                                        {
                                            "text": "завершена",
                                            "startTimeMs": 420,
                                            "endTimeMs": 800,
                                        },
                                    ],
                                }
                            ]
                        },
                        "audioCursors": {"finalIndex": 0},
                    }
                ]
            },
        )


def test_yandex_normalization_preserves_text_words_language_and_speakers():
    result = normalize_yandex_transcript_response(
        [
            {
                "final": {
                    "alternatives": [
                        {
                            "text": "Добрый день",
                            "words": [
                                {"text": "Добрый", "startTimeMs": 0, "endTimeMs": 300},
                                {"text": "день", "startTimeMs": 320, "endTimeMs": 600},
                            ],
                            "languages": [{"languageCode": "ru-RU", "probability": 0.99}],
                        }
                    ]
                },
                "audioCursors": {"finalIndex": 0},
                "channelTag": "speaker-1",
            }
        ]
    )
    assert result.text == "Добрый день"
    assert result.detected_language_code == "ru-RU"
    assert result.words[0].start == 0
    assert result.words[1].end == 0.6
    assert {word.speaker_id for word in result.words} == {"speaker-1"}


def test_yandex_realtime_capability_is_bounded_signed_and_origin_scoped():
    capability = create_yandex_realtime_capability(
        owner_user_id="owner",
        project_id="project",
        credential_id="credential",
        credential_version_id="version",
        folder_id="folder",
        language_code="ru-RU",
        model="general",
        settings=Settings(),
        now_epoch=1_000,
    )
    parsed = urlsplit(capability["websocket_url"])
    token = parse_qs(parsed.query)["capability"][0]
    authority = decode_yandex_realtime_capability(token, settings=Settings(), now_epoch=1_010)

    assert capability["provider"] == "yandex"
    assert parsed.scheme == "wss"
    assert parsed.netloc == "studio.example"
    assert authority.folder_id == "folder"
    assert authority.language_code == "ru-RU"
    with pytest.raises(YandexRealtimeCapabilityError):
        decode_yandex_realtime_capability(token + "x", settings=Settings(), now_epoch=1_010)
    with pytest.raises(YandexRealtimeCapabilityError, match="expired_capability"):
        decode_yandex_realtime_capability(token, settings=Settings(), now_epoch=1_301)


def test_yandex_realtime_wire_options_and_audio_budget_match_documented_limits():
    authority = decode_yandex_realtime_capability(
        parse_qs(
            urlsplit(
                create_yandex_realtime_capability(
                    owner_user_id="owner",
                    project_id="project",
                    credential_id="credential",
                    credential_version_id="version",
                    folder_id="folder",
                    language_code="ru-RU",
                    model="general",
                    settings=Settings(),
                    now_epoch=1_000,
                )["websocket_url"]
            ).query
        )["capability"][0],
        settings=Settings(),
        now_epoch=1_001,
    )
    options = _session_options(authority)
    assert options.recognition_model.model == "general"
    assert options.recognition_model.audio_format.raw_audio.sample_rate_hertz == 16_000
    assert options.recognition_model.audio_format.raw_audio.audio_channel_count == 1
    assert list(options.recognition_model.language_restriction.language_code) == ["ru-RU"]

    encoded = base64.b64encode(b"a" * MAX_AUDIO_CHUNK_BYTES).decode("ascii")
    assert len(_validated_audio_chunk({"audio_base_64": encoded}, received_bytes=0)) == MAX_AUDIO_CHUNK_BYTES
    with pytest.raises(YandexRealtimeCapabilityError, match="audio_limit_exceeded"):
        _validated_audio_chunk(
            {"audio_base_64": base64.b64encode(b"x").decode("ascii")},
            received_bytes=MAX_SESSION_AUDIO_BYTES,
        )


def test_yandex_realtime_relay_streams_audio_and_committed_text(monkeypatch):
    audio = b"pcm-safe"
    messages = [
        {"audio_base_64": base64.b64encode(audio).decode("ascii")},
        {"commit": True},
    ]
    sent = []
    received_audio = []
    health = []

    class WebSocket:
        headers = {"origin": "https://studio.example"}

        async def accept(self):
            sent.append({"accepted": True})

        async def receive_json(self):
            return messages.pop(0)

        async def send_json(self, payload):
            sent.append(payload)

        async def close(self, *, code):
            sent.append({"closed": code})

    class Call:
        def __init__(self, requests):
            self.requests = requests

        def __aiter__(self):
            return self.responses()

        async def responses(self):
            async for request in self.requests:
                if request.WhichOneof("Event") == "chunk":
                    received_audio.append(request.chunk.data)
            yield SimpleNamespace(
                WhichOneof=lambda _name: "final",
                partial=None,
                final=SimpleNamespace(
                    alternatives=[SimpleNamespace(text="сырой фрагмент")],
                ),
            )
            yield SimpleNamespace(
                WhichOneof=lambda _name: "final_refinement",
                partial=None,
                final=None,
                final_refinement=SimpleNamespace(
                    normalized_text=SimpleNamespace(
                        alternatives=[SimpleNamespace(text="Готовый фрагмент")],
                    ),
                ),
            )

    class Stub:
        def __init__(self, _channel):
            pass

        def RecognizeStreaming(self, requests, **_kwargs):
            return Call(requests)

    class Channel:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

    authority = SimpleNamespace(
        folder_id="folder-safe",
        language_code="ru-RU",
        model="general",
    )
    settings = SimpleNamespace(
        app_origin="https://studio.example",
        yandex_stt_grpc_endpoint="stt.api.cloud.yandex.net:443",
    )
    monkeypatch.setattr(
        realtime_relay,
        "decode_yandex_realtime_capability",
        lambda *_args, **_kwargs: authority,
    )
    monkeypatch.setattr(
        realtime_relay,
        "_open_api_key",
        lambda *_args, **_kwargs: "api-key-safe",
    )
    monkeypatch.setattr(realtime_relay, "RecognizerStub", Stub)
    monkeypatch.setattr(
        realtime_relay.grpc.aio,
        "secure_channel",
        lambda *_args, **_kwargs: Channel(),
    )
    monkeypatch.setattr(
        realtime_relay,
        "_record_realtime_provider_health",
        lambda **kwargs: health.append(kwargs),
    )

    asyncio.run(
        relay_yandex_realtime(
            WebSocket(),
            capability="signed-capability",
            settings=settings,
        )
    )

    assert received_audio == [audio]
    assert {"message_type": "session_started"} in sent
    assert {
        "message_type": "committed_transcript",
        "text": "Готовый фрагмент",
    } in sent
    assert all(item.get("text") != "сырой фрагмент" for item in sent)
    assert health == [{"settings": settings, "failure_code": None}]
    assert sent[-1] == {"closed": 1000}


def test_yandex_async_operation_is_durable_before_poll_and_completed_result_resumes_without_resubmit():
    db = _YandexDb()
    client = _YandexClient(db)
    settings = SimpleNamespace(
        yandex_stt_api_base_url="https://stt.api.cloud.yandex.net",
        yandex_operations_api_base_url="https://operation.api.cloud.yandex.net",
        yandex_operation_timeout_seconds=30,
        yandex_operation_poll_interval_seconds=0,
        credential_key_id="studio-v1",
        master_key_b64=lambda: base64.urlsafe_b64encode(b"k" * 32).decode("ascii"),
    )
    transport = YandexTranscriptionTransport(
        db=db,
        job_id="job",
        job_source_id="job-source",
        settings=settings,
        folder_id="folder-safe",
        clock=lambda: datetime.now(timezone.utc),
        client=client,
        sleeper=lambda _seconds: None,
    )

    result = transport.transcribe(
        api_key="api-key-safe",
        stream=io.BytesIO(b"ogg-opus"),
        filename="source.ogg",
        mime_type="audio/ogg",
        language_code="ru",
        diarize=False,
        model_id="general",
    )

    assert result.text == "Проверка завершена"
    assert db.operation.status == "completed"
    assert db.operation.result_ciphertext
    assert [call[0] for call in client.calls] == ["POST", "GET", "GET"]

    db.job.attempt_count = 2
    no_network_client = _YandexClient(db)
    resumed = YandexTranscriptionTransport(
        db=db,
        job_id="job",
        job_source_id="job-source",
        settings=settings,
        folder_id="folder-safe",
        clock=lambda: datetime.now(timezone.utc),
        client=no_network_client,
    ).transcribe(
        api_key="api-key-safe",
        stream=io.BytesIO(b"unused"),
        filename="source.ogg",
        mime_type="audio/ogg",
        language_code="ru",
        model_id="general",
    )

    assert resumed.text == result.text
    assert no_network_client.calls == []

    db.operation.status = "failed"
    db.operation.attempt_number = db.job.attempt_count
    rejected_client = _YandexClient(db)
    with pytest.raises(ElevenLabsTranscriptionError) as rejected:
        YandexTranscriptionTransport(
            db=db,
            job_id="job",
            job_source_id="job-source",
            settings=settings,
            folder_id="folder-safe",
            clock=lambda: datetime.now(timezone.utc),
            client=rejected_client,
        ).transcribe(
            api_key="api-key-safe",
            stream=io.BytesIO(b"unused"),
            filename="source.ogg",
            mime_type="audio/ogg",
            language_code="ru",
            model_id="general",
        )
    assert rejected.value.reason is ElevenLabsTranscriptionReason.provider_request_rejected
    assert rejected_client.calls == []

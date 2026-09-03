from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import grpc
from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect

from .db import SessionLocal
from .models import CredentialStatus, Project, ProviderCredential, ProviderCredentialVersion
from .security import aad, decrypt, master_key_from_b64
from .stt_provider_health import record_provider_failure, record_provider_success
from .yandex_realtime_pb2 import (
    AudioChunk,
    AudioFormatOptions,
    LanguageRestrictionOptions,
    RawAudio,
    RecognitionModelOptions,
    SpeakerLabelingOptions,
    StreamingOptions,
    StreamingRequest,
)
from .yandex_realtime_pb2_grpc import RecognizerStub


CAPABILITY_TTL_SECONDS = 300
MAX_CAPABILITY_LENGTH = 1600
MAX_AUDIO_CHUNK_BYTES = 256 * 1024
MAX_SESSION_AUDIO_BYTES = 10 * 1024 * 1024
MAX_SESSION_SECONDS = 300

_HEALTH_FAILURE_BY_GRPC_STATUS = {
    grpc.StatusCode.RESOURCE_EXHAUSTED: "provider_rate_limited",
    grpc.StatusCode.DEADLINE_EXCEEDED: "provider_timeout",
    grpc.StatusCode.UNAVAILABLE: "provider_unavailable",
    grpc.StatusCode.INTERNAL: "provider_unavailable",
    grpc.StatusCode.UNKNOWN: "provider_unavailable",
}

_USER_FAILURE_BY_GRPC_STATUS = {
    **_HEALTH_FAILURE_BY_GRPC_STATUS,
    grpc.StatusCode.UNAUTHENTICATED: "provider_authentication_rejected",
    grpc.StatusCode.PERMISSION_DENIED: "provider_authentication_rejected",
    grpc.StatusCode.INVALID_ARGUMENT: "provider_request_rejected",
}


class YandexRealtimeCapabilityError(ValueError):
    pass


@dataclass(frozen=True)
class YandexRealtimeAuthority:
    owner_user_id: str
    project_id: str
    credential_id: str
    credential_version_id: str
    folder_id: str
    language_code: str | None
    model: str


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def create_yandex_realtime_capability(
    *,
    owner_user_id: str,
    project_id: str,
    credential_id: str,
    credential_version_id: str,
    folder_id: str,
    language_code: str | None,
    model: str,
    settings,
    now_epoch: int | None = None,
) -> dict[str, Any]:
    now_epoch = int(time.time()) if now_epoch is None else int(now_epoch)
    payload = {
        "v": 1,
        "sub": owner_user_id,
        "project": project_id,
        "credential": credential_id,
        "version": credential_version_id,
        "folder": folder_id,
        "language": language_code,
        "model": model,
        "nonce": secrets.token_urlsafe(18),
        "iat": now_epoch,
        "exp": now_epoch + CAPABILITY_TTL_SECONDS,
    }
    encoded = _b64encode(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8"))
    signature = _b64encode(hmac.new(master_key_from_b64(settings.master_key_b64()), encoded.encode("ascii"), hashlib.sha256).digest())
    token = f"{encoded}.{signature}"
    scheme = "wss" if settings.app_origin.startswith("https://") else "ws"
    authority = settings.app_origin.split("://", 1)[-1].rstrip("/")
    return {
        "provider": "yandex",
        "websocket_url": f"{scheme}://{authority}/api/realtime/yandex?capability={token}",
        "expires_in_seconds": CAPABILITY_TTL_SECONDS,
        "model_id": model,
        "audio_format": "pcm_16000",
        "commit_strategy": "vad",
    }


def decode_yandex_realtime_capability(token: str, *, settings, now_epoch: int | None = None) -> YandexRealtimeAuthority:
    if not isinstance(token, str) or len(token) > MAX_CAPABILITY_LENGTH or token.count(".") != 1:
        raise YandexRealtimeCapabilityError("invalid_capability")
    encoded, signature = token.split(".", 1)
    expected = _b64encode(hmac.new(master_key_from_b64(settings.master_key_b64()), encoded.encode("ascii"), hashlib.sha256).digest())
    if not hmac.compare_digest(expected, signature):
        raise YandexRealtimeCapabilityError("invalid_capability")
    try:
        payload = json.loads(_b64decode(encoded))
    except Exception as exc:
        raise YandexRealtimeCapabilityError("invalid_capability") from exc
    now_epoch = int(time.time()) if now_epoch is None else int(now_epoch)
    if payload.get("v") != 1 or not isinstance(payload.get("iat"), int) or not isinstance(payload.get("exp"), int):
        raise YandexRealtimeCapabilityError("invalid_capability")
    if payload["exp"] < now_epoch or payload["exp"] - payload["iat"] != CAPABILITY_TTL_SECONDS or payload["iat"] > now_epoch + 30:
        raise YandexRealtimeCapabilityError("expired_capability")
    required = ("sub", "project", "credential", "version", "folder", "model", "nonce")
    if any(not isinstance(payload.get(field), str) or not payload[field] for field in required):
        raise YandexRealtimeCapabilityError("invalid_capability")
    language = payload.get("language")
    if language is not None and language not in {"ru-RU", "en-US"}:
        raise YandexRealtimeCapabilityError("invalid_capability")
    return YandexRealtimeAuthority(
        owner_user_id=payload["sub"],
        project_id=payload["project"],
        credential_id=payload["credential"],
        credential_version_id=payload["version"],
        folder_id=payload["folder"],
        language_code=language,
        model=payload["model"],
    )


def _open_api_key(authority: YandexRealtimeAuthority, settings) -> str:
    db = SessionLocal()
    try:
        project = db.get(Project, authority.project_id)
        credential = db.get(ProviderCredential, authority.credential_id)
        version = db.get(ProviderCredentialVersion, authority.credential_version_id)
        if (
            project is None
            or project.owner_user_id != authority.owner_user_id
            or project.archived_at is not None
            or credential is None
            or credential.user_id != authority.owner_user_id
            or credential.provider.value != "yandex"
            or credential.status != CredentialStatus.active
            or credential.deleted_at is not None
            or credential.active_version_id != authority.credential_version_id
            or version is None
            or version.credential_id != credential.id
            or version.revoked_at is not None
            or version.deleted_at is not None
            or version.ciphertext is None
            or version.nonce is None
            or version.key_id != settings.credential_key_id
        ):
            raise YandexRealtimeCapabilityError("credential_unavailable")
        return decrypt(
            version.ciphertext,
            version.nonce,
            master_key_from_b64(settings.master_key_b64()),
            aad(authority.owner_user_id, credential.id, version.id, "yandex"),
        )
    finally:
        db.close()


def _realtime_health_failure_code(status_code: grpc.StatusCode) -> str | None:
    return _HEALTH_FAILURE_BY_GRPC_STATUS.get(status_code)


def _realtime_user_failure_code(status_code: grpc.StatusCode) -> str:
    return _USER_FAILURE_BY_GRPC_STATUS.get(status_code, "provider_unavailable")


def _record_realtime_provider_health(*, settings, failure_code: str | None) -> None:
    """Persist only server-observed provider health without affecting the session."""
    db = None
    try:
        db = SessionLocal()
        now = datetime.now(timezone.utc)
        if failure_code is None:
            record_provider_success(
                db,
                provider="yandex",
                operating_mode="realtime",
                now=now,
            )
        else:
            record_provider_failure(
                db,
                provider="yandex",
                operating_mode="realtime",
                failure_code=failure_code,
                threshold=settings.stt_health_failure_threshold,
                cooldown_seconds=settings.stt_health_cooldown_seconds,
                now=now,
            )
        db.commit()
    except Exception:
        if db is not None:
            try:
                db.rollback()
            except Exception:
                pass
    finally:
        if db is not None:
            try:
                db.close()
            except Exception:
                pass


def _validated_audio_chunk(message: object, *, received_bytes: int) -> bytes:
    if not isinstance(message, dict):
        raise YandexRealtimeCapabilityError("invalid_audio_message")
    encoded = message.get("audio_base_64")
    if not isinstance(encoded, str) or not encoded:
        raise YandexRealtimeCapabilityError("invalid_audio_message")
    try:
        chunk = base64.b64decode(encoded, validate=True)
    except Exception as exc:
        raise YandexRealtimeCapabilityError("invalid_audio_message") from exc
    if (
        not chunk
        or len(chunk) > MAX_AUDIO_CHUNK_BYTES
        or received_bytes + len(chunk) > MAX_SESSION_AUDIO_BYTES
    ):
        raise YandexRealtimeCapabilityError("audio_limit_exceeded")
    return chunk


def _session_options(authority: YandexRealtimeAuthority) -> StreamingOptions:
    language = None
    if authority.language_code:
        language = LanguageRestrictionOptions(
            restriction_type=LanguageRestrictionOptions.WHITELIST,
            language_code=[authority.language_code],
        )
    recognition = RecognitionModelOptions(
        model=authority.model,
        audio_format=AudioFormatOptions(
            raw_audio=RawAudio(
                audio_encoding=RawAudio.LINEAR16_PCM,
                sample_rate_hertz=16000,
                audio_channel_count=1,
            )
        ),
        audio_processing_type=RecognitionModelOptions.REAL_TIME,
    )
    if language is not None:
        recognition.language_restriction.CopyFrom(language)
    return StreamingOptions(
        recognition_model=recognition,
        speaker_labeling=SpeakerLabelingOptions(
            speaker_labeling=SpeakerLabelingOptions.SPEAKER_LABELING_ENABLED
        ),
    )


async def relay_yandex_realtime(websocket: WebSocket, *, capability: str, settings) -> None:
    origin = (websocket.headers.get("origin") or "").rstrip("/")
    if origin != settings.app_origin.rstrip("/"):
        await websocket.close(code=4403)
        return
    received_transcript = False
    pending_final = ""
    try:
        authority = decode_yandex_realtime_capability(capability, settings=settings)
        api_key = _open_api_key(authority, settings)
    except YandexRealtimeCapabilityError:
        await websocket.close(code=4403)
        return
    await websocket.accept()
    credentials = grpc.ssl_channel_credentials()
    metadata = (("authorization", f"Api-Key {api_key}"), ("x-folder-id", authority.folder_id))
    api_key = ""

    async def request_stream():
        received_bytes = 0
        yield StreamingRequest(session_options=_session_options(authority))
        while True:
            message = await websocket.receive_json()
            if not isinstance(message, dict):
                raise YandexRealtimeCapabilityError("invalid_audio_message")
            if message.get("commit") is True:
                return
            chunk = _validated_audio_chunk(message, received_bytes=received_bytes)
            received_bytes += len(chunk)
            yield StreamingRequest(chunk=AudioChunk(data=chunk))

    try:
        async with grpc.aio.secure_channel(settings.yandex_stt_grpc_endpoint, credentials) as channel:
            call = RecognizerStub(channel).RecognizeStreaming(
                request_stream(),
                metadata=metadata,
                timeout=MAX_SESSION_SECONDS,
            )
            await websocket.send_json({"message_type": "session_started"})
            async for response in call:
                event = response.WhichOneof("Event")
                if event == "partial":
                    if pending_final:
                        await websocket.send_json(
                            {
                                "message_type": "committed_transcript",
                                "text": pending_final,
                            }
                        )
                        pending_final = ""
                    update = response.partial
                elif event == "final":
                    update = response.final
                elif event == "final_refinement":
                    update = response.final_refinement.normalized_text
                else:
                    update = None
                if update is None or not update.alternatives:
                    continue
                text = update.alternatives[0].text.strip()
                if text:
                    received_transcript = True
                    if event == "final":
                        pending_final = text
                    else:
                        await websocket.send_json(
                            {
                                "message_type": (
                                    "partial_transcript"
                                    if event == "partial"
                                    else "committed_transcript"
                                ),
                                "text": text,
                            }
                        )
                        if event == "final_refinement":
                            pending_final = ""
            if pending_final:
                await websocket.send_json(
                    {
                        "message_type": "committed_transcript",
                        "text": pending_final,
                    }
                )
            if received_transcript:
                _record_realtime_provider_health(settings=settings, failure_code=None)
    except WebSocketDisconnect:
        return
    except YandexRealtimeCapabilityError as exc:
        await websocket.send_json({"message_type": "error", "error": str(exc)})
    except grpc.aio.AioRpcError as exc:
        health_failure_code = _realtime_health_failure_code(exc.code())
        if health_failure_code is not None:
            _record_realtime_provider_health(
                settings=settings,
                failure_code=health_failure_code,
            )
        await websocket.send_json(
            {
                "message_type": "error",
                "error": _realtime_user_failure_code(exc.code()),
            }
        )
    except Exception:
        await websocket.send_json({"message_type": "error", "error": "provider_unavailable"})
    finally:
        try:
            await websocket.close(code=1000)
        except Exception:
            pass

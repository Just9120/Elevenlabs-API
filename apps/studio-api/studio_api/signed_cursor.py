from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
from datetime import datetime, timezone
from typing import Any


def _as_utc_naive(value: datetime) -> datetime:
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _cursor_key(namespace: str, secret: str) -> bytes:
    return hashlib.sha256((namespace + ":" + secret).encode()).digest()


def encode_signed_cursor(
    timestamp: datetime,
    row_id: str,
    context: dict[str, Any],
    secret: str,
    *,
    namespace: str,
) -> str:
    payload = {
        "v": 1,
        "t": _as_utc_naive(timestamp).isoformat(),
        "i": row_id,
        "c": context,
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    signature = hmac.new(
        _cursor_key(namespace, secret), raw, hashlib.sha256
    ).digest()
    return base64.urlsafe_b64encode(raw + signature).decode().rstrip("=")


def decode_signed_cursor_payload(
    cursor: str,
    secret: str,
    *,
    namespace: str,
    max_length: int = 1200,
) -> tuple[datetime, str, dict[str, Any]] | None:
    try:
        if (
            not isinstance(cursor, str)
            or len(cursor) > max_length
            or not re.fullmatch(r"[A-Za-z0-9_-]+", cursor)
        ):
            return None
        data = base64.urlsafe_b64decode(
            (cursor + "=" * (-len(cursor) % 4)).encode()
        )
        if len(data) <= 32:
            return None
        raw, signature = data[:-32], data[-32:]
        expected = hmac.new(
            _cursor_key(namespace, secret), raw, hashlib.sha256
        ).digest()
        if not hmac.compare_digest(signature, expected):
            return None
        payload = json.loads(raw)
        signed_context = payload.get("c")
        if payload.get("v") != 1 or not isinstance(signed_context, dict):
            return None
        timestamp = datetime.fromisoformat(payload["t"])
        row_id = payload["i"]
        if not isinstance(row_id, str) or len(row_id) > 64:
            return None
        return _as_utc_naive(timestamp), row_id, signed_context
    except Exception:
        return None


def decode_signed_cursor(
    cursor: str,
    context: dict[str, Any],
    secret: str,
    *,
    namespace: str,
    max_length: int = 1200,
) -> tuple[datetime, str] | None:
    decoded = decode_signed_cursor_payload(
        cursor,
        secret,
        namespace=namespace,
        max_length=max_length,
    )
    if decoded is None:
        return None
    timestamp, row_id, signed_context = decoded
    return (timestamp, row_id) if signed_context == context else None

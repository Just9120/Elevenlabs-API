from __future__ import annotations

import re
from datetime import datetime
from typing import Any
from uuid import UUID

from .signed_cursor import decode_signed_cursor, encode_signed_cursor


DEFAULT_COLLECTION_PAGE_SIZE = 50
MAX_COLLECTION_PAGE_SIZE = 100
MAX_COLLECTION_CURSOR_LENGTH = 1200
_SURFACE_RE = re.compile(r"[a-z][a-z0-9_-]{1,39}")
_CURSOR_NAMESPACE = "studio-browser-collection-cursor-v1"


class CollectionCursorError(ValueError):
    pass


def collection_cursor_context(
    *,
    owner_user_id: str,
    surface: str,
    scope: dict[str, str] | None = None,
) -> dict[str, Any]:
    if not _SURFACE_RE.fullmatch(surface):
        raise ValueError("invalid collection cursor surface")
    normalized_scope = dict(sorted((scope or {}).items()))
    if any(
        not isinstance(key, str)
        or not key
        or len(key) > 40
        or not isinstance(value, str)
        or not value
        or len(value) > 128
        for key, value in normalized_scope.items()
    ):
        raise ValueError("invalid collection cursor scope")
    return {
        "owner": owner_user_id,
        "surface": surface,
        "scope": normalized_scope,
    }


def decode_collection_cursor(
    cursor: str | None,
    *,
    secret: str,
    owner_user_id: str,
    surface: str,
    scope: dict[str, str] | None = None,
) -> tuple[datetime, str] | None:
    if cursor is None:
        return None
    context = collection_cursor_context(
        owner_user_id=owner_user_id,
        surface=surface,
        scope=scope,
    )
    decoded = decode_signed_cursor(
        cursor,
        context,
        secret,
        namespace=_CURSOR_NAMESPACE,
        max_length=MAX_COLLECTION_CURSOR_LENGTH,
    )
    if decoded is None:
        raise CollectionCursorError("invalid collection cursor")
    timestamp, row_id = decoded
    try:
        UUID(row_id)
    except (TypeError, ValueError, AttributeError) as exc:
        raise CollectionCursorError("invalid collection cursor") from exc
    return timestamp, row_id


def encode_collection_cursor(
    timestamp: datetime,
    row_id: str,
    *,
    secret: str,
    owner_user_id: str,
    surface: str,
    scope: dict[str, str] | None = None,
) -> str:
    try:
        UUID(row_id)
    except (TypeError, ValueError, AttributeError) as exc:
        raise ValueError("invalid collection row id") from exc
    return encode_signed_cursor(
        timestamp,
        row_id,
        collection_cursor_context(
            owner_user_id=owner_user_id,
            surface=surface,
            scope=scope,
        ),
        secret,
        namespace=_CURSOR_NAMESPACE,
    )


def page_envelope(
    rows: list[Any],
    *,
    page_size: int,
    timestamp_attribute: str,
    secret: str,
    owner_user_id: str,
    surface: str,
    scope: dict[str, str] | None = None,
) -> tuple[list[Any], str | None]:
    if page_size < 1 or page_size > MAX_COLLECTION_PAGE_SIZE:
        raise ValueError("invalid collection page size")
    if len(rows) <= page_size:
        return rows, None
    visible = rows[:page_size]
    last = visible[-1]
    return visible, encode_collection_cursor(
        getattr(last, timestamp_attribute),
        last.id,
        secret=secret,
        owner_user_id=owner_user_id,
        surface=surface,
        scope=scope,
    )

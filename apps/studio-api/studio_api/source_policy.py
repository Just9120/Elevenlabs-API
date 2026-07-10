from __future__ import annotations

SUPPORTED_SOURCE_MIME_PREFIXES = ("audio/", "video/")
SUPPORTED_SOURCE_MIME_TYPES = {"application/ogg"}


def normalize_source_mime_type(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    return normalized or None


def is_supported_source_mime_type(value: str | None) -> bool:
    normalized = normalize_source_mime_type(value)
    if not normalized:
        return False
    return normalized.startswith(SUPPORTED_SOURCE_MIME_PREFIXES) or normalized in SUPPORTED_SOURCE_MIME_TYPES


def validate_source_size(size_bytes: int | None, max_bytes: int) -> bool:
    if size_bytes is None:
        return True
    return 0 <= size_bytes <= max_bytes

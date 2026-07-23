from __future__ import annotations

from typing import Any, Sequence


def build_batch_preflight_payload(
    *,
    sources: Sequence[Any],
    output_folders: Sequence[Any],
    titles: Sequence[str | None],
    language_mode: str,
    diarization_enabled: bool,
) -> dict[str, Any]:
    """Build a browser-safe, non-authoritative preview of a validated batch."""
    if not (len(sources) == len(output_folders) == len(titles)):
        raise ValueError("Preflight inputs must have equal lengths")

    items = []
    for position, (source, folder, title) in enumerate(
        zip(sources, output_folders, titles, strict=True)
    ):
        source_type = getattr(source, "source_type", None)
        if hasattr(source_type, "value"):
            source_type = source_type.value
        if source_type not in {"local_upload", "google_drive"}:
            source_type = "unknown"
        size_bytes = getattr(source, "size_bytes", None)
        items.append(
            {
                "position": position,
                "title": _optional_text(title, 160),
                "source": {
                    "name": _optional_text(
                        getattr(source, "original_filename", None), 255
                    )
                    or "Источник",
                    "source_type": source_type,
                    "mime_type": _optional_text(getattr(source, "mime_type", None), 255),
                    "size_bytes": size_bytes
                    if isinstance(size_bytes, int)
                    and not isinstance(size_bytes, bool)
                    and size_bytes >= 0
                    else None,
                    # Duration is established by the media-preparation probe. The
                    # current Source authority does not persist it before a job.
                    "duration_seconds": None,
                },
                "output_destination": {
                    "name": _optional_text(getattr(folder, "name", None), 512)
                    or "Папка Google Drive",
                },
                "existing_result_match": {"status": "not_evaluated"},
                "planned_outcome": "process",
            }
        )

    return {
        "provider": "elevenlabs",
        "model": "scribe_v2",
        "language_mode": language_mode,
        "diarization_enabled": bool(diarization_enabled),
        "existing_result_authority": {
            "status": "not_available",
            "reason_code": "catalog_authority_not_available",
        },
        "items": items,
        "summary": {
            "process_count": len(items),
            "skip_count": 0,
            "blocked_count": 0,
        },
        "confirmation_required": True,
    }


def _optional_text(value: object, max_length: int) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    return cleaned[:max_length] or None

from __future__ import annotations

from typing import Any, Sequence

from .transcript_catalog import (
    CURRENT_TRANSCRIPTION_MODEL,
    CURRENT_TRANSCRIPTION_PROVIDER,
    ExistingResultMatch,
    ExistingResultMatchStatus,
    ProviderAttemptAuthorityStatus,
)


def build_batch_preflight_payload(
    *,
    sources: Sequence[Any],
    output_folders: Sequence[Any],
    titles: Sequence[str | None],
    language_mode: str,
    diarization_enabled: bool,
    existing_result_matches: dict[str, ExistingResultMatch],
    reprocess_existing: Sequence[bool],
    provider_attempt_authorities: dict[
        str, ProviderAttemptAuthorityStatus
    ],
) -> dict[str, Any]:
    """Build a browser-safe preview from validated targets and catalog evidence."""
    if not (
        len(sources)
        == len(output_folders)
        == len(titles)
        == len(reprocess_existing)
    ):
        raise ValueError("Preflight inputs must have equal lengths")

    items = []
    for position, (source, folder, title, explicit_reprocess) in enumerate(
        zip(
            sources,
            output_folders,
            titles,
            reprocess_existing,
            strict=True,
        )
    ):
        source_id = getattr(source, "id", None)
        match = existing_result_matches.get(source_id)
        if match is None:
            raise ValueError("Preflight catalog decision is missing")
        provider_attempt_authority = provider_attempt_authorities.get(source_id)
        if provider_attempt_authority is None:
            raise ValueError("Preflight provider-attempt authority is missing")
        existing_result_conflict = (
            match.status != ExistingResultMatchStatus.no_match
        )
        resolution = (
            "reprocess"
            if existing_result_conflict and explicit_reprocess
            else "required"
            if existing_result_conflict
            else "not_required"
        )
        provider_attempt_conflict = (
            provider_attempt_authority
            != ProviderAttemptAuthorityStatus.available
        )
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
                "existing_result_match": {
                    "status": match.status.value,
                    "accepted_output_count": match.accepted_output_count,
                    "resolution": resolution,
                },
                "provider_attempt_authority": _provider_attempt_authority_payload(
                    provider_attempt_authority
                ),
                "planned_outcome": (
                    "blocked"
                    if provider_attempt_conflict
                    or (existing_result_conflict and not explicit_reprocess)
                    else "process"
                ),
            }
        )

    process_count = sum(
        item["planned_outcome"] == "process" for item in items
    )
    blocked_count = sum(
        item["planned_outcome"] == "blocked" for item in items
    )
    return {
        "provider": CURRENT_TRANSCRIPTION_PROVIDER,
        "model": CURRENT_TRANSCRIPTION_MODEL,
        "language_mode": language_mode,
        "diarization_enabled": bool(diarization_enabled),
        "existing_result_authority": {
            "status": "partial",
            "reason_code": "unlinked_catalog_entries_excluded",
        },
        "items": items,
        "summary": {
            "process_count": process_count,
            "skip_count": 0,
            "blocked_count": blocked_count,
        },
        "confirmation_required": True,
    }


def _optional_text(value: object, max_length: int) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    return cleaned[:max_length] or None


def _provider_attempt_authority_payload(
    status: ProviderAttemptAuthorityStatus,
) -> dict[str, str | None]:
    if status == ProviderAttemptAuthorityStatus.available:
        return {"status": "available", "reason_code": None}
    if status == ProviderAttemptAuthorityStatus.in_flight:
        return {
            "status": "blocked",
            "reason_code": "equivalent_provider_work_in_flight",
        }
    if status == ProviderAttemptAuthorityStatus.unresolved:
        return {
            "status": "blocked",
            "reason_code": "equivalent_provider_outcome_unresolved",
        }
    raise ValueError("Unsupported provider-attempt authority")

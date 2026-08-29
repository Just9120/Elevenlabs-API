from __future__ import annotations

from dataclasses import replace
from enum import Enum
from typing import Callable, Iterable, Mapping

from .source_creation import parse_authoritative_source_created_at
from .source_creation_authority import (
    SourceCreationAuthorityStatus,
    format_source_created_at,
)
from .transcript_catalog_migration import (
    CatalogMigrationOperation,
    TranscriptStandardizationAction,
    TranscriptStandardizationCandidate,
    build_transcript_standardization_payload,
    classify_transcript_standardization_candidate,
)
from .transcript_catalog_standardize import (
    CatalogGoogleWriteError,
    CatalogGoogleWriteReason,
    GoogleTranscriptCatalogStandardizer,
    standardize_transcript_document_in_place,
)


class TranscriptStandardizationApplyOutcome(str, Enum):
    standardized = "standardized"
    already_current = "already_current"
    blocked = "blocked"


class TranscriptStandardizationApplyBlockReason(str, Enum):
    source_creation_time_unavailable = "source_creation_time_unavailable"
    source_creation_time_conflict = "source_creation_time_conflict"
    document_unavailable = "catalog_document_unavailable"
    write_rejected = "catalog_document_write_rejected"
    revision_changed = "catalog_document_revision_changed"
    multiple_tabs = "catalog_document_multiple_tabs"
    unsupported_content = "catalog_document_content_unsupported"
    classification_changed = "catalog_document_classification_changed"
    empty_transcript = "catalog_document_empty"
    limit_exceeded = "catalog_document_limit_exceeded"
    response_invalid = "catalog_document_response_invalid"


PER_DOCUMENT_WRITE_BLOCK_REASONS = {
    CatalogGoogleWriteReason.request_rejected: (
        TranscriptStandardizationApplyBlockReason.write_rejected
    ),
    CatalogGoogleWriteReason.malformed_response: (
        TranscriptStandardizationApplyBlockReason.response_invalid
    ),
    CatalogGoogleWriteReason.document_not_found: (
        TranscriptStandardizationApplyBlockReason.document_unavailable
    ),
    CatalogGoogleWriteReason.revision_conflict_or_rejected: (
        TranscriptStandardizationApplyBlockReason.revision_changed
    ),
    CatalogGoogleWriteReason.multiple_tabs: (
        TranscriptStandardizationApplyBlockReason.multiple_tabs
    ),
    CatalogGoogleWriteReason.unsupported_content: (
        TranscriptStandardizationApplyBlockReason.unsupported_content
    ),
    CatalogGoogleWriteReason.classification_changed: (
        TranscriptStandardizationApplyBlockReason.classification_changed
    ),
    CatalogGoogleWriteReason.empty_transcript: (
        TranscriptStandardizationApplyBlockReason.empty_transcript
    ),
    CatalogGoogleWriteReason.limit_exceeded: (
        TranscriptStandardizationApplyBlockReason.limit_exceeded
    ),
}


def execute_transcript_standardization_apply(
    *,
    access_token: str,
    candidates: Iterable[TranscriptStandardizationCandidate],
    source_created_at_by_document_id: Mapping[str, str] | None = None,
    standardizer: GoogleTranscriptCatalogStandardizer | None = None,
    progress: Callable[[str, int, int | None], None] | None = None,
) -> dict:
    """Standardize only eligible selected Docs, without catalog access."""

    token = _private_value(access_token, label="access token")
    candidate_rows = _normalize_standardization_candidates(candidates)
    document_ids = {
        candidate.drive_document_id for candidate in candidate_rows
    }
    source_created_times = _normalize_created_times(
        (
            source_created_at_by_document_id
            if source_created_at_by_document_id is not None
            else {}
        ),
        allowed_document_ids=document_ids,
    )
    _validate_source_creation_coverage(
        candidate_rows,
        source_created_times,
    )
    plan = build_transcript_standardization_payload(
        operation=CatalogMigrationOperation.apply,
        candidates=candidate_rows,
    )
    decisions = tuple(
        classify_transcript_standardization_candidate(candidate)
        for candidate in candidate_rows
    )
    transport = standardizer or GoogleTranscriptCatalogStandardizer()

    outcomes = []
    items = []
    for position, (candidate, decision, plan_item) in enumerate(zip(
        candidate_rows,
        decisions,
        plan["items"],
        strict=True,
    ), start=1):
        if decision.action == TranscriptStandardizationAction.blocked:
            outcome = TranscriptStandardizationApplyOutcome.blocked
            reason = decision.reason
        elif decision.action == TranscriptStandardizationAction.unchanged:
            outcome = TranscriptStandardizationApplyOutcome.already_current
            reason = None
        elif (
            decision.action
            == TranscriptStandardizationAction.standardize_document
        ):
            try:
                result = standardize_transcript_document_in_place(
                    access_token=token,
                    document_id=candidate.drive_document_id,
                    document_name=candidate.name,
                    expected_status=candidate.standard_status,
                    created_time=source_created_times.get(
                        candidate.drive_document_id
                    ),
                    standardizer=transport,
                )
            except CatalogGoogleWriteError as exc:
                reason = PER_DOCUMENT_WRITE_BLOCK_REASONS.get(exc.reason)
                if reason is None:
                    raise
                outcome = TranscriptStandardizationApplyOutcome.blocked
            else:
                outcome = (
                    TranscriptStandardizationApplyOutcome.standardized
                    if result.changed
                    else (
                        TranscriptStandardizationApplyOutcome.already_current
                    )
                )
                reason = None
        else:
            raise RuntimeError("Transcript standardization plan is invalid")
        outcomes.append(outcome)
        items.append(
            {
                "position": plan_item["position"],
                "name": decision.name,
                "source_creation_status": (
                    candidate.source_creation_status.value
                ),
                "action": decision.action.value,
                "outcome": outcome.value,
                "reason_code": reason.value if reason else None,
            }
        )
        if progress is not None:
            progress("applying", position, len(candidate_rows))

    return {
        "workflow": plan["workflow"],
        "operation": plan["operation"],
        "target_standard": plan["target_standard"],
        "items": items,
        "summary": {
            f"{outcome.value}_count": outcomes.count(outcome)
            for outcome in TranscriptStandardizationApplyOutcome
        },
    }


def _normalize_standardization_candidates(
    candidates: Iterable[TranscriptStandardizationCandidate],
) -> tuple[TranscriptStandardizationCandidate, ...]:
    rows = tuple(candidates)
    if any(
        not isinstance(candidate, TranscriptStandardizationCandidate)
        for candidate in rows
    ):
        raise ValueError("Transcript standardization candidate is required")
    normalized = tuple(
        replace(
            candidate,
            drive_document_id=_private_value(
                candidate.drive_document_id,
                label="document identity",
                maximum=256,
            ),
        )
        for candidate in rows
    )
    document_ids = tuple(
        candidate.drive_document_id for candidate in normalized
    )
    if len(document_ids) != len(set(document_ids)):
        raise ValueError(
            "Transcript standardization candidates must be unique"
        )
    return normalized


def _normalize_created_times(
    values: Mapping[str, str],
    *,
    allowed_document_ids: set[str],
) -> dict[str, str]:
    if not isinstance(values, Mapping):
        raise ValueError(
            "Transcript standardization created times must be a mapping"
        )
    normalized = {}
    for raw_document_id, created_time in values.items():
        document_id = _private_value(
            raw_document_id,
            label="document identity",
            maximum=256,
        )
        if document_id in normalized:
            raise ValueError(
                "Transcript standardization created times must be unique"
            )
        if document_id not in allowed_document_ids:
            raise ValueError(
                "Transcript standardization created time is out of scope"
            )
        if not isinstance(created_time, str):
            raise ValueError(
                "Transcript standardization created time is invalid"
            )
        parsed = parse_authoritative_source_created_at(created_time)
        if parsed is None:
            raise ValueError(
                "Transcript standardization created time is invalid"
            )
        normalized[document_id] = format_source_created_at(parsed)
    return normalized


def _validate_source_creation_coverage(
    candidates: tuple[TranscriptStandardizationCandidate, ...],
    source_created_times: Mapping[str, str],
) -> None:
    authoritative_ids = {
        candidate.drive_document_id
        for candidate in candidates
        if candidate.source_creation_status
        == SourceCreationAuthorityStatus.authoritative
    }
    if set(source_created_times) != authoritative_ids:
        raise ValueError(
            "Transcript standardization source creation coverage is invalid"
        )


def _private_value(
    value: object,
    *,
    label: str,
    maximum: int | None = None,
) -> str:
    cleaned = value.strip() if isinstance(value, str) else ""
    if not cleaned or (maximum is not None and len(cleaned) > maximum):
        raise ValueError(f"Transcript standardization {label} is invalid")
    return cleaned

from __future__ import annotations

from dataclasses import replace
from enum import Enum
from typing import Iterable, Mapping

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
    created_time_by_document_id: Mapping[str, str | None] | None = None,
    standardizer: GoogleTranscriptCatalogStandardizer | None = None,
) -> dict:
    """Standardize only eligible selected Docs, without catalog access."""

    token = _private_value(access_token, label="access token")
    candidate_rows = _normalize_standardization_candidates(candidates)
    document_ids = {
        candidate.drive_document_id for candidate in candidate_rows
    }
    created_times = _normalize_created_times(
        (
            created_time_by_document_id
            if created_time_by_document_id is not None
            else {}
        ),
        allowed_document_ids=document_ids,
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
    for candidate, decision, plan_item in zip(
        candidate_rows,
        decisions,
        plan["items"],
        strict=True,
    ):
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
                    created_time=created_times.get(
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
                "action": decision.action.value,
                "outcome": outcome.value,
                "reason_code": reason.value if reason else None,
            }
        )

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
    values: Mapping[str, str | None],
    *,
    allowed_document_ids: set[str],
) -> dict[str, str | None]:
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
        if created_time is not None and not isinstance(created_time, str):
            raise ValueError(
                "Transcript standardization created time is invalid"
            )
        normalized[document_id] = created_time
    return normalized


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

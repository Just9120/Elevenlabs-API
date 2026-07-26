from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Iterable, Mapping

from .transcript_catalog_apply import (
    CatalogApplyMetadata,
    CatalogMetadataApplyOutcome,
    apply_catalog_migration_metadata,
)
from .transcript_catalog_migration import (
    CatalogMigrationAction,
    CatalogMigrationCandidate,
    CatalogMigrationOperation,
    build_catalog_migration_payload,
    classify_catalog_migration_candidate,
)
from .transcript_catalog_standardize import (
    GoogleTranscriptCatalogStandardizer,
    standardize_transcript_document_in_place,
)


class CatalogStandardizationApplyOutcome(str, Enum):
    not_required = "not_required"
    changed = "changed"
    already_current = "already_current"
    blocked = "blocked"


def execute_catalog_migration_apply(
    db: Any,
    *,
    owner_user_id: str,
    access_token: str,
    candidates: Iterable[CatalogMigrationCandidate],
    metadata_by_document_id: Mapping[str, CatalogApplyMetadata] | None = None,
    created_time_by_document_id: Mapping[str, str | None] | None = None,
    applied_at: datetime | None = None,
    standardizer: GoogleTranscriptCatalogStandardizer | None = None,
) -> dict:
    """Converge one explicit apply without storing document body text.

    Standardization candidates receive a non-mutating metadata preflight first.
    Google writes then finish before the final catalog import. If the final
    database phase fails, a retry observes the already-current Google Doc and
    completes the idempotent import without a second document rewrite.
    """

    _private_value(access_token, label="access token")
    candidate_rows = _normalize_candidates(candidates)
    document_ids = {
        candidate.drive_document_id for candidate in candidate_rows
    }
    private_metadata = _normalize_metadata(
        (
            metadata_by_document_id
            if metadata_by_document_id is not None
            else {}
        ),
        allowed_document_ids=document_ids,
    )
    created_times = _normalize_created_times(
        (
            created_time_by_document_id
            if created_time_by_document_id is not None
            else {}
        ),
        allowed_document_ids=document_ids,
    )
    timestamp = applied_at or datetime.now(timezone.utc)
    if (
        not isinstance(timestamp, datetime)
        or timestamp.tzinfo is None
        or timestamp.utcoffset() is None
    ):
        raise ValueError("Catalog apply timestamp must be timezone-aware")

    plan = build_catalog_migration_payload(
        operation=CatalogMigrationOperation.apply,
        candidates=candidate_rows,
    )
    decisions = tuple(
        classify_catalog_migration_candidate(candidate)
        for candidate in candidate_rows
    )
    standardization_rows = tuple(
        candidate
        for candidate, decision in zip(
            candidate_rows,
            decisions,
            strict=True,
        )
        if decision.action
        in {
            CatalogMigrationAction.standardize_and_import,
            CatalogMigrationAction.standardize_document,
        }
    )
    standardization_outcomes = {
        candidate.drive_document_id: (
            CatalogStandardizationApplyOutcome.not_required
        )
        for candidate in candidate_rows
    }
    refreshed_by_document_id = {
        candidate.drive_document_id: candidate
        for candidate in candidate_rows
    }

    if standardization_rows:
        preflight = apply_catalog_migration_metadata(
            db,
            owner_user_id=owner_user_id,
            candidates=standardization_rows,
            metadata_by_document_id={
                candidate.drive_document_id: private_metadata[
                    candidate.drive_document_id
                ]
                for candidate in standardization_rows
                if candidate.drive_document_id in private_metadata
            },
            applied_at=timestamp,
        )
        preflight_items = _validated_items(
            preflight,
            expected_count=len(standardization_rows),
        )
        transport = standardizer or GoogleTranscriptCatalogStandardizer()
        for candidate, item in zip(
            standardization_rows,
            preflight_items,
            strict=True,
        ):
            document_id = candidate.drive_document_id
            outcome = _metadata_outcome(item)
            if outcome == CatalogMetadataApplyOutcome.conflict:
                standardization_outcomes[document_id] = (
                    CatalogStandardizationApplyOutcome.blocked
                )
                continue
            if (
                outcome
                != CatalogMetadataApplyOutcome.standardization_required
            ):
                raise RuntimeError(
                    "Catalog standardization preflight contract changed"
                )
            standardized = standardize_transcript_document_in_place(
                access_token=access_token,
                document_id=document_id,
                document_name=candidate.name,
                expected_status=candidate.standard_status,
                created_time=created_times.get(document_id),
                standardizer=transport,
            )
            standardization_outcomes[document_id] = (
                CatalogStandardizationApplyOutcome.changed
                if standardized.changed
                else CatalogStandardizationApplyOutcome.already_current
            )
            refreshed_by_document_id[document_id] = replace(
                candidate,
                standard_status=standardized.status,
            )

    refreshed_rows = tuple(
        refreshed_by_document_id[candidate.drive_document_id]
        for candidate in candidate_rows
    )
    applied = apply_catalog_migration_metadata(
        db,
        owner_user_id=owner_user_id,
        candidates=refreshed_rows,
        metadata_by_document_id=private_metadata,
        applied_at=timestamp,
    )
    applied_items = _validated_items(
        applied,
        expected_count=len(candidate_rows),
    )

    items = []
    for plan_item, applied_item, candidate in zip(
        plan["items"],
        applied_items,
        candidate_rows,
        strict=True,
    ):
        outcome = _metadata_outcome(applied_item)
        if outcome == CatalogMetadataApplyOutcome.standardization_required:
            raise RuntimeError("Catalog apply did not converge")
        items.append(
            {
                "position": plan_item["position"],
                "name": applied_item["name"],
                "action": plan_item["action"],
                "outcome": outcome.value,
                "reason_code": applied_item["reason_code"],
                "standardization_outcome": (
                    standardization_outcomes[
                        candidate.drive_document_id
                    ].value
                ),
            }
        )

    summary = dict(applied["summary"])
    summary.update(
        {
            "document_standardized_count": _count_standardization_outcome(
                standardization_outcomes,
                CatalogStandardizationApplyOutcome.changed,
            ),
            "document_already_current_count": (
                _count_standardization_outcome(
                    standardization_outcomes,
                    CatalogStandardizationApplyOutcome.already_current,
                )
            ),
            "document_standardization_blocked_count": (
                _count_standardization_outcome(
                    standardization_outcomes,
                    CatalogStandardizationApplyOutcome.blocked,
                )
            ),
        }
    )
    return {
        "operation": applied["operation"],
        "target_standard": applied["target_standard"],
        "items": items,
        "summary": summary,
    }


def _normalize_candidates(
    candidates: Iterable[CatalogMigrationCandidate],
) -> tuple[CatalogMigrationCandidate, ...]:
    rows = tuple(candidates)
    if any(
        not isinstance(candidate, CatalogMigrationCandidate)
        for candidate in rows
    ):
        raise ValueError("Catalog migration candidate is required")
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
        raise ValueError("Catalog migration candidates must be unique")
    return normalized


def _normalize_metadata(
    metadata_by_document_id: Mapping[str, CatalogApplyMetadata],
    *,
    allowed_document_ids: set[str],
) -> dict[str, CatalogApplyMetadata]:
    if not isinstance(metadata_by_document_id, Mapping):
        raise ValueError("Catalog apply metadata must be a mapping")
    normalized = {}
    for raw_document_id, metadata in metadata_by_document_id.items():
        document_id = _private_value(
            raw_document_id,
            label="document identity",
            maximum=256,
        )
        if document_id in normalized:
            raise ValueError("Catalog apply metadata identities must be unique")
        if document_id not in allowed_document_ids:
            raise ValueError("Catalog apply metadata is out of scope")
        if not isinstance(metadata, CatalogApplyMetadata):
            raise ValueError("Catalog apply metadata is invalid")
        normalized[document_id] = metadata
    return normalized


def _normalize_created_times(
    created_time_by_document_id: Mapping[str, str | None],
    *,
    allowed_document_ids: set[str],
) -> dict[str, str | None]:
    if not isinstance(created_time_by_document_id, Mapping):
        raise ValueError("Catalog created times must be a mapping")
    normalized = {}
    for raw_document_id, created_time in (
        created_time_by_document_id.items()
    ):
        document_id = _private_value(
            raw_document_id,
            label="document identity",
            maximum=256,
        )
        if document_id in normalized:
            raise ValueError("Catalog created time identities must be unique")
        if document_id not in allowed_document_ids:
            raise ValueError("Catalog created time is out of scope")
        if created_time is not None and not isinstance(created_time, str):
            raise ValueError("Catalog created time is invalid")
        normalized[document_id] = created_time
    return normalized


def _validated_items(
    payload: Mapping[str, Any],
    *,
    expected_count: int,
) -> tuple[Mapping[str, Any], ...]:
    raw_items = payload.get("items") if isinstance(payload, Mapping) else None
    if (
        not isinstance(raw_items, list)
        or len(raw_items) != expected_count
        or any(not isinstance(item, Mapping) for item in raw_items)
    ):
        raise RuntimeError("Catalog metadata apply contract changed")
    return tuple(raw_items)


def _metadata_outcome(
    item: Mapping[str, Any],
) -> CatalogMetadataApplyOutcome:
    try:
        return CatalogMetadataApplyOutcome(item.get("outcome"))
    except (TypeError, ValueError) as exc:
        raise RuntimeError(
            "Catalog metadata apply outcome contract changed"
        ) from exc


def _count_standardization_outcome(
    outcomes: Mapping[str, CatalogStandardizationApplyOutcome],
    expected: CatalogStandardizationApplyOutcome,
) -> int:
    return sum(outcome == expected for outcome in outcomes.values())


def _private_value(
    value: object,
    *,
    label: str,
    maximum: int | None = None,
) -> str:
    cleaned = value.strip() if isinstance(value, str) else ""
    if not cleaned or (maximum is not None and len(cleaned) > maximum):
        raise ValueError(f"Catalog {label} is invalid")
    return cleaned

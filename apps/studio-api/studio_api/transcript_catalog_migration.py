from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Iterable

from .transcript_catalog import CURRENT_TRANSCRIPT_STANDARD


class CatalogMigrationOperation(str, Enum):
    dry_run = "dry_run"
    apply = "apply"


class CatalogDocumentStandardStatus(str, Enum):
    current = "current"
    outdated = "outdated"
    unstructured = "unstructured"
    unreadable = "unreadable"


class CatalogImportAuthorityStatus(str, Enum):
    not_imported = "not_imported"
    imported_exact = "imported_exact"
    conflict = "conflict"


class CatalogSettingsAuthorityStatus(str, Enum):
    exact = "exact"
    indeterminate = "indeterminate"


class CatalogMigrationAction(str, Enum):
    import_metadata = "import_metadata"
    standardize_and_import = "standardize_and_import"
    standardize_document = "standardize_document"
    unchanged = "unchanged"
    blocked = "blocked"


class CatalogMigrationBlockReason(str, Enum):
    catalog_conflict = "catalog_conflict"
    document_unreadable = "document_unreadable"


@dataclass(frozen=True)
class CatalogMigrationCandidate:
    """Private server-side evidence for one approved Google document."""

    drive_document_id: str = field(repr=False)
    name: str | None
    standard_status: CatalogDocumentStandardStatus
    import_status: CatalogImportAuthorityStatus
    settings_status: CatalogSettingsAuthorityStatus


@dataclass(frozen=True)
class CatalogMigrationDecision:
    name: str
    standard_status: CatalogDocumentStandardStatus
    import_status: CatalogImportAuthorityStatus
    settings_status: CatalogSettingsAuthorityStatus
    action: CatalogMigrationAction
    reason: CatalogMigrationBlockReason | None = None


def classify_catalog_migration_candidate(
    candidate: CatalogMigrationCandidate,
) -> CatalogMigrationDecision:
    if not isinstance(candidate, CatalogMigrationCandidate):
        raise ValueError("Catalog migration candidate is required")
    document_id = _private_document_id(candidate.drive_document_id)
    _require_enum(candidate.standard_status, CatalogDocumentStandardStatus)
    _require_enum(candidate.import_status, CatalogImportAuthorityStatus)
    _require_enum(candidate.settings_status, CatalogSettingsAuthorityStatus)

    if candidate.import_status == CatalogImportAuthorityStatus.conflict:
        action = CatalogMigrationAction.blocked
        reason = CatalogMigrationBlockReason.catalog_conflict
    elif candidate.standard_status == CatalogDocumentStandardStatus.unreadable:
        action = CatalogMigrationAction.blocked
        reason = CatalogMigrationBlockReason.document_unreadable
    elif candidate.standard_status in {
        CatalogDocumentStandardStatus.outdated,
        CatalogDocumentStandardStatus.unstructured,
    }:
        if candidate.import_status == CatalogImportAuthorityStatus.not_imported:
            action = CatalogMigrationAction.standardize_and_import
        else:
            action = CatalogMigrationAction.standardize_document
        reason = None
    elif candidate.import_status == CatalogImportAuthorityStatus.not_imported:
        action = CatalogMigrationAction.import_metadata
        reason = None
    else:
        action = CatalogMigrationAction.unchanged
        reason = None

    return CatalogMigrationDecision(
        name=_safe_name(candidate.name, private_document_id=document_id),
        standard_status=candidate.standard_status,
        import_status=candidate.import_status,
        settings_status=candidate.settings_status,
        action=action,
        reason=reason,
    )


def build_catalog_migration_payload(
    *,
    operation: CatalogMigrationOperation,
    candidates: Iterable[CatalogMigrationCandidate],
) -> dict:
    """Build a deterministic browser-safe migration plan.

    The same allowlisted shape is used to preview a dry-run or the work selected
    for an explicit apply. Execution results are a later service boundary; this
    function never reads Google content, mutates Drive, or persists catalog rows.
    """

    _require_enum(operation, CatalogMigrationOperation)
    candidate_rows = tuple(candidates)
    document_ids = [_private_document_id(row.drive_document_id) for row in candidate_rows]
    if len(document_ids) != len(set(document_ids)):
        raise ValueError("Catalog migration candidates must be unique")

    decisions = tuple(classify_catalog_migration_candidate(row) for row in candidate_rows)
    items = [
        {
            "position": position,
            "name": decision.name,
            "standard_status": decision.standard_status.value,
            "import_status": decision.import_status.value,
            "settings_status": decision.settings_status.value,
            "action": decision.action.value,
            "reason_code": decision.reason.value if decision.reason else None,
        }
        for position, decision in enumerate(decisions)
    ]
    return {
        "operation": operation.value,
        "target_standard": CURRENT_TRANSCRIPT_STANDARD,
        "items": items,
        "summary": {
            "import_metadata_count": _count_action(
                decisions, CatalogMigrationAction.import_metadata
            ),
            "standardize_and_import_count": _count_action(
                decisions, CatalogMigrationAction.standardize_and_import
            ),
            "standardize_document_count": _count_action(
                decisions, CatalogMigrationAction.standardize_document
            ),
            "unchanged_count": _count_action(
                decisions, CatalogMigrationAction.unchanged
            ),
            "blocked_count": _count_action(decisions, CatalogMigrationAction.blocked),
        },
    }


def _count_action(
    decisions: Iterable[CatalogMigrationDecision],
    action: CatalogMigrationAction,
) -> int:
    return sum(decision.action == action for decision in decisions)


def _private_document_id(value: object) -> str:
    cleaned = value.strip() if isinstance(value, str) else ""
    if not cleaned:
        raise ValueError("Catalog migration document identity is required")
    return cleaned


def _safe_name(value: object, *, private_document_id: str) -> str:
    cleaned = value.strip() if isinstance(value, str) else ""
    lowered = cleaned.lower()
    if (
        private_document_id in cleaned
        or lowered.startswith(("http://", "https://"))
        or "drive.google.com/" in lowered
        or "docs.google.com/" in lowered
    ):
        cleaned = ""
    return cleaned[:240] or "Документ Google Docs"


def _require_enum(value: object, enum_type: type[Enum]) -> None:
    if not isinstance(value, enum_type):
        raise ValueError(f"Catalog migration {enum_type.__name__} is invalid")

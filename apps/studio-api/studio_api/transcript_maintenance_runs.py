from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Callable

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .audit import audit
from .google_connection_access import (
    GoogleConnectionAccessError,
    GoogleConnectionAccessReason,
    refresh_user_google_maintenance_access_token,
)
from .models import (
    TranscriptMaintenanceRun,
    TranscriptMaintenanceRunStatus,
    User,
)
from .security import utcnow
from .transcript_catalog_apply import apply_transcript_catalog_import_metadata
from .transcript_catalog_scan import CatalogGoogleReadError, CatalogGoogleReadReason
from .transcript_catalog_standardize import CatalogGoogleWriteError, CatalogGoogleWriteReason
from .transcript_document_selection import (
    TranscriptDocumentSelectionError,
    TranscriptDocumentSelectionReason,
)
from .transcript_maintenance_apply import execute_transcript_standardization_apply
from .transcript_maintenance_dry_run import (
    TranscriptMaintenanceSelectionMode,
    build_transcript_catalog_import_dry_run,
    build_transcript_standardization_dry_run,
    inspect_transcript_catalog_import_selection,
    inspect_transcript_standardization_selection,
)


IDEMPOTENCY_KEY_PATTERN = re.compile(r"^[A-Za-z0-9_-]{16,64}$")
MAX_RUN_ATTEMPTS = 3


class TranscriptMaintenanceWorkflow(str, Enum):
    standardization = "standardization"
    catalog_import = "catalog_import"


class TranscriptMaintenanceOperation(str, Enum):
    dry_run = "dry_run"
    apply = "apply"


class TranscriptMaintenanceRunReason(str, Enum):
    active_run_exists = "transcript_maintenance_run_in_progress"
    idempotency_conflict = "transcript_maintenance_idempotency_conflict"
    preview_invalid = "transcript_maintenance_preview_invalid"
    run_not_found = "transcript_maintenance_run_not_found"
    lease_not_owned = "transcript_maintenance_lease_not_owned"


class TranscriptMaintenanceRunError(RuntimeError):
    def __init__(self, reason: TranscriptMaintenanceRunReason):
        self.reason = reason
        super().__init__(reason.value)


@dataclass(frozen=True)
class TranscriptMaintenanceProcessedRun:
    run_id: str
    workflow: str
    operation: str
    status: str


def create_transcript_maintenance_run(
    db: Session,
    *,
    owner_user_id: str,
    workflow: TranscriptMaintenanceWorkflow,
    operation: TranscriptMaintenanceOperation,
    selection_mode: TranscriptMaintenanceSelectionMode,
    folder_id: str | None,
    document_id: str | None,
    target_name: str,
    idempotency_key: str,
    preview_run_id: str | None = None,
    now: datetime | None = None,
) -> TranscriptMaintenanceRun:
    owner_id = _identity(owner_user_id, maximum=36)
    key = _idempotency_key(idempotency_key)
    timestamp = now or utcnow()
    db.execute(select(User).where(User.id == owner_id).with_for_update()).scalar_one()
    existing = db.execute(
        select(TranscriptMaintenanceRun).where(
            TranscriptMaintenanceRun.owner_user_id == owner_id,
            TranscriptMaintenanceRun.idempotency_key == key,
        )
    ).scalar_one_or_none()
    requested = {
        "workflow": _workflow(workflow).value,
        "operation": _operation(operation).value,
        "selection_mode": _selection_mode(selection_mode).value,
        "folder_id": folder_id,
        "document_id": document_id,
        "preview_run_id": preview_run_id,
    }
    if existing is not None:
        persisted = {name: getattr(existing, name) for name in requested}
        if persisted != requested:
            raise TranscriptMaintenanceRunError(
                TranscriptMaintenanceRunReason.idempotency_conflict
            )
        return existing

    active = db.execute(
        select(TranscriptMaintenanceRun.id).where(
            TranscriptMaintenanceRun.owner_user_id == owner_id,
            TranscriptMaintenanceRun.workflow == requested["workflow"],
            TranscriptMaintenanceRun.status.in_(
                (
                    TranscriptMaintenanceRunStatus.queued,
                    TranscriptMaintenanceRunStatus.running,
                )
            ),
        )
    ).first()
    if active is not None:
        raise TranscriptMaintenanceRunError(
            TranscriptMaintenanceRunReason.active_run_exists
        )

    private_folder_id, private_document_id = _target(
        requested["selection_mode"],
        folder_id,
        document_id,
    )
    preview_id = None
    if requested["operation"] == TranscriptMaintenanceOperation.apply.value:
        preview_id = _preview_authority(
            db,
            owner_user_id=owner_id,
            workflow=requested["workflow"],
            selection_mode=requested["selection_mode"],
            folder_id=private_folder_id,
            document_id=private_document_id,
            preview_run_id=preview_run_id,
        ).id
    elif preview_run_id is not None:
        raise TranscriptMaintenanceRunError(
            TranscriptMaintenanceRunReason.preview_invalid
        )

    run = TranscriptMaintenanceRun(
        owner_user_id=owner_id,
        workflow=requested["workflow"],
        operation=requested["operation"],
        selection_mode=requested["selection_mode"],
        folder_id=private_folder_id,
        document_id=private_document_id,
        target_name=_target_name(target_name),
        preview_run_id=preview_id,
        idempotency_key=key,
        status=TranscriptMaintenanceRunStatus.queued,
        current_stage="queued",
        created_at=timestamp,
        updated_at=timestamp,
    )
    db.add(run)
    audit(
        db,
        "transcript_maintenance.queued",
        actor_user_id=owner_id,
        subject_user_id=owner_id,
    )
    db.commit()
    db.refresh(run)
    return run


def create_transcript_maintenance_apply_run(
    db: Session,
    *,
    owner_user_id: str,
    workflow: TranscriptMaintenanceWorkflow,
    preview_run_id: str,
    idempotency_key: str,
    now: datetime | None = None,
) -> TranscriptMaintenanceRun:
    preview = owned_transcript_maintenance_run(
        db,
        owner_user_id=owner_user_id,
        run_id=preview_run_id,
    )
    return create_transcript_maintenance_run(
        db,
        owner_user_id=owner_user_id,
        workflow=workflow,
        operation=TranscriptMaintenanceOperation.apply,
        selection_mode=TranscriptMaintenanceSelectionMode(
            preview.selection_mode
        ),
        folder_id=preview.folder_id,
        document_id=preview.document_id,
        target_name=preview.target_name,
        idempotency_key=idempotency_key,
        preview_run_id=preview.id,
        now=now,
    )


def latest_transcript_maintenance_run(
    db: Session,
    *,
    owner_user_id: str,
    workflow: TranscriptMaintenanceWorkflow,
) -> TranscriptMaintenanceRun | None:
    return db.execute(
        select(TranscriptMaintenanceRun)
        .where(
            TranscriptMaintenanceRun.owner_user_id == _identity(owner_user_id, maximum=36),
            TranscriptMaintenanceRun.workflow == _workflow(workflow).value,
        )
        .order_by(
            TranscriptMaintenanceRun.created_at.desc(),
            TranscriptMaintenanceRun.id.desc(),
        )
        .limit(1)
    ).scalar_one_or_none()


def owned_transcript_maintenance_run(
    db: Session,
    *,
    owner_user_id: str,
    run_id: str,
) -> TranscriptMaintenanceRun:
    run = db.execute(
        select(TranscriptMaintenanceRun).where(
            TranscriptMaintenanceRun.id == _run_id(run_id),
            TranscriptMaintenanceRun.owner_user_id == _identity(owner_user_id, maximum=36),
        )
    ).scalar_one_or_none()
    if run is None:
        raise TranscriptMaintenanceRunError(
            TranscriptMaintenanceRunReason.run_not_found
        )
    return run


def transcript_maintenance_run_payload(run: TranscriptMaintenanceRun) -> dict[str, Any]:
    result = None
    if run.status == TranscriptMaintenanceRunStatus.succeeded:
        try:
            result = json.loads(run.result_json or "")
        except (TypeError, ValueError) as exc:
            raise RuntimeError("Transcript maintenance result is invalid") from exc
        if not isinstance(result, dict):
            raise RuntimeError("Transcript maintenance result is invalid")
    return {
        "id": run.id,
        "workflow": run.workflow,
        "operation": run.operation,
        "selection_mode": run.selection_mode,
        "target_name": run.target_name,
        "preview_run_id": run.preview_run_id,
        "status": _status_value(run.status),
        "current_stage": run.current_stage,
        "progress": {
            "completed": run.progress_completed,
            "total": run.progress_total,
        },
        "result": result,
        "error": (
            {
                "code": run.error_code,
                "retryable": bool(run.error_retryable),
            }
            if run.status == TranscriptMaintenanceRunStatus.failed
            else None
        ),
        "created_at": run.created_at.isoformat(),
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "finished_at": run.finished_at.isoformat() if run.finished_at else None,
    }


def claim_next_transcript_maintenance_run(
    db: Session,
    *,
    lease_owner_id: str,
    now: datetime,
    lease_ttl: timedelta,
) -> TranscriptMaintenanceRun | None:
    owner = _identity(lease_owner_id, maximum=128)
    run = db.execute(
        select(TranscriptMaintenanceRun)
        .where(
            or_(
                TranscriptMaintenanceRun.status == TranscriptMaintenanceRunStatus.queued,
                (
                    (TranscriptMaintenanceRun.status == TranscriptMaintenanceRunStatus.running)
                    & (TranscriptMaintenanceRun.lease_expires_at < now)
                ),
            )
        )
        .order_by(TranscriptMaintenanceRun.created_at, TranscriptMaintenanceRun.id)
        .with_for_update(skip_locked=True)
        .limit(1)
    ).scalar_one_or_none()
    if run is None:
        return None
    if run.attempt_count >= MAX_RUN_ATTEMPTS:
        _fail_run(run, code="transcript_maintenance_attempts_exhausted", retryable=False, now=now)
        db.commit()
        return None
    run.status = TranscriptMaintenanceRunStatus.running
    run.current_stage = "authorizing"
    run.attempt_count += 1
    run.lease_generation += 1
    run.lease_owner_id = owner
    run.claimed_at = now
    run.lease_expires_at = now + lease_ttl
    run.started_at = run.started_at or now
    run.updated_at = now
    return run


def renew_transcript_maintenance_lease(
    db: Session,
    *,
    job_id: str,
    lease_owner_id: str,
    lease_generation: int,
    now: datetime,
    lease_ttl: timedelta,
) -> None:
    run = db.execute(
        select(TranscriptMaintenanceRun)
        .where(TranscriptMaintenanceRun.id == _run_id(job_id))
        .with_for_update()
    ).scalar_one_or_none()
    if (
        run is None
        or run.status != TranscriptMaintenanceRunStatus.running
        or run.lease_owner_id != _identity(lease_owner_id, maximum=128)
        or run.lease_generation != lease_generation
        or run.lease_expires_at is None
        or _as_utc(run.lease_expires_at) < _as_utc(now)
    ):
        raise TranscriptMaintenanceRunError(
            TranscriptMaintenanceRunReason.lease_not_owned
        )
    run.lease_expires_at = now + lease_ttl
    run.updated_at = now


def process_claimed_transcript_maintenance_run(
    db: Session,
    *,
    run_id: str,
    lease_owner_id: str,
    lease_generation: int,
    settings,
    clock: Callable[[], datetime] | None = None,
) -> TranscriptMaintenanceProcessedRun:
    now = clock or utcnow
    run = _owned_lease(
        db,
        run_id=run_id,
        lease_owner_id=lease_owner_id,
        lease_generation=lease_generation,
        now=now(),
    )

    def progress(stage: str, completed: int, total: int | None) -> None:
        current = _owned_lease(
            db,
            run_id=run_id,
            lease_owner_id=lease_owner_id,
            lease_generation=lease_generation,
            now=now(),
        )
        current.current_stage = stage
        current.progress_completed = max(0, completed)
        current.progress_total = total if total is None else max(completed, total)
        current.updated_at = now()
        db.commit()

    try:
        token = refresh_user_google_maintenance_access_token(
            db,
            user_id=run.owner_user_id,
            settings=settings,
        )
        db.commit()
        target = {
            "selection_mode": TranscriptMaintenanceSelectionMode(run.selection_mode),
            "folder_id": run.folder_id,
            "document_id": run.document_id,
        }
        if run.workflow == TranscriptMaintenanceWorkflow.standardization.value:
            if run.operation == TranscriptMaintenanceOperation.dry_run.value:
                payload = build_transcript_standardization_dry_run(
                    db,
                    owner_user_id=run.owner_user_id,
                    access_token=token,
                    progress=progress,
                    **target,
                )
            else:
                inspection = inspect_transcript_standardization_selection(
                    db,
                    owner_user_id=run.owner_user_id,
                    access_token=token,
                    progress=progress,
                    **target,
                )
                payload = execute_transcript_standardization_apply(
                    access_token=token,
                    candidates=inspection.candidates,
                    source_created_at_by_document_id=inspection.source_created_at_by_document_id,
                    progress=progress,
                )
                payload["selection_summary"] = dict(inspection.selection_summary)
        elif run.workflow == TranscriptMaintenanceWorkflow.catalog_import.value:
            if run.operation == TranscriptMaintenanceOperation.dry_run.value:
                payload = build_transcript_catalog_import_dry_run(
                    db,
                    owner_user_id=run.owner_user_id,
                    access_token=token,
                    progress=progress,
                    **target,
                )
            else:
                inspection = inspect_transcript_catalog_import_selection(
                    db,
                    owner_user_id=run.owner_user_id,
                    access_token=token,
                    progress=progress,
                    **target,
                )
                payload = apply_transcript_catalog_import_metadata(
                    db,
                    owner_user_id=run.owner_user_id,
                    candidates=inspection.candidates,
                )
                payload["selection_summary"] = dict(inspection.selection_summary)
        else:
            raise RuntimeError("Transcript maintenance workflow is invalid")
        run = _owned_lease(
            db,
            run_id=run_id,
            lease_owner_id=lease_owner_id,
            lease_generation=lease_generation,
            now=now(),
        )
        run.result_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        run.status = TranscriptMaintenanceRunStatus.succeeded
        run.current_stage = "completed"
        run.progress_total = run.progress_total or max(1, run.progress_completed)
        run.progress_completed = run.progress_total
        run.finished_at = now()
        run.updated_at = run.finished_at
        _release_lease(run)
        audit(
            db,
            "transcript_maintenance.completed",
            actor_user_id=run.owner_user_id,
            subject_user_id=run.owner_user_id,
        )
        db.commit()
    except Exception as exc:
        db.rollback()
        run = db.execute(
            select(TranscriptMaintenanceRun)
            .where(TranscriptMaintenanceRun.id == _run_id(run_id))
            .with_for_update()
            .execution_options(populate_existing=True)
        ).scalar_one()
        failure_time = now()
        if (
            run.status != TranscriptMaintenanceRunStatus.running
            or run.lease_owner_id != _identity(lease_owner_id, maximum=128)
            or run.lease_generation != lease_generation
            or run.lease_expires_at is None
            or _as_utc(run.lease_expires_at) < _as_utc(failure_time)
        ):
            db.rollback()
            raise TranscriptMaintenanceRunError(
                TranscriptMaintenanceRunReason.lease_not_owned
            ) from None
        code, retryable = _failure(exc)
        _fail_run(run, code=code, retryable=retryable, now=failure_time)
        audit(
            db,
            "transcript_maintenance.failed",
            actor_user_id=run.owner_user_id,
            subject_user_id=run.owner_user_id,
            outcome="failed",
        )
        db.commit()
    return TranscriptMaintenanceProcessedRun(
        run_id=run.id,
        workflow=run.workflow,
        operation=run.operation,
        status=_status_value(run.status),
    )


def _preview_authority(
    db: Session,
    *,
    owner_user_id: str,
    workflow: str,
    selection_mode: str,
    folder_id: str | None,
    document_id: str | None,
    preview_run_id: str | None,
) -> TranscriptMaintenanceRun:
    if preview_run_id is None:
        raise TranscriptMaintenanceRunError(TranscriptMaintenanceRunReason.preview_invalid)
    preview = db.execute(
        select(TranscriptMaintenanceRun).where(
            TranscriptMaintenanceRun.id == _run_id(preview_run_id),
            TranscriptMaintenanceRun.owner_user_id == owner_user_id,
            TranscriptMaintenanceRun.workflow == workflow,
            TranscriptMaintenanceRun.operation == TranscriptMaintenanceOperation.dry_run.value,
            TranscriptMaintenanceRun.status == TranscriptMaintenanceRunStatus.succeeded,
        )
    ).scalar_one_or_none()
    if (
        preview is None
        or preview.selection_mode != selection_mode
        or preview.folder_id != folder_id
        or preview.document_id != document_id
        or not preview.result_json
    ):
        raise TranscriptMaintenanceRunError(TranscriptMaintenanceRunReason.preview_invalid)
    return preview


def _owned_lease(
    db: Session,
    *,
    run_id: str,
    lease_owner_id: str,
    lease_generation: int,
    now: datetime,
) -> TranscriptMaintenanceRun:
    run = db.execute(
        select(TranscriptMaintenanceRun)
        .where(TranscriptMaintenanceRun.id == _run_id(run_id))
        .with_for_update()
        .execution_options(populate_existing=True)
    ).scalar_one_or_none()
    if (
        run is None
        or run.status != TranscriptMaintenanceRunStatus.running
        or run.lease_owner_id != _identity(lease_owner_id, maximum=128)
        or run.lease_generation != lease_generation
        or run.lease_expires_at is None
        or _as_utc(run.lease_expires_at) < _as_utc(now)
    ):
        raise TranscriptMaintenanceRunError(TranscriptMaintenanceRunReason.lease_not_owned)
    return run


def _fail_run(
    run: TranscriptMaintenanceRun,
    *,
    code: str,
    retryable: bool,
    now: datetime,
) -> None:
    run.status = TranscriptMaintenanceRunStatus.failed
    run.current_stage = "failed"
    run.error_code = code[:80]
    run.error_retryable = retryable
    run.finished_at = now
    run.updated_at = now
    _release_lease(run)


def _release_lease(run: TranscriptMaintenanceRun) -> None:
    run.lease_owner_id = None
    run.claimed_at = None
    run.lease_expires_at = None


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _failure(exc: Exception) -> tuple[str, bool]:
    if isinstance(exc, GoogleConnectionAccessError):
        return {
            GoogleConnectionAccessReason.missing: ("catalog_google_connection_missing", False),
            GoogleConnectionAccessReason.inactive: ("catalog_google_connection_inactive", False),
            GoogleConnectionAccessReason.reauthorization_required: ("catalog_google_reauthorization_required", False),
            GoogleConnectionAccessReason.scope_unavailable: ("catalog_google_scope_unavailable", False),
            GoogleConnectionAccessReason.maintenance_missing: ("catalog_google_maintenance_connection_missing", False),
            GoogleConnectionAccessReason.maintenance_inactive: ("catalog_google_maintenance_connection_inactive", False),
            GoogleConnectionAccessReason.maintenance_account_mismatch: ("catalog_google_maintenance_account_mismatch", False),
            GoogleConnectionAccessReason.config_unavailable: ("catalog_google_config_unavailable", False),
            GoogleConnectionAccessReason.token_unavailable: ("catalog_google_token_unavailable", True),
        }[exc.reason]
    if isinstance(exc, CatalogGoogleReadError):
        return {
            CatalogGoogleReadReason.authentication_rejected: ("catalog_google_reauthorization_required", False),
            CatalogGoogleReadReason.request_rejected: ("catalog_folder_unavailable", False),
            CatalogGoogleReadReason.rate_limited: ("catalog_google_rate_limited", True),
            CatalogGoogleReadReason.unavailable: ("catalog_google_unavailable", True),
            CatalogGoogleReadReason.timeout: ("catalog_google_timeout", True),
            CatalogGoogleReadReason.malformed_response: ("catalog_google_response_invalid", False),
            CatalogGoogleReadReason.incomplete_search: ("catalog_scan_incomplete", True),
            CatalogGoogleReadReason.limit_exceeded: ("catalog_scan_limit_exceeded", False),
            CatalogGoogleReadReason.document_not_found: ("catalog_document_unavailable", False),
        }[exc.reason]
    if isinstance(exc, CatalogGoogleWriteError):
        return {
            CatalogGoogleWriteReason.authentication_rejected: (
                "catalog_google_reauthorization_required",
                False,
            ),
            CatalogGoogleWriteReason.request_rejected: (
                "catalog_document_write_rejected",
                False,
            ),
            CatalogGoogleWriteReason.rate_limited: (
                "catalog_google_rate_limited",
                True,
            ),
            CatalogGoogleWriteReason.unavailable: (
                "catalog_google_unavailable",
                True,
            ),
            CatalogGoogleWriteReason.timeout: (
                "catalog_google_timeout",
                True,
            ),
            CatalogGoogleWriteReason.malformed_response: (
                "catalog_google_response_invalid",
                False,
            ),
            CatalogGoogleWriteReason.document_not_found: (
                "catalog_document_unavailable",
                False,
            ),
            CatalogGoogleWriteReason.revision_conflict_or_rejected: (
                "catalog_document_revision_changed",
                True,
            ),
            CatalogGoogleWriteReason.multiple_tabs: (
                "catalog_document_multiple_tabs",
                False,
            ),
            CatalogGoogleWriteReason.unsupported_content: (
                "catalog_document_content_unsupported",
                False,
            ),
            CatalogGoogleWriteReason.classification_changed: (
                "catalog_document_classification_changed",
                True,
            ),
            CatalogGoogleWriteReason.empty_transcript: (
                "catalog_document_empty",
                False,
            ),
            CatalogGoogleWriteReason.limit_exceeded: (
                "catalog_document_limit_exceeded",
                False,
            ),
        }[exc.reason]
    if isinstance(exc, TranscriptDocumentSelectionError):
        return {
            TranscriptDocumentSelectionReason.invalid: (
                "transcript_selection_invalid"
            ),
            TranscriptDocumentSelectionReason.empty: (
                "transcript_selection_empty"
            ),
            TranscriptDocumentSelectionReason.limit_exceeded: (
                "transcript_selection_limit_exceeded"
            ),
            TranscriptDocumentSelectionReason.duplicate: (
                "transcript_selection_duplicate"
            ),
            TranscriptDocumentSelectionReason.folder_invalid: (
                "transcript_folder_invalid"
            ),
            TranscriptDocumentSelectionReason.document_invalid: (
                "transcript_document_invalid"
            ),
            TranscriptDocumentSelectionReason.document_not_google_doc: (
                "transcript_document_not_google_doc"
            ),
            TranscriptDocumentSelectionReason.document_out_of_folder: (
                "transcript_document_out_of_folder"
            ),
            TranscriptDocumentSelectionReason.document_trashed: (
                "transcript_document_trashed"
            ),
        }[exc.reason], False
    if isinstance(exc, TranscriptMaintenanceRunError):
        return exc.reason.value, False
    return "transcript_maintenance_internal_error", False


def _target(selection_mode: str, folder_id: str | None, document_id: str | None) -> tuple[str | None, str | None]:
    if selection_mode == TranscriptMaintenanceSelectionMode.folder_tree.value:
        if document_id is not None:
            raise ValueError("Maintenance folder target is invalid")
        return _identity(folder_id, maximum=256), None
    if folder_id is not None:
        raise ValueError("Maintenance document target is invalid")
    return None, _identity(document_id, maximum=256)


def _identity(value: object, *, maximum: int) -> str:
    cleaned = value.strip() if isinstance(value, str) else ""
    if not cleaned or len(cleaned) > maximum or not cleaned.isascii() or not all(
        character.isalnum() or character in "_-:" for character in cleaned
    ):
        raise ValueError("Maintenance identity is invalid")
    return cleaned


def _target_name(value: object) -> str:
    cleaned = " ".join(value.split()) if isinstance(value, str) else ""
    if not cleaned or len(cleaned) > 512:
        raise ValueError("Maintenance target name is invalid")
    return cleaned


def _idempotency_key(value: object) -> str:
    cleaned = value.strip() if isinstance(value, str) else ""
    if not IDEMPOTENCY_KEY_PATTERN.fullmatch(cleaned):
        raise ValueError("Maintenance idempotency key is invalid")
    return cleaned


def _run_id(value: object) -> str:
    cleaned = value.strip() if isinstance(value, str) else ""
    try:
        parsed = uuid.UUID(cleaned)
    except (AttributeError, TypeError, ValueError):
        raise TranscriptMaintenanceRunError(
            TranscriptMaintenanceRunReason.run_not_found
        ) from None
    if str(parsed) != cleaned:
        raise TranscriptMaintenanceRunError(TranscriptMaintenanceRunReason.run_not_found)
    return cleaned


def _workflow(value: object) -> TranscriptMaintenanceWorkflow:
    try:
        return TranscriptMaintenanceWorkflow(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("Maintenance workflow is invalid") from exc


def _operation(value: object) -> TranscriptMaintenanceOperation:
    try:
        return TranscriptMaintenanceOperation(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("Maintenance operation is invalid") from exc


def _selection_mode(value: object) -> TranscriptMaintenanceSelectionMode:
    try:
        return TranscriptMaintenanceSelectionMode(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("Maintenance selection mode is invalid") from exc


def _status_value(value: object) -> str:
    raw = getattr(value, "value", value)
    if not isinstance(raw, str):
        raise RuntimeError("Maintenance status is invalid")
    return raw

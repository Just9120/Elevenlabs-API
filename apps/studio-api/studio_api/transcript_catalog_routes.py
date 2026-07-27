from __future__ import annotations

from typing import NoReturn

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator
from sqlalchemy.orm import Session

from .audit import audit
from .config import Settings, get_settings
from .db import get_db
from .deps import require_csrf
from .google_connection_access import (
    GoogleConnectionAccessError,
    GoogleConnectionAccessReason,
    active_google_connection_for_user,
    refresh_user_google_drive_access_token,
    require_drive_file_scope,
)
from .rate_limit import RateLimiter
from .transcript_catalog_dry_run import (
    build_catalog_migration_dry_run,
    inspect_catalog_migration_folder,
)
from .transcript_catalog_execution import execute_catalog_migration_apply
from .transcript_catalog_scan import (
    CatalogGoogleReadError,
    CatalogGoogleReadReason,
)
from .transcript_catalog_standardize import (
    CatalogGoogleWriteError,
    CatalogGoogleWriteReason,
)
from .transcript_document_selection import (
    MAX_SELECTED_TRANSCRIPT_DOCUMENTS,
    TranscriptDocumentSelectionError,
    TranscriptDocumentSelectionReason,
)
from .transcript_maintenance_dry_run import (
    build_transcript_catalog_import_dry_run,
    build_transcript_standardization_dry_run,
)


router = APIRouter()
legacy_router = APIRouter(prefix="/api/transcript-catalog/migration")
maintenance_router = APIRouter(prefix="/api/transcript-maintenance")
catalog_limiter = RateLimiter()
_NO_STORE_HEADERS = {
    "Cache-Control": "no-store",
    "Pragma": "no-cache",
}


class TranscriptCatalogMigrationFolderIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    folder_id: str = Field(min_length=1, max_length=256)

    @field_validator("folder_id")
    @classmethod
    def valid_folder_id(cls, value: str) -> str:
        cleaned = value.strip()
        if (
            not cleaned
            or not all(
                character.isalnum() or character in "_-"
                for character in cleaned
            )
        ):
            raise ValueError("Некорректный ID папки Google Drive")
        return cleaned


class TranscriptCatalogMigrationApplyIn(
    TranscriptCatalogMigrationFolderIn
):
    confirm_apply: StrictBool

    @field_validator("confirm_apply")
    @classmethod
    def apply_must_be_confirmed(cls, value: bool) -> bool:
        if value is not True:
            raise ValueError("Подтвердите применение миграции")
        return value


class TranscriptMaintenanceSelectionIn(
    TranscriptCatalogMigrationFolderIn
):
    document_ids: tuple[str, ...] = Field(
        min_length=1,
        max_length=MAX_SELECTED_TRANSCRIPT_DOCUMENTS,
    )


@legacy_router.post("/dry-run")
def dry_run_transcript_catalog_migration(
    data: TranscriptCatalogMigrationFolderIn,
    response: Response,
    pair=Depends(require_csrf),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    _, user = pair
    catalog_limiter.check(
        f"transcript-catalog:dry-run:{user.id}",
        20,
        3600,
    )
    _no_store(response)
    try:
        access_token = _catalog_access_token(db, user.id, settings)
        return build_catalog_migration_dry_run(
            db,
            owner_user_id=user.id,
            access_token=access_token,
            folder_id=data.folder_id,
        )
    except GoogleConnectionAccessError as exc:
        db.rollback()
        _raise_connection_error(exc)
    except CatalogGoogleReadError as exc:
        db.rollback()
        _raise_read_error(exc)


@legacy_router.post("/apply")
def apply_transcript_catalog_migration(
    data: TranscriptCatalogMigrationApplyIn,
    response: Response,
    pair=Depends(require_csrf),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    _, user = pair
    catalog_limiter.check(
        f"transcript-catalog:apply:{user.id}",
        5,
        3600,
    )
    _no_store(response)
    try:
        access_token = _catalog_access_token(db, user.id, settings)
        inspection = inspect_catalog_migration_folder(
            db,
            owner_user_id=user.id,
            access_token=access_token,
            folder_id=data.folder_id,
        )
        payload = execute_catalog_migration_apply(
            db,
            owner_user_id=user.id,
            access_token=access_token,
            candidates=inspection.candidates,
            created_time_by_document_id=(
                inspection.created_time_by_document_id
            ),
        )
        payload["scan_summary"] = dict(inspection.scan_summary)
        audit(
            db,
            "transcript_catalog.migration_applied",
            actor_user_id=user.id,
            subject_user_id=user.id,
        )
        db.commit()
        return payload
    except GoogleConnectionAccessError as exc:
        db.rollback()
        _raise_connection_error(exc)
    except CatalogGoogleReadError as exc:
        db.rollback()
        _raise_read_error(exc)
    except CatalogGoogleWriteError as exc:
        db.rollback()
        _raise_write_error(exc)
    except Exception:
        db.rollback()
        raise


@maintenance_router.post("/standardization/dry-run")
def dry_run_transcript_standardization(
    data: TranscriptMaintenanceSelectionIn,
    response: Response,
    pair=Depends(require_csrf),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    _, user = pair
    catalog_limiter.check(
        f"transcript-maintenance:standardization:dry-run:{user.id}",
        20,
        3600,
    )
    _no_store(response)
    try:
        access_token = _catalog_access_token(db, user.id, settings)
        return build_transcript_standardization_dry_run(
            access_token=access_token,
            folder_id=data.folder_id,
            document_ids=data.document_ids,
        )
    except GoogleConnectionAccessError as exc:
        db.rollback()
        _raise_connection_error(exc)
    except TranscriptDocumentSelectionError as exc:
        db.rollback()
        _raise_selection_error(exc)
    except CatalogGoogleReadError as exc:
        db.rollback()
        _raise_read_error(exc)


@maintenance_router.post("/catalog-import/dry-run")
def dry_run_transcript_catalog_import(
    data: TranscriptMaintenanceSelectionIn,
    response: Response,
    pair=Depends(require_csrf),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    _, user = pair
    catalog_limiter.check(
        f"transcript-maintenance:catalog-import:dry-run:{user.id}",
        20,
        3600,
    )
    _no_store(response)
    try:
        access_token = _catalog_access_token(db, user.id, settings)
        return build_transcript_catalog_import_dry_run(
            db,
            owner_user_id=user.id,
            access_token=access_token,
            folder_id=data.folder_id,
            document_ids=data.document_ids,
        )
    except GoogleConnectionAccessError as exc:
        db.rollback()
        _raise_connection_error(exc)
    except TranscriptDocumentSelectionError as exc:
        db.rollback()
        _raise_selection_error(exc)
    except CatalogGoogleReadError as exc:
        db.rollback()
        _raise_read_error(exc)


def _catalog_access_token(
    db: Session,
    user_id: str,
    settings: Settings,
) -> str:
    connection = active_google_connection_for_user(
        db,
        user_id=user_id,
    )
    require_drive_file_scope(connection)
    return refresh_user_google_drive_access_token(
        db,
        user_id=user_id,
        settings=settings,
    )


def _no_store(response: Response) -> None:
    for header, value in _NO_STORE_HEADERS.items():
        response.headers[header] = value


def _raise_catalog_error(
    status_code: int,
    *,
    reason: str,
    retryable: bool,
) -> NoReturn:
    raise HTTPException(
        status_code,
        detail={
            "reason": reason,
            "retryable": retryable,
        },
        headers=_NO_STORE_HEADERS,
    )


def _raise_connection_error(
    error: GoogleConnectionAccessError,
) -> NoReturn:
    status_code, reason, retryable = {
        GoogleConnectionAccessReason.missing: (
            status.HTTP_409_CONFLICT,
            "catalog_google_connection_missing",
            False,
        ),
        GoogleConnectionAccessReason.inactive: (
            status.HTTP_409_CONFLICT,
            "catalog_google_connection_inactive",
            False,
        ),
        GoogleConnectionAccessReason.reauthorization_required: (
            status.HTTP_409_CONFLICT,
            "catalog_google_reauthorization_required",
            False,
        ),
        GoogleConnectionAccessReason.scope_unavailable: (
            status.HTTP_409_CONFLICT,
            "catalog_google_scope_unavailable",
            False,
        ),
        GoogleConnectionAccessReason.config_unavailable: (
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "catalog_google_config_unavailable",
            False,
        ),
        GoogleConnectionAccessReason.token_unavailable: (
            status.HTTP_502_BAD_GATEWAY,
            "catalog_google_token_unavailable",
            True,
        ),
    }[error.reason]
    _raise_catalog_error(
        status_code,
        reason=reason,
        retryable=retryable,
    )


def _raise_selection_error(
    error: TranscriptDocumentSelectionError,
) -> NoReturn:
    reason = {
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
    }[error.reason]
    _raise_catalog_error(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        reason=reason,
        retryable=False,
    )


def _raise_read_error(error: CatalogGoogleReadError) -> NoReturn:
    status_code, reason, retryable = {
        CatalogGoogleReadReason.authentication_rejected: (
            status.HTTP_409_CONFLICT,
            "catalog_google_reauthorization_required",
            False,
        ),
        CatalogGoogleReadReason.request_rejected: (
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "catalog_folder_unavailable",
            False,
        ),
        CatalogGoogleReadReason.rate_limited: (
            status.HTTP_429_TOO_MANY_REQUESTS,
            "catalog_google_rate_limited",
            True,
        ),
        CatalogGoogleReadReason.unavailable: (
            status.HTTP_502_BAD_GATEWAY,
            "catalog_google_unavailable",
            True,
        ),
        CatalogGoogleReadReason.timeout: (
            status.HTTP_504_GATEWAY_TIMEOUT,
            "catalog_google_timeout",
            True,
        ),
        CatalogGoogleReadReason.malformed_response: (
            status.HTTP_502_BAD_GATEWAY,
            "catalog_google_response_invalid",
            False,
        ),
        CatalogGoogleReadReason.incomplete_search: (
            status.HTTP_409_CONFLICT,
            "catalog_scan_incomplete",
            True,
        ),
        CatalogGoogleReadReason.limit_exceeded: (
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "catalog_scan_limit_exceeded",
            False,
        ),
        CatalogGoogleReadReason.document_not_found: (
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "catalog_document_unavailable",
            False,
        ),
    }[error.reason]
    _raise_catalog_error(
        status_code,
        reason=reason,
        retryable=retryable,
    )


def _raise_write_error(error: CatalogGoogleWriteError) -> NoReturn:
    status_code, reason, retryable = {
        CatalogGoogleWriteReason.authentication_rejected: (
            status.HTTP_409_CONFLICT,
            "catalog_google_reauthorization_required",
            False,
        ),
        CatalogGoogleWriteReason.request_rejected: (
            status.HTTP_409_CONFLICT,
            "catalog_document_write_rejected",
            False,
        ),
        CatalogGoogleWriteReason.rate_limited: (
            status.HTTP_429_TOO_MANY_REQUESTS,
            "catalog_google_rate_limited",
            True,
        ),
        CatalogGoogleWriteReason.unavailable: (
            status.HTTP_502_BAD_GATEWAY,
            "catalog_google_unavailable",
            True,
        ),
        CatalogGoogleWriteReason.timeout: (
            status.HTTP_504_GATEWAY_TIMEOUT,
            "catalog_google_timeout",
            True,
        ),
        CatalogGoogleWriteReason.malformed_response: (
            status.HTTP_502_BAD_GATEWAY,
            "catalog_google_response_invalid",
            False,
        ),
        CatalogGoogleWriteReason.document_not_found: (
            status.HTTP_409_CONFLICT,
            "catalog_document_unavailable",
            False,
        ),
        CatalogGoogleWriteReason.revision_conflict_or_rejected: (
            status.HTTP_409_CONFLICT,
            "catalog_document_revision_changed",
            True,
        ),
        CatalogGoogleWriteReason.multiple_tabs: (
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "catalog_document_multiple_tabs",
            False,
        ),
        CatalogGoogleWriteReason.unsupported_content: (
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "catalog_document_content_unsupported",
            False,
        ),
        CatalogGoogleWriteReason.classification_changed: (
            status.HTTP_409_CONFLICT,
            "catalog_document_classification_changed",
            True,
        ),
        CatalogGoogleWriteReason.empty_transcript: (
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "catalog_document_empty",
            False,
        ),
        CatalogGoogleWriteReason.limit_exceeded: (
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "catalog_document_limit_exceeded",
            False,
        ),
    }[error.reason]
    _raise_catalog_error(
        status_code,
        reason=reason,
        retryable=retryable,
    )


router.include_router(legacy_router)
router.include_router(maintenance_router)

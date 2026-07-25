from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Iterable, Sequence

from sqlalchemy import and_

from .transcript_catalog import effective_settings_from_persisted_job
from .transcript_catalog_migration import (
    CatalogDocumentStandardStatus,
    CatalogImportAuthorityStatus,
    CatalogMigrationCandidate,
    CatalogMigrationOperation,
    CatalogSettingsAuthorityStatus,
    build_catalog_migration_payload,
)
from .transcript_catalog_scan import (
    CatalogGoogleReadError,
    CatalogGoogleReadReason,
    GoogleTranscriptCatalogReader,
    classify_transcript_document_standard,
)


PER_DOCUMENT_UNREADABLE_REASONS = {
    CatalogGoogleReadReason.document_not_found,
    CatalogGoogleReadReason.malformed_response,
    CatalogGoogleReadReason.request_rejected,
}


@dataclass(frozen=True)
class CatalogImportAuthority:
    import_status: CatalogImportAuthorityStatus
    settings_status: CatalogSettingsAuthorityStatus


def build_catalog_migration_dry_run(
    db: Any,
    *,
    owner_user_id: str,
    access_token: str,
    folder_id: str,
    reader: GoogleTranscriptCatalogReader | None = None,
    authority_loader: Callable[..., dict[str, CatalogImportAuthority]]
    | None = None,
) -> dict:
    """Build one owner-scoped, non-mutating migration preview."""

    owner_id = _private_identity(owner_user_id, label="owner")
    catalog_reader = reader or GoogleTranscriptCatalogReader()
    folder_scan = catalog_reader.scan_folder(
        access_token=access_token,
        folder_id=folder_id,
    )
    document_ids = tuple(
        item.drive_document_id for item in folder_scan.documents
    )
    loader = authority_loader or load_catalog_import_authorities
    authorities = loader(
        db,
        owner_user_id=owner_id,
        document_ids=document_ids,
    )
    if set(authorities) != set(document_ids):
        raise ValueError("Catalog import authority coverage is incomplete")

    candidates: list[CatalogMigrationCandidate] = []
    unreadable_document_count = 0
    for document in folder_scan.documents:
        authority = authorities[document.drive_document_id]
        try:
            document_text = catalog_reader.read_document_text(
                access_token=access_token,
                document_id=document.drive_document_id,
            )
            standard_status = classify_transcript_document_standard(
                document_text
            )
            del document_text
        except CatalogGoogleReadError as exc:
            if exc.reason not in PER_DOCUMENT_UNREADABLE_REASONS:
                raise
            standard_status = CatalogDocumentStandardStatus.unreadable
            unreadable_document_count += 1
        candidates.append(
            CatalogMigrationCandidate(
                drive_document_id=document.drive_document_id,
                name=document.name,
                standard_status=standard_status,
                import_status=authority.import_status,
                settings_status=authority.settings_status,
            )
        )

    payload = build_catalog_migration_payload(
        operation=CatalogMigrationOperation.dry_run,
        candidates=candidates,
    )
    payload["scan_summary"] = {
        "google_document_count": len(folder_scan.documents),
        "nested_folder_count": folder_scan.nested_folder_count,
        "skipped_non_document_count": (
            folder_scan.skipped_non_document_count
        ),
        "unreadable_document_count": unreadable_document_count,
        "pages_scanned": folder_scan.pages_scanned,
    }
    return payload


def load_catalog_import_authorities(
    db: Any,
    *,
    owner_user_id: str,
    document_ids: Iterable[str],
) -> dict[str, CatalogImportAuthority]:
    """Load output authority without exposing cross-owner record details."""

    from .models import (
        ProviderCredential,
        TranscriptionJob,
        TranscriptionJobOutput,
    )

    owner_id = _private_identity(owner_user_id, label="owner")
    requested_ids = tuple(
        _private_identity(value, label="document")
        for value in document_ids
    )
    if len(requested_ids) != len(set(requested_ids)):
        raise ValueError("Catalog document identities must be unique")
    if not requested_ids:
        return {}

    rows = (
        db.query(
            TranscriptionJobOutput.document_id,
            TranscriptionJob.owner_user_id,
            TranscriptionJob.provider,
            ProviderCredential.provider,
            TranscriptionJob.language,
            TranscriptionJob.options_json,
        )
        .join(
            TranscriptionJob,
            TranscriptionJob.id == TranscriptionJobOutput.job_id,
        )
        .outerjoin(
            ProviderCredential,
            and_(
                ProviderCredential.id
                == TranscriptionJob.provider_credential_id,
                ProviderCredential.user_id
                == TranscriptionJob.owner_user_id,
            ),
        )
        .filter(TranscriptionJobOutput.document_id.in_(requested_ids))
        .all()
    )
    return classify_catalog_import_authorities(
        owner_user_id=owner_id,
        document_ids=requested_ids,
        rows=rows,
    )


def classify_catalog_import_authorities(
    *,
    owner_user_id: str,
    document_ids: Iterable[str],
    rows: Iterable[Sequence[Any]],
) -> dict[str, CatalogImportAuthority]:
    """Classify existing outputs while keeping private identities server-side."""

    owner_id = _private_identity(owner_user_id, label="owner")
    requested_ids = tuple(
        _private_identity(value, label="document")
        for value in document_ids
    )
    if len(requested_ids) != len(set(requested_ids)):
        raise ValueError("Catalog document identities must be unique")
    requested_set = set(requested_ids)
    evidence_by_document: dict[str, list[Sequence[Any]]] = {
        document_id: [] for document_id in requested_ids
    }
    for row in rows:
        if isinstance(row, (str, bytes)):
            raise ValueError("Catalog import authority evidence is invalid")
        try:
            evidence_row = tuple(row)
        except TypeError as exc:
            raise ValueError(
                "Catalog import authority evidence is invalid"
            ) from exc
        if len(evidence_row) != 6:
            raise ValueError("Catalog import authority evidence is invalid")
        document_id = _private_identity(
            evidence_row[0],
            label="document",
        )
        if document_id not in requested_set:
            raise ValueError("Catalog import authority evidence is out of scope")
        evidence_by_document[document_id].append(evidence_row)

    authorities: dict[str, CatalogImportAuthority] = {}
    for document_id in requested_ids:
        evidence = evidence_by_document[document_id]
        if not evidence:
            authorities[document_id] = CatalogImportAuthority(
                import_status=CatalogImportAuthorityStatus.not_imported,
                settings_status=(
                    CatalogSettingsAuthorityStatus.indeterminate
                ),
            )
            continue
        if len(evidence) != 1 or evidence[0][1] != owner_id:
            authorities[document_id] = CatalogImportAuthority(
                import_status=CatalogImportAuthorityStatus.conflict,
                settings_status=(
                    CatalogSettingsAuthorityStatus.indeterminate
                ),
            )
            continue

        (
            _document_id,
            _row_owner_id,
            job_provider,
            credential_provider,
            language,
            options_json,
        ) = evidence[0]
        settings = effective_settings_from_persisted_job(
            job_provider=job_provider,
            credential_provider=credential_provider,
            language=language,
            options_json=options_json,
        )
        authorities[document_id] = CatalogImportAuthority(
            import_status=CatalogImportAuthorityStatus.imported_exact,
            settings_status=(
                CatalogSettingsAuthorityStatus.exact
                if settings is not None
                else CatalogSettingsAuthorityStatus.indeterminate
            ),
        )
    return authorities


def _private_identity(value: object, *, label: str) -> str:
    cleaned = value.strip() if isinstance(value, str) else ""
    if not cleaned:
        raise ValueError(f"Catalog {label} identity is required")
    return cleaned

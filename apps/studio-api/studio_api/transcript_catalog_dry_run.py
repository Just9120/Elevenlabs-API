from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Iterable, Sequence

from sqlalchemy import and_

from .transcript_catalog import (
    EffectiveTranscriptionSettings,
    effective_settings_from_persisted_job,
)
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
    settings: EffectiveTranscriptionSettings | None = field(
        default=None,
        repr=False,
    )


@dataclass(frozen=True)
class CatalogMigrationFolderInspection:
    """Private revalidated folder evidence for dry-run or explicit apply."""

    candidates: tuple[CatalogMigrationCandidate, ...] = field(repr=False)
    created_time_by_document_id: dict[str, str | None] = field(
        repr=False
    )
    scan_summary: dict[str, int]

    def __repr__(self) -> str:
        return (
            "CatalogMigrationFolderInspection("
            f"candidate_count={len(self.candidates)!r}, "
            f"scan_summary={self.scan_summary!r}, "
            "candidates=<redacted>, created_time_by_document_id=<redacted>)"
        )


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

    inspection = inspect_catalog_migration_folder(
        db,
        owner_user_id=owner_user_id,
        access_token=access_token,
        folder_id=folder_id,
        reader=reader,
        authority_loader=authority_loader,
    )
    payload = build_catalog_migration_payload(
        operation=CatalogMigrationOperation.dry_run,
        candidates=inspection.candidates,
    )
    payload["scan_summary"] = dict(inspection.scan_summary)
    return payload


def inspect_catalog_migration_folder(
    db: Any,
    *,
    owner_user_id: str,
    access_token: str,
    folder_id: str,
    reader: GoogleTranscriptCatalogReader | None = None,
    authority_loader: Callable[..., dict[str, CatalogImportAuthority]]
    | None = None,
) -> CatalogMigrationFolderInspection:
    """Rebuild private folder evidence without trusting a browser preview."""

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

    return CatalogMigrationFolderInspection(
        candidates=tuple(candidates),
        created_time_by_document_id={
            document.drive_document_id: document.created_time
            for document in folder_scan.documents
        },
        scan_summary={
            "google_document_count": len(folder_scan.documents),
            "nested_folder_count": folder_scan.nested_folder_count,
            "skipped_non_document_count": (
                folder_scan.skipped_non_document_count
            ),
            "unreadable_document_count": unreadable_document_count,
            "pages_scanned": folder_scan.pages_scanned,
        },
    )


def load_catalog_import_authorities(
    db: Any,
    *,
    owner_user_id: str,
    document_ids: Iterable[str],
) -> dict[str, CatalogImportAuthority]:
    """Load durable catalog and historical output authority privately."""

    from .models import (
        ProviderCredential,
        TranscriptCatalogEntry,
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

    output_rows = (
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
    catalog_rows = (
        db.query(
            TranscriptCatalogEntry.document_id,
            TranscriptCatalogEntry.owner_user_id,
            TranscriptCatalogEntry.settings_status,
            TranscriptCatalogEntry.provider,
            TranscriptCatalogEntry.model,
            TranscriptCatalogEntry.language_mode,
            TranscriptCatalogEntry.diarization_enabled,
        )
        .filter(
            TranscriptCatalogEntry.owner_user_id == owner_id,
            TranscriptCatalogEntry.document_id.in_(requested_ids),
        )
        .all()
    )
    output_authorities = classify_catalog_import_authorities(
        owner_user_id=owner_id,
        document_ids=requested_ids,
        rows=output_rows,
    )
    catalog_authorities = classify_persisted_catalog_authorities(
        owner_user_id=owner_id,
        document_ids=requested_ids,
        rows=catalog_rows,
    )
    return reconcile_catalog_import_authorities(
        document_ids=requested_ids,
        output_authorities=output_authorities,
        catalog_authorities=catalog_authorities,
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
            settings=settings,
        )
    return authorities


def classify_persisted_catalog_authorities(
    *,
    owner_user_id: str,
    document_ids: Iterable[str],
    rows: Iterable[Sequence[Any]],
) -> dict[str, CatalogImportAuthority]:
    """Classify durable Studio catalog membership without leaking identities."""

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
            raise ValueError("Persisted catalog authority evidence is invalid")
        try:
            evidence_row = tuple(row)
        except TypeError as exc:
            raise ValueError(
                "Persisted catalog authority evidence is invalid"
            ) from exc
        if len(evidence_row) != 7:
            raise ValueError("Persisted catalog authority evidence is invalid")
        document_id = _private_identity(
            evidence_row[0],
            label="document",
        )
        if document_id not in requested_set:
            raise ValueError(
                "Persisted catalog authority evidence is out of scope"
            )
        evidence_by_document[document_id].append(evidence_row)

    authorities: dict[str, CatalogImportAuthority] = {}
    for document_id in requested_ids:
        evidence = evidence_by_document[document_id]
        if not evidence:
            authorities[document_id] = _not_imported_authority()
            continue
        if len(evidence) != 1 or evidence[0][1] != owner_id:
            authorities[document_id] = _conflicting_authority()
            continue
        (
            _document_id,
            _row_owner_id,
            raw_settings_status,
            provider,
            model,
            language_mode,
            diarization_enabled,
        ) = evidence[0]
        settings_status = _catalog_settings_status(raw_settings_status)
        if settings_status is None:
            authorities[document_id] = _conflicting_authority()
            continue
        if settings_status == CatalogSettingsAuthorityStatus.indeterminate:
            if any(
                value is not None
                for value in (
                    provider,
                    model,
                    language_mode,
                    diarization_enabled,
                )
            ):
                authorities[document_id] = _conflicting_authority()
                continue
            settings = None
        else:
            settings = _persisted_catalog_settings(
                provider=provider,
                model=model,
                language_mode=language_mode,
                diarization_enabled=diarization_enabled,
            )
            if settings is None:
                authorities[document_id] = _conflicting_authority()
                continue
        authorities[document_id] = CatalogImportAuthority(
            import_status=CatalogImportAuthorityStatus.imported_exact,
            settings_status=settings_status,
            settings=settings,
        )
    return authorities


def reconcile_catalog_import_authorities(
    *,
    document_ids: Iterable[str],
    output_authorities: dict[str, CatalogImportAuthority],
    catalog_authorities: dict[str, CatalogImportAuthority],
) -> dict[str, CatalogImportAuthority]:
    """Merge legacy output and durable catalog evidence fail closed."""

    requested_ids = tuple(
        _private_identity(value, label="document")
        for value in document_ids
    )
    requested_set = set(requested_ids)
    if len(requested_ids) != len(requested_set):
        raise ValueError("Catalog document identities must be unique")
    if set(output_authorities) != requested_set:
        raise ValueError("Output catalog authority coverage is incomplete")
    if set(catalog_authorities) != requested_set:
        raise ValueError("Persisted catalog authority coverage is incomplete")

    reconciled: dict[str, CatalogImportAuthority] = {}
    for document_id in requested_ids:
        output = output_authorities[document_id]
        catalog = catalog_authorities[document_id]
        if not _authority_is_coherent(output) or not _authority_is_coherent(
            catalog
        ):
            reconciled[document_id] = _conflicting_authority()
            continue
        if (
            output.import_status == CatalogImportAuthorityStatus.conflict
            or catalog.import_status == CatalogImportAuthorityStatus.conflict
        ):
            reconciled[document_id] = _conflicting_authority()
            continue
        if catalog.import_status == CatalogImportAuthorityStatus.not_imported:
            reconciled[document_id] = output
            continue
        if output.import_status == CatalogImportAuthorityStatus.not_imported:
            reconciled[document_id] = catalog
            continue
        if (
            output.settings is not None
            and catalog.settings is not None
            and output.settings != catalog.settings
        ):
            reconciled[document_id] = _conflicting_authority()
            continue
        exact_settings = catalog.settings or output.settings
        reconciled[document_id] = CatalogImportAuthority(
            import_status=CatalogImportAuthorityStatus.imported_exact,
            settings_status=(
                CatalogSettingsAuthorityStatus.exact
                if exact_settings is not None
                else CatalogSettingsAuthorityStatus.indeterminate
            ),
            settings=exact_settings,
        )
    return reconciled


def _authority_is_coherent(authority: CatalogImportAuthority) -> bool:
    if not isinstance(authority, CatalogImportAuthority):
        return False
    if not isinstance(authority.import_status, CatalogImportAuthorityStatus):
        return False
    if not isinstance(
        authority.settings_status,
        CatalogSettingsAuthorityStatus,
    ):
        return False
    if authority.import_status != CatalogImportAuthorityStatus.imported_exact:
        return authority.settings is None
    if authority.settings_status == CatalogSettingsAuthorityStatus.exact:
        return isinstance(authority.settings, EffectiveTranscriptionSettings)
    return authority.settings is None


def _not_imported_authority() -> CatalogImportAuthority:
    return CatalogImportAuthority(
        import_status=CatalogImportAuthorityStatus.not_imported,
        settings_status=CatalogSettingsAuthorityStatus.indeterminate,
    )


def _conflicting_authority() -> CatalogImportAuthority:
    return CatalogImportAuthority(
        import_status=CatalogImportAuthorityStatus.conflict,
        settings_status=CatalogSettingsAuthorityStatus.indeterminate,
    )


def _catalog_settings_status(
    value: Any,
) -> CatalogSettingsAuthorityStatus | None:
    raw = getattr(value, "value", value)
    try:
        return CatalogSettingsAuthorityStatus(raw)
    except (TypeError, ValueError):
        return None


def _persisted_catalog_settings(
    *,
    provider: Any,
    model: Any,
    language_mode: Any,
    diarization_enabled: Any,
) -> EffectiveTranscriptionSettings | None:
    values = (provider, model, language_mode)
    if not all(isinstance(value, str) and value.strip() for value in values):
        return None
    if not isinstance(diarization_enabled, bool):
        return None
    return EffectiveTranscriptionSettings(
        provider=provider.strip().lower(),
        model=model.strip(),
        language_mode=language_mode.strip().lower(),
        diarization_enabled=diarization_enabled,
    )


def _private_identity(value: object, *, label: str) -> str:
    cleaned = value.strip() if isinstance(value, str) else ""
    if not cleaned:
        raise ValueError(f"Catalog {label} identity is required")
    return cleaned

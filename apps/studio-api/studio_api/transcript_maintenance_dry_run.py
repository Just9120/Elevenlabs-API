from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable

from .transcript_catalog_dry_run import (
    CatalogImportAuthority,
    load_catalog_import_authorities,
)
from .transcript_catalog_migration import (
    CatalogDocumentStandardStatus,
    CatalogMigrationCandidate,
    CatalogMigrationOperation,
    TranscriptStandardizationCandidate,
    build_transcript_catalog_import_payload,
    build_transcript_standardization_payload,
)
from .transcript_catalog_scan import (
    DRIVE_ID_PATTERN,
    CatalogGoogleDocumentMetadata,
    CatalogGoogleFolderScan,
    CatalogGoogleReadError,
    CatalogGoogleReadReason,
    GoogleTranscriptCatalogReader,
    classify_transcript_document_standard,
)


class TranscriptMaintenanceSelectionMode(str, Enum):
    folder_tree = "folder_tree"
    single_document = "single_document"


PER_DOCUMENT_UNREADABLE_REASONS = {
    CatalogGoogleReadReason.document_not_found,
    CatalogGoogleReadReason.malformed_response,
    CatalogGoogleReadReason.request_rejected,
}


@dataclass(frozen=True)
class TranscriptStandardizationSelectionInspection:
    """Private target evidence for one standardization operation."""

    candidates: tuple[TranscriptStandardizationCandidate, ...] = field(
        repr=False
    )
    created_time_by_document_id: dict[str, str | None] = field(
        repr=False
    )
    selection_summary: dict[str, int]

    def __repr__(self) -> str:
        return (
            "TranscriptStandardizationSelectionInspection("
            f"candidate_count={len(self.candidates)!r}, "
            f"selection_summary={self.selection_summary!r}, "
            "candidates=<redacted>, "
            "created_time_by_document_id=<redacted>)"
        )


@dataclass(frozen=True)
class TranscriptCatalogImportSelectionInspection:
    """Private target evidence for one catalog-import operation."""

    candidates: tuple[CatalogMigrationCandidate, ...] = field(repr=False)
    selection_summary: dict[str, int]

    def __repr__(self) -> str:
        return (
            "TranscriptCatalogImportSelectionInspection("
            f"candidate_count={len(self.candidates)!r}, "
            f"selection_summary={self.selection_summary!r}, "
            "candidates=<redacted>)"
        )


@dataclass(frozen=True)
class _SelectedTranscriptEvidence:
    drive_document_id: str = field(repr=False)
    name: str | None
    created_time: str | None
    standard_status: CatalogDocumentStandardStatus


def build_transcript_standardization_dry_run(
    *,
    access_token: str,
    selection_mode: TranscriptMaintenanceSelectionMode,
    folder_id: str | None = None,
    document_id: str | None = None,
    reader: GoogleTranscriptCatalogReader | None = None,
) -> dict:
    """Classify one selected Doc or every Doc in a recursive folder."""

    inspection = inspect_transcript_standardization_selection(
        access_token=access_token,
        selection_mode=selection_mode,
        folder_id=folder_id,
        document_id=document_id,
        reader=reader,
    )
    payload = build_transcript_standardization_payload(
        operation=CatalogMigrationOperation.dry_run,
        candidates=inspection.candidates,
    )
    payload["selection_summary"] = dict(inspection.selection_summary)
    return payload


def inspect_transcript_standardization_selection(
    *,
    access_token: str,
    selection_mode: TranscriptMaintenanceSelectionMode,
    folder_id: str | None = None,
    document_id: str | None = None,
    reader: GoogleTranscriptCatalogReader | None = None,
) -> TranscriptStandardizationSelectionInspection:
    """Rebuild standardization evidence from the selected target."""

    evidence, selection_summary = _inspect_transcripts(
        access_token=access_token,
        selection_mode=selection_mode,
        folder_id=folder_id,
        document_id=document_id,
        reader=reader,
    )
    return TranscriptStandardizationSelectionInspection(
        candidates=tuple(
            TranscriptStandardizationCandidate(
                drive_document_id=item.drive_document_id,
                name=item.name,
                standard_status=item.standard_status,
            )
            for item in evidence
        ),
        created_time_by_document_id={
            item.drive_document_id: item.created_time for item in evidence
        },
        selection_summary=selection_summary,
    )


def build_transcript_catalog_import_dry_run(
    db: Any,
    *,
    owner_user_id: str,
    access_token: str,
    selection_mode: TranscriptMaintenanceSelectionMode,
    folder_id: str | None = None,
    document_id: str | None = None,
    reader: GoogleTranscriptCatalogReader | None = None,
    authority_loader: Callable[..., dict[str, CatalogImportAuthority]]
    | None = None,
) -> dict:
    """Classify one Doc or every recursive Doc for metadata import."""

    inspection = inspect_transcript_catalog_import_selection(
        db,
        owner_user_id=owner_user_id,
        access_token=access_token,
        selection_mode=selection_mode,
        folder_id=folder_id,
        document_id=document_id,
        reader=reader,
        authority_loader=authority_loader,
    )
    payload = build_transcript_catalog_import_payload(
        operation=CatalogMigrationOperation.dry_run,
        candidates=inspection.candidates,
    )
    payload["selection_summary"] = dict(inspection.selection_summary)
    return payload


def inspect_transcript_catalog_import_selection(
    db: Any,
    *,
    owner_user_id: str,
    access_token: str,
    selection_mode: TranscriptMaintenanceSelectionMode,
    folder_id: str | None = None,
    document_id: str | None = None,
    reader: GoogleTranscriptCatalogReader | None = None,
    authority_loader: Callable[..., dict[str, CatalogImportAuthority]]
    | None = None,
) -> TranscriptCatalogImportSelectionInspection:
    """Rebuild catalog-import evidence from the selected target."""

    owner_id = _private_identity(owner_user_id, label="owner")
    evidence, selection_summary = _inspect_transcripts(
        access_token=access_token,
        selection_mode=selection_mode,
        folder_id=folder_id,
        document_id=document_id,
        reader=reader,
    )
    selected_document_ids = tuple(
        item.drive_document_id for item in evidence
    )
    loader = authority_loader or load_catalog_import_authorities
    authorities = loader(
        db,
        owner_user_id=owner_id,
        document_ids=selected_document_ids,
    )
    if set(authorities) != set(selected_document_ids):
        raise ValueError("Catalog import authority coverage is incomplete")
    return TranscriptCatalogImportSelectionInspection(
        candidates=tuple(
            CatalogMigrationCandidate(
                drive_document_id=item.drive_document_id,
                name=item.name,
                standard_status=item.standard_status,
                import_status=authorities[
                    item.drive_document_id
                ].import_status,
                settings_status=authorities[
                    item.drive_document_id
                ].settings_status,
            )
            for item in evidence
        ),
        selection_summary=selection_summary,
    )


def _inspect_transcripts(
    *,
    access_token: str,
    selection_mode: TranscriptMaintenanceSelectionMode,
    folder_id: str | None,
    document_id: str | None,
    reader: GoogleTranscriptCatalogReader | None,
) -> tuple[tuple[_SelectedTranscriptEvidence, ...], dict[str, int]]:
    mode = _selection_mode(selection_mode)
    if mode == TranscriptMaintenanceSelectionMode.folder_tree:
        if document_id is not None:
            raise ValueError(
                "Single document must be absent for folder-tree maintenance"
            )
        return _inspect_folder_transcripts(
            access_token=access_token,
            folder_id=_private_drive_id(folder_id, label="folder"),
            reader=reader,
        )
    if folder_id is not None:
        raise ValueError(
            "Folder must be absent for single-document maintenance"
        )
    return _inspect_single_transcript(
        access_token=access_token,
        document_id=_private_drive_id(document_id, label="document"),
        reader=reader,
    )


def _inspect_folder_transcripts(
    *,
    access_token: str,
    folder_id: str,
    reader: GoogleTranscriptCatalogReader | None,
) -> tuple[tuple[_SelectedTranscriptEvidence, ...], dict[str, int]]:
    catalog_reader = reader or GoogleTranscriptCatalogReader()
    scan = catalog_reader.scan_folder(
        access_token=access_token,
        folder_id=folder_id,
    )
    documents = _validated_recursive_documents(scan)
    evidence, unreadable_document_count = _classify_documents(
        access_token=access_token,
        documents=documents,
        reader=catalog_reader,
    )
    return (
        evidence,
        {
            "google_document_count": len(evidence),
            "nested_folder_count": scan.nested_folder_count,
            "skipped_non_document_count": (
                scan.skipped_non_document_count
            ),
            "pages_scanned": scan.pages_scanned,
            "unreadable_document_count": unreadable_document_count,
        },
    )


def _inspect_single_transcript(
    *,
    access_token: str,
    document_id: str,
    reader: GoogleTranscriptCatalogReader | None,
) -> tuple[tuple[_SelectedTranscriptEvidence, ...], dict[str, int]]:
    catalog_reader = reader or GoogleTranscriptCatalogReader()
    try:
        document = catalog_reader.inspect_document(
            access_token=access_token,
            document_id=document_id,
        )
    except CatalogGoogleReadError as exc:
        if exc.reason not in PER_DOCUMENT_UNREADABLE_REASONS:
            raise
        evidence = (
            _SelectedTranscriptEvidence(
                drive_document_id=document_id,
                name=None,
                created_time=None,
                standard_status=CatalogDocumentStandardStatus.unreadable,
            ),
        )
        unreadable_document_count = 1
    else:
        evidence, unreadable_document_count = _classify_documents(
            access_token=access_token,
            documents=(document,),
            reader=catalog_reader,
        )
    return (
        evidence,
        {
            "google_document_count": 1,
            "nested_folder_count": 0,
            "skipped_non_document_count": 0,
            "pages_scanned": 0,
            "unreadable_document_count": unreadable_document_count,
        },
    )


def _classify_documents(
    *,
    access_token: str,
    documents: tuple[CatalogGoogleDocumentMetadata, ...],
    reader: GoogleTranscriptCatalogReader,
) -> tuple[tuple[_SelectedTranscriptEvidence, ...], int]:
    evidence = []
    unreadable_document_count = 0
    for document in documents:
        try:
            document_text = reader.read_document_text(
                access_token=access_token,
                document_id=document.drive_document_id,
            )
            standard_status = classify_transcript_document_standard(
                document_text
            )
            if not document_text:
                standard_status = CatalogDocumentStandardStatus.unreadable
                unreadable_document_count += 1
            del document_text
        except CatalogGoogleReadError as exc:
            if exc.reason not in PER_DOCUMENT_UNREADABLE_REASONS:
                raise
            standard_status = CatalogDocumentStandardStatus.unreadable
            unreadable_document_count += 1
        evidence.append(
            _SelectedTranscriptEvidence(
                drive_document_id=document.drive_document_id,
                name=document.name,
                created_time=document.created_time,
                standard_status=standard_status,
            )
        )
    return tuple(evidence), unreadable_document_count


def _validated_recursive_documents(
    scan: CatalogGoogleFolderScan,
) -> tuple[CatalogGoogleDocumentMetadata, ...]:
    if not isinstance(scan, CatalogGoogleFolderScan):
        raise ValueError("Recursive transcript scan evidence is invalid")
    documents = scan.documents
    if not isinstance(documents, tuple):
        raise ValueError("Recursive transcript scan evidence is invalid")
    for value in (
        scan.nested_folder_count,
        scan.skipped_non_document_count,
        scan.pages_scanned,
    ):
        if (
            isinstance(value, bool)
            or not isinstance(value, int)
            or value < 0
        ):
            raise ValueError("Recursive transcript scan evidence is invalid")
    if scan.pages_scanned < 1:
        raise ValueError("Recursive transcript scan evidence is invalid")
    if any(
        not isinstance(document, CatalogGoogleDocumentMetadata)
        for document in documents
    ):
        raise ValueError("Selected transcript evidence is invalid")
    inspected_ids = tuple(
        document.drive_document_id for document in documents
    )
    if (
        len(inspected_ids) != len(set(inspected_ids))
        or any(not isinstance(value, str) or not value for value in inspected_ids)
    ):
        raise ValueError("Recursive transcript scan evidence is invalid")
    return documents


def _private_identity(value: object, *, label: str) -> str:
    cleaned = value.strip() if isinstance(value, str) else ""
    if not cleaned:
        raise ValueError(f"Transcript maintenance {label} is required")
    return cleaned


def _private_drive_id(value: object, *, label: str) -> str:
    cleaned = _private_identity(value, label=label)
    if not DRIVE_ID_PATTERN.fullmatch(cleaned):
        raise ValueError(f"Transcript maintenance {label} is invalid")
    return cleaned


def _selection_mode(
    value: object,
) -> TranscriptMaintenanceSelectionMode:
    try:
        return TranscriptMaintenanceSelectionMode(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(
            "Transcript maintenance selection mode is invalid"
        ) from exc

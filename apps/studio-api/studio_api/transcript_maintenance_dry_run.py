from __future__ import annotations

from dataclasses import dataclass, field
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
    CatalogGoogleDocumentMetadata,
    CatalogGoogleReadError,
    CatalogGoogleReadReason,
    GoogleTranscriptCatalogReader,
    classify_transcript_document_standard,
)
from .transcript_document_selection import (
    normalize_transcript_document_selection,
)


PER_DOCUMENT_UNREADABLE_REASONS = {
    CatalogGoogleReadReason.document_not_found,
    CatalogGoogleReadReason.malformed_response,
    CatalogGoogleReadReason.request_rejected,
}


@dataclass(frozen=True)
class TranscriptStandardizationSelectionInspection:
    """Private, revalidated evidence for one standardization operation."""

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
    """Private, revalidated evidence for one catalog-import operation."""

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
    folder_id: str,
    document_ids: tuple[str, ...],
    reader: GoogleTranscriptCatalogReader | None = None,
) -> dict:
    """Classify selected Docs without catalog access or any mutation."""

    inspection = inspect_transcript_standardization_selection(
        access_token=access_token,
        folder_id=folder_id,
        document_ids=document_ids,
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
    folder_id: str,
    document_ids: tuple[str, ...],
    reader: GoogleTranscriptCatalogReader | None = None,
) -> TranscriptStandardizationSelectionInspection:
    """Rebuild standardization evidence from the explicit selected set."""

    evidence, selection_summary = _inspect_selected_transcripts(
        access_token=access_token,
        folder_id=folder_id,
        document_ids=document_ids,
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
    folder_id: str,
    document_ids: tuple[str, ...],
    reader: GoogleTranscriptCatalogReader | None = None,
    authority_loader: Callable[..., dict[str, CatalogImportAuthority]]
    | None = None,
) -> dict:
    """Classify selected Docs for metadata import without any mutation."""

    inspection = inspect_transcript_catalog_import_selection(
        db,
        owner_user_id=owner_user_id,
        access_token=access_token,
        folder_id=folder_id,
        document_ids=document_ids,
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
    folder_id: str,
    document_ids: tuple[str, ...],
    reader: GoogleTranscriptCatalogReader | None = None,
    authority_loader: Callable[..., dict[str, CatalogImportAuthority]]
    | None = None,
) -> TranscriptCatalogImportSelectionInspection:
    """Rebuild catalog-import evidence from the explicit selected set."""

    owner_id = _private_identity(owner_user_id, label="owner")
    evidence, selection_summary = _inspect_selected_transcripts(
        access_token=access_token,
        folder_id=folder_id,
        document_ids=document_ids,
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


def _inspect_selected_transcripts(
    *,
    access_token: str,
    folder_id: str,
    document_ids: tuple[str, ...],
    reader: GoogleTranscriptCatalogReader | None,
) -> tuple[tuple[_SelectedTranscriptEvidence, ...], dict[str, int]]:
    selection = normalize_transcript_document_selection(
        folder_id=folder_id,
        document_ids=document_ids,
    )
    catalog_reader = reader or GoogleTranscriptCatalogReader()
    selected = catalog_reader.inspect_selected_documents(
        access_token=access_token,
        folder_id=selection.folder_id,
        document_ids=selection.document_ids,
    )
    documents = tuple(selected.documents)
    _require_exact_selection_coverage(
        documents,
        selected_document_ids=selection.document_ids,
    )

    evidence = []
    unreadable_document_count = 0
    for document in documents:
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
        evidence.append(
            _SelectedTranscriptEvidence(
                drive_document_id=document.drive_document_id,
                name=document.name,
                created_time=document.created_time,
                standard_status=standard_status,
            )
        )
    return (
        tuple(evidence),
        {
            "selected_document_count": len(evidence),
            "unreadable_document_count": unreadable_document_count,
        },
    )


def _require_exact_selection_coverage(
    documents: tuple[CatalogGoogleDocumentMetadata, ...],
    *,
    selected_document_ids: tuple[str, ...],
) -> None:
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
        or set(inspected_ids) != set(selected_document_ids)
    ):
        raise ValueError("Selected transcript evidence coverage is incomplete")


def _private_identity(value: object, *, label: str) -> str:
    cleaned = value.strip() if isinstance(value, str) else ""
    if not cleaned:
        raise ValueError(f"Transcript maintenance {label} is required")
    return cleaned

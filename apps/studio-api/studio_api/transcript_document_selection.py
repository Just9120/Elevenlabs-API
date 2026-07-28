from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
import re
from typing import Iterable


MAX_SELECTED_TRANSCRIPT_DOCUMENTS = 50
DRIVE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,256}$")


class TranscriptDocumentSelectionReason(str, Enum):
    invalid = "invalid"
    empty = "empty"
    limit_exceeded = "limit_exceeded"
    duplicate = "duplicate"
    folder_invalid = "folder_invalid"
    document_invalid = "document_invalid"
    document_not_google_doc = "document_not_google_doc"
    document_out_of_folder = "document_out_of_folder"
    document_trashed = "document_trashed"


class TranscriptDocumentSelectionError(ValueError):
    def __init__(self, reason: TranscriptDocumentSelectionReason):
        self.reason = reason
        super().__init__(reason.value)


@dataclass(frozen=True)
class TranscriptDocumentSelection:
    """Private bounded Picker authority for one folder and explicit documents."""

    folder_id: str = field(repr=False)
    document_ids: tuple[str, ...] = field(repr=False)

    def __repr__(self) -> str:
        return (
            "TranscriptDocumentSelection("
            f"document_count={len(self.document_ids)!r}, "
            "folder_id=<redacted>, document_ids=<redacted>)"
        )


def normalize_transcript_document_selection(
    *,
    folder_id: object,
    document_ids: Iterable[object],
    maximum: int = MAX_SELECTED_TRANSCRIPT_DOCUMENTS,
) -> TranscriptDocumentSelection:
    selected_folder_id = normalize_drive_id(
        folder_id,
        reason=TranscriptDocumentSelectionReason.folder_invalid,
    )
    if (
        isinstance(maximum, bool)
        or not isinstance(maximum, int)
        or maximum < 1
        or maximum > MAX_SELECTED_TRANSCRIPT_DOCUMENTS
    ):
        raise TranscriptDocumentSelectionError(
            TranscriptDocumentSelectionReason.invalid
        )
    if isinstance(document_ids, (str, bytes)) or not isinstance(
        document_ids,
        Iterable,
    ):
        raise TranscriptDocumentSelectionError(
            TranscriptDocumentSelectionReason.invalid
        )
    raw_document_ids = tuple(document_ids)
    if not raw_document_ids:
        raise TranscriptDocumentSelectionError(
            TranscriptDocumentSelectionReason.empty
        )
    if len(raw_document_ids) > maximum:
        raise TranscriptDocumentSelectionError(
            TranscriptDocumentSelectionReason.limit_exceeded
        )
    normalized_document_ids = tuple(
        normalize_drive_id(
            document_id,
            reason=TranscriptDocumentSelectionReason.document_invalid,
        )
        for document_id in raw_document_ids
    )
    if len(normalized_document_ids) != len(set(normalized_document_ids)):
        raise TranscriptDocumentSelectionError(
            TranscriptDocumentSelectionReason.duplicate
        )
    return TranscriptDocumentSelection(
        folder_id=selected_folder_id,
        document_ids=normalized_document_ids,
    )


def normalize_drive_id(
    value: object,
    *,
    reason: TranscriptDocumentSelectionReason,
) -> str:
    cleaned = value.strip() if isinstance(value, str) else ""
    if not DRIVE_ID_PATTERN.fullmatch(cleaned):
        raise TranscriptDocumentSelectionError(reason)
    return cleaned

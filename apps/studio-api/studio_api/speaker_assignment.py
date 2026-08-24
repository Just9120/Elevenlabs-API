from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Callable

from sqlalchemy.orm import Session

from .google_connection_access import (
    GoogleConnectionAccessError,
    refresh_user_google_drive_access_token,
)
from .models import (
    SpeakerProfile,
    TranscriptionJob,
    TranscriptionJobOutput,
    TranscriptionJobSpeaker,
)
from .speaker_identity import job_speaker_payload, render_profile_label
from .transcript_catalog_standardize import (
    CatalogGoogleWriteError,
    GoogleTranscriptCatalogStandardizer,
)


class SpeakerAssignmentReason(str, Enum):
    not_found = "not_found"
    profile_unavailable = "profile_unavailable"
    output_unavailable = "output_unavailable"
    google_connection_unavailable = "google_connection_unavailable"
    document_changed = "document_changed"
    google_docs_unavailable = "google_docs_unavailable"


class SpeakerAssignmentError(RuntimeError):
    def __init__(self, reason: SpeakerAssignmentReason):
        self.reason = reason
        super().__init__(reason.value)


@dataclass(frozen=True)
class SpeakerAssignmentResult:
    payload: dict
    document_changed: bool


def assign_speaker_profile(
    db: Session,
    *,
    owner_user_id: str,
    job_id: str,
    speaker_id: str,
    profile_id: str,
    settings,
    now: datetime,
    token_resolver: Callable = refresh_user_google_drive_access_token,
    standardizer: GoogleTranscriptCatalogStandardizer | None = None,
) -> SpeakerAssignmentResult:
    speaker = (
        db.query(TranscriptionJobSpeaker)
        .filter(
            TranscriptionJobSpeaker.id == speaker_id,
            TranscriptionJobSpeaker.job_id == job_id,
            TranscriptionJobSpeaker.owner_user_id == owner_user_id,
        )
        .with_for_update()
        .one_or_none()
    )
    if speaker is None:
        raise SpeakerAssignmentError(SpeakerAssignmentReason.not_found)
    job = db.get(TranscriptionJob, job_id)
    if job is None or job.owner_user_id != owner_user_id:
        raise SpeakerAssignmentError(SpeakerAssignmentReason.not_found)
    profile = (
        db.query(SpeakerProfile)
        .filter(
            SpeakerProfile.id == profile_id,
            SpeakerProfile.owner_user_id == owner_user_id,
            SpeakerProfile.active.is_(True),
        )
        .one_or_none()
    )
    if profile is None:
        raise SpeakerAssignmentError(SpeakerAssignmentReason.profile_unavailable)
    output = (
        db.query(TranscriptionJobOutput)
        .filter(
            TranscriptionJobOutput.job_id == job_id,
            TranscriptionJobOutput.job_source_id == speaker.job_source_id,
        )
        .one_or_none()
    )
    if output is None:
        raise SpeakerAssignmentError(SpeakerAssignmentReason.output_unavailable)

    desired_label = render_profile_label(profile.display_name, profile.role)
    desired_heading = f"{desired_label}:"
    current_heading = f"{speaker.applied_document_label or f'Speaker {speaker.display_ordinal}'}:"
    expected_existing_desired_count = (
        db.query(TranscriptionJobSpeaker)
        .filter(
            TranscriptionJobSpeaker.job_source_id == speaker.job_source_id,
            TranscriptionJobSpeaker.id != speaker.id,
            TranscriptionJobSpeaker.applied_document_label == desired_label,
        )
        .count()
    )
    try:
        access_token = token_resolver(db, user_id=owner_user_id, settings=settings)
    except GoogleConnectionAccessError as exc:
        raise SpeakerAssignmentError(
            SpeakerAssignmentReason.google_connection_unavailable
        ) from exc

    transport = standardizer or GoogleTranscriptCatalogStandardizer()
    try:
        snapshot = transport.read_document(
            access_token=access_token,
            document_id=output.document_id,
        )
        replacement, changed = replace_exact_speaker_heading(
            snapshot.document_text,
            current_heading=current_heading,
            desired_heading=desired_heading,
            expected_existing_desired_count=expected_existing_desired_count,
        )
        if changed:
            transport.replace_document_text(
                access_token=access_token,
                snapshot=snapshot,
                document_text=replacement,
            )
    except CatalogGoogleWriteError as exc:
        raise SpeakerAssignmentError(
            SpeakerAssignmentReason.google_docs_unavailable
        ) from exc

    speaker.speaker_profile_id = profile.id
    speaker.applied_display_name = profile.display_name
    speaker.applied_role = profile.role
    speaker.applied_document_label = desired_label
    speaker.assigned_at = now
    speaker.updated_at = now
    db.flush()
    return SpeakerAssignmentResult(
        payload=job_speaker_payload(speaker),
        document_changed=changed,
    )


def replace_exact_speaker_heading(
    document_text: str,
    *,
    current_heading: str,
    desired_heading: str,
    expected_existing_desired_count: int = 0,
) -> tuple[str, bool]:
    if not document_text or not current_heading or not desired_heading:
        raise SpeakerAssignmentError(SpeakerAssignmentReason.document_changed)
    lines = document_text.splitlines(keepends=True)
    desired_count = sum(line.rstrip("\r\n") == desired_heading for line in lines)
    current_indexes = [
        index
        for index, line in enumerate(lines)
        if line.rstrip("\r\n") == current_heading
    ]
    if current_heading == desired_heading and desired_count > 0:
        return document_text, False
    if not current_indexes and desired_count > expected_existing_desired_count:
        return document_text, False
    if not current_indexes:
        raise SpeakerAssignmentError(SpeakerAssignmentReason.document_changed)
    for index in current_indexes:
        line = lines[index]
        ending = line[len(line.rstrip("\r\n")) :]
        lines[index] = desired_heading + ending
    return "".join(lines), True

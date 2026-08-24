from __future__ import annotations

import math
import unicodedata
from dataclasses import dataclass
from datetime import datetime
from typing import Iterable, Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import SpeakerProfile, TranscriptionJob, TranscriptionJobSpeaker


SPEAKER_SAMPLE_MAX_MS = 8_000


class TranscriptWordProtocol(Protocol):
    start: float | None
    end: float | None
    speaker_id: str | None


@dataclass(frozen=True)
class SpeakerObservation:
    provider_speaker_label: str
    display_ordinal: int
    sample_start_ms: int
    sample_end_ms: int

    @property
    def technical_label(self) -> str:
        return f"Speaker {self.display_ordinal}"


def normalize_profile_text(value: str, *, maximum: int, field: str) -> str:
    cleaned = " ".join(unicodedata.normalize("NFKC", value).replace("\x00", " ").split())
    if not cleaned:
        raise ValueError(f"{field}_required")
    if len(cleaned) > maximum:
        raise ValueError(f"{field}_too_long")
    return cleaned


def normalize_profile_name(value: str) -> tuple[str, str]:
    display_name = normalize_profile_text(
        value,
        maximum=160,
        field="display_name",
    )
    return display_name, display_name.casefold()


def normalize_profile_role(value: str) -> str:
    return normalize_profile_text(value, maximum=120, field="role")


def render_profile_label(display_name: str, role: str) -> str:
    return f"{display_name} — {role}"


def derive_speaker_observations(
    words: Iterable[TranscriptWordProtocol],
    *,
    source_offset_seconds: int = 0,
) -> tuple[SpeakerObservation, ...]:
    labels: dict[str, int] = {}
    ranges: dict[str, tuple[float, float]] = {}
    offset = max(0, source_offset_seconds)

    for word in words:
        label = (word.speaker_id or "").strip()
        if not label:
            continue
        if label not in labels:
            labels[label] = len(labels) + 1
        start = word.start
        end = word.end
        if (
            start is None
            or end is None
            or not math.isfinite(start)
            or not math.isfinite(end)
            or start < 0
            or end <= start
        ):
            continue
        current = ranges.get(label)
        if current is None:
            ranges[label] = (start, min(end, start + SPEAKER_SAMPLE_MAX_MS / 1000))
            continue
        range_start, range_end = current
        if range_end - range_start >= SPEAKER_SAMPLE_MAX_MS / 1000:
            continue
        if start - range_end > 1.0:
            continue
        ranges[label] = (
            range_start,
            min(max(range_end, end), range_start + SPEAKER_SAMPLE_MAX_MS / 1000),
        )

    result: list[SpeakerObservation] = []
    for label, ordinal in labels.items():
        sample = ranges.get(label)
        if sample is None:
            continue
        sample_start_ms = round((offset + sample[0]) * 1000)
        sample_end_ms = round((offset + sample[1]) * 1000)
        if sample_end_ms <= sample_start_ms:
            continue
        result.append(
            SpeakerObservation(
                provider_speaker_label=label[:160],
                display_ordinal=ordinal,
                sample_start_ms=sample_start_ms,
                sample_end_ms=min(sample_end_ms, sample_start_ms + SPEAKER_SAMPLE_MAX_MS),
            )
        )
    return tuple(result)


def persist_speaker_observations(
    db: Session,
    *,
    job: TranscriptionJob,
    job_source_id: str,
    words: Iterable[TranscriptWordProtocol],
    now: datetime,
) -> tuple[TranscriptionJobSpeaker, ...]:
    observations = derive_speaker_observations(
        words,
        source_offset_seconds=job.media_clip_start_seconds or 0,
    )
    existing = {
        row.provider_speaker_label: row
        for row in db.execute(
            select(TranscriptionJobSpeaker).where(
                TranscriptionJobSpeaker.owner_user_id == job.owner_user_id,
                TranscriptionJobSpeaker.job_id == job.id,
                TranscriptionJobSpeaker.job_source_id == job_source_id,
            )
        ).scalars()
    }
    persisted: list[TranscriptionJobSpeaker] = []
    for observation in observations:
        row = existing.get(observation.provider_speaker_label)
        if row is None:
            row = TranscriptionJobSpeaker(
                owner_user_id=job.owner_user_id,
                job_id=job.id,
                job_source_id=job_source_id,
                provider_speaker_label=observation.provider_speaker_label,
                display_ordinal=observation.display_ordinal,
                sample_start_ms=observation.sample_start_ms,
                sample_end_ms=observation.sample_end_ms,
                created_at=now,
                updated_at=now,
            )
            db.add(row)
        elif row.speaker_profile_id is None:
            row.display_ordinal = observation.display_ordinal
            row.sample_start_ms = observation.sample_start_ms
            row.sample_end_ms = observation.sample_end_ms
            row.updated_at = now
        persisted.append(row)
    return tuple(persisted)


def speaker_profile_payload(profile: SpeakerProfile) -> dict:
    return {
        "id": profile.id,
        "display_name": profile.display_name,
        "role": profile.role,
        "active": profile.active,
        "created_at": profile.created_at.isoformat(),
        "updated_at": profile.updated_at.isoformat(),
    }


def job_speaker_payload(speaker: TranscriptionJobSpeaker) -> dict:
    return {
        "id": speaker.id,
        "label": f"Speaker {speaker.display_ordinal}",
        "sample_available": speaker.sample_end_ms > speaker.sample_start_ms,
        "profile": (
            {
                "id": speaker.speaker_profile_id,
                "display_name": speaker.applied_display_name,
                "role": speaker.applied_role,
            }
            if speaker.speaker_profile_id is not None
            else None
        ),
    }

from __future__ import annotations

import math
import statistics
from collections.abc import Iterable, Mapping
from datetime import datetime
from typing import Any

from .transcription_options import browser_language_mode, job_diarization_enabled


JOB_STATUSES = ("queued", "processing", "completed", "failed", "cancelled")


def _enum_value(value: Any) -> str:
    raw = getattr(value, "value", value)
    return raw if isinstance(raw, str) else ""


def _duration_seconds(
    started_at: datetime | None,
    finished_at: datetime | None,
) -> float | None:
    if started_at is None or finished_at is None:
        return None
    seconds = (finished_at - started_at).total_seconds()
    return seconds if seconds >= 0 else None


def _duration_summary(values: Iterable[float]) -> dict[str, int | float | None]:
    samples = sorted(value for value in values if math.isfinite(value) and value >= 0)
    if not samples:
        return {
            "sample_count": 0,
            "average_seconds": None,
            "p50_seconds": None,
            "p95_seconds": None,
        }

    def nearest_rank(percentile: float) -> float:
        return samples[max(0, math.ceil(percentile * len(samples)) - 1)]

    return {
        "sample_count": len(samples),
        "average_seconds": round(sum(samples) / len(samples), 1),
        "p50_seconds": round(statistics.median(samples), 1),
        "p95_seconds": round(nearest_rank(0.95), 1),
    }


def _selected_provider(
    job: Any,
    provider_by_credential_id: Mapping[str, str],
) -> str:
    credential_id = getattr(job, "provider_credential_id", None)
    credential_provider = provider_by_credential_id.get(credential_id, "")
    if credential_provider == "elevenlabs":
        return credential_provider
    explicit_provider = str(getattr(job, "provider", "") or "").strip().lower()
    return explicit_provider if explicit_provider == "elevenlabs" else "unknown"


def build_transcription_analytics_payload(
    *,
    jobs: Iterable[Any],
    source_count: int,
    output_count: int,
    attempts: Iterable[Any],
    provider_by_credential_id: Mapping[str, str],
) -> dict[str, Any]:
    job_rows = list(jobs)
    attempt_rows = list(attempts)
    outcomes = {status: 0 for status in JOB_STATUSES}
    provider_model = {"elevenlabs_scribe_v2": 0, "unknown": 0}
    language_mode = {"ru": 0, "detect": 0, "other": 0}
    diarization = {"enabled": 0, "disabled": 0}
    queue_durations: list[float] = []
    processing_durations: list[float] = []

    for job in job_rows:
        status = _enum_value(getattr(job, "status", ""))
        if status in outcomes:
            outcomes[status] += 1

        provider_key = (
            "elevenlabs_scribe_v2"
            if _selected_provider(job, provider_by_credential_id) == "elevenlabs"
            else "unknown"
        )
        provider_model[provider_key] += 1

        selected_language = browser_language_mode(getattr(job, "language", None))
        language_key = (
            selected_language if selected_language in {"ru", "detect"} else "other"
        )
        language_mode[language_key] += 1

        diarization_key = (
            "enabled"
            if job_diarization_enabled(getattr(job, "options_json", None))
            else "disabled"
        )
        diarization[diarization_key] += 1

        queue_duration = _duration_seconds(
            getattr(job, "created_at", None),
            getattr(job, "started_at", None),
        )
        if queue_duration is not None:
            queue_durations.append(queue_duration)
        processing_duration = _duration_seconds(
            getattr(job, "started_at", None),
            getattr(job, "finished_at", None),
        )
        if processing_duration is not None:
            processing_durations.append(processing_duration)

    provider_durations: list[float] = []
    post_provider_durations: list[float] = []
    for attempt in attempt_rows:
        provider_duration = _duration_seconds(
            getattr(attempt, "provider_request_started_at", None),
            getattr(attempt, "provider_response_returned_at", None),
        )
        if provider_duration is not None:
            provider_durations.append(provider_duration)
        post_provider_duration = _duration_seconds(
            getattr(attempt, "provider_response_returned_at", None),
            getattr(attempt, "completed_at", None),
        )
        if post_provider_duration is not None:
            post_provider_durations.append(post_provider_duration)

    return {
        "scope": "project_all_time",
        "totals": {
            "jobs": len(job_rows),
            "sources": max(0, int(source_count)),
            "outputs": max(0, int(output_count)),
        },
        "outcomes": outcomes,
        "configuration": {
            "provider_model": provider_model,
            "language_mode": language_mode,
            "diarization": diarization,
        },
        "durations": {
            "queue": _duration_summary(queue_durations),
            "processing": _duration_summary(processing_durations),
            "provider_processing": _duration_summary(provider_durations),
            "post_provider_output": _duration_summary(post_provider_durations),
        },
    }


def load_transcription_analytics_payload(
    db: Any,
    *,
    owner_user_id: str,
    project_id: str,
):
    from .models import (
        ProviderCredential,
        TranscriptionJob,
        TranscriptionJobOutput,
        TranscriptionJobSource,
        TranscriptionJobSourceAttempt,
    )

    jobs = (
        db.query(TranscriptionJob)
        .filter(
            TranscriptionJob.owner_user_id == owner_user_id,
            TranscriptionJob.project_id == project_id,
        )
        .all()
    )
    credential_ids = {
        job.provider_credential_id for job in jobs if job.provider_credential_id
    }
    credentials = (
        db.query(ProviderCredential)
        .filter(
            ProviderCredential.user_id == owner_user_id,
            ProviderCredential.id.in_(credential_ids),
        )
        .all()
        if credential_ids
        else []
    )
    provider_by_credential_id = {
        credential.id: _enum_value(credential.provider) for credential in credentials
    }
    source_count = (
        db.query(TranscriptionJobSource)
        .join(TranscriptionJob, TranscriptionJob.id == TranscriptionJobSource.job_id)
        .filter(
            TranscriptionJob.owner_user_id == owner_user_id,
            TranscriptionJob.project_id == project_id,
        )
        .count()
    )
    output_count = (
        db.query(TranscriptionJobOutput)
        .join(TranscriptionJob, TranscriptionJob.id == TranscriptionJobOutput.job_id)
        .filter(
            TranscriptionJob.owner_user_id == owner_user_id,
            TranscriptionJob.project_id == project_id,
        )
        .count()
    )
    attempts = (
        db.query(TranscriptionJobSourceAttempt)
        .join(
            TranscriptionJob,
            TranscriptionJob.id == TranscriptionJobSourceAttempt.job_id,
        )
        .filter(
            TranscriptionJob.owner_user_id == owner_user_id,
            TranscriptionJob.project_id == project_id,
        )
        .all()
    )
    return build_transcription_analytics_payload(
        jobs=jobs,
        source_count=source_count,
        output_count=output_count,
        attempts=attempts,
        provider_by_credential_id=provider_by_credential_id,
    )

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


def enum(value: str):
    return SimpleNamespace(value=value)


def job(
    status: str,
    *,
    created_at: datetime,
    started_after: int | None,
    finished_after: int | None,
    credential_id: str | None,
    provider: str | None = None,
    language: str | None = "ru",
    options_json: str | None = None,
):
    return SimpleNamespace(
        status=enum(status),
        created_at=created_at,
        started_at=(
            created_at + timedelta(seconds=started_after)
            if started_after is not None
            else None
        ),
        finished_at=(
            created_at + timedelta(seconds=finished_after)
            if finished_after is not None
            else None
        ),
        provider_credential_id=credential_id,
        provider=provider,
        language=language,
        options_json=options_json,
        title="private title",
        output_drive_folder_url="https://drive.google.com/private-folder",
    )


def attempt(
    start: datetime | None,
    returned: datetime | None,
    completed: datetime | None,
):
    return SimpleNamespace(
        provider_request_started_at=start,
        provider_response_returned_at=returned,
        completed_at=completed,
        failure_code="private-provider-error",
    )


def test_analytics_aggregates_only_safe_durable_counts_and_intervals():
    from studio_api.transcription_analytics import build_transcription_analytics_payload

    now = datetime(2026, 7, 23, tzinfo=timezone.utc)
    payload = build_transcription_analytics_payload(
        jobs=[
            job(
                "completed",
                created_at=now,
                started_after=10,
                finished_after=100,
                credential_id="credential-elevenlabs",
                language="ru",
                options_json='{"diarize":true}',
            ),
            job(
                "failed",
                created_at=now,
                started_after=20,
                finished_after=80,
                credential_id="credential-missing",
                language=None,
            ),
            job(
                "queued",
                created_at=now,
                started_after=None,
                finished_after=None,
                credential_id=None,
                provider="elevenlabs",
                language="ru",
            ),
        ],
        source_count=4,
        output_count=1,
        attempts=[
            attempt(
                now + timedelta(seconds=20),
                now + timedelta(seconds=50),
                now + timedelta(seconds=90),
            ),
            attempt(
                now + timedelta(seconds=30),
                now + timedelta(seconds=50),
                now + timedelta(seconds=70),
            ),
            attempt(
                now + timedelta(seconds=60),
                now + timedelta(seconds=50),
                now + timedelta(seconds=40),
            ),
            attempt(now, None, None),
        ],
        provider_by_credential_id={"credential-elevenlabs": "elevenlabs"},
    )

    assert payload == {
        "scope": "project_all_time",
        "totals": {"jobs": 3, "sources": 4, "outputs": 1},
        "outcomes": {
            "queued": 1,
            "processing": 0,
            "completed": 1,
            "failed": 1,
            "cancelled": 0,
        },
        "configuration": {
            "provider_model": {
                "elevenlabs_scribe_v2": 2,
                "unknown": 1,
            },
            "language_mode": {"ru": 2, "detect": 1, "other": 0},
            "diarization": {"enabled": 1, "disabled": 2},
        },
        "durations": {
            "queue": {
                "sample_count": 2,
                "average_seconds": 15.0,
                "p50_seconds": 15.0,
                "p95_seconds": 20.0,
            },
            "processing": {
                "sample_count": 2,
                "average_seconds": 75.0,
                "p50_seconds": 75.0,
                "p95_seconds": 90.0,
            },
            "provider_processing": {
                "sample_count": 2,
                "average_seconds": 25.0,
                "p50_seconds": 25.0,
                "p95_seconds": 30.0,
            },
            "post_provider_output": {
                "sample_count": 2,
                "average_seconds": 30.0,
                "p50_seconds": 30.0,
                "p95_seconds": 40.0,
            },
        },
    }
    encoded = json.dumps(payload)
    for private_marker in (
        "private title",
        "private-folder",
        "credential-elevenlabs",
        "credential-missing",
        "private-provider-error",
    ):
        assert private_marker not in encoded


def test_analytics_reports_empty_duration_samples_honestly():
    from studio_api.transcription_analytics import build_transcription_analytics_payload

    payload = build_transcription_analytics_payload(
        jobs=[],
        source_count=0,
        output_count=0,
        attempts=[],
        provider_by_credential_id={},
    )

    assert payload["totals"] == {"jobs": 0, "sources": 0, "outputs": 0}
    assert payload["outcomes"] == {
        "queued": 0,
        "processing": 0,
        "completed": 0,
        "failed": 0,
        "cancelled": 0,
    }
    assert all(
        summary == {
            "sample_count": 0,
            "average_seconds": None,
            "p50_seconds": None,
            "p95_seconds": None,
        }
        for summary in payload["durations"].values()
    )

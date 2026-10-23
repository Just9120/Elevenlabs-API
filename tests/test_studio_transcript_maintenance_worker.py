from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
import sys
import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


@pytest.mark.parametrize("order,expected", [
    (("audio", "transcription", "maintenance"), ["audio", "transcription", "maintenance"]),
    (("maintenance", "audio", "transcription"), ["maintenance"]),
])
def test_selector_rotates_order_and_falls_through_empty_queues(monkeypatch, order, expected):
    from studio_api import audio_preparation_worker as worker
    from studio_api import job_processing_runner
    from studio_api import transcript_maintenance_worker

    calls = []
    monkeypatch.setattr("studio_api.worker_recovery.recover_expired_worker_jobs", lambda *a, **k: calls.append("recover"))
    monkeypatch.setattr(
        worker,
        "claim_next_and_process_audio_preparation",
        lambda *args, **kwargs: calls.append("audio") or None,
    )
    monkeypatch.setattr(
        job_processing_runner,
        "claim_next_and_orchestrate_processing_job",
        lambda *args, **kwargs: calls.append("transcription") or None,
    )
    monkeypatch.setattr(
        transcript_maintenance_worker,
        "claim_next_and_process_transcript_maintenance",
        lambda *args, **kwargs: calls.append("maintenance") or "done",
    )

    db = SimpleNamespace(commit=lambda: calls.append("commit"))
    assert worker.claim_next_studio_work(db, work_order=order) == "done"
    assert calls == ["recover", "commit", *expected]


def test_user_facing_work_prevents_maintenance_claim(monkeypatch):
    from studio_api import audio_preparation_worker as worker
    from studio_api import job_processing_runner
    from studio_api import transcript_maintenance_worker

    maintenance_calls = []
    monkeypatch.setattr("studio_api.worker_recovery.recover_expired_worker_jobs", lambda *a, **k: None)
    monkeypatch.setattr(
        worker,
        "claim_next_and_process_audio_preparation",
        lambda *args, **kwargs: None,
    )
    monkeypatch.setattr(
        job_processing_runner,
        "claim_next_and_orchestrate_processing_job",
        lambda *args, **kwargs: "transcription-result",
    )
    monkeypatch.setattr(
        transcript_maintenance_worker,
        "claim_next_and_process_transcript_maintenance",
        lambda *args, **kwargs: maintenance_calls.append(True),
    )

    assert worker.claim_next_studio_work(SimpleNamespace(commit=lambda: None)) == "transcription-result"
    assert maintenance_calls == []


def test_maintenance_worker_commits_claim_before_external_processing(monkeypatch):
    from studio_api import transcript_maintenance_worker as worker

    events = []

    class Db:
        def commit(self):
            events.append("commit")

        def rollback(self):
            events.append("rollback")

    run = SimpleNamespace(
        id="00000000-0000-4000-8000-000000000001",
        lease_generation=4,
    )
    monkeypatch.setattr(
        worker,
        "claim_next_transcript_maintenance_run",
        lambda *args, **kwargs: events.append("claim") or run,
    )

    def process(**kwargs):
        events.append("process")
        assert kwargs["run_id"] == run.id
        assert kwargs["lease_generation"] == 4
        return "processed"

    result = worker.claim_next_and_process_transcript_maintenance(
        Db(),
        lease_owner_id="worker:test",
        lease_ttl=timedelta(minutes=5),
        settings=SimpleNamespace(
            worker_lease_heartbeat_interval_seconds=60
        ),
        clock=lambda: datetime(2026, 8, 29, tzinfo=timezone.utc),
        processor=process,
    )

    assert result == "processed"
    assert events == ["claim", "commit", "process"]

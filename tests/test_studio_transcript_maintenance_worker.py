from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
import sys


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


def test_maintenance_runs_only_after_user_facing_queues_are_empty(monkeypatch):
    from studio_api import audio_preparation_worker as worker
    from studio_api import job_processing_runner
    from studio_api import transcript_maintenance_worker

    calls = []
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

    assert worker.claim_next_studio_work(object()) == "done"
    assert calls == ["audio", "transcription", "maintenance"]


def test_user_facing_work_prevents_maintenance_claim(monkeypatch):
    from studio_api import audio_preparation_worker as worker
    from studio_api import job_processing_runner
    from studio_api import transcript_maintenance_worker

    maintenance_calls = []
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

    assert worker.claim_next_studio_work(object()) == "transcription-result"
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

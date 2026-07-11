from __future__ import annotations

import logging
import sys
import threading
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path

import pytest
from pydantic import ValidationError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


@dataclass
class FakeSettings:
    worker_poll_interval_seconds: int = 5
    worker_error_backoff_seconds: int = 5
    worker_lease_ttl_seconds: int = 3600


class StopEvent:
    def __init__(self, stop_first=False):
        self.set_calls = 0; self.waits=[]; self._set=stop_first
    def is_set(self): return self._set
    def set(self): self.set_calls += 1; self._set = True
    def wait(self, seconds): self.waits.append(seconds); self._set=True; return True


class Session:
    def __init__(self, events): self.events=events
    def close(self): self.events.append("close")
    def rollback(self): self.events.append("rollback")


def test_worker_settings_defaults_and_bounds(monkeypatch):
    from studio_api.config import Settings
    for k in ["STUDIO_WORKER_POLL_INTERVAL_SECONDS", "STUDIO_WORKER_ERROR_BACKOFF_SECONDS", "STUDIO_WORKER_LEASE_TTL_SECONDS"]:
        monkeypatch.delenv(k, raising=False)
    s=Settings()
    assert (s.worker_poll_interval_seconds, s.worker_error_backoff_seconds, s.worker_lease_ttl_seconds)==(5,5,3600)
    assert Settings(worker_poll_interval_seconds=1, worker_error_backoff_seconds=1, worker_lease_ttl_seconds=300)
    assert Settings(worker_poll_interval_seconds=60, worker_error_backoff_seconds=300, worker_lease_ttl_seconds=86400)
    with pytest.raises(ValidationError): Settings(worker_poll_interval_seconds=0)
    with pytest.raises(ValidationError): Settings(worker_error_backoff_seconds=301)
    with pytest.raises(ValidationError): Settings(worker_lease_ttl_seconds=299)


def test_main_configuration_failure_is_normalized_before_db(monkeypatch, caplog):
    from studio_api import worker
    class BadSettings:
        def __init__(self): raise ValidationError.from_exception_data("Settings", [])
    monkeypatch.setattr("studio_api.config.Settings", BadSettings)
    caplog.set_level(logging.ERROR)
    assert worker.main() == 2
    assert "studio_worker_configuration_invalid" in caplog.text
    assert "999SECRET" not in caplog.text and "ValidationError" not in caplog.text


def test_owner_id_safe_stable_and_unique():
    from studio_api.worker import build_worker_owner_id
    a=build_worker_owner_id(hostname="raw-host-SECRET")
    b=build_worker_owner_id(hostname="raw-host-SECRET")
    assert a.startswith("studio-worker:") and len(a) <= 128
    assert b.startswith("studio-worker:") and a != b
    assert "raw-host" not in a and "SECRET" not in a


def test_idle_closes_session_then_waits_poll_interval(caplog):
    from studio_api.worker import run_worker_loop
    events=[]; stop=StopEvent(); caplog.set_level(logging.WARNING)
    def sf(): events.append("session"); return Session(events)
    def iteration(db, **kw): events.append(("iteration", kw["lease_owner_id"], kw["lease_ttl"])); return None
    assert run_worker_loop(settings=FakeSettings(), session_factory=sf, stop_event=stop, iteration=iteration, owner_id_factory=lambda:"owner") == 0
    assert events == ["session", ("iteration", "owner", timedelta(seconds=3600)), "close"]
    assert stop.waits == [5]
    assert caplog.text == ""


def test_success_logs_safe_result_and_uses_new_session(caplog):
    from types import SimpleNamespace
    from studio_api.worker import run_worker_loop
    caplog.set_level(logging.INFO)
    events=[]; stop=StopEvent(); calls={"n":0}
    def sf(): events.append("session"); return Session(events)
    def iteration(db, **kw):
        calls["n"]+=1
        if calls["n"]==1: return SimpleNamespace(job_id="job", final_job_status="completed", attempt_count=1, required_source_count=2, persisted_output_count=2, processed_source_count=2, completion_occurred=True)
        stop.set(); return None
    run_worker_loop(settings=FakeSettings(), session_factory=sf, stop_event=stop, iteration=iteration, owner_id_factory=lambda:"owner")
    assert events.count("session") == 2 and events.count("close") == 2
    assert stop.waits == []
    assert "studio_worker_job_processed" in caplog.text and "SECRET" not in caplog.text


def test_known_and_unexpected_errors_are_redacted_and_continue(caplog):
    from studio_api.worker import run_worker_loop
    class JobProcessingRunnerError(RuntimeError):
        def __init__(self):
            self.reason = type("R", (), {"value":"claim_failed"})()
            super().__init__("claim_failed")
    for unexpected in (False, True):
        caplog.clear(); events=[]; stop=StopEvent(); calls={"n":0}
        def sf(): return Session(events)
        def iteration(db, **kw):
            calls["n"] += 1
            if calls["n"] == 1:
                if unexpected: raise RuntimeError("SECRET token traceback")
                raise JobProcessingRunnerError()
            stop.set(); return None
        run_worker_loop(settings=FakeSettings(worker_error_backoff_seconds=7), session_factory=sf, stop_event=stop, iteration=iteration, owner_id_factory=lambda:"owner")
        assert stop.waits == [7]
        assert "SECRET" not in caplog.text and "traceback" not in caplog.text
        assert ("worker_iteration_failed" in caplog.text) is unexpected
        assert events[-1] == "close" and ("rollback" in events) is unexpected


def test_stop_before_claim_and_signal_handler(monkeypatch):
    from studio_api import worker
    stop=StopEvent(stop_first=True)
    assert worker.run_worker_loop(settings=FakeSettings(), session_factory=lambda: (_ for _ in ()).throw(AssertionError()), stop_event=stop, iteration=lambda *a, **k: None) == 0
    registered=[]
    monkeypatch.setattr(worker.signal, "signal", lambda sig, handler: registered.append(handler))
    ev=threading.Event(); worker.install_signal_handlers(ev); registered[0](None, None)
    assert ev.is_set()


def test_stop_during_active_iteration_no_second_claim():
    from studio_api.worker import run_worker_loop
    stop=StopEvent(); calls=[]
    def iteration(db, **kw): calls.append("iteration"); stop.set(); return None
    run_worker_loop(settings=FakeSettings(), session_factory=lambda: Session([]), stop_event=stop, iteration=iteration, owner_id_factory=lambda:"owner")
    assert calls == ["iteration"] and stop.waits == []

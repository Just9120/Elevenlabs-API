from __future__ import annotations

import io
import json
import logging
import subprocess
import sys
import threading
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/studio-api"))


def test_progress_deadline_is_operation_specific_and_not_renewed_by_other_threads():
    from studio_api.worker_progress import WorkerProgress, bind_worker_progress, worker_phase, touch_worker_progress
    now = [0]
    progress = WorkerProgress(clock=lambda: now[0])
    with bind_worker_progress(progress):
        with worker_phase("media_processing", 7230):
            now[0] = 7200
            assert progress.is_current()  # A legitimate two-hour encode is allowed.
            now[0] = 7231
            thread = threading.Thread(target=touch_worker_progress)
            thread.start(); thread.join()
            assert not progress.is_current()
        assert progress.is_current()  # Main thread actually returned from its operation.
        now[0] += 121
        assert not progress.is_current()


def test_runtime_heartbeat_does_not_report_stalled_main_as_healthy(monkeypatch):
    from studio_api import runtime_observability as runtime
    class Stop:
        stopped = False
        def is_set(self): return self.stopped
        def wait(self, _seconds): self.stopped = True
    writes = []
    monkeypatch.setattr(runtime, "record_worker_runtime_heartbeat", lambda *a, **k: writes.append(k))
    for current in (False, True):
        db = SimpleNamespace(close=lambda: None)
        heartbeat = runtime.WorkerRuntimeHeartbeat(
            session_factory=lambda: db, identity=None, instance_id="instance",
            interval_seconds=30, logger=logging.getLogger("test"), progress_check=lambda: current,
        )
        heartbeat.stop_event = Stop()
        heartbeat._run()
        assert len(writes) == int(current)


def test_background_housekeeping_runs_while_primary_work_is_blocked(monkeypatch):
    from studio_api.worker_background import WorkerBackground
    from studio_api import security_email
    active = threading.Event(); release = threading.Event(); delivered = threading.Event()
    stop = threading.Event(); events = []
    primary = threading.Thread(target=lambda: (active.set(), release.wait(5)))
    primary.start(); assert active.wait(2)
    monkeypatch.setattr(security_email, "process_one_security_email", lambda **kw: events.append("email") or True)
    background = WorkerBackground(
        settings=SimpleNamespace(worker_poll_interval_seconds=1),
        session_factory=lambda: SimpleNamespace(close=lambda: events.append("closed")),
        stop_event=stop, logger=logging.getLogger("test"), owner_id="owner",
        source_cleanup_runner=lambda *a, **k: events.append("cleanup") or False,
        job_notification_runner=lambda **k: events.append("notification") or True,
        alert_evaluator=lambda **k: events.append("evaluate"),
        alert_delivery_runner=lambda **k: (events.append("delivery"), delivered.set()),
    )
    try:
        background.start()
        assert delivered.wait(2)
        assert primary.is_alive()
    finally:
        background.stop_and_join()
        release.set(); primary.join(2)
    assert not background.thread.is_alive()
    assert events == ["cleanup", "closed", "email", "notification", "evaluate", "delivery"]


def test_production_selector_rotates_priority_under_continuous_backlog(monkeypatch):
    from studio_api import worker, audio_preparation_worker as selector
    seen = []; stop = threading.Event()
    def claim(db, **kwargs):
        seen.append(kwargs["work_order"][0])
        if len(seen) == 3: stop.set()
        return SimpleNamespace(stage="completed", job_id=None, status="completed", output_created=True)
    monkeypatch.setattr(selector, "claim_next_studio_work", claim)
    settings = SimpleNamespace(worker_lease_ttl_seconds=3600, worker_poll_interval_seconds=5, worker_error_backoff_seconds=5)
    worker.run_worker_loop(settings=settings, session_factory=lambda: SimpleNamespace(close=lambda: None),
                           stop_event=stop, independent_background=True)
    assert seen == ["audio", "transcription", "maintenance"]


def test_graceful_shutdown_waits_for_active_background_boundary(monkeypatch):
    from studio_api.worker_background import WorkerBackground
    from studio_api import security_email
    entered = threading.Event(); release = threading.Event(); joined = threading.Event()
    stop = threading.Event(); deliveries = []
    monkeypatch.setattr(security_email, "process_one_security_email", lambda **kw: deliveries.append(1))
    def cleanup(*args, **kwargs):
        entered.set()
        assert release.wait(3)
        return False
    background = WorkerBackground(
        settings=SimpleNamespace(worker_poll_interval_seconds=1),
        session_factory=lambda: SimpleNamespace(close=lambda: None),
        stop_event=stop, logger=logging.getLogger("test"), owner_id="owner", source_cleanup_runner=cleanup,
    )
    background.start(); assert entered.wait(2)
    def drain():
        background.stop_and_join()
        joined.set()
    observer = threading.Thread(target=drain); observer.start()
    try:
        assert stop.wait(2) and not joined.is_set()
    finally:
        release.set(); observer.join(3)
    assert joined.is_set() and not background.thread.is_alive() and deliveries == []


def test_unknown_error_has_stage_and_correlation_but_no_payload_or_traceback():
    from studio_api.worker import run_worker_loop
    from studio_api.worker_logging import WorkerLogFormatter
    from studio_api.worker_progress import WorkerProgress, bind_worker_progress, worker_phase
    output = io.StringIO(); handler = logging.StreamHandler(output); handler.setFormatter(WorkerLogFormatter())
    logger = logging.Logger("isolated-worker-test"); logger.addHandler(handler)
    class Stop:
        def is_set(self): return False
        def wait(self, _seconds): raise KeyboardInterrupt
    def iteration(*a, **k):
        with worker_phase("media_preparation", 60):
            raise ValueError("SECRET https://private/path?token=123 transcript-body")
    settings = SimpleNamespace(worker_lease_ttl_seconds=3600, worker_poll_interval_seconds=5, worker_error_backoff_seconds=5)
    with bind_worker_progress(WorkerProgress()), pytest.raises(KeyboardInterrupt):
        run_worker_loop(settings=settings, session_factory=lambda: SimpleNamespace(close=lambda: None, rollback=lambda: None),
                        stop_event=Stop(), iteration=iteration, logger=logger)
    record = json.loads(output.getvalue())
    assert record["error_type"] == "ValueError" and record["stage"] == "media_preparation"
    assert len(record["iteration_id"]) == 36
    assert not any(text in output.getvalue() for text in ("SECRET", "private", "transcript-body", "Traceback"))


def test_cancel_during_owned_media_subprocess_reaps_child(monkeypatch):
    from studio_api.preparation_control import preparation_control, controlled_runner, PreparationInterrupted
    children = []; calls = []
    real_popen = subprocess.Popen
    def popen(*args, **kwargs):
        child = real_popen(*args, **kwargs); children.append(child); return child
    monkeypatch.setattr(subprocess, "Popen", popen)
    def check():
        calls.append(1)
        if len(calls) >= 3: raise RuntimeError("cancelled")
    with preparation_control(check), pytest.raises(PreparationInterrupted):
        controlled_runner(subprocess.run)([sys.executable, "-c", "import time; time.sleep(30)"],
                                          check=True, capture_output=True, timeout=30)
    assert len(children) == 1 and children[0].poll() is not None
    assert children[0].stdout.closed and children[0].stderr.closed

from __future__ import annotations

import sys
from datetime import datetime, timedelta
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


class Session:
    def __init__(self, events, fail_commit=False):
        self.events = events; self.fail_commit = fail_commit
    def commit(self):
        self.events.append(("commit", id(self)))
        if self.fail_commit: raise RuntimeError("raw SECRET db failure")
    def rollback(self): self.events.append(("rollback", id(self)))
    def close(self): self.events.append(("close", id(self)))


def test_renew_uses_fresh_session_exact_fence_commits_and_closes():
    from studio_api.job_lease_heartbeat import LeaseHeartbeat, LEASE_HEARTBEAT_STAGE_SOURCE_PROVIDER
    events=[]; sessions=[]; calls=[]
    def sf():
        s=Session(events); sessions.append(s); return s
    def renewer(db, **kw): calls.append((db, kw))
    hb=LeaseHeartbeat(session_factory=sf, job_id="job", lease_owner_id="owner", lease_generation=7, lease_ttl=timedelta(seconds=300), heartbeat_interval=timedelta(seconds=60), stage=LEASE_HEARTBEAT_STAGE_SOURCE_PROVIDER, clock=lambda: datetime(2026,1,1), lease_renewer=renewer)
    hb._renew_once(); hb._renew_once()
    assert len(sessions)==2 and calls[0][0] is sessions[0] and calls[1][0] is sessions[1]
    assert calls[0][1]["job_id"] == "job" and calls[0][1]["lease_owner_id"] == "owner" and calls[0][1]["lease_generation"] == 7
    assert [e[0] for e in events] == ["commit", "close", "commit", "close"]
    assert hb.renewal_count == 2 and not hb.failed


def test_job_lease_error_rolls_back_closes_and_normalizes_reason():
    from studio_api.job_lease_heartbeat import LeaseHeartbeat, LEASE_HEARTBEAT_STAGE_SOURCE_PROVIDER
    class JobLeaseError(RuntimeError):
        def __init__(self):
            self.reason = type("Reason", (), {"value": "lease_not_owned"})()
    events=[]
    def renewer(db, **kw): raise JobLeaseError()
    hb=LeaseHeartbeat(session_factory=lambda: Session(events), job_id="job", lease_owner_id="owner", lease_generation=1, lease_ttl=timedelta(seconds=300), heartbeat_interval=timedelta(seconds=60), stage=LEASE_HEARTBEAT_STAGE_SOURCE_PROVIDER, lease_renewer=renewer)
    hb._renew_once()
    assert [e[0] for e in events] == ["rollback", "close"]
    assert hb.failed and hb.failure_reason == "lease_heartbeat_not_owned"
    assert "SECRET" not in repr(hb.result()) and "RuntimeError" not in repr(hb.result())


def test_commit_failure_rolls_back_and_is_redacted():
    from studio_api.job_lease_heartbeat import LeaseHeartbeat, LEASE_HEARTBEAT_STAGE_SOURCE_PROVIDER
    events=[]
    hb=LeaseHeartbeat(session_factory=lambda: Session(events, fail_commit=True), job_id="job", lease_owner_id="owner", lease_generation=1, lease_ttl=timedelta(seconds=300), heartbeat_interval=timedelta(seconds=60), stage=LEASE_HEARTBEAT_STAGE_SOURCE_PROVIDER, lease_renewer=lambda db, **kw: None)
    hb._renew_once()
    assert [e[0] for e in events] == ["commit", "rollback", "close"]
    assert hb.failure_reason == "lease_heartbeat_commit_failed"
    assert "SECRET" not in repr(hb.result())


class ManualEvent:
    def __init__(self): self.set_called=False; self.waits=0
    def wait(self, seconds): self.waits += 1; return self.set_called
    def set(self): self.set_called=True

class ManualThread:
    def __init__(self, target, name=None): self.target=target; self.alive=False; self.name=name
    def start(self): self.alive=True
    def join(self, timeout=None): self.alive=False
    def is_alive(self): return self.alive


def test_controller_stop_join_ends_stage_without_extra_renewal():
    from studio_api.job_lease_heartbeat import LeaseHeartbeat, LEASE_HEARTBEAT_STAGE_GOOGLE_OUTPUT
    event=ManualEvent(); threads=[]
    hb=LeaseHeartbeat(session_factory=lambda: Session([]), job_id="job", lease_owner_id="owner", lease_generation=1, lease_ttl=timedelta(seconds=300), heartbeat_interval=timedelta(seconds=60), stage=LEASE_HEARTBEAT_STAGE_GOOGLE_OUTPUT, event_factory=lambda: event, thread_factory=lambda **kw: threads.append(ManualThread(**kw)) or threads[-1])
    hb.start(); hb.stop(); result=hb.join()
    assert event.set_called and not threads[0].is_alive()
    assert result.renewal_count == 0 and not result.failed


def test_join_timeout_fails_closed():
    from studio_api.job_lease_heartbeat import LeaseHeartbeat, LEASE_HEARTBEAT_STAGE_GOOGLE_OUTPUT, LeaseHeartbeatError
    class SlowThenDone(ManualThread):
        def __init__(self, **kw): super().__init__(**kw); self.joins=0
        def join(self, timeout=None):
            self.joins += 1
            if self.joins >= 2: self.alive=False
    hb=LeaseHeartbeat(session_factory=lambda: Session([]), job_id="job", lease_owner_id="owner", lease_generation=1, lease_ttl=timedelta(seconds=300), heartbeat_interval=timedelta(seconds=60), stage=LEASE_HEARTBEAT_STAGE_GOOGLE_OUTPUT, thread_factory=lambda **kw: SlowThenDone(**kw))
    hb.start(); hb.stop(); result=hb.join()
    assert result.failed and result.reason == "lease_heartbeat_stop_timeout"
    assert not hb.thread_alive
    with pytest.raises(LeaseHeartbeatError): hb.check()


def test_no_redis_or_lease_lifecycle_calls_in_helper_source():
    text = (ROOT / "apps/studio-api/studio_api/job_lease_heartbeat.py").read_text(encoding="utf-8")
    assert "redis" not in text.lower()
    assert "acquire_" not in text and "release_job_lease" not in text and "recover" not in text.lower()


def test_context_preserves_external_exception_when_heartbeat_success():
    from studio_api.job_lease_heartbeat import LeaseHeartbeat, LEASE_HEARTBEAT_STAGE_SOURCE_PROVIDER, lease_heartbeat_stage
    hb=LeaseHeartbeat(session_factory=lambda: Session([]), job_id="job", lease_owner_id="owner", lease_generation=1, lease_ttl=timedelta(seconds=300), heartbeat_interval=timedelta(seconds=60), stage=LEASE_HEARTBEAT_STAGE_SOURCE_PROVIDER, thread_factory=lambda **kw: ManualThread(**kw))
    class ProviderError(RuntimeError): pass
    with pytest.raises(ProviderError):
        with lease_heartbeat_stage(hb):
            raise ProviderError("SECRET provider raw")
    assert not hb.thread_alive


def test_context_heartbeat_failure_wins_over_external_exception():
    from studio_api.job_lease_heartbeat import LeaseHeartbeat, LeaseHeartbeatError, LeaseHeartbeatFailureReason, LEASE_HEARTBEAT_STAGE_SOURCE_PROVIDER, lease_heartbeat_stage
    hb=LeaseHeartbeat(session_factory=lambda: Session([]), job_id="job", lease_owner_id="owner", lease_generation=1, lease_ttl=timedelta(seconds=300), heartbeat_interval=timedelta(seconds=60), stage=LEASE_HEARTBEAT_STAGE_SOURCE_PROVIDER, thread_factory=lambda **kw: ManualThread(**kw))
    hb._set_failed(LeaseHeartbeatFailureReason.lease_heartbeat_expired)
    class ProviderError(RuntimeError): pass
    with pytest.raises(LeaseHeartbeatError) as excinfo:
        with lease_heartbeat_stage(hb):
            raise ProviderError("SECRET provider raw")
    assert excinfo.value.reason.value == "lease_heartbeat_expired"
    assert isinstance(excinfo.value.__cause__, ProviderError)
    assert "SECRET" not in str(excinfo.value) + repr(hb.result())
    assert not hb.thread_alive


def test_context_stop_timeout_wins_and_thread_dead_before_return():
    from studio_api.job_lease_heartbeat import LeaseHeartbeat, LeaseHeartbeatError, LEASE_HEARTBEAT_STAGE_GOOGLE_OUTPUT, lease_heartbeat_stage
    class SlowThenDone(ManualThread):
        def __init__(self, **kw): super().__init__(**kw); self.joins=0
        def join(self, timeout=None):
            self.joins += 1
            if self.joins >= 2: self.alive=False
    thread_holder=[]
    hb=LeaseHeartbeat(session_factory=lambda: Session([]), job_id="job", lease_owner_id="owner", lease_generation=1, lease_ttl=timedelta(seconds=300), heartbeat_interval=timedelta(seconds=60), stage=LEASE_HEARTBEAT_STAGE_GOOGLE_OUTPUT, thread_factory=lambda **kw: thread_holder.append(SlowThenDone(**kw)) or thread_holder[-1])
    class GoogleError(RuntimeError): pass
    with pytest.raises(LeaseHeartbeatError) as excinfo:
        with lease_heartbeat_stage(hb):
            raise GoogleError("SECRET google raw")
    assert excinfo.value.reason.value == "lease_heartbeat_stop_timeout"
    assert isinstance(excinfo.value.__cause__, GoogleError)
    assert not hb.thread_alive and not thread_holder[0].is_alive()


def test_successful_stage_with_failed_heartbeat_raises_heartbeat_error():
    from studio_api.job_lease_heartbeat import LeaseHeartbeat, LeaseHeartbeatError, LeaseHeartbeatFailureReason, LEASE_HEARTBEAT_STAGE_SOURCE_PROVIDER, lease_heartbeat_stage
    hb=LeaseHeartbeat(session_factory=lambda: Session([]), job_id="job", lease_owner_id="owner", lease_generation=1, lease_ttl=timedelta(seconds=300), heartbeat_interval=timedelta(seconds=60), stage=LEASE_HEARTBEAT_STAGE_SOURCE_PROVIDER, thread_factory=lambda **kw: ManualThread(**kw))
    hb._set_failed(LeaseHeartbeatFailureReason.lease_heartbeat_failed)
    with pytest.raises(LeaseHeartbeatError):
        with lease_heartbeat_stage(hb):
            pass
    assert not hb.thread_alive


def test_timeout_configurator_applied_before_renew_and_timeout_failure_closes():
    from studio_api.job_lease_heartbeat import LeaseHeartbeat, LEASE_HEARTBEAT_STAGE_SOURCE_PROVIDER
    events=[]
    class Db(Session): pass
    def config(db, seconds): events.append(("timeout", seconds))
    def renewer(db, **kw): events.append("renew"); raise RuntimeError("SECRET db timeout text")
    hb=LeaseHeartbeat(session_factory=lambda: Db(events), job_id="job", lease_owner_id="owner", lease_generation=1, lease_ttl=timedelta(seconds=300), heartbeat_interval=timedelta(seconds=60), stage=LEASE_HEARTBEAT_STAGE_SOURCE_PROVIDER, lease_renewer=renewer, timeout_configurator=config, db_operation_timeout=2.0, join_timeout=3.0)
    hb._renew_once()
    assert events[0] == ("timeout", 2.0)
    assert events[1] == "renew"
    assert [e[0] for e in events if isinstance(e, tuple) and e[0] in {"rollback", "close"}] == ["rollback", "close"]
    assert hb.failure_reason == "lease_heartbeat_commit_failed"
    assert "SECRET" not in repr(hb.result())

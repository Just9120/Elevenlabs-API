from __future__ import annotations

import threading
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Callable

from .security import utcnow

LEASE_HEARTBEAT_STAGE_SOURCE_PROVIDER = "source_provider"
LEASE_HEARTBEAT_STAGE_GOOGLE_OUTPUT = "google_output"
LEASE_HEARTBEAT_STAGES = frozenset({LEASE_HEARTBEAT_STAGE_SOURCE_PROVIDER, LEASE_HEARTBEAT_STAGE_GOOGLE_OUTPUT})


class LeaseHeartbeatFailureReason(str, Enum):
    lease_heartbeat_failed = "lease_heartbeat_failed"
    lease_heartbeat_not_owned = "lease_heartbeat_not_owned"
    lease_heartbeat_expired = "lease_heartbeat_expired"
    lease_heartbeat_commit_failed = "lease_heartbeat_commit_failed"
    lease_heartbeat_stop_timeout = "lease_heartbeat_stop_timeout"


class LeaseHeartbeatError(RuntimeError):
    def __init__(self, reason: LeaseHeartbeatFailureReason):
        self.reason = reason
        super().__init__(reason.value)


@dataclass(frozen=True)
class LeaseHeartbeatResult:
    stage: str
    renewal_count: int
    failed: bool
    reason: str | None = None

    def __repr__(self) -> str:
        return (
            "LeaseHeartbeatResult("
            f"stage={self.stage!r}, renewal_count={self.renewal_count!r}, "
            f"failed={self.failed!r}, reason={self.reason!r})"
        )


class LeaseHeartbeat:
    def __init__(
        self,
        *,
        session_factory: Callable,
        job_id: str,
        lease_owner_id: str,
        lease_generation: int,
        lease_ttl: timedelta,
        heartbeat_interval: timedelta,
        stage: str,
        clock: Callable[[], datetime] | None = None,
        lease_renewer: Callable | None = None,
        event_factory: Callable[[], threading.Event] = threading.Event,
        thread_factory: Callable[..., threading.Thread] = threading.Thread,
        join_timeout: float = 5.0,
    ):
        if stage not in LEASE_HEARTBEAT_STAGES:
            raise ValueError("invalid heartbeat stage")
        self.session_factory = session_factory
        self.job_id = job_id
        self.lease_owner_id = lease_owner_id
        self.lease_generation = lease_generation
        self.lease_ttl = lease_ttl
        self.heartbeat_interval = heartbeat_interval
        self.stage = stage
        self.clock = clock or (lambda: utcnow().replace(tzinfo=None))
        self.lease_renewer = lease_renewer or _default_lease_renewer
        self._stop_event = event_factory()
        self._thread_factory = thread_factory
        self._join_timeout = join_timeout
        self._thread = None
        self._renewal_count = 0
        self._failed_reason: LeaseHeartbeatFailureReason | None = None
        self._lock = threading.Lock()

    @property
    def renewal_count(self) -> int:
        with self._lock:
            return self._renewal_count

    @property
    def failed(self) -> bool:
        with self._lock:
            return self._failed_reason is not None

    @property
    def failure_reason(self) -> str | None:
        with self._lock:
            return self._failed_reason.value if self._failed_reason else None

    def start(self) -> None:
        if self._thread is not None:
            raise RuntimeError("heartbeat already started")
        self._thread = self._thread_factory(target=self._run, name=f"studio-lease-heartbeat-{self.stage}")
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()

    def join(self) -> LeaseHeartbeatResult:
        if self._thread is not None:
            self._thread.join(timeout=self._join_timeout)
            if self._thread.is_alive():
                self._set_failed(LeaseHeartbeatFailureReason.lease_heartbeat_stop_timeout)
        return self.result()

    def stop_and_join(self) -> LeaseHeartbeatResult:
        self.stop()
        return self.join()

    def check(self) -> None:
        reason = self.failure_reason
        if reason:
            raise LeaseHeartbeatError(LeaseHeartbeatFailureReason(reason))

    def result(self) -> LeaseHeartbeatResult:
        return LeaseHeartbeatResult(self.stage, self.renewal_count, self.failed, self.failure_reason)

    def _run(self) -> None:
        seconds = max(0.0, self.heartbeat_interval.total_seconds())
        while not self._stop_event.wait(seconds):
            if self.failed:
                return
            self._renew_once()
            if self.failed:
                return

    def _renew_once(self) -> None:
        db = None
        try:
            db = self.session_factory()
            self.lease_renewer(
                db,
                job_id=self.job_id,
                lease_owner_id=self.lease_owner_id,
                lease_generation=self.lease_generation,
                now=self.clock(),
                lease_ttl=self.lease_ttl,
            )
            db.commit()
            with self._lock:
                self._renewal_count += 1
        except Exception as exc:
            if db is not None:
                _rollback(db)
            if _looks_like_job_lease_error(exc):
                self._set_failed(_map_lease_reason(getattr(exc, "reason", None)))
            else:
                self._set_failed(LeaseHeartbeatFailureReason.lease_heartbeat_commit_failed)
        finally:
            if db is not None:
                try:
                    db.close()
                except Exception:
                    pass

    def _set_failed(self, reason: LeaseHeartbeatFailureReason) -> None:
        with self._lock:
            if self._failed_reason is None:
                self._failed_reason = reason


def _rollback(db) -> None:
    try:
        db.rollback()
    except Exception:
        pass


def _default_lease_renewer(*args, **kwargs):
    from .job_claim_lease import renew_job_lease

    return renew_job_lease(*args, **kwargs)

def _looks_like_job_lease_error(exc: BaseException) -> bool:
    return exc.__class__.__name__ == "JobLeaseError" and hasattr(exc, "reason")

def _map_lease_reason(reason) -> LeaseHeartbeatFailureReason:
    value = getattr(reason, "value", reason)
    if value == "lease_not_owned":
        return LeaseHeartbeatFailureReason.lease_heartbeat_not_owned
    if value == "lease_not_active":
        return LeaseHeartbeatFailureReason.lease_heartbeat_expired
    return LeaseHeartbeatFailureReason.lease_heartbeat_failed


class lease_heartbeat_stage:
    def __init__(self, heartbeat: LeaseHeartbeat):
        self.heartbeat = heartbeat

    def __enter__(self) -> LeaseHeartbeat:
        self.heartbeat.start()
        return self.heartbeat

    def __exit__(self, exc_type, exc, tb) -> bool:
        self.heartbeat.stop_and_join()
        return False

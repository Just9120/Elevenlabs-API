from __future__ import annotations

from datetime import datetime, timedelta
from typing import Callable

from sqlalchemy.orm import Session

from .job_lease_heartbeat import (
    LEASE_HEARTBEAT_STAGE_MAINTENANCE,
    LeaseHeartbeat,
    lease_heartbeat_stage,
)
from .security import utcnow
from .transcript_maintenance_runs import (
    claim_next_transcript_maintenance_run,
    process_claimed_transcript_maintenance_run,
    renew_transcript_maintenance_lease,
)


def claim_next_and_process_transcript_maintenance(
    db: Session,
    *,
    lease_owner_id: str,
    lease_ttl: timedelta,
    settings,
    clock: Callable[[], datetime] | None = None,
    processor: Callable = process_claimed_transcript_maintenance_run,
    heartbeat_session_factory: Callable | None = None,
    heartbeat_controller_factory: Callable = LeaseHeartbeat,
    **_ignored,
):
    now = (clock or utcnow)()
    try:
        run = claim_next_transcript_maintenance_run(
            db,
            lease_owner_id=lease_owner_id,
            now=now,
            lease_ttl=lease_ttl,
        )
        if run is None:
            db.rollback()
            return None
        run_id = run.id
        generation = run.lease_generation
        db.commit()
    except Exception:
        db.rollback()
        raise
    kwargs = dict(
        db=db,
        run_id=run_id,
        lease_owner_id=lease_owner_id,
        lease_generation=generation,
        settings=settings,
    )
    if heartbeat_session_factory is None:
        return processor(**kwargs)
    heartbeat = heartbeat_controller_factory(
        session_factory=heartbeat_session_factory,
        job_id=run_id,
        lease_owner_id=lease_owner_id,
        lease_generation=generation,
        lease_ttl=lease_ttl,
        heartbeat_interval=timedelta(
            seconds=settings.worker_lease_heartbeat_interval_seconds
        ),
        stage=LEASE_HEARTBEAT_STAGE_MAINTENANCE,
        lease_renewer=renew_transcript_maintenance_lease,
    )
    with lease_heartbeat_stage(heartbeat):
        return processor(**kwargs)

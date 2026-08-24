from __future__ import annotations

from datetime import datetime, timedelta
from typing import Callable

from sqlalchemy.orm import Session

from .audio_preparation_processor import process_claimed_audio_preparation_job
from .audio_preparation_service import claim_next_audio_preparation_job
from .security import utcnow


def claim_next_and_process_audio_preparation(
    db: Session,
    *,
    lease_owner_id: str,
    lease_ttl: timedelta,
    settings,
    clock: Callable[[], datetime] | None = None,
    processor: Callable = process_claimed_audio_preparation_job,
    **_ignored,
):
    now = (clock or utcnow)()
    try:
        job = claim_next_audio_preparation_job(
            db,
            lease_owner_id=lease_owner_id,
            now=now,
            lease_ttl=lease_ttl,
        )
        if job is None:
            db.rollback()
            return None
        job_id = job.id
        generation = job.lease_generation
        db.commit()
    except Exception:
        db.rollback()
        raise
    return processor(
        db,
        job_id=job_id,
        lease_owner_id=lease_owner_id,
        lease_generation=generation,
        settings=settings,
        now=now,
    )


def claim_next_studio_work(db: Session, **kwargs):
    audio_result = claim_next_and_process_audio_preparation(db, **kwargs)
    if audio_result is not None:
        return audio_result
    from .job_processing_runner import claim_next_and_orchestrate_processing_job

    return claim_next_and_orchestrate_processing_job(db, **kwargs)

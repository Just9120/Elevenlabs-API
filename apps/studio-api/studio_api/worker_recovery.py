"""Bounded database-only recovery; never dispatch providers or create outputs."""
from datetime import datetime

from sqlalchemy import or_, select

from .job_processing_lifecycle import recover_expired_processing_job
from .models import JobStatus, TranscriptionJob


def recover_expired_worker_jobs(db, *, now: datetime, limit: int = 10) -> int:
    jobs = db.execute(
        select(TranscriptionJob)
        .where(
            TranscriptionJob.status == JobStatus.processing,
            or_(TranscriptionJob.lease_expires_at.is_(None), TranscriptionJob.lease_expires_at <= now),
        )
        .order_by(TranscriptionJob.lease_expires_at.asc(), TranscriptionJob.id.asc())
        .limit(max(1, min(limit, 50)))
        .with_for_update(skip_locked=True)
    ).scalars().all()
    for job in jobs:
        # The lifecycle revalidates the lock/lease and existing output/accounting
        # authority. Unknown or possibly paid outcomes become attention states.
        recover_expired_processing_job(db, job_id=job.id, now=now)
    db.flush()
    return len(jobs)

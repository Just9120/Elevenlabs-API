"""Export recovery from encrypted checkpoints without source or provider I/O."""
from contextlib import contextmanager
from types import SimpleNamespace

from sqlalchemy import select
from sqlalchemy.orm import object_session

from .models import TranscriptionJob, TranscriptionProviderPartCheckpoint, Project, JobStatus
from .job_claim_lease import is_lease_active
from .provider_part_checkpoints import (
    ProviderPartCheckpointError, ProviderPartCheckpointReason,
    complete_provider_attempt, checkpoint_resume_count, load_provider_part_checkpoints,
)
from .elevenlabs_transcription import merge_elevenlabs_transcript_results


def fully_cached_relation(db, job, relation_id, now):
    if job.provider != "elevenlabs":
        return False
    attempt = complete_provider_attempt(db, job_id=job.id, job_source_id=relation_id)
    return attempt is not None and checkpoint_resume_count(
        db, job_source_id=relation_id, total_parts=attempt.provider_total_parts,
        completed_parts=int(attempt.provider_completed_parts), now=now,
    ) == attempt.provider_total_parts


def cached_relations(job, now):
    """Metadata readiness only; execution always validates ciphertext and lease."""
    if not isinstance(job, TranscriptionJob):
        return frozenset()
    db = object_session(job)
    if db is None:
        return frozenset()
    return frozenset(rel.id for rel in job.sources if fully_cached_relation(db, job, rel.id, now))


@contextmanager
def restore_cached_transcript(db, *, job_id, job_source_id, lease_owner_id, lease_generation, settings, now):
    from .job_retry_recovery import mark_attempt_provider_started, mark_attempt_provider_returned
    job = db.get(TranscriptionJob, job_id)
    project = db.get(Project, job.project_id) if job else None
    if (job is None or job.status != JobStatus.processing or job.cancel_requested_at is not None
        or job.lease_owner_id != lease_owner_id or job.lease_generation != lease_generation
        or not is_lease_active(job, now) or project is None or project.archived_at is not None
        or project.owner_user_id != job.owner_user_id):
        raise ProviderPartCheckpointError(ProviderPartCheckpointReason.scope_conflict)
    attempt = complete_provider_attempt(db, job_id=job_id, job_source_id=job_source_id, before_attempt=job.attempt_count)
    if attempt is None:
        raise ProviderPartCheckpointError(ProviderPartCheckpointReason.complete_set_unavailable)
    rows = db.execute(select(TranscriptionProviderPartCheckpoint).where(
        TranscriptionProviderPartCheckpoint.job_source_id == job_source_id,
    ).order_by(TranscriptionProviderPartCheckpoint.part_index).limit(10001)).scalars().all()
    if len(rows) != attempt.provider_total_parts or len(rows) > 10000:
        raise ProviderPartCheckpointError(ProviderPartCheckpointReason.complete_set_unavailable)
    parts = tuple(SimpleNamespace(timeline_offset_seconds=row.timeline_offset_seconds,
        duration_seconds=row.duration_seconds) for row in rows)
    results = load_provider_part_checkpoints(db, job_id=job_id, job_source_id=job_source_id,
        parts=parts, settings=settings, now=now, require_complete=True)
    result = None
    try:
        # This transition records reuse, not new billed transport; no usage
        # accounting begin/confirm is performed for restored provider text.
        mark_attempt_provider_started(db, job_id=job_id, job_source_id=job_source_id,
            lease_owner_id=lease_owner_id, lease_generation=lease_generation,
            now=now, total_parts=len(parts), completed_parts=len(parts))
        mark_attempt_provider_returned(db, job_id=job_id, job_source_id=job_source_id,
            lease_owner_id=lease_owner_id, lease_generation=lease_generation, now=now)
        db.commit()
        if len(results) == 1:
            result = results[0]
        else:
            from .job_elevenlabs_transcription import _merge_inputs
            result = merge_elevenlabs_transcript_results(_merge_inputs(SimpleNamespace(parts=parts), list(results)))
        if not result.text.strip():
            raise ProviderPartCheckpointError(ProviderPartCheckpointReason.payload_invalid)
        yield result
    finally:
        if result is not None:
            result.revoke()
        for transcript in results:
            transcript.revoke()

"""Real row locking in an owned synthetic schema; no external services called."""
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/studio-api"))


def test_expired_sweep_is_bounded_skip_locked_and_transactional():
    from studio_api.db import Base, engine
    from studio_api import models as m
    from studio_api.worker_recovery import recover_expired_worker_jobs
    if engine.dialect.name != "postgresql":
        if os.environ.get("CI") == "true":
            pytest.fail("PostgreSQL recovery contract is required in CI")
        pytest.skip("PostgreSQL row locking is verified by required Linux CI")
    assert engine.url.host in {"127.0.0.1", "localhost"} and engine.url.database == "studio_test"
    schema = "worker_recovery_" + uuid.uuid4().hex
    isolated = engine.execution_options(schema_translate_map={None: schema})
    with engine.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    try:
        Base.metadata.create_all(isolated)
        now = datetime.now(timezone.utc)
        with Session(isolated) as db:
            user = m.User(email=f"{schema}@example.test", role=m.UserRole.admin, status=m.UserStatus.active)
            db.add(user); db.flush()
            project = m.Project(owner_user_id=user.id, title="Synthetic worker recovery")
            db.add(project); db.flush()
            jobs = [m.TranscriptionJob(project_id=project.id, owner_user_id=user.id,
                        status=m.JobStatus.processing, lease_owner_id="old-worker", lease_generation=1,
                        lease_expires_at=now + timedelta(seconds=60 if index == 2 else -60),
                        cancel_requested_at=now, attempt_count=1) for index in range(3)]
            db.add_all(jobs); db.flush()
            ids = [job.id for job in jobs]
            db.commit()
        with Session(isolated) as first, Session(isolated) as second:
            assert recover_expired_worker_jobs(first, now=now, limit=1) == 1
            # First keeps its row lock; a second worker must skip it, not wait
            # or recover the same generation. Each pass remains bounded.
            second.execute(text("SET LOCAL lock_timeout = '1s'"))
            assert recover_expired_worker_jobs(second, now=now, limit=1) == 1
            second.commit()
            first.rollback()
            assert recover_expired_worker_jobs(second, now=now, limit=10) == 1
            second.commit()
            rows = [second.get(m.TranscriptionJob, job_id) for job_id in ids]
            assert [job.status for job in rows] == [m.JobStatus.cancelled, m.JobStatus.cancelled, m.JobStatus.processing]
            assert all(job.lease_owner_id is None and job.lease_expires_at is None for job in rows[:2])
            assert rows[2].lease_owner_id == "old-worker" and rows[2].lease_generation == 1
    finally:
        with engine.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))

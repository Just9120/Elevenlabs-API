"""An older backup must not restore active identities, grants or queued work."""
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy import create_engine, select, text
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Session as DbSession

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/studio-api"))
from studio_api.db import Base
from studio_api.models import (
    AudioPreparationJob, AudioPreparationStatus, GoogleConnection, GoogleConnectionStatus,
    JobStatus, Project, RealtimeTranscriptDraft, Session, TranscriptionJob, TrustedDevice, User, UserStatus,
    JobNotificationDelivery,
)
from studio_api.recovery_quarantine import quarantine_restored_database, quarantine_statements


@pytest.mark.parametrize("execution", ["orm", "literal_sql"])
def test_restore_quarantines_work_and_auth_without_erasing_recovery_content(execution):
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 10, 6, tzinfo=timezone.utc)
    with DbSession(engine) as db:
        user = User(id="owner", email="owner@example.test")
        project = Project(id="workspace", owner_user_id=user.id, title="Synthetic")
        db.add_all([user, project])
        db.flush()
        session = Session(user_id=user.id, token_hash="s" * 64, csrf_hash="c" * 64,
            expires_at=now + timedelta(days=1), reauthenticated_at=now)
        trusted = TrustedDevice(user_id=user.id, token_hash="t" * 64, expires_at=now + timedelta(days=30))
        job = TranscriptionJob(owner_user_id=user.id, project_id=project.id, status=JobStatus.processing,
            lease_owner_id="old-worker", lease_generation=9, automatic_retry_reason="provider_rate_limited")
        audio = AudioPreparationJob(owner_user_id=user.id, project_id=project.id,
            status=AudioPreparationStatus.processing, title="Synthetic", options_json="{}", output_destination="download",
            download_slot=1, download_request_id="old-transfer", lease_generation=2)
        connection = GoogleConnection(user_id=user.id, refresh_token_ciphertext=b"opaque", refresh_token_nonce=b"nonce")
        draft = RealtimeTranscriptDraft(owner_user_id=user.id, project_id=project.id, client_session_id="a" * 20,
            revision=1, ciphertext=b"encrypted-restored-text", nonce=b"n", key_id="test",
            payload_hmac="h" * 64, committed_segment_count=1, committed_character_count=5, partial_character_count=0)
        db.add_all([session, trusted, job, audio, connection, draft])
        db.flush()
        notification = JobNotificationDelivery(owner_user_id=user.id, job_id=job.id,
            terminal_status="failed", attempt_number=1, channel="email", destination_id="synthetic",
            state="claimed", claim_token="old-claim", claim_expires_at=now + timedelta(minutes=1))
        db.add(notification)
        db.commit()
        if execution == "literal_sql":
            # This is the same serialization used by the offline psql drill.
            for statement in quarantine_statements(now):
                sql = str(statement.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
                db.execute(text(sql))
            result = {"automatic_activation": False}
        else:
            result = quarantine_restored_database(db, now=now)
        db.commit()
        db.expire_all()
        assert result["automatic_activation"] is False
        assert user.status == UserStatus.disabled and project.archived_at is not None
        assert session.revoked_at is not None and session.reauthenticated_at is None and trusted.revoked_at is not None
        assert connection.status == GoogleConnectionStatus.revoked
        assert job.status == JobStatus.failed and job.lease_generation == 10 and job.lease_owner_id is None
        assert job.automatic_retry_reason is None and job.error_code == "restore_manual_review_required"
        assert audio.status == AudioPreparationStatus.failed and audio.download_slot is None
        assert notification.state == "suppressed" and notification.claim_token is None
        assert notification.claim_expires_at is None and notification.next_attempt_at is None
        assert db.scalar(select(RealtimeTranscriptDraft.ciphertext)) == b"encrypted-restored-text"
        assert quarantine_restored_database(db, now=now)["quarantined_rows"] == 0
    engine.dispose()

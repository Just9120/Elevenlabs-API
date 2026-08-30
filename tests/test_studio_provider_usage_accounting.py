from __future__ import annotations

import sys
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine
from sqlalchemy.orm import Session


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


@pytest.fixture
def db(monkeypatch):
    monkeypatch.setenv("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")
    from studio_api.config import get_settings

    get_settings.cache_clear()
    from studio_api.db import Base
    import studio_api.models  # noqa: F401

    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as session:
        yield session
    Base.metadata.drop_all(engine)
    engine.dispose()


def _context(db: Session, *, parts: int = 2):
    from studio_api import models as m

    now = datetime(2026, 8, 30, 12, 0, 0)
    user = m.User(email="usage@example.test")
    db.add(user)
    db.flush()
    project = m.Project(owner_user_id=user.id, title="Usage")
    db.add(project)
    db.flush()
    source = m.Source(
        project_id=project.id,
        source_type=m.SourceType.local_upload,
        original_filename="private.mp3",
        upload_status=m.SourceUploadStatus.uploaded,
    )
    db.add(source)
    db.flush()
    job = m.TranscriptionJob(
        project_id=project.id,
        owner_user_id=user.id,
        provider="elevenlabs",
        status=m.JobStatus.processing,
        attempt_count=1,
        lease_owner_id="worker",
        lease_generation=7,
        lease_expires_at=now + timedelta(minutes=10),
    )
    db.add(job)
    db.flush()
    relation = m.TranscriptionJobSource(
        job_id=job.id, source_id=source.id, position=0
    )
    db.add(relation)
    db.flush()
    attempt = m.TranscriptionJobSourceAttempt(
        owner_user_id=user.id,
        project_id=project.id,
        job_id=job.id,
        job_source_id=relation.id,
        attempt_number=1,
        stage=m.SourceAttemptStage.provider_request_started,
        provider_total_parts=parts,
        provider_completed_parts=0,
        provider_request_started_at=now,
        created_at=now,
        updated_at=now,
    )
    db.add(attempt)
    db.commit()
    return m, now, job, relation, attempt


def _settings(rate: Decimal | None = Decimal("0.22")):
    return SimpleNamespace(
        elevenlabs_scribe_v2_rate_per_hour_usd=rate,
        elevenlabs_pricing_effective_date=(date(2026, 8, 30) if rate else None),
        elevenlabs_pricing_source=("elevenlabs_public_api_pricing" if rate else None),
    )


def test_confirmed_parts_are_counted_once_with_locked_rate_snapshot(db):
    from studio_api.job_retry_recovery import mark_attempt_provider_part_completed
    from studio_api.provider_usage_accounting import (
        ProviderUsageAccountingError,
        begin_provider_part_usage,
        confirm_provider_part_usage,
    )

    _m, now, job, relation, attempt = _context(db)
    begin_provider_part_usage(
        db,
        job_id=job.id,
        job_source_id=relation.id,
        lease_owner_id="worker",
        lease_generation=7,
        part_index=0,
        duration_seconds=3600,
        settings=_settings(),
        now=now,
    )
    db.commit()
    assert attempt.provider_accounting_status == "pending"
    assert job.provider_billed_duration_ms == 0

    usage = confirm_provider_part_usage(
        db,
        job_id=job.id,
        job_source_id=relation.id,
        lease_owner_id="worker",
        lease_generation=7,
        part_index=0,
        now=now,
    )
    db.commit()
    assert usage.duration_ms == 3_600_000
    assert usage.cost_amount == Decimal("0.22000000")
    assert job.provider_billed_duration_ms == 3_600_000
    assert job.provider_cost_amount == Decimal("0.22000000")
    with pytest.raises(ProviderUsageAccountingError, match="provider_usage_progress_invalid"):
        confirm_provider_part_usage(
            db,
            job_id=job.id,
            job_source_id=relation.id,
            lease_owner_id="worker",
            lease_generation=7,
            part_index=0,
            now=now,
        )

    mark_attempt_provider_part_completed(
        db,
        job_id=job.id,
        job_source_id=relation.id,
        lease_owner_id="worker",
        lease_generation=7,
        completed_parts=1,
        now=now,
    )
    db.commit()
    with pytest.raises(
        ProviderUsageAccountingError,
        match="provider_pricing_snapshot_conflict",
    ):
        begin_provider_part_usage(
            db,
            job_id=job.id,
            job_source_id=relation.id,
            lease_owner_id="worker",
            lease_generation=7,
            part_index=1,
            duration_seconds=1800,
            settings=_settings(Decimal("0.30")),
            now=now,
        )
    assert attempt.provider_pending_part_index is None
    begin_provider_part_usage(
        db,
        job_id=job.id,
        job_source_id=relation.id,
        lease_owner_id="worker",
        lease_generation=7,
        part_index=1,
        duration_seconds=1800,
        settings=_settings(),
        now=now,
    )
    confirm_provider_part_usage(
        db,
        job_id=job.id,
        job_source_id=relation.id,
        lease_owner_id="worker",
        lease_generation=7,
        part_index=1,
        now=now,
    )
    db.commit()
    assert job.provider_billed_duration_ms == 5_400_000
    assert job.provider_cost_amount == Decimal("0.33000000")
    assert job.provider_rate_per_hour == Decimal("0.220000")
    assert job.provider_rate_source == "elevenlabs_public_api_pricing"


def test_missing_pricing_fails_before_usage_boundary(db):
    from studio_api.provider_usage_accounting import (
        ProviderUsageAccountingError,
        begin_provider_part_usage,
    )

    _m, now, job, relation, attempt = _context(db)
    with pytest.raises(ProviderUsageAccountingError, match="provider_pricing_unavailable"):
        begin_provider_part_usage(
            db,
            job_id=job.id,
            job_source_id=relation.id,
            lease_owner_id="worker",
            lease_generation=7,
            part_index=0,
            duration_seconds=60,
            settings=_settings(None),
            now=now,
        )
    assert attempt.provider_pending_part_index is None
    assert job.provider_billed_duration_ms == 0


def test_unreturned_call_is_explicitly_uncertain_not_confirmed_cost(db):
    from studio_api.provider_usage_accounting import (
        begin_provider_part_usage,
        finalize_job_provider_accounting,
        mark_pending_provider_usage_uncertain,
    )

    m, now, job, relation, attempt = _context(db)
    begin_provider_part_usage(
        db,
        job_id=job.id,
        job_source_id=relation.id,
        lease_owner_id="worker",
        lease_generation=7,
        part_index=0,
        duration_seconds=90,
        settings=_settings(),
        now=now,
    )
    db.commit()
    assert mark_pending_provider_usage_uncertain(
        db, job_id=job.id, job_source_id=relation.id, now=now
    )
    job.status = m.JobStatus.failed
    finalize_job_provider_accounting(db, job=job, now=now)
    db.commit()
    assert attempt.provider_accounting_status == "uncertain"
    assert attempt.provider_pending_duration_ms == 90_000
    assert job.provider_billed_duration_ms == 0
    assert job.provider_cost_amount == Decimal("0E-8")
    assert job.provider_accounting_uncertain is True
    assert job.provider_accounting_complete is False


def test_accounting_migration_is_additive_direct_successor():
    cfg = Config("apps/studio-api/alembic.ini")
    scripts = ScriptDirectory.from_config(cfg)
    assert scripts.get_heads() == ["0030_provider_usage_accounting"]
    revision = scripts.get_revision("0030_provider_usage_accounting")
    assert revision is not None and revision.down_revision == "0029_source_reference_class"
    path = ROOT / "apps/studio-api/alembic/versions/0030_provider_usage_accounting.py"
    text = path.read_text(encoding="utf-8")
    assert 'release_safety = "additive"' in text
    assert "partial provider usage accounting schema" in text


def test_pricing_configuration_is_all_or_none_and_source_is_allowlisted():
    from pydantic import ValidationError
    from studio_api.config import Settings

    with pytest.raises(ValidationError, match="pricing snapshot must be complete"):
        Settings(elevenlabs_scribe_v2_rate_per_hour_usd="0.22")
    with pytest.raises(ValidationError, match="unsupported ElevenLabs pricing source"):
        Settings(
            elevenlabs_scribe_v2_rate_per_hour_usd="0.22",
            elevenlabs_pricing_effective_date=date(2026, 8, 30),
            elevenlabs_pricing_source="operator_guess",
        )
    settings = Settings(
        elevenlabs_scribe_v2_rate_per_hour_usd="0.22",
        elevenlabs_pricing_effective_date=date(2026, 8, 30),
        elevenlabs_pricing_source="elevenlabs_public_api_pricing",
    )
    assert settings.elevenlabs_scribe_v2_rate_per_hour_usd == Decimal("0.22")

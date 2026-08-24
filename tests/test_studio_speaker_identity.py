from __future__ import annotations

import sys
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))
os.environ.setdefault("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")
ALEMBIC = ROOT / "apps/studio-api" / "alembic.ini"


@dataclass(frozen=True)
class Word:
    speaker_id: str | None
    start: float | None
    end: float | None


def test_speaker_identity_schema_is_owner_scoped_bounded_and_additive():
    from studio_api.models import SpeakerProfile, TranscriptionJobSpeaker

    profile_columns = set(SpeakerProfile.__table__.columns.keys())
    assert {
        "owner_user_id",
        "display_name",
        "normalized_name",
        "role",
        "active",
    } <= profile_columns
    observation_columns = set(TranscriptionJobSpeaker.__table__.columns.keys())
    assert {
        "owner_user_id",
        "job_id",
        "job_source_id",
        "provider_speaker_label",
        "display_ordinal",
        "sample_start_ms",
        "sample_end_ms",
        "speaker_profile_id",
        "applied_display_name",
        "applied_role",
    } <= observation_columns
    assert not ({"audio", "audio_bytes", "transcript", "text", "embedding"} & observation_columns)
    assert {
        constraint.name
        for constraint in TranscriptionJobSpeaker.__table__.constraints
        if constraint.name
    } >= {
        "ck_transcription_job_speakers_sample_bounded",
        "ck_transcription_job_speakers_assignment_complete",
    }

    script = ScriptDirectory.from_config(Config(str(ALEMBIC)))
    revision = script.get_revision("0024_speaker_identity")
    assert revision.down_revision == "0023_realtime_drafts"
    assert script.get_heads() == ["0024_speaker_identity"]
    migration = Path(revision.module.__file__).read_text(encoding="utf-8")
    assert 'release_safety = "additive"' in migration


def test_profile_normalization_and_rendering_are_deterministic():
    from studio_api.speaker_identity import (
        normalize_profile_name,
        normalize_profile_role,
        render_profile_label,
    )

    display_name, normalized_name = normalize_profile_name("  Анна   Петрова  ")
    role = normalize_profile_role("  Руководитель  проекта ")

    assert display_name == "Анна Петрова"
    assert normalized_name == "анна петрова"
    assert role == "Руководитель проекта"
    assert render_profile_label(display_name, role) == "Анна Петрова — Руководитель проекта"


def test_speaker_observations_follow_display_order_and_bound_sample():
    from studio_api.speaker_identity import derive_speaker_observations

    observations = derive_speaker_observations(
        [
            Word("speaker-b", 1.0, 2.0),
            Word("speaker-b", 2.1, 12.0),
            Word(None, 3.0, 3.2),
            Word("speaker-a", 20.0, 20.6),
            Word("speaker-a", float("nan"), 21.0),
        ],
        source_offset_seconds=600,
    )

    assert [(item.provider_speaker_label, item.technical_label) for item in observations] == [
        ("speaker-b", "Speaker 1"),
        ("speaker-a", "Speaker 2"),
    ]
    assert observations[0].sample_start_ms == 601_000
    assert observations[0].sample_end_ms == 609_000
    assert observations[1].sample_start_ms == 620_000
    assert observations[1].sample_end_ms == 620_600


def test_persisted_observations_use_job_owner_and_do_not_overwrite_assignment():
    from studio_api.db import Base
    from studio_api.models import (
        Project,
        Source,
        SourceType,
        SpeakerProfile,
        TranscriptionJob,
        TranscriptionJobSource,
        TranscriptionJobSpeaker,
        User,
    )
    from studio_api.speaker_identity import persist_speaker_observations

    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime(2026, 8, 24, 16, 0, tzinfo=timezone.utc)
    with Session(engine) as db:
        owner = User(id="owner-1", email="owner@example.test")
        project = Project(id="project-1", owner_user_id=owner.id, title="Транскрибации")
        source = Source(
            id="source-1",
            project_id=project.id,
            source_type=SourceType.local_upload,
            original_filename="meeting.mp3",
        )
        job = TranscriptionJob(
            id="job-1",
            project_id=project.id,
            owner_user_id=owner.id,
            media_clip_start_seconds=10,
        )
        relation = TranscriptionJobSource(
            id="job-source-1",
            job_id=job.id,
            source_id=source.id,
            position=0,
        )
        profile = SpeakerProfile(
            id="profile-1",
            owner_user_id=owner.id,
            display_name="Анна",
            normalized_name="анна",
            role="Автор",
        )
        db.add_all([owner, project, source, job, relation, profile])
        db.flush()

        first = persist_speaker_observations(
            db,
            job=job,
            job_source_id=relation.id,
            words=[Word("speaker-1", 1.0, 2.0)],
            now=now,
        )[0]
        db.flush()
        first.speaker_profile_id = profile.id
        first.applied_display_name = profile.display_name
        first.applied_role = profile.role
        first.applied_document_label = "Анна — Автор"
        first.assigned_at = now
        db.flush()

        persisted = persist_speaker_observations(
            db,
            job=job,
            job_source_id=relation.id,
            words=[Word("speaker-1", 40.0, 41.0)],
            now=now,
        )
        db.flush()

        row = db.execute(select(TranscriptionJobSpeaker)).scalar_one()
        assert len(persisted) == 1
        assert row.owner_user_id == owner.id
        assert (row.sample_start_ms, row.sample_end_ms) == (11_000, 12_000)
        assert row.applied_document_label == "Анна — Автор"
    engine.dispose()

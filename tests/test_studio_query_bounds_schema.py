from __future__ import annotations

import sys
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


EXPECTED_INDEXES = {
    "projects": {
        "ix_projects_owner_active_updated_id": (
            "owner_user_id",
            "archived_at",
            "updated_at",
            "id",
        ),
    },
    "sources": {
        "ix_sources_project_deleted_created_id": (
            "project_id",
            "deleted_at",
            "created_at",
            "id",
        ),
    },
    "transcription_jobs": {
        "ix_transcription_jobs_project_owner_created_id": (
            "project_id",
            "owner_user_id",
            "created_at",
            "id",
        ),
    },
    "audit_events": {
        "ix_audit_events_subject_created_id": (
            "subject_user_id",
            "created_at",
            "id",
        ),
    },
    "transcription_provider_part_checkpoints": {
        "ix_provider_part_checkpoints_expiry_id": ("expires_at", "id"),
    },
    "realtime_transcript_drafts": {
        "ix_realtime_drafts_expiry_id": ("expires_at", "id"),
    },
    "audio_preparation_jobs": {
        "ix_audio_preparation_jobs_owner_project_created_id": (
            "owner_user_id",
            "project_id",
            "created_at",
            "id",
        ),
    },
}


def test_query_bounds_migration_is_single_additive_successor():
    script = ScriptDirectory.from_config(
        Config(str(ROOT / "apps/studio-api/alembic.ini"))
    )
    assert script.get_heads() == ["0027_query_bounds"]
    revision = script.get_revision("0027_query_bounds")
    assert revision.down_revision == "0026_runtime_component_status"
    source = (
        ROOT / "apps/studio-api/alembic/versions/0027_query_bounds.py"
    ).read_text(encoding="utf-8")
    assert 'release_safety = "additive"' in source


def test_query_bounds_indexes_match_model_query_order():
    from studio_api.db import Base
    import studio_api.models  # noqa: F401

    for table_name, expected in EXPECTED_INDEXES.items():
        table = Base.metadata.tables[table_name]
        actual = {
            index.name: tuple(column.name for column in index.columns)
            for index in table.indexes
        }
        assert actual.items() >= expected.items()

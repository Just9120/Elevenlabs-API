"""Exercise both current-metadata bootstrap and populated predecessor schema."""

from datetime import datetime, timezone
from contextlib import contextmanager
import os
from pathlib import Path
import sys
import uuid

import pytest
import sqlalchemy as sa
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


def _scripts():
    cfg = Config(str(ROOT / "apps/studio-api/alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "apps/studio-api/alembic"))
    return ScriptDirectory.from_config(cfg)


@contextmanager
def _migration_connection(dialect):
    if dialect == "postgresql":
        if os.environ.get("CI") != "true":
            pytest.skip("isolated PostgreSQL schema requires the configured synthetic CI services")
        from studio_api.config import Settings

        url = sa.engine.make_url(Settings().sqlalchemy_url())
        if url.host != "127.0.0.1" or url.database != "studio_test" or url.username != "studio_test":
            raise RuntimeError("migration regression requires the exact synthetic CI database")
        engine = sa.create_engine(url)
    else:
        engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    try:
        with engine.connect() as connection, connection.begin():
            if dialect == "postgresql":
                schema = "migration_test_" + uuid.uuid4().hex
                connection.execute(sa.text(f'CREATE SCHEMA "{schema}"'))
                connection.execute(sa.text(f'SET LOCAL search_path TO "{schema}"'))
            try:
                yield connection
            finally:
                # PostgreSQL schema/data/DDL are all rolled back; no shared fixtures are altered.
                connection.rollback()
    finally:
        engine.dispose()


def test_current_metadata_bootstrap_accepts_repeat(monkeypatch):
    monkeypatch.setenv("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")
    scripts = _scripts()
    revision = scripts.get_revision("0040_text_lifecycle").module
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    with engine.begin() as connection, Operations.context(MigrationContext.configure(connection)):
        scripts.get_revision("0001_platform_core").module.upgrade()
        revision.upgrade()
        revision.upgrade()
        assert sa.inspect(connection).get_columns("realtime_transcript_drafts")
        assert next(c for c in sa.inspect(connection).get_columns("realtime_transcript_drafts")
                    if c["name"] == "expires_at")["nullable"]
        indexes = sa.inspect(connection).get_indexes("audio_preparation_jobs")
        assert any(i["name"] == "uq_audio_download_slot" and i["unique"] for i in indexes)
    engine.dispose()


@pytest.mark.parametrize("missing", ["index", "column", "constraint", "constraint_definition"])
def test_incomplete_bootstrap_is_rejected_before_any_metadata_write(monkeypatch, missing):
    monkeypatch.setenv("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")
    from studio_api.db import Base
    from studio_api import models  # noqa: F401

    metadata = sa.MetaData()
    for table in Base.metadata.sorted_tables:
        table.to_metadata(metadata)
    if missing == "index":
        table = metadata.tables["sources"]
        table.indexes.remove(next(i for i in table.indexes if i.name == "ix_sources_storage_identity"))
    elif missing == "column":
        table = metadata.tables["transcription_jobs"]
        table._columns.remove(table.c.long_duration_preflight_json)
    elif missing == "constraint":
        table = metadata.tables["sources"]
        table.constraints.remove(next(c for c in table.constraints if c.name == "ck_sources_audio_retention_days"))
    else:
        table = metadata.tables["sources"]
        next(c for c in table.constraints if c.name == "ck_sources_audio_retention_days").sqltext = sa.text("audio_retention_days >= 0")
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    with engine.begin() as connection, Operations.context(MigrationContext.configure(connection)):
        metadata.create_all(connection)
        with pytest.raises(RuntimeError, match="partial text lifecycle schema"):
            _scripts().get_revision("0040_text_lifecycle").module.upgrade()
    engine.dispose()


@pytest.mark.parametrize("dialect", ["sqlite", "postgresql"])
def test_populated_0039_shape_keeps_ciphertext_and_does_not_enroll_sources(monkeypatch, dialect):
    if dialect == "sqlite":
        monkeypatch.setenv("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")
    from studio_api.db import Base
    from studio_api import models  # noqa: F401

    revision = _scripts().get_revision("0040_text_lifecycle").module
    metadata = sa.MetaData()
    for table in Base.metadata.sorted_tables:
        table.to_metadata(metadata)
    for name, columns in revision.NEW_COLUMNS.items():
        table = metadata.tables[name]
        for index in tuple(table.indexes):
            if index.name in revision.NEW_INDEXES.get(name, {}):
                table.indexes.remove(index)
        for check in tuple(table.constraints):
            if check.name in revision.NEW_CHECKS.get(name, {}):
                table.constraints.remove(check)
        for column in columns:
            table._columns.remove(table.c[column.name])
    for name in ("realtime_transcript_drafts", "transcription_provider_part_checkpoints"):
        metadata.tables[name].c.expires_at.nullable = False
    checkpoints = metadata.tables["transcription_provider_part_checkpoints"]
    next(c for c in checkpoints.constraints if c.name == "ck_provider_part_checkpoint_total_parts_multiple").sqltext = sa.text("total_parts > 1")
    now = datetime.now(timezone.utc)
    with _migration_connection(dialect) as connection, Operations.context(MigrationContext.configure(connection)):
        metadata.create_all(connection)
        # Raw predecessor rows: no new ORM columns or defaults can mask missing DDL.
        connection.execute(metadata.tables["users"].insert().values(id="owner", email="migration@example.test"))
        connection.execute(metadata.tables["projects"].insert().values(id="project", owner_user_id="owner", title="Synthetic"))
        connection.execute(metadata.tables["sources"].insert().values(
            id="source", project_id="project", source_type="device", original_filename="test.wav"))
        connection.execute(metadata.tables["transcription_jobs"].insert().values(
            id="job", owner_user_id="owner", project_id="project"))
        connection.execute(metadata.tables["transcription_job_sources"].insert().values(
            id="job-source", job_id="job", source_id="source", position=0))
        connection.execute(checkpoints.insert().values(
            id="part", owner_user_id="owner", project_id="project", job_id="job", job_source_id="job-source",
            part_index=0, total_parts=2, timeline_offset_seconds=0, duration_seconds=1,
            provider="elevenlabs", model="scribe_v2", ciphertext=b"preserved-ciphertext", nonce=b"nonce",
            key_id="synthetic", payload_hmac="a" * 64, created_at=now, expires_at=now))
        revision.upgrade()
        assert connection.execute(sa.text("SELECT ciphertext, expires_at FROM transcription_provider_part_checkpoints")).one() == (b"preserved-ciphertext", None)
        assert connection.execute(sa.text("SELECT audio_retention_days, delete_after_transcripts FROM sources")).one() == (None, 0)
        # A complete single-part checkpoint becomes legal after the migration.
        connection.execute(sa.text("UPDATE transcription_provider_part_checkpoints SET total_parts=1"))
        with pytest.raises(sa.exc.IntegrityError), connection.begin_nested():
            connection.execute(sa.text("UPDATE transcription_provider_part_checkpoints SET total_parts=0"))
        with pytest.raises(sa.exc.IntegrityError), connection.begin_nested():
            connection.execute(sa.text("UPDATE sources SET audio_retention_days=1"))
        revision.upgrade()
        assert connection.execute(sa.text("SELECT ciphertext FROM transcription_provider_part_checkpoints")).scalar_one() == b"preserved-ciphertext"

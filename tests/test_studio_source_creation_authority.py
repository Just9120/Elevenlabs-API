from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


@pytest.fixture()
def db():
    from studio_api.db import Base
    import studio_api.models  # noqa: F401

    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    session = factory()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


def _studio_output(
    db,
    *,
    owner_id: str,
    document_id: str,
    created_at: datetime,
    provenance: str,
):
    from studio_api.models import (
        Project,
        Source,
        SourceType,
        TranscriptionJob,
        TranscriptionJobOutput,
        TranscriptionJobSource,
        User,
    )

    owner = db.get(User, owner_id)
    if owner is None:
        owner = User(id=owner_id, email=f"{owner_id}@example.com")
        db.add(owner)
        db.flush()
    project = Project(owner_user_id=owner_id, title="Private project")
    db.add(project)
    db.flush()
    source = Source(
        project_id=project.id,
        source_type=SourceType.google_drive,
        original_filename="private-source.mp4",
        drive_file_id=f"drive-{document_id}",
        source_created_at=created_at,
        source_created_at_provenance=provenance,
    )
    db.add(source)
    db.flush()
    job = TranscriptionJob(
        project_id=project.id,
        owner_user_id=owner_id,
    )
    db.add(job)
    db.flush()
    relation = TranscriptionJobSource(
        job_id=job.id,
        source_id=source.id,
        position=0,
    )
    db.add(relation)
    db.flush()
    db.add(
        TranscriptionJobOutput(
            job_id=job.id,
            job_source_id=relation.id,
            document_id=document_id,
            web_view_url="https://docs.google.test/private",
            output_drive_folder_id="private-folder",
            output_kind="google_docs_transcript",
            transcript_standard="transcript_doc_v1.2",
            document_character_count=1,
            document_created_at=created_at,
            persisted_at=created_at,
            lease_generation=1,
        )
    )
    db.flush()
    return source


def test_source_creation_authority_is_owner_scoped_and_fail_closed(db):
    from studio_api.models import (
        TranscriptCatalogDocumentStandardStatus,
        TranscriptCatalogEntry,
        TranscriptCatalogSettingsStatus,
        TranscriptCatalogSourceIdentityKind,
    )
    from studio_api.source_creation_authority import (
        SourceCreationAuthorityStatus,
        load_document_source_creation_authorities,
    )

    first_at = datetime(2026, 6, 1, 10, 11, 12, tzinfo=timezone.utc)
    other_at = datetime(2026, 6, 2, 10, 11, 12, tzinfo=timezone.utc)
    direct = _studio_output(
        db,
        owner_id="owner-a",
        document_id="direct-document",
        created_at=first_at,
        provenance="google_drive_created_time",
    )
    conflicting_source = _studio_output(
        db,
        owner_id="owner-a",
        document_id="other-document",
        created_at=other_at,
        provenance="embedded_media_metadata",
    )
    _studio_output(
        db,
        owner_id="owner-b",
        document_id="foreign-document",
        created_at=other_at,
        provenance="google_drive_created_time",
    )
    db.add(
        TranscriptCatalogEntry(
            owner_user_id="owner-a",
            document_id="direct-document",
            document_name="Private document",
            transcript_standard="transcript_doc_v1.2",
            standard_status=(
                TranscriptCatalogDocumentStandardStatus.current
            ),
            settings_status=TranscriptCatalogSettingsStatus.indeterminate,
            source_identity_kind=(
                TranscriptCatalogSourceIdentityKind.studio_source
            ),
            source_identity_value=conflicting_source.id,
        )
    )
    db.commit()

    authority = load_document_source_creation_authorities(
        db,
        owner_user_id="owner-a",
        document_ids=(
            "direct-document",
            "foreign-document",
            "missing-document",
        ),
    )

    assert authority["direct-document"].status == (
        SourceCreationAuthorityStatus.conflict
    )
    assert authority["direct-document"].iso8601 is None
    assert authority["foreign-document"].status == (
        SourceCreationAuthorityStatus.unavailable
    )
    assert authority["missing-document"].status == (
        SourceCreationAuthorityStatus.unavailable
    )
    assert direct.id != conflicting_source.id


def test_source_creation_authority_formats_exact_direct_output(db):
    from studio_api.source_creation_authority import (
        SourceCreationAuthorityStatus,
        load_document_source_creation_authorities,
    )

    created_at = datetime(
        2026,
        6,
        1,
        10,
        11,
        12,
        345678,
        tzinfo=timezone.utc,
    )
    _studio_output(
        db,
        owner_id="owner-a",
        document_id="direct-document",
        created_at=created_at,
        provenance="google_drive_created_time",
    )
    db.commit()

    authority = load_document_source_creation_authorities(
        db,
        owner_user_id="owner-a",
        document_ids=("direct-document",),
    )["direct-document"]

    assert authority.status == SourceCreationAuthorityStatus.authoritative
    assert authority.provenance == "google_drive_created_time"
    assert authority.iso8601 == "2026-06-01T10:11:12Z"

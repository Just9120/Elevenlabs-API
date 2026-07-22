from __future__ import annotations

import sys
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from urllib.error import HTTPError, URLError
from io import BytesIO

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


@dataclass(frozen=True)
class SimpleSettings:
    source_s3_endpoint_url: str | None = "https://r2.test"
    source_s3_bucket: str | None = "studio-temp"
    source_s3_access_key_id_file: str | None = None
    source_s3_secret_access_key_file: str | None = None
    source_max_upload_bytes: int = 1000

    def source_storage_configured(self) -> bool:
        return bool(self.source_s3_endpoint_url and self.source_s3_bucket)


class FakeStorage:
    def __init__(self, head=None, exc=None, before_head=None):
        self.head = head
        self.exc = exc
        self.before_head = before_head

    def head_object(self, key):
        if self.before_head:
            self.before_head()
        if self.exc:
            raise self.exc
        if self.head is not None:
            return self.head
        from studio_api.source_storage import ObjectHead

        return ObjectHead(size_bytes=100, content_type="audio/mpeg")


@pytest.fixture()
def sqlite_session(monkeypatch):
    monkeypatch.setenv("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")
    from studio_api.db import Base
    import studio_api.models  # noqa: F401 - registers ORM tables for fixture-created schema.

    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture()
def models():
    from studio_api import models as model_module

    return model_module


def make_processing_job(
    db,
    models,
    *,
    source_type=None,
    source_kwargs=None,
    status=None,
    lease_owner="worker-1",
    lease_generation=1,
    expires_delta=timedelta(minutes=5),
    email="worker@example.com",
):
    from studio_api.security import hash_password, utcnow

    source_type = source_type or models.SourceType.local_upload
    status = status or models.JobStatus.processing
    now = utcnow().replace(tzinfo=None)
    user = models.User(email=email, role=models.UserRole.admin, status=models.UserStatus.active)
    db.add(user)
    db.flush()
    db.add(models.LocalIdentity(user_id=user.id, password_hash=hash_password("password-123")))
    project = models.Project(owner_user_id=user.id, title="Project")
    db.add(project)
    db.flush()
    kwargs = dict(
        project_id=project.id,
        source_type=source_type,
        original_filename="meeting.mp3",
        mime_type="audio/mpeg",
        size_bytes=100,
        upload_status=models.SourceUploadStatus.uploaded,
        uploaded_at=now,
    )
    if source_type == models.SourceType.local_upload:
        kwargs.update(s3_bucket="studio-temp", s3_object_key="private/key", expires_at=now + timedelta(hours=1))
    else:
        kwargs.update(drive_file_id="drive-1")
    kwargs.update(source_kwargs or {})
    src = models.Source(**kwargs)
    db.add(src)
    db.flush()
    job = models.TranscriptionJob(
        project_id=project.id,
        owner_user_id=user.id,
        status=status,
        lease_owner_id=lease_owner,
        lease_generation=lease_generation,
        claimed_at=now,
        lease_expires_at=now + expires_delta,
        started_at=now,
    )
    db.add(job)
    db.flush()
    job_source = models.TranscriptionJobSource(job_id=job.id, source_id=src.id, position=0)
    db.add(job_source)
    db.commit()
    return job.id, src.id, job_source.id, project.id, now, user.id


def verify(db, **kwargs):
    from studio_api.job_source_availability import verify_processing_job_sources

    return verify_processing_job_sources(db, settings=SimpleSettings(), **kwargs)


def assert_safe_summary(summary):
    text = str(summary)
    for forbidden in [
        "drive-1",
        "drive-2",
        "drive-mutated",
        "studio-temp",
        "private/key",
        "changed/key",
        "access-token-secret",
        "refresh-token-secret",
        "presigned",
        "raw google payload",
    ]:
        assert forbidden not in text


def test_test_module_has_no_import_time_env_file_or_schema_side_effects():
    source = Path(__file__).read_text(encoding="utf-8")
    before_fixtures = source.split("@pytest.fixture", 1)[0]
    assert "os.environ" not in before_fixtures
    assert "setdefault" not in before_fixtures
    assert "write_text" not in before_fixtures
    assert "create_all" not in before_fixtures
    assert "STUDIO_" + "POSTGRES_PASSWORD_FILE" not in source
    assert "STUDIO_" + "CREDENTIAL_MASTER_KEY_FILE" not in source


def test_source_policy_normalizes_and_accepts_only_media_and_ogg():
    from studio_api.source_policy import is_supported_source_mime_type, normalize_source_mime_type

    assert normalize_source_mime_type(" Audio/MPEG ") == "audio/mpeg"
    assert is_supported_source_mime_type("audio/wav")
    assert is_supported_source_mime_type("video/mp4")
    assert is_supported_source_mime_type("application/ogg")
    assert not is_supported_source_mime_type("application/pdf")
    assert not is_supported_source_mime_type("application/vnd.google-apps.folder")


@pytest.mark.parametrize(
    ("expected_size", "expected_mime", "actual_size", "actual_mime", "expected_issue"),
    [
        (10, "audio/mpeg", 10, " Audio/MPEG ", None),
        (10, "audio/mpeg", None, "audio/mpeg", "metadata_unavailable"),
        (10, "audio/mpeg", 10, None, "metadata_unavailable"),
        (10, "audio/mpeg", 1001, "audio/mpeg", "source_too_large"),
        (10, "audio/mpeg", 10, "text/plain", "unsupported_mime_type"),
        (10, "audio/mpeg", 11, "audio/mpeg", "source_size_mismatch"),
        (10, "audio/mpeg", 10, "audio/wav", "source_mime_mismatch"),
    ],
)
def test_uploaded_object_metadata_requires_exact_complete_head(
    expected_size,
    expected_mime,
    actual_size,
    actual_mime,
    expected_issue,
):
    from studio_api.source_policy import uploaded_object_metadata_issue

    issue = uploaded_object_metadata_issue(
        expected_size_bytes=expected_size,
        expected_mime_type=expected_mime,
        actual_size_bytes=actual_size,
        actual_mime_type=actual_mime,
        max_bytes=1000,
    )

    assert (issue.value if issue else None) == expected_issue


def test_processing_job_local_upload_head_ready_and_safe(sqlite_session, models):
    job_id, _, _, _, now, _ = make_processing_job(sqlite_session, models)
    summary = verify(
        sqlite_session,
        job_id=job_id,
        lease_owner_id="worker-1",
        lease_generation=1,
        now=now,
        storage_factory=lambda _: FakeStorage(),
    )
    assert summary.ready is True
    assert [s.position for s in summary.sources] == [0]
    assert_safe_summary(summary)


def test_processing_job_rejects_wrong_lifecycle_and_lease_boundaries(sqlite_session, models):
    cases = [
        {"status": models.JobStatus.queued, "reason": "job_not_processing"},
        {"lease_owner": "worker-1", "call_owner": "stale", "reason": "lease_not_owned"},
        {"lease_generation": 2, "call_generation": 1, "reason": "lease_not_owned"},
        {"expires_delta": timedelta(seconds=-1), "reason": "lease_not_active"},
    ]
    for index, case in enumerate(cases):
        job_id, _, _, _, now, _ = make_processing_job(
            sqlite_session,
            models,
            email=f"worker-{index}-{case['reason']}@example.com",
            status=case.get("status", models.JobStatus.processing),
            lease_owner=case.get("lease_owner", "worker-1"),
            lease_generation=case.get("lease_generation", 1),
            expires_delta=case.get("expires_delta", timedelta(minutes=5)),
        )
        summary = verify(
            sqlite_session,
            job_id=job_id,
            lease_owner_id=case.get("call_owner", "worker-1"),
            lease_generation=case.get("call_generation", 1),
            now=now,
        )
        assert summary.ready is False
        assert case["reason"] in summary.blocking_reasons
        sqlite_session.rollback()


def test_google_drive_uses_one_token_for_multiple_sources_and_rejects_folder(sqlite_session, models):
    from studio_api.google_drive import GoogleDriveMetadata

    job_id, _, _, project_id, now, _ = make_processing_job(sqlite_session, models, source_type=models.SourceType.google_drive)
    s2 = models.Source(
        project_id=project_id,
        source_type=models.SourceType.google_drive,
        original_filename="two.mp4",
        mime_type="video/mp4",
        size_bytes=200,
        drive_file_id="drive-2",
        upload_status=models.SourceUploadStatus.uploaded,
        uploaded_at=now,
    )
    sqlite_session.add(s2)
    sqlite_session.flush()
    sqlite_session.add(models.TranscriptionJobSource(job_id=job_id, source_id=s2.id, position=1))
    sqlite_session.commit()
    calls = {"token": 0}

    def token_resolver(db, *, user_id, settings):
        calls["token"] += 1
        return "access-token-secret"

    def fetcher(token, drive_file_id):
        if drive_file_id == "drive-2":
            return GoogleDriveMetadata(id=drive_file_id, name="folder", mime_type="application/vnd.google-apps.folder", size_bytes=None, web_view_link="raw", created_time=None, modified_time=None, is_folder=True)
        return GoogleDriveMetadata(id=drive_file_id, name="one", mime_type="audio/mpeg", size_bytes=100, web_view_link="raw", created_time=None, modified_time=None, is_folder=False)

    summary = verify(
        sqlite_session,
        job_id=job_id,
        lease_owner_id="worker-1",
        lease_generation=1,
        now=now,
        drive_token_resolver=token_resolver,
        drive_metadata_fetcher=fetcher,
    )
    assert calls["token"] == 1
    assert summary.ready is False
    assert [s.position for s in summary.sources] == [0, 1]
    assert summary.sources[0].available is True
    assert "drive_file_is_folder" in summary.sources[1].blocking_reasons
    assert_safe_summary(summary)


@pytest.mark.parametrize(
    ("source_type_name", "field", "value"),
    [
        ("google_drive", "drive_file_id", "drive-mutated"),
        ("local_upload", "s3_object_key", "changed/key"),
        ("local_upload", "s3_bucket", "changed-bucket"),
        ("local_upload", "mime_type", "audio/wav"),
        ("local_upload", "size_bytes", 101),
        ("local_upload", "source_type", "google_drive"),
        ("local_upload", "project_id", "other-project"),
        ("local_upload", "upload_status", "pending"),
        ("local_upload", "deleted_at", "now"),
        ("local_upload", "expires_at", "now"),
    ],
)
def test_source_identity_toctou_changes_block_ready(sqlite_session, models, source_type_name, field, value):
    source_type = getattr(models.SourceType, source_type_name)
    job_id, source_id, _, _, now, _ = make_processing_job(sqlite_session, models, source_type=source_type)

    def mutate():
        src = sqlite_session.get(models.Source, source_id)
        if field == "source_type":
            setattr(src, field, getattr(models.SourceType, value))
            src.drive_file_id = "drive-mutated"
        elif field == "upload_status":
            setattr(src, field, getattr(models.SourceUploadStatus, value))
        elif value == "now":
            setattr(src, field, now)
        else:
            setattr(src, field, value)
        sqlite_session.flush()

    summary = verify(
        sqlite_session,
        job_id=job_id,
        lease_owner_id="worker-1",
        lease_generation=1,
        now=now,
        storage_factory=lambda _: FakeStorage(before_head=mutate),
        drive_token_resolver=lambda db, *, user_id, settings: "access-token-secret",
        drive_metadata_fetcher=lambda token, drive_file_id: (_ for _ in ()).throw(mutate()),
    )
    assert summary.ready is False
    assert "source_state_changed" in summary.blocking_reasons
    assert_safe_summary(summary)


@pytest.mark.parametrize("mutation", ["position", "replace_source", "remove_relation", "add_relation", "job_source_status"])
def test_ordered_relation_toctou_changes_block_ready(sqlite_session, models, mutation):
    job_id, source_id, job_source_id, project_id, now, _ = make_processing_job(sqlite_session, models)

    def mutate():
        relation = sqlite_session.get(models.TranscriptionJobSource, job_source_id)
        if mutation == "position":
            relation.position = 5
        elif mutation == "replace_source":
            replacement = models.Source(project_id=project_id, source_type=models.SourceType.local_upload, original_filename="replacement.mp3", mime_type="audio/mpeg", size_bytes=100, s3_bucket="studio-temp", s3_object_key="replacement/key", upload_status=models.SourceUploadStatus.uploaded, uploaded_at=now, expires_at=now + timedelta(hours=1))
            sqlite_session.add(replacement)
            sqlite_session.flush()
            relation.source_id = replacement.id
        elif mutation == "remove_relation":
            sqlite_session.delete(relation)
        elif mutation == "add_relation":
            extra = models.Source(project_id=project_id, source_type=models.SourceType.local_upload, original_filename="extra.mp3", mime_type="audio/mpeg", size_bytes=100, s3_bucket="studio-temp", s3_object_key="extra/key", upload_status=models.SourceUploadStatus.uploaded, uploaded_at=now, expires_at=now + timedelta(hours=1))
            sqlite_session.add(extra)
            sqlite_session.flush()
            sqlite_session.add(models.TranscriptionJobSource(job_id=job_id, source_id=extra.id, position=1))
        else:
            relation.status = models.JobSourceStatus.skipped
        sqlite_session.flush()

    summary = verify(sqlite_session, job_id=job_id, lease_owner_id="worker-1", lease_generation=1, now=now, storage_factory=lambda _: FakeStorage(before_head=mutate))
    assert summary.ready is False
    if mutation in {"add_relation", "remove_relation"}:
        assert "source_set_changed" in summary.blocking_reasons
        assert all("source_state_changed" not in source.blocking_reasons for source in summary.sources)
    else:
        assert "source_state_changed" in summary.blocking_reasons
    assert_safe_summary(summary)


@pytest.mark.parametrize(
    ("mutation", "reason"),
    [
        ("project_archived", "project_archived"),
        ("job_status", "job_not_processing"),
        ("lease_owner", "lease_not_owned"),
        ("lease_generation", "lease_not_owned"),
        ("lease_expiry", "lease_not_active"),
        ("cancel_requested", "cancellation_requested"),
    ],
)
def test_project_and_lifecycle_toctou_reasons_are_not_per_source_changes(sqlite_session, models, mutation, reason):
    job_id, _, _, project_id, now, _ = make_processing_job(sqlite_session, models)

    def mutate():
        job = sqlite_session.get(models.TranscriptionJob, job_id)
        project = sqlite_session.get(models.Project, project_id)
        if mutation == "project_archived":
            project.archived_at = now
        elif mutation == "job_status":
            job.status = models.JobStatus.failed
        elif mutation == "lease_owner":
            job.lease_owner_id = "other-worker"
        elif mutation == "lease_generation":
            job.lease_generation = 2
        elif mutation == "lease_expiry":
            job.lease_expires_at = now - timedelta(seconds=1)
        else:
            job.cancel_requested_at = now
        sqlite_session.flush()

    summary = verify(sqlite_session, job_id=job_id, lease_owner_id="worker-1", lease_generation=1, now=now, storage_factory=lambda _: FakeStorage(before_head=mutate))
    assert summary.ready is False
    assert reason in summary.blocking_reasons
    assert all("source_state_changed" not in source.blocking_reasons for source in summary.sources)
    assert_safe_summary(summary)



def test_boundary_snapshot_is_immutable_tuple(sqlite_session, models):
    from dataclasses import FrozenInstanceError
    from studio_api.job_source_availability import _boundary_snapshot

    job_id, _, _, _, _, _ = make_processing_job(sqlite_session, models)
    job = sqlite_session.get(models.TranscriptionJob, job_id)
    snapshot = _boundary_snapshot(job, job.project, job.sources)

    assert isinstance(snapshot.relations, tuple)
    with pytest.raises(FrozenInstanceError):
        snapshot.job.status = "queued"
    with pytest.raises(TypeError):
        snapshot.relations[0] = snapshot.relations[0]


def test_precise_source_change_marks_only_changed_source(sqlite_session, models):
    job_id, source_a_id, _, project_id, now, _ = make_processing_job(sqlite_session, models)
    source_b = models.Source(
        project_id=project_id,
        source_type=models.SourceType.local_upload,
        original_filename="second.mp3",
        mime_type="audio/mpeg",
        size_bytes=100,
        s3_bucket="studio-temp",
        s3_object_key="private/key-b",
        upload_status=models.SourceUploadStatus.uploaded,
        uploaded_at=now,
        expires_at=now + timedelta(hours=1),
    )
    sqlite_session.add(source_b)
    sqlite_session.flush()
    sqlite_session.add(models.TranscriptionJobSource(job_id=job_id, source_id=source_b.id, position=1))
    sqlite_session.commit()

    def mutate_source_a():
        source = sqlite_session.get(models.Source, source_a_id)
        source.mime_type = "audio/wav"
        sqlite_session.flush()

    summary = verify(
        sqlite_session,
        job_id=job_id,
        lease_owner_id="worker-1",
        lease_generation=1,
        now=now,
        storage_factory=lambda _: FakeStorage(before_head=mutate_source_a),
    )

    by_id = {source.source_id: source for source in summary.sources}
    assert summary.ready is False
    assert "source_state_changed" in by_id[source_a_id].blocking_reasons
    assert "source_state_changed" not in by_id[source_b.id].blocking_reasons
    assert by_id[source_b.id].available is True
    assert_safe_summary(summary)


def test_relation_set_addition_is_top_level_only_for_existing_sources(sqlite_session, models):
    job_id, _, _, project_id, now, _ = make_processing_job(sqlite_session, models)

    def add_unattributable_relation():
        extra = models.Source(project_id=project_id, source_type=models.SourceType.local_upload, original_filename="extra.mp3", mime_type="audio/mpeg", size_bytes=100, s3_bucket="studio-temp", s3_object_key="extra/key", upload_status=models.SourceUploadStatus.uploaded, uploaded_at=now, expires_at=now + timedelta(hours=1))
        sqlite_session.add(extra)
        sqlite_session.flush()
        sqlite_session.add(models.TranscriptionJobSource(job_id=job_id, source_id=extra.id, position=1))
        sqlite_session.flush()

    summary = verify(sqlite_session, job_id=job_id, lease_owner_id="worker-1", lease_generation=1, now=now, storage_factory=lambda _: FakeStorage(before_head=add_unattributable_relation))
    assert summary.ready is False
    assert "source_set_changed" in summary.blocking_reasons
    assert all("source_state_changed" not in source.blocking_reasons for source in summary.sources)
    assert_safe_summary(summary)


def test_relation_reorder_with_two_sources_is_attributed(sqlite_session, models):
    job_id, source_a_id, job_source_a_id, project_id, now, _ = make_processing_job(sqlite_session, models)
    source_b = models.Source(project_id=project_id, source_type=models.SourceType.local_upload, original_filename="second.mp3", mime_type="audio/mpeg", size_bytes=100, s3_bucket="studio-temp", s3_object_key="private/key-b", upload_status=models.SourceUploadStatus.uploaded, uploaded_at=now, expires_at=now + timedelta(hours=1))
    sqlite_session.add(source_b)
    sqlite_session.flush()
    relation_b = models.TranscriptionJobSource(job_id=job_id, source_id=source_b.id, position=1)
    sqlite_session.add(relation_b)
    sqlite_session.commit()

    def reorder():
        sqlite_session.get(models.TranscriptionJobSource, job_source_a_id).position = 1
        sqlite_session.get(models.TranscriptionJobSource, relation_b.id).position = 0
        sqlite_session.flush()

    summary = verify(sqlite_session, job_id=job_id, lease_owner_id="worker-1", lease_generation=1, now=now, storage_factory=lambda _: FakeStorage(before_head=reorder))
    by_id = {source.source_id: source for source in summary.sources}
    assert summary.ready is False
    assert "source_state_changed" in by_id[source_a_id].blocking_reasons
    assert "source_state_changed" in by_id[source_b.id].blocking_reasons
    assert_safe_summary(summary)


def test_relation_id_replacement_preserving_source_and_position_is_attributed(sqlite_session, models):
    job_id, source_id, job_source_id, _, now, _ = make_processing_job(sqlite_session, models)

    def replace_relation_id():
        relation = sqlite_session.get(models.TranscriptionJobSource, job_source_id)
        sqlite_session.delete(relation)
        sqlite_session.flush()
        sqlite_session.add(models.TranscriptionJobSource(job_id=job_id, source_id=source_id, position=0))
        sqlite_session.flush()

    summary = verify(sqlite_session, job_id=job_id, lease_owner_id="worker-1", lease_generation=1, now=now, storage_factory=lambda _: FakeStorage(before_head=replace_relation_id))
    assert summary.ready is False
    assert "source_state_changed" in summary.sources[0].blocking_reasons
    assert "source_set_changed" not in summary.blocking_reasons
    assert_safe_summary(summary)


@pytest.mark.parametrize(
    ("mutation", "reason"),
    [
        ("job_owner", "project_missing"),
        ("job_project", "project_missing"),
        ("project_owner", "project_missing"),
        ("job_deleted", "job_not_found"),
    ],
)
def test_lifecycle_identity_and_disappearance_toctou(sqlite_session, models, mutation, reason):
    job_id, _, _, project_id, now, _ = make_processing_job(sqlite_session, models)

    def mutate():
        job = sqlite_session.get(models.TranscriptionJob, job_id)
        project = sqlite_session.get(models.Project, project_id)
        if mutation == "job_owner":
            job.owner_user_id = "other-owner"
        elif mutation == "job_project":
            other = models.Project(owner_user_id=job.owner_user_id, title="Other")
            sqlite_session.add(other)
            sqlite_session.flush()
            job.project_id = other.id
        elif mutation == "project_owner":
            project.owner_user_id = "other-owner"
        else:
            for relation in list(job.sources):
                sqlite_session.delete(relation)
            sqlite_session.flush()
            sqlite_session.delete(job)
        sqlite_session.flush()

    summary = verify(sqlite_session, job_id=job_id, lease_owner_id="worker-1", lease_generation=1, now=now, storage_factory=lambda _: FakeStorage(before_head=mutate))
    assert summary.ready is False
    assert reason in summary.blocking_reasons
    assert all("source_state_changed" not in source.blocking_reasons for source in summary.sources)
    assert_safe_summary(summary)


def test_fresh_clock_detects_lease_expiring_during_external_io(sqlite_session, models):
    job_id, _, _, _, now, _ = make_processing_job(sqlite_session, models, expires_delta=timedelta(seconds=5))
    summary = verify(
        sqlite_session,
        job_id=job_id,
        lease_owner_id="worker-1",
        lease_generation=1,
        now=now,
        storage_factory=lambda _: FakeStorage(),
        now_provider=lambda: now + timedelta(seconds=10),
    )
    assert summary.ready is False
    assert summary.verified_at == now + timedelta(seconds=10)
    assert "lease_not_active" in summary.blocking_reasons
    assert all("source_state_changed" not in source.blocking_reasons for source in summary.sources)


def test_fresh_clock_detects_source_expiring_during_external_io(sqlite_session, models):
    job_id, source_id, _, _, now, _ = make_processing_job(sqlite_session, models)
    source = sqlite_session.get(models.Source, source_id)
    source.expires_at = now + timedelta(seconds=5)
    sqlite_session.commit()
    summary = verify(
        sqlite_session,
        job_id=job_id,
        lease_owner_id="worker-1",
        lease_generation=1,
        now=now,
        storage_factory=lambda _: FakeStorage(),
        now_provider=lambda: now + timedelta(seconds=10),
    )
    assert summary.ready is False
    assert "source_state_changed" in summary.sources[0].blocking_reasons
    assert_safe_summary(summary)


def test_default_revalidation_clock_uses_fresh_utcnow(sqlite_session, models, monkeypatch):
    from studio_api import job_source_availability

    job_id, _, _, _, now, _ = make_processing_job(sqlite_session, models, expires_delta=timedelta(seconds=5))
    post_io_now = now + timedelta(seconds=10)
    monkeypatch.setattr(job_source_availability, "utcnow", lambda: post_io_now)

    summary = verify(
        sqlite_session,
        job_id=job_id,
        lease_owner_id="worker-1",
        lease_generation=1,
        now=now,
        storage_factory=lambda _: FakeStorage(),
    )

    assert summary.ready is False
    assert summary.verified_at == post_io_now
    assert "lease_not_active" in summary.blocking_reasons
    assert all("source_state_changed" not in source.blocking_reasons for source in summary.sources)
    assert_safe_summary(summary)


@pytest.mark.parametrize("payload", [b'{"id":"drive-1","mimeType":"audio/mpeg","size":0}', b'{"id":"drive-1","mimeType":"audio/mpeg","size":123}', b'{"id":"drive-1","mimeType":"audio/mpeg","size":"0"}', b'{"id":"drive-1","mimeType":"audio/mpeg","size":"123"}'])
def test_valid_integer_drive_metadata_sizes_are_accepted(sqlite_session, models, monkeypatch, payload):
    from studio_api import google_drive
    from studio_api.job_source_availability import verify_processing_job_sources

    job_id, _, _, _, now, _ = make_processing_job(sqlite_session, models, source_type=models.SourceType.google_drive)

    class FakeResponse:
        def __enter__(self):
            return self
        def __exit__(self, exc_type, exc, tb):
            return False
        def read(self):
            return payload

    monkeypatch.setattr(google_drive, "urlopen", lambda req, timeout=10: FakeResponse())
    summary = verify_processing_job_sources(
        sqlite_session,
        job_id=job_id,
        lease_owner_id="worker-1",
        lease_generation=1,
        now=now,
        settings=SimpleSettings(),
        drive_token_resolver=lambda db, *, user_id, settings: "access-token-secret",
        now_provider=lambda: now,
    )
    assert summary.ready is True
    assert_safe_summary(summary)


def test_drive_metadata_typed_errors_map_to_safe_availability_reasons(sqlite_session, models, monkeypatch):
    from studio_api import google_drive
    from studio_api.job_source_availability import verify_processing_job_sources

    job_id, _, _, _, now, _ = make_processing_job(sqlite_session, models, source_type=models.SourceType.google_drive)

    class FakeResponse:
        def __enter__(self):
            return self
        def __exit__(self, exc_type, exc, tb):
            return False
        def read(self):
            return b'{"id":"drive-1","name":"ok","mimeType":"audio/mpeg","size":"100"}'

    def run_with_urlopen(fake_urlopen):
        monkeypatch.setattr(google_drive, "urlopen", fake_urlopen)
        return verify_processing_job_sources(
            sqlite_session,
            job_id=job_id,
            lease_owner_id="worker-1",
            lease_generation=1,
            now=now,
            settings=SimpleSettings(),
            drive_token_resolver=lambda db, *, user_id, settings: "access-token-secret",
        )

    not_found = run_with_urlopen(lambda req, timeout=10: (_ for _ in ()).throw(HTTPError(req.full_url, 404, "missing", {}, BytesIO(b"raw google payload"))))
    assert not_found.ready is False
    assert "drive_file_missing" in not_found.blocking_reasons
    assert_safe_summary(not_found)

    forbidden = run_with_urlopen(lambda req, timeout=10: (_ for _ in ()).throw(HTTPError(req.full_url, 403, "forbidden", {}, BytesIO(b"raw google payload"))))
    assert forbidden.ready is False
    assert "drive_metadata_unavailable" in forbidden.blocking_reasons
    assert_safe_summary(forbidden)

    server_error = run_with_urlopen(lambda req, timeout=10: (_ for _ in ()).throw(HTTPError(req.full_url, 500, "server", {}, BytesIO(b"raw google payload"))))
    assert server_error.ready is False
    assert "drive_metadata_unavailable" in server_error.blocking_reasons
    assert_safe_summary(server_error)

    network = run_with_urlopen(lambda req, timeout=10: (_ for _ in ()).throw(URLError("raw google payload")))
    assert network.ready is False
    assert "drive_metadata_unavailable" in network.blocking_reasons
    assert_safe_summary(network)


@pytest.mark.parametrize(
    "payload",
    [
        b"not-json",
        b"[]",
        b"{}",
        b'{"id":"","mimeType":"audio/mpeg","size":"100"}',
        b'{"id":"drive-1","size":"100"}',
        b'{"id":"drive-1","mimeType":"","size":"100"}',
        b'{"id":"drive-1","mimeType":"audio/mpeg","size":"not-int"}',
        b'{"id":"drive-1","mimeType":"audio/mpeg","size":""}',
        b'{"id":"drive-1","mimeType":"audio/mpeg","size":"   "}',
        b'{"id":"drive-1","mimeType":"audio/mpeg","size":"-1"}',
        b'{"id":"drive-1","mimeType":"audio/mpeg","size":-1}',
        b'{"id":"drive-1","mimeType":"audio/mpeg","size":1.5}',
        b'{"id":"drive-1","mimeType":"audio/mpeg","size":"1.5"}',
        b'{"id":"drive-1","mimeType":"audio/mpeg","size":true}',
        b'{"id":"drive-1","mimeType":"audio/mpeg","size":false}',
        b'{"id":"drive-1","mimeType":"audio/mpeg","size":[]}',
        b'{"id":"drive-1","mimeType":"audio/mpeg","size":{}}',
        b'{"id":"drive-1","mimeType":"audio/mpeg","size":null}',
    ],
)
def test_malformed_drive_metadata_maps_to_unavailable(sqlite_session, models, monkeypatch, payload):
    from studio_api import google_drive
    from studio_api.job_source_availability import verify_processing_job_sources

    job_id, _, _, _, now, _ = make_processing_job(sqlite_session, models, source_type=models.SourceType.google_drive)

    class FakeResponse:
        def __enter__(self):
            return self
        def __exit__(self, exc_type, exc, tb):
            return False
        def read(self):
            return payload

    monkeypatch.setattr(google_drive, "urlopen", lambda req, timeout=10: FakeResponse())
    summary = verify_processing_job_sources(
        sqlite_session,
        job_id=job_id,
        lease_owner_id="worker-1",
        lease_generation=1,
        now=now,
        settings=SimpleSettings(),
        drive_token_resolver=lambda db, *, user_id, settings: "access-token-secret",
    )
    assert summary.ready is False
    assert "drive_metadata_unavailable" in summary.blocking_reasons
    assert "drive_file_identity_mismatch" not in summary.blocking_reasons
    assert_safe_summary(summary)


def test_source_retention_preference_allowlist_and_model_constraint():
    from studio_api.models import User
    from studio_api.source_policy import (
        DEFAULT_SOURCE_RETENTION_TTL_SECONDS,
        SOURCE_RETENTION_TTL_OPTIONS_SECONDS,
    )

    assert DEFAULT_SOURCE_RETENTION_TTL_SECONDS == 86400
    assert SOURCE_RETENTION_TTL_OPTIONS_SECONDS == (
        3600,
        86400,
        259200,
        604800,
        2592000,
    )
    assert User.__table__.c.source_retention_ttl_seconds.nullable is False
    retention_constraint = next(
        constraint
        for constraint in User.__table__.constraints
        if constraint.name == "ck_users_source_retention_ttl_allowed"
    )
    assert str(retention_constraint.sqltext) == (
        "source_retention_ttl_seconds IN (3600, 86400, 259200, 604800, 2592000)"
    )

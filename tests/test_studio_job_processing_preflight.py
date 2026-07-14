import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))

from studio_api.job_processing_preflight import build_processing_preflight


@dataclass
class ProjectStub:
    id: str = "project-1"
    output_drive_folder_id: str | None = None


@dataclass
class SourceStub:
    id: str
    project_id: str = "project-1"
    source_type: str = "google_drive"
    upload_status: str = "uploaded"
    deleted_at: datetime | None = None
    drive_file_id: str | None = None
    drive_file_url: str | None = None
    s3_bucket: str | None = None
    s3_object_key: str | None = None


@dataclass
class JobSourceStub:
    source: SourceStub
    position: int


@dataclass
class JobStub:
    id: str = "job-1"
    project_id: str = "project-1"
    status: str = "queued"
    provider_credential_id: str | None = None
    project: ProjectStub | None = None
    output_drive_folder_id: str | None = None
    sources: list[JobSourceStub] = field(default_factory=list)


def source(
    source_id,
    project_id="project-1",
    source_type="google_drive",
    upload_status="uploaded",
    deleted=False,
    missing_identity=False,
):
    src = SourceStub(id=source_id, project_id=project_id, source_type=source_type, upload_status=upload_status)
    if source_type == "google_drive" and not missing_identity:
        src.drive_file_id = f"drive_{source_id}"
        src.drive_file_url = "https://drive.google.com/file/d/private/view"
    if source_type == "local_upload" and not missing_identity:
        src.s3_bucket = "studio-temp"
        src.s3_object_key = "users/private/projects/project-1/sources/source/source"
    if deleted:
        src.deleted_at = datetime.now(timezone.utc)
    return src


def job_with_sources(*sources, status="queued", credential_id=None, output_folder_id=None):
    return JobStub(
        status=status,
        provider_credential_id=credential_id,
        project=ProjectStub(output_drive_folder_id=output_folder_id),
        output_drive_folder_id=output_folder_id,
        sources=[JobSourceStub(source=src, position=position) for position, src in enumerate(sources)],
    )


def assert_summary_safe(summary):
    text = str(summary).lower()
    for forbidden in [
        "users/private",
        "s3_object_key",
        "presigned",
        "raw-provider-secret",
        "ciphertext",
        "refresh-token",
        "token",
        "secret",
        "transcript body",
        "google docs body",
        "raw_provider",
        "file-mounted",
    ]:
        assert forbidden not in text


def test_processing_preflight_eligible_sources_preserves_order_and_safe_metadata():
    google = source("google-1")
    local = source("local-1", source_type="local_upload")

    summary = build_processing_preflight(job_with_sources(google, local, credential_id="credential-123", output_folder_id="folder-123"))

    assert summary["eligible"] is True
    assert summary["blocking_reasons"] == []
    assert [item["source_id"] for item in summary["sources"]] == ["google-1", "local-1"]
    assert [item["source_type"] for item in summary["sources"]] == ["google_drive", "local_upload"]
    assert all(item["ready"] for item in summary["sources"])
    assert summary["provider_credential_present"] is True
    assert summary["output_folder_configured"] is True
    assert "credential-123" not in str(summary)
    assert_summary_safe(summary)


def test_processing_preflight_blocks_terminal_job_without_mutating_status():
    job = job_with_sources(source("google-1"), status="completed")

    summary = build_processing_preflight(job)

    assert summary["eligible"] is False
    assert "job_status_not_queued" in summary["blocking_reasons"]
    assert job.status == "completed"
    assert_summary_safe(summary)


def test_processing_preflight_blocks_deleted_unuploaded_and_missing_identity_sources():
    cases = [
        (source("deleted", source_type="local_upload", upload_status="deleted", deleted=True), "source_deleted"),
        (source("pending", source_type="local_upload", upload_status="pending"), "source_not_uploaded"),
        (source("missing-identity", source_type="local_upload", missing_identity=True), "source_missing_required_identity"),
    ]

    for src, expected_reason in cases:
        summary = build_processing_preflight(job_with_sources(src))

        assert summary["eligible"] is False
        assert expected_reason in summary["blocking_reasons"]
        assert summary["sources"][0]["ready"] is False
        assert_summary_safe(summary)


def test_processing_preflight_output_folder_is_readiness_signal_only():
    summary = build_processing_preflight(job_with_sources(source("google-1"), output_folder_id=None))

    assert summary["eligible"] is True
    assert summary["output_folder_configured"] is False
    assert "output" not in summary
    assert "google_doc" not in str(summary).lower()
    assert_summary_safe(summary)

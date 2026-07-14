import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))

from studio_api.job_claim_readiness import build_claim_readiness, build_claim_readiness_from_preflight


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


def source(source_id, source_type="google_drive", upload_status="uploaded", missing_identity=False, deleted=False):
    src = SourceStub(id=source_id, source_type=source_type, upload_status=upload_status)
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
        "credential-123",
        "token",
        "secret",
        "transcript body",
        "google docs body",
        "raw_provider",
        "file-mounted",
        "env:",
    ]:
        assert forbidden not in text


def test_claim_readiness_eligible_queued_preflight_is_ready():
    summary = build_claim_readiness(job_with_sources(source("google-1"), credential_id="credential-123", output_folder_id="folder-123"))

    assert summary["ready_for_future_claim"] is True
    assert summary["blocking_reasons"] == []
    assert summary["preflight_eligible"] is True
    assert summary["source_count"] == 1
    assert summary["ready_source_count"] == 1
    assert summary["provider_credential_present"] is True
    assert summary["output_folder_configured"] is True
    assert_summary_safe(summary)


def test_claim_readiness_terminal_status_is_not_ready_and_does_not_mutate_job():
    job = job_with_sources(source("google-1"), status="completed")

    summary = build_claim_readiness(job)

    assert summary["ready_for_future_claim"] is False
    assert "job_status_not_queued" in summary["blocking_reasons"]
    assert summary["status"] == "completed"
    assert job.status == "completed"
    assert_summary_safe(summary)


def test_claim_readiness_propagates_source_and_preflight_blockers():
    summary = build_claim_readiness(job_with_sources(source("missing-identity", source_type="local_upload", missing_identity=True)))

    assert summary["ready_for_future_claim"] is False
    assert summary["preflight_eligible"] is False
    assert "source_missing_required_identity" in summary["blocking_reasons"]
    assert summary["ready_source_count"] == 0
    assert_summary_safe(summary)


def test_claim_readiness_no_source_case_is_blocked():
    summary = build_claim_readiness(job_with_sources())

    assert summary["ready_for_future_claim"] is False
    assert "job_has_no_sources" in summary["blocking_reasons"]
    assert "job_has_no_ready_sources" in summary["blocking_reasons"]
    assert summary["source_count"] == 0
    assert summary["ready_source_count"] == 0
    assert_summary_safe(summary)


def test_claim_readiness_provider_credential_is_boolean_presence_only():
    summary = build_claim_readiness(job_with_sources(source("google-1"), credential_id="credential-123"))

    assert summary["provider_credential_present"] is True
    assert "provider_credential_id" not in summary
    assert "credential-123" not in str(summary)
    assert_summary_safe(summary)


def test_claim_readiness_output_folder_is_reported_signal_only():
    summary = build_claim_readiness(job_with_sources(source("google-1"), output_folder_id=None))

    assert summary["ready_for_future_claim"] is True
    assert summary["output_folder_configured"] is False
    assert "output_folder_not_configured" not in summary["blocking_reasons"]
    assert_summary_safe(summary)


def test_claim_readiness_from_preflight_omits_raw_source_and_provider_material():
    summary = build_claim_readiness_from_preflight({
        "job_id": "job-1",
        "project_id": "project-1",
        "status": "queued",
        "eligible": True,
        "blocking_reasons": [],
        "sources": [{
            "source_id": "source-1",
            "source_type": "local_upload",
            "upload_status": "uploaded",
            "project_matches_job": True,
            "is_deleted": False,
            "has_required_identity": True,
            "is_uploaded": True,
            "ready": True,
            "blocking_reasons": [],
        }],
        "provider_credential_present": True,
        "output_folder_configured": False,
    })

    assert summary["ready_for_future_claim"] is True
    assert set(summary) == {
        "job_id",
        "project_id",
        "status",
        "claim_contract_version",
        "ready_for_future_claim",
        "blocking_reasons",
        "preflight_eligible",
        "source_count",
        "ready_source_count",
        "provider_credential_present",
        "output_folder_configured",
    }
    assert_summary_safe(summary)

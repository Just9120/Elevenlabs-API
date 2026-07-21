import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))
os.environ.setdefault("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")

from studio_api.main import job_payload, project_payload
from studio_api.models import JobStatus


NOW = datetime(2026, 7, 21, tzinfo=timezone.utc)
PROJECT_KEYS = {
    "id",
    "title",
    "description",
    "output_drive_folder_id",
    "output_drive_folder_url",
    "output_drive_folder_name",
    "created_at",
    "updated_at",
    "archived_at",
}
JOB_KEYS = {
    "id",
    "project_id",
    "status",
    "title",
    "provider",
    "source_count",
    "created_at",
    "updated_at",
    "cancelled_at",
    "cancel_requested_at",
    "attempt_count",
    "started_at",
    "finished_at",
    "error_code",
    "error_message",
    "output_folder",
}


def test_project_browser_payload_has_an_explicit_minimum_contract():
    project = SimpleNamespace(
        id="project-public",
        owner_user_id="owner-internal",
        title="Project",
        description=None,
        output_drive_folder_id=None,
        output_drive_folder_url=None,
        output_drive_folder_name=None,
        created_at=NOW,
        updated_at=NOW,
        archived_at=None,
    )

    payload = project_payload(project)

    assert set(payload) == PROJECT_KEYS
    assert "owner_user_id" not in payload


def test_job_browser_payload_omits_credential_and_worker_authority():
    job = SimpleNamespace(
        id="job-public",
        project_id="project-public",
        owner_user_id="owner-internal",
        status=JobStatus.queued,
        title="Job",
        provider="elevenlabs",
        provider_credential_id="credential-internal",
        sources=[],
        created_at=NOW,
        updated_at=NOW,
        cancelled_at=None,
        cancel_requested_at=None,
        attempt_count=0,
        started_at=None,
        finished_at=None,
        error_code=None,
        error_message=None,
        output_drive_folder_id=None,
        output_drive_folder_url=None,
        output_drive_folder_name=None,
        lease_owner_id="worker-internal",
        lease_generation=7,
    )

    payload = job_payload(job)

    assert set(payload) == JOB_KEYS
    assert "owner_user_id" not in payload
    assert "provider_credential_id" not in payload
    assert "lease_owner_id" not in payload
    assert "lease_generation" not in payload

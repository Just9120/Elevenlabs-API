from __future__ import annotations

import sys
from datetime import timedelta
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps/studio-api"))

from studio_api.config import get_settings


E2E_DATABASE_NAME = "studio_browser_e2e"
E2E_EMAIL = "browser-e2e@example.com"
E2E_PASSWORD = "browser-e2e-password"


def _require_isolated_database() -> None:
    settings = get_settings()
    if (
        settings.environment != "test"
        or settings.database_name != E2E_DATABASE_NAME
        or settings.database_host not in {"127.0.0.1", "localhost"}
    ):
        raise RuntimeError("browser E2E seed requires the isolated local test database")


def seed() -> None:
    _require_isolated_database()
    from studio_api.db import SessionLocal
    from studio_api.diagnostics import write_diagnostic_event
    from studio_api.models import (
        JobSourceStatus,
        JobStatus,
        LocalIdentity,
        OutputReconciliationStatus,
        Project,
        Source,
        SourceType,
        SourceUploadStatus,
        TranscriptionJob,
        TranscriptionJobOutput,
        TranscriptionJobSource,
        TranscriptionOutputReconciliation,
        User,
        UserRole,
        UserStatus,
    )
    from studio_api.security import hash_password, utcnow

    now = utcnow()
    with SessionLocal() as db:
        if db.query(User.id).first() is not None:
            raise RuntimeError("browser E2E seed requires an empty database")

        user = User(
            email=E2E_EMAIL,
            role=UserRole.admin,
            status=UserStatus.active,
        )
        db.add(user)
        db.flush()
        db.add(
            LocalIdentity(
                user_id=user.id,
                password_hash=hash_password(E2E_PASSWORD),
            )
        )

        project = Project(
            owner_user_id=user.id,
            title="Browser E2E Results",
            description="Synthetic completed result fixture",
            output_drive_folder_id="browser-e2e-folder",
            output_drive_folder_url=(
                "https://drive.google.com/drive/folders/browser-e2e-folder"
            ),
            output_drive_folder_name="Browser E2E output",
        )
        db.add(project)
        db.flush()

        source = Source(
            project_id=project.id,
            source_type=SourceType.google_drive,
            original_filename="browser-e2e-audio.mp3",
            mime_type="audio/mpeg",
            size_bytes=128,
            drive_file_id="browser-e2e-source",
            drive_file_url=(
                "https://drive.google.com/file/d/browser-e2e-source/view"
            ),
            upload_status=SourceUploadStatus.uploaded,
            uploaded_at=now - timedelta(minutes=2),
        )
        db.add(source)
        db.flush()

        job = TranscriptionJob(
            project_id=project.id,
            owner_user_id=user.id,
            status=JobStatus.completed,
            provider="elevenlabs",
            title="Browser E2E completed job",
            output_drive_folder_id=project.output_drive_folder_id,
            output_drive_folder_url=project.output_drive_folder_url,
            output_drive_folder_name=project.output_drive_folder_name,
            attempt_count=1,
            lease_generation=1,
            started_at=now - timedelta(minutes=2),
            finished_at=now - timedelta(minutes=1),
        )
        db.add(job)
        db.flush()

        relation = TranscriptionJobSource(
            job_id=job.id,
            source_id=source.id,
            position=0,
            status=JobSourceStatus.queued,
        )
        db.add(relation)
        db.flush()
        output = TranscriptionJobOutput(
            job_id=job.id,
            job_source_id=relation.id,
            document_id="browser-e2e-document",
            web_view_url=(
                "https://docs.google.com/document/d/"
                "browser-e2e-document/edit"
            ),
            output_drive_folder_id="browser-e2e-folder",
            output_kind="google_doc",
            transcript_standard="elevenlabs",
            document_character_count=42,
            document_created_at=now - timedelta(minutes=1),
            persisted_at=now - timedelta(minutes=1),
            lease_generation=1,
        )
        db.add(output)
        db.flush()
        db.add(
            TranscriptionOutputReconciliation(
                owner_user_id=user.id,
                project_id=project.id,
                job_id=job.id,
                job_source_id=relation.id,
                reconciliation_token="or_browser_e2e_resolved",
                lease_generation=1,
                attempt_number=1,
                status=OutputReconciliationStatus.resolved,
                expected_output_drive_folder_id="browser-e2e-folder",
                expected_document_character_count=42,
                prepared_at=now - timedelta(minutes=1, seconds=5),
                creation_started_at=now - timedelta(minutes=1, seconds=5),
                returned_document_id="browser-e2e-document",
                returned_web_view_url=(
                    "https://docs.google.com/document/d/"
                    "browser-e2e-document/edit"
                ),
                returned_document_created_at=now - timedelta(minutes=1),
                resolved_output_id=output.id,
                resolved_at=now - timedelta(minutes=1),
                created_at=now - timedelta(minutes=1, seconds=5),
                updated_at=now - timedelta(minutes=1),
            )
        )
        owner_user_id = user.id
        result_project_id = project.id
        result_job_id = job.id
        db.commit()

    diagnostic_events = (
        (
            "api",
            "JOB_CREATED",
            {
                "source_count": 1,
                "batch_position": 0,
                "credential_selected": True,
            },
            now - timedelta(minutes=2),
        ),
        (
            "worker",
            "OUTPUT_PERSISTED",
            {"output_count": 1, "attempt_number": 1},
            now - timedelta(minutes=1, seconds=1),
        ),
        (
            "worker",
            "JOB_COMPLETED",
            {
                "final_job_status": "completed",
                "output_count": 1,
                "attempt_number": 1,
            },
            now - timedelta(minutes=1),
        ),
    )
    for component, event_code, metadata, occurred_at in diagnostic_events:
        result = write_diagnostic_event(
            owner_user_id=owner_user_id,
            component=component,
            event_code=event_code,
            project_id=result_project_id,
            job_id=result_job_id,
            metadata=metadata,
            session_factory=SessionLocal,
            now=occurred_at,
        )
        if not result.accepted or not result.persisted:
            raise RuntimeError(
                f"browser E2E diagnostic seed failed for {event_code}"
            )


if __name__ == "__main__":
    seed()
    print("STUDIO_BROWSER_E2E_SEED_OK")

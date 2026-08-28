from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import sys

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))
if "STUDIO_DATABASE_HOST" not in os.environ:
    os.environ.setdefault("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")

from studio_api.db import Base
from studio_api.models import TranscriptMaintenanceRunStatus, User
from studio_api.transcript_catalog_scan import (
    CatalogGoogleReadError,
    CatalogGoogleReadReason,
)
from studio_api.transcript_maintenance_dry_run import (
    TranscriptMaintenanceSelectionMode,
)
from studio_api.transcript_maintenance_runs import (
    TranscriptMaintenanceOperation,
    TranscriptMaintenanceRunError,
    TranscriptMaintenanceRunReason,
    TranscriptMaintenanceWorkflow,
    claim_next_transcript_maintenance_run,
    create_transcript_maintenance_run,
    owned_transcript_maintenance_run,
    process_claimed_transcript_maintenance_run,
    transcript_maintenance_run_payload,
)


NOW = datetime(2026, 8, 29, 8, 0, tzinfo=timezone.utc)


@pytest.fixture()
def db():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, expire_on_commit=False)()
    session.add(User(id="owner-1", email="owner@example.com"))
    session.commit()
    try:
        yield session
    finally:
        session.close()


def _dry_run(db, *, key="dry-run-key-0001", target="folder-1"):
    return create_transcript_maintenance_run(
        db,
        owner_user_id="owner-1",
        workflow=TranscriptMaintenanceWorkflow.standardization,
        operation=TranscriptMaintenanceOperation.dry_run,
        selection_mode=TranscriptMaintenanceSelectionMode.folder_tree,
        folder_id=target,
        document_id=None,
        target_name="Созвоны",
        idempotency_key=key,
        now=NOW,
    )


def test_run_creation_is_idempotent_owner_scoped_and_browser_safe(db):
    run = _dry_run(db)
    repeated = _dry_run(db)
    assert repeated.id == run.id
    payload = transcript_maintenance_run_payload(run)
    assert payload["status"] == "queued"
    assert payload["target_name"] == "Созвоны"
    assert "folder_id" not in payload
    assert "idempotency_key" not in payload

    with pytest.raises(TranscriptMaintenanceRunError) as error:
        _dry_run(db, key="dry-run-key-0002")
    assert error.value.reason == TranscriptMaintenanceRunReason.active_run_exists

    with pytest.raises(TranscriptMaintenanceRunError) as malformed:
        owned_transcript_maintenance_run(
            db,
            owner_user_id="owner-1",
            run_id="------------------------------------",
        )
    assert malformed.value.reason == TranscriptMaintenanceRunReason.run_not_found


def test_apply_requires_matching_successful_preview(db):
    preview = _dry_run(db)
    preview.status = TranscriptMaintenanceRunStatus.succeeded
    preview.current_stage = "completed"
    preview.result_json = json.dumps({"workflow": "standardization"})
    preview.finished_at = NOW
    db.commit()

    apply = create_transcript_maintenance_run(
        db,
        owner_user_id="owner-1",
        workflow=TranscriptMaintenanceWorkflow.standardization,
        operation=TranscriptMaintenanceOperation.apply,
        selection_mode=TranscriptMaintenanceSelectionMode.folder_tree,
        folder_id="folder-1",
        document_id=None,
        target_name="Созвоны",
        idempotency_key="apply-key-0000001",
        preview_run_id=preview.id,
        now=NOW + timedelta(seconds=1),
    )
    assert apply.preview_run_id == preview.id

    with pytest.raises(TranscriptMaintenanceRunError) as error:
        create_transcript_maintenance_run(
            db,
            owner_user_id="owner-1",
            workflow=TranscriptMaintenanceWorkflow.catalog_import,
            operation=TranscriptMaintenanceOperation.apply,
            selection_mode=TranscriptMaintenanceSelectionMode.folder_tree,
            folder_id="folder-1",
            document_id=None,
            target_name="Созвоны",
            idempotency_key="apply-key-0000002",
            preview_run_id=preview.id,
            now=NOW + timedelta(seconds=2),
        )
    assert error.value.reason == TranscriptMaintenanceRunReason.preview_invalid


def test_claim_and_process_persists_progress_and_result(db, monkeypatch):
    run = _dry_run(db)
    claimed = claim_next_transcript_maintenance_run(
        db,
        lease_owner_id="studio-worker:test",
        now=NOW,
        lease_ttl=timedelta(minutes=5),
    )
    assert claimed is not None
    generation = claimed.lease_generation
    db.commit()

    monkeypatch.setattr(
        "studio_api.transcript_maintenance_runs.refresh_user_google_maintenance_access_token",
        lambda *_args, **_kwargs: "private-token",
    )

    def build(*_args, progress, **_kwargs):
        progress("scanning", 2, None)
        progress("inspecting", 3, 3)
        return {
            "workflow": "standardization",
            "operation": "dry_run",
            "target_standard": "transcript_doc",
            "items": [],
            "summary": {
                "standardize_document_count": 0,
                "unchanged_count": 0,
                "blocked_count": 0,
            },
            "selection_summary": {
                "google_document_count": 3,
                "nested_folder_count": 1,
                "skipped_non_document_count": 0,
                "pages_scanned": 2,
                "unreadable_document_count": 0,
            },
        }

    monkeypatch.setattr(
        "studio_api.transcript_maintenance_runs.build_transcript_standardization_dry_run",
        build,
    )
    result = process_claimed_transcript_maintenance_run(
        db,
        run_id=run.id,
        lease_owner_id="studio-worker:test",
        lease_generation=generation,
        settings=object(),
        clock=lambda: NOW + timedelta(seconds=10),
    )
    assert result.status == "succeeded"
    persisted = owned_transcript_maintenance_run(
        db, owner_user_id="owner-1", run_id=run.id
    )
    payload = transcript_maintenance_run_payload(persisted)
    assert payload["progress"] == {"completed": 3, "total": 3}
    assert payload["result"]["target_standard"] == "transcript_doc"
    assert persisted.lease_owner_id is None


def test_google_timeout_becomes_specific_retryable_terminal_error(db, monkeypatch):
    run = _dry_run(db)
    claimed = claim_next_transcript_maintenance_run(
        db,
        lease_owner_id="studio-worker:test",
        now=NOW,
        lease_ttl=timedelta(minutes=5),
    )
    generation = claimed.lease_generation
    db.commit()
    monkeypatch.setattr(
        "studio_api.transcript_maintenance_runs.refresh_user_google_maintenance_access_token",
        lambda *_args, **_kwargs: "private-token",
    )
    monkeypatch.setattr(
        "studio_api.transcript_maintenance_runs.build_transcript_standardization_dry_run",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            CatalogGoogleReadError(CatalogGoogleReadReason.timeout)
        ),
    )
    result = process_claimed_transcript_maintenance_run(
        db,
        run_id=run.id,
        lease_owner_id="studio-worker:test",
        lease_generation=generation,
        settings=object(),
        clock=lambda: NOW + timedelta(seconds=10),
    )
    assert result.status == "failed"
    payload = transcript_maintenance_run_payload(
        owned_transcript_maintenance_run(
            db, owner_user_id="owner-1", run_id=run.id
        )
    )
    assert payload["error"] == {
        "code": "catalog_google_timeout",
        "retryable": True,
    }
    assert payload["result"] is None


def test_lost_lease_cannot_overwrite_a_reclaimed_run(db, monkeypatch):
    run = _dry_run(db)
    claimed = claim_next_transcript_maintenance_run(
        db,
        lease_owner_id="studio-worker:first",
        now=NOW,
        lease_ttl=timedelta(minutes=5),
    )
    generation = claimed.lease_generation
    db.commit()
    monkeypatch.setattr(
        "studio_api.transcript_maintenance_runs.refresh_user_google_maintenance_access_token",
        lambda *_args, **_kwargs: "private-token",
    )

    def lose_lease(*_args, **_kwargs):
        persisted = owned_transcript_maintenance_run(
            db,
            owner_user_id="owner-1",
            run_id=run.id,
        )
        persisted.lease_owner_id = "studio-worker:replacement"
        persisted.lease_generation += 1
        persisted.lease_expires_at = NOW + timedelta(minutes=10)
        db.commit()
        raise CatalogGoogleReadError(CatalogGoogleReadReason.timeout)

    monkeypatch.setattr(
        "studio_api.transcript_maintenance_runs.build_transcript_standardization_dry_run",
        lose_lease,
    )

    with pytest.raises(TranscriptMaintenanceRunError) as error:
        process_claimed_transcript_maintenance_run(
            db,
            run_id=run.id,
            lease_owner_id="studio-worker:first",
            lease_generation=generation,
            settings=object(),
            clock=lambda: NOW + timedelta(seconds=10),
        )
    assert error.value.reason == TranscriptMaintenanceRunReason.lease_not_owned
    persisted = owned_transcript_maintenance_run(
        db,
        owner_user_id="owner-1",
        run_id=run.id,
    )
    assert persisted.status == TranscriptMaintenanceRunStatus.running
    assert persisted.lease_owner_id == "studio-worker:replacement"
    assert persisted.error_code is None

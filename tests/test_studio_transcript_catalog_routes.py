from __future__ import annotations

import base64
from datetime import datetime, timezone
import os
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))
PASSWORD_FILE = Path(tempfile.gettempdir()) / "studio_routes_test_pg_password"
MASTER_KEY_FILE = Path(tempfile.gettempdir()) / "studio_routes_test_master_key"
PASSWORD_FILE.write_text("studio_test_password", encoding="utf-8")
MASTER_KEY_FILE.write_text(
    base64.b64encode(b"1" * 32).decode(),
    encoding="utf-8",
)
os.environ.setdefault("STUDIO_DATABASE_SCHEME", "postgresql+psycopg")
os.environ.setdefault("STUDIO_DATABASE_HOST", "127.0.0.1")
os.environ.setdefault("STUDIO_DATABASE_PORT", "5432")
os.environ.setdefault("STUDIO_DATABASE_NAME", "studio_test")
os.environ.setdefault("STUDIO_DATABASE_USER", "studio_test")
os.environ.setdefault("STUDIO_POSTGRES_PASSWORD_FILE", str(PASSWORD_FILE))
os.environ.setdefault(
    "STUDIO_CREDENTIAL_MASTER_KEY_FILE",
    str(MASTER_KEY_FILE),
)


class FakeDb:
    def __init__(self):
        self.commits = 0
        self.rollbacks = 0

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def _client(monkeypatch):
    from studio_api.db import get_db
    from studio_api.deps import current_session, require_csrf
    from studio_api import transcript_catalog_routes as routes

    db = FakeDb()
    owner = SimpleNamespace(id="private-owner")
    app = FastAPI()
    app.include_router(routes.router)
    app.dependency_overrides[require_csrf] = lambda: (SimpleNamespace(), owner)
    app.dependency_overrides[current_session] = lambda: (SimpleNamespace(), owner)
    app.dependency_overrides[get_db] = lambda: db
    monkeypatch.setattr(routes.catalog_limiter, "check", lambda *args: None)
    return TestClient(app), db, routes


def _run(
    *,
    workflow="standardization",
    operation="dry_run",
    status="queued",
    run_id="00000000-0000-4000-8000-000000000001",
    preview_run_id=None,
):
    from studio_api.models import TranscriptMaintenanceRunStatus

    timestamp = datetime(2026, 8, 29, tzinfo=timezone.utc)
    return SimpleNamespace(
        id=run_id,
        workflow=workflow,
        operation=operation,
        selection_mode="folder_tree",
        folder_id="private-folder",
        document_id=None,
        target_name="Архив созвонов",
        preview_run_id=preview_run_id,
        idempotency_key="private-idempotency-key",
        status=TranscriptMaintenanceRunStatus(status),
        current_stage="queued" if status == "queued" else "completed",
        progress_completed=0,
        progress_total=None,
        result_json=None,
        error_code=None,
        error_retryable=None,
        created_at=timestamp,
        started_at=None,
        finished_at=None,
    )


def test_legacy_combined_routes_are_fail_closed_after_split(monkeypatch):
    client, db, _routes = _client(monkeypatch)

    responses = (
        client.post(
            "/api/transcript-catalog/migration/dry-run",
            json={"folder_id": "private-folder"},
        ),
        client.post(
            "/api/transcript-catalog/migration/apply",
            json={"folder_id": "private-folder", "confirm_apply": True},
        ),
    )

    for response in responses:
        assert response.status_code == 410
        assert response.json()["detail"] == {
            "reason": "transcript_maintenance_split_required",
            "retryable": False,
        }
        assert response.headers["cache-control"] == "no-store"
        assert "private-folder" not in response.text
    assert db.commits == 0
    assert db.rollbacks == 0


def test_dry_run_routes_enqueue_independent_owner_scoped_runs(monkeypatch):
    client, _db, routes = _client(monkeypatch)
    calls = []
    limiter_calls = []

    def create(db, **kwargs):
        calls.append((db, kwargs))
        return _run(workflow=kwargs["workflow"].value)

    monkeypatch.setattr(routes, "create_transcript_maintenance_run", create)
    monkeypatch.setattr(
        routes.catalog_limiter,
        "check",
        lambda *args: limiter_calls.append(args),
    )
    body = {
        "selection_mode": "folder_tree",
        "folder_id": "private-folder",
        "target_name": "Архив созвонов",
        "idempotency_key": "dry-run-key-00000001",
    }

    standardization = client.post(
        "/api/transcript-maintenance/standardization/dry-run",
        json=body,
    )
    catalog = client.post(
        "/api/transcript-maintenance/catalog-import/dry-run",
        json=body,
    )

    assert standardization.status_code == 202
    assert catalog.status_code == 202
    assert standardization.json()["workflow"] == "standardization"
    assert catalog.json()["workflow"] == "catalog_import"
    assert [call[1]["owner_user_id"] for call in calls] == [
        "private-owner",
        "private-owner",
    ]
    assert [call[1]["workflow"].value for call in calls] == [
        "standardization",
        "catalog_import",
    ]
    assert all(call[1]["folder_id"] == "private-folder" for call in calls)
    assert limiter_calls == [
        (
            "transcript-maintenance:standardization:dry-run:private-owner",
            20,
            3600,
        ),
        (
            "transcript-maintenance:catalog-import:dry-run:private-owner",
            20,
            3600,
        ),
    ]
    encoded = standardization.text + catalog.text
    for private in ("private-owner", "private-folder", "private-idempotency-key"):
        assert private not in encoded
    assert standardization.headers["cache-control"] == "no-store"
    assert catalog.headers["cache-control"] == "no-store"


def test_dry_run_rejects_missing_mismatched_and_untrusted_fields(monkeypatch):
    client, _db, routes = _client(monkeypatch)
    calls = []
    monkeypatch.setattr(
        routes,
        "create_transcript_maintenance_run",
        lambda *args, **kwargs: calls.append((args, kwargs)),
    )
    valid = {
        "selection_mode": "single_document",
        "document_id": "private-document",
        "target_name": "Один документ",
        "idempotency_key": "dry-run-key-00000001",
    }
    invalid_bodies = (
        {},
        {**valid, "folder_id": "private-folder"},
        {**valid, "document_id": "документ"},
        {**valid, "items": [{"action": "standardize_document"}]},
        {
            "selection_mode": "folder_tree",
            "document_id": "private-document",
            "target_name": "Архив",
            "idempotency_key": "dry-run-key-00000001",
        },
        {**valid, "idempotency_key": "short"},
    )

    for body in invalid_bodies:
        assert client.post(
            "/api/transcript-maintenance/standardization/dry-run",
            json=body,
        ).status_code == 422
    assert calls == []


def test_apply_uses_only_successful_preview_authority(monkeypatch):
    client, _db, routes = _client(monkeypatch)
    calls = []
    preview_id = "00000000-0000-4000-8000-000000000001"

    def create_apply(db, **kwargs):
        calls.append((db, kwargs))
        return _run(
            workflow=kwargs["workflow"].value,
            operation="apply",
            run_id="00000000-0000-4000-8000-000000000002",
            preview_run_id=preview_id,
        )

    monkeypatch.setattr(
        routes,
        "create_transcript_maintenance_apply_run",
        create_apply,
    )
    body = {
        "confirm_apply": True,
        "preview_run_id": preview_id,
        "idempotency_key": "apply-key-000000001",
    }
    response = client.post(
        "/api/transcript-maintenance/standardization/apply",
        json=body,
    )

    assert response.status_code == 202
    assert calls[0][1] == {
        "owner_user_id": "private-owner",
        "workflow": routes.TranscriptMaintenanceWorkflow.standardization,
        "preview_run_id": preview_id,
        "idempotency_key": "apply-key-000000001",
    }
    assert "private-folder" not in response.text
    assert client.post(
        "/api/transcript-maintenance/standardization/apply",
        json={**body, "confirm_apply": False},
    ).status_code == 422
    assert client.post(
        "/api/transcript-maintenance/standardization/apply",
        json={**body, "folder_id": "private-folder"},
    ).status_code == 422


def test_run_creation_errors_are_normalized_without_private_state(monkeypatch):
    from studio_api.transcript_maintenance_runs import (
        TranscriptMaintenanceRunError,
        TranscriptMaintenanceRunReason,
    )

    client, db, routes = _client(monkeypatch)
    monkeypatch.setattr(
        routes,
        "create_transcript_maintenance_run",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            TranscriptMaintenanceRunError(
                TranscriptMaintenanceRunReason.active_run_exists
            )
        ),
    )
    response = client.post(
        "/api/transcript-maintenance/catalog-import/dry-run",
        json={
            "selection_mode": "folder_tree",
            "folder_id": "private-folder",
            "target_name": "Архив",
            "idempotency_key": "dry-run-key-00000001",
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"] == {
        "reason": "transcript_maintenance_run_in_progress",
        "retryable": False,
    }
    assert response.headers["cache-control"] == "no-store"
    assert db.rollbacks == 1
    assert "private-folder" not in response.text


def test_latest_and_exact_run_reads_are_owner_scoped_and_no_store(monkeypatch):
    client, db, routes = _client(monkeypatch)
    run = _run()
    calls = []
    monkeypatch.setattr(
        routes,
        "latest_transcript_maintenance_run",
        lambda db_arg, **kwargs: calls.append(("latest", db_arg, kwargs)) or run,
    )
    monkeypatch.setattr(
        routes,
        "owned_transcript_maintenance_run",
        lambda db_arg, **kwargs: calls.append(("owned", db_arg, kwargs)) or run,
    )

    latest = client.get(
        "/api/transcript-maintenance/runs?workflow=standardization"
    )
    exact = client.get(f"/api/transcript-maintenance/runs/{run.id}")

    assert latest.status_code == 200
    assert latest.json()["run"]["id"] == run.id
    assert exact.status_code == 200
    assert exact.json()["id"] == run.id
    assert calls == [
        (
            "latest",
            db,
            {
                "owner_user_id": "private-owner",
                "workflow": routes.TranscriptMaintenanceWorkflow.standardization,
            },
        ),
        (
            "owned",
            db,
            {"owner_user_id": "private-owner", "run_id": run.id},
        ),
    ]
    assert latest.headers["cache-control"] == "no-store"
    assert exact.headers["cache-control"] == "no-store"
    assert "private-folder" not in latest.text + exact.text


def test_missing_owned_run_is_safe_404(monkeypatch):
    from studio_api.transcript_maintenance_runs import (
        TranscriptMaintenanceRunError,
        TranscriptMaintenanceRunReason,
    )

    client, _db, routes = _client(monkeypatch)
    monkeypatch.setattr(
        routes,
        "owned_transcript_maintenance_run",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            TranscriptMaintenanceRunError(
                TranscriptMaintenanceRunReason.run_not_found
            )
        ),
    )
    response = client.get(
        "/api/transcript-maintenance/runs/00000000-0000-4000-8000-000000000099"
    )
    assert response.status_code == 404
    assert response.json()["detail"] == {
        "reason": "transcript_maintenance_run_not_found",
        "retryable": False,
    }
    assert response.headers["cache-control"] == "no-store"

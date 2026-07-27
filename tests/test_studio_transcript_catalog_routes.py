from __future__ import annotations

import base64
import json
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
        self.added = []
        self.commits = 0
        self.rollbacks = 0

    def add(self, value):
        self.added.append(value)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def _client(monkeypatch):
    from studio_api.config import get_settings
    from studio_api.db import get_db
    from studio_api.deps import require_csrf
    from studio_api import transcript_catalog_routes as routes

    db = FakeDb()
    app = FastAPI()
    app.include_router(routes.router)
    app.dependency_overrides[require_csrf] = lambda: (
        SimpleNamespace(),
        SimpleNamespace(id="private-owner"),
    )
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_settings] = lambda: SimpleNamespace()
    monkeypatch.setattr(
        routes.catalog_limiter,
        "check",
        lambda *args, **kwargs: None,
    )
    monkeypatch.setattr(
        routes,
        "_catalog_access_token",
        lambda *args, **kwargs: "private-access-token",
    )
    return TestClient(app), db, routes


def test_catalog_routes_rescan_apply_and_return_only_safe_payload(
    monkeypatch,
):
    client, db, routes = _client(monkeypatch)
    calls = []
    inspection = SimpleNamespace(
        candidates=("private-server-candidate",),
        created_time_by_document_id={
            "private-document": "2026-07-01T00:00:00Z"
        },
        scan_summary={
            "google_document_count": 1,
            "nested_folder_count": 0,
            "skipped_non_document_count": 0,
            "unreadable_document_count": 0,
            "pages_scanned": 1,
        },
    )

    def dry_run(*args, **kwargs):
        calls.append(("dry_run", kwargs["folder_id"]))
        assert kwargs["access_token"] == "private-access-token"
        return {
            "operation": "dry_run",
            "target_standard": "transcript_doc_v1.2",
            "items": [{"position": 0, "name": "Safe document"}],
            "summary": {"blocked_count": 0},
            "scan_summary": inspection.scan_summary,
        }

    def inspect(*args, **kwargs):
        calls.append(("apply_scan", kwargs["folder_id"]))
        assert kwargs["access_token"] == "private-access-token"
        return inspection

    def execute(*args, **kwargs):
        calls.append(("apply_execute", len(kwargs["candidates"])))
        assert kwargs["access_token"] == "private-access-token"
        assert kwargs["created_time_by_document_id"] == (
            inspection.created_time_by_document_id
        )
        return {
            "operation": "apply",
            "target_standard": "transcript_doc_v1.2",
            "items": [
                {
                    "position": 0,
                    "name": "Safe document",
                    "action": "standardize_and_import",
                    "outcome": "imported",
                    "reason_code": None,
                    "standardization_outcome": "changed",
                }
            ],
            "summary": {"imported_count": 1},
        }

    monkeypatch.setattr(
        routes,
        "build_catalog_migration_dry_run",
        dry_run,
    )
    monkeypatch.setattr(
        routes,
        "inspect_catalog_migration_folder",
        inspect,
    )
    monkeypatch.setattr(
        routes,
        "execute_catalog_migration_apply",
        execute,
    )

    dry_response = client.post(
        "/api/transcript-catalog/migration/dry-run",
        json={"folder_id": "private-folder"},
    )
    apply_response = client.post(
        "/api/transcript-catalog/migration/apply",
        json={
            "folder_id": "private-folder",
            "confirm_apply": True,
        },
    )

    assert dry_response.status_code == 200
    assert apply_response.status_code == 200
    assert dry_response.headers["cache-control"] == "no-store"
    assert apply_response.headers["cache-control"] == "no-store"
    assert calls == [
        ("dry_run", "private-folder"),
        ("apply_scan", "private-folder"),
        ("apply_execute", 1),
    ]
    assert db.commits == 1
    assert db.rollbacks == 0
    assert len(db.added) == 1
    encoded = json.dumps(
        (dry_response.json(), apply_response.json()),
        ensure_ascii=False,
    )
    for private in (
        "private-owner",
        "private-access-token",
        "private-folder",
        "private-document",
        "private-server-candidate",
    ):
        assert private not in encoded


def test_catalog_apply_requires_confirmation_and_rejects_preview_fields(
    monkeypatch,
):
    client, db, routes = _client(monkeypatch)
    called = []
    monkeypatch.setattr(
        routes,
        "inspect_catalog_migration_folder",
        lambda *args, **kwargs: called.append(True),
    )

    not_confirmed = client.post(
        "/api/transcript-catalog/migration/apply",
        json={
            "folder_id": "private-folder",
            "confirm_apply": False,
        },
    )
    untrusted_preview = client.post(
        "/api/transcript-catalog/migration/apply",
        json={
            "folder_id": "private-folder",
            "confirm_apply": True,
            "items": [{"position": 0, "action": "unchanged"}],
        },
    )

    assert not_confirmed.status_code == 422
    assert untrusted_preview.status_code == 422
    assert called == []
    assert db.commits == 0


def test_catalog_routes_normalize_google_errors_without_raw_payloads(
    monkeypatch,
):
    from studio_api.transcript_catalog_scan import (
        CatalogGoogleReadError,
        CatalogGoogleReadReason,
    )
    from studio_api.transcript_catalog_standardize import (
        CatalogGoogleWriteError,
        CatalogGoogleWriteReason,
    )

    client, db, routes = _client(monkeypatch)
    monkeypatch.setattr(
        routes,
        "build_catalog_migration_dry_run",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            CatalogGoogleReadError(
                CatalogGoogleReadReason.incomplete_search
            )
        ),
    )

    dry_response = client.post(
        "/api/transcript-catalog/migration/dry-run",
        json={"folder_id": "private-folder"},
    )
    assert dry_response.status_code == 409
    assert dry_response.json()["detail"] == {
        "reason": "catalog_scan_incomplete",
        "retryable": True,
    }

    monkeypatch.setattr(
        routes,
        "inspect_catalog_migration_folder",
        lambda *args, **kwargs: SimpleNamespace(
            candidates=("private-candidate",),
            created_time_by_document_id={},
            scan_summary={},
        ),
    )
    monkeypatch.setattr(
        routes,
        "execute_catalog_migration_apply",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            CatalogGoogleWriteError(
                CatalogGoogleWriteReason.revision_conflict_or_rejected
            )
        ),
    )
    apply_response = client.post(
        "/api/transcript-catalog/migration/apply",
        json={
            "folder_id": "private-folder",
            "confirm_apply": True,
        },
    )

    assert apply_response.status_code == 409
    assert apply_response.json()["detail"] == {
        "reason": "catalog_document_revision_changed",
        "retryable": True,
    }
    assert dry_response.headers["cache-control"] == "no-store"
    assert apply_response.headers["cache-control"] == "no-store"
    assert db.rollbacks == 2
    encoded = dry_response.text + apply_response.text
    assert "private-folder" not in encoded
    assert "private-candidate" not in encoded


def test_maintenance_dry_run_routes_are_independent_and_selected_only(
    monkeypatch,
):
    client, db, routes = _client(monkeypatch)
    calls = []
    limit_calls = []
    monkeypatch.setattr(
        routes.catalog_limiter,
        "check",
        lambda *args: limit_calls.append(args),
    )

    def standardization(**kwargs):
        calls.append(("standardization", kwargs))
        return {
            "workflow": "standardization",
            "operation": "dry_run",
            "items": [],
            "summary": {"standardize_document_count": 0},
            "selection_summary": {"selected_document_count": 2},
        }

    def catalog_import(db_arg, **kwargs):
        calls.append(("catalog_import", db_arg, kwargs))
        return {
            "workflow": "catalog_import",
            "operation": "dry_run",
            "items": [],
            "summary": {"import_metadata_count": 0},
            "selection_summary": {"selected_document_count": 2},
        }

    monkeypatch.setattr(
        routes,
        "build_transcript_standardization_dry_run",
        standardization,
    )
    monkeypatch.setattr(
        routes,
        "build_transcript_catalog_import_dry_run",
        catalog_import,
    )
    body = {
        "folder_id": "private-folder",
        "document_ids": ["private-first", "private-second"],
    }

    standardization_response = client.post(
        "/api/transcript-maintenance/standardization/dry-run",
        json=body,
    )
    catalog_response = client.post(
        "/api/transcript-maintenance/catalog-import/dry-run",
        json=body,
    )

    assert standardization_response.status_code == 200
    assert catalog_response.status_code == 200
    assert standardization_response.json()["workflow"] == "standardization"
    assert catalog_response.json()["workflow"] == "catalog_import"
    assert calls == [
        (
            "standardization",
            {
                "access_token": "private-access-token",
                "folder_id": "private-folder",
                "document_ids": (
                    "private-first",
                    "private-second",
                ),
            },
        ),
        (
            "catalog_import",
            db,
            {
                "owner_user_id": "private-owner",
                "access_token": "private-access-token",
                "folder_id": "private-folder",
                "document_ids": (
                    "private-first",
                    "private-second",
                ),
            },
        ),
    ]
    assert limit_calls == [
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
    assert standardization_response.headers["cache-control"] == "no-store"
    assert catalog_response.headers["cache-control"] == "no-store"
    assert db.commits == 0


def test_maintenance_dry_run_rejects_missing_or_untrusted_selection(
    monkeypatch,
):
    client, db, routes = _client(monkeypatch)
    called = []
    monkeypatch.setattr(
        routes,
        "build_transcript_standardization_dry_run",
        lambda **kwargs: called.append(kwargs),
    )
    missing = client.post(
        "/api/transcript-maintenance/standardization/dry-run",
        json={"folder_id": "private-folder"},
    )
    empty = client.post(
        "/api/transcript-maintenance/standardization/dry-run",
        json={"folder_id": "private-folder", "document_ids": []},
    )
    preview = client.post(
        "/api/transcript-maintenance/standardization/dry-run",
        json={
            "folder_id": "private-folder",
            "document_ids": ["private-document"],
            "items": [{"action": "standardize_document"}],
        },
    )

    assert missing.status_code == 422
    assert empty.status_code == 422
    assert preview.status_code == 422
    assert called == []
    assert db.commits == 0


def test_maintenance_selection_errors_are_safe_and_normalized(
    monkeypatch,
):
    from studio_api.transcript_document_selection import (
        TranscriptDocumentSelectionError,
        TranscriptDocumentSelectionReason,
    )

    client, db, routes = _client(monkeypatch)
    monkeypatch.setattr(
        routes,
        "build_transcript_catalog_import_dry_run",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            TranscriptDocumentSelectionError(
                TranscriptDocumentSelectionReason.document_out_of_folder
            )
        ),
    )

    response = client.post(
        "/api/transcript-maintenance/catalog-import/dry-run",
        json={
            "folder_id": "private-folder",
            "document_ids": ["private-document"],
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"] == {
        "reason": "transcript_document_out_of_folder",
        "retryable": False,
    }
    assert response.headers["cache-control"] == "no-store"
    assert db.rollbacks == 1
    assert "private-folder" not in response.text
    assert "private-document" not in response.text

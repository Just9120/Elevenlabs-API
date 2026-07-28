from __future__ import annotations

import base64
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
        "_maintenance_access_token",
        lambda *args, **kwargs: "private-access-token",
    )
    return TestClient(app), db, routes


def test_legacy_combined_routes_are_fail_closed_after_split(
    monkeypatch,
):
    client, db, _routes = _client(monkeypatch)

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

    for response in (dry_response, apply_response):
        assert response.status_code == 410
        assert response.json()["detail"] == {
            "reason": "transcript_maintenance_split_required",
            "retryable": False,
        }
        assert response.headers["cache-control"] == "no-store"
        assert "private-folder" not in response.text

    assert db.commits == 0
    assert db.rollbacks == 0
    assert db.added == []


def test_legacy_apply_still_rejects_unconfirmed_or_preview_payloads(
    monkeypatch,
):
    client, db, _routes = _client(monkeypatch)

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
    assert db.commits == 0
    assert db.rollbacks == 0
    assert db.added == []


def test_maintenance_dry_run_routes_are_independent_and_recursive(
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
            "selection_summary": {"google_document_count": 2},
        }

    def catalog_import(db_arg, **kwargs):
        calls.append(("catalog_import", db_arg, kwargs))
        return {
            "workflow": "catalog_import",
            "operation": "dry_run",
            "items": [],
            "summary": {"import_metadata_count": 0},
            "selection_summary": {"google_document_count": 2},
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
            },
        ),
        (
            "catalog_import",
            db,
            {
                "owner_user_id": "private-owner",
                "access_token": "private-access-token",
                "folder_id": "private-folder",
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


def test_maintenance_routes_fail_closed_on_server_grant_errors(
    monkeypatch,
):
    from studio_api.google_connection_access import (
        GoogleConnectionAccessError,
        GoogleConnectionAccessReason,
    )

    cases = (
        (
            GoogleConnectionAccessReason.maintenance_missing,
            "catalog_google_maintenance_connection_missing",
        ),
        (
            GoogleConnectionAccessReason.maintenance_inactive,
            "catalog_google_maintenance_connection_inactive",
        ),
        (
            GoogleConnectionAccessReason.maintenance_account_mismatch,
            "catalog_google_maintenance_account_mismatch",
        ),
    )

    for access_reason, response_reason in cases:
        client, db, routes = _client(monkeypatch)

        def reject_access(*args, _reason=access_reason, **kwargs):
            raise GoogleConnectionAccessError(_reason)

        monkeypatch.setattr(
            routes,
            "_maintenance_access_token",
            reject_access,
        )
        response = client.post(
            "/api/transcript-maintenance/standardization/dry-run",
            json={"folder_id": "private-folder"},
        )

        assert response.status_code == 409
        assert response.json()["detail"] == {
            "reason": response_reason,
            "retryable": False,
        }
        assert response.headers["cache-control"] == "no-store"
        assert db.commits == 0
        assert db.rollbacks == 1
        assert "private-folder" not in response.text


def test_maintenance_access_uses_only_server_grant(
    monkeypatch,
):
    from studio_api import transcript_catalog_routes as routes

    db = FakeDb()
    settings = SimpleNamespace()
    calls = []

    monkeypatch.setattr(
        routes,
        "refresh_user_google_maintenance_access_token",
        lambda *args, **kwargs: (
            calls.append((args, kwargs)) or "private-maintenance-token"
        ),
    )

    assert routes._maintenance_access_token(
        db,
        "private-owner",
        settings,
    ) == "private-maintenance-token"
    assert calls == [
        (
            (db,),
            {
                "user_id": "private-owner",
                "settings": settings,
            },
        )
    ]


def test_maintenance_dry_run_rejects_missing_or_untrusted_fields(
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
        json={},
    )
    legacy_selection = client.post(
        "/api/transcript-maintenance/standardization/dry-run",
        json={
            "folder_id": "private-folder",
            "document_ids": ["private-document"],
        },
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
    assert legacy_selection.status_code == 422
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
                TranscriptDocumentSelectionReason.folder_invalid
            )
        ),
    )

    response = client.post(
        "/api/transcript-maintenance/catalog-import/dry-run",
        json={
            "folder_id": "private-folder",
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"] == {
        "reason": "transcript_folder_invalid",
        "retryable": False,
    }
    assert response.headers["cache-control"] == "no-store"
    assert db.rollbacks == 1
    assert "private-folder" not in response.text
    assert "private-document" not in response.text


def test_maintenance_apply_routes_reinspect_and_execute_independently(
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
    standardization_inspection = SimpleNamespace(
        candidates=("private-standardization-candidate",),
        created_time_by_document_id={
            "private-document": "2026-07-01T00:00:00Z"
        },
        selection_summary={"google_document_count": 1},
    )
    catalog_inspection = SimpleNamespace(
        candidates=("private-catalog-candidate",),
        selection_summary={"google_document_count": 1},
    )

    def inspect_standardization(**kwargs):
        calls.append(("inspect_standardization", kwargs))
        return standardization_inspection

    def execute_standardization(**kwargs):
        calls.append(("execute_standardization", kwargs))
        return {
            "workflow": "standardization",
            "operation": "apply",
            "items": [],
            "summary": {"standardized_count": 0},
        }

    def inspect_catalog(db_arg, **kwargs):
        calls.append(("inspect_catalog", db_arg, kwargs))
        return catalog_inspection

    def apply_catalog(db_arg, **kwargs):
        calls.append(("apply_catalog", db_arg, kwargs))
        return {
            "workflow": "catalog_import",
            "operation": "apply",
            "items": [],
            "summary": {"imported_count": 0},
        }

    monkeypatch.setattr(
        routes,
        "inspect_transcript_standardization_selection",
        inspect_standardization,
    )
    monkeypatch.setattr(
        routes,
        "execute_transcript_standardization_apply",
        execute_standardization,
    )
    monkeypatch.setattr(
        routes,
        "inspect_transcript_catalog_import_selection",
        inspect_catalog,
    )
    monkeypatch.setattr(
        routes,
        "apply_transcript_catalog_import_metadata",
        apply_catalog,
    )
    body = {
        "folder_id": "private-folder",
        "confirm_apply": True,
    }

    standardization_response = client.post(
        "/api/transcript-maintenance/standardization/apply",
        json=body,
    )
    catalog_response = client.post(
        "/api/transcript-maintenance/catalog-import/apply",
        json=body,
    )

    assert standardization_response.status_code == 200
    assert catalog_response.status_code == 200
    assert standardization_response.json()["workflow"] == "standardization"
    assert catalog_response.json()["workflow"] == "catalog_import"
    assert calls == [
        (
            "inspect_standardization",
            {
                "access_token": "private-access-token",
                "folder_id": "private-folder",
            },
        ),
        (
            "execute_standardization",
            {
                "access_token": "private-access-token",
                "candidates": (
                    "private-standardization-candidate",
                ),
                "created_time_by_document_id": {
                    "private-document": "2026-07-01T00:00:00Z"
                },
            },
        ),
        (
            "inspect_catalog",
            db,
            {
                "owner_user_id": "private-owner",
                "access_token": "private-access-token",
                "folder_id": "private-folder",
            },
        ),
        (
            "apply_catalog",
            db,
            {
                "owner_user_id": "private-owner",
                "candidates": ("private-catalog-candidate",),
            },
        ),
    ]
    assert limit_calls == [
        (
            "transcript-maintenance:standardization:apply:private-owner",
            5,
            3600,
        ),
        (
            "transcript-maintenance:catalog-import:apply:private-owner",
            5,
            3600,
        ),
    ]
    assert db.commits == 2
    assert db.rollbacks == 0
    assert len(db.added) == 2
    assert standardization_response.headers["cache-control"] == "no-store"
    assert catalog_response.headers["cache-control"] == "no-store"
    encoded = standardization_response.text + catalog_response.text
    for private in (
        "private-owner",
        "private-access-token",
        "private-folder",
        "private-document",
        "private-standardization-candidate",
        "private-catalog-candidate",
    ):
        assert private not in encoded


def test_maintenance_apply_confirmation_is_required_per_endpoint(
    monkeypatch,
):
    client, db, routes = _client(monkeypatch)
    called = []
    monkeypatch.setattr(
        routes,
        "inspect_transcript_standardization_selection",
        lambda **kwargs: called.append(("standardization", kwargs)),
    )
    monkeypatch.setattr(
        routes,
        "inspect_transcript_catalog_import_selection",
        lambda *args, **kwargs: called.append(("catalog", kwargs)),
    )
    base = {
        "folder_id": "private-folder",
    }

    for path in (
        "/api/transcript-maintenance/standardization/apply",
        "/api/transcript-maintenance/catalog-import/apply",
    ):
        assert client.post(path, json=base).status_code == 422
        assert client.post(
            path,
            json={**base, "confirm_apply": False},
        ).status_code == 422

    assert called == []
    assert db.commits == 0


def test_standardization_apply_normalizes_google_write_failure(
    monkeypatch,
):
    from studio_api.transcript_catalog_standardize import (
        CatalogGoogleWriteError,
        CatalogGoogleWriteReason,
    )

    client, db, routes = _client(monkeypatch)
    monkeypatch.setattr(
        routes,
        "inspect_transcript_standardization_selection",
        lambda **kwargs: SimpleNamespace(
            candidates=("private-candidate",),
            created_time_by_document_id={},
            selection_summary={"google_document_count": 1},
        ),
    )
    monkeypatch.setattr(
        routes,
        "execute_transcript_standardization_apply",
        lambda **kwargs: (_ for _ in ()).throw(
            CatalogGoogleWriteError(
                CatalogGoogleWriteReason.revision_conflict_or_rejected
            )
        ),
    )

    response = client.post(
        "/api/transcript-maintenance/standardization/apply",
        json={
            "folder_id": "private-folder",
            "confirm_apply": True,
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"] == {
        "reason": "catalog_document_revision_changed",
        "retryable": True,
    }
    assert response.headers["cache-control"] == "no-store"
    assert db.commits == 0
    assert db.rollbacks == 1
    assert "private-document" not in response.text

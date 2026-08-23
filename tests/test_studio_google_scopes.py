from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


def test_picker_and_maintenance_scope_boundaries_are_disjoint():
    from studio_api.google_scopes import (
        has_maintenance_server_scope_boundary,
        has_picker_browser_scope_boundary,
    )

    picker = (
        "openid email "
        "https://www.googleapis.com/auth/drive.file "
        "https://www.googleapis.com/auth/drive.readonly"
    )
    maintenance = (
        "openid email "
        "https://www.googleapis.com/auth/drive.metadata.readonly "
        "https://www.googleapis.com/auth/documents"
    )

    assert has_picker_browser_scope_boundary(picker)
    assert not has_maintenance_server_scope_boundary(picker)
    assert has_maintenance_server_scope_boundary(maintenance)
    assert not has_picker_browser_scope_boundary(maintenance)


def test_picker_scope_boundary_requires_source_read_and_rejects_broader_grants():
    from studio_api.google_scopes import has_picker_browser_scope_boundary

    drive_file_only = (
        "openid email https://www.googleapis.com/auth/drive.file"
    )
    required = (
        drive_file_only
        + " https://www.googleapis.com/auth/drive.readonly"
    )

    assert not has_picker_browser_scope_boundary(drive_file_only)
    assert has_picker_browser_scope_boundary(required)
    assert not has_picker_browser_scope_boundary(
        required + " https://www.googleapis.com/auth/drive"
    )


def test_maintenance_scope_boundary_rejects_missing_or_broader_grants():
    from studio_api.google_scopes import (
        has_maintenance_server_scope_boundary,
    )

    required = (
        "openid https://www.googleapis.com/auth/userinfo.email "
        "https://www.googleapis.com/auth/drive.metadata.readonly "
        "https://www.googleapis.com/auth/documents"
    )

    assert has_maintenance_server_scope_boundary(required)
    assert not has_maintenance_server_scope_boundary(
        required.replace(
            "https://www.googleapis.com/auth/documents",
            "https://www.googleapis.com/auth/documents.readonly",
        )
    )
    assert not has_maintenance_server_scope_boundary(
        required
        + " https://www.googleapis.com/auth/drive.readonly"
    )
    assert not has_maintenance_server_scope_boundary(
        required.replace("openid ", "")
    )

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import sys

import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


@dataclass
class OAuthSettings:
    google_oauth_client_id: str | None = "picker-client"
    google_oauth_client_secret_file: str | None = None
    google_oauth_redirect_uri: str | None = "https://studio.test/picker"
    google_oauth_scopes: str = (
        "openid email https://www.googleapis.com/auth/drive.file "
        "https://www.googleapis.com/auth/drive.readonly"
    )
    google_maintenance_oauth_client_id: str | None = "maintenance-client"
    google_maintenance_oauth_client_secret_file: str | None = None
    google_maintenance_oauth_redirect_uri: str | None = (
        "https://studio.test/maintenance"
    )
    google_maintenance_oauth_scopes: str = (
        "openid email "
        "https://www.googleapis.com/auth/drive.metadata.readonly "
        "https://www.googleapis.com/auth/documents"
    )


def test_maintenance_oauth_loads_only_separate_server_config(tmp_path):
    from studio_api.google_oauth import load_google_maintenance_oauth_config

    picker_secret = tmp_path / "picker"
    maintenance_secret = tmp_path / "maintenance"
    picker_secret.write_text("picker-secret", encoding="utf-8")
    maintenance_secret.write_text("maintenance-secret", encoding="utf-8")
    settings = OAuthSettings(
        google_oauth_client_secret_file=str(picker_secret),
        google_maintenance_oauth_client_secret_file=str(maintenance_secret),
    )

    config = load_google_maintenance_oauth_config(settings)

    assert config.client_id == "maintenance-client"
    assert config.client_secret == "maintenance-secret"
    assert config.redirect_uri == "https://studio.test/maintenance"
    assert "drive.file" not in config.scopes


@pytest.mark.parametrize(
    "scopes",
    [
        "openid email https://www.googleapis.com/auth/documents",
        (
            "openid email "
            "https://www.googleapis.com/auth/drive.metadata.readonly"
        ),
        (
            "openid email "
            "https://www.googleapis.com/auth/drive.metadata.readonly "
            "https://www.googleapis.com/auth/documents "
            "https://www.googleapis.com/auth/drive"
        ),
    ],
)
def test_maintenance_oauth_rejects_incomplete_or_broader_scopes(
    tmp_path,
    scopes,
):
    from studio_api.google_oauth import (
        GoogleOAuthConfigError,
        load_google_maintenance_oauth_config,
    )

    secret = tmp_path / "maintenance"
    secret.write_text("maintenance-secret", encoding="utf-8")
    settings = OAuthSettings(
        google_maintenance_oauth_client_secret_file=str(secret),
        google_maintenance_oauth_scopes=scopes,
    )

    with pytest.raises(GoogleOAuthConfigError):
        load_google_maintenance_oauth_config(settings)


def test_picker_oauth_rejects_server_maintenance_scope(tmp_path):
    from studio_api.google_oauth import (
        GoogleOAuthConfigError,
        load_google_oauth_config,
    )

    secret = tmp_path / "picker"
    secret.write_text("picker-secret", encoding="utf-8")
    settings = OAuthSettings(
        google_oauth_client_secret_file=str(secret),
        google_oauth_scopes=(
            "openid email "
            "https://www.googleapis.com/auth/drive.file "
            "https://www.googleapis.com/auth/drive.readonly "
            "https://www.googleapis.com/auth/documents"
        ),
    )

    with pytest.raises(GoogleOAuthConfigError):
        load_google_oauth_config(settings)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("google_maintenance_oauth_client_id", " "),
        ("google_maintenance_oauth_redirect_uri", "\t"),
        ("google_maintenance_oauth_client_secret_file", None),
    ],
)
def test_maintenance_oauth_rejects_missing_runtime_config(
    tmp_path,
    field,
    value,
):
    from studio_api.google_oauth import (
        GoogleOAuthConfigError,
        load_google_maintenance_oauth_config,
    )

    secret = tmp_path / "maintenance"
    secret.write_text("maintenance-secret", encoding="utf-8")
    settings = OAuthSettings(
        google_maintenance_oauth_client_secret_file=str(secret),
    )
    setattr(settings, field, value)

    with pytest.raises(GoogleOAuthConfigError):
        load_google_maintenance_oauth_config(settings)

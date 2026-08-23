import io
import json
import sys
from pathlib import Path
from types import SimpleNamespace
from urllib.error import HTTPError, URLError

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return json.dumps(self.payload).encode()


def config():
    from studio_api.google_oauth import GoogleOAuthConfig

    return GoogleOAuthConfig(
        client_id="client",
        client_secret="secret",
        redirect_uri="https://studio.test/oauth",
        scopes=(
            "openid email https://www.googleapis.com/auth/drive.file "
            "https://www.googleapis.com/auth/drive.readonly"
        ),
    )


def test_google_token_refresh_classifies_rejected_credentials(monkeypatch):
    from studio_api import google_drive

    def rejected(*_args, **_kwargs):
        raise HTTPError(
            "https://oauth2.googleapis.com/token",
            400,
            "rejected",
            {},
            io.BytesIO(b'{"error":"invalid_grant"}'),
        )

    monkeypatch.setattr(google_drive, "urlopen", rejected)

    with pytest.raises(google_drive.GoogleAccessTokenRefreshError) as exc:
        google_drive.refresh_access_token(config(), "refresh-value")

    assert (
        exc.value.reason
        == google_drive.GoogleAccessTokenRefreshReason.authentication_rejected
    )
    assert "invalid_grant" not in str(exc.value)


@pytest.mark.parametrize(
    "failure",
    [
        HTTPError(
            "https://oauth2.googleapis.com/token",
            503,
            "unavailable",
            {},
            None,
        ),
        URLError("offline"),
    ],
)
def test_google_token_refresh_classifies_transient_failures(monkeypatch, failure):
    from studio_api import google_drive

    monkeypatch.setattr(
        google_drive,
        "urlopen",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(failure),
    )

    with pytest.raises(google_drive.GoogleAccessTokenRefreshError) as exc:
        google_drive.refresh_access_token(config(), "refresh-value")

    assert exc.value.reason == google_drive.GoogleAccessTokenRefreshReason.unavailable


def test_google_token_refresh_rejects_malformed_success(monkeypatch):
    from studio_api import google_drive

    monkeypatch.setattr(
        google_drive,
        "urlopen",
        lambda *_args, **_kwargs: FakeResponse({"expires_in": 3600}),
    )

    with pytest.raises(google_drive.GoogleAccessTokenRefreshError) as exc:
        google_drive.refresh_access_token(config(), "refresh-value")

    assert (
        exc.value.reason
        == google_drive.GoogleAccessTokenRefreshReason.malformed_response
    )


class FakeQuery:
    def __init__(self, connection):
        self.connection = connection

    def filter_by(self, **_kwargs):
        return self

    def first(self):
        return self.connection


class FakeDb:
    def __init__(self, connection):
        self.connection = connection

    def query(self, *_args):
        return FakeQuery(self.connection)


@pytest.mark.parametrize(
    ("refresh_reason", "expected_reason"),
    [
        ("authentication_rejected", "google_reauthorization_required"),
        ("unavailable", "google_token_unavailable"),
        ("malformed_response", "google_token_unavailable"),
    ],
)
def test_connection_access_maps_safe_refresh_reason(
    monkeypatch, refresh_reason, expected_reason
):
    monkeypatch.setenv("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")
    from studio_api import google_connection_access as access
    from studio_api.google_drive import (
        GoogleAccessTokenRefreshError,
        GoogleAccessTokenRefreshReason,
    )
    from studio_api.models import GoogleConnectionStatus

    connection = SimpleNamespace(
        id="connection",
        status=GoogleConnectionStatus.active,
        refresh_token_ciphertext=b"ciphertext",
        refresh_token_nonce=b"nonce",
        key_id="key",
    )
    monkeypatch.setattr(access, "load_google_oauth_config", lambda _settings: config())
    monkeypatch.setattr(access, "master_key_from_b64", lambda _value: b"key")
    monkeypatch.setattr(access, "decrypt", lambda *_args: "refresh-value")
    monkeypatch.setattr(
        access,
        "refresh_access_token",
        lambda *_args: (_ for _ in ()).throw(
            GoogleAccessTokenRefreshError(
                GoogleAccessTokenRefreshReason(refresh_reason)
            )
        ),
    )

    with pytest.raises(access.GoogleConnectionAccessError) as exc:
        access.refresh_user_google_drive_access_token(
            FakeDb(connection),
            user_id="user",
            settings=SimpleNamespace(master_key_b64=lambda: "master"),
        )

    assert exc.value.reason.value == expected_reason


def maintenance_connection(**overrides):
    from studio_api.models import GoogleConnectionStatus

    values = {
        "id": "connection",
        "status": GoogleConnectionStatus.active,
        "google_subject": "same-google-subject",
        "maintenance_google_subject": "same-google-subject",
        "maintenance_scopes": (
            "openid email "
            "https://www.googleapis.com/auth/drive.metadata.readonly "
            "https://www.googleapis.com/auth/documents"
        ),
        "maintenance_refresh_token_ciphertext": b"maintenance-ciphertext",
        "maintenance_refresh_token_nonce": b"maintenance-nonce",
        "maintenance_key_id": "maintenance-key",
        "maintenance_revoked_at": None,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_maintenance_access_uses_separate_grant_and_aad(monkeypatch):
    monkeypatch.setenv("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")
    from studio_api import google_connection_access as access

    connection = maintenance_connection(
        refresh_token_ciphertext=b"picker-ciphertext",
        refresh_token_nonce=b"picker-nonce",
        key_id="picker-key",
    )
    calls = {}

    monkeypatch.setattr(
        access,
        "load_google_maintenance_oauth_config",
        lambda _settings: config(),
    )
    monkeypatch.setattr(access, "master_key_from_b64", lambda _value: b"key")

    def fake_decrypt(ciphertext, nonce, key, additional_data):
        calls["decrypt"] = (ciphertext, nonce, key, additional_data)
        return "maintenance-refresh-value"

    def fake_refresh(_config, refresh_token):
        calls["refresh"] = refresh_token
        return "maintenance-access-value"

    monkeypatch.setattr(access, "decrypt", fake_decrypt)
    monkeypatch.setattr(access, "refresh_access_token", fake_refresh)

    result = access.refresh_user_google_maintenance_access_token(
        FakeDb(connection),
        user_id="user",
        settings=SimpleNamespace(master_key_b64=lambda: "master"),
    )

    assert result == "maintenance-access-value"
    assert calls["decrypt"] == (
        b"maintenance-ciphertext",
        b"maintenance-nonce",
        b"key",
        access.google_maintenance_token_aad("user", "connection"),
    )
    assert calls["refresh"] == "maintenance-refresh-value"


@pytest.mark.parametrize(
    ("overrides", "expected_reason"),
    [
        (
            {"maintenance_refresh_token_ciphertext": None},
            "google_maintenance_connection_missing",
        ),
        (
            {"maintenance_revoked_at": object()},
            "google_maintenance_connection_inactive",
        ),
        (
            {"maintenance_google_subject": "different-google-subject"},
            "google_maintenance_account_mismatch",
        ),
        (
            {"maintenance_scopes": "openid email"},
            "google_scope_unavailable",
        ),
    ],
)
def test_maintenance_access_fails_closed_before_refresh(
    monkeypatch,
    overrides,
    expected_reason,
):
    monkeypatch.setenv("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")
    from studio_api import google_connection_access as access

    monkeypatch.setattr(
        access,
        "refresh_access_token",
        lambda *_args: pytest.fail("refresh must not run"),
    )

    with pytest.raises(access.GoogleConnectionAccessError) as exc:
        access.refresh_user_google_maintenance_access_token(
            FakeDb(maintenance_connection(**overrides)),
            user_id="user",
            settings=SimpleNamespace(master_key_b64=lambda: "master"),
        )

    assert exc.value.reason.value == expected_reason

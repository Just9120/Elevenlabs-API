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
        scopes="openid email https://www.googleapis.com/auth/drive.file",
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

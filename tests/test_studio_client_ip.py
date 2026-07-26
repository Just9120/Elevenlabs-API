from pathlib import Path
import sys

import pytest
from pydantic import ValidationError
from starlette.requests import Request


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))

from studio_api.client_ip import get_client_ip
from studio_api.config import Settings


def request_with_peer(peer: tuple[str, int], forwarded_for: str) -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": [(b"x-forwarded-for", forwarded_for.encode())],
            "client": peer,
        }
    )


def test_client_ip_trusts_forwarding_only_from_the_exact_configured_peer() -> None:
    settings = Settings(trusted_proxy_ip="127.0.0.1")

    assert (
        get_client_ip(request_with_peer(("8.8.8.8", 12345), "1.2.3.4"), settings)
        == "8.8.8.8"
    )
    assert (
        get_client_ip(
            request_with_peer(("127.0.0.1", 12345), "1.2.3.4, 10.0.0.1"),
            settings,
        )
        == "1.2.3.4"
    )
    assert (
        get_client_ip(
            request_with_peer(("127.0.0.1", 12345), "not-an-ip"),
            settings,
        )
        == "127.0.0.1"
    )


def test_trusted_proxy_requires_one_valid_ip_and_is_wired_to_compose() -> None:
    for unsafe_value in ("0.0.0.0/0", "0.0.0.0", "::"):
        with pytest.raises(ValidationError):
            Settings(trusted_proxy_ip=unsafe_value)

    compose = (ROOT / "deploy/studio/compose.platform.yml").read_text(
        encoding="utf-8"
    )
    env_example = (ROOT / "deploy/studio/.env.example").read_text(
        encoding="utf-8"
    )
    assert (
        "STUDIO_TRUSTED_PROXY_IP: "
        "${STUDIO_TRUSTED_PROXY_IP:-127.0.0.1}" in compose
    )
    assert "STUDIO_TRUSTED_PROXY_IP=127.0.0.1" in env_example

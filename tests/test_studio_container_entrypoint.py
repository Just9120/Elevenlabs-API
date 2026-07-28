from __future__ import annotations

import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))

from studio_api import container_entrypoint as entrypoint  # noqa: E402


class CommandExecuted(RuntimeError):
    pass


def test_maintenance_oauth_secret_has_dedicated_runtime_target() -> None:
    assert entrypoint.SECRET_FILES[
        "STUDIO_GOOGLE_MAINTENANCE_OAUTH_CLIENT_SECRET_FILE"
    ] == "studio_google_maintenance_oauth_client_secret"
    assert len(set(entrypoint.SECRET_FILES.values())) == len(entrypoint.SECRET_FILES)


def stop_at_exec(events: list[object]):
    def fake_exec(command):
        events.append(("exec", list(command)))
        raise CommandExecuted

    return fake_exec


def test_required_bootstrap_precedes_privilege_drop_and_exec(monkeypatch) -> None:
    events: list[object] = []
    monkeypatch.setenv(entrypoint.BOOTSTRAP_ENV, entrypoint.BOOTSTRAP_REQUIRED)
    monkeypatch.setattr(entrypoint, "_effective_uid", lambda: 0)
    monkeypatch.setattr(
        entrypoint, "_bootstrap_runtime_secrets", lambda: events.append("bootstrap")
    )
    monkeypatch.setattr(entrypoint, "_drop_privileges", lambda: events.append("drop"))
    monkeypatch.setattr(entrypoint, "_exec", stop_at_exec(events))
    monkeypatch.setattr(entrypoint.os, "umask", lambda _mode: None)

    with pytest.raises(CommandExecuted):
        entrypoint.run(["alembic", "current"])

    assert events == ["bootstrap", "drop", ("exec", ["alembic", "current"])]


def test_required_bootstrap_refuses_non_root_start(monkeypatch) -> None:
    monkeypatch.setenv(entrypoint.BOOTSTRAP_ENV, entrypoint.BOOTSTRAP_REQUIRED)
    monkeypatch.setattr(
        entrypoint, "_effective_uid", lambda: entrypoint.RUNTIME_UID
    )

    with pytest.raises(entrypoint.BootstrapError, match="reason=bootstrap_not_root"):
        entrypoint.run(["python", "-m", "studio_api.worker"])


def test_drop_only_skips_secret_copy(monkeypatch) -> None:
    events: list[object] = []
    monkeypatch.setenv(entrypoint.BOOTSTRAP_ENV, entrypoint.BOOTSTRAP_REQUIRED)
    monkeypatch.setattr(entrypoint, "_effective_uid", lambda: 0)
    monkeypatch.setattr(
        entrypoint, "_bootstrap_runtime_secrets", lambda: events.append("bootstrap")
    )
    monkeypatch.setattr(entrypoint, "_drop_privileges", lambda: events.append("drop"))
    monkeypatch.setattr(entrypoint, "_exec", stop_at_exec(events))

    with pytest.raises(CommandExecuted):
        entrypoint.run(["--drop-only", "python", "-m", "studio_api.worker_health"])

    assert events == [
        "drop",
        ("exec", ["python", "-m", "studio_api.worker_health"]),
    ]


def test_entrypoint_rejects_unknown_mode_before_exec(monkeypatch) -> None:
    monkeypatch.setenv(entrypoint.BOOTSTRAP_ENV, "unexpected")
    monkeypatch.setattr(entrypoint, "_effective_uid", lambda: 0)

    with pytest.raises(entrypoint.BootstrapError, match="reason=bootstrap_mode_invalid"):
        entrypoint.run(["python", "-V"])

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


def test_mounted_storage_secret_validation_reads_current_mount_without_copy_or_exec(
    monkeypatch, tmp_path: Path
) -> None:
    events: list[object] = []
    mounted = tmp_path / "mounted"
    mounted.mkdir()
    key = "STUDIO_SOURCE_S3_ACCESS_KEY_ID_FILE"
    (mounted / entrypoint.SECRET_FILES[key]).write_text("a" * 32 + "\n")
    monkeypatch.setattr(entrypoint, "MOUNTED_SECRET_DIR", mounted)
    monkeypatch.setattr(entrypoint, "_effective_uid", lambda: 0)
    monkeypatch.setattr(
        entrypoint, "_bootstrap_runtime_secrets", lambda: events.append("bootstrap")
    )
    monkeypatch.setattr(entrypoint, "_drop_privileges", lambda: events.append("drop"))
    monkeypatch.setattr(entrypoint, "_exec", stop_at_exec(events))

    result = entrypoint.run(["--validate-mounted-storage-secret", key])

    assert result is None
    assert events == []


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("STUDIO_SOURCE_S3_ACCESS_KEY_ID_FILE", "short"),
        ("STUDIO_SOURCE_S3_ACCESS_KEY_ID_FILE", "a" * 129),
        ("STUDIO_SOURCE_S3_SECRET_ACCESS_KEY_FILE", "changeme"),
        ("STUDIO_SOURCE_S3_SECRET_ACCESS_KEY_FILE", "b" * 32 + "\nsecond-line"),
    ],
)
def test_mounted_storage_secret_validation_rejects_invalid_content_without_echo(
    monkeypatch, tmp_path: Path, key: str, value: str
) -> None:
    mounted = tmp_path / "mounted"
    mounted.mkdir()
    (mounted / entrypoint.SECRET_FILES[key]).write_text(value)
    monkeypatch.setattr(entrypoint, "MOUNTED_SECRET_DIR", mounted)
    monkeypatch.setattr(entrypoint, "_effective_uid", lambda: 0)

    with pytest.raises(entrypoint.BootstrapError, match=f"reason=secret_invalid key={key}") as exc_info:
        entrypoint.run(["--validate-mounted-storage-secret", key])

    assert value not in str(exc_info.value)


def test_mounted_storage_secret_validation_rejects_non_root_and_unknown_key(
    monkeypatch
) -> None:
    monkeypatch.setattr(entrypoint, "_effective_uid", lambda: entrypoint.RUNTIME_UID)
    with pytest.raises(
        entrypoint.BootstrapError, match="reason=mounted_secret_validation_not_root"
    ):
        entrypoint.run(
            [
                "--validate-mounted-storage-secret",
                "STUDIO_SOURCE_S3_ACCESS_KEY_ID_FILE",
            ]
        )

    monkeypatch.setattr(entrypoint, "_effective_uid", lambda: 0)
    with pytest.raises(
        entrypoint.BootstrapError, match="reason=mounted_secret_validation_key_invalid"
    ):
        entrypoint.run(["--validate-mounted-storage-secret", "UNREVIEWED_SECRET_FILE"])

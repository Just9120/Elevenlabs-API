from __future__ import annotations

import sys
from pathlib import Path

from pydantic import ValidationError
from sqlalchemy import create_engine

OK_MARKER = "STUDIO_WORKER_HEALTH_OK"
FAIL_PREFIX = "STUDIO_WORKER_HEALTH_FAIL"
EXPECTED_TOKENS = ("studio_api.worker", "python -m studio_api.worker")


def _fail(reason: str) -> int:
    print(f"{FAIL_PREFIX} reason={reason}", file=sys.stderr)
    return 1


def _pid1_command() -> str:
    try:
        return Path("/proc/1/cmdline").read_bytes().replace(b"\x00", b" ").decode("utf-8", "ignore").strip()
    except Exception:
        return ""


def _valid_pid1(command: str) -> bool:
    normalized = " ".join(command.split())
    return bool(normalized and any(token in normalized for token in EXPECTED_TOKENS))


def main(argv: list[str] | None = None) -> int:
    argv = list(argv or [])
    if argv not in ([], ["--mode", "readiness"], ["--mode", "liveness"]):
        return _fail("invalid_mode")
    mode = "liveness" if argv == ["--mode", "liveness"] else "readiness"
    if not _valid_pid1(_pid1_command()):
        return _fail("pid1_not_worker")
    if mode == "liveness":
        print(f"{OK_MARKER} mode=liveness")
        return 0
    try:
        from .config import Settings
        from .runtime_observability import (
            check_database_readiness,
            current_worker_runtime_instance_id,
            load_worker_runtime_status,
            settings_runtime_identity,
        )

        settings = Settings()
        identity = settings_runtime_identity(settings, expected_component="worker")
        if identity is None:
            return _fail("runtime_identity_invalid")
        runtime_instance_id = current_worker_runtime_instance_id()
        engine = create_engine(settings.sqlalchemy_url(), pool_pre_ping=True)
        heartbeat_ready = False
        with engine.connect() as db:
            check_database_readiness(db)
            worker = load_worker_runtime_status(
                db,
                stale_after_seconds=settings.runtime_worker_stale_after_seconds,
                expected_instance_id=runtime_instance_id,
            )
            heartbeat_ready = worker.get("status") == "ready" and worker.get("commit_sha") == identity.commit_sha
        engine.dispose()
        if not heartbeat_ready:
            return _fail("runtime_heartbeat_unavailable")
    except ValidationError:
        return _fail("configuration_invalid")
    except Exception:
        return _fail("dependency_unavailable")
    print(f"{OK_MARKER} mode=readiness")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

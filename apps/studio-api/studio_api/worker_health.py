from __future__ import annotations

import os
import sys
from pathlib import Path

from pydantic import ValidationError
from sqlalchemy import create_engine, text

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


def main() -> int:
    if not _valid_pid1(_pid1_command()):
        return _fail("pid1_not_worker")
    try:
        from .config import Settings

        settings = Settings()
        _ = (settings.worker_poll_interval_seconds, settings.worker_error_backoff_seconds, settings.worker_lease_ttl_seconds)
        engine = create_engine(settings.sqlalchemy_url(), pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine.dispose()
    except ValidationError:
        return _fail("configuration_invalid")
    except Exception:
        return _fail("dependency_unavailable")
    print(OK_MARKER)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

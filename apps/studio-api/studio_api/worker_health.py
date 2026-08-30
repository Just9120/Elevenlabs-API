from __future__ import annotations

import os
import sys
from pathlib import Path

from pydantic import ValidationError
from sqlalchemy import create_engine, text

OK_MARKER = "STUDIO_WORKER_HEALTH_OK"
FAIL_PREFIX = "STUDIO_WORKER_HEALTH_FAIL"
EXPECTED_TOKENS = ("studio_api.worker", "python -m studio_api.worker")
EXPECTED_UID = 10001
EXPECTED_GID = 10001
EXPECTED_DATABASE_ROLE = "studio_worker"


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


def _valid_runtime_process_identity() -> bool:
    try:
        return (
            os.geteuid() == EXPECTED_UID
            and os.getegid() == EXPECTED_GID
            and os.getgroups() == []
        )
    except (AttributeError, OSError):
        return False


def check_worker_database_role(connection) -> None:
    role = connection.execute(
        text(
            "SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, "
            "rolreplication, rolbypassrls, rolinherit, "
            "NOT EXISTS ("
            "SELECT 1 FROM pg_auth_members AS membership "
            "WHERE membership.member = (SELECT oid FROM pg_roles WHERE rolname = current_user)"
            ") "
            "FROM pg_roles WHERE rolname = current_user"
        )
    ).one()
    if tuple(role) != (
        EXPECTED_DATABASE_ROLE,
        True,
        False,
        False,
        False,
        False,
        False,
        False,
        True,
    ):
        raise RuntimeError("worker_database_role_invalid")
    privileges = connection.execute(
        text(
            "SELECT "
            "has_schema_privilege(current_user, 'public', 'USAGE'), "
            "has_schema_privilege(current_user, 'public', 'CREATE'), "
            "has_table_privilege(current_user, 'transcription_jobs', 'SELECT'), "
            "has_table_privilege(current_user, 'transcription_jobs', 'UPDATE'), "
            "has_table_privilege(current_user, 'transcription_job_outputs', 'INSERT'), "
            "has_table_privilege(current_user, 'diagnostic_events', 'DELETE'), "
            "has_table_privilege(current_user, 'sessions', 'SELECT'), "
            "has_table_privilege(current_user, 'provider_credentials', 'UPDATE')"
        )
    ).one()
    if tuple(privileges) != (True, False, True, True, True, True, False, False):
        raise RuntimeError("worker_database_privileges_invalid")


def main(argv: list[str] | None = None) -> int:
    argv = list(argv or [])
    if argv not in ([], ["--mode", "readiness"], ["--mode", "liveness"]):
        return _fail("invalid_mode")
    mode = "liveness" if argv == ["--mode", "liveness"] else "readiness"
    if not _valid_pid1(_pid1_command()):
        return _fail("pid1_not_worker")
    if not _valid_runtime_process_identity():
        return _fail("runtime_identity_invalid")
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
            check_worker_database_role(db)
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

"""Execute the operator verifier; synthetic Docker never touches a real DB."""

import os
from pathlib import Path
import shutil
import stat
import subprocess

import pytest


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/configure_studio_worker_db_role.sh"


def _executable(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


def run_verifier(tmp_path: Path, **settings: str):
    repo = tmp_path / "repo"
    runtime = repo / "deploy/studio"
    runtime.mkdir(parents=True)
    (runtime / ".env").write_text("# No secrets needed for verification\n", encoding="utf-8")
    (runtime / "compose.platform.yml").write_text("services: {}\n", encoding="utf-8")
    shutil.copy2(ROOT / "deploy/studio/worker-db-role.sql", runtime / "worker-db-role.sql")
    bindir = tmp_path / "bin"
    bindir.mkdir()
    log = tmp_path / "queries.log"
    _executable(bindir / "git", """#!/usr/bin/env bash
set -euo pipefail
[[ "$*" == 'status --porcelain --untracked-files=no' ]] || exit 91
[[ "${ROLE_TEST_GIT_ERROR:-}" != yes ]] || exit 90
printf '%s' "${ROLE_TEST_DIRTY:-}"
""")
    _executable(bindir / "docker", """#!/usr/bin/env bash
set -euo pipefail
[[ "$1" == compose ]] || exit 92
shift
[[ "$1" == --env-file && "$2" == deploy/studio/.env ]] || exit 93
shift 2
[[ "$1" == -f && "$2" == deploy/studio/compose.platform.yml ]] || exit 94
shift 2
[[ "$1 $2 $3 $4 $5 $6 $7 $8" == 'exec -T postgres psql -X --set ON_ERROR_STOP=1 -U' ]] || exit 95
[[ "$9 ${10} ${11} ${12}" == 'studio -d studio -Atqc' && "$#" == 13 ]] || exit 96
query="${13}"
[[ "$query" == SELECT* ]] || exit 97
printf '%s\n' "$query" >> "$ROLE_TEST_LOG"
case "$query" in
  *"concat_ws"*) printf 't:f:f:f:f:f:f\n' ;;
  *"FROM pg_roles WHERE"*)
    [[ "${ROLE_TEST_QUERY_ERROR:-}" != yes ]] || exit 98
    printf '%s\n' "${ROLE_TEST_ATTRIBUTES-t}" ;;
  *"pg_auth_members"*) printf '%s\n' "${ROLE_TEST_MEMBERSHIPS-t}" ;;
  *"has_schema_privilege"*) printf '%s\n' "${ROLE_TEST_SCHEMA-t}" ;;
  *"alembic_version"*) printf '%s\n' "${ROLE_TEST_REVISION-t}" ;;
  *"SELECT NOT (has_table_privilege"*) printf '%s\n' "${ROLE_TEST_PROHIBITED-t}" ;;
  *"has_table_privilege"*) printf '%s\n' "${ROLE_TEST_REQUIRED-t}" ;;
  *) exit 99 ;;
esac
""")
    env = {
        **os.environ,
        **{f"ROLE_TEST_{key.upper()}": value for key, value in settings.items()},
        "STUDIO_DEPLOY_DIR": repo.as_posix(),
        "ROLE_TEST_LOG": log.as_posix(),
    }
    proc = subprocess.run(
        ["bash", "-c", 'export PATH="$(cd "$1" && pwd):$PATH"; exec bash "$2" verify',
         "role-verifier-test", bindir.as_posix(), SCRIPT.as_posix()], cwd=repo, env=env,
        capture_output=True, text=True, timeout=15,
    )
    queries = log.read_text(encoding="utf-8").splitlines() if log.exists() else []
    return proc, queries


def test_worker_role_verifier_accepts_postgresql_boolean_output(tmp_path):
    proc, queries = run_verifier(tmp_path)
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert proc.stdout.strip() == "STUDIO_WORKER_DB_ROLE_OK"
    assert len(queries) == 6
    assert all(query.startswith("SELECT") for query in queries)


@pytest.mark.parametrize("result", ["f", "", "true", "t\nt", "t:f:f:f:f:f:f"])
def test_worker_role_verifier_rejects_invalid_or_ambiguous_attributes(tmp_path, result):
    proc, queries = run_verifier(tmp_path, attributes=result)
    assert proc.returncode != 0
    assert "worker role attributes invalid" in proc.stderr
    assert "STUDIO_WORKER_DB_ROLE_OK" not in proc.stdout
    assert len(queries) == 1


def test_worker_role_verifier_stops_on_query_failure(tmp_path):
    proc, queries = run_verifier(tmp_path, query_error="yes")
    assert proc.returncode != 0
    assert "STUDIO_WORKER_DB_ROLE_OK" not in proc.stdout
    assert len(queries) == 1


@pytest.mark.parametrize("gate,message,count", [
    ("memberships", "worker role memberships invalid", 2),
    ("schema", "worker schema privileges invalid", 3),
    ("revision", "worker schema revision read-only privilege invalid", 4),
    ("required", "worker required table privileges missing", 5),
    ("prohibited", "worker prohibited table privileges present", 6),
])
def test_worker_role_verifier_preserves_each_privilege_gate(tmp_path, gate, message, count):
    proc, queries = run_verifier(tmp_path, **{gate: "f"})
    assert proc.returncode != 0
    assert message in proc.stderr
    assert "STUDIO_WORKER_DB_ROLE_OK" not in proc.stdout
    assert len(queries) == count


def test_worker_role_verifier_does_not_query_a_dirty_checkout(tmp_path):
    proc, queries = run_verifier(tmp_path, dirty=" M scripts/operator.sh")
    assert proc.returncode != 0
    assert "tracked checkout is dirty" in proc.stderr
    assert not queries


def test_worker_role_verifier_stops_when_git_status_fails(tmp_path):
    proc, queries = run_verifier(tmp_path, git_error="yes")
    assert proc.returncode != 0
    assert "cannot inspect tracked checkout" in proc.stderr
    assert not queries

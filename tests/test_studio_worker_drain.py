from __future__ import annotations

import os
import re
import stat
import subprocess
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/studio_worker_drain.sh"
WORKFLOW = ROOT / ".github/workflows/studio-worker-drain.yml"
SHA = "a" * 40


def _bash_path(path: Path) -> str:
    resolved = path.resolve().as_posix()
    if os.name == "nt" and re.fullmatch(r"[A-Za-z]:/.*", resolved):
        return f"/{resolved[0].lower()}{resolved[2:]}"
    return resolved


def _write_executable(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


def _run_drain(
    tmp_path: Path,
    *,
    branch: str = "main",
    remote: str = "git@github.com:Just9120/Elevenlabs-API.git",
    commit: str = SHA,
    dirty: str = "",
    tracked: bool = True,
    ttl: str = "300",
    final_state: str = "exited",
    final_exit: str = "0",
) -> tuple[subprocess.CompletedProcess[str], list[str]]:
    repo = tmp_path / "repo"
    scripts = repo / "scripts"
    deploy = repo / "deploy" / "studio"
    scripts.mkdir(parents=True)
    deploy.mkdir(parents=True)
    (deploy / ".env").write_text(f"STUDIO_WORKER_LEASE_TTL_SECONDS={ttl}\n", encoding="utf-8")
    calls = tmp_path / "calls.log"
    state = tmp_path / "state"
    state.write_text("running", encoding="utf-8")
    _write_executable(
        scripts / "manage_studio_worker.sh",
        f'''#!/usr/bin/env bash
set -euo pipefail
printf 'manage %s\n' "$*" >> {str(calls)!r}
case "$1" in
  status)
    current="$(cat {str(state)!r})"
    if [[ "$current" == running ]]; then
      printf 'container_state=running\nexit_code=0\ndrain_state=running\nSTUDIO_WORKER_STATUS_OK\n'
    else
      printf 'container_state=%s\nexit_code=%s\ndrain_state=%s\nSTUDIO_WORKER_STATUS_OK\n' {final_state!r} {final_exit!r} "$([[ {final_state!r} == exited && {final_exit!r} == 0 ]] && echo gracefully-drained || echo abnormal-exit)"
    fi ;;
  drain)
    printf '%s\n' stopped > {str(state)!r}
    printf 'STUDIO_WORKER_DRAINED\n' ;;
  *) exit 9 ;;
esac
''',
    )
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    tracked_exit = 0 if tracked else 1
    _write_executable(
        bin_dir / "git",
        f'''#!/usr/bin/env bash
set -euo pipefail
printf 'git %s\n' "$*" >> {str(calls)!r}
case "$*" in
  'config --get remote.origin.url') printf '%s\n' {remote!r} ;;
  'rev-parse --abbrev-ref HEAD') printf '%s\n' {branch!r} ;;
  'rev-parse HEAD') printf '%s\n' {commit!r} ;;
  'status --porcelain --untracked-files=no') printf '%s\n' {dirty!r} ;;
  'ls-files --error-unmatch -- scripts/manage_studio_worker.sh') exit {tracked_exit} ;;
  *) exit 9 ;;
esac
''',
    )
    proc = subprocess.run(
        ["bash", str(SCRIPT), _bash_path(repo), "main", "Just9120/Elevenlabs-API", SHA],
        cwd=repo,
        env={**os.environ, "PATH": f"{_bash_path(bin_dir)}:{os.environ['PATH']}"},
        text=True,
        capture_output=True,
        timeout=10,
    )
    return proc, calls.read_text(encoding="utf-8").splitlines() if calls.exists() else []


@pytest.mark.skipif(os.name == "nt", reason="requires POSIX command lookup for shell fixtures")
def test_drain_wrapper_verifies_identity_then_runs_status_drain_status(tmp_path: Path) -> None:
    proc, calls = _run_drain(tmp_path)
    assert proc.returncode == 0, proc.stderr + proc.stdout
    assert "STUDIO_WORKER_DRAIN_WORKFLOW_OK" in proc.stdout
    assert [call for call in calls if call.startswith("manage ")] == ["manage status", "manage drain", "manage status"]


@pytest.mark.skipif(os.name == "nt", reason="requires POSIX command lookup for shell fixtures")
def test_drain_wrapper_blocks_identity_or_tracked_tree_drift_before_mutation(tmp_path: Path) -> None:
    scenarios = [
        {"remote": "git@github.com:Other/Repo.git"},
        {"branch": "feature"},
        {"commit": "b" * 40},
        {"dirty": " M scripts/manage_studio_worker.sh"},
        {"tracked": False},
    ]
    for index, kwargs in enumerate(scenarios):
        proc, calls = _run_drain(tmp_path / str(index), **kwargs)
        assert proc.returncode != 0
        assert not any(call == "manage drain" for call in calls)


@pytest.mark.skipif(os.name == "nt", reason="requires POSIX command lookup for shell fixtures")
def test_drain_wrapper_blocks_over_budget_or_unconfirmed_final_state(tmp_path: Path) -> None:
    over_budget, calls = _run_drain(tmp_path / "budget", ttl="19200")
    assert over_budget.returncode != 0
    assert not any(call == "manage drain" for call in calls)
    unconfirmed, calls = _run_drain(tmp_path / "unconfirmed", final_state="running", final_exit="0")
    assert unconfirmed.returncode != 0
    assert [call for call in calls if call.startswith("manage ")] == ["manage status", "manage drain", "manage status"]
    assert "did not reach" in unconfirmed.stderr


def test_workflow_is_manual_scoped_and_production_serialized() -> None:
    text = WORKFLOW.read_text(encoding="utf-8")
    data = yaml.safe_load(text)
    triggers = data[True]  # PyYAML 1.1 parses "on" as True.
    assert set(triggers) == {"workflow_dispatch"}
    assert triggers["workflow_dispatch"]["inputs"]["expected_commit"]["required"] is True
    assert data["permissions"] == {"contents": "read"}
    assert data["concurrency"] == {"group": "studio-platform-production", "cancel-in-progress": False}
    assert set(data["jobs"]) == {"worker-drain"}
    assert data["jobs"]["worker-drain"]["timeout-minutes"] == 330
    checkout = next(step for step in data["jobs"]["worker-drain"]["steps"] if step.get("name") == "Checkout trusted source")
    assert checkout["with"] == {"ref": "main", "persist-credentials": False}
    assert "scripts/studio_worker_drain.sh" in text
    assert "scripts/manage_studio_worker.sh" not in text
    assert "StrictHostKeyChecking=yes" in text and "BatchMode=yes" in text
    assert "ServerAliveInterval=30" in text and "ServerAliveCountMax=12" in text
    assert "bash -s" not in text and "git fetch" not in text and "git pull" not in text
    for forbidden in ("deploy_studio_platform_component", "alembic", "backup", " resume", " rollback", "docker start"):
        assert forbidden not in text


def test_drain_wrapper_has_one_mutation_and_no_deploy_or_stateful_commands() -> None:
    text = SCRIPT.read_text(encoding="utf-8")
    assert text.count('"$expected_dir/$MANAGE_SCRIPT" status') == 2
    assert text.count('"$expected_dir/$MANAGE_SCRIPT" drain') == 1
    for forbidden in (" pause", " resume", " rollback", "docker ", "git fetch", "git pull", "alembic", "backup", "deploy_studio_platform_component"):
        assert forbidden not in text


def test_dispatch_input_is_validated_and_used_only_as_environment_data() -> None:
    data = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
    steps = data["jobs"]["worker-drain"]["steps"]
    validate = next(step for step in steps if step.get("name") == "Validate dispatch inputs and branch")
    assert validate["env"] == {"DISPATCH_REF": "${{ github.ref }}", "EXPECTED_COMMIT": "${{ inputs.expected_commit }}"}
    for step in steps:
        run = step.get("run", "")
        assert "${{ inputs.expected_commit }}" not in run
        assert "${{ github.event.inputs" not in run
    assert '"$EXPECTED_COMMIT" =~ ^[0-9a-fA-F]{40}$' in validate["run"]
    assert '"$DISPATCH_REF" != "refs/heads/main"' in validate["run"]


def test_remote_temp_path_and_materialized_execution_are_fail_closed() -> None:
    text = WORKFLOW.read_text(encoding="utf-8")
    assert "mktemp /tmp/studio-worker-drain.XXXXXX" in text
    assert "mapfile -t mktemp_lines" in text and '${#mktemp_lines[@]}' in text
    assert r"^/tmp/studio-worker-drain\.[A-Za-z0-9]{6,32}$" in text
    assert 'rm -f -- $(shell_quote "$remote_script")' in text
    assert 'execute_command="chmod 700 -- $(shell_quote "$remote_script")' in text
    assert 'scp "${ssh_options[@]}"' in text

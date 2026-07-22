from __future__ import annotations

import os
import re
import stat
import subprocess
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/studio_worker_status.sh"
WORKFLOW = ROOT / ".github/workflows/studio-worker-status.yml"
SHA = "a" * 40


def _bash_path(path: Path) -> str:
    resolved = path.resolve().as_posix()
    if os.name == "nt" and re.fullmatch(r"[A-Za-z]:/.*", resolved):
        return f"/{resolved[0].lower()}{resolved[2:]}"
    return resolved


def _write_executable(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


def _run_status(
    tmp_path: Path,
    *,
    branch: str = "main",
    remote: str = "git@github.com:Just9120/Elevenlabs-API.git",
    commit: str = SHA,
    dirty: str = "",
    tracked: bool = True,
) -> tuple[subprocess.CompletedProcess[str], list[str]]:
    repo = tmp_path / "repo"
    scripts = repo / "scripts"
    scripts.mkdir(parents=True)
    calls = tmp_path / "calls.log"
    _write_executable(
        scripts / "manage_studio_worker.sh",
        f"#!/usr/bin/env bash\nprintf 'manage %s\\n' \"$*\" >> {str(calls)!r}\nprintf 'container_state=running\\nidentity_match=unknown\\nSTUDIO_WORKER_STATUS_OK\\n'\n",
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
def test_status_wrapper_verifies_identity_then_runs_only_status(tmp_path: Path) -> None:
    proc, calls = _run_status(tmp_path)
    assert proc.returncode == 0, proc.stderr + proc.stdout
    assert "STUDIO_WORKER_STATUS_OK" in proc.stdout
    assert calls[-1] == "manage status"
    assert not any("manage drain" in call or "manage pause" in call or "manage resume" in call or "manage rollback" in call for call in calls)


@pytest.mark.skipif(os.name == "nt", reason="requires POSIX command lookup for shell fixtures")
def test_status_wrapper_blocks_identity_or_tracked_tree_drift_before_status(tmp_path: Path) -> None:
    scenarios = [
        {"remote": "git@github.com:Other/Repo.git"},
        {"branch": "feature"},
        {"commit": "b" * 40},
        {"dirty": " M scripts/manage_studio_worker.sh"},
        {"tracked": False},
    ]
    for index, kwargs in enumerate(scenarios):
        proc, calls = _run_status(tmp_path / str(index), **kwargs)
        assert proc.returncode != 0
        assert not any(call.startswith("manage ") for call in calls)


def test_workflow_is_manual_read_only_and_production_serialized() -> None:
    text = WORKFLOW.read_text(encoding="utf-8")
    data = yaml.safe_load(text)
    triggers = data[True]  # PyYAML 1.1 parses "on" as True.
    assert set(triggers) == {"workflow_dispatch"}
    assert triggers["workflow_dispatch"]["inputs"]["expected_commit"]["required"] is True
    assert data["permissions"] == {"contents": "read"}
    assert data["concurrency"] == {"group": "studio-platform-production", "cancel-in-progress": False}
    assert set(data["jobs"]) == {"worker-status"}
    assert data["jobs"]["worker-status"]["timeout-minutes"] == 10
    checkout = next(step for step in data["jobs"]["worker-status"]["steps"] if step.get("name") == "Checkout trusted source")
    assert checkout["with"] == {"ref": "main", "persist-credentials": False}
    assert "scripts/studio_worker_status.sh" in text
    assert "scripts/manage_studio_worker.sh" not in text
    assert "StrictHostKeyChecking=yes" in text and "BatchMode=yes" in text
    assert "bash -s" not in text and "git fetch" not in text and "git pull" not in text
    for forbidden in (" drain", " pause", " resume", " rollback", "deploy_studio_platform_component", "alembic", "backup", "docker stop", "docker start"):
        assert forbidden not in text


def test_status_wrapper_contains_no_runtime_mutation_commands() -> None:
    text = SCRIPT.read_text(encoding="utf-8")
    assert '"$expected_dir/$MANAGE_SCRIPT" status' in text
    assert text.count('"$expected_dir/$MANAGE_SCRIPT" status') == 1
    for forbidden in (" drain", " pause", " resume", " rollback", "docker ", "git fetch", "git pull", "alembic", "backup", "deploy_studio_platform_component"):
        assert forbidden not in text


def test_dispatch_input_is_validated_and_used_only_as_environment_data() -> None:
    data = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
    steps = data["jobs"]["worker-status"]["steps"]
    validate = next(step for step in steps if step.get("name") == "Validate dispatch inputs and branch")
    assert validate["env"] == {"DISPATCH_REF": "${{ github.ref }}", "EXPECTED_COMMIT": "${{ inputs.expected_commit }}"}
    for step in steps:
        run = step.get("run", "")
        assert "${{ inputs.expected_commit }}" not in run
        assert "${{ github.event.inputs" not in run
    assert '"$EXPECTED_COMMIT" =~ ^[0-9a-fA-F]{40}$' in validate["run"]
    assert '"$DISPATCH_REF" != "refs/heads/main"' in validate["run"]
    assert re.fullmatch(r"[0-9a-fA-F]{40}", "a" * 40)
    assert not re.fullmatch(r"[0-9a-fA-F]{40}", "a" * 40 + "$(touch /tmp/owned)")


def test_remote_temp_path_and_materialized_execution_are_fail_closed() -> None:
    text = WORKFLOW.read_text(encoding="utf-8")
    assert "mktemp /tmp/studio-worker-status.XXXXXX" in text
    assert "mapfile -t mktemp_lines" in text and '${#mktemp_lines[@]}' in text
    assert r"^/tmp/studio-worker-status\.[A-Za-z0-9]{6,32}$" in text
    assert 'rm -f -- $(shell_quote "$remote_script")' in text
    assert 'execute_command="chmod 700 -- $(shell_quote "$remote_script")' in text
    assert "scp -i ~/.ssh/deploy_key" in text

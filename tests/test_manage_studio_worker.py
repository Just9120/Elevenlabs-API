from __future__ import annotations

import os
import stat
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/manage_studio_worker.sh"
SHA = "a" * 40


def exe(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


def run_cmd(
    tmp_path: Path,
    cmd: str,
    *,
    state: str = "absent",
    exit_code: str = "0",
    container_ids: list[str] | None = None,
    stop_state: str = "exited",
    stop_exit: str = "0",
    image: str = "sha256:worker-old",
    rollback: str = "present",
    rollback_image: str = "sha256:rollback",
    rollback_head: str = "abc",
    stopped_head: str = "abc",
    current_revision: str = "abc",
    commit_tag: str = "present",
    commit_image: str = "sha256:worker-old",
    health: str = "healthy",
):
    tmp_path.mkdir(parents=True, exist_ok=True)
    bindir = tmp_path / "bin"; bindir.mkdir()
    log = tmp_path / "calls.log"
    state_file = tmp_path / "state"; exit_file = tmp_path / "exit"; image_file = tmp_path / "image"
    ids = container_ids if container_ids is not None else ([] if state == "absent" else ["cid"])
    ids_text = " ".join(ids)
    state_file.write_text(state); exit_file.write_text(exit_code); image_file.write_text(image)
    exe(bindir / "git", f"""#!/usr/bin/env bash
set -euo pipefail
echo git $* >> {str(log)!r}
case "$*" in "rev-parse HEAD") echo {SHA!r} ;; *) exit 0 ;; esac
""")
    exe(bindir / "sleep", f"#!/usr/bin/env bash\necho sleep $* >> {str(log)!r}\n")
    exe(bindir / "docker", f"""#!/usr/bin/env bash
set -euo pipefail
echo docker $* >> {str(log)!r}
state="$(cat {str(state_file)!r})"; code="$(cat {str(exit_file)!r})"; image="$(cat {str(image_file)!r})"
ids={ids_text!r}
if [[ "$1" == compose ]]; then
  shift; while [[ "$1" == --env-file || "$1" == -f ]]; do shift 2; done
  case "$1" in
    ps)
      all=false; for arg in "$@"; do [[ "$arg" == "-a" ]] && all=true; done
      if [[ -z "$ids" || "$state" == absent ]]; then exit 0; fi
      if [[ "$all" == true || "$state" == running || "$state" == restarting ]]; then for id in $ids; do echo "$id"; done; fi ;;
    run)
      last="${{@: -1}}"; [[ "$last" == current ]] && printf '%s\n' {current_revision!r} || printf '%s\n' abc ;;
    up)
      echo up; printf running > {str(state_file)!r}; printf {rollback_image!r} > {str(image_file)!r} ;;
    *) exit 7 ;;
  esac
elif [[ "$1" == inspect ]]; then
  fmt="$3"
  if [[ "$fmt" == *State.Status* ]]; then echo "$state"; elif [[ "$fmt" == *State.ExitCode* ]]; then echo "$code"; elif [[ "$fmt" == *State.Health* ]]; then echo {health!r}; else echo "$image"; fi
elif [[ "$1 $2" == "image inspect" ]]; then
  target="${{@: -1}}"
  if [[ "$target" == elevenlabs-studio-worker:rollback-candidate ]]; then [[ {rollback!r} == present ]] || exit 1; [[ "$*" == *--format* ]] && echo {rollback_image!r}; exit 0; fi
  if [[ "$target" == elevenlabs-studio-worker:{SHA} ]]; then [[ {commit_tag!r} == present ]] || exit 1; [[ "$*" == *--format* ]] && echo {commit_image!r}; exit 0; fi
  exit 1
elif [[ "$1" == run ]]; then
  if [[ "$*" == *elevenlabs-studio-worker:rollback-candidate* ]]; then printf '%s\n' {rollback_head!r}; else printf '%s\n' {stopped_head!r}; fi
elif [[ "$1" == stop ]]; then
  printf {stop_state!r} > {str(state_file)!r}; printf {stop_exit!r} > {str(exit_file)!r}
elif [[ "$1" == start ]]; then
  printf running > {str(state_file)!r}
elif [[ "$1" == tag ]]; then
  [[ "$3" != elevenlabs-studio-api:local ]] || exit 10
else exit 8; fi
""")
    env_file = ROOT / "deploy/studio/.env"; created = not env_file.exists()
    if created: env_file.write_text("STUDIO_WORKER_LEASE_TTL_SECONDS=300\n", encoding="utf-8")
    env = {**os.environ, "PATH": f"{bindir}:{os.environ['PATH']}", "STUDIO_DEPLOY_DIR": str(ROOT), "STUDIO_WORKER_LEASE_TTL_SECONDS": "300"}
    try:
        proc = subprocess.run(["bash", str(SCRIPT), cmd], cwd=ROOT, env=env, text=True, capture_output=True, timeout=10)
    finally:
        if created: env_file.unlink()
    return proc, log.read_text(encoding="utf-8").splitlines() if log.exists() else []


def assert_no_forbidden(calls: list[str]) -> None:
    joined = "\n".join(calls)
    assert " compose down" not in joined and " pause" not in joined and "prune" not in joined
    assert "elevenlabs-studio-api:local" not in joined


def assert_no_runtime_mutation(calls: list[str]) -> None:
    assert not any("docker stop" in c or "docker start" in c or "docker tag" in c or " compose.platform.yml up" in c for c in calls)


def test_multiple_worker_containers_block_all_lifecycle_commands(tmp_path: Path) -> None:
    for state in ("running", "exited"):
        for cmd in ("status", "drain", "pause", "resume", "rollback"):
            proc, calls = run_cmd(tmp_path / state / cmd, cmd, state=state, container_ids=["cid1", "cid2"])
            assert proc.returncode != 0, cmd
            assert "multiple_worker_containers" in proc.stderr
            assert "STUDIO_WORKER_DRAINED" not in proc.stdout and "STUDIO_WORKER_PAUSED" not in proc.stdout
            assert_no_runtime_mutation(calls)
            assert_no_forbidden(calls)


def test_drain_absent_and_already_stopped_classification(tmp_path: Path) -> None:
    proc, calls = run_cmd(tmp_path / "absent", "drain", state="absent")
    assert proc.returncode == 0 and "STUDIO_WORKER_DRAINED" in proc.stdout
    assert_no_forbidden(calls)
    cases = [("0", 0, "STUDIO_WORKER_DRAINED"), ("137", 1, "forced_kill"), ("143", 1, "signal_terminated"), ("1", 1, "abnormal_exit")]
    for code, rc_nonzero, marker in cases:
        proc, calls = run_cmd(tmp_path / f"exited{code}", "drain", state="exited", exit_code=code)
        assert (proc.returncode != 0) == bool(rc_nonzero)
        assert marker in (proc.stdout + proc.stderr)
        assert not any("docker stop" in c for c in calls)
        if code != "0": assert "lease_output_reconciliation_review_required" in proc.stderr
    for st, reason in [("created", "created_not_validated"), ("dead", "state_dead"), ("unknown", "state_unknown")]:
        proc, calls = run_cmd(tmp_path / st, "drain", state=st)
        assert proc.returncode != 0 and reason in proc.stderr and "lease_output_reconciliation_review_required" in proc.stderr
        assert not any("docker stop" in c for c in calls)


def test_running_drain_exit_semantics(tmp_path: Path) -> None:
    for code, reason in [("0", "STUDIO_WORKER_DRAINED"), ("137", "forced_kill"), ("143", "signal_terminated"), ("1", "abnormal_exit")]:
        proc, calls = run_cmd(tmp_path / code, "drain", state="running", stop_exit=code)
        if code == "0":
            assert proc.returncode == 0 and reason in proc.stdout
            assert any("docker stop --time 360 cid" in c for c in calls)
        else:
            assert proc.returncode != 0 and reason in proc.stderr and "lease_output_reconciliation_review_required" in proc.stderr
        assert_no_forbidden(calls)
    proc, _ = run_cmd(tmp_path / "still", "drain", state="running", stop_state="running", stop_exit="0")
    assert proc.returncode != 0 and "still_running" in proc.stderr


def test_pause_only_succeeds_after_successful_drain(tmp_path: Path) -> None:
    for st, code in [("absent", "0"), ("exited", "0")]:
        proc, _ = run_cmd(tmp_path / st, "pause", state=st, exit_code=code)
        assert proc.returncode == 0 and "STUDIO_WORKER_DRAINED" in proc.stdout and "STUDIO_WORKER_PAUSED" in proc.stdout
    for code in ("137", "143", "1"):
        proc, _ = run_cmd(tmp_path / f"bad{code}", "pause", state="exited", exit_code=code)
        assert proc.returncode != 0 and "STUDIO_WORKER_PAUSED" not in proc.stdout
    proc, _ = run_cmd(tmp_path / "multi", "pause", state="exited", container_ids=["a", "b"])
    assert proc.returncode != 0 and "STUDIO_WORKER_PAUSED" not in proc.stdout


def test_status_reports_drain_state_and_identity(tmp_path: Path) -> None:
    cases = [("absent", "0", "drain_state=absent"), ("running", "0", "drain_state=running"), ("exited", "0", "drain_state=gracefully-drained"), ("exited", "137", "drain_state=abnormal-exit")]
    for i, (st, code, expected) in enumerate(cases):
        proc, calls = run_cmd(tmp_path / f"s{i}", "status", state=st, exit_code=code)
        assert proc.returncode == 0 and "STUDIO_WORKER_STATUS_OK" in proc.stdout and expected in proc.stdout
        assert_no_forbidden(calls)
    proc, _ = run_cmd(tmp_path / "mismatch", "status", state="exited", exit_code="0", commit_image="sha256:new")
    assert "identity_match=no" in proc.stdout


def test_resume_schema_gate_uses_exact_stopped_image_before_start(tmp_path: Path) -> None:
    proc, calls = run_cmd(tmp_path / "ok", "resume", state="exited", exit_code="0", stopped_head="abc", current_revision="abc")
    assert proc.returncode == 0, proc.stderr + proc.stdout
    assert "STUDIO_WORKER_RESUMED" in proc.stdout
    assert any("docker run --rm --entrypoint alembic sha256:worker-old heads" in c for c in calls)
    assert not any("elevenlabs-studio-worker:local heads" in c for c in calls)
    assert any("docker start cid" in c for c in calls)
    assert_no_forbidden(calls)
    for name, stopped, current in [("mismatch", "new", "old"), ("missinghead", "", "abc"), ("multihead", "abc\ndef", "abc"), ("missingcurrent", "abc", ""), ("multicurrent", "abc", "abc\ndef")]:
        proc, calls = run_cmd(tmp_path / name, "resume", state="exited", exit_code="0", stopped_head=stopped, current_revision=current)
        assert proc.returncode != 0 and "schema_mismatch" in proc.stderr
        assert not any("docker start" in c for c in calls)
        assert_no_forbidden(calls)


def test_resume_existing_state_regressions(tmp_path: Path) -> None:
    for code in ("137", "143", "1"):
        proc, calls = run_cmd(tmp_path / f"bad{code}", "resume", state="exited", exit_code=code)
        assert proc.returncode != 0 and "operator review required" in proc.stderr and not any("docker start" in c for c in calls)
    for st in ("absent", "running", "created", "dead"):
        proc, calls = run_cmd(tmp_path / st, "resume", state=st, exit_code="0")
        assert proc.returncode != 0 and not any("docker start" in c for c in calls)
    proc, calls = run_cmd(tmp_path / "health", "resume", state="exited", exit_code="0", health="unhealthy")
    assert proc.returncode != 0 and "worker health is unhealthy" in proc.stderr


def test_rollback_schema_order_and_api_tag_isolation(tmp_path: Path) -> None:
    proc, calls = run_cmd(tmp_path / "missing", "rollback", state="exited", exit_code="0", rollback="absent")
    assert proc.returncode != 0 and "rollback candidate missing" in proc.stderr
    proc, calls = run_cmd(tmp_path / "abnormal", "rollback", state="exited", exit_code="137")
    assert proc.returncode != 0 and "operator review required" in proc.stderr
    assert_no_runtime_mutation(calls)
    proc, calls = run_cmd(tmp_path / "mismatch", "rollback", state="exited", exit_code="0", rollback_head="new", current_revision="old")
    assert proc.returncode != 0 and "schema mismatch" in proc.stderr
    assert any("docker run --rm --entrypoint alembic elevenlabs-studio-worker:rollback-candidate heads" in c for c in calls)
    assert not any("docker tag" in c or " compose.platform.yml up" in c for c in calls)
    proc, calls = run_cmd(tmp_path / "ok", "rollback", state="exited", exit_code="0")
    assert proc.returncode == 0 and "STUDIO_WORKER_ROLLBACK_OK" in proc.stdout
    assert any("docker tag elevenlabs-studio-worker:rollback-candidate elevenlabs-studio-worker:local" in c for c in calls)
    assert_no_forbidden(calls)

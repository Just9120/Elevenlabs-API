from __future__ import annotations

import os
import stat
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "migrate_studio_platform.sh"
SNAPSHOT_ID = "a" * 64
IMAGE_ID = "sha256:" + ("b" * 64)


def _write_exe(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


def run_migration(
    tmp_path: Path,
    *,
    snapshot: str = SNAPSHOT_ID,
    current: str = "old_revision",
    head: str = "new_revision",
    expected_from: str = "old_revision",
    expected_to: str = "new_revision",
    expected_repository_head: str = "new_revision",
    image_id: str = IMAGE_ID,
    expected_image_id: str = IMAGE_ID,
    upgrade_exit: str = "0",
    persist_upgrade: bool = True,
) -> tuple[subprocess.CompletedProcess[str], list[str]]:
    tmp_path.mkdir(parents=True, exist_ok=True)
    calls = tmp_path / "calls.log"
    state = tmp_path / "current-revision"
    state.write_text(current, encoding="utf-8")
    deploy_dir = tmp_path / "deploy"
    runtime_dir = deploy_dir / "deploy" / "studio"
    runtime_dir.mkdir(parents=True)
    (runtime_dir / ".env").write_text("# fake runtime\n", encoding="utf-8")
    (runtime_dir / "compose.platform.yml").write_text("services: {}\n", encoding="utf-8")
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()

    _write_exe(
        bin_dir / "docker",
        f"""#!/usr/bin/env bash
set -euo pipefail
printf 'docker %s\\n' "$*" >> {str(calls)!r}
if [[ "$1 $2" == "image inspect" ]]; then
  printf '%s\\n' {image_id!r}
  exit 0
fi
[[ "$1" == "compose" ]] || exit 41
shift
while [[ "$1" == "--env-file" || "$1" == "-f" ]]; do shift 2; done
[[ "$1" == "run" ]] || exit 42
last="${{@: -1}}"
case "$last" in
  current)
    cat {str(state)!r}
    ;;
  heads)
    printf '%s\\n' {head!r}
    ;;
  {expected_to})
    [[ "$*" == *" upgrade "* ]] || exit 43
    if [[ {upgrade_exit!r} != "0" ]]; then
      exit {upgrade_exit}
    fi
    if [[ {str(persist_upgrade).lower()!r} == "true" ]]; then
      printf '%s' {expected_to!r} > {str(state)!r}
    fi
    ;;
  *)
    exit 43
    ;;
esac
""",
    )

    env = {
        **os.environ,
        "PATH": f"{bin_dir}:{os.environ['PATH']}",
        "STUDIO_DEPLOY_DIR": str(deploy_dir),
        "STUDIO_PRE_MIGRATION_BACKUP_CONFIRMED": "yes",
        "STUDIO_PRE_MIGRATION_BACKUP_SNAPSHOT": snapshot,
        "STUDIO_EXPECTED_MIGRATION_FROM": expected_from,
        "STUDIO_EXPECTED_MIGRATION_TO": expected_to,
        "STUDIO_EXPECTED_REPOSITORY_HEAD": expected_repository_head,
        "STUDIO_EXPECTED_API_IMAGE_ID": expected_image_id,
    }
    proc = subprocess.run(
        ["bash", str(SCRIPT)],
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
        timeout=10,
    )
    logged = calls.read_text(encoding="utf-8").splitlines() if calls.exists() else []
    return proc, logged


def _upgrade_calls(calls: list[str]) -> list[str]:
    return [line for line in calls if " upgrade " in line]


def test_migration_requires_verified_snapshot_before_docker_use(tmp_path: Path) -> None:
    proc, calls = run_migration(tmp_path, snapshot="not-a-snapshot")

    assert proc.returncode == 2
    assert "reason=backup_snapshot_invalid" in proc.stderr
    assert calls == []


def test_migration_checks_exact_candidate_and_revisions_then_runs_once(
    tmp_path: Path,
) -> None:
    proc, calls = run_migration(tmp_path)

    assert proc.returncode == 0, proc.stderr + proc.stdout
    assert proc.stdout.count("[studio-platform-migration] OK") == 1
    assert f"snapshot={SNAPSHOT_ID[:12]}" in proc.stdout
    assert len(_upgrade_calls(calls)) == 1
    assert calls[0].startswith("docker image inspect")
    assert next(i for i, line in enumerate(calls) if line.endswith(" current")) < next(
        i for i, line in enumerate(calls) if line.endswith(" heads")
    )
    assert next(i for i, line in enumerate(calls) if line.endswith(" heads")) < next(
        i for i, line in enumerate(calls) if " upgrade new_revision" in line
    )
    assert next(
        i for i, line in enumerate(calls) if " upgrade new_revision" in line
    ) < max(
        i for i, line in enumerate(calls) if line.endswith(" current")
    )


def test_migration_can_apply_one_explicit_target_before_repository_head(
    tmp_path: Path,
) -> None:
    proc, calls = run_migration(
        tmp_path,
        head="final_revision",
        expected_to="middle_revision",
        expected_repository_head="final_revision",
    )

    assert proc.returncode == 0, proc.stderr + proc.stdout
    assert len(_upgrade_calls(calls)) == 1
    assert " upgrade middle_revision" in _upgrade_calls(calls)[0]
    assert "to=middle_revision" in proc.stdout


def test_candidate_image_mismatch_blocks_before_revision_probe(tmp_path: Path) -> None:
    proc, calls = run_migration(
        tmp_path,
        image_id="sha256:" + ("c" * 64),
    )

    assert proc.returncode == 2
    assert "reason=candidate_image_mismatch" in proc.stderr
    assert len(calls) == 1
    assert _upgrade_calls(calls) == []


def test_unexpected_current_or_head_blocks_before_upgrade(tmp_path: Path) -> None:
    current_proc, current_calls = run_migration(
        tmp_path / "current",
        current="unexpected",
    )
    head_proc, head_calls = run_migration(
        tmp_path / "head",
        head="unexpected",
    )

    assert current_proc.returncode == 2
    assert "reason=current_revision_mismatch" in current_proc.stderr
    assert _upgrade_calls(current_calls) == []
    assert head_proc.returncode == 2
    assert "reason=head_revision_mismatch" in head_proc.stderr
    assert _upgrade_calls(head_calls) == []


def test_upgrade_failure_is_not_retried_or_reported_success(tmp_path: Path) -> None:
    proc, calls = run_migration(tmp_path, upgrade_exit="17")

    assert proc.returncode == 2
    assert "reason=upgrade_failed" in proc.stderr
    assert len(_upgrade_calls(calls)) == 1
    assert " OK " not in proc.stdout


def test_post_revision_mismatch_blocks_success(tmp_path: Path) -> None:
    proc, calls = run_migration(tmp_path, persist_upgrade=False)

    assert proc.returncode == 2
    assert "reason=post_revision_mismatch" in proc.stderr
    assert len(_upgrade_calls(calls)) == 1
    assert " OK " not in proc.stdout


def test_current_head_must_declare_additive_release_safety() -> None:
    migration = (
        ROOT
        / "apps"
        / "studio-api"
        / "alembic"
        / "versions"
        / "0018_job_part_progress.py"
    ).read_text(encoding="utf-8")

    assert 'release_safety = "additive"' in migration

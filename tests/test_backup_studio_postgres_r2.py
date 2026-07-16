from __future__ import annotations

import os
import stat
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "backup_studio_postgres_r2.sh"


def _write_exe(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


def run_backup(tmp_path: Path, tag: str) -> tuple[subprocess.CompletedProcess[str], list[str]]:
    calls = tmp_path / "calls.log"
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    deploy_dir = tmp_path / "deploy"
    (deploy_dir / "deploy" / "studio").mkdir(parents=True)
    (deploy_dir / "deploy" / "studio" / ".env").write_text("# fake env\n", encoding="utf-8")
    password_file = tmp_path / "restic-password"
    access_key_file = tmp_path / "access-key"
    secret_key_file = tmp_path / "secret-key"
    password_file.write_text("RESTIC_PASSWORD_SECRET\n", encoding="utf-8")
    access_key_file.write_text("AWS_ACCESS_SECRET\n", encoding="utf-8")
    secret_key_file.write_text("AWS_SECRET_SECRET\n", encoding="utf-8")

    _write_exe(
        bin_dir / "flock",
        f"""#!/usr/bin/env bash
printf 'flock %s\\n' "$*" >> {str(calls)!r}
exit 0
""",
    )
    _write_exe(
        bin_dir / "docker",
        f"""#!/usr/bin/env bash
set -euo pipefail
printf 'docker %s\\n' "$*" >> {str(calls)!r}
[[ "$1" == "compose" ]] || exit 40
shift
while [[ "$1" == "--env-file" || "$1" == "-f" ]]; do shift 2; done
cmd="$1"; shift
case "$cmd" in
  exec)
    if [[ "$*" == *"pg_dump"* ]]; then exit 0; fi
    if [[ "$*" == *"rm -f /tmp/studio-postgres.dump"* ]]; then exit 0; fi
    exit 41
    ;;
  cp)
    dest="${{@: -1}}"
    printf 'fake dump' > "$dest"
    ;;
  *) exit 42 ;;
esac
""",
    )
    _write_exe(
        bin_dir / "restic",
        f"""#!/usr/bin/env bash
set -euo pipefail
printf 'restic %s\\n' "$*" >> {str(calls)!r}
case "$*" in
  *RESTIC_PASSWORD_SECRET*|*AWS_ACCESS_SECRET*|*AWS_SECRET_SECRET*) exit 43 ;;
esac
""",
    )
    env = os.environ.copy()
    env.update(
        {
            "PATH": f"{bin_dir}:{env['PATH']}",
            "STUDIO_BACKUP_LOCK_FILE": str(tmp_path / "backup.lock"),
            "STUDIO_BACKUP_TAG": tag,
            "RESTIC_REPOSITORY": "s3:https://example.invalid/bucket",
            "RESTIC_PASSWORD_FILE": str(password_file),
            "AWS_ACCESS_KEY_ID_FILE": str(access_key_file),
            "AWS_SECRET_ACCESS_KEY_FILE": str(secret_key_file),
            "STUDIO_DEPLOY_DIR": str(deploy_dir),
        }
    )
    proc = subprocess.run(["bash", str(SCRIPT)], cwd=ROOT, env=env, text=True, capture_output=True, timeout=10)
    return proc, calls.read_text(encoding="utf-8").splitlines() if calls.exists() else []


def _restic_forget(calls: list[str]) -> str:
    matches = [line for line in calls if line.startswith("restic ") and " forget " in f" {line} "]
    assert len(matches) == 1
    return matches[0]


def test_scheduled_retention_selects_only_scheduled_snapshots() -> None:
    import tempfile

    with tempfile.TemporaryDirectory() as d:
        proc, calls = run_backup(Path(d), "scheduled")
    assert proc.returncode == 0, proc.stderr
    forget = _restic_forget(calls)
    assert "--host studio-postgres" in forget
    assert "--tag studio-postgres,scheduled" in forget
    assert "--tag studio-postgres --tag scheduled" not in forget
    assert "pre-migration" not in forget
    assert "--group-by host,tags" in forget
    assert "--keep-within 7d" in forget
    assert "--keep-daily 30" in forget
    assert "--keep-monthly 12" in forget


def test_pre_migration_retention_selects_only_pre_migration_snapshots() -> None:
    import tempfile

    with tempfile.TemporaryDirectory() as d:
        proc, calls = run_backup(Path(d), "pre-migration")
    assert proc.returncode == 0, proc.stderr
    forget = _restic_forget(calls)
    assert "--host studio-postgres" in forget
    assert "--tag studio-postgres,pre-migration" in forget
    assert "--tag studio-postgres --tag pre-migration" not in forget
    assert "scheduled" not in forget
    assert "--group-by host,tags" in forget
    assert "--keep-within 90d" in forget
    assert "--keep-daily" not in forget
    assert "--keep-monthly" not in forget


def test_unsupported_backup_tag_fails_closed_before_secret_or_restic_use(tmp_path: Path) -> None:
    proc, calls = run_backup(tmp_path, "manual")
    assert proc.returncode == 2
    assert "unsupported backup tag" in proc.stderr
    assert not any(line.startswith("restic ") for line in calls)
    combined = proc.stdout + proc.stderr + "\n".join(calls)
    assert "RESTIC_PASSWORD_SECRET" not in combined
    assert "AWS_ACCESS_SECRET" not in combined
    assert "AWS_SECRET_SECRET" not in combined


def test_backup_output_does_not_print_secret_values() -> None:
    import tempfile

    with tempfile.TemporaryDirectory() as d:
        proc, calls = run_backup(Path(d), "scheduled")
    assert proc.returncode == 0, proc.stderr
    combined = proc.stdout + proc.stderr + "\n".join(calls)
    assert "RESTIC_PASSWORD_SECRET" not in combined
    assert "AWS_ACCESS_SECRET" not in combined
    assert "AWS_SECRET_SECRET" not in combined

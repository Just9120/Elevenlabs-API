from __future__ import annotations

import os
import re
import stat
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RELEASE_SCRIPT = ROOT / "scripts" / "release_studio_platform_migration.sh"
WRAPPER = ROOT / "deploy" / "studio" / "studio-migration-release-wrapper.sh"
CD_WORKFLOW = ROOT / ".github" / "workflows" / "studio-platform-cd.yml"
STUDIO_CI_WORKFLOW = ROOT / ".github" / "workflows" / "studio-ci.yml"
COMMIT = "a" * 40
OLD_REVISION = "0017_google_maintenance_oauth"
NEW_REVISION = "0018_job_part_progress"
IMAGE_ID = "sha256:" + ("b" * 64)
POSTGRES_IMAGE_ID = "sha256:" + ("e" * 64)
OLD_SNAPSHOT = "c" * 64
NEW_SNAPSHOT = "d" * 64


def _write_exe(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


def _bash_path(path: Path) -> str:
    resolved = path.resolve().as_posix()
    drive, separator, suffix = resolved.partition(":")
    if separator:
        return f"/{drive.lower()}{suffix}"
    return resolved


def run_release(
    tmp_path: Path,
    *,
    release_safety: str = "additive",
    pg_restore_ok: bool = True,
) -> tuple[subprocess.CompletedProcess[str], list[str]]:
    checkout = tmp_path / "checkout"
    fake_bin = tmp_path / "bin"
    secrets = tmp_path / "secrets"
    checkout.mkdir()
    fake_bin.mkdir()
    secrets.mkdir()
    (checkout / ".git").mkdir()
    (checkout / "deploy" / "studio").mkdir(parents=True)
    (checkout / "apps" / "studio-api").mkdir(parents=True)
    (checkout / "scripts").mkdir()

    calls = tmp_path / "calls.log"
    revision_state = tmp_path / "revision"
    deployed = tmp_path / "deployed"
    backup_complete = tmp_path / "backup-complete"
    revision_state.write_text(OLD_REVISION, encoding="utf-8")

    primary_secret = secrets / "primary-oauth"
    maintenance_secret = secrets / "maintenance-oauth"
    restic_password = secrets / "restic-password"
    r2_access = secrets / "r2-access"
    r2_secret = secrets / "r2-secret"
    for path in (
        primary_secret,
        maintenance_secret,
        restic_password,
        r2_access,
        r2_secret,
    ):
        path.write_text("protected-test-value\n", encoding="utf-8")

    env_file = checkout / "deploy" / "studio" / ".env"
    env_file.write_text(
        "\n".join(
            (
                "APP_PUBLIC_URL=https://studio.example.test",
                "STUDIO_GOOGLE_OAUTH_CLIENT_ID=primary-client",
                f"STUDIO_GOOGLE_OAUTH_CLIENT_SECRET_FILE={primary_secret.as_posix()}",
                "STUDIO_GOOGLE_MAINTENANCE_OAUTH_CLIENT_ID=maintenance-client",
                f"STUDIO_GOOGLE_MAINTENANCE_OAUTH_CLIENT_SECRET_FILE={maintenance_secret.as_posix()}",
                "STUDIO_GOOGLE_MAINTENANCE_OAUTH_REDIRECT_URI=https://studio.example.test/api/google/callback",
                "STUDIO_GOOGLE_MAINTENANCE_OAUTH_SCOPES=openid email https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/documents",
                "",
            )
        ),
        encoding="utf-8",
    )
    (checkout / "deploy" / "studio" / "compose.platform.yml").write_text(
        "services: {}\n", encoding="utf-8"
    )
    (checkout / "apps" / "studio-api" / "Dockerfile").write_text(
        "FROM scratch\n", encoding="utf-8"
    )
    (checkout / "apps" / "studio-api" / "alembic.ini").write_text(
        "[alembic]\n", encoding="utf-8"
    )

    backup_env = tmp_path / "backup.env"
    backup_env.write_text(
        "\n".join(
            (
                "RESTIC_REPOSITORY=s3:https://example.invalid/studio",
                f"RESTIC_PASSWORD_FILE={restic_password.as_posix()}",
                f"AWS_ACCESS_KEY_ID_FILE={r2_access.as_posix()}",
                f"AWS_SECRET_ACCESS_KEY_FILE={r2_secret.as_posix()}",
                f"STUDIO_DEPLOY_DIR={_bash_path(checkout)}",
                "",
            )
        ),
        encoding="utf-8",
    )

    _write_exe(
        checkout / "scripts" / "backup_studio_postgres_r2.sh",
        f"""#!/usr/bin/env bash
set -euo pipefail
printf 'backup\\n' >> {str(calls)!r}
touch {str(backup_complete)!r}
""",
    )
    _write_exe(
        checkout / "scripts" / "migrate_studio_platform.sh",
        f"""#!/usr/bin/env bash
set -euo pipefail
printf 'migrate snapshot=%s from=%s to=%s image=%s\\n' \
  "${{STUDIO_PRE_MIGRATION_BACKUP_SNAPSHOT}}" \
  "${{STUDIO_EXPECTED_MIGRATION_FROM}}" \
  "${{STUDIO_EXPECTED_MIGRATION_TO}}" \
  "${{STUDIO_EXPECTED_API_IMAGE_ID}}" >> {str(calls)!r}
[[ -f {str(backup_complete)!r} ]]
printf '%s' {NEW_REVISION!r} > {str(revision_state)!r}
""",
    )
    _write_exe(
        fake_bin / "id",
        f"""#!/usr/bin/env bash
printf 'id %s\\n' "$*" >> {str(calls)!r}
[[ "${{1:-}}" == "-u" ]] && {{ echo 0; exit 0; }}
exit 0
""",
    )
    _write_exe(
        fake_bin / "stat",
        """#!/usr/bin/env bash
case "$*" in
  *"%u"*) echo 0 ;;
  *"%a"*) echo 600 ;;
  *) exit 41 ;;
esac
""",
    )
    _write_exe(
        fake_bin / "git",
        f"""#!/usr/bin/env bash
printf 'git %s\\n' "$*" >> {str(calls)!r}
while [[ "$1" == "-c" || "$1" == "-C" ]]; do shift 2; done
case "$*" in
  "rev-parse --abbrev-ref HEAD") echo main ;;
  "rev-parse HEAD") echo {COMMIT!r} ;;
  "status --porcelain --untracked-files=no") ;;
  "status --porcelain --untracked-files=all -- apps/studio-api") ;;
  *) exit 42 ;;
esac
""",
    )
    _write_exe(
        fake_bin / "runuser",
        """#!/usr/bin/env bash
[[ "$1" == "-u" && "$3" == "--" ]] || exit 51
shift 3
exec "$@"
""",
    )
    _write_exe(
        fake_bin / "python3",
        f"""#!/usr/bin/env bash
if [[ "${{2:-}}" == *"snapshots-before" && "${{3:-}}" == *"snapshots-after" ]]; then
  echo {NEW_SNAPSHOT!r}
  exit 0
fi
case "$*" in
  *".env")
    printf '%s\\t%s\\t%s\\n' \
      'https://studio.example.test' \
      {primary_secret.as_posix()!r} \
      {maintenance_secret.as_posix()!r}
    ;;
  *"snapshots-before.json") echo {OLD_SNAPSHOT!r} ;;
  *"snapshots-after.json")
    echo {OLD_SNAPSHOT!r}
    echo {NEW_SNAPSHOT!r}
    ;;
  *) exit 43 ;;
esac
""",
    )
    _write_exe(
        fake_bin / "docker",
        f"""#!/usr/bin/env bash
set -euo pipefail
printf 'docker %s\\n' "$*" >> {str(calls)!r}
if [[ "$1" == "compose" ]]; then
  shift
  while [[ "$1" == "--env-file" || "$1" == "-f" ]]; do shift 2; done
  command="$1"; shift
  case "$command" in
    config|build) exit 0 ;;
    ps)
      if [[ "$1" == "-a" && "$2" == "-q" && "$3" == "studio-worker" ]]; then
        exit 0
      fi
      [[ "$1" == "-q" ]]
      case "$2" in
        postgres) echo postgres-container ;;
        redis) echo redis-container ;;
        studio-api)
          [[ -f {str(deployed)!r} ]] && echo api-new || echo api-old
          ;;
        *) exit 44 ;;
      esac
      ;;
    run)
      [[ "${{@: -1}}" == "current" ]] || exit 45
      cat {str(revision_state)!r}
      ;;
    up)
      [[ "$*" == "-d --no-deps --force-recreate studio-api" ]] || exit 46
      touch {str(deployed)!r}
      ;;
    *) exit 47 ;;
  esac
elif [[ "$1 $2" == "image inspect" ]]; then
  echo {IMAGE_ID!r}
elif [[ "$1" == "run" ]]; then
  if [[ "$*" == *"--entrypoint python"* ]]; then
    printf '%s\\t%s\\t%s\\n' {NEW_REVISION!r} {OLD_REVISION!r} {release_safety!r}
  elif [[ "$*" == *"--entrypoint pg_restore"* ]]; then
    [[ "$*" == *"--pull never"* ]]
    [[ "$*" == *"--network none"* ]]
    [[ "$*" == *"--read-only"* ]]
    [[ "$*" == *"--cap-drop ALL"* ]]
    [[ "$*" == *"--security-opt no-new-privileges"* ]]
    [[ "$*" == *"--pids-limit 32"* ]]
    [[ "$*" == *"--tmpfs /var/lib/postgresql/data:"* ]]
    [[ "$*" == *"dst=/tmp/studio-postgres.dump,readonly"* ]]
    [[ "$*" == *"--list /tmp/studio-postgres.dump"* ]]
    [[ {str(pg_restore_ok).lower()} == true ]]
  else
    exit 49
  fi
elif [[ "$1" == "inspect" ]]; then
  if [[ "$*" == *".State.Health"* ]]; then
    echo healthy
  elif [[ "$*" == *".Image"* ]]; then
    if [[ "${{@: -1}}" == "postgres-container" ]]; then
      echo {POSTGRES_IMAGE_ID!r}
    else
      echo {IMAGE_ID!r}
    fi
  else
    exit 48
  fi
else
  exit 50
fi
""",
    )
    _write_exe(
        fake_bin / "restic",
        f"""#!/usr/bin/env bash
set -euo pipefail
printf 'restic %s\\n' "$*" >> {str(calls)!r}
if [[ "$*" == *" snapshots "* ]]; then
  printf '[]\\n'
elif [[ "$*" == *" restore "* ]]; then
  target=""
  while [[ "$#" -gt 0 ]]; do
    if [[ "$1" == "--target" ]]; then target="$2"; break; fi
    shift
  done
  [[ -n "$target" ]]
  mkdir -p "$target/tmp/source"
  printf 'fake-postgres-dump' > "$target/tmp/source/studio-postgres.dump"
else
  exit 50
fi
""",
    )
    _write_exe(
        fake_bin / "curl",
        f"#!/usr/bin/env bash\nprintf 'curl %s\\n' \"$*\" >> {str(calls)!r}\n",
    )
    _write_exe(fake_bin / "sleep", "#!/usr/bin/env bash\nexit 0\n")

    env = {
        **os.environ,
        "PATH": f"{fake_bin}:{os.environ['PATH']}",
        "STUDIO_RELEASE_FIXED_PATH": f"{_bash_path(fake_bin)}:/usr/bin:/bin",
        "STUDIO_RELEASE_PYTHON_BIN": "python3",
        "STUDIO_BACKUP_ENV_FILE": _bash_path(backup_env),
        "STUDIO_DEPLOY_DIR": _bash_path(checkout),
        "STUDIO_EXPECTED_COMMIT": COMMIT,
        "STUDIO_REPOSITORY_USER": "studio-deploy",
        "STUDIO_RELEASE_LOCK_HELD": "yes",
        "TEST_FAKE_PATH": _bash_path(fake_bin),
    }
    proc = subprocess.run(
        [
            "bash",
            "-c",
            'PATH="$TEST_FAKE_PATH:$PATH"; export PATH; exec bash "$1"',
            "_",
            str(RELEASE_SCRIPT),
        ],
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
        timeout=15,
    )
    logged = calls.read_text(encoding="utf-8").splitlines() if calls.exists() else []
    return proc, logged


def _index(calls: list[str], fragment: str) -> int:
    return next(index for index, call in enumerate(calls) if fragment in call)


def test_release_orders_candidate_backup_verification_migration_and_api() -> None:
    import tempfile

    with tempfile.TemporaryDirectory() as directory:
        proc, calls = run_release(Path(directory))

    assert proc.returncode == 0, proc.stderr + proc.stdout + "\n" + "\n".join(calls)
    assert "studio-migration-release] OK" in proc.stdout
    assert _index(calls, "docker compose") < _index(calls, "docker run --rm")
    assert _index(calls, "docker run --rm") < _index(calls, "backup")
    restic_indices = [
        index for index, call in enumerate(calls) if call.startswith("restic ")
    ]
    assert len(restic_indices) == 3
    assert restic_indices[0] < _index(calls, "backup") < restic_indices[1]
    assert " snapshots " in f" {calls[restic_indices[0]]} "
    assert " snapshots " in f" {calls[restic_indices[1]]} "
    assert " restore " in f" {calls[restic_indices[2]]} "
    pg_restore_index = _index(calls, "--entrypoint pg_restore")
    assert restic_indices[2] < pg_restore_index
    assert pg_restore_index < _index(calls, "migrate snapshot=")
    pg_restore_call = calls[pg_restore_index]
    assert POSTGRES_IMAGE_ID in pg_restore_call
    assert "--pull never" in pg_restore_call
    assert "--network none" in pg_restore_call
    assert "--read-only" in pg_restore_call
    assert "--cap-drop ALL" in pg_restore_call
    assert "--security-opt no-new-privileges" in pg_restore_call
    assert "--pids-limit 32" in pg_restore_call
    assert "--tmpfs /var/lib/postgresql/data:" in pg_restore_call
    assert "dst=/tmp/studio-postgres.dump,readonly" in pg_restore_call
    assert "--list /tmp/studio-postgres.dump" in pg_restore_call
    assert _index(calls, "migrate snapshot=") < _index(
        calls, "up -d --no-deps --force-recreate studio-api"
    )
    migrate_call = next(call for call in calls if call.startswith("migrate "))
    assert f"snapshot={NEW_SNAPSHOT}" in migrate_call
    assert f"from={OLD_REVISION}" in migrate_call
    assert f"to={NEW_REVISION}" in migrate_call
    assert f"image={IMAGE_ID}" in migrate_call
    combined = proc.stdout + proc.stderr + "\n".join(calls)
    assert "protected-test-value" not in combined


def test_non_additive_candidate_blocks_before_backup_or_migration(tmp_path: Path) -> None:
    proc, calls = run_release(tmp_path, release_safety="destructive")

    assert proc.returncode == 2
    assert "reason=candidate_migration_not_additive" in proc.stderr
    assert not any(call == "backup" for call in calls)
    assert not any(call.startswith("migrate ") for call in calls)
    assert not any("force-recreate studio-api" in call for call in calls)


def test_failed_isolated_pg_restore_check_blocks_before_migration(
    tmp_path: Path,
) -> None:
    proc, calls = run_release(tmp_path, pg_restore_ok=False)

    assert proc.returncode == 2
    assert "reason=backup_pg_restore_list_invalid" in proc.stderr
    assert any("--entrypoint pg_restore" in call for call in calls)
    assert not any(call.startswith("migrate ") for call in calls)
    assert not any("force-recreate studio-api" in call for call in calls)


def test_forced_command_wrapper_never_executes_original_command() -> None:
    wrapper = WRAPPER.read_text(encoding="utf-8")

    assert r"^release\ ([0-9a-f]{40})$" in wrapper
    assert 'requested_commit="${BASH_REMATCH[1]}"' in wrapper
    assert '[[ "$remote_commit" == "$requested_commit" ]]' in wrapper
    assert 'repo_git show "${requested_commit}:${RELEASE_SCRIPT}"' in wrapper
    assert "env -i" in wrapper
    assert 'INSTALLED_PATH="/usr/local/sbin/studio-migration-release-wrapper"' in wrapper
    assert 'stat -c %u -- "$INSTALLED_PATH"' in wrapper
    assert "eval " not in wrapper
    assert 'bash -c "${SSH_ORIGINAL_COMMAND' not in wrapper
    assert "sudo " not in wrapper


def test_release_has_no_automatic_retry_downgrade_or_database_restore() -> None:
    release = RELEASE_SCRIPT.read_text(encoding="utf-8")

    assert "alembic downgrade" not in release
    assert "docker compose down" not in release
    assert "postgresql://" not in release
    assert release.count('bash "$MIGRATION_SCRIPT"') == 1
    assert "command -v pg_restore" not in release
    assert "--entrypoint pg_restore" in release
    assert '"$postgres_image_id"' in release
    assert "--pull never" in release
    assert "--network none" in release
    assert "--read-only" in release
    assert "--tmpfs /var/lib/postgresql/data:" in release
    assert "--list /tmp/studio-postgres.dump" in release
    assert "pg_restore --clean" not in release
    assert "pg_restore --create" not in release


def test_cd_migration_lane_is_disabled_by_default_and_environment_gated() -> None:
    workflow = CD_WORKFLOW.read_text(encoding="utf-8")
    detection = workflow.split("  deploy-web:", 1)[0]
    release_job = workflow.split("  release-api-migration:", 1)[1].split(
        "\n  deploy-worker:", 1
    )[0]

    assert "migration_release=false" in detection
    assert 'vars.STUDIO_MIGRATION_RELEASE_ENABLED }}" == "true"' in detection
    assert "migration_release=true" in detection
    assert "source_changed_approval_required" in detection
    assert "manual_selection_approval_required" in detection
    assert "automatic_migration_release_disabled" in detection
    assert "manual_migration_release_disabled" in detection
    assert "environment: studio-production-migration" in release_job
    assert "inputs.component == 'migration'" in release_job
    assert "needs.detect-components.outputs.migration_release == 'true'" in release_job
    assert "needs.deploy-web.result == 'success'" in release_job


def test_cd_uses_only_dedicated_forced_command_identity_for_migration() -> None:
    workflow = CD_WORKFLOW.read_text(encoding="utf-8")
    release_job = workflow.split("  release-api-migration:", 1)[1].split(
        "\n  deploy-worker:", 1
    )[0]

    for secret in (
        "STUDIO_MIGRATION_DEPLOY_HOST",
        "STUDIO_MIGRATION_SSH_KEY",
        "STUDIO_MIGRATION_KNOWN_HOSTS",
    ):
        assert secret in release_job
    assert '"root@$MIGRATION_DEPLOY_HOST"' in release_job
    assert '"release $RELEASE_SHA"' in release_job
    assert "StrictHostKeyChecking=yes" in release_job
    assert "UserKnownHostsFile=~/.ssh/studio_migration_known_hosts" in release_job
    assert "[studio-migration-release] OK commit=" in release_job
    assert "[studio-migration-release-wrapper] OK commit=" in release_job
    assert "bash -s" not in release_job
    assert "alembic upgrade" not in release_job
    assert "backup_studio_postgres_r2.sh" not in release_job


def test_studio_ci_watches_migration_release_contract_files() -> None:
    workflow = STUDIO_CI_WORKFLOW.read_text(encoding="utf-8")

    for path in (
        "scripts/release_studio_platform_migration.sh",
        "tests/test_migrate_studio_platform.py",
        "tests/test_studio_migration_release.py",
    ):
        assert workflow.count(f"- '{path}'") == 2


def test_embedded_release_python_programs_compile() -> None:
    release = RELEASE_SCRIPT.read_text(encoding="utf-8")
    heredoc_programs = re.findall(
        r"<<'PY'\n(.*?)\nPY",
        release,
        flags=re.DOTALL,
    )
    docker_program = release.split(
        'docker run --rm --entrypoint python "$API_IMAGE" -c \'\n',
        1,
    )[1].split("\n' </dev/null", 1)[0]

    assert len(heredoc_programs) == 3
    for index, program in enumerate((*heredoc_programs, docker_program), start=1):
        compile(program, f"<studio-release-embedded-{index}>", "exec")

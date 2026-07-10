from __future__ import annotations

import os
import stat
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "deploy_studio_platform_component.sh"


def _write_exe(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


def run_deploy(tmp_path: Path, component: str, **env_overrides: str) -> tuple[subprocess.CompletedProcess[str], list[str]]:
    log = tmp_path / "calls.log"
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    state = {
        "built_image_id": "sha256:built",
        "running_image_id": "sha256:built",
        "container_id": "container-new",
        "postgres_id": "postgres-container",
        "redis_id": "redis-container",
        "health_status": "healthy",
        "head_revision": "abc123",
        "current_revision": "abc123",
        "curl_exit": "0",
        "build_exit": "0",
        "tagged_inspect_exit": "0",
        "tagged_inspect_empty": "0",
        "running_inspect_exit": "0",
        "running_inspect_empty": "0",
    }
    state.update(env_overrides)

    _write_exe(
        bin_dir / "git",
        f"""#!/usr/bin/env bash
set -euo pipefail
printf 'git %s\\n' "$*" >> {str(log)!r}
case "$*" in
  "rev-parse --abbrev-ref HEAD") echo main ;;
  "config --get remote.origin.url") echo git@github.com:Just9120/Elevenlabs-API.git ;;
  "status --porcelain --untracked-files=no") ;;
  "fetch --prune origin main") ;;
  "merge --ff-only origin/main") ;;
  *) echo "unexpected git $*" >&2; exit 44 ;;
esac
""",
    )
    _write_exe(
        bin_dir / "curl",
        f"""#!/usr/bin/env bash
printf 'curl %s\\n' "$*" >> {str(log)!r}
exit {state['curl_exit']}
""",
    )
    _write_exe(bin_dir / "sleep", f"#!/usr/bin/env bash\nprintf 'sleep %s\\n' \"$*\" >> {str(log)!r}\n")
    _write_exe(
        bin_dir / "docker",
        f"""#!/usr/bin/env bash
set -euo pipefail
printf 'docker %s\\n' "$*" >> {str(log)!r}
if [[ "$1" == "compose" ]]; then
  shift
  while [[ "$1" == "--env-file" || "$1" == "-f" ]]; do shift 2; done
  cmd="$1"; shift
  case "$cmd" in
    build)
      [[ "$1" == "studio-api" || "$1" == "studio-web" ]] || exit 45
      exit {state['build_exit']}
      ;;
    ps)
      [[ "$1" == "-q" ]] || exit 45
      case "$2" in
        studio-api|studio-web) printf '%s\\n' {state['container_id']!r} ;;
        postgres) printf '%s\\n' {state['postgres_id']!r} ;;
        redis) printf '%s\\n' {state['redis_id']!r} ;;
        *) exit 46 ;;
      esac
      ;;
    run)
      last="${{@: -1}}"
      if [[ "$last" == "heads" ]]; then echo {state['head_revision']!r}; elif [[ "$last" == "current" ]]; then echo {state['current_revision']!r}; else exit 47; fi
      ;;
    up)
      printf 'compose-up-args %s\\n' "$*" >> {str(log)!r}
      [[ "$*" != *postgres* && "$*" != *redis* ]] || exit 48
      ;;
    down|config) exit 49 ;;
    *) echo "unexpected compose $cmd $*" >&2; exit 50 ;;
  esac
elif [[ "$1" == "image" && "$2" == "inspect" ]]; then
  [[ "$3" == "--format" && "$4" == "{{{{.Id}}}}" ]] || exit 51
  exit_code={state['tagged_inspect_exit']}
  [[ "$exit_code" == "0" ]] || exit "$exit_code"
  [[ {state['tagged_inspect_empty']!r} == "1" ]] || printf '%s\\n' {state['built_image_id']!r}
elif [[ "$1" == "inspect" ]]; then
  if [[ "$4" == "postgres-container" || "$4" == "redis-container" ]]; then
    printf '%s\\n' {state['health_status']!r}
  else
    exit_code={state['running_inspect_exit']}
    [[ "$exit_code" == "0" ]] || exit "$exit_code"
    [[ {state['running_inspect_empty']!r} == "1" ]] || printf '%s\\n' {state['running_image_id']!r}
  fi
else
  echo "unexpected docker $*" >&2; exit 52
fi
""",
    )
    env = os.environ.copy()
    env.update({"PATH": f"{bin_dir}:{env['PATH']}", "STUDIO_DEPLOY_DIR": str(ROOT)})
    env_file = ROOT / "deploy/studio/.env"
    created_env_file = not env_file.exists()
    if created_env_file:
        env_file.write_text("# test placeholder; fake docker does not read this file\n", encoding="utf-8")
    try:
        proc = subprocess.run(["bash", str(SCRIPT), component], cwd=ROOT, env=env, text=True, capture_output=True, timeout=10)
    finally:
        if created_env_file:
            env_file.unlink()
    return proc, log.read_text(encoding="utf-8").splitlines() if log.exists() else []


def assert_no_forbidden_mutation(calls: list[str]) -> None:
    joined = "\n".join(calls)
    forbidden = ["compose down", " prune", " volume rm", "compose config", "rollback"]
    for text in forbidden:
        assert text not in joined
    up_lines = [line for line in calls if line.startswith("compose-up-args ")]
    assert all("postgres" not in line and "redis" not in line for line in up_lines)


def index_of(calls: list[str], fragment: str) -> int:
    return next(i for i, line in enumerate(calls) if fragment in line)


def test_successful_api_deployment_orders_identity_before_health() -> None:
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        proc, calls = run_deploy(Path(d), "api")
    assert proc.returncode == 0, proc.stderr + proc.stdout
    assert "STUDIO_PLATFORM_API_DEPLOY_OK" in proc.stdout
    assert "STUDIO_PLATFORM_WEB_DEPLOY_OK" not in proc.stdout
    assert index_of(calls, "build studio-api") < index_of(calls, "docker image inspect --format {{.Id}} elevenlabs-studio-api:local")
    assert not any("build studio-web" in line for line in calls)
    assert index_of(calls, "docker compose --env-file deploy/studio/.env -f deploy/studio/compose.platform.yml ps -q postgres") < index_of(calls, "compose-up-args -d --no-deps --force-recreate studio-api")
    assert index_of(calls, "alembic studio-api heads") < index_of(calls, "compose-up-args -d --no-deps --force-recreate studio-api")
    assert index_of(calls, "alembic studio-api current") < index_of(calls, "compose-up-args -d --no-deps --force-recreate studio-api")
    assert index_of(calls, "compose-up-args -d --no-deps --force-recreate studio-api") < index_of(calls, "docker compose --env-file deploy/studio/.env -f deploy/studio/compose.platform.yml ps -q studio-api")
    assert index_of(calls, "docker inspect --format {{.Image}} container-new") < index_of(calls, "curl -fsS http://127.0.0.1:8182/api/healthz")
    assert_no_forbidden_mutation(calls)


def test_successful_web_deployment_has_no_api_dependency_gates(tmp_path: Path) -> None:
    proc, calls = run_deploy(tmp_path, "web")
    assert proc.returncode == 0, proc.stderr + proc.stdout
    assert proc.stdout.count("STUDIO_PLATFORM_WEB_DEPLOY_OK") == 1
    assert "STUDIO_PLATFORM_API_DEPLOY_OK" not in proc.stdout
    assert any("build studio-web" in line for line in calls)
    assert not any("studio-api heads" in line or "studio-api current" in line or "ps -q postgres" in line or "ps -q redis" in line for line in calls)
    assert index_of(calls, "compose-up-args -d --no-deps --force-recreate studio-web") < index_of(calls, "docker inspect --format {{.Image}} container-new")
    assert index_of(calls, "docker inspect --format {{.Image}} container-new") < index_of(calls, "curl -fsS http://127.0.0.1:8181/healthz")
    assert_no_forbidden_mutation(calls)


def test_image_mismatch_blocks_before_health_even_if_old_service_would_be_healthy(tmp_path: Path) -> None:
    proc, calls = run_deploy(tmp_path, "api", running_image_id="sha256:old")
    assert proc.returncode != 0
    assert "STUDIO_PLATFORM_API_DEPLOY_OK" not in proc.stdout
    assert not any(line.startswith("curl ") for line in calls)
    assert "does not match built image identity" in proc.stderr
    assert_no_forbidden_mutation(calls)


def test_missing_tagged_image_identity_blocks_before_update(tmp_path: Path) -> None:
    proc, calls = run_deploy(tmp_path, "web", tagged_inspect_empty="1")
    assert proc.returncode != 0
    assert "STUDIO_PLATFORM_WEB_DEPLOY_OK" not in proc.stdout
    assert not any("compose-up-args" in line for line in calls)
    assert_no_forbidden_mutation(calls)


def test_tagged_image_inspect_failure_blocks_before_update(tmp_path: Path) -> None:
    proc, calls = run_deploy(tmp_path, "web", tagged_inspect_exit="7")
    assert proc.returncode != 0
    assert "STUDIO_PLATFORM_WEB_DEPLOY_OK" not in proc.stdout
    assert not any("compose-up-args" in line for line in calls)
    assert_no_forbidden_mutation(calls)


def test_missing_container_id_blocks_after_forced_update_before_health(tmp_path: Path) -> None:
    proc, calls = run_deploy(tmp_path, "web", container_id="")
    assert proc.returncode != 0
    assert "STUDIO_PLATFORM_WEB_DEPLOY_OK" not in proc.stdout
    assert any("compose-up-args -d --no-deps --force-recreate studio-web" in line for line in calls)
    assert not any(line.startswith("curl ") for line in calls)
    assert_no_forbidden_mutation(calls)


def test_missing_running_image_identity_blocks_before_health(tmp_path: Path) -> None:
    proc, calls = run_deploy(tmp_path, "web", running_inspect_empty="1")
    assert proc.returncode != 0
    assert "STUDIO_PLATFORM_WEB_DEPLOY_OK" not in proc.stdout
    assert not any(line.startswith("curl ") for line in calls)
    assert_no_forbidden_mutation(calls)


def test_running_image_inspect_failure_blocks_before_health(tmp_path: Path) -> None:
    proc, calls = run_deploy(tmp_path, "web", running_inspect_exit="8")
    assert proc.returncode != 0
    assert "STUDIO_PLATFORM_WEB_DEPLOY_OK" not in proc.stdout
    assert not any(line.startswith("curl ") for line in calls)
    assert_no_forbidden_mutation(calls)


def test_api_revision_mismatch_blocks_before_replacement(tmp_path: Path) -> None:
    proc, calls = run_deploy(tmp_path, "api", current_revision="old")
    assert proc.returncode != 0
    assert "STUDIO_PLATFORM_API_DEPLOY_OK" not in proc.stdout
    assert not any("compose-up-args" in line for line in calls)
    assert "manual migration required" in proc.stderr
    assert_no_forbidden_mutation(calls)


def test_unhealthy_stateful_dependency_blocks_before_replacement(tmp_path: Path) -> None:
    proc, calls = run_deploy(tmp_path, "api", health_status="unhealthy")
    assert proc.returncode != 0
    assert "STUDIO_PLATFORM_API_DEPLOY_OK" not in proc.stdout
    assert not any("compose-up-args" in line for line in calls)
    assert_no_forbidden_mutation(calls)


def test_build_failure_is_visible_and_not_retried(tmp_path: Path) -> None:
    proc, calls = run_deploy(tmp_path, "api", build_exit="9")
    assert proc.returncode != 0
    assert "STUDIO_PLATFORM_API_DEPLOY_OK" not in proc.stdout
    assert sum("build studio-api" in line for line in calls) == 1
    assert not any("docker image inspect --format {{.Id}}" in line for line in calls)
    assert_no_forbidden_mutation(calls)


def test_health_failure_after_matching_identity_fails_without_success(tmp_path: Path) -> None:
    proc, calls = run_deploy(tmp_path, "web", curl_exit="22")
    assert proc.returncode != 0
    assert "STUDIO_PLATFORM_WEB_DEPLOY_OK" not in proc.stdout
    assert index_of(calls, "docker inspect --format {{.Image}} container-new") < index_of(calls, "curl -fsS http://127.0.0.1:8181/healthz")
    assert_no_forbidden_mutation(calls)

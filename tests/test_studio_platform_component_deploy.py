from __future__ import annotations

import os
import stat
import subprocess
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "deploy_studio_platform_component.sh"


def _write_exe(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


def run_deploy(
    tmp_path: Path,
    component: str,
    *,
    via_stdin: bool = False,
    checkout_dir: Path | None = None,
    merge_target_tree: Path | None = None,
    merge_updates_head: bool = True,
    **env_overrides: str,
) -> tuple[subprocess.CompletedProcess[str], list[str]]:
    log = tmp_path / "calls.log"
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    checkout = checkout_dir or ROOT
    merge_marker = tmp_path / "merge-complete"
    merge_actions = []
    if merge_target_tree is not None:
        merge_actions.append(f"cp -R {str(merge_target_tree)!r}/. {str(checkout)!r}/")
    if merge_updates_head:
        merge_actions.append(f"touch {str(merge_marker)!r}")
    merge_command = "; ".join(merge_actions) or ":"
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
        "local_head": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "target_head": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    }
    state.update(env_overrides)

    _write_exe(
        bin_dir / "git",
        f"""#!/usr/bin/env bash
set -euo pipefail
printf 'git %s\\n' "$*" >> {str(log)!r}
case "$*" in
  "rev-parse --abbrev-ref HEAD") echo main ;;
  "rev-parse HEAD") if [[ -f {str(merge_marker)!r} ]]; then echo {state['target_head']!r}; else echo {state['local_head']!r}; fi ;;
  "rev-parse origin/main") echo {state['target_head']!r} ;;
  "config --get remote.origin.url") echo git@github.com:Just9120/Elevenlabs-API.git ;;
  "status --porcelain --untracked-files=no") ;;
  "fetch --prune origin main") ;;
  "merge --ff-only origin/main") {merge_command} ;;
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
      [[ "$1" == "studio-api" || "$1" == "studio-web" || "$1" == "studio-worker" ]] || exit 45
      exit {state['build_exit']}
      ;;
    ps)
      [[ "$1" == "-q" ]] || exit 45
      case "$2" in
        studio-api|studio-web|studio-worker) printf '%s\\n' {state['container_id']!r} ;;
        postgres) printf '%s\\n' {state['postgres_id']!r} ;;
        redis) printf '%s\\n' {state['redis_id']!r} ;;
        *) exit 46 ;;
      esac
      ;;
    run)
      has_detached_tty=false
      for arg in "$@"; do
        if [[ "$arg" == "-T" ]]; then has_detached_tty=true; fi
      done
      if [[ "$has_detached_tty" != "true" ]]; then
        cat >/dev/null
      else
        if read -r unexpected_stdin; then
          printf 'unexpected-run-stdin %s\n' "$unexpected_stdin" >> {str(log)!r}
        fi
      fi
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
elif [[ "$1" == "tag" ]]; then
  exit 0
elif [[ "$1" == "image" && "$2" == "inspect" ]]; then
  [[ "$3" == "--format" && "$4" == "{{{{.Id}}}}" ]] || exit 51
  exit_code={state['tagged_inspect_exit']}
  [[ "$exit_code" == "0" ]] || exit "$exit_code"
  [[ {state['tagged_inspect_empty']!r} == "1" ]] || printf '%s\\n' {state['built_image_id']!r}
elif [[ "$1" == "inspect" ]]; then
  if [[ "$*" == *State.Health* ]]; then
    printf '%s\n' {state['health_status']!r}
  elif [[ "$4" == "postgres-container" || "$4" == "redis-container" ]]; then
    printf '%s\n' {state['health_status']!r}
  else
    exit_code={state['running_inspect_exit']}
    [[ "$exit_code" == "0" ]] || exit "$exit_code"
    [[ {state['running_inspect_empty']!r} == "1" ]] || printf '%s\n' {state['running_image_id']!r}
  fi
else
  echo "unexpected docker $*" >&2; exit 52
fi
""",
    )
    env = os.environ.copy()
    env.update({"PATH": f"{bin_dir}:{env['PATH']}", "STUDIO_DEPLOY_DIR": str(checkout)})
    env_file = checkout / "deploy/studio/.env"
    created_env_file = not env_file.exists()
    if created_env_file:
        env_file.write_text("# test placeholder; fake docker does not read this file\n", encoding="utf-8")
    try:
        if via_stdin:
            with SCRIPT.open("r", encoding="utf-8") as stdin:
                proc = subprocess.run(["bash", "-s", "--", component], cwd=checkout, env=env, text=True, stdin=stdin, capture_output=True, timeout=10)
        else:
            proc = subprocess.run(["bash", str(SCRIPT), component], cwd=checkout, env=env, text=True, capture_output=True, timeout=10)
    finally:
        if created_env_file:
            env_file.unlink()
    return proc, log.read_text(encoding="utf-8").splitlines() if log.exists() else []


def assert_no_forbidden_mutation(calls: list[str]) -> None:
    joined = "\n".join(calls)
    forbidden = ["compose down", " prune", " volume rm", "compose config"]
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


def test_api_deploy_via_stdin_still_reaches_success_boundary(tmp_path: Path) -> None:
    proc, calls = run_deploy(tmp_path, "api", via_stdin=True)
    assert proc.returncode == 0, proc.stderr + proc.stdout
    assert proc.stdout.count("STUDIO_PLATFORM_API_DEPLOY_OK") == 1
    assert index_of(calls, "ps -q postgres") < index_of(calls, "ps -q redis")
    assert index_of(calls, "ps -q redis") < index_of(calls, "alembic studio-api heads")
    assert index_of(calls, "alembic studio-api heads") < index_of(calls, "alembic studio-api current")
    assert index_of(calls, "alembic studio-api current") < index_of(calls, "compose-up-args -d --no-deps --force-recreate studio-api")
    assert index_of(calls, "compose-up-args -d --no-deps --force-recreate studio-api") < index_of(calls, "docker inspect --format {{.Image}} container-new")
    assert index_of(calls, "docker inspect --format {{.Image}} container-new") < index_of(calls, "curl -fsS http://127.0.0.1:8182/api/healthz")
    assert not any(line.startswith("unexpected-run-stdin ") for line in calls)
    assert_no_forbidden_mutation(calls)


def test_studio_platform_cd_materializes_deploy_script_for_both_components() -> None:
    workflow = (ROOT / ".github/workflows/studio-platform-cd.yml").read_text(encoding="utf-8")
    assert "git show origin/main:scripts/deploy_studio_platform_component.sh |" not in workflow
    assert "bash -s -- web" not in workflow
    assert "bash -s -- api" not in workflow
    for component in ("web", "api"):
        pattern = re.compile(
            rf"git fetch --prune origin main.*?"
            rf"deploy_script=\"\$\(mktemp\)\".*?"
            rf"trap 'rm -f \"\$deploy_script\"' EXIT.*?"
            rf"git show origin/main:scripts/deploy_studio_platform_component.sh >\"\$deploy_script\".*?"
            rf"\[\[ -s \"\$deploy_script\" \]\].*?"
            rf"STUDIO_DEPLOY_DIR=\"\$STUDIO_DEPLOY_DIR\" bash \"\$deploy_script\" {component}",
            re.DOTALL,
        )
        assert pattern.search(workflow), f"{component} deploy does not execute a materialized temporary script"


def test_studio_ci_path_filters_reference_existing_files() -> None:
    workflow = (ROOT / ".github/workflows/studio-ci.yml").read_text(encoding="utf-8")
    filtered_paths = re.findall(r"^\s+- '([^']+)'$", workflow, re.MULTILINE)
    literal_paths = {path for path in filtered_paths if "*" not in path}
    missing = sorted(path for path in literal_paths if not (ROOT / path).is_file())

    assert missing == []
    assert workflow.count("- 'docs/runbooks/studio-platform-ops.md'") == 2


def test_platform_deploy_files_do_not_export_or_embed_postgres_password() -> None:
    compose = (ROOT / "deploy/studio/compose.platform.yml").read_text(encoding="utf-8")
    migrate = (ROOT / "scripts/migrate_studio_platform.sh").read_text(encoding="utf-8")

    assert "STUDIO_POSTGRES_PASSWORD:" not in compose
    assert "postgresql+psycopg://studio:${" not in compose
    assert "export STUDIO_POSTGRES_PASSWORD" not in migrate


def test_new_script_fast_forwards_old_checkout_before_versioned_validation(tmp_path: Path) -> None:
    checkout = tmp_path / "checkout"
    target_tree = tmp_path / "target-tree"
    checkout.mkdir()
    target_tree.mkdir()

    env_file = checkout / "deploy/studio/.env"
    env_file.parent.mkdir(parents=True)
    env_file.write_text("# runtime file remains outside versioned updates\n", encoding="utf-8")

    required_files = (
        "apps/studio/Dockerfile",
        "apps/studio-api/Dockerfile",
        "apps/studio-api/alembic.ini",
        "apps/studio-api/studio_api/worker.py",
        "apps/studio-api/studio_api/worker_health.py",
        "apps/studio-api/alembic/versions/0001_fixture.py",
    )
    for relative_path in required_files:
        path = target_tree / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("# target revision fixture\n", encoding="utf-8")

    compose_file = target_tree / "deploy/studio/compose.platform.yml"
    compose_file.parent.mkdir(parents=True, exist_ok=True)
    compose_file.write_text(
        """services:
  studio-web:
    ports:
      - "127.0.0.1:8181:8080"
  studio-api:
    ports:
      - "127.0.0.1:8182:8000"
  postgres:
  redis:
  studio-worker:
    healthcheck:
      test: ["CMD", "true"]
""",
        encoding="utf-8",
    )

    assert not (checkout / "apps/studio-api/studio_api/worker_health.py").exists()
    proc, calls = run_deploy(
        tmp_path,
        "web",
        checkout_dir=checkout,
        merge_target_tree=target_tree,
        local_head="1" * 40,
        target_head="2" * 40,
    )

    assert proc.returncode == 0, proc.stderr + proc.stdout
    assert "STUDIO_PLATFORM_WEB_DEPLOY_OK" in proc.stdout
    assert (checkout / "apps/studio-api/studio_api/worker_health.py").is_file()
    assert index_of(calls, "rev-parse --abbrev-ref HEAD") < index_of(calls, "fetch --prune origin main")
    assert index_of(calls, "config --get remote.origin.url") < index_of(calls, "fetch --prune origin main")
    assert index_of(calls, "status --porcelain --untracked-files=no") < index_of(calls, "fetch --prune origin main")
    assert sum("status --porcelain --untracked-files=no" in line for line in calls) == 2
    assert index_of(calls, "fetch --prune origin main") < index_of(calls, "rev-parse origin/main")
    assert index_of(calls, "rev-parse origin/main") < index_of(calls, "merge --ff-only origin/main")
    assert index_of(calls, "merge --ff-only origin/main") < index_of(calls, "rev-parse HEAD")
    assert index_of(calls, "rev-parse HEAD") < index_of(calls, "build studio-web")
    assert_no_forbidden_mutation(calls)


def test_target_revision_mismatch_blocks_before_build(tmp_path: Path) -> None:
    proc, calls = run_deploy(
        tmp_path,
        "web",
        local_head="1" * 40,
        target_head="2" * 40,
        merge_updates_head=False,
    )
    assert proc.returncode != 0
    assert "checkout did not reach fetched target revision" in proc.stderr
    assert not any("build studio-web" in line for line in calls)
    assert_no_forbidden_mutation(calls)


def test_successful_worker_deployment_is_worker_only_and_manual_identity(tmp_path: Path) -> None:
    proc, calls = run_deploy(tmp_path, "worker")
    assert proc.returncode == 0, proc.stderr + proc.stdout
    assert "STUDIO_PLATFORM_WORKER_DEPLOY_OK" in proc.stdout
    assert any("build studio-worker" in line for line in calls)
    assert not any("build studio-web" in line or "build studio-api" in line for line in calls)
    assert any("docker tag elevenlabs-studio-worker:local elevenlabs-studio-worker:" in line for line in calls)
    assert any("compose-up-args -d --no-deps --force-recreate studio-worker" in line for line in calls)
    assert not any("compose-up-args" in line and ("postgres" in line or "redis" in line or "studio-api" in line or "studio-web" in line) for line in calls)
    assert_no_forbidden_mutation(calls)


def test_workflow_worker_is_manual_only_and_materialized() -> None:
    workflow = (ROOT / ".github/workflows/studio-platform-cd.yml").read_text(encoding="utf-8")
    assert "- worker" in workflow
    assert "deploy-worker:" in workflow
    assert "github.event_name == 'workflow_dispatch'" in workflow
    assert 'bash "$deploy_script" worker' in workflow
    assert "worker=true" not in workflow.split('elif [[ "${{ vars.STUDIO_PLATFORM_CD_ENABLED }}" == "true" ]]', 1)[1].split('echo "web=$web"',1)[0]
    assert "manage_studio_worker.sh drain" not in workflow
    assert "alembic upgrade" not in workflow

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


def run_worker_deploy_state(tmp_path: Path, *, worker_state: str = "absent", worker_exit: str = "0", worker_ids: str = "worker-old", postgres_health: str = "healthy", redis_health: str = "healthy", head: str = "abc123", current: str = "abc123", tag_exit: str = "0", running_image: str = "sha256:built", health: str = "healthy"):
    log = tmp_path / "calls.log"; bin_dir = tmp_path / "bin"; bin_dir.mkdir(parents=True)
    deployed = tmp_path / "deployed"; deployed.write_text("0")
    _write_exe(bin_dir / "git", f"""#!/usr/bin/env bash
set -euo pipefail
printf 'git %s\n' "$*" >> {str(log)!r}
case "$*" in
  "rev-parse --abbrev-ref HEAD") echo main ;;
  "rev-parse HEAD") echo {('b'*40)!r} ;;
  "rev-parse origin/main") echo {('b'*40)!r} ;;
  "config --get remote.origin.url") echo git@github.com:Just9120/Elevenlabs-API.git ;;
  "status --porcelain --untracked-files=no") ;;
  "fetch --prune origin main") ;;
  "merge --ff-only origin/main") ;;
  *) exit 44 ;;
esac
""")
    _write_exe(bin_dir / "sleep", f"#!/usr/bin/env bash\nprintf 'sleep %s\\n' \"$*\" >> {str(log)!r}\n")
    _write_exe(bin_dir / "docker", f"""#!/usr/bin/env bash
set -euo pipefail
printf 'docker %s\n' "$*" >> {str(log)!r}
if [[ "$1" == compose ]]; then
  shift; while [[ "$1" == --env-file || "$1" == -f ]]; do shift 2; done
  cmd="$1"; shift
  case "$cmd" in
    ps)
      all=false; for a in "$@"; do [[ "$a" == -a ]] && all=true; done; svc="${{@: -1}}"
      if [[ "$svc" == studio-worker ]]; then
        if [[ "$(cat {str(deployed)!r})" == 1 ]]; then echo worker-new; elif [[ {worker_state!r} != absent && ( "$all" == true || {worker_state!r} == running || {worker_state!r} == restarting ) ]]; then for id in {worker_ids}; do echo "$id"; done; fi
      elif [[ "$svc" == postgres ]]; then echo postgres-container
      elif [[ "$svc" == redis ]]; then [[ {redis_health!r} == absent ]] || echo redis-container
      else echo container-new; fi ;;
    build) [[ "$1" == studio-worker ]] || exit 45 ;;
    run) last="${{@: -1}}"; [[ "$last" == heads ]] && echo {head!r} || echo {current!r} ;;
    up) printf 'compose-up-args %s\n' "$*" >> {str(log)!r}; printf 1 > {str(deployed)!r} ;;
    down|config) exit 49 ;;
  esac
elif [[ "$1" == inspect ]]; then
  target="${{@: -1}}"
  if [[ "$*" == *State.Health* ]]; then
    case "$target" in postgres-container) echo {postgres_health!r} ;; redis-container) echo {redis_health!r} ;; worker-new) echo {health!r} ;; *) echo {health!r} ;; esac
  elif [[ "$*" == *State.Status* ]]; then
    case "$target" in postgres-container) echo running ;; redis-container) echo running ;; worker-new) echo running ;; *) echo {worker_state!r} ;; esac
  elif [[ "$*" == *State.ExitCode* ]]; then echo {worker_exit!r}
  else
    case "$target" in worker-old) echo sha256:old ;; worker-new) echo {running_image!r} ;; *) echo sha256:built ;; esac
  fi
elif [[ "$1 $2" == "image inspect" ]]; then
  [[ "$3" == --format ]] || exit 0
  [[ "$5" == elevenlabs-studio-worker:local || "$5" == elevenlabs-studio-worker:* ]] && echo sha256:built || echo sha256:built
elif [[ "$1" == tag ]]; then
  [[ "$3" != elevenlabs-studio-api:local ]] || exit 98
  exit {tag_exit}
else exit 52; fi
""")
    env_file = ROOT / "deploy/studio/.env"; created = not env_file.exists()
    if created: env_file.write_text("# fake\n", encoding="utf-8")
    env = {**os.environ, "PATH": f"{bin_dir}:{os.environ['PATH']}", "STUDIO_DEPLOY_DIR": str(ROOT)}
    try:
        proc = subprocess.run(["bash", str(SCRIPT), "worker"], cwd=ROOT, env=env, text=True, capture_output=True, timeout=10)
    finally:
        if created: env_file.unlink()
    return proc, log.read_text(encoding="utf-8").splitlines() if log.exists() else []


def test_worker_deploy_previous_state_safety_and_candidate_order(tmp_path: Path) -> None:
    proc, calls = run_worker_deploy_state(tmp_path / "running", worker_state="running")
    assert proc.returncode != 0 and "previous_worker_active" in proc.stderr
    assert not any("build studio-worker" in c or "docker tag" in c for c in calls)
    proc, calls = run_worker_deploy_state(tmp_path / "ok", worker_state="exited", worker_exit="0")
    assert proc.returncode == 0, proc.stderr + proc.stdout
    assert index_of(calls, "docker inspect --format {{.Image}} worker-old") < index_of(calls, "docker tag sha256:old elevenlabs-studio-worker:rollback-candidate") < index_of(calls, "build studio-worker")
    assert any("docker image inspect --format {{.Id}} elevenlabs-studio-worker:local" in c for c in calls)
    assert "elevenlabs-studio-api:local" not in "\n".join(calls)
    for code in ("137", "143", "1"):
        proc, calls = run_worker_deploy_state(tmp_path / f"bad{code}", worker_state="exited", worker_exit=code)
        assert proc.returncode != 0 and "previous_worker_exit_abnormal" in proc.stderr
        assert not any("build studio-worker" in c or "rollback-candidate" in c for c in calls)


def test_worker_deploy_postgres_only_dependency_and_failure_gates(tmp_path: Path) -> None:
    proc, calls = run_worker_deploy_state(tmp_path / "pgbad", postgres_health="unhealthy")
    assert proc.returncode != 0 and not any("compose-up-args" in c for c in calls)
    proc, calls = run_worker_deploy_state(tmp_path / "redisbad", redis_health="unhealthy")
    assert proc.returncode == 0, proc.stderr + proc.stdout
    assert not any("ps -q redis" in c for c in calls)
    proc, calls = run_worker_deploy_state(tmp_path / "mismatch", head="new", current="old")
    assert proc.returncode != 0 and "manual migration required" in proc.stderr
    assert not any("compose-up-args" in c for c in calls)
    proc, calls = run_worker_deploy_state(tmp_path / "healthbad", health="unhealthy")
    assert proc.returncode != 0 and "STUDIO_PLATFORM_WORKER_DEPLOY_OK" not in proc.stdout
    proc, calls = run_worker_deploy_state(tmp_path / "imagemismatch", running_image="sha256:old")
    assert proc.returncode != 0 and "does not match built image identity" in proc.stderr


def test_worker_deploy_multiple_containers_blocks_before_build_without_mutation(tmp_path: Path) -> None:
    proc, calls = run_worker_deploy_state(tmp_path / "multi", worker_state="exited", worker_exit="0", worker_ids="worker-old worker-extra")
    assert proc.returncode != 0
    assert "multiple_worker_containers" in proc.stderr
    assert "STUDIO_PLATFORM_WORKER_DEPLOY_OK" not in proc.stdout
    assert not any("build studio-worker" in c for c in calls)
    assert not any("docker tag" in c for c in calls)
    assert not any("compose-up-args" in c for c in calls)

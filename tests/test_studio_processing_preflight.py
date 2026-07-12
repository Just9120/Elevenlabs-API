from __future__ import annotations

import os
import shutil
import stat
import subprocess
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "studio_processing_preflight.sh"
WORKFLOW = ROOT / ".github/workflows/studio-processing-preflight.yml"
SHA = "a" * 40
SECRET_MARKERS = ["SUPERSECRET", "TOKEN123", "container-alpha", "private@example.com", "https://secret.example"]


def _write_exe(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


def make_repo(tmp_path: Path, **state: str) -> tuple[Path, Path]:
    repo = tmp_path / "repo"
    shutil.copytree(ROOT / "apps/studio-api/alembic", repo / "apps/studio-api/alembic")
    (repo / "apps/studio-api/Dockerfile").parent.mkdir(parents=True, exist_ok=True)
    (repo / "apps/studio-api/Dockerfile").write_text("FROM scratch\n", encoding="utf-8")
    (repo / "apps/studio/Dockerfile").parent.mkdir(parents=True, exist_ok=True)
    (repo / "apps/studio/Dockerfile").write_text("FROM scratch\n", encoding="utf-8")
    (repo / "deploy/studio").mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / "deploy/studio/compose.platform.yml", repo / "deploy/studio/compose.platform.yml")
    secret_dir = tmp_path / "secrets"
    secret_dir.mkdir()
    secrets = {}
    for name in ["pg", "master", "s3id", "s3secret", "google"]:
        p = secret_dir / name
        p.write_text(f"SUPERSECRET-{name}-TOKEN123\n", encoding="utf-8")
        secrets[name] = p
    env_text = f"""APP_PUBLIC_URL=https://secret.example
STUDIO_POSTGRES_PASSWORD_FILE={secrets['pg']}
STUDIO_CREDENTIAL_MASTER_KEY_FILE={secrets['master']}
STUDIO_SOURCE_S3_ENDPOINT_URL=https://private-r2.invalid
STUDIO_SOURCE_S3_REGION=auto
STUDIO_SOURCE_S3_BUCKET=bucket
STUDIO_SOURCE_S3_ACCESS_KEY_ID_FILE={secrets['s3id']}
STUDIO_SOURCE_S3_SECRET_ACCESS_KEY_FILE={secrets['s3secret']}
STUDIO_SOURCE_UPLOAD_TTL_SECONDS=3600
STUDIO_SOURCE_PRESIGN_TTL_SECONDS=900
STUDIO_SOURCE_MAX_UPLOAD_BYTES=10
STUDIO_GOOGLE_OAUTH_CLIENT_ID=client-private@example.com
STUDIO_GOOGLE_OAUTH_CLIENT_SECRET_FILE={secrets['google']}
STUDIO_GOOGLE_OAUTH_REDIRECT_URI=https://secret.example/api/google/oauth/callback
STUDIO_GOOGLE_OAUTH_SCOPES=openid email https://www.googleapis.com/auth/drive.file
STUDIO_GOOGLE_OAUTH_STATE_TTL_SECONDS=600
STUDIO_WORKER_POLL_INTERVAL_SECONDS=5
STUDIO_WORKER_ERROR_BACKOFF_SECONDS=5
STUDIO_WORKER_LEASE_TTL_SECONDS=3600
"""
    (repo / "deploy/studio/.env").write_text(state.pop("env_text", env_text), encoding="utf-8")
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    log = tmp_path / "calls.log"
    branch = state.get("branch", "main")
    remote = state.get("remote", "git@github.com:Just9120/Elevenlabs-API.git")
    commit = state.get("commit", SHA)
    dirty = state.get("dirty", "")
    _write_exe(bin_dir / "git", f"""#!/usr/bin/env bash
set -euo pipefail
printf 'git %s\n' "$*" >> {str(log)!r}
case "$*" in
 'rev-parse --abbrev-ref HEAD') echo {branch!r} ;;
 'config --get remote.origin.url') echo {remote!r} ;;
 'rev-parse HEAD') echo {commit!r} ;;
 'status --porcelain --untracked-files=no') echo {dirty!r} ;;
 *) echo unexpected git >&2; exit 9 ;;
esac
""")
    service = {
        "postgres": state.get("postgres", "healthy"),
        "redis": state.get("redis", "healthy"),
        "studio-api": state.get("api", "healthy"),
        "studio-web": state.get("web", "healthy"),
        "studio-worker": state.get("worker", "missing"),
    }
    worker_count = int(state.get("worker_count", "0"))
    current = state.get("current", "0008_transcription_job_outputs")
    _write_exe(bin_dir / "docker", f"""#!/usr/bin/env bash
set -euo pipefail
printf 'docker %s\n' "$*" >> {str(log)!r}
joined="$*"
case "$joined" in *config*|*build*|*pull*|*up*|*down*|*restart*|*stop*|*start*|*kill*|*logs*|*upgrade*|*downgrade*|*stamp*) exit 44;; esac
if [[ "$1" == "compose" ]]; then
  shift
  while [[ "$1" == "--env-file" || "$1" == "-f" ]]; do shift 2; done
  if [[ "$1" == "ps" ]]; then
    svc="$3"
    if [[ "$svc" == "studio-worker" ]]; then for i in $(seq 1 {worker_count}); do echo "container-alpha-studio-worker-$i"; done; exit 0; fi
    case "$svc" in postgres|redis|studio-api|studio-web) echo "container-alpha-$svc";; *) exit 4;; esac
  elif [[ "$1" == "exec" ]]; then
    [[ "$2" == "-T" ]] || exit 45
    if read -r unexpected; then echo stdin-leak >> {str(log)!r}; fi
    printf '%s\n' {current!r}
  else exit 5; fi
elif [[ "$1" == "inspect" ]]; then
  id="${{@: -1}}"; svc="${{id#container-alpha-}}"; svc="${{svc%-1}}"; svc="${{svc%-2}}"
  case "$svc" in
    postgres) status={service['postgres']!r};; redis) status={service['redis']!r};; studio-api) status={service['studio-api']!r};; studio-web) status={service['studio-web']!r};; studio-worker) status={state.get('worker', 'healthy')!r};; *) status=missing;;
  esac
  if [[ "$*" == *State.Health* ]]; then echo "$status"; else [[ "$status" == "missing" || "$status" == "stopped" ]] && echo exited || echo running; fi
else exit 6; fi
""")
    _write_exe(bin_dir / "curl", f"#!/usr/bin/env bash\nprintf 'curl %s\\n' \"$*\" >> {str(log)!r}\nexit {state.get('curl_exit', '0')}\n")
    return repo, bin_dir


def run_preflight(tmp_path: Path, **state: str):
    repo, bin_dir = make_repo(tmp_path, **state)
    env = os.environ.copy()
    env["PATH"] = f"{bin_dir}:{env['PATH']}"
    proc = subprocess.run(["bash", str(SCRIPT), str(repo), "main", "Just9120/Elevenlabs-API", SHA], cwd=repo, env=env, text=True, capture_output=True, timeout=15)
    calls = (tmp_path / "calls.log").read_text(encoding="utf-8").splitlines() if (tmp_path / "calls.log").exists() else []
    return proc, calls, repo


def assert_no_secret_output(proc: subprocess.CompletedProcess[str]) -> None:
    combined = proc.stdout + proc.stderr
    for marker in SECRET_MARKERS:
        assert marker not in combined


def assert_no_forbidden(calls: list[str]) -> None:
    joined = "\n".join(calls).lower()
    for word in ["fetch", "merge", "build", " pull", " up", " down", "restart", " stop", " start", "kill", "upgrade", "downgrade", "backup", "migration", "provider", " job", "logs"]:
        assert word not in joined


def test_successful_host_preflight(tmp_path: Path) -> None:
    proc, calls, _ = run_preflight(tmp_path)
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert proc.stdout.count("STUDIO_PROCESSING_HOST_PREFLIGHT_OK") == 1
    assert "STUDIO_PROCESSING_HOST_PREFLIGHT_BLOCKED" not in proc.stdout
    assert "authenticated smoke-account login | not-run" in proc.stdout
    assert "production Alembic revision | pass" in proc.stdout
    assert any("exec -T studio-api alembic current" in c for c in calls)
    assert_no_secret_output(proc)
    assert_no_forbidden(calls)


def test_identity_failures_block_before_docker(tmp_path: Path) -> None:
    for kwargs in [
        {"wrong_cwd": "1"},
        {"remote": "git@github.com:Other/Repo.git"},
        {"branch": "feature"},
        {"commit": "b" * 40},
        {"dirty": " M secret-file"},
    ]:
        case = tmp_path / str(len(list(tmp_path.iterdir())))
        case.mkdir()
        if kwargs.pop("wrong_cwd", None):
            repo, bin_dir = make_repo(case)
            proc = subprocess.run(["bash", str(SCRIPT), str(repo), "main", "Just9120/Elevenlabs-API", SHA], cwd=case, env={**os.environ, "PATH": f"{bin_dir}:{os.environ['PATH']}"}, text=True, capture_output=True, timeout=10)
            calls = (case / "calls.log").read_text().splitlines() if (case / "calls.log").exists() else []
        else:
            proc, calls, _ = run_preflight(case, **kwargs)
        assert proc.returncode != 0
        assert "STUDIO_PROCESSING_HOST_PREFLIGHT_BLOCKED" in proc.stdout
        assert not any(c.startswith("docker ") for c in calls)
        assert_no_secret_output(proc)


def test_runtime_gate_failures_block_before_service_inspection(tmp_path: Path) -> None:
    cases = [
        {"remove_env": True},
        {"env_text": "APP_PUBLIC_URL=https://x\nAPP_PUBLIC_URL=https://y\n"},
        {"env_text": "APP_PUBLIC_URL=\n"},
        {"env_text": "APP_PUBLIC_URL=__REQUIRED_VALUE__\n"},
        {"missing_secret": True},
    ]
    for i, kwargs in enumerate(cases):
        case = tmp_path / str(i); case.mkdir()
        proc, calls, repo = run_preflight(case, **{k: v for k, v in kwargs.items() if k == "env_text"})
        if kwargs.get("remove_env") or kwargs.get("missing_secret"):
            repo, bin_dir = make_repo(case / "x")
            if kwargs.get("remove_env"):
                (repo / "deploy/studio/.env").unlink()
            else:
                (case / "x/secrets/pg").unlink()
            proc = subprocess.run(["bash", str(SCRIPT), str(repo), "main", "Just9120/Elevenlabs-API", SHA], cwd=repo, env={**os.environ, "PATH": f"{bin_dir}:{os.environ['PATH']}"}, text=True, capture_output=True, timeout=10)
            calls = (case / "x/calls.log").read_text().splitlines() if (case / "x/calls.log").exists() else []
        assert proc.returncode != 0
        assert not any(c.startswith("docker ") for c in calls)
        assert_no_secret_output(proc)


def test_worker_running_blocks_without_mutation(tmp_path: Path) -> None:
    for count in (1, 2):
        proc, calls, _ = run_preflight(tmp_path / str(count), worker_count=str(count), worker="healthy")
        assert proc.returncode != 0
        assert "studio-worker running count is not zero" in proc.stdout
        assert_no_forbidden(calls)


def test_service_safety_blocks_unhealthy_dependencies(tmp_path: Path) -> None:
    for kwargs in [{"postgres": "missing"}, {"postgres": "unhealthy"}, {"redis": "missing"}, {"redis": "unhealthy"}, {"api": "unhealthy"}, {"web": "unhealthy"}]:
        proc, calls, _ = run_preflight(tmp_path / repr(kwargs), **kwargs)
        assert proc.returncode != 0
        assert "STUDIO_PROCESSING_HOST_PREFLIGHT_BLOCKED" in proc.stdout
        assert_no_forbidden(calls)


def test_revision_safety_cases(tmp_path: Path) -> None:
    # no/multiple repository heads by changing down_revision graph in copied files
    proc, _, repo = run_preflight(tmp_path / "ok")
    assert proc.returncode == 0
    for name, edit in [("nohead", "revision = '0008_alt'"), ("multi", "down_revision = None")]:
        case = tmp_path / name
        proc, calls, repo = run_preflight(case)
        f = repo / "apps/studio-api/alembic/versions/0008_transcription_job_outputs.py"
        f.write_text(f.read_text().replace('revision = "0008_transcription_job_outputs"', edit.replace(chr(39), chr(34))), encoding="utf-8")
        proc = subprocess.run(["bash", str(SCRIPT), str(repo), "main", "Just9120/Elevenlabs-API", SHA], cwd=repo, env={**os.environ, "PATH": f"{case/'bin'}:{os.environ['PATH']}"}, text=True, capture_output=True, timeout=15)
        assert proc.returncode != 0
    for current in ["", "abc\ndef", "0007_job_processing_lifecycle"]:
        proc, calls, _ = run_preflight(tmp_path / ("cur" + (current or "empty").replace("\n", "_")), current=current)
        assert proc.returncode != 0
        assert_no_forbidden(calls)


def test_workflow_contract() -> None:
    text = WORKFLOW.read_text(encoding="utf-8")
    data = yaml.safe_load(text)
    on = data[True]  # PyYAML 1.1 parses "on" as True.
    assert set(on) == {"workflow_dispatch"}
    assert on["workflow_dispatch"]["inputs"]["expected_commit"]["required"] is True
    assert data["permissions"] == {"contents": "read"}
    assert data["concurrency"] == {"group": "studio-platform-production", "cancel-in-progress": False}
    assert "refs/heads/main" in text
    assert "StrictHostKeyChecking=yes" in text and "BatchMode=yes" in text
    assert "mktemp /tmp/studio-processing-preflight" in text and "rm -f '$remote_script'" in text
    assert "deploy_studio_platform_component.sh" not in text
    assert "bash -s" not in text
    assert "git fetch" not in text and "git pull" not in text and "docker compose" not in text

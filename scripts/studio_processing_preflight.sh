#!/usr/bin/env bash
set -euo pipefail

PREFIX="[studio-processing-preflight]"
EXPECTED_HEAD="0008_transcription_job_outputs"
COMPOSE_FILE="deploy/studio/compose.platform.yml"
ENV_FILE="deploy/studio/.env"
VERSIONS_DIR="apps/studio-api/alembic/versions"
DEPLOY_DIR="${1:-}"
EXPECTED_BRANCH="${2:-}"
EXPECTED_REPO="${3:-}"
EXPECTED_COMMIT="${4:-}"
OVERALL="pass"
DOCKER_ALLOWED="false"
declare -a ROWS=()
declare -A ENV_VALUES=()
declare -A ENV_SEEN=()

add_row() { ROWS+=("$1|$2|$3"); [[ "$2" == "pass" || "$2" == "not-run" ]] || OVERALL="blocked"; }
print_table() { echo "check | status | secret-free observation"; echo "--- | --- | ---"; for row in "${ROWS[@]}"; do IFS='|' read -r c s o <<<"$row"; echo "$c | $s | $o"; done; }
block_exit() { add_account_rows; print_table; echo "STUDIO_PROCESSING_HOST_PREFLIGHT_BLOCKED"; exit 1; }
add_account_rows() {
  add_row "authenticated smoke-account login" "not-run" "separate authenticated operator confirmation is required"
  add_row "active Google connection" "not-run" "separate authenticated operator confirmation is required"
  add_row "exactly one active ElevenLabs BYOK credential" "not-run" "separate authenticated operator confirmation is required"
  add_row "writable output folder selected" "not-run" "separate authenticated operator confirmation is required"
  add_row "one small supported source available" "not-run" "separate authenticated operator confirmation is required"
}

echo "$PREFIX starting read-only host preflight"
[[ -n "$DEPLOY_DIR" && -n "$EXPECTED_BRANCH" && -n "$EXPECTED_REPO" && -n "$EXPECTED_COMMIT" ]] || { add_row "deploy directory identity" "blocked" "required invocation arguments are missing"; block_exit; }
[[ "$EXPECTED_COMMIT" =~ ^[0-9a-fA-F]{40}$ ]] || { add_row "commit identity" "blocked" "expected commit must be a 40-character hexadecimal SHA"; block_exit; }

actual_dir="$(pwd -P 2>/dev/null || true)"
expected_dir="$(cd "$DEPLOY_DIR" 2>/dev/null && pwd -P || true)"
if [[ -n "$expected_dir" && "$actual_dir" == "$expected_dir" && "$expected_dir" == "$DEPLOY_DIR" ]]; then add_row "deploy directory identity" "pass" "current directory matches the documented production checkout"; else add_row "deploy directory identity" "blocked" "current directory is not the documented production checkout"; block_exit; fi

branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [[ "$branch" == "$EXPECTED_BRANCH" ]]; then add_row "branch identity" "pass" "current branch matches expected branch"; else add_row "branch identity" "blocked" "current branch does not match expected branch"; block_exit; fi
remote="$(git config --get remote.origin.url 2>/dev/null || true)"
case "$remote" in
  git@github.com:${EXPECTED_REPO}.git|git@github.com:${EXPECTED_REPO}|https://github.com/${EXPECTED_REPO}.git) add_row "repository remote identity" "pass" "origin remote matches an accepted repository form" ;;
  *) add_row "repository remote identity" "blocked" "origin remote does not match an accepted repository form"; block_exit ;;
esac
head="$(git rev-parse HEAD 2>/dev/null || true)"
if [[ "$head" == "$EXPECTED_COMMIT" ]]; then add_row "commit identity" "pass" "HEAD matches expected commit"; else add_row "commit identity" "blocked" "HEAD does not match expected commit"; block_exit; fi
status="$(git status --porcelain --untracked-files=no 2>/dev/null || true)"
if [[ -z "$status" ]]; then add_row "tracked working tree" "pass" "tracked working tree is clean"; else add_row "tracked working tree" "blocked" "tracked working tree is not clean"; block_exit; fi

[[ -f "$ENV_FILE" && -f "$COMPOSE_FILE" && -d "$VERSIONS_DIR" && -f "apps/studio-api/Dockerfile" && -f "apps/studio/Dockerfile" ]] || { add_row "runtime env presence" "blocked" "required runtime or inspection files are missing"; block_exit; }
add_row "runtime env presence" "pass" "required runtime and inspection files are present"

parse_env() {
  local line key val
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" == *"="* && ! "$line" =~ ^[[:space:]] && "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || return 2
    key="${line%%=*}"; val="${line#*=}"
    [[ -z "${ENV_SEEN[$key]+x}" ]] || return 3
    ENV_SEEN[$key]=1; ENV_VALUES[$key]="$val"
  done < "$ENV_FILE"
}
if ! parse_env; then add_row "runtime setting completeness" "blocked" "runtime env contains malformed or duplicate required syntax"; block_exit; fi
required=(APP_PUBLIC_URL STUDIO_SOURCE_S3_ENDPOINT_URL STUDIO_SOURCE_S3_REGION STUDIO_SOURCE_S3_BUCKET STUDIO_SOURCE_UPLOAD_TTL_SECONDS STUDIO_SOURCE_PRESIGN_TTL_SECONDS STUDIO_SOURCE_MAX_UPLOAD_BYTES STUDIO_GOOGLE_OAUTH_CLIENT_ID STUDIO_GOOGLE_OAUTH_REDIRECT_URI STUDIO_GOOGLE_OAUTH_SCOPES STUDIO_GOOGLE_OAUTH_STATE_TTL_SECONDS STUDIO_WORKER_POLL_INTERVAL_SECONDS STUDIO_WORKER_ERROR_BACKOFF_SECONDS STUDIO_WORKER_LEASE_TTL_SECONDS)
for k in "${required[@]}"; do v="${ENV_VALUES[$k]-}"; if [[ -z "$v" || "$v" == __*__ || "$v" == *REQUIRED* ]]; then add_row "runtime setting completeness" "blocked" "required runtime settings are missing, blank, or unresolved"; block_exit; fi; done
add_row "runtime setting completeness" "pass" "required non-secret runtime settings are present"
for k in STUDIO_POSTGRES_PASSWORD_FILE STUDIO_CREDENTIAL_MASTER_KEY_FILE STUDIO_SOURCE_S3_ACCESS_KEY_ID_FILE STUDIO_SOURCE_S3_SECRET_ACCESS_KEY_FILE STUDIO_GOOGLE_OAUTH_CLIENT_SECRET_FILE; do
  v="${ENV_VALUES[$k]-}"
  label="${k#STUDIO_}"; label="${label%_FILE} secret-file presence"
  if [[ -z "$v" || "$v" == __*__ || "$v" == *REQUIRED* || ! -f "$v" ]]; then add_row "$label" "blocked" "required secret file is not present"; block_exit; else add_row "$label" "pass" "required secret file is present"; fi
done
DOCKER_ALLOWED="true"
compose=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
service_status() {
  local svc="$1" ids count running=0 health="unknown" id hs state status="missing"
  ids="$(${compose[@]} ps -q "$svc" 2>/dev/null || true)"
  count=$(printf '%s\n' "$ids" | sed '/^$/d' | wc -l | tr -d ' ')
  if [[ "$count" != "0" ]]; then
    while IFS= read -r id; do [[ -n "$id" ]] || continue; state="$(docker inspect --format '{{.State.Status}}' "$id" 2>/dev/null || true)"; hs="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id" 2>/dev/null || true)"; [[ "$state" == "running" ]] && running=$((running+1)); if [[ "$hs" == "healthy" ]]; then health="healthy"; elif [[ "$hs" == "unhealthy" ]]; then health="unhealthy"; fi; done <<<"$ids"
    if [[ "$health" == "healthy" ]]; then status="healthy"; elif [[ "$health" == "unhealthy" ]]; then status="unhealthy"; elif [[ "$running" -gt 0 ]]; then status="running"; else status="stopped"; fi
  fi
  printf '%s:%s:%s\n' "$count" "$running" "$status"
}
declare -A SCOUNT SRUN SSTATUS
for svc in postgres redis studio-api studio-web studio-worker; do IFS=: read -r c r s < <(service_status "$svc"); SCOUNT[$svc]="$c"; SRUN[$svc]="$r"; SSTATUS[$svc]="$s"; add_row "$svc service count/status" "pass" "running count ${r}; status ${s}"; done
[[ "${SRUN[studio-worker]}" == "0" ]] || { add_row "studio-worker pre-rollout state" "blocked" "studio-worker running count is not zero"; block_exit; }
[[ "${SSTATUS[postgres]}" == "healthy" ]] && add_row "PostgreSQL health" "pass" "postgres service is healthy" || { add_row "PostgreSQL health" "blocked" "postgres service is not healthy"; block_exit; }
[[ "${SSTATUS[redis]}" == "healthy" ]] && add_row "Redis health" "pass" "redis service is healthy" || { add_row "Redis health" "blocked" "redis service is not healthy"; block_exit; }
[[ "${SSTATUS[studio-api]}" == "healthy" ]] || { add_row "localhost API health" "blocked" "studio-api is not healthy before localhost check"; block_exit; }
[[ "${SSTATUS[studio-web]}" == "healthy" ]] || { add_row "localhost web health" "blocked" "studio-web is not healthy before localhost check"; block_exit; }

curl -fsS -o /dev/null --max-time 5 http://127.0.0.1:8182/api/healthz >/dev/null 2>&1 && add_row "localhost API health" "pass" "localhost API health endpoint passed" || { add_row "localhost API health" "blocked" "localhost API health endpoint failed"; block_exit; }
curl -fsS -o /dev/null --max-time 5 http://127.0.0.1:8181/healthz >/dev/null 2>&1 && add_row "localhost web health" "pass" "localhost web health endpoint passed" || { add_row "localhost web health" "blocked" "localhost web health endpoint failed"; block_exit; }
public="${ENV_VALUES[APP_PUBLIC_URL]}"
curl -fsS -o /dev/null --max-time 8 "$public/api/healthz" >/dev/null 2>&1 && add_row "public API health" "pass" "public API routing health passed" || { add_row "public API health" "blocked" "public API routing health failed"; block_exit; }
curl -fsS -o /dev/null --max-time 8 "$public/healthz" >/dev/null 2>&1 && add_row "public web health" "pass" "public web routing health passed" || { add_row "public web health" "blocked" "public web routing health failed"; block_exit; }

mapfile -t heads < <(python - <<'PY'
from pathlib import Path
import ast
versions=Path('apps/studio-api/alembic/versions')
revs={}; downs=set()
for path in versions.glob('*.py'):
    tree=ast.parse(path.read_text())
    vals={}
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in {'revision','down_revision'}:
                    vals[target.id]=ast.literal_eval(node.value) if not isinstance(node.value, ast.Constant) or node.value.value is not None else None
    if vals.get('revision'): revs[vals['revision']]=path.name
    d=vals.get('down_revision')
    if isinstance(d, str): downs.add(d)
    elif isinstance(d, (tuple, list)): downs.update(x for x in d if isinstance(x, str))
for h in sorted(set(revs)-downs): print(h)
PY
)
if [[ "${#heads[@]}" -eq 1 && "${heads[0]}" == "$EXPECTED_HEAD" ]]; then add_row "repository Alembic head" "pass" "exactly one repository Alembic head matches expected source head"; else add_row "repository Alembic head" "blocked" "repository Alembic head is missing, multiple, or unexpected"; block_exit; fi
current_raw="$(${compose[@]} exec -T studio-api alembic current </dev/null 2>/dev/null || true)"
mapfile -t currents < <(printf '%s\n' "$current_raw" | sed -nE 's/^([0-9a-zA-Z_]+).*/\1/p' | sed '/^$/d' | sort -u)
if [[ "${#currents[@]}" -eq 1 ]]; then add_row "production Alembic revision" "pass" "exactly one production database revision was reported"; else add_row "production Alembic revision" "blocked" "production database revision is missing, unknown, or multiple"; block_exit; fi
if [[ "${currents[0]}" == "${heads[0]}" ]]; then add_row "revision equality" "pass" "production database revision equals repository head"; else add_row "revision equality" "blocked" "production database revision does not equal repository head"; block_exit; fi
add_account_rows
print_table
echo "STUDIO_PROCESSING_HOST_PREFLIGHT_OK"

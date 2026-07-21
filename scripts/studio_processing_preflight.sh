#!/usr/bin/env bash
set -euo pipefail

PREFIX="[studio-processing-preflight]"
EXPECTED_HEAD="0014_source_deletion_retention"
COMPOSE_FILE="deploy/studio/compose.platform.yml"
ENV_FILE="deploy/studio/.env"
VERSIONS_DIR="apps/studio-api/alembic/versions"
DEPLOY_DIR="${1:-}"
EXPECTED_BRANCH="${2:-}"
EXPECTED_REPO="${3:-}"
EXPECTED_COMMIT="${4:-}"
declare -A ROW_STATUS=()
declare -A ROW_OBS=()
declare -A ENV_VALUES=()
declare -A ENV_SEEN=()
ROWS=(
  "deploy directory identity" "repository remote identity" "branch identity" "commit identity" "tracked working tree"
  "runtime env presence" "runtime setting completeness"
  "POSTGRES_PASSWORD secret-file presence" "CREDENTIAL_MASTER_KEY secret-file presence" "SOURCE_S3_ACCESS_KEY_ID secret-file presence" "SOURCE_S3_SECRET_ACCESS_KEY secret-file presence" "GOOGLE_OAUTH_CLIENT_SECRET secret-file presence"
  "postgres service count/status" "redis service count/status" "studio-api service count/status" "studio-web service count/status" "studio-worker service count/status"
  "PostgreSQL health" "Redis health" "localhost API health" "localhost web health" "public API health" "public web health"
  "repository Alembic head" "production Alembic revision" "revision equality"
  "authenticated smoke-account login" "active Google connection" "exactly one active ElevenLabs BYOK credential" "writable output folder selected" "one small supported source available"
)
for row in "${ROWS[@]}"; do ROW_STATUS[$row]="not-run"; ROW_OBS[$row]="not evaluated because an earlier required check blocked"; done
for row in "authenticated smoke-account login" "active Google connection" "exactly one active ElevenLabs BYOK credential" "writable output folder selected" "one small supported source available"; do ROW_OBS[$row]="separate authenticated operator confirmation is required"; done

set_row() { ROW_STATUS[$1]="$2"; ROW_OBS[$1]="$3"; }
print_table() { echo "check | status | secret-free observation"; echo "--- | --- | ---"; for row in "${ROWS[@]}"; do echo "$row | ${ROW_STATUS[$row]} | ${ROW_OBS[$row]}"; done; }
block_exit() { print_table; echo "STUDIO_PROCESSING_HOST_PREFLIGHT_BLOCKED"; exit 1; }

is_url() {
  local value="$1" require_https="$2"
  [[ "$value" != *[[:space:]]* ]] || return 1
  [[ "$value" != *"'"* && "$value" != *'"'* && "$value" != *"<"* && "$value" != *">"* && "$value" != *"\\"* ]] || return 1
  local https_re='^https://[^[:space:]]+$'
  local http_re='^https?://[^[:space:]]+$'
  if [[ "$require_https" == "true" ]]; then [[ "$value" =~ $https_re ]] || return 1; else [[ "$value" =~ $http_re ]] || return 1; fi
  [[ "$value" == *.* || "$value" == http://localhost* || "$value" == http://127.0.0.1* || "$value" == https://localhost* || "$value" == https://127.0.0.1* ]]
}
is_int() { [[ "$1" =~ ^[0-9]+$ ]]; }
in_range() { local v="$1" min="$2" max="$3"; is_int "$v" && (( v >= min && v <= max )); }
positive_int() { local v="$1"; is_int "$v" && (( v > 0 )); }

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

validate_runtime_values() {
  local required k v
  required=(APP_PUBLIC_URL STUDIO_SOURCE_S3_ENDPOINT_URL STUDIO_SOURCE_S3_REGION STUDIO_SOURCE_S3_BUCKET STUDIO_SOURCE_UPLOAD_TTL_SECONDS STUDIO_SOURCE_PRESIGN_TTL_SECONDS STUDIO_SOURCE_MAX_UPLOAD_BYTES STUDIO_GOOGLE_OAUTH_CLIENT_ID STUDIO_GOOGLE_OAUTH_REDIRECT_URI STUDIO_GOOGLE_OAUTH_SCOPES STUDIO_GOOGLE_OAUTH_STATE_TTL_SECONDS STUDIO_GOOGLE_PICKER_API_KEY STUDIO_GOOGLE_PICKER_APP_ID STUDIO_WORKER_POLL_INTERVAL_SECONDS STUDIO_WORKER_ERROR_BACKOFF_SECONDS STUDIO_WORKER_LEASE_TTL_SECONDS)
  for k in "${required[@]}"; do v="${ENV_VALUES[$k]-}"; [[ -n "$v" && "$v" != __*__ && "$v" != *REQUIRED* && "$v" != *[[:space:]][[:space:]]* ]] || return 1; done
  is_url "${ENV_VALUES[APP_PUBLIC_URL]}" true || return 1
  is_url "${ENV_VALUES[STUDIO_SOURCE_S3_ENDPOINT_URL]}" false || return 1
  is_url "${ENV_VALUES[STUDIO_GOOGLE_OAUTH_REDIRECT_URI]}" true || return 1
  positive_int "${ENV_VALUES[STUDIO_SOURCE_UPLOAD_TTL_SECONDS]}" || return 1
  positive_int "${ENV_VALUES[STUDIO_SOURCE_PRESIGN_TTL_SECONDS]}" || return 1
  positive_int "${ENV_VALUES[STUDIO_SOURCE_MAX_UPLOAD_BYTES]}" || return 1
  positive_int "${ENV_VALUES[STUDIO_GOOGLE_OAUTH_STATE_TTL_SECONDS]}" || return 1
  in_range "${ENV_VALUES[STUDIO_WORKER_POLL_INTERVAL_SECONDS]}" 1 60 || return 1
  in_range "${ENV_VALUES[STUDIO_WORKER_ERROR_BACKOFF_SECONDS]}" 1 300 || return 1
  in_range "${ENV_VALUES[STUDIO_WORKER_LEASE_TTL_SECONDS]}" 300 86400 || return 1
  local heartbeat_interval="${ENV_VALUES[STUDIO_WORKER_LEASE_HEARTBEAT_INTERVAL_SECONDS]-60}"
  in_range "$heartbeat_interval" 5 28800 || return 1
  (( heartbeat_interval * 3 <= ENV_VALUES[STUDIO_WORKER_LEASE_TTL_SECONDS] )) || return 1
}

service_status() {
  local svc="$1" ids count=0 running=0 any_unhealthy=false any_unknown=false any_healthy=false id state hs status
  ids="$(${compose[@]} ps -a -q "$svc" 2>/dev/null || true)"
  while IFS= read -r id; do
    [[ -n "$id" ]] || continue
    count=$((count+1))
    state="$(docker inspect --format '{{.State.Status}}' "$id" 2>/dev/null || true)"
    hs="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id" 2>/dev/null || true)"
    [[ "$state" == "running" ]] && running=$((running+1))
    case "$hs" in healthy) any_healthy=true ;; unhealthy) any_unhealthy=true ;; none) ;; *) any_unknown=true ;; esac
    [[ -n "$state" ]] || any_unknown=true
  done <<<"$ids"
  if (( count == 0 )); then status="missing"; elif [[ "$any_unhealthy" == true ]]; then status="unhealthy"; elif [[ "$any_unknown" == true ]]; then status="unknown"; elif [[ "$any_healthy" == true && "$running" -eq "$count" ]]; then status="healthy"; elif (( running > 0 )); then status="running"; else status="stopped"; fi
  printf '%s:%s:%s\n' "$count" "$running" "$status"
}

echo "$PREFIX starting read-only host preflight"
[[ -n "$DEPLOY_DIR" && -n "$EXPECTED_BRANCH" && -n "$EXPECTED_REPO" && -n "$EXPECTED_COMMIT" ]] || { set_row "deploy directory identity" "blocked" "required invocation arguments are missing"; block_exit; }
[[ "$EXPECTED_COMMIT" =~ ^[0-9a-fA-F]{40}$ ]] || { set_row "commit identity" "blocked" "expected commit must be a 40-character hexadecimal SHA"; block_exit; }
actual_dir="$(pwd -P 2>/dev/null || true)"; expected_dir="$(cd "$DEPLOY_DIR" 2>/dev/null && pwd -P || true)"
if [[ -n "$expected_dir" && "$actual_dir" == "$expected_dir" && "$expected_dir" == "$DEPLOY_DIR" ]]; then set_row "deploy directory identity" "pass" "current directory matches the documented production checkout"; else set_row "deploy directory identity" "blocked" "current directory is not the documented production checkout"; block_exit; fi
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
remote="$(git config --get remote.origin.url 2>/dev/null || true)"
head="$(git rev-parse HEAD 2>/dev/null || true)"
case "$remote" in git@github.com:${EXPECTED_REPO}.git|git@github.com:${EXPECTED_REPO}|https://github.com/${EXPECTED_REPO}.git) set_row "repository remote identity" "pass" "origin remote matches an accepted repository form" ;; *) set_row "repository remote identity" "blocked" "origin remote does not match an accepted repository form"; block_exit ;; esac
[[ "$branch" == "$EXPECTED_BRANCH" ]] && set_row "branch identity" "pass" "current branch matches expected branch" || { set_row "branch identity" "blocked" "current branch does not match expected branch"; block_exit; }
[[ "$head" == "$EXPECTED_COMMIT" ]] && set_row "commit identity" "pass" "HEAD matches expected commit" || { set_row "commit identity" "blocked" "HEAD does not match expected commit"; block_exit; }
status="$(git status --porcelain --untracked-files=no 2>/dev/null || true)"
[[ -z "$status" ]] && set_row "tracked working tree" "pass" "tracked working tree is clean" || { set_row "tracked working tree" "blocked" "tracked working tree is not clean"; block_exit; }

[[ -f "$ENV_FILE" && -f "$COMPOSE_FILE" && -d "$VERSIONS_DIR" && -f "apps/studio-api/Dockerfile" && -f "apps/studio/Dockerfile" ]] || { set_row "runtime env presence" "blocked" "required runtime or inspection files are missing"; block_exit; }
set_row "runtime env presence" "pass" "required runtime and inspection files are present"
parse_env || { set_row "runtime setting completeness" "blocked" "runtime env contains malformed or duplicate required syntax"; block_exit; }
validate_runtime_values || { set_row "runtime setting completeness" "blocked" "required runtime settings are missing, malformed, or outside approved ranges"; block_exit; }
set_row "runtime setting completeness" "pass" "required non-secret runtime settings are present and valid"
for k in STUDIO_POSTGRES_PASSWORD_FILE STUDIO_CREDENTIAL_MASTER_KEY_FILE STUDIO_SOURCE_S3_ACCESS_KEY_ID_FILE STUDIO_SOURCE_S3_SECRET_ACCESS_KEY_FILE STUDIO_GOOGLE_OAUTH_CLIENT_SECRET_FILE; do
  v="${ENV_VALUES[$k]-}"; label="${k#STUDIO_}"; label="${label%_FILE} secret-file presence"
  if [[ -z "$v" || "$v" == __*__ || "$v" == *REQUIRED* || "$v" == *[[:space:]]* || ! -f "$v" ]]; then set_row "$label" "blocked" "required secret file is not present"; block_exit; else set_row "$label" "pass" "required secret file is present"; fi
done

compose=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
declare -A SCOUNT SRUN SSTATUS
for svc in postgres redis studio-api studio-web studio-worker; do IFS=: read -r c r s < <(service_status "$svc"); SCOUNT[$svc]="$c"; SRUN[$svc]="$r"; SSTATUS[$svc]="$s"; set_row "$svc service count/status" "pass" "total count ${c}; running count ${r}; status ${s}"; done
[[ "${SRUN[studio-worker]}" == "0" ]] || { set_row "studio-worker service count/status" "blocked" "total count ${SCOUNT[studio-worker]}; studio-worker running count is not zero"; block_exit; }
[[ "${SSTATUS[postgres]}" == "healthy" ]] && set_row "PostgreSQL health" "pass" "postgres service is healthy" || { set_row "PostgreSQL health" "blocked" "postgres service is not healthy"; block_exit; }
[[ "${SSTATUS[redis]}" == "healthy" ]] && set_row "Redis health" "pass" "redis service is healthy" || { set_row "Redis health" "blocked" "redis service is not healthy"; block_exit; }
[[ "${SSTATUS[studio-api]}" == "healthy" ]] || { set_row "localhost API health" "blocked" "studio-api is not healthy before localhost check"; block_exit; }
[[ "${SSTATUS[studio-web]}" == "healthy" ]] || { set_row "localhost web health" "blocked" "studio-web is not healthy before localhost check"; block_exit; }
curl -fsS -o /dev/null --max-time 5 http://127.0.0.1:8182/api/healthz >/dev/null 2>&1 && set_row "localhost API health" "pass" "localhost API health endpoint passed" || { set_row "localhost API health" "blocked" "localhost API health endpoint failed"; block_exit; }
curl -fsS -o /dev/null --max-time 5 http://127.0.0.1:8181/healthz >/dev/null 2>&1 && set_row "localhost web health" "pass" "localhost web health endpoint passed" || { set_row "localhost web health" "blocked" "localhost web health endpoint failed"; block_exit; }
public="${ENV_VALUES[APP_PUBLIC_URL]}"
curl -fsS -o /dev/null --max-time 8 "$public/api/healthz" >/dev/null 2>&1 && set_row "public API health" "pass" "public API routing health passed" || { set_row "public API health" "blocked" "public API routing health failed"; block_exit; }
curl -fsS -o /dev/null --max-time 8 "$public/healthz" >/dev/null 2>&1 && set_row "public web health" "pass" "public web routing health passed" || { set_row "public web health" "blocked" "public web routing health failed"; block_exit; }

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
[[ "${#heads[@]}" -eq 1 && "${heads[0]}" == "$EXPECTED_HEAD" ]] && set_row "repository Alembic head" "pass" "exactly one repository Alembic head matches expected source head" || { set_row "repository Alembic head" "blocked" "repository Alembic head is missing, multiple, or unexpected"; block_exit; }
current_raw="$(${compose[@]} exec -T studio-api alembic current </dev/null 2>/dev/null || true)"
mapfile -t currents < <(printf '%s\n' "$current_raw" | sed -nE 's/^([0-9a-zA-Z_]+).*/\1/p' | sed '/^$/d' | sort -u)
[[ "${#currents[@]}" -eq 1 ]] && set_row "production Alembic revision" "pass" "exactly one production database revision was reported" || { set_row "production Alembic revision" "blocked" "production database revision is missing, unknown, or multiple"; block_exit; }
[[ "${currents[0]}" == "${heads[0]}" ]] && set_row "revision equality" "pass" "production database revision equals repository head" || { set_row "revision equality" "blocked" "production database revision does not equal repository head"; block_exit; }
print_table
echo "STUDIO_PROCESSING_HOST_PREFLIGHT_OK"

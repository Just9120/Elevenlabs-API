#!/usr/bin/env bash
set -euo pipefail

EXPECTED_DIR="${STUDIO_DEPLOY_DIR:-$(pwd)}"
COMPOSE_FILE="deploy/studio/compose.platform.yml"
ENV_FILE="deploy/studio/.env"
WORKER_SERVICE="studio-worker"
ROLLBACK_TAG="elevenlabs-studio-worker:rollback-candidate"
BUFFER_SECONDS="${STUDIO_WORKER_DRAIN_BUFFER_SECONDS:-60}"

log() { printf '[studio-worker-ops] %s\n' "$*"; }
fail() { printf '[studio-worker-ops] ERROR: %s\n' "$*" >&2; exit 1; }
compose() { docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }

require_runtime() {
  cd "$EXPECTED_DIR"
  [[ -f "$ENV_FILE" && -f "$COMPOSE_FILE" ]] || fail "missing compose or env file"
}

container_id_any() { compose ps -a -q "$WORKER_SERVICE" 2>/dev/null | head -n1 || true; }
container_id_running() { compose ps -q "$WORKER_SERVICE" 2>/dev/null | head -n1 || true; }
inspect_field() { docker inspect --format "$1" "$2" 2>/dev/null || true; }
health_of() { local id="$1"; [[ -z "$id" ]] && { echo not-applicable; return; }; inspect_field '{{if .State.Health}}{{.State.Health.Status}}{{else}}not-applicable{{end}}' "$id"; }
state_of() { local id="$1"; [[ -z "$id" ]] && { echo absent; return; }; inspect_field '{{.State.Status}}' "$id"; }
image_of() { local id="$1"; [[ -z "$id" ]] && { echo unavailable; return; }; inspect_field '{{.Image}}' "$id"; }
rollback_present() { docker image inspect "$ROLLBACK_TAG" >/dev/null 2>&1 && echo present || echo absent; }
current_commit_tag() { local head; head="$(git rev-parse HEAD 2>/dev/null || true)"; [[ -n "$head" ]] && echo "elevenlabs-studio-worker:$head" || echo unavailable; }

wait_healthy() {
  local expected_image="$1" id hs running
  for _ in $(seq 1 60); do
    id="$(container_id_running)"
    if [[ -n "$id" ]]; then
      running="$(image_of "$id")"
      [[ "$running" == "$expected_image" ]] || fail "running image identity mismatch"
      hs="$(health_of "$id")"
      [[ "$hs" == healthy ]] && return 0
      [[ "$hs" == unhealthy ]] && fail "worker health is unhealthy"
    fi
    sleep 2
  done
  fail "worker did not become healthy"
}

drain_timeout() {
  local ttl="${STUDIO_WORKER_LEASE_TTL_SECONDS:-}"
  if [[ -z "$ttl" && -f "$ENV_FILE" ]]; then
    ttl="$(sed -n 's/^STUDIO_WORKER_LEASE_TTL_SECONDS=//p' "$ENV_FILE" | tail -n1)"
  fi
  [[ "$ttl" =~ ^[0-9]+$ ]] || ttl=3600
  echo $((ttl + BUFFER_SECONDS))
}

cmd_status() {
  require_runtime
  local id state health image tag rollback
  id="$(container_id_any)"; state="$(state_of "$id")"; health="$(health_of "$id")"; image="$(image_of "$id")"; tag="$(current_commit_tag)"; rollback="$(rollback_present)"
  [[ "$state" == exited || "$state" == created || "$state" == absent ]] && paused="stopped/drained" || paused="not-paused"
  printf 'container=%s\nhealth=%s\nrunning_image=%s\nintended_identity=%s\nrollback_candidate=%s\npaused_state=%s\n' "$state" "$health" "$image" "$tag" "$rollback" "$paused"
  echo STUDIO_WORKER_STATUS_OK
}

cmd_drain() {
  require_runtime
  local id running before after code timeout
  running="$(container_id_running)"
  if [[ -z "$running" ]]; then
    echo STUDIO_WORKER_DRAINED
    return 0
  fi
  timeout="$(drain_timeout)"
  before="$(image_of "$running")"
  log "sending SIGTERM via docker stop with timeout ${timeout}s"
  docker stop --time "$timeout" "$running" >/dev/null
  after="$(state_of "$running")"
  code="$(inspect_field '{{.State.ExitCode}}' "$running")"
  [[ "$after" != running ]] || fail "STUDIO_WORKER_DRAIN_BLOCKED reason=still_running"
  if [[ "$code" == "137" || "$code" == "143" && "$after" == "running" ]]; then
    fail "STUDIO_WORKER_DRAIN_BLOCKED reason=forced_kill lease_output_reconciliation_review_required"
  fi
  [[ "$before" == "$(image_of "$running")" ]] || fail "worker image changed during drain"
  echo STUDIO_WORKER_DRAINED
}

cmd_pause() { cmd_drain; echo STUDIO_WORKER_PAUSED; }

cmd_resume() {
  require_runtime
  local id state image
  id="$(container_id_any)"; [[ -n "$id" ]] || fail "worker container absent; use official worker deploy path"
  state="$(state_of "$id")"; [[ "$state" != running ]] || fail "worker already running"
  image="$(image_of "$id")"; [[ -n "$image" && "$image" != unavailable ]] || fail "stopped worker image identity unavailable"
  docker start "$id" >/dev/null
  wait_healthy "$image"
  echo STUDIO_WORKER_RESUMED
}

revision_of_image() { compose run --rm --no-deps -T --entrypoint alembic "$1" heads </dev/null 2>/dev/null | awk '$1 ~ /^[[:alnum:]_]+$/ {print $1; exit}'; }
current_revision() { compose run --rm --no-deps -T --entrypoint alembic studio-api current </dev/null 2>/dev/null | awk '$1 ~ /^[[:alnum:]_]+$/ {print $1; exit}'; }

cmd_rollback() {
  require_runtime
  local id state rollback_image current head new_id running
  id="$(container_id_any)"; state="$(state_of "$id")"; [[ "$state" != running ]] || fail "drain/stop worker before rollback"
  docker image inspect "$ROLLBACK_TAG" >/dev/null 2>&1 || fail "rollback candidate missing"
  rollback_image="$(docker image inspect --format '{{.Id}}' "$ROLLBACK_TAG")"; [[ -n "$rollback_image" ]] || fail "rollback image identity missing"
  docker tag "$ROLLBACK_TAG" elevenlabs-studio-api:local
  current="$(current_revision)"; head="$(revision_of_image "$WORKER_SERVICE")"
  [[ -n "$current" && -n "$head" && "$current" == "$head" ]] || fail "schema mismatch; downgrade is not allowed"
  compose up -d --no-deps --force-recreate "$WORKER_SERVICE"
  new_id="$(container_id_running)"; running="$(image_of "$new_id")"
  [[ "$running" == "$rollback_image" ]] || fail "running rollback image identity mismatch"
  wait_healthy "$rollback_image"
  echo STUDIO_WORKER_ROLLBACK_OK
}

case "${1:-}" in
  status) cmd_status ;;
  drain) cmd_drain ;;
  pause) cmd_pause ;;
  resume) cmd_resume ;;
  rollback) cmd_rollback ;;
  *) fail "usage: $0 status|drain|pause|resume|rollback" ;;
esac

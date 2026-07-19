#!/usr/bin/env bash
set -euo pipefail

EXPECTED_DIR="${STUDIO_DEPLOY_DIR:-$(pwd)}"
COMPOSE_FILE="deploy/studio/compose.platform.yml"
ENV_FILE="deploy/studio/.env"
WORKER_SERVICE="studio-worker"
WORKER_LOCAL_TAG="elevenlabs-studio-worker:local"
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
exit_code_of() { local id="$1"; [[ -z "$id" ]] && { echo unavailable; return; }; inspect_field '{{.State.ExitCode}}' "$id"; }
image_of() { local id="$1"; [[ -z "$id" ]] && { echo unavailable; return; }; inspect_field '{{.Image}}' "$id"; }
image_id_of() { docker image inspect --format '{{.Id}}' "$1" 2>/dev/null || true; }
image_exists() { docker image inspect "$1" >/dev/null 2>&1; }
rollback_present() { image_exists "$ROLLBACK_TAG" && echo present || echo absent; }

commit_tag_name() {
  local head
  head="$(git rev-parse HEAD 2>/dev/null || true)"
  [[ -n "$head" ]] && echo "elevenlabs-studio-worker:$head" || echo unavailable
}

drain_state_for() {
  local state="$1" code="$2"
  case "$state" in
    absent) echo absent ;;
    running|restarting) echo running ;;
    exited) [[ "$code" == "0" ]] && echo gracefully-drained || echo abnormal-exit ;;
    created) echo created-not-started ;;
    *) echo unknown ;;
  esac
}

require_gracefully_drained_or_absent() {
  local id state code dstate
  id="$(container_id_any)"
  [[ -z "$id" ]] && return 0
  state="$(state_of "$id")"; code="$(exit_code_of "$id")"; dstate="$(drain_state_for "$state" "$code")"
  [[ "$dstate" == gracefully-drained ]] || fail "worker previous exit was abnormal; operator review required"
}

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

blocked_for_exit() {
  case "$1" in
    137) echo "STUDIO_WORKER_DRAIN_BLOCKED reason=forced_kill lease_output_reconciliation_review_required" ;;
    143) echo "STUDIO_WORKER_DRAIN_BLOCKED reason=signal_terminated lease_output_reconciliation_review_required" ;;
    *) echo "STUDIO_WORKER_DRAIN_BLOCKED reason=abnormal_exit lease_output_reconciliation_review_required" ;;
  esac
}

cmd_status() {
  require_runtime
  local id state code health image tag tag_state commit_image identity rollback dstate
  id="$(container_id_any)"
  state="$(state_of "$id")"; code="$(exit_code_of "$id")"; health="$(health_of "$id")"; image="$(image_of "$id")"
  tag="$(commit_tag_name)"; commit_image="unavailable"; tag_state="absent"; identity="unknown"
  if [[ "$tag" != unavailable ]] && image_exists "$tag"; then
    tag_state="present"
    commit_image="$(image_id_of "$tag")"
  fi
  if [[ "$image" != unavailable && "$commit_image" != unavailable ]]; then
    [[ "$image" == "$commit_image" ]] && identity="yes" || identity="no"
  fi
  rollback="$(rollback_present)"; dstate="$(drain_state_for "$state" "$code")"
  printf 'container_state=%s\nexit_code=%s\ndrain_state=%s\nhealth=%s\nrunning_image_id=%s\ncommit_tag=%s\ncommit_tag_state=%s\ncommit_image_id=%s\nidentity_match=%s\nrollback_candidate=%s\n' "$state" "$code" "$dstate" "$health" "$image" "$tag" "$tag_state" "$commit_image" "$identity" "$rollback"
  echo STUDIO_WORKER_STATUS_OK
}

cmd_drain() {
  require_runtime
  local running before after code timeout reason
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
  code="$(exit_code_of "$running")"
  [[ "$after" != running && "$after" != restarting ]] || fail "STUDIO_WORKER_DRAIN_BLOCKED reason=still_running lease_output_reconciliation_review_required"
  [[ "$before" == "$(image_of "$running")" ]] || fail "worker image changed during drain"
  if [[ "$code" != "0" ]]; then
    reason="$(blocked_for_exit "$code")"
    fail "$reason"
  fi
  echo STUDIO_WORKER_DRAINED
}

cmd_pause() { cmd_drain; echo STUDIO_WORKER_PAUSED; }

cmd_resume() {
  require_runtime
  local id state code image
  id="$(container_id_any)"; [[ -n "$id" ]] || fail "worker container absent; use official worker deploy path"
  state="$(state_of "$id")"; code="$(exit_code_of "$id")"
  [[ "$state" != running && "$state" != restarting ]] || fail "worker already running"
  [[ "$state" == exited && "$code" == "0" ]] || fail "worker previous exit was abnormal; operator review required"
  image="$(image_of "$id")"; [[ -n "$image" && "$image" != unavailable ]] || fail "stopped worker image identity unavailable"
  docker start "$id" >/dev/null
  wait_healthy "$image"
  echo STUDIO_WORKER_RESUMED
}

capture_revision_ids() { awk '$1 ~ /^[[:alnum:]_]+$/ && (NF == 1 || $2 ~ /^\(/) {print $1}'; }
require_one_revision() { local label="$1"; shift; [[ "$#" -eq 1 && -n "${1:-}" ]] || fail "schema check failed: expected exactly one $label revision"; }
rollback_head_revision() { docker run --rm --entrypoint alembic "$ROLLBACK_TAG" heads </dev/null 2>/dev/null | capture_revision_ids; }
current_revision() { compose run --rm --no-deps -T --entrypoint alembic studio-api current </dev/null 2>/dev/null | capture_revision_ids; }

cmd_rollback() {
  require_runtime
  require_gracefully_drained_or_absent
  local rollback_image current head new_id running
  image_exists "$ROLLBACK_TAG" || fail "rollback candidate missing"
  rollback_image="$(image_id_of "$ROLLBACK_TAG")"; [[ -n "$rollback_image" ]] || fail "rollback image identity missing"
  mapfile -t head_revisions < <(rollback_head_revision)
  require_one_revision "rollback image Alembic head" "${head_revisions[@]}"
  head="${head_revisions[0]}"
  mapfile -t current_revisions < <(current_revision)
  require_one_revision "current database" "${current_revisions[@]}"
  current="${current_revisions[0]}"
  [[ "$current" == "$head" ]] || fail "schema mismatch; downgrade is not allowed"
  docker tag "$ROLLBACK_TAG" "$WORKER_LOCAL_TAG" || fail "could not prepare worker rollback image"
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

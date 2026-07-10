#!/usr/bin/env bash
set -euo pipefail

EXPECTED_REMOTE="${EXPECTED_REMOTE:-git@github.com:Just9120/Elevenlabs-API.git}"
EXPECTED_BRANCH="${EXPECTED_BRANCH:-main}"
EXPECTED_DIR="${STUDIO_DEPLOY_DIR:?STUDIO_DEPLOY_DIR is required}"
COMPOSE_FILE="deploy/studio/compose.platform.yml"
ENV_FILE="deploy/studio/.env"

log() { printf '[studio-platform-component-deploy] %s\n' "$*"; }
fail() { printf '[studio-platform-component-deploy] ERROR: %s\n' "$*" >&2; exit 1; }

[[ "$#" -eq 1 ]] || fail "expected exactly one component argument: web or api"
case "$1" in
  web)
    SERVICE="studio-web"
    IMAGE_REF="elevenlabs-studio-web:local"
    HEALTH_URL="http://127.0.0.1:8181/healthz"
    SUCCESS_MARKER="STUDIO_PLATFORM_WEB_DEPLOY_OK"
    ;;
  api)
    SERVICE="studio-api"
    IMAGE_REF="elevenlabs-studio-api:local"
    HEALTH_URL="http://127.0.0.1:8182/api/healthz"
    SUCCESS_MARKER="STUDIO_PLATFORM_API_DEPLOY_OK"
    ;;
  *)
    fail "unsupported component '$1'; expected web or api"
    ;;
esac

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

require_file() {
  [[ -f "$1" ]] || fail "missing required file: $1"
}

require_service_healthy() {
  local service="$1"
  local container_id health
  container_id="$(compose ps -q "$service")"
  [[ -n "$container_id" ]] || fail "$service must already be running and healthy; manual stateful maintenance required"
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")"
  [[ "$health" == "healthy" ]] || fail "$service must already be healthy before API deployment; observed status: $health"
}

capture_revision_ids() {
  awk '$1 ~ /^[[:alnum:]_]+$/ && (NF == 1 || $2 ~ /^\(/) {print $1}'
}

require_exactly_one_revision() {
  local label="$1"
  shift
  local revisions=("$@")
  if [[ "${#revisions[@]}" -ne 1 ]]; then
    fail "manual migration required: expected exactly one $label revision, found ${#revisions[@]}"
  fi
  [[ -n "${revisions[0]}" ]] || fail "manual migration required: $label revision is empty"
}

verify_database_revision_matches_new_image() {
  log "verifying stateful dependencies are already healthy"
  require_service_healthy postgres
  require_service_healthy redis

  log "comparing database revision with Alembic head from the newly built API image"
  local -a head_revisions current_revisions
  mapfile -t head_revisions < <(compose run --rm --no-deps -T --entrypoint alembic studio-api heads </dev/null 2>/dev/null | capture_revision_ids)
  require_exactly_one_revision "Alembic head" "${head_revisions[@]}"
  local head_revision="${head_revisions[0]}"

  mapfile -t current_revisions < <(compose run --rm --no-deps -T --entrypoint alembic studio-api current </dev/null 2>/dev/null | capture_revision_ids)
  require_exactly_one_revision "current database" "${current_revisions[@]}"
  local current_revision="${current_revisions[0]}"

  [[ "$current_revision" == "$head_revision" ]] || fail "manual migration required: database revision ($current_revision) does not match API image Alembic head ($head_revision)"
}

inspect_image_id() {
  local image_ref="$1" image_id
  if ! image_id="$(docker image inspect --format '{{.Id}}' "$image_ref")"; then
    fail "could not inspect built image identity for $SERVICE"
  fi
  [[ -n "$image_id" ]] || fail "built image identity for $SERVICE is empty"
  printf '%s\n' "$image_id"
}

verify_running_image_identity() {
  local expected_image_id="$1" container_id running_image_id

  log "verifying running $SERVICE image identity"
  container_id="$(compose ps -q "$SERVICE")"
  [[ -n "$container_id" ]] || fail "$SERVICE container is not running after forced recreation"

  if ! running_image_id="$(docker inspect --format '{{.Image}}' "$container_id")"; then
    fail "could not inspect running image identity for $SERVICE"
  fi
  [[ -n "$running_image_id" ]] || fail "running image identity for $SERVICE is empty"

  [[ "$running_image_id" == "$expected_image_id" ]] || fail "running $SERVICE image identity ($running_image_id) does not match built image identity ($expected_image_id)"
}

poll_health() {
  log "checking localhost health: $HEALTH_URL"
  for _ in $(seq 1 30); do
    if curl -fsS "$HEALTH_URL" >/dev/null; then
      echo "$SUCCESS_MARKER"
      return 0
    fi
    sleep 2
  done
  fail "health check failed for $SERVICE; no automatic rollback attempted"
}

[[ "$(pwd -P)" == "$(cd "$EXPECTED_DIR" && pwd -P)" ]] || fail "must run inside STUDIO_DEPLOY_DIR"
[[ "$(git rev-parse --abbrev-ref HEAD)" == "$EXPECTED_BRANCH" ]] || fail "unexpected branch"
remote_url="$(git config --get remote.origin.url)"
[[ "$remote_url" == "$EXPECTED_REMOTE" || "$remote_url" == "git@github.com:Just9120/Elevenlabs-API" || "$remote_url" == "https://github.com/Just9120/Elevenlabs-API.git" ]] || fail "unexpected remote"
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || fail "tracked working tree is not clean"
require_file "$ENV_FILE"
require_file "$COMPOSE_FILE"
require_file apps/studio/Dockerfile
require_file apps/studio-api/Dockerfile
require_file apps/studio-api/alembic.ini
[[ -d apps/studio-api/alembic/versions ]] || fail "missing Alembic versions directory"
grep -q '^  studio-web:' "$COMPOSE_FILE" || fail "compose missing studio-web service"
grep -q '^  studio-api:' "$COMPOSE_FILE" || fail "compose missing studio-api service"
grep -q '^  postgres:' "$COMPOSE_FILE" || fail "compose missing postgres service"
grep -q '^  redis:' "$COMPOSE_FILE" || fail "compose missing redis service"
grep -q '127.0.0.1:8181:8080' "$COMPOSE_FILE" || fail "studio-web must bind localhost-only 8181"
grep -q '127.0.0.1:8182:8000' "$COMPOSE_FILE" || fail "studio-api must bind localhost-only 8182"

git fetch --prune origin "$EXPECTED_BRANCH"
git merge --ff-only "origin/$EXPECTED_BRANCH"
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || fail "tracked working tree changed unexpectedly"

log "building only $SERVICE"
compose build "$SERVICE"

log "capturing built image identity for $SERVICE"
BUILT_IMAGE_ID="$(inspect_image_id "$IMAGE_REF")"

if [[ "$SERVICE" == "studio-api" ]]; then
  verify_database_revision_matches_new_image
fi

log "force-recreating only $SERVICE without dependencies"
compose up -d --no-deps --force-recreate "$SERVICE"
verify_running_image_identity "$BUILT_IMAGE_ID"
poll_health

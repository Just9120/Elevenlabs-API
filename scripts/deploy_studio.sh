#!/usr/bin/env bash
set -euo pipefail

EXPECTED_REMOTE="${EXPECTED_REMOTE:-git@github.com:Just9120/Elevenlabs-API.git}"
EXPECTED_BRANCH="${EXPECTED_BRANCH:-main}"
EXPECTED_DIR="${STUDIO_DEPLOY_DIR:?STUDIO_DEPLOY_DIR is required}"
COMPOSE_FILE="deploy/studio/compose.prod.yml"
SERVICE="studio-web"

log() { printf '[studio-deploy] %s\n' "$*"; }
fail() { printf '[studio-deploy] ERROR: %s\n' "$*" >&2; exit 1; }

[[ "$(pwd -P)" == "$(cd "$EXPECTED_DIR" && pwd -P)" ]] || fail "must run inside STUDIO_DEPLOY_DIR"
[[ "$(git rev-parse --abbrev-ref HEAD)" == "$EXPECTED_BRANCH" ]] || fail "unexpected branch"
remote_url="$(git config --get remote.origin.url)"
[[ "$remote_url" == "$EXPECTED_REMOTE" || "$remote_url" == "git@github.com:Just9120/Elevenlabs-API" || "$remote_url" == "https://github.com/Just9120/Elevenlabs-API.git" ]] || fail "unexpected remote"
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || fail "tracked working tree is not clean"
[[ -f "$COMPOSE_FILE" ]] || fail "missing compose file"
[[ -f deploy/studio/.env ]] || fail "missing deploy/studio/.env runtime file"
[[ -f apps/studio/package-lock.json && -f apps/studio/Dockerfile ]] || fail "missing Studio runtime files"
grep -q '^  studio-web:' "$COMPOSE_FILE" || fail "compose service identity mismatch"
grep -q '127.0.0.1:8181:8080' "$COMPOSE_FILE" || fail "compose must bind localhost-only 8181"
grep -q '^APP_PUBLIC_URL=https://studio.librechat.online$' deploy/studio/.env || fail "APP_PUBLIC_URL must be configured for studio.librechat.online"

log "fetching origin safely"
git fetch --prune origin "$EXPECTED_BRANCH"
git merge --ff-only "origin/$EXPECTED_BRANCH"
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || fail "tracked working tree changed unexpectedly"

log "building and restarting only $SERVICE"
docker compose --env-file deploy/studio/.env -f "$COMPOSE_FILE" build "$SERVICE"
docker compose --env-file deploy/studio/.env -f "$COMPOSE_FILE" up -d --no-deps "$SERVICE"

log "checking localhost health"
for _ in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:8181/healthz >/dev/null; then
    echo "STUDIO_DEPLOY_OK"
    exit 0
  fi
  sleep 2
done
fail "health check failed"

#!/usr/bin/env bash
set -euo pipefail
DEPLOY_DIR="${STUDIO_DEPLOY_DIR:-$(pwd)}"
cd "$DEPLOY_DIR"
test -f deploy/studio/.env
test -f deploy/studio/compose.platform.yml

set -a
# shellcheck disable=SC1091
source deploy/studio/.env
set +a
export STUDIO_POSTGRES_PASSWORD="$(<"${STUDIO_POSTGRES_PASSWORD_FILE:?}")"
docker compose --env-file deploy/studio/.env -f deploy/studio/compose.platform.yml config >/dev/null
docker compose --env-file deploy/studio/.env -f deploy/studio/compose.platform.yml up -d --build studio-web studio-api postgres redis

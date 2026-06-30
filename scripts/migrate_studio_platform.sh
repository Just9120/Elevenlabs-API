#!/usr/bin/env bash
set -euo pipefail
: "${STUDIO_DEPLOY_DIR:?set deployment checkout path}"
: "${STUDIO_PRE_MIGRATION_BACKUP_CONFIRMED:?set to yes after tagged pre-migration backup}"
if [[ "$STUDIO_PRE_MIGRATION_BACKUP_CONFIRMED" != "yes" ]]; then echo "Refusing migration without pre-migration backup confirmation" >&2; exit 2; fi
cd "$STUDIO_DEPLOY_DIR"

set -a
# shellcheck disable=SC1091
source deploy/studio/.env
set +a
export STUDIO_POSTGRES_PASSWORD="$(<"${STUDIO_POSTGRES_PASSWORD_FILE:?}")"
docker compose --env-file deploy/studio/.env -f deploy/studio/compose.platform.yml run --rm studio-api alembic -c /app/alembic.ini upgrade head

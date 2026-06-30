#!/usr/bin/env bash
set -euo pipefail
umask 077
LOCK_FILE="${STUDIO_BACKUP_LOCK_FILE:-/tmp/studio-postgres-backup.lock}"
exec 9>"$LOCK_FILE"
flock -n 9 || { echo "backup already running" >&2; exit 1; }
: "${STUDIO_BACKUP_TAG:=scheduled}"
: "${RESTIC_REPOSITORY:?set S3-compatible R2 restic repository}"
: "${RESTIC_PASSWORD_FILE:?set restic password file}"
: "${AWS_ACCESS_KEY_ID_FILE:?set R2 access key file}"
: "${AWS_SECRET_ACCESS_KEY_FILE:?set R2 secret key file}"
: "${STUDIO_DEPLOY_DIR:?set deployment checkout path}"
export AWS_ACCESS_KEY_ID; AWS_ACCESS_KEY_ID="$(<"$AWS_ACCESS_KEY_ID_FILE")"
export AWS_SECRET_ACCESS_KEY; AWS_SECRET_ACCESS_KEY="$(<"$AWS_SECRET_ACCESS_KEY_FILE")"
TMPDIR="$(mktemp -d)"; trap 'rm -rf "$TMPDIR"' EXIT
DUMP="$TMPDIR/studio-postgres.dump"
cd "$STUDIO_DEPLOY_DIR"
docker compose --env-file deploy/studio/.env -f deploy/studio/compose.platform.yml exec -T postgres pg_dump -U studio -d studio --format=custom --no-owner --file=/tmp/studio-postgres.dump
docker compose --env-file deploy/studio/.env -f deploy/studio/compose.platform.yml cp postgres:/tmp/studio-postgres.dump "$DUMP" >/dev/null
docker compose --env-file deploy/studio/.env -f deploy/studio/compose.platform.yml exec -T postgres rm -f /tmp/studio-postgres.dump
restic --password-file "$RESTIC_PASSWORD_FILE" backup --tag studio-postgres --tag "$STUDIO_BACKUP_TAG" "$DUMP"
if [[ "$STUDIO_BACKUP_TAG" == "scheduled" ]]; then
  restic --password-file "$RESTIC_PASSWORD_FILE" forget --tag studio-postgres --tag scheduled --keep-within 7d --keep-daily 30 --keep-monthly 12
fi
echo "studio postgres backup completed tag=$STUDIO_BACKUP_TAG"

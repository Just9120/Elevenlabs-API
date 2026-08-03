#!/usr/bin/env bash
set -euo pipefail

PREFIX="[studio-platform-migration]"
COMPOSE_FILE="deploy/studio/compose.platform.yml"
ENV_FILE="deploy/studio/.env"
API_IMAGE="elevenlabs-studio-api:local"

fail() {
  printf '%s BLOCKED reason=%s\n' "$PREFIX" "$1" >&2
  exit 2
}

capture_revision_ids() {
  awk '$1 ~ /^[[:alnum:]_]+$/ && (NF == 1 || $2 ~ /^\(/) {print $1}'
}

probe_revision() {
  local command="$1"
  local raw
  if ! raw="$(
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" \
      run --rm --no-deps -T studio-api \
      alembic -c /app/alembic.ini "$command" </dev/null 2>/dev/null
  )"; then
    fail "${command}_probe_failed"
  fi

  local -a revisions
  mapfile -t revisions < <(printf '%s\n' "$raw" | capture_revision_ids)
  [[ "${#revisions[@]}" -eq 1 ]] || fail "${command}_revision_count"
  [[ -n "${revisions[0]}" ]] || fail "${command}_revision_empty"
  printf '%s\n' "${revisions[0]}"
}

: "${STUDIO_DEPLOY_DIR:?set deployment checkout path}"
: "${STUDIO_PRE_MIGRATION_BACKUP_CONFIRMED:?set to yes after tagged pre-migration backup}"
: "${STUDIO_PRE_MIGRATION_BACKUP_SNAPSHOT:?set verified pre-migration restic snapshot ID}"
: "${STUDIO_EXPECTED_MIGRATION_FROM:?set expected current database revision}"
: "${STUDIO_EXPECTED_MIGRATION_TO:?set expected direct migration target}"
: "${STUDIO_EXPECTED_REPOSITORY_HEAD:?set expected candidate Alembic head}"
: "${STUDIO_EXPECTED_API_IMAGE_ID:?set expected candidate API image ID}"

[[ "$STUDIO_PRE_MIGRATION_BACKUP_CONFIRMED" == "yes" ]] \
  || fail "backup_not_confirmed"
[[ "$STUDIO_PRE_MIGRATION_BACKUP_SNAPSHOT" =~ ^[0-9a-f]{64}$ ]] \
  || fail "backup_snapshot_invalid"
[[ "$STUDIO_EXPECTED_MIGRATION_FROM" =~ ^[[:alnum:]_]+$ ]] \
  || fail "expected_from_invalid"
[[ "$STUDIO_EXPECTED_MIGRATION_TO" =~ ^[[:alnum:]_]+$ ]] \
  || fail "expected_to_invalid"
[[ "$STUDIO_EXPECTED_REPOSITORY_HEAD" =~ ^[[:alnum:]_]+$ ]] \
  || fail "expected_repository_head_invalid"
[[ "$STUDIO_EXPECTED_MIGRATION_FROM" != "$STUDIO_EXPECTED_MIGRATION_TO" ]] \
  || fail "migration_not_required"
[[ "$STUDIO_EXPECTED_API_IMAGE_ID" =~ ^sha256:[0-9a-f]{64}$ ]] \
  || fail "expected_image_invalid"

cd "$STUDIO_DEPLOY_DIR"
[[ -f "$ENV_FILE" && -f "$COMPOSE_FILE" ]] \
  || fail "runtime_files_missing"

candidate_image_id="$(
  docker image inspect --format '{{.Id}}' "$API_IMAGE" 2>/dev/null
)" || fail "candidate_image_inspect_failed"
[[ "$candidate_image_id" == "$STUDIO_EXPECTED_API_IMAGE_ID" ]] \
  || fail "candidate_image_mismatch"

current_revision="$(probe_revision current)"
head_revision="$(probe_revision heads)"
[[ "$current_revision" == "$STUDIO_EXPECTED_MIGRATION_FROM" ]] \
  || fail "current_revision_mismatch"
[[ "$head_revision" == "$STUDIO_EXPECTED_REPOSITORY_HEAD" ]] \
  || fail "head_revision_mismatch"

if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" \
  run --rm --no-deps -T studio-api \
  alembic -c /app/alembic.ini upgrade \
  "$STUDIO_EXPECTED_MIGRATION_TO" </dev/null; then
  fail "upgrade_failed"
fi

post_revision="$(probe_revision current)"
[[ "$post_revision" == "$STUDIO_EXPECTED_MIGRATION_TO" ]] \
  || fail "post_revision_mismatch"

printf '%s OK from=%s to=%s snapshot=%s\n' \
  "$PREFIX" \
  "$STUDIO_EXPECTED_MIGRATION_FROM" \
  "$STUDIO_EXPECTED_MIGRATION_TO" \
  "${STUDIO_PRE_MIGRATION_BACKUP_SNAPSHOT:0:12}"

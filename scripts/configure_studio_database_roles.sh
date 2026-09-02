#!/usr/bin/env bash
set -euo pipefail

EXPECTED_DIR="${STUDIO_DEPLOY_DIR:-$(pwd)}"
COMPOSE_FILE="deploy/studio/compose.platform.yml"
ENV_FILE="deploy/studio/.env"
ROLE_SQL="deploy/studio/database-roles.sql"

log() { printf '[studio-database-roles] %s\n' "$*"; }
fail() { printf '[studio-database-roles] ERROR: %s\n' "$*" >&2; exit 1; }
compose() { docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }

env_value_once() {
  local key="$1" count value
  count="$(grep -c "^${key}=" "$ENV_FILE" || true)"
  [[ "$count" == "1" ]] || fail "expected exactly one ${key}"
  value="$(sed -n "s|^${key}=||p" "$ENV_FILE")"
  [[ -n "$value" && "$value" != __REQUIRED_* ]] || fail "${key} is unresolved"
  printf '%s\n' "$value"
}

require_secret_file() {
  local label="$1" path="$2" mode
  [[ "$path" == /* && -f "$path" && ! -L "$path" ]] || fail "${label} password file is unavailable"
  mode="$(stat -c '%a' "$path")"
  [[ "$mode" == "600" || "$mode" == "400" ]] || fail "${label} password file mode must be 0600 or 0400"
  [[ "$(stat -c '%U' "$path")" == "root" ]] || fail "${label} password file must be root-owned"
}

psql_admin() {
  compose exec -T postgres psql -X --set ON_ERROR_STOP=1 -U studio -d studio "$@"
}

set_password() {
  local role="$1" file="$2" password escaped
  password="$(<"$file")"
  [[ ${#password} -ge 24 && ${#password} -le 256 && "$password" != *$'\n'* && "$password" != *$'\r'* ]] || fail "${role} password shape invalid"
  escaped="${password//\'/\'\'}"
  printf "ALTER ROLE %s WITH LOGIN PASSWORD '%s';\n" "$role" "$escaped" | psql_admin >/dev/null
  unset password escaped
}

verify_role_structure() {
  local attributes migrator memberships
  attributes="$(psql_admin -Atqc "SELECT count(*) = 3 FROM pg_roles WHERE rolname IN ('studio_owner','studio_migrator','studio_api') AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls AND NOT rolinherit")"
  [[ "$attributes" == "t" ]] || fail "role attributes invalid"
  [[ "$(psql_admin -Atqc "SELECT NOT rolcanlogin FROM pg_roles WHERE rolname='studio_owner'")" == "t" ]] || fail "owner role must not login"
  [[ "$(psql_admin -Atqc "SELECT rolcanlogin AND NOT rolinherit FROM pg_roles WHERE rolname='studio_api'")" == "t" ]] || fail "API role attributes invalid"
  [[ "$(psql_admin -Atqc "SELECT rolcanlogin AND NOT rolinherit FROM pg_roles WHERE rolname='studio_migrator'")" == "t" ]] || fail "migrator role attributes invalid"
  migrator="$(psql_admin -Atqc "SELECT pg_has_role('studio_migrator','studio_owner','SET')")"
  [[ "$migrator" == "t" ]] || fail "migrator cannot assume owner"
  memberships="$(psql_admin -Atqc "SELECT NOT EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member WHERE member.rolname='studio_api') AND (SELECT count(*)=1 FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member JOIN pg_roles granted ON granted.oid=m.roleid WHERE member.rolname='studio_migrator' AND granted.rolname='studio_owner')")"
  [[ "$memberships" == "t" ]] || fail "database role memberships invalid"
}

schema_initialized() {
  [[ "$(psql_admin -Atqc "SELECT to_regclass('public.users') IS NOT NULL AND to_regclass('public.audit_events') IS NOT NULL AND to_regclass('public.alembic_version') IS NOT NULL AND to_regclass('public.transcription_provider_part_checkpoints') IS NOT NULL")" == "t" ]]
}

verify_runtime_privileges() {
  local api_privileges ownership
  api_privileges="$(psql_admin -Atqc "SELECT has_schema_privilege('studio_api','public','USAGE') AND NOT has_schema_privilege('studio_api','public','CREATE') AND has_table_privilege('studio_api','users','SELECT,INSERT,UPDATE,DELETE') AND NOT has_table_privilege('studio_api','users','TRUNCATE') AND has_table_privilege('studio_api','audit_events','SELECT,INSERT') AND NOT has_table_privilege('studio_api','audit_events','UPDATE,DELETE,TRUNCATE') AND has_table_privilege('studio_api','alembic_version','SELECT') AND NOT has_table_privilege('studio_api','alembic_version','INSERT,UPDATE,DELETE,TRUNCATE') AND has_table_privilege('studio_api','transcription_provider_part_checkpoints','SELECT') AND NOT has_table_privilege('studio_api','transcription_provider_part_checkpoints','INSERT,UPDATE,DELETE,TRUNCATE')")"
  [[ "$api_privileges" == "t" ]] || fail "API privilege boundary invalid"
  ownership="$(psql_admin -Atqc "SELECT NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','S','v','m','f') AND pg_get_userbyid(c.relowner) <> 'studio_owner')")"
  [[ "$ownership" == "t" ]] || fail "public object ownership invalid"
}

verify_roles() {
  verify_role_structure
  schema_initialized || fail "application schema is not initialized"
  verify_runtime_privileges
  echo STUDIO_DATABASE_ROLES_OK
}

apply_roles() {
  local api_file migrator_file
  api_file="$(env_value_once STUDIO_API_POSTGRES_PASSWORD_FILE)"
  migrator_file="$(env_value_once STUDIO_MIGRATOR_POSTGRES_PASSWORD_FILE)"
  [[ "$api_file" != "$migrator_file" ]] || fail "API and migrator password files must be distinct"
  require_secret_file API "$api_file"
  require_secret_file migrator "$migrator_file"
  psql_admin -f - < "$ROLE_SQL"
  set_password studio_api "$api_file"
  set_password studio_migrator "$migrator_file"
  verify_role_structure
  if schema_initialized; then
    verify_runtime_privileges
    echo STUDIO_DATABASE_ROLES_OK
  else
    echo STUDIO_DATABASE_ROLES_BOOTSTRAP_OK
  fi
}

cd "$EXPECTED_DIR"
[[ -f "$ENV_FILE" && -f "$COMPOSE_FILE" && -f "$ROLE_SQL" ]] || fail "missing runtime contract"
case "${1:-}" in
  apply) apply_roles ;;
  verify) verify_roles ;;
  disable-logins)
    psql_admin -c "ALTER ROLE studio_api NOLOGIN; ALTER ROLE studio_migrator NOLOGIN;" >/dev/null
    echo STUDIO_DATABASE_ROLE_LOGINS_DISABLED
    ;;
  *) fail "usage: $0 apply|verify|disable-logins" ;;
esac

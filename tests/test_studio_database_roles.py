from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ROLE_SQL = ROOT / "deploy/studio/database-roles.sql"
ROLE_SCRIPT = ROOT / "scripts/configure_studio_database_roles.sh"
MIGRATION_SCRIPT = ROOT / "scripts/migrate_studio_platform.sh"
RELEASE_SCRIPT = ROOT / "scripts/release_studio_platform_migration.sh"


def test_application_database_roles_separate_owner_migrator_and_api():
    sql = ROLE_SQL.read_text(encoding="utf-8")
    assert "CREATE ROLE studio_owner NOLOGIN" in sql
    assert "CREATE ROLE studio_migrator NOLOGIN" in sql
    assert "CREATE ROLE studio_api NOLOGIN" in sql
    for role in ("studio_owner", "studio_migrator", "studio_api"):
        assert f"ALTER ROLE {role} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT" in sql
    assert "GRANT studio_owner TO studio_migrator" in sql
    assert "ALTER ROLE studio_migrator SET role = 'studio_owner'" in sql
    assert "ALTER SCHEMA public OWNER TO studio_owner" in sql
    assert "DO $enum_ownership$" in sql
    assert "t.typtype = 'e'" in sql
    assert "ALTER TYPE %I.%I OWNER TO studio_owner" in sql
    assert "PASSWORD" not in sql
    assert sql.count("BEGIN;") == 1
    assert sql.count("COMMIT;") == 1


def test_api_role_is_direct_grant_only_and_sensitive_tables_are_read_only():
    sql = ROLE_SQL.read_text(encoding="utf-8")
    assert "REVOKE CREATE ON SCHEMA public FROM PUBLIC, studio_api" in sql
    assert "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO studio_api" in sql
    assert "GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO studio_api" in sql
    assert "REVOKE UPDATE, DELETE ON TABLE public.audit_events FROM studio_api" in sql
    assert "REVOKE INSERT, UPDATE, DELETE ON TABLE public.alembic_version FROM studio_api" in sql
    assert "REVOKE INSERT, UPDATE, DELETE ON TABLE public.transcription_provider_part_checkpoints FROM studio_api" in sql
    assert "to_regclass('public.audit_events') IS NOT NULL" in sql
    assert "to_regclass('public.alembic_version') IS NOT NULL" in sql
    assert "ALTER DEFAULT PRIVILEGES FOR ROLE studio_owner" in sql
    assert "FROM pg_auth_members" in sql
    assert "REVOKE %I FROM %I" in sql


def test_database_role_operator_keeps_passwords_out_of_argv_and_requires_protected_files():
    script = ROLE_SCRIPT.read_text(encoding="utf-8")
    assert "set -euo pipefail" in script
    assert "STUDIO_API_POSTGRES_PASSWORD_FILE" in script
    assert "STUDIO_MIGRATOR_POSTGRES_PASSWORD_FILE" in script
    assert '"600" || "$mode" == "400"' in script
    assert '"$(stat -c \'%U\' "$path")" == "root"' in script
    assert "printf \"ALTER ROLE %s WITH LOGIN PASSWORD '%s';\\n\"" in script
    assert "| psql_admin" in script
    assert "mktemp" not in script
    assert "set -x" not in script
    assert "echo $password" not in script
    assert "database role memberships invalid" in script
    assert "public enum ownership invalid" in script
    assert "STUDIO_DATABASE_ROLES_OK" in script
    assert "STUDIO_DATABASE_ROLES_BOOTSTRAP_OK" in script
    assert 'schema_initialized || fail "application schema is not initialized"' in script
    assert "STUDIO_DATABASE_ROLE_LOGINS_DISABLED" in script


def test_migration_lane_uses_migrator_and_reapplies_runtime_grants():
    migration = MIGRATION_SCRIPT.read_text(encoding="utf-8")
    release = RELEASE_SCRIPT.read_text(encoding="utf-8")
    assert "configure_studio_database_roles.sh apply" in migration
    assert "studio-migrator" in migration
    assert migration.count("configure_studio_database_roles.sh apply") == 2
    assert "printf 'base\\n'" in migration
    assert "configure_studio_worker_db_role.sh apply" in migration
    assert "database-roles.sql" in release
    assert "configure_studio_database_roles.sh" in release

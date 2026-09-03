-- Application PostgreSQL least-privilege manifest.
-- Passwords are applied separately by the operator script.

BEGIN;

DO $roles$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'studio_owner') THEN
        CREATE ROLE studio_owner NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'studio_migrator') THEN
        CREATE ROLE studio_migrator NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'studio_api') THEN
        CREATE ROLE studio_api NOLOGIN;
    END IF;
END
$roles$;

ALTER ROLE studio_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
ALTER ROLE studio_migrator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
ALTER ROLE studio_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;

GRANT studio_owner TO studio_migrator;
ALTER ROLE studio_migrator SET role = 'studio_owner';
ALTER ROLE studio_migrator SET statement_timeout = '30min';
ALTER ROLE studio_migrator SET lock_timeout = '10s';
ALTER ROLE studio_api SET statement_timeout = '30s';
ALTER ROLE studio_api SET lock_timeout = '5s';
ALTER ROLE studio_api SET idle_in_transaction_session_timeout = '60s';

DO $memberships$
DECLARE
    member_record record;
BEGIN
    FOR member_record IN
        SELECT member_role.rolname AS member_name,
               granted_role.rolname AS granted_name
        FROM pg_auth_members AS membership
        JOIN pg_roles AS granted_role ON granted_role.oid = membership.roleid
        JOIN pg_roles AS member_role ON member_role.oid = membership.member
        WHERE member_role.rolname = 'studio_api'
           OR (member_role.rolname = 'studio_migrator' AND granted_role.rolname <> 'studio_owner')
    LOOP
        EXECUTE format(
            'REVOKE %I FROM %I',
            member_record.granted_name,
            member_record.member_name
        );
    END LOOP;
END
$memberships$;

ALTER SCHEMA public OWNER TO studio_owner;

DO $ownership$
DECLARE
    item record;
BEGIN
    FOR item IN
        SELECT c.relkind, n.nspname, c.relname
        FROM pg_class AS c
        JOIN pg_namespace AS n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r','p','S','v','m','f')
          AND pg_get_userbyid(c.relowner) <> 'studio_owner'
    LOOP
        EXECUTE format(
            'ALTER %s %I.%I OWNER TO studio_owner',
            CASE item.relkind
                WHEN 'S' THEN 'SEQUENCE'
                WHEN 'v' THEN 'VIEW'
                WHEN 'm' THEN 'MATERIALIZED VIEW'
                WHEN 'f' THEN 'FOREIGN TABLE'
                ELSE 'TABLE'
            END,
            item.nspname,
            item.relname
        );
    END LOOP;
END
$ownership$;

-- Native PostgreSQL enums created by the original bootstrap predate the
-- dedicated owner/migrator split.  Tables do not carry ownership of their
-- column types, so transfer those enums explicitly before Alembic needs to
-- extend one of them (for example credentialprovider).
DO $enum_ownership$
DECLARE
    item record;
BEGIN
    FOR item IN
        SELECT n.nspname, t.typname
        FROM pg_type AS t
        JOIN pg_namespace AS n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typtype = 'e'
          AND pg_get_userbyid(t.typowner) <> 'studio_owner'
    LOOP
        EXECUTE format(
            'ALTER TYPE %I.%I OWNER TO studio_owner',
            item.nspname,
            item.typname
        );
    END LOOP;
END
$enum_ownership$;

GRANT CONNECT ON DATABASE studio TO studio_api, studio_migrator;
GRANT USAGE ON SCHEMA public TO studio_api;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, studio_api;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM studio_api;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM studio_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO studio_api;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO studio_api;

-- A first-time database has no application tables yet.  Keep the same manifest
-- safe before the first Alembic upgrade and re-apply it after every migration.
DO $sensitive_tables$
BEGIN
    IF to_regclass('public.audit_events') IS NOT NULL THEN
        REVOKE UPDATE, DELETE ON TABLE public.audit_events FROM studio_api;
    END IF;
    IF to_regclass('public.alembic_version') IS NOT NULL THEN
        REVOKE INSERT, UPDATE, DELETE ON TABLE public.alembic_version FROM studio_api;
    END IF;
    IF to_regclass('public.transcription_provider_part_checkpoints') IS NOT NULL THEN
        REVOKE INSERT, UPDATE, DELETE ON TABLE public.transcription_provider_part_checkpoints FROM studio_api;
    END IF;
END
$sensitive_tables$;

ALTER DEFAULT PRIVILEGES FOR ROLE studio_owner IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO studio_api;
ALTER DEFAULT PRIVILEGES FOR ROLE studio_owner IN SCHEMA public
    GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO studio_api;

COMMIT;

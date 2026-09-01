-- Worker-only PostgreSQL privilege manifest.
-- Password/login activation is intentionally performed separately by the
-- operator script so this reviewed file never contains credential material.

BEGIN;

DO $worker_role$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'studio_worker') THEN
        CREATE ROLE studio_worker
            NOLOGIN
            NOSUPERUSER
            NOCREATEDB
            NOCREATEROLE
            NOREPLICATION
            NOBYPASSRLS
            NOINHERIT;
    END IF;
END
$worker_role$;

ALTER ROLE studio_worker
    NOLOGIN
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    NOREPLICATION
    NOBYPASSRLS
    NOINHERIT;
ALTER ROLE studio_worker SET statement_timeout = '30min';
ALTER ROLE studio_worker SET lock_timeout = '10s';
ALTER ROLE studio_worker SET idle_in_transaction_session_timeout = '60s';

DO $worker_memberships$
DECLARE
    inherited_role text;
BEGIN
    FOR inherited_role IN
        SELECT granted_role.rolname
        FROM pg_auth_members AS membership
        JOIN pg_roles AS granted_role ON granted_role.oid = membership.roleid
        JOIN pg_roles AS member_role ON member_role.oid = membership.member
        WHERE member_role.rolname = 'studio_worker'
    LOOP
        EXECUTE format('REVOKE %I FROM studio_worker', inherited_role);
    END LOOP;
END
$worker_memberships$;

GRANT CONNECT ON DATABASE studio TO studio_worker;
GRANT USAGE ON SCHEMA public TO studio_worker;
REVOKE CREATE ON SCHEMA public FROM studio_worker;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM studio_worker;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM studio_worker;

GRANT SELECT ON TABLE
    alembic_version,
    users,
    provider_credentials,
    provider_credential_versions,
    provider_account_snapshots,
    google_connections,
    projects,
    sources,
    transcription_jobs,
    transcription_job_outputs,
    transcript_catalog_entries,
    transcript_maintenance_runs,
    transcription_job_sources,
    audio_preparation_jobs,
    audio_preparation_job_inputs,
    speaker_profiles,
    transcription_job_speakers,
    transcription_job_source_attempts,
    transcription_provider_part_checkpoints,
    realtime_transcript_drafts,
    transcription_output_reconciliations,
    audit_events,
    diagnostic_debug_sessions,
    diagnostic_events,
    operational_incidents,
    operational_alert_deliveries,
    runtime_component_status
TO studio_worker;

GRANT UPDATE ON TABLE
    sources,
    transcription_jobs,
    transcript_catalog_entries,
    transcript_maintenance_runs,
    transcription_job_sources,
    audio_preparation_jobs,
    audio_preparation_job_inputs,
    transcription_job_speakers,
    transcription_job_source_attempts,
    transcription_output_reconciliations,
    diagnostic_events,
    operational_incidents,
    operational_alert_deliveries,
    runtime_component_status
TO studio_worker;

GRANT INSERT ON TABLE
    sources,
    transcription_job_outputs,
    transcript_catalog_entries,
    transcription_job_speakers,
    transcription_job_source_attempts,
    transcription_provider_part_checkpoints,
    transcription_output_reconciliations,
    audit_events,
    diagnostic_events,
    operational_incidents,
    operational_alert_deliveries,
    runtime_component_status
TO studio_worker;

GRANT DELETE ON TABLE
    diagnostic_events,
    transcription_provider_part_checkpoints,
    realtime_transcript_drafts
TO studio_worker;

COMMIT;

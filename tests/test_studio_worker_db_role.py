from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
ROLE_SQL = ROOT / "deploy/studio/worker-db-role.sql"
ROLE_SCRIPT = ROOT / "scripts/configure_studio_worker_db_role.sh"


def test_worker_role_manifest_is_non_superuser_and_fail_closed_for_future_tables():
    sql = ROLE_SQL.read_text(encoding="utf-8")
    assert "CREATE ROLE studio_worker" in sql
    for attribute in (
        "NOLOGIN",
        "NOSUPERUSER",
        "NOCREATEDB",
        "NOCREATEROLE",
        "NOREPLICATION",
        "NOBYPASSRLS",
        "NOINHERIT",
    ):
        assert attribute in sql
    assert "REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public" in sql
    assert "REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public" in sql
    assert "ALTER DEFAULT PRIVILEGES" not in sql
    assert "PASSWORD" not in sql
    assert sql.count("BEGIN;") == 1
    assert sql.count("COMMIT;") == 1
    assert "FROM pg_auth_members" in sql
    assert "REVOKE %I FROM studio_worker" in sql


def test_worker_role_grants_only_current_processing_surfaces():
    sql = ROLE_SQL.read_text(encoding="utf-8")
    delete_block = re.search(
        r"GRANT DELETE ON TABLE(?P<body>.*?)TO studio_worker;",
        sql,
        flags=re.DOTALL,
    )
    assert delete_block is not None
    assert "diagnostic_events" in delete_block.group("body")
    for required in (
        "transcription_jobs",
        "transcription_job_outputs",
        "transcription_job_sources",
        "transcription_job_source_attempts",
        "transcription_provider_part_checkpoints",
        "audio_preparation_jobs",
        "transcript_maintenance_runs",
        "diagnostic_events",
        "runtime_component_status",
    ):
        assert required in sql
    for forbidden in (
        "local_identities",
        "sessions",
        "login_contexts",
        "google_oauth_states",
        "output_folder_favorites",
        "provider_account_snapshots",
    ):
        assert re.search(rf"\\b{re.escape(forbidden)}\\b", sql) is None


def test_worker_role_operator_script_keeps_password_off_argv_and_disk():
    script = ROLE_SCRIPT.read_text(encoding="utf-8")
    assert "set -euo pipefail" in script
    assert "git status --porcelain --untracked-files=no" in script
    assert "STUDIO_WORKER_POSTGRES_PASSWORD_FILE" in script
    assert "root-owned" in script and '"600"' in script and '"400"' in script
    assert "printf \"ALTER ROLE %s WITH LOGIN PASSWORD '%s';\\n\"" in script
    assert "| psql_admin" in script
    assert "mktemp" not in script
    assert "set -x" not in script
    assert "echo $password" not in script
    assert "STUDIO_WORKER_DB_ROLE_OK" in script
    assert "STUDIO_WORKER_DB_ROLE_DISABLED" in script

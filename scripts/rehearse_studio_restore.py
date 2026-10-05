"""Real custom-format PostgreSQL dump/restore with synthetic Studio data only.

No URL, source dump, production target, secret file or existing container is
accepted. Two owned, network-isolated tmpfs containers use a locally cached
postgres:17 image. The restored copy is quarantined, never activated.
"""
from __future__ import annotations

import base64
import enum
import json
import re
import subprocess
import sys
import time
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import create_engine, create_mock_engine, select
from sqlalchemy.orm import Session as DbSession

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))
from studio_api.db import Base
from studio_api.models import Project, RealtimeTranscriptDraft, Session, TrustedDevice, User
from studio_api.realtime_drafts import save_realtime_draft
from studio_api.recovery_quarantine import quarantine_statements

LABEL = "studio.synthetic-recovery-drill"
CLEARED_SESSION_ID = "cleared-after-backup".ljust(20, "_")


class DrillFailure(RuntimeError):
    pass


def _run(args, *, input=None, timeout=20):
    try:
        result = subprocess.run(args, input=input, capture_output=True, timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired):
        raise DrillFailure("isolated_restore_command_unavailable_or_timeout") from None
    if result.returncode:
        # Command output may include fixture text; never include it in reports.
        raise DrillFailure("isolated_restore_command_failed")
    if len(result.stdout) > 64 * 1024 * 1024:
        raise DrillFailure("isolated_restore_output_budget_exceeded")
    return result.stdout


def _literal(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, enum.Enum):
        value = value.name
    if isinstance(value, bytes):
        return "decode('" + value.hex() + "','hex')"
    if isinstance(value, (datetime, date)):
        value = value.isoformat()
    if isinstance(value, (float, int)):
        return str(value)
    if not isinstance(value, str):
        raise DrillFailure("unsupported_fixture_value")
    return "'" + value.replace("'", "''") + "'"


def fixture_sql():
    """Use real model schema/defaults and the real encrypted Live writer."""
    statements = []
    dialect = create_mock_engine("postgresql+psycopg://", lambda sql, *a, **kw: statements.append(
        str(sql.compile(dialect=dialect.dialect)) + ";"))
    Base.metadata.create_all(dialect)
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime.now(timezone.utc)
    class Settings:
        credential_key_id = "synthetic-drill"
        @staticmethod
        def master_key_b64():
            return base64.b64encode(b"s" * 32).decode()
    with DbSession(engine) as db:
        user = User(id=str(uuid.uuid4()), email="recovery-drill@example.test")
        project = Project(id=str(uuid.uuid4()), owner_user_id=user.id, title="Synthetic restore")
        db.add_all([user, project])
        db.flush()
        for name in ("retained", "cleared-after-backup"):
            save_realtime_draft(db, owner_user_id=user.id, project=project,
                client_session_id=name.ljust(20, "_"), revision=1,
                committed_segments=["SYNTHETIC_RESTORE_TEXT"], partial="", settings=Settings(), now=now)
        db.add(Session(user_id=user.id, token_hash="s" * 64, csrf_hash="c" * 64,
            expires_at=now + timedelta(days=1), reauthenticated_at=now))
        db.add(TrustedDevice(user_id=user.id, token_hash="t" * 64, expires_at=now + timedelta(days=30)))
        db.commit()
        for table in Base.metadata.sorted_tables:
            for row in db.execute(select(table)).mappings():
                names = ",".join('"' + col.name + '"' for col in table.columns)
                values = ",".join(_literal(row[col.name]) for col in table.columns)
                statements.append(f'INSERT INTO "{table.name}" ({names}) VALUES ({values});')
        ciphertexts = sorted(row.hex() for row in db.scalars(select(RealtimeTranscriptDraft.ciphertext)))
    engine.dispose()
    return "\n".join(statements).encode(), ciphertexts, dialect.dialect


class OwnedPostgres:
    def __init__(self, image_id, nonce, role):
        self.image_id, self.nonce, self.role = image_id, nonce, role
        self.container_id = None

    def verify(self):
        if not self.container_id or not re.fullmatch(r"[a-f0-9]{64}", self.container_id):
            raise DrillFailure("drill_container_identity_invalid")
        record = json.loads(_run(["docker", "inspect", self.container_id]))[0]
        host = record["HostConfig"]
        if (record["Image"] != self.image_id or record["Config"].get("Labels", {}).get(LABEL) != self.nonce
            or record.get("Name") != f"/studio-recovery-{self.nonce}-{self.role}"
            or host["NetworkMode"] != "none" or not host["ReadonlyRootfs"]
            or host.get("Binds") or host.get("PortBindings")
            or "ALL" not in host.get("CapDrop", [])
            or not any(value.startswith("no-new-privileges") for value in host.get("SecurityOpt", []))
            or any(mount.get("Type") != "tmpfs" for mount in record.get("Mounts", []))):
            raise DrillFailure("drill_container_boundary_invalid")

    def start(self):
        data = "rw,size=268435456,uid=999,gid=999,mode=0700"
        try:
            self.container_id = _run(["docker", "create", "--pull=never",
            "--name", f"studio-recovery-{self.nonce}-{self.role}", "--label", f"{LABEL}={self.nonce}",
            "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
            "--user", "999:999", "--memory", "384m", "--cpus", "1", "--pids-limit", "128",
            "--tmpfs", f"/var/lib/postgresql/data:{data}", "--tmpfs", "/var/run/postgresql:rw,uid=999,gid=999,mode=0700",
            "--tmpfs", "/tmp:rw,size=16777216,mode=1777", "--env", "POSTGRES_HOST_AUTH_METHOD=trust",
            "--env", "POSTGRES_USER=studio_drill", "--env", "POSTGRES_DB=studio_drill",
                self.image_id, "postgres", "-c", "shared_buffers=16MB", "-c", "max_connections=10"]).decode().strip()
        except DrillFailure:
            # A timed-out create can still have succeeded. Recover the exact
            # nonce/name, then verify all boundaries before finally removing it.
            try:
                records = json.loads(_run(["docker", "inspect", f"studio-recovery-{self.nonce}-{self.role}"]))
                self.container_id = records[0]["Id"]
                self.verify()
            except (DrillFailure, ValueError, KeyError, IndexError):
                raise DrillFailure("ambiguous_create_needs_identity_review") from None
            raise
        self.verify()
        _run(["docker", "start", self.container_id])
        deadline = time.monotonic() + 25
        while time.monotonic() < deadline:
            try:
                if self.exec(["cat", "/proc/1/comm"]).decode().strip() != "postgres":
                    time.sleep(.2)
                    continue
                self.exec(["pg_isready", "-U", "studio_drill", "-d", "studio_drill"])
                return
            except DrillFailure:
                time.sleep(.2)
        raise DrillFailure("drill_postgres_not_ready")

    def exec(self, args, *, input=None):
        self.verify()
        return _run(["docker", "exec", *( ["-i"] if input is not None else []), self.container_id, *args], input=input)

    def sql(self, sql):
        return self.exec(["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "studio_drill", "-d", "studio_drill"], input=sql)

    def close(self):
        if self.container_id:
            self.verify()
            _run(["docker", "rm", "--force", self.container_id])
            self.container_id = None


def rehearse():
    image_id = _run(["docker", "image", "inspect", "postgres:17", "--format", "{{.Id}}"] ).decode().strip()
    if not re.fullmatch(r"sha256:[a-f0-9]{64}", image_id):
        raise DrillFailure("cached_postgres_image_identity_invalid")
    nonce = uuid.uuid4().hex
    source, target = OwnedPostgres(image_id, nonce, "source"), OwnedPostgres(image_id, nonce, "restore")
    schema, expected_ciphertexts, dialect = fixture_sql()
    try:
        source.start()
        source.sql(schema)
        captured = datetime.now(timezone.utc)
        dump = source.exec(["pg_dump", "-U", "studio_drill", "-d", "studio_drill", "--format=custom", "--no-owner"])
        if not dump.startswith(b"PGDMP"):
            raise DrillFailure("invalid_custom_dump")
        # A deletion occurring after backup is intentionally absent from it.
        source.sql(("DELETE FROM realtime_transcript_drafts WHERE client_session_id=" + _literal(CLEARED_SESSION_ID) + ";").encode())
        if source.sql(b"SELECT count(*) FROM realtime_transcript_drafts;").decode().strip() != "1":
            raise DrillFailure("post_backup_deletion_not_applied")
        source.sql(b"UPDATE projects SET title='Synthetic changed after snapshot';")
        if source.sql(b"SELECT count(*) FROM projects WHERE title='Synthetic changed after snapshot';").decode().strip() != "1":
            raise DrillFailure("post_backup_update_not_applied")
        incident = time.monotonic()
        target.start()
        target.exec(["pg_restore", "-U", "studio_drill", "-d", "studio_drill", "--no-owner", "--exit-on-error"], input=dump)
        restored = target.sql(b"SELECT encode(ciphertext,'hex') FROM realtime_transcript_drafts ORDER BY encode(ciphertext,'hex');").decode().splitlines()
        if restored != expected_ciphertexts:
            raise DrillFailure("restored_encrypted_text_mismatch")
        if target.sql(b"SELECT count(*) FROM projects WHERE title='Synthetic restore';").decode().strip() != "1":
            raise DrillFailure("restored_metadata_snapshot_mismatch")
        now = datetime.now(timezone.utc)
        quarantine = "BEGIN;\n" + "\n".join(str(statement.compile(dialect=dialect,
            compile_kwargs={"literal_binds": True})) + ";" for statement in quarantine_statements(now)) + "\nCOMMIT;"
        target.sql(quarantine.encode())
        counts = target.sql(b"SELECT count(*) FROM users WHERE status='active'; SELECT count(*) FROM projects WHERE archived_at IS NULL; SELECT count(*) FROM sessions WHERE revoked_at IS NULL; SELECT count(*) FROM trusted_devices WHERE revoked_at IS NULL;").decode().splitlines()
        if counts != ["0"] * 4:
            raise DrillFailure("restored_copy_not_quarantined")
        return {"result": "PASS", "image_id": image_id, "fixture": "synthetic_current_model_schema",
            "encrypted_drafts_restored": len(restored), "deleted_after_backup_reactivated": 0,
            "post_snapshot_metadata_updates_missing_from_restore": 1,
            "restore_to_quarantine_seconds": round(time.monotonic() - incident, 3),
            "snapshot_age_seconds": round((now - captured).total_seconds(), 3),
            "automatic_activation": False, "production_rpo_rto_verified": False,
            "limits": "No production snapshot/storage/Google/provider call; activation needs current deletion evidence."}
    finally:
        # Always attempt both owned removals; never delete an unverified target.
        failures = []
        for container in (target, source):
            try:
                container.close()
            except DrillFailure as exc:
                failures.append(str(exc))
        if failures:
            raise DrillFailure("isolated_restore_cleanup_requires_attention")


if __name__ == "__main__":
    try:
        print(json.dumps(rehearse(), ensure_ascii=False))
    except DrillFailure as exc:
        print(json.dumps({"result": "FAIL", "reason": str(exc)}))
        raise SystemExit(1)

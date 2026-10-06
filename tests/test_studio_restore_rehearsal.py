from __future__ import annotations

import importlib.util
import json
import os
import shutil
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("studio_restore_rehearsal", ROOT / "scripts/rehearse_studio_restore.py")
drill = importlib.util.module_from_spec(spec)
spec.loader.exec_module(drill)


def test_restore_fixture_is_encrypted_and_current_quarantine_sql_compiles():
    from datetime import datetime, timezone
    from studio_api.recovery_quarantine import quarantine_statements
    sql, ciphertexts, dialect = drill.fixture_sql()
    assert ciphertexts and b"SYNTHETIC_RESTORE_TEXT" not in sql
    assert b"CREATE TABLE realtime_transcript_drafts" in sql
    assert b"CREATE TABLE audio_preparation_jobs" in sql
    quarantine = "\n".join(str(statement.compile(dialect=dialect, compile_kwargs={"literal_binds": True}))
        for statement in quarantine_statements(datetime.now(timezone.utc)))
    assert "DELETE" not in quarantine  # Recovery content is retained for reconciliation.
    assert "studio_drill" not in quarantine  # Target comes only from the owned container boundary.


@pytest.mark.parametrize("age,elapsed,expected,rpo,rto", [
    (12, 8, "PARTIAL", "PASS", "PENDING"),
    (13, 8, "FAIL", "FAIL", "PENDING"),
    (12, 9, "FAIL", "PASS", "FAIL"),
])
def test_restore_target_comparison_has_inclusive_bounds_without_false_full_rto(age, elapsed, expected, rpo, rto):
    result = drill.compare_recovery_targets({"incident_snapshot_age_seconds": age,
        "restore_to_quarantine_seconds": elapsed, "snapshot_age_seconds": age + elapsed},
        rpo_seconds=12, rto_seconds=8)
    assert result["result"] == expected
    assert result["synthetic_loss_window_result"] == rpo
    assert result["full_recovery_time_result"] == rto
    assert not result["production_rpo_rto_verified"]


@pytest.mark.parametrize("value", [0, -1, True, float("nan"), float("inf"), "12"])
def test_invalid_recovery_target_cannot_be_claimed_pass(value):
    with pytest.raises(drill.DrillFailure, match="target_invalid"):
        drill.compare_recovery_targets({"incident_snapshot_age_seconds": 1,
            "restore_to_quarantine_seconds": 1}, rpo_seconds=value, rto_seconds=10)


def test_missing_actual_measurement_does_not_default_to_zero():
    with pytest.raises(drill.DrillFailure, match="measurement_invalid"):
        drill.compare_recovery_targets({}, rpo_seconds=12, rto_seconds=8)


@pytest.mark.parametrize("elapsed,expected", [(14400, "PASS"), (14401, "FAIL")])
def test_personal_recovery_budget_measures_application_access_not_only_dump(elapsed, expected):
    result = drill.compare_recovery_targets({"incident_snapshot_age_seconds": 43200,
        "restore_to_quarantine_seconds": 10, "synthetic_application_recovery_seconds": elapsed,
        "synthetic_application_access_result": "PASS"},
        rpo_seconds=drill.PERSONAL_RPO_SECONDS, rto_seconds=drill.PERSONAL_RTO_SECONDS)
    assert result["result"] == expected
    assert result["synthetic_application_time_result"] == expected
    assert result["full_recovery_time_result"] == "PENDING"
    assert not result["production_rpo_rto_verified"]


@pytest.mark.parametrize("violation", ["external", "foreign", "label"])
def test_application_network_must_be_internal_owned_and_free_of_foreign_containers(monkeypatch, violation):
    network = drill.OwnedNetwork("nonce")
    network.network_id = "a" * 64
    record = {"Id": network.network_id, "Name": network.name, "Driver": "bridge", "Internal": True,
        "Labels": {drill.LABEL: "nonce"}, "Containers": {}}
    if violation == "external":
        record["Internal"] = False
    elif violation == "foreign":
        record["Containers"] = {"b" * 64: {}}
    else:
        record["Labels"][drill.LABEL] = "another-task"
    calls = []
    def run(args, **kwargs):
        calls.append(args)
        return json.dumps([record]).encode()
    monkeypatch.setattr(drill, "_run", run)
    with pytest.raises(drill.DrillFailure, match="network_boundary_invalid"):
        network.close()
    assert calls == [["docker", "network", "inspect", network.network_id]]


@pytest.mark.parametrize("violation", [None, "publish_loopback", "publish_public", "public_ip", "foreign_subnet", "foreign_network", "extra_network"])
def test_application_database_accepts_only_owned_internal_address_without_published_ports(monkeypatch, violation):
    network = drill.OwnedNetwork("nonce")
    network.network_id = "c" * 64
    monkeypatch.setattr(network, "verify", lambda: {"IPAM": {"Config": [{"Subnet": "172.28.0.0/16"}]}})
    container = drill.OwnedPostgres("sha256:" + "a" * 64, "nonce", "restore", network)
    container.container_id = "b" * 64
    record = {"Image": container.image_id, "Name": "/studio-recovery-nonce-restore",
        "Config": {"Labels": {drill.LABEL: "nonce"}}, "HostConfig": {"NetworkMode": network.name,
            "ReadonlyRootfs": True, "CapDrop": ["ALL"], "SecurityOpt": ["no-new-privileges"],
            "PortBindings": {}}, "Mounts": [],
        "NetworkSettings": {"Ports": {"5432/tcp": None}, "Networks": {network.name: {
            "NetworkID": network.network_id, "IPAddress": "172.28.0.2"}}}}
    if violation in ("publish_loopback", "publish_public"):
        address = "127.0.0.1" if violation == "publish_loopback" else "0.0.0.0"
        record["HostConfig"]["PortBindings"] = {"5432/tcp": [{"HostIp": address, "HostPort": "34567"}]}
    elif violation in ("public_ip", "foreign_subnet"):
        record["NetworkSettings"]["Networks"][network.name]["IPAddress"] = "8.8.8.8" if violation == "public_ip" else "172.29.0.2"
    elif violation == "foreign_network":
        record["NetworkSettings"]["Networks"][network.name]["NetworkID"] = "d" * 64
    elif violation == "extra_network":
        record["NetworkSettings"]["Networks"]["unrelated"] = {}
    monkeypatch.setattr(drill, "_run", lambda *args, **kwargs: json.dumps([record]).encode())
    if violation is None:
        assert container.application_url() == "postgresql+psycopg://studio_drill@172.28.0.2:5432/studio_drill"
    else:
        with pytest.raises(drill.DrillFailure, match="(port_boundary|address|network)_invalid"):
            container.application_url()


def test_real_postgres_custom_dump_restore_and_authenticated_application_access(monkeypatch):
    if not shutil.which("docker"):
        if os.getenv("CI") == "true":
            pytest.fail("Required isolated PostgreSQL restore drill needs the CI Docker runtime")
        pytest.skip("Local Docker is unavailable; real restore remains required in Linux CI")
    def application_probe(target, current_inventory):
        from datetime import datetime, timedelta, timezone
        from fastapi.testclient import TestClient
        from sqlalchemy import create_engine, select
        from sqlalchemy.orm import Session as OrmSession
        from studio_api import main as api
        from studio_api.db import get_db
        from studio_api.models import Project, RealtimeTranscriptDraft, Session, User, UserStatus
        from studio_api.security import token_hash

        assert current_inventory == ("retained".ljust(20, "_"),)
        engine = create_engine(target.application_url(), connect_args={"connect_timeout": 5}, pool_size=2, max_overflow=0)
        class ProbeSettings(type(api.settings)):
            def master_key_b64(self):
                import base64
                return base64.b64encode(b"s" * 32).decode()
        probe_settings = ProbeSettings(**api.settings.model_dump())
        probe_settings.credential_key_id = "synthetic-drill"
        fresh_token = "synthetic-restored-session-" + target.nonce

        def restored_db():
            target.verify()
            with OrmSession(engine) as db:
                yield db

        previous_overrides = dict(api.app.dependency_overrides)
        try:
            with OrmSession(engine) as db:
                users = db.scalars(select(User)).all()
                projects = db.scalars(select(Project)).all()
                drafts = db.scalars(select(RealtimeTranscriptDraft)).all()
                assert len(users) == len(projects) == 1
                assert users[0].email == "recovery-drill@example.test"
                assert users[0].status == UserStatus.disabled and projects[0].archived_at is not None
                assert {row.client_session_id for row in drafts} == {*current_inventory, drill.CLEARED_SESSION_ID}
                # Only the separately verified synthetic current inventory may
                # authorize activation. Never infer deletion state from backup.
                for row in drafts:
                    if row.client_session_id not in current_inventory:
                        db.delete(row)
                users[0].status = UserStatus.active
                projects[0].archived_at = None
                project_id = projects[0].id
                db.add(Session(user_id=users[0].id, token_hash=token_hash(fresh_token), csrf_hash="f" * 64,
                    expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)))
                db.commit()
            with monkeypatch.context() as patch:
                patch.setattr(api, "settings", probe_settings)
                api.app.dependency_overrides[get_db] = restored_db
                client = TestClient(api.app)
                try:
                    client.cookies.set(probe_settings.cookie_name, drill.OLD_SESSION_TOKEN)
                    assert client.get("/api/auth/session").status_code == 401
                    client.cookies.clear()
                    client.cookies.set(probe_settings.cookie_name, fresh_token)
                    assert client.get("/api/auth/session").json()["authenticated"] is True
                    response = client.get(f"/api/projects/{project_id}/realtime/drafts/latest")
                    assert response.status_code == 200
                    assert response.json()["draft"]["committed_segments"] == ["SYNTHETIC_RESTORE_TEXT"]
                finally:
                    client.close()
            with OrmSession(engine) as db:
                assert db.scalars(select(RealtimeTranscriptDraft.client_session_id)).all() == list(current_inventory)
        finally:
            api.app.dependency_overrides.clear()
            api.app.dependency_overrides.update(previous_overrides)
            engine.dispose()

    result = drill.rehearse(application_probe=application_probe)
    assert result["result"] == "PASS"
    assert result["encrypted_drafts_restored"] == 2
    assert result["post_snapshot_metadata_updates_missing_from_restore"] == 1
    assert result["deleted_after_backup_reactivated"] == 0
    assert result["automatic_activation"] is False
    assert result["production_rpo_rto_verified"] is False
    assert result["synthetic_application_access_result"] == "PASS"
    assert result["synthetic_application_recovery_seconds"] >= result["restore_to_quarantine_seconds"]
    assert result["target_comparison"]["synthetic_application_time_result"] == "PASS"
    assert result["target_comparison"]["rpo_target_seconds"] == 12 * 3600
    assert result["target_comparison"]["rto_target_seconds"] == 4 * 3600


@pytest.mark.parametrize("violation", ["label", "network", "volume", "image", "role"])
def test_existing_or_unsafe_container_cannot_be_used_or_removed(monkeypatch, violation):
    container = drill.OwnedPostgres("sha256:" + "a" * 64, "nonce", "restore")
    container.container_id = "b" * 64
    record = {"Image": container.image_id, "Name": "/studio-recovery-nonce-restore",
        "Config": {"Labels": {drill.LABEL: "nonce"}}, "HostConfig": {"NetworkMode": "none",
            "ReadonlyRootfs": True, "CapDrop": ["ALL"], "SecurityOpt": ["no-new-privileges"]}, "Mounts": []}
    if violation == "label":
        record["Config"]["Labels"][drill.LABEL] = "another-task"
    elif violation == "network":
        record["HostConfig"]["NetworkMode"] = "bridge"
    elif violation == "volume":
        record["Mounts"] = [{"Type": "volume"}]
    elif violation == "image":
        record["Image"] = "sha256:" + "c" * 64
    else:
        record["Name"] = "/studio-recovery-nonce-source"
    calls = []
    def run(args, **kwargs):
        calls.append(args)
        return json.dumps([record]).encode()
    monkeypatch.setattr(drill, "_run", run)
    with pytest.raises(drill.DrillFailure, match="boundary_invalid"):
        container.close()
    assert calls == [["docker", "inspect", container.container_id]]


def test_ambiguous_create_recovers_owned_identity_before_cleanup(monkeypatch):
    container = drill.OwnedPostgres("sha256:" + "a" * 64, "nonce", "source")
    identity = "b" * 64
    record = {"Id": identity, "Image": container.image_id, "Name": "/studio-recovery-nonce-source",
        "Config": {"Labels": {drill.LABEL: "nonce"}}, "HostConfig": {"NetworkMode": "none",
            "ReadonlyRootfs": True, "CapDrop": ["ALL"], "SecurityOpt": ["no-new-privileges"]}, "Mounts": []}
    calls = []
    def run(args, **kwargs):
        calls.append(args)
        if args[1] == "create":
            raise drill.DrillFailure("isolated_restore_command_unavailable_or_timeout")
        if args[1] == "inspect":
            return json.dumps([record]).encode()
        return b""
    monkeypatch.setattr(drill, "_run", run)
    with pytest.raises(drill.DrillFailure, match="timeout"):
        container.start()
    container.close()
    assert calls[-1] == ["docker", "rm", "--force", identity]
    assert not any(call[1] == "start" for call in calls)

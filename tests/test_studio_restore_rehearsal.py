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


def test_real_postgres_custom_dump_restore_remains_inactive_after_later_deletion():
    if not shutil.which("docker"):
        if os.getenv("CI") == "true":
            pytest.fail("Required isolated PostgreSQL restore drill needs the CI Docker runtime")
        pytest.skip("Local Docker is unavailable; real restore remains required in Linux CI")
    result = drill.rehearse()
    assert result["result"] == "PASS"
    assert result["encrypted_drafts_restored"] == 2
    assert result["post_snapshot_metadata_updates_missing_from_restore"] == 1
    assert result["deleted_after_backup_reactivated"] == 0
    assert result["automatic_activation"] is False
    assert result["production_rpo_rto_verified"] is False


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

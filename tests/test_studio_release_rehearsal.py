import importlib.util
import json
import os
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
os.environ.setdefault("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")
spec = importlib.util.spec_from_file_location("release_drill", ROOT / "scripts/rehearse_studio_release.py")
drill = importlib.util.module_from_spec(spec)
spec.loader.exec_module(drill)


@pytest.mark.parametrize("failure,accepted", [("password authentication failed for user synthetic", True), ("timeout expired", False), (None, False)])
def test_superseded_credential_probe_requires_actual_authentication_rejection(monkeypatch, capsys, failure, accepted):
    class DriverError(Exception):
        sqlstate = None
    def connect(**kwargs):
        assert kwargs['password'] == 'synthetic-old'
        if failure:
            raise DriverError(failure)
        return SimpleNamespace(close=lambda: None)
    monkeypatch.setitem(sys.modules, 'psycopg', SimpleNamespace(connect=connect, OperationalError=DriverError))
    monkeypatch.setenv('STUDIO_DATABASE_HOST', 'owned-database')
    monkeypatch.setattr(sys, 'argv', ['probe', 'synthetic-old'])
    if accepted:
        exec(compile(drill.REJECTED_CREDENTIAL_PROBE, 'synthetic-probe', 'exec'), {})
        assert capsys.readouterr().out == 'superseded_credential_rejected\n'
    else:
        with pytest.raises(SystemExit, match='1'):
            exec(compile(drill.REJECTED_CREDENTIAL_PROBE, 'synthetic-probe', 'exec'), {})
        assert capsys.readouterr().out == ''


def test_release_probe_error_exposes_only_allowlisted_health_enum(monkeypatch):
    container = drill.OwnedReleaseContainer("sha256:" + "a" * 64, "nonce", "worker", SimpleNamespace())
    container.container_id = "b" * 64
    monkeypatch.setattr(container, "verify", lambda: None)
    monkeypatch.setattr(drill.subprocess, "run", lambda *a, **k: SimpleNamespace(returncode=1,
        stdout=b"synthetic-sensitive-body", stderr=b"synthetic-sensitive-secret STUDIO_WORKER_HEALTH_FAIL reason=runtime_identity_invalid"))
    with pytest.raises(drill.DrillFailure) as failure:
        container.exec(["python", "-m", "studio_api.worker_health"])
    assert str(failure.value) == "worker_probe_runtime_identity_invalid"


def test_both_role_manifests_target_only_the_owned_synthetic_database(tmp_path):
    manifest = tmp_path / "deploy/studio"
    manifest.mkdir(parents=True)
    for name, role in [("database-roles.sql", "studio_api"), ("worker-db-role.sql", "studio_worker")]:
        (manifest / name).write_text(f"GRANT CONNECT ON DATABASE studio TO {role};", encoding="utf-8")
    statements = []
    drill.apply_roles(SimpleNamespace(sql=statements.append), tmp_path, password="synthetic-old")
    assert b"DATABASE studio_drill TO studio_api" in statements[0]
    assert b"DATABASE studio_drill TO studio_worker" in statements[1]
    assert not any(b"DATABASE studio TO" in value for value in statements)


@pytest.mark.parametrize("baseline,candidate", [("main", "b"*40), ("a"*40, "HEAD"), ("a"*40, "a"*40)])
def test_release_drill_refuses_mutable_or_identical_revisions_before_docker(baseline, candidate, monkeypatch):
    monkeypatch.setattr(drill, "_run", lambda *a, **k: pytest.fail("Docker called before admission"))
    with pytest.raises(drill.DrillFailure, match="revision_pair_invalid"):
        drill.rehearse(baseline=baseline, candidate=candidate)


@pytest.mark.parametrize("violation", [None, "foreign-image", "foreign-label", "public-port", "bind", "wrong-user", "writable", "foreign-network"])
def test_release_container_operations_require_exact_owned_isolated_target(violation, monkeypatch):
    network = SimpleNamespace(nonce="nonce", name="owned-network", verify=lambda: None)
    container = drill.OwnedReleaseContainer("sha256:" + "a"*64, "nonce", "api", network)
    container.container_id = "b"*64
    row = {"Image": container.image_id, "Name": "/"+container.name,
        "Config": {"Labels": {drill.LABEL: "nonce"}, "User": "10001:10001"},
        "HostConfig": {"ReadonlyRootfs": True, "NetworkMode": network.name, "Binds": [], "PortBindings": {},
            "CapDrop": ["ALL"], "SecurityOpt": ["no-new-privileges"]}, "Mounts": [{"Type": "tmpfs"}]}
    if violation == "foreign-image": row["Image"] = "sha256:"+"c"*64
    if violation == "foreign-label": row["Config"]["Labels"][drill.LABEL] = "other"
    if violation == "public-port": row["HostConfig"]["PortBindings"] = {"8000/tcp": [{"HostIp": "0.0.0.0", "HostPort": "8000"}]}
    if violation == "bind": row["HostConfig"]["Binds"] = ["/production:/data"]
    if violation == "wrong-user": row["Config"]["User"] = "0:0"
    if violation == "writable": row["HostConfig"]["ReadonlyRootfs"] = False
    if violation == "foreign-network": row["HostConfig"]["NetworkMode"] = "bridge"
    monkeypatch.setattr(drill, "_run", lambda *a, **k: json.dumps([row]).encode())
    if violation:
        with pytest.raises(drill.DrillFailure, match="boundary_invalid"): container.verify()
    else:
        assert container.verify() == row


def test_runtime_roles_never_receive_schema_admin_credentials():
    database = SimpleNamespace(nonce="nonce", role="release")
    redis = SimpleNamespace(name="owned-redis")
    for role in ("studio_api", "studio_worker"):
        env = drill.application_env(database, redis, role=role, password="synthetic-new")
        assert env["STUDIO_DATABASE_USER"] == role
        assert env["STUDIO_DATABASE_NAME"] == "studio_drill"
        assert not any("/opt" in value or "production" in value for value in env.values())


@pytest.mark.parametrize("role,user", [("redis", "0:0"), ("web", "0:0"), ("worker", "10001:10001")])
def test_privilege_drop_bootstrap_is_bounded_to_root_api_and_worker(role, user):
    with pytest.raises(drill.DrillFailure, match="privilege_drop_role_invalid"):
        drill.OwnedReleaseContainer("sha256:" + "a" * 64, "nonce", role, SimpleNamespace(), user=user, drop_privileges=True)


def test_rehearsal_selection_is_scoped_to_release_risk():
    spec = importlib.util.spec_from_file_location("ci_rehearsal_selection", ROOT / "scripts/ci_validation.py")
    ci = importlib.util.module_from_spec(spec); spec.loader.exec_module(ci)
    assert ci.requires_release_rehearsal(["apps/studio-api/alembic/versions/0041_source_retention_default.py"])
    assert ci.requires_release_rehearsal(["deploy/studio/worker-db-role.sql"])
    assert not ci.requires_release_rehearsal(["apps/studio/src/App.tsx", "docs/delivery-plan.md"])

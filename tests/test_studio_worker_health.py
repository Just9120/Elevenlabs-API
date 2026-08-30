from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/studio-api"))

from studio_api import worker_health


def test_worker_health_success(monkeypatch, capsys):
    from studio_api import runtime_observability

    calls = []
    monkeypatch.setattr(worker_health, "_pid1_command", lambda: "python -m studio_api.worker")
    monkeypatch.setattr(worker_health, "_valid_runtime_process_identity", lambda: True)
    monkeypatch.setattr(worker_health, "check_worker_database_role", lambda db: calls.append("db-role"))
    class Settings:
        runtime_worker_stale_after_seconds=120
        def sqlalchemy_url(self): return "postgresql://safe"
    monkeypatch.setattr("studio_api.config.Settings", Settings)
    class Conn:
        def __enter__(self): return self
        def __exit__(self, *a): pass
        pass
    class Engine:
        def connect(self): return Conn()
        def dispose(self): calls.append("dispose")
    monkeypatch.setattr(worker_health, "create_engine", lambda url, pool_pre_ping=True: Engine())
    identity=SimpleNamespace(commit_sha="a"*40)
    monkeypatch.setattr(runtime_observability, "settings_runtime_identity", lambda *a, **k: identity)
    monkeypatch.setattr(runtime_observability, "current_worker_runtime_instance_id", lambda: "worker-instance")
    monkeypatch.setattr(runtime_observability, "check_database_readiness", lambda db: calls.append("readiness"))
    def load_status(*args, **kwargs):
        assert kwargs["expected_instance_id"] == "worker-instance"
        return {"status":"ready", "commit_sha":"a"*40}
    monkeypatch.setattr(runtime_observability, "load_worker_runtime_status", load_status)
    assert worker_health.main() == 0
    assert "STUDIO_WORKER_HEALTH_OK" in capsys.readouterr().out
    assert calls == ["readiness", "db-role", "dispose"]


def test_worker_liveness_does_not_touch_configuration_or_dependencies(monkeypatch, capsys):
    monkeypatch.setattr(worker_health, "_pid1_command", lambda: "python -m studio_api.worker")
    monkeypatch.setattr(worker_health, "_valid_runtime_process_identity", lambda: True)
    monkeypatch.setattr("studio_api.config.Settings", lambda: (_ for _ in ()).throw(AssertionError("configuration touched")))
    monkeypatch.setattr(worker_health, "create_engine", lambda *a, **k: (_ for _ in ()).throw(AssertionError("database touched")))
    assert worker_health.main(["--mode", "liveness"]) == 0
    assert "mode=liveness" in capsys.readouterr().out


def test_worker_health_rejects_wrong_pid(monkeypatch, capsys):
    monkeypatch.setattr(worker_health, "_pid1_command", lambda: "uvicorn studio_api.main:app")
    assert worker_health.main() == 1
    err = capsys.readouterr().err
    assert "pid1_not_worker" in err and "uvicorn" not in err


def test_worker_health_invalid_config_is_redacted(monkeypatch, capsys):
    monkeypatch.setattr(worker_health, "_pid1_command", lambda: "python -m studio_api.worker")
    monkeypatch.setattr(worker_health, "_valid_runtime_process_identity", lambda: True)
    class BadSettings:
        def __init__(self): raise RuntimeError("SUPERSECRET raw failure")
    monkeypatch.setattr("studio_api.config.Settings", BadSettings)
    assert worker_health.main() == 1
    captured = capsys.readouterr()
    combined = captured.out + captured.err
    assert "SUPERSECRET" not in combined
    assert "dependency_unavailable" in combined


def test_worker_health_db_unavailable_redacted(monkeypatch, capsys):
    from studio_api import runtime_observability

    monkeypatch.setattr(worker_health, "_pid1_command", lambda: "python -m studio_api.worker")
    monkeypatch.setattr(worker_health, "_valid_runtime_process_identity", lambda: True)
    class Settings:
        runtime_worker_stale_after_seconds=120
        def sqlalchemy_url(self): return "postgresql://secret-token@db"
    monkeypatch.setattr("studio_api.config.Settings", Settings)
    monkeypatch.setattr(runtime_observability, "settings_runtime_identity", lambda *a, **k: SimpleNamespace(commit_sha="a"*40))
    monkeypatch.setattr(runtime_observability, "current_worker_runtime_instance_id", lambda: "worker-instance")
    def boom(*a, **k): raise RuntimeError("secret-token db down")
    monkeypatch.setattr(worker_health, "create_engine", boom)
    assert worker_health.main() == 1
    err = capsys.readouterr().err
    assert "secret-token" not in err
    assert "dependency_unavailable" in err


def test_worker_readiness_rejects_stale_or_wrong_revision_heartbeat(monkeypatch, capsys):
    from studio_api import runtime_observability

    monkeypatch.setattr(worker_health, "_pid1_command", lambda: "python -m studio_api.worker")
    monkeypatch.setattr(worker_health, "_valid_runtime_process_identity", lambda: True)
    monkeypatch.setattr(worker_health, "check_worker_database_role", lambda db: None)
    class Settings:
        runtime_worker_stale_after_seconds=120
        def sqlalchemy_url(self): return "postgresql://safe"
    monkeypatch.setattr("studio_api.config.Settings", Settings)
    monkeypatch.setattr(runtime_observability, "settings_runtime_identity", lambda *a, **k: SimpleNamespace(commit_sha="a"*40))
    monkeypatch.setattr(runtime_observability, "current_worker_runtime_instance_id", lambda: "worker-instance")
    monkeypatch.setattr(runtime_observability, "check_database_readiness", lambda db: None)
    monkeypatch.setattr(runtime_observability, "load_worker_runtime_status", lambda *a, **k: {"status":"stale", "commit_sha":"b"*40})
    class Conn:
        def __enter__(self): return self
        def __exit__(self, *a): pass
    class Engine:
        def connect(self): return Conn()
        def dispose(self): pass
    monkeypatch.setattr(worker_health, "create_engine", lambda *a, **k: Engine())
    assert worker_health.main(["--mode", "readiness"]) == 1
    assert "runtime_heartbeat_unavailable" in capsys.readouterr().err


def test_worker_health_rejects_unexpected_runtime_uid(monkeypatch, capsys):
    monkeypatch.setattr(worker_health, "_pid1_command", lambda: "python -m studio_api.worker")
    monkeypatch.setattr(worker_health, "_valid_runtime_process_identity", lambda: False)
    assert worker_health.main(["--mode", "liveness"]) == 1
    assert "runtime_identity_invalid" in capsys.readouterr().err


def test_worker_database_role_contract_accepts_only_narrow_role():
    class Result:
        def __init__(self, value):
            self.value = value

        def one(self):
            return self.value

    class Connection:
        def __init__(self, rows):
            self.rows = iter(rows)

        def execute(self, _statement):
            return Result(next(self.rows))

    worker_health.check_worker_database_role(
        Connection(
            [
                ("studio_worker", True, False, False, False, False, False, False, True),
                (True, False, True, True, True, True, False, False),
            ]
        )
    )
    with pytest.raises(RuntimeError, match="worker_database_role_invalid"):
        worker_health.check_worker_database_role(
            Connection(
                [
                    ("studio", True, True, True, True, True, True, True, False),
                    (True, True, True, True, True, True, True, True),
                ]
            )
        )
    with pytest.raises(RuntimeError, match="worker_database_privileges_invalid"):
        worker_health.check_worker_database_role(
            Connection(
                [
                    ("studio_worker", True, False, False, False, False, False, False, True),
                    (True, False, True, True, True, True, True, False),
                ]
            )
        )

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/studio-api"))

from studio_api import worker_health


def test_worker_health_success(monkeypatch, capsys):
    calls = []
    monkeypatch.setattr(worker_health, "_pid1_command", lambda: "python -m studio_api.worker")
    class Settings:
        worker_poll_interval_seconds=5; worker_error_backoff_seconds=5; worker_lease_ttl_seconds=3600
        def sqlalchemy_url(self): return "postgresql://safe"
    monkeypatch.setattr("studio_api.config.Settings", Settings)
    class Conn:
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def execute(self, stmt): calls.append(str(stmt))
    class Engine:
        def connect(self): return Conn()
        def dispose(self): calls.append("dispose")
    monkeypatch.setattr(worker_health, "create_engine", lambda url, pool_pre_ping=True: Engine())
    assert worker_health.main() == 0
    assert "STUDIO_WORKER_HEALTH_OK" in capsys.readouterr().out
    assert calls == ["SELECT 1", "dispose"]


def test_worker_health_rejects_wrong_pid(monkeypatch, capsys):
    monkeypatch.setattr(worker_health, "_pid1_command", lambda: "uvicorn studio_api.main:app")
    assert worker_health.main() == 1
    err = capsys.readouterr().err
    assert "pid1_not_worker" in err and "uvicorn" not in err


def test_worker_health_invalid_config_is_redacted(monkeypatch, capsys):
    monkeypatch.setattr(worker_health, "_pid1_command", lambda: "python -m studio_api.worker")
    class BadSettings:
        def __init__(self): raise RuntimeError("SUPERSECRET raw failure")
    monkeypatch.setattr("studio_api.config.Settings", BadSettings)
    assert worker_health.main() == 1
    captured = capsys.readouterr()
    combined = captured.out + captured.err
    assert "SUPERSECRET" not in combined
    assert "dependency_unavailable" in combined


def test_worker_health_db_unavailable_redacted(monkeypatch, capsys):
    monkeypatch.setattr(worker_health, "_pid1_command", lambda: "python -m studio_api.worker")
    class Settings:
        worker_poll_interval_seconds=5; worker_error_backoff_seconds=5; worker_lease_ttl_seconds=3600
        def sqlalchemy_url(self): return "postgresql://secret-token@db"
    monkeypatch.setattr("studio_api.config.Settings", Settings)
    def boom(*a, **k): raise RuntimeError("secret-token db down")
    monkeypatch.setattr(worker_health, "create_engine", boom)
    assert worker_health.main() == 1
    err = capsys.readouterr().err
    assert "secret-token" not in err
    assert "dependency_unavailable" in err

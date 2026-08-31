import importlib.util
from pathlib import Path
import stat
from types import SimpleNamespace

import pytest


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "worker_secret_probe", ROOT / "scripts/check_studio_worker_secret.py"
)
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


def metadata(mode, uid=0, size=32):
    return SimpleNamespace(st_mode=mode, st_uid=uid, st_size=size)


@pytest.mark.parametrize("mode", [0o400, 0o600])
def test_root_only_secret_metadata_never_reads_contents(monkeypatch, mode):
    def lstat(path):
        return metadata(stat.S_IFDIR | 0o700) if path.name == "probe" else metadata(stat.S_IFREG | mode)

    def forbidden(*args, **kwargs):
        raise AssertionError("secret contents must never be opened")

    monkeypatch.setattr(Path, "lstat", lstat)
    monkeypatch.setattr(Path, "open", forbidden)
    monkeypatch.setattr(probe.os, "open", forbidden)
    assert probe.validate_metadata(Path("/probe"), "password")


@pytest.mark.parametrize("parent,secret", [
    (metadata(stat.S_IFDIR | 0o777), metadata(stat.S_IFREG | 0o600)),
    (metadata(stat.S_IFDIR | 0o700, uid=10001), metadata(stat.S_IFREG | 0o600)),
    (metadata(stat.S_IFLNK | 0o700), metadata(stat.S_IFREG | 0o600)),
    (metadata(stat.S_IFDIR | 0o700), metadata(stat.S_IFREG | 0o600, uid=10001)),
    (metadata(stat.S_IFDIR | 0o700), metadata(stat.S_IFLNK | 0o600)),
    (metadata(stat.S_IFDIR | 0o700), metadata(stat.S_IFDIR | 0o600)),
    (metadata(stat.S_IFDIR | 0o700), metadata(stat.S_IFIFO | 0o600)),
    (metadata(stat.S_IFDIR | 0o700), metadata(stat.S_IFREG | 0o644)),
    (metadata(stat.S_IFDIR | 0o700), metadata(stat.S_IFREG | 0o660)),
    (metadata(stat.S_IFDIR | 0o700), metadata(stat.S_IFREG | 0o600, size=0)),
    (metadata(stat.S_IFDIR | 0o700), metadata(stat.S_IFREG | 0o600, size=65537)),
])
def test_unsafe_metadata_is_rejected(monkeypatch, parent, secret):
    monkeypatch.setattr(Path, "lstat", lambda path: parent if path.name == "probe" else secret)
    assert not probe.validate_metadata(Path("/probe"), "password")


@pytest.mark.parametrize("name", ["", ".", "..", "../password", "/password", "x\\password"])
def test_filename_cannot_escape_mount(name):
    assert not probe.validate_metadata(Path("/probe"), name)


def test_missing_or_inaccessible_file_is_rejected(monkeypatch):
    def missing(path):
        raise FileNotFoundError()
    monkeypatch.setattr(Path, "lstat", missing)
    assert not probe.validate_metadata(Path("/probe"), "password")


def test_ci_replays_real_root_only_mount_and_negative_cases():
    workflow = (ROOT / ".github/workflows/studio-ci.yml").read_text(encoding="utf-8")
    step = workflow.split("- name: Verify metadata-only worker secret probe", 1)[1].split("- name:", 1)[0]
    for required in [
        "sudo chown root:root", "chmod 700", "chmod 600", "sudo -u nobody test -f",
        "task_probe password", "task_probe link", "task_probe absent", "sudo truncate",
        "STUDIO_WORKER_SECRET_METADATA_OK",
    ]:
        assert required in step
    script = (ROOT / "scripts/studio_processing_preflight.sh").read_text(encoding="utf-8")
    for boundary in [
        "--pull never --network none --read-only --user 0:0",
        "--cap-drop ALL --security-opt no-new-privileges --pids-limit 32",
        "--memory 64m --memory-swap 64m --cpus 0.25 --log-driver none",
        "readonly,bind-recursive=disabled", "-I -S -", "< scripts/check_studio_worker_secret.py",
    ]:
        assert boundary in step and boundary in script

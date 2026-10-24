from __future__ import annotations

import hashlib
import os
import subprocess
from pathlib import Path

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey


ROOT = Path(__file__).resolve().parents[1]
pytestmark = pytest.mark.skipif(os.name == "nt", reason="POSIX wrapper ownership/modes; required Linux CI")


def _git(repo: Path, *args: str) -> str:
    return subprocess.check_output(["git", "-C", str(repo), *args], text=True).strip()


@pytest.fixture
def signed_release(tmp_path):
    repo = tmp_path / "checkout"
    repo.mkdir()
    _git(repo, "init", "-b", "main")
    _git(repo, "config", "user.email", "synthetic@example.invalid")
    _git(repo, "config", "user.name", "Synthetic release")
    _git(repo, "remote", "add", "origin", "https://github.com/Just9120/voiceops-studio.git")
    (repo / "base").write_text("base\n")
    _git(repo, "add", ".")
    _git(repo, "commit", "-m", "base")
    base = _git(repo, "rev-parse", "HEAD")
    marker = tmp_path / "runner-executed"
    (repo / "scripts").mkdir()
    (repo / "scripts/release_studio_platform_migration.sh").write_text(f"touch '{marker}'\n")
    _git(repo, "add", ".")
    _git(repo, "commit", "-m", "synthetic descendant runner")
    commit = _git(repo, "rev-parse", "HEAD")
    bundle = tmp_path / "release.bundle"
    _git(repo, "bundle", "create", str(bundle), "HEAD")
    _git(repo, "reset", "--hard", base)
    _git(repo, "update-ref", "refs/remotes/origin/main", base)
    digest = hashlib.sha256(bundle.read_bytes()).hexdigest()
    key = Ed25519PrivateKey.generate()
    trust = tmp_path / "trust"
    trust.mkdir(mode=0o700)
    pub = trust / "signing.pub"
    pub.write_bytes(key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo))
    pub.chmod(0o400)
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    # Only privilege/identity operations are simulated. Real Git, openssl,
    # permissions, signature, bundle validation, ref promotion and runner execute.
    for name, body in {
        "id": "printf '0\\n'\n",
        "runuser": 'shift 3\nexec "$@"\n',
        "chown": "exit 0\n",
        "stat": 'if [[ "$1" == -c && "$2" == %u ]]; then echo 0; else exec /usr/bin/stat "$@"; fi\n',
    }.items():
        path = fake_bin / name
        path.write_text("#!/usr/bin/env bash\n" + body)
        path.chmod(0o700)
    wrapper = tmp_path / "wrapper"
    source = (ROOT / "deploy/studio/studio-migration-release-wrapper.sh").read_text()
    source = source.replace('PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"', f'PATH="{fake_bin}:$PATH"')
    source = source.replace('DEPLOY_DIR="/opt/elevenlabs-studio"', f'DEPLOY_DIR="{repo}"')
    source = source.replace('INSTALLED_PATH="/usr/local/sbin/studio-migration-release-wrapper"', f'INSTALLED_PATH="{wrapper}"')
    source = source.replace('SIGNING_DIRECTORY="/etc/studio-migration-release"', f'SIGNING_DIRECTORY="{trust}"')
    source = source.replace('/run/lock/studio-migration-release.lock', str(tmp_path / "release.lock"))
    source = source.replace('/run/studio-migration-', str(tmp_path / "studio-migration-"))
    wrapper.write_text(source)
    wrapper.chmod(0o500)
    return repo, base, commit, bundle, digest, key, wrapper, marker, pub


def _run_release(fixture, *, signing_key=None, signed_target="head", command_target="head", signed_digest=None, unsigned=False):
    import base64

    repo, base, commit, bundle, digest, key, wrapper, marker, pub = fixture
    payload = f"voiceops-studio-migration-release-v1\nJust9120/voiceops-studio\n{commit}\n{signed_target}\n{signed_digest or digest}\n".encode()
    signature = base64.b64encode((signing_key or key).sign(payload)).decode()
    command = f"release-bundle {commit} {command_target} {digest}"
    if not unsigned:
        command += " " + signature
    result = subprocess.run(["bash", str(wrapper)], input=bundle.read_bytes(), capture_output=True,
                            env={**os.environ, "SSH_ORIGINAL_COMMAND": command, "SSH_TTY": ""})
    return result


@pytest.mark.parametrize("attack", ["unsigned", "wrong_key", "target", "digest", "writable_key"])
def test_unapproved_descendant_bundle_never_promotes_or_executes(signed_release, attack):
    kwargs = {"unsigned": True} if attack == "unsigned" else {}
    if attack == "wrong_key":
        kwargs["signing_key"] = Ed25519PrivateKey.generate()
    if attack == "target":
        kwargs["command_target"] = "0042_totp_replay"
    if attack == "digest":
        kwargs["signed_digest"] = "0" * 64
    if attack == "writable_key":
        signed_release[-1].chmod(0o666)
    result = _run_release(signed_release, **kwargs)
    repo, base, _, _, _, _, _, marker, _ = signed_release
    assert result.returncode == 2, result.stderr.decode()
    assert not marker.exists()
    assert _git(repo, "rev-parse", "HEAD") == base
    assert _git(repo, "rev-parse", "origin/main") == base


def test_independently_signed_exact_bundle_preserves_release(signed_release):
    result = _run_release(signed_release)
    repo, _, commit, _, _, _, _, marker, _ = signed_release
    assert result.returncode == 0, result.stderr.decode()
    assert marker.exists()
    assert _git(repo, "rev-parse", "HEAD") == commit
    assert _git(repo, "rev-parse", "origin/main") == commit

from __future__ import annotations

import importlib.util
import re
import shlex
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
from scripts.test_shell_environment import repository_bash


ROOT = Path(__file__).resolve().parents[1]
RELEASE_SCRIPT = ROOT / "scripts" / "release_studio_edge.sh"
WRAPPER = ROOT / "deploy" / "studio" / "studio-edge-release-wrapper.sh"
HEADERS = ROOT / "deploy" / "studio" / "studio-security-headers.conf"
CD_WORKFLOW = ROOT / ".github" / "workflows" / "studio-edge-cd.yml"
STUDIO_CI_WORKFLOW = ROOT / ".github" / "workflows" / "studio-ci.yml"


def _embedded_python_programs() -> list[str]:
    return re.findall(
        r"<<'PY'\n(.*?)\nPY",
        RELEASE_SCRIPT.read_text(encoding="utf-8"),
        flags=re.DOTALL,
    )


def _run_header_validator(tmp_path: Path, content: str) -> None:
    candidate = tmp_path / "candidate.conf"
    candidate.write_text(content, encoding="utf-8")
    program = _embedded_python_programs()[0]
    previous_argv = sys.argv
    try:
        sys.argv = ["<studio-edge-header-validator>", str(candidate)]
        exec(compile(program, "<studio-edge-header-validator>", "exec"), {})
    finally:
        sys.argv = previous_argv


def _run_response_validator(tmp_path, response):
    candidate = tmp_path / "candidate.conf"
    candidate.write_text(HEADERS.read_text(encoding="utf-8"), encoding="utf-8")
    observed = tmp_path / "response.headers"
    observed.write_bytes(response.encode("iso-8859-1"))
    program = _embedded_python_programs()[1]
    previous_argv = sys.argv
    try:
        sys.argv = ["<studio-edge-response-validator>", str(candidate), str(observed)]
        exec(compile(program, "<studio-edge-response-validator>", "exec"), {})
    finally:
        sys.argv = previous_argv


def _canonical_http_response(status="HTTP/1.1 200 OK"):
    fields = re.findall(r'^add_header ([A-Za-z-]+) "([^"\r\n]+)" always;$',
                        HEADERS.read_text(encoding="utf-8"), re.M)
    assert len(fields) == 6
    return status + "\r\nServer: nginx\r\nContent-Type: text/html\r\n" + "".join(
        f"{name}: {value}\r\n" for name, value in fields
    ) + "\r\n"


@pytest.mark.parametrize("status", ["HTTP/1.1 200 OK", "HTTP/1.0 200 OK", "HTTP/2 200", "HTTP/3 200"])
def test_response_validator_accepts_real_http_envelope(tmp_path, status):
    _run_response_validator(tmp_path, _canonical_http_response(status))


def test_response_validator_uses_final_response_after_proxy_or_interim_blocks(tmp_path):
    response = "HTTP/1.1 200 Connection established\r\n\r\nHTTP/1.1 100 Continue\r\n\r\n"
    _run_response_validator(tmp_path, response + _canonical_http_response())


@pytest.mark.parametrize("failure", ["missing", "duplicate", "wrong", "non_200", "no_status"])
def test_response_validator_still_rejects_security_header_or_status_mismatch(tmp_path, failure):
    response = _canonical_http_response()
    if failure == "missing":
        response = response.replace("X-Frame-Options: DENY\r\n", "")
    elif failure == "duplicate":
        response = response.replace("X-Frame-Options: DENY\r\n", "X-Frame-Options: DENY\r\nX-Frame-Options: DENY\r\n")
    elif failure == "wrong":
        response = response.replace("X-Frame-Options: DENY", "X-Frame-Options: SAMEORIGIN")
    elif failure == "non_200":
        response = response.replace("HTTP/1.1 200 OK", "HTTP/1.1 403 Forbidden")
    else:
        response = response.partition("\r\n")[2]
    with pytest.raises(SystemExit):
        _run_response_validator(tmp_path, response)


def test_forced_command_wrapper_accepts_only_exact_main_release() -> None:
    wrapper = WRAPPER.read_text(encoding="utf-8")

    assert r"^release\ ([0-9a-f]{40})$" in wrapper
    assert 'requested_commit="${BASH_REMATCH[1]}"' in wrapper
    assert '[[ "$remote_commit" == "$requested_commit" ]]' in wrapper
    assert 'repo_git merge --ff-only "origin/$EXPECTED_BRANCH"' in wrapper
    assert 'repo_git show "${requested_commit}:${RELEASE_SCRIPT}"' in wrapper
    assert "env -i" in wrapper
    assert 'STUDIO_EDGE_RELEASE_LOCK_HELD=yes' in wrapper
    assert 'INSTALLED_PATH="/usr/local/sbin/studio-edge-release-wrapper"' in wrapper
    assert "eval " not in wrapper
    assert 'bash -c "${SSH_ORIGINAL_COMMAND' not in wrapper
    assert "sudo " not in wrapper


def test_release_is_limited_to_host_edge_headers() -> None:
    release = RELEASE_SCRIPT.read_text(encoding="utf-8")

    assert 'SOURCE_HEADERS="deploy/studio/studio-security-headers.conf"' in release
    assert "/etc/nginx/sites-enabled/studio.librechat.online" in release
    assert "/etc/nginx/snippets/studio-security-headers.conf" in release
    assert "/var/backups/elevenlabs-studio/nginx" in release
    assert "nginx -t" in release
    assert "systemctl reload nginx" in release
    assert 'rollback="completed"' in release
    assert "local_tls_headers_mismatch" in release
    assert "public_tls_headers_mismatch" in release
    assert "localhost_api_health_failed" in release
    assert "public_api_health_failed" in release

    for forbidden in (
        "docker ",
        "alembic",
        "postgres",
        "redis",
        "pg_restore",
        "deploy/studio/.env",
        "compose.platform.yml",
    ):
        assert forbidden not in release.lower()


def test_release_environment_overrides_are_not_forwarded_by_wrapper() -> None:
    release = RELEASE_SCRIPT.read_text(encoding="utf-8")
    wrapper = WRAPPER.read_text(encoding="utf-8")

    for name in (
        "STUDIO_EDGE_ACTIVE_SITE",
        "STUDIO_EDGE_ACTIVE_HEADERS",
        "STUDIO_EDGE_BACKUP_ROOT",
        "STUDIO_EDGE_PUBLIC_ORIGIN",
        "STUDIO_EDGE_FIXED_PATH",
        "STUDIO_EDGE_PYTHON_BIN",
    ):
        assert name in release
        assert name not in wrapper


def test_embedded_release_python_programs_compile() -> None:
    programs = _embedded_python_programs()

    assert len(programs) == 2
    for index, program in enumerate(programs, start=1):
        compile(program, f"<studio-edge-release-embedded-{index}>", "exec")


def test_header_validator_accepts_only_canonical_allowlist(tmp_path: Path) -> None:
    _run_header_validator(tmp_path, HEADERS.read_text(encoding="utf-8"))

    invalid = HEADERS.read_text(encoding="utf-8") + "\ninclude /tmp/unsafe.conf;\n"
    with pytest.raises(SystemExit):
        _run_header_validator(tmp_path, invalid)


def test_shell_programs_have_valid_syntax() -> None:
    bash = shutil.which("bash")
    if bash is None and sys.platform == "win32":
        candidate = Path("C:/Program Files/Git/bin/bash.exe")
        bash = str(candidate) if candidate.exists() else None
    if bash is None:
        pytest.skip("bash is unavailable")

    for path in (RELEASE_SCRIPT, WRAPPER):
        proc = subprocess.run(
            [bash, "-n", str(path)],
            text=True,
            capture_output=True,
            timeout=10,
        )
        assert proc.returncode == 0, proc.stderr


def test_edge_cd_is_manual_exact_main_and_protected() -> None:
    workflow = CD_WORKFLOW.read_text(encoding="utf-8")

    assert "workflow_dispatch:" in workflow
    assert "push:" not in workflow
    assert "pull_request:" not in workflow
    assert "expected_commit:" in workflow
    assert 'vars.STUDIO_EDGE_RELEASE_ENABLED' in workflow
    assert '[[ "$EDGE_RELEASE_ENABLED" == "true" ]]' in workflow
    assert '[[ "${{ github.ref }}" == "refs/heads/main" ]]' in workflow
    assert '[[ "$checked_out_commit" == "$EXPECTED_COMMIT" ]]' in workflow
    assert "environment: studio-production-migration" in workflow
    assert "cancel-in-progress: false" in workflow


def test_edge_cd_uses_only_dedicated_forced_command_identity() -> None:
    workflow = CD_WORKFLOW.read_text(encoding="utf-8")

    for secret in (
        "STUDIO_EDGE_DEPLOY_HOST",
        "STUDIO_EDGE_SSH_KEY",
        "STUDIO_EDGE_KNOWN_HOSTS",
    ):
        assert secret in workflow
    assert '"root@$DEPLOY_HOST"' in workflow
    assert '"release $RELEASE_SHA"' in workflow
    assert "StrictHostKeyChecking=yes" in workflow
    assert "UserKnownHostsFile=~/.ssh/studio_edge_known_hosts" in workflow
    assert "[studio-edge-release] OK commit=" in workflow
    assert "[studio-edge-release-wrapper] OK commit=" in workflow
    assert "bash -s" not in workflow
    assert "nginx -t" not in workflow
    assert "systemctl reload nginx" not in workflow


def test_studio_ci_watches_edge_release_contract_files() -> None:
    workflow = STUDIO_CI_WORKFLOW.read_text(encoding="utf-8")

    for path in (
        ".github/workflows/studio-edge-cd.yml",
        "scripts/release_studio_edge.sh",
        "scripts/prepare_studio_edge_known_hosts.py",
        "tests/test_studio_edge_release.py",
    ):
        assert workflow.count(f"- '{path}'") == 2


@pytest.mark.parametrize("directive", ["access_log /tmp/leak.log;", "access_log on;", "proxy_pass http://evil;", "access_log off;"])
def test_edge_validator_rejects_logging_destinations_and_duplicate_disable(tmp_path, directive):
    with pytest.raises(SystemExit):
        _run_header_validator(tmp_path, HEADERS.read_text(encoding="utf-8") + "\n" + directive)


@pytest.fixture
def pinned_host(tmp_path):
    key = tmp_path / "synthetic_host"
    subprocess.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", str(key)],
                   capture_output=True, check=True, timeout=10)
    public = key.with_suffix(".pub").read_text().split()
    return "example.com " + " ".join(public[:2]) + "\n"


def _prepare_host_trust(destination, environment):
    spec = importlib.util.spec_from_file_location("edge_host_trust", ROOT / "scripts/prepare_studio_edge_known_hosts.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.prepare(destination, environment)


def test_same_target_uses_existing_component_pin_without_reusing_authentication(tmp_path, pinned_host):
    destination = tmp_path / "hosts"
    source = _prepare_host_trust(destination, {
        "DEPLOY_HOST": "example.com", "COMPONENT_DEPLOY_HOST": "example.com",
        "COMPONENT_KNOWN_HOSTS": pinned_host, "DEPLOY_KNOWN_HOSTS": "obsolete invalid pin",
    })
    assert source == "component-same-target"
    assert destination.read_text() == pinned_host
    if sys.platform != "win32":
        assert destination.stat().st_mode & 0o777 == 0o600
    workflow = CD_WORKFLOW.read_text()
    assert "secrets.DEPLOY_SSH_KEY" not in workflow
    assert "secrets.STUDIO_EDGE_SSH_KEY" in workflow
    assert "ssh-keyscan" not in workflow
    assert "StrictHostKeyChecking=yes" in workflow


def test_different_target_keeps_dedicated_pin(tmp_path, pinned_host):
    destination = tmp_path / "hosts"
    assert _prepare_host_trust(destination, {
        "DEPLOY_HOST": "example.com", "COMPONENT_DEPLOY_HOST": "other.example.com",
        "COMPONENT_KNOWN_HOSTS": "invalid", "DEPLOY_KNOWN_HOSTS": pinned_host,
    }) == "edge"


@pytest.mark.parametrize("content", ["", "example.com ssh-ed25519 invalid", "other.example.com ssh-ed25519 invalid"])
def test_invalid_or_unmatched_pin_fails_before_ssh_and_removes_file(tmp_path, content):
    destination = tmp_path / "hosts"
    with pytest.raises(ValueError):
        _prepare_host_trust(destination, {"DEPLOY_HOST": "example.com", "DEPLOY_KNOWN_HOSTS": content})
    assert not destination.exists()


def test_different_target_cannot_borrow_component_trust(tmp_path, pinned_host):
    with pytest.raises(ValueError):
        _prepare_host_trust(tmp_path / "hosts", {
            "DEPLOY_HOST": "different.example.com", "COMPONENT_DEPLOY_HOST": "example.com",
            "COMPONENT_KNOWN_HOSTS": pinned_host, "DEPLOY_KNOWN_HOSTS": "",
        })


def test_valid_pin_for_other_host_cannot_authorize_edge(tmp_path, pinned_host):
    destination = tmp_path / "hosts"
    with pytest.raises(ValueError):
        _prepare_host_trust(destination, {
            "DEPLOY_HOST": "other.example.com", "DEPLOY_KNOWN_HOSTS": pinned_host,
        })
    assert not destination.exists()


def test_invalid_canonical_pin_does_not_fall_back_to_another_identity(tmp_path, pinned_host):
    with pytest.raises(ValueError):
        _prepare_host_trust(tmp_path / "hosts", {
            "DEPLOY_HOST": "example.com", "COMPONENT_DEPLOY_HOST": "example.com",
            "COMPONENT_KNOWN_HOSTS": "invalid", "DEPLOY_KNOWN_HOSTS": pinned_host,
        })


def test_existing_trust_file_is_not_overwritten(tmp_path, pinned_host):
    destination = tmp_path / "hosts"
    destination.write_text("existing operator file")
    with pytest.raises(FileExistsError):
        _prepare_host_trust(destination, {"DEPLOY_HOST": "example.com", "DEPLOY_KNOWN_HOSTS": pinned_host})
    assert destination.read_text() == "existing operator file"


def _run_active_site_resolver(site, available, *, owner=0):
    release = RELEASE_SCRIPT.read_text(encoding="utf-8")
    helpers = release[release.index("require_root_file() {"):release.index("validate_headers_file() {")]
    program = f'''set -eu
PREFIX="[synthetic-edge]"
blocked() {{ printf '%s\\n' "$1" >&2; exit 2; }}
stat() {{ if [[ "$1" == "-c" && "$2" == "%u" ]]; then printf '%s\\n' {owner}; else command stat "$@"; fi; }}
ACTIVE_SITE={shlex.quote(str(site))}
{helpers}
resolve_active_site {shlex.quote(str(available))}
printf 'resolved=%s\\n' "$ACTIVE_SITE"
'''
    return subprocess.run([repository_bash(), "-c", program], capture_output=True, text=True, timeout=10)


@pytest.mark.skipif(sys.platform == "win32", reason="POSIX nginx symlinks/modes; required Linux CI")
@pytest.mark.parametrize("layout", ["regular", "symlink", "broken", "outside", "non_root", "writable_directory"])
def test_active_site_resolver_preserves_narrow_root_owned_boundary(tmp_path, layout):
    # Simulate root ownership only; filesystem links, paths and permissions are real.
    enabled = tmp_path / "sites-enabled"
    available = tmp_path / "sites-available"
    enabled.mkdir(mode=0o755)
    available.mkdir(mode=0o755)
    tmp_path.chmod(0o755)
    site = enabled / "studio.librechat.online"
    target = available / "studio.librechat.online"
    target.write_text("synthetic site config")
    if layout == "regular":
        site.write_text("synthetic site config")
    elif layout == "outside":
        outside = tmp_path / "outside"
        outside.write_text("different config")
        site.symlink_to(outside)
    else:
        site.symlink_to(target)
    if layout == "broken":
        target.unlink()
    if layout == "writable_directory":
        available.chmod(0o777)
    result = _run_active_site_resolver(site, available, owner=1001 if layout == "non_root" else 0)
    if layout in ("regular", "symlink"):
        assert result.returncode == 0, result.stderr
        assert f"resolved={target if layout == 'symlink' else site}" in result.stdout
        assert site.read_text() == "synthetic site config"
    else:
        assert result.returncode == 2
        assert "active_site" in result.stderr


def test_active_site_resolution_does_not_change_release_targets():
    release = RELEASE_SCRIPT.read_text(encoding="utf-8")
    assert "resolve_active_site\nrequire_root_file \"$ACTIVE_HEADERS\"" in release
    assert '[[ "$(dirname -- "$target")" == "$available_directory" ]]' in release
    assert 'local available_directory="${1:-/etc/nginx/sites-available}"' in release
    assert "ln -s" not in release
    assert "active_site_include_mismatch" in release


def test_hashed_host_pin_is_supported(tmp_path, pinned_host):
    source = tmp_path / "source"
    source.write_text(pinned_host)
    subprocess.run(["ssh-keygen", "-H", "-f", str(source)], capture_output=True, check=True, timeout=10)
    assert _prepare_host_trust(tmp_path / "hosts", {
        "DEPLOY_HOST": "example.com", "DEPLOY_KNOWN_HOSTS": source.read_text(),
    }) == "edge"


def test_host_trust_failure_output_does_not_expose_values(tmp_path):
    import os
    environment = dict(os.environ, DEPLOY_HOST="private.invalid", DEPLOY_KNOWN_HOSTS="secret-invalid-payload",
                       COMPONENT_DEPLOY_HOST="", COMPONENT_KNOWN_HOSTS="")
    result = subprocess.run([sys.executable, str(ROOT / "scripts/prepare_studio_edge_known_hosts.py"), str(tmp_path / "hosts")],
                            env=environment, capture_output=True, text=True, timeout=20)
    assert result.returncode == 1
    assert "no SSH connection attempted" in result.stderr
    assert "private.invalid" not in result.stderr
    assert "secret-invalid-payload" not in result.stderr

from __future__ import annotations

import re
import shutil
import subprocess
import sys
from pathlib import Path

import pytest


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
        "tests/test_studio_edge_release.py",
    ):
        assert workflow.count(f"- '{path}'") == 2

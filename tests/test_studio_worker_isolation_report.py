"""Exercise the actual status function without a Docker daemon or host fixtures."""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/manage_studio_worker.sh"
pytestmark = pytest.mark.skipif(
    shutil.which("bash") is None and os.environ.get("CI") != "true",
    reason="Bash is unavailable locally; the real shell regression remains mandatory in CI",
)


@pytest.mark.parametrize("capabilities,expected", [
    (["CHOWN", "SETGID", "SETUID"], "yes"),
    (["CAP_CHOWN", "CAP_SETGID", "CAP_SETUID"], "yes"),
    (["CHOWN", "CAP_SETGID", "SETUID"], "yes"),
    (["CAP_CHOWN", "CAP_SETGID", "CAP_SETUID", "CAP_DAC_OVERRIDE"], "no"),
    (["CAP_CHOWN", "CAP_SETGID"], "no"),
    (["CAP_CAP_CHOWN", "CAP_SETGID", "CAP_SETUID"], "no"),
    (["CHOWN", "SETGID", "SYS_ADMIN"], "no"),
    ([], "no"),
])
def test_status_compares_capability_aliases_without_accepting_extra_privileges(capabilities, expected):
    function = re.search(r"(?ms)^container_isolation_report\(\) \{.*?^\}", SCRIPT.read_text()).group()
    fake_inspect = r'''
inspect_field() {
  case "$1" in
    *NanoCpus*) echo 2000000000 ;;
    *MemorySwap*|*Memory*) echo 4294967296 ;;
    *PidsLimit*) echo 256 ;;
    *ReadonlyRootfs*) echo true ;;
    *CapDrop*) echo '["ALL"]' ;;
    *CapAdd*) printf '%s\n' "$TEST_CAP_ADD" ;;
    *SecurityOpt*) echo '["no-new-privileges:true"]' ;;
    *NetworkSettings.Networks*) echo 'elevenlabs-studio-platform_studio-worker-db,elevenlabs-studio-platform_studio-worker-egress,' ;;
    *) exit 99 ;;
  esac
}
container_isolation_report synthetic-container
'''
    raw = json.dumps(capabilities, separators=(",", ":"))
    result = subprocess.run(
        ["bash", "-c", "set -euo pipefail\n" + function + fake_inspect],
        env={**os.environ, "TEST_CAP_ADD": raw}, text=True, capture_output=True, timeout=10,
    )
    assert result.returncode == 0, result.stderr
    assert f"cap_add={raw}\n" in result.stdout  # Preserve actual evidence verbatim.
    assert f"isolation_match={expected}\n" in result.stdout

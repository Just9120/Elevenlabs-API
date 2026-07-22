from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
RUNTIME_REQUIREMENTS = ROOT / "apps" / "studio-api" / "requirements.txt"
RUNTIME_CONSTRAINTS = ROOT / "apps" / "studio-api" / "constraints.txt"
DEV_CONSTRAINTS = ROOT / "constraints-dev.txt"


def _pins(path: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        match = re.match(r"^([A-Za-z0-9_.-]+)(?:\[[^]]+\])?==([^\s;]+)", line.strip())
        if match:
            result[match.group(1).lower().replace("_", "-")] = match.group(2)
    return result


def test_runtime_direct_pins_are_identical_in_both_constraint_sets():
    direct = _pins(RUNTIME_REQUIREMENTS)
    runtime = _pins(RUNTIME_CONSTRAINTS)
    dev = _pins(DEV_CONSTRAINTS)

    assert direct
    assert all(runtime.get(name) == version for name, version in direct.items())
    assert all(dev.get(name) == version for name, version in runtime.items())
    assert "python-multipart" not in runtime
    assert dev["pytest"]
    assert dev["httpx2"] == "2.7.0"


def test_ci_and_container_apply_constraints_to_source_requirements():
    dockerfile = (ROOT / "apps" / "studio-api" / "Dockerfile").read_text(encoding="utf-8")
    ci = (ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")

    assert "COPY requirements.txt constraints.txt ./" in dockerfile
    assert "pip install --no-cache-dir -r requirements.txt -c constraints.txt" in dockerfile
    assert "pip install -r requirements-dev.txt -c constraints-dev.txt" in ci

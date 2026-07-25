import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "dependency-audit.yml"
STUDIO_CI_WORKFLOW = ROOT / ".github" / "workflows" / "studio-ci.yml"
STUDIO = ROOT / "apps" / "studio"


def test_dependency_audit_is_scheduled_and_manual_not_an_ordinary_ci_gate():
    workflow = WORKFLOW.read_text(encoding="utf-8")
    triggers = workflow.split("permissions:", 1)[0]

    assert "schedule:" in triggers
    assert "workflow_dispatch:" in triggers
    assert "pull_request:" not in triggers
    assert "push:" not in triggers
    assert "permissions:\n  contents: read" in workflow
    assert "timeout-minutes:" in workflow
    assert "cancel-in-progress: true" in workflow


def test_dependency_audit_covers_exact_node_and_installed_python_graphs():
    workflow = WORKFLOW.read_text(encoding="utf-8")

    assert "npm ci --ignore-scripts" in workflow
    assert "npm audit --audit-level=low" in workflow
    assert "python -m pip install pip-audit==2.10.1" in workflow
    assert 'python -m pip install --target "$RUNNER_TEMP/studio-python-audit" -r requirements-dev.txt -c constraints-dev.txt' in workflow
    assert 'python -m pip_audit --strict --path "$RUNNER_TEMP/studio-python-audit"' in workflow


def test_studio_lock_pins_the_compatible_postcss_override():
    package = json.loads((STUDIO / "package.json").read_text(encoding="utf-8"))
    lock = json.loads((STUDIO / "package-lock.json").read_text(encoding="utf-8"))
    postcss = lock["packages"]["node_modules/postcss"]

    assert package["overrides"]["postcss"] == "8.5.23"
    assert postcss["version"] == "8.5.23"
    assert postcss["resolved"] == "https://registry.npmjs.org/postcss/-/postcss-8.5.23.tgz"
    assert postcss["integrity"] == (
        "sha512-g50586zr4bZmwFiTlflMu8E0bDTb5I5gertgwAKmsdUlTQIhZtunzUlD1WSzwcVWPoAVpsrA6vlfCD7oXvRwgg=="
    )


def test_studio_uses_the_supported_eslint_runtime_contract():
    package = json.loads((STUDIO / "package.json").read_text(encoding="utf-8"))
    lock = json.loads((STUDIO / "package-lock.json").read_text(encoding="utf-8"))
    packages = lock["packages"]

    assert package["devDependencies"]["eslint"] == "10.8.0"
    assert package["devDependencies"]["@eslint/js"] == "10.0.1"
    assert package["engines"]["node"] == "^20.19.0 || ^22.13.0 || >=24"
    assert packages["node_modules/eslint"]["version"] == "10.8.0"
    assert packages["node_modules/@eslint/js"]["version"] == "10.0.1"
    assert packages["node_modules/minimatch"]["version"] == "10.2.5"
    assert packages["node_modules/brace-expansion"]["version"] == "5.0.8"
    assert "node_modules/@eslint/eslintrc" not in packages


def test_studio_build_tool_override_uses_the_supported_filelist_graph():
    package = json.loads((STUDIO / "package.json").read_text(encoding="utf-8"))
    lock = json.loads((STUDIO / "package-lock.json").read_text(encoding="utf-8"))
    packages = lock["packages"]
    filelist = packages["node_modules/filelist"]

    assert package["overrides"]["filelist"] == "2.0.2"
    assert filelist["version"] == "2.0.2"
    assert filelist["dependencies"]["minimatch"] == "^10.2.1"
    assert "node_modules/filelist/node_modules/minimatch" not in packages
    assert "node_modules/filelist/node_modules/brace-expansion" not in packages


def test_studio_enforces_its_node_runtime_floor_in_ci_and_image_builds():
    package = json.loads((STUDIO / "package.json").read_text(encoding="utf-8"))
    npmrc = (STUDIO / ".npmrc").read_text(encoding="utf-8").splitlines()
    studio_ci = STUDIO_CI_WORKFLOW.read_text(encoding="utf-8")
    dependency_audit = WORKFLOW.read_text(encoding="utf-8")
    dockerfile = (STUDIO / "Dockerfile").read_text(encoding="utf-8")

    assert package["engines"]["node"] == "^20.19.0 || ^22.13.0 || >=24"
    assert npmrc == ["engine-strict=true"]
    assert studio_ci.count("node-version: '22'") == 2
    assert dependency_audit.count("node-version: '22'") == 1
    assert dockerfile.startswith("FROM node:22-alpine AS build\n")

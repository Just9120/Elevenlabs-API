from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "dependency-audit.yml"


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

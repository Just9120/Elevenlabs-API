from __future__ import annotations

import re
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = (
    ROOT
    / ".github/workflows/studio-migration-environment-probe.yml"
)
STUDIO_CI = ROOT / ".github/workflows/studio-ci.yml"


def _workflow() -> tuple[str, dict]:
    text = WORKFLOW.read_text(encoding="utf-8")
    return text, yaml.safe_load(text)


def test_probe_is_manual_exact_main_and_environment_gated() -> None:
    text, data = _workflow()
    triggers = data[True]  # PyYAML 1.1 parses "on" as True.
    dispatch = triggers["workflow_dispatch"]
    job = data["jobs"]["probe-required-review"]

    assert set(triggers) == {"workflow_dispatch"}
    assert set(dispatch["inputs"]) == {"expected_commit"}
    assert dispatch["inputs"]["expected_commit"]["required"] is True
    assert data["permissions"] == {}
    assert data["concurrency"] == {
        "group": "studio-migration-environment-probe",
        "cancel-in-progress": False,
    }
    assert set(data["jobs"]) == {"probe-required-review"}
    assert job["environment"] == "studio-production-migration"
    assert job["timeout-minutes"] == 5
    assert "refs/heads/main" in text
    assert "expected_commit does not match" in text


def test_probe_has_no_repository_secret_network_or_vps_capability() -> None:
    text, data = _workflow()
    job = data["jobs"]["probe-required-review"]

    assert all("uses" not in step for step in job["steps"])
    assert "secrets." not in text
    assert "github.token" not in text
    assert "GITHUB_TOKEN" not in text
    for forbidden in (
        "actions/checkout",
        "DEPLOY_",
        "STUDIO_MIGRATION_SSH_KEY",
    ):
        assert forbidden not in text
    for command in (
        "curl",
        "wget",
        "ssh",
        "scp",
        "gh",
        "docker",
        "psql",
        "alembic",
        "git",
        "sudo",
        "rm",
    ):
        assert re.search(
            rf"(?m)^\s*{re.escape(command)}(?:\s|$)",
            text,
        ) is None


def test_probe_treats_dispatch_input_only_as_validated_environment_data() -> None:
    _text, data = _workflow()
    steps = data["jobs"]["probe-required-review"]["steps"]
    validate = steps[0]

    assert validate["env"] == {
        "DISPATCH_REF": "${{ github.ref }}",
        "EXPECTED_COMMIT": "${{ inputs.expected_commit }}",
        "RUN_SHA": "${{ github.sha }}",
    }
    for step in steps:
        assert "${{ inputs.expected_commit }}" not in step["run"]
        assert "${{ github.event.inputs" not in step["run"]
    assert '"$EXPECTED_COMMIT" =~ ^[0-9a-fA-F]{40}$' in validate["run"]
    assert '"${EXPECTED_COMMIT,,}" != "$RUN_SHA"' in validate["run"]


def test_probe_summary_does_not_claim_review_was_proven_by_success() -> None:
    text, _data = _workflow()

    assert "Confirm separately in the run timeline" in text
    assert "recorded reviewer approval" in text
    assert "approval confirmed" not in text.lower()
    assert "reviewer approved" not in text.lower()


def test_studio_ci_watches_probe_workflow_and_contract_test() -> None:
    workflow = STUDIO_CI.read_text(encoding="utf-8")

    assert workflow.count(
        "- '.github/workflows/studio-migration-environment-probe.yml'"
    ) == 2
    assert workflow.count(
        "- 'tests/test_studio_migration_environment_probe.py'"
    ) == 2

from __future__ import annotations

import json
import sys
import tomllib
from pathlib import Path

import pytest
import yaml


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


def report_fixture():
    from studio_api.diagnostic_reports import build_diagnostic_report

    return build_diagnostic_report(
        generated_at="2026-08-15T00:00:00",
        start_at="2026-08-14T00:00:00",
        end_at="2026-08-15T00:00:00",
        system_summary={
            "environment": "production",
            "build": {"web": "web-build", "api": "api-build", "worker": "worker-build"},
            "google_drive": {"connected": True, "scope_ready": True},
            "provider_credentials": {"active_count": 1, "ready": True},
            "diagnostics": {
                "recording_enabled": True,
                "debug_recording": "inactive",
                "retention_days": 14,
                "debug_retention_hours": 24,
            },
            "report_limits": {"max_days": 7, "max_timeline_events": 500},
        },
        events=[
            {
                "occurred_at": "2026-08-14T12:00:00",
                "level": "INFO",
                "component": "worker",
                "event_code": "JOB_COMPLETED",
                "project_id": "00000000-0000-4000-8000-000000000001",
                "job_id": "00000000-0000-4000-8000-000000000002",
                "correlation_id": "corr_safe_identifier_1234",
                "request_id": "req_safe_identifier_1234",
                "occurrence_count": 2,
                "metadata": {"output_count": 1, "retryable": False},
            }
        ],
        truncated=False,
        level="INFO",
        component="worker",
        event_code="JOB_COMPLETED",
        project_id="00000000-0000-4000-8000-000000000001",
        job_id="00000000-0000-4000-8000-000000000002",
    )


def test_report_payload_has_one_safe_format_independent_contract():
    report = report_fixture()

    assert report["schema_version"] == "studio-diagnostics-report-v1"
    assert report["counts"] == {
        "by_level": {"ERROR": 0, "WARNING": 0, "INFO": 2, "DEBUG": 0},
        "by_component": {"web": 0, "api": 0, "worker": 2},
        "timeline_rows": 1,
        "total_occurrences": 2,
    }
    assert report["timeline"][0]["metadata"] == {
        "output_count": 1,
        "retryable": False,
    }
    encoded = json.dumps(report)
    for excluded in (
        "user@example.com",
        "private-title",
        "https://drive.google.com/private",
        "transcript body",
        "provider request body",
    ):
        assert excluded not in encoded


def test_json_yaml_and_toml_round_trip_to_the_same_report():
    from studio_api.diagnostic_reports import serialize_diagnostic_report

    report = report_fixture()
    json_report = serialize_diagnostic_report(report, "json")
    yaml_report = serialize_diagnostic_report(report, "yaml")
    toml_report = serialize_diagnostic_report(report, "toml")

    assert json.loads(json_report) == report
    assert yaml.safe_load(yaml_report) == report
    assert tomllib.loads(toml_report) == report


def test_markdown_remains_compatible_and_unknown_format_fails_closed():
    from studio_api.diagnostic_reports import serialize_diagnostic_report

    report = report_fixture()
    markdown = serialize_diagnostic_report(report, "md")

    assert markdown.startswith("# Studio diagnostics report\n")
    assert "Chronological diagnostic timeline" in markdown
    assert "Event counts by level" in markdown
    assert "JOB\\_COMPLETED" in markdown
    with pytest.raises(ValueError, match="Unsupported diagnostic report format"):
        serialize_diagnostic_report(report, "xml")

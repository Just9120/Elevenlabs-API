from __future__ import annotations

import json
import math
import re
from collections.abc import Mapping, Sequence
from typing import Any

REPORT_SCHEMA_VERSION = "studio-diagnostics-report-v1"
REPORT_REDACTION_NOTICE = (
    "Report excludes secrets, URLs, filenames, raw JSON, transcript text, "
    "request/response bodies, stack traces, and user email."
)
REPORT_EXCLUDED_FIELDS = (
    "security audit events",
    "emails",
    "titles",
    "filenames",
    "URLs",
    "source bytes",
    "transcript text",
    "provider payloads",
    "request/response bodies",
    "stack traces",
    "secrets",
    "internal expiry",
    "deduplication fingerprints",
)
REPORT_LEVELS = ("ERROR", "WARNING", "INFO", "DEBUG")
REPORT_COMPONENTS = ("web", "api", "worker")
_TOML_BARE_KEY = re.compile(r"^[A-Za-z0-9_-]+$")


def build_diagnostic_report(
    *,
    generated_at: str,
    start_at: str,
    end_at: str,
    system_summary: Mapping[str, Any],
    events: Sequence[Mapping[str, Any]],
    truncated: bool,
    level: str | None = None,
    component: str | None = None,
    event_code: str | None = None,
    project_id: str | None = None,
    job_id: str | None = None,
    problem_description: str | None = None,
    operation_reference: str | None = None,
) -> dict[str, Any]:
    timeline = [_normalized_event(event) for event in events]
    by_level = {key: 0 for key in REPORT_LEVELS}
    by_component = {key: 0 for key in REPORT_COMPONENTS}
    for event in timeline:
        occurrences = event["occurrence_count"]
        if event["level"] in by_level:
            by_level[event["level"]] += occurrences
        if event["component"] in by_component:
            by_component[event["component"]] += occurrences

    return {
        "schema_version": REPORT_SCHEMA_VERSION,
        "generated_at": generated_at,
        "period": {"start": start_at, "end": end_at},
        "redaction": {
            "notice": REPORT_REDACTION_NOTICE,
            "excluded_fields": list(REPORT_EXCLUDED_FIELDS),
        },
        "user_context": {
            "problem_description": _normalized_user_context(
                problem_description, 1000
            ),
            "operation_reference": _normalized_user_context(
                operation_reference, 160
            ),
            "notice": (
                "User-entered context; treat as untrusted supporting input, "
                "not runtime evidence."
            ),
        },
        "system": dict(system_summary),
        "filters": {
            "level": level or "all",
            "component": component or "all",
            "event_code": event_code or "all",
            "project_id": project_id or "all",
            "job_id": job_id or "all",
        },
        "counts": {
            "by_level": by_level,
            "by_component": by_component,
            "timeline_rows": len(timeline),
            "total_occurrences": sum(
                event["occurrence_count"] for event in timeline
            ),
        },
        "timeline": timeline,
        "truncated": bool(truncated),
    }


def _normalized_user_context(value: Any, limit: int) -> str:
    if value is None:
        return ""
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", " ", str(value))
    return text.strip()[:limit]


def serialize_diagnostic_report(report: Mapping[str, Any], report_format: str) -> str:
    if report_format == "md":
        return _serialize_markdown(report)
    if report_format == "json":
        return json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if report_format == "yaml":
        return "---\n" + "\n".join(_yaml_lines(report)) + "\n"
    if report_format == "toml":
        return _serialize_toml(report)
    raise ValueError("Unsupported diagnostic report format")


def _normalized_event(event: Mapping[str, Any]) -> dict[str, Any]:
    metadata = event.get("metadata")
    safe_metadata = dict(metadata) if isinstance(metadata, Mapping) else {}
    return {
        "occurred_at": str(event.get("occurred_at") or ""),
        "level": str(event.get("level") or ""),
        "component": str(event.get("component") or ""),
        "event_code": str(event.get("event_code") or ""),
        "project_id": str(event.get("project_id") or ""),
        "job_id": str(event.get("job_id") or ""),
        "correlation_id": str(event.get("correlation_id") or ""),
        "request_id": str(event.get("request_id") or ""),
        "occurrence_count": max(0, int(event.get("occurrence_count") or 0)),
        "metadata": safe_metadata,
    }


def _serialize_markdown(report: Mapping[str, Any]) -> str:
    system = report["system"]
    filters = report["filters"]
    counts = report["counts"]
    lines = [
        "# Studio diagnostics report",
        "",
        f"Generated: {_markdown_escape(report['generated_at'])}",
        (
            "Selected period: "
            f"{_markdown_escape(report['period']['start'])} to "
            f"{_markdown_escape(report['period']['end'])}"
        ),
        f"Redaction: {_markdown_escape(report['redaction']['notice'])}",
        "",
        "## User-provided problem context",
        (
            "- Description: "
            f"{_markdown_escape(report['user_context']['problem_description'])}"
        ),
        (
            "- Related operation: "
            f"{_markdown_escape(report['user_context']['operation_reference'])}"
        ),
        f"- Notice: {_markdown_escape(report['user_context']['notice'])}",
        "",
        "## Build identities",
        f"- Web: {_markdown_escape(system['build']['web'])}",
        f"- API: {_markdown_escape(system['build']['api'])}",
        f"- Worker: {_markdown_escape(system['build']['worker'])}",
        "",
        "## Environment summary",
        f"- Environment: {_markdown_escape(system['environment'])}",
        f"- Google Drive connected: {system['google_drive']['connected']}",
        f"- Google Drive scope ready: {system['google_drive']['scope_ready']}",
        (
            "- Active provider credentials: "
            f"{system['provider_credentials']['active_count']}"
        ),
        (
            "- Diagnostics recording enabled: "
            f"{system['diagnostics']['recording_enabled']}"
        ),
        (
            "- DEBUG recording: "
            f"{_markdown_escape(system['diagnostics']['debug_recording'])}"
        ),
        "",
        "## Scope",
        f"- Project ID: {_markdown_escape(filters['project_id'])}",
        f"- Job ID: {_markdown_escape(filters['job_id'])}",
        "",
        "## Event counts by level",
    ]
    lines += [f"- {key}: {value}" for key, value in counts["by_level"].items()]
    lines += ["", "## Event counts by component"]
    lines += [
        f"- {key}: {value}" for key, value in counts["by_component"].items()
    ]
    lines += ["", "## Chronological diagnostic timeline"]
    for event in report["timeline"]:
        metadata = ", ".join(
            f"{_markdown_escape(key)}={_markdown_escape(value)}"
            for key, value in sorted(event["metadata"].items())
        )
        lines.append(
            f"- {_markdown_escape(event['occurred_at'])} | {event['level']} | "
            f"{event['component']} | {_markdown_escape(event['event_code'])} | "
            f"project={_markdown_escape(event['project_id'])} "
            f"job={_markdown_escape(event['job_id'])} "
            f"corr={_markdown_escape(event['correlation_id'])} "
            f"req={_markdown_escape(event['request_id'])} "
            f"occurrences={event['occurrence_count']} metadata={metadata}"
        )
    lines += [
        "",
        "## Occurrence and deduplication counts",
        f"- Timeline rows: {counts['timeline_rows']}",
        f"- Total occurrences: {counts['total_occurrences']}",
        "",
        "## Truncation",
        f"- Truncated: {report['truncated']}",
        "",
        "## Fields intentionally excluded",
        "- " + ", ".join(report["redaction"]["excluded_fields"]) + ".",
    ]
    return "\n".join(lines) + "\n"


def _markdown_escape(value: Any) -> str:
    text = str(value if value is not None else "")
    text = re.sub(r"<[^>]*>", "", text).replace("`", "\\`")
    return re.sub(r"([\\*_{}\[\]()#+\-.!|])", r"\\\1", text)[:500]


def _yaml_lines(value: Any, indent: int = 0) -> list[str]:
    prefix = " " * indent
    if isinstance(value, Mapping):
        if not value:
            return [prefix + "{}"]
        lines: list[str] = []
        for key, item in value.items():
            rendered_key = json.dumps(str(key), ensure_ascii=False)
            if isinstance(item, (Mapping, list)) and item:
                lines.append(f"{prefix}{rendered_key}:")
                lines.extend(_yaml_lines(item, indent + 2))
            else:
                lines.append(f"{prefix}{rendered_key}: {_yaml_scalar(item)}")
        return lines
    if isinstance(value, list):
        if not value:
            return [prefix + "[]"]
        lines = []
        for item in value:
            if isinstance(item, (Mapping, list)) and item:
                lines.append(prefix + "-")
                lines.extend(_yaml_lines(item, indent + 2))
            else:
                lines.append(f"{prefix}- {_yaml_scalar(item)}")
        return lines
    return [prefix + _yaml_scalar(value)]


def _yaml_scalar(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float) and math.isfinite(value):
        return repr(value)
    if isinstance(value, (Mapping, list)) and not value:
        return "{}" if isinstance(value, Mapping) else "[]"
    return json.dumps(str(value), ensure_ascii=False)


def _serialize_toml(report: Mapping[str, Any]) -> str:
    lines = [
        f"schema_version = {_toml_scalar(report['schema_version'])}",
        f"generated_at = {_toml_scalar(report['generated_at'])}",
        f"truncated = {_toml_scalar(report['truncated'])}",
    ]
    for table in (
        "period",
        "redaction",
        "user_context",
        "filters",
        "counts",
        "system",
    ):
        lines.append("")
        lines.extend(_toml_table(report[table], (table,)))
    for event in report["timeline"]:
        lines.extend(["", "[[timeline]]"])
        for key, value in event.items():
            if key == "metadata":
                lines.append(f"metadata = {_toml_inline_table(value)}")
            else:
                lines.append(f"{_toml_key(key)} = {_toml_scalar(value)}")
    return "\n".join(lines) + "\n"


def _toml_table(value: Mapping[str, Any], path: tuple[str, ...]) -> list[str]:
    lines = [f"[{'.'.join(_toml_key(part) for part in path)}]"]
    nested: list[tuple[str, Mapping[str, Any]]] = []
    for key, item in value.items():
        if isinstance(item, Mapping):
            nested.append((str(key), item))
        else:
            lines.append(f"{_toml_key(str(key))} = {_toml_scalar(item)}")
    for key, item in nested:
        lines.append("")
        lines.extend(_toml_table(item, (*path, key)))
    return lines


def _toml_inline_table(value: Mapping[str, Any]) -> str:
    return "{ " + ", ".join(
        f"{_toml_key(str(key))} = {_toml_scalar(item)}"
        for key, item in sorted(value.items())
    ) + " }"


def _toml_key(value: str) -> str:
    return value if _TOML_BARE_KEY.fullmatch(value) else json.dumps(
        value, ensure_ascii=False
    )


def _toml_scalar(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float) and math.isfinite(value):
        return repr(value)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return "[" + ", ".join(_toml_scalar(item) for item in value) + "]"
    raise ValueError("Unsupported TOML diagnostic value")

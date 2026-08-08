from __future__ import annotations

import re


_PROJECT_REALTIME_PATH = re.compile(
    r"^/api/projects/[^/]+/realtime(?:/|$)",
)

_API_ENDPOINT_GROUPS = (
    ("/api/realtime", "realtime"),
    ("/api/diagnostics", "diagnostics"),
    ("/api/jobs", "jobs"),
    ("/api/sources", "sources"),
    ("/api/transcript-catalog", "transcript_catalog"),
    ("/api/google", "google"),
    ("/api/credentials", "credentials"),
    ("/api/projects", "projects"),
    ("/api/auth", "auth"),
)


def diagnostic_endpoint_group(path: str) -> str:
    value = path if isinstance(path, str) else ""
    if _PROJECT_REALTIME_PATH.match(value):
        return "realtime"
    for prefix, group in _API_ENDPOINT_GROUPS:
        if value == prefix or value.startswith(prefix + "/"):
            return group
    return "unknown"

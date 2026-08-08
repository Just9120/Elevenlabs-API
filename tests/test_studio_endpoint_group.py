from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))

from studio_api.endpoint_group import diagnostic_endpoint_group


def test_project_scoped_realtime_routes_have_their_own_group():
    assert (
        diagnostic_endpoint_group(
            "/api/projects/project-safe/realtime/capability",
        )
        == "realtime"
    )
    assert diagnostic_endpoint_group("/api/realtime") == "realtime"


def test_non_realtime_project_routes_remain_project_diagnostics():
    assert diagnostic_endpoint_group("/api/projects/project-safe") == "projects"
    assert (
        diagnostic_endpoint_group("/api/projects/project-safe/jobs")
        == "projects"
    )


def test_endpoint_group_matching_fails_closed_for_unknown_paths():
    assert diagnostic_endpoint_group("/api/projects//realtime/capability") == "projects"
    assert diagnostic_endpoint_group("/api/project/project-safe/realtime") == "unknown"
    assert diagnostic_endpoint_group(42) == "unknown"  # type: ignore[arg-type]

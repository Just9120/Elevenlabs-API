from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"
NODE24_ACTION_MAJORS = {
    "actions/checkout": "v7",
    "actions/setup-node": "v6",
    "actions/setup-python": "v6",
    "actions/upload-artifact": "v7",
}


def test_official_javascript_actions_use_node24_majors() -> None:
    discovered: dict[str, list[tuple[Path, str]]] = {
        action: [] for action in NODE24_ACTION_MAJORS
    }

    for workflow in sorted(WORKFLOWS.glob("*.y*ml")):
        text = workflow.read_text(encoding="utf-8")
        for action, major in re.findall(
            r"uses:\s+(actions/(?:checkout|setup-node|setup-python|upload-artifact))@(v\d+)",
            text,
        ):
            discovered[action].append((workflow, major))

    for action, expected_major in NODE24_ACTION_MAJORS.items():
        usages = discovered[action]
        assert usages, f"{action} is no longer covered by the runtime contract"
        assert {major for _, major in usages} == {expected_major}, (
            f"{action} must use {expected_major}: "
            + ", ".join(
                f"{path.relative_to(ROOT)} uses {major}" for path, major in usages
            )
        )

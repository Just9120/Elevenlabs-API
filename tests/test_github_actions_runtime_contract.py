from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"
PINNED_ACTION_COMMITS = {
    "actions/cache": "55cc8345863c7cc4c66a329aec7e433d2d1c52a9",
    "actions/checkout": "3d3c42e5aac5ba805825da76410c181273ba90b1",
    "actions/setup-node": "249970729cb0ef3589644e2896645e5dc5ba9c38",
    "actions/setup-python": "ece7cb06caefa5fff74198d8649806c4678c61a1",
    "actions/upload-artifact": "043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
    "docker/build-push-action": "53b7df96c91f9c12dcc8a07bcb9ccacbed38856a",
    "docker/setup-buildx-action": "37fe631027851001ddb9b187196cc803df7f5f0e",
}


def test_external_actions_use_verified_immutable_commits() -> None:
    discovered: dict[str, list[tuple[Path, str]]] = {}

    for workflow in sorted(WORKFLOWS.glob("*.y*ml")):
        text = workflow.read_text(encoding="utf-8")
        for action, revision in re.findall(r"uses:\s+([^@\s]+)@([^\s#]+)", text):
            if action.startswith("./"):
                continue
            assert re.fullmatch(r"[0-9a-f]{40}", revision), (
                f"{workflow.relative_to(ROOT)} uses mutable action ref "
                f"{action}@{revision}"
            )
            discovered.setdefault(action, []).append((workflow, revision))

    assert set(discovered) == set(PINNED_ACTION_COMMITS)
    for action, expected_commit in PINNED_ACTION_COMMITS.items():
        usages = discovered.get(action, [])
        assert usages, f"{action} is no longer covered by the runtime contract"
        assert {revision for _, revision in usages} == {expected_commit}, (
            f"{action} must use verified commit {expected_commit}: "
            + ", ".join(
                f"{path.relative_to(ROOT)} uses {revision}"
                for path, revision in usages
            )
        )

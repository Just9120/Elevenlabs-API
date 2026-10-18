"""User-facing audit taxonomy must follow new static backend event types."""
import ast
import re
from pathlib import Path


def test_static_audit_events_have_human_labels():
    root = Path(__file__).resolve().parents[1]
    events = set()
    for path in (root / "apps/studio-api/studio_api").rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for call in ast.walk(tree):
            if not isinstance(call, ast.Call) or not isinstance(call.func, ast.Name) or call.func.id != "audit":
                continue
            event = call.args[1] if len(call.args) > 1 else None
            if isinstance(event, ast.Constant) and isinstance(event.value, str):
                events.add(event.value)
    labels = (root / "apps/studio/src/auditLabels.ts").read_text(encoding="utf-8")
    labelled = set(re.findall(r'"([\w.]+)"\s*:', labels))
    assert events
    assert not events - labelled, f"Add human audit labels for {sorted(events-labelled)}"

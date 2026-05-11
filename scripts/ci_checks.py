#!/usr/bin/env python3
"""Lightweight repository hygiene checks for CI."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK_PATH = ROOT / "notebooks" / "elevenlabs_api_colab.ipynb"
CANONICAL_PY = ROOT / "elevenlabs_api.py"


class CheckError(RuntimeError):
    pass


def fail(message: str) -> None:
    raise CheckError(message)


def check_notebooks() -> None:
    notebook_paths = sorted(ROOT.rglob("*.ipynb"))
    if not notebook_paths:
        print("[ci-checks] No notebooks found; skipping notebook hygiene checks.")
        return

    for path in notebook_paths:
        rel = path.relative_to(ROOT)
        try:
            notebook = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            fail(f"Notebook is not valid JSON: {rel} ({exc})")

        for idx, cell in enumerate(notebook.get("cells", [])):
            outputs = cell.get("outputs", [])
            exec_count = cell.get("execution_count")
            if outputs:
                fail(f"Notebook has committed outputs: {rel} cell #{idx}")
            if exec_count is not None:
                fail(f"Notebook has execution_count set: {rel} cell #{idx} -> {exec_count}")

    print(f"[ci-checks] Notebook JSON + clean output checks passed ({len(notebook_paths)} file(s)).")


def check_launcher_notebook() -> None:
    if not NOTEBOOK_PATH.exists():
        fail("Required launcher notebook missing: notebooks/elevenlabs_api_colab.ipynb")

    nb = json.loads(NOTEBOOK_PATH.read_text(encoding="utf-8"))
    source_text = "\n".join(
        "".join(cell.get("source", [])) for cell in nb.get("cells", []) if cell.get("cell_type") == "code"
    )

    size = NOTEBOOK_PATH.stat().st_size
    if size > 30_000:
        fail(
            "Launcher notebook is unexpectedly large; expected a thin launcher "
            f"but got {size} bytes (>30000)."
        )

    required_markers = [
        "GITHUB_REF",
        "raw.githubusercontent.com",
        "urllib.request.urlretrieve",
        "subprocess.run",
        "exec(compile",
    ]
    for marker in required_markers:
        if marker not in source_text:
            fail(f"Launcher notebook missing expected thin-launcher marker: {marker}")

    if not any(m in source_text for m in ["subprocess.check_call", "subprocess.run"]):
        fail("Launcher notebook missing expected dependency install execution marker (subprocess.*)")

    suspicious_markers = [
        "cleanup_stale_project_temp_files",
        "TranscriptionRuntimeOptions",
        "build(\"drive\", \"v3\"",
        "gpt-4o-transcribe",
        "scribe_v2",
    ]
    for marker in suspicious_markers:
        if marker in source_text:
            fail(f"Launcher notebook appears to embed canonical workflow marker: {marker}")

    print("[ci-checks] Launcher notebook thinness checks passed.")


def check_no_raw_provider_body_logging() -> None:
    text = CANONICAL_PY.read_text(encoding="utf-8")
    disallowed_patterns = [
        r"print\(\s*resp\.text\s*\)",
        r"print\(\s*response\.text\s*\)",
        r"logging\.(?:error|warning|info|debug|exception)\([^\n]*resp\.text",
        r"logging\.(?:error|warning|info|debug|exception)\([^\n]*response\.text",
    ]
    for pattern in disallowed_patterns:
        if re.search(pattern, text):
            fail(f"Disallowed raw provider response body logging pattern detected: {pattern}")
    print("[ci-checks] Raw provider body logging guard passed.")


def check_temp_cleanup_patterns() -> None:
    text = CANONICAL_PY.read_text(encoding="utf-8")
    disallowed_patterns = [
        r"shutil\.rmtree\(\s*['\"]?/tmp/?['\"]?\s*\)",
        r"rm\s+-rf\s+/tmp\b",
        r"/tmp/\*\.m4a",
        r"glob\(\s*['\"]/tmp/\*\.(?:m4a|mp3|wav|flac|ogg)['\"]\s*\)",
    ]
    for pattern in disallowed_patterns:
        if re.search(pattern, text):
            fail(f"Dangerous broad temp cleanup pattern detected: {pattern}")
    print("[ci-checks] Temp cleanup safety guard passed.")


def main() -> int:
    try:
        check_notebooks()
        check_launcher_notebook()
        check_no_raw_provider_body_logging()
        check_temp_cleanup_patterns()
    except CheckError as exc:
        print(f"[ci-checks] FAILED: {exc}")
        return 1

    print("[ci-checks] All lightweight checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

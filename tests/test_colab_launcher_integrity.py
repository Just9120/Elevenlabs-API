import ast
import hashlib
from io import BytesIO
import json
from pathlib import Path
from types import SimpleNamespace

import pytest


@pytest.mark.parametrize("name", ["elevenlabs_api_colab", "elevenlabs_realtime_colab"])
def test_launcher_verifies_download_before_replacing_or_executing_runtime(tmp_path, name):
    notebook = json.loads((Path("notebooks") / f"{name}.ipynb").read_text(encoding="utf-8"))
    source = "\n".join("".join(cell["source"]) for cell in notebook["cells"] if cell["cell_type"] == "code")
    tree = ast.parse(source)
    ref = next(ast.literal_eval(node.value) for node in tree.body if isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id == "GITHUB_REF" for target in node.targets))
    assert len(ref) == 40 and all(character in "0123456789abcdef" for character in ref)
    definition = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "download_verified")
    calls = []
    def download(url, *, timeout):
        calls.append((url, timeout))
        return BytesIO(b"reviewed synthetic runtime")
    namespace = {"hashlib": hashlib, "urllib": SimpleNamespace(request=SimpleNamespace(urlopen=download))}
    exec(compile(ast.Module(body=[definition], type_ignores=[]), "launcher-verifier", "exec"), namespace)
    path = tmp_path / "runtime.py"
    path.write_bytes(b"previous reviewed version")
    with pytest.raises(RuntimeError, match="reviewed release"):
        namespace["download_verified"]("https://example.test/runtime", path, "0" * 64)
    assert path.read_bytes() == b"previous reviewed version"
    namespace["download_verified"]("https://example.test/runtime", path, hashlib.sha256(b"reviewed synthetic runtime").hexdigest())
    assert path.read_bytes() == b"reviewed synthetic runtime"
    assert all(timeout == 30 for _, timeout in calls)

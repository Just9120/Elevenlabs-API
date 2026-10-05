"""Select Git Bash for Windows tests without invoking the WSL launcher."""
from __future__ import annotations

import os
from pathlib import Path
import shutil


def repository_bash() -> str:
    # Windows CreateProcess can resolve a bare name using a different search
    # path from the supplied child environment. Always pass the discovered file.
    return shutil.which("bash") or "bash"


def configure_test_shell(environment: dict[str, str], *, windows: bool | None = None) -> bool:
    if not (os.name == "nt" if windows is None else windows):
        return False
    roots: list[Path] = []
    git = shutil.which("git", path=environment.get("PATH", ""))
    if git:
        roots.append(Path(git).resolve().parent.parent)
    for name in ("ProgramFiles", "ProgramW6432", "ProgramFiles(x86)"):
        if environment.get(name):
            roots.append(Path(environment[name]) / "Git")
    for root in roots:
        # The supported Git installation contains both Bash and MSYS utilities.
        binary, utilities = root / "bin", root / "usr" / "bin"
        if not (binary / "bash.exe").is_file() or not (utilities / "bash.exe").is_file():
            continue
        environment["PATH"] = os.pathsep.join((str(binary), str(utilities), environment.get("PATH", "")))
        return True
    # Never replace an unknown installation with a guessed executable.
    return False

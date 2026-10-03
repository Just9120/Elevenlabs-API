"""Prepare pinned SSH host trust without exposing secret values or probing the network."""

from __future__ import annotations

import os
from pathlib import Path
import re
import subprocess
import sys


def prepare(destination: Path, environment: dict[str, str]) -> str:
    host = environment.get("DEPLOY_HOST", "")
    if not re.fullmatch(r"[A-Za-z0-9_.:-]+", host):
        raise ValueError("invalid edge target")

    # Server host identity is shared only for an exactly identical target.
    # Authentication still uses the dedicated edge forced-command private key.
    component_host = environment.get("COMPONENT_DEPLOY_HOST", "")
    component_hosts = environment.get("COMPONENT_KNOWN_HOSTS", "")
    same_target = host == component_host and bool(component_hosts.strip())
    source = "component-same-target" if same_target else "edge"
    content = component_hosts if same_target else environment.get("DEPLOY_KNOWN_HOSTS", "")
    if not content.strip():
        raise ValueError("missing pinned host keys")

    destination.parent.mkdir(parents=True, exist_ok=True)
    # The Actions runner directory is private; never append to global SSH trust.
    descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(content.rstrip() + "\n")
        matched = subprocess.run(
            ["ssh-keygen", "-F", host, "-f", str(destination)],
            capture_output=True, timeout=10, check=False,
        )
        valid = subprocess.run(
            ["ssh-keygen", "-l", "-f", str(destination)],
            capture_output=True, timeout=10, check=False,
        )
        if matched.returncode != 0 or valid.returncode != 0:
            raise ValueError("no valid pinned keys for edge target")
    except BaseException:
        destination.unlink(missing_ok=True)
        raise
    return source


def main() -> int:
    try:
        if len(sys.argv) != 2:
            raise ValueError("destination required")
        source = prepare(Path(sys.argv[1]), dict(os.environ))
    except (ValueError, OSError, subprocess.SubprocessError):
        print("Studio edge host trust preparation failed; no SSH connection attempted", file=sys.stderr)
        return 1
    print(f"Studio edge pinned host trust prepared: source={source}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

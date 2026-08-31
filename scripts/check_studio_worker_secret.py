"""Metadata-only probe, fed to an isolated container; never opens secret bytes."""

import os
from pathlib import Path
import stat
import sys


MOUNT_ROOT = Path("/run/studio-worker-secret-probe")


def validate_metadata(directory: Path, name: str) -> bool:
    if not name or name in {".", ".."} or "/" in name or "\\" in name:
        return False
    try:
        parent = directory.lstat()
        secret = (directory / name).lstat()
    except OSError:
        return False
    return (
        stat.S_ISDIR(parent.st_mode)
        and parent.st_uid == 0
        and not parent.st_mode & 0o022
        and stat.S_ISREG(secret.st_mode)
        and secret.st_uid == 0
        and stat.S_IMODE(secret.st_mode) in {0o400, 0o600}
        and 0 < secret.st_size <= 64 * 1024
    )


if __name__ == "__main__":
    sys.exit(
        0 if os.geteuid() == 0 and len(sys.argv) == 2
        and validate_metadata(MOUNT_ROOT, sys.argv[1]) else 1
    )

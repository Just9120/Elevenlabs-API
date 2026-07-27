from __future__ import annotations

import os
import stat
import sys
import tempfile
from pathlib import Path
from typing import NoReturn, Sequence


RUNTIME_UID = 10001
RUNTIME_GID = 10001
RUNTIME_SECRET_DIR = Path("/run/studio-runtime-secrets")
BOOTSTRAP_ENV = "STUDIO_CONTAINER_SECRET_BOOTSTRAP"
BOOTSTRAP_REQUIRED = "required"
MAX_SECRET_BYTES = 64 * 1024

SECRET_FILES = {
    "STUDIO_POSTGRES_PASSWORD_FILE": "studio_postgres_password",
    "STUDIO_CREDENTIAL_MASTER_KEY_FILE": "studio_credential_master_key",
    "STUDIO_SOURCE_S3_ACCESS_KEY_ID_FILE": "studio_source_s3_access_key_id",
    "STUDIO_SOURCE_S3_SECRET_ACCESS_KEY_FILE": "studio_source_s3_secret_access_key",
    "STUDIO_GOOGLE_OAUTH_CLIENT_SECRET_FILE": "studio_google_oauth_client_secret",
}


class BootstrapError(RuntimeError):
    pass


def _effective_uid() -> int:
    getuid = getattr(os, "geteuid", None)
    if getuid is None:
        raise BootstrapError("reason=unsupported_runtime")
    return int(getuid())


def _prepare_runtime_secret_dir() -> None:
    try:
        RUNTIME_SECRET_DIR.mkdir(mode=0o711)
    except FileExistsError:
        try:
            existing = RUNTIME_SECRET_DIR.lstat()
        except OSError as exc:
            raise BootstrapError("reason=runtime_secret_dir_invalid") from exc
        if (
            not stat.S_ISDIR(existing.st_mode)
            or existing.st_uid != 0
            or existing.st_mode & 0o022
        ):
            raise BootstrapError("reason=runtime_secret_dir_invalid")
    except OSError as exc:
        raise BootstrapError("reason=runtime_secret_dir_unavailable") from exc

    try:
        os.chown(RUNTIME_SECRET_DIR, 0, 0)
        os.chmod(RUNTIME_SECRET_DIR, 0o711)
    except OSError as exc:
        raise BootstrapError("reason=runtime_secret_dir_unavailable") from exc


def _copy_secret(source: Path, target: Path, *, key: str) -> None:
    source_fd = -1
    target_fd = -1
    temporary_name: str | None = None
    source_flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(
        os, "O_NOFOLLOW", 0
    )
    try:
        source_fd = os.open(source, source_flags)
        source_stat = os.fstat(source_fd)
        if not stat.S_ISREG(source_stat.st_mode) or source_stat.st_size > MAX_SECRET_BYTES:
            raise BootstrapError(f"reason=secret_invalid key={key}")

        target_fd, temporary_name = tempfile.mkstemp(
            prefix=f".{target.name}.", dir=RUNTIME_SECRET_DIR
        )
        total = 0
        while True:
            chunk = os.read(source_fd, 8192)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_SECRET_BYTES:
                raise BootstrapError(f"reason=secret_invalid key={key}")
            view = memoryview(chunk)
            while view:
                written = os.write(target_fd, view)
                if written <= 0:
                    raise BootstrapError(f"reason=secret_copy_failed key={key}")
                view = view[written:]

        os.fchmod(target_fd, 0o400)
        os.fchown(target_fd, RUNTIME_UID, RUNTIME_GID)
        os.fsync(target_fd)
        os.close(target_fd)
        target_fd = -1
        os.replace(temporary_name, target)
        temporary_name = None
    except BootstrapError:
        raise
    except OSError as exc:
        raise BootstrapError(f"reason=secret_unavailable key={key}") from exc
    finally:
        if source_fd >= 0:
            os.close(source_fd)
        if target_fd >= 0:
            os.close(target_fd)
        if temporary_name is not None:
            try:
                os.unlink(temporary_name)
            except FileNotFoundError:
                pass


def _bootstrap_runtime_secrets() -> None:
    _prepare_runtime_secret_dir()
    for key, name in SECRET_FILES.items():
        configured_path = os.environ.get(key)
        if configured_path is None:
            continue

        target = RUNTIME_SECRET_DIR / name
        if configured_path != str(target):
            raise BootstrapError(f"reason=runtime_secret_path_mismatch key={key}")
        _copy_secret(Path("/run/secrets") / name, target, key=key)


def _drop_privileges() -> None:
    if _effective_uid() == RUNTIME_UID:
        return
    if _effective_uid() != 0:
        raise BootstrapError("reason=unexpected_runtime_uid")
    try:
        os.setgroups([])
        os.setgid(RUNTIME_GID)
        os.setuid(RUNTIME_UID)
    except (AttributeError, OSError) as exc:
        raise BootstrapError("reason=privilege_drop_failed") from exc
    if _effective_uid() != RUNTIME_UID:
        raise BootstrapError("reason=privilege_drop_failed")


def _exec(command: Sequence[str]) -> NoReturn:
    if not command:
        raise BootstrapError("reason=command_missing")
    try:
        os.execvp(command[0], list(command))
    except OSError as exc:
        raise BootstrapError("reason=command_exec_failed") from exc


def run(argv: Sequence[str] | None = None) -> NoReturn:
    command = list(sys.argv[1:] if argv is None else argv)
    drop_only = bool(command and command[0] == "--drop-only")
    if drop_only:
        command.pop(0)
    if not command:
        raise BootstrapError("reason=command_missing")

    bootstrap_mode = os.environ.get(BOOTSTRAP_ENV, "")
    if bootstrap_mode not in {"", BOOTSTRAP_REQUIRED}:
        raise BootstrapError("reason=bootstrap_mode_invalid")

    current_uid = _effective_uid()
    if bootstrap_mode == BOOTSTRAP_REQUIRED and not drop_only:
        if current_uid != 0:
            raise BootstrapError("reason=bootstrap_not_root")
        os.umask(0o077)
        _bootstrap_runtime_secrets()

    _drop_privileges()
    _exec(command)


def main() -> NoReturn:
    try:
        run()
    except BootstrapError as exc:
        print(f"[studio-container-entrypoint] ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()

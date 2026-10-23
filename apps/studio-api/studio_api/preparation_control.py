"""Cooperative cancellation before STT; only the owned media child is stopped."""
import subprocess
from contextlib import contextmanager
from contextvars import ContextVar
from time import monotonic

from .worker_progress import touch_worker_progress, worker_phase

_check = ContextVar("preparation_check", default=None)


class PreparationInterrupted(RuntimeError):
    pass


@contextmanager
def preparation_control(check):
    token = _check.set(check)
    try:
        yield
    finally:
        _check.reset(token)


def check_preparation_control():
    touch_worker_progress()
    check = _check.get()
    if check is not None:
        try:
            check()
        except Exception as exc:
            raise PreparationInterrupted("preparation_authority_changed") from exc


def controlled_runner(runner):
    def run(command, **kwargs):
        check_preparation_control()
        timeout = kwargs.get("timeout", 1800)
        with worker_phase("media_preparation", timeout + 30):
            if runner is not subprocess.run or _check.get() is None:
                result = runner(command, **kwargs)
                check_preparation_control()
                return result
            options = dict(kwargs)
            options.pop("timeout", None)
            check_exit = options.pop("check", False)
            if options.pop("capture_output", False):
                options.update(stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            child = subprocess.Popen(command, **options)
            deadline = monotonic() + timeout
            try:
                while True:
                    check_preparation_control()
                    remaining = deadline - monotonic()
                    if remaining <= 0:
                        raise subprocess.TimeoutExpired(command, timeout)
                    try:
                        stdout, stderr = child.communicate(timeout=min(0.25, remaining))
                        break
                    except subprocess.TimeoutExpired:
                        continue
                check_preparation_control()
                if check_exit and child.returncode:
                    raise subprocess.CalledProcessError(child.returncode, command, output=stdout, stderr=stderr)
                return subprocess.CompletedProcess(command, child.returncode, stdout, stderr)
            finally:
                if child.poll() is None:
                    child.terminate()
                    try:
                        child.wait(timeout=2)
                    except subprocess.TimeoutExpired:
                        child.kill()
                        child.wait(timeout=2)
                for stream in (child.stdout, child.stderr):
                    if stream is not None:
                        stream.close()
    return run

"""Main-thread progress authority, separate from lease/runtime heartbeat threads."""
from contextlib import contextmanager
from contextvars import ContextVar
from functools import wraps
from threading import Lock
from time import monotonic

_current = ContextVar("worker_progress", default=None)


class WorkerProgress:
    def __init__(self, *, timeout_seconds=120, clock=monotonic):
        self.clock = clock
        self.lock = Lock()
        self.stage = "main_loop"
        self.timeout = timeout_seconds
        self.deadline = clock() + timeout_seconds
        self.failure_stage = None

    def touch(self):
        with self.lock:
            self.deadline = self.clock() + self.timeout

    def is_current(self):
        with self.lock:
            return self.clock() <= self.deadline


@contextmanager
def bind_worker_progress(progress):
    token = _current.set(progress)
    try:
        yield
    finally:
        _current.reset(token)


def touch_worker_progress():
    progress = _current.get()
    if progress is not None:
        progress.touch()


def begin_worker_iteration():
    progress = _current.get()
    if progress is not None:
        progress.failure_stage = None
        progress.touch()


def failure_stage():
    progress = _current.get()
    return (progress.failure_stage or progress.stage) if progress is not None else "main_loop"


@contextmanager
def worker_phase(stage, timeout_seconds):
    progress = _current.get()
    if progress is None:
        yield
        return
    with progress.lock:
        previous = progress.stage, progress.timeout
        progress.stage, progress.timeout = stage, timeout_seconds
        progress.deadline = progress.clock() + timeout_seconds
    try:
        yield
    except BaseException:
        # Preserve the deepest failing boundary, without exception text.
        if progress.failure_stage is None:
            progress.failure_stage = stage
        raise
    finally:
        with progress.lock:
            progress.stage, progress.timeout = previous
            progress.deadline = progress.clock() + progress.timeout


def worker_operation(stage, timeout_seconds):
    def decorate(function):
        @wraps(function)
        def wrapped(*args, **kwargs):
            with worker_phase(stage, timeout_seconds):
                return function(*args, **kwargs)
        return wrapped
    return decorate

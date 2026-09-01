from __future__ import annotations

import contextvars
import re
import secrets


TRACE_ID_RE = re.compile(r"^trace_[A-Za-z0-9_-]{16,64}$")
_CURRENT_TRACE_ID: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "studio_trace_id",
    default=None,
)


def new_trace_id() -> str:
    return f"trace_{secrets.token_hex(16)}"


def valid_trace_id(value: str | None) -> bool:
    return bool(
        isinstance(value, str)
        and TRACE_ID_RE.fullmatch(value)
        and not any(part in value.lower() for part in ("secret", "token", "bearer", "password"))
    )


def sanitize_inbound_trace(value: str | None) -> str:
    candidate = value.strip() if isinstance(value, str) else None
    return candidate if valid_trace_id(candidate) else new_trace_id()


def current_trace_id() -> str | None:
    value = _CURRENT_TRACE_ID.get()
    return value if valid_trace_id(value) else None


def set_current_trace_id(value: str):
    if not valid_trace_id(value):
        raise ValueError("invalid trace id")
    return _CURRENT_TRACE_ID.set(value)


def reset_current_trace_id(token) -> None:
    _CURRENT_TRACE_ID.reset(token)

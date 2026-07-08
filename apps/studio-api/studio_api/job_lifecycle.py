from __future__ import annotations

from .models import JobStatus

TERMINAL_JOB_STATUSES = frozenset({
    JobStatus.cancelled,
    JobStatus.failed,
    JobStatus.completed,
})

SENSITIVE_FAILURE_MARKERS = (
    "secret",
    "token",
    "api_key",
    "apikey",
    "password",
    "credential",
    "authorization",
    "bearer ",
    "refresh",
    "ciphertext",
    "raw_provider",
    "raw-provider",
    "raw google",
    "raw_google",
    "transcript",
    "google docs body",
    "docs body",
    "file-mounted",
    "env:",
    "s3_object_key",
    "presigned",
)

SAFE_REDACTED_FAILURE_MESSAGE = "Недоступно"


def is_terminal_job_status(status: JobStatus) -> bool:
    """Return whether an existing Studio job status is terminal."""
    return status in TERMINAL_JOB_STATUSES


def can_cancel_job_status(status: JobStatus) -> bool:
    """Record-only jobs may only transition from queued to cancelled."""
    return status == JobStatus.queued


def safe_failure_metadata_value(value: str | None) -> str | None:
    """Keep job failure metadata safe for browser responses.

    Current Studio job APIs are record-only and should not expose raw provider
    payloads, transcript bodies, Google Docs content, tokens, credentials, secret
    paths, environment values, or private storage details if a future internal
    component writes unsafe text into failure fields.
    """
    if value is None:
        return None
    lowered = value.lower()
    if any(marker in lowered for marker in SENSITIVE_FAILURE_MARKERS):
        return SAFE_REDACTED_FAILURE_MESSAGE
    return value

from __future__ import annotations

import hashlib
import logging
import signal
import socket
import sys
import threading
import uuid
from datetime import timedelta
from typing import Callable

from pydantic import ValidationError


LOGGER = logging.getLogger("studio_api.worker")


def build_worker_owner_id(*, hostname: str | None = None, process_uuid: uuid.UUID | None = None) -> str:
    host = hostname if hostname is not None else socket.gethostname()
    digest = hashlib.sha256(host.encode("utf-8", errors="ignore")).hexdigest()[:16]
    process_id = process_uuid or uuid.uuid4()
    owner = f"studio-worker:{digest}:{process_id}"
    return owner[:128]


def install_signal_handlers(stop_event: threading.Event) -> None:
    def _handler(_signum, _frame):
        stop_event.set()

    signal.signal(signal.SIGTERM, _handler)
    signal.signal(signal.SIGINT, _handler)


def _reason(exc: BaseException) -> str:
    reason = getattr(exc, "reason", None)
    return getattr(reason, "value", None) or "unknown"


def _safe_log_result(logger: logging.Logger, result) -> None:
    logger.info(
        "studio_worker_job_processed",
        extra={
            "event": "studio_worker_job_processed",
            "job_id": result.job_id,
            "final_job_status": getattr(result.final_job_status, "value", str(result.final_job_status)),
            "attempt_count": result.attempt_count,
            "required_source_count": result.required_source_count,
            "persisted_output_count": result.persisted_output_count,
            "processed_source_count": result.processed_source_count,
            "completion_occurred": result.completion_occurred,
        },
    )


def _safe_rollback(db, logger: logging.Logger) -> None:
    try:
        db.rollback()
    except Exception:
        logger.warning("worker_session_rollback_failed")


def run_worker_loop(
    *,
    settings,
    session_factory: Callable,
    stop_event: threading.Event,
    iteration: Callable | None = None,
    logger: logging.Logger = LOGGER,
    owner_id_factory: Callable[[], str] = build_worker_owner_id,
) -> int:
    if iteration is None:
        from .job_processing_runner import claim_next_and_orchestrate_processing_job

        iteration = claim_next_and_orchestrate_processing_job
    lease_ttl = timedelta(seconds=settings.worker_lease_ttl_seconds)
    poll_interval = settings.worker_poll_interval_seconds
    error_backoff = settings.worker_error_backoff_seconds
    owner_id = owner_id_factory()

    while not stop_event.is_set():
        if stop_event.is_set():
            break
        db = session_factory()
        result = None
        wait_seconds = None
        try:
            result = iteration(db, lease_owner_id=owner_id, lease_ttl=lease_ttl, settings=settings, heartbeat_session_factory=session_factory)
        except Exception as exc:
            if type(exc).__name__ not in {"JobLeaseError", "JobProcessingRunnerError", "JobProcessingOrchestrationError"}:
                _safe_rollback(db, logger)
                logger.error("worker_iteration_failed", extra={"event": "worker_iteration_failed"})
                wait_seconds = error_backoff
            else:
                logger.warning(
                    "studio_worker_iteration_error",
                    extra={"event": "studio_worker_iteration_error", "error_type": type(exc).__name__, "reason": _reason(exc)},
                )
                wait_seconds = error_backoff
        finally:
            try:
                db.close()
            except Exception:
                logger.warning("worker_session_close_failed")

        if stop_event.is_set():
            break
        if result is not None:
            _safe_log_result(logger, result)
            continue
        if not stop_event.is_set():
            cleanup_db = session_factory()
            try:
                from datetime import datetime, timezone
                from .source_deletion import run_one_source_cleanup

                if run_one_source_cleanup(cleanup_db, settings=settings, owner_id=f"{owner_id}:source-cleanup", now=datetime.now(timezone.utc)):
                    logger.info("studio_worker_source_cleanup_processed", extra={"event": "studio_worker_source_cleanup_processed"})
            except Exception:
                _safe_rollback(cleanup_db, logger)
                logger.warning("studio_worker_source_cleanup_failed", extra={"event": "studio_worker_source_cleanup_failed", "reason": "source_cleanup_failed"})
            finally:
                try:
                    cleanup_db.close()
                except Exception:
                    logger.warning("worker_session_close_failed")
        stop_event.wait(wait_seconds if wait_seconds is not None else poll_interval)
    return 0


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    try:
        from .config import Settings

        settings = Settings()
        # Force worker fields to be resolved before the DB module can construct its engine.
        _ = (settings.worker_poll_interval_seconds, settings.worker_error_backoff_seconds, settings.worker_lease_ttl_seconds, settings.worker_lease_heartbeat_interval_seconds)
    except ValidationError:
        LOGGER.error("studio_worker_configuration_invalid")
        return 2
    except Exception:
        LOGGER.error("studio_worker_configuration_invalid")
        return 2

    from .db import SessionLocal

    stop_event = threading.Event()
    install_signal_handlers(stop_event)
    return run_worker_loop(settings=settings, session_factory=SessionLocal, stop_event=stop_event, logger=LOGGER)


if __name__ == "__main__":
    raise SystemExit(main())

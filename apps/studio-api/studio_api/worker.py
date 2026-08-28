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
    if hasattr(result, "stage"):
        logger.info(
            "studio_worker_audio_preparation_processed",
            extra={
                "event": "studio_worker_audio_preparation_processed",
                "job_id": result.job_id,
                "final_job_status": result.status,
                "stage": result.stage,
                "output_created": result.output_created,
            },
        )
        return
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
    source_cleanup_runner: Callable | None = None,
    provider_checkpoint_cleanup_runner: Callable | None = None,
    realtime_draft_cleanup_runner: Callable | None = None,
) -> int:
    if iteration is None:
        from .audio_preparation_worker import claim_next_studio_work

        iteration = claim_next_studio_work
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
        iteration_failed = False
        try:
            result = iteration(db, lease_owner_id=owner_id, lease_ttl=lease_ttl, settings=settings, heartbeat_session_factory=session_factory)
        except Exception as exc:
            if type(exc).__name__ not in {"JobLeaseError", "JobProcessingRunnerError", "JobProcessingOrchestrationError"}:
                _safe_rollback(db, logger)
                logger.error("worker_iteration_failed", extra={"event": "worker_iteration_failed"})
                wait_seconds = error_backoff
                iteration_failed = True
            else:
                logger.warning(
                    "studio_worker_iteration_error",
                    extra={"event": "studio_worker_iteration_error", "error_type": type(exc).__name__, "reason": _reason(exc)},
                )
                wait_seconds = error_backoff
                iteration_failed = True
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
        if iteration_failed:
            stop_event.wait(wait_seconds if wait_seconds is not None else poll_interval)
            continue
        if not stop_event.is_set():
            cleanup_db = session_factory()
            try:
                from datetime import datetime, timezone
                if (
                    provider_checkpoint_cleanup_runner is None
                    and source_cleanup_runner is None
                    and realtime_draft_cleanup_runner is None
                ):
                    from .provider_part_checkpoints import cleanup_expired_provider_part_checkpoints as checkpoint_cleanup_runner
                    from .realtime_drafts import cleanup_expired_realtime_drafts as draft_cleanup_runner
                else:
                    checkpoint_cleanup_runner = provider_checkpoint_cleanup_runner
                    draft_cleanup_runner = realtime_draft_cleanup_runner
                if source_cleanup_runner is None:
                    from .source_deletion import run_one_source_cleanup as cleanup_runner
                else:
                    cleanup_runner = source_cleanup_runner

                cleanup_now = datetime.now(timezone.utc)
                expired_checkpoint_count = (
                    checkpoint_cleanup_runner(cleanup_db, now=cleanup_now)
                    if checkpoint_cleanup_runner is not None
                    else 0
                )
                expired_draft_count = (
                    draft_cleanup_runner(cleanup_db, now=cleanup_now)
                    if draft_cleanup_runner is not None
                    else 0
                )
                if expired_checkpoint_count or expired_draft_count:
                    cleanup_db.commit()
                if expired_checkpoint_count:
                    logger.info(
                        "studio_worker_provider_part_checkpoints_expired",
                        extra={
                            "event": "studio_worker_provider_part_checkpoints_expired",
                            "checkpoint_count": expired_checkpoint_count,
                        },
                    )
                if expired_draft_count:
                    logger.info(
                        "studio_worker_realtime_drafts_expired",
                        extra={
                            "event": "studio_worker_realtime_drafts_expired",
                            "draft_count": expired_draft_count,
                        },
                    )
                if cleanup_runner(cleanup_db, settings=settings, owner_id=f"{owner_id}:source-cleanup", now=cleanup_now, should_stop=stop_event.is_set):
                    logger.info("studio_worker_source_cleanup_processed", extra={"event": "studio_worker_source_cleanup_processed"})
            except Exception:
                _safe_rollback(cleanup_db, logger)
                logger.warning("studio_worker_source_cleanup_failed", extra={"event": "studio_worker_source_cleanup_failed", "reason": "source_cleanup_failed"})
            finally:
                try:
                    cleanup_db.close()
                except Exception:
                    logger.warning("worker_session_close_failed")
        if stop_event.is_set():
            break
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
    from .runtime_observability import (
        WorkerRuntimeHeartbeat,
        current_worker_runtime_instance_id,
        settings_runtime_identity,
    )

    stop_event = threading.Event()
    install_signal_handlers(stop_event)
    identity = settings_runtime_identity(settings, expected_component="worker")
    if identity is None:
        LOGGER.error("studio_worker_runtime_identity_invalid")
        return 2
    try:
        runtime_instance_id = current_worker_runtime_instance_id()
    except Exception:
        LOGGER.error("studio_worker_runtime_instance_invalid")
        return 2
    runtime_heartbeat = WorkerRuntimeHeartbeat(
        session_factory=SessionLocal,
        identity=identity,
        instance_id=runtime_instance_id,
        interval_seconds=settings.runtime_worker_heartbeat_interval_seconds,
        logger=LOGGER,
    )
    runtime_heartbeat.start()
    try:
        return run_worker_loop(
            settings=settings,
            session_factory=SessionLocal,
            stop_event=stop_event,
            logger=LOGGER,
            owner_id_factory=lambda: runtime_instance_id,
        )
    finally:
        runtime_heartbeat.stop_and_join()


if __name__ == "__main__":
    raise SystemExit(main())

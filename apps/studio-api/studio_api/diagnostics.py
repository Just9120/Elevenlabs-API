from __future__ import annotations

import base64, hashlib, hmac, json, logging, re, secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import update
from sqlalchemy.exc import IntegrityError

from .config import get_settings
from .db import SessionLocal
from .models import DiagnosticComponent, DiagnosticEvent, DiagnosticLevel, Project, TranscriptionJob, User

LOGGER = logging.getLogger("studio_api.diagnostics")
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)
REQUEST_ID_RE = re.compile(r"^req_[A-Za-z0-9_-]{16,64}$")
CORRELATION_ID_RE = re.compile(r"^corr_[A-Za-z0-9_-]{16,64}$")
SAFE_BUILD_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,80}$")
SAFE_TOKEN_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,80}$")
BAD_KEY_RE = re.compile(r"token|secret|password|authorization|cookie|csrf|credential|oauth|code|state|key", re.I)
BAD_VALUE_RES = [
    re.compile(p, re.I) for p in [
        r"(^|[_\-\s:])sk[-_][A-Za-z0-9_-]+",
        r"(^|[_\-\s:])bearer(\s+|[_\-])",
        r"authorization\s*[:=]",
        r"(^|[_\-\s:])(?:access|refresh|csrf|oauth)[-_ ]?token([_\-\s:]|$)",
        r"\b(?:oauth[-_ ]?)?(?:code|state)\s*[:=]",
        r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b",
        r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
        r"https?://|www\.",
        r"[A-Za-z][A-Za-z0-9+.-]*://",
        r"\b(?:postgresql|postgres|mysql|redis|mongodb)://",
        r"[/\\]",
        r"\.[A-Za-z0-9]{1,8}\b",
        r"Traceback \(most recent call last\)|File \"|line \d+|Exception:|Error:",
        r"\n|\r",
    ]
]
_LAST_CLEANUP_SUCCESS: datetime | None = None

@dataclass(frozen=True)
class MetaRule:
    kind: str
    min: int | None = None
    max: int | None = None
    choices: frozenset[str] | None = None
    required: bool = False

@dataclass(frozen=True)
class EventDef:
    components: frozenset[str]
    level: str
    metadata: dict[str, MetaRule]

BOUNDARIES = frozenset({"source_validation", "provider_transport", "provider_response", "post_provider_lifecycle", "google_docs", "output_persistence", "orchestration", "lease_heartbeat", "retry_api", "retry_state", "source_deletion", "source_cleanup", "unknown"})
ERROR_CODES = frozenset({
    "unknown", "provider_authentication_rejected", "provider_request_rejected", "provider_rate_limited",
    "provider_unavailable", "provider_timeout", "malformed_provider_response", "lifecycle_changed_after_provider_call",
    "lifecycle_changed_before_provider_call", "credential_or_output_identity_changed_before_provider_call",
    "source_materialization_unavailable", "prerequisites_unavailable", "provider_mismatch", "pipeline_transcription_failed",
    "pipeline_google_docs_failed", "output_reconciliation_required", "incomplete_output_coverage", "commit_failed",
    "no_required_sources", "cancellation_requested", "google_docs_failed", "transcription_failed", "lease_heartbeat_failed", "lease_heartbeat_not_owned",
    "lease_heartbeat_expired", "lease_heartbeat_commit_failed", "lease_heartbeat_stop_timeout", "pipeline_retry_state_prepare_failed", "pipeline_retry_state_persistence_failed", "retry_attempt_limit_reached", "retry_recovery_state_unknown",
})
HTTP_STATUS_CATEGORIES = frozenset({"1xx", "2xx", "3xx", "4xx", "5xx", "unknown"})
RECONCILIATION_CASE_STATUSES = frozenset({"prepared","creation_returned","reconciliation_required","resolved","conflict"})
FINAL_STATUSES = frozenset({"processing", "cancelled", "failed", "completed"})
ENDPOINT_GROUPS = frozenset({"diagnostics", "jobs", "sources", "google", "credentials", "projects", "auth", "unknown"})
PWA_BOUNDARIES = frozenset({"app", "react_boundary", "route", "api_request", "service_worker", "unknown"})
PWA_ERROR_CODES = frozenset({"app_error", "unhandled_rejection", "api_request_failed", "route_error", "service_worker_error", "unknown"})
SOURCE_TYPES = frozenset({"local_upload", "google_drive"})
SOURCE_DELETION_REASONS = frozenset({"user_deleted", "retention_expired"})
SOURCE_CLEANUP_OUTCOMES = frozenset({"not_applicable", "pending", "completed", "failed"})
SOURCE_DELETION_BLOCKERS = frozenset({"queued_job_uses_source", "processing_job_uses_source", "retryable_failed_job_uses_source", "project_unavailable", "source_already_deleted", "unsupported_source_state"})

def R(kind: str, *, min: int | None = None, max: int | None = None, choices: frozenset[str] | None = None, required: bool = False) -> MetaRule:
    return MetaRule(kind, min, max, choices, required)

REGISTRY: dict[str, EventDef] = {
    "SOURCE_DELETION_REQUESTED": EventDef(frozenset({"api"}), "INFO", {"source_type": R("enum", choices=SOURCE_TYPES, required=True), "deletion_reason": R("enum", choices=SOURCE_DELETION_REASONS, required=True), "boundary": R("enum", choices=BOUNDARIES, required=True)}),
    "SOURCE_DELETION_BLOCKED": EventDef(frozenset({"api"}), "WARNING", {"source_type": R("enum", choices=SOURCE_TYPES, required=True), "blocker": R("enum", choices=SOURCE_DELETION_BLOCKERS, required=True), "boundary": R("enum", choices=BOUNDARIES, required=True)}),
    "SOURCE_DELETION_COMPLETED": EventDef(frozenset({"api"}), "INFO", {"source_type": R("enum", choices=SOURCE_TYPES, required=True), "deletion_reason": R("enum", choices=SOURCE_DELETION_REASONS, required=True), "cleanup_outcome": R("enum", choices=SOURCE_CLEANUP_OUTCOMES, required=True), "boundary": R("enum", choices=BOUNDARIES, required=True)}),
    "SOURCE_RETENTION_EXPIRED": EventDef(frozenset({"worker"}), "INFO", {"source_type": R("enum", choices=SOURCE_TYPES, required=True), "deletion_reason": R("enum", choices=SOURCE_DELETION_REASONS, required=True), "boundary": R("enum", choices=BOUNDARIES, required=True)}),
    "SOURCE_STORAGE_CLEANUP_STARTED": EventDef(frozenset({"worker"}), "INFO", {"source_type": R("enum", choices=SOURCE_TYPES, required=True), "cleanup_attempt": R("int", min=1, max=100000, required=True), "boundary": R("enum", choices=BOUNDARIES, required=True)}),
    "SOURCE_STORAGE_CLEANUP_COMPLETED": EventDef(frozenset({"worker"}), "INFO", {"cleanup_outcome": R("enum", choices=SOURCE_CLEANUP_OUTCOMES, required=True), "cleanup_attempt": R("int", min=1, max=100000, required=True), "boundary": R("enum", choices=BOUNDARIES, required=True)}),
    "SOURCE_STORAGE_CLEANUP_FAILED": EventDef(frozenset({"worker"}), "WARNING", {"cleanup_outcome": R("enum", choices=SOURCE_CLEANUP_OUTCOMES, required=True), "cleanup_attempt": R("int", min=1, max=100000, required=True), "boundary": R("enum", choices=BOUNDARIES, required=True)}),
    "JOB_CREATED": EventDef(frozenset({"api"}), "INFO", {"source_count": R("int", min=1, max=50, required=True), "batch_position": R("int", min=0, max=1000), "credential_selected": R("bool", required=True)}),
    "JOB_CLAIMED": EventDef(frozenset({"worker"}), "INFO", {}),
    "PROCESSING_STARTED": EventDef(frozenset({"worker"}), "INFO", {"attempt_number": R("int", min=1, max=1000, required=True)}),
    "SOURCE_VALIDATION_STARTED": EventDef(frozenset({"worker"}), "INFO", {"attempt_number": R("int", min=1, max=1000, required=True)}),
    "SOURCE_READY": EventDef(frozenset({"worker"}), "INFO", {"attempt_number": R("int", min=1, max=1000, required=True)}),
    "PROVIDER_REQUEST_STARTED": EventDef(frozenset({"worker"}), "INFO", {"attempt_number": R("int", min=1, max=1000, required=True), "boundary": R("enum", choices=BOUNDARIES)}),
    "PROVIDER_REQUEST_COMPLETED": EventDef(frozenset({"worker"}), "INFO", {"attempt_number": R("int", min=1, max=1000, required=True), "duration_ms": R("int", min=0, max=86400000)}),
    "PROVIDER_REQUEST_FAILED": EventDef(frozenset({"worker"}), "ERROR", {"boundary": R("enum", choices=BOUNDARIES, required=True), "error_code": R("enum", choices=ERROR_CODES, required=True), "retryable": R("bool", required=True), "attempt_number": R("int", min=1, max=1000, required=True), "duration_ms": R("int", min=0, max=86400000), "http_status_category": R("enum", choices=HTTP_STATUS_CATEGORIES)}),

    "LEASE_HEARTBEAT_STARTED": EventDef(frozenset({"worker"}), "INFO", {"stage": R("enum", choices=frozenset({"source_provider", "google_output"}), required=True), "attempt_number": R("int", min=0, max=1000)}),
    "LEASE_HEARTBEAT_STOPPED": EventDef(frozenset({"worker"}), "INFO", {"stage": R("enum", choices=frozenset({"source_provider", "google_output"}), required=True), "renewal_count": R("int", min=0, max=100000, required=True), "success": R("bool", required=True), "attempt_number": R("int", min=0, max=1000)}),
    "LEASE_HEARTBEAT_FAILED": EventDef(frozenset({"worker"}), "ERROR", {"stage": R("enum", choices=frozenset({"source_provider", "google_output"}), required=True), "renewal_count": R("int", min=0, max=100000, required=True), "reason": R("enum", choices=frozenset({"lease_heartbeat_failed", "lease_heartbeat_not_owned", "lease_heartbeat_expired", "lease_heartbeat_commit_failed", "lease_heartbeat_stop_timeout"}), required=True), "attempt_number": R("int", min=0, max=1000)}),
    "OUTPUT_CREATION_STARTED": EventDef(frozenset({"worker"}), "INFO", {"attempt_number": R("int", min=1, max=1000, required=True)}),
    "OUTPUT_PERSISTED": EventDef(frozenset({"worker"}), "INFO", {"output_count": R("int", min=0, max=50, required=True), "attempt_number": R("int", min=1, max=1000, required=True)}),
    "JOB_COMPLETED": EventDef(frozenset({"worker"}), "INFO", {"final_job_status": R("enum", choices=frozenset({"completed"}), required=True), "output_count": R("int", min=0, max=50, required=True), "attempt_number": R("int", min=1, max=1000)}),
    "JOB_FAILED": EventDef(frozenset({"worker"}), "ERROR", {"final_job_status": R("enum", choices=frozenset({"failed"}), required=True), "error_code": R("enum", choices=ERROR_CODES, required=True), "boundary": R("enum", choices=BOUNDARIES), "attempt_number": R("int", min=1, max=1000)}),
    "JOB_CANCEL_REQUESTED": EventDef(frozenset({"api"}), "INFO", {"final_job_status": R("enum", choices=frozenset({"processing"}), required=True)}),
    "JOB_CANCELLED": EventDef(frozenset({"api", "worker"}), "INFO", {"final_job_status": R("enum", choices=frozenset({"cancelled"}), required=True)}),

    "JOB_RETRY_REQUESTED": EventDef(frozenset({"api"}), "INFO", {"attempt_number": R("int", min=0, max=1000), "retry_available": R("bool"), "boundary": R("enum", choices=BOUNDARIES)}),
    "JOB_RETRY_QUEUED": EventDef(frozenset({"api"}), "INFO", {"retry_reason": R("token"), "retry_available": R("bool"), "retry_safe_source_count": R("int", min=0, max=50), "missing_output_count": R("int", min=0, max=50), "final_job_status": R("enum", choices=FINAL_STATUSES), "boundary": R("enum", choices=BOUNDARIES)}),
    "JOB_RETRY_BLOCKED": EventDef(frozenset({"api"}), "WARNING", {"retry_reason": R("token"), "retry_available": R("bool"), "retry_safe_source_count": R("int", min=0, max=50), "missing_output_count": R("int", min=0, max=50), "boundary": R("enum", choices=BOUNDARIES)}),
    "JOB_EXPIRED_LEASE_RECOVERED": EventDef(frozenset({"worker", "api"}), "INFO", {"retry_reason": R("token"), "final_job_status": R("enum", choices=FINAL_STATUSES), "missing_output_count": R("int", min=0, max=50)}),
    "JOB_EXPIRED_LEASE_RECOVERY_BLOCKED": EventDef(frozenset({"worker", "api"}), "WARNING", {"retry_reason": R("token"), "final_job_status": R("enum", choices=FINAL_STATUSES), "missing_output_count": R("int", min=0, max=50)}),
    "SOURCE_ATTEMPT_PREPARED": EventDef(frozenset({"worker"}), "INFO", {"attempt_number": R("int", min=1, max=1000, required=True), "boundary": R("enum", choices=BOUNDARIES)}),
    "SOURCE_ATTEMPT_RETRY_CLASSIFIED": EventDef(frozenset({"worker"}), "INFO", {"attempt_number": R("int", min=1, max=1000), "retry_reason": R("token"), "boundary": R("enum", choices=BOUNDARIES)}),
    "OUTPUT_RECONCILIATION_REQUIRED": EventDef(frozenset({"worker"}), "WARNING", {"case_status": R("enum", choices=RECONCILIATION_CASE_STATUSES, required=True), "attempt_number": R("int", min=0, max=1000)}),
    "OUTPUT_RECONCILIATION_CHECK_STARTED": EventDef(frozenset({"api"}), "INFO", {"case_status": R("enum", choices=RECONCILIATION_CASE_STATUSES, required=True)}),
    "OUTPUT_RECONCILIATION_NOT_FOUND": EventDef(frozenset({"api"}), "INFO", {"case_status": R("enum", choices=RECONCILIATION_CASE_STATUSES, required=True), "resolved": R("bool"), "aggregate_count": R("int", min=0, max=50)}),
    "OUTPUT_RECONCILIATION_RESOLVED": EventDef(frozenset({"api"}), "INFO", {"case_status": R("enum", choices=RECONCILIATION_CASE_STATUSES, required=True), "resolved": R("bool", required=True), "aggregate_count": R("int", min=0, max=50)}),
    "OUTPUT_RECONCILIATION_CONFLICT": EventDef(frozenset({"api"}), "WARNING", {"case_status": R("enum", choices=RECONCILIATION_CASE_STATUSES, required=True), "resolved": R("bool"), "aggregate_count": R("int", min=0, max=50)}),
    "OUTPUT_RECONCILIATION_FAILED": EventDef(frozenset({"api"}), "WARNING", {"case_status": R("enum", choices=RECONCILIATION_CASE_STATUSES, required=True), "resolved": R("bool")}),
    "API_REQUEST_FAILED": EventDef(frozenset({"api"}), "WARNING", {"endpoint_group": R("enum", choices=ENDPOINT_GROUPS, required=True), "http_status_category": R("enum", choices=HTTP_STATUS_CATEGORIES, required=True)}),
    "API_UNHANDLED_EXCEPTION": EventDef(frozenset({"api"}), "ERROR", {"endpoint_group": R("enum", choices=ENDPOINT_GROUPS, required=True), "http_status_category": R("enum", choices=frozenset({"5xx"}), required=True)}),
    "PWA_APP_ERROR": EventDef(frozenset({"web"}), "ERROR", {"boundary": R("enum", choices=PWA_BOUNDARIES), "error_code": R("enum", choices=PWA_ERROR_CODES), "retryable": R("bool"), "duration_ms": R("int", min=0, max=86400000), "http_status_category": R("enum", choices=HTTP_STATUS_CATEGORIES), "endpoint_group": R("enum", choices=ENDPOINT_GROUPS)}),
    "PWA_UNHANDLED_REJECTION": EventDef(frozenset({"web"}), "ERROR", {"boundary": R("enum", choices=PWA_BOUNDARIES), "error_code": R("enum", choices=PWA_ERROR_CODES), "retryable": R("bool"), "duration_ms": R("int", min=0, max=86400000), "http_status_category": R("enum", choices=HTTP_STATUS_CATEGORIES), "endpoint_group": R("enum", choices=ENDPOINT_GROUPS)}),
    "PWA_API_REQUEST_FAILED": EventDef(frozenset({"web"}), "WARNING", {"boundary": R("enum", choices=PWA_BOUNDARIES), "error_code": R("enum", choices=PWA_ERROR_CODES), "retryable": R("bool"), "duration_ms": R("int", min=0, max=86400000), "http_status_category": R("enum", choices=HTTP_STATUS_CATEGORIES, required=True), "endpoint_group": R("enum", choices=ENDPOINT_GROUPS, required=True)}),
    "PWA_ROUTE_ERROR": EventDef(frozenset({"web"}), "ERROR", {"boundary": R("enum", choices=PWA_BOUNDARIES), "error_code": R("enum", choices=PWA_ERROR_CODES), "retryable": R("bool"), "duration_ms": R("int", min=0, max=86400000), "http_status_category": R("enum", choices=HTTP_STATUS_CATEGORIES), "endpoint_group": R("enum", choices=ENDPOINT_GROUPS)}),
    "PWA_SERVICE_WORKER_ERROR": EventDef(frozenset({"web"}), "WARNING", {"boundary": R("enum", choices=PWA_BOUNDARIES), "error_code": R("enum", choices=PWA_ERROR_CODES), "retryable": R("bool"), "duration_ms": R("int", min=0, max=86400000), "http_status_category": R("enum", choices=HTTP_STATUS_CATEGORIES), "endpoint_group": R("enum", choices=ENDPOINT_GROUPS)}),
}

@dataclass(frozen=True)
class DiagnosticWriteResult:
    accepted: bool
    persisted: bool = False
    reason: str | None = None
    event_id: str | None = None

def _safe_fail(reason: str = "persistence_failed") -> DiagnosticWriteResult:
    return DiagnosticWriteResult(True, False, reason=reason)

def new_request_id() -> str:
    return f"req_{secrets.token_hex(16)}"

def new_correlation_id() -> str:
    return f"corr_{secrets.token_hex(16)}"

def new_opaque_id(prefix: str = "dg") -> str:
    return new_request_id() if prefix == "req" else new_correlation_id() if prefix == "corr" else f"{prefix}_{secrets.token_urlsafe(24).rstrip('=')}"

def valid_uuid(value: str | None) -> bool:
    if value is None or not isinstance(value, str) or not UUID_RE.fullmatch(value):
        return False
    try:
        return str(UUID(value)) == value.lower()
    except Exception:
        return False

def valid_db_id(value: str | None) -> bool:
    return value is None or valid_uuid(value)

def valid_request_id(value: str | None) -> bool:
    return value is None or bool(isinstance(value, str) and REQUEST_ID_RE.fullmatch(value) and not unsafe_string(value))

def valid_correlation_id(value: str | None) -> bool:
    return value is None or bool(isinstance(value, str) and (CORRELATION_ID_RE.fullmatch(value) or UUID_RE.fullmatch(value)) and not unsafe_string(value))

def valid_opaque_id(value: str | None) -> bool:
    return valid_correlation_id(value) or valid_request_id(value)

def sanitize_inbound_correlation(value: str | None) -> str:
    raw = value.strip() if isinstance(value, str) else None
    return raw if raw and valid_correlation_id(raw) else new_correlation_id()

def sanitize_build_id(value: str | None) -> str:
    value = (value or "unknown").strip()[:80]
    return value if SAFE_BUILD_RE.fullmatch(value) and not unsafe_string(value) else "unknown"

def unsafe_string(value: str) -> bool:
    if not isinstance(value, str) or not value or len(value) > 120:
        return True
    return any(rx.search(value) for rx in BAD_VALUE_RES)

def sanitize_metadata(code: str, metadata: dict[str, Any] | None) -> dict[str, Any] | None:
    definition = REGISTRY.get(code)
    if not definition:
        return None
    incoming = metadata or {}
    if set(incoming) - set(definition.metadata):
        return None
    safe: dict[str, Any] = {}
    for key, rule in definition.metadata.items():
        if rule.required and key not in incoming:
            return None
    for key, value in incoming.items():
        rule = definition.metadata.get(key)
        if not rule or isinstance(value, (dict, list, tuple, set)):
            return None
        if rule.kind == "bool":
            if type(value) is not bool: return None
            safe[key] = value
        elif rule.kind == "int":
            if type(value) is not int: return None
            if rule.min is not None and value < rule.min: return None
            if rule.max is not None and value > rule.max: return None
            safe[key] = value
        elif rule.kind == "enum":
            if not isinstance(value, str) or not SAFE_TOKEN_RE.fullmatch(value) or unsafe_string(value): return None
            if rule.choices and value not in rule.choices: return None
            safe[key] = value
        else:
            return None
    try:
        encoded = json.dumps(safe, sort_keys=True, separators=(",", ":"))
    except Exception:
        return None
    if len(encoded) > 1500:
        return None
    return safe

def _as_utc_naive(now: datetime | None = None) -> datetime:
    dt = now or datetime.now(timezone.utc)
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt

def _bucket(now: datetime) -> datetime:
    return now.replace(minute=(now.minute // 5) * 5, second=0, microsecond=0)

def _settings():
    return get_settings()

def expiry_for(level: str, now: datetime, settings=None) -> datetime:
    settings = settings or _settings()
    days = max(1, min(int(settings.diagnostic_retention_days), 30))
    hours = max(1, min(int(settings.diagnostic_debug_retention_hours), 24))
    return now + (timedelta(hours=hours) if level == "DEBUG" else timedelta(days=days))

def fingerprint(*, owner_user_id, component, level, event_code, project_id, job_id, metadata, bucket) -> str:
    payload = {"o": owner_user_id, "c": component, "l": level, "e": event_code, "p": project_id, "j": job_id, "m": metadata, "b": bucket.isoformat()}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

def _rollback(db) -> None:
    try: db.rollback()
    except Exception: pass

def _close(db) -> None:
    try: db.close()
    except Exception: pass

def _scope_valid(db, owner_user_id: str, project_id: str | None, job_id: str | None) -> bool:
    if db.get(User, owner_user_id) is None:
        return False
    if project_id is not None:
        project = db.get(Project, project_id)
        if project is None or project.owner_user_id != owner_user_id:
            return False
    if job_id is not None:
        job = db.get(TranscriptionJob, job_id)
        if job is None or job.owner_user_id != owner_user_id:
            return False
        if project_id is not None and job.project_id != project_id:
            return False
    return True

def _upsert_event(db, row_values: dict[str, Any], fp: str):
    updated = db.execute(update(DiagnosticEvent).where(DiagnosticEvent.dedup_fingerprint == fp).values(occurrence_count=DiagnosticEvent.occurrence_count + 1, last_occurred_at=row_values["last_occurred_at"]))
    if getattr(updated, "rowcount", 0):
        return db.query(DiagnosticEvent.id).filter_by(dedup_fingerprint=fp).scalar()
    try:
        db.add(DiagnosticEvent(**row_values))
        db.flush()
        return row_values["id"]
    except IntegrityError:
        _rollback(db)
        updated = db.execute(update(DiagnosticEvent).where(DiagnosticEvent.dedup_fingerprint == fp).values(occurrence_count=DiagnosticEvent.occurrence_count + 1, last_occurred_at=row_values["last_occurred_at"]))
        if not getattr(updated, "rowcount", 0):
            raise
        return db.query(DiagnosticEvent.id).filter_by(dedup_fingerprint=fp).scalar()

def write_diagnostic_event(*, owner_user_id: str, component: str, event_code: str, level: str | None = None, project_id: str | None = None, job_id: str | None = None, correlation_id: str | None = None, request_id: str | None = None, metadata: dict[str, Any] | None = None, session_factory=SessionLocal, now: datetime | None = None, allow_debug_override: bool = False) -> DiagnosticWriteResult:
    db = None
    try:
        definition = REGISTRY.get(event_code)
        if not definition: return DiagnosticWriteResult(False, reason="unknown_event_code")
        component = getattr(component, "value", component); level = level or definition.level
        debug_override = bool(allow_debug_override and event_code.startswith("PWA_") and level == "DEBUG")
        if component not in definition.components or (level != definition.level and not debug_override) or level not in DiagnosticLevel.__members__:
            return DiagnosticWriteResult(False, reason="invalid_scope")
        if not valid_uuid(owner_user_id) or not valid_db_id(project_id) or not valid_db_id(job_id) or not valid_correlation_id(correlation_id) or not valid_request_id(request_id):
            return DiagnosticWriteResult(False, reason="invalid_identifier")
        safe = sanitize_metadata(event_code, metadata)
        if safe is None: return DiagnosticWriteResult(False, reason="invalid_metadata")
        now_dt = _as_utc_naive(now); bucket = _bucket(now_dt)
        settings = _settings()
        fp = fingerprint(owner_user_id=owner_user_id, component=component, level=level, event_code=event_code, project_id=project_id, job_id=job_id, metadata=safe, bucket=bucket)
        db = session_factory()
        if not _scope_valid(db, owner_user_id, project_id, job_id):
            _rollback(db); return DiagnosticWriteResult(False, reason="invalid_scope")
        row_values = dict(id=secrets.token_hex(16), owner_user_id=owner_user_id, project_id=project_id, job_id=job_id, level=DiagnosticLevel[level], component=DiagnosticComponent(component), event_code=event_code, correlation_id=correlation_id, request_id=request_id, metadata_json=json.dumps(safe, sort_keys=True), first_occurred_at=now_dt, last_occurred_at=now_dt, occurrence_count=1, dedup_fingerprint=fp, dedup_bucket=bucket, expires_at=expiry_for(level, now_dt, settings))
        event_id = _upsert_event(db, row_values, fp)
        db.commit()
        try:
            cleanup_expired_diagnostics(session_factory=session_factory)
        except Exception:
            LOGGER.warning("diagnostic_cleanup_failed")
        return DiagnosticWriteResult(True, True, event_id=event_id)
    except Exception:
        if db is not None: _rollback(db)
        LOGGER.warning("diagnostic_write_failed")
        return _safe_fail()
    finally:
        if db is not None: _close(db)

def cleanup_expired_diagnostics(*, session_factory=SessionLocal, now: datetime | None = None, force=False) -> None:
    global _LAST_CLEANUP_SUCCESS
    db = None
    try:
        now_dt = _as_utc_naive(now); settings = _settings()
        interval = max(60, min(int(settings.diagnostic_cleanup_interval_seconds), 86400))
        if not force and _LAST_CLEANUP_SUCCESS and now_dt - _LAST_CLEANUP_SUCCESS < timedelta(seconds=interval):
            return
        db = session_factory()
        limit = max(1, min(int(settings.diagnostic_cleanup_batch_size), 1000))
        ids = [r[0] for r in db.query(DiagnosticEvent.id).filter(DiagnosticEvent.expires_at <= now_dt).order_by(DiagnosticEvent.expires_at.asc()).limit(limit).all()]
        if ids:
            db.query(DiagnosticEvent).filter(DiagnosticEvent.id.in_(ids)).delete(synchronize_session=False)
        db.commit()
        _LAST_CLEANUP_SUCCESS = now_dt
    except Exception:
        if db is not None: _rollback(db)
        LOGGER.warning("diagnostic_cleanup_failed")
    finally:
        if db is not None: _close(db)

def resolve_job_correlation_id(*, owner_user_id: str, job_id: str, session_factory=SessionLocal, now: datetime | None = None) -> str | None:
    db = None
    try:
        if not valid_uuid(owner_user_id) or not valid_uuid(job_id): return None
        now_dt = _as_utc_naive(now)
        db = session_factory()
        row = db.query(DiagnosticEvent.correlation_id).filter(DiagnosticEvent.owner_user_id == owner_user_id, DiagnosticEvent.job_id == job_id, DiagnosticEvent.event_code == "JOB_CREATED", DiagnosticEvent.expires_at > now_dt, DiagnosticEvent.correlation_id.isnot(None)).order_by(DiagnosticEvent.first_occurred_at.asc(), DiagnosticEvent.id.asc()).first()
        value = row[0] if row else None
        return value if valid_correlation_id(value) else None
    except Exception:
        LOGGER.warning("diagnostic_correlation_lookup_failed")
        return None
    finally:
        if db is not None: _close(db)

def cursor_context(*, owner_user_id: str, start: datetime, end: datetime, level=None, component=None, event_code=None, project_id=None, job_id=None) -> dict[str, Any]:
    return {"owner": owner_user_id, "start": _as_utc_naive(start).isoformat(), "end": _as_utc_naive(end).isoformat(), "level": level, "component": component, "event_code": event_code, "project_id": project_id, "job_id": job_id}

def _cursor_key(secret: str) -> bytes:
    return hashlib.sha256(("studio-diagnostics-cursor-v1:" + secret).encode()).digest()

def encode_cursor(dt: datetime, event_id: str, context: dict[str, Any], secret: str) -> str:
    payload = {"v": 1, "t": _as_utc_naive(dt).isoformat(), "i": event_id, "c": context}
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    sig = hmac.new(_cursor_key(secret), raw, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(raw + sig).decode().rstrip("=")

def decode_cursor(cursor: str, context: dict[str, Any], secret: str) -> tuple[datetime, str] | None:
    decoded = decode_cursor_payload(cursor, secret)
    if not decoded:
        return None
    dt, eid, signed_context = decoded
    return (dt, eid) if signed_context == context else None

def decode_cursor_payload(cursor: str, secret: str) -> tuple[datetime, str, dict[str, Any]] | None:
    try:
        if not isinstance(cursor, str) or len(cursor) > 1200 or not re.fullmatch(r"[A-Za-z0-9_-]+", cursor): return None
        data = base64.urlsafe_b64decode((cursor + "=" * (-len(cursor) % 4)).encode())
        if len(data) <= 32: return None
        raw, sig = data[:-32], data[-32:]
        expected = hmac.new(_cursor_key(secret), raw, hashlib.sha256).digest()
        if not hmac.compare_digest(sig, expected): return None
        payload = json.loads(raw)
        signed_context = payload.get("c")
        if payload.get("v") != 1 or not isinstance(signed_context, dict): return None
        dt = datetime.fromisoformat(payload["t"]); eid = payload["i"]
        return (_as_utc_naive(dt), eid, signed_context) if isinstance(eid, str) and len(eid) <= 64 else None
    except Exception:
        return None

def markdown_escape(value: Any) -> str:
    text = str(value if value is not None else "")
    text = re.sub(r"<[^>]*>", "", text).replace("`", "\\`")
    return re.sub(r"([\\*_{}\[\]()#+\-.!|])", r"\\\1", text)[:500]

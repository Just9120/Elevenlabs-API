from __future__ import annotations

import base64, hashlib, hmac, json, logging, re, secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .config import get_settings
from .db import SessionLocal
from .models import DiagnosticComponent, DiagnosticEvent, DiagnosticLevel

LOGGER = logging.getLogger("studio_api.diagnostics")
OPAQUE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$")
UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
BAD_KEY_RE = re.compile(r"token|secret|password|authorization|cookie", re.I)
URL_RE = re.compile(r"https?://|www\.", re.I)
FILENAME_RE = re.compile(r"[/\\]|\.[A-Za-z0-9]{1,8}$")
SAFE_ENUM = re.compile(r"^[A-Za-z0-9_.:-]{1,80}$")
_LAST_CLEANUP: datetime | None = None

@dataclass(frozen=True)
class MetaRule:
    kind: str
    min: int | None = None
    max: int | None = None
    choices: frozenset[str] | None = None

@dataclass(frozen=True)
class EventDef:
    components: frozenset[str]
    level: str
    metadata: dict[str, MetaRule]

COMMON = {
    "source_count": MetaRule("int", 0, 50), "output_count": MetaRule("int", 0, 50),
    "batch_position": MetaRule("int", 0, 1000), "credential_selected": MetaRule("bool"),
    "attempt_number": MetaRule("int", 0, 1000), "duration_ms": MetaRule("int", 0, 86400000),
    "retryable": MetaRule("bool"), "boundary": MetaRule("enum"), "error_code": MetaRule("enum"),
    "http_status_category": MetaRule("enum", choices=frozenset({"1xx","2xx","3xx","4xx","5xx","unknown"})),
    "final_job_status": MetaRule("enum", choices=frozenset({"queued","processing","cancelled","failed","completed"})),
    "endpoint_group": MetaRule("enum"),
}
REGISTRY: dict[str, EventDef] = {}
for code in ["JOB_CREATED", "JOB_CANCEL_REQUESTED"]:
    REGISTRY[code] = EventDef(frozenset({"api"}), "INFO", COMMON)
for code in ["JOB_CLAIMED", "PROCESSING_STARTED", "SOURCE_VALIDATION_STARTED", "SOURCE_READY", "PROVIDER_REQUEST_STARTED", "PROVIDER_REQUEST_COMPLETED", "OUTPUT_CREATION_STARTED", "OUTPUT_PERSISTED", "JOB_COMPLETED", "JOB_CANCELLED"]:
    REGISTRY[code] = EventDef(frozenset({"worker"}), "INFO", COMMON)
for code in ["PROVIDER_REQUEST_FAILED", "JOB_FAILED", "WORKER_ITERATION_FAILED"]:
    REGISTRY[code] = EventDef(frozenset({"worker"}), "ERROR", COMMON)
REGISTRY["API_REQUEST_FAILED"] = EventDef(frozenset({"api"}), "WARNING", COMMON)

@dataclass(frozen=True)
class DiagnosticWriteResult:
    accepted: bool
    persisted: bool = False
    reason: str | None = None
    event_id: str | None = None

def new_opaque_id(prefix: str = "dg") -> str:
    return f"{prefix}_{secrets.token_urlsafe(18).rstrip('=')}"

def valid_opaque_id(value: str | None) -> bool:
    return value is None or bool((UUID_RE.fullmatch(value) or OPAQUE_RE.fullmatch(value)) and not URL_RE.search(value) and "@" not in value)

def sanitize_build_id(value: str | None) -> str:
    value = (value or "unknown").strip()[:80]
    return value if SAFE_ENUM.fullmatch(value) else "unknown"

def sanitize_metadata(code: str, metadata: dict[str, Any] | None) -> dict[str, Any] | None:
    definition = REGISTRY.get(code)
    if not definition:
        return None
    safe: dict[str, Any] = {}
    for key, value in (metadata or {}).items():
        rule = definition.metadata.get(key)
        if not rule or BAD_KEY_RE.search(key) or isinstance(value, (dict, list, tuple, set)):
            return None
        if isinstance(value, str) and (URL_RE.search(value) or FILENAME_RE.search(value) or "\n\n" in value or len(value) > 120):
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
            if not isinstance(value, str) or not SAFE_ENUM.fullmatch(value): return None
            if rule.choices and value not in rule.choices: return None
            safe[key] = value
        else:
            return None
    encoded = json.dumps(safe, sort_keys=True, separators=(",", ":"))
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

def expiry_for(level: str, now: datetime, settings=None) -> datetime:
    settings = settings or get_settings()
    days = max(1, min(int(settings.diagnostic_retention_days), 30))
    hours = max(1, min(int(settings.diagnostic_debug_retention_hours), 24))
    return now + (timedelta(hours=hours) if level == "DEBUG" else timedelta(days=days))

def fingerprint(*, owner_user_id, component, level, event_code, project_id, job_id, metadata, bucket) -> str:
    payload = {"o": owner_user_id, "c": component, "l": level, "e": event_code, "p": project_id, "j": job_id, "m": metadata, "b": bucket.isoformat()}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

def write_diagnostic_event(*, owner_user_id: str, component: str, event_code: str, level: str | None = None, project_id: str | None = None, job_id: str | None = None, correlation_id: str | None = None, request_id: str | None = None, metadata: dict[str, Any] | None = None, session_factory=SessionLocal, now: datetime | None = None) -> DiagnosticWriteResult:
    definition = REGISTRY.get(event_code)
    if not definition: return DiagnosticWriteResult(False, reason="unknown_event_code")
    component = getattr(component, "value", component); level = level or definition.level
    if component not in definition.components or level not in DiagnosticLevel.__members__: return DiagnosticWriteResult(False, reason="invalid_scope")
    if not all(valid_opaque_id(v) for v in [owner_user_id, project_id, job_id, correlation_id, request_id]): return DiagnosticWriteResult(False, reason="invalid_identifier")
    safe = sanitize_metadata(event_code, metadata)
    if safe is None: return DiagnosticWriteResult(False, reason="invalid_metadata")
    now_dt = _as_utc_naive(now); bucket = _bucket(now_dt)
    fp = fingerprint(owner_user_id=owner_user_id, component=component, level=level, event_code=event_code, project_id=project_id, job_id=job_id, metadata=safe, bucket=bucket)
    db = session_factory()
    try:
        row = db.query(DiagnosticEvent).filter_by(dedup_fingerprint=fp).one_or_none()
        if row:
            row.occurrence_count += 1; row.last_occurred_at = now_dt
            db.commit(); return DiagnosticWriteResult(True, True, event_id=row.id)
        row = DiagnosticEvent(owner_user_id=owner_user_id, project_id=project_id, job_id=job_id, level=DiagnosticLevel[level], component=DiagnosticComponent(component), event_code=event_code, correlation_id=correlation_id, request_id=request_id, metadata_json=json.dumps(safe, sort_keys=True), first_occurred_at=now_dt, last_occurred_at=now_dt, occurrence_count=1, dedup_fingerprint=fp, dedup_bucket=bucket, expires_at=expiry_for(level, now_dt))
        db.add(row); db.commit(); return DiagnosticWriteResult(True, True, event_id=row.id)
    except IntegrityError:
        db.rollback()
        try:
            row = db.query(DiagnosticEvent).filter_by(dedup_fingerprint=fp).one_or_none()
            if row:
                row.occurrence_count += 1; row.last_occurred_at = now_dt; db.commit(); return DiagnosticWriteResult(True, True, event_id=row.id)
        except Exception:
            db.rollback()
    except Exception:
        db.rollback(); LOGGER.warning("diagnostic_write_failed")
    finally:
        try: db.close()
        except Exception: pass
    return DiagnosticWriteResult(True, False, reason="persistence_failed")

def cleanup_expired_diagnostics(*, session_factory=SessionLocal, now: datetime | None = None, force=False) -> None:
    global _LAST_CLEANUP
    now_dt = _as_utc_naive(now); settings = get_settings()
    interval = max(60, min(int(settings.diagnostic_cleanup_interval_seconds), 86400))
    if not force and _LAST_CLEANUP and now_dt - _LAST_CLEANUP < timedelta(seconds=interval):
        return
    _LAST_CLEANUP = now_dt
    db = session_factory()
    try:
        ids = [r[0] for r in db.query(DiagnosticEvent.id).filter(DiagnosticEvent.expires_at <= now_dt).order_by(DiagnosticEvent.expires_at.asc()).limit(max(1, min(settings.diagnostic_cleanup_batch_size, 1000))).all()]
        if ids:
            db.query(DiagnosticEvent).filter(DiagnosticEvent.id.in_(ids)).delete(synchronize_session=False)
        db.commit()
    except Exception:
        db.rollback(); LOGGER.warning("diagnostic_cleanup_failed")
    finally:
        db.close()

def encode_cursor(dt: datetime, event_id: str) -> str:
    raw = json.dumps({"t": _as_utc_naive(dt).isoformat(), "i": event_id}, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")

def decode_cursor(cursor: str) -> tuple[datetime, str] | None:
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        data = json.loads(base64.urlsafe_b64decode(padded.encode()))
        dt = datetime.fromisoformat(data["t"])
        eid = data["i"]
        return (_as_utc_naive(dt), eid) if valid_opaque_id(eid) else None
    except Exception:
        return None

def markdown_escape(value: Any) -> str:
    text = str(value if value is not None else "")
    text = re.sub(r"<[^>]*>", "", text).replace("`", "\\`")
    return re.sub(r"([\\*_{}\[\]()#+\-.!|])", r"\\\1", text)[:500]

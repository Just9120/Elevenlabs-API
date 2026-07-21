import json
from sqlalchemy.orm import Session
from .models import AuditEvent

SAFE_KEYS={"provider","credential_id","version","session_id","reason"}
SAFE_ENUM_VALUES={
    "blocker": {
        "queued_job_uses_source",
        "processing_job_uses_source",
        "retryable_failed_job_uses_source",
        "project_unavailable",
        "source_already_deleted",
        "unsupported_source_state",
    },
    "deletion_reason": {"user_deleted", "retention_expired"},
    "cleanup_outcome": {"not_applicable", "pending", "completed", "failed"},
}
MAX_CLEANUP_ATTEMPT=100000
FORBIDDEN_SUBSTRINGS=(
    "source_id",
    "job_id",
    "project_id",
    "bucket",
    "object_key",
    "key",
    "filename",
    "url",
    "owner",
    "generation",
    "lease",
    "exception",
    "traceback",
    "token",
    "secret",
)

def _safe_audit_metadata(metadata):
    safe={k:v for k,v in metadata.items() if k in SAFE_KEYS}
    for key, allowed in SAFE_ENUM_VALUES.items():
        value=metadata.get(key)
        if isinstance(value, str) and value in allowed:
            safe[key]=value
    attempt=metadata.get("cleanup_attempt")
    if isinstance(attempt, int) and not isinstance(attempt, bool) and 0 <= attempt <= MAX_CLEANUP_ATTEMPT:
        safe["cleanup_attempt"]=attempt
    return {
        k: v
        for k, v in safe.items()
        if not any(part in k.lower() for part in FORBIDDEN_SUBSTRINGS)
    }

def audit(db: Session, event_type: str, actor_user_id: str|None=None, subject_user_id: str|None=None, **metadata):
    safe=_safe_audit_metadata(metadata)
    db.add(AuditEvent(event_type=event_type, actor_user_id=actor_user_id, subject_user_id=subject_user_id, metadata_json=json.dumps(safe, sort_keys=True)))

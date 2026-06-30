import json
from sqlalchemy.orm import Session
from .models import AuditEvent
SAFE_KEYS={"provider","credential_id","version","session_id","reason"}
def audit(db: Session, event_type: str, actor_user_id: str|None=None, subject_user_id: str|None=None, **metadata):
    safe={k:v for k,v in metadata.items() if k in SAFE_KEYS}
    db.add(AuditEvent(event_type=event_type, actor_user_id=actor_user_id, subject_user_id=subject_user_id, metadata_json=json.dumps(safe, sort_keys=True)))

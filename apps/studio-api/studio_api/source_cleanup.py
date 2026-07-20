from __future__ import annotations

from sqlalchemy.orm import Session

from .config import Settings
from .security import utcnow
from .source_deletion import run_one_source_cleanup


def cleanup_expired_local_uploads(db: Session, settings: Settings) -> int:
    return 1 if run_one_source_cleanup(db, settings=settings, owner_id="legacy-source-cleanup", now=utcnow()) else 0

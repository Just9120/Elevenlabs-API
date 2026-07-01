from __future__ import annotations

from sqlalchemy.orm import Session

from .config import Settings
from .models import Source, SourceType, SourceUploadStatus
from .security import utcnow
from .source_storage import get_source_storage


def cleanup_expired_local_uploads(db: Session, settings: Settings) -> int:
    now = utcnow()
    rows = (
        db.query(Source)
        .filter(
            Source.source_type == SourceType.local_upload,
            Source.expires_at <= now,
            Source.deleted_at.is_(None),
        )
        .all()
    )
    storage = get_source_storage(settings) if rows else None
    count = 0
    for src in rows:
        if src.s3_object_key and storage is not None:
            storage.delete_object(src.s3_object_key)
        src.upload_status = SourceUploadStatus.expired
        src.deleted_at = now
        src.delete_reason = "expired"
        src.updated_at = now
        count += 1
    db.commit()
    return count

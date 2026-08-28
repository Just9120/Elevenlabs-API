from __future__ import annotations

import hashlib
import hmac
import json
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .models import Project, RealtimeTranscriptDraft
from .security import decrypt, encrypt, master_key_from_b64


MAX_COMMITTED_SEGMENTS = 5_000
MAX_COMMITTED_CHARACTERS = 500_000
MAX_PARTIAL_CHARACTERS = 20_000
CLIENT_SESSION_PATTERN = re.compile(r"^[A-Za-z0-9_-]{16,64}$")


class RealtimeDraftReason(str, Enum):
    scope_conflict = "realtime_draft_scope_conflict"
    revision_conflict = "realtime_draft_revision_conflict"
    payload_too_large = "realtime_draft_payload_too_large"
    payload_invalid = "realtime_draft_payload_invalid"
    crypto_failed = "realtime_draft_crypto_failed"


class RealtimeDraftError(RuntimeError):
    def __init__(self, reason: RealtimeDraftReason):
        self.reason = reason
        super().__init__(reason.value)


@dataclass(frozen=True)
class RealtimeDraftContent:
    client_session_id: str
    revision: int
    committed_segments: tuple[str, ...]
    partial: str
    updated_at: datetime
    expires_at: datetime


def save_realtime_draft(
    db: Session,
    *,
    owner_user_id: str,
    project: Project,
    client_session_id: str,
    revision: int,
    committed_segments: list[str],
    partial: str,
    settings,
    now: datetime,
) -> RealtimeDraftContent:
    _require_project_scope(project, owner_user_id)
    client_session_id = _client_session_id(client_session_id)
    payload, segments, partial = _serialize_payload(committed_segments, partial)
    key = _key(settings)
    existing = db.execute(
        select(RealtimeTranscriptDraft)
        .where(
            RealtimeTranscriptDraft.owner_user_id == owner_user_id,
            RealtimeTranscriptDraft.client_session_id == client_session_id,
        )
        .with_for_update()
    ).scalar_one_or_none()
    if existing is not None and _expired(existing.expires_at, now):
        db.delete(existing)
        db.flush()
        existing = None
    if existing is not None and existing.project_id != project.id:
        raise RealtimeDraftError(RealtimeDraftReason.scope_conflict)
    if existing is not None and revision < existing.revision:
        raise RealtimeDraftError(RealtimeDraftReason.revision_conflict)

    row_id = existing.id if existing is not None else str(uuid.uuid4())
    associated = _draft_aad(
        owner_user_id,
        project.id,
        row_id,
        client_session_id,
        revision,
    )
    payload_hmac = hmac.new(
        key,
        associated + payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if existing is not None and revision == existing.revision:
        if hmac.compare_digest(existing.payload_hmac, payload_hmac):
            return _row_content(existing, settings=settings)
        raise RealtimeDraftError(RealtimeDraftReason.revision_conflict)

    try:
        ciphertext, nonce = encrypt(payload, key, associated)
    except Exception as exc:
        raise RealtimeDraftError(RealtimeDraftReason.crypto_failed) from exc
    expires_at = now + timedelta(seconds=settings.realtime_draft_ttl_seconds)
    if existing is None:
        row = RealtimeTranscriptDraft(
            id=row_id,
            owner_user_id=owner_user_id,
            project_id=project.id,
            client_session_id=client_session_id,
            revision=revision,
            ciphertext=ciphertext,
            nonce=nonce,
            key_id=settings.credential_key_id,
            payload_hmac=payload_hmac,
            committed_segment_count=len(segments),
            committed_character_count=sum(len(segment) for segment in segments),
            partial_character_count=len(partial),
            created_at=now,
            updated_at=now,
            expires_at=expires_at,
        )
        db.add(row)
    else:
        row = existing
        row.revision = revision
        row.ciphertext = ciphertext
        row.nonce = nonce
        row.key_id = settings.credential_key_id
        row.payload_hmac = payload_hmac
        row.committed_segment_count = len(segments)
        row.committed_character_count = sum(len(segment) for segment in segments)
        row.partial_character_count = len(partial)
        row.updated_at = now
        row.expires_at = expires_at
    db.flush()
    return RealtimeDraftContent(
        client_session_id=row.client_session_id,
        revision=row.revision,
        committed_segments=segments,
        partial=partial,
        updated_at=row.updated_at,
        expires_at=row.expires_at,
    )


def load_latest_realtime_draft(
    db: Session,
    *,
    owner_user_id: str,
    project: Project,
    settings,
    now: datetime,
) -> RealtimeDraftContent | None:
    _require_project_scope(project, owner_user_id)
    cleanup_expired_realtime_drafts(
        db,
        now=now,
        owner_user_id=owner_user_id,
        project_id=project.id,
    )
    row = db.execute(
        select(RealtimeTranscriptDraft)
        .where(
            RealtimeTranscriptDraft.owner_user_id == owner_user_id,
            RealtimeTranscriptDraft.project_id == project.id,
            RealtimeTranscriptDraft.expires_at > now,
        )
        .order_by(
            RealtimeTranscriptDraft.updated_at.desc(),
            RealtimeTranscriptDraft.created_at.desc(),
        )
        .limit(1)
    ).scalar_one_or_none()
    return _row_content(row, settings=settings) if row is not None else None


def delete_realtime_draft(
    db: Session,
    *,
    owner_user_id: str,
    project: Project,
    client_session_id: str,
) -> bool:
    _require_project_scope(project, owner_user_id)
    normalized = _client_session_id(client_session_id)
    result = db.execute(
        delete(RealtimeTranscriptDraft).where(
            RealtimeTranscriptDraft.owner_user_id == owner_user_id,
            RealtimeTranscriptDraft.project_id == project.id,
            RealtimeTranscriptDraft.client_session_id == normalized,
        )
    )
    return bool(result.rowcount)


DEFAULT_REALTIME_DRAFT_CLEANUP_BATCH_SIZE = 500
MAX_REALTIME_DRAFT_CLEANUP_BATCH_SIZE = 1000


def cleanup_expired_realtime_drafts(
    db: Session,
    *,
    now: datetime,
    owner_user_id: str | None = None,
    project_id: str | None = None,
    limit: int = DEFAULT_REALTIME_DRAFT_CLEANUP_BATCH_SIZE,
) -> int:
    safe_limit = max(1, min(int(limit), MAX_REALTIME_DRAFT_CLEANUP_BATCH_SIZE))
    expired_ids = select(RealtimeTranscriptDraft.id).where(
        RealtimeTranscriptDraft.expires_at <= now
    )
    if owner_user_id is not None:
        expired_ids = expired_ids.where(
            RealtimeTranscriptDraft.owner_user_id == owner_user_id
        )
    if project_id is not None:
        expired_ids = expired_ids.where(
            RealtimeTranscriptDraft.project_id == project_id
        )
    expired_ids = expired_ids.order_by(
        RealtimeTranscriptDraft.expires_at.asc(),
        RealtimeTranscriptDraft.id.asc(),
    ).limit(safe_limit)
    return int(
        db.execute(
            delete(RealtimeTranscriptDraft).where(
                RealtimeTranscriptDraft.id.in_(expired_ids)
            )
        ).rowcount
        or 0
    )


def _row_content(row: RealtimeTranscriptDraft, *, settings) -> RealtimeDraftContent:
    if row.key_id != settings.credential_key_id:
        raise RealtimeDraftError(RealtimeDraftReason.crypto_failed)
    key = _key(settings)
    associated = _draft_aad(
        row.owner_user_id,
        row.project_id,
        row.id,
        row.client_session_id,
        row.revision,
    )
    try:
        payload = decrypt(row.ciphertext, row.nonce, key, associated)
    except Exception as exc:
        raise RealtimeDraftError(RealtimeDraftReason.crypto_failed) from exc
    expected_hmac = hmac.new(
        key,
        associated + payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected_hmac, row.payload_hmac):
        raise RealtimeDraftError(RealtimeDraftReason.payload_invalid)
    try:
        candidate = json.loads(payload)
    except Exception as exc:
        raise RealtimeDraftError(RealtimeDraftReason.payload_invalid) from exc
    if not isinstance(candidate, dict) or set(candidate) != {"segments", "partial"}:
        raise RealtimeDraftError(RealtimeDraftReason.payload_invalid)
    try:
        _serialized, segments, partial = _serialize_payload(
            candidate["segments"],
            candidate["partial"],
        )
    except RealtimeDraftError as exc:
        raise RealtimeDraftError(RealtimeDraftReason.payload_invalid) from exc
    if (
        row.committed_segment_count != len(segments)
        or row.committed_character_count != sum(len(item) for item in segments)
        or row.partial_character_count != len(partial)
    ):
        raise RealtimeDraftError(RealtimeDraftReason.payload_invalid)
    return RealtimeDraftContent(
        client_session_id=row.client_session_id,
        revision=row.revision,
        committed_segments=segments,
        partial=partial,
        updated_at=row.updated_at,
        expires_at=row.expires_at,
    )


def _serialize_payload(segments, partial) -> tuple[str, tuple[str, ...], str]:
    if not isinstance(segments, (list, tuple)) or len(segments) > MAX_COMMITTED_SEGMENTS:
        raise RealtimeDraftError(RealtimeDraftReason.payload_too_large)
    if not isinstance(partial, str):
        raise RealtimeDraftError(RealtimeDraftReason.payload_invalid)
    normalized: list[str] = []
    total = 0
    for segment in segments:
        if not isinstance(segment, str):
            raise RealtimeDraftError(RealtimeDraftReason.payload_invalid)
        if not segment or len(segment) > MAX_PARTIAL_CHARACTERS:
            raise RealtimeDraftError(RealtimeDraftReason.payload_too_large)
        total += len(segment)
        if total > MAX_COMMITTED_CHARACTERS:
            raise RealtimeDraftError(RealtimeDraftReason.payload_too_large)
        normalized.append(segment)
    if len(partial) > MAX_PARTIAL_CHARACTERS:
        raise RealtimeDraftError(RealtimeDraftReason.payload_too_large)
    payload = json.dumps(
        {"segments": normalized, "partial": partial},
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return payload, tuple(normalized), partial


def _client_session_id(value: str) -> str:
    normalized = value.strip() if isinstance(value, str) else ""
    if not CLIENT_SESSION_PATTERN.fullmatch(normalized):
        raise RealtimeDraftError(RealtimeDraftReason.payload_invalid)
    return normalized


def _require_project_scope(project: Project, owner_user_id: str) -> None:
    if project.owner_user_id != owner_user_id or project.archived_at is not None:
        raise RealtimeDraftError(RealtimeDraftReason.scope_conflict)


def _key(settings) -> bytes:
    try:
        return master_key_from_b64(settings.master_key_b64())
    except Exception as exc:
        raise RealtimeDraftError(RealtimeDraftReason.crypto_failed) from exc


def _draft_aad(owner, project, draft, client_session, revision) -> bytes:
    return (
        f"owner={owner};project={project};draft={draft};client_session={client_session};"
        f"revision={revision};purpose=realtime_transcript_draft_v1"
    ).encode("utf-8")


def _expired(expires_at: datetime, now: datetime) -> bool:
    if expires_at.tzinfo is not None and now.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=None)
    elif expires_at.tzinfo is None and now.tzinfo is not None:
        now = now.replace(tzinfo=None)
    return expires_at <= now

"""Worker-rendered, bounded transient downloads. No finished audio in S3."""
from __future__ import annotations

import logging
import shutil
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote

import anyio
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from .audio_preparation_service import (
    AUDIO_DRIVE_EXPORT_STAGES, AudioPreparationServiceError, AudioPreparationServiceReason,
    load_owned_audio_preparation_job, require_audio_result_sources,
)
from .models import AudioPreparationJob, AudioPreparationStatus, Project
from .security import utcnow

READY_TTL_SECONDS = 15 * 60
DOWNLOAD_WORK_TTL = timedelta(hours=3)
DOWNLOAD_WORK_STAGES = ("audio_download_queued", "audio_download_rendering")
DOWNLOAD_ACTIVE_STAGES = DOWNLOAD_WORK_STAGES + ("audio_download_ready", "audio_download_transferring")
_MARKER = "studio-transient-audio-v1"
LOGGER = logging.getLogger("studio_api.audio_downloads")


def _naive(value: datetime) -> datetime:
    return value.astimezone(timezone.utc).replace(tzinfo=None) if value.tzinfo else value


class AudioDownloadError(RuntimeError):
    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(reason)


def download_directory(root: Path, request_id: str) -> Path:
    try:
        if str(uuid.UUID(request_id)) != request_id:
            raise ValueError()
    except (TypeError, ValueError, AttributeError):
        raise AudioDownloadError("download_unavailable") from None
    path = root / ("render-" + request_id)
    if root.is_symlink() or path.is_symlink() or path.resolve().parent != root.resolve():
        raise AudioDownloadError("download_unavailable")
    return path


def remove_download_directory(root: Path, request_id: str):
    path = download_directory(root, request_id)
    if not path.exists():
        return
    marker = path / ".studio-render"
    if marker.is_symlink() or not marker.is_file() or marker.read_text() != _MARKER:
        raise AudioDownloadError("download_unavailable")
    # Resolved path is a direct child of the explicit transfer root. Unknown
    # paths, symlinks and unmarked directories are never recursively removed.
    shutil.rmtree(path)


def expire_audio_downloads(db, *, root: Path, now: datetime) -> int:
    jobs = list(db.execute(select(AudioPreparationJob).where(
        AudioPreparationJob.download_request_id.is_not(None),
        AudioPreparationJob.download_expires_at <= _naive(now),
    ).order_by(AudioPreparationJob.download_expires_at).limit(10)
        .with_for_update(skip_locked=True)).scalars())
    for job in jobs:
        remove_download_directory(root, job.download_request_id)
        if job.current_stage in DOWNLOAD_ACTIVE_STAGES:
            job.current_stage = job.download_previous_stage or "completed"
            job.progress_percent = 100
            job.lease_owner_id = None
            job.lease_expires_at = None
        job.download_slot = None
        job.download_request_id = None
        job.download_expires_at = None
        job.download_error_code = "download_expired"
    db.flush()
    return len(jobs)


def mark_worker_download_ready(db, *, job, result, root: Path, now: datetime, owner, generation, request_id):
    job = db.execute(select(AudioPreparationJob).where(AudioPreparationJob.id == job.id,
        AudioPreparationJob.lease_owner_id == owner, AudioPreparationJob.lease_generation == generation,
        AudioPreparationJob.download_request_id == request_id).with_for_update()
        .execution_options(populate_existing=True)).scalar_one_or_none()
    if (job is None or job.current_stage != "audio_download_rendering" or not job.lease_expires_at
        or _naive(job.lease_expires_at) <= _naive(now) or not job.download_expires_at
        or _naive(job.download_expires_at) <= _naive(now) or job.cancel_requested_at):
        raise AudioPreparationServiceError(AudioPreparationServiceReason.lease_unavailable)
    directory = download_directory(root, job.download_request_id)
    if result.path.parent != directory / f"attempt-{generation}":
        raise AudioDownloadError("download_unavailable")
    result.path.rename(directory / "output")
    result.path.parent.rmdir()
    job.download_size_bytes = result.size_bytes
    if not job.download_preview:
        job.output_size_bytes = result.size_bytes
    job.current_stage = "audio_download_ready"
    job.download_expires_at = _naive(now + timedelta(seconds=READY_TTL_SECONDS))
    job.progress_percent = 100
    job.lease_owner_id = None
    job.lease_expires_at = None
    db.flush()


def create_worker_download_directory(job, root: Path) -> Path:
    if not root.is_dir() or root.is_symlink():
        raise AudioDownloadError("download_unavailable")
    directory = download_directory(root, job.download_request_id)
    if directory.exists():
        marker = directory / ".studio-render"
        if marker.is_symlink() or not marker.is_file() or marker.read_text() != _MARKER:
            raise AudioDownloadError("download_unavailable")
    else:
        directory.mkdir(mode=0o700)
        (directory / ".studio-render").write_text(_MARKER)
    # A reclaimed lease renders into its own directory. A resumed stale worker
    # cannot overwrite or remove the current attempt; publication is DB fenced.
    if not isinstance(job.lease_generation, int) or job.lease_generation < 1:
        raise AudioDownloadError("download_unavailable")
    attempt = directory / f"attempt-{job.lease_generation}"
    attempt.mkdir(mode=0o700)
    return attempt


def remove_worker_download_attempt(root: Path, request_id: str, generation: int):
    directory = download_directory(root, request_id)
    attempt = directory / f"attempt-{generation}"
    if not attempt.exists():
        return
    marker = directory / ".studio-render"
    if (not isinstance(generation, int) or generation < 1 or directory.is_symlink()
        or attempt.is_symlink() or attempt.resolve().parent != directory.resolve()
        or marker.is_symlink() or not marker.is_file() or marker.read_text() != _MARKER):
        raise AudioDownloadError("download_unavailable")
    shutil.rmtree(attempt)


@dataclass(frozen=True)
class DownloadTransfer:
    owner: str
    job_id: str
    request_id: str
    path: Path
    filename: str
    mime_type: str
    size_bytes: int


class AudioDownloadManager:
    """API admission/transfer only. Rendering stays in the media worker.

    A unique nullable DB slot bounds the whole service to one queued/rendered
    artifact. State survives API restart; the tmpfs transfer volume is not an
    archive. Owner checks, worker leases, a deadline and a janitor fence it.
    """
    def __init__(self, session_factory, settings, *, clock=utcnow, cache_root: Path | None = None):
        self.session_factory = session_factory
        self.settings = settings
        self.clock = clock
        self.cache_root = cache_root or Path(settings.audio_delivery_directory)
        self.stop = threading.Event()
        self.janitor = None

    def start(self):
        if self.janitor:
            return
        self.stop.clear()
        def sweep():
            while not self.stop.wait(30):
                try:
                    with self.session_factory() as db:
                        expire_audio_downloads(db, root=self.cache_root, now=self.clock())
                        db.commit()
                except Exception:
                    LOGGER.warning("audio_download_cleanup_failed")
        self.janitor = threading.Thread(target=sweep, name="studio-audio-download-cleanup", daemon=True)
        self.janitor.start()

    def close(self):
        self.stop.set()
        if self.janitor:
            self.janitor.join(timeout=2)
            self.janitor = None

    @staticmethod
    def _payload(job):
        if job.download_error_code:
            return {"state": "failed", "percent": 0, "reason": job.download_error_code}
        state = "ready" if job.current_stage == "audio_download_ready" else "preparing"
        return {"state": state, "percent": job.progress_percent, "reason": None}

    def prepare(self, db, *, owner: str, job_id: str, preview: bool = False):
        if not self.cache_root.is_dir() or self.cache_root.is_symlink():
            raise AudioDownloadError("download_unavailable")
        job = load_owned_audio_preparation_job(db, owner_user_id=owner, job_id=job_id)
        project = db.get(Project, job.project_id)
        if not project or project.owner_user_id != owner or project.archived_at:
            raise AudioPreparationServiceError(AudioPreparationServiceReason.project_unavailable)
        if job.download_slot == 1 and job.download_expires_at and _naive(job.download_expires_at) > _naive(self.clock()):
            if job.download_preview != preview:
                raise AudioDownloadError("download_busy")
            if job.current_stage == "audio_download_transferring":
                raise AudioDownloadError("download_busy")
            if job.current_stage == "audio_download_ready":
                path = download_directory(self.cache_root, job.download_request_id) / "output"
                if path.is_symlink() or not path.is_file() or path.stat().st_size != job.download_size_bytes:
                    job.download_expires_at = _naive(self.clock())
                    db.flush()
                    expire_audio_downloads(db, root=self.cache_root, now=self.clock())
                    db.commit()
                else:
                    db.commit()
                    return self._payload(job)
            elif job.current_stage in DOWNLOAD_WORK_STAGES:
                db.commit()
                return self._payload(job)
        require_audio_result_sources(db, job, now=self.clock())
        expire_audio_downloads(db, root=self.cache_root, now=self.clock())
        job = db.execute(select(AudioPreparationJob).where(AudioPreparationJob.id == job_id,
            AudioPreparationJob.owner_user_id == owner).with_for_update()
            .execution_options(populate_existing=True)).scalar_one()
        if (preview and job.status is not AudioPreparationStatus.preview_ready) or (not preview and (
            job.status is not AudioPreparationStatus.completed or not job.output_filename or job.output_source_id)):
            raise AudioPreparationServiceError(AudioPreparationServiceReason.invalid_state)
        if job.current_stage == "audio_download_transferring":
            raise AudioDownloadError("download_busy")
        if job.download_slot == 1 and job.current_stage in DOWNLOAD_ACTIVE_STAGES:
            if job.download_preview != preview:
                raise AudioDownloadError("download_busy")
            db.commit()
            return self._payload(job)
        if job.current_stage in AUDIO_DRIVE_EXPORT_STAGES or (job.lease_owner_id and job.lease_expires_at
            and _naive(job.lease_expires_at) > _naive(self.clock())):
            raise AudioPreparationServiceError(AudioPreparationServiceReason.lease_unavailable)
        active = db.execute(select(AudioPreparationJob.id).where(AudioPreparationJob.download_slot == 1).limit(1)).scalar_one_or_none()
        if active:
            raise AudioDownloadError("download_busy")
        job.download_previous_stage = job.current_stage
        job.download_request_id = str(uuid.uuid4())
        job.download_slot = 1
        job.download_preview = preview
        job.download_size_bytes = None
        job.download_expires_at = _naive(self.clock() + DOWNLOAD_WORK_TTL)
        job.download_error_code = None
        job.current_stage = "audio_download_queued"
        job.progress_percent = 0
        job.cancel_requested_at = None
        job.lease_owner_id = None
        job.lease_expires_at = None
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise AudioDownloadError("download_busy") from None
        return self._payload(job)

    def status(self, *, owner, job_id):
        with self.session_factory() as db:
            job = load_owned_audio_preparation_job(db, owner_user_id=owner, job_id=job_id)
            if not job.download_request_id or not job.download_expires_at or _naive(job.download_expires_at) <= _naive(self.clock()):
                raise AudioDownloadError("download_expired")
            if job.current_stage == "audio_download_ready":
                path = download_directory(self.cache_root, job.download_request_id) / "output"
                if path.is_symlink() or not path.is_file():
                    raise AudioDownloadError("download_expired")
            return self._payload(job)

    def cancel(self, db, *, owner, job_id):
        job = db.execute(select(AudioPreparationJob).where(AudioPreparationJob.id == job_id,
            AudioPreparationJob.owner_user_id == owner).with_for_update()).scalar_one_or_none()
        if job is None:
            raise AudioPreparationServiceError(AudioPreparationServiceReason.not_found)
        if job.current_stage == "audio_download_rendering":
            job.cancel_requested_at = _naive(self.clock())
        elif job.current_stage in DOWNLOAD_ACTIVE_STAGES:
            if job.download_request_id:
                remove_download_directory(self.cache_root, job.download_request_id)
            job.current_stage = job.download_previous_stage or "completed"
            job.progress_percent = 100
            job.download_slot = None
            job.download_error_code = "cancellation_requested"
        db.commit()
        return self._payload(job)

    def take(self, *, owner, job_id):
        with self.session_factory() as db:
            job = db.execute(select(AudioPreparationJob).where(AudioPreparationJob.id == job_id,
                AudioPreparationJob.owner_user_id == owner).with_for_update()).scalar_one_or_none()
            if job is None:
                raise AudioPreparationServiceError(AudioPreparationServiceReason.not_found)
            if not job.download_request_id or not job.download_expires_at or _naive(job.download_expires_at) <= _naive(self.clock()):
                raise AudioDownloadError("download_expired")
            if job.current_stage != "audio_download_ready" or job.download_slot != 1 or job.download_preview:
                raise AudioDownloadError("download_not_ready")
            path = download_directory(self.cache_root, job.download_request_id) / "output"
            if path.is_symlink() or not path.is_file() or path.stat().st_size != job.download_size_bytes:
                raise AudioDownloadError("download_expired")
            result = DownloadTransfer(owner, job.id, job.download_request_id, path,
                "Фрагмент.wav" if job.download_preview else job.output_filename, "audio/wav" if job.download_preview else job.output_mime_type, job.download_size_bytes)
            job.current_stage = "audio_download_transferring"
            job.download_expires_at = _naive(self.clock() + timedelta(seconds=READY_TTL_SECONDS))
            db.commit()
            return result

    def listen(self, *, owner, job_id):
        with self.session_factory() as db:
            job = load_owned_audio_preparation_job(db, owner_user_id=owner, job_id=job_id)
            project = db.get(Project, job.project_id)
            if not project or project.owner_user_id != owner or project.archived_at:
                raise AudioPreparationServiceError(AudioPreparationServiceReason.project_unavailable)
            if (job.current_stage != "audio_download_ready" or job.download_slot != 1
                or not job.download_expires_at or _naive(job.download_expires_at) <= _naive(self.clock())):
                raise AudioDownloadError("download_expired")
            path = download_directory(self.cache_root, job.download_request_id) / "output"
            if path.is_symlink() or not path.is_file() or path.stat().st_size != job.download_size_bytes:
                raise AudioDownloadError("download_expired")
            return DownloadTransfer(owner, job.id, job.download_request_id, path,
                "Фрагмент.wav" if job.download_preview else job.output_filename, "audio/wav" if job.download_preview else job.output_mime_type, job.download_size_bytes)

    def discard(self, entry: DownloadTransfer):
        with self.session_factory() as db:
            job = db.execute(select(AudioPreparationJob).where(AudioPreparationJob.id == entry.job_id,
                AudioPreparationJob.owner_user_id == entry.owner,
                AudioPreparationJob.download_request_id == entry.request_id).with_for_update()).scalar_one_or_none()
            if not job:
                return
            remove_download_directory(self.cache_root, entry.request_id)
            job.current_stage = job.download_previous_stage or "completed"
            job.progress_percent = 100
            job.download_slot = None
            job.download_request_id = None
            job.download_expires_at = None
            db.commit()


class _TransientResponse(StreamingResponse):
    def __init__(self, content, *, cleanup, **kwargs):
        super().__init__(content, **kwargs)
        self.cleanup = cleanup

    async def __call__(self, scope, receive, send):
        try:
            with anyio.fail_after(READY_TTL_SECONDS):
                await super().__call__(scope, receive, send)
        finally:
            with anyio.CancelScope(shield=True):
                await anyio.to_thread.run_sync(self.cleanup)


def stream_audio_download(manager: AudioDownloadManager, *, owner: str, job_id: str):
    result = manager.take(owner=owner, job_id=job_id)
    async def content():
        async with await anyio.open_file(result.path, "rb") as stream:
            while chunk := await stream.read(1024 * 1024):
                yield chunk
    return _TransientResponse(content(), cleanup=lambda: manager.discard(result), media_type=result.mime_type, headers={
        "Content-Disposition": "attachment; filename*=UTF-8''" + quote(result.filename, safe=""),
        "Content-Length": str(result.size_bytes), "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff", "X-Accel-Buffering": "no",
    })

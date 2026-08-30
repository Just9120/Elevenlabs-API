from __future__ import annotations

import subprocess
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Callable

from sqlalchemy.orm import Session

from .google_connection_access import (
    GoogleConnectionAccessError,
    refresh_user_google_drive_access_token,
)
from .google_drive import GoogleDriveContentError, fetch_drive_file_content
from .models import (
    Source,
    SourceType,
    SourceUploadStatus,
    TranscriptionJob,
    TranscriptionJobSource,
    TranscriptionJobSpeaker,
)
from .source_deletion import is_source_expired
from .security import utcnow
from .source_storage import (
    SourceObjectReadError,
    get_source_storage,
    reference_storage_bucket,
    reference_storage_isolation_configured,
    reference_storage_settings,
    source_reference_class,
)


SPEAKER_SAMPLE_TIMEOUT_SECONDS = 60
SPEAKER_SAMPLE_MAX_BYTES = 2 * 1024 * 1024
_COPY_CHUNK_SIZE = 1024 * 1024


class SpeakerSampleReason(str, Enum):
    not_found = "not_found"
    source_unavailable = "source_unavailable"
    source_too_large = "source_too_large"
    extraction_unavailable = "extraction_unavailable"
    extraction_failed = "extraction_failed"


class SpeakerSampleError(RuntimeError):
    def __init__(self, reason: SpeakerSampleReason):
        self.reason = reason
        super().__init__(reason.value)


@dataclass(frozen=True)
class SpeakerSampleAudio:
    content: bytes
    media_type: str = "audio/mpeg"


def create_speaker_sample_audio(
    db: Session,
    *,
    owner_user_id: str,
    job_id: str,
    speaker_id: str,
    settings,
    storage_factory: Callable = get_source_storage,
    drive_token_resolver: Callable = refresh_user_google_drive_access_token,
    drive_content_fetcher: Callable = fetch_drive_file_content,
    runner: Callable = subprocess.run,
) -> SpeakerSampleAudio:
    row = (
        db.query(TranscriptionJobSpeaker)
        .filter(
            TranscriptionJobSpeaker.id == speaker_id,
            TranscriptionJobSpeaker.job_id == job_id,
            TranscriptionJobSpeaker.owner_user_id == owner_user_id,
        )
        .one_or_none()
    )
    if row is None:
        raise SpeakerSampleError(SpeakerSampleReason.not_found)
    job = db.get(TranscriptionJob, job_id)
    relation = db.get(TranscriptionJobSource, row.job_source_id)
    source = db.get(Source, relation.source_id) if relation is not None else None
    if (
        job is None
        or job.owner_user_id != owner_user_id
        or relation is None
        or relation.job_id != job.id
        or source is None
        or source.project_id != job.project_id
        or source.upload_status != SourceUploadStatus.uploaded
        or source.deleted_at is not None
        or is_source_expired(source, utcnow())
    ):
        raise SpeakerSampleError(SpeakerSampleReason.source_unavailable)

    start_seconds = row.sample_start_ms / 1000
    duration_seconds = (row.sample_end_ms - row.sample_start_ms) / 1000
    if start_seconds < 0 or duration_seconds <= 0 or duration_seconds > 8:
        raise SpeakerSampleError(SpeakerSampleReason.source_unavailable)

    with TemporaryDirectory(prefix="studio-speaker-sample-") as temp_dir:
        root = Path(temp_dir)
        source_path = root / "source-media"
        output_path = root / "speaker-sample.mp3"
        stream = _open_source_stream(
            db,
            source=source,
            owner_user_id=owner_user_id,
            settings=settings,
            storage_factory=storage_factory,
            drive_token_resolver=drive_token_resolver,
            drive_content_fetcher=drive_content_fetcher,
        )
        try:
            copied = 0
            with source_path.open("wb") as target:
                for chunk in stream.iter_chunks(_COPY_CHUNK_SIZE):
                    if not chunk:
                        continue
                    copied += len(chunk)
                    if copied > settings.source_max_upload_bytes:
                        raise SpeakerSampleError(SpeakerSampleReason.source_too_large)
                    target.write(chunk)
        except SpeakerSampleError:
            raise
        except Exception as exc:
            raise SpeakerSampleError(SpeakerSampleReason.source_unavailable) from exc
        finally:
            stream.close()
        if copied <= 0:
            raise SpeakerSampleError(SpeakerSampleReason.source_unavailable)

        command = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(source_path),
            "-ss",
            f"{start_seconds:.3f}",
            "-t",
            f"{duration_seconds:.3f}",
            "-vn",
            "-map_metadata",
            "-1",
            "-ac",
            "1",
            "-ar",
            "24000",
            "-b:a",
            "64k",
            "-y",
            str(output_path),
        ]
        try:
            runner(
                command,
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                timeout=SPEAKER_SAMPLE_TIMEOUT_SECONDS,
            )
        except FileNotFoundError as exc:
            raise SpeakerSampleError(SpeakerSampleReason.extraction_unavailable) from exc
        except (subprocess.SubprocessError, OSError) as exc:
            raise SpeakerSampleError(SpeakerSampleReason.extraction_failed) from exc
        try:
            size = output_path.stat().st_size
            if size <= 0 or size > SPEAKER_SAMPLE_MAX_BYTES:
                raise SpeakerSampleError(SpeakerSampleReason.extraction_failed)
            return SpeakerSampleAudio(content=output_path.read_bytes())
        except SpeakerSampleError:
            raise
        except OSError as exc:
            raise SpeakerSampleError(SpeakerSampleReason.extraction_failed) from exc


def _open_source_stream(
    db: Session,
    *,
    source: Source,
    owner_user_id: str,
    settings,
    storage_factory: Callable,
    drive_token_resolver: Callable,
    drive_content_fetcher: Callable,
):
    if source.source_type == SourceType.local_upload:
        reference_class = source_reference_class(source)
        if (
            not reference_storage_isolation_configured(settings)
            or source.s3_bucket
            != reference_storage_bucket(settings, reference_class)
            or not source.s3_object_key
        ):
            raise SpeakerSampleError(SpeakerSampleReason.source_unavailable)
        try:
            return storage_factory(
                reference_storage_settings(settings, reference_class)
            ).open_read(source.s3_object_key)
        except SourceObjectReadError as exc:
            raise SpeakerSampleError(SpeakerSampleReason.source_unavailable) from exc
    if source.source_type == SourceType.google_drive and source.drive_file_id:
        try:
            token = drive_token_resolver(db, user_id=owner_user_id, settings=settings)
            return drive_content_fetcher(token, source.drive_file_id)
        except (GoogleConnectionAccessError, GoogleDriveContentError) as exc:
            raise SpeakerSampleError(SpeakerSampleReason.source_unavailable) from exc
    raise SpeakerSampleError(SpeakerSampleReason.source_unavailable)

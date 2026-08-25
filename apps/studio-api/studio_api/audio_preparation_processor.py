from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Callable

from sqlalchemy.orm import Session

from .audio_preparation import (
    AudioOutputFormat,
    AudioPreparationError,
    AudioPreparationReason,
    AudioProbe,
    analyze_silence,
    build_ffmpeg_command,
    build_preview,
    probe_media,
    render_output_filename,
    run_processing,
    verify_media_integrity,
)
from .audio_preparation_service import (
    AudioPreparationServiceError,
    AudioPreparationServiceReason,
    complete_audio_preview,
    deserialize_options,
    fail_audio_preparation_job,
    finalize_cancelled_audio_preparation_job,
)
from .google_connection_access import refresh_user_google_drive_access_token
from .google_drive import fetch_drive_file_content
from .google_drive_upload import upload_file_resumable
from .diagnostics import write_diagnostic_event
from .models import (
    AudioPreparationJob,
    AudioPreparationStatus,
    Project,
    Source,
    SourceStorageCleanupStatus,
    SourceType,
    SourceUploadStatus,
    User,
)
from .security import utcnow
from .source_deletion import request_source_deletion
from .source_policy import is_source_expired, is_supported_source_mime_type
from .source_storage import SourceObjectReadError, get_source_storage, safe_filename


_COPY_CHUNK_SIZE = 1024 * 1024
OUTPUT_SOURCE_NAMESPACE = uuid.UUID("b87bbd61-e1e5-4e0b-8c5a-1a6bc043bbce")


@dataclass(frozen=True)
class AudioProcessingResult:
    job_id: str
    status: str
    stage: str
    output_created: bool


def process_claimed_audio_preparation_job(
    db: Session,
    *,
    job_id: str,
    lease_owner_id: str,
    lease_generation: int,
    settings,
    now: datetime | None = None,
    storage_factory: Callable = get_source_storage,
    drive_token_resolver: Callable = refresh_user_google_drive_access_token,
    drive_content_fetcher: Callable = fetch_drive_file_content,
    drive_uploader: Callable = upload_file_resumable,
    runner: Callable | None = None,
    temp_directory_factory: Callable = TemporaryDirectory,
) -> AudioProcessingResult:
    operation_now = now or utcnow()
    job = _load_claimed_job(db, job_id, lease_owner_id, lease_generation)
    try:
        with temp_directory_factory(prefix="studio-audio-preparation-") as temp_dir:
            root = Path(temp_dir)
            paths = _materialize_inputs(
                db,
                job=job,
                root=root,
                settings=settings,
                storage_factory=storage_factory,
                drive_token_resolver=drive_token_resolver,
                drive_content_fetcher=drive_content_fetcher,
            )
            options = deserialize_options(job)
            probes: list[AudioProbe] = []
            silence_durations: list[float] = []
            is_preview = job.status is AudioPreparationStatus.analyzing
            if is_preview:
                _checkpoint(db, job, "analyzing", 10)
            else:
                _checkpoint(db, job, "materializing", 10)
            for index, path in enumerate(paths):
                probes.append(probe_media(path, runner=runner) if runner else probe_media(path))
                if is_preview and options.silence_enabled:
                    silence_durations.extend(
                        analyze_silence(
                            path,
                            threshold_db=options.silence_threshold_db,
                            minimum_seconds=options.silence_min_duration_seconds,
                            runner=runner,
                        )
                        if runner
                        else analyze_silence(
                            path,
                            threshold_db=options.silence_threshold_db,
                            minimum_seconds=options.silence_min_duration_seconds,
                        )
                    )
                elif is_preview:
                    verify_media_integrity(path, runner=runner) if runner else verify_media_integrity(path)
                if is_preview:
                    _checkpoint(db, job, "analyzing", 10 + round(((index + 1) / len(paths)) * 80))
            preview = build_preview(probes, silence_durations, options)
            if job.status is AudioPreparationStatus.analyzing:
                complete_audio_preview(
                    db,
                    job_id=job.id,
                    lease_owner_id=lease_owner_id,
                    lease_generation=lease_generation,
                    total_input_duration_ms=round(preview.input_duration_seconds * 1000),
                    estimated_output_duration_ms=round(preview.estimated_output_duration_seconds * 1000),
                    copy_compatible=preview.copy_compatible,
                )
                db.commit()
                return AudioProcessingResult(job.id, "preview_ready", "preview_ready", False)
            if job.status is not AudioPreparationStatus.processing:
                raise AudioPreparationServiceError(AudioPreparationServiceReason.invalid_state)
            _require_not_cancelled(db, job)
            _checkpoint(db, job, "processing", 20)
            creation_time = _earliest_creation_time(job) or _naive_utc(operation_now)
            extension = _output_extension(job, options, paths)
            output_path = root / f"processed-output.{extension}"
            concat_path = None
            if options.output_format is AudioOutputFormat.copy:
                concat_path = root / "concat-inputs.txt"
                concat_path.write_text(
                    "".join(f"file '{path.name}'\n" for path in paths),
                    encoding="utf-8",
                )
            command = build_ffmpeg_command(
                paths,
                output_path,
                options,
                probes,
                concat_list_path=concat_path,
                creation_time=creation_time,
            )
            expected_duration_seconds = max(
                1.0,
                (job.estimated_output_duration_ms or job.total_input_duration_ms or 1000) / 1000,
            )
            last_processing_percent = 20

            def report_processing_progress(ratio: float) -> None:
                nonlocal last_processing_percent
                percent = min(80, 20 + round(max(0.0, min(1.0, ratio)) * 60))
                if percent >= last_processing_percent + 2 or percent == 80:
                    _checkpoint(db, job, "processing", percent)
                    last_processing_percent = percent

            if runner:
                run_processing(command, runner=runner)
            else:
                run_processing(
                    command,
                    expected_duration_seconds=expected_duration_seconds,
                    progress_callback=report_processing_progress,
                )
            _require_not_cancelled(db, job)
            output_probe = probe_media(output_path, runner=runner) if runner else probe_media(output_path)
            output_size = output_path.stat().st_size
            if output_size <= 0:
                raise AudioPreparationError(AudioPreparationReason.processing_failed)
            if output_size > getattr(
                settings,
                "audio_preparation_max_output_bytes",
                settings.source_max_upload_bytes,
            ):
                raise AudioPreparationError(AudioPreparationReason.output_too_large)
            _checkpoint(db, job, "storing", 85)
            output_filename = render_output_filename(
                options,
                created_at=creation_time,
                project_title=db.get(Project, job.project_id).title,
                title=job.title,
            )
            if options.output_format is AudioOutputFormat.copy:
                output_filename = f"{Path(output_filename).stem}.{extension}"
            mime_type = _output_mime(options, job)
            source = _store_output_source(
                db,
                job=job,
                settings=settings,
                output_path=output_path,
                output_filename=output_filename,
                mime_type=mime_type,
                output_size=output_size,
                creation_time=creation_time,
                operation_now=operation_now,
                storage_factory=storage_factory,
            )
            if job.output_destination == "google_drive":
                _checkpoint(db, job, "google_drive_upload", 92)
                token = drive_token_resolver(db, user_id=job.owner_user_id, settings=settings)
                uploaded = drive_uploader(
                    token,
                    folder_id=job.output_drive_folder_id,
                    path=output_path,
                    filename=output_filename,
                    mime_type=mime_type,
                    idempotency_key=job.id,
                )
                job.output_drive_file_id = uploaded.file_id
                job.output_drive_web_view_url = uploaded.web_view_url
            job.output_source_id = source.id
            job.output_duration_ms = round(output_probe.duration_seconds * 1000)
            job.status = AudioPreparationStatus.completed
            job.current_stage = "completed"
            job.progress_percent = 100
            job.finished_at = _naive_utc(operation_now)
            job.lease_owner_id = None
            job.lease_expires_at = None
            # SessionLocal disables autoflush. Persist the terminal job state before
            # deletion readiness checks so the job does not block its own ephemeral
            # input cleanup as an apparently active processing reference.
            db.flush()
            _request_ephemeral_cleanup(db, job, operation_now)
            db.commit()
            return AudioProcessingResult(job.id, "completed", "completed", True)
    except (AudioPreparationError, AudioPreparationServiceError) as exc:
        failure_stage = job.current_stage
        db.rollback()
        reason = getattr(getattr(exc, "reason", None), "value", "processing_failed")
        try:
            if reason == AudioPreparationServiceReason.cancellation_requested.value:
                finalize_cancelled_audio_preparation_job(
                    db,
                    job_id=job_id,
                    lease_owner_id=lease_owner_id,
                    lease_generation=lease_generation,
                    now=utcnow(),
                )
            else:
                fail_audio_preparation_job(
                    db,
                    job_id=job_id,
                    lease_owner_id=lease_owner_id,
                    lease_generation=lease_generation,
                    error_code=reason,
                    now=utcnow(),
                )
            failed_job = db.get(AudioPreparationJob, job_id)
            if failed_job is not None:
                _request_ephemeral_cleanup(db, failed_job, operation_now)
            db.commit()
            _record_failure_diagnostic(failed_job, reason, failure_stage)
        except Exception:
            db.rollback()
        raise
    except Exception as exc:
        failure_stage = job.current_stage
        db.rollback()
        try:
            fail_audio_preparation_job(
                db,
                job_id=job_id,
                lease_owner_id=lease_owner_id,
                lease_generation=lease_generation,
                error_code="processing_failed",
                now=operation_now,
            )
            failed_job = db.get(AudioPreparationJob, job_id)
            if failed_job is not None:
                _request_ephemeral_cleanup(db, failed_job, operation_now)
            db.commit()
            _record_failure_diagnostic(failed_job, "processing_failed", failure_stage)
        except Exception:
            db.rollback()
        raise AudioPreparationError(AudioPreparationReason.processing_failed) from exc


def _load_claimed_job(db, job_id, owner, generation) -> AudioPreparationJob:
    job = db.get(AudioPreparationJob, job_id)
    if job is None:
        raise AudioPreparationServiceError(AudioPreparationServiceReason.not_found)
    if job.lease_owner_id != owner or job.lease_generation != generation:
        raise AudioPreparationServiceError(AudioPreparationServiceReason.lease_unavailable)
    if job.status not in {AudioPreparationStatus.analyzing, AudioPreparationStatus.processing}:
        raise AudioPreparationServiceError(AudioPreparationServiceReason.invalid_state)
    return job


def _materialize_inputs(
    db,
    *,
    job,
    root,
    settings,
    storage_factory,
    drive_token_resolver,
    drive_content_fetcher,
) -> list[Path]:
    project = db.get(Project, job.project_id)
    if project is None or project.owner_user_id != job.owner_user_id or project.archived_at is not None:
        raise AudioPreparationServiceError(AudioPreparationServiceReason.project_unavailable)
    token_cache: dict[str, str] = {}
    paths = []
    for item in job.inputs:
        source = item.source
        if (
            source is None
            or source.project_id != job.project_id
            or source.upload_status is not SourceUploadStatus.uploaded
            or source.deleted_at is not None
            or is_source_expired(source.expires_at, utcnow())
            or not is_supported_source_mime_type(source.mime_type)
        ):
            raise AudioPreparationServiceError(AudioPreparationServiceReason.source_unavailable)
        extension = safe_filename(source.original_filename).rsplit(".", 1)[-1].lower()
        if not extension or len(extension) > 12:
            extension = "media"
        path = root / f"input-{item.position:03d}.{extension}"
        if source.source_type is SourceType.local_upload:
            if source.s3_bucket != settings.source_s3_bucket or not source.s3_object_key:
                raise AudioPreparationServiceError(AudioPreparationServiceReason.source_unavailable)
            try:
                stream = storage_factory(settings).open_read(source.s3_object_key)
            except SourceObjectReadError as exc:
                raise AudioPreparationServiceError(AudioPreparationServiceReason.source_unavailable) from exc
        elif source.source_type is SourceType.google_drive and source.drive_file_id:
            if "token" not in token_cache:
                token_cache["token"] = drive_token_resolver(db, user_id=job.owner_user_id, settings=settings)
            stream = drive_content_fetcher(token_cache["token"], source.drive_file_id)
        else:
            raise AudioPreparationServiceError(AudioPreparationServiceReason.source_unavailable)
        copied = 0
        try:
            with path.open("wb") as target:
                for chunk in stream.iter_chunks(_COPY_CHUNK_SIZE):
                    if not chunk:
                        continue
                    copied += len(chunk)
                    if copied > settings.source_max_upload_bytes:
                        raise AudioPreparationServiceError(AudioPreparationServiceReason.source_unavailable)
                    target.write(chunk)
        finally:
            stream.close()
        if copied <= 0 or (source.size_bytes is not None and copied != source.size_bytes):
            raise AudioPreparationServiceError(AudioPreparationServiceReason.source_unavailable)
        paths.append(path)
    return paths


def _store_output_source(
    db,
    *,
    job,
    settings,
    output_path,
    output_filename,
    mime_type,
    output_size,
    creation_time,
    operation_now,
    storage_factory,
) -> Source:
    source_id = str(uuid.uuid5(OUTPUT_SOURCE_NAMESPACE, job.id))
    key = f"audio-preparation/{job.owner_user_id}/{job.id}/{safe_filename(output_filename)}"
    storage_factory(settings).put_file(key, output_path, mime_type)
    user = db.get(User, job.owner_user_id)
    if user is None:
        raise AudioPreparationServiceError(AudioPreparationServiceReason.project_unavailable)
    source = db.get(Source, source_id)
    if source is None:
        source = Source(
            id=source_id,
            project_id=job.project_id,
            source_type=SourceType.local_upload,
            original_filename=output_filename,
            mime_type=mime_type,
            size_bytes=output_size,
            s3_bucket=settings.source_s3_bucket,
            s3_object_key=key,
            upload_status=SourceUploadStatus.uploaded,
            uploaded_at=_naive_utc(operation_now),
            source_created_at=_naive_utc(creation_time),
            source_created_at_provenance="embedded_media_metadata",
            expires_at=_naive_utc(operation_now) + timedelta(seconds=user.source_retention_ttl_seconds),
            storage_cleanup_status=SourceStorageCleanupStatus.not_requested,
        )
        db.add(source)
        db.flush()
    elif (
        source.project_id != job.project_id
        or source.s3_bucket != settings.source_s3_bucket
        or source.s3_object_key != key
        or source.original_filename != output_filename
        or source.mime_type != mime_type
        or source.size_bytes != output_size
    ):
        raise AudioPreparationServiceError(AudioPreparationServiceReason.invalid_state)
    return source


def _request_ephemeral_cleanup(db, job, now):
    for item in job.inputs:
        if not item.ephemeral_reference:
            continue
        request_source_deletion(
            db,
            owner_user_id=job.owner_user_id,
            source_id=item.source_id,
            now=_naive_utc(now),
        )


def _require_not_cancelled(db, job):
    db.refresh(job)
    db_status = job.cancel_requested_at
    if db_status is not None:
        raise AudioPreparationServiceError(AudioPreparationServiceReason.cancellation_requested)


def _checkpoint(db, job, stage, percent):
    _require_not_cancelled(db, job)
    job.current_stage = stage
    job.progress_percent = percent
    db.commit()


def _record_failure_diagnostic(job, reason, stage):
    if job is None:
        return
    write_diagnostic_event(
        owner_user_id=job.owner_user_id,
        component="worker",
        event_code="AUDIO_PREPARATION_FAILED",
        project_id=job.project_id,
        job_id=job.id,
        metadata={
            "error_code": reason if reason in {item.value for item in AudioPreparationReason} else "processing_failed",
            "stage": stage if stage in {"analyzing", "materializing", "processing", "storing", "google_drive_upload", "failed"} else "failed",
            "input_count": len(job.inputs),
        },
    )


def _earliest_creation_time(job) -> datetime | None:
    values = [item.source.source_created_at for item in job.inputs if item.source and item.source.source_created_at]
    return min((_naive_utc(value) for value in values), default=None)


def _output_extension(job, options, paths) -> str:
    if options.output_format is AudioOutputFormat.copy:
        return paths[0].suffix.lstrip(".").lower() or "audio"
    return options.output_format.value


def _output_mime(options, job) -> str:
    if options.output_format is AudioOutputFormat.wav:
        return "audio/wav"
    if options.output_format is AudioOutputFormat.flac:
        return "audio/flac"
    return job.inputs[0].source.mime_type or "application/octet-stream"


def _naive_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)

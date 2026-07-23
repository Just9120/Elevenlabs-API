from __future__ import annotations

import re
import shutil
import subprocess
from contextlib import contextmanager
from dataclasses import dataclass, field
from enum import Enum
from math import ceil, isfinite
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import BinaryIO, Callable, Iterator


FFMPEG_VIDEO_EXTRACTION_TIMEOUT_SECONDS = 1800
FFMPEG_PART_EXTRACTION_TIMEOUT_SECONDS = 1800
FFPROBE_TIMEOUT_SECONDS = 30
FFMPEG_AUDIO_BITRATE = "192k"
ELEVENLABS_PART_AUDIO_BITRATE = "96k"
ELEVENLABS_PART_MAX_BYTES = 25 * 1024 * 1024
ELEVENLABS_PART_TARGET_BYTES = 20 * 1024 * 1024
ELEVENLABS_PART_TARGET_DURATION_SECONDS = 1320.0
ELEVENLABS_PART_MIN_DURATION_SECONDS = 30.0
ELEVENLABS_PART_OVERLAP_SECONDS = 2.0
ELEVENLABS_MAX_PARTS = 256
_COPY_CHUNK_SIZE = 1024 * 1024


class MediaPreparationReason(str, Enum):
    ffmpeg_unavailable = "ffmpeg_unavailable"
    media_preparation_timeout = "media_preparation_timeout"
    media_preparation_failed = "media_preparation_failed"
    prepared_media_too_large = "prepared_media_too_large"
    media_duration_unavailable = "media_duration_unavailable"
    media_split_failed = "media_split_failed"
    media_part_too_large = "media_part_too_large"


class MediaPreparationError(RuntimeError):
    def __init__(self, reason: MediaPreparationReason):
        self.reason = reason
        super().__init__(reason.value)


@dataclass(frozen=True)
class PreparedMediaInput:
    filename: str
    mime_type: str
    byte_count: int
    stream: BinaryIO = field(repr=False)
    audio_extracted: bool = False
    part_index: int = 1
    part_count: int = 1
    timeline_offset_seconds: float = 0.0
    duration_seconds: float | None = None

    def __repr__(self) -> str:
        return (
            "PreparedMediaInput(filename=<redacted>, "
            f"mime_type={self.mime_type!r}, byte_count={self.byte_count!r}, "
            f"audio_extracted={self.audio_extracted!r}, "
            f"part_index={self.part_index!r}, part_count={self.part_count!r}, "
            f"timeline_offset_seconds={self.timeline_offset_seconds!r}, "
            f"duration_seconds={self.duration_seconds!r}, stream=<redacted>)"
        )


@dataclass(frozen=True)
class PreparedMediaBatch:
    parts: tuple[PreparedMediaInput, ...] = field(repr=False)
    duration_seconds: float
    split_reason: str | None = None

    def __repr__(self) -> str:
        return (
            "PreparedMediaBatch(parts=<redacted>, "
            f"part_count={len(self.parts)!r}, "
            f"duration_seconds={self.duration_seconds!r}, "
            f"split_reason={self.split_reason!r})"
        )


def requires_video_audio_extraction(mime_type: str) -> bool:
    normalized = str(mime_type or "").split(";", 1)[0].strip().lower()
    return normalized.startswith("video/")


@contextmanager
def prepare_elevenlabs_media_input(
    *,
    stream: BinaryIO,
    original_filename: str,
    mime_type: str,
    byte_count: int,
    max_output_bytes: int,
    runner: Callable[..., object] = subprocess.run,
    temporary_directory: str | None = None,
) -> Iterator[PreparedMediaInput]:
    if not requires_video_audio_extraction(mime_type):
        yield PreparedMediaInput(
            filename=original_filename,
            mime_type=mime_type,
            byte_count=byte_count,
            stream=stream,
        )
        return

    if max_output_bytes <= 0:
        raise MediaPreparationError(MediaPreparationReason.media_preparation_failed)

    with TemporaryDirectory(
        prefix="studio-media-",
        dir=temporary_directory,
    ) as temp_dir:
        try:
            root = Path(temp_dir)
            input_path = root / f"source{_safe_input_suffix(original_filename)}"
            output_path = root / "prepared-audio.m4a"
            _copy_input(stream, input_path)
            _run_ffmpeg(runner, input_path, output_path)
            prepared_size = _validated_output_size(output_path, max_output_bytes)
            prepared_name = f"{_safe_stem(original_filename)}.m4a"
            prepared_stream = output_path.open("rb")
        except MediaPreparationError:
            raise
        except Exception as exc:
            raise MediaPreparationError(
                MediaPreparationReason.media_preparation_failed,
            ) from exc
        try:
            yield PreparedMediaInput(
                filename=prepared_name,
                mime_type="audio/mp4",
                byte_count=prepared_size,
                stream=prepared_stream,
                audio_extracted=True,
            )
        finally:
            prepared_stream.close()


@contextmanager
def prepare_elevenlabs_media_parts(
    *,
    stream: BinaryIO,
    original_filename: str,
    mime_type: str,
    byte_count: int,
    max_output_bytes: int,
    runner: Callable[..., object] = subprocess.run,
    temporary_directory: str | None = None,
) -> Iterator[PreparedMediaBatch]:
    with prepare_elevenlabs_media_input(
        stream=stream,
        original_filename=original_filename,
        mime_type=mime_type,
        byte_count=byte_count,
        max_output_bytes=max_output_bytes,
        runner=runner,
        temporary_directory=temporary_directory,
    ) as prepared:
        with TemporaryDirectory(
            prefix="studio-parts-",
            dir=temporary_directory,
        ) as temp_dir:
            part_streams: list[BinaryIO] = []
            try:
                root = Path(temp_dir)
                prepared_path = root / f"prepared-source{_safe_input_suffix(prepared.filename)}"
                _copy_input(prepared.stream, prepared_path)
                prepared_size = _validated_output_size(prepared_path, max_output_bytes)
                duration = _probe_duration_seconds(runner, prepared_path)
                split_reason = _split_reason(prepared_size, duration)
                if split_reason is None:
                    prepared.stream.seek(0)
                    batch = PreparedMediaBatch(
                        parts=(
                            PreparedMediaInput(
                                filename=prepared.filename,
                                mime_type=prepared.mime_type,
                                byte_count=prepared.byte_count,
                                stream=prepared.stream,
                                audio_extracted=prepared.audio_extracted,
                                duration_seconds=duration,
                            ),
                        ),
                        duration_seconds=duration,
                    )
                else:
                    part_specs = _create_split_parts(
                        runner=runner,
                        prepared_path=prepared_path,
                        root=root,
                        prepared_size=prepared_size,
                        duration_seconds=duration,
                        max_total_bytes=max_output_bytes,
                    )
                    part_count = len(part_specs)
                    parts: list[PreparedMediaInput] = []
                    for index, (path, offset, part_duration, part_size) in enumerate(
                        part_specs,
                        start=1,
                    ):
                        part_stream = path.open("rb")
                        part_streams.append(part_stream)
                        parts.append(
                            PreparedMediaInput(
                                filename=f"{_safe_stem(prepared.filename)} - part {index:03d}.m4a",
                                mime_type="audio/mp4",
                                byte_count=part_size,
                                stream=part_stream,
                                audio_extracted=prepared.audio_extracted,
                                part_index=index,
                                part_count=part_count,
                                timeline_offset_seconds=offset,
                                duration_seconds=part_duration,
                            )
                        )
                    batch = PreparedMediaBatch(
                        parts=tuple(parts),
                        duration_seconds=duration,
                        split_reason=split_reason,
                    )
            except MediaPreparationError:
                raise
            except Exception as exc:
                raise MediaPreparationError(
                    MediaPreparationReason.media_split_failed,
                ) from exc
            try:
                yield batch
            finally:
                for part_stream in part_streams:
                    part_stream.close()


def _copy_input(stream: BinaryIO, destination: Path) -> None:
    try:
        stream.seek(0)
        with destination.open("wb") as target:
            shutil.copyfileobj(stream, target, length=_COPY_CHUNK_SIZE)
    except Exception as exc:
        raise MediaPreparationError(
            MediaPreparationReason.media_preparation_failed,
        ) from exc


def _run_ffmpeg(
    runner: Callable[..., object],
    input_path: Path,
    output_path: Path,
) -> None:
    command = [
        "ffmpeg",
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(input_path),
        "-map",
        "0:a:0",
        "-vn",
        "-c:a",
        "aac",
        "-b:a",
        FFMPEG_AUDIO_BITRATE,
        str(output_path),
    ]
    try:
        runner(
            command,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=FFMPEG_VIDEO_EXTRACTION_TIMEOUT_SECONDS,
        )
    except FileNotFoundError as exc:
        raise MediaPreparationError(
            MediaPreparationReason.ffmpeg_unavailable,
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise MediaPreparationError(
            MediaPreparationReason.media_preparation_timeout,
        ) from exc
    except (subprocess.CalledProcessError, OSError) as exc:
        raise MediaPreparationError(
            MediaPreparationReason.media_preparation_failed,
        ) from exc


def _probe_duration_seconds(
    runner: Callable[..., object],
    prepared_path: Path,
) -> float:
    command = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(prepared_path),
    ]
    try:
        completed = runner(
            command,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=FFPROBE_TIMEOUT_SECONDS,
        )
        duration = float(str(getattr(completed, "stdout", "") or "").strip())
    except FileNotFoundError as exc:
        raise MediaPreparationError(MediaPreparationReason.ffmpeg_unavailable) from exc
    except subprocess.TimeoutExpired as exc:
        raise MediaPreparationError(
            MediaPreparationReason.media_preparation_timeout,
        ) from exc
    except (subprocess.CalledProcessError, OSError, TypeError, ValueError) as exc:
        raise MediaPreparationError(
            MediaPreparationReason.media_duration_unavailable,
        ) from exc
    if not isfinite(duration) or duration <= 0:
        raise MediaPreparationError(
            MediaPreparationReason.media_duration_unavailable,
        )
    return duration


def _split_reason(size_bytes: int, duration_seconds: float) -> str | None:
    size_exceeded = size_bytes > ELEVENLABS_PART_MAX_BYTES
    duration_exceeded = duration_seconds > ELEVENLABS_PART_TARGET_DURATION_SECONDS
    if size_exceeded and duration_exceeded:
        return "size_and_duration"
    if size_exceeded:
        return "size"
    if duration_exceeded:
        return "duration"
    return None


def _create_split_parts(
    *,
    runner: Callable[..., object],
    prepared_path: Path,
    root: Path,
    prepared_size: int,
    duration_seconds: float,
    max_total_bytes: int,
) -> list[tuple[Path, float, float, int]]:
    size_target_duration = (
        duration_seconds
        * (ELEVENLABS_PART_TARGET_BYTES / prepared_size)
        * 0.92
    )
    target_duration = max(
        ELEVENLABS_PART_MIN_DURATION_SECONDS,
        min(ELEVENLABS_PART_TARGET_DURATION_SECONDS, size_target_duration),
    )
    estimated_parts = ceil(
        max(1.0, duration_seconds - ELEVENLABS_PART_OVERLAP_SECONDS)
        / max(0.25, target_duration - ELEVENLABS_PART_OVERLAP_SECONDS)
    )
    if estimated_parts > ELEVENLABS_MAX_PARTS:
        raise MediaPreparationError(MediaPreparationReason.media_split_failed)

    specs: list[tuple[Path, float, float, int]] = []
    total_part_bytes = 0
    start = 0.0
    while start < duration_seconds - 0.01:
        if len(specs) >= ELEVENLABS_MAX_PARTS:
            raise MediaPreparationError(MediaPreparationReason.media_split_failed)
        remaining = duration_seconds - start
        part_duration = min(target_duration, remaining)
        part_path = root / f"part-{len(specs) + 1:03d}.m4a"
        part_size = _create_bounded_part(
            runner=runner,
            prepared_path=prepared_path,
            output_path=part_path,
            start_seconds=start,
            duration_seconds=part_duration,
        )
        total_part_bytes += part_size
        if total_part_bytes > max_total_bytes:
            raise MediaPreparationError(
                MediaPreparationReason.prepared_media_too_large,
            )
        specs.append((part_path, start, part_duration, part_size))
        if start + part_duration >= duration_seconds - 0.01:
            break
        overlap = min(
            ELEVENLABS_PART_OVERLAP_SECONDS,
            max(0.0, part_duration / 4),
        )
        next_start = start + part_duration - overlap
        if next_start <= start + 0.25:
            raise MediaPreparationError(MediaPreparationReason.media_split_failed)
        start = next_start
    if not specs:
        raise MediaPreparationError(MediaPreparationReason.media_split_failed)
    return specs


def _create_bounded_part(
    *,
    runner: Callable[..., object],
    prepared_path: Path,
    output_path: Path,
    start_seconds: float,
    duration_seconds: float,
) -> int:
    command = [
        "ffmpeg",
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ss",
        f"{start_seconds:.3f}",
        "-t",
        f"{duration_seconds:.3f}",
        "-i",
        str(prepared_path),
        "-map",
        "0:a:0",
        "-vn",
        "-ac",
        "1",
        "-c:a",
        "aac",
        "-b:a",
        ELEVENLABS_PART_AUDIO_BITRATE,
        str(output_path),
    ]
    try:
        runner(
            command,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=FFMPEG_PART_EXTRACTION_TIMEOUT_SECONDS,
        )
    except FileNotFoundError as exc:
        raise MediaPreparationError(MediaPreparationReason.ffmpeg_unavailable) from exc
    except subprocess.TimeoutExpired as exc:
        raise MediaPreparationError(
            MediaPreparationReason.media_preparation_timeout,
        ) from exc
    except (subprocess.CalledProcessError, OSError) as exc:
        raise MediaPreparationError(MediaPreparationReason.media_split_failed) from exc
    try:
        return _validated_output_size(output_path, ELEVENLABS_PART_MAX_BYTES)
    except MediaPreparationError as exc:
        if exc.reason is MediaPreparationReason.prepared_media_too_large:
            raise MediaPreparationError(
                MediaPreparationReason.media_part_too_large,
            ) from exc
        raise


def _validated_output_size(output_path: Path, max_output_bytes: int) -> int:
    try:
        size = output_path.stat().st_size
    except OSError as exc:
        raise MediaPreparationError(
            MediaPreparationReason.media_preparation_failed,
        ) from exc
    if size <= 0:
        raise MediaPreparationError(MediaPreparationReason.media_preparation_failed)
    if size > max_output_bytes:
        raise MediaPreparationError(
            MediaPreparationReason.prepared_media_too_large,
        )
    return size


def _safe_input_suffix(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    return suffix if re.fullmatch(r"\.[a-z0-9]{1,10}", suffix) else ".media"


def _safe_stem(filename: str) -> str:
    stem = Path(filename).stem.strip().strip(".")
    return stem or "prepared-audio"

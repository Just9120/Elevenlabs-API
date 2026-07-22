from __future__ import annotations

import re
import shutil
import subprocess
from contextlib import contextmanager
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import BinaryIO, Callable, Iterator


FFMPEG_VIDEO_EXTRACTION_TIMEOUT_SECONDS = 1800
FFMPEG_AUDIO_BITRATE = "192k"
_COPY_CHUNK_SIZE = 1024 * 1024


class MediaPreparationReason(str, Enum):
    ffmpeg_unavailable = "ffmpeg_unavailable"
    media_preparation_timeout = "media_preparation_timeout"
    media_preparation_failed = "media_preparation_failed"
    prepared_media_too_large = "prepared_media_too_large"


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

    def __repr__(self) -> str:
        return (
            "PreparedMediaInput(filename=<redacted>, "
            f"mime_type={self.mime_type!r}, byte_count={self.byte_count!r}, "
            f"audio_extracted={self.audio_extracted!r}, stream=<redacted>)"
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

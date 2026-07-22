from __future__ import annotations

import subprocess
import sys
from io import BytesIO
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


def test_audio_input_is_passed_through_without_ffmpeg():
    from studio_api.media_preparation import prepare_elevenlabs_media_input

    source = BytesIO(b"audio-bytes")

    def unexpected_runner(*args, **kwargs):
        raise AssertionError("ffmpeg must not run for an audio source")

    with prepare_elevenlabs_media_input(
        stream=source,
        original_filename="recording.mp3",
        mime_type="audio/mpeg",
        byte_count=11,
        max_output_bytes=100,
        runner=unexpected_runner,
    ) as prepared:
        assert prepared.stream is source
        assert prepared.filename == "recording.mp3"
        assert prepared.mime_type == "audio/mpeg"
        assert prepared.byte_count == 11
        assert prepared.audio_extracted is False

    assert source.closed is False


def test_video_input_is_extracted_to_bounded_aac_m4a_and_cleaned(tmp_path):
    from studio_api.media_preparation import (
        FFMPEG_VIDEO_EXTRACTION_TIMEOUT_SECONDS,
        prepare_elevenlabs_media_input,
    )

    calls = []
    source = BytesIO(b"synthetic-video")

    def runner(command, **kwargs):
        calls.append((command, kwargs))
        input_path = Path(command[command.index("-i") + 1])
        output_path = Path(command[-1])
        assert input_path.read_bytes() == b"synthetic-video"
        output_path.write_bytes(b"prepared-audio")
        return subprocess.CompletedProcess(command, 0)

    with prepare_elevenlabs_media_input(
        stream=source,
        original_filename="private meeting.MP4",
        mime_type="video/mp4; charset=binary",
        byte_count=15,
        max_output_bytes=100,
        runner=runner,
        temporary_directory=str(tmp_path),
    ) as prepared:
        assert prepared.filename == "private meeting.m4a"
        assert prepared.mime_type == "audio/mp4"
        assert prepared.byte_count == len(b"prepared-audio")
        assert prepared.audio_extracted is True
        assert prepared.stream.read() == b"prepared-audio"
        command, kwargs = calls[0]
        assert command[:7] == [
            "ffmpeg",
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
        ]
        assert command[command.index("-map") + 1] == "0:a:0"
        assert ["-vn", "-c:a", "aac", "-b:a", "192k"] == command[10:15]
        assert kwargs == {
            "check": True,
            "stdout": subprocess.DEVNULL,
            "stderr": subprocess.DEVNULL,
            "timeout": FFMPEG_VIDEO_EXTRACTION_TIMEOUT_SECONDS,
        }
        created_paths = [Path(command[command.index("-i") + 1]), Path(command[-1])]
        assert all(path.exists() for path in created_paths)
        assert "private meeting" not in repr(prepared)

    assert all(not path.exists() for path in created_paths)


@pytest.mark.parametrize(
    "failure, expected_reason",
    [
        (FileNotFoundError("private path"), "ffmpeg_unavailable"),
        (
            subprocess.TimeoutExpired(["ffmpeg"], timeout=1),
            "media_preparation_timeout",
        ),
        (
            subprocess.CalledProcessError(1, ["ffmpeg"], stderr=b"private data"),
            "media_preparation_failed",
        ),
    ],
)
def test_video_extraction_normalizes_tool_failures(
    tmp_path,
    failure,
    expected_reason,
):
    from studio_api.media_preparation import (
        MediaPreparationError,
        prepare_elevenlabs_media_input,
    )

    def runner(*args, **kwargs):
        raise failure

    with pytest.raises(MediaPreparationError, match=expected_reason) as exc:
        with prepare_elevenlabs_media_input(
            stream=BytesIO(b"video"),
            original_filename="private.mp4",
            mime_type="video/mp4",
            byte_count=5,
            max_output_bytes=100,
            runner=runner,
            temporary_directory=str(tmp_path),
        ):
            pass

    assert "private" not in str(exc.value)


def test_video_extraction_rejects_missing_empty_and_oversized_outputs(tmp_path):
    from studio_api.media_preparation import (
        MediaPreparationError,
        prepare_elevenlabs_media_input,
    )

    outputs = [None, b"", b"too-large"]
    reasons = [
        "media_preparation_failed",
        "media_preparation_failed",
        "prepared_media_too_large",
    ]

    for output, reason in zip(outputs, reasons):
        def runner(command, **kwargs):
            if output is not None:
                Path(command[-1]).write_bytes(output)

        with pytest.raises(MediaPreparationError, match=reason):
            with prepare_elevenlabs_media_input(
                stream=BytesIO(b"video"),
                original_filename="clip.mp4",
                mime_type="video/mp4",
                byte_count=5,
                max_output_bytes=5,
                runner=runner,
                temporary_directory=str(tmp_path),
            ):
                pass


def test_prepared_context_preserves_caller_exceptions(tmp_path):
    from studio_api.media_preparation import prepare_elevenlabs_media_input

    sentinel = RuntimeError("caller-owned-error")

    def runner(command, **kwargs):
        Path(command[-1]).write_bytes(b"prepared")

    with pytest.raises(RuntimeError) as exc:
        with prepare_elevenlabs_media_input(
            stream=BytesIO(b"video"),
            original_filename="clip.mp4",
            mime_type="video/mp4",
            byte_count=5,
            max_output_bytes=100,
            runner=runner,
            temporary_directory=str(tmp_path),
        ):
            raise sentinel

    assert exc.value is sentinel

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


def test_small_media_is_probed_but_not_split(tmp_path):
    from studio_api.media_preparation import prepare_elevenlabs_media_parts

    source = BytesIO(b"small-audio")
    calls = []

    def runner(command, **kwargs):
        calls.append((command, kwargs))
        assert command[0] == "ffprobe"
        return subprocess.CompletedProcess(command, 0, stdout="120.5\n")

    with prepare_elevenlabs_media_parts(
        stream=source,
        original_filename="private.mp3",
        mime_type="audio/mpeg",
        byte_count=11,
        max_output_bytes=100,
        runner=runner,
        temporary_directory=str(tmp_path),
    ) as batch:
        assert batch.duration_seconds == 120.5
        assert batch.split_reason is None
        assert len(batch.parts) == 1
        assert batch.parts[0].stream is source
        assert batch.parts[0].duration_seconds == 120.5
        assert "private" not in repr(batch)
        assert calls[0][1] == {
            "check": True,
            "stdout": subprocess.PIPE,
            "stderr": subprocess.DEVNULL,
            "text": True,
            "timeout": 30,
        }

    assert source.closed is False


def test_video_extraction_flows_into_probe_and_single_prepared_part(tmp_path):
    from studio_api.media_preparation import prepare_elevenlabs_media_parts

    commands = []

    def runner(command, **kwargs):
        commands.append(command)
        if command[0] == "ffprobe":
            return subprocess.CompletedProcess(command, 0, stdout="30")
        Path(command[-1]).write_bytes(b"extracted-audio")
        return subprocess.CompletedProcess(command, 0)

    with prepare_elevenlabs_media_parts(
        stream=BytesIO(b"video"),
        original_filename="private.mp4",
        mime_type="video/mp4",
        byte_count=5,
        max_output_bytes=100,
        runner=runner,
        temporary_directory=str(tmp_path),
    ) as batch:
        assert [command[0] for command in commands] == ["ffmpeg", "ffprobe"]
        assert len(batch.parts) == 1
        assert batch.parts[0].audio_extracted is True
        assert batch.parts[0].filename == "private.m4a"
        assert batch.parts[0].mime_type == "audio/mp4"
        assert batch.parts[0].stream.read() == b"extracted-audio"


def test_long_media_is_split_in_deterministic_overlapping_order_and_cleaned(tmp_path):
    from studio_api.media_preparation import prepare_elevenlabs_media_parts

    commands = []

    def runner(command, **kwargs):
        commands.append(command)
        if command[0] == "ffprobe":
            return subprocess.CompletedProcess(command, 0, stdout="1325\n")
        assert command[0] == "ffmpeg"
        Path(command[-1]).write_bytes(f"part-{len(commands)}".encode())
        return subprocess.CompletedProcess(command, 0)

    with prepare_elevenlabs_media_parts(
        stream=BytesIO(b"long-audio"),
        original_filename="private recording.wav",
        mime_type="audio/wav",
        byte_count=10,
        max_output_bytes=100,
        runner=runner,
        temporary_directory=str(tmp_path),
    ) as batch:
        assert batch.split_reason == "duration"
        assert batch.duration_seconds == 1325
        assert len(batch.parts) == 2
        first, second = batch.parts
        assert (first.part_index, first.part_count) == (1, 2)
        assert (second.part_index, second.part_count) == (2, 2)
        assert first.timeline_offset_seconds == 0
        assert second.timeline_offset_seconds == 1318
        assert first.duration_seconds == 1320
        assert second.duration_seconds == 7
        assert first.filename.endswith("part 001.m4a")
        assert second.filename.endswith("part 002.m4a")
        assert first.mime_type == second.mime_type == "audio/mp4"
        assert first.stream.read().startswith(b"part-")
        assert second.stream.read().startswith(b"part-")
        created_paths = [Path(command[-1]) for command in commands if command[0] == "ffmpeg"]
        assert all(path.exists() for path in created_paths)
        first_command, second_command = [command for command in commands if command[0] == "ffmpeg"]
        assert first_command[first_command.index("-ss") + 1] == "0.000"
        assert first_command[first_command.index("-t") + 1] == "1320.000"
        assert second_command[second_command.index("-ss") + 1] == "1318.000"
        assert second_command[second_command.index("-t") + 1] == "7.000"
        audio_options = first_command.index("-ac")
        assert ["-ac", "1", "-c:a", "aac", "-b:a", "96k"] == first_command[audio_options:audio_options + 6]

    assert all(not path.exists() for path in created_paths)
    assert first.stream.closed is True
    assert second.stream.closed is True


@pytest.mark.parametrize(
    "probe_result, expected_reason",
    [
        (FileNotFoundError("private"), "ffmpeg_unavailable"),
        (subprocess.TimeoutExpired(["ffprobe"], timeout=1), "media_preparation_timeout"),
        (subprocess.CalledProcessError(1, ["ffprobe"]), "media_duration_unavailable"),
        (subprocess.CompletedProcess(["ffprobe"], 0, stdout="not-a-duration"), "media_duration_unavailable"),
        (subprocess.CompletedProcess(["ffprobe"], 0, stdout="0"), "media_duration_unavailable"),
    ],
)
def test_media_probe_failures_are_normalized(tmp_path, probe_result, expected_reason):
    from studio_api.media_preparation import (
        MediaPreparationError,
        prepare_elevenlabs_media_parts,
    )

    def runner(*args, **kwargs):
        if isinstance(probe_result, Exception):
            raise probe_result
        return probe_result

    with pytest.raises(MediaPreparationError, match=expected_reason) as exc:
        with prepare_elevenlabs_media_parts(
            stream=BytesIO(b"audio"),
            original_filename="private.mp3",
            mime_type="audio/mpeg",
            byte_count=5,
            max_output_bytes=100,
            runner=runner,
            temporary_directory=str(tmp_path),
        ):
            pass

    assert "private" not in str(exc.value)


def test_split_part_over_limit_fails_before_provider_use(tmp_path):
    from studio_api.media_preparation import (
        ELEVENLABS_PART_MAX_BYTES,
        MediaPreparationError,
        prepare_elevenlabs_media_parts,
    )

    def runner(command, **kwargs):
        if command[0] == "ffprobe":
            return subprocess.CompletedProcess(command, 0, stdout="1321")
        with Path(command[-1]).open("wb") as output:
            output.truncate(ELEVENLABS_PART_MAX_BYTES + 1)
        return subprocess.CompletedProcess(command, 0)

    with pytest.raises(MediaPreparationError, match="media_part_too_large"):
        with prepare_elevenlabs_media_parts(
            stream=BytesIO(b"audio"),
            original_filename="clip.wav",
            mime_type="audio/wav",
            byte_count=5,
            max_output_bytes=100,
            runner=runner,
            temporary_directory=str(tmp_path),
        ):
            pass


def test_split_policy_uses_both_size_and_duration_boundaries():
    from studio_api.media_preparation import (
        ELEVENLABS_PART_MAX_BYTES,
        ELEVENLABS_PART_TARGET_DURATION_SECONDS,
        _split_reason,
    )

    assert _split_reason(ELEVENLABS_PART_MAX_BYTES, ELEVENLABS_PART_TARGET_DURATION_SECONDS) is None
    assert _split_reason(ELEVENLABS_PART_MAX_BYTES + 1, 1) == "size"
    assert _split_reason(1, ELEVENLABS_PART_TARGET_DURATION_SECONDS + 0.001) == "duration"
    assert _split_reason(ELEVENLABS_PART_MAX_BYTES + 1, ELEVENLABS_PART_TARGET_DURATION_SECONDS + 1) == "size_and_duration"


def test_split_parts_are_bounded_in_aggregate(tmp_path):
    from studio_api.media_preparation import (
        MediaPreparationError,
        prepare_elevenlabs_media_parts,
    )

    def runner(command, **kwargs):
        if command[0] == "ffprobe":
            return subprocess.CompletedProcess(command, 0, stdout="1321")
        Path(command[-1]).write_bytes(b"123456")
        return subprocess.CompletedProcess(command, 0)

    with pytest.raises(MediaPreparationError, match="prepared_media_too_large"):
        with prepare_elevenlabs_media_parts(
            stream=BytesIO(b"audio"),
            original_filename="clip.wav",
            mime_type="audio/wav",
            byte_count=5,
            max_output_bytes=10,
            runner=runner,
            temporary_directory=str(tmp_path),
        ):
            pass

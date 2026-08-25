from datetime import datetime, timezone
from pathlib import Path
from subprocess import CompletedProcess
import sys

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))

from studio_api.audio_preparation import (
    AudioMonoMode,
    AudioOutputFormat,
    AudioPreparationError,
    AudioPreparationReason,
    AudioPreset,
    AudioProbe,
    analyze_silence,
    build_ffmpeg_command,
    build_preview,
    normalize_options,
    probe_media,
    render_output_filename,
    verify_media_integrity,
)


def options(**overrides):
    payload = {"preset": "processing_only"}
    payload.update(overrides)
    return normalize_options(payload)


def probe(*, channels=2, codec="pcm_s16le", fmt="wav"):
    return AudioProbe(60.0, fmt, codec, 48000, channels, "stereo" if channels == 2 else "mono")


def test_presets_are_effective_and_user_overrides_remain_explicit():
    lecture = normalize_options({"preset": "lecture", "silence_threshold_db": -35})
    assert lecture.preset is AudioPreset.lecture
    assert lecture.output_format is AudioOutputFormat.flac
    assert lecture.mono_mode is AudioMonoMode.mixdown
    assert lecture.silence_enabled is True
    assert lecture.silence_threshold_db == -35


@pytest.mark.parametrize(
    "payload",
    [
        {"preset": "unknown"},
        {"preset": "processing_only", "silence_threshold_db": -100},
        {"preset": "processing_only", "silence_min_duration_seconds": 0},
        {"preset": "processing_only", "silence_keep_duration_seconds": 6},
        {"preset": "processing_only", "silence_min_duration_seconds": 1, "silence_keep_duration_seconds": 2},
        {"preset": "processing_only", "output_name_template": "{secret}"},
        {"preset": "processing_only", "output_format": "copy", "mono_mode": "left"},
        {"preset": "processing_only", "output_format": "copy", "silence_enabled": True},
    ],
)
def test_options_fail_closed(payload):
    with pytest.raises(AudioPreparationError) as caught:
        normalize_options(payload)
    assert caught.value.reason is AudioPreparationReason.invalid_options


def test_probe_uses_allowlisted_command_and_reduces_metadata():
    def runner(command, **kwargs):
        assert command[:3] == ["ffprobe", "-v", "error"]
        assert kwargs == {"capture_output": True, "text": True, "check": True, "timeout": 60}
        return CompletedProcess(
            command,
            0,
            stdout='{"format":{"format_name":"wav","duration":"12.5"},"streams":[{"codec_type":"video"},{"codec_type":"audio","codec_name":"pcm_s16le","sample_rate":"48000","channels":2,"channel_layout":"stereo"}]}',
            stderr="private",
        )

    result = probe_media(Path("private-input.wav"), runner=runner)
    assert result == AudioProbe(12.5, "wav", "pcm_s16le", 48000, 2, "stereo")
    assert "private" not in repr(result)


def test_probe_falls_back_to_container_duration_for_obs_matroska_stream_sentinel():
    def runner(command, **kwargs):
        return CompletedProcess(
            command,
            0,
            stdout=(
                '{"format":{"format_name":"matroska,webm","duration":"12.5"},'
                '"streams":[{"codec_type":"audio","duration":"N/A","codec_name":"aac",'
                '"sample_rate":"48000","channels":2,"channel_layout":"stereo"}]}'
            ),
            stderr="private",
        )

    result = probe_media(Path("obs-capture.mkv"), runner=runner)

    assert result.duration_seconds == 12.5
    assert result.format_name == "matroska,webm"


def test_probe_rejects_missing_audio_and_malformed_values():
    def runner(command, **kwargs):
        return CompletedProcess(command, 0, stdout='{"format":{"duration":"4"},"streams":[]}', stderr="")

    with pytest.raises(AudioPreparationError) as caught:
        probe_media(Path("x"), runner=runner)
    assert caught.value.reason is AudioPreparationReason.invalid_input


def test_integrity_check_decodes_audio_without_shell():
    calls = []

    def runner(command, **kwargs):
        calls.append((command, kwargs))
        return CompletedProcess(command, 0)

    verify_media_integrity(Path("input.flac"), runner=runner)
    command, kwargs = calls[0]
    assert command == ["ffmpeg", "-v", "error", "-xerror", "-i", "input.flac", "-map", "0:a:0", "-f", "null", "-"]
    assert "shell" not in kwargs


def test_silence_analysis_parses_only_bounded_scalar_durations():
    def runner(command, **kwargs):
        return CompletedProcess(
            command,
            0,
            stdout="",
            stderr="[silencedetect] silence_end: 12.4 | silence_duration: 2.4\n[silencedetect] silence_end: 25 | silence_duration: 5",
        )

    assert analyze_silence(Path("private.wav"), threshold_db=-40, minimum_seconds=1, runner=runner) == (2.4, 5.0)


def test_preview_sums_duration_estimates_truncated_silence_and_copy_compatibility():
    result = build_preview([probe(), probe()], [2.0, 3.0], options(silence_enabled=True, silence_keep_duration_seconds=0.5))
    assert result.input_count == 2
    assert result.input_duration_seconds == 120
    assert result.estimated_output_duration_seconds == 116
    assert result.copy_compatible is True


def test_preview_rejects_copy_mismatch_and_right_channel_for_mono():
    with pytest.raises(AudioPreparationError) as mismatch:
        build_preview([probe(), probe(codec="flac", fmt="flac")], [], options(output_format="copy"))
    assert mismatch.value.reason is AudioPreparationReason.copy_incompatible
    with pytest.raises(AudioPreparationError) as channel:
        build_preview([probe(channels=1)], [], options(mono_mode="right"))
    assert channel.value.reason is AudioPreparationReason.channel_unavailable


def test_copy_command_requires_compatible_inputs_and_concat_manifest():
    command = build_ffmpeg_command(
        [Path("a.wav"), Path("b.wav")],
        Path("out.wav"),
        options(output_format="copy"),
        [probe(), probe()],
        concat_list_path=Path("inputs.txt"),
    )
    assert command == [
        "ffmpeg", "-v", "error", "-xerror", "-f", "concat", "-safe", "1", "-i", "inputs.txt",
        "-map", "0:a:0", "-c:a", "copy", "-y", "out.wav",
    ]


@pytest.mark.parametrize(
    ("mono_mode", "expected_filter"),
    [
        ("preserve", None),
        ("mixdown", "aformat=channel_layouts=mono"),
        ("left", "pan=mono|c0=c0"),
        ("right", "pan=mono|c0=c1"),
    ],
)
def test_conversion_command_composes_channel_silence_concat_and_exact_codec(mono_mode, expected_filter):
    configured = options(
        output_format="flac",
        mono_mode=mono_mode,
        silence_enabled=True,
        silence_threshold_db=-41,
        silence_min_duration_seconds=1.5,
        silence_keep_duration_seconds=0.4,
    )
    command = build_ffmpeg_command([Path("a.wav"), Path("b.wav")], Path("out.flac"), configured, [probe(), probe()])
    filter_value = command[command.index("-filter_complex") + 1]
    if expected_filter is not None:
        assert expected_filter in filter_value
    assert "silenceremove=" in filter_value
    assert "concat=n=2:v=0:a=1[outa]" in filter_value
    assert command[-6:] == ["-c:a", "flac", "-f", "flac", "-y", "out.flac"]
    assert "shell" not in command


def test_render_filename_uses_only_allowlisted_metadata_and_extension():
    configured = options(output_format="wav", output_name_template="{date}_{time}_{project}_{title}")
    filename = render_output_filename(
        configured,
        created_at=datetime(2026, 8, 24, 18, 5, 6, tzinfo=timezone.utc),
        project_title="Проект/секрет",
        title="Созвон: команда",
    )
    assert filename.startswith("2026-08-24_18-05-06Z_")
    assert filename.endswith(".wav")
    assert "/" not in filename and "\\" not in filename

"""Synthetic known pauses, bounded metadata and a real decoder contract."""
import math
from pathlib import Path
import shutil
import struct
import subprocess
import sys
from types import SimpleNamespace
import wave

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/studio-api"))
from studio_api.audio_analysis import analyze_audio_visual, visual_payload
from studio_api.audio_preparation import AudioPreparationError, normalize_options


def options():
    return normalize_options({"output_format": "wav", "silence_enabled": True, "silence_threshold_db": -30,
        "silence_min_duration_seconds": 0.3, "silence_keep_duration_seconds": 0.1})


def test_metadata_bound_does_not_truncate_total_removed_time():
    output = SimpleNamespace(stdout="lavfi.astats.Overall.Peak_level=-6.0206\n" * 600,
        stderr="\n".join(f"silence_end: {index + 0.5} | silence_duration: 0.5" for index in range(600)))
    analysis = analyze_audio_visual(Path("synthetic.wav"), duration=1000, options=options(), runner=lambda *a, **k: output)
    assert len(analysis.peaks) == len(analysis.intervals) == 512
    assert analysis.silence_count == 600 and analysis.intervals_truncated
    assert analysis.removed_seconds == pytest.approx(240)
    assert analysis.peaks[0] == pytest.approx(0.5, abs=0.00001)
    payload = visual_payload([analysis, analysis], [1000, 1000], 0.1)
    assert sum(len(source["silences"]) for source in payload["sources"]) == 512
    assert payload["removed_seconds"] == pytest.approx(480)
    assert payload["sources"][1]["intervals_truncated"]


def test_waveform_silence_zero_and_nonfinite_levels_are_safe():
    output = SimpleNamespace(stdout="lavfi.astats.Overall.Peak_level=-inf\nlavfi.astats.Overall.Peak_level=0\n", stderr="")
    analysis = analyze_audio_visual(Path("synthetic.wav"), duration=3, options=options(), runner=lambda *a, **k: output)
    assert analysis.peaks == [0, 1]
    assert analysis.silence_count == 0 and analysis.removed_seconds == 0


def test_invalid_decoder_result_has_normalized_error_without_raw_payload():
    def fail(*args, **kwargs):
        raise subprocess.CalledProcessError(1, args[0], stderr="private source path and content")
    with pytest.raises(AudioPreparationError, match="media_integrity_failed") as caught:
        analyze_audio_visual(Path("synthetic.wav"), duration=3, options=options(), runner=fail)
    assert "private" not in str(caught.value)


def test_real_decoder_known_tone_pause_and_envelope(tmp_path):
    if not shutil.which("ffmpeg"):
        pytest.skip("FFmpeg is required by the Linux media profile")
    path = tmp_path / "synthetic.wav"
    samples = []
    for index in range(3 * 8000):
        value = 0 if 8000 <= index < 16000 else int(16000 * math.sin(2 * math.pi * 440 * index / 8000))
        samples.append(struct.pack("<h", value))
    with wave.open(str(path), "wb") as stream:
        stream.setnchannels(1); stream.setsampwidth(2); stream.setframerate(8000)
        stream.writeframes(b"".join(samples))
    analysis = analyze_audio_visual(path, duration=3, options=options(), sample_rate=8000, points=32)
    assert 20 <= len(analysis.peaks) <= 32 and max(analysis.peaks) > 0.2
    assert min(analysis.peaks) < 0.01
    assert analysis.silence_count == 1
    assert analysis.intervals[0][0] == pytest.approx(1, abs=0.03)
    assert analysis.intervals[0][1] == pytest.approx(2, abs=0.03)
    assert analysis.removed_seconds == pytest.approx(0.9, abs=0.03)


def test_preserved_stereo_envelope_does_not_cancel_opposite_phase_channels(tmp_path):
    if not shutil.which("ffmpeg"):
        pytest.skip("FFmpeg is required by the Linux media profile")
    path = tmp_path / "stereo.wav"
    samples = []
    for index in range(8000):
        value = int(16000 * math.sin(2 * math.pi * 440 * index / 8000))
        samples.append(struct.pack("<hh", value, -value))
    with wave.open(str(path), "wb") as stream:
        stream.setnchannels(2)
        stream.setsampwidth(2)
        stream.setframerate(8000)
        stream.writeframes(b"".join(samples))
    analysis = analyze_audio_visual(path, duration=1, options=options(), channels=2, sample_rate=8000, points=20)
    assert max(analysis.peaks) > 0.2 and analysis.silence_count == 0

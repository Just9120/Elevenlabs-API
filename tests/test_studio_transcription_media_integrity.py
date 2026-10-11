"""Real, synthetic media must be validated before any provider part is yielded."""
from io import BytesIO
import shutil
import subprocess
import sys
from pathlib import Path
import wave

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/studio-api"))
from studio_api.media_preparation import MediaPreparationError, prepare_elevenlabs_media_parts


@pytest.fixture
def media_tools():
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        pytest.skip("Real FFmpeg/ffprobe profile is unavailable locally")


def prepare(path, mime_type):
    data = path.read_bytes()
    return prepare_elevenlabs_media_parts(stream=BytesIO(data), original_filename=path.name,
        mime_type=mime_type, byte_count=len(data), max_output_bytes=1024 * 1024)


def wav(path):
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1); output.setsampwidth(2); output.setframerate(8000)
        output.writeframes(b"\0\0" * 8000)


def test_real_audio_is_accepted_with_actual_container_and_full_decode(tmp_path, media_tools):
    path = tmp_path / "synthetic.wav"
    wav(path)
    with prepare(path, "audio/wav") as result:
        assert len(result.parts) == 1
        assert result.duration_seconds == pytest.approx(1)
        assert result.parts[0].stream.read() == path.read_bytes()


def test_mislabeled_container_is_rejected_before_provider_yield(tmp_path, media_tools):
    path = tmp_path / "synthetic.mp3"
    wav(path)
    with pytest.raises(MediaPreparationError, match="media_preparation_failed"):
        with prepare(path, "audio/mpeg"):
            pytest.fail("Mislabeled media must never reach STT")


def test_video_only_mp4_is_rejected_even_with_audio_mime(tmp_path, media_tools):
    path = tmp_path / "video-only.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=c=black:s=16x16:d=1",
        "-an", "-c:v", "mpeg4", str(path)], check=True, capture_output=True, timeout=30)
    with pytest.raises(MediaPreparationError, match="media_preparation_failed"):
        with prepare(path, "audio/mp4"):
            pytest.fail("A video-only container must never reach STT")


def test_truncated_wav_fails_full_integrity_before_provider_yield(tmp_path, media_tools):
    path = tmp_path / "truncated.wav"
    wav(path)
    data = path.read_bytes()
    path.write_bytes(data[:-7001])
    with pytest.raises(MediaPreparationError, match="media_preparation_failed"):
        with prepare(path, "audio/wav"):
            pytest.fail("Incomplete PCM frame must never reach STT")

"""Static/pure tests for the LIVE-COLAB-01 realtime prototype.

These tests intentionally avoid browser APIs and ElevenLabs provider calls.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import elevenlabs_realtime as realtime


def test_realtime_runtime_is_standalone_from_batch_runtime() -> None:
    source = (ROOT / "elevenlabs_realtime.py").read_text(encoding="utf-8")
    assert "import elevenlabs_api" not in source
    assert "from elevenlabs_api" not in source


def test_realtime_notebook_is_thin_launcher_without_outputs() -> None:
    nb_path = ROOT / "notebooks" / "elevenlabs_realtime_colab.ipynb"
    notebook = json.loads(nb_path.read_text(encoding="utf-8"))
    code = "\n".join(
        "".join(cell.get("source", []))
        for cell in notebook.get("cells", [])
        if cell.get("cell_type") == "code"
    )
    assert nb_path.stat().st_size < 20_000
    assert "GITHUB_REF" in code
    assert "raw.githubusercontent.com" in code
    assert "urllib.request.urlretrieve" in code
    assert "elevenlabs_realtime.py" in code
    assert "elevenlabs_api.py" not in code
    for cell in notebook.get("cells", []):
        assert cell.get("outputs", []) == []
        assert cell.get("execution_count") is None



def test_get_elevenlabs_api_key_prefers_project_secret_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(realtime, "_get_colab_userdata", lambda: None)
    monkeypatch.setenv("ELEVEN_API_KEY", " preferred-key ")
    monkeypatch.setenv("ELEVENLABS_API_KEY", "fallback-key")

    assert realtime.get_elevenlabs_api_key() == "preferred-key"


def test_get_elevenlabs_api_key_attempts_compatibility_alias_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(realtime, "_get_colab_userdata", lambda: None)
    monkeypatch.delenv("ELEVEN_API_KEY", raising=False)
    monkeypatch.setenv("ELEVENLABS_API_KEY", " alias-key ")

    assert realtime.get_elevenlabs_api_key() == "alias-key"


def test_get_elevenlabs_api_key_falls_back_after_missing_colab_secret(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = []

    class SecretNotFoundError(Exception):
        pass

    class UserData:
        @staticmethod
        def get(name: str) -> str:
            calls.append(name)
            if name == "ELEVEN_API_KEY":
                raise SecretNotFoundError("missing preferred secret")
            if name == "ELEVENLABS_API_KEY":
                return " compatibility-key "
            raise SecretNotFoundError("unexpected secret")

    monkeypatch.setattr(realtime, "_get_colab_userdata", lambda: UserData())
    monkeypatch.delenv("ELEVEN_API_KEY", raising=False)
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)

    assert realtime.get_elevenlabs_api_key() == "compatibility-key"
    assert calls == ["ELEVEN_API_KEY", "ELEVENLABS_API_KEY"]


def test_get_elevenlabs_api_key_raises_generic_message_after_supported_names_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class SecretNotFoundError(Exception):
        pass

    class UserData:
        @staticmethod
        def get(name: str) -> str:
            raise SecretNotFoundError(f"{name} missing")

    monkeypatch.setattr(realtime, "_get_colab_userdata", lambda: UserData())
    monkeypatch.delenv("ELEVEN_API_KEY", raising=False)
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)

    with pytest.raises(realtime.RealtimeTokenError) as exc_info:
        realtime.get_elevenlabs_api_key()

    assert str(exc_info.value) == realtime.ELEVENLABS_API_KEY_NOT_FOUND_MESSAGE
    assert "missing preferred secret" not in str(exc_info.value)


def test_extract_realtime_token_validates_response_shape() -> None:
    assert realtime.extract_realtime_token({"token": " abc "}) == "abc"
    assert realtime.extract_realtime_token({"single_use_token": "tok"}) == "tok"
    with pytest.raises(realtime.RealtimeTokenError):
        realtime.extract_realtime_token({"unexpected": "tok"})
    with pytest.raises(realtime.RealtimeTokenError):
        realtime.extract_realtime_token({"token": ""})


def test_create_realtime_single_use_token_uses_injected_post_without_network() -> None:
    calls = []

    class Response:
        status_code = 200

        @staticmethod
        def json() -> dict[str, str]:
            return {"token": "single-use-token"}

    def fake_post(url: str, **kwargs: object) -> Response:
        calls.append((url, kwargs))
        return Response()

    token = realtime.create_realtime_single_use_token("main-api-key", post=fake_post)
    assert token == "single-use-token"
    assert calls[0][0] == realtime.REALTIME_TOKEN_URL
    assert calls[0][1]["headers"]["xi-api-key"] == "main-api-key"


def test_websocket_url_builder_requires_token_and_model_id() -> None:
    with pytest.raises(ValueError):
        realtime.build_realtime_websocket_url("")
    with pytest.raises(ValueError):
        realtime.build_realtime_websocket_url("tok", model_id="")
    with pytest.raises(ValueError):
        realtime.build_realtime_websocket_url("tok", commit_strategy="")

    url = realtime.build_realtime_websocket_url("tok 123")
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    assert parsed.scheme == "wss"
    assert parsed.netloc == "api.elevenlabs.io"
    assert parsed.path == "/v1/speech-to-text/realtime"
    assert query["model_id"] == ["scribe_v2_realtime"]
    assert query["token"] == ["tok 123"]
    assert query["audio_format"] == ["pcm_16000"]
    assert query["commit_strategy"] == ["vad"]


def test_generated_html_does_not_embed_main_api_key_values_or_secret_names() -> None:
    html = realtime.build_realtime_colab_html("temporary-token")
    assert "temporary-token" in html
    assert "ELEVEN_API_KEY" not in html
    assert "ELEVENLABS_API_KEY" not in html
    assert "preferred-key" not in html
    assert "compatibility-key" not in html
    assert "main-api-key" not in html
    assert "message_type" in html
    assert "audio_base_64" in html
    assert "input_audio_chunk" in html
    assert "input_audio_chunk: payload" not in html
    assert '"input_audio_chunk": payload' not in html
    assert "commit: true" not in html
    assert "getUserMedia" in html
    assert "getDisplayMedia" in html


def test_generated_html_uses_current_render_root_for_colab_binding() -> None:
    first_html = realtime.build_realtime_colab_html("temporary-token")
    second_html = realtime.build_realtime_colab_html("temporary-token")

    assert "document.getElementById('el-realtime-root')" not in first_html
    assert 'id="el-realtime-root"' not in first_html
    assert 'data-el-realtime-root' in first_html
    assert "const RENDER_ROOT_ID = 'el-realtime-root-" in first_html
    assert "const root = document.getElementById(RENDER_ROOT_ID)" in first_html
    assert "root.querySelector" in first_html
    assert first_html != second_html


def test_generated_html_avoids_duplicate_fixed_element_ids() -> None:
    html = realtime.build_realtime_colab_html("temporary-token")
    ids = re.findall(r'id="([^"]+)"', html)

    assert len(ids) == len(set(ids))
    assert all(element_id.startswith("el-realtime-root-") for element_id in ids)


def test_generated_html_includes_js_ready_status_transition_marker() -> None:
    html = realtime.build_realtime_colab_html("temporary-token")

    assert "Статус: HTML loaded; JS not attached yet" in html
    assert "function markJsReady()" in html
    assert "root.dataset.jsReady = 'true'" in html
    assert "statusEl.dataset.jsReadyMarker = 'attached'" in html
    assert "setStatus('idle')" in html


def test_generated_html_still_includes_realtime_controls() -> None:
    html = realtime.build_realtime_colab_html("temporary-token")

    assert 'data-el="start">Start</button>' in html
    assert 'data-el="stop" disabled>Stop</button>' in html
    assert 'data-el="copy">Copy transcript</button>' in html
    assert 'data-el="download">Download .txt</button>' in html
    assert "startBtn.addEventListener('click', start)" in html
    assert "stopBtn.addEventListener('click', () => stop())" in html
    assert "copyBtn.addEventListener('click'" in html
    assert "downloadBtn.addEventListener('click'" in html


def test_generated_html_uses_compact_diagnostics_ui() -> None:
    html = realtime.build_realtime_colab_html("temporary-token")
    assert "LIVE-COLAB-01: realtime transcription prototype" in html
    assert "Источник аудио" in html
    assert "<summary>Диагностика</summary>" in html
    assert "Диагностика появится после запуска realtime-сессии." in html
    assert '<pre data-el="diagnostics" hidden></pre>' in html
    assert "diagWrapEl.open = true" in html
    assert "background:#111" not in html
    assert "min-height:80px" not in html
    assert "Ready. Manual Colab/browser/provider runtime validation" not in html


def test_error_message_mapping_has_russian_known_cases() -> None:
    cases = [
        "auth_error",
        "quota_exceeded",
        "rate_limited",
        "queue_overflow",
        "session_time_limit_exceeded",
        "invalid_input_audio_chunk_size",
    ]
    for case in cases:
        message = realtime.realtime_error_message_ru(case)
        assert message
        assert any("а" <= char.lower() <= "я" or char == "ё" for char in message)
    assert "WebSocket" in realtime.realtime_error_message_ru("unknown")


def test_docs_mention_realtime_experimental_caveats() -> None:
    docs = "\n".join(
        (ROOT / path).read_text(encoding="utf-8")
        for path in ["README.md", "docs/project-spec.md", "docs/delivery-plan.md", "VALIDATION_MATRIX.md"]
    )
    for phrase in [
        "Realtime Colab prototype",
        "experimental",
        "no Google Docs",
        "no manifest",
        "single-use",
        "manual Colab runtime validation",
    ]:
        assert phrase in docs

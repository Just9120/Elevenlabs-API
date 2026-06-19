"""Static/pure tests for the LIVE-COLAB-01 realtime prototype.

These tests intentionally avoid browser APIs and ElevenLabs provider calls.
"""

from __future__ import annotations

import html
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from urllib.request import urlopen

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


def test_generated_html_shell_does_not_embed_executable_script_or_secrets() -> None:
    root_id = realtime.create_realtime_colab_root_id()
    html = realtime.build_realtime_colab_html_shell(root_id)

    assert "temporary-token" not in html
    assert "<script" not in html.lower()
    assert "</script" not in html.lower()
    assert "ELEVEN_API_KEY" not in html
    assert "ELEVENLABS_API_KEY" not in html
    assert "preferred-key" not in html
    assert "compatibility-key" not in html
    assert "main-api-key" not in html
    assert "message_type" not in html
    assert "audio_base_64" not in html
    assert "input_audio_chunk" not in html
    assert "getUserMedia" not in html
    assert "getDisplayMedia" not in html


def test_generated_javascript_contains_realtime_payload_without_main_api_key_values() -> None:
    root_id = realtime.create_realtime_colab_root_id()
    js = realtime.build_realtime_colab_javascript("temporary-token", root_id)

    assert "temporary-token" in js
    assert "ELEVEN_API_KEY" not in js
    assert "ELEVENLABS_API_KEY" not in js
    assert "preferred-key" not in js
    assert "compatibility-key" not in js
    assert "main-api-key" not in js
    assert "message_type" in js
    assert "audio_base_64" in js
    assert "input_audio_chunk" in js
    assert "input_audio_chunk: payload" not in js
    assert '"input_audio_chunk": payload' not in js
    assert "commit: true" not in js
    assert "getUserMedia" in js
    assert "getDisplayMedia" in js


def _iframe_srcdoc_from_outer_html(outer_html: str) -> str:
    match = re.search(r'srcdoc="([^"]+)"', outer_html, flags=re.DOTALL)
    assert match is not None
    return html.unescape(match.group(1))


def test_generated_outer_colab_html_contains_srcdoc_iframe_without_outer_script() -> None:
    outer_html = realtime.build_realtime_colab_iframe_html("temporary-token")
    srcdoc = _iframe_srcdoc_from_outer_html(outer_html)

    assert "<iframe" in outer_html
    assert "srcdoc=" in outer_html
    assert "<script" not in outer_html.lower()
    assert "</script" not in outer_html.lower()
    assert "&lt;script&gt;" in outer_html
    assert "<script>" in srcdoc


def test_generated_iframe_has_media_permissions_and_sandbox_flags() -> None:
    outer_html = realtime.build_realtime_colab_iframe_html("temporary-token")

    assert 'allow="microphone; display-capture; clipboard-write"' in outer_html
    assert 'sandbox="allow-scripts allow-same-origin allow-downloads"' in outer_html


def test_generated_iframe_srcdoc_contains_readiness_marker_and_listeners() -> None:
    srcdoc = realtime.build_realtime_colab_iframe_srcdoc("temporary-token")

    assert "Статус: HTML iframe загружен; JavaScript ещё не подключён" in srcdoc
    assert "function markJsReady()" in srcdoc
    assert "setStatus(STATUS.ready)" in srcdoc
    assert "startBtn.addEventListener('click', start)" in srcdoc
    assert "stopBtn.addEventListener('click', () => stop(true))" in srcdoc
    assert "copyBtn.addEventListener('click'" in srcdoc
    assert "downloadBtn.addEventListener('click'" in srcdoc


def test_generated_iframe_output_exposes_only_single_use_realtime_token() -> None:
    outer_html = realtime.build_realtime_colab_iframe_html("temporary-token")
    srcdoc = _iframe_srcdoc_from_outer_html(outer_html)

    assert "temporary-token" in outer_html
    assert "temporary-token" in srcdoc
    for forbidden in [
        "ELEVEN_API_KEY",
        "ELEVENLABS_API_KEY",
        "preferred-key",
        "compatibility-key",
        "main-api-key",
    ]:
        assert forbidden not in outer_html
        assert forbidden not in srcdoc


def test_generated_shell_and_javascript_use_current_render_root_for_colab_binding() -> None:
    first_root_id = realtime.create_realtime_colab_root_id()
    second_root_id = realtime.create_realtime_colab_root_id()
    first_html = realtime.build_realtime_colab_html_shell(first_root_id)
    second_html = realtime.build_realtime_colab_html_shell(second_root_id)
    first_js = realtime.build_realtime_colab_javascript("temporary-token", first_root_id)

    assert "document.getElementById('el-realtime-root')" not in first_js
    assert 'id="el-realtime-root"' not in first_html
    assert 'data-el-realtime-root' in first_html
    assert f'id="{first_root_id}"' in first_html
    assert f"const RENDER_ROOT_ID = '{first_root_id}'" in first_js
    assert "const root = document.getElementById(RENDER_ROOT_ID)" in first_js
    assert "root.querySelector" in first_js
    assert first_html != second_html


def test_generated_html_shell_avoids_duplicate_fixed_element_ids() -> None:
    root_id = realtime.create_realtime_colab_root_id()
    html = realtime.build_realtime_colab_html_shell(root_id)
    ids = re.findall(r'id="([^"]+)"', html)

    assert len(ids) == len(set(ids))
    assert all(element_id.startswith("el-realtime-root-") for element_id in ids)


def test_generated_shell_and_javascript_include_js_ready_status_transition_marker() -> None:
    root_id = realtime.create_realtime_colab_root_id()
    html = realtime.build_realtime_colab_html_shell(root_id)
    js = realtime.build_realtime_colab_javascript("temporary-token", root_id)

    assert "Статус: HTML iframe загружен; JavaScript ещё не подключён" in html
    assert "function markJsReady()" in js
    assert "root.dataset.jsReady = 'true'" in js
    assert "statusEl.dataset.jsReadyMarker = 'attached'" in js
    assert "setStatus(STATUS.ready)" in js


def test_generated_shell_and_javascript_still_include_realtime_controls() -> None:
    root_id = realtime.create_realtime_colab_root_id()
    html = realtime.build_realtime_colab_html_shell(root_id)
    js = realtime.build_realtime_colab_javascript("temporary-token", root_id)

    assert 'data-el="start" disabled>Начать</button>' in html
    assert 'data-el="stop" disabled>Остановить</button>' in html
    assert 'data-el="copy" disabled>Скопировать текст</button>' in html
    assert 'data-el="download" disabled>Скачать .txt</button>' in html
    assert "startBtn.addEventListener('click', start)" in js
    assert "stopBtn.addEventListener('click', () => stop(true))" in js
    assert "copyBtn.addEventListener('click'" in js
    assert "downloadBtn.addEventListener('click'" in js


def test_launch_path_displays_proxy_link_without_separate_javascript_display() -> None:
    source = (ROOT / "elevenlabs_realtime.py").read_text(encoding="utf-8")

    assert "def launch_realtime_colab_proxy()" in source
    assert "from IPython.display import HTML, display" in source
    assert "from IPython.display import HTML, Javascript, display" not in source
    assert "build_realtime_proxy_launch_html(" in source
    assert "display(Javascript(" not in source
    assert "if __name__ == \"__main__\":\n    launch_realtime_colab_proxy()" in source


def test_generated_html_shell_uses_compact_diagnostics_ui() -> None:
    root_id = realtime.create_realtime_colab_root_id()
    html = realtime.build_realtime_colab_html_shell(root_id)
    js = realtime.build_realtime_colab_javascript("temporary-token", root_id)

    assert "LIVE-COLAB-01: прототип realtime-распознавания" in html
    assert "Аудио вкладки / экрана" in html
    assert "<summary>Диагностика</summary>" in html
    assert "Диагностика появится после запуска realtime-сессии." in html
    assert '<pre data-el="diagnostics" hidden></pre>' in html
    assert "diagWrapEl.open = true" in js
    assert "background:#111" not in html
    assert "min-height:80px" not in html
    assert "Ready. Manual Colab/browser/provider runtime validation" not in html


def test_proxy_frontend_config_contains_only_single_use_realtime_websocket_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELEVEN_API_KEY", "preferred-key")
    monkeypatch.setenv("ELEVENLABS_API_KEY", "compatibility-key")
    config = realtime.build_realtime_frontend_config("temporary-token")

    assert config["wsUrl"].startswith("wss://api.elevenlabs.io/v1/speech-to-text/realtime?")
    assert "temporary-token" in config["wsUrl"]
    assert config["modelId"] == realtime.REALTIME_MODEL_ID
    assert config["audioFormat"] == realtime.REALTIME_AUDIO_FORMAT
    assert config["commitStrategy"] == realtime.REALTIME_COMMIT_STRATEGY
    serialized = json.dumps(config, ensure_ascii=False)
    for forbidden in ["ELEVEN_API_KEY", "ELEVENLABS_API_KEY", "preferred-key", "compatibility-key", "main-api-key"]:
        assert forbidden not in serialized


def test_proxy_standalone_frontend_includes_controls_status_and_external_realtime_js() -> None:
    page = realtime.build_realtime_frontend_html("temporary-token")
    js = realtime.build_realtime_frontend_javascript("temporary-token", realtime.create_realtime_colab_root_id())

    assert "LIVE-COLAB-PROXY-01: отдельная realtime-страница" in page
    assert "Статус: страница загружена" in page
    assert '<script src="/realtime.js" defer></script>' in page
    assert "<script>" not in page
    assert not re.search(r"<script(?![^>]*\bsrc=)[^>]*>.*?</script>", page, flags=re.DOTALL | re.IGNORECASE)
    assert "temporary-token" not in page
    assert "fetch('/config.json'" in js
    assert "setStatus(STATUS.ready)" in js
    assert "setStatus(STATUS.starting)" in js
    assert "setStatus(STATUS.websocketOpen)" in js
    assert "setStatus(STATUS.sessionStarted)" in js
    assert 'data-el="start" disabled>Начать</button>' in page
    assert 'data-el="stop" disabled>Остановить</button>' in page
    assert "Микрофон / аудиовход" in page
    assert "Вкладка браузера / экран со звуком" in page
    assert "Virtual input / system audio device" not in page
    assert "navigator.mediaDevices.getUserMedia" in js
    assert "navigator.mediaDevices.getDisplayMedia" in js
    assert "new WebSocket(CONFIG.wsUrl)" in js
    assert "message_type: 'input_audio_chunk'" in js
    assert "audio_base_64: payload" in js
    for forbidden in ["ELEVEN_API_KEY", "ELEVENLABS_API_KEY", "preferred-key", "compatibility-key", "main-api-key", "temporary-token"]:
        assert forbidden not in page
        assert forbidden not in js



def test_proxy_frontend_has_independent_sources_and_russian_device_labels() -> None:
    page = realtime.build_realtime_frontend_html("temporary-token")
    js = realtime.build_realtime_frontend_javascript("temporary-token", realtime.create_realtime_colab_root_id())

    assert 'data-el="display-audio"' in page
    assert 'data-el="input-device"' in page
    assert '<option value="off">Выключено</option>' in page
    assert '<option value="">Устройство по умолчанию</option>' in page
    assert "Аудиовход " in js
    assert "Обновить список устройств" in page
    assert "Включите аудио вкладки / экрана или микрофон / аудиовход." in page
    assert "hasDisplayAudio()" in js
    assert "hasInputAudio()" in js
    assert "startBtn.disabled = isRunning || !anySource" in js
    assert "navigator.mediaDevices.addEventListener('devicechange'" in js


def test_proxy_frontend_represents_display_only_input_only_and_mixed_branches_without_virtual_mode() -> None:
    page = realtime.build_realtime_frontend_html("temporary-token")
    js = realtime.build_realtime_frontend_javascript("temporary-token", realtime.create_realtime_colab_root_id())

    assert "getDisplayAudioStream" in js
    assert "navigator.mediaDevices.getUserMedia(microphoneConstraints())" in js
    assert "streams.length === 1" in js
    assert "streams.length > 1" in js
    assert "createMediaStreamDestination" in js
    assert "Микрофон может повторно захватывать звук вкладки" in page
    assert "virtual" not in page
    assert "mode === 'virtual'" not in js
    assert "Virtual input" not in js


def test_transcript_readability_clear_confirmation_and_lifecycle_guards() -> None:
    page = realtime.build_realtime_frontend_html("temporary-token")
    js = realtime.build_realtime_frontend_javascript("temporary-token", realtime.create_realtime_colab_root_id())

    assert "Предварительный текст" in page
    assert "Подтверждённый текст" in page
    assert "font-size:17px" in page
    assert "line-height:1.6" in page
    assert "white-space:pre-wrap" in page
    assert 'data-el="clear" disabled>Очистить подтверждённый текст</button>' in page
    assert "function updateTranscriptButtons()" in js
    assert "copyBtn.disabled = !hasText" in js
    assert "downloadBtn.disabled = !hasText" in js
    assert "clearBtn.disabled = !hasText" in js
    assert "window.confirm('Будет очищен только подтверждённый текст в текущей вкладке. Google Docs, manifest, предварительный текст и текущая сессия не будут затронуты.')" in js
    assert "function clearCommittedSegments()" in js
    assert "finalTranscript = ''; committedSegmentCount = 0; renderCommittedEmptyState(); updateTranscriptButtons();" in js
    assert "partialEl.textContent = '';" in js
    assert "cleanupDone" in js
    assert "userStopRequested" in js
    assert "WebSocket закрыт после команды пользователя" in js
    assert "Неожиданное закрытие WebSocket" in js



def test_realtime_lifecycle_stop_status_and_failed_capture_cleanup_are_guarded() -> None:
    js = realtime.build_realtime_frontend_javascript(
        "temporary-token", realtime.create_realtime_colab_root_id()
    )

    assert "ws.onclose = (event) =>" in js
    assert "finalStatus: expected ? STATUS.stopped : STATUS.closed" in js
    assert "if (attempt.cleanupDone)" in js
    assert "if (current && finalStatus) setStatus(finalStatus); return;" in js
    assert "function stopStreams(streams)" in js
    assert "throw err;" in js
    assert "partialEl.textContent = ''; setStatus(STATUS.starting);" in js


def test_realtime_live_transcript_v1_uses_safe_ordered_dom_segments() -> None:
    page = realtime.build_realtime_frontend_html("temporary-token")
    js = realtime.build_realtime_frontend_javascript(
        "temporary-token", realtime.create_realtime_colab_root_id()
    )

    assert 'data-schema="realtime_live_transcript_v1"' in page
    assert "Пока нет подтверждённых фрагментов" in js
    assert "document.createElement('p')" in js
    assert "segment.className = 'el-committed-segment'" in js
    assert "segment.textContent = text" in js
    assert "segment.innerHTML" not in js
    assert "segment.dataset.segmentIndex = String(committedSegmentCount + 1)" in js
    assert "finalTranscript += (finalTranscript && !finalTranscript.endsWith('\\n') ? '\\n' : '') + text" in js
    assert "appendCommittedSegment(text)" in js
    assert "committedEl.replaceChildren()" in js


def test_realtime_user_facing_copy_is_russian_first() -> None:
    assets = realtime.build_realtime_frontend_html("temporary-token") + realtime.build_realtime_frontend_javascript(
        "temporary-token", realtime.create_realtime_colab_root_id()
    ) + realtime.build_realtime_proxy_launch_html("https://colab.example/proxy/123/", "http://127.0.0.1:123/", used_colab_proxy=True)

    for forbidden in [
        "standalone frontend bridge",
        "single-use realtime token",
        "Python HTTP server",
        "speaker projects",
        "media tracks",
        "Main API key",
        "share audio",
    ]:
        assert forbidden not in assets
    assert "одноразовый токен realtime" in assets
    assert "локальный HTTP-сервер Python" in assets
    assert "проектов" in assets
    assert "медиадорожки" in assets

def test_proxy_frontend_does_not_introduce_persistence_or_extra_runtime_surfaces() -> None:
    assets = realtime.build_realtime_frontend_html("temporary-token") + realtime.build_realtime_frontend_javascript("temporary-token", realtime.create_realtime_colab_root_id())

    for forbidden in ["localStorage", "sessionStorage", "indexedDB", "serviceWorker", "manifest.json", "speaker-project", "Google Docs save"]:
        assert forbidden not in assets

def test_realtime_attempt_scoped_permission_cancellation_guards() -> None:
    js = realtime.build_realtime_frontend_javascript("temporary-token", realtime.create_realtime_colab_root_id())

    assert "let currentAttempt = null" in js
    assert "let attemptGeneration = 0" in js
    assert "function createAttempt()" in js
    assert "function ownsCurrentUi(attempt)" in js
    assert "function isAttemptActive(attempt)" in js
    assert "function assertAttemptActive(attempt)" in js
    assert "cancelled: false" in js
    assert "const attempt = createAttempt(); currentAttempt = attempt;" in js
    assert "await attempt.audioContext.resume(); assertAttemptActive(attempt);" in js
    assert "attachWebSocket(attempt)" in js


def test_realtime_stop_during_pending_display_permission_stops_stale_stream_before_websocket() -> None:
    js = realtime.build_realtime_frontend_javascript("temporary-token", realtime.create_realtime_colab_root_id())

    assert "async function getDisplayAudioStream(attempt)" in js
    assert "navigator.mediaDevices.getDisplayMedia" in js
    assert "if (!isAttemptActive(attempt)) { stopStream(stream); throw new Error('STALE_ATTEMPT'); }" in js
    assert "assertAttemptActive(attempt);" in js


def test_realtime_stop_during_pending_microphone_permission_stops_stale_stream_before_websocket() -> None:
    js = realtime.build_realtime_frontend_javascript("temporary-token", realtime.create_realtime_colab_root_id())

    assert "async function getInputAudioStream(attempt)" in js
    assert "navigator.mediaDevices.getUserMedia(microphoneConstraints())" in js
    assert "if (!isAttemptActive(attempt)) { stopStream(stream); throw new Error('STALE_ATTEMPT'); }" in js


def test_realtime_mixed_source_stale_acquisition_cleanup_and_source_reset() -> None:
    js = realtime.build_realtime_frontend_javascript("temporary-token", realtime.create_realtime_colab_root_id())

    assert "function registerCapturedStream(stream)" in js
    assert "attempt.mediaStreams.push(stream); streams.push(stream); return stream;" in js
    assert "if (hasDisplayAudio()) registerCapturedStream(await getDisplayAudioStream(attempt));" in js
    assert "if (hasInputAudio()) registerCapturedStream(await getInputAudioStream(attempt));" in js
    assert "catch (err) { stopStreams(streams); throw err; }" in js
    assert "function resetUiAfterAttempt()" in js
    assert "setSourceControlsDisabled(false); updateSourceUi();" in js


def test_realtime_browser_prompt_cancelled_without_websocket_creation_is_ready() -> None:
    js = realtime.build_realtime_frontend_javascript("temporary-token", realtime.create_realtime_colab_root_id())

    assert "function isPermissionCancellation(err)" in js
    assert "Разрешение на захват аудио отменено или отклонено в браузере" in js
    assert "Запуск остановлен до создания WebSocket; состояние готово к повторной попытке." in js
    assert "finalStatus: STATUS.ready" in js
    assert "attempt.websocketCreated = true" in js


def test_realtime_stale_old_attempt_cannot_affect_newer_attempt_or_callbacks() -> None:
    js = realtime.build_realtime_frontend_javascript("temporary-token", realtime.create_realtime_colab_root_id())

    assert "currentAttempt && currentAttempt.id === attempt.id" in js
    assert "if (!isAttemptActive(attempt)) return; setStatus(STATUS.websocketOpen)" in js
    assert "if (!ownsCurrentUi(attempt)) return; if (!isAttemptActive(attempt) && !attempt.userStopRequested) return; const expected = attempt.userStopRequested" in js
    assert "if (!isAttemptActive(attempt)) return; try { handleRealtimeEvent" in js


def test_realtime_expected_stop_and_unexpected_close_remain_distinguishable() -> None:
    js = realtime.build_realtime_frontend_javascript("temporary-token", realtime.create_realtime_colab_root_id())

    assert "const expected = attempt.userStopRequested" in js
    assert "WebSocket закрыт после команды пользователя" in js
    assert "Неожиданное закрытие WebSocket" in js
    assert "finalStatus: expected ? STATUS.stopped : STATUS.closed" in js
    assert "cleanupAttempt(attempt, {closeSocket, finalStatus: STATUS.stopped" in js


def test_realtime_partial_text_clears_after_cancellation_failure_and_stop() -> None:
    js = realtime.build_realtime_frontend_javascript("temporary-token", realtime.create_realtime_colab_root_id())

    assert "partialEl.textContent = ''; setSourceControlsDisabled(false); updateSourceUi();" in js
    assert "isRunning = true; setSourceControlsDisabled(true); updateSourceUi(); partialEl.textContent = ''; setStatus(STATUS.starting);" in js
    assert "if (!attempt) { isRunning = false; partialEl.textContent = '';" in js


def test_realtime_stop_marks_attempt_cancelled_before_cleanup() -> None:
    js = realtime.build_realtime_frontend_javascript("temporary-token", realtime.create_realtime_colab_root_id())

    assert "attempt.userStopRequested = true;\n    attempt.cancelled = true;\n    cleanupAttempt(attempt" in js
    assert js.index("attempt.userStopRequested = true;\n    attempt.cancelled = true;\n    cleanupAttempt(attempt") < js.index("finalStatus: STATUS.stopped")


def test_realtime_active_predicate_invalidates_cancelled_or_cleaned_attempts() -> None:
    js = realtime.build_realtime_frontend_javascript("temporary-token", realtime.create_realtime_colab_root_id())

    assert "function isAttemptActive(attempt) { return ownsCurrentUi(attempt) && !attempt.cancelled && !attempt.cleanupDone; }" in js
    assert "function assertAttemptActive(attempt) { if (!isAttemptActive(attempt)) throw new Error('STALE_ATTEMPT'); }" in js


def test_realtime_each_stream_registered_before_next_capture_await() -> None:
    js = realtime.build_realtime_frontend_javascript("temporary-token", realtime.create_realtime_colab_root_id())

    display_capture = "registerCapturedStream(await getDisplayAudioStream(attempt));"
    input_capture = "registerCapturedStream(await getInputAudioStream(attempt));"
    assert "attempt.mediaStreams.push(stream); streams.push(stream); return stream;" in js
    assert js.index(display_capture) < js.index(input_capture)


def test_realtime_stop_between_display_and_microphone_prevents_websocket_creation() -> None:
    js = realtime.build_realtime_frontend_javascript("temporary-token", realtime.create_realtime_colab_root_id())

    assert "if (!isAttemptActive(attempt)) { stopStream(stream); throw new Error('STALE_ATTEMPT'); }" in js
    assert "assertAttemptActive(attempt);" in js
    assert js.index("await populateInputDevices(attempt)") < js.index("attachWebSocket(attempt)")
    assert js.index("assertAttemptActive(attempt);\n    attempt.websocketCreated = true;") < js.index("attempt.ws = new WebSocket(CONFIG.wsUrl)")


def test_realtime_inactive_attempt_catch_precedes_permission_cancellation_ready_cleanup() -> None:
    js = realtime.build_realtime_frontend_javascript("temporary-token", realtime.create_realtime_colab_root_id())

    inactive_branch = "if (!isAttemptActive(attempt) || String(err && err.message) === 'STALE_ATTEMPT') { cleanupAttempt(attempt); return; }"
    permission_branch = "const message = isPermissionCancellation(err) ?"
    ready_cleanup = "cleanupAttempt(attempt, {finalStatus: STATUS.ready"
    assert inactive_branch in js
    assert permission_branch in js
    assert ready_cleanup in js
    assert js.index(inactive_branch) < js.index(permission_branch) < js.index(ready_cleanup)


def test_realtime_stop_then_late_permission_rejection_preserves_stopped_status() -> None:
    js = realtime.build_realtime_frontend_javascript("temporary-token", realtime.create_realtime_colab_root_id())

    stop_cancel = "attempt.userStopRequested = true;\n    attempt.cancelled = true;\n    cleanupAttempt(attempt, {closeSocket, finalStatus: STATUS.stopped"
    inactive_branch = "if (!isAttemptActive(attempt) || String(err && err.message) === 'STALE_ATTEMPT') { cleanupAttempt(attempt); return; }"
    ready_cleanup = "cleanupAttempt(attempt, {finalStatus: STATUS.ready"
    assert stop_cancel in js
    assert inactive_branch in js
    assert ready_cleanup in js
    assert js.index(inactive_branch) < js.index("const message = isPermissionCancellation(err) ?")


def test_realtime_device_refresh_defaults_to_passive_without_attempt() -> None:
    js = realtime.build_realtime_frontend_javascript("temporary-token", realtime.create_realtime_colab_root_id())

    assert "async function populateInputDevices(attempt = null)" in js
    assert "if (attempt) assertAttemptActive(attempt);" in js
    assert "const devices = await navigator.mediaDevices.enumerateDevices();" in js


def test_realtime_startup_device_refresh_is_attempt_bound_after_enumeration() -> None:
    js = realtime.build_realtime_frontend_javascript("temporary-token", realtime.create_realtime_colab_root_id())

    assert "await populateInputDevices(attempt).catch" in js
    assert js.index("const devices = await navigator.mediaDevices.enumerateDevices();") < js.index("if (attempt) assertAttemptActive(attempt);")


def test_realtime_passive_refresh_call_sites_do_not_reuse_cancelled_attempt() -> None:
    js = realtime.build_realtime_frontend_javascript("temporary-token", realtime.create_realtime_colab_root_id())

    assert "refreshDevicesBtn.addEventListener('click', () => populateInputDevices().catch" in js
    assert "markJsReady(); populateInputDevices().catch" in js
    assert "devicechange', () => populateInputDevices().catch" in js
    assert "populateInputDevices(currentAttempt)" not in js

def test_generated_proxy_realtime_javascript_passes_node_syntax_check(tmp_path: Path) -> None:
    node = shutil.which("node")
    if node is None:
        pytest.skip("node is not available for generated JavaScript syntax validation")

    js = realtime.build_realtime_frontend_javascript(
        "temporary-token",
        realtime.create_realtime_colab_root_id(),
    )
    js_path = tmp_path / "realtime.js"
    js_path.write_text(js, encoding="utf-8")

    result = subprocess.run(
        [node, "--check", str(js_path)],
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr


def test_proxy_frontend_javascript_uses_deterministic_config_loader() -> None:
    source = (ROOT / "elevenlabs_realtime.py").read_text(encoding="utf-8")
    function_source = source[
        source.index("def build_realtime_frontend_javascript") : source.index(
            "def build_realtime_frontend_html"
        )
    ]
    js = realtime.build_realtime_frontend_javascript(
        "temporary-token",
        realtime.create_realtime_colab_root_id(),
    )

    assert "fetch('/config.json', {cache: 'no-store'})" in js
    assert "_build_realtime_app_javascript" in function_source
    assert ".index(" not in function_source
    assert "javascript[:" not in function_source
    assert "runtime-config-loaded-from-json" not in function_source


def test_proxy_server_serves_standalone_frontend_assets_without_provider_calls() -> None:
    server, local_url = realtime.start_realtime_frontend_server("temporary-token")
    try:
        with urlopen(local_url, timeout=5) as response:
            body = response.read().decode("utf-8")
            content_type = response.headers.get("Content-Type")
        assert response.status == 200
        assert content_type == "text/html; charset=utf-8"
        assert "LIVE-COLAB-PROXY-01: отдельная realtime-страница" in body
        assert '<script src="/realtime.js" defer></script>' in body
        assert "temporary-token" not in body

        with urlopen(local_url + "realtime.js", timeout=5) as response:
            js = response.read().decode("utf-8")
            js_content_type = response.headers.get("Content-Type")
        assert response.status == 200
        assert js_content_type == "application/javascript; charset=utf-8"
        assert "fetch('/config.json'" in js
        assert "setStatus(STATUS.ready)" in js
        assert "temporary-token" not in js

        with urlopen(local_url + "config.json", timeout=5) as response:
            config = json.loads(response.read().decode("utf-8"))
            config_content_type = response.headers.get("Content-Type")
        assert response.status == 200
        assert config_content_type == "application/json; charset=utf-8"
        assert config["bridge"] == "LIVE-COLAB-PROXY-01"
        assert "temporary-token" in config["wsUrl"]

        combined = body + js + json.dumps(config, ensure_ascii=False)
        assert "ELEVEN_API_KEY" not in combined
        assert "ELEVENLABS_API_KEY" not in combined
    finally:
        server.shutdown()
        server.server_close()


def test_proxy_launch_html_contains_required_link_label_and_warnings() -> None:
    launch_html = realtime.build_realtime_proxy_launch_html(
        "https://colab.example/proxy/123/",
        "http://127.0.0.1:123/",
        used_colab_proxy=True,
    )

    assert "Открыть realtime-страницу в новой вкладке" in launch_html
    assert "Экспериментальный контур" in launch_html
    assert "Без сохранения в Google Docs" in launch_html
    assert "Без чтения/записи manifest" in launch_html
    assert "Без интеграции проектов спикеров" in launch_html
    assert "одноразовый токен realtime" in launch_html
    assert "https://colab.example/proxy/123/" in launch_html


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


def test_realtime_proxy_source_has_no_google_docs_drive_manifest_or_speaker_calls() -> None:
    source = (ROOT / "elevenlabs_realtime.py").read_text(encoding="utf-8")

    disallowed_patterns = [
        r"build\(\s*['\"]drive['\"]",
        r"build\(\s*['\"]docs['\"]",
        r"manifest\s*=",
        r"open\([^)]*manifest",
        r"speaker_projects\.json",
        r"telegram",
    ]
    for pattern in disallowed_patterns:
        assert re.search(pattern, source, flags=re.IGNORECASE) is None


def test_proxy_page_assets_do_not_introduce_google_docs_drive_manifest_or_speaker_calls() -> None:
    page = realtime.build_realtime_frontend_html("temporary-token")
    js = realtime.build_realtime_frontend_javascript("temporary-token", realtime.create_realtime_colab_root_id())
    config = json.dumps(realtime.build_realtime_frontend_config("temporary-token"), ensure_ascii=False)
    assets = page + js + config

    for forbidden in [
        "google.docs",
        "google.drive",
        "build('docs'",
        'build("docs"',
        "build('drive'",
        'build("drive"',
        "speaker_projects.json",
        "telegram",
    ]:
        assert forbidden.lower() not in assets.lower()


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

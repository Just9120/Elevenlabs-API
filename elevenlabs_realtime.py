"""Experimental LIVE-COLAB-01 realtime transcription Colab runtime.

This file is intentionally standalone and does not import the batch Colab
runtime. It creates an ElevenLabs realtime Scribe single-use token Python-side,
then renders a lightweight browser UI that sends captured PCM audio chunks over
an ElevenLabs realtime WebSocket.

Prototype boundaries:
- no Google Docs/Drive writes;
- no manifest reads/writes;
- no speaker project integration;
- no transcript/audio/secrets persistence;
- browser receives only a short-lived realtime token, never the main API key.
"""

from __future__ import annotations

import html
import importlib.util
import json
import os
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable
from urllib.parse import urlencode
from urllib.request import Request, urlopen


REALTIME_TOKEN_URL = "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe"
REALTIME_WS_ENDPOINT = "wss://api.elevenlabs.io/v1/speech-to-text/realtime"
REALTIME_MODEL_ID = "scribe_v2_realtime"
REALTIME_AUDIO_FORMAT = "pcm_16000"
REALTIME_COMMIT_STRATEGY = "vad"
ELEVENLABS_API_KEY_NAMES = ("ELEVEN_API_KEY", "ELEVENLABS_API_KEY")
ELEVENLABS_API_KEY_NOT_FOUND_MESSAGE = (
    "ElevenLabs API key not found. Add ELEVEN_API_KEY to Colab Secrets, "
    "or use ELEVENLABS_API_KEY as a compatibility alias."
)

_REALTIME_PROXY_SERVERS: list[ThreadingHTTPServer] = []


KNOWN_ERROR_MESSAGES_RU = {
    "auth": "Ошибка авторизации ElevenLabs realtime. Проверьте API key и срок действия single-use token.",
    "authentication": "Ошибка авторизации ElevenLabs realtime. Проверьте API key и срок действия single-use token.",
    "unauthorized": "Ошибка авторизации ElevenLabs realtime. Проверьте API key и срок действия single-use token.",
    "quota": "Квота ElevenLabs исчерпана или недоступна для realtime transcription.",
    "quota_exceeded": "Квота ElevenLabs исчерпана или недоступна для realtime transcription.",
    "rate_limit": "Превышен лимит запросов ElevenLabs realtime. Подождите и попробуйте снова.",
    "rate_limited": "Превышен лимит запросов ElevenLabs realtime. Подождите и попробуйте снова.",
    "queue_overflow": "Очередь realtime audio переполнена. Остановите запись и попробуйте снова с меньшей нагрузкой.",
    "session_time_limit": "Достигнут лимит длительности realtime session. Остановите запись и начните новую session.",
    "session_time_limit_exceeded": "Достигнут лимит длительности realtime session. Остановите запись и начните новую session.",
    "chunk_size": "Некорректный размер audio chunk. Остановите запись и попробуйте снова.",
    "input_audio_chunk": "Ошибка входного audio chunk. Остановите запись и попробуйте снова.",
    "invalid_audio": "Некорректный audio input. Проверьте источник звука и попробуйте снова.",
}


class _JsonResponse:
    def __init__(self, status_code: int, body: bytes):
        self.status_code = status_code
        self._body = body

    def json(self) -> dict[str, Any]:
        return json.loads(self._body.decode("utf-8"))


def _urllib_post_json(url: str, *, headers: dict[str, str], timeout: int) -> _JsonResponse:
    request = Request(url, data=b"", headers=headers, method="POST")
    with urlopen(request, timeout=timeout) as response:
        return _JsonResponse(getattr(response, "status", 200), response.read())


class RealtimeTokenError(RuntimeError):
    """Raised when a realtime single-use token cannot be obtained safely."""


def _get_colab_userdata() -> Any | None:
    """Return Colab userdata when available, otherwise None."""

    if (
        importlib.util.find_spec("google") is None
        or importlib.util.find_spec("google.colab") is None
    ):
        return None
    from google.colab import userdata

    return userdata


def get_elevenlabs_api_key() -> str:
    """Load the ElevenLabs API key from Colab Secrets/userdata or environment."""

    userdata = _get_colab_userdata()
    for name in ELEVENLABS_API_KEY_NAMES:
        if userdata is not None:
            try:
                key = (userdata.get(name) or "").strip()
            except Exception:
                key = ""
            if key:
                return key

        key = os.environ.get(name, "").strip()
        if key:
            return key

    raise RealtimeTokenError(ELEVENLABS_API_KEY_NOT_FOUND_MESSAGE)


def extract_realtime_token(payload: dict[str, Any]) -> str:
    """Validate ElevenLabs single-use-token response shape and return the token."""

    for field in ("token", "single_use_token", "singleUseToken"):
        value = payload.get(field)
        if isinstance(value, str) and value.strip():
            return value.strip()
    raise RealtimeTokenError(
        "ElevenLabs single-use token response did not contain a non-empty token field."
    )


def create_realtime_single_use_token(
    api_key: str,
    *,
    post: Callable[..., Any] | None = None,
    timeout: int = 20,
) -> str:
    """Create a single-use realtime Scribe token without exposing the main API key."""

    if not isinstance(api_key, str) or not api_key.strip():
        raise RealtimeTokenError("ElevenLabs API key is empty.")
    post_fn = post or _urllib_post_json
    response = post_fn(
        REALTIME_TOKEN_URL,
        headers={"xi-api-key": api_key.strip(), "Accept": "application/json"},
        timeout=timeout,
    )
    if getattr(response, "status_code", 0) >= 400:
        raise RealtimeTokenError(
            f"ElevenLabs single-use token request failed with HTTP {response.status_code}."
        )
    return extract_realtime_token(response.json())


def build_realtime_websocket_url(
    token: str,
    *,
    model_id: str = REALTIME_MODEL_ID,
    audio_format: str = REALTIME_AUDIO_FORMAT,
    commit_strategy: str = REALTIME_COMMIT_STRATEGY,
) -> str:
    """Build the ElevenLabs realtime WebSocket URL used by browser JavaScript."""

    if not isinstance(token, str) or not token.strip():
        raise ValueError("token is required")
    if not isinstance(model_id, str) or not model_id.strip():
        raise ValueError("model_id is required")
    if not isinstance(commit_strategy, str) or not commit_strategy.strip():
        raise ValueError("commit_strategy is required")
    query = urlencode(
        {
            "model_id": model_id.strip(),
            "token": token.strip(),
            "audio_format": audio_format,
            "commit_strategy": commit_strategy.strip(),
        }
    )
    return f"{REALTIME_WS_ENDPOINT}?{query}"


def realtime_error_message_ru(code_or_event: Any) -> str:
    """Map known realtime error events/codes to concise Russian messages."""

    text = str(code_or_event or "").lower()
    for key, message in KNOWN_ERROR_MESSAGES_RU.items():
        if key in text:
            return message
    return "WebSocket realtime transcription error. Проверьте соединение, источник аудио и попробуйте снова."


def create_realtime_colab_root_id() -> str:
    """Return a unique DOM root id for one Colab realtime UI render."""

    return f"el-realtime-root-{uuid.uuid4().hex}"


def _validate_realtime_colab_root_id(root_id: str) -> str:
    """Validate a generated DOM root id before embedding it in HTML/JS."""

    if not isinstance(root_id, str) or not root_id.strip():
        raise ValueError("root_id is required")
    root_id = root_id.strip()
    if not root_id.startswith("el-realtime-root-"):
        raise ValueError("root_id must be an el-realtime-root-* id")
    if not all(char.isalnum() or char == "-" for char in root_id):
        raise ValueError("root_id contains unsupported characters")
    return root_id


def build_realtime_colab_html_shell(root_id: str) -> str:
    """Return the static DOM/CSS shell for the Colab output cell."""

    root_id = _validate_realtime_colab_root_id(root_id)

    return f"""
<div id="{root_id}" data-el-realtime-root style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.45;max-width:960px;border:1px solid #d8dee9;border-radius:14px;padding:18px;margin:8px 0;background:#fff;color:#17202a;box-shadow:0 1px 3px rgba(15,23,42,0.06);">
  <style>
    #{root_id} .el-title {{ margin:0 0 6px;color:#111827;font-size:22px;line-height:1.25;font-weight:700; }}
    #{root_id} .el-subtitle {{ margin:0;color:#4b5563;max-width:860px; }}
    #{root_id} .el-panel {{ border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin:14px 0;background:#fafafa; }}
    #{root_id} .el-field {{ margin:0 0 12px; }}
    #{root_id} .el-label {{ display:block;margin:0 0 6px;color:#1f2937;font-weight:700; }}
    #{root_id} select {{ display:block;width:min(100%,420px);padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#111827; }}
    #{root_id} .el-controls {{ display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:4px; }}
    #{root_id} button {{ padding:8px 14px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;color:#111827;cursor:pointer; }}
    #{root_id} button:disabled {{ color:#94a3b8;cursor:not-allowed;background:#f1f5f9; }}
    #{root_id} [data-el="status"] {{ padding:9px 11px;background:#eef6ff;border:1px solid #bfdbfe;border-radius:10px;margin:12px 0 8px;color:#1e3a8a;font-weight:700; }}
    #{root_id} [data-el="diagnostics-wrap"] {{ margin:8px 0 16px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb; }}
    #{root_id} [data-el="diagnostics-wrap"] summary {{ padding:8px 10px;cursor:pointer;font-weight:700;color:#374151; }}
    #{root_id} .el-diagnostics-placeholder {{ padding:0 10px 10px;color:#6b7280;font-size:13px; }}
    #{root_id} [data-el="diagnostics"] {{ white-space:pre-wrap;background:#263238;color:#eef2f7;border-radius:8px;padding:9px 10px;margin:0 10px 10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.45;max-height:160px;overflow:auto; }}
    #{root_id} .el-section-title {{ margin:14px 0 6px;color:#111827;font-size:16px; }}
  </style>
  <h2 class="el-title">LIVE-COLAB-01: realtime transcription prototype</h2>
  <p class="el-subtitle">Экспериментальный Colab-прототип: без Google Docs save, без manifest, без speaker projects. Main API key остаётся Python-side; browser получает только single-use realtime token.</p>
  <div class="el-panel" aria-label="Realtime controls">
    <div class="el-field">
      <label class="el-label" for="{root_id}-source-mode">Источник аудио</label>
      <select id="{root_id}-source-mode" data-el="source-mode">
        <option value="mic">Microphone</option>
        <option value="display">Browser tab / screen audio</option>
        <option value="display_mic">Browser tab / screen audio + microphone</option>
        <option value="virtual">Virtual input / system audio device</option>
      </select>
    </div>
    <div class="el-field">
      <label class="el-label" for="{root_id}-input-device">Microphone / virtual input device</label>
      <select id="{root_id}-input-device" data-el="input-device">
        <option value="">Default browser input</option>
      </select>
    </div>
    <div class="el-controls">
      <button data-el="start">Start</button>
      <button data-el="stop" disabled>Stop</button>
      <button data-el="copy">Copy transcript</button>
      <button data-el="download">Download .txt</button>
    </div>
  </div>
  <div data-el="status" data-js-ready-marker="pending">Статус: iframe HTML loaded; JS not attached yet</div>
  <details data-el="diagnostics-wrap">
    <summary>Диагностика</summary>
    <div data-el="diagnostics-placeholder" class="el-diagnostics-placeholder">Диагностика появится после запуска realtime-сессии.</div>
    <pre data-el="diagnostics" hidden></pre>
  </details>
  <h3 class="el-section-title">Partial transcript</h3>
  <div data-el="partial" style="min-height:56px;border:1px dashed #a7b3c4;border-radius:10px;padding:12px;background:#fcfcff;"></div>
  <h3 class="el-section-title">Committed transcript</h3>
  <pre data-el="committed" style="white-space:pre-wrap;min-height:180px;border:1px solid #cbd5e1;border-radius:10px;padding:12px;background:#fbfbfb;"></pre>
</div>
"""


def build_realtime_colab_javascript(token: str, root_id: str) -> str:
    """Return executable JavaScript for the current Colab realtime UI render."""

    ws_url = build_realtime_websocket_url(token)
    root_id = _validate_realtime_colab_root_id(root_id)
    config_json = json.dumps(
        {
            "wsUrl": ws_url,
            "modelId": REALTIME_MODEL_ID,
            "audioFormat": REALTIME_AUDIO_FORMAT,
            "commitStrategy": REALTIME_COMMIT_STRATEGY,
            "messages": KNOWN_ERROR_MESSAGES_RU,
        },
        ensure_ascii=False,
    )

    return f"""
(() => {{
  const CONFIG = {config_json};
  const RENDER_ROOT_ID = '{root_id}';
  const root = document.getElementById(RENDER_ROOT_ID);
  if (!root) {{
    console.error('LIVE-COLAB-01 root not found for current render:', RENDER_ROOT_ID);
    return;
  }}
  const byEl = (name) => root.querySelector(`[data-el="${{name}}"]`);
  const modeEl = byEl('source-mode');
  const inputDeviceEl = byEl('input-device');
  const startBtn = byEl('start');
  const stopBtn = byEl('stop');
  const copyBtn = byEl('copy');
  const downloadBtn = byEl('download');
  const statusEl = byEl('status');
  const diagWrapEl = byEl('diagnostics-wrap');
  const diagPlaceholderEl = byEl('diagnostics-placeholder');
  const diagEl = byEl('diagnostics');
  const partialEl = byEl('partial');
  const committedEl = byEl('committed');

  let ws = null;
  let audioContext = null;
  let processor = null;
  let sourceNodes = [];
  let mediaStreams = [];
  let finalTranscript = '';
  let isRunning = false;

  function setStatus(text) {{ statusEl.textContent = 'Статус: ' + text; }}
  function markJsReady() {{
    root.dataset.jsReady = 'true';
    statusEl.dataset.jsReadyMarker = 'attached';
    setStatus('idle');
  }}
  function log(text) {{
    const line = '[' + new Date().toLocaleTimeString() + '] ' + text;
    diagPlaceholderEl.hidden = true;
    diagEl.hidden = false;
    diagWrapEl.open = true;
    diagEl.textContent = (diagEl.textContent ? diagEl.textContent + '\n' : '') + line;
  }}
  function knownErrorMessage(value) {{
    const lower = String(value || '').toLowerCase();
    for (const [key, message] of Object.entries(CONFIG.messages)) {{
      if (lower.includes(key)) return message;
    }}
    return 'WebSocket realtime transcription error. Проверьте соединение, источник аудио и попробуйте снова.';
  }}
  async function populateInputDevices() {{
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    const current = inputDeviceEl.value;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');
    inputDeviceEl.innerHTML = '<option value="">Default browser input</option>';
    audioInputs.forEach((device, index) => {{
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || ('Audio input ' + (index + 1));
      inputDeviceEl.appendChild(option);
    }});
    if ([...inputDeviceEl.options].some(option => option.value === current)) inputDeviceEl.value = current;
  }}
  function microphoneConstraints() {{
    return inputDeviceEl.value ? {{audio: {{deviceId: {{exact: inputDeviceEl.value}}}}}} : {{audio: true}};
  }}
  function appendCommitted(text) {{
    if (!text) return;
    finalTranscript += (finalTranscript && !finalTranscript.endsWith('\n') ? '\n' : '') + text;
    committedEl.textContent = finalTranscript;
  }}
  function pickTranscriptText(data) {{
    return data.text || data.transcript || data.partial_transcript || data.committed_transcript || data.final_transcript || data.message || '';
  }}
  function handleRealtimeEvent(data) {{
    const eventType = String(data.type || data.event || data.message_type || data.status || '').toLowerCase();
    if (eventType.includes('session_started') || eventType.includes('session started')) {{
      setStatus('session_started');
      log('ElevenLabs session_started');
      return;
    }}
    if (eventType.includes('error') || data.error || data.error_code) {{
      const code = data.error_code || data.code || data.error || eventType;
      log(knownErrorMessage(code));
      return;
    }}
    const text = pickTranscriptText(data);
    if (!text) {{
      log('Realtime event: ' + eventType);
      return;
    }}
    if (eventType.includes('partial') || data.is_final === false) {{
      partialEl.textContent = text;
      return;
    }}
    if (eventType.includes('commit') || eventType.includes('final') || data.is_final === true) {{
      partialEl.textContent = '';
      appendCommitted(text);
      return;
    }}
    partialEl.textContent = text;
  }}
  function floatTo16BitPcmBase64(float32) {{
    const buffer = new ArrayBuffer(float32.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32.length; i++) {{
      const s = Math.max(-1, Math.min(1, float32[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }}
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {{
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }}
    return btoa(binary);
  }}
  function downsampleMono(input, inputRate, outputRate) {{
    if (inputRate === outputRate) return input;
    const ratio = inputRate / outputRate;
    const newLength = Math.round(input.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {{
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < input.length; i++) {{
        accum += input[i];
        count++;
      }}
      result[offsetResult] = count ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }}
    return result;
  }}
  async function getStreamForMode(mode) {{
    if (mode === 'mic' || mode === 'virtual') {{
      if (mode === 'virtual') log('Virtual/system audio mode: выберите OS-level virtual audio/loopback input как microphone device. Browser не гарантирует прямой захват desktop app audio.');
      return navigator.mediaDevices.getUserMedia(microphoneConstraints());
    }}
    if (mode === 'display') {{
      const stream = await navigator.mediaDevices.getDisplayMedia({{video: true, audio: true}});
      if (stream.getAudioTracks().length === 0) {{
        stream.getTracks().forEach(track => track.stop());
        throw new Error('Браузер не передал audio track для выбранной вкладки/экрана. Попробуйте вкладку с включенным "share audio" или другой источник.');
      }}
      return stream;
    }}
    if (mode === 'display_mic') {{
      const displayStream = await navigator.mediaDevices.getDisplayMedia({{video: true, audio: true}});
      if (displayStream.getAudioTracks().length === 0) {{
        displayStream.getTracks().forEach(track => track.stop());
        throw new Error('Браузер не передал audio track для выбранной вкладки/экрана. Попробуйте вкладку с включенным "share audio" или другой источник.');
      }}
      const micStream = await navigator.mediaDevices.getUserMedia(microphoneConstraints());
      mediaStreams.push(displayStream, micStream);
      log('Warning: display+mic mixing can create echo/double audio if the microphone hears speakers.');
      const ctx = new AudioContext();
      audioContext = ctx;
      const destination = ctx.createMediaStreamDestination();
      const displaySource = ctx.createMediaStreamSource(displayStream);
      const micSource = ctx.createMediaStreamSource(micStream);
      displaySource.connect(destination);
      micSource.connect(destination);
      sourceNodes.push(displaySource, micSource);
      return destination.stream;
    }}
    throw new Error('Unknown audio source mode: ' + mode);
  }}
  async function start() {{
    if (isRunning) return;
    isRunning = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    partialEl.textContent = '';
    setStatus('starting');
    try {{
      if (!navigator.mediaDevices) throw new Error('Browser mediaDevices API is unavailable in this environment.');
      await populateInputDevices();
      const mode = modeEl.value;
      let stream = await getStreamForMode(mode);
      if (!mediaStreams.includes(stream)) mediaStreams.push(stream);
      if (!audioContext) audioContext = new AudioContext();
      await audioContext.resume();
      ws = new WebSocket(CONFIG.wsUrl);
      ws.onopen = () => {{ setStatus('websocket_open'); log('WebSocket opened; using ' + CONFIG.modelId + ' / ' + CONFIG.audioFormat + ' / commit_strategy=' + CONFIG.commitStrategy); }};
      ws.onerror = () => {{ log('WebSocket error. Проверьте сеть, token и ElevenLabs realtime access.'); }};
      ws.onclose = (event) => {{ log('WebSocket closed: code=' + event.code + ', reason=' + (event.reason || '')); setStatus('closed'); stop(false); }};
      ws.onmessage = (event) => {{
        try {{ handleRealtimeEvent(JSON.parse(event.data)); }}
        catch (err) {{ log('Non-JSON realtime message ignored.'); }}
      }};
      const source = audioContext.createMediaStreamSource(stream);
      sourceNodes.push(source);
      // Prototype-only: ScriptProcessorNode is deprecated. TODO: migrate to AudioWorklet for PWA/backend-grade realtime capture.
      processor = audioContext.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (event) => {{
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const mono = event.inputBuffer.getChannelData(0);
        const pcm16k = downsampleMono(mono, audioContext.sampleRate, 16000);
        const payload = floatTo16BitPcmBase64(pcm16k);
        ws.send(JSON.stringify({{
          message_type: 'input_audio_chunk',
          audio_base_64: payload,
          sample_rate: 16000
        }}));
      }};
      source.connect(processor);
      processor.connect(audioContext.destination);
      log('Audio capture started. If this is display audio, browser support and share-audio selection are required.');
    }} catch (err) {{
      log(err && err.message ? err.message : String(err));
      stop();
    }}
  }}
  function stop(closeSocket = true) {{
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    try {{ if (processor) processor.disconnect(); }} catch (e) {{}}
    sourceNodes.forEach(node => {{ try {{ node.disconnect(); }} catch (e) {{}} }});
    sourceNodes = [];
    mediaStreams.forEach(stream => stream.getTracks().forEach(track => track.stop()));
    mediaStreams = [];
    if (closeSocket && ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) ws.close();
    ws = null;
    if (audioContext && audioContext.state !== 'closed') audioContext.close();
    audioContext = null;
    setStatus('stopped');
    log('Stopped: media tracks released and WebSocket close requested.');
  }}
  startBtn.addEventListener('click', start);
  stopBtn.addEventListener('click', () => stop());
  copyBtn.addEventListener('click', async () => {{
    await navigator.clipboard.writeText(finalTranscript);
    log('Committed transcript copied to clipboard.');
  }});
  downloadBtn.addEventListener('click', () => {{
    const blob = new Blob([finalTranscript], {{type: 'text/plain;charset=utf-8'}});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'elevenlabs-realtime-transcript.txt';
    a.click();
    URL.revokeObjectURL(url);
  }});
  markJsReady();
  populateInputDevices().catch(() => {{ /* Device labels may be unavailable before browser permission. */ }});
}})();
"""


def build_realtime_colab_iframe_srcdoc(token: str, root_id: str | None = None) -> str:
    """Return the complete realtime app document executed inside a Colab iframe."""

    root_id = _validate_realtime_colab_root_id(root_id or create_realtime_colab_root_id())
    shell = build_realtime_colab_html_shell(root_id)
    javascript = build_realtime_colab_javascript(token, root_id)
    return f"""<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LIVE-COLAB-01 realtime transcription prototype</title>
</head>
<body style="margin:0;padding:0;background:#fff;">
{shell}
<script>
{javascript}
</script>
</body>
</html>
"""


def build_realtime_colab_iframe_html(token: str) -> str:
    """Return outer Colab HTML containing only a sandboxed srcdoc iframe."""

    srcdoc = build_realtime_colab_iframe_srcdoc(token)
    escaped_srcdoc = html.escape(srcdoc, quote=True)
    return f'''
<iframe
  title="LIVE-COLAB-01 realtime transcription prototype"
  srcdoc="{escaped_srcdoc}"
  allow="microphone; display-capture; clipboard-write"
  sandbox="allow-scripts allow-same-origin allow-downloads"
  style="width:100%;min-height:760px;border:0;border-radius:14px;display:block;"
></iframe>
'''


def build_realtime_colab_html(token: str) -> str:
    """Return the iframe-based Colab HTML launcher for the realtime app."""

    return build_realtime_colab_iframe_html(token)


def build_realtime_frontend_config(token: str) -> dict[str, Any]:
    """Build browser config for a standalone page without the main API key."""

    return {
        "wsUrl": build_realtime_websocket_url(token),
        "modelId": REALTIME_MODEL_ID,
        "audioFormat": REALTIME_AUDIO_FORMAT,
        "commitStrategy": REALTIME_COMMIT_STRATEGY,
        "messages": KNOWN_ERROR_MESSAGES_RU,
        "bridge": "LIVE-COLAB-PROXY-01",
    }


def build_realtime_frontend_javascript(token: str, root_id: str) -> str:
    """Return frontend JavaScript that is portable outside Colab output cells."""

    # The LIVE-COLAB-PROXY-01 page runs as a normal document. It intentionally
    # reuses the same browser realtime logic as the output-cell prototype, while
    # the launcher/proxy remains replaceable infrastructure for a future PWA.
    return build_realtime_colab_javascript(token, root_id)


def build_realtime_frontend_html(token: str) -> str:
    """Return a standalone realtime browser page for Colab proxy/new-tab use."""

    root_id = create_realtime_colab_root_id()
    shell = build_realtime_colab_html_shell(root_id)
    shell = shell.replace(
        "LIVE-COLAB-01: realtime transcription prototype",
        "LIVE-COLAB-PROXY-01: realtime frontend bridge",
    )
    shell = shell.replace(
        "Экспериментальный Colab-прототип: без Google Docs save, без manifest, без speaker projects. Main API key остаётся Python-side; browser получает только single-use realtime token.",
        "Экспериментальный standalone bridge через Colab proxy/new tab: no Google Docs save, no manifest, no speaker projects. Browser receives only a single-use realtime token; Colab launcher/proxy is replaceable infrastructure for a future PWA.",
    )
    shell = shell.replace(
        "Статус: iframe HTML loaded; JS not attached yet",
        "Статус: page loaded",
    )
    javascript = build_realtime_frontend_javascript(token, root_id)
    return f"""<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LIVE-COLAB-PROXY-01 realtime frontend bridge</title>
</head>
<body style="margin:0;padding:16px;background:#f8fafc;">
{shell}
<script>
{javascript}
</script>
</body>
</html>
"""


class _RealtimeFrontendRequestHandler(BaseHTTPRequestHandler):
    """Serve the standalone realtime page from the Colab runtime only."""

    server_version = "ElevenLabsRealtimeColabProxy/0.1"

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002 - stdlib signature
        return

    def _send_bytes(self, body: bytes, *, content_type: str, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 - stdlib handler method
        if self.path in ("/", "/index.html"):
            body = self.server.frontend_html.encode("utf-8")  # type: ignore[attr-defined]
            self._send_bytes(body, content_type="text/html; charset=utf-8")
            return
        if self.path == "/healthz":
            self._send_bytes(b"ok", content_type="text/plain; charset=utf-8")
            return
        self._send_bytes(b"not found", content_type="text/plain; charset=utf-8", status=404)


def start_realtime_frontend_server(
    token: str, *, host: str = "127.0.0.1", port: int = 0
) -> tuple[ThreadingHTTPServer, str]:
    """Start a lightweight local HTTP server for the standalone browser page."""

    frontend_html = build_realtime_frontend_html(token)
    server = ThreadingHTTPServer((host, port), _RealtimeFrontendRequestHandler)
    server.frontend_html = frontend_html  # type: ignore[attr-defined]
    thread = threading.Thread(target=server.serve_forever, name="elevenlabs-realtime-proxy", daemon=True)
    thread.start()
    _REALTIME_PROXY_SERVERS.append(server)
    actual_host, actual_port = server.server_address[:2]
    return server, f"http://{actual_host}:{actual_port}/"


def get_colab_proxy_url(port: int) -> str | None:
    """Return the standard Colab proxy URL for a local runtime port when available."""

    if (
        importlib.util.find_spec("google") is None
        or importlib.util.find_spec("google.colab") is None
        or importlib.util.find_spec("google.colab.output") is None
    ):
        return None
    from google.colab import output as colab_output

    try:
        proxy_url = colab_output.eval_js(f"google.colab.kernel.proxyPort({int(port)})")
    except Exception:
        return None
    if isinstance(proxy_url, str) and proxy_url.strip():
        return proxy_url.strip()
    return None


def build_realtime_proxy_launch_html(
    public_url: str, local_url: str, *, used_colab_proxy: bool
) -> str:
    """Build the Colab output containing the new-tab bridge link and warnings."""

    escaped_public_url = html.escape(public_url, quote=True)
    escaped_local_url = html.escape(local_url, quote=True)
    proxy_note = "Colab proxy URL is active." if used_colab_proxy else (
        "Не удалось получить Colab proxy URL автоматически. Если ссылка localhost не открывается из браузера, "
        "перезапустите в Google Colab runtime и проверьте доступность google.colab.kernel.proxyPort(port)."
    )
    return f"""
<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.45;max-width:900px;border:1px solid #d8dee9;border-radius:14px;padding:16px;margin:8px 0;background:#fff;color:#17202a;">
  <h2 style="margin:0 0 8px;">LIVE-COLAB-PROXY-01 realtime frontend bridge</h2>
  <p style="margin:0 0 12px;">Experimental bridge: Colab launches a local Python HTTP server and exposes a standalone browser page in a new tab.</p>
  <p style="margin:0 0 12px;"><a href="{escaped_public_url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;">Open realtime frontend in a new tab</a></p>
  <ul style="margin:0 0 12px 20px;padding:0;">
    <li>No Google Docs save.</li>
    <li>No manifest reads/writes and no manifest schema changes.</li>
    <li>No speaker projects integration.</li>
    <li>Browser receives only a single-use realtime token, never the main API key.</li>
    <li>Do not claim realtime E2E success until manual Colab/browser/provider validation passes.</li>
  </ul>
  <p style="margin:0;color:#4b5563;">{html.escape(proxy_note)} Local runtime URL: <code>{escaped_local_url}</code></p>
</div>
"""


def launch_realtime_colab_proxy() -> None:
    """Launch LIVE-COLAB-PROXY-01 as a standalone page through Colab proxy."""

    if (
        importlib.util.find_spec("IPython") is None
        or importlib.util.find_spec("IPython.display") is None
    ):
        raise RealtimeTokenError("IPython.display is required to render the Colab proxy link.")
    from IPython.display import HTML, display

    api_key = get_elevenlabs_api_key()
    token = create_realtime_single_use_token(api_key)
    server, local_url = start_realtime_frontend_server(token)
    port = int(server.server_address[1])
    proxy_url = get_colab_proxy_url(port)
    public_url = proxy_url or local_url
    display(
        HTML(
            build_realtime_proxy_launch_html(
                public_url, local_url, used_colab_proxy=proxy_url is not None
            )
        )
    )


def launch_realtime_standalone_page() -> None:
    """Compatibility alias for the LIVE-COLAB-PROXY-01 launcher."""

    launch_realtime_colab_proxy()

def launch_realtime_colab() -> None:
    """Create a realtime token and render the Colab browser UI."""

    if (
        importlib.util.find_spec("IPython") is None
        or importlib.util.find_spec("IPython.display") is None
    ):
        raise RealtimeTokenError("IPython.display is required to render the Colab realtime UI.")
    from IPython.display import HTML, display

    api_key = get_elevenlabs_api_key()
    token = create_realtime_single_use_token(api_key)
    display(HTML(build_realtime_colab_iframe_html(token)))


if __name__ == "__main__":
    launch_realtime_colab_proxy()

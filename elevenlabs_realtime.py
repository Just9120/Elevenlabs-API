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

import importlib.util
import json
import os
from typing import Any, Callable
from urllib.parse import urlencode
from urllib.request import Request, urlopen


REALTIME_TOKEN_URL = "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe"
REALTIME_WS_ENDPOINT = "wss://api.elevenlabs.io/v1/speech-to-text/realtime"
REALTIME_MODEL_ID = "scribe_v2_realtime"
REALTIME_AUDIO_FORMAT = "pcm_16000"

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


def get_elevenlabs_api_key() -> str:
    """Load the ElevenLabs API key from Colab Secrets/userdata or environment."""

    key = ""
    if (
        importlib.util.find_spec("google") is not None
        and importlib.util.find_spec("google.colab") is not None
    ):
        from google.colab import userdata

        key = (userdata.get("ELEVENLABS_API_KEY") or "").strip()
    if not key:
        key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not key:
        raise RealtimeTokenError(
            "ELEVENLABS_API_KEY не найден. Добавьте ключ в Colab Secrets "
            "или переменную окружения ELEVENLABS_API_KEY."
        )
    return key


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
        raise RealtimeTokenError("ELEVENLABS_API_KEY is empty.")
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
) -> str:
    """Build the ElevenLabs realtime WebSocket URL used by browser JavaScript."""

    if not isinstance(token, str) or not token.strip():
        raise ValueError("token is required")
    if not isinstance(model_id, str) or not model_id.strip():
        raise ValueError("model_id is required")
    query = urlencode(
        {
            "model_id": model_id.strip(),
            "token": token.strip(),
            "audio_format": audio_format,
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


def build_realtime_colab_html(token: str) -> str:
    """Return the self-contained browser UI HTML for the Colab output cell."""

    ws_url = build_realtime_websocket_url(token)
    config_json = json.dumps(
        {
            "wsUrl": ws_url,
            "modelId": REALTIME_MODEL_ID,
            "audioFormat": REALTIME_AUDIO_FORMAT,
            "messages": KNOWN_ERROR_MESSAGES_RU,
        },
        ensure_ascii=False,
    )

    return f"""
<div id="el-realtime-root" style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.4;max-width:960px;border:1px solid #ddd;border-radius:12px;padding:16px;margin:8px 0;background:#fff;">
  <h2 style="margin:0 0 8px;">LIVE-COLAB-01: ElevenLabs realtime transcription prototype</h2>
  <p style="margin:0 0 12px;color:#555;">Экспериментальный Colab prototype: без Google Docs save, без manifest, без speaker projects. Main API key остается Python-side; browser получает только single-use realtime token.</p>
  <label for="el-source-mode"><strong>Audio source mode</strong></label>
  <select id="el-source-mode" style="display:block;margin:6px 0 10px;padding:6px;min-width:360px;">
    <option value="mic">Microphone</option>
    <option value="display">Browser tab / screen audio</option>
    <option value="display_mic">Browser tab / screen audio + microphone</option>
    <option value="virtual">Virtual input / system audio device</option>
  </select>
  <label for="el-input-device"><strong>Microphone / virtual input device</strong></label>
  <select id="el-input-device" style="display:block;margin:6px 0 10px;padding:6px;min-width:360px;">
    <option value="">Default browser input</option>
  </select>
  <div style="display:flex;gap:8px;align-items:center;margin:8px 0 12px;">
    <button id="el-start" style="padding:8px 14px;">Start</button>
    <button id="el-stop" style="padding:8px 14px;" disabled>Stop</button>
    <button id="el-copy" style="padding:8px 14px;">Copy transcript</button>
    <button id="el-download" style="padding:8px 14px;">Download .txt</button>
  </div>
  <div id="el-status" style="padding:8px;background:#f5f5f5;border-radius:8px;margin:8px 0;">Status: idle</div>
  <div id="el-diagnostics" style="white-space:pre-wrap;background:#111;color:#eee;border-radius:8px;padding:10px;min-height:80px;margin:8px 0;font-family:ui-monospace,Menlo,monospace;font-size:12px;"></div>
  <h3>Partial transcript</h3>
  <div id="el-partial" style="min-height:48px;border:1px dashed #aaa;border-radius:8px;padding:10px;background:#fcfcff;"></div>
  <h3>Committed transcript</h3>
  <pre id="el-committed" style="white-space:pre-wrap;min-height:160px;border:1px solid #ccc;border-radius:8px;padding:10px;background:#fbfbfb;"></pre>
</div>
<script>
(() => {{
  const CONFIG = {config_json};
  const root = document.getElementById('el-realtime-root');
  const modeEl = root.querySelector('#el-source-mode');
  const inputDeviceEl = root.querySelector('#el-input-device');
  const startBtn = root.querySelector('#el-start');
  const stopBtn = root.querySelector('#el-stop');
  const copyBtn = root.querySelector('#el-copy');
  const downloadBtn = root.querySelector('#el-download');
  const statusEl = root.querySelector('#el-status');
  const diagEl = root.querySelector('#el-diagnostics');
  const partialEl = root.querySelector('#el-partial');
  const committedEl = root.querySelector('#el-committed');

  let ws = null;
  let audioContext = null;
  let processor = null;
  let sourceNodes = [];
  let mediaStreams = [];
  let finalTranscript = '';
  let isRunning = false;

  function setStatus(text) {{ statusEl.textContent = 'Status: ' + text; }}
  function log(text) {{
    const line = '[' + new Date().toLocaleTimeString() + '] ' + text;
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
      ws.onopen = () => {{ setStatus('websocket_open'); log('WebSocket opened; using ' + CONFIG.modelId + ' / ' + CONFIG.audioFormat); }};
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
        ws.send(JSON.stringify({{input_audio_chunk: payload}}));
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
  populateInputDevices().catch(() => log('Input device list is unavailable before browser permission. Default input can still be used.'));
  setStatus('ready');
  log('Ready. Manual Colab/browser/provider runtime validation is still required before claiming E2E success.');
}})();
</script>
"""


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
    display(HTML(build_realtime_colab_html(token)))


if __name__ == "__main__":
    launch_realtime_colab()

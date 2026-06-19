# Realtime Colab prototype (LIVE-COLAB-01)

`LIVE-COLAB-01` — experimental realtime transcription contour for Colab runtime validation. It is separate from the current batch Google Colab workflow and is not a replacement for `elevenlabs_api.py` or `notebooks/elevenlabs_api_colab.ipynb`. The stable/fallback channel remains the batch Colab workflow.

## Current status

- `LIVE-COLAB-01` is present in `main`, but output-cell UI execution is blocked in the tested Colab runtime.
- Tested output-cell attempts that did not attach active JavaScript: inline `<script>` inside `display(HTML(...))`, separate `IPython.display.Javascript(...)`, and sandboxed `iframe srcdoc`.
- `LIVE-COLAB-PROXY-01` is the experimental bridge where Colab acts as a Python launcher/local HTTP server and opens a separate realtime browser page through a Colab proxy/new tab.
- The contour is experimental.
- Static CI checks cover notebook hygiene, helper behavior, generated `/realtime.js` syntax, and safety guardrails.
- One manual Colab/browser run has confirmed the display+microphone path only: page boot, WebSocket open, ElevenLabs `session_started`, partial transcript, committed transcript, user Stop, media-track release and WebSocket close.
- Microphone-only, display-only, virtual-input/loopback, device refresh behavior and all-browser coverage remain pending; do not claim full realtime E2E validation.


## LIVE-COLAB-PROXY-01 standalone proxy bridge

`LIVE-COLAB-PROXY-01` avoids active JavaScript inside notebook output cells. The notebook still stays thin: it downloads `elevenlabs_realtime.py`, Python reads `ELEVEN_API_KEY` first and `ELEVENLABS_API_KEY` only as a compatibility alias, creates one ElevenLabs `realtime_scribe` one-time realtime token, starts a lightweight localhost HTTP server in the Colab runtime, and displays a link labeled `Открыть realtime-страницу в новой вкладке`.

The standalone page is served from the Colab runtime and should be opened through the Colab proxy URL when `google.colab.kernel.proxyPort(port)` is available. If the proxy helper is unavailable, the launcher shows a Russian fallback instruction instead of claiming success. The browser page runs as a normal document in a separate tab/window and requests microphone/display permissions there.

Portability rule: the frontend builder is intentionally separable from the Colab launcher/proxy. A future PWA should be able to reuse the realtime browser logic and replace only the token source, hosting URL, and deployment shell. The proxy bridge does **not** make the existing batch Colab workflow depend on realtime code, and it does **not** make Colab depend on future PWA/backend code.

Bridge safety warnings shown by the launcher:

- experimental bridge only;
- no Google Docs save;
- no manifest reads/writes and no manifest schema change;
- no speaker-project integration;
- browser receives only a one-time realtime token, never the main API key;
- do not claim realtime E2E success until manual runtime validation passes.

## What this prototype validates

This runtime contour is intended to validate:

- ElevenLabs one-time realtime token flow;
- browser microphone capture;
- browser tab/screen audio capture when browser/Colab returns an audio track;
- browser tab/screen audio + microphone mixing;
- virtual input device path for desktop-app/system audio routed through the OS;
- partial transcript display;
- committed transcript display as browser-only `realtime_live_transcript_v1` structured DOM segments;
- Stop/release behavior for WebSocket and медиадорожки.

## What this prototype does not do yet

`LIVE-COLAB-01` intentionally does **not** include:

- Google Docs save;
- manifest integration or manifest schema changes;
- speaker-project integration;
- batch transcription changes;
- PWA, backend or Telegram integration;
- guaranteed system-wide audio capture;
- production-grade `AudioWorklet` implementation.

## Safety model

- The main ElevenLabs API key is read only Python-side from Colab Secrets / `userdata` or the environment. Use `ELEVEN_API_KEY` as the preferred project secret; `ELEVENLABS_API_KEY` is accepted only as a compatibility alias.
- Python creates a single-use realtime Scribe token with `POST https://api.elevenlabs.io/v1/single-use-token/realtime_scribe`.
- Browser JavaScript receives only the temporary one-time realtime token embedded in the realtime WebSocket URL, which uses `commit_strategy=vad` for this MVP.
- The prototype must not log the main API key or the one-time realtime token.
- Transcript text, audio chunks, API keys, provider raw responses and browser audio data must not be stored in `manifest` or analytics.

## Audio source controls

The standalone realtime page now separates capture decisions into two independent controls:

### Аудио вкладки / экрана

- `Выключено` is the default.
- `Вкладка браузера / экран со звуком` uses browser display/tab capture through `getDisplayMedia`.
- The user may need to choose a browser tab and explicitly enable tab audio sharing.
- If no audio track is provided, the UI should show the Russian no-audio-track error.
- Do not assume every window, screen or shared source provides audio.

### Микрофон / аудиовход

- `Выключено` disables microphone/input capture.
- `Устройство по умолчанию` uses browser default `getUserMedia` audio input.
- Browser/OS-provided audio-input device names are shown unchanged when labels are available.
- Hidden labels use generated Russian fallback names such as `Аудиовход 1`.
- Virtual cable, loopback, Stereo Mix, BlackHole, CABLE Output or similar devices are selected here as ordinary audio-input devices; they are not a separate source mode.

### Supported combinations

- Tab/screen audio off + microphone/input off: Start is disabled.
- Tab/screen audio off + microphone/input enabled: captures only the selected microphone/input.
- Tab/screen audio on + microphone/input off: captures only browser tab/screen audio.
- Tab/screen audio on + microphone/input enabled: mixes both streams through the existing Web Audio path and warns that the microphone may recapture tab audio; headphones are recommended.


## Live transcript presentation

The browser page uses `realtime_live_transcript_v1` for live presentation only. This is not Google Docs standardization, does not create Google Docs, and does not read or mutate `manifest`.

- `Предварительный текст` remains temporary partial text.
- Provider VAD (`commit_strategy=vad`) determines when partial text becomes committed; there is no local “seven lines” or line-count threshold.
- Each provider committed event becomes one ordered committed segment rendered with safe text-only DOM insertion. The browser does not rewrite text with AI/LLM logic.
- `Скопировать текст` and `Скачать .txt` use the internal plain-text transcript in the same committed-event order.
- Clearing confirmed text removes only committed browser DOM/state and keeps preliminary text, diagnostics, active capture and WebSocket state untouched.
- Explicit user Stop keeps visible `Статус: Остановлено`; WebSocket close code/reason remains diagnostics-only. Unexpected close can show `Статус: Соединение закрыто`.

## Manual evidence and remaining validation gaps

A real manual Colab/browser run has confirmed one source combination only: standalone page boot, display+microphone capture, WebSocket open, ElevenLabs `session_started`, partial transcript, committed transcript, user Stop, media-track release and WebSocket close. This is partial runtime evidence for display+microphone only and must not be described as full realtime E2E validation.

Still pending: microphone-only, display-only, virtual-input/loopback, device refresh behavior, the refreshed-device UX, structured `realtime_live_transcript_v1` presentation, and all-browser coverage. Do not record transcript content, API keys, tokens, private audio, browser identity or other sensitive runtime data.

## Manual runtime validation checklist

Copy this checklist into the runtime report and mark each item as pass/fail/not tested:

- [ ] Open `notebooks/elevenlabs_realtime_colab.ipynb` from `main`.
- [ ] Confirm the notebook fetches `elevenlabs_realtime.py` from `main` or the selected `GITHUB_REF`.
- [ ] Confirm preferred `ELEVEN_API_KEY` loads from Colab Secrets without printing the value. If the preferred secret is unavailable, confirm `ELEVENLABS_API_KEY` works only as a compatibility alias.
- [ ] Confirm a single-use token is created.
- [ ] Confirm the launcher displays `Открыть realtime-страницу в новой вкладке`.
- [ ] Confirm the link uses a Colab proxy URL when `google.colab.kernel.proxyPort(port)` is available.
- [ ] Confirm the standalone page opens in a new tab and shows `Статус: страница загружена`, then `Статус: Готово` after JavaScript boot.
- [ ] Confirm the realtime UI renders.
- [ ] Confirm microphone/input-only capture starts when only `Микрофон / аудиовход` is enabled.
- [ ] Confirm Start changes status to `Статус: Запуск…`.
- [ ] Confirm WebSocket opens and status changes to `Статус: Соединение установлено`.
- [ ] Confirm ElevenLabs session start events show `Статус: Сессия распознавания запущена` where applicable, with `session_started` preserved in diagnostics.
- [ ] Confirm partial transcript appears.
- [ ] Confirm committed transcript appears as ordered `realtime_live_transcript_v1` segments, with copy/download preserving committed text order.
- [ ] Confirm Stop closes WebSocket and releases media tracks.
- [ ] Confirm display-only capture either works or shows the expected Russian no-audio-track error.
- [ ] Confirm display+input mixed mode starts and mixes, or document the failure.
- [ ] Confirm a virtual/loopback device can be selected under `Микрофон / аудиовход`, if available.
- [ ] Confirm the main API key is not visible in browser JS, notebook output, diagnostics or logs.
- [ ] Confirm no transcript/audio/secrets are written to `manifest` or analytics.

## Troubleshooting

| Symptom | Likely cause | What to check |
| --- | --- | --- |
| Browser `mediaDevices` unavailable | Unsupported/insecure browser context or Colab/browser limitation | Use a supported browser and a normal Colab page; retry after reload. |
| Microphone permission denied | Browser or OS permission blocked | Re-enable microphone permission in browser/OS settings and restart capture. |
| Device labels hidden | Browser hides labels until permission is granted | Grant microphone permission once, then refresh device list. |
| No audio track from display/tab capture | Browser did not provide shared audio | Select a browser tab and enable tab audio sharing if the browser offers it; otherwise record the expected Russian no-audio-track error. |
| WebSocket auth/token error | Missing/invalid API key, token creation failure or token not accepted | Check Colab Secrets and token creation cell without printing secrets/tokens. |
| Token expired or already used | Single-use token was reused or delayed too long | Create a fresh token and start a new session. |
| No committed transcript | VAD/session did not commit speech or provider did not return committed events | Speak clearly, wait for VAD commit, then stop; record whether partial transcript appeared. |
| Echo/double audio in display+mic mode | Microphone hears speaker output in addition to display audio | Use headphones, lower speaker volume or validate sources separately. |
| Desktop app audio not captured | Browser cannot directly capture that app/system output | Route desktop audio through loopback/virtual input and select it as an input device. |
| Stop does not release capture indicator | Media tracks or display capture were not fully stopped | Press Stop again, close browser sharing UI if needed and record browser/OS details. |

## Runtime report template

Do not paste API keys, single-use tokens, raw transcript body or private audio content.

```text
Browser/OS:
Colab runtime:
Source mode:
WebSocket opened: yes/no
Partial transcript: yes/no
Committed transcript: yes/no
Stop released tracks: yes/no
Error shown:
Notes:
```

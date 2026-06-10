# Realtime Colab prototype (LIVE-COLAB-01)

`LIVE-COLAB-01` — experimental realtime transcription contour for Colab runtime validation. It is separate from the current batch Google Colab workflow and is not a replacement for `elevenlabs_api.py` or `notebooks/elevenlabs_api_colab.ipynb`. The stable/fallback channel remains the batch Colab workflow.

## Current status

- `LIVE-COLAB-01` is implemented in `main` after PR #49, but output-cell UI execution is blocked in the tested Colab runtime.
- Tested output-cell attempts that did not attach active JavaScript: inline `<script>` inside `display(HTML(...))`, separate `IPython.display.Javascript(...)`, and sandboxed `iframe srcdoc`.
- `LIVE-COLAB-PROXY-01` is the next experimental bridge: Colab acts as a Python launcher/local HTTP server and opens a standalone browser page through a Colab proxy/new tab.
- The contour is experimental.
- Static CI checks cover notebook hygiene, helper behavior and safety guardrails.
- Manual end-to-end Colab runtime validation is still pending for the proxy standalone page.
- Success must be proven by runtime checks in a real browser/Colab session, not by static tests alone.


## LIVE-COLAB-PROXY-01 standalone proxy bridge

`LIVE-COLAB-PROXY-01` avoids active JavaScript inside notebook output cells. The notebook still stays thin: it downloads `elevenlabs_realtime.py`, Python reads `ELEVEN_API_KEY` first and `ELEVENLABS_API_KEY` only as a compatibility alias, creates one ElevenLabs `realtime_scribe` single-use token, starts a lightweight localhost HTTP server in the Colab runtime, and displays a link labeled `Open realtime frontend in a new tab`.

The standalone page is served from the Colab runtime and should be opened through the Colab proxy URL when `google.colab.kernel.proxyPort(port)` is available. If the proxy helper is unavailable, the launcher shows a Russian fallback instruction instead of claiming success. The browser page runs as a normal document in a separate tab/window and requests microphone/display permissions there.

Portability rule: the frontend builder is intentionally separable from the Colab launcher/proxy. A future PWA should be able to reuse the realtime browser logic and replace only the token source, hosting URL, and deployment shell. The proxy bridge does **not** make the existing batch Colab workflow depend on realtime code, and it does **not** make Colab depend on future PWA/backend code.

Bridge safety warnings shown by the launcher:

- experimental bridge only;
- no Google Docs save;
- no manifest reads/writes and no manifest schema change;
- no speaker projects integration;
- browser receives only a single-use realtime token, never the main API key;
- do not claim realtime E2E success until manual runtime validation passes.

## What this prototype validates

This runtime contour is intended to validate:

- ElevenLabs single-use realtime token flow;
- browser microphone capture;
- browser tab/screen audio capture when browser/Colab returns an audio track;
- browser tab/screen audio + microphone mixing;
- virtual input device path for desktop-app/system audio routed through the OS;
- partial transcript display;
- committed transcript display;
- Stop/release behavior for WebSocket and media tracks.

## What this prototype does not do yet

`LIVE-COLAB-01` intentionally does **not** include:

- Google Docs save;
- manifest integration or manifest schema changes;
- speaker projects integration;
- batch transcription changes;
- PWA, backend or Telegram integration;
- guaranteed system-wide audio capture;
- production-grade `AudioWorklet` implementation.

## Safety model

- The main ElevenLabs API key is read only Python-side from Colab Secrets / `userdata` or the environment. Use `ELEVEN_API_KEY` as the preferred project secret; `ELEVENLABS_API_KEY` is accepted only as a compatibility alias.
- Python creates a single-use realtime Scribe token with `POST https://api.elevenlabs.io/v1/single-use-token/realtime_scribe`.
- Browser JavaScript receives only the temporary single-use token embedded in the realtime WebSocket URL, which uses `commit_strategy=vad` for this MVP.
- The prototype must not log the main API key or the single-use token.
- Transcript text, audio chunks, API keys, provider raw responses and browser audio data must not be stored in `manifest` or analytics.

## Audio source modes

### Microphone

- Uses browser microphone/input-device capture through `getUserMedia`.
- This is the best first validation path because it has the fewest moving parts.
- It may capture only the local user and may not capture remote speakers played through headphones.

### Browser tab / screen audio

- Uses browser display/tab capture through `getDisplayMedia`.
- Requires browser support and browser-specific permission UI.
- The user may need to choose a browser tab and explicitly enable tab audio sharing.
- If no audio track is provided, the UI should show the Russian no-audio-track error.
- Do not assume every window, screen or shared source provides audio.

### Browser tab / screen audio + microphone

- Captures display/tab audio and microphone audio, then mixes them into one stream in the browser.
- Useful for meetings where remote speakers are in a browser tab and the local user speaks through a microphone.
- Watch for echo/double audio when the microphone also hears speakers from the same tab or device output.

### Virtual input / system audio device

- For desktop apps, browser capture may not directly access app/system audio.
- The expected path is OS-level audio routing, loopback or a virtual audio device.
- The browser sees that routed source as an input device, similar to a microphone.
- This is the expected validation path for desktop Zoom/Teams/Telegram/WhatsApp-like apps.
- Browser-based capture must not be described as reliable system-wide desktop audio capture.

## Manual runtime validation checklist

Copy this checklist into the runtime report and mark each item as pass/fail/not tested:

- [ ] Open `notebooks/elevenlabs_realtime_colab.ipynb` from `main`.
- [ ] Confirm the notebook fetches `elevenlabs_realtime.py` from `main` or the selected `GITHUB_REF`.
- [ ] Confirm preferred `ELEVEN_API_KEY` loads from Colab Secrets without printing the value. If the preferred secret is unavailable, confirm `ELEVENLABS_API_KEY` works only as a compatibility alias.
- [ ] Confirm a single-use token is created.
- [ ] Confirm the launcher displays `Open realtime frontend in a new tab`.
- [ ] Confirm the link uses a Colab proxy URL when `google.colab.kernel.proxyPort(port)` is available.
- [ ] Confirm the standalone page opens in a new tab and shows `Статус: page loaded`, then `Статус: idle` after JavaScript boot.
- [ ] Confirm the realtime UI renders.
- [ ] Confirm microphone mode starts.
- [ ] Confirm Start changes status to `starting`.
- [ ] Confirm WebSocket opens and status changes to `websocket_open`.
- [ ] Confirm ElevenLabs session start events show `session_started` where applicable.
- [ ] Confirm partial transcript appears.
- [ ] Confirm committed transcript appears.
- [ ] Confirm Stop closes WebSocket and releases media tracks.
- [ ] Confirm tab/screen audio mode either works or shows the expected Russian no-audio-track error.
- [ ] Confirm display+mic mode starts and mixes, or document the failure.
- [ ] Confirm virtual input mode can see the virtual/loopback device, if available.
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

# Realtime Colab operator guide

## 1. Статус

Realtime Colab/proxy contour — experimental validation path for live browser audio capture + ElevenLabs realtime STT. Он отдельный от stable batch Colab workflow and does not replace `elevenlabs_api.py` or `notebooks/elevenlabs_api_colab.ipynb`.

Output-cell UI path is blocked in the tested Colab runtime: active JavaScript did not attach for inline `display(HTML(...))`, separate `IPython.display.Javascript(...)`, or sandboxed `iframe srcdoc`. Active validation path is the standalone page through Colab proxy/new tab.

## 2. Confirmed evidence

Current confirmed manual evidence is limited to partial standalone-page paths:

- standalone page boot;
- display+microphone capture;
- WebSocket open;
- ElevenLabs `session_started`;
- partial transcript;
- committed transcript;
- user Stop;
- media-track release;
- WebSocket close;
- after RT-TOKEN-01, sequential Start → Stop → Start in the same standalone page without reload: the first session reached WebSocket open and `session_started`, Stop released media resources and requested WebSocket close, the second Start reached WebSocket open and `session_started` again, the second session stopped cleanly, and the final close was user-initiated with code 1000;
- ordinary browser capture permission cancellation/denial before WebSocket creation returned the existing safe retry diagnostic, created no WebSocket for that attempt, and left the UI usable for retry.

This is partial runtime evidence only. Do not claim full realtime E2E success.

## 3. Remaining manual validation gaps

Still pending:

- microphone-only capture;
- display-only capture and no-audio-track behavior;
- loopback/virtual input route;
- explicit Stop while a browser permission prompt remains open (implemented/static-tested, pending manual runtime validation unless separately proven);
- refreshed-device UX;
- structured live presentation verification for `realtime_live_transcript_v1` copy/download/clear behavior;
- cross-browser validation;
- runtime confirmation that main API key, one-time token, transcript content, private audio and raw provider payloads are not exposed in logs/output. Ordinary browser denial/cancel before WebSocket creation has partial manual evidence only and does not prove Stop-during-prompt behavior.

## 4. Current source-control model

The standalone page has independent source controls:

- `Аудио вкладки / экрана` — off by default; uses browser `getDisplayMedia` when enabled. Browser may require selecting a tab and enabling tab audio sharing. Some shared sources provide no audio track.
- `Микрофон / аудиовход` — off by default; uses browser `getUserMedia` for default or selected input. Browser/OS device labels remain unchanged when available; hidden labels use Russian fallback names.

Supported combinations:

- both off — Start disabled;
- microphone/input only;
- tab/screen audio only;
- tab/screen audio + microphone/input mixed through Web Audio, with echo/double-audio risk.

Virtual cable, loopback, Stereo Mix, BlackHole, CABLE Output or similar routes are selected as ordinary audio-input devices under `Микрофон / аудиовход` when the OS/browser exposes them.

## 5. VAD and live transcript behavior

The realtime WebSocket uses `scribe_v2_realtime`, `pcm_16000` and `commit_strategy=vad`. Provider VAD controls partial-to-committed transitions; there is no local line-count or “seven lines” threshold.

`realtime_live_transcript_v1` is browser-only live presentation:

- preliminary text remains temporary;
- each committed provider event becomes one ordered committed segment;
- DOM insertion must be text-safe;
- `Скопировать текст` and `Скачать .txt` use committed text order;
- clearing confirmed text affects only browser committed state, not Google Docs, `manifest`, preliminary text, diagnostics, audio capture or WebSocket state.

## 6. Safety boundaries

- Python reads `ELEVEN_API_KEY` first and `ELEVENLABS_API_KEY` only as a compatibility alias.
- Python creates a single-use token with `POST https://api.elevenlabs.io/v1/single-use-token/realtime_scribe`.
- Browser receives only the generated realtime WebSocket URL/token, never the main API key.
- Realtime has no Google Docs save, no `manifest` reads/writes/schema changes, no analytics mutation for batch workflow and no speaker project integration.
- Do not record transcript content, API keys, one-time tokens, browser identity, private audio, or raw provider payloads in reports.

## 7. Intended permission-cancellation lifecycle

If the user presses `Остановить` while display, microphone or mixed-source permission prompts are still open, the visible final status should remain `Статус: Остановлено`, source controls should become usable again, and any stream returned after that stale attempt should be stopped immediately. Stale attempts must not open a late WebSocket or update/clean up a newer attempt.

If the browser prompt itself is cancelled or denied before WebSocket creation, the UI should return to a safe retry state, temporary preliminary text should clear, diagnostics should explain in Russian that capture permission was cancelled or denied, and the page should not show `Статус: Соединение закрыто` for a WebSocket that never existed. This ordinary browser deny/cancel path now has limited manual evidence for safe retry without WebSocket creation; explicit Stop while a prompt remains open is still pending.

## 8. Manual runtime checklist

Copy this checklist into a runtime report and mark pass/fail/not tested:

- [ ] Open `notebooks/elevenlabs_realtime_colab.ipynb` from `main` or selected commit SHA.
- [ ] Confirm notebook fetches `elevenlabs_realtime.py` from the selected `GITHUB_REF`.
- [ ] Confirm `ELEVEN_API_KEY` loads without printing value; if absent, confirm `ELEVENLABS_API_KEY` works only as compatibility alias.
- [ ] Confirm a single-use token is created without exposing token value.
- [ ] Confirm launcher displays `Открыть realtime-страницу в новой вкладке`.
- [ ] Confirm link uses Colab proxy URL when `google.colab.kernel.proxyPort(port)` is available, or shows the Russian fallback instruction.
- [ ] Confirm standalone page opens in a new tab and reaches ready state.
- [ ] Confirm microphone/input-only capture starts and stops cleanly.
- [ ] Confirm display-only capture works or shows the expected Russian no-audio-track error.
- [ ] Confirm display+input mixed mode starts and documents echo/double-audio behavior.
- [ ] Confirm loopback/virtual input can be selected if available.
- [ ] Confirm permission cancellation returns UI to `Статус: Остановлено` after explicit Stop, or safe ready state after browser denial/cancel, and releases any acquired stale tracks without opening a late WebSocket.
- [ ] Confirm WebSocket opens and `session_started` appears in diagnostics when provider sends it.
- [ ] Confirm partial transcript appears.
- [ ] Confirm committed transcript appears as ordered `realtime_live_transcript_v1` segments.
- [ ] Confirm copy/download preserve committed text order without saving to Google Docs.
- [ ] Confirm Stop closes WebSocket and releases media tracks.
- [ ] Confirm no Google Docs, `manifest` or speaker project mutation occurs.
- [ ] Confirm main API key and one-time token are not visible in browser JS, notebook output, diagnostics or logs.

## 9. Troubleshooting

| Symptom | Likely cause | What to check |
| --- | --- | --- |
| Browser `mediaDevices` unavailable | Unsupported/insecure browser context or Colab/browser limitation | Use a supported browser and normal Colab page; retry after reload. |
| Microphone permission denied | Browser or OS permission blocked | Re-enable microphone permission in browser/OS settings and restart capture. |
| Permission prompt cancelled | User/browser cancelled before capture completed | Confirm UI returns to ready/error state, no stale Start state remains, and any acquired tracks are released. |
| Device labels hidden | Browser hides labels until permission is granted | Grant microphone permission once, then refresh device list. |
| No audio track from display/tab capture | Browser did not provide shared audio | Select a browser tab and enable tab audio sharing if offered; otherwise record expected Russian no-audio-track error. |
| WebSocket auth/token error | Missing/invalid API key, token creation failure or token not accepted | Check Colab Secrets and token creation cell without printing secrets/tokens. |
| Token expired or reused | Single-use token was delayed too long or reused | Create a fresh token and start a new session. |
| No committed transcript | VAD/session did not commit speech or provider did not return committed events | Speak clearly, wait for VAD commit, then stop; record whether partial transcript appeared. |
| Echo/double audio | Microphone hears speaker output in addition to display audio | Use headphones, lower speaker volume or validate sources separately. |
| Desktop app audio not captured | Browser cannot directly capture that app/system output | Route desktop audio through loopback/virtual input and select it as an input device. |
| Stop does not release capture indicator | Tracks or display capture were not fully stopped | Press Stop again, close browser sharing UI if needed and record browser/OS details without private data. |

## 10. Runtime report template

Do not paste API keys, one-time tokens, raw transcript body, private audio content, browser identity or raw provider payloads.

```text
Date:
Colab runtime:
Source combination:
WebSocket opened: yes/no/not tested
session_started observed: yes/no/not tested
Partial transcript: yes/no/not tested
Committed transcript: yes/no/not tested
Stop released tracks: yes/no/not tested
Google Docs/manifest mutation observed: no/yes/not checked
Error shown:
Notes:
```

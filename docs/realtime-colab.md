# Realtime Colab prototype (LIVE-COLAB-01)

`LIVE-COLAB-01` is an experimental realtime transcription contour for Colab runtime validation. It is separate from the current batch Google Colab workflow and is not a replacement for `elevenlabs_api.py` or `notebooks/elevenlabs_api_colab.ipynb`.

## Scope

The prototype adds:

- `elevenlabs_realtime.py` — standalone lightweight Colab runtime;
- `notebooks/elevenlabs_realtime_colab.ipynb` — thin GitHub launcher;
- browser audio capture modes for microphone, display/tab audio, display/tab audio + microphone mixing, and virtual input devices;
- ElevenLabs realtime WebSocket STT with `scribe_v2_realtime`;
- separate partial and committed transcript display;
- copy/download convenience for the in-browser committed transcript buffer.

This first contour intentionally does **not** save to Google Docs, does **not** read or write `manifest`, and does **not** integrate speaker projects.

## Safety model

- The main `ELEVENLABS_API_KEY` is read only Python-side from Colab Secrets / `userdata` or the environment.
- Python creates a single-use realtime Scribe token with `POST https://api.elevenlabs.io/v1/single-use-token/realtime_scribe`.
- Browser JavaScript receives only the temporary single-use token embedded in the realtime WebSocket URL.
- The prototype must not log the main API key or the single-use token.
- Transcript text, audio chunks, API keys, provider raw responses and browser audio data must not be stored in `manifest` or analytics.

## Audio capture modes and constraints

1. **Microphone** — uses `navigator.mediaDevices.getUserMedia({ audio: true })` and browser permission prompts.
2. **Browser tab / screen audio** — uses `navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })`. Browser support varies; if no audio track is returned, the UI shows the Russian error required by the delivery scope.
3. **Browser tab / screen audio + microphone** — captures display audio and microphone audio, mixes them with Web Audio API, and warns about echo/double audio.
4. **Virtual input / system audio device** — treated as a microphone/input-device route. Desktop app audio usually requires OS-level routing, virtual audio device, loopback or similar setup. Browser capture does not guarantee direct system-wide desktop audio access.

The MVP uses browser-side PCM conversion to 16kHz mono and sends `input_audio_chunk` messages with base64 PCM audio. If a deprecated browser API is used for prototype simplicity, it is documented as prototype-only and should be replaced with AudioWorklet in a future PWA/backend-grade implementation.

## Manual runtime validation still required

Local tests and CI only verify static/pure behavior. Live/browser/provider behavior requires manual Colab runtime validation before any E2E success claim:

- token creation works with Colab Secrets;
- microphone mode starts and streams audio;
- display audio mode either receives an audio track or shows the clear Russian no-audio-track error;
- display + microphone mode mixes both sources;
- WebSocket opens and reports `session_started`;
- partial transcript appears;
- committed transcript appears;
- Stop closes WebSocket and releases all tracks;
- no API key is exposed in browser JavaScript;
- no Google Docs, Drive or `manifest` mutation occurs.

# Architecture baseline

## 1. Назначение

Этот документ описывает observed architecture текущего repository state перед будущим runtime refactor. Он основан на текущих docs и коде `elevenlabs_api.py` / `elevenlabs_realtime.py` и не объявляет unimplemented design как существующий факт.

## 2. Component map

### Stable batch Colab workflow

- `notebooks/elevenlabs_api_colab.ipynb` — thin Colab launcher. Он выбирает `GITHUB_REF`, устанавливает Colab dependencies, загружает `elevenlabs_api.py` и запускает batch workflow в текущем Colab runtime.
- `elevenlabs_api.py` — canonical batch runtime: UI/helpers для source selection, provider transcription paths, Google Drive/Docs integration, `manifest`, analytics, docs-only tools и speaker project helpers.
- Google Drive boundary — source files, output folders, workspace folders и JSON artifacts находятся в user Drive authority.
- Google Docs boundary — batch runtime создаёт или обновляет Google Docs transcript через Google APIs. Docs-only workflows работают с существующими Docs.
- `manifest` boundary — `VoiceOps Workspace/manifest/elevenlabs_transcription_manifest.json` хранит processing metadata and source/document links, но не transcript body или Google Docs body content.
- Analytics boundary — `VoiceOps Workspace/analytics/elevenlabs_transcription_runs.jsonl` хранит operational metadata/timing/statuses без secrets, transcript body, Docs body content или raw provider body.

### Experimental realtime Colab/proxy contour

- `notebooks/elevenlabs_realtime_colab.ipynb` — thin launcher for realtime validation contour.
- `elevenlabs_realtime.py` — Python realtime runtime: reads ElevenLabs key, creates one-time realtime token, builds WebSocket URL, serves standalone frontend through a local HTTP server and renders Colab proxy/new-tab launch HTML.
- Colab proxy/new-tab bridge — Colab hosts a local HTTP server; `google.colab.kernel.proxyPort(port)` provides browser-accessible URL when available.
- Browser realtime frontend — standalone HTML/JS document requesting microphone/display permissions, capturing/mixing browser audio, opening ElevenLabs WebSocket, rendering partial and committed text.
- ElevenLabs token/WebSocket boundary — Python calls `POST /v1/single-use-token/realtime_scribe`; browser connects to ElevenLabs realtime STT WebSocket using the one-time token with `scribe_v2_realtime`, `pcm_16000`, `commit_strategy=vad`.

## 3. Authority and data-flow boundaries

### Batch transcription flow

1. User launches `notebooks/elevenlabs_api_colab.ipynb`.
2. Launcher imports current `elevenlabs_api.py` from selected ref.
3. User selects provider path, source mode and output folder.
4. Runtime checks secrets without printing values.
5. Runtime reads source metadata/content from local upload or Google Drive.
6. Runtime calls selected provider path for transcription.
7. Runtime creates Google Docs transcript in the selected output folder.
8. Runtime updates `manifest` source/document state and writes analytics/timing metadata.

Authority boundaries: provider APIs own transcription responses; Google Drive/Docs own persisted user artifacts; `manifest` owns processing state only; analytics owns operational diagnostics only.

### Docs-only maintenance flow

Docs-only workflows operate on existing Google Docs and/or `manifest` records. They may read Docs text to inspect/standardize, but they must not call provider/STT/LLM APIs and must not persist Docs body content into `manifest` or analytics.

### Realtime flow

1. User launches realtime notebook.
2. Python reads `ELEVEN_API_KEY` or compatibility `ELEVENLABS_API_KEY` without printing the value.
3. Python creates one-time ElevenLabs realtime token.
4. Python starts a local HTTP server and exposes a standalone page through Colab proxy/new tab.
5. Browser page requests microphone and/or display capture permissions.
6. Browser captures/mixes audio, opens WebSocket, sends `input_audio_chunk` messages, receives provider events.
7. Browser renders partial text and ordered committed `realtime_live_transcript_v1` segments.
8. User Stop closes WebSocket and releases media tracks.

Realtime authority boundaries: Python owns main API key and token creation; browser owns media capture and live presentation; ElevenLabs owns realtime STT events; no Google Docs/Drive/manifest authority is used by realtime.

## 4. Batch versus realtime separation

Batch is the stable/fallback product workflow and the only current path that creates Google Docs transcripts and mutates `manifest`. Realtime is an experimental validation contour for live browser capture and provider WebSocket behavior. Realtime output is browser-only and must not be described as batch transcript output.

## 5. Docs-only versus runtime behavior

Documentation maintenance can update repository docs and validation status, but it must not imply runtime behavior changed. Docs-only Google Docs maintenance in `elevenlabs_api.py` is runtime functionality, but its product boundary is no provider/STT/LLM calls and no new transcription registration unless tied to real transcription state.

## 6. Safety boundaries

- Main API keys stay Python-side or Colab-secret-side; browser receives only one-time realtime token for realtime.
- Secrets, one-time tokens, raw provider responses, transcript body, Google Docs body content and private audio must not be logged or stored in `manifest`/analytics.
- `manifest` conflict handling defaults to safe skip / `Пропустить`.
- Realtime has no Google Docs save, no `manifest` mutation and no speaker project integration.
- Speaker projects are manual label rename helpers, not biometric identification.
- CI/static validation does not prove live Colab/Drive/Docs/browser/provider success.

## 7. Current refactor seams for future implementation work

These are recommendations for future RT-REF-01-style implementation, not claims about current module boundaries:

- **Token/proxy server layer** — isolate one-time token creation, local HTTP server lifecycle and Colab proxy URL rendering from frontend construction.
- **Frontend document shell** — separate static HTML/CSS shell from runtime JavaScript state and provider config injection.
- **Frontend session state/lifecycle** — make Start/Stop/WebSocket/media-track lifecycle explicit, including cancellation protection while browser permission prompts are open.
- **Browser capture/mixing** — isolate microphone/display/virtual-input capture and Web Audio mixing from WebSocket send logic.
- **Live transcript presentation** — isolate partial text, committed `realtime_live_transcript_v1` segments, copy/download and clear-confirmed-text behavior.

Future refactors must preserve existing token/proxy/WebSocket behavior, browser-only transcript rendering, no Google Docs/manifest side effects, and conservative validation requirements.

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
- Browser realtime frontend — standalone HTML/JS document with internal boundaries for document shell, attempt-scoped session lifecycle, microphone/display capture and mixing, WebSocket send/receive lifecycle, and live transcript presentation.
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
5. Browser page requests microphone and/or display capture permissions under an attempt-scoped lifecycle guard.
6. Browser captures/mixes audio, verifies the attempt is still current after async boundaries, opens WebSocket only for the current attempt, sends `input_audio_chunk` messages, receives provider events.
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

Current realtime frontend boundaries in `elevenlabs_realtime.py`:

- **Token/proxy server layer** — isolate one-time token creation, local HTTP server lifecycle and Colab proxy URL rendering from frontend construction.
- **Frontend document shell** — separate static HTML/CSS shell from runtime JavaScript state and provider config injection.
- **Frontend session state/lifecycle** — Start/Stop/WebSocket/media-track lifecycle uses a monotonically increasing attempt context so stale permission/capture work stops its own streams and cannot update newer attempts.
- **Browser capture/mixing** — isolate microphone/display/virtual-input capture and Web Audio mixing from WebSocket send logic.
- **Live transcript presentation** — isolate partial text, committed `realtime_live_transcript_v1` segments, copy/download and clear-confirmed-text behavior.

Future refactors must preserve existing token/proxy/WebSocket behavior, browser-only transcript rendering, no Google Docs/manifest side effects, and conservative validation requirements. Permission-cancellation safety is statically covered but still requires manual browser validation.

## 8. Current Studio PWA frontend/deploy boundary

`apps/studio/` is the PWA frontend-only workspace. It contains a React + TypeScript + Vite app shell, PWA manifest, service worker, static nginx container config and frontend tests. Current functionality is static/client-side: Russian-first navigation, prototype projects/jobs, browser-only file metadata display, settings with public app URL, and local validation of visual multi-document segments.

`deploy/studio/` contains the production Compose file, environment schema and host nginx vhost template. The only current service is `studio-web`, a stateless web container served behind host nginx through `127.0.0.1:8181`. Host nginx and TLS remain manually managed by the VPS operator; the repository template for host nginx is not applied by repository code.

The current repository runtime and deployed Studio runtime do not contain a Studio backend API, authentication/session system, provider credential store, Google OAuth/Drive/Docs integration, server upload path, persistent user/project/job/output store, database, Redis, queue, worker, stateful migration, or production transcription job pipeline.

## 9. Planned, not implemented: Studio platform boundaries

The following boundaries describe intended future architecture only. They are not implemented in repository runtime or deployed Studio runtime, and they do not approve a backend framework, database, queue, storage engine, OAuth client, or deployment topology. Supporting preparation detail lives in `docs/studio-platform-01-prep.md`.

```text
Current implemented runtime
  Browser/PWA frontend (`apps/studio`)
    -> static `studio-web` container
    -> host nginx + Certbot operated outside repository automation

Planned first stateful platform core (unimplemented)
  Browser/PWA frontend
    -> Backend API (unimplemented)
       -> server-side auth/session boundary (unimplemented)
       -> user/account state (unimplemented)
       -> encrypted BYOK provider credential store (unimplemented)
       -> audit/security events (unimplemented)

Later processing pipeline (unimplemented, separate approval)
  Backend API
    -> upload/media storage boundary (unimplemented)
    -> job records and queue/worker boundary (unimplemented)
    -> provider execution boundary using credential identity/version (unimplemented)
    -> output metadata/artifact boundary (unimplemented)

Later Google Drive/Docs integration (unimplemented, separate approval)
  Backend API
    -> optional Google sign-in (unimplemented)
    -> explicit Drive consent + encrypted refresh-token boundary (unimplemented)
    -> Drive/Docs output integration (unimplemented)
```

- **Current Browser/PWA frontend boundary** — user-facing Studio shell, installable PWA behavior, prototype project/job UI, browser-only file metadata display, settings and segment planning views.
- **First stateful platform core, unimplemented** — future backend API, local password auth, server-side sessions, account state, encrypted BYOK credential lifecycle, and audit/security events.
- **Later processing pipeline, unimplemented** — future uploads, temporary media lifecycle, job creation/cancel/retry/status, queue/worker execution, provider calls, output metadata/artifacts, and processing observability.
- **Later Google Drive/Docs integration, unimplemented** — future optional Google sign-in, explicit Drive consent, encrypted refresh-token lifecycle, Drive connection status, and Docs output.

Future API, OAuth, provider processing, uploads, queues, database, worker and job-pipeline capabilities require separate product scope, runtime architecture, security review, deployment design and validation before implementation.

## PWA-PLATFORM-01 implemented source boundary

The repository now contains `apps/studio-api`, a FastAPI service using SQLAlchemy 2/Alembic with PostgreSQL 17 as the intended deployment database, Redis 7 only as an internal rate-limit store, opaque PostgreSQL-backed browser sessions, login/authenticated CSRF enforcement, audit events, and AES-256-GCM encrypted user-owned BYOK credential versions for ElevenLabs/OpenAI.

The Studio PWA talks to the API through same-origin `/api` and keeps the existing project/task/upload screens as non-processing prototypes. Later uploads, queues/workers, provider calls, Google OAuth/Drive/Docs, job execution, and output processing remain separate unimplemented boundaries.

## 10. Current Colab and Studio contour alignment

Google Colab batch remains the current production workflow for source selection, provider transcription, Google Docs transcript output, and `manifest` progress/skip mutation. Studio PWA is the development/platform contour intended to reach Colab product parity with PWA/platform adaptations. Current Studio jobs are record/preflight/readiness only: worker execution, provider calls, Drive download/export processing, Google Docs output, output persistence, and manifest authority remain future boundaries requiring separate scope and validation.

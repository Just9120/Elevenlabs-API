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

## 7. Studio PWA internal processing prerequisites boundary

The Studio API now has internal-only execution-prerequisite helpers for a job that is already in `processing` under an exact active lease. The boundary resolves and decrypts the current owner-scoped BYOK provider credential inside a context manager, verifies the project-configured Google Drive output folder with the current user's Google connection, and revalidates lifecycle/identity state after decryption and Drive metadata I/O before yielding an ephemeral redacted handle.

This boundary is deliberately not a worker and is not exposed through FastAPI. It performs no provider transcription request, source-byte materialization, Google Docs creation, transcript/output persistence, completion transition, manifest mutation, runtime/deploy behavior, or production processing claim.


## 8. Studio PWA internal ElevenLabs single-source boundary

The Studio API now has an internal-only ElevenLabs transcription boundary for one already-materialized source of an already leased `processing` job. It composes the existing prerequisites and source-materialization contexts, requires the provider to remain `elevenlabs`, performs a fresh DB-only pre-provider revalidation, submits exactly one synchronous `scribe_v2` request, validates the response into an ephemeral redacted transcript handle, and performs a post-provider lifecycle check before transcript access.

This boundary is deliberately not a worker and is not exposed through FastAPI. It performs no OpenAI request, Google Docs creation, transcript/output persistence, completion transition, manifest mutation, runtime/deploy behavior, production processing claim, or automatic retry.


## 9. Studio PWA internal Google Docs single-transcript output boundary

The Studio API now has an internal-only Google Docs output boundary for one active ephemeral ElevenLabs transcript of one source from an already leased `processing` job:

```text
ephemeral ElevenLabs transcript
→ internal Google output authorization
→ one Google Docs artifact
→ ephemeral redacted document reference
→ owner-scoped per-source output record
→ completed only when every non-skipped relation has persisted output
```

The boundary resolves one fresh Google access token, verifies the current project output folder, fences job/source/output identity before and after external I/O, creates exactly one Google Docs transcript through Drive multipart upload/conversion, and yields only a revocable redacted document-reference handle. A follow-on internal persistence boundary stores only safe Google document references and aggregate metadata per job-source relation, never transcript text or Google Docs body content, and transitions the job to `completed` only when all non-skipped relations have output rows under the current lease owner/generation. It is deliberately not a worker and is not exposed through FastAPI. It performs no manifest mutation, retry, cleanup/rollback deletion, runtime/deploy behavior, public output API, or production processing claim.

Source now contains the internal synchronous orchestrator for one already-leased job, an internal one-shot explicit-job runner that acquires and commits a lease before invoking that orchestrator, and an internal single-iteration claim-next runner that uses PostgreSQL `SELECT FOR UPDATE SKIP LOCKED` to select at most one oldest unlocked ready queued job, commit its lease, and invoke the orchestrator once or return idle. These are separate from future worker/runtime invocation, public API behavior, and manifest authority. The internal composition is:

```text
leased processing job
→ deterministic non-skipped relations
→ ephemeral source materialization
→ ephemeral ElevenLabs transcript
→ Google Docs artifact
→ per-source durable output reference
→ commit progress
→ repeat
→ completed when all required outputs exist
```

This diagram shows conceptual processing stages, not a mandate for separate orchestrator calls at each stage. The existing ElevenLabs boundary currently composes execution prerequisites, source materialization, and provider transcription internally, so the internal/server-only orchestrator does not materialize the source separately before invoking that boundary. Source now contains an internal synchronous orchestrator for one already-leased job, internal explicit queued-job and single-iteration claim-next processing boundaries, and a dedicated worker process entrypoint/source-only Compose wiring; public API behavior must not start processing, production worker rollout is not claimed, and the Colab manifest remains outside Studio mutation authority. The source topology now separates the `studio-api` HTTP process from a dedicated `studio-worker` polling process. Both processes use the same application image with different commands: the API serves HTTP, while the worker runs `python -m studio_api.worker`. They share PostgreSQL as the processing authority for discovery, ordering, row locks, leases, lifecycle, output persistence, and completion. Redis remains unrelated rate-limit infrastructure and is not a processing queue, lock service, scheduler, wake-up channel, retry mechanism, or worker heartbeat store. This is source/Compose wiring only and does not add operator deployment steps or production-live evidence.


## 9.1 Studio browser-safe output read path contract

The processing write path and future browser read path are separate:

```text
processing write path
→ Google Docs artifact
→ persisted safe output reference

authenticated browser read path
→ owner-scoped output serializer
→ validated Google web-view URL only
```

`PWA-OUTPUT-02-PREP` approves the read-path contract for a future explicit `GET /api/jobs/{job_id}/outputs` endpoint, but this PREP PR does not implement that endpoint, a serializer, frontend links, polling, Google API calls, output persistence changes, worker changes, runtime changes, deployment, or production-live processing. The future read path must first authorize the job through the same owner-scoped authority as job detail, then serialize only source metadata already visible to that owner plus safe output metadata and a parsed/validated `docs.google.com` or `drive.google.com` HTTPS web-view URL. It must never return transcript text, document body content, Google document ids, output folder ids, lease generation, storage paths, tokens, raw provider/Google responses, or unsafe persisted URLs.

## 10. Current refactor seams for future implementation work

Current realtime frontend boundaries in `elevenlabs_realtime.py`:

- **Token/proxy server layer** — isolate one-time token creation, local HTTP server lifecycle and Colab proxy URL rendering from frontend construction.
- **Frontend document shell** — separate static HTML/CSS shell from runtime JavaScript state and provider config injection.
- **Frontend session state/lifecycle** — Start/Stop/WebSocket/media-track lifecycle uses a monotonically increasing attempt context so stale permission/capture work stops its own streams and cannot update newer attempts.
- **Browser capture/mixing** — isolate microphone/display/virtual-input capture and Web Audio mixing from WebSocket send logic.
- **Live transcript presentation** — isolate partial text, committed `realtime_live_transcript_v1` segments, copy/download and clear-confirmed-text behavior.

Future refactors must preserve existing token/proxy/WebSocket behavior, browser-only transcript rendering, no Google Docs/manifest side effects, and conservative validation requirements. Permission-cancellation safety is statically covered but still requires manual browser validation.

## 11. Current Studio PWA frontend/deploy boundary

`apps/studio/` is the PWA frontend-only workspace. It contains a React + TypeScript + Vite app shell, PWA manifest, service worker, static nginx container config and frontend tests. Current functionality is static/client-side: Russian-first navigation, prototype projects/jobs, browser-only file metadata display, settings with public app URL, and local validation of visual multi-document segments.

`deploy/studio/` contains the production Compose file, environment schema and host nginx vhost template. The only current service is `studio-web`, a stateless web container served behind host nginx through `127.0.0.1:8181`. Host nginx and TLS remain manually managed by the VPS operator; the repository template for host nginx is not applied by repository code.

The current repository runtime and deployed Studio runtime do not contain a Studio backend API, authentication/session system, provider credential store, Google OAuth/Drive/Docs integration, server upload path, persistent user/project/job/output store, database, Redis, queue, worker, stateful migration, or production transcription job pipeline.

## 12. Planned, not implemented: Studio platform boundaries

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

## 13. Current Colab and Studio contour alignment

Google Colab batch remains the current production workflow for source selection, provider transcription, Google Docs transcript output, and `manifest` progress/skip mutation. Studio PWA is the development/platform contour intended to reach Colab product parity with PWA/platform adaptations. Studio jobs have records, preflight/readiness guardrails, and internal processing boundary slices in source form. The API includes internal PostgreSQL claim/lease primitives with opaque owner id, generation fencing, claimed timestamp, and expiration for exclusive execution intent. A later internal lifecycle layer can move a valid leased queued job to `processing`, increment attempts, record processing cancellation requests, safely fail/acknowledge cancellation, and explicitly recover expired processing leases. This is still not a worker or provider runtime. The new internal source-availability boundary verifies database lifecycle state, exact lease owner/generation, ephemeral Google token access, Drive metadata, and private S3/R2 HEAD metadata, then returns only a safe server-side summary with no browser exposure of tokens, raw Google/S3 payloads, object keys, presigned URLs, or source bytes. An internal source-byte materialization boundary now exists after source availability verification: it materializes exactly one selected relation for a leased `processing` job into bounded context-managed temporary storage, streams private S3/R2 objects through server credentials or binary Drive `alt=media`, revalidates lease/cancellation/source identity after copy, and yields only an internal safe handle. Studio source now contains internal boundaries through source materialization, provider execution, Google Docs creation, safe output persistence, fenced completion, an internal synchronous orchestrator for one already-leased job, and an internal claim-next iteration for one unlocked ready queued PostgreSQL job. Worker/runtime invocation, polling, public API processing behavior, manifest authority, and production processing remain separate future boundaries requiring separate scope and validation.

The Colab Drive `manifest` remains the current production authority for batch progress, skip protection, and source-document synchronization. Studio currently has project, source, job, and internal output-reference authority in source form, but no manifest mutation authority and no production processing claim. Any future worker boundary depends on separately approved source-access, output-destination, and manifest/skip authority decisions before Studio can claim Colab processing parity.

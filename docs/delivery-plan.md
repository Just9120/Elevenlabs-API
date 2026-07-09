# Delivery plan: Elevenlabs-API

## Operational dashboard

- ✅ **DOCS-REF-01 — Documentation reconciliation and architecture baseline** — merged/completed docs-only reconciliation; no runtime behavior change.
- ✅ **RT-REF-01 — Refactor realtime frontend boundaries and harden permission-cancellation lifecycle** — merged into main via PR #65; static/generated-JS coverage added; manual permission-cancellation validation remains pending under LIVE-COLAB-PROXY-01.
- ✅ **RT-POLISH-01 — Behavior-preserving realtime frontend lifecycle readability refactor** — merged into main; no new manual/browser evidence claimed.
- ✅ **RT-TOKEN-01 — Fresh realtime single-use token per standalone Start attempt** — done/merged into main; sequential Start → Stop → Start in one standalone page was manually confirmed after RT-TOKEN-01.
- ✅ **OPENAI-BATCH-DURATION-01 — OpenAI batch duration-aware splitting** — manually runtime-confirmed for one long duration-triggered OpenAI batch run that produced a Google Doc; oversized-file and OpenAI diarization runtime validation remain pending.
- ✅ **OPENAI-BATCH-TIMING-01 — Safe OpenAI per-chunk timing observability** — implemented as local diagnostics; manual review remains separate.
- ✅ **USER-SEGMENTS-VISUAL-BUILDER-01 — Visual multi-document segmentation builder** — completed/merged via PR #75; raw manual segment text input replaced with a one-source-only visual builder before provider transcription.
- ✅ **USER-SEGMENTS-HARDENING-01 — Harden visual segment builder validation** — completed follow-up; full-chain add validation, correct-card add errors, and regression coverage added.
- ✅ **PWA-FOUNDATION-01 — Studio PWA foundation and isolated delivery boundary** — completed/merged via PR #77; existing Python CI and Studio PWA CI passed before merge.
- ✅ **PWA-DEPLOY-01 — Manual first Studio deployment** — completed for the existing stateless `studio-web` container at `https://studio.librechat.online`; initial automatic CD was not part of that first manual deployment and only public app-shell availability is validated.
- ✅ **PWA-PLATFORM-01-PREP — Studio platform implementation contract and private-path cleanup** — completed/merged documentation and decision preparation; no runtime implementation.
- ✅ **PWA-PLATFORM-01 — First Studio stateful account/session/BYOK platform core** — implemented in source form; manual production rollout remains operator-scoped.
- ✅ **PWA-PROJECTS-01 — Studio Projects API foundation** — backend persistence/API/migration foundation is live; platform-mode frontend follow-up is implemented in this PR.
- ✅ **PWA-SOURCES-01A — Studio source/storage backend foundation** — backend foundation is live/done: source records, Google Drive source metadata, selected output folder binding, local-upload initiation, S3/R2 presigned upload contract, 1-hour expiry, and cleanup CLI.
- ✅ **PWA-SOURCES-01B — Studio source upload storage runtime config** — done/live: temporary local-upload S3/R2 env and file-mounted secrets have been wired into the production `studio-api` Compose runtime by the operator.
- ✅ **PWA-SOURCES-02 — Studio project source UI** — implemented on main: platform-mode UI binds output Drive folder metadata, lists/deletes source records, adds Google Drive source metadata, and uses direct browser PUT local-upload flow.
- ✅ **PWA-GOOGLE-01A — Studio Google Drive OAuth backend foundation** — backend-only explicit-consent Google Drive connection foundation is merged and manually rolled out. No frontend UI, Drive picker, Drive file listing/access, Google Docs output, provider execution, transcription jobs, queues/workers, or manifest mutation.
- ✅ **PWA-GOOGLE-01B — Studio Google OAuth runtime config** — merged/source-done Compose runtime wiring for Google OAuth env and file-mounted client-secret configuration; production rollout/live enablement is not claimed without operator evidence.
- ✅ **PWA-GOOGLE-02 — Studio Google Drive connection UI** — source-done/merged on main: platform settings status/start/disconnect UI for the existing backend OAuth foundation.
- ✅ **PWA-GOOGLE-03A — Studio Google Drive metadata backend foundation** — source-done/merged on main: authenticated safe metadata lookup for one explicitly supplied Drive file/folder ID through the user's active Google OAuth connection.
- ✅ **PWA-GOOGLE-03B — Studio Drive metadata verification frontend** — source-done/merged on main: platform-mode Sources UI verifies one explicit Drive file/folder ID, previews safe backend metadata, and creates a Google Drive source record from verified metadata.
- ✅ **PWA-GOOGLE-04A — Studio Google Drive folder children backend foundation** — source-done/merged on main: authenticated safe direct-children metadata listing for one explicitly supplied Drive folder ID through the current user's active Google OAuth connection.
- ✅ **PWA-GOOGLE-04B — Studio Google Drive folder children source selection UI** — source-done/merged on main: platform-mode Sources UI lists direct children of one explicitly supplied Drive folder ID through safe backend metadata, supports selecting file-like children, and creates Google Drive source records from selected safe metadata. Explicit non-goals remain: no Drive Picker, no recursive folder browsing, no Drive search, no Google Docs creation, no provider execution, no jobs/queues/workers, no production deployment, and no manifest mutation.
- ✅ **PWA-JOBS-01A — Studio transcription job backend foundation** — source-done/merged on main: job/job-source persistence and authenticated create/list/detail/cancel APIs for jobs from existing project sources only. Explicit non-goals remain: no worker, no provider execution, no queue consumer, no Google Docs creation, no output persistence, no manifest mutation, no frontend UI, no production deployment, and no automatic migration rollout.
- ✅ **PWA-JOBS-01B — Studio transcription job frontend UI** — source-done/merged on main: platform-mode per-project job create/list/detail/cancel UI for queued/cancelled job records from existing uploaded project sources only. Explicit non-goals remain: no worker, no provider execution, no queue consumer, no Google Docs creation, no output persistence, no manifest mutation, no backend schema/API changes unless a frontend-blocking contract bug is found, no production deployment, and no automatic migration rollout.
- ✅ **PWA-JOBS-01C — Studio job BYOK credential selection UI** — source-done/merged on main: optional active BYOK provider credential selection for queued job creation only. It uses safe credential metadata from `GET /api/credentials` and sends only the selected credential identity, or no credential, to the existing job create API. Explicit non-goals remain: no worker, no provider execution, no queue consumer, no Google Docs creation, no output persistence, no manifest mutation, no backend schema/API changes unless a frontend-blocking contract bug is found, no production deployment, and no automatic migration rollout.
- ✅ **PWA-JOBS-01D — Studio job readiness/status UX before worker execution** — source-done/merged on main via PR #103 (merge commit `2c28b3553e820f1d28da51903afae9971dd3f98f`, head `64802d31c46652134790c964b50cb6e2d54e97d7`): record-only job lifecycle/status copy and source/credential/output-folder readiness checklist before worker execution. Explicit non-goals remain: no worker, no provider execution, no queue consumer, no Google Docs creation, no output persistence, no manifest mutation, no backend schema changes or migrations, no production deployment, and no automatic migration rollout.
- ✅ **PWA-JOBS-02-PREP — Studio job processing execution contract** — source-done/merged via PR #104: documented the future worker/provider execution boundary before coding slices implement processing. Production migration rollout remains manual/operator-scoped.
- ✅ **PWA-JOBS-02A — Studio job lifecycle guardrails for existing record-only APIs** — source-done/merged on main via PR #105: added small backend lifecycle guardrails/tests for existing create/list/detail/cancel job record APIs only. Explicit non-goals remain no worker/provider execution, queues, Google Docs output, output persistence, manifest mutation, migrations, CI/CD, Docker/runtime/deploy, production rollout, or secrets.
- 👉 **PWA-JOBS-02B — Studio job processing preflight snapshot for existing record-only jobs** — active/in PR: adds a small internal read-only backend preflight helper and focused tests for conservative existing job/source/output readiness metadata only. Explicit non-goals remain no worker/provider execution, queue consumer, credential decryption/use, Google Drive download/export, source byte access, Google Docs output, output persistence, manifest mutation, job claiming/leases, migrations, CI/CD, Docker/runtime/deploy, production rollout, or secrets handling changes.
- 📋 **RUNTIME-01 — Batch source picker / manifest skip / Google Docs output smoke-check** — deferred by current product priority; still planned manual Colab/Drive/Docs validation without claiming pass/fail.
- 📋 **LIVE-COLAB-PROXY-01 remaining validation** — separate unfinished manual realtime validation gaps after RT-TOKEN-01.
- 📋 **SPEAKER-RUNTIME-01 — Speaker projects workflow on copied diarized Google Doc** — planned manual validation.
- 📋 **PERF-RUNTIME-01 — Startup timing summary collection** — planned runtime diagnostics validation.

## Current checkpoint

Batch Colab remains the stable/fallback product workflow and the only current production path for provider transcription, Google Drive/Docs output, and `manifest` mutation. Docs-only maintenance workflows remain separate and must not call provider/STT/LLM APIs. Realtime Colab/proxy remains an experimental contour for browser capture + ElevenLabs realtime STT and must not save Google Docs, mutate `manifest`, or integrate speaker projects.

`apps/studio/` static mode remains demo-only and does not call `/api`. Platform mode now has Projects/source UI for the already-live projects and sources backends: project list/create/edit/archive, selected output Drive folder metadata, source listing/deletion, Google Drive source metadata creation from verified safe backend metadata, temporary local-upload intake, and Google Drive connection status/start/disconnect UI on account settings. PWA-GOOGLE-04A and PWA-GOOGLE-04B are source-done/merged on main. PWA-JOBS-01A is source-done/merged on main for persisted transcription job/job-source records plus authenticated create/list/detail/cancel APIs for jobs from existing project sources. PWA-JOBS-01B is source-done/merged on main for platform-mode per-project UI to create, list, inspect, and cancel queued/cancelled job records from existing uploaded sources. PWA-JOBS-01C is source-done/merged on main for optional active BYOK provider credential selection for queued job creation only. PWA-JOBS-01D is source-done/merged on main via PR #103 for record-only job lifecycle/status copy and readiness checklist before worker execution. PWA-JOBS-02-PREP is source-done/merged via PR #104. PWA-JOBS-02A is source-done/merged on main via PR #105. The current recommended item is PWA-JOBS-02B, a small backend code+tests slice for an internal read-only processing preflight snapshot over existing record-only Studio jobs. Provider execution, Drive picker, recursive browsing, Drive search, Google Docs output, processing, queues/workers, output persistence, sharing, production deployment, automatic migration rollout, and manifest mutation remain deferred. PWA-GOOGLE-01B is source-done/merged for runtime config wiring, but production rollout/live enablement is not claimed without operator evidence.

Current confirmed realtime evidence is partial: one display+microphone run confirmed standalone page boot, capture, WebSocket open, `session_started`, partial transcript, committed transcript, user Stop, media-track release and WebSocket close. After RT-TOKEN-01, the standalone page also manually confirmed sequential Start → Stop → Start without page reload: both sessions reached WebSocket open and `session_started`, both stopped cleanly, and the final close was user-initiated with code 1000. Full realtime E2E success is not claimed.

## Active recommended next item

The active recommended item is **PWA-JOBS-02B — Studio job processing preflight snapshot for existing record-only jobs**. It is a small backend code+tests slice that adds an internal read-only helper for future server-side processing to inspect conservative existing job/source/output readiness metadata without processing or mutating jobs.

PWA-JOBS-02A is source-done/merged on main via PR #105. PWA-JOBS-02B must preserve the existing public API contract and keep Studio jobs record-only. It may add a pure/internal preflight helper and focused backend tests for queued eligibility, terminal-status blocking, source ownership/deletion/upload/identity readiness, source ordering, credential presence as safe metadata only, and output folder readiness as a non-authorizing signal.

Explicit non-goals: no worker implementation; no queue consumer; no provider API calls; no credential decryption/use at runtime; no Google Drive download/export; no source byte access; no Google Docs output creation; no output persistence; no manifest mutation; no job claiming/lease implementation; no backend schema changes or Alembic migrations; no CI/CD changes; no Docker/Compose/runtime changes; no production deployment; no automatic migration rollout; no secrets, tokens, environment values, or file-mounted secret contents.

### PWA-PLATFORM-01-PREP — Studio platform implementation contract

PWA-PLATFORM-01-PREP is complete as documentation/design preparation. It created `docs/studio-platform-01-prep.md`, preserved the current UI-only Studio and Colab boundaries, and cleaned the private deployment path out of durable product/delivery/validation documents. It did not implement backend/auth/BYOK/Google/uploads/jobs/workers/deployment changes.

### PWA-DEPLOY-01 — Manual first Studio deployment

PWA-DEPLOY-01 is complete for the existing stateless `studio-web` container behind host nginx at `https://studio.librechat.online`. This records public app-shell availability only, not a production transcription platform.

Factual evidence recorded from manual VPS/browser validation:

- isolated operator-managed deployment checkout exists on branch `main`;
- existing stateless `studio-web` container was built and started successfully;
- local container health passed and the container binds only to `127.0.0.1:8181`;
- host nginx proxies `studio.librechat.online` to the local Studio container;
- Let's Encrypt certificate was issued for `studio.librechat.online` and HTTPS works;
- `https://studio.librechat.online/healthz` returned HTTP 200;
- HTTP redirects to HTTPS;
- public homepage exposes `manifest.webmanifest`;
- public `sw.js` is present and precaches the app shell;
- Studio UI opens in a normal desktop browser;
- browser offers PWA installation;
- installed app opens in a separate window;
- after a successful online visit, the app shell appears to reopen offline. Browser/version were not recorded; this is manual user-reported confirmation and must not be described as proof of offline transcription, provider execution, Google integration, authentication, credentials, uploads, or job processing.

Boundaries preserved after deployment:

- current Studio is still UI-only;
- Studio platform CD exists now, but this first manual deployment evidence did not depend on automatic CD;
- no backend API, authentication, provider keys, provider calls, Google OAuth/Drive/Docs, uploads, transcription jobs, database, Redis, queue, worker, persistence, or migrations were added;
- no changes were made to Colab, realtime, provider contracts, Google Docs behavior, or manifest behavior.
- Studio production CD is expected to be a single `Studio Platform CD` workflow at `.github/workflows/studio-platform-cd.yml`; split web/API Studio platform CD workflows are not current state.

### PWA-FOUNDATION-01 — Studio PWA foundation

PWA-FOUNDATION-01 is complete/merged via PR #77. It established `apps/studio/`, PWA-only CI scaffolding, production scaffolding, and the localhost-only `studio-web` delivery boundary for `studio.librechat.online`. Studio CI passed before merge: reproducible `npm ci`, lint, tests, production build, and Docker image build. The completed foundation remains UI-only and did not add provider calls, Google integration, uploads, queues, databases, workers, persistence or changes to Colab runtime behavior.

### RUNTIME-01 — batch runtime smoke validation

RUNTIME-01 is deferred by current product priority, not passed or failed. It remains a separate manual Colab/Drive/Docs batch smoke validation item, including the visual user-segment builder, selected output folder, Google Docs creation, and `manifest` skip behavior. Do not claim runtime success until this is executed in Colab and recorded with factual evidence.

## Near backlog

### PWA-GOOGLE-04B — Studio Google Drive folder children source selection UI

Active frontend/docs item: platform-mode Studio can list direct children of one explicitly supplied Google Drive folder ID through `GET /api/google/drive/folders/{folder_id}/children`, render only safe normalized metadata, mark folder items as non-source-file entries, select file-like child items, and create Google Drive source records through `POST /api/projects/{project_id}/sources/google-drive` using selected safe child metadata. Pagination uses `next_page_token` in component state only and appends additional safe items. Explicit non-goals: no Drive Picker, no recursive folder browsing, no Drive search, no Google Docs creation, no provider execution, no jobs/queues/workers, no migration, no production deployment, and no manifest mutation.

### PWA-GOOGLE-04A — Studio Google Drive folder children backend foundation

Source-done/merged on main: authenticated Studio users can list safe normalized metadata for direct children of one explicitly supplied Google Drive folder ID through `GET /api/google/drive/folders/{folder_id}/children` using the current user's active Google OAuth connection. The endpoint returns only `folder_id`, safe child `items` metadata consistent with the single-file metadata endpoint, and optional `next_page_token`. Explicit non-goals: no Drive Picker, no Drive listing/browsing UI, no recursive folder browsing, no Drive search, no Google Docs creation, no provider execution, no jobs/queues/workers, no migration, no production deployment, and no manifest mutation.

### PWA-GOOGLE-03B — Studio Drive metadata verification frontend

Source-done/merged on main: platform-mode Studio can verify one explicitly supplied Google Drive file/folder ID through `GET /api/google/drive/files/{drive_file_id}/metadata`, preview only safe normalized metadata, and create a Google Drive source record through `POST /api/projects/{project_id}/sources/google-drive` using the verified id, name, MIME type, size, and web view link. Static mode remains demo-only and must make zero `/api` requests. Explicit non-goals: no Drive picker, no Drive listing/browsing UI, no Google Docs creation, no provider execution, no jobs/queues/workers, no migration, no production deployment, and no manifest mutation.

### PWA-GOOGLE-03A — Studio Google Drive metadata backend foundation

Source-done/merged on main: authenticated Studio users can request safe metadata for one explicitly supplied Google Drive file/folder ID via the current user's active Google OAuth connection. The endpoint must not expose refresh tokens, access tokens, raw Google payloads, client secrets, secret file paths, owners, permissions, labels, thumbnails, or sharing details. It has no Drive picker, no Drive listing/browsing UI, no Google Docs creation, no provider execution, no jobs/queues/workers, no migration, no production deployment, and no manifest mutation.

### PWA-GOOGLE-02 — Studio Google Drive connection UI

Source-done/merged: platform-mode account settings can show Google Drive connection loading/connected/disconnected/revoked/unavailable states, start OAuth via `POST /api/google/oauth/start` with CSRF and immediate browser navigation, and disconnect via `DELETE /api/google/connection` with CSRF. The UI may render only safe connection metadata (`connected`, `status`, Google email, scopes, connected/revoked timestamps) and must not store OAuth URLs, states, codes, tokens, provider credentials, or secrets in browser storage. This item has no Drive picker, Drive source browsing, Google Docs creation, provider execution, jobs/queues/workers, migration, production deploy, manifest mutation, or backend OAuth behavior change.

### PWA-GOOGLE-01B — Studio Google OAuth runtime config

Done/source-merged ops/config item: Compose runtime wiring for `STUDIO_GOOGLE_OAUTH_CLIENT_ID`, `STUDIO_GOOGLE_OAUTH_CLIENT_SECRET_FILE`, `STUDIO_GOOGLE_OAUTH_REDIRECT_URI`, `STUDIO_GOOGLE_OAUTH_SCOPES`, and `STUDIO_GOOGLE_OAUTH_STATE_TTL_SECONDS` exists in source. The client secret remains file-based and mounted read-only into `studio-api`; incomplete config must continue to fail closed. Production rollout/live enablement is not claimed without operator evidence. This item does not implement Drive picker, Drive file listing/access, Google Docs output, provider execution, transcription jobs, queues/workers, migrations, production deployment, or manifest mutation.

### PWA-GOOGLE-01A — Studio Google Drive OAuth backend foundation

Done/live backend-only item: authenticated Studio users can establish an explicit-consent Google Drive OAuth connection through backend status/start/callback/disconnect endpoints. Refresh tokens are encrypted at rest with the existing credential master-key pattern and are never returned to the browser. Short-lived OAuth state is stored hashed and cannot be reused after expiry or successful callback. This item does not implement frontend UI, Drive picker, Drive file listing/access, Google Docs output, provider execution, transcription jobs, queues/workers, or manifest mutation.

### PWA-SOURCES-02 — Studio project source UI

Active frontend/docs item: platform-mode Studio can bind a project to selected output Google Drive folder metadata, list/delete project source records, add Google Drive source-file metadata manually, and upload a local audio/video file with the existing backend contract (`initiate` → browser direct PUT to S3/R2 presigned URL → `complete`). Static mode remains demo-only and must make zero `/api` requests. This item has no backend migration, no backend API change unless a frontend-blocking contract bug is found, no provider execution, no Google OAuth/Drive picker, no Google Docs creation, and no queue/worker.

### PWA-SOURCES-01B — Studio source upload storage runtime config

Done/live: the already-implemented temporary source-upload S3/R2 non-secret settings and file-mounted access-key secrets have been wired into the production `studio-api` Compose runtime by the operator. Secret values remain file-based only; no raw S3/R2 credential values are committed or passed through Compose environment variables. UI, Google OAuth/Drive picker, provider transcription execution, queues/workers, and Google Docs creation remain follow-ups.

### PWA-SOURCES-01A — Studio source/storage backend foundation

PWA-SOURCES-01A is live/done as the backend-only foundation for Studio project sources: projects can store the selected output Google Drive folder, and source records support `google_drive` metadata or `local_upload` temporary S3/R2-compatible storage with fail-closed configuration, presigned upload initiation, 1-hour expiry, and cleanup CLI support. Transcription outputs always target the selected Google Drive folder. Local computer sources are temporary inputs only: they use private object storage, are not proxied through FastAPI memory or stored in PostgreSQL/VPS disk, and expire/delete after 1 hour or after processing in later work. Frontend UI, Google OAuth/Drive picker, provider transcription execution, queues/workers, and Google Docs creation remain follow-ups.

### PWA-PROJECTS-01 — Studio Projects API foundation

Backend foundation for persisted Projects is live: id, owner user id, title, optional description, created_at, updated_at, nullable archived_at, and authenticated owner-scoped API endpoints. The platform-mode Projects UI is available against `/api/projects` while static mode remains demo-only. Uploads, transcription jobs, provider calls, queues/workers, Google OAuth/Drive/Docs, output persistence, public registration, invites, password recovery, and project sharing remain deferred beyond PWA-SOURCES-01A. CD workflow behavior is unchanged.

### PWA-PLATFORM-01 — First Studio stateful platform core

Planned first stateful stage: account/session/BYOK foundation with bootstrap-admin or invite-only access, local sessions, encrypted user-owned provider credential lifecycle, and audit/security event boundaries. It is blocked until explicit approval resolves the open decisions listed in `docs/studio-platform-01-prep.md`, including backend framework, database, encryption-key management, backup/restore objective, rate-limit implementation, migration/rollback procedure, stateful deployment design, and whether queue/worker, media storage, and OAuth remain deferred. Provider execution, uploads, Drive/Docs, and workers must remain separate later-stage work unless explicitly approved.

### RUNTIME-01 — batch runtime smoke validation

Validate in real Colab/Drive/Docs:

- launch `notebooks/elevenlabs_api_colab.ipynb` from `main` or selected commit SHA;
- verify relevant Colab Secrets without printing values;
- select source through Drive picker button path;
- create Google Docs transcript in selected output folder;
- verify `manifest` source/document update;
- rerun same source and confirm safe skip / `Пропустить` without repeat provider/STT call;
- record result in `VALIDATION_MATRIX.md` only after factual validation.

### LIVE-COLAB-PROXY-01 remaining validation

Use `docs/realtime-colab.md` as the operator guide. Pending: microphone-only, display-only, loopback/virtual input, explicit Stop-during-prompt cancellation, refreshed-device UX, structured `realtime_live_transcript_v1` copy/download/clear behavior and cross-browser validation. Ordinary browser deny/cancel before WebSocket creation has partial manual evidence only.

### SPEAKER-RUNTIME-01 — speaker project validation

Validate on copied diarized Google Doc only: gate behavior, turn-boundary `Speaker N labels` detection, counts/sample display without persistence, manual mapping, explicit apply, unmapped labels unchanged, and plain-text rewrite/formatting impact.

### PERF-RUNTIME-01 — startup timing collection

Collect timing from clean Colab runtime and confirm summary contains no secrets, transcript body, Docs body content or raw provider responses. Do not treat timing as transcription success.

## Blockers and validation notes

- PWA-DEPLOY-01 public app-shell deployment validation is complete, but it does not validate offline transcription, provider execution, Google integration, authentication, credentials, uploads, jobs, or production processing.
- PWA-PLATFORM-01 remains blocked on explicit approval and unresolved technology/operations decisions listed in `docs/studio-platform-01-prep.md`; backend implementation is not the active immediate item.
- Realtime output-cell UI path is blocked in the tested Colab runtime; active validation path is proxy/new-tab standalone page.
- Realtime evidence is partial and must not be generalized beyond the confirmed display+microphone and sequential same-page Start → Stop → Start paths.
- Batch Google Docs output and manifest skip still need controlled live runtime validation before E2E claims.
- OpenAI duration-triggered chunking has one manually confirmed long-file Google Docs output path; oversized-file and OpenAI diarization validation remain pending.
- OpenAI diarization + chunking remains high risk due to potential inconsistent `Speaker N labels` across chunks.
- Speaker project apply may rewrite Google Doc as plain text; first validation must use copies.

## Docs-only PR validation

For documentation-only PRs, run:

```bash
python scripts/ci_checks.py
pytest -q
git diff --check
```

If runtime code/notebooks/token flow/Google Docs behavior/manifest behavior are untouched, state that explicitly in the PR and final response. Local checks do not replace manual Colab runtime validation.

## PWA-PLATFORM-01 delivery note

- ✅ **PWA-PLATFORM-01 — Studio account/session/BYOK platform core** — implemented in this PR as source, tests, migrations, platform Compose, scripts, and runbooks. It is not yet manually deployed or production-runtime validated.
- 👉 **Next operational action** — operator provisions secrets, starts PostgreSQL/Redis/API, runs explicit pre-migration backup and migration, creates bootstrap admin, rolls out nginx `/api/`, installs the 10-hour backup timer, performs backup/restore rehearsal, and records browser/runtime acceptance evidence.
- 📋 **RUNTIME-01** remains deferred; Colab/provider/Google runtime validation is unchanged by this platform-core PR.

### PWA-PLATFORM-01 hardening follow-up note

The open PR branch now separates static-only and platform-mode Studio builds, keeps PostgreSQL password material file-mounted instead of environment-interpolated, adds authenticated CSRF refresh for page reloads, hardens readiness and trusted-proxy IP handling, and corrects PostgreSQL-only backup retention grouping. Manual deployment/runtime/backup/browser validation remains pending.

### Studio platform isolated CD follow-up note

The current PR replaces the unsafe legacy-only automatic CD contour with isolated platform web/API CD definitions for `deploy/studio/compose.platform.yml`. Automatic deployment remains gated behind `STUDIO_PLATFORM_CD_ENABLED=true`; initial platform web deployment and all migrations, backups/restores, PostgreSQL, Redis, nginx, volume, runtime-secret, and legacy-stack maintenance remain manual/operator-scoped. No production deployment has been executed by coding-agent validation.

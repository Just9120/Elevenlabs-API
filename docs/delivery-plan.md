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
- ✅ **PWA-DEPLOY-01 — Manual first Studio deployment** — completed for the existing stateless `studio-web` container at `https://studio.librechat.online`; CD remains disabled and only public app-shell availability is validated.
- ✅ **PWA-PLATFORM-01-PREP — Studio platform implementation contract and private-path cleanup** — completed/merged documentation and decision preparation; no runtime implementation.
- ⛔ **PWA-PLATFORM-01 — First Studio stateful account/session/BYOK platform core** — planned but blocked until explicit approval resolves backend framework, database, encryption-key management, backup/restore, rate limiting, migration/rollback, deployment design, and whether queue/storage/OAuth remain deferred.
- 📋 **RUNTIME-01 — Batch source picker / manifest skip / Google Docs output smoke-check** — deferred by current product priority; still planned manual Colab/Drive/Docs validation without claiming pass/fail.
- 📋 **LIVE-COLAB-PROXY-01 remaining validation** — separate unfinished manual realtime validation gaps after RT-TOKEN-01.
- 📋 **SPEAKER-RUNTIME-01 — Speaker projects workflow on copied diarized Google Doc** — planned manual validation.
- 📋 **PERF-RUNTIME-01 — Startup timing summary collection** — planned runtime diagnostics validation.

## Current checkpoint

Batch Colab remains the stable/fallback product workflow and the only current production path for provider transcription, Google Drive/Docs output, and `manifest` mutation. Docs-only maintenance workflows remain separate and must not call provider/STT/LLM APIs. Realtime Colab/proxy remains an experimental contour for browser capture + ElevenLabs realtime STT and must not save Google Docs, mutate `manifest`, or integrate speaker projects.

`apps/studio/` is currently an installable, static, client-side PWA foundation only. There is no Studio backend API, authentication, server upload, provider execution, Google integration, persistence, database, Redis, queue, worker, or production transcription job pipeline.

Current confirmed realtime evidence is partial: one display+microphone run confirmed standalone page boot, capture, WebSocket open, `session_started`, partial transcript, committed transcript, user Stop, media-track release and WebSocket close. After RT-TOKEN-01, the standalone page also manually confirmed sequential Start → Stop → Start without page reload: both sessions reached WebSocket open and `session_started`, both stopped cleanly, and the final close was user-initiated with code 1000. Full realtime E2E success is not claimed.

## Active recommended next item

The next action is explicit approval of the first implementation slice and unresolved technology/operations decisions. Backend implementation is not the active immediate item.

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
- CD remains disabled;
- no backend API, authentication, provider keys, provider calls, Google OAuth/Drive/Docs, uploads, transcription jobs, database, Redis, queue, worker, persistence, or migrations were added;
- no changes were made to Colab, realtime, provider contracts, Google Docs behavior, or manifest behavior.

### PWA-FOUNDATION-01 — Studio PWA foundation

PWA-FOUNDATION-01 is complete/merged via PR #77. It established `apps/studio/`, PWA-only CI scaffolding, production scaffolding, and the localhost-only `studio-web` delivery boundary for `studio.librechat.online`. Studio CI passed before merge: reproducible `npm ci`, lint, tests, production build, and Docker image build. The completed foundation remains UI-only and did not add provider calls, Google integration, uploads, queues, databases, workers, persistence or changes to Colab runtime behavior.

### RUNTIME-01 — batch runtime smoke validation

RUNTIME-01 is deferred by current product priority, not passed or failed. It remains a separate manual Colab/Drive/Docs batch smoke validation item, including the visual user-segment builder, selected output folder, Google Docs creation, and `manifest` skip behavior. Do not claim runtime success until this is executed in Colab and recorded with factual evidence.

## Near backlog

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

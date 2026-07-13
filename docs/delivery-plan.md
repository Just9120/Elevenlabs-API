# Delivery plan: Elevenlabs-API

## Operational dashboard

Status vocabulary:

- `source-done/merged` — repository source/docs merged to `main`.
- `CI-verified` — relevant GitHub Actions checks passed.
- `production-live` — runtime/operator evidence exists.
- `manual-ops-required` — cannot be completed by a coding agent alone.
- `deferred` — intentionally outside current PR scope.
- `blocked` — requires decision, access, migration, or runtime work.

Capability/status snapshot:

- Google Colab is the current working production contour for provider transcription, Google Drive/Docs transcript output, and `manifest` progress/skip mutation.
- Studio PWA is the current development contour intended to duplicate Google Colab product scope with PWA/platform adaptations.
- Studio PWA source has many platform foundations merged: account/session/BYOK, projects, sources, Google Drive OAuth/metadata/folder-child selection, local temporary upload intake, persisted job records, job UI, and preflight/claim-readiness guardrails.
- Studio PWA production processing is not claimed: current source has a dedicated `studio-worker` polling process entrypoint and Compose source wiring, plus internal processing/provider/output boundary slices through safe output persistence, fenced completion, a synchronous single-job orchestrator, an internal one-shot explicit-job claim-and-orchestrate boundary, and an internal single-iteration claim-next boundary. This is source wiring only: no deployment, public processing pipeline, production processing pipeline, or manifest mutation is claimed.
- Studio job persistence migration rollout remains manual/operator-scoped unless runtime/operator evidence exists.

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
- ✅ **PWA-PROJECTS-01 — Studio Projects API foundation** — source-done/merged: backend persistence/API/migration foundation and platform-mode frontend integration are present in repository source; production-live status requires operator evidence.
- ✅ **PWA-SOURCES-01A — Studio source/storage backend foundation** — backend foundation is live/done: source records, Google Drive source metadata, selected output folder binding, local-upload initiation, S3/R2 presigned upload contract, 1-hour expiry, and cleanup CLI.
- ✅ **PWA-SOURCES-01B — Studio source upload storage runtime config** — done/live: temporary local-upload S3/R2 env and file-mounted secrets have been wired into the production `studio-api` Compose runtime by the operator.
- ✅ **PWA-SOURCES-02 — Studio project source UI** — implemented on main: platform-mode UI binds output Drive folder metadata, lists/deletes source records, adds Google Drive source metadata, and uses direct browser PUT local-upload flow.
- ✅ **PWA-GOOGLE-01A — Studio Google Drive OAuth backend foundation** — backend-only explicit-consent Google Drive connection foundation is merged and manually rolled out. No frontend UI, Drive picker, Drive file listing/access, Google Docs output, provider execution, transcription jobs, queues/workers, or manifest mutation.
- ✅ **PWA-GOOGLE-01B — Studio Google OAuth runtime config** — merged/source-done Compose runtime wiring for Google OAuth env and file-mounted client-secret configuration; production rollout/live enablement is not claimed without operator evidence.
- ✅ **PWA-GOOGLE-02 — Studio Google Drive connection UI** — source-done/merged on main: platform settings status/start/disconnect UI for the existing backend OAuth foundation.
- ✅ **PWA-GOOGLE-03A/B — Studio Drive metadata backend/frontend foundation** — source-done/merged on main: safe metadata verification for one explicitly supplied Drive file/folder ID and source creation from verified metadata.
- ✅ **PWA-GOOGLE-04A/B — Studio Drive folder children source selection** — source-done/merged on main: direct child listing for one explicitly supplied Drive folder and selected file-like child source creation; no Drive picker, recursive browsing, search, Docs creation, provider execution, workers, production deployment, or manifest mutation.
- ✅ **PWA-JOBS-01A/B/C/D — Studio record-only job foundation and UI** — source-done/merged on main through PR #103: persisted job/job-source records, create/list/detail/cancel UI, optional safe credential identity selection, and readiness/status UX; jobs remain record-only.
- ✅ **PWA-JOBS-02-PREP — Studio job processing execution contract** — source-done/merged via PR #104: documented future worker/provider execution boundary before coding slices implement processing. Production migration rollout remains manual/operator-scoped.
- ✅ **PWA-JOBS-02A — Studio job lifecycle guardrails for existing record-only APIs** — source-done/merged on main via PR #105; no worker/provider execution, queues, Google Docs output, output persistence, manifest mutation, migrations, CI/CD, Docker/runtime/deploy, production rollout, or secrets.
- ✅ **PWA-JOBS-02B — Studio job processing preflight snapshot for existing record-only jobs** — source-done/merged on main via PR #106; no worker/provider execution, queue consumer, credential use, Drive download/export, source byte access, Google Docs output, output persistence, manifest mutation, job claiming/leases, migrations, CI/CD, Docker/runtime/deploy, production rollout, or secrets handling changes.
- ✅ **PWA-JOBS-02C — Studio job claim/lease contract before worker implementation** — source-done/merged on main via PR #107; no actual claiming/leasing or processing implementation.
- ✅ **PWA-JOBS-02D — Studio job claim-readiness plan helper for existing record-only jobs** — source-done/merged on main via PR #108 (`cdbcd8716d216a03ebdb455d6820c96a16875f0a`; head `eab9adf29c29f17c73aafec2d88b4d7f8cb361f7`); CI and Studio PWA CI passed. It added an internal non-mutating claim-readiness helper and DB-free tests; jobs remain record-only and production processing is not claimed.
- ✅ **PWA-SCOPE-ENTRY-01 — Align Google Colab vs Studio PWA scope, entry docs, workflow rules, and delivery state** — source-done/merged on main via PR #109 (head `2c0187f7d548583872f6cbcb4ac83eb8c476a208`, merge `43f94dc62d5d8f58c5d26a105d797e6ac6e06d5f`); CI passed.
- ✅ **PWA-PROCESSING-CONTRACT-01 — Studio output/source/manifest parity contracts before worker implementation** — source-done/merged via PR #110 (head `604ece2072ccd145862f8ec2d5ddcf848711b92e`, merge `9ac842fa2b1598716a7043a75699872cc9fcda9a`); CI passed.
- ✅ **PWA-JOBS-03A — Internal Studio job claim/lease persistence and fencing foundation** — source-done/merged via PR #111 (head `94269517dbc241886561a3d87f92ed209cd12abb`; merge `b265becb6aabdc339771b4556cdae66f0ee19df9`); CI and Studio PWA CI passed. Jobs remain record-only and claimed jobs stay `queued`; no worker/provider/source/output/manifest/runtime/deploy/production/secrets work was introduced.
- ✅ **PWA-JOBS-03B — Studio processing lifecycle, attempts, and cancellation-request foundation** — source-done/merged via PR #112 (head `ceee127c326369391d4fe84b4f3447edadec48cb`, merge `1c9d41db7fb42b7bdd49d50f72962b7ec21cbc3d`); Backend CI and Studio PWA CI passed. It added `processing` lifecycle foundations, `attempt_count`, cancellation request/acknowledgement, lease ownership/generation fencing, safe failure, and expired-processing recovery while preserving no-worker/no-provider/no-byte-access/no-output/no-runtime/no-deploy boundaries. Migrations 0005/0006/0007 remain manual/operator-scoped for production.
- ✅ **PWA-JOBS-03C — Studio processing-time source availability verification foundation** — done/merged via PR #113 (head `d40c477527b74a5f14f385589daeb6a672c86fa3`, merge `54c13df27a009e79de9dde88f09483d4fec719b3`); Backend CI #260 passed and Studio PWA CI #95 passed. It added an internal read-only verification boundary for leased `processing` jobs and still added no worker, provider, source byte materialization, output, runtime, deploy, production, or secrets scope.
- ✅ **PWA-JOBS-03D — Ephemeral single-source byte materialization boundary** — done/merged via PR #114 (head `5a19337c993d6e7472a3a0b5efc3de65ed62e0ee`, merge `7b660875a57a65b866f8970275b47b0495c9cb90`); Backend CI #263 passed and Studio PWA CI #98 passed. It added an internal context-managed source-byte materialization boundary and still added no worker, queue consumer, provider execution, provider credential use, Google Docs output, output persistence, completed transition, manifest mutation, public endpoint, frontend, migration, CI/CD/runtime/deploy change, production rollout, VPS access, or secrets change.
- ✅ **PWA-JOBS-04A — Processing-time credential and output-destination authorization boundary** — done/merged via PR #115 (head `2aa5046e80cf14c416c9abf8ccc4a0f11845e69b`, merge `f60748cfa2e9f4de17b3409a541f87684ee68956`); Backend CI #267 passed and Studio PWA CI #102 passed. It added internal server-only prerequisites for leased `processing` jobs and still added no provider request, source materialization, worker, queue consumer, Google Docs output, transcript persistence, completed transition, manifest mutation, public endpoint, frontend, migration, runtime/deploy/production change, or secrets change.
- ✅ **PWA-JOBS-04B — Internal ElevenLabs single-source transcription boundary** — done/merged via PR #116 (head `51b8b8b4de01130d33c6786029a79840279b6cf1`, merge `e9f875eeea15171fb03a7b52cbd9b745cd705f90`); Backend CI #269 passed and Studio PWA CI #104 passed. It added the internal ElevenLabs single-source execution boundary and still added no worker, public processing pipeline, public endpoint, OpenAI support, Google Docs output, output persistence, job completion, manifest mutation, migration, CI/CD/runtime/deploy/production rollout, VPS access, or secrets change.
- ✅ **STUDIO-CD-IMAGE-01 — Enforce component image replacement and identity verification** — source-done, CI-verified, and production-live based on operator evidence: the recreated API container is healthy, the running image ID matches the newly built tagged image ID, and local/public API health returned HTTP 200.
- ✅ **STUDIO-CD-STDIN-01 — Prevent deploy-script stdin consumption and false-success CD runs** — done/merged via PR #118 (head `4013dd0fb758260287e56d12e9edfd0442b62ebe`, merge `07984815cbd8c1851f8eb079e1a3fc44d4b76a75`); Backend CI #273 passed and Studio PWA CI #108 passed. Post-merge operator evidence confirmed a healthy recreated API container and matching running/tagged image identity.
- ✅ **PWA-OUTPUT-01A — Internal Google Docs single-transcript write boundary** — source-done/merged via PR #119 (head `7405c0db1a51059f4d0a0cf8e0ca8421f92771cc`, merge `58981fd86cf1de002f6378602fa38d99d79b3aa6`); Backend CI #276 passed and Studio PWA CI #111 passed. It added only an internal single-transcript Google Docs creation boundary and did not claim production-live processing.
- ✅ **PWA-OUTPUT-01B — Safe output persistence and fenced completion transition** — source-done/merged via PR #120 (head `b3368d18889f41fd8397fce8343b3cfe825bb79b`, merge `e510497204138546dd9cdbeb5f87785ef53b33d3`); Backend CI #282 passed and Studio PWA CI #117 passed. It added internal per-source safe Google Docs output-reference persistence and fenced completion when every non-skipped relation has persisted output evidence; no production-live processing is claimed.
- ✅ **PWA-PIPELINE-01-PREP — Internal single-job processing orchestration contract** — source-done/merged via PR #121 (head `67aa43ba9fca69a7139726cbcd326c46bc3efa65`, merge `e11558b5c22cba727410535b34780718eb6248cf`); Backend CI #285 passed. It defined the internal synchronous composition contract for one already-leased job without implementing orchestration, workers, queues, public APIs, automatic retry, runtime/deploy changes, or production processing.
- ✅ **PWA-PIPELINE-01A — Internal synchronous single-job orchestrator** — source-done/merged via PR #122 (head `b3c693da7fc7ab301a6939f0ff46402f0b0707b4`, merge `f2481a05f0a79a3cccd3631d3a1c9e98dc825d52`); Backend CI #288 passed and Studio PWA CI #120 passed. It added the internal server-only synchronous orchestrator for one already-leased job and did not add worker/runtime/API/production processing behavior.
- ✅ **PWA-PIPELINE-01B — Internal one-shot claim-and-process boundary** — source-done/merged via PR #123 (head `cc739bb04df1b200d556f99d33bbc3ec20e463dc`, merge `2b6b766e41337dcab3c5548ae1ee4dd1ec0eae34`); Backend CI #290 passed and Studio PWA CI #122 passed. It added the internal server-only explicit-job claim, lease commit, and orchestrator invocation boundary without worker/runtime/API/production processing behavior.
- ✅ **PWA-WORKER-01A — Internal single-iteration claim-next-and-process boundary** — source-done/merged via PR #124 (head `6e858a066304b3bf20388322c81c293f61df49ff`, merge `99f0e34e67740a60053242e98e194f888ff05341`); Backend CI #293 passed and Studio PWA CI #125 passed. It added one internal non-looping claim-next-and-process iteration without worker/runtime/API/production processing behavior.
- ✅ **PWA-WORKER-01-PREP — Dedicated Studio polling worker runtime contract** — source-done/merged via PR #125 (head `a5694a13db1243b12bd93705b280057cbc35bbfc`, merge `e850f6f6cd68dde8ebb55c8008bcc19f1c9750c4`); Backend CI #296 passed. It defined the dedicated `studio-worker` runtime contract without changing runtime source.
- ✅ **PWA-WORKER-01B — Dedicated Studio polling worker source and Compose wiring** — source-done/merged via PR #126 (head `b0236d1f6eab4495d2b1d315f4dc06f6c38055a5`, merge `4b91598651c90199ffb189b3758f9bfab6a05d11`); Backend CI #299 passed and Studio PWA CI #128 passed. It added the dedicated worker entrypoint/source-only Compose wiring, PostgreSQL claim-next polling, committed lease-renewal checkpoints, synchronous ElevenLabs processing, Google Docs creation, safe per-source output-reference persistence, and fenced job completion. No worker deployment, production processing, public browser output API, frontend output links, manifest mutation, or exactly-once Google document creation is claimed.
- ✅ **PWA-OUTPUT-02-PREP — Browser-safe Studio job output discovery contract** — source-done/merged via PR #127 (head `709ee29b2323c91a34683ce4d2b70804c7a6c4bc`, merge `fc856758da6e08d2fbdb42ece5004d6a9117cd15`); Backend CI #301 passed. It defined the authenticated, owner-scoped, read-only browser API contract for discovering persisted Studio job outputs without implementing the endpoint, frontend, runtime behavior, deployment, or production processing.
- ✅ **PWA-OUTPUT-02A — Browser-safe Studio job output API** — source-done/merged via PR #128 (head `3b713f2f0defee1a9ff08c5177f29277637e5b2b`, merge `80e29cab9db33a497fe2d3c71d31c34f7bd8de0c`); Backend CI #304 passed and Studio PWA CI #131 passed. It added the authenticated read-only `/api/jobs/{job_id}/outputs` endpoint without frontend output links, deployment, production-live processing, manifest mutation, or exactly-once Google document creation claims.
- ✅ **PWA-OUTPUT-02B — Studio job output links UI** — source-done/merged via PR #129 (head `a3ea0117b525970cdeec8235c3d740b1160387cb`, merge `7d555faa3e6e02d41327d6761f6bda1c2c7d59dd`); Backend CI #307 passed and Studio PWA CI #134 passed. It added platform-mode frontend output metadata and links without claiming production-live processing, worker rollout, manifest mutation, or exactly-once Google document creation.
- ✅ **PWA-PROCESSING-ROLLOUT-01-PREP — Studio processing production rollout contract** — source-done/merged via PR #130 (head `ba87fe7a991b748b8f1fbc0eed3e5b2d295622c0`, merge `41dfa926f77b2a8657dec1d675d770000b188843`); Backend CI #310 passed and Studio PWA CI #137 passed.
- ✅ **Blocked preflight reconciliation** — source-done/merged via PR #131 (head `5412a2c14f50fe6cb08cf1cb14be7174aaab283d`, merge `d5adc5b14a2f2abc4dca6e22280477702e4964a1`); Backend CI #312 passed.
- ✅ **PWA-PROCESSING-PREFLIGHT-01A — Read-only Studio production host preflight workflow** — source-done/merged via PR #132; it did not execute production preflight and does not claim production processing smoke success.
- ✅ **PWA-GOOGLE-PICKER-01 — Native Google Drive Picker navigation for Studio PWA** — source-done/merged into main via PR #133 (`096a6a40ad96789af990d4fbf05087d2f1c74bd3`): replaced manual Drive file/folder ID UX with official Google Picker modal, server-side verified source persistence, and server-side verified output-folder selection while preserving `drive.file` only.
- 👉 **PWA-GOOGLE-PICKER-POLISH-01 — Improve Google Picker navigation and presentation** — current focused frontend UX item: polish the official Picker with list mode, Russian locale, mode-specific titles, viewport-aware sizing, explicit origin, and selection limits without backend, OAuth, deployment, or production processing changes.
- ⛔ **PWA-PROCESSING-ROLLOUT-01A — Manual Studio processing rollout and controlled smoke validation** — paused before production job creation: production processing smoke remains separate and is not claimed by the Picker source merge or Picker polish work.
- 📋 **RUNTIME-01 — Batch source picker / manifest skip / Google Docs output smoke-check** — deferred by current product priority; still planned manual Colab/Drive/Docs validation without claiming pass/fail.

## Last completed item: PWA-GOOGLE-PICKER-01 — Native Google Drive Picker navigation for Studio PWA

Status: source-done/merged into main via PR #133 (`096a6a40ad96789af990d4fbf05087d2f1c74bd3`).

Scope:

- Replaced manual Drive file/folder ID UX with the official Google Picker modal for source-file and output-folder selection.
- Preserved server-side verification, current mutation endpoints, and `drive.file` scope.
- Did not claim production processing smoke success.

Rollout boundary:

- Production processing smoke remains a separate operator-controlled validation item.
- **PWA-GOOGLE-PICKER-POLISH-01** is the current focused frontend UX item before any resumed worker/smoke rollout.
- No production deployment, production worker start, job creation, smoke job, Google document creation, or production-live processing claim is recorded here.
- **RUNTIME-01** remains deferred.

## Current checkpoint

Batch Colab remains the primary working product contour and current/fallback production workflow for provider transcription, Google Drive/Docs output, Drive integration, and `manifest` progress/skip mutation. Docs-only maintenance workflows remain separate and must not call provider/STT/LLM APIs. Realtime Colab/proxy remains an experimental contour for browser capture + ElevenLabs realtime STT and must not save Google Docs, mutate `manifest`, or integrate speaker projects.

Studio PWA is the current development contour intended to duplicate Google Colab product scope with PWA/platform adaptations. Source on main now includes account/session/BYOK, projects, sources, Google Drive OAuth/metadata/folder-child selection, local temporary upload intake, persisted job records, job UI, preflight/claim-readiness guardrails, internal processing-time source materialization, and processing prerequisites. PWA-WORKER-01A is source-done/merged via PR #124 (head `6e858a066304b3bf20388322c81c293f61df49ff`, merge `99f0e34e67740a60053242e98e194f888ff05341`) with Backend CI #293 passed and Studio PWA CI #125 passed. PWA-WORKER-01-PREP is source-done/merged via PR #125 (head `a5694a13db1243b12bd93705b280057cbc35bbfc`, merge `e850f6f6cd68dde8ebb55c8008bcc19f1c9750c4`) with Backend CI #296 passed. PWA-WORKER-01B is source-done/merged via PR #126 (head `b0236d1f6eab4495d2b1d315f4dc06f6c38055a5`, merge `4b91598651c90199ffb189b3758f9bfab6a05d11`) with Backend CI #299 passed and Studio PWA CI #128 passed. Current Studio source now includes a worker entrypoint and Compose service definition, but no production rollout, public processing pipeline, production processing pipeline, frontend output rendering source now exists for an explicitly opened job, but this does not mean production deployment, production-live processing, manifest mutation, or exactly-once Google document creation is claimed. PWA-OUTPUT-02-PREP is source-done/merged via PR #127 (head `709ee29b2323c91a34683ce4d2b70804c7a6c4bc`, merge `fc856758da6e08d2fbdb42ece5004d6a9117cd15`) with Backend CI #301 passed. PWA-OUTPUT-02A is source-done/merged via PR #128 (head `3b713f2f0defee1a9ff08c5177f29277637e5b2b`, merge `80e29cab9db33a497fe2d3c71d31c34f7bd8de0c`) with Backend CI #304 passed and Studio PWA CI #131 passed. PWA-OUTPUT-02B is source-done/merged via PR #129 (head `a3ea0117b525970cdeec8235c3d740b1160387cb`, merge `7d555faa3e6e02d41327d6761f6bda1c2c7d59dd`) with Backend CI #307 passed and Studio PWA CI #134 passed. PWA-PROCESSING-ROLLOUT-01-PREP is source-done/merged via PR #130 (head `ba87fe7a991b748b8f1fbc0eed3e5b2d295622c0`, merge `41dfa926f77b2a8657dec1d675d770000b188843`) with Backend CI #310 passed and Studio PWA CI #137 passed. PWA-PROCESSING-ROLLOUT-01A is blocked before production validation because production operator access was unavailable; no production-live Studio processing is claimed. STUDIO-CD-IMAGE-01 and STUDIO-CD-STDIN-01 are source-done, CI-verified, and production-live from operator evidence. Studio job persistence migration rollout remains manual/operator-scoped unless operator evidence exists.

Current confirmed realtime evidence is partial: one display+microphone run confirmed standalone page boot, capture, WebSocket open, `session_started`, partial transcript, committed transcript, user Stop, media-track release and WebSocket close. After RT-TOKEN-01, the standalone page also manually confirmed sequential Start → Stop → Start without page reload: both sessions reached WebSocket open and `session_started`, both stopped cleanly, and the final close was user-initiated with code 1000. Full realtime E2E success is not claimed.

## Active recommended next item

**PWA-GOOGLE-PICKER-POLISH-01 — Improve Google Picker navigation and presentation** is the active focused source item. It is limited to frontend presentation/configuration of the official Google Picker and does not execute production preflight, deployment, worker start, smoke job creation, or production processing validation. **PWA-PROCESSING-ROLLOUT-01A — Manual Studio processing rollout and controlled smoke validation** remains blocked/separate because production operator environment/access was unavailable. The two read-only preflight attempts were made only from a non-production coding workspace; that workspace was not the documented production checkout, and `/opt/elevenlabs-studio` was unavailable there. Phase 0 production identity and runtime gates were not executed, and all later production checks are `not-run`.

This blocked state is not a failed production validation. No production repository identity, runtime files, services, database revision, smoke-account prerequisites, migration state, worker state, or production health were inspected, so no conclusion about actual production health, configuration, migration revision, worker state, or smoke readiness is supported. No production mutation occurred: no backup, migration, deploy, worker start, job creation, provider call, Google API call, cleanup, rollback, source edit, commit, or production PR action occurred.

The next source action is the focused Picker polish item above; it does not complete the blocked operator rollout or claim production processing smoke success.

**RUNTIME-01** remains deferred.

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

# Delivery plan

## Current dashboard

- ✅ `PWA-CATALOG-DURABLE-IDEMPOTENCE-04` — PR #199 merged as `bd8d513`. PR-head and exact-main repository/Studio CI passed. Exact-main component CD deployed web and API; the migration release job was correctly skipped.
- ✅ `PWA-MIGRATION-ENVIRONMENT-PROBE-02` — exact-main run `30718275780` remained environment-gated for about 20 minutes before the approved no-op job started. This supplies the previously missing required-review evidence without VPS or migration action.
- ✅ `PWA-WORKER-OPS-01 / current baseline` — manual exact-main worker deployment run `30721775811` succeeded and status run `30721817365` completed for `main@bd8d513`. The operator then completed a real batch transcription successfully. That run is useful bounded production evidence, not proof of every media/options/failure scenario.
- ✅ `PWA-JOB-PROGRESS-02 / source` — PR #200 merged as `6e0eb183`; PR-head and exact-main repository/Studio CI passed. The source keeps terminal jobs visible until explicit dismissal and persists confirmed provider-part progress through additive migration `0018_job_part_progress`.
- ✅ `PWA-TWO-PROJECT-SPLIT-01 / source` — PR #200 merged as `6e0eb183`; the optional composer flow creates two immutable complementary clip jobs and persists their bounds through additive migration `0019_job_media_clip`.
- ✅ `PWA-APPEARANCE-LAYOUT-01 / web` — PR #200 merged and exact-main component CD deployed the web surface. System/light/dark appearance and the full-width desktop workspace are live-source capabilities; a bounded live Chrome visual smoke is still absent.
- ✅ `STUDIO-MIGRATION-STAGED-01 / production evidence` — PR #201 merged as `cb1a0e3`. Protected run `31255557765` visibly waited for approval, created verified pre-migration snapshot `91f483f8bf45`, applied only `0019_job_media_clip -> 0020_provider_part_checkpoints`, and deployed the exact-head API. The enable variable was then returned to `false`.
- 👉 `PWA-PARTIAL-PROVIDER-RESUME-01` — PR #202 merged as `66fb098`; exact-main repository and Studio CI passed. Production is migrated to `0020`, the matching API is healthy, and manual worker run `31255817558` deployed the exact merge image. A real split workload proved the original partial-failure mode; one explicit live continuation canary remains and must not be manufactured by forcing a paid provider failure.
- 👉 `PWA-REALTIME-TRANSCRIPTION-01` — active source candidate on `codex/pwa-realtime-sprint-01`. The separate PWA tab, server-issued single-use capability, microphone/display/mixed capture, bounded WebSocket/audio lifecycle, actionable provider failures, input activity, and browser-only transcript UX are implemented locally. PR CI, merge, web/API plus host-header rollout, and live capture canaries remain open.
- 📋 `PWA-TRANSCRIPT-MAINTENANCE-CANARY-04` — complete the bounded recursive-folder and single-document dry-run/apply matrix. Every state-changing apply remains a separate explicit user decision.
- 📋 `PWA-TRUSTED-PROXY-01 / production evidence` — source contract is merged; bounded production peer observation and separately reviewed runtime configuration remain absent.
- 📋 `PWA-LEGACY-SUCCESSOR-DISCOVERY-01 / consumer decision` — compatibility APIs advertise successors, but removal/support still requires external-consumer evidence and an explicit decision.

## Audit conclusion

- Stable Colab batch remains accepted at **100%** for its current scope. Realtime Colab remains a separate experimental contour.
- Current merged source is `main@66fb0984965ee43746caa398cda0f0b799a4e78c` (PR #202). Exact-main CI passed. Protected run `31255557765` established production revision `0019_job_media_clip`, created and verified pre-migration snapshot `91f483f8bf45`, applied only direct successor `0020_provider_part_checkpoints`, deployed the API from the exact merge, and passed health gates. Manual worker run `31255817558` then deployed exact commit `66fb098` as image `sha256:f5065193221b...` and reached `STUDIO_PLATFORM_WORKER_DEPLOY_OK`.
- The successful job exposed a real usability defect: on terminal transition its active progress card disappeared into history. PR #200 contains the source fix; production proof still depends on the staged schema/API/worker rollout and a real UI canary.
- Final branch review found two continuity gaps in the first local implementation: dismissal authority was component-local and concurrent polling discarded the terminal snapshot. The corrective commit makes dismissal owner-scoped and durable in PostgreSQL, backfills pre-existing terminal history as already dismissed, and retains non-requested progress snapshots until explicit dismissal.
- Batch progress remains HTTP-polled and evidence-based. The server can report part-level movement only after each prepared ElevenLabs part returns successfully. A single unsplit provider request has no truthful intermediate percentage because the synchronous provider response exposes no such checkpoint.
- The two-project option is deliberately pre-launch and narrow: one source, one whole-second boundary, exactly two parts and two different folders. Once created, each job is independent and immutable; arbitrary editing/cutting remains excluded.
- The screenshot width loss is a source CSS constraint, not a PWA platform limitation: the previous main element was centered behind a `1360px` maximum. The branch removes that cap, keeps the responsive breakpoint, and narrows the project selector column so the transcription builder receives the reclaimed space.
- Migrations `0018_job_part_progress`, `0019_job_media_clip`, and `0020_provider_part_checkpoints` are additive but still stateful. Production is now at exact head `0020` through the protected one-successor lane; matching API and worker deployment evidence is retained. Ordinary component CD must still not apply migrations, and the explicit partial-provider continuation remains unproven until a bounded live canary occurs.
- The Realtime source candidate is deliberately outside the batch worker/stateful path. It adds no migration, queue, job, source, output, catalog, or analytics state. Its production path requires exact API/web deployment plus a separately reviewed public-host nginx header reload; none of those rollout gates are implied by local source or tests.

## Readiness snapshot

| Contour/dimension | Evidence-based estimate | Meaning |
| --- | ---: | --- |
| Stable Colab batch | **100%** | Accepted current scope and operational fallback. |
| Selected Studio v1 baseline source/CI on `main` | **100% (`40/40`)** | PR #202 is merged and exact-main repository/Studio CI passed. This is source/CI, not universal production proof. |
| Studio batch production usability baseline | **80% (`4/5`)** | Exact source/CI, current schema/API/web, intended worker, and a real successful job are evidenced. The terminal progress/result continuity gate failed in real use. |
| `PWA-JOB-PROGRESS-02` merged source | **100% (`4/4`)** | Durable terminal visibility/dismissal, concurrent checkpoint continuity, durable N/M parts, and focused validation/documentation are merged with green exact-main CI. |
| `PWA-JOB-PROGRESS-02` production rollout | **50% (`2/4`)** | Merged CI and live progress/result behavior are observed. Exact database/API and worker image identity evidence for that run was not retained. |
| `PWA-TWO-PROJECT-SPLIT-01` merged source | **100% (`6/6`)** | Composer UX, complementary API validation, immutable persistence, clip-aware duplicate authority, pre-provider server clipping, and focused validation are merged with green exact-main CI. |
| `PWA-TWO-PROJECT-SPLIT-01` production rollout | **60% (`3/5`)** | Merged CI, a live two-folder flow, and two created documents are observed. Exact database/API and worker image identity evidence for that run was not retained. |
| `PWA-APPEARANCE-LAYOUT-01` merged source | **100% (`4/4`)** | Three-way preference, browser-local persistence/system resolution, semantic light/dark palette, full-width responsive layout, and focused validation are merged. |
| `PWA-APPEARANCE-LAYOUT-01` production rollout | **50% (`1/2`)** | Exact-main web deployment is present; one live Chrome visual smoke across light/dark plus desktop/narrow layout is absent. |
| `STUDIO-MIGRATION-STAGED-01` source fix | **100% (`4/4`)** | Explicit one-successor implementation, focused validation, PR CI, and merge are present. Live releases remain operational evidence, not source completeness. |
| `PWA-PARTIAL-PROVIDER-RESUME-01` merged source | **100% (`7/7`)** | Safe root-cause preservation, encrypted checkpoint storage, remaining-part resume, explicit restart fallback, lifecycle cleanup, focused backend/frontend evidence, merge, and green exact-main CI are present. |
| `PWA-PARTIAL-PROVIDER-RESUME-01` production rollout | **75% (`3/4`)** | Merge/CI, protected `0020` release plus exact API, and exact worker rollout are evidenced. One controlled live continuation canary remains. |
| Protected migration lane pre-fix baseline evidence | **100% (`5/5`)** | Historical source/CI, VPS forced-command boundary, successful single-revision protected release, disabled post-release flag, and visible reviewer wait/approval are evidenced. The new staged-target contract is tracked separately above. |
| Transcript-maintenance source acceptance on `main` | **100% (`10/10`)** | Durable post-apply rediscovery fix and required CI are merged. |
| Transcript-maintenance rollout | **50% (`2/4`)** | Runtime/OAuth/schema and exact API identity/health are evidenced; full target-mode dry-run/apply matrix is not. |
| `PWA-REALTIME-TRANSCRIPTION-01` | **83% (`5/6`)** | PWA tab, token endpoint, capture lifecycle, realtime session, and safe transcript UX are implemented on the working branch with local automated evidence. Service-backed CI, merge, deployment/header rollout, and live microphone/display/mixed canaries remain gate 6. |

The denominators are explicit gates. Local code, a green workflow summary with skipped jobs, or an idle healthy worker cannot advance a deployment, migration, provider, or canary gate by itself.

## Active item

`PWA-REALTIME-TRANSCRIPTION-01` acceptance checks:

1. A separate Live tab exists inside the selected Studio project while batch composer/jobs remain unchanged.
2. After browser permission succeeds, an authenticated owner-scoped CSRF endpoint resolves the active ElevenLabs credential server-side and returns only a validated `no-store` single-use `scribe_v2_realtime` capability under a bounded issuance rate limit.
3. The browser supports microphone-only, display/tab-audio-only, and mixed capture; missing browser media APIs/shared audio, rejected permission, source-ended, Stop during permission or capability issuance, page hide, unmount, socket/provider error, a 25-second capability timeout, a 10-second connection timeout, and bounded WebSocket backpressure release all media/audio/socket resources deterministically.
4. VAD partial text is replaceable, committed text is ordered, and copy/download/clear are explicit. Confirmed fragments remain project-scoped only in the current React tree across internal workspace navigation; the UI stops hidden capture, warns before browser unload, and retains no unconfirmed cross-project partial. Transcript content, media, capability URL/token, and the main BYOK key are never durably persisted or emitted to Studio diagnostics.
5. There is no automatic reconnect, token reuse, or hidden/background capture. Every new attempt requests a new capability; tabs are independent; Live creates no batch jobs, sources, Google Docs, catalog entries, analytics records, database rows, Redis work, or worker activity.
6. Full local validation, PR/service-backed CI, merge, exact API/web deployment, public-host CSP/Permissions-Policy rollout, and live Chrome microphone/display/mixed plus lifecycle canaries are separately evidenced.

Checks 1–5 are implemented on `codex/pwa-realtime-sprint-01`. Current local gate 6 evidence includes full Studio Vitest (`355 passed`), production Vite/PWA build, TypeScript, ESLint, lightweight repository checks, pure diagnostic-group assertions, Python compilation, and a listed mocked Playwright flow covering Live capture plus internal-workspace continuity. The earlier branch-wide portable Python baseline passed (`940 passed, 5 skipped`); the newest backend diagnostic-isolation tests still require the service-backed Python CI environment because the local virtual environment is incomplete. PostgreSQL-backed endpoint execution, actual browser E2E, PR/exact-main CI, merge, deployment/header reload, and live capture remain open.

Non-goals: no Google Docs output, catalog/manifest mutation, analytics, batch-job integration, worker use, transcript-body persistence, automatic reconnect, background capture, migration, deployment, VPS mutation, or production-readiness claim in this source task.

Merged acceptance evidence for `PWA-JOB-PROGRESS-02`:

1. A job transitioning from `queued/processing` to terminal remains visible in the current project view and its safe detail/output is loaded automatically.
2. The user can explicitly dismiss the retained terminal card into history. Undismissed state survives refresh and project switches through owner-scoped PostgreSQL authority; pre-migration terminal history is backfilled as already dismissed.
3. The displayed percentage uses only confirmed server checkpoints and completed/total prepared provider parts. It never advances from elapsed time.
4. PostgreSQL persists only bounded integer part counters on the current source attempt; transcript content, provider payloads, storage identity, lease authority, and failure detail remain absent from the browser DTO.
5. Counter updates are monotonic, lease-fenced, committed after each successful provider part, and fail closed after a partial provider result or lost lifecycle authority.
6. Progress counters and terminal-dismissal authority are the direct additive `0018_job_part_progress` migration and the branch head is its direct additive successor `0019_job_media_clip`; ordinary component CD applies neither.
7. Focused backend/frontend tests, TypeScript, ESLint, and portable repository checks pass.
8. Required PR/exact-main CI, protected migration, API/worker identity and health, and one production UI canary are separately evidenced.

Checks 1–7 are merged with green exact-main CI. In check 8, merge/CI is complete; protected migration, API/worker identity and health, and the production UI canary remain open.

Non-goals: no WebSocket for batch jobs, no fabricated within-request ElevenLabs percentage, no provider API change, no plaintext or browser transcript-body persistence, no deploy, no migration execution, and no VPS mutation in this source task.

`PWA-TWO-PROJECT-SPLIT-01` acceptance checks:

1. The option is off by default; an ordinary composer row keeps its existing one-job request contract.
2. When enabled, the PWA requires one valid `MM:SS` or `HH:MM:SS` boundary, a second verified folder different from the first, and expands the row into exactly two complementary entries.
3. The API accepts only a two-entry same-source complementary group and persists immutable clip bounds plus independent output-folder snapshots.
4. Preflight and cross-run duplicate/provider-attempt authority distinguish the two clips without weakening owner, source, settings, or output-evidence checks.
5. The worker duration-probes and clips server-side before ElevenLabs. Invalid or out-of-duration bounds fail closed before provider billing; temporary media is not persisted.
6. Each part has an independent job/result lifecycle and a browser-safe `Начало — граница` or `граница — конец` label; transcript content and private identifiers remain absent.
7. Focused backend/frontend tests, TypeScript, ESLint, lightweight repository checks, and documentation validation pass.
8. Required PR/exact-main CI, protected `0018`/`0019` migration, API/worker identity and health, two-folder preflight, and one real split canary are separately evidenced.

Checks 1–7 are merged with green exact-main CI. Operator evidence now includes the two-folder flow and two created documents; the exact migration revision plus API/worker image identity for that canary were not retained and remain open.

`PWA-APPEARANCE-LAYOUT-01` acceptance checks:

1. Account settings expose system, light, and dark choices and apply them immediately.
2. The preference persists only in browser local storage; system mode resolves from `prefers-color-scheme` and changes no server/account state.
3. Semantic color tokens cover the existing PWA surfaces in both light and dark modes, including controls, status cards, analytics, and job progress.
4. The desktop main area has no fixed maximum width, the project selector column is compact, and the existing narrow-screen single-column breakpoint remains intact.
5. Focused frontend tests, TypeScript, ESLint, lightweight repository checks, and documentation validation pass.
6. Required PR/exact-main CI, web deployment, and one live Chrome light/dark plus wide/narrow visual smoke are separately evidenced.

Checks 1–5 are merged and the exact-main web deployment is complete. The live Chrome visual smoke in check 6 remains open.

## Next item

Close `PWA-REALTIME-TRANSCRIPTION-01` gate 6 without broadening product scope:

1. Publish the source candidate and require repository CI plus Studio unit/build/browser-E2E jobs on the exact PR head, followed by exact-main CI after merge.
2. Deploy only the selected API and web components from the exact merge; no migration or worker deployment belongs to this contour.
3. Separately review, back up, apply, syntax-check, and reload the public-host nginx CSP/Permissions-Policy change. A green component CD run does not prove this host-level boundary.
4. In Chrome, validate microphone-only, tab/display-audio-only, mixed capture, partial/committed ordering, Stop, permission denial, source-ended, refresh/page-hide cleanup, copy/download/clear, and a second start receiving a new one-use capability.
5. Treat secondary-browser behavior and any browser-specific capture limitation as explicit evidence, not inferred parity. Keep transcript content and capability values out of screenshots/logs.

## Near backlog

1. Use the next naturally occurring eligible partial-provider failure for one explicit continuation canary; do not deliberately create a paid provider failure merely for evidence.
2. Add favorite Google Drive destination folders so repeated transcription setup does not require reopening Picker each time.
3. Complete transcript-maintenance target-mode canaries.
4. Verify trusted reverse-proxy peer identity before any runtime value change.
5. Collect external-consumer evidence for deprecated compatibility routes.

## Current blockers

- PR #202 is merged with green exact-main CI. Production migration `0020`, matching API, and exact worker identity are evidenced; the explicit live-continuation behavior is not yet production-canary proven.
- PostgreSQL integration tests still need the service-backed CI environment. Focused local tests do not replace CI or rollout evidence.
- Exact part progress is available only for media split into multiple provider requests. The current synchronous provider call exposes no honest within-part percentage.
- Studio Realtime is implemented only as an unmerged source candidate with local automated evidence. Service-backed CI, exact deployment, host-header rollout, and live browser/provider evidence are absent.
- Transcript-maintenance rollout still lacks the complete target-mode canary matrix.

## Validation notes

- Rollout evidence branch: `codex/provider-resume-rollout-evidence`, based on clean `main@66fb098`.
- Incident evidence: a real two-project split completed technically; a later split job reached internal provider part `1/2`, then failed on the second part. The aggregate error hid the fixed safe provider category and no continuation action was available.
- Source evidence: focused backend/recovery tests passed (`130 passed`); portable Python passed (`925 passed, 5 skipped`); full Studio frontend Vitest passed (`332 passed`); TypeScript, ESLint, Vite/PWA production build, migration-release tests (`11 passed`), lightweight repository checks, and `git diff --check` passed. PR #202 run `31253629976` and browser-E2E run `31253629969` exposed that the original 33-character Alembic identifier exceeded the existing `alembic_version.version_num VARCHAR(32)` limit; the candidate was narrowed to the 30-character `0020_provider_part_checkpoints`. Service-backed reruns `31253942235` (`checks`) and `31253942231` (`studio`, `browser-e2e`) passed, followed by exact-main runs `31254860835` and `31254860818`. Production run `31255557765` applied `0020` with verified snapshot `91f483f8bf45` and exact API deployment; worker run `31255817558` deployed exact commit `66fb098` and passed identity/schema/health gates. Live continuation remains separate.
- Realtime branch evidence: pure capability validation covers provider status/error redaction and strict WSS/token/model/audio/commit parsing; frontend protocol/session/panel tests cover permission-before-token, supported-source detection, capability timeout/abort, PCM streaming, VAD partial/committed ordering, mixed capture, bounded backpressure, duration/activity counters, safe export, internal workspace continuity, hidden-capture shutdown, Stop, connection timeout, page-hide disposal, and token non-rendering including WebSocket-constructor failures. Full Studio Vitest passed (`355 passed`); production Vite/PWA build, TypeScript, ESLint, lightweight repository checks, nginx header assertions, pure diagnostic-group assertions, Python compilation, and `git diff --check` passed. The earlier portable Python baseline passed (`940 passed, 5 skipped`), while the newest service diagnostic-isolation tests, mocked Playwright scenario execution, actual browser E2E, and PostgreSQL-backed route tests remain assigned to service-backed CI.
- Final focused backend split gate: `55 passed` across clip normalization, media preparation, batch preflight, duplicate/catalog authority, browser DTOs, and schema shape. Earlier progress-focused suites remain separate commit evidence.
- Final focused frontend gate: `150 passed` across the complete App suite plus composer, job-model, and job-card suites; TypeScript build and targeted ESLint passed.
- Final appearance/layout gate: `128 passed` across theme initialization, PWA bootstrap, and the complete App suite; TypeScript, targeted ESLint, production Vite/PWA build, `git diff --check`, and lightweight repository checks passed.
- Final corrective gate covers durable owner-scoped terminal dismissal, retry reset, persisted visibility grouping, concurrent progress retention, blocked-storage theme bootstrap, and aligned manifest colors. Full frontend Vitest passed (`328 passed`), portable Python passed (`920 passed, 5 skipped`), focused DB-free backend/schema checks passed (`19 passed`), TypeScript, targeted ESLint, production Vite/PWA build, lightweight repository checks, and `git diff --check` passed. The PostgreSQL endpoint/migration integration remains assigned to service-backed CI.
- Lightweight repository checks passed. PostgreSQL-backed integration tests still require the service-backed CI environment and were not counted as local passes.
- Earlier feature-branch operational testing was limited by local PostgreSQL. Git for Windows Bash is available for syntax and simulated migration-lane tests; service-backed PostgreSQL execution remains CI/runtime evidence.
- GitHub evidence refreshed on 2026-08-02: PR #199 merge `bd8d513`; exact-main CI runs `30702706377` and `30702706378`; web/API CD run `30702706409`; no-op review probe `30718275780`; manual worker deployment `30721775811`; worker status `30721817365`.
- Operator evidence: a real production batch transcription completed successfully after worker activation; the terminal progress card disappeared until found in history, which is the observed defect for this item.
- Self-review: the earlier package changes durable job-result continuity, browser-safe progress projection, fenced integer part counters, the narrowly authorized two-project split with immutable clip bounds, and browser-local appearance/full-width layout. Terminal dismissal stores only an owner-scoped timestamp, retry clears it, and old terminal history is not resurfaced. The current branch adds an isolated direct-browser Live WebSocket contour without adding WebSockets to batch, exposing the main key or content to Studio persistence, deploying, migrating, or mutating production.
- Partial-provider self-review: the branch intentionally adds encrypted transcript-bearing checkpoint state, so it is bounded more strictly than ordinary progress metadata: normalized payload only, existing master-key encryption, integrity HMAC, exact scope/shape, maximum 24-hour TTL, and deletion on completion/cancellation/restart/expiry. It never automatically retries provider work, never exposes payloads to the browser, and cannot turn an uncertain no-checkpoint outcome into retry authority.

## Repeatable engineering pipeline

For each task/commit:

1. Select one dashboard item and state scope/non-goals.
2. Work only on the current `codex/` branch and inspect `main...HEAD`.
3. Implement the smallest safe change with focused validation.
4. Commit once; report checks, behind/ahead, readiness numerator, uncertainty, and self-review.
5. Do not convert source/CI success into deployment, migration, worker, provider, or canary evidence.

For each 10–15-commit thematic batch:

1. Reconcile this dashboard and run the full applicable pre-PR gate.
2. Review the complete `main...HEAD` diff and commit series; do not pad the count.
3. Push once, open a draft PR, wait for all required checks, and fix failures with focused commits.
4. Merge remains a user action. After merge, verify exact-main CI and job-level CD results.
5. Verify exact deployed identities and only then run separately authorized production checks.
6. Fast-forward local `main`, remove merged work branches, and start the next batch branch.

Production/operator work remains a separate pipeline: **read-only preflight → explicit authorization → backup if state changes → bounded action → identity/health check → canary → stabilization**.

## Sources of truth

- Product and acceptance contract: `docs/project-spec.md`.
- Processing invariants: `docs/studio-processing-contract.md`.
- Workflow: `docs/ai-coding-workflow.md`.
- CI/CD and runtime safety: `docs/ci-cd-rules.md`.
- Architecture: `docs/architecture.md`.
- Operator procedure: `docs/runbooks/studio-platform-ops.md`.
- Validation: `docs/runbooks/validation.md`.

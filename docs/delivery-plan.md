# Delivery plan

## Current dashboard

- ✅ `PWA-CATALOG-DURABLE-IDEMPOTENCE-04` — PR #199 merged as `bd8d513`. PR-head and exact-main repository/Studio CI passed. Exact-main component CD deployed web and API; the migration release job was correctly skipped.
- ✅ `PWA-MIGRATION-ENVIRONMENT-PROBE-02` — exact-main run `30718275780` remained environment-gated for about 20 minutes before the approved no-op job started. This supplies the previously missing required-review evidence without VPS or migration action.
- ✅ `PWA-WORKER-OPS-01 / current baseline` — manual exact-main worker deployment run `30721775811` succeeded and status run `30721817365` completed for `main@bd8d513`. The operator then completed a real batch transcription successfully. That run is useful bounded production evidence, not proof of every media/options/failure scenario.
- ✅ `PWA-JOB-PROGRESS-02 / source` — PR #200 merged as `6e0eb183`; PR-head and exact-main repository/Studio CI passed. The source keeps terminal jobs visible until explicit dismissal and persists confirmed provider-part progress through additive migration `0018_job_part_progress`.
- ✅ `PWA-TWO-PROJECT-SPLIT-01 / source` — PR #200 merged as `6e0eb183`; the optional composer flow creates two immutable complementary clip jobs and persists their bounds through additive migration `0019_job_media_clip`.
- ✅ `PWA-APPEARANCE-LAYOUT-01 / web` — PR #200 merged and exact-main component CD deployed the web surface. System/light/dark appearance and the full-width desktop workspace are live-source capabilities; a bounded live Chrome visual smoke is still absent.
- 👉 `STUDIO-MIGRATION-STAGED-01` — active on `codex/studio-migration-target-release`. Two protected attempts failed closed before backup, migration, API recreation, or database change: first because the worker was running, then because the lane required the repository head to be exactly one successor of production revision `0017`. The source fix makes each approved run select exactly one direct additive successor (`0018`, then `0019`), preserves the current API on an intermediate target, and deploys API only when the repository head is reached. The worker is intentionally drained and remains stopped; focused local tests pass, while CI, merge, wrapper installation, both protected releases, API/worker rollout, and production canaries remain absent.
- 📋 `PWA-REALTIME-TRANSCRIPTION-01` — next product epic. Bring the existing experimental realtime Colab capability into a separate tab on the same PWA transcription page. Design must preserve the single-use-token, browser capture, WebSocket, transcript-content, and no-Google-Docs boundaries before implementation.
- 📋 `PWA-TRANSCRIPT-MAINTENANCE-CANARY-04` — complete the bounded recursive-folder and single-document dry-run/apply matrix. Every state-changing apply remains a separate explicit user decision.
- 📋 `PWA-TRUSTED-PROXY-01 / production evidence` — source contract is merged; bounded production peer observation and separately reviewed runtime configuration remain absent.
- 📋 `PWA-LEGACY-SUCCESSOR-DISCOVERY-01 / consumer decision` — compatibility APIs advertise successors, but removal/support still requires external-consumer evidence and an explicit decision.

## Audit conclusion

- Stable Colab batch remains accepted at **100%** for its current scope. Realtime Colab remains a separate experimental contour.
- Current merged source is `main@6e0eb18328f79841a99e0138cfb60dfd842387d0`. Exact-main CI and web deployment are present for PR #200. Production PostgreSQL and API remain at revision `0017_google_maintenance_oauth`; migrations `0018`/`0019`, the matching API/worker rollout, and feature canaries are not yet present. The previously successful real batch transcription remains valid evidence for the older deployed baseline only.
- The successful job exposed a real usability defect: on terminal transition its active progress card disappeared into history. PR #200 contains the source fix; production proof still depends on the staged schema/API/worker rollout and a real UI canary.
- Final branch review found two continuity gaps in the first local implementation: dismissal authority was component-local and concurrent polling discarded the terminal snapshot. The corrective commit makes dismissal owner-scoped and durable in PostgreSQL, backfills pre-existing terminal history as already dismissed, and retains non-requested progress snapshots until explicit dismissal.
- Batch progress remains HTTP-polled and evidence-based. The server can report part-level movement only after each prepared ElevenLabs part returns successfully. A single unsplit provider request has no truthful intermediate percentage because the synchronous provider response exposes no such checkpoint.
- The two-project option is deliberately pre-launch and narrow: one source, one whole-second boundary, exactly two parts and two different folders. Once created, each job is independent and immutable; arbitrary editing/cutting remains excluded.
- The screenshot width loss is a source CSS constraint, not a PWA platform limitation: the previous main element was centered behind a `1360px` maximum. The branch removes that cap, keeps the responsive breakpoint, and narrows the project selector column so the transcription builder receives the reclaimed space.
- Migrations `0018_job_part_progress` and `0019_job_media_clip` are additive but still stateful. Ordinary component CD must not apply them. The protected migration lane, exact API/worker deployment, and bounded production UI canaries remain required after merge.

## Readiness snapshot

| Contour/dimension | Evidence-based estimate | Meaning |
| --- | ---: | --- |
| Stable Colab batch | **100%** | Accepted current scope and operational fallback. |
| Selected Studio v1 baseline source/CI on `main` | **100% (`40/40`)** | PR #200 is merged and exact-main repository/Studio CI passed. This is source/CI, not universal production proof. |
| Studio batch production usability baseline | **80% (`4/5`)** | Exact source/CI, current schema/API/web, intended worker, and a real successful job are evidenced. The terminal progress/result continuity gate failed in real use. |
| `PWA-JOB-PROGRESS-02` merged source | **100% (`4/4`)** | Durable terminal visibility/dismissal, concurrent checkpoint continuity, durable N/M parts, and focused validation/documentation are merged with green exact-main CI. |
| `PWA-JOB-PROGRESS-02` production rollout | **25% (`1/4`)** | Merged CI is present. Schema/API rollout through `0019`, worker identity/health, and a real UI canary are absent. |
| `PWA-TWO-PROJECT-SPLIT-01` merged source | **100% (`6/6`)** | Composer UX, complementary API validation, immutable persistence, clip-aware duplicate authority, pre-provider server clipping, and focused validation are merged with green exact-main CI. |
| `PWA-TWO-PROJECT-SPLIT-01` production rollout | **20% (`1/5`)** | Merged CI is present. `0018`/`0019` plus API rollout, worker identity/health, two-folder dry-run, and a real two-output canary are absent. |
| `PWA-APPEARANCE-LAYOUT-01` merged source | **100% (`4/4`)** | Three-way preference, browser-local persistence/system resolution, semantic light/dark palette, full-width responsive layout, and focused validation are merged. |
| `PWA-APPEARANCE-LAYOUT-01` production rollout | **50% (`1/2`)** | Exact-main web deployment is present; one live Chrome visual smoke across light/dark plus desktop/narrow layout is absent. |
| `STUDIO-MIGRATION-STAGED-01` source fix | **50% (`2/4`)** | Explicit one-successor implementation and focused local validation are present. CI/merge and a live two-step protected exercise are absent. |
| Protected migration lane pre-fix baseline evidence | **100% (`5/5`)** | Historical source/CI, VPS forced-command boundary, successful single-revision protected release, disabled post-release flag, and visible reviewer wait/approval are evidenced. The new staged-target contract is tracked separately above. |
| Transcript-maintenance source acceptance on `main` | **100% (`10/10`)** | Durable post-apply rediscovery fix and required CI are merged. |
| Transcript-maintenance rollout | **50% (`2/4`)** | Runtime/OAuth/schema and exact API identity/health are evidenced; full target-mode dry-run/apply matrix is not. |
| `PWA-REALTIME-TRANSCRIPTION-01` | **0% (`0/6`)** | PWA tab, token endpoint, capture lifecycle, realtime session, safe transcript UX, and validation/rollout are not implemented in Studio. |

The denominators are explicit gates. Local code, a green workflow summary with skipped jobs, or an idle healthy worker cannot advance a deployment, migration, provider, or canary gate by itself.

## Active item

`STUDIO-MIGRATION-STAGED-01` acceptance checks:

1. A protected run accepts `head` or one explicit Alembic revision but may apply only the direct additive successor of the current production revision.
2. The selected target must exist on the single linear ancestor chain of the repository head; branches, unknown revisions, non-additive revisions, and skipped ancestors fail closed.
3. The forced-command SSH boundary binds the approved exact repository SHA and requested migration target; arbitrary remote commands remain impossible.
4. Every successor remains a separate reviewed run with a new verified backup. One run never upgrades through multiple pending revisions.
5. An intermediate target migrates the database without rebuilding or recreating API and must prove the current API remains healthy.
6. The final repository-head target migrates, deploys the matching API image, and proves image identity plus local/public health.
7. Worker-stopped, exact-source, clean-tree, backup, rollback, schema, and postcondition gates remain unchanged.
8. Focused tests, Bash syntax, lightweight repository checks, PR/exact-main CI, wrapper installation, the `0018` then `0019` protected releases, API/worker rollout, and bounded feature canaries are separately evidenced.

Checks 1–7 are implemented on the local branch. Focused local validation is present; check 8 remains open beyond that local evidence.

Non-goals: no migration or deploy from this source task, no automatic multi-revision upgrade, no worker restart, no recovery of the intentionally drained worker, and no relaxation of approval/backup/rollback gates.

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

Non-goals: no WebSocket for batch jobs, no fabricated within-request ElevenLabs percentage, no provider API change, no transcript-body persistence, no deploy, no migration execution, and no VPS mutation in this source task.

`PWA-TWO-PROJECT-SPLIT-01` acceptance checks:

1. The option is off by default; an ordinary composer row keeps its existing one-job request contract.
2. When enabled, the PWA requires one valid `MM:SS` or `HH:MM:SS` boundary, a second verified folder different from the first, and expands the row into exactly two complementary entries.
3. The API accepts only a two-entry same-source complementary group and persists immutable clip bounds plus independent output-folder snapshots.
4. Preflight and cross-run duplicate/provider-attempt authority distinguish the two clips without weakening owner, source, settings, or output-evidence checks.
5. The worker duration-probes and clips server-side before ElevenLabs. Invalid or out-of-duration bounds fail closed before provider billing; temporary media is not persisted.
6. Each part has an independent job/result lifecycle and a browser-safe `Начало — граница` or `граница — конец` label; transcript content and private identifiers remain absent.
7. Focused backend/frontend tests, TypeScript, ESLint, lightweight repository checks, and documentation validation pass.
8. Required PR/exact-main CI, protected `0018`/`0019` migration, API/worker identity and health, two-folder preflight, and one real split canary are separately evidenced.

Checks 1–7 are merged with green exact-main CI. In check 8, merge/CI is complete; protected migration, API/worker identity and health, two-folder preflight, and the real split canary remain open.

`PWA-APPEARANCE-LAYOUT-01` acceptance checks:

1. Account settings expose system, light, and dark choices and apply them immediately.
2. The preference persists only in browser local storage; system mode resolves from `prefers-color-scheme` and changes no server/account state.
3. Semantic color tokens cover the existing PWA surfaces in both light and dark modes, including controls, status cards, analytics, and job progress.
4. The desktop main area has no fixed maximum width, the project selector column is compact, and the existing narrow-screen single-column breakpoint remains intact.
5. Focused frontend tests, TypeScript, ESLint, lightweight repository checks, and documentation validation pass.
6. Required PR/exact-main CI, web deployment, and one live Chrome light/dark plus wide/narrow visual smoke are separately evidenced.

Checks 1–5 are merged and the exact-main web deployment is complete. The live Chrome visual smoke in check 6 remains open.

## Next item

`PWA-REALTIME-TRANSCRIPTION-01` starts with a focused contract/design task:

1. Add a separate **Live transcription** tab inside the existing PWA transcription page; batch behavior remains unchanged.
2. Reuse the proven realtime contour only after mapping its single-use server token, `scribe_v2_realtime` session, microphone/display input combinations, VAD commit semantics, and Stop/permission-race lifecycle to Studio ownership and CSRF rules.
3. Keep the primary ElevenLabs API key server-only; the browser receives only a short-lived single-use realtime capability.
4. Keep live transcript text browser-only for the first slice, with ordered partial/committed presentation plus copy/download/clear. Google Docs, catalog, analytics, and batch jobs are non-goals until separately authorized.
5. Define reconnect, token reuse/expiry, browser refresh, multi-tab, rate-limit, logging, and content-retention behavior before code.
6. Validate microphone-only first, then display-only/mixed capture and cross-browser behavior as separate gates.

## Near backlog

1. Merge the staged migration-lane fix, install its exact wrapper, and apply `0018` then `0019` through two separately approved protected releases before API/worker feature canaries.
2. Design and implement the first safe microphone-only Studio realtime slice.
3. Complete transcript-maintenance target-mode canaries.
4. Verify trusted reverse-proxy peer identity before any runtime value change.
5. Collect external-consumer evidence for deprecated compatibility routes.

## Current blockers

- The current fix branch is not pushed or reviewed. Production remains on `0017`; `0018` and `0019` require two separately approved protected releases after the wrapper is updated.
- The worker is intentionally gracefully drained and stopped. This is a safe migration precondition, not worker rollout evidence; the user explicitly deferred restoration until after the migration fix.
- PostgreSQL integration tests still need the service-backed CI environment. Focused migration-lane tests are green locally; CI evidence for this branch is absent.
- Exact part progress is available only for media split into multiple provider requests. The current synchronous provider call exposes no honest within-part percentage.
- Studio realtime is not implemented; only the separate experimental Colab prototype and its partial runtime evidence exist.
- Transcript-maintenance rollout still lacks the complete target-mode canary matrix.

## Validation notes

- Current branch: `codex/studio-migration-target-release`, based on clean `main@6e0eb183`.
- Protected attempt evidence: the first release stopped before backup/migration because the worker was running; after an explicit graceful drain, the second stopped before backup/migration because production `0017` was not the direct predecessor of repository head `0019`. Both reported no database/API mutation and no manual recovery requirement.
- Current fix validation: focused migration-runner/release tests pass (`19 passed`), all three changed shell scripts pass `bash -n`, lightweight repository checks pass, and `git diff --check` passes. Service-backed CI and the live two-step protected exercise remain separate gates.
- Final focused backend split gate: `55 passed` across clip normalization, media preparation, batch preflight, duplicate/catalog authority, browser DTOs, and schema shape. Earlier progress-focused suites remain separate commit evidence.
- Final focused frontend gate: `150 passed` across the complete App suite plus composer, job-model, and job-card suites; TypeScript build and targeted ESLint passed.
- Final appearance/layout gate: `128 passed` across theme initialization, PWA bootstrap, and the complete App suite; TypeScript, targeted ESLint, production Vite/PWA build, `git diff --check`, and lightweight repository checks passed.
- Final corrective gate covers durable owner-scoped terminal dismissal, retry reset, persisted visibility grouping, concurrent progress retention, blocked-storage theme bootstrap, and aligned manifest colors. Full frontend Vitest passed (`328 passed`), portable Python passed (`920 passed, 5 skipped`), focused DB-free backend/schema checks passed (`19 passed`), TypeScript, targeted ESLint, production Vite/PWA build, lightweight repository checks, and `git diff --check` passed. The PostgreSQL endpoint/migration integration remains assigned to service-backed CI.
- Lightweight repository checks passed. PostgreSQL-backed integration tests still require the service-backed CI environment and were not counted as local passes.
- Earlier feature-branch operational testing was limited by local PostgreSQL. Git for Windows Bash is available for syntax and simulated migration-lane tests; service-backed PostgreSQL execution remains CI/runtime evidence.
- GitHub evidence refreshed on 2026-08-02: PR #199 merge `bd8d513`; exact-main CI runs `30702706377` and `30702706378`; web/API CD run `30702706409`; no-op review probe `30718275780`; manual worker deployment `30721775811`; worker status `30721817365`.
- Operator evidence: a real production batch transcription completed successfully after worker activation; the terminal progress card disappeared until found in history, which is the observed defect for this item.
- Self-review: the package changes durable job-result continuity, browser-safe progress projection, fenced integer part counters, the narrowly authorized two-project split with immutable clip bounds, and browser-local appearance/full-width layout. Terminal dismissal stores only an owner-scoped timestamp, retry clears it, and old terminal history is not resurfaced. It does not permit arbitrary editing after launch, add WebSockets to batch, expose content, store theme in account state, implement realtime, deploy, migrate, or mutate production.
- Staged-migration self-review: the fix changes target selection and final-head API deployment only. It retains exact-SHA checkout, stopped-worker, additive/direct-successor, protected backup, restore validation, one migration execution, revision equality, health, and rollback/manual-recovery reporting. Intermediate `0018` intentionally leaves the backward-compatible current API running; final `0019` is the only step that recreates API from the captured candidate image.

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

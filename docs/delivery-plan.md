# Delivery plan

## Current dashboard

- 👉 `PWA-BATCH-CREATE-RECOVERY-15 / local source` — batch preflight and create now stop waiting after 20 seconds; an ambiguous create remains owner-scoped across project switches and blocks a new key until the user explicitly replays the exact request body with the same `Idempotency-Key`. Local CODE/TEST gates pass; publication and CI are intentionally absent.
- 👉 `PWA-JOB-MUTATION-TIMEOUT-14 / local source` — cancel, provider retry, output reconciliation, and terminal dismissal now stop waiting after 20 seconds, never retry a POST automatically, and perform one bounded authoritative GET before reporting a predefined confirmed or ambiguous outcome. Local CODE/TEST gates pass; publication and CI are intentionally absent.
- 🟦 `PWA-JOB-MUTATION-OUTCOME-13 / local source` — safe cancel, retry, output-reconciliation, and terminal-dismiss outcomes now survive originating-panel remounts in owner-scoped browser memory; notices stay project-isolated, clear on explicit retry, and never render raw backend detail. Local CODE/TEST gates pass; publication and CI are intentionally absent.
- 🟦 `PWA-JOB-MUTATION-OWNERSHIP-12 / local source` — cancel, retry, output-reconciliation, and terminal-dismiss in-flight ownership now survives project switches; restored controls remain pending and duplicate POSTs stay blocked until the original request settles. Local CODE/TEST gates pass; publication and CI are intentionally absent.
- 🟦 `PWA-PROJECT-COLLECTION-TIMEOUT-11 / local source` — same-project sources/jobs collection reads now have a 15-second bound, same-resource supersede abort, and teardown cancellation; failed refreshes preserve last-known items and expose safe Russian messages. Local CODE/TEST gates pass; publication and CI are intentionally absent.
- 🟦 `PWA-JOB-READ-TIMEOUT-10 / local source` — job detail, outputs, retry metadata, and reconciliation metadata reads now have a 15-second bound, same-resource supersede abort, and teardown cancellation; safe detail/output failures replace indefinite loading. Local CODE/TEST gates pass; publication and CI are intentionally absent.
- 🟦 `PWA-JOB-DISMISS-DEDUP-09 / local source` — durable terminal dismissal now has a synchronous per-job in-flight guard plus disabled/aria-busy UI; safe failure unlocks one explicit retry without exposing raw backend detail. Local CODE/TEST gates pass; publication and CI are intentionally absent.
- 🟦 `PWA-JOB-RECONCILIATION-DEDUP-08 / local source` — explicit Google Drive reconciliation now has a synchronous per-job in-flight guard; pending action is disabled/aria-busy and safe failure unlocks one explicit retry. Local CODE/TEST gates pass; publication and CI are intentionally absent.
- 🟦 `PWA-JOB-RETRY-DEDUP-07 / local source` — provider-cost-sensitive retry now has a synchronous per-job in-flight guard; pending action is disabled/aria-busy and safe failure unlocks one explicit retry. Local CODE/TEST gates pass; publication and CI are intentionally absent.
- 🟦 `PWA-JOB-CANCEL-DEDUP-06 / local source` — queued and processing job cancellation now has a synchronous per-job in-flight guard plus disabled/aria-busy UI; failure unlocks one explicit retry without exposing raw backend detail. Local CODE/TEST gates pass; publication and CI are intentionally absent.
- 🟦 `PWA-JOB-DETAIL-ORDERING-05 / local source` — repeated job detail, outputs, retry, and reconciliation reads now use independent latest-request-wins epochs; post-mutation jobs reload remains immediate. Local CODE/TEST gates pass; publication and CI are intentionally absent.
- 🟦 `PWA-PROJECT-LIST-ORDERING-04 / local source` — same-project sources/jobs reloads now use latest-request-wins epochs, so a slower stale success or failure cannot replace newer authoritative state. Local CODE/TEST gates pass; publication and CI are intentionally absent.
- 🟦 `PWA-JOB-PROGRESS-POLLING-03 / local source` — rejected and stalled `/jobs/progress` requests now recover through bounded timeout/backoff; missing-job reconciliation keeps polling alive, and cleanup aborts in-flight work without false API-failure diagnostics. Local CODE/TEST gates pass; publication and CI are intentionally absent.
- ✅ `PWA-CATALOG-DURABLE-IDEMPOTENCE-04` — PR #199 merged as `bd8d513`. PR-head and exact-main repository/Studio CI passed. Exact-main component CD deployed web and API; the migration release job was correctly skipped.
- ✅ `PWA-MIGRATION-ENVIRONMENT-PROBE-02` — exact-main run `30718275780` remained environment-gated for about 20 minutes before the approved no-op job started. This supplies the previously missing required-review evidence without VPS or migration action.
- ✅ `PWA-WORKER-OPS-01 / current baseline` — manual exact-main worker deployment run `30721775811` succeeded and status run `30721817365` completed for `main@bd8d513`. The operator then completed a real batch transcription successfully. That run is useful bounded production evidence, not proof of every media/options/failure scenario.
- ✅ `PWA-JOB-PROGRESS-02 / source` — PR #200 merged as `6e0eb183`; PR-head and exact-main repository/Studio CI passed. The source keeps terminal jobs visible until explicit dismissal and persists confirmed provider-part progress through additive migration `0018_job_part_progress`.
- ✅ `PWA-TWO-PROJECT-SPLIT-01 / source` — PR #200 merged as `6e0eb183`; the optional composer flow creates two immutable complementary clip jobs and persists their bounds through additive migration `0019_job_media_clip`.
- ✅ `PWA-APPEARANCE-LAYOUT-01 / web` — PR #200 merged and exact-main component CD deployed the web surface. System/light/dark appearance and the full-width desktop workspace are live-source capabilities; a bounded live Chrome visual smoke is still absent.
- ✅ `STUDIO-MIGRATION-STAGED-01 / production evidence` — PR #201 merged as `cb1a0e3`. Protected run `31255557765` visibly waited for approval, created verified pre-migration snapshot `91f483f8bf45`, applied only `0019_job_media_clip -> 0020_provider_part_checkpoints`, and deployed the exact-head API. The enable variable was then returned to `false`.
- 👉 `PWA-PARTIAL-PROVIDER-RESUME-01` — PR #202 merged as `66fb098`; exact-main repository and Studio CI passed. Production is migrated to `0020`, the matching API is healthy, and manual worker run `31255817558` deployed the exact merge image. A real split workload proved the original partial-failure mode; one explicit live continuation canary remains and must not be manufactured by forcing a paid provider failure.
- ✅ `PWA-REALTIME-TRANSCRIPTION-01 / merged and primary live path` — PR #203 merged as `8a306f8`. Exact-main repository/Studio CI passed, component CD deployed web and API, the host policy was separately corrected, and a real Chrome tab/display-audio session produced growing confirmed fragments before a clean explicit Stop. Microphone-only, mixed capture, and the remaining negative lifecycle canaries are still open gate-6 evidence.
- 👉 `PWA-STUDIO-EDGE-CD-01` — PR #204 merged as `3ec5b48`; exact-main repository/Studio CI passed, and the dedicated VPS wrapper/key bootstrap is complete. The lane reuses the existing protected `studio-production-migration` human-approval boundary while retaining separate edge secrets and a separate forced-command identity. One approved live release and its browser canary remain open.
- 📋 `PWA-TRANSCRIPT-MAINTENANCE-CANARY-04` — complete the bounded recursive-folder and single-document dry-run/apply matrix. Every state-changing apply remains a separate explicit user decision.
- 📋 `PWA-TRUSTED-PROXY-01 / production evidence` — source contract is merged; bounded production peer observation and separately reviewed runtime configuration remain absent.
- 📋 `PWA-LEGACY-SUCCESSOR-DISCOVERY-01 / consumer decision` — compatibility APIs advertise successors, but removal/support still requires external-consumer evidence and an explicit decision.

## Audit conclusion

- Stable Colab batch and Realtime are operator-accepted at **100%** for their current scope after about four months of stable use. Focused repository/runtime gaps remain valid follow-ups; implemented Realtime is not backlog.
- Current merged source is `main@7871b31dc47158c43c3572612a8d0aa3242d018f` (PR #205). The retained exact-main CI evidence below predates this newer SHA and is not silently attributed to it. The earlier component CD run `31300547844` deployed web and API for `8a306f8`; migration and worker jobs were correctly skipped. Earlier protected run `31255557765` established production revision `0020_provider_part_checkpoints`, and manual worker run `31255817558` deployed exact commit `66fb098` as image `sha256:f5065193221b...`.
- The successful job exposed a real usability defect: on terminal transition its active progress card disappeared into history. PR #200 contains the source fix; production proof still depends on the staged schema/API/worker rollout and a real UI canary.
- Final branch review found two continuity gaps in the first local implementation: dismissal authority was component-local and concurrent polling discarded the terminal snapshot. The corrective commit makes dismissal owner-scoped and durable in PostgreSQL, backfills pre-existing terminal history as already dismissed, and retains non-requested progress snapshots until explicit dismissal.
- Batch progress remains HTTP-polled and evidence-based. The server can report part-level movement only after each prepared ElevenLabs part returns successfully. A single unsplit provider request has no truthful intermediate percentage because the synchronous provider response exposes no such checkpoint.
- The two-project option is deliberately pre-launch and narrow: one source, one whole-second boundary, exactly two parts and two different folders. Once created, each job is independent and immutable; arbitrary editing/cutting remains excluded.
- The screenshot width loss is a source CSS constraint, not a PWA platform limitation: the previous main element was centered behind a `1360px` maximum. The branch removes that cap, keeps the responsive breakpoint, and narrows the project selector column so the transcription builder receives the reclaimed space.
- Migrations `0018_job_part_progress`, `0019_job_media_clip`, and `0020_provider_part_checkpoints` are additive but still stateful. Production is now at exact head `0020` through the protected one-successor lane; matching API and worker deployment evidence is retained. Ordinary component CD must still not apply migrations, and the explicit partial-provider continuation remains unproven until a bounded live canary occurs.
- Realtime remains deliberately outside the batch worker/stateful path. It adds no migration, queue, job, source, output, catalog, or analytics state. Exact API/web deployment, the separately reviewed public-host header correction, and one successful tab/display-audio session are now evidenced. The remaining browser modes and negative lifecycle cases are still separate canaries.
- The edge-CD candidate addresses the operational gap exposed by that rollout: repository header policy and the active root-owned nginx snippet had drifted, forcing repeated manual mutation. Its source automation is not deployment proof; the dedicated VPS identity, GitHub protected environment/secrets/disabled flag, merge, and first approved release remain explicit gates.

## Readiness snapshot

| Contour/dimension | Evidence-based estimate | Meaning |
| --- | ---: | --- |
| Project, all current scope | **N/A (numerator/denominator are not defined)** | `project-spec.md` does not provide one closed, non-overlapping project-wide acceptance set; inventing a percentage would violate the agreed method. |
| Stable Colab batch + Realtime | **100% (operator-accepted current scope)** | Four months of stable use cover both implemented Colab contours; this does not assert that no focused gaps remain. |
| `PWA-BATCH-CREATE-RECOVERY-15` | **75% (`3/4`)** | Bounded preflight/create execution, persistent exact-key/body recovery without automatic POST replay, and full applicable local validation are complete. Publication plus required PR/exact-main CI is the remaining gate. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI —, DEPLOY N/A, LIVE N/A. |
| `PWA-JOB-MUTATION-TIMEOUT-14` | **75% (`3/4`)** | Bounded non-retrying POST execution, endpoint-specific authoritative timeout reconciliation, and full applicable local validation are complete. Publication plus required PR/exact-main CI is the remaining gate. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI —, DEPLOY N/A, LIVE N/A. |
| `PWA-JOB-MUTATION-OUTCOME-13` | **75% (`3/4`)** | Safe owner-scoped outcomes, remount/project isolation and explicit-retry clearing, and full applicable local validation are complete. Publication plus required PR/exact-main CI is the remaining gate. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI —, DEPLOY N/A, LIVE N/A. |
| `PWA-JOB-MUTATION-OWNERSHIP-12` | **75% (`3/4`)** | Persistent four-kind mutation ownership, project-switch duplicate prevention/unlock behavior, and full applicable local validation are complete. Publication plus required PR/exact-main CI is the remaining gate. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI —, DEPLOY N/A, LIVE N/A. |
| `PWA-PROJECT-COLLECTION-TIMEOUT-11` | **75% (`3/4`)** | Bounded source/job collection reads, safe cancellation and last-known-data preservation, and full applicable local validation are complete. Publication plus required PR/exact-main CI is the remaining gate. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI —, DEPLOY N/A, LIVE N/A. |
| `PWA-JOB-READ-TIMEOUT-10` | **75% (`3/4`)** | Four bounded job-read paths, safe timeout/supersede/teardown behavior, and full applicable local validation are complete. Publication plus required PR/exact-main CI is the remaining gate. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI —, DEPLOY N/A, LIVE N/A. |
| `PWA-JOB-DISMISS-DEDUP-09` | **75% (`3/4`)** | Terminal-dismiss mutation deduplication, accessible pending/failure-unlock behavior, and full applicable local validation are complete. Publication plus required PR/exact-main CI is the remaining gate. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI —, DEPLOY N/A, LIVE N/A. |
| `PWA-JOB-RECONCILIATION-DEDUP-08` | **75% (`3/4`)** | Reconciliation mutation deduplication, accessible pending/failure-unlock behavior, and full applicable local validation are complete. Publication plus required PR/exact-main CI is the remaining gate. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI —, DEPLOY N/A, LIVE N/A. |
| `PWA-JOB-RETRY-DEDUP-07` | **75% (`3/4`)** | Provider-cost retry deduplication, accessible pending/failure-unlock behavior, and full applicable local validation are complete. Publication plus required PR/exact-main CI is the remaining gate. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI —, DEPLOY N/A, LIVE N/A. |
| `PWA-JOB-CANCEL-DEDUP-06` | **75% (`3/4`)** | In-flight mutation deduplication, accessible pending/unlock behavior, and full applicable local validation are complete. Publication plus required PR/exact-main CI is the remaining gate. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI —, DEPLOY N/A, LIVE N/A. |
| `PWA-JOB-DETAIL-ORDERING-05` | **75% (`3/4`)** | Detail/output ordering, retry/reconciliation metadata ordering, and full applicable local validation are complete. Publication plus required PR/exact-main CI is the remaining gate. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI —, DEPLOY N/A, LIVE N/A. |
| `PWA-JOB-PROGRESS-POLLING-03` | **80% (`4/5`)** | Rejected/stalled request recovery, bounded backoff/abort cleanup, reconciliation continuity, and full applicable local gates are complete. Publication plus required PR/exact-main CI is the remaining gate. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI —, DEPLOY N/A, LIVE N/A. |
| `PWA-PROJECT-LIST-ORDERING-04` | **75% (`3/4`)** | Sources ordering, jobs ordering, and full applicable local validation are complete. Publication plus required PR/exact-main CI is the remaining gate. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI —, DEPLOY N/A, LIVE N/A. |
| Selected Studio v1 baseline source/CI on `main` | **100% (`40/40`)** | PR #203 is merged and exact-main repository/Studio CI passed. This is source/CI, not universal production proof. |
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
| `PWA-REALTIME-TRANSCRIPTION-01` | **83% (`5/6`)** | Checks 1–5, merge, exact-main CI, API/web deployment, public-host policy, and one real tab/display-audio session are evidenced. Gate 6 remains incomplete until microphone-only, mixed, and negative lifecycle canaries are recorded. |
| `PWA-STUDIO-EDGE-CD-01` | **80% (`4/5`)** | Canonical configuration, fail-closed release/wrapper, protected workflow, green merge/exact-main CI, and the dedicated VPS bootstrap are evidenced. One approved live release plus its browser canary form the final gate. |

The denominators are explicit gates. Local code, a green workflow summary with skipped jobs, or an idle healthy worker cannot advance a deployment, migration, provider, or canary gate by itself.

## Active item

`PWA-BATCH-CREATE-RECOVERY-15` acceptance checks:

1. Repository evidence establishes the recovery authority: a complete exact replay is project/owner/key/request-hash scoped, returns the original ordered jobs with `replayed: true`, and is protected by the backend unique constraint/transaction. The ordinary jobs list is explicitly not treated as batch-membership evidence because its browser DTO omits the idempotency key and batch positions.
2. Batch preflight and create stop waiting after 20 seconds with one shared abort signal across any CSRF refresh. A timed-out or transport-ambiguous create is never repeated automatically; its exact request body and `Idempotency-Key` remain in owner-scoped memory across A → B → A, block a new key, and require one explicit user replay.
3. Regression tests prove one POST before timeout, abort at the deadline, no hidden second POST, project isolation, and byte-identical body/key on explicit replay. Complete App suite, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
4. Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Checks 1–3 are complete locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. Check 4 is intentionally open under the current local-only instruction.

Non-goals: no automatic POST replay, jobs-list inference, backend/API/schema/business-rule change, browser persistence of request bodies, provider or Google Drive call, deploy, or production mutation.

## Previous local items

### Bounded job mutations and authoritative timeout reconciliation

`PWA-JOB-MUTATION-TIMEOUT-14` acceptance checks:

1. Cancel, provider-cost retry, output reconciliation, and terminal dismissal stop waiting after 20 seconds. The same abort signal also bounds a CSRF refresh, and no timed-out mutation is ever repeated automatically.
2. A timeout triggers one separately bounded authoritative read before ownership is released: job detail confirms cancellation only through `cancelled`/`cancel_requested_at` and dismissal only through `terminal_dismissed_at`; retry readiness confirms queueing/running/completion or an advanced attempt; reconciliation metadata confirms only an observable status/count/check-time transition.
3. Confirmed and still-ambiguous outcomes use predefined safe owner-scoped notices. Integration tests prove exactly one POST for each action, the matching GET reconciliation, and no raw backend/provider/Google response in UI or storage; helper/API tests, complete App suite, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
4. Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Checks 1–3 are complete locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. Check 4 is intentionally open under the current local-only instruction.

Non-goals: no automatic POST retry, backend idempotency/business-rule change, API/schema change, provider or Google Drive call in local tests, deploy, or production mutation.


### Safe job mutation outcomes across project switches

`PWA-JOB-MUTATION-OUTCOME-13` acceptance checks:

1. Settlement of cancel, provider retry, output reconciliation, and terminal dismissal produces only predefined safe success/failure notices in persistent ProjectsPage memory, keyed by mutation kind/job and scoped to the originating project; no raw response, path, identifier, or transcript body is copied into notice text or browser storage.
2. A notice remains available after the originating PreparationPanel remounts, is absent in another project, and is cleared when the user explicitly begins the same mutation again. Current-panel retry/reconciliation inline feedback suppresses the owner notice so text is not duplicated; cancel/dismiss feedback uses the owner path directly.
3. Existing four-kind dedup regressions, A → B → A failure/success/clearing/isolation regression, complete App suite, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
4. Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Checks 1–3 are complete locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. Check 4 is intentionally open under the current local-only instruction.

Non-goals for this completed item: no mutation timeout, automatic retry, durable/browser-storage notice persistence, backend idempotency/business-rule change, API/schema change, deploy, or production mutation.


### Job mutation ownership across projects

`PWA-JOB-MUTATION-OWNERSHIP-12` acceptance checks:

1. A synchronous owner-scoped registry in persistent ProjectsPage tracks cancel, provider retry, output reconciliation, and terminal dismissal independently by mutation kind and job ID; PreparationPanel project remounts cannot clear it.
2. Every covered mutation rejects a duplicate begin before React rerender. Returning to the originating project while the request is pending restores disabled/`aria-busy` UI, and settlement releases only the matching key for one explicit retry without exposing raw backend detail.
3. Existing four-kind dedup regressions, a real A → B → A pending-cancellation regression, complete App suite, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
4. Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Checks 1–3 are complete locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. Check 4 is intentionally open under the current local-only instruction.

Non-goals: no mutation timeout, automatic retry, backend idempotency/business-rule change, cross-project success/failure message persistence, API/schema change, deploy, or production mutation.


### Project collection read timeouts

`PWA-PROJECT-COLLECTION-TIMEOUT-11` acceptance checks:

1. Same-project sources and jobs collection GETs receive independent AbortSignals and cannot remain pending beyond 15 seconds; only the matching project/resource key is affected.
2. A newer collection read aborts the older same-key request without committing stale failure or emitting an intentional-abort diagnostic. ProjectsPage teardown invalidates and aborts all active collection reads; real timeout/failure resolves loading to safe Russian UI while preserving last-known successfully loaded items.
3. Focused collection-timeout and failed-refresh preservation regressions, complete App suite, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
4. Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Checks 1–3 are complete locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. Check 4 is intentionally open under the current local-only instruction.

Non-goals: no mutation timeout or retry, no global API timeout, no backend/API/schema change, no project-list or Google-connection behavior change, deploy, or production mutation.


### Job detail read timeouts

`PWA-JOB-READ-TIMEOUT-10` acceptance checks:

1. Job detail, outputs, retry metadata, and output-reconciliation metadata GETs receive independent AbortSignals and cannot remain pending beyond 15 seconds; only the matching resource/job key is affected.
2. A newer read aborts the older same-key request without committing stale failure or emitting an intentional-abort diagnostic. PreparationPanel teardown invalidates and aborts all active job reads; a real timeout remains observable and replaces indefinite detail/output loading with existing safe messages.
3. Focused ordering/timeout tests, complete App and latestRequest suites, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
4. Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Checks 1–3 are complete locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. Check 4 is intentionally open under the current local-only instruction.

Non-goals: no mutation timeout or retry, no global API timeout, no backend/API/schema change, no progress-polling behavior change, deploy, or production mutation.


### Terminal dismissal deduplication

`PWA-JOB-DISMISS-DEDUP-09` acceptance checks:

1. Two terminal-dismiss attempts for the same job while the first request is in flight produce at most one mutation request; the synchronous per-job guard does not depend on a React rerender.
2. The pinned-terminal dismissal control is disabled and exposes `aria-busy=true` while pending. A safe failure message unlocks one explicit retry, raw backend detail is not rendered, and a successful response preserves the authoritative jobs reload and existing backend idempotency contract.
3. Focused App and JobCard regressions, complete suites, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
4. Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Checks 1–3 are complete locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. Check 4 is intentionally open under the current local-only instruction.

Non-goals: no terminal-visibility/business-rule change, backend idempotency or audit change, API/schema changes, deploy, or production mutation.

### Output reconciliation deduplication

`PWA-JOB-RECONCILIATION-DEDUP-08` acceptance checks:

1. Two output-reconciliation checks for the same job while the first request is in flight produce at most one mutation request; the synchronous per-job guard does not depend on a React rerender.
2. The explicit Google Drive check is disabled and exposes `aria-busy=true` while pending. A safe failure message unlocks one explicit retry, raw backend detail is not rendered, and no automatic reconciliation is introduced.
3. Focused App and OutputReconciliationNotice regressions, complete suites, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
4. Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Checks 1–3 are complete locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. Check 4 is intentionally open under the current local-only instruction.

Non-goals: no reconciliation eligibility/business-rule change, backend idempotency change, automatic Google Drive check, API/schema changes, deploy, or production mutation.

### Provider-cost retry deduplication

`PWA-JOB-RETRY-DEDUP-07` acceptance checks:

1. Two retry attempts for the same job while the first request is in flight produce at most one mutation request; this includes partial resume/restart requests carrying explicit remaining-provider-cost confirmation and does not depend on a React rerender.
2. An available retry control is disabled and exposes `aria-busy=true` while pending. A safe failure message unlocks one explicit retry, raw backend detail is not rendered, and no automatic provider retry is introduced.
3. Focused App and JobDetailSection regressions, complete suites, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
4. Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Checks 1–3 are complete locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. Check 4 is intentionally open under the current local-only instruction.

Non-goals: no retry eligibility/business-rule change, backend idempotency change, automatic provider retry, API/schema changes, deploy, or production mutation.

### Job cancellation deduplication

`PWA-JOB-CANCEL-DEDUP-06` acceptance checks:

1. Two cancellation attempts for the same job while the first request is in flight produce at most one mutation request; the synchronous guard does not depend on a React rerender.
2. Queued and processing cancellation controls are disabled and expose `aria-busy=true` while pending. A safe failure message unlocks one explicit retry, raw backend detail is not rendered, and a successful response preserves the existing authoritative jobs reload.
3. Focused action/component regressions, complete App and JobCard suites, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
4. Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Checks 1–3 are complete locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. Check 4 is intentionally open under the current local-only instruction.

Non-goals: no backend idempotency contract, API/schema changes, automatic mutation retry, cancellation semantics change, deploy, or production mutation.

### Job detail ordering

`PWA-JOB-DETAIL-ORDERING-05` acceptance checks:

1. For repeated loads of one job, only the newest detail and outputs requests may commit success or failure state; a stale response cannot restore obsolete source/output data or replace a newer safe error.
2. Retry and output-reconciliation metadata use independent per-job request epochs, so a stale response cannot restore obsolete action availability. After a successful retry or reconciliation mutation, authoritative jobs reload remains immediate and is not blocked by the four detail reads.
3. Shared ordering tests, a component-level repeated-open regression, complete App tests, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
4. Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Checks 1–3 are complete locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. Check 4 is intentionally open under the current local-only instruction.

Non-goals: no API/backend/schema changes, no global request cache, no mutation retry, no deploy, and no production mutation.

### Project list ordering

`PWA-PROJECT-LIST-ORDERING-04` acceptance checks:

1. For repeated source-list loads of one project, only the newest request may commit success or failure state; stale responses cannot restore removed sources or erase newly loaded sources.
2. For repeated job-list loads of one project, only the newest request may commit success or failure state; stale responses cannot hide newly created/retried jobs or replace fresh status.
3. Request epochs are isolated by resource and project key. Focused ordering tests, complete App tests, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
4. Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Checks 1–3 are complete locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. Check 4 is intentionally open under the current local-only instruction.

Non-goals: no request cancellation, API/backend/schema changes, cache persistence, cross-owner state, deploy, or production mutation.

### Polling resilience

`PWA-JOB-PROGRESS-POLLING-03` acceptance checks:

1. An initial or later transient `/jobs/progress` rejection cannot permanently stop polling; retry does not depend on a previously confirmed response.
2. A stalled request is aborted after 15 seconds and enters the same bounded retry path; project switch/unmount aborts the current request immediately. Intentional cleanup abort is excluded from API-failure diagnostics while timeout/unexpected abort remains observable.
3. Consecutive failures use bounded exponential backoff up to 30 seconds; success resets the normal five-second cadence and outages preserve the last confirmed snapshot.
4. Missing requested jobs trigger authoritative jobs reconciliation without terminating polling; cleanup prevents stale scheduling. Focused tests, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
5. Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Checks 1–4 are complete locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. Check 5 is intentionally open: the current instruction is local implementation without push or PR.

Non-goals: no API/worker/schema/provider changes, no changed progress semantics, no fabricated within-request percentage, no deploy, and no production mutation.

## Deferred operational item

`PWA-STUDIO-EDGE-CD-01` acceptance checks:

1. The public browser policy has one canonical repository snippet containing exactly the six allowlisted headers; the host site includes the fixed runtime snippet and contains no competing header directives.
2. A root-owned forced-command wrapper accepts only `release <exact-main-sha>`, fast-forwards a clean trusted checkout, and executes the release program from that exact commit under an empty environment.
3. The release program can change only the active header snippet, creates a timestamped backup, validates the allowlist, runs `nginx -t`, reloads nginx, verifies exact local/public headers and API health, and restores the backup on post-mutation failure.
4. A manual-only workflow is disabled by default, requires the current full `main` SHA, reuses the protected `studio-production-migration` human-approval environment with separately named edge secrets and a dedicated SSH identity, and requires both success markers.
5. Focused source/config/workflow tests, shell/YAML validation, repository checks, PR/exact-main CI, merge, operator bootstrap, one approved protected release, and a bounded live browser feature canary are separately evidenced.

Checks 1–4 are merged with green exact-main CI, and the dedicated VPS trust-boundary bootstrap is complete. Check 5 remains open for this shared-environment correction, the first approved release, and its browser canary. The lane does not authorize application deploy, site rewrite, Docker, database, migration, worker, secret, Google, provider, or volume operations.

`PWA-REALTIME-TRANSCRIPTION-01` acceptance evidence:

1. A separate Live tab exists inside the selected Studio project while batch composer/jobs remain unchanged.
2. After browser permission succeeds, an authenticated owner-scoped CSRF endpoint resolves the active ElevenLabs credential server-side and returns only a validated `no-store` single-use `scribe_v2_realtime` capability under a bounded issuance rate limit.
3. The browser supports microphone-only, display/tab-audio-only, and mixed capture; missing browser media APIs/shared audio, rejected permission, source-ended, Stop during permission or capability issuance, page hide, unmount, socket/provider error, a 25-second capability timeout, a 10-second connection timeout, a separate 10-second provider-session-start timeout, and bounded WebSocket backpressure release all media/audio/socket resources deterministically. Chrome-capable clients default to display/tab audio while microphone remains an explicit optional mix-in; clients without display capture safely fall back to the available microphone control.
4. VAD partial text is replaceable, committed text is ordered, and copy/download/clear are explicit. Confirmed fragments remain project-scoped only in the current React tree across internal workspace navigation; the UI stops hidden capture, warns before browser unload, and retains no unconfirmed cross-project partial. Transcript content, media, capability URL/token, and the main BYOK key are never durably persisted or emitted to Studio diagnostics.
5. There is no automatic reconnect, token reuse, or hidden/background capture. Every new attempt requests a new capability; tabs are independent; Live creates no batch jobs, sources, Google Docs, catalog entries, analytics records, database rows, Redis work, or worker activity.
6. Full local validation, PR/service-backed CI, merge, exact API/web deployment, public-host CSP/Permissions-Policy rollout, and live Chrome microphone/display/mixed plus lifecycle canaries are separately evidenced.

Checks 1–5 are merged. Gate 6 includes green PR/exact-main repository and Studio CI, exact web/API deployment, corrected public-host policy, and one real Chrome tab/display-audio session whose confirmed fragments and symbols increased before explicit Stop. Microphone-only, mixed capture, permission denial, browser-ended source, refresh/page-hide cleanup, export/clear, and second-capability live canaries remain open; automated controller coverage does not replace them.

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

Continue local PWA stability hardening with source lifecycle mutations: verify backend idempotency and authoritative recovery for source removal and local-upload completion, then bound the highest-risk stalled path without duplicating stored sources or hiding an accepted deletion. `PWA-STUDIO-EDGE-CD-01` remains an operational follow-up and does not pre-empt the current local-only PWA priority.

## Near backlog

1. Use the next naturally occurring eligible partial-provider failure for one explicit continuation canary; do not deliberately create a paid provider failure merely for evidence.
2. Add favorite Google Drive destination folders so repeated transcription setup does not require reopening Picker each time; this is the next product-code item after the edge release contour.
3. Complete transcript-maintenance target-mode canaries.
4. Verify trusted reverse-proxy peer identity before any runtime value change.
5. Collect external-consumer evidence for deprecated compatibility routes.

## Current blockers

- PR #202 is merged with green exact-main CI. Production migration `0020`, matching API, and exact worker identity are evidenced; the explicit live-continuation behavior is not yet production-canary proven.
- PostgreSQL integration tests still need the service-backed CI environment. Focused local tests do not replace CI or rollout evidence.
- Exact part progress is available only for media split into multiple provider requests. The current synchronous provider call exposes no honest within-part percentage.
- Studio Realtime's primary tab/display-audio path is live-evidenced, but microphone-only, mixed, and negative lifecycle canaries remain absent.
- Studio edge CD is merged and its dedicated VPS trust boundary is bootstrapped, but the shared-environment workflow correction and one protected exact-main release are still required.
- Transcript-maintenance rollout still lacks the complete target-mode canary matrix.

## Validation notes

- `PWA-BATCH-CREATE-RECOVERY-15` local evidence: backend route/model/tests verify owner/project/idempotency-key/request-hash replay, ordered complete-batch recovery, transaction rollback, and a unique `(owner_id, project_id, batch_idempotency_key, batch_position)` constraint. The ordinary jobs-list DTO omits batch identity, so no unsafe list inference was implemented. Preflight/create timeout regressions `2/2`, A → B → A exact-replay/isolation regression `1/1`, complete App suite `138/138`, full Studio Vitest `401/401`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. Preflight and create share a 20-second bound; a timed-out create issues exactly one POST, and explicit recovery reuses the exact body/key without browser storage. No backend/API/schema change, automatic POST replay, PR, CI, deploy, provider/Google call, or live evidence is claimed.
- `PWA-JOB-MUTATION-TIMEOUT-14` local evidence: endpoint audit verified durable idempotency for cancel/dismiss, transactional queue authority for retry, and fail-closed Google reconciliation metadata. Bounded-request helper tests `5/5`, timeout integration regressions `4/4`, API client tests `7/7`, complete App suite `136/136`, full Studio Vitest `399/399`, TypeScript, full ESLint, Vite/PWA production build, and `git diff --check` passed. Each timeout produces exactly one POST followed by the endpoint-specific authoritative GET; provider-cost retry and Google Drive check are never automatically repeated, CSRF refresh shares the deadline signal, and confirmed/ambiguous text is predefined. Initial integration runs exposed two fixture-only assumptions: the test timer also accelerated existing 15-second detail reads, and terminal failed jobs preloaded readiness before explicit open. A distinct 20-second mutation deadline plus abort-driven fixture transition resolved both without weakening production assertions. No PR, CI, deploy, provider/Google call, or live evidence is claimed.
- `PWA-JOB-MUTATION-OUTCOME-13` local evidence: existing same-act mutation regressions plus the expanded project-switch outcome regression `5/5`, complete App suite `132/132`, full Studio Vitest `389/389`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. A safe cancellation failure remains visible after remount, disappears on explicit retry, the later safe success is absent in project B and visible on return to project A, and raw backend detail remains absent. Retry/reconciliation current-panel inline feedback suppresses duplicate owner notices; all notice state remains owner-scoped in memory only. One intermediate focused run caught a mechanically malformed template-literal path before tests executed; all four paths were restored by function-bounded replacement and TypeScript plus all final gates pass. No mutation timeout, automatic retry, PR, CI, deploy, or live evidence is claimed.
- `PWA-JOB-MUTATION-OWNERSHIP-12` local evidence: four existing same-act mutation dedup regressions `4/4`, project-switch ownership regression `1/1`, complete App suite `132/132`, full Studio Vitest `389/389`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. A pending cancellation remains disabled and `aria-busy` after A → B → A remount, a second POST is rejected synchronously, settlement releases the matching owner-scoped key for explicit retry, and raw backend failures remain absent from the DOM. The same persistent registry is wired to retry, reconciliation, and dismissal, whose existing same-act regressions remain green. No mutation timeout, automatic retry, PR, CI, deploy, or live evidence is claimed.
- `PWA-PROJECT-COLLECTION-TIMEOUT-11` local evidence: focused collection timeout and failed-refresh preservation regressions `2/2`, complete App suite `131/131`, full Studio Vitest `388/388`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. Sources/jobs collection requests receive independent signals and abort after 15 seconds; teardown/supersede cancellation is silent, while real failure resolves loading to safe Russian UI and retains last-known items. The production timeout remains 15 seconds; tests accelerate only that exact timer. No PR, CI, deploy, or live evidence is claimed.
- `PWA-JOB-READ-TIMEOUT-10` local evidence: latestRequest ordering/abort/timeout/teardown suite `6/6`, App stalled-read regression `1/1`, complete App suite `130/130`, full Studio Vitest `387/387`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. All four job-read signals abort at 15 seconds, detail/output loading resolves to safe retryable UI, a newer same-key request cancels its predecessor without stale failure, and teardown cancellation is explicitly ignored by API diagnostics while timeout aborts remain observable. The first App run exposed the existing terminal auto-load path and was narrowed to a processing-job fixture so timeout and supersede cases remain independent. No PR, CI, deploy, or live evidence is claimed.
- `PWA-JOB-DISMISS-DEDUP-09` local evidence: App terminal-dismiss regression `1/1`, complete JobCard suite `4/4`, complete App suite `129/129`, full Studio Vitest `383/383`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. A same-act double click produces one POST; pending action is disabled with `aria-busy`, failure unlocks explicit retry, authoritative jobs reload remains intact, and raw backend detail remains absent from the DOM. The first focused run exposed an incomplete fixture that omitted canonical `terminal_dismissed_at: null`; the corrected fixture and repeated gates pass. No PR, CI, deploy, or live evidence is claimed.
- `PWA-JOB-RECONCILIATION-DEDUP-08` local evidence: App reconciliation regression `1/1`, complete OutputReconciliationNotice suite `2/2`, complete App suite `128/128`, full Studio Vitest `381/381`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. A same-act double click produces one POST; pending action is disabled with `aria-busy`, failure unlocks explicit retry, the existing authoritative jobs/detail reload remains intact, and raw backend detail remains absent from the DOM. No PR, CI, deploy, Google Drive call, or live evidence is claimed.
- `PWA-JOB-RETRY-DEDUP-07` local evidence: App provider-cost retry regression `1/1`, complete JobDetailSection suite `8/8`, complete App suite `127/127`, full Studio Vitest `380/380`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. A same-act double click produces one POST; pending action is disabled with `aria-busy`, failure unlocks explicit retry, both explicit partial requests preserve `{confirm_remaining_provider_cost: true}`, and raw backend detail remains absent from the DOM. No PR, CI, deploy, provider call, or live evidence is claimed.
- `PWA-JOB-CANCEL-DEDUP-06` local evidence: focused cancellation regressions `6/6`, complete App suite `126/126`, complete JobCardActions suite `8/8`, full Studio Vitest `378/378`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. A same-act double click produces one POST; pending queued/processing controls are disabled with `aria-busy`, a failed request unlocks explicit retry, and raw backend detail remains absent from the DOM. No PR, CI, deploy, or live evidence is claimed.
- `PWA-JOB-DETAIL-ORDERING-05` local evidence: ordering helper `3/3`, component repeated-open regression `1/1`, complete App suite `125/125`, full Studio Vitest `375/375`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. Evidence covers stale success and failure suppression, independent resource keys, and integration wiring for out-of-order detail/output responses. Jobs reconciliation remains immediate after retry/reconciliation mutations. No PR, CI, deploy, or live evidence is claimed.
- `PWA-PROJECT-LIST-ORDERING-04` local evidence: ordering helper `3/3`, complete App suite `124/124`, full Studio Vitest `374/374`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. Tests prove stale success suppression, stale failure suppression, newest failure visibility, and independent resource keys. One pre-commit run caught and prevented an accidental recursive helper implementation; the corrected implementation passed all repeated gates. No PR, CI, deploy, or live evidence is claimed.
- `PWA-JOB-PROGRESS-POLLING-03` local evidence: focused polling Vitest `7/7` plus API abort diagnostics `6/6`; full Studio Vitest `371/371`; TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. Fake-timer evidence covers initial rejection, bounded exponential backoff, cadence reset, 15-second stalled-request abort, retry after timeout, reconciliation continuity, timer cleanup, in-flight abort, suppression of the exact intentional stop reason, and continued timeout-abort diagnostics. The first Vite attempt exposed an incomplete local pnpm link layout (`workbox-window` unresolved); an npm-compatible hoisted local `node_modules` layout fixed the environment without manifest/lockfile changes. No PR, CI, deploy, or live evidence is claimed.
- Rollout evidence branch: `codex/provider-resume-rollout-evidence`, based on clean `main@66fb098`.
- Incident evidence: a real two-project split completed technically; a later split job reached internal provider part `1/2`, then failed on the second part. The aggregate error hid the fixed safe provider category and no continuation action was available.
- Source evidence: focused backend/recovery tests passed (`130 passed`); portable Python passed (`925 passed, 5 skipped`); full Studio frontend Vitest passed (`332 passed`); TypeScript, ESLint, Vite/PWA production build, migration-release tests (`11 passed`), lightweight repository checks, and `git diff --check` passed. PR #202 run `31253629976` and browser-E2E run `31253629969` exposed that the original 33-character Alembic identifier exceeded the existing `alembic_version.version_num VARCHAR(32)` limit; the candidate was narrowed to the 30-character `0020_provider_part_checkpoints`. Service-backed reruns `31253942235` (`checks`) and `31253942231` (`studio`, `browser-e2e`) passed, followed by exact-main runs `31254860835` and `31254860818`. Production run `31255557765` applied `0020` with verified snapshot `91f483f8bf45` and exact API deployment; worker run `31255817558` deployed exact commit `66fb098` and passed identity/schema/health gates. Live continuation remains separate.
- Realtime evidence: PR #203 merged as exact main `8a306f8`; runs `31300547847` (repository CI), `31300547843` (Studio CI/browser E2E), and `31300547844` (web/API component CD) passed. Migration and worker jobs were skipped. After separately correcting active host Permissions-Policy and CSP drift, a real Chrome tab/display-audio session reached live recognition, confirmed fragment/symbol counters increased, and explicit Stop completed cleanly. No transcript text or capability value is retained as evidence.
- Edge-CD branch evidence: focused header/release/workflow tests pass locally; both shell programs pass `bash -n`, both workflows parse as YAML, and `git diff --check` passes. This is source evidence only; no VPS bootstrap or release is claimed.
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

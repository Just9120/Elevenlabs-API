# Delivery plan

## Current dashboard

- ✅ `PWA-STABILITY-HARDENING-PR207 / merged baseline` — PR #207 merged 30 atomic commits as `main@26ecae6`. PR-head and exact-main repository/Studio/browser CI passed; component CD deployed and identity-checked web and API, and public HTTPS health returned 200 for both endpoints. Migration and worker were correctly not selected.
- ✅ `PWA-DIAGNOSTICS-DEBUG-SESSION-34 / local complete` — the existing DEBUG-session read/start/stop lifecycle is bounded, runtime-validated, teardown-safe, single-flight, and reconciles ambiguous mutations without replay. Functional completion is `3/3 = 100%`; lifecycle remains IN PROGRESS until required GitHub CI is available. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI —, DEPLOY N/A, LIVE N/A.
- ✅ `PWA-AUTH-LOGOUT-BOUNDARY-33 / local complete` — logout is bounded and single-flight, and ambiguous responses reconcile against authoritative session state without replaying the logout POST. Functional completion is `3/3 = 100%`; lifecycle remains IN PROGRESS until required GitHub CI is available. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI —, DEPLOY N/A, LIVE N/A.
- ✅ `PWA-AUTH-LOGIN-BOUNDARY-32 / local complete` — the pre-auth bootstrap read and two-stage login mutation are bounded, runtime-validated, teardown-safe, and single-flight without changing backend auth rules, cookies, or API shapes. Functional completion is `3/3 = 100%`; lifecycle remains IN PROGRESS until required GitHub CI is available. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI —, DEPLOY N/A, LIVE N/A.
- ✅ `PWA-AUTH-SESSION-BOOTSTRAP-31 / local complete` — the bounded, validated, latest-wins root bootstrap is implemented on `codex/pwa-session-bootstrap-hardening`, based on `main@26ecae6`. All three functional criteria and the complete local gate pass. Functional completion is `3/3 = 100%`; lifecycle remains IN PROGRESS until required GitHub CI is available. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI —, DEPLOY N/A, LIVE N/A.
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
- Current merged source is `main@26ecae6e6cd0ec0c8a3fd2307b7434970c11edf4` (PR #207). PR-head runs `31744423393` and `31744423370` passed; exact-main runs `31744712542` and `31744712601` passed. Component CD run `31744712488` deployed web and API from the exact merge SHA, verified running image identity and localhost health, and the bounded public HTTPS probes returned 200 for `/healthz` and `/api/healthz`. This is deployment/health evidence, not a transcription canary.
- The successful job exposed a real usability defect: on terminal transition its active progress card disappeared into history. PR #200 contains the source fix; production proof still depends on the staged schema/API/worker rollout and a real UI canary.
- Final branch review found two continuity gaps in the first local implementation: dismissal authority was component-local and concurrent polling discarded the terminal snapshot. The corrective commit makes dismissal owner-scoped and durable in PostgreSQL, backfills pre-existing terminal history as already dismissed, and retains non-requested progress snapshots until explicit dismissal.
- Batch progress remains HTTP-polled and evidence-based. The server can report part-level movement only after each prepared ElevenLabs part returns successfully. A single unsplit provider request has no truthful intermediate percentage because the synchronous provider response exposes no such checkpoint.
- The two-project option is deliberately pre-launch and narrow: one source, one whole-second boundary, exactly two parts and two different folders. Once created, each job is independent and immutable; arbitrary editing/cutting remains excluded.
- The screenshot width loss is a source CSS constraint, not a PWA platform limitation: the previous main element was centered behind a `1360px` maximum. The branch removes that cap, keeps the responsive breakpoint, and narrows the project selector column so the transcription builder receives the reclaimed space.
- Migrations `0018_job_part_progress`, `0019_job_media_clip`, and `0020_provider_part_checkpoints` are additive but still stateful. Production is now at exact head `0020` through the protected one-successor lane; matching API and worker deployment evidence is retained. Ordinary component CD must still not apply migrations, and the explicit partial-provider continuation remains unproven until a bounded live canary occurs.
- Realtime remains deliberately outside the batch worker/stateful path. It adds no migration, queue, job, source, output, catalog, or analytics state. Exact API/web deployment, the separately reviewed public-host header correction, and one successful tab/display-audio session are now evidenced. The remaining browser modes and negative lifecycle cases are still separate canaries.
- The edge-CD candidate addresses the operational gap exposed by that rollout: repository header policy and the active root-owned nginx snippet had drifted, forcing repeated manual mutation. Its source automation is not deployment proof; the dedicated VPS identity, GitHub protected environment/secrets/disabled flag, merge, and first approved release remain explicit gates.

## Readiness snapshot

Percentage means completed functional acceptance criteria divided by all functional acceptance criteria, without weights. SPEC/CODE/TEST/CI/DEPLOY/LIVE remain separate READY gates and are not added to the percentage denominator. Rows explicitly named delivery/rollout Evidence are gate coverage, not feature-completion percentages.

| Contour/dimension | Evidence-based estimate | Meaning |
| --- | ---: | --- |
| Project, all current scope | **N/A (numerator/denominator are not defined)** | `project-spec.md` still lacks one closed, non-overlapping project-wide acceptance set. This is a canonical coverage gap, not permission to average epic percentages. |
| Project delta after task 34 | **N/A → N/A** | PR #207 closes delivery gates for tasks 03–30, while tasks 31–34 each complete their local functional denominator at `3/3`; none supplies the undefined canonical project-wide denominator. A project percentage still requires a separately authorized atomic AC normalization in `project-spec.md`. |
| Stable Colab batch + Realtime | **100% (`2/2` operator-accepted contours)** | The current explicit owner evidence accepts both implemented Colab contours after about four months of stable use. This does not erase the subordinate Realtime runbook's stale/manual-gap conflict; that conflict is an Evidence/readiness issue. |
| Studio PWA Live functional contract | **100% (`7/7`)** | All seven accepted first-slice behavior criteria in `project-spec.md` are implemented at source level. READY remains gated separately: delivery evidence is `5/6`, with microphone-only, mixed, and negative lifecycle canaries still open. |
| `PWA-DIAGNOSTICS-DEBUG-SESSION-34` | **100% (`3/3`)** | Bounded/latest-wins validated status reads, single-flight bounded start/stop, authoritative ambiguity reconciliation without ambiguity-driven mutation replay, teardown ownership, and the complete local gate are implemented. Status remains IN PROGRESS because publication and required GitHub CI have not occurred. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI —, DEPLOY N/A, LIVE N/A. |
| `PWA-AUTH-LOGOUT-BOUNDARY-33` | **100% (`3/3`)** | Bounded single-flight logout, validated success, authoritative ambiguity reconciliation without POST replay, safe retry UI, teardown invalidation, and the complete local gate are implemented. Status remains IN PROGRESS because publication and required GitHub CI have not occurred. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI —, DEPLOY N/A, LIVE N/A. |
| `PWA-AUTH-LOGIN-BOUNDARY-32` | **100% (`3/3`)** | The bounded pre-auth bootstrap read, single-flight two-stage login mutation, shared auth DTO validation, teardown ownership, safe errors, and complete local gate are implemented. Status remains IN PROGRESS because publication and required GitHub CI have not occurred. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI —, DEPLOY N/A, LIVE N/A. |
| `PWA-AUTH-SESSION-BOOTSTRAP-31` | **100% (`3/3`)** | The bounded two-stage request, DTO validation, fail-closed recovery, session-generation isolation, and complete local validation are implemented. Status remains IN PROGRESS because publication and required GitHub CI have not occurred. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI —, DEPLOY N/A, LIVE N/A. |
| `PWA-PREPARATION-PREREQUISITE-BOUNDARY-30` | **100% (`3/3`)** | Shared validated credential/policy requesters, independent 15-second latest-wins/teardown boundaries, safe explicit retry, fail-closed controls, stale-remount suppression, and full applicable local validation are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-OVERVIEW-COLLECTION-BOUNDARY-29` | **100% (`3/3`)** | Exact shared collection validation, independent bounded/latest-wins/teardown reads, safe per-summary retry, last-known-data preservation, and full applicable local validation are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-GOOGLE-CONNECTION-CONSUMERS-28` | **100% (`3/3`)** | Shared exact DTO validation, bounded/latest-wins Overview and Projects reads, explicit retry, reactivation refresh, stale-response rejection, fail-closed Picker gating, and full applicable local validation are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-GOOGLE-CONNECTION-BOUNDARY-27` | **100% (`3/3`)** | Exact semantic DTO/redirect capability validation, bounded latest-wins reads, remount-safe OAuth/disconnect ownership, logout invalidation, ambiguity reconciliation without replay, sequential disconnect audit idempotence, and all available local gates are complete. The service-backed backend regression passed in CI; PR #207 is merged and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-RETENTION-PREFERENCE-BOUNDARY-26` | **100% (`3/3`)** | Exact five-option DTO validation, bounded latest-wins reads, remount-safe PATCH ownership/outcomes, authoritative ambiguity confirmation, last-known-state preservation, and full applicable local validation are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-CREDENTIAL-LIFECYCLE-BOUNDARY-25` | **100% (`3/3`)** | Terminal backend deletion/idempotent revoke-delete replay behavior, validated bounded list reads, exact remount-safe mutation ownership, fail-closed ambiguity reconciliation, immediate raw-input clearing, and all available local frontend/static gates are complete. The service-backed backend regression passed in CI; PR #207 is merged and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-PROJECT-MUTATION-BOUNDARY-24` | **100% (`3/3`)** | Validated bounded project-list reads, exact create/update/archive single-flight ownership, fail-closed ambiguity reconciliation, project-scoped safe outcomes, draft preservation, and full applicable local validation are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-GOOGLE-PICKER-REMOUNT-23` | **100% (`3/3`)** | Exact owner-scoped source/folder Picker lifecycle, remount-safe pending UI, duplicate blocking, project-isolated safe outcomes, and full applicable local validation are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-GOOGLE-SELECTION-BOUNDARY-22` | **100% (`3/3`)** | Bounded single-attempt source creation with authoritative list refresh on ambiguity, bounded folder verification, runtime DTO validation, safe unlock, and full applicable local validation are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-GOOGLE-PICKER-TIMEOUT-21` | **100% (`3/3`)** | Bounded and validated composer session acquisition, bounded callback lifecycle with safe unlock/token cleanup, and full applicable local validation are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-LOCAL-UPLOAD-REMOUNT-20` | **100% (`3/3`)** | Persistent ID-only ownership, detached-operation blocking, project-isolated safe outcomes, explicit-retry clearing, same-panel row concurrency, and full applicable local validation are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-LOCAL-UPLOAD-BOUNDARY-19` | **100% (`3/3`)** | Bounded initiation/PUT execution, fail-closed non-idempotent initiation ambiguity, exact-source PUT recovery without object replay, and full applicable local validation are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-SOURCE-DELETE-REMOUNT-18` | **100% (`3/3`)** | Persistent exact-source ownership, remount-safe pending UI, project-isolated safe outcomes, explicit-retry clearing, and full applicable local validation are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-LOCAL-UPLOAD-COMPLETE-17` | **100% (`3/3`)** | Bounded completion, exact uploaded/pending recovery authority, one safe completion-only replay, and full applicable local validation are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-SOURCE-DELETE-RECOVERY-16` | **100% (`3/3`)** | Same-act deletion deduplication, bounded DELETE plus exact-ID authoritative reconciliation, and full applicable local validation are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-BATCH-CREATE-RECOVERY-15` | **100% (`3/3`)** | Bounded preflight/create execution, persistent exact-key/body recovery without automatic POST replay, and full applicable local validation are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-JOB-MUTATION-TIMEOUT-14` | **100% (`3/3`)** | Bounded non-retrying POST execution, endpoint-specific authoritative timeout reconciliation, and full applicable local validation are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-JOB-MUTATION-OUTCOME-13` | **100% (`3/3`)** | Safe owner-scoped outcomes, remount/project isolation and explicit-retry clearing, and full applicable local validation are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-JOB-MUTATION-OWNERSHIP-12` | **100% (`3/3`)** | Persistent four-kind mutation ownership, project-switch duplicate prevention/unlock behavior, and full applicable local validation are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-PROJECT-COLLECTION-TIMEOUT-11` | **100% (`3/3`)** | Bounded source/job collection reads, safe cancellation and last-known-data preservation, and full applicable local validation are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-JOB-READ-TIMEOUT-10` | **100% (`3/3`)** | Four bounded job-read paths, safe timeout/supersede/teardown behavior, and full applicable local validation are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-JOB-DISMISS-DEDUP-09` | **100% (`3/3`)** | Terminal-dismiss mutation deduplication, accessible pending/failure-unlock behavior, and full applicable local validation are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-JOB-RECONCILIATION-DEDUP-08` | **100% (`3/3`)** | Reconciliation mutation deduplication, accessible pending/failure-unlock behavior, and full applicable local validation are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-JOB-RETRY-DEDUP-07` | **100% (`3/3`)** | Provider-cost retry deduplication, accessible pending/failure-unlock behavior, and full applicable local validation are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-JOB-CANCEL-DEDUP-06` | **100% (`3/3`)** | In-flight mutation deduplication, accessible pending/unlock behavior, and full applicable local validation are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-JOB-DETAIL-ORDERING-05` | **100% (`3/3`)** | Detail/output ordering, retry/reconciliation metadata ordering, and full applicable local validation are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-JOB-PROGRESS-POLLING-03` | **100% (`4/4`)** | Rejected/stalled request recovery, bounded backoff/abort cleanup, reconciliation continuity, and full applicable local gates are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
| `PWA-PROJECT-LIST-ORDERING-04` | **100% (`3/3`)** | Sources ordering, jobs ordering, and full applicable local validation are complete. PR #207 is merged; PR-head and exact-main CI passed, so status is READY. Evidence: SPEC ✅, CODE ✅, TEST ✅, CI ✅, DEPLOY N/A, LIVE N/A. |
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
| `PWA-REALTIME-TRANSCRIPTION-01` delivery Evidence | **83% (`5/6`)** | Checks 1–5, merge, exact-main CI, API/web deployment, public-host policy, and one real tab/display-audio session are evidenced. Gate 6 remains incomplete until microphone-only, mixed, and negative lifecycle canaries are recorded. |
| `PWA-STUDIO-EDGE-CD-01` | **80% (`4/5`)** | Canonical configuration, fail-closed release/wrapper, protected workflow, green merge/exact-main CI, and the dedicated VPS bootstrap are evidenced. One approved live release plus its browser canary form the final gate. |

For rows explicitly named delivery/rollout Evidence, the denominators are readiness gates. Local code, a green workflow summary with skipped jobs, or an idle healthy worker cannot advance a deployment, migration, provider, or canary gate by itself.

## Active item

`PWA-DIAGNOSTICS-DEBUG-SESSION-34` functional acceptance checks:

1. `GET /diagnostics/debug-session` is runtime-validated, bounded, latest-wins, and cancelled on diagnostics teardown. Timeout, transport/HTTP failure, or malformed success fails closed with predefined UI and explicit retry; stale or raw fields are never rendered.
2. `POST` start and `DELETE` stop are bounded, single-flight, runtime-validated, and teardown-owned. Timeout, transport/HTTP failure, conflict, or malformed success performs no ambiguity-driven mutation replay and uses one separately bounded authoritative GET reconciliation to confirm active/inactive state, expose accessible pending/safe outcomes, and permit explicit retry. The existing retry after an exact CSRF rejection remains the only safe mutation retry path.
3. Focused DEBUG-session regressions, the complete App/Studio suites, TypeScript, ESLint, production build, lightweight repository checks, and `git diff --check` pass.

Functional completion is **100% (`3/3`)** on `codex/pwa-session-bootstrap-hardening`, based on `main@26ecae6e6cd0ec0c8a3fd2307b7434970c11edf4`. Focused diagnostics/DEBUG regressions `9/9`, the complete App suite `196/196`, the complete Studio suite `464/464`, TypeScript, ESLint, production build, lightweight repository checks, and `git diff --check` pass.

Readiness gate is separate: SPEC ✅, CODE ✅, TEST ✅, CI —, DEPLOY N/A, LIVE N/A. Lifecycle status is IN PROGRESS pending publication and required GitHub CI.

Non-goals: no diagnostics event/system/export changes, backend DEBUG policy/duration/retention, API-shape, migration, CI/CD, deploy, or production-state change.

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

After task 34 reaches its local gates, inspect exactly one remaining diagnostics read/export boundary and select it only with direct code evidence. No additional scope is pre-authorized by this placeholder.

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

- Diagnostics DEBUG-session task 34: the focused diagnostics/DEBUG block passed (`9/9`), the complete App suite passed (`196/196`), and the complete Studio suite passed (`464/464` in `37/37` files). TypeScript, ESLint, the Vite/PWA production build (`1618` modules), lightweight repository checks, and `git diff --check` passed. Coverage includes bounded/latest-wins validated GET, explicit retry, bounded single-flight POST/DELETE, validated active/inactive dates, timeout/malformed/conflict reconciliation through one authoritative GET without ambiguity-driven mutation replay, raw-field suppression, and diagnostics teardown cancellation. The shared CSRF helper may retry only after an exact CSRF rejection, which proves that the rejected attempt did not mutate state. An initial complete-App run passed `195/196` and exposed that simultaneous events/DEBUG errors produced two identically named retry buttons; the DEBUG action was made explicitly named `Повторить проверку DEBUG`, after which focused `9/9` and complete `196/196` reruns passed. No diagnostics event/system/export, backend DEBUG policy/duration/retention, API-shape, migration, CI/CD, deploy, or production-state change is included.
- Logout-boundary task 33: focused logout/session regressions passed (`6/6`), the complete App suite passed (`193/193`), and the complete Studio suite passed (`461/461` in `37/37` files). TypeScript, ESLint, the Vite/PWA production build (`1618` modules), lightweight repository checks, and `git diff --check` passed. Coverage includes synchronous duplicate-click exclusion, a shared bounded signal for optional CSRF refresh and logout, validated `ok: true`, one bounded authenticated bootstrap reconciliation after timeout/malformed success, no logout POST replay, authoritative anonymous `401`, authenticated recovery with a fresh CSRF token and explicit retry, raw-field suppression, and root-shell teardown cancellation. No backend, cookie/session-lifetime, API-shape, OAuth, migration, CI/CD, deploy, or production-state change is included.
- Login-boundary task 32: focused Login regressions passed (`5/5`), related App auth regressions passed (`4/4`), the complete App suite passed (`190/190`), and the complete Studio suite passed (`458/458` in `37/37` files). TypeScript, ESLint, the Vite/PWA production build (`1618` modules), lightweight repository checks, and `git diff --check` passed. Coverage includes hidden-until-authoritative bootstrap UI, bootstrap timeout and malformed-response retry, the valid operator-only bootstrap state, one shared bounded signal for both login POST stages, synchronous single-flight ownership, explicit retry after timeout, shared auth DTO validation, raw-field suppression, and teardown cancellation with late-success rejection. No backend, password-policy, cookie, OAuth, API-shape, migration, CI/CD, deploy, or production-state change is included.
- Session-bootstrap task 31: focused auth regressions passed (`6/6`), the complete App suite passed (`190/190`), and the complete Studio suite passed (`453/453`). TypeScript, ESLint, the Vite/PWA production build (`1617` modules), lightweight repository checks, and `git diff --check` passed. Coverage includes timeouts in both bootstrap stages, shared AbortSignal propagation, explicit retry, malformed and cross-user DTO rejection without raw-field rendering, StrictMode teardown, stale-generation suppression, and logout invalidation. No backend, cookie, OAuth, API-shape, migration, CI/CD, deploy, or production-state change is included.
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

# Delivery plan

## Current dashboard

- ✅ `PWA-CATALOG-DURABLE-IDEMPOTENCE-04` — PR #199 merged as `bd8d513`. PR-head and exact-main repository/Studio CI passed. Exact-main component CD deployed web and API; the migration release job was correctly skipped.
- ✅ `PWA-MIGRATION-ENVIRONMENT-PROBE-02` — exact-main run `30718275780` remained environment-gated for about 20 minutes before the approved no-op job started. This supplies the previously missing required-review evidence without VPS or migration action.
- ✅ `PWA-WORKER-OPS-01 / current baseline` — manual exact-main worker deployment run `30721775811` succeeded and status run `30721817365` completed for `main@bd8d513`. The operator then completed a real batch transcription successfully. That run is useful bounded production evidence, not proof of every media/options/failure scenario.
- 👉 `PWA-JOB-PROGRESS-02` — active on `codex/pwa-job-progress-02`. The candidate keeps a newly terminal job visible, loads its result, exposes an explicit **Убрать в историю** action, calculates progress only from confirmed checkpoints, and persists safe completed/total ElevenLabs part counters through additive migration `0018_job_part_progress`. Local source gates are complete; CI, merge, protected migration, API/worker deployment, and production canary are absent.
- 👉 `PWA-TWO-PROJECT-SPLIT-01` — included in the same branch batch. An optional composer control expands one source into two immutable complementary clip jobs, requires two different verified output folders, validates duration before the first provider request, clips server-side, scopes duplicate authority by clip, and labels both parts in job history. Local source gates are complete through additive migration `0019_job_media_clip`; CI and every rollout gate are absent.
- 📋 `PWA-REALTIME-TRANSCRIPTION-01` — next product epic. Bring the existing experimental realtime Colab capability into a separate tab on the same PWA transcription page. Design must preserve the single-use-token, browser capture, WebSocket, transcript-content, and no-Google-Docs boundaries before implementation.
- 📋 `PWA-TRANSCRIPT-MAINTENANCE-CANARY-04` — complete the bounded recursive-folder and single-document dry-run/apply matrix. Every state-changing apply remains a separate explicit user decision.
- 📋 `PWA-TRUSTED-PROXY-01 / production evidence` — source contract is merged; bounded production peer observation and separately reviewed runtime configuration remain absent.
- 📋 `PWA-LEGACY-SUCCESSOR-DISCOVERY-01 / consumer decision` — compatibility APIs advertise successors, but removal/support still requires external-consumer evidence and an explicit decision.

## Audit conclusion

- Stable Colab batch remains accepted at **100%** for its current scope. Realtime Colab remains a separate experimental contour.
- Current merged source is `main@bd8d5132594de6f99ae7c64e296a7feb905f7df5`. Exact-main CI, web/API component deployment, manual worker deployment/status, production revision `0017_google_maintenance_oauth`, and at least one operator-reported successful real batch transcription are distinct pieces of evidence and are all now present.
- The successful job exposed a real usability defect: on terminal transition its active progress card disappeared into history. The current branch fixes that observed behavior rather than expanding speculative test coverage.
- Batch progress remains HTTP-polled and evidence-based. The server can report part-level movement only after each prepared ElevenLabs part returns successfully. A single unsplit provider request has no truthful intermediate percentage because the synchronous provider response exposes no such checkpoint.
- The two-project option is deliberately pre-launch and narrow: one source, one whole-second boundary, exactly two parts and two different folders. Once created, each job is independent and immutable; arbitrary editing/cutting remains excluded.
- Migrations `0018_job_part_progress` and `0019_job_media_clip` are additive but still stateful. Ordinary component CD must not apply them. The protected migration lane, exact API/worker deployment, and bounded production UI canaries remain required after merge.

## Readiness snapshot

| Contour/dimension | Evidence-based estimate | Meaning |
| --- | ---: | --- |
| Stable Colab batch | **100%** | Accepted current scope and operational fallback. |
| Selected Studio v1 baseline source/CI on `main` | **100% (`40/40`)** | PR #199 merged and exact-main repository/Studio CI passed. This is source/CI, not universal production proof. |
| Studio batch production usability baseline | **80% (`4/5`)** | Exact source/CI, current schema/API/web, intended worker, and a real successful job are evidenced. The terminal progress/result continuity gate failed in real use. |
| `PWA-JOB-PROGRESS-02` local source candidate | **100% (`4/4`)** | Terminal visibility, checkpoint percentage, durable N/M parts, and focused validation/documentation are present on the branch. |
| `PWA-JOB-PROGRESS-02` production rollout | **0% (`0/4`)** | Required gates are merged CI; branch schema/API rollout through `0019`; worker identity/health; real UI canary. None applies to the unmerged branch. |
| `PWA-TWO-PROJECT-SPLIT-01` local source candidate | **100% (`6/6`)** | Composer UX, complementary API validation, immutable persistence, clip-aware duplicate authority, pre-provider server clipping, and focused validation are present on the branch. |
| `PWA-TWO-PROJECT-SPLIT-01` production rollout | **0% (`0/5`)** | Required gates are merged CI; `0018`/`0019` plus API rollout; worker identity/health; two-folder dry-run; real two-output canary. None applies to the unmerged branch. |
| Protected migration lane operational evidence | **100% (`5/5`)** | Source/CI, VPS forced-command boundary, successful protected release, disabled post-release flag, and visible reviewer wait/approval are evidenced. |
| Transcript-maintenance source acceptance on `main` | **100% (`10/10`)** | Durable post-apply rediscovery fix and required CI are merged. |
| Transcript-maintenance rollout | **50% (`2/4`)** | Runtime/OAuth/schema and exact API identity/health are evidenced; full target-mode dry-run/apply matrix is not. |
| `PWA-REALTIME-TRANSCRIPTION-01` | **0% (`0/6`)** | PWA tab, token endpoint, capture lifecycle, realtime session, safe transcript UX, and validation/rollout are not implemented in Studio. |

The denominators are explicit gates. Local code, a green workflow summary with skipped jobs, or an idle healthy worker cannot advance a deployment, migration, provider, or canary gate by itself.

## Active item

Current branch batch acceptance checks for `PWA-JOB-PROGRESS-02`:

1. A job transitioning from `queued/processing` to terminal remains visible in the current project view and its safe detail/output is loaded automatically.
2. The user can explicitly dismiss the retained terminal card into history; refresh and ordinary history behavior remain intact.
3. The displayed percentage uses only confirmed server checkpoints and completed/total prepared provider parts. It never advances from elapsed time.
4. PostgreSQL persists only bounded integer part counters on the current source attempt; transcript content, provider payloads, storage identity, lease authority, and failure detail remain absent from the browser DTO.
5. Counter updates are monotonic, lease-fenced, committed after each successful provider part, and fail closed after a partial provider result or lost lifecycle authority.
6. Progress persistence is the direct additive `0018_job_part_progress` migration and the branch head is its direct additive successor `0019_job_media_clip`; ordinary component CD applies neither.
7. Focused backend/frontend tests, TypeScript, ESLint, and portable repository checks pass.
8. Required PR/exact-main CI, protected migration, API/worker identity and health, and one production UI canary are separately evidenced.

Checks 1–7 are complete on the local branch. Check 8 is entirely open.

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

Checks 1–7 are complete on the local branch. Check 8 is entirely open.

## Next item

`PWA-REALTIME-TRANSCRIPTION-01` starts with a focused contract/design task:

1. Add a separate **Live transcription** tab inside the existing PWA transcription page; batch behavior remains unchanged.
2. Reuse the proven realtime contour only after mapping its single-use server token, `scribe_v2_realtime` session, microphone/display input combinations, VAD commit semantics, and Stop/permission-race lifecycle to Studio ownership and CSRF rules.
3. Keep the primary ElevenLabs API key server-only; the browser receives only a short-lived single-use realtime capability.
4. Keep live transcript text browser-only for the first slice, with ordered partial/committed presentation plus copy/download/clear. Google Docs, catalog, analytics, and batch jobs are non-goals until separately authorized.
5. Define reconnect, token reuse/expiry, browser refresh, multi-tab, rate-limit, logging, and content-retention behavior before code.
6. Validate microphone-only first, then display-only/mixed capture and cross-browser behavior as separate gates.

## Near backlog

1. Merge and roll out the progress plus two-project split branch through its stateful release gates.
2. Design and implement the first safe microphone-only Studio realtime slice.
3. Complete transcript-maintenance target-mode canaries.
4. Verify trusted reverse-proxy peer identity before any runtime value change.
5. Collect external-consumer evidence for deprecated compatibility routes.

## Current blockers

- The branch is not pushed or reviewed and changes repository head from production `0017` to candidate `0019` through the additive `0018`/`0019` chain.
- Windows-local operational shell tests need Bash, and PostgreSQL integration tests need the service-backed CI environment. The portable focused suites are green; CI evidence is still absent.
- Exact part progress is available only for media split into multiple provider requests. The current synchronous provider call exposes no honest within-part percentage.
- Studio realtime is not implemented; only the separate experimental Colab prototype and its partial runtime evidence exist.
- Transcript-maintenance rollout still lacks the complete target-mode canary matrix.

## Validation notes

- Branch: `codex/pwa-job-progress-02`, based on clean `main@bd8d513`; after the progress and split source implementation it is `0 behind / 12 ahead` before this documentation commit.
- Final focused backend split gate: `55 passed` across clip normalization, media preparation, batch preflight, duplicate/catalog authority, browser DTOs, and schema shape. Earlier progress-focused suites remain separate commit evidence.
- Final focused frontend gate: `150 passed` across the complete App suite plus composer, job-model, and job-card suites; TypeScript build and targeted ESLint passed.
- Lightweight repository checks passed. PostgreSQL-backed integration tests still require the service-backed CI environment and were not counted as local passes.
- Operational test attempt was correctly limited by local prerequisites: Bash is unavailable and local PostgreSQL at `127.0.0.1:5432` is not running. This is not CI evidence and does not count as a pass.
- GitHub evidence refreshed on 2026-08-02: PR #199 merge `bd8d513`; exact-main CI runs `30702706377` and `30702706378`; web/API CD run `30702706409`; no-op review probe `30718275780`; manual worker deployment `30721775811`; worker status `30721817365`.
- Operator evidence: a real production batch transcription completed successfully after worker activation; the terminal progress card disappeared until found in history, which is the observed defect for this item.
- Self-review: the package changes job-result continuity, browser-safe progress projection, fenced integer part counters, and the narrowly authorized two-project split with immutable clip bounds. It does not permit arbitrary editing after launch, add WebSockets to batch, expose content, implement realtime, deploy, migrate, or mutate production.

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

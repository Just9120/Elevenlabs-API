# Delivery plan

## Current dashboard

- ✅ `PWA-FRONTEND-MODULARIZATION-01B/02` — The first two behavior-preserving frontend tranches are merged through PR #180 at `605cbae`; repository, Studio, authenticated Chromium, and web deployment checks passed.
- ✅ `PWA-PROCESSING-ROLLOUT-01A / Gate 0A` — PR #181 merged the manual-only read-only worker-status path at `749833c`; run `29925528002` safely proved one running, not-drained worker while leaving its image identity unknown.
- ✅ `PWA-PROCESSING-ROLLOUT-01A / Gate 0B` — PR #182 merged the controlled drain path at `850bfdf`; run `29929528124` gracefully drained the worker, and preflight run `29929607368` passed runtime/service/local/public checks before blocking on production database revision mismatch.
- ✅ `PWA-PROCESSING-ROLLOUT-01A / Gates 0C–3` — PR #183 merged the processing source batch at `77a3b39`. A tagged restic/R2 PostgreSQL backup completed as snapshot `7b03ad00`; the authorized migration then applied `0011 → 0012 → 0013 → 0014 → 0015`. Isolated API deployment run `30004599136` succeeded, and post-deploy preflight run `30004696267` proved database head `0015_user_source_retention`, healthy PostgreSQL/Redis, and passing public API/web health.
- ✅ `PWA-PROCESSING-SOURCE-BATCH-01` — Transcription language/diarization, validated multi-source intake, video and long-media preparation, batch preflight/progress, aggregate analytics, transcript-catalog duplicate decisions, and the final provider-call guard are merged through PR #183. Source and CI evidence is complete for that batch; real provider/Google behavior still belongs to the controlled rollout gates.
- ✅ `PWA-UX-STABILIZATION-04 / Gate 4 diagnostics baseline` — PR #184 is merged at current `main` revision `89fa7d5`. The safe Picker diagnostics and walkthrough-driven navigation, preparation, credential-safety, and analytics-copy changes are now the released source baseline.
- 👉 `PWA-LOCAL-UPLOAD-STABILIZATION-05 / Gate 4 completion` — Active branch `codex/pwa-upload-recovery`. Nine implementation commits make upload completion idempotent, recover ambiguous PUT/completion outcomes without re-upload, reject placeholder storage credentials before deployment, prevent concurrent uploads per row, validate browser capabilities/responses at runtime, improve safe storage diagnostics, and explain asynchronous cleanup. The branch still requires the full pre-PR gate, CI, deployment, and a clean public re-smoke.
- ⏸ `PWA-PROCESSING-ROLLOUT-01A / Gates 5–6` — Worker deployment and the one-output canary remain blocked until the current upload batch is merged/deployed and Gate 4 authenticated prerequisites are re-verified. Worker-status run `30004841628` still reports the worker exited with `exit_code=0` and gracefully drained; its image identity remains unknown.
- ⏸ `PWA-FRONTEND-MODULARIZATION-03` — Preparation composer/readiness extraction is deferred until the production baseline is known or rollout is waiting on an explicit operator window.

## Audit conclusion

- The stable Colab batch contour remains frozen and accepted at **100%** for its current operational scope. Experimental realtime work is a separate contour and is not included in that claim.
- Studio has broad source-level implementation at merged `main` revision `89fa7d5`. The dominant remaining blocker is a clean authenticated public boundary followed by controlled worker/canary evidence, not missing core ElevenLabs processing code.
- Production PostgreSQL has a verified tagged backup boundary (`7b03ad00`) and is migrated through `0015_user_source_retention`. API deployment run `30004599136` and post-deploy preflight `30004696267` replace the older `0011`/revision-mismatch evidence.
- The worker remains intentionally stopped and gracefully drained. Run `30004841628` confirms the safe stopped state but not image provenance; do not describe worker processing as production-live.
- The latest operator smoke supersedes the original all-Picker-failed walkthrough: Google Drive selection appeared available, and one local R2 upload completed after the missing CORS policy and invalid storage credential were corrected and the API was redeployed. The first ambiguous attempt plus a second successful attempt produced duplicate stored objects, and one completion request returned `403`; this branch addresses those client/API recovery gaps. Output-folder selection, security headers, and a clean post-fix single-upload smoke remain unproven.
- Studio Platform CD is not generally broken: migration-changing pushes intentionally suppress automatic API deployment, and worker deployment is intentionally manual-only. The workflow currently makes this safe skip too easy to mistake for a complete green deployment; that observability gap is a focused follow-up.
- The authenticated Playwright scenario proves the browser shell through live FastAPI/PostgreSQL/Redis with controlled boundaries. It does not call ElevenLabs, Google, S3/R2, or production and therefore does not replace the controlled canary.

## Readiness snapshot

| Contour/dimension | Current estimate | Meaning |
| --- | ---: | --- |
| Stable Colab batch | **100%** | Accepted current scope; do not reopen without an explicit maintenance/product task. |
| Studio source breadth | **about 98%** | Core processing, safety, analytics, and duplicate-authority work is merged. Historical Drive catalog import/standardization, accepted-output reuse, finer optional telemetry, and final rollout evidence remain. |
| Studio UX readiness | **about 80% on `main`; about 83% candidate** | PR #184 fixes the recorded walkthrough issues at source level. The current branch adds local-upload recovery and clearer cleanup behavior, but its candidate value requires CI and deployment before it becomes released evidence. |
| Studio production evidence | **about 71%** | Backup, migration, current API, database, services, public health, and one corrected local-upload success are evidenced. A clean post-fix smoke, current worker identity/deploy, and the one-output canary are not. |
| Studio combined v1 readiness | **about 71% deployed; about 73% candidate** | The candidate increase is deliberately small: upload reliability improves, but production readiness cannot jump until the branch is merged/deployed and Gates 4–6 produce factual evidence. |

Documentation, diagnostics, or behavior-preserving refactors do not raise these estimates by themselves. A rollout gate changes production evidence only after its factual result is recorded; a feature changes source breadth only after implementation and relevant validation.

## Release-critical roadmap

### Gate 0 — read-only production truth (completed)

1. Confirm the intended `main` SHA and green post-merge repository/Studio CI.
2. Dispatch `Studio Processing Preflight` from `main` only after explicit operator authorization, using the full intended SHA.
3. Capture only the workflow's secret-free table: checkout/remote/branch/commit identity, clean tracked tree, required file presence, service counts/health, localhost/public health, repository head, production revision, and worker count.
4. Treat a blocked revision-equality result as useful truth, not as permission to mutate production. Do not start a worker, provider call, Google call, job, backup, migration, deploy, or retry in this gate.

Initial attempt: run `29918894603` passed checkout/remote/branch/commit/clean-tree checks, runtime configuration and required secret-file presence, and Compose-reported counts/status for PostgreSQL, Redis, API, and web. It then blocked on one running `studio-worker`. Dedicated health, public routing, Alembic, and authenticated preparation rows were not reached.

Initial worker evidence: after PR #181 and green post-merge repository CI run `29925230146`, read-only status run `29925528002` validated the clean production checkout at `605cbae` and completed with `STUDIO_WORKER_STATUS_OK`. At that checkpoint exactly one worker was running with exit code `0`; it was not drained, had no Docker health check, had no matching `605cbae` commit tag, had unknown image identity, and had no rollback candidate.

Prior blocking attempt: after PR #182 and green post-merge repository CI run `29929236644`, drain run `29929528124` completed with `STUDIO_WORKER_DRAIN_WORKFLOW_OK` and confirmed `container_state=exited`, `exit_code=0`, and `drain_state=gracefully-drained`. Read-only preflight run `29929607368` then passed checkout identity, runtime configuration, required secret-file presence, service topology, PostgreSQL/Redis health, localhost API/web health, public API/web health, repository head, and single production-revision detection. It correctly blocked at the pre-migration revision mismatch.

Exit: met. The subsequent authorized backup/migration/API sequence and post-deploy preflight supersede the earlier revision-mismatch checkpoint.

### Gate 1 — backup and migration readiness (completed)

1. Review the actual known production revision through `0015`, current CI migration evidence, expected additive/data-update effects, and rollback boundary. Do not infer the baseline from the last proven API deployment.
2. Confirm PostgreSQL/Redis health and the configured restic/R2 backup boundary without printing secret values.
3. Create a tagged `pre-migration` PostgreSQL backup with the approved script and verify its safe metadata according to the operations runbook.
4. Stop if the backup is missing, ambiguous, concurrent, or unverifiable.

Exit: met. Restic/R2 snapshot `7b03ad00` was saved with tags `pre-migration,studio-postgres`; the repository reported nine retained snapshots under the 90-day policy before migration began.

Decision record used for the completed operator action:

- Baseline: accept only one normalized production revision that exists in the checked-out repository migration inventory. Unknown, missing, or multiple revisions are a hard stop. The last GitHub-proven API deployment at repository head `0011_diagnostic_debug_sessions` is historical context, not proof that production remains at `0011`.
- Forward path: if the trusted preflight proves `0011`, the candidate chain is exactly `0012_output_reconciliation_cases → 0013_job_retry_recovery → 0014_source_deletion_retention → 0015_user_source_retention`. If it proves another known ancestor, review only the actual remaining suffix; if it is not an ancestor of `0015`, stop and investigate rather than improvising.
- Effects: `0012` creates durable output-reconciliation state; `0013` creates durable retry-attempt state; `0014` adds source-cleanup state and classifies existing source lifecycle rows; `0015` adds the per-user source-retention preference with the current default and allowlist constraint.
- Rollback boundary: Alembic downgrade is not an operational rollback for this chain. Downgrading `0012` or `0013` drops durable tables, `0014` drops cleanup metadata and cannot reconstruct every prior lifecycle value changed during its upgrade, and `0015` drops stored user retention choices. Recovery therefore requires a verified pre-migration database backup/restore boundary, not an automatic downgrade.
- Backup go/no-go: require the exact known baseline, a still-gracefully-stopped worker, healthy PostgreSQL, no concurrent production maintenance, a separately authorized tagged pre-migration backup, and safe verifiable backup metadata under the operations runbook. Any ambiguity is no-go.
- Migration go/no-go: require separate explicit authorization after the backup evidence is accepted. Apply only the reviewed forward suffix, then verify one revision equal to `0015_user_source_retention` and PostgreSQL health. Do not resume or deploy a worker in the migration gate.

### Gate 2 — apply and verify database head (completed)

1. Run the manual migration script with explicit backup confirmation.
2. Verify exactly one production revision equal to `0015_user_source_retention`.
3. Recheck PostgreSQL health and record only revision/health evidence.
4. Stop on multiple/unknown revisions, health degradation, or any uncertainty; do not improvise a downgrade.

Exit: met. The manual script applied `0011_diagnostic_debug_sessions → 0012_output_reconciliation_cases → 0013_job_retry_recovery → 0014_source_deletion_retention → 0015_user_source_retention`; post-deploy preflight `30004696267` verified the resulting head and PostgreSQL health.

### Gate 3 — deploy and verify API (completed)

1. Manually dispatch the `api` component from the intended `main` SHA.
2. Require checkout fast-forward, built/running image identity equality, database/image Alembic equality, Docker health, and localhost API health.
3. Verify public API health and safe authenticated session behavior without processing a source.

Exit: met. Isolated API deployment `30004599136` succeeded, and run `30004696267` verified database/image compatibility plus localhost/public API and web health.

### Gate 4 — public browser boundary (active)

1. PR #184 has merged the safe Picker failure classification/diagnostics and walkthrough-driven UX batch. Confirm its repository/Studio CI and API/web deployment evidence together with the current upload-stabilization batch before closing this gate.
2. Reproduce one source-Picker open and one output-folder-Picker open from the public authenticated PWA.
3. Read only the allowlisted `GOOGLE_PICKER_SESSION_FAILED` reason and HTTP category. Do not inspect or expose refresh tokens, access tokens, raw Google responses, or private source data.
4. Follow the proven branch: reconnect Google for `google_reauthorization_required`; correct server Picker/OAuth configuration for `google_picker_not_configured`; investigate/retry boundedly for `google_token_unavailable`; stop on an unknown result.
5. Verify the committed host security-header policy, `nginx -t`, TLS/public routing, and the presigned local-upload initiation/completion boundary with no-store browser behavior.
6. Confirm the authenticated operator account has one active ElevenLabs credential, a valid Google connection, one writable output folder, and one small supported source.

Exit: the real public browser/API integration boundary is ready for one controlled job.

Current Gate 4 evidence is partial, so the exit is not met. The operator corrected R2 CORS and bucket-scoped credentials without exposing them, redeployed the API, and completed one local upload. Because that smoke included an ambiguous first attempt, a manual second attempt, duplicate objects, and a `403` completion response, it cannot be used as the clean single-upload acceptance run. Physical cleanup of deleted/expired local objects also remains pending while the worker is intentionally stopped.

### Gate 5 — deploy exactly one worker

1. Confirm the old worker is absent or explicitly drained/stopped.
2. Manually dispatch only the `worker` component.
3. Require intended checkout/image identity, database-head compatibility, Docker health, and exactly one healthy worker shown idle before the canary.

Exit: exactly one intended worker is healthy and idle; deploy success is not a production-live claim.

### Gate 6 — controlled one-output canary

1. Use one approved account, one small source, one owner-scoped ElevenLabs BYOK credential, one valid Google connection, and one selected writable folder.
2. Submit one job once. Do not manually retry, duplicate, replace, or start a second job when side-effect state is uncertain.
3. Require a safe terminal state. Success requires exactly one persisted output and one validated Google Doc in the selected folder.
4. Stop on duplicate output, provider/Google uncertainty, lease ambiguity, worker identity drift, or unsafe evidence.

Exit: all nine processing-readiness criteria in `docs/project-spec.md` have factual, secret-free evidence. Only then may Studio processing be described as production-live.

### Gate 7 — stabilization checkpoint

1. Verify the worker returns to healthy idle state and inspect owner-scoped safe diagnostics/reconciliation state.
2. Record deployed web/API/worker identities, database head, CI/CD run links, canary result, and residual risks in this dashboard.
3. Recalculate readiness from evidence and choose the next product milestone.

## Product roadmap after production proof

Order product work so that each capability inherits a known production baseline:

1. `PWA-E2E-FOUNDATION-01B` — extend authenticated browser coverage across preparation and job-result behavior with controlled provider/Google/S3 boundaries; keep the real canary separate.
2. `PWA-PREFLIGHT-UNCERTAINTY-01` — project the final provider guard's in-flight/unresolved conflict into a browser-safe preflight outcome so a stale job is rejected before preparation. The current accepted-output checkbox never overrides unresolved provider outcomes; changing that rule requires an explicit product decision.
3. `PWA-LEGACY-AUTHORITY-01` — confirm external consumers, then remove the two deprecated compatibility APIs or retain them with an explicit support/removal contract. The old static UI and obsolete stateless/full-platform deploy paths are already removed.
4. Golden Colab/PWA fixtures — lock normalization, ordering, output shape, and failure semantics before adding parity paths.
5. OpenAI short-media parity — add provider selection/credential/processing behavior without weakening the canonical batch and side-effect contracts.
6. Manifest/skip semantics — define the web-native durable equivalent and its relationship to PostgreSQL jobs/outputs before implementation.
7. Long-media parity — define size/duration limits, splitting/resume behavior, lease/heartbeat requirements, storage lifecycle, and cost-safe acceptance tests.
8. Multi-worker validation — only after single-worker production stability; prove claim/lease/heartbeat/recovery behavior under concurrency before increasing worker count.

Any change to the durable product meaning or acceptance criteria above requires an explicit user decision and a separate update to `docs/project-spec.md`.

## Maintainability and infrastructure lane

These tasks are valuable but do not outrank Gates 0–6:

1. `PWA-CD-OBSERVABILITY-01` — make component detection and migration-blocked API skips explicit in job summaries/tests so a green workflow cannot be read as a complete platform deploy.
2. Run the scheduled/manual dependency-audit workflow once and record remote evidence; GitHub currently reports no runs for this workflow.
3. Upgrade GitHub actions that emit the Node.js 20 deprecation annotation in a focused CI-maintenance task with workflow tests.
4. Resume `PWA-FRONTEND-MODULARIZATION-03`: extract bounded preparation composer/readiness behavior, then split `App.test.tsx` by the same domain boundaries.
5. Modularize `apps/studio-api/studio_api/main.py` into domain routers/response models, followed by a fixture-preserving split of `tests/test_studio_api_core.py`.
6. Simplify the 619-line `docs/ai-coding-workflow.md` in a dedicated documentation task; keep `AGENTS.md` as the lightweight router and avoid duplicating product/CI contracts.

Current large-file concentrations are maintainability signals, not automatic defects: `App.test.tsx` ~7.3k lines, `test_text_processing_helpers.py` ~4.0k, `test_studio_api_core.py` ~3.4k, `App.tsx` ~3.3k, and API `main.py` ~1.2k. The stable Colab implementation is deliberately excluded from opportunistic refactoring.

## Documentation disposition

- Keep the currently present core source/router/support documents in their assigned roles. No optional Context Bundle Builder or AI-delivery-infrastructure document should be created without a real requested workstream.
- Keep `docs/runbooks/repository-audit-2026-07-21.md` as a dated historical snapshot; its old readiness and sequence are superseded here.
- Keep the processing contract and Studio operations runbook separate: one owns processing invariants, the other owns operator procedure.
- Do not read or update `docs/delivery-plan-archive.md` during ordinary tasks. Move checkpoints/status chains there only on a separate explicit archive request.
- The remaining consolidation candidate is `docs/ai-coding-workflow.md`; simplify it only as a focused task, not during product or rollout work.

## Repeatable engineering pipeline

For every narrow task/commit:

1. Select exactly one active item from this dashboard and state its scope, non-goals, source documents, and acceptance check.
2. Work only on the current `codex/` batch branch. Before editing, verify a clean tree and record `main...HEAD` behind/ahead state.
3. Inspect only the relevant implementation and tests; update `docs/project-spec.md` only after an explicit scope/business-rule decision.
4. Implement the smallest safe change with its focused tests/docs.
5. Run the targeted gate: docs (`git diff --check`, `python scripts/ci_checks.py`, links/searches); frontend (lint, focused/full Vitest, build, Playwright when browser behavior changes); API (targeted pytest plus service-backed CI); migration/deploy (chain/script tests plus CI/CD safety review).
6. Commit the narrow task. After every commit report validation, `main...HEAD`, changed risk, Colab readiness, Studio source breadth, Studio production evidence, and combined readiness—even when unchanged.
7. Perform a short self-review: verify no scope creep, no secret/private evidence, no accidental production claim, and no untested behavior change.

For each 10–15-commit thematic batch:

1. Reconcile the batch against this dashboard and run the full applicable pre-PR gate.
2. Review the entire `main...HEAD` diff and commit series; do not hide known-red commits or unrelated product/deploy/dependency changes in one PR just to reach a count.
3. Push once, open a draft PR, wait for every required CI check, and add focused fix commits for failures.
4. Mark ready only when checks are green and the diff still matches the task contract. Merge remains a user action.
5. After merge, verify post-merge repository/Studio CI and inspect Studio Platform CD component-by-component; a green workflow with skipped jobs proves only the jobs that actually ran.
6. Fast-forward local `main`, delete the merged local/remote work branch, create the next `codex/` batch branch, and record the handoff commit.

For production/operator work, use a separate evidence pipeline: **read-only preflight → explicit authorization → backup → migration → API → public edge → one worker → one canary → stabilization**. Never collapse these into “merge means deployed,” and never auto-retry a migration, worker rollout, provider call, Google side effect, or uncertain canary.

## Current validation evidence and blockers

- `main` and `origin/main` are `89fa7d5` (PR #184). The active `codex/pwa-upload-recovery` branch contains nine focused implementation commits plus this dashboard checkpoint; none of its behavior is production evidence yet.
- Current branch validation is incremental: focused Studio Vitest scenarios for ambiguous PUT recovery, completion retry, per-row concurrency, safe storage failure diagnostics, capability/completion/deletion validation, and cleanup UX pass; targeted ESLint and TypeScript pass; Bash syntax and lightweight repository checks pass. Full Vitest/build/portable Python and Linux service-backed/preflight checks remain the pre-PR gate.
- The backend completion regression test is present but cannot run against the Windows local environment without PostgreSQL. The preflight behavior tests are Linux-oriented and Git Bash path semantics cannot reproduce their host identity gate; GitHub CI remains authoritative for both.
- Pre-migration backup snapshot `7b03ad00` completed successfully against the configured restic/R2 repository, and the manual migration reached `0015_user_source_retention`.
- Isolated API deployment run `30004599136` succeeded. Post-deploy preflight `30004696267` proved database head `0015`, healthy PostgreSQL/Redis, and passing public API/web health.
- Worker-status run `30004841628` proves `container_state=exited`, `exit_code=0`, and `drain_state=gracefully-drained`; worker image identity remains unknown and no worker deploy is authorized before Gate 4 passes.
- The 2026-07-24 follow-up smoke indicates Google Drive selection is available and proves one R2 object upload after CORS/credential correction, but it is not a clean Gate 4 pass because the upload required a second manual attempt and left duplicate objects. The current branch must be deployed before repeating it once.
- Public security-header/TLS policy verification, both Picker roles in one clean run, single-attempt presigned upload completion, authenticated canary prerequisites, current worker rollout, and the one-output canary remain unproven.
- The dependency-audit workflow still has no recorded run. Windows local service-backed processing tests remain environment-limited without PostgreSQL/Redis; GitHub CI is the authoritative service-backed gate.

## Sources of truth

- Product and acceptance contract: `docs/project-spec.md`.
- Processing invariants: `docs/studio-processing-contract.md`.
- Workflow: `docs/ai-coding-workflow.md`.
- CI/CD and runtime safety: `docs/ci-cd-rules.md`.
- Architecture: `docs/architecture.md`.
- Operator procedure: `docs/runbooks/studio-platform-ops.md`.
- Validation: `docs/runbooks/validation.md`.

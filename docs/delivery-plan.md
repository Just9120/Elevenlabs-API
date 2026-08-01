# Delivery plan

## Current dashboard

- ✅ `PWA-TRANSCRIPT-MAINTENANCE-RECURSIVE-02 + TARGET-MODES-03 / source` — PR #196 merged as `d2cb556`; repository and Studio CI passed. Standardization and **Манифест Studio** have independent targets and support one bounded recursive folder tree or exactly one Google Doc through the separate maintenance OAuth boundary.
- ✅ `PWA-GATED-MIGRATION-CD-01 / source and release` — PR #197 introduced the disabled protected lane; PR #198 merged the portable dump-validation fix as `45c2ce0`. Exact-main CI runs `30658692173` and `30658692170` passed. Manual exact-main CD run `30694223143` completed `release-api-migration`; web, ordinary API deploy, and worker jobs were skipped.
- ✅ `PWA-MAINTENANCE-OAUTH-ROLLOUT-01` — operator evidence confirms a verified pre-migration snapshot, production revision `0017_google_maintenance_oauth`, exact API replacement/health, and a same-account maintenance connection. `studio-worker` remains intentionally stopped. `STUDIO_MIGRATION_RELEASE_ENABLED=false` was reverified through GitHub CLI on 2026-08-01.
- 👉 `PWA-CATALOG-DURABLE-IDEMPOTENCE-04` — active in draft PR #199. A production folder apply inserted one current document into **Манифест Studio**, but the next dry-run incorrectly offered it for import again. The loader read historical transcription outputs and ignored durable `transcript_catalog_entries`. The branch now reconciles both owner-scoped authorities fail-closed, adds portable and PostgreSQL lifecycle coverage, and clarifies the PWA post-apply boundary. Repository CI, Studio build/tests, and Chromium browser E2E are green for source revision `8bc6f2b`; merge, deployment, and the production post-apply dry-run remain absent.
- 📋 `PWA-MIGRATION-ENVIRONMENT-PROBE-02` — next after merge. Dispatch the no-op environment probe from exact `main`, verify the job visibly enters `Waiting`, approve it, and verify the deployment review history. Do not enable or rerun the migration release: production is already at repository Alembic head.
- 📋 `PWA-TRANSCRIPT-MAINTENANCE-CANARY-04` — after deploying this fix, repeat the same non-mutating manifest dry-run and require `unchanged/already present`. Then complete the missing bounded matrix: one actual nested-folder target and one single-document target for each operation. Every apply remains a separate explicit user decision.
- 📋 `PWA-TRUSTED-PROXY-01 / production evidence` — the exact-peer source contract is merged; bounded production peer observation and separately reviewed runtime configuration remain absent.
- 📋 `PWA-LEGACY-SUCCESSOR-DISCOVERY-01 / consumer decision` — compatibility APIs advertise successors, but removal/support still requires external-consumer evidence and an explicit decision.
- 📋 `PWA-FRONTEND-MODULARIZATION-03` — resume only after the current production hardening batch and its canaries are closed.
- ✅ `DOCS-DELIVERY-ARCHIVE-01` — superseded checkpoints and older PR/status chains remain in `docs/delivery-plan-archive.md`; ordinary focused tasks do not read or update it.

## Audit conclusion

- Stable Colab batch remains frozen and accepted at **100%** for its current scope. Experimental realtime work is separate.
- Current merged source is `main@45c2ce0582e129eac3b769ce29ed2372451f0815` with exact-main repository and Studio CI green.
- Migration/runtime gate and exact API deployment/health gate are complete for transcript maintenance. This is stronger evidence than the previous `0016` baseline, but it does not prove every target mode or operation.
- Production folder-mode dry-runs reached both panels for one current document. Manifest apply persisted one row without changing Google Docs. The immediate repeated dry-run exposed a real source defect, so that apply cannot close the post-apply idempotence gate until the fix is merged, deployed, and rechecked.
- No production evidence yet covers a folder with actual descendants or the current single-document route after the `0017` rollout. Standardization apply also lacks an approved outdated-document canary.
- A successful environment-bound migration job is not proof that GitHub paused for a required reviewer. Environment binding, required-reviewer configuration, and recorded review history are distinct evidence.
- Worker start, provider calls, new transcription jobs, migration retry, restore, and production mutation are outside this branch. The worker remains stopped.

## Readiness snapshot

| Contour/dimension | Evidence-based estimate | Meaning |
| --- | ---: | --- |
| Stable Colab batch | **100%** | Accepted current scope; no reopen without a product or maintenance decision. |
| Selected Studio v1 source/CI on `main` | **98% (`39/40`)** | The previously complete source set lost one gate when production disproved durable manifest idempotence. The branch contains the fix, but unmerged source and local tests do not restore exact-main CI readiness. |
| Transcript-maintenance source acceptance on `main` | **90% (`9/10`)** | OAuth separation, target modes, traversal, parsing, isolation, fresh apply validation, and independent UI state are merged; durable post-apply rediscovery is the open gate. |
| Transcript-maintenance source acceptance on PR candidate | **100% (`10/10`)** | All ten source gates, including durable post-apply rediscovery, passed required CI on PR #199 source revision `8bc6f2b`. This is candidate source/CI evidence, not merged-main or production evidence. |
| Transcript-maintenance rollout | **50% (`2/4`)** | Complete gates: `0017` plus runtime/OAuth, and exact API identity/health. Partial gates: operation/mode dry-run matrix and bounded apply/post-apply evidence. Partial gates do not count. |
| Protected migration lane operational evidence | **80% (`4/5`)** | Source/CI, environment/VPS boundary, one exact release, and disabled post-release flag are evidenced. A visible waiting state plus recorded reviewer approval remains unproven. |
| Bounded earlier processing canary | **100% of its exact scenario** | The earlier one-small-source ElevenLabs-to-Google-Docs canary remains valid only for that exact baseline/scenario and does not authorize the stopped worker now. |

The denominators are explicit acceptance gates, not subjective confidence. Local implementation, documentation, a green summary with skipped jobs, or a successful environment-bound job cannot advance a production gate by itself.

## Active item

`PWA-CATALOG-DURABLE-IDEMPOTENCE-04` acceptance checks:

1. Durable owner-scoped catalog rows are recognized even without a historical transcription output.
2. Conflicting historical-output and catalog settings fail closed.
3. `dry-run → apply → commit → new database session → dry-run` changes `import_metadata` to `unchanged` and returns no private IDs, token, or body.
4. PostgreSQL CI executes the same durable-authority assertion.
5. PWA clears the actionable preview after apply and tells the operator not to repeat apply.
6. Required CI is green, web/API deployment identities match the merge SHA, and the same production target returns `unchanged/already present` on a fresh dry-run.

Non-goals: no project-spec change, Alembic revision, worker start/deploy, migration rerun, provider/Google write, catalog cleanup, or production apply.

Acceptance checks 1–5 and the PR-head CI portion of check 6 are green on PR #199. Check 6 remains open for merge-SHA deployment identity and the fresh production `unchanged/already present` result.

## Next item

`PWA-MIGRATION-ENVIRONMENT-PROBE-02`:

1. Merge the no-op workflow and keep `STUDIO_MIGRATION_RELEASE_ENABLED=false`.
2. Dispatch from exact `main` with its 40-character SHA.
3. Observe `Waiting` before any step runs; approve as the configured reviewer.
4. Verify the run timeline records the deployment review, then archive only non-secret evidence.
5. If it starts immediately, stop and repair environment protection. Do not substitute a migration release as a probe.

## Near backlog

1. Complete non-mutating folder-with-descendants and single-document dry-runs for both maintenance operations.
2. Prepare one disposable/approved outdated Google Doc and request separate authorization for a standardization apply canary.
3. Verify trusted reverse-proxy peer identity before any runtime value change.
4. Collect external-consumer evidence for deprecated compatibility routes.
5. Resume bounded frontend/API modularization only after the rollout baseline is stable.

## Current blockers

- PR #199 is still draft and has no merge or deployment evidence. Its source revision CI is green; the final PR head must remain green before merge.
- Production still runs the unfixed `main@45c2ce0`; do not repeat the manifest apply.
- Required-reviewer configuration exists, but a visible waiting state and recorded approval have not been independently demonstrated.
- No current rollout evidence covers actual descendant traversal, the single-document maintenance route, or standardization apply.
- Production trusted-proxy peer identity remains unknown.

## Validation notes

- Branch: `codex/transcript-maintenance-hardening`; before this PR evidence update it was `0 behind / 10 ahead` of local `main` at `8bc6f2b`. This evidence-only update is task/commit 11.
- Backend focused checks: catalog dry-run `9 passed`; catalog apply/lifecycle `10 passed`; combined catalog/maintenance set `31 passed` before the added lifecycle case; lightweight CI checks passed.
- Frontend focused check: `TranscriptCatalogMigrationPanel.test.tsx` reports `6 passed`.
- Workflow-focused checks: environment probe/release and deployment-summary contracts pass in the targeted sets.
- PostgreSQL/Redis are unavailable in the local Windows workspace, so the PostgreSQL-only assertion did not run locally. PR-head repository CI supplied both services and passed the full suite, including that regression.
- PR #199 source-revision evidence for `8bc6f2b`: repository CI run `30701413008` passed `checks`; Studio PWA CI run `30701413006` passed `studio` and `browser-e2e`. The PR was mergeable and remained draft before this evidence-only dashboard update.
- Exact-main live evidence refreshed through GitHub CLI: PR #198 merge `45c2ce0`; CI runs `30658692173` and `30658692170`; migration release run `30694223143`; release job succeeded while web/API/worker jobs were skipped.
- Self-review: the branch changes only durable catalog authority, related PWA messaging/tests, a no-op environment probe, truthful CD reporting, and subordinate operator/delivery documentation. It changes no product scope, migration, secret, VPS runtime, worker state, or Google document.

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

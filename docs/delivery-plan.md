# Delivery plan

## Current dashboard

- ✅ `PWA-FRONTEND-MODULARIZATION-01B/02` — The first two behavior-preserving frontend tranches are merged through PR #180 at `605cbae`; repository, Studio, authenticated Chromium, and web deployment checks passed.
- ⛔ `PWA-PROCESSING-ROLLOUT-01A / Gate 0` — Current-main preflight run `29918894603` stopped fail-closed because one `studio-worker` is running; later health, public-routing, and revision checks were intentionally not run.
- 👉 `PWA-PROCESSING-ROLLOUT-01A / Gate 0A` — Merge and dispatch the manual-only read-only worker-status workflow from the intended `main` SHA; use its safe identity/health evidence before separately authorizing any drain/stop.
- ⏸ `PWA-FRONTEND-MODULARIZATION-03` — Preparation composer/readiness extraction is deferred until the production baseline is known or rollout is waiting on an explicit operator window.
- ⛔ `PWA-PROCESSING-ROLLOUT-01A / Gates 1–6` — Backup, migration, API deployment, public-edge validation, worker deployment, and canary must run in order; each later gate is blocked until the previous gate has safe factual evidence.

## Audit conclusion

- The stable Colab batch contour remains frozen and accepted at **100%** for its current operational scope. Experimental realtime work is a separate contour and is not included in that claim.
- Studio has broad source-level implementation and green service-backed CI. The dominant blocker is release evidence, not a missing core ElevenLabs processing implementation.
- Current `main` source and CI are proven at `605cbaee35664327197bfc15b58771cf967241e3`; automatic CD at that revision proved only the web component.
- The last GitHub-proven API deployment is run `29677090742` at `fe60789f9278fd9adc967a2046a4fca0c4833774`, when the repository Alembic head was `0011_diagnostic_debug_sessions`. There is no later GitHub evidence that production API, database, or worker reached current source head `0015_user_source_retention`.
- Current-main preflight run `29918894603` proved the VPS checkout is clean at `605cbae` and found one running worker. No `deploy-worker` job exists in the inspected Studio Platform CD workflow-dispatch history, so that worker's deployment source/image identity is not established by GitHub evidence.
- Studio Platform CD is not generally broken: migration-changing pushes intentionally suppress automatic API deployment, and worker deployment is intentionally manual-only. The workflow currently makes this safe skip too easy to mistake for a complete green deployment; that observability gap is a focused follow-up.
- Migrations `0012`–`0015` are a single chain with PostgreSQL upgrade/downgrade and schema-contract coverage. Their tests reduce source risk but do not replace the required production backup, migration, identity checks, or canary.
- The authenticated Playwright scenario proves the browser shell through live FastAPI/PostgreSQL/Redis with controlled boundaries. It does not call ElevenLabs, Google, S3/R2, or production and therefore does not replace the controlled canary.

## Readiness snapshot

| Contour/dimension | Current estimate | Meaning |
| --- | ---: | --- |
| Stable Colab batch | **100%** | Accepted current scope; do not reopen without an explicit maintenance/product task. |
| Studio source breadth | **about 85%** | Major ElevenLabs short-media workflow, lifecycle safety, PWA shell, operations, and test foundations exist. |
| Studio production evidence | **about 45–50%** | Web is current; current API/database/worker identity and one-output canary are not proven. |
| Studio combined v1 readiness | **about 71% ±5** | Weighted planning estimate across product, parity, quality, operations, and production evidence. |

Documentation, diagnostics, or behavior-preserving refactors do not raise these estimates by themselves. A rollout gate changes production evidence only after its factual result is recorded; a feature changes source breadth only after implementation and relevant validation.

## Release-critical roadmap

### Gate 0 — read-only production truth (active)

1. Confirm the intended `main` SHA and green post-merge repository/Studio CI.
2. Dispatch `Studio Processing Preflight` from `main` only after explicit operator authorization, using the full intended SHA.
3. Capture only the workflow's secret-free table: checkout/remote/branch/commit identity, clean tracked tree, required file presence, service counts/health, localhost/public health, repository head, production revision, and worker count.
4. Treat a blocked revision-equality result as useful truth, not as permission to mutate production. Do not start a worker, provider call, Google call, job, backup, migration, deploy, or retry in this gate.

Current attempt: run `29918894603` passed checkout/remote/branch/commit/clean-tree checks, runtime configuration and required secret-file presence, and Compose-reported counts/status for PostgreSQL, Redis, API, and web. It then blocked on one running `studio-worker`. Dedicated health, public routing, Alembic, and authenticated preparation rows were not reached. Do not rerun until the worker is explicitly drained/stopped and its authority is understood.

Exit: a safe go/no-go record identifies the actual production baseline and confirms that no worker is running before migration work.

### Gate 1 — backup and migration readiness

1. Review the `0011 → 0015` chain, current CI migration evidence, expected additive/data-update effects, and rollback boundary.
2. Confirm PostgreSQL/Redis health and the configured restic/R2 backup boundary without printing secret values.
3. Create a tagged `pre-migration` PostgreSQL backup with the approved script and verify its safe metadata according to the operations runbook.
4. Stop if the backup is missing, ambiguous, concurrent, or unverifiable.

Exit: verified pre-migration backup evidence and an approved operator window. This is the authorization prerequisite for Gate 2, not the migration itself.

### Gate 2 — apply and verify database head

1. Run the manual migration script with explicit backup confirmation.
2. Verify exactly one production revision equal to `0015_user_source_retention`.
3. Recheck PostgreSQL health and record only revision/health evidence.
4. Stop on multiple/unknown revisions, health degradation, or any uncertainty; do not improvise a downgrade.

Exit: production PostgreSQL is healthy at exactly the repository head.

### Gate 3 — deploy and verify API

1. Manually dispatch the `api` component from the intended `main` SHA.
2. Require checkout fast-forward, built/running image identity equality, database/image Alembic equality, Docker health, and localhost API health.
3. Verify public API health and safe authenticated session behavior without processing a source.

Exit: current API identity and health are proven against database head `0015`.

### Gate 4 — public browser boundary

1. Apply/verify the committed host security-header policy, run `nginx -t`, and verify TLS/public routing.
2. Smoke Google Picker and presigned local-upload initiation/completion boundaries with no-store and safe browser behavior.
3. Confirm the authenticated operator account has one active ElevenLabs credential, a valid Google connection, one writable output folder, and one small supported source.

Exit: the real public browser/API integration boundary is ready for one controlled job.

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
2. `PWA-LEGACY-AUTHORITY-01` — confirm external consumers, then remove the two deprecated compatibility APIs or retain them with an explicit support/removal contract. The old static UI and obsolete stateless/full-platform deploy paths are already removed.
3. Golden Colab/PWA fixtures — lock normalization, ordering, output shape, and failure semantics before adding parity paths.
4. OpenAI short-media parity — add provider selection/credential/processing behavior without weakening the canonical batch and side-effect contracts.
5. Manifest/skip semantics — define the web-native durable equivalent and its relationship to PostgreSQL jobs/outputs before implementation.
6. Long-media parity — define size/duration limits, splitting/resume behavior, lease/heartbeat requirements, storage lifecycle, and cost-safe acceptance tests.
7. Multi-worker validation — only after single-worker production stability; prove claim/lease/heartbeat/recovery behavior under concurrency before increasing worker count.

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

- `main` revision `605cbae` passed repository CI run `29915391965`, Studio PWA CI run `29915391923`, and web-only CD run `29915391979`.
- The dependency-audit workflow has no GitHub run. Studio Processing Preflight passed historically in run `29633282269` at old revision `5df22347f4d9d8a2805f70f023929cbe7ac34c47`, but current-main run `29918894603` is blocked by the running worker.
- Production checkout is now proven clean at `605cbae`; current API image identity, database revision, and running worker image/deployment authority remain unproven because the fail-closed preflight stopped before those checks.
- The current branch adds a manual-only `Studio Worker Status` workflow that validates `main`/SHA/repository/clean-tree identity and invokes only `manage_studio_worker.sh status`; it cannot be dispatched as trusted default-branch source until merged.
- Public security headers, TLS Picker/upload behavior, database head `0015`, controlled worker absence/rollout, and the one-output canary remain unproven.
- Windows local service-backed processing tests remain environment-limited without PostgreSQL/Redis; GitHub CI is the authoritative service-backed gate.

## Sources of truth

- Product and acceptance contract: `docs/project-spec.md`.
- Processing invariants: `docs/studio-processing-contract.md`.
- Workflow: `docs/ai-coding-workflow.md`.
- CI/CD and runtime safety: `docs/ci-cd-rules.md`.
- Architecture: `docs/architecture.md`.
- Operator procedure: `docs/runbooks/studio-platform-ops.md`.
- Validation: `docs/runbooks/validation.md`.

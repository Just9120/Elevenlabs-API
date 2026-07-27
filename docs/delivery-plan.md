# Delivery plan

## Current dashboard

- ✅ `BATCH-PUBLICATION-2026-07-26` — PR #192 merged as `e825247`. Exact-main repository CI run `30223311852` and Studio CI run `30223311879` passed, including PostgreSQL/Redis pytest, Alembic, frontend tests/build, both Docker image builds, Compose validation, and authenticated Chromium.
- ✅ `PWA-HARDENING-2026-07-26` — The project-create race, Docker contexts/base-image pinning, worker dependency signal, rate-limit atomicity, session write throttling, bounded auth retention, explicit CSRF retry, project-routing authority, source-cleanup consolidation, and their applicable exact-main CI gates are complete.
- ✅ `PWA-NONROOT-SECRET-RUNTIME-01` — PR #193 merged as `93de8cf`. Exact-main repository run `30248034282` and Studio run `30248034348` passed. API CD run `30248034330` built the new image and read the production `0015_user_source_retention` revision through the protected-secret bootstrap, then stopped before replacement on the explicit `0016_transcript_catalog_entries` migration gate.
- 👉 `PWA-TRANSCRIPT-CATALOG-MIGRATION-01 / production rollout` — Active operator-gated item. Verified snapshot `15ca68cc3e4f` protected the separately authorized migration from `0015_user_source_retention` to `0016_transcript_catalog_entries`; the post-check found the new catalog table with zero rows. API-only deployment run `30263481907` then verified revision equality, recreated only the intended API, matched its running image identity, and passed localhost/public health at `main@93de8cf`. The next gate is an authenticated approved-folder dry-run; one bounded apply still requires separate explicit authorization.
- 📋 `PWA-TRUSTED-PROXY-01 / production evidence` — The exact-peer source contract and tests are merged. Production peer observation, runtime value selection, and a separately reviewed API deployment remain unproven.
- 📋 `PWA-LEGACY-SUCCESSOR-DISCOVERY-01 / consumer decision` — Both compatibility APIs advertise deprecation and canonical successors; removal/support still requires external-consumer evidence and an explicit decision.
- 📋 `PWA-FRONTEND-MODULARIZATION-03` — Preparation-composer/readiness extraction remains deferred until the production baseline is restored or rollout is waiting on an operator window.
- ✅ `DOCS-DELIVERY-ARCHIVE-01` — Completed Gates 0–7 and superseded validation chains remain in `docs/delivery-plan-archive.md`; this ordinary focused task does not read or modify that archive.

## Audit conclusion

- The stable Colab batch contour remains frozen and accepted at **100%** for its current operational scope. Experimental realtime work is a separate contour and is not included in that claim.
- Studio has broad source-level implementation at merged `main` revision `93de8cf`. Exact-main repository and Studio/browser CI are green for that revision.
- The separately authorized catalog migration passed its backup, service-health, exact-source, exact-revision, table-state, and row-count gates. Production PostgreSQL now reports `0016_transcript_catalog_entries`; no restore, worker, provider, Google, dry-run, or apply action was performed.
- Manual Studio Platform CD run `30263481907` selected only API at `main@93de8cf`. It built the intended image, confirmed database/head equality, recreated only API, matched the running image identity, and emitted `STUDIO_PLATFORM_API_DEPLOY_OK` after localhost health. Web and worker jobs were skipped.
- Independent public checks returned `ok` for `/healthz` and `{"ok":true,"database":"reachable","migrations":"current"}` for `/api/healthz`.
- The `0015` production baseline has a tagged backup, verified component identities, one healthy worker, public TLS/security evidence, and one successful exactly-one-output ElevenLabs-to-Google-Docs canary. That proves only the bounded scenario, not every selected mode or repository head.
- Repository head, production PostgreSQL, and the deployed API now agree on `0016_transcript_catalog_entries`. Catalog production proof still requires an authenticated approved-folder dry-run and a separately authorized apply.
- Authenticated Playwright exercises real Chromium with isolated FastAPI/PostgreSQL/Redis and controlled external boundaries. It raises source/CI confidence but cannot substitute for provider, Google, storage, deployment-identity, or production canary evidence.

## Readiness snapshot

| Contour/dimension | Current estimate | Meaning |
| --- | ---: | --- |
| Stable Colab batch | **100%** | Accepted current scope; do not reopen without an explicit maintenance/product task. |
| Selected Studio v1 source/CI | **99% authoritative** | Exact-main corrective CI passed. On the same ten-epic denominator, auth is `4/4` and frontend UX/modularization is `3.5/4`: `39.5/40 = 98.75%`, rounded to 99%. |
| Selected Studio v1 production evidence | **61%** | On the same ten-epic denominator, the catalog epic advances from 30% to 60% after verified schema migration and intended API identity/health; the prior 58% aggregate gains three points. |
| Bounded one-small-source canary | **100% of its exact scenario gates** | The `0015` core baseline has backup, component identities, database compatibility, public health/security, one exactly-one-output canary, and safe diagnostics/reconciliation. This must not be generalized to every selected mode or repository head. |
| Catalog migration production rollout | **60% (`3/5`)** | The verified backup plus `0016` complete the schema/config prerequisite, and the intended API deployment/identity/health gate is complete. Authenticated dry-run and separately authorized apply remain. |

The scoring method and partial-gate rule are in `docs/audits/repository-audit-2026-07-26.md`. The authoritative 99% source/CI estimate is unchanged and remains backed by exact-main `93de8cf` checks. Catalog rollout advances from `1.5/5` to `3/5`: migration completes the remaining half of the schema/config gate, and intended API deployment/identity/health adds one full gate. On the same ten-epic denominator, Studio production evidence moves from 58% to 61%. Neither public health nor deployment substitutes for authenticated dry-run or apply evidence.

## Product roadmap after production proof

Order work so each capability inherits a known source and production baseline:

1. Run an authenticated approved-folder catalog dry-run, then require separate authorization for one bounded apply.
2. Run bounded production canaries for the remaining selected modes: auto-detect language, diarization, video preparation, long-media split/merge, and multi-file processing.
3. Confirm external consumers of the two deprecated compatibility APIs, then either remove them or record an explicit support/removal contract. Existing deprecation/successor headers do not prove that consumers have migrated.
4. Resume preparation-composer and API-router modularization in bounded behavior-preserving slices.
5. Add golden Colab/PWA fixtures for normalization, ordering, output shape, and failure semantics.
6. Validate claim/lease/heartbeat/recovery behavior under concurrency before increasing the production worker count.

OpenAI processing remains deferred, and the already source-complete media preparation path is not reopened by this sequence. Accepted-output reuse/skip requires an explicit linkage design and is not inferred from catalog matching.

Any change to the durable product meaning or acceptance criteria above requires an explicit user decision and a separate update to `docs/project-spec.md`.

## Maintainability and infrastructure lane

These tasks are valuable but do not outrank the completed production safety gates or explicitly selected product work:

PR #188 and PR #192 completed the CD-observability, dependency-remediation, Actions-runtime, Docker-context/image-build, and worker-dependency-signal evidence. Remaining maintainability work:

1. Obtain production trusted-peer evidence for the exact-IP contract; do not guess or deploy the peer value from source inspection.
2. Resume `PWA-FRONTEND-MODULARIZATION-03`: extract bounded preparation composer/readiness behavior, then split `App.test.tsx` by the same domain boundaries.
3. Modularize `apps/studio-api/studio_api/main.py` into domain routers/response models, followed by a fixture-preserving split of `tests/test_studio_api_core.py`.
4. Simplify the 619-line `docs/ai-coding-workflow.md` in a dedicated documentation task; keep `AGENTS.md` as the lightweight router and avoid duplicating product/CI contracts.

Current large-file concentrations are maintainability signals, not automatic defects: `App.test.tsx` ~8.5k lines, `test_studio_api_core.py` ~4.8k, `App.tsx` ~4.1k, `test_text_processing_helpers.py` ~4.0k, and API `main.py` ~1.4k. The ~9.0k-line stable Colab implementation is deliberately excluded from opportunistic refactoring.

## Documentation disposition

- Keep the currently present core source/router/support documents in their assigned roles. No optional Context Bundle Builder or AI-delivery-infrastructure document should be created without a real requested workstream.
- Keep `docs/runbooks/repository-audit-2026-07-21.md` as a dated historical snapshot; its old readiness and sequence are superseded here.
- Keep `docs/audits/repository-audit-2026-07-26.md` as the current dated audit evidence; it does not replace this dashboard or the product contract.
- Keep the processing contract and Studio operations runbook separate: one owns processing invariants, the other owns operator procedure.
- Do not read or update `docs/delivery-plan-archive.md` during ordinary tasks. This broad reconciliation moved completed Gates 0–7, PR history, and superseded validation/status chains there.
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

- Local `main` and `origin/main` are synchronized at merge revision `93de8cf`.
- Exact-main repository CI run `30248034282` and Studio run `30248034348` passed at `93de8cf`, including full PostgreSQL/Redis pytest, Alembic, frontend checks/build, authenticated browser E2E, both image builds, protected-secret bootstrap smoke, and Compose validation.
- Studio Platform CD run `30248034330` selected only API, built the intended source image, and reported production database revision `0015_user_source_retention` against image head `0016_transcript_catalog_entries`. It emitted `manual migration required` and stopped before API recreation; web and worker deployment jobs were skipped.
- Read-only public checks after the CD run returned HTTP 200 for `/healthz` and `/api/healthz`. The API result belongs to the prior image/schema baseline and is not new-image identity evidence.
- Read-only host preflight run `30250456568` validated the dispatch/SSH boundary and reached merged commit `93de8cf`, but stopped before backup or migration when the deploy user received `Permission denied` reading a protected operator-owned source-storage secret file. No secret value was printed, and no backup, migration, deploy, worker, provider, or Google action ran.
- A separately approved privileged operator path preserved protected-file permissions, confirmed PostgreSQL and Redis healthy, and created catalog pre-migration snapshot `15ca68cc3e4f`. Read-only verification matched its timestamp, host, and required tags, restored the snapshot into an isolated root-only temporary directory, found one `102318`-byte custom-format dump, and parsed its object list successfully with `pg_restore`. The temporary verification directory was removed; no production restore, migration, deployment, worker, provider, or Google action ran.
- The separately authorized migration revalidated `main@93de8cf`, snapshot `15ca68cc3e4f`, healthy PostgreSQL/Redis, image head `0016_transcript_catalog_entries`, database current `0015_user_source_retention`, and absence of the catalog table before running the repository migration once. It finished with database revision `0016_transcript_catalog_entries`, the catalog table present, and `catalog_rows=0`; no uncertain or retry marker occurred.
- Manual API-only CD run `30263481907` succeeded at `93de8cf`. The deploy job built only API, verified PostgreSQL/Redis and exact database/image revision equality, force-recreated only API, verified running image identity, and emitted `STUDIO_PLATFORM_API_DEPLOY_OK`. Web and worker jobs were skipped. Independent public web/API checks then passed, with the API reporting `database=reachable` and `migrations=current`.
- The repository-provided `studio-postgres-backup.service` and timer were reported `not-found` on the VPS. This does not invalidate the verified one-off snapshot, but recurring backup automation remains an operator/infrastructure gap and requires a separate installation/enablement task.
- PR #193 implementation/test commits provide the protected secret bootstrap, normalized revision-probe failure, one focused Docker smoke, the aligned lightweight wiring guard, and the Linux fixture correction. Locally, the portable suite passed `806 passed, 6 skipped`; lightweight checks, focused entrypoint/Compose and workflow tests, Python compilation, YAML parsing, shell syntax checks, and diff checks also passed.
- Docker remains unavailable locally, and the Windows Python/Git-Bash path model cannot execute the repository's POSIX fake-binary shell integration harness reliably. Exact Linux/Docker CI has passed for the merged revision.
- Production trusted-proxy peer identity remains unknown. The source contract is intentionally fail-closed until bounded runtime observation supplies the exact direct peer and a separately reviewed deployment applies it.
- Catalog production rollout is paused after verified database/API rollout and before Google discovery. Continue with an authenticated approved-folder dry-run only; do not infer authorization for apply from the backup, migration, deployment, or dry-run.
- Historical deployment, CI/CD, security-header, worker, canary, and reconciliation evidence is preserved in `docs/delivery-plan-archive.md`. The one successful canary and healthy worker remain bounded earlier-baseline evidence; PR #193 is merged, CI-verified, and deployed for API, while worker deployment remains manual-only and was not part of run `30263481907`.

## Sources of truth

- Product and acceptance contract: `docs/project-spec.md`.
- Processing invariants: `docs/studio-processing-contract.md`.
- Workflow: `docs/ai-coding-workflow.md`.
- CI/CD and runtime safety: `docs/ci-cd-rules.md`.
- Architecture: `docs/architecture.md`.
- Operator procedure: `docs/runbooks/studio-platform-ops.md`.
- Validation: `docs/runbooks/validation.md`.

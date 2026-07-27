# Delivery plan

## Current dashboard

- ✅ `BATCH-PUBLICATION-2026-07-26` — PR #192 merged as `e825247`. Exact-main repository CI run `30223311852` and Studio CI run `30223311879` passed, including PostgreSQL/Redis pytest, Alembic, frontend tests/build, both Docker image builds, Compose validation, and authenticated Chromium.
- ✅ `PWA-HARDENING-2026-07-26` — The project-create race, Docker contexts/base-image pinning, worker dependency signal, rate-limit atomicity, session write throttling, bounded auth retention, explicit CSRF retry, project-routing authority, source-cleanup consolidation, and their applicable exact-main CI gates are complete.
- 👉 `PWA-NONROOT-SECRET-RUNTIME-01` — Current focused branch item. Post-merge CD proved that the new UID/GID `10001` image could not read operator-owned `0600` file-backed secrets. The local fix copies only allowlisted secrets into root-owned tmpfs as `0400` files for `10001`, drops privileges before API/worker/Alembic/health execution, normalizes failed revision probes, and adds one Docker smoke. Exact-revision Linux/Docker CI remains required.
- ⛔ `PWA-TRANSCRIPT-CATALOG-MIGRATION-01 / production rollout` — Blocked first on a merged/CI-green non-root secret-runtime fix, then on the separately authorized operator sequence: tagged backup, migration to `0016_transcript_catalog_entries`, intended API deployment/identity/health, authenticated approved-folder dry-run, and separately authorized apply.
- 📋 `PWA-TRUSTED-PROXY-01 / production evidence` — The exact-peer source contract and tests are merged. Production peer observation, runtime value selection, and a separately reviewed API deployment remain unproven.
- 📋 `PWA-LEGACY-SUCCESSOR-DISCOVERY-01 / consumer decision` — Both compatibility APIs advertise deprecation and canonical successors; removal/support still requires external-consumer evidence and an explicit decision.
- 📋 `PWA-FRONTEND-MODULARIZATION-03` — Preparation-composer/readiness extraction remains deferred until the production baseline is restored or rollout is waiting on an operator window.
- ✅ `DOCS-DELIVERY-ARCHIVE-01` — Completed Gates 0–7 and superseded validation chains remain in `docs/delivery-plan-archive.md`; this ordinary focused task does not read or modify that archive.

## Audit conclusion

- The stable Colab batch contour remains frozen and accepted at **100%** for its current operational scope. Experimental realtime work is a separate contour and is not included in that claim.
- Studio has broad source-level implementation at merged `main` revision `e825247`. Exact-main repository and Studio/browser CI are green for that revision.
- Post-merge Studio Platform CD run `30223311873` deployed the web component, skipped the manual-only worker, and failed the API revision probe before container recreation. The prior API remains live and publicly healthy on its existing pre-`0016` schema baseline; that health is not evidence for the `e825247` API image.
- The API CD failure was a runtime compatibility regression: the fixed UID/GID `10001` process could not read operator-owned `0600` Compose file-backed secrets, while the deploy script suppressed the underlying probe error and misclassified the empty parsed output as zero current revisions. The current branch addresses both defects but has no exact-revision CI yet.
- The `0015` production baseline has a tagged backup, verified component identities, one healthy worker, public TLS/security evidence, and one successful exactly-one-output ElevenLabs-to-Google-Docs canary. That proves only the bounded scenario, not every selected mode or repository head.
- Repository head includes `0016_transcript_catalog_entries`, but production remains evidenced only through `0015_user_source_retention`. Catalog rollout still requires its own backup, migration, intended API identity/health, approved-folder dry-run, and separately authorized apply.
- Authenticated Playwright exercises real Chromium with isolated FastAPI/PostgreSQL/Redis and controlled external boundaries. It raises source/CI confidence but cannot substitute for provider, Google, storage, deployment-identity, or production canary evidence.

## Readiness snapshot

| Contour/dimension | Current estimate | Meaning |
| --- | ---: | --- |
| Stable Colab batch | **100%** | Accepted current scope; do not reopen without an explicit maintenance/product task. |
| Selected Studio v1 source/CI | **96% authoritative; 99% provisional** | The audit score remains authoritative until the current corrective revision passes exact CI. On the same ten-epic denominator, merged evidence moves auth to `4/4` and frontend UX/modularization to `3.5/4`: `39.5/40 = 98.75%`, rounded to 99%. |
| Selected Studio v1 production evidence | **57%** | Reproducible gate average across applicable schema/config, deployed identity, worker, authenticated/public, and real-external-effect evidence. |
| Bounded one-small-source canary | **100% of its exact scenario gates** | The `0015` core baseline has backup, component identities, database compatibility, public health/security, one exactly-one-output canary, and safe diagnostics/reconciliation. This must not be generalized to every selected mode or repository head. |
| Catalog migration production rollout | **about 20%** | Source and web UI are merged and the web component is deployed, but production backup for this migration, database `0016`, intended API deployment, authenticated dry-run, and separately authorized apply remain. |

The scoring method and per-epic fractions are in `docs/audits/repository-audit-2026-07-26.md`. The provisional 99% is a reproducible same-denominator calculation, not a production claim and not yet the authoritative dashboard value because the post-merge runtime regression requires a new exact-revision CI result. Production evidence remains 57%, and catalog rollout remains about 20%; source fixes, diagnostics, and web deployment do not satisfy the missing backup, database, intended API, dry-run, or apply gates.

## Product roadmap after production proof

Order work so each capability inherits a known source and production baseline:

1. Publish `PWA-NONROOT-SECRET-RUNTIME-01` as a focused PR and require exact-revision repository, Studio, Docker-bootstrap, Compose, and authenticated-browser evidence.
2. After that fix is merged, inspect post-merge component CD. Do not rerun the failed API deployment before the fix and do not infer API rollout from web success.
3. Execute the catalog production rollout only through its guarded backup → migration → intended API → dry-run → separately authorized apply sequence.
4. Run bounded production canaries for the remaining selected modes: auto-detect language, diarization, video preparation, long-media split/merge, and multi-file processing.
5. Confirm external consumers of the two deprecated compatibility APIs, then either remove them or record an explicit support/removal contract. Existing deprecation/successor headers do not prove that consumers have migrated.
6. Resume preparation-composer and API-router modularization in bounded behavior-preserving slices.
7. Add golden Colab/PWA fixtures for normalization, ordering, output shape, and failure semantics.
8. Validate claim/lease/heartbeat/recovery behavior under concurrency before increasing the production worker count.

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

- `main` and `origin/main` were synchronized at merge revision `e825247` before `codex/studio-nonroot-secret-runtime` was created.
- Exact-main repository CI run `30223311852` and Studio run `30223311879` passed at `e825247`, including full PostgreSQL/Redis pytest, Alembic, frontend checks/build, authenticated browser E2E, both image builds, and Compose validation.
- Studio Platform CD run `30223311873` deployed web successfully, skipped worker as manual-only, and failed API before recreation when `alembic current` returned non-zero under the unreadable `0600` secret mount. Public `/api/healthz` remained HTTP 200 from the prior API/schema baseline.
- Current branch commits `46bc69b`, `051ad4d`, `9566029`, and `c254700` implement the protected secret bootstrap, normalized revision-probe failure, one focused Docker smoke, and the aligned lightweight wiring guard. Locally, the portable suite passes `806 passed, 6 skipped`; lightweight checks, focused entrypoint/Compose and workflow tests, Python compilation, YAML parsing, shell syntax checks, and diff checks also pass.
- Docker is unavailable locally, and the Windows Python/Git-Bash path model cannot execute the repository's POSIX fake-binary shell integration harness reliably. Exact Linux/Docker CI is therefore the required behavioral gate for the current branch.
- Production trusted-proxy peer identity remains unknown. The source contract is intentionally fail-closed until bounded runtime observation supplies the exact direct peer and a separately reviewed deployment applies it.
- Catalog production rollout remains paused pending the merged secret-runtime fix, a tagged pre-migration backup, database `0016`, intended API deployment identity/health, an authenticated approved-folder dry-run, and separate authorization for one bounded apply.
- Historical deployment, CI/CD, security-header, worker, canary, and reconciliation evidence is preserved in `docs/delivery-plan-archive.md`. The one successful canary and healthy worker remain bounded `0015` evidence; the current branch has not been pushed, CI-verified, or deployed.

## Sources of truth

- Product and acceptance contract: `docs/project-spec.md`.
- Processing invariants: `docs/studio-processing-contract.md`.
- Workflow: `docs/ai-coding-workflow.md`.
- CI/CD and runtime safety: `docs/ci-cd-rules.md`.
- Architecture: `docs/architecture.md`.
- Operator procedure: `docs/runbooks/studio-platform-ops.md`.
- Validation: `docs/runbooks/validation.md`.

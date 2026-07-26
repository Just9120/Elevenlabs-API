# Delivery plan

## Current dashboard

- ✅ Released baseline through PR #190 and completed processing Gates 0–7 — source, CI/CD, deployment identities, the one-output canary, and stabilization history are preserved in `docs/delivery-plan-archive.md`. The current merged repository baseline is `c02accd`; this summary is not evidence that the working branch is deployed.
- ✅ `AUDIT-BASELINE-2026-07-26` — `docs/audits/repository-audit-2026-07-26.md` reconciles documentation, code, architecture, CI/CD, public health, and reproducible readiness gates.
- ⏳ `PWA-PROJECT-CREATE-NAVIGATION-RACE-01` — Local source implementation and deterministic regression evidence are complete on the working branch: an explicit `Новый проект` action now clears the pending `browse` intent before opening the form, and a delayed `/projects` test reproduces the old close-after-load behavior. Exact changed-revision Studio/browser CI remains required after batch publication before this item is marked done.
- ⏳ `PWA-DOCKER-CONTEXT-01` — Local source and static contract evidence are complete on the working branch: frontend/API contexts exclude host dependencies, generated output, caches, test artifacts, virtual environments, and local environment/secret-shaped files while retaining required build inputs. Docker is unavailable in the local environment, so both exact-revision image builds remain required in Studio CI after batch publication.
- ⏳ `PWA-WORKER-CHANGE-DETECTION-01` — Local workflow and contract evidence are complete on the working branch. Any API-context change now reports a manual worker dependency review while automatic worker deployment remains impossible; exact-revision workflow evidence remains pending publication.
- ⏳ `PWA-TRUSTED-PROXY-01` — Local source/config support is complete on the working branch: one validated exact trusted peer is wired through Compose, forwarded headers remain ignored for every other direct peer, and the runbook requires bounded peer observation before any production value/deploy change. Production peer identity and runtime verification remain unproven.
- ⏳ `PWA-RATE-LIMIT-ATOMICITY-01` — Local source and unit evidence are complete on the working branch. Redis increment plus first-expiry assignment now execute in one transaction, legacy no-TTL counters self-heal, and the existing limits, 429 body, and `Retry-After` contract are unchanged; service-backed CI remains pending.
- ⏳ `PWA-SESSION-LAST-SEEN-01` — Local source and portable evidence are complete on the working branch. Authentication still checks the session on every request, while the auxiliary `last_seen_at` write is bounded to once per configured five-minute window; exact-revision service-backed CI remains pending.
- ⏳ `PWA-AUTH-RETENTION-01` — Local source and portable evidence are complete on the working branch. Login and OAuth-start traffic opportunistically purges only terminal login contexts, OAuth states, and sessions in capped batches; cleanup is interval-throttled and fail-open, while active auth state and audit events remain untouched. Exact-revision service-backed PostgreSQL CI remains pending.
- ⏳ `PWA-CSRF-RETRY-CONTRACT-01` — Local server/client contract evidence is complete on the working branch. A mutation is replayed once only for the stable `csrf_token_invalid` reason; generic `401`, `403`, and `419` responses are no longer treated as refresh authority. Exact-revision Studio and service-backed CI remain pending.
- ⏳ `PWA-CONTAINER-REPRODUCIBILITY-01` — Local source and registry evidence are complete on the working branch. The frontend build now pins the official Node 22 and stable nginx 1.28.3 multi-platform index digests; Docker is unavailable locally, so the exact-revision image build and health check remain pending Studio CI.
- ⏳ `PWA-API-LEAST-PRIVILEGE-01` — Local source/static evidence is complete on the working branch. The shared API/worker image installs system dependencies as root and then runs API, worker, health, and migration commands as fixed UID/GID `10001`; its runtime writes remain under writable temporary storage and Compose secrets remain read-only inputs. Exact-revision image builds and API/worker health checks remain pending CI.
- ⏳ `PWA-FRONTEND-MODULARIZATION-03A` — Local source/unit evidence is complete on the working branch. The create/browse request resolution that guarded the project-navigation race is now a pure `platformRouting` authority with explicit loading/empty-list cases; the broader preparation-composer refactor remains deferred.
- ✅ `DOCS-DELIVERY-ARCHIVE-01` — Completed Gates 0–7, PR history, and superseded validation chains are preserved in `docs/delivery-plan-archive.md`; this active dashboard now retains current decisions, blockers, and evidence only.
- 👉 `PWA-LEGACY-AUTHORITY-01A` — Next local item. Make the two retained compatibility APIs advertise their canonical successors without removing routes or assuming that external consumers have migrated.
- ⏸ `PWA-TRANSCRIPT-CATALOG-MIGRATION-01 / production rollout` — Stateful operator item after a green merged source batch: tagged pre-migration backup, manual migration to `0016_transcript_catalog_entries`, intended API deployment/identity/health verification, authenticated approved-folder dry-run, and a separately authorized apply.
- 📋 `BATCH-PUBLICATION-2026-07-26` — After commit 15, reconcile the full `main...HEAD` diff, run the complete applicable local gate, and stop at the push/PR boundary for review.
- ⏸ `PWA-FRONTEND-MODULARIZATION-03` — Preparation composer/readiness extraction is deferred until the production baseline is known or rollout is waiting on an explicit operator window.

## Audit conclusion

- The stable Colab batch contour remains frozen and accepted at **100%** for its current operational scope. Experimental realtime work is a separate contour and is not included in that claim.
- Studio has broad source-level implementation at merged `main` revision `c02accd`; the application/runtime source remains `625cd33` because the intervening merge is documentation-only. This branch adds focused implementation and contract hardening, but none of it counts as exact-main CI or deployment evidence before publication.
- The `0015` production baseline has a tagged backup, verified component identities, one healthy worker, public TLS/security evidence, and one successful exactly-one-output ElevenLabs-to-Google-Docs canary. That proves only the bounded scenario, not every selected mode or repository head.
- Repository head includes `0016_transcript_catalog_entries`, but production remains evidenced only through `0015_user_source_retention`. Catalog rollout still requires its own backup, migration, intended API identity/health, approved-folder dry-run, and separately authorized apply.
- Authenticated Playwright exercises real Chromium with isolated FastAPI/PostgreSQL/Redis and controlled external boundaries. It raises source/CI confidence but cannot substitute for provider, Google, storage, deployment-identity, or production canary evidence.

## Readiness snapshot

| Contour/dimension | Current estimate | Meaning |
| --- | ---: | --- |
| Stable Colab batch | **100%** | Accepted current scope; do not reopen without an explicit maintenance/product task. |
| Selected Studio v1 source/CI | **96%** | Reproducible gate average from the 2026-07-26 audit: current contract, implementation, targeted tests, and exact-main CI are scored separately for required epics. |
| Selected Studio v1 production evidence | **57%** | Reproducible gate average across applicable schema/config, deployed identity, worker, authenticated/public, and real-external-effect evidence. |
| Bounded one-small-source canary | **100% of its exact scenario gates** | The `0015` core baseline has backup, component identities, database compatibility, public health/security, one exactly-one-output canary, and safe diagnostics/reconciliation. This must not be generalized to every selected mode or repository head. |
| Catalog migration production rollout | **about 20%** | Source and web UI are merged and the web component is deployed, but production backup for this migration, database `0016`, intended API deployment, authenticated dry-run, and separately authorized apply remain. |

The scoring method and per-epic fractions are in `docs/audits/repository-audit-2026-07-26.md`. The local project-create, Docker-context, worker-visibility, trusted-peer, rate-limit atomicity, session-write-throttling, bounded auth-retention, explicit CSRF-retry, frontend base-image pinning, API/worker non-root, and project-navigation authority fixes improve implementation confidence but do not yet promote exact-main CI, image-build, deployment, or production-runtime gates, so the aggregate estimates remain unchanged pending publication. Catalog production readiness changes only after the separately evidenced backup, migration, API deployment, dry-run, and authorized apply gates.

## Product roadmap after production proof

Order work so each capability inherits a known source and production baseline:

1. Publish this source batch and require exact-revision repository, Studio, authenticated-browser, Compose, and image-build evidence.
2. Execute the catalog production rollout only through its guarded backup → migration → intended API → dry-run → separately authorized apply sequence.
3. Run bounded production canaries for the remaining selected modes: auto-detect language, diarization, video preparation, long-media split/merge, and multi-file processing.
4. Confirm external consumers of the two deprecated compatibility APIs, then either remove them or record an explicit support/removal contract. This branch may advertise successors but must not infer consumer migration.
5. Resume preparation-composer and API-router modularization in bounded behavior-preserving slices.
6. Add golden Colab/PWA fixtures for normalization, ordering, output shape, and failure semantics.
7. Validate claim/lease/heartbeat/recovery behavior under concurrency before increasing the production worker count.

OpenAI processing remains deferred, and the already source-complete media preparation path is not reopened by this sequence. Accepted-output reuse/skip requires an explicit linkage design and is not inferred from catalog matching.

Any change to the durable product meaning or acceptance criteria above requires an explicit user decision and a separate update to `docs/project-spec.md`.

## Maintainability and infrastructure lane

These tasks are valuable but do not outrank the completed production safety gates or explicitly selected product work:

PR #188 and dependency-audit verification completed the CD-observability, dependency-remediation, and Actions-runtime items recorded in the dashboard. Remaining maintainability work:

1. Prove the local `.dockerignore` context contracts through exact-revision frontend/API image builds in Studio CI.
2. Prove the local worker shared-dependency review signal through exact-revision component-CD evidence.
3. Obtain production trusted-peer evidence for the local exact-IP contract; do not guess or deploy the peer value from source inspection.
4. Resume `PWA-FRONTEND-MODULARIZATION-03`: extract bounded preparation composer/readiness behavior, then split `App.test.tsx` by the same domain boundaries.
5. Modularize `apps/studio-api/studio_api/main.py` into domain routers/response models, followed by a fixture-preserving split of `tests/test_studio_api_core.py`.
6. Simplify the 619-line `docs/ai-coding-workflow.md` in a dedicated documentation task; keep `AGENTS.md` as the lightweight router and avoid duplicating product/CI contracts.

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

- `main` and `origin/main` were synchronized at `c02accd` before the 2026-07-26 audit branch was created. The revision differs from the `625cd33` product/runtime source baseline only through documentation reconciliation.
- Current branch-local evidence includes `801` passed portable Python tests with `6` skipped, `290` passing frontend tests through the CSRF slice, `137` focused App/routing tests after navigation extraction, ESLint, TypeScript, and lightweight repository checks. Commit 15 will rerun the complete applicable local batch gate and replace these intermediate counts.
- Exact-main repository CI run `30207923222` and Studio run `30207923262` passed at `c02accd`, including `studio` and `browser-e2e`. They do not prove this unpublished branch revision.
- Publication blockers are exact-revision repository/Studio/browser CI, both image builds, Compose validation, and component-CD review. Docker is unavailable locally, and local Windows lacks the PostgreSQL/Redis services used by the authoritative integration jobs.
- Production trusted-proxy peer identity remains unknown. The source contract is intentionally fail-closed until bounded runtime observation supplies the exact direct peer and a separately reviewed deployment applies it.
- Catalog production rollout remains paused pending a tagged pre-migration backup, database `0016`, intended API deployment identity/health, an authenticated approved-folder dry-run, and separate authorization for one bounded apply.
- Historical deployment, CI/CD, security-header, worker, canary, and reconciliation evidence is preserved in `docs/delivery-plan-archive.md`. The one successful canary and healthy worker remain bounded `0015` evidence; this branch has not been deployed.

## Sources of truth

- Product and acceptance contract: `docs/project-spec.md`.
- Processing invariants: `docs/studio-processing-contract.md`.
- Workflow: `docs/ai-coding-workflow.md`.
- CI/CD and runtime safety: `docs/ci-cd-rules.md`.
- Architecture: `docs/architecture.md`.
- Operator procedure: `docs/runbooks/studio-platform-ops.md`.
- Validation: `docs/runbooks/validation.md`.

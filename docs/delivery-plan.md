# Delivery plan

## Current dashboard

- ✅ `BATCH-PUBLICATION-2026-07-26` — PR #192 merged as `e825247`. Exact-main repository CI run `30223311852` and Studio CI run `30223311879` passed, including PostgreSQL/Redis pytest, Alembic, frontend tests/build, both Docker image builds, Compose validation, and authenticated Chromium.
- ✅ `PWA-HARDENING-2026-07-26` — The project-create race, Docker contexts/base-image pinning, worker dependency signal, rate-limit atomicity, session write throttling, bounded auth retention, explicit CSRF retry, project-routing authority, source-cleanup consolidation, and their applicable exact-main CI gates are complete.
- ✅ `PWA-NONROOT-SECRET-RUNTIME-01` — PR #193 merged as `93de8cf`. Exact-main repository run `30248034282` and Studio run `30248034348` passed. API CD run `30248034330` built the new image and read the production `0015_user_source_retention` revision through the protected-secret bootstrap, then stopped before replacement on the explicit `0016_transcript_catalog_entries` migration gate.
- ✅ `PWA-PICKER-REFERRER-POLICY-01` — PR #194 merged the privacy-minimizing public `origin` policy while preserving explicit `no-referrer` on presigned local-upload PUTs. Exact-main CI passed at `202deed`; the VPS checkout was fast-forwarded to that revision, the active Studio security-header snippet was backed up, `nginx -t` and reload passed, local/public TLS returned exactly `Referrer-Policy: origin`, both public health endpoints remained HTTP 200, and authenticated Chrome opened the Picker list without the invalid-key failure.
- ✅ `PWA-TRANSCRIPT-MAINTENANCE-SPLIT-01` — PR #195 merged as `5ab3b5f`. Exact-main repository run `30335920148` and Studio run `30335920193` passed. CD run `30335920233` deployed web and API and skipped the manual-only worker. This proves the separated explicit-document implementation, not the newer recursive contract.
- ✅ `PWA-TRANSCRIPT-MAINTENANCE-RECURSIVE-02 + TARGET-MODES-03 / source` — PR #196 merged as `d2cb556`. Exact-main repository CI run `30383911078` and Studio run `30383910844` passed. Standardization and `Манифест Studio` own independent dropdowns and targets: one bounded recursive folder tree or exactly one Google Doc. Requests require the matching mode and exactly one ID; dry-run/apply freshly revalidate that target, skip target-state documents, isolate safe per-document failures, and use a separately consented/stored server-only maintenance OAuth grant.
- 👉 `PWA-GATED-MIGRATION-CD-01 / local infrastructure candidate` — The current branch adds an exact-snapshot/digest/revision migration executor, a dedicated root forced-command wrapper, a release runner limited to one direct additive migration, and a disabled-by-default GitHub job gated by environment `studio-production-migration`. Local targeted tests, Bash syntax, YAML parsing, and lightweight checks pass. GitHub environment/secrets, the VPS-installed wrapper/key, the enable variable, exact-head CI, and a real approved release remain absent; this item adds no production evidence.
- 📋 `PWA-TRANSCRIPT-MAINTENANCE-RECURSIVE-02 + TARGET-MODES-03 / rollout` — Configure the separate maintenance OAuth client/secret and protected migration-lane prerequisites, then use one approved exact-main release to create/verify a new tagged backup, apply `0017`, and deploy exact API identity. Verify same-account consent, then run one safe dry-run per operation and target mode. Apply requires a later explicit decision for each bounded canary.
- 📋 `PWA-TRUSTED-PROXY-01 / production evidence` — The exact-peer source contract and tests are merged. Production peer observation, runtime value selection, and a separately reviewed API deployment remain unproven.
- 📋 `PWA-LEGACY-SUCCESSOR-DISCOVERY-01 / consumer decision` — Both compatibility APIs advertise deprecation and canonical successors; removal/support still requires external-consumer evidence and an explicit decision.
- 📋 `PWA-FRONTEND-MODULARIZATION-03` — Preparation-composer/readiness extraction remains deferred until the production baseline is restored or rollout is waiting on an operator window.
- ✅ `DOCS-DELIVERY-ARCHIVE-01` — Completed Gates 0–7 and superseded validation chains remain in `docs/delivery-plan-archive.md`; this ordinary focused task does not read or modify that archive.

## Audit conclusion

- The stable Colab batch contour remains frozen and accepted at **100%** for its current operational scope. Experimental realtime work is a separate contour and is not included in that claim.
- Studio has broad source-level implementation at merged `main@d2cb556`. Exact-main repository run `30383911078` and Studio/browser run `30383910844` are green for that revision.
- The separately authorized catalog migration passed its backup, service-health, exact-source, exact-revision, table-state, and row-count gates. Production PostgreSQL now reports `0016_transcript_catalog_entries`; no restore, worker, provider, or apply action was performed. Two later non-mutating authenticated Google dry-runs returned zero visible items.
- Merge-triggered Studio Platform CD run `30383911032` selected and deployed web from exact `main@d2cb556`, skipped API on the existing migration boundary, and skipped the manual-only worker. It is web deployment evidence only.
- Independent public checks returned `ok` for `/healthz` and `{"ok":true,"database":"reachable","migrations":"current"}` for `/api/healthz`.
- The `0015` production baseline has a tagged backup, verified component identities, one healthy worker, public TLS/security evidence, and one successful exactly-one-output ElevenLabs-to-Google-Docs canary. That proves only the bounded scenario, not every selected mode or repository head.
- Production PostgreSQL and the deployed API agree on `0016_transcript_catalog_entries`; merged main is one migration ahead at `0017_google_maintenance_oauth`. PR #196's web source is deployed, but API/schema/runtime config are not, so the recursive target-mode contract has no end-to-end production claim.
- The current local branch changes only migration-release infrastructure and its documentation/tests. It does not alter the product contract, configure production, apply a migration, deploy API, grant maintenance OAuth, or run either maintenance operation.
- Authenticated Playwright exercises real Chromium with isolated FastAPI/PostgreSQL/Redis and controlled external boundaries. It raises source/CI confidence but cannot substitute for provider, Google, storage, deployment-identity, or production canary evidence.

## Readiness snapshot

| Contour/dimension | Current estimate | Meaning |
| --- | ---: | --- |
| Stable Colab batch | **100%** | Accepted current scope; do not reopen without an explicit maintenance/product task. |
| Selected Studio v1 source/CI | **100% merged (`40/40`)** | The current maintenance contract, source, targeted tests, and exact-main Linux/Docker/browser CI are present at `d2cb556`. The local CD-infrastructure candidate is tracked separately and cannot increase product readiness. |
| Transcript-maintenance source tasks | **100% (`11/11`)** | Separate OAuth boundary/storage/config/refresh/lifecycle, canonical Docs parsing, recursive scan/preview, exact-document revalidation, strict target-mode routes, per-document isolation, and independent PWA target controls/consent are implemented. This is source completion, not rollout completion. |
| Selected Studio v1 production evidence | **63% historical evidence** | Existing backup/schema, deployed web/API, public edge, worker, and bounded processing evidence remains valid. This local batch adds no production evidence and does not change the historical numerator. |
| Bounded one-small-source canary | **100% of its exact scenario gates** | The `0015` core baseline has backup, component identities, database compatibility, public health/security, one exactly-one-output canary, and safe diagnostics/reconciliation. This must not be generalized to every selected mode or repository head. |
| Transcript-maintenance rollout | **0% (`0/4`)** | Required gates are: `0017` plus maintenance runtime config, exact web/API deployment identity and health, meaningful dry-runs across both target modes and operations, and separately authorized bounded apply evidence. None belongs to this branch yet. |

The scoring method and partial-gate rule are in `docs/audits/repository-audit-2026-07-26.md`. Exact-main `d2cb556` checks are authoritative for merged product source. The current branch adds only local infrastructure evidence. Documentation, workflow source, local tests, and prior zero-item requests cannot increase production readiness.

## Product roadmap after production proof

Order work so each capability inherits a known source and production baseline:

1. Publish the guarded migration-CD infrastructure as one PR, inspect exact-head checks, and merge only after CI is green.
2. With the release lane still disabled, create the protected GitHub environment and dedicated secrets, install the root-owned forced-command wrapper/key on the VPS, and validate runtime backup plus distinct maintenance OAuth secret-file prerequisites. Enable the repository variable last.
3. Dispatch the protected migration release from exact `main`, approve it once, and require a new verified tagged backup, exact `0016 → 0017` revision transition, exact API image identity, and local/public health. Worker rollout is not part of this release.
4. Complete and verify same-account maintenance consent while preserving the narrow primary Picker grant.
5. In the user's authenticated Chrome, run a bounded non-mutating dry-run matrix for both operations: one recursive-folder target and one single-document target per panel; review only safe results.
6. Require a separate explicit authorization for each bounded apply. Never use one operation's mode, target, preview, confirmation, or result as authority for the other.
7. Run bounded production canaries for the remaining selected modes: auto-detect language, diarization, video preparation, long-media split/merge, and multi-file processing.
8. Confirm external consumers of the two deprecated compatibility APIs, then either remove them or record an explicit support/removal contract. Existing deprecation/successor headers do not prove that consumers have migrated.
9. Resume preparation-composer and API-router modularization in bounded behavior-preserving slices.
10. Add golden Colab/PWA fixtures, then validate claim/lease/heartbeat/recovery under concurrency before increasing the production worker count.

OpenAI processing remains deferred, and the already source-complete media preparation path is not reopened by this sequence. Accepted-output reuse/skip requires an explicit linkage design and is not inferred from catalog matching.

Any change to the durable product meaning or acceptance criteria above requires an explicit user decision and a separate update to `docs/project-spec.md`.

## Maintainability and infrastructure lane

These tasks are valuable but do not outrank the completed production safety gates or explicitly selected product work:

PR #188 and PR #192 completed the CD-observability, dependency-remediation, Actions-runtime, Docker-context/image-build, and worker-dependency-signal evidence. Remaining maintainability work:

1. Finish `PWA-GATED-MIGRATION-CD-01` source review/CI, then perform its separately approved one-time GitHub/VPS setup; do not count setup source as production migration evidence.
2. Obtain production trusted-peer evidence for the exact-IP contract; do not guess or deploy the peer value from source inspection.
3. Resume `PWA-FRONTEND-MODULARIZATION-03`: extract bounded preparation composer/readiness behavior, then split `App.test.tsx` by the same domain boundaries.
4. Modularize `apps/studio-api/studio_api/main.py` into domain routers/response models, followed by a fixture-preserving split of `tests/test_studio_api_core.py`.
5. Simplify the 619-line `docs/ai-coding-workflow.md` in a dedicated documentation task; keep `AGENTS.md` as the lightweight router and avoid duplicating product/CI contracts.

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

- Local `main` and `origin/main` are synchronized at merge revision `d2cb556`. Exact-main repository CI run `30383911078` and Studio run `30383910844` passed, including repository, PostgreSQL/Redis/Alembic, frontend, authenticated browser, image-build, protected-secret bootstrap, and Compose gates.
- Merge-triggered CD run `30383911032` deployed web from exact `d2cb556`, while API and worker were skipped. The API skip preserves the production `0016` boundary; a green summary is not API/schema deployment evidence.
- The current `codex/studio-gated-migration-cd` branch is `0 behind / 5 ahead` of local `main` after five focused task commits, including the final setup/test review. The portable suite reports `881 passed, 6 skipped`; the release chain and workflow-focused tests pass; Bash syntax, workflow YAML parsing, lightweight checks, and diff checks pass. Exact-head GitHub CI and every GitHub/VPS setup or runtime step remain absent.
- Studio Platform CD run `30248034330` selected only API, built the intended source image, and reported production database revision `0015_user_source_retention` against image head `0016_transcript_catalog_entries`. It emitted `manual migration required` and stopped before API recreation; web and worker deployment jobs were skipped.
- Read-only public checks after the CD run returned HTTP 200 for `/healthz` and `/api/healthz`. The API result belongs to the prior image/schema baseline and is not new-image identity evidence.
- Read-only host preflight run `30250456568` validated the dispatch/SSH boundary and reached merged commit `93de8cf`, but stopped before backup or migration when the deploy user received `Permission denied` reading a protected operator-owned source-storage secret file. No secret value was printed, and no backup, migration, deploy, worker, provider, or Google action ran.
- A separately approved privileged operator path preserved protected-file permissions, confirmed PostgreSQL and Redis healthy, and created catalog pre-migration snapshot `15ca68cc3e4f`. Read-only verification matched its timestamp, host, and required tags, restored the snapshot into an isolated root-only temporary directory, found one `102318`-byte custom-format dump, and parsed its object list successfully with `pg_restore`. The temporary verification directory was removed; no production restore, migration, deployment, worker, provider, or Google action ran.
- The separately authorized migration revalidated `main@93de8cf`, snapshot `15ca68cc3e4f`, healthy PostgreSQL/Redis, image head `0016_transcript_catalog_entries`, database current `0015_user_source_retention`, and absence of the catalog table before running the repository migration once. It finished with database revision `0016_transcript_catalog_entries`, the catalog table present, and `catalog_rows=0`; no uncertain or retry marker occurred.
- Manual API-only CD run `30263481907` succeeded at `93de8cf`. The deploy job built only API, verified PostgreSQL/Redis and exact database/image revision equality, force-recreated only API, verified running image identity, and emitted `STUDIO_PLATFORM_API_DEPLOY_OK`. Web and worker jobs were skipped. Independent public web/API checks then passed, with the API reporting `database=reachable` and `migrations=current`.
- After the operator corrected the Picker API-key layout in the runtime `.env`, manual API-only CD run `30287692026` succeeded at the same exact `main@93de8cf`. It built and force-recreated only `studio-api`, verified healthy PostgreSQL/Redis, exact database/image revision equality, and running image identity, then emitted `STUDIO_PLATFORM_API_DEPLOY_OK`. Web and worker jobs were skipped. Independent public checks returned `ok` and `{"ok":true,"database":"reachable","migrations":"current"}`. This proves the configuration-consuming API was recreated and healthy, not that Google Picker now accepts the key.
- The repository-provided `studio-postgres-backup.service` and timer were reported `not-found` on the VPS. This does not invalidate the verified one-off snapshot, but recurring backup automation remains an operator/infrastructure gap and requires a separate installation/enablement task.
- PR #193 implementation/test commits provide the protected secret bootstrap, normalized revision-probe failure, one focused Docker smoke, the aligned lightweight wiring guard, and the Linux fixture correction. Locally, the portable suite passed `806 passed, 6 skipped`; lightweight checks, focused entrypoint/Compose and workflow tests, Python compilation, YAML parsing, shell syntax checks, and diff checks also passed.
- Docker remains unavailable locally, and the Windows Python/Git-Bash path model cannot execute the repository's POSIX fake-binary shell integration harness reliably. Exact Linux/Docker CI has passed for the merged revision.
- Production trusted-proxy peer identity remains unknown. The source contract is intentionally fail-closed until bounded runtime observation supplies the exact direct peer and a separately reviewed deployment applies it.
- The explicit host-nginx rollout backed up `/etc/nginx/snippets/studio-security-headers.conf`, changed only its Studio referrer policy, passed `nginx -t`, reloaded nginx, and verified exactly `origin` through both localhost-resolved and public TLS. Public `/healthz` and `/api/healthz` remained HTTP 200. One immediate strict probe triggered a clean automatic rollback before tracing excluded upstream headers and public cache/proxy drift; the guarded retry then passed on its first local and public probes.
- Authenticated Chrome opened the production Google Picker list under the live `origin` policy. Folder-only `drive.file` dry-runs then returned zero visible documents despite files being present, which exposed the child-authority gap. PR #195's explicit-document split was merged, passed exact-main CI, and deployed as the interim correction; no apply was performed.
- PR #196 merged separate encrypted maintenance consent, exact same-account/scope validation, server-only refresh, bounded recursive traversal, exact single-document revalidation, strict `selection_mode` plus one-ID request schemas, per-document isolation, and independent PWA dropdown/target state. Exact-main CI is green; that proves source/CI only.
- Repository head is `0017_google_maintenance_oauth`, while production remains operator-evidenced at `0016_transcript_catalog_entries`. The protected environment, its dedicated secrets/reviewer, VPS forced-command wrapper/key, enable variable, maintenance runtime client/secret/scopes, API rollout, same-account maintenance consent, and target-mode dry-run/apply evidence are absent. These are explicit rollout blockers, not source defects.
- Historical deployment, CI/CD, security-header, worker, canary, and reconciliation evidence is preserved in `docs/delivery-plan-archive.md`. The one successful canary and healthy worker remain bounded earlier-baseline evidence; PR #193 is merged, CI-verified, and deployed for API, while worker deployment remains manual-only and was not part of run `30263481907`.

## Sources of truth

- Product and acceptance contract: `docs/project-spec.md`.
- Processing invariants: `docs/studio-processing-contract.md`.
- Workflow: `docs/ai-coding-workflow.md`.
- CI/CD and runtime safety: `docs/ci-cd-rules.md`.
- Architecture: `docs/architecture.md`.
- Operator procedure: `docs/runbooks/studio-platform-ops.md`.
- Validation: `docs/runbooks/validation.md`.

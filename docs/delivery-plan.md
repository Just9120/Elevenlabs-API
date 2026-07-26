# Delivery plan

## Current dashboard

- ✅ `PWA-FRONTEND-MODULARIZATION-01B/02` — The first two behavior-preserving frontend tranches are merged through PR #180 at `605cbae`; repository, Studio, authenticated Chromium, and web deployment checks passed.
- ✅ `PWA-PROCESSING-ROLLOUT-01A / Gate 0A` — PR #181 merged the manual-only read-only worker-status path at `749833c`; run `29925528002` safely proved one running, not-drained worker while leaving its image identity unknown.
- ✅ `PWA-PROCESSING-ROLLOUT-01A / Gate 0B` — PR #182 merged the controlled drain path at `850bfdf`; run `29929528124` gracefully drained the worker, and preflight run `29929607368` passed runtime/service/local/public checks before blocking on production database revision mismatch.
- ✅ `PWA-PROCESSING-ROLLOUT-01A / Gates 0C–3` — PR #183 merged the processing source batch at `77a3b39`. A tagged restic/R2 PostgreSQL backup completed as snapshot `7b03ad00`; the authorized migration then applied `0011 → 0012 → 0013 → 0014 → 0015`. Isolated API deployment run `30004599136` succeeded, and post-deploy preflight run `30004696267` proved database head `0015_user_source_retention`, healthy PostgreSQL/Redis, and passing public API/web health.
- ✅ `PWA-PROCESSING-SOURCE-BATCH-01` — Transcription language/diarization, validated multi-source intake, video and long-media preparation, batch preflight/progress, aggregate analytics, transcript-catalog duplicate decisions, and the final provider-call guard are merged through PR #183. Source and CI evidence is complete for that batch; real provider/Google behavior still belongs to the controlled rollout gates.
- ✅ `PWA-UX-STABILIZATION-04 / Gate 4 diagnostics baseline` — PR #184 is merged at revision `89fa7d5`. The safe Picker diagnostics and walkthrough-driven navigation, preparation, credential-safety, and analytics-copy changes are part of the released source baseline.
- ✅ `PWA-LOCAL-UPLOAD-STABILIZATION-05 / Gate 4 source and deployment` — PR #185 merged at revision `900bf5b`. Post-merge CI run `30098393764`, Studio run `30098393750`, and component CD run `30098393662` passed. Web and API were rebuilt, their running image identities matched the intended images, localhost post-checks passed, and both public health endpoints returned `200`.
- ✅ `PWA-PROCESSING-ROLLOUT-01A / Gate 4` — The clean authenticated functional smoke passed both Picker roles, one single-attempt local upload/completion, required credential/folder/source prerequisites, and source-removal cleanup messaging. The committed security policy was then applied to the active public-host nginx through a separately backed-up snippet, `nginx -t` passed, and independent checks proved both the PWA and API returning all six required headers over TLS 1.3. The authenticated PWA subsequently loaded under the CSP without browser-console errors.
- ✅ `PWA-PROCESSING-ROLLOUT-01A / Gate 5` — Read-only run `30107810563` reconfirmed the old worker gracefully stopped at production commit `900bf5b`. The first worker-only deploy attempt in run `30107907971` blocked before build because the stopped container referenced an already-missing image and no rollback tag could be preserved. After separately authorized removal of only that stale stopped container record, the failed job was rerun successfully: database/image revision compatibility passed, exactly one worker started healthy from the commit-specific `900bf5b` image, and post-deploy status reported `identity_match=yes`. The authenticated PWA showed no current tasks, proving the worker was left idle.
- ✅ `PWA-PROCESSING-ROLLOUT-01A / Gate 6` — After separate operator authorization, one bounded Drive-source canary was submitted exactly once. It reached `completed`, persisted exactly one `google_docs_transcript`, and the created native Google Doc was confirmed through Drive metadata as present and non-empty. No retry or second job was submitted. Post-canary worker-status job `89537922592` passed with the worker `running`, Docker `healthy`, and `identity_match=yes`.
- ✅ `PWA-PROCESSING-ROLLOUT-01A / Gate 7 stabilization` — PR #186 merged at `39aaaff`. PR and post-merge repository/Studio CI passed, including the real PostgreSQL/Redis-backed authenticated Chromium job. Component CD run `30120922496` fast-forwarded production to `39aaaff`, rebuilt/deployed only the changed web component, verified running image identity and localhost health, and correctly skipped API and manual-only worker deployment. Authenticated live verification shows the completed canary source as `Статус обработки: Завершена` with no raw internal `queued` label. The running worker still has no retained prior-image candidate.
- ✅ `PWA-E2E-FOUNDATION-01B` — PR #187 merged at revision `7362a0c`. The secretless authenticated Chromium scenario covers the principal preparation, job-result, reconciliation, and safe-diagnostics boundaries against isolated FastAPI/PostgreSQL/Redis state.
- ✅ `CI-MAINTENANCE-BATCH-01` — PR #188 merged at revision `0b23320`. The batch upgrades repository-owned GitHub Actions runtimes, adds explicit component-CD selection/result summaries, remediates the Node advisory graph to zero reported vulnerabilities, enforces the supported Node range, and hardens the read-only dependency-audit workflow without changing product behavior or deployment selection rules.
- ✅ `DEPENDENCY-AUDIT-VERIFICATION-01C` — Exact-revision workflow run `30175970003` passed both Python and Node jobs at published branch revision `889a9ff`; the dependency release blocker is cleared.
- ✅ `CI-MAINTENANCE-BATCH-01 / post-merge` — Repository CI run `30175325342`, Studio PWA CI run `30175325383`, and Studio Platform CD run `30175325341` passed at merge revision `0b23320`. CD selected and deployed only the changed web component, verified its image identity and localhost health, reported explicit reason/result codes, and correctly skipped unchanged API and manual-only worker components.
- ✅ `PWA-PREFLIGHT-UNCERTAINTY-01` — PR #189 merged at revision `95d3210`. PR and post-merge repository/Studio CI passed, including service-backed PostgreSQL and authenticated Chromium. Component CD deployed the changed web and API components, verified their running image identities and localhost health, skipped the manual-only worker, and public web/API health passed.
- ✅ `PWA-TRANSCRIPT-CATALOG-MIGRATION-01 / source acceptance` — PR #190 merged at `625cd33`: browser-safe dry-run, separately confirmed idempotent apply, eligible in-place `transcript_doc_v1.2` standardization, minimal durable Studio catalog metadata, linked-catalog duplicate authority, explicit conflict outcomes, and a fail-closed PWA entry point are in `main`. Repository CI and the Studio lint/unit/build job passed for the merge revision.
- ✅ `AUDIT-BASELINE-2026-07-26` — The deep repository audit at `docs/audits/repository-audit-2026-07-26.md` reconciles documentation, code, architecture, CI/CD, public health, readiness gates, and a 12-task local batch without changing product/runtime behavior.
- ⏳ `PWA-PROJECT-CREATE-NAVIGATION-RACE-01` — Local source implementation and deterministic regression evidence are complete on the working branch: an explicit `Новый проект` action now clears the pending `browse` intent before opening the form, and a delayed `/projects` test reproduces the old close-after-load behavior. Exact changed-revision Studio/browser CI remains required after batch publication before this item is marked done.
- ⏳ `PWA-DOCKER-CONTEXT-01` — Local source and static contract evidence are complete on the working branch: frontend/API contexts exclude host dependencies, generated output, caches, test artifacts, virtual environments, and local environment/secret-shaped files while retaining required build inputs. Docker is unavailable in the local environment, so both exact-revision image builds remain required in Studio CI after batch publication.
- ⏳ `PWA-WORKER-CHANGE-DETECTION-01` — Local workflow and contract evidence are complete on the working branch. Any API-context change now reports a manual worker dependency review while automatic worker deployment remains impossible; exact-revision workflow evidence remains pending publication.
- ⏳ `PWA-TRUSTED-PROXY-01` — Local source/config support is complete on the working branch: one validated exact trusted peer is wired through Compose, forwarded headers remain ignored for every other direct peer, and the runbook requires bounded peer observation before any production value/deploy change. Production peer identity and runtime verification remain unproven.
- ⏳ `PWA-RATE-LIMIT-ATOMICITY-01` — Local source and unit evidence are complete on the working branch. Redis increment plus first-expiry assignment now execute in one transaction, legacy no-TTL counters self-heal, and the existing limits, 429 body, and `Retry-After` contract are unchanged; service-backed CI remains pending.
- 👉 `PWA-SESSION-LAST-SEEN-01` — Next local item. Throttle durable session activity writes while preserving expiry, revocation, ownership, and authentication behavior.
- ⏸ `PWA-TRANSCRIPT-CATALOG-MIGRATION-01 / production rollout` — Stateful operator item after a green merged source batch: tagged pre-migration backup, manual migration to `0016_transcript_catalog_entries`, intended API deployment/identity/health verification, authenticated approved-folder dry-run, and a separately authorized apply.
- 📋 `PWA-LEGACY-AUTHORITY-01` — After the catalog batch, confirm external consumers and then remove the two deprecated compatibility APIs or retain them with an explicit support/removal contract.
- ⏸ `PWA-FRONTEND-MODULARIZATION-03` — Preparation composer/readiness extraction is deferred until the production baseline is known or rollout is waiting on an explicit operator window.

## Audit conclusion

- The stable Colab batch contour remains frozen and accepted at **100%** for its current operational scope. Experimental realtime work is a separate contour and is not included in that claim.
- Studio has broad source-level implementation at merged `main` revision `c02accd`; the application/runtime source remains the `625cd33` baseline because the intervening merge is documentation-only. Gates 4–7 remain complete: the real one-output ElevenLabs-to-Google-Docs path is production-proven, PR #187 established secretless browser coverage around the principal preparation/job-result safety boundaries, PR #189 deployed the browser-safe provider-attempt preflight authority, and PR #190 merged the one-time catalog migration/standardization source. The working branch contains a focused project-create race fix and deterministic delayed-load regression test, but the stabilization blocker remains open until the exact changed revision passes Studio/browser CI; it is not evidence that the earlier bounded provider/Google canary failed.
- Production PostgreSQL has a verified tagged backup boundary (`7b03ad00`) and remains operator-evidenced through `0015_user_source_retention`. Repository head `0016_transcript_catalog_entries` is not production-applied; the currently deployed older API reports migrations current relative to its own image, not relative to `625cd33`.
- Exactly one worker is running healthy from the commit-specific `900bf5b` image. Deploy run `30107907971`, the bounded successful canary, and post-canary status job `89537922592` prove database compatibility, Docker health, one persisted Google Docs output, and `identity_match=yes`. The processing path may now be described as production-live with bounded canary evidence; broader workload confidence still depends on stabilization.
- The clean 2026-07-24 operator smoke supersedes the earlier ambiguous upload evidence. Both Google Picker roles opened successfully, one Drive source and one writable output folder were selected, the account showed one active ElevenLabs credential, and one local source uploaded and completed without a manual duplicate retry. Removing the disposable local source immediately blocked its composer row and reported queued background storage cleanup. No transcription job was created.
- Live TLS/public routing and the browser security policy are now verified for both the PWA and API (`200` over TLS 1.3 with a valid host certificate and all six required headers). Standard component CD intentionally does not apply host nginx, so the operator applied the policy with a timestamped backup, successful `nginx -t`, reload, independent header verification, and an authenticated PWA load under the resulting CSP.
- Studio Platform CD is not generally broken: migration-changing pushes intentionally suppress automatic API deployment, and worker deployment is intentionally manual-only. At `625cd33`, run `30202031076` deployed and identity-checked only the source-changed web component, skipped API with `manual_migration_required`, and skipped worker with `manual_only`.
- The authenticated Playwright suite uses real Chromium with isolated FastAPI/PostgreSQL/Redis and controlled external boundaries. It does not call ElevenLabs, Google, S3/R2, or production and therefore does not replace the controlled canary. Run `30202031078` failed before the project form opened, while exact-main run `30207923262` later passed all nine scenarios without an application-code change. A deterministic Vitest delayed-load regression now covers the race locally; browser determinism for the changed source remains unproven until exact-revision Studio/browser CI passes after publication.

## Readiness snapshot

| Contour/dimension | Current estimate | Meaning |
| --- | ---: | --- |
| Stable Colab batch | **100%** | Accepted current scope; do not reopen without an explicit maintenance/product task. |
| Selected Studio v1 source/CI | **96%** | Reproducible gate average from the 2026-07-26 audit: current contract, implementation, targeted tests, and exact-main CI are scored separately for required epics. |
| Selected Studio v1 production evidence | **57%** | Reproducible gate average across applicable schema/config, deployed identity, worker, authenticated/public, and real-external-effect evidence. |
| Bounded one-small-source canary | **100% of its exact scenario gates** | The `0015` core baseline has backup, component identities, database compatibility, public health/security, one exactly-one-output canary, and safe diagnostics/reconciliation. This must not be generalized to every selected mode or repository head. |
| Catalog migration production rollout | **about 20%** | Source and web UI are merged and the web component is deployed, but production backup for this migration, database `0016`, intended API deployment, authenticated dry-run, and separately authorized apply remain. |

The scoring method and per-epic fractions are in `docs/audits/repository-audit-2026-07-26.md`. The local project-create, Docker-context, worker-visibility, trusted-peer, and rate-limit atomicity fixes improve implementation confidence but do not yet promote exact-main CI, image-build, deployment, or production-runtime gates, so the aggregate estimates remain unchanged pending publication. Catalog production readiness changes only after the separately evidenced backup, migration, API deployment, dry-run, and authorized apply gates.

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

### Gate 4 — public browser boundary (completed)

1. PR #184 merged the safe Picker failure classification/diagnostics and walkthrough-driven UX batch. PR #185 subsequently merged and deployed the upload-stabilization batch at `900bf5b`; post-merge repository/Studio CI and API/web component deployment evidence are green.
2. Reproduce one source-Picker open and one output-folder-Picker open from the public authenticated PWA.
3. Read only the allowlisted `GOOGLE_PICKER_SESSION_FAILED` reason and HTTP category. Do not inspect or expose refresh tokens, access tokens, raw Google responses, or private source data.
4. Follow the proven branch: reconnect Google for `google_reauthorization_required`; correct server Picker/OAuth configuration for `google_picker_not_configured`; investigate/retry boundedly for `google_token_unavailable`; stop on an unknown result.
5. Verify the committed host security-header policy, `nginx -t`, TLS/public routing, and the presigned local-upload initiation/completion boundary with no-store browser behavior.
6. Confirm the authenticated operator account has one active ElevenLabs credential, a valid Google connection, one writable output folder, and one small supported source.

Exit: the real public browser/API integration boundary is ready for one controlled job.

Exit: met. The clean authenticated smoke passed both Picker roles, one single-attempt local upload and completion, one writable output folder, one active ElevenLabs credential, a valid Google connection, and the source-removal boundary. The removed local source was immediately excluded from preparation and the PWA reported queued background cleanup without waiting for the retention deadline; its physical cleanup outcome was not inspected. The operator applied the committed host policy through a dedicated snippet after preserving the active Certbot-managed configuration as timestamped backup `studio.librechat.online.pre-security-headers-20260724T154127Z`; `nginx -t` and reload succeeded. Independent checks then proved both `/` and `/api/healthz` returning `200` over TLS 1.3 with the required CSP, HSTS, MIME-sniffing, referrer, permissions, and framing headers. An authenticated PWA load under that CSP completed without browser-console errors.

### Gate 5 — deploy exactly one worker (completed)

1. Confirm the old worker is absent or explicitly drained/stopped.
2. Manually dispatch only the `worker` component.
3. Require intended checkout/image identity, database-head compatibility, Docker health, and exactly one healthy worker shown idle before the canary.

Exit: met. Fresh read-only run `30107810563` first proved the production checkout at `900bf5b` and the previous worker still `exited` with `exit_code=0` and `drain_state=gracefully-drained`. Worker-only run `30107907971` initially stopped before build with `rollback_candidate_preserve_failed` because Docker no longer retained the old stopped image. After separate operator authorization, a guarded command verified exactly one `studio-worker` container, `exited`, `exit_code=0`, and missing image bytes before removing only that stale container record without volumes. Rerunning only the failed worker job built the `900bf5b` worker, verified PostgreSQL health and database/image Alembic equality, recreated no dependencies, proved running/built/commit-tag image identity equality, reached Docker `healthy`, and printed `STUDIO_PLATFORM_WORKER_DEPLOY_OK`. The post-deploy status rerun reported one `running`/`healthy` worker with `identity_match=yes`; the authenticated PWA showed no current tasks and no console errors. The initial deployment has no prior-image rollback candidate because that image was already absent; the safe immediate rollback boundary is to drain/stop the new worker, not to invent an old image.

### Gate 6 — controlled one-output canary (completed)

1. Use one approved account, one small source, one owner-scoped ElevenLabs BYOK credential, one valid Google connection, and one selected writable folder.
2. Submit one job once. Do not manually retry, duplicate, replace, or start a second job when side-effect state is uncertain.
3. Require a safe terminal state. Success requires exactly one persisted output and one validated Google Doc in the selected folder.
4. Stop on duplicate output, provider/Google uncertainty, lease ambiguity, worker identity drift, or unsafe evidence.

Exit: met. After explicit authorization, the preflight found no accepted Studio result with the same settings. One supported Drive audio source and one writable folder produced exactly one job from one confirmation. The job moved through source preparation and one ElevenLabs transcription to `completed`, persisted exactly one `google_docs_transcript`, and reported a non-empty transcript. Read-only Drive metadata independently confirmed that the linked output is a newly created, non-empty native Google Doc. No manual or automatic second submission occurred. Post-canary worker-status job `89537922592` then proved the worker remained `running`/`healthy` at the intended `900bf5b` image with `identity_match=yes`.

### Gate 7 — stabilization checkpoint (completed)

1. Verify the worker returns to healthy idle state and inspect owner-scoped safe diagnostics/reconciliation state.
2. Record deployed web/API/worker identities, database head, CI/CD run links, canary result, and residual risks in this dashboard.
3. Recalculate readiness from evidence and choose the next product milestone.

Exit: met. Owner-scoped production diagnostics show one `JOB_CREATED`, one processing attempt, one provider request, one `OUTPUT_PERSISTED` with `output_count=1`, and one `JOB_COMPLETED` with final status `completed`; the filtered chain contains no error or uncertainty event. The read-only reconciliation endpoint reports the single case `resolved`, `available=false`, and zero unresolved/conflicting cases, so no manual reconciliation action or repeated Google side effect is required. PR #186 merged the result-status fix and strengthened the authenticated browser scenario with the exact completed-output/relation-queued regression, resolved reconciliation, and owner-filtered safe diagnostics. PR and post-merge CI executed that scenario against FastAPI, PostgreSQL, Redis, migrations, seed, and headless Chromium. Web-only CD fast-forwarded production to `39aaaff`, verified the running web image identity and localhost health, and authenticated live verification then showed `Статус обработки: Завершена` without the raw `queued` label. API and worker correctly remained unchanged; the absent prior worker-image rollback candidate remains documented.

## Product roadmap after production proof

Order product work so that each capability inherits a known production baseline:

`PWA-E2E-FOUNDATION-01B` and `PWA-PREFLIGHT-UNCERTAINTY-01` remain source-complete through PRs #187 and #189. Current order:

1. ⏳ `PWA-PROJECT-CREATE-NAVIGATION-RACE-01` — local fix and delayed-load regression complete; exact-revision authenticated Chromium remains.
2. ⏳ `PWA-DOCKER-CONTEXT-01` — local frontend/API exclusions and static contract complete; exact-revision image builds remain.
3. ⏳ `PWA-WORKER-CHANGE-DETECTION-01` — local conservative manual-review visibility complete; exact-revision workflow evidence remains.
4. 👉 Authentication/runtime hygiene — local exact-peer and rate-limit atomicity support are complete; production peer evidence remains, and session-write amplification plus expired auth-row retention are next.
5. `PWA-TRANSCRIPT-CATALOG-MIGRATION-01 / production rollout` — only after a green merged source batch, preserve a tagged backup, migrate PostgreSQL to `0016_transcript_catalog_entries`, deploy/verify the intended API, run an authenticated approved-folder dry-run, and require separate authorization before one bounded apply.
6. Selected-capability production canaries — validate auto-detect language, diarization, video preparation, long-media split/merge, and multi-file processing without treating one small-source success as proof of all modes.
7. `PWA-LEGACY-AUTHORITY-01` — confirm external consumers, then remove the two deprecated compatibility APIs or retain them with an explicit support/removal contract. The old static UI and obsolete stateless/full-platform deploy paths are already removed.
8. Golden Colab/PWA fixtures — lock normalization, ordering, output shape, and failure semantics before adding any later parity paths.
9. Multi-worker validation — only after single-worker production stability; prove claim/lease/heartbeat/recovery behavior under concurrency before increasing worker count.

OpenAI processing remains deferred, and the already source-complete media preparation path is not reopened by this sequence. Accepted-output reuse/skip requires an explicit linkage design and is not inferred from catalog matching.

Any change to the durable product meaning or acceptance criteria above requires an explicit user decision and a separate update to `docs/project-spec.md`.

## Maintainability and infrastructure lane

These tasks are valuable but do not outrank the completed production safety gates or explicitly selected product work:

PR #188 and dependency-audit verification completed the CD-observability, dependency-remediation, and Actions-runtime items recorded in the dashboard. Remaining maintainability work:

1. Prove the local `.dockerignore` context contracts through exact-revision frontend/API image builds in Studio CI.
2. Prove the local worker shared-dependency review signal through exact-revision component-CD evidence.
3. Obtain production trusted-peer evidence for the local exact-IP contract, and continue auth/session/rate-limit retention work without guessing the runtime value.
4. Resume `PWA-FRONTEND-MODULARIZATION-03`: extract bounded preparation composer/readiness behavior, then split `App.test.tsx` by the same domain boundaries.
5. Modularize `apps/studio-api/studio_api/main.py` into domain routers/response models, followed by a fixture-preserving split of `tests/test_studio_api_core.py`.
6. Simplify the 619-line `docs/ai-coding-workflow.md` in a dedicated documentation task; keep `AGENTS.md` as the lightweight router and avoid duplicating product/CI contracts.

Current large-file concentrations are maintainability signals, not automatic defects: `App.test.tsx` ~8.5k lines, `test_studio_api_core.py` ~4.8k, `App.tsx` ~4.1k, `test_text_processing_helpers.py` ~4.0k, and API `main.py` ~1.4k. The ~9.0k-line stable Colab implementation is deliberately excluded from opportunistic refactoring.

## Documentation disposition

- Keep the currently present core source/router/support documents in their assigned roles. No optional Context Bundle Builder or AI-delivery-infrastructure document should be created without a real requested workstream.
- Keep `docs/runbooks/repository-audit-2026-07-21.md` as a dated historical snapshot; its old readiness and sequence are superseded here.
- Keep `docs/audits/repository-audit-2026-07-26.md` as the current dated audit evidence; it does not replace this dashboard or the product contract.
- Keep the processing contract and Studio operations runbook separate: one owns processing invariants, the other owns operator procedure.
- Do not read or update `docs/delivery-plan-archive.md` during ordinary tasks. The current broad audit identifies completed Gates 0–7 and long validation/status chains for a focused compaction commit in this local batch.
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
- The audit local gate passed `788` portable Python tests with `6` skipped, all `285` frontend unit/component tests, ESLint, TypeScript, production build, lightweight repository checks, and Playwright discovery of `9` authenticated scenarios. PostgreSQL/Redis-backed API and authenticated Chromium behavior remain GitHub CI authority and are not replaced by local portable evidence.
- Exact-main repository CI run `30207923222` and Studio run `30207923262` passed at `c02accd`; Studio passed both `studio` and `browser-e2e`. Because no application code changed after the `625cd33` browser failure, the later green run does not resolve the project-create race.
- Catalog production rollout remains incomplete after source merge. Required evidence is a tagged pre-migration backup, manual database migration to `0016_transcript_catalog_entries`, intended API deployment identity/health, an authenticated approved-folder dry-run, and a separately authorized single apply. No catalog Google mutation or production database change is implied by source readiness or the deployed web UI.
- PR #190 post-merge repository CI run `30202031053` passed. Studio run `30202031078` passed lint, unit/component tests, production build, image builds, and Compose validation, but authenticated Chromium failed at the first project-creation scenario and left eight scenarios unrun. Component CD run `30202031076` deployed/verified only web, skipped API with `manual_migration_required`, and skipped worker with `manual_only`.
- Independent audit-time public checks returned `200` for the PWA with the six required header families and `{"ok":true,"database":"reachable","migrations":"current"}` for the deployed API. This proves the deployed web/API boundary only; it does not prove production equality with repository migration head `0016`.
- PR #187 checks passed after the authenticated-session fix. Post-merge repository CI run `30129485474` and Studio run `30129485476` passed; the latter executed both `studio` and real PostgreSQL/Redis-backed `browser-e2e` jobs.
- Component CD run `30129485498` detected only the web change. `deploy-web` fast-forwarded production to `7362a0c`, rebuilt the web image, verified its running identity and localhost health, and succeeded; `deploy-api` and manual-only `deploy-worker` were correctly skipped.
- PR #188 source acceptance is complete: repository CI run `30174331982` passed, Studio PWA CI run `30174331983` passed after a transient Docker Hub timeout rerun, and the exact published revision passed dependency-audit run `30175970003` with both jobs successful. Post-merge repository CI `30175325342`, Studio PWA CI `30175325383`, and component CD `30175325341` also passed. The CD summary reported `web=success/source_changed`, `api=skipped/not_changed`, and `worker=skipped/manual_only`.
- PR #189 source acceptance is complete: PR CI `30177377055` and Studio PWA CI `30177377357` passed, including the PostgreSQL/Redis-backed API scenarios and authenticated Chromium. Post-merge repository CI `30177718794` and Studio PWA CI `30177718783` passed. Component CD `30177718793` deployed source-changed web/API, verified both running image identities and localhost health, skipped the manual-only worker, and completed its deployment summary. Independent public checks then returned `ok` for web health and `{"ok":true,"database":"reachable","migrations":"current"}` for API health.
- The backend completion regression test is present but cannot run against the Windows local environment without PostgreSQL. The preflight behavior tests are Linux-oriented and Git Bash path semantics cannot reproduce their host identity gate; GitHub CI remains authoritative for both.
- Pre-migration backup snapshot `7b03ad00` completed successfully against the configured restic/R2 repository, and the manual migration reached `0015_user_source_retention`.
- Isolated API deployment run `30004599136` succeeded. Post-deploy preflight `30004696267` proved database head `0015`, healthy PostgreSQL/Redis, and passing public API/web health.
- Pre-deploy worker-status run `30107810563` proved production `900bf5b`, `container_state=exited`, `exit_code=0`, and `drain_state=gracefully-drained`. The first run `30107907971` attempt blocked before build because the old image bytes were already absent; separately authorized guarded removal deleted only the stale stopped container record after revalidating its safe state.
- The clean 2026-07-24 authenticated smoke opened both Picker roles, selected one Drive source and one writable output folder, confirmed one active ElevenLabs credential and a valid Google connection, completed one local upload without a manual retry, and verified the queued-cleanup deletion response. No transcription job was created and no provider call was made.
- The active Certbot-managed host configuration was backed up as `studio.librechat.online.pre-security-headers-20260724T154127Z`; the repository-owned six-header policy was installed through a dedicated nginx snippet without replacing the TLS block. `nginx -t`, reload, and service-active checks passed.
- Independent public checks returned `200` over TLS 1.3 with the expected CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and `X-Frame-Options` values for both `/` and `/api/healthz`. The authenticated PWA loaded under that CSP with no browser-console errors.
- Worker-only run `30107907971` then succeeded on its failed-job rerun with database/image revision equality, one healthy worker, exact running/built/commit-tag image equality at `900bf5b`, and `STUDIO_PLATFORM_WORKER_DEPLOY_OK`; API/web remained skipped. Post-deploy status rerun `30107810563` reported `running`, `healthy`, and `identity_match=yes`. The authenticated PWA showed no current tasks, so the worker was left idle.
- The separately authorized Gate 6 canary was submitted once with one Drive source and one writable output folder. It completed with exactly one persisted Google Docs transcript; Studio reported a non-empty transcript, and read-only Drive metadata confirmed a newly created, non-empty native Google Doc. No retry or second job was submitted.
- Post-canary worker-status job `89537922592` in run `30107810563` passed with `container_state=running`, `health=healthy`, and `identity_match=yes` at `900bf5b`. The prior-image rollback candidate remains absent.
- Gates 4–7 remain complete. Authenticated production verification at `39aaaff` established the completed canary source as `Статус обработки: Завершена` with no raw `Статус файла: queued`; PR #187 subsequently deployed the expanded browser E2E source baseline at `7362a0c`, PR #188 closed the dependency/action/CD-observability lane, PR #189 deployed the provider-attempt preflight authority at `95d3210`, and PR #190 merged the catalog source at `625cd33`. The active item is the project-creation navigation race; catalog production rollout is next.
- Dependency-audit run `30166841704` at `7362a0c` remains the historical failing baseline with 12 high-severity Node findings. Exact-revision run `30175970003` supersedes it for the merged remediation and passed both jobs; the dependency release blocker is no longer active. Windows local service-backed processing tests remain environment-limited without PostgreSQL/Redis; GitHub CI is the authoritative service-backed gate.

## Sources of truth

- Product and acceptance contract: `docs/project-spec.md`.
- Processing invariants: `docs/studio-processing-contract.md`.
- Workflow: `docs/ai-coding-workflow.md`.
- CI/CD and runtime safety: `docs/ci-cd-rules.md`.
- Architecture: `docs/architecture.md`.
- Operator procedure: `docs/runbooks/studio-platform-ops.md`.
- Validation: `docs/runbooks/validation.md`.

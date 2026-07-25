# Delivery plan

## Current dashboard

- ✅ `PWA-FRONTEND-MODULARIZATION-01B/02` — The first two behavior-preserving frontend tranches are merged through PR #180 at `605cbae`; repository, Studio, authenticated Chromium, and web deployment checks passed.
- ✅ `PWA-PROCESSING-ROLLOUT-01A / Gate 0A` — PR #181 merged the manual-only read-only worker-status path at `749833c`; run `29925528002` safely proved one running, not-drained worker while leaving its image identity unknown.
- ✅ `PWA-PROCESSING-ROLLOUT-01A / Gate 0B` — PR #182 merged the controlled drain path at `850bfdf`; run `29929528124` gracefully drained the worker, and preflight run `29929607368` passed runtime/service/local/public checks before blocking on production database revision mismatch.
- ✅ `PWA-PROCESSING-ROLLOUT-01A / Gates 0C–3` — PR #183 merged the processing source batch at `77a3b39`. A tagged restic/R2 PostgreSQL backup completed as snapshot `7b03ad00`; the authorized migration then applied `0011 → 0012 → 0013 → 0014 → 0015`. Isolated API deployment run `30004599136` succeeded, and post-deploy preflight run `30004696267` proved database head `0015_user_source_retention`, healthy PostgreSQL/Redis, and passing public API/web health.
- ✅ `PWA-PROCESSING-SOURCE-BATCH-01` — Transcription language/diarization, validated multi-source intake, video and long-media preparation, batch preflight/progress, aggregate analytics, transcript-catalog duplicate decisions, and the final provider-call guard are merged through PR #183. Source and CI evidence is complete for that batch; real provider/Google behavior still belongs to the controlled rollout gates.
- ✅ `PWA-UX-STABILIZATION-04 / Gate 4 diagnostics baseline` — PR #184 is merged at revision `89fa7d5`. The safe Picker diagnostics and walkthrough-driven navigation, preparation, credential-safety, and analytics-copy changes are part of the released source baseline.
- ✅ `PWA-LOCAL-UPLOAD-STABILIZATION-05 / Gate 4 source and deployment` — PR #185 is merged at current `main` revision `900bf5b`. Post-merge CI run `30098393764`, Studio run `30098393750`, and component CD run `30098393662` passed. Web and API were rebuilt, their running image identities matched the intended images, localhost post-checks passed, and both public health endpoints returned `200`.
- ✅ `PWA-PROCESSING-ROLLOUT-01A / Gate 4` — The clean authenticated functional smoke passed both Picker roles, one single-attempt local upload/completion, required credential/folder/source prerequisites, and source-removal cleanup messaging. The committed security policy was then applied to the active public-host nginx through a separately backed-up snippet, `nginx -t` passed, and independent checks proved both the PWA and API returning all six required headers over TLS 1.3. The authenticated PWA subsequently loaded under the CSP without browser-console errors.
- ✅ `PWA-PROCESSING-ROLLOUT-01A / Gate 5` — Read-only run `30107810563` reconfirmed the old worker gracefully stopped at production commit `900bf5b`. The first worker-only deploy attempt in run `30107907971` blocked before build because the stopped container referenced an already-missing image and no rollback tag could be preserved. After separately authorized removal of only that stale stopped container record, the failed job was rerun successfully: database/image revision compatibility passed, exactly one worker started healthy from the commit-specific `900bf5b` image, and post-deploy status reported `identity_match=yes`. The authenticated PWA showed no current tasks, proving the worker was left idle.
- ✅ `PWA-PROCESSING-ROLLOUT-01A / Gate 6` — After separate operator authorization, one bounded Drive-source canary was submitted exactly once. It reached `completed`, persisted exactly one `google_docs_transcript`, and the created native Google Doc was confirmed through Drive metadata as present and non-empty. No retry or second job was submitted. Post-canary worker-status job `89537922592` passed with the worker `running`, Docker `healthy`, and `identity_match=yes`.
- ✅ `PWA-PROCESSING-ROLLOUT-01A / Gate 7 stabilization` — PR #186 merged at `39aaaff`. PR and post-merge repository/Studio CI passed, including the real PostgreSQL/Redis-backed authenticated Chromium job. Component CD run `30120922496` fast-forwarded production to `39aaaff`, rebuilt/deployed only the changed web component, verified running image identity and localhost health, and correctly skipped API and manual-only worker deployment. Authenticated live verification shows the completed canary source as `Статус обработки: Завершена` with no raw internal `queued` label. The running worker still has no retained prior-image candidate.
- ✅ `PWA-E2E-FOUNDATION-01B` — PR #187 merged at current `main` revision `7362a0c`. The secretless authenticated Chromium scenario now covers fail-closed preparation, staged/queued progress, refresh failure, bounded cancellation, retry-safe and uncertain provider outcomes, output reconciliation, completed results, and owner-filtered diagnostics against isolated FastAPI/PostgreSQL/Redis state. PR and post-merge repository/Studio CI passed; component CD deployed only the changed web component and correctly skipped API and manual-only worker deployment.
- 🔄 `CI-ACTIONS-RUNTIME-01` — Every repository-owned use of the deprecated Node.js 20 GitHub Action majors is replaced with current Node.js 24 majors while preserving workflow triggers, permissions, commands, cache inputs, artifacts, and deployment boundaries. Local commit `6e3cd67` and its runtime contract are complete; PR CI remains the remote acceptance gate.
- 🔄 `PWA-CD-OBSERVABILITY-01` — Component selection, migration-blocked API skips, manual-only worker decisions, and final per-job results are explicit in the Studio Platform CD job summary. Local implementation and contracts are in the current batch; PR CI is the source acceptance gate, while the first ordinary qualifying CD run is the runtime-summary acceptance gate.
- ⛔ `DEPENDENCY-AUDIT-01` — The first manual audit run `30166841704` on `main` revision `7362a0c` completed with `python=success` and `node=failure`; the Node lock graph reported 12 high-severity dependency findings. This is a confirmed advisory result, not a registry outage. Do not use `npm audit fix --force` or weaken the audit threshold.
- 🔄 `DEPENDENCY-AUDIT-REMEDIATION-01A` — One semver-compatible transitive advisory group is remediated locally through an exact override and lock refresh. The local audit count is reduced from 12 to 11; lint, 276 Vitest tests, TypeScript, the production PWA build, Playwright discovery, and portable Python pass. PR CI remains the source acceptance gate.
- 🔄 `DEPENDENCY-AUDIT-REMEDIATION-01B1` — The supported ESLint 10 toolchain and its explicit Node runtime floor replace the unpatched ESLint 9 dependency path. The local audit count is reduced from 11 to 8; lint, 276 Vitest tests, TypeScript, the production PWA build, Playwright discovery, and portable Python pass. PR CI remains the source acceptance gate.
- 🔄 `DEPENDENCY-AUDIT-REMEDIATION-01B2` — An exact build-only transitive override removes the final legacy dependency path without changing the direct PWA plugin, Workbox, template engine, or generated service-worker behavior. Clean install and local audit report zero vulnerabilities; lint, 276 Vitest tests, TypeScript, production PWA build, Playwright discovery, and portable Python pass.
- 🔄 `DEPENDENCY-RUNTIME-ENFORCEMENT-01D` — Studio package installation now fails fast outside the declared Node runtime range. A focused contract keeps package metadata aligned with both Node 22 CI jobs, the dependency-audit job, and the Node 22 image build; clean install and zero-vulnerability audit pass under Node 24.
- 🔄 `DEPENDENCY-AUDIT-POLICY-GUARD-01E` — The scheduled/manual audit has a regression contract against lifecycle scripts, force-fix behavior, skipped dependency classes, advisory ignores, and failure masking. Exact Node/Python graph commands remain authoritative and unchanged.
- 🔄 `DEPENDENCY-AUDIT-HANDOFF-01F` — The validation runbook now defines local exact-graph reproduction, exact-revision GitHub dispatch, `headSha` verification, both-job acceptance, outage/finding classification, and a safe evidence boundary.
- 🔄 `DEPENDENCY-AUDIT-CHECKOUT-HARDENING-01G` — Both read-only audit jobs now disable checkout credential persistence; the workflow still has only `contents: read` permission and no write/deploy path.
- 🔄 `DEPENDENCY-AUDIT-NODE-REQUEST-01H` — Node installation now skips npm's implicit advisory request, leaving the following explicit fail-closed audit step as the only authoritative Node advisory call. Local clean install and explicit audit pass with zero vulnerabilities.
- 🔄 `DEPENDENCY-AUDIT-JOB-SUMMARY-01I` — Both jobs now render always-running summaries containing only exact revision and install/audit outcomes. The summaries neither expose dependency details nor use failure masking, so advisory findings still fail their jobs.
- 👉 `DEPENDENCY-AUDIT-RUN-IDENTITY-01J` — Give scheduled/manual audit runs a concise ref/SHA identity so operators can select the intended exact revision before opening job details.
- ⏸ `BATCH-PRE-PR-GATE-01` — After the requested fifteen-commit infrastructure batch, review the complete `main...HEAD` diff and commit series, rerun the full applicable local gate, then publish one branch/PR without mixing in the next product item.
- ⏸ `DEPENDENCY-AUDIT-VERIFICATION-01C` — After the thematic branch is published, run the unchanged dependency-audit workflow against its exact revision. Require both Python and Node jobs to pass before clearing the release blocker; do not substitute the local clean result for remote evidence.
- ⏭ `PWA-PREFLIGHT-UNCERTAINTY-01` — Next product item after the focused CI-maintenance batch: project unresolved/in-flight provider authority into a browser-safe preflight rejection without weakening the final provider-call guard.
- ⏸ `PWA-FRONTEND-MODULARIZATION-03` — Preparation composer/readiness extraction is deferred until the production baseline is known or rollout is waiting on an explicit operator window.

## Audit conclusion

- The stable Colab batch contour remains frozen and accepted at **100%** for its current operational scope. Experimental realtime work is a separate contour and is not included in that claim.
- Studio has broad source-level implementation at merged `main` revision `7362a0c`. Gates 4–7 are complete: the real one-output ElevenLabs-to-Google-Docs path is production-proven, the result-status defect is deployed and authenticated-live verified, and PR #187 adds repeatable secretless browser coverage around the principal preparation/job-result safety boundaries. The current CI-maintenance lane does not reopen the bounded production canary or change product readiness.
- Production PostgreSQL has a verified tagged backup boundary (`7b03ad00`) and is migrated through `0015_user_source_retention`. API deployment run `30004599136` and post-deploy preflight `30004696267` replace the older `0011`/revision-mismatch evidence.
- Exactly one worker is running healthy from the commit-specific `900bf5b` image. Deploy run `30107907971`, the bounded successful canary, and post-canary status job `89537922592` prove database compatibility, Docker health, one persisted Google Docs output, and `identity_match=yes`. The processing path may now be described as production-live with bounded canary evidence; broader workload confidence still depends on stabilization.
- The clean 2026-07-24 operator smoke supersedes the earlier ambiguous upload evidence. Both Google Picker roles opened successfully, one Drive source and one writable output folder were selected, the account showed one active ElevenLabs credential, and one local source uploaded and completed without a manual duplicate retry. Removing the disposable local source immediately blocked its composer row and reported queued background storage cleanup. No transcription job was created.
- Live TLS/public routing and the browser security policy are now verified for both the PWA and API (`200` over TLS 1.3 with a valid host certificate and all six required headers). Standard component CD intentionally does not apply host nginx, so the operator applied the policy with a timestamped backup, successful `nginx -t`, reload, independent header verification, and an authenticated PWA load under the resulting CSP.
- Studio Platform CD is not generally broken: migration-changing pushes intentionally suppress automatic API deployment, and worker deployment is intentionally manual-only. The workflow currently makes this safe skip too easy to mistake for a complete green deployment; that observability gap is a focused follow-up.
- The authenticated Playwright scenario proves the browser shell through live FastAPI/PostgreSQL/Redis with controlled boundaries. It does not call ElevenLabs, Google, S3/R2, or production and therefore does not replace the controlled canary.

## Readiness snapshot

| Contour/dimension | Current estimate | Meaning |
| --- | ---: | --- |
| Stable Colab batch | **100%** | Accepted current scope; do not reopen without an explicit maintenance/product task. |
| Studio source breadth | **about 98%** | Core processing, safety, analytics, duplicate-authority, and the real provider/Google path are proven. Historical Drive catalog import/standardization, accepted-output reuse, and finer optional telemetry remain. |
| Studio UX readiness | **about 94%** | Picker roles, single-attempt local upload/completion, prerequisites, cleanup feedback, CSP behavior, and one real completed result have authenticated public evidence. PR #187 adds repeatable authenticated CI coverage for the principal preparation/result safety boundaries; broader UX polish and the next browser-safe preflight outcome remain. |
| Studio production evidence | **about 98%** | Backup, migration, component identities, database compatibility, public health/security, clean smoke, one successful one-output canary, safe diagnostics/reconciliation, post-merge CI/CD, and live result-status verification are evidenced. The absent prior worker-image rollback candidate remains the main rollout limitation. |
| Studio combined v1 readiness | **about 95% deployed** | The core production processing path is live, bounded-canary proven, stabilized through Gate 7, and covered by the expanded authenticated CI scenario. Remaining work includes browser-safe preflight uncertainty handling, rollback-candidate limitations, and the explicitly listed non-core roadmap. |

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

1. ✅ `PWA-E2E-FOUNDATION-01B` — completed through PR #187 with controlled FastAPI/PostgreSQL/Redis fixtures and no provider, Google, S3/R2, or production calls; the real canary remains separate.
2. `PWA-PREFLIGHT-UNCERTAINTY-01` — project the final provider guard's in-flight/unresolved conflict into a browser-safe preflight outcome so a stale job is rejected before preparation. The current accepted-output checkbox never overrides unresolved provider outcomes; changing that rule requires an explicit product decision.
3. `PWA-LEGACY-AUTHORITY-01` — confirm external consumers, then remove the two deprecated compatibility APIs or retain them with an explicit support/removal contract. The old static UI and obsolete stateless/full-platform deploy paths are already removed.
4. Golden Colab/PWA fixtures — lock normalization, ordering, output shape, and failure semantics before adding parity paths.
5. OpenAI short-media parity — add provider selection/credential/processing behavior without weakening the canonical batch and side-effect contracts.
6. Manifest/skip semantics — define the web-native durable equivalent and its relationship to PostgreSQL jobs/outputs before implementation.
7. Long-media parity — define size/duration limits, splitting/resume behavior, lease/heartbeat requirements, storage lifecycle, and cost-safe acceptance tests.
8. Multi-worker validation — only after single-worker production stability; prove claim/lease/heartbeat/recovery behavior under concurrency before increasing worker count.

Any change to the durable product meaning or acceptance criteria above requires an explicit user decision and a separate update to `docs/project-spec.md`.

## Maintainability and infrastructure lane

These tasks are valuable but do not outrank the completed production safety gates or explicitly selected product work:

1. 🔄 `PWA-CD-OBSERVABILITY-01` — the current batch adds fixed component reason codes and an always-running final job summary with selection/result evidence for web, API, and worker. The deploy conditions and commands are unchanged; PR CI validates the source contract, and the first ordinary qualifying CD run validates the rendered runtime summary.
2. 🔄 `DEPENDENCY-AUDIT-01` — first manual run `30166841704` is recorded: the constrained Python graph passed, while the Node graph reported 12 high-severity dependency findings. Three focused local remediations now produce a clean install and zero-vulnerability audit, unsupported Node runtimes fail at package installation, and regression coverage prevents audit softening; the release gate remains open until the unchanged remote workflow passes against the exact published revision.
3. 🔄 `CI-ACTIONS-RUNTIME-01` — local commit `6e3cd67` upgrades all repository-owned checkout/setup/artifact actions to Node.js 24 majors and adds a workflow-wide regression contract. Local validation is complete; PR CI is still required before this item is complete.
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

- `main` and `origin/main` are `7362a0c` (PR #187). The active `codex/ci-actions-runtime-maintenance` branch starts from that exact revision and contains the local CI-runtime commit `6e3cd67` plus this dashboard reconciliation checkpoint.
- PR #187 checks passed after the authenticated-session fix. Post-merge repository CI run `30129485474` and Studio run `30129485476` passed; the latter executed both `studio` and real PostgreSQL/Redis-backed `browser-e2e` jobs.
- Component CD run `30129485498` detected only the web change. `deploy-web` fast-forwarded production to `7362a0c`, rebuilt the web image, verified its running identity and localhost health, and succeeded; `deploy-api` and manual-only `deploy-worker` were correctly skipped.
- PR #187 local validation included full ESLint, TypeScript, production Vite/PWA build, Playwright discovery, focused contracts, and portable Python. The current CI-maintenance batch additionally passes YAML parsing for all seven workflows, the focused action-runtime contracts (`14 passed, 2 skipped`), the focused CD-observability contracts (`7 passed`), the dependency-audit contracts (`8 passed`), `722 passed, 6 skipped` portable Python, lightweight repository checks, and `git diff --check`. Dependency remediations 01A/01B1/01B2 and runtime enforcement 01D pass clean lock installation, a zero-vulnerability local audit, ESLint 10, 276 Vitest tests, TypeScript, a production Vite/PWA build, Playwright discovery (`8 tests`), and exact dependency/runtime lock contracts. The Windows sandbox requires Vite's supported module-runner config loader and an isolated pytest temp directory; GitHub CI remains authoritative for default Linux execution, shell/deploy integration, and the upgraded actions. The first ordinary qualifying post-merge CD run remains the runtime-summary evidence boundary.
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
- Gates 4–7 remain complete. Authenticated production verification at `39aaaff` established the completed canary source as `Статус обработки: Завершена` with no raw `Статус файла: queued`; PR #187 subsequently deployed the expanded browser E2E source baseline at `7362a0c` without changing API or worker behavior. The active item is `DEPENDENCY-AUDIT-RUN-IDENTITY-01J`; remediations 01A/01B1/01B2, runtime enforcement 01D, policy guard 01E, audit handoff 01F, checkout hardening 01G, explicit Node audit 01H, audit summaries 01I, `PWA-CD-OBSERVABILITY-01`, and `CI-ACTIONS-RUNTIME-01` await the same batch PR gate. Remote audit verification 01C waits for branch publication, and the next product item remains `PWA-PREFLIGHT-UNCERTAINTY-01`.
- Dependency-audit run `30166841704` at `7362a0c` completed with `python=success` and `node=failure`. The Node job installed the exact lock without lifecycle scripts and then reported 12 high-severity dependency findings, so this is confirmed audit evidence rather than an advisory-service outage. Remediations 01A/01B1/01B2 now produce a clean local lock audit with zero vulnerabilities and no direct PWA-plugin downgrade, but no clean remote audit exists yet and the release blocker remains. Windows local service-backed processing tests remain environment-limited without PostgreSQL/Redis; GitHub CI is the authoritative service-backed gate.

## Sources of truth

- Product and acceptance contract: `docs/project-spec.md`.
- Processing invariants: `docs/studio-processing-contract.md`.
- Workflow: `docs/ai-coding-workflow.md`.
- CI/CD and runtime safety: `docs/ci-cd-rules.md`.
- Architecture: `docs/architecture.md`.
- Operator procedure: `docs/runbooks/studio-platform-ops.md`.
- Validation: `docs/runbooks/validation.md`.

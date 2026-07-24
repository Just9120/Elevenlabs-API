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
- 👉 `PWA-PROCESSING-ROLLOUT-01A / Gate 7 stabilization` — The source fix for the misleading result-detail `queued` label is implemented and frontend-validated on the rollout branch; GitHub CI/CD and live verification remain before closure. Also inspect safe diagnostics/reconciliation state and preserve the known limitation that the running worker has no retained prior-image candidate.
- ⏸ `PWA-FRONTEND-MODULARIZATION-03` — Preparation composer/readiness extraction is deferred until the production baseline is known or rollout is waiting on an explicit operator window.

## Audit conclusion

- The stable Colab batch contour remains frozen and accepted at **100%** for its current operational scope. Experimental realtime work is a separate contour and is not included in that claim.
- Studio has broad source-level implementation at merged and deployed `main` revision `900bf5b`. Gates 4–6 are complete: the real one-output ElevenLabs-to-Google-Docs path is production-proven. The remaining release work is stabilization and focused defect closure, not missing core processing code.
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
| Studio UX readiness | **about 92%** | Picker roles, single-attempt local upload/completion, prerequisites, cleanup feedback, CSP behavior, and one real completed result have authenticated public evidence. The stale per-file `queued` label has a tested branch fix, but production evidence remains unchanged until deployment. |
| Studio production evidence | **about 97%** | Backup, migration, current API/web/worker identities, database compatibility, public health/security, clean smoke, and one successful one-output canary are evidenced. Safe diagnostics/reconciliation review and the rollback-candidate limitation remain in stabilization. |
| Studio combined v1 readiness | **about 94% deployed** | The core production processing path is live and bounded-canary proven. Gate 7 stabilization, the result-status defect, and non-core roadmap items remain before a broader v1 readiness claim. |

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

### Gate 7 — stabilization checkpoint (in progress)

1. Verify the worker returns to healthy idle state and inspect owner-scoped safe diagnostics/reconciliation state.
2. Record deployed web/API/worker identities, database head, CI/CD run links, canary result, and residual risks in this dashboard.
3. Recalculate readiness from evidence and choose the next product milestone.

Current checkpoint: worker health and identity are reconfirmed after the successful one-output canary, and the readiness estimates above are recalculated. The result detail now derives a user-facing processing status from persisted output evidence and the terminal job contract instead of rendering the durable relation's internal `queued`/`skipped` classification as file progress. The branch fix passes focused and full frontend validation; deployment/live verification, safe diagnostics/reconciliation inspection, and the absent prior-image rollback candidate remain.

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

- `main` and `origin/main` are `900bf5b` (PR #185). The active `codex/pwa-production-rollout` branch starts from that exact revision.
- Post-merge CI run `30098393764`, Studio run `30098393750`, and component CD run `30098393662` passed. CD deployed web and API only, verified each running image identity, and passed localhost post-checks; the worker remained intentionally skipped. Both public health endpoints returned `200`.
- Full local pre-PR validation passed: the latest Studio run has `276 passed`; portable Python has `715 passed, 6 skipped`; full ESLint, TypeScript, production Vite/PWA build, Python compileall, Bash syntax, lightweight repository checks, and `main...HEAD` diff checks passed. Playwright discovery lists the single authenticated scenario without launching a browser.
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
- Gates 4–6 are complete and Gate 7 is active. The misleading file-detail status is corrected on the branch with model, component, and App integration coverage; CI/CD and live verification are still required. Safe diagnostics/reconciliation inspection remains the other immediate stabilization check.
- The dependency-audit workflow still has no recorded run. Windows local service-backed processing tests remain environment-limited without PostgreSQL/Redis; GitHub CI is the authoritative service-backed gate.

## Sources of truth

- Product and acceptance contract: `docs/project-spec.md`.
- Processing invariants: `docs/studio-processing-contract.md`.
- Workflow: `docs/ai-coding-workflow.md`.
- CI/CD and runtime safety: `docs/ci-cd-rules.md`.
- Architecture: `docs/architecture.md`.
- Operator procedure: `docs/runbooks/studio-platform-ops.md`.
- Validation: `docs/runbooks/validation.md`.

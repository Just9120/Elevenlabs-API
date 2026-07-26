# Delivery plan archive

This document is historical. Codex and other coding agents must not read it during ordinary focused tasks. It does not define current scope, current product requirements, active delivery state, or production readiness. Current delivery status is in `docs/delivery-plan.md`; the current product contract is in `docs/project-spec.md`.

The archive preserves traceability from documents consolidated during `DOCS-AUTHORITY-RESET-01`. It intentionally avoids secrets, production credentials, private account data, transcript bodies, document IDs/URLs, raw provider responses, and raw Google responses.

## Archived checkpoint summary

Historical delivery progressed from a Colab-first transcription workflow into a Studio PWA platform contour. Completed source-level slices included platform preparation, authentication/session foundations, projects, sources, Google OAuth/Drive metadata and folder selection, encrypted BYOK credentials, job records and lifecycle guardrails, claim/lease foundations, source availability/materialization, ElevenLabs provider boundaries, Google Docs output boundaries, output persistence/read APIs, frontend output links, batch composer UX, diagnostics, and worker source/Compose wiring.

These historical source-done and CI-verified items explain why Studio must no longer be described as only record-only. They do not prove production-live Studio processing.

## Archived status-chain highlights

- Early Studio job items intentionally described jobs as record-only while worker/provider/output slices did not yet exist.
- Later source-level processing, worker, provider, output, persistence, browser output, and diagnostics slices superseded the record-only-only description.
- Historical rollout/preflight notes recorded partial operator evidence such as migration application, API health, and at one point an idle worker observation.
- At that earlier checkpoint, a controlled rollout smoke was blocked before successful end-to-end completion. The later Gates 0–7 evidence archived below superseded that checkpoint with one bounded successful canary.
- Diagnostics-related work reached source-done/merged and partial deployment/browser evidence, but this did not imply provider execution, Google Docs creation, worker-running, or production-live processing.

## Archived implementation notes preserved from consolidated docs

### Colab-oriented technical specification

Durable information preserved in current docs:

- Colab batch remains the stable ready contour and behavioral baseline.
- Secrets must not be printed or committed.
- Provider and Google raw payloads, transcript bodies, document content, and private source bytes must not be copied into evidence.
- Long-media and manifest behavior are Colab baseline topics for parity, not automatically ready Studio capabilities.

### Validation matrix and runtime checklist

Useful validation commands and evidence rules were moved to `docs/runbooks/validation.md`. Outdated claims that Studio lacked backend/auth/database/workers were removed because source-level components now exist.

### Studio jobs processing contract

Durable guarantees were moved to current authority documents:

- Product rules and readiness criteria: `docs/project-spec.md`.
- Current processing invariants: `docs/studio-processing-contract.md`.
- State machine, data flow, provider/output boundaries, and trust boundaries: `docs/architecture.md`.
- Operator rollout, stop conditions, and recovery procedures: `docs/runbooks/studio-platform-ops.md`.

Historical details from earlier job phases remain non-authoritative here. Current rules are not duplicated in this archive.

### Provider transcription contract

Provider boundaries were consolidated into `docs/project-spec.md` and `docs/architecture.md`: ElevenLabs is the present source-level Studio provider path; OpenAI Studio processing parity remains unfinished. The former standalone provider contract was removed after its current rules were verified as duplicate authority.

### Studio platform prep

Preparation decisions that still matter were consolidated into current product, architecture, CI/CD, and operations docs. The old prep document is historical and no longer source authority.

### Studio deploy runbooks

Current platform operations live in `docs/runbooks/studio-platform-ops.md` and CI/CD safety remains in `docs/ci-cd-rules.md`. The legacy stateless web-only contour and the unreferenced full-platform deploy helper were removed under `PWA-LEGACY-AUTHORITY-01` after documented bootstrap steps and the platform component path became authoritative.

## Archived closed items and PR-chain categories

The following categories are closed historical delivery work, not active items:

- PWA platform preparation and environment boundary definition.
- Studio auth/session/account foundation.
- Projects and sources APIs/UI.
- Google OAuth/Drive connection and safe metadata/folder selection.
- BYOK provider credential storage and selection.
- Job records, list/detail/cancel UI, lifecycle guardrails, preflight, and claim readiness.
- Claim/lease persistence and processing lifecycle foundations.
- Source availability/materialization and execution prerequisites.
- ElevenLabs transcription path.
- Google Docs output creation, safe output persistence, and browser-safe output links.
- Worker source entrypoint and initial Compose source wiring.
- Batch composer UX and source-to-destination rows.
- Diagnostics backend, read-only UI/report export, debug sessions, and UX polish.
- Historical deployment/preflight and partial rollout validation notes that did not produce a successful end-to-end processing canary.

## Archived PR #173–#177 stabilization checkpoint

PR #173 completed source-level safe stage-specific retry/recovery. PR #174 completed source-level Studio source deletion, retention, and storage cleanup. PR #177 merged the following tracked remediation items into `main` at `9f85ffe93102354869f37f60fd525dd60404b878`:

- `DOCS-AUTHORITY-SYNC-02`
- `SECURITY-ENTRYPOINT-01`
- `PWA-LEGACY-AUTHORITY-01`
- `PWA-BROWSER-INTEGRATION-BOUNDARY-01`
- `PWA-WEB-SECURITY-HEADERS-01`
- `PWA-CD-RECOVERY-01`
- `PWA-DEPENDENCY-SECURITY-01`
- `PWA-DEPENDENCY-REPRODUCIBILITY-01`
- `PWA-DEPENDENCY-REPORTING-01`
- `PWA-E2E-FOUNDATION-01A`
- `PWA-BROWSER-DTO-MINIMIZATION-01`
- `PWA-UNHANDLED-DIAGNOSTICS-01`
- `PWA-UPLOAD-VERIFIED-METADATA-01A`
- `REPO-HYGIENE-01`
- `TEST-PORTABLE-PROFILE-01`
- `PWA-FRONTEND-MODULARIZATION-01A`
- `PWA-UPLOAD-RETENTION-CONTRACT-01B`
- `PWA-UPLOAD-RETENTION-PREFERENCES-02`
- `PWA-UPLOAD-POLICY-DISCOVERY-01C`

Repository CI run `29898199041` and Studio PWA CI run `29898198991` passed for the merge revision. Studio Platform CD run `29898198997` deployed and identity-checked the web component only; API deployment, migration `0015_user_source_retention`, worker rollout, public-host header validation, dependency-audit workflow execution, and a controlled processing canary were not proven by that checkpoint.

## Archived PR #180–#191 and processing Gates 0–7

This chain ran from frontend modularization through the first bounded production processing proof and the subsequent source/CI hardening:

- PR #180 `605cbae` and PR #181 `749833c` continued bounded frontend modularization and production-status visibility.
- PR #182 `850bfdf` added the guarded worker-drain path; PR #183 `77a3b39` added rollout/preflight controls.
- PR #184 `89fa7d5` delivered the walkthrough-driven UX/Picker diagnostics batch; PR #185 `900bf5b` delivered upload stabilization and the component deployment baseline used by the first worker/canary.
- PR #186 `39aaaff` closed the result-status and stabilization checkpoint; PR #187 `7362a0c` established the authenticated service-backed browser foundation.
- PR #188 `0b23320` closed the dependency/Actions/CD-observability lane; PR #189 `95d3210` added provider-attempt preflight authority.
- PR #190 `625cd33` merged the catalog source and migration `0016_transcript_catalog_entries`; PR #191 `c02accd` reconciled source-of-truth documentation without changing runtime source.

### Gate 0 — read-only production truth

- Initial preflight `29918894603` proved checkout/config/service facts, then stopped on one running worker before health, revision, and authenticated rows.
- Status run `29925528002` proved a clean `605cbae` checkout and one running worker whose image/rollback identity was not yet trustworthy.
- Drain run `29929528124` proved the old worker `exited`, `exit_code=0`, and `drain_state=gracefully-drained`.
- Preflight `29929607368` then passed repository identity, service health, localhost/public health, and single production-revision detection, and correctly stopped at the pre-migration revision mismatch.

The gate remained read-only: it did not authorize a backup, migration, deploy, worker start, job, provider request, Google mutation, or retry.

### Gates 1–3 — backup, database, and API

- Tagged restic/R2 snapshot `7b03ad00` established the pre-migration rollback boundary.
- The guarded migration applied the known chain through `0015_user_source_retention`; it did not improvise a downgrade.
- Isolated API deployment `30004599136` succeeded.
- Post-deploy preflight `30004696267` proved PostgreSQL/Redis health, database head `0015`, image/database migration equality, and localhost/public API/web health.

### Gate 4 — public browser boundary

The clean 2026-07-24 authenticated smoke opened both Google Picker roles, selected one Drive source and one writable output folder, confirmed one active ElevenLabs credential and a valid Google connection, and completed one local upload without a manual duplicate retry. Removing that disposable local source immediately blocked its composer row and reported queued background storage cleanup. No transcription job or provider call occurred in this smoke.

The active Certbot-managed host configuration was preserved as timestamped backup `studio.librechat.online.pre-security-headers-20260724T154127Z`. The repository-owned six-header policy was applied through a dedicated nginx snippet; `nginx -t`, reload, and service checks passed. Independent checks then returned `200` over TLS 1.3 for `/` and `/api/healthz` with CSP, HSTS, MIME-sniffing, referrer, permissions, and framing headers. An authenticated PWA load under that CSP had no browser-console errors.

### Gate 5 — exactly one worker

Read-only run `30107810563` first proved production at `900bf5b` with the previous worker still safely drained. Worker run `30107907971` initially stopped before build because the prior stopped image bytes were already absent. After separate operator authorization, only the stale stopped container record was removed without volumes. The failed worker job was then rerun: it built the `900bf5b` image, proved database/image Alembic equality, exact running/built/commit-tag image equality, Docker health, and exactly one worker. The status rerun reported `running`, `healthy`, and `identity_match=yes`.

Because the prior image was already absent, the immediate rollback boundary was drain/stop of the new worker; no historical image was invented.

### Gate 6 — one-output canary

After explicit authorization and a no-match preflight, one supported Drive audio source, one owner-scoped ElevenLabs credential, one valid Google connection, and one writable folder produced exactly one submitted job. It completed one ElevenLabs transcription and persisted exactly one `google_docs_transcript`. Read-only Drive metadata confirmed a newly created, non-empty native Google Doc. No manual or automatic second submission occurred.

Post-canary worker-status job `89537922592` in run `30107810563` proved the worker remained `running`/`healthy` at `900bf5b` with `identity_match=yes`. This is evidence only for that bounded scenario.

### Gate 7 — stabilization

Owner-scoped diagnostics recorded one job creation, one processing attempt, one provider request, one output persistence event with `output_count=1`, and one completed terminal state without an error/uncertainty event. Read-only reconciliation reported the case resolved with zero unresolved/conflicting cases; no manual reconciliation or repeated Google side effect was required.

PR #186 and its service-backed browser checks locked the completed-output, relation-queued, resolved-reconciliation, and safe-diagnostics regressions. Web-only CD moved the web component to `39aaaff`; authenticated production verification showed `Статус обработки: Завершена` without exposing the raw relation `queued` label. API and worker correctly remained unchanged.

### Archived CI/CD acceptance chain

- PR #187/post-merge: repository `30129485474`, Studio `30129485476`, and component CD `30129485498`; authenticated Chromium ran with FastAPI, PostgreSQL, Redis, migrations, and seed data, while CD deployed only the changed web component.
- PR #188/post-merge: repository `30174331982` / `30175325342`, Studio `30174331983` / `30175325383`, dependency audit `30175970003`, and component CD `30175325341`. The exact remediation superseded historical failing dependency run `30166841704`.
- PR #189/post-merge: repository `30177377055` / `30177718794`, Studio `30177377357` / `30177718783`, and component CD `30177718793`; source-changed web/API were identity-checked and the worker remained manual-only.
- PR #190/post-merge: repository `30202031053`, Studio `30202031078`, and component CD `30202031076`. Web deployed; API stopped at `manual_migration_required`; worker remained `manual_only`. Chromium failed before project creation and left eight scenarios unrun.
- Exact-main reconciliation at `c02accd`: repository `30207923222` and Studio `30207923262` passed, including all nine authenticated scenarios. Because no application source changed between `625cd33` and `c02accd`, that later pass did not explain or deterministically reproduce the earlier project-navigation race.

These run IDs are historical evidence for their exact revisions and executed jobs only. They do not prove the current working branch, repository migration `0016`, unexecuted CD components, or broader production processing modes.

## Current non-authority warning

If this archive conflicts with `docs/project-spec.md`, `docs/delivery-plan.md`, `docs/architecture.md`, `docs/ci-cd-rules.md`, or the current user task, treat the current documents/task as authoritative and this archive as historical context only.

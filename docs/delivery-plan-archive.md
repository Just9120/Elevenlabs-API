# Delivery plan archive

This document is historical. Codex and other coding agents must not read it during ordinary focused tasks. It does not define current scope, current product requirements, active delivery state, or production readiness. Current delivery status is in `docs/delivery-plan.md`; the current product contract is in `docs/project-spec.md`.

The archive preserves traceability from documents consolidated during `DOCS-AUTHORITY-RESET-01`. It intentionally avoids secrets, production credentials, private account data, transcript bodies, document IDs/URLs, raw provider responses, and raw Google responses.

## Archived `PWA-REALTIME-STABILITY-READINESS-01` delivery — PRs #228–#230

- Final baseline: `main@ebbba50a938feb2d06b2ec59e828834ff204988d`.
- Outcome: hardened repeated start/stop and stale async cleanup, added static voice-priority mix, then separate browser-only display/microphone source meters and microphone-triggered display ducking without persisting audio or transcript content.
- Final exact-main CI: repository run `32706218832` ✅; Studio PWA run `32706218892`, jobs `studio` and `browser-e2e` ✅.
- Deployment: Studio Platform CD run `32706218830` ✅ deployed `studio-web`; API, worker and migration correctly skipped as unaffected.
- LIVE: owner-controlled ordinary Chrome canary on laptop speakers confirmed both source signals during mixed capture and microphone speech reaching transcription while display playback continued. Partial acoustic/provider masking of simultaneous speech was explicitly accepted as non-critical; no new capture reset was reported.
- Readiness at closure: `PWA-REALTIME-01 13/13 = 100%`, Studio PWA `86/91 = 94,5%`, project `108/120 = 90,0%`; denominator remained `120`.
- Cleanup: all three merged Goal branches were ancestor-verified and removed locally/remotely; local `main` fast-forwarded to exact `origin/main`.
- Metadata limitation: approved post-deploy writer remains absent, so final Evidence was recorded in PR #230 and reconciled by the next authorized Goal instead of a docs-only follow-up PR.

## Archived `PWA-TRANSCRIPTIONS-UX-AND-LIVE-RECOVERY-01` delivery — PR #222

- Base: `main@dd194c929d957e822ff618df294dc54e72d5971e`.
- PR: #222, merged as `main@ccb067d05d5225a3178b21cd239bd65c0764f1fb`.
- Outcome: primary UX переведён с ручного Projects lifecycle на `Транскрибации` с ordinary/Live tabs; batch отображается одной multi-transcription; добавлены local IndexedDB и encrypted owner-scoped server Live drafts с 72-hour TTL, recovery/download/delete UX и bounded accessibility/diagnostics remediation.
- Exact-main CI: run `32588711409` ✅; Studio PWA CI run `32588711419`, jobs `studio` и `browser-e2e` ✅.
- Deployment: web run `32588711397` ✅; protected migration `0023_realtime_drafts` run `32589660127` ✅; API run `32589888861` ✅; worker runs `32589929940` и rollback-corrected `32590256878` ✅.
- LIVE/operations: bounded preflight `32590047900` ✅ и worker status `32590305806` ✅; Goal Evidence `SPEC/CODE/TEST/CI/DEPLOY/LIVE ✅`.
- Cleanup: local/remote merged branch удалена после ancestry check; local `main` fast-forward синхронизирован. Post-deploy operational diff перенесён в следующую authorized Goal из именованного stash, поскольку approved metadata writer отсутствует.

## Archived `PWA-REALTIME-CAPTURE-01` delivery — PR #212

- Base: `main@f90e0d7b3b10d345a9ea6ff34f5b8c3025d818d7`.
- Implementation commits: `907ba24d5e0a058bbacf04f28dc98f6d2fac8676`, `25fa508212ec65f1da887b9b0ad01e0fd0b1db5d`, `8d6b061f1cbf9a2967c9860a398916c6f2f9af3f`.
- PR: #212, merged 2026-08-15 as `main@f3a3f33fb0ce019c1916d95f754ed72d1d56ee01`.
- PR-head checks: CI run `31872035202` `checks` ✅; Studio run `31872035197` `studio` ✅ и `browser-e2e` ✅.
- Exact-main checks: CI run `31872181449` ✅; Studio run `31872181421` ✅.
- Deployment: Studio Platform CD run `31872181463` ✅ доставил `studio-web`; API/worker/migration были intentionally skipped. VPS checkout и running image identity соответствовали merge revision, `/healthz` прошёл.
- LIVE: bounded in-app canary прошёл; owner отдельно подтвердил, что Chrome tab capture больше не сбрасывается. Full microphone/display/mixed matrix не выполнялась, поэтому product `PR-06` остался `5/6` и `LIVE ◐`.
- Delivery state: `LIVE_VERIFIED`; metadata synchronization не выполнена, потому что approved writer отсутствует (`metadata_sync.enabled=false`).
- Cleanup: local/remote working branch удалена после merge ancestry check; local `main` fast-forward синхронизирован.

## Archived `DOCS-AGENT-DELIVERY-V2` closure — PR #209

- Base: `main@830bd00754567dfa6809e1e36bb7fcbaa145b824`.
- PR: #209, merged 2026-08-14 as `main@a252a1efa54ba952ec4eb04405fae5722f15d7b5`.
- Outcome: принят `direct-agent-v1`, agent lifecycle был вынесен в отдельный canonical workflow, CI/CD contract получил verified project profile, README navigation обновлена. Эта схема позднее superseded contract `goal-driven-v1`; отдельный workflow больше не является repository document.
- Exact-main CI: run `31823766931`, success.
- Deployment: N/A для docs-only diff; GitHub Deployments API вернул пустой список.
- Metadata sync: автоматический post-deploy writer отсутствует (`metadata_sync.enabled=false`); прямой push для отдельного status commit не выполнялся.
- Branch cleanup: merged working branch удалена локально и в origin после fast-forward local main.

Предыдущий active dashboard с project readiness `N/A`, Colab `100% (2/2)` и отдельным Studio Live denominator был superseded новой explicit owner baseline от 2026-08-14. Эти проценты не сопоставимы с новым полным product denominator и не являются текущей readiness.

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

## Archived PR #207 PWA async reliability batch

PR #207 merged the 30-commit PWA-STABILITY-HARDENING-PR207 batch from base 7871b31dc47158c43c3572612a8d0aa3242d018f as merge commit 26ecae6e6cd0ec0c8a3fd2307b7434970c11edf4. The review diff contained 23 files with 10,446 insertions and 1,387 deletions. Functional numerators/denominators for tasks 03–30 did not change at merge; their separate readiness gates moved to READY after PR-head and exact-main CI.

PR-head repository run 31744423393 and Studio/browser run 31744423370 passed. Exact-main repository run 31744712542 and Studio/browser run 31744712601 passed on the merge SHA. Component CD run 31744712488 selected web and API, fast-forwarded the VPS checkout to 26ecae6, built each selected image, verified running image identity, and emitted STUDIO_PLATFORM_WEB_DEPLOY_OK plus STUDIO_PLATFORM_API_DEPLOY_OK after localhost health. The API probe observed two transient startup failures before the bounded retry succeeded. Migration and worker jobs were correctly skipped because this batch changed neither migrations nor the manual-only worker release scope. Read-only public HTTPS probes returned 200 with successful TLS verification for /healthz and /api/healthz.

Standard component CD does not create GitHub Deployment records or bind web/API to an Environment. The protected studio-production-migration Environment was not selected and no approval was required. Deployment and health are evidenced; no provider/Google call, authenticated workflow, transcript-body observation, or new production transcription canary is claimed. The merged working branch was then removed locally and from origin after local main reached the merge SHA.

### Final active item at publication

`PWA-PREPARATION-PREREQUISITE-BOUNDARY-30` functional acceptance checks:

1. Preparation obtains credentials through the shared validated collection requester and obtains the local-upload policy through its existing runtime validator. The two resources use independent latest-request keys, 15-second deadlines, and teardown AbortSignals.
2. Timeout, transport failure, malformed/duplicate credential data, and malformed policy data fail closed with predefined Russian UI and separate explicit retry controls. Job submission and local device upload remain disabled without valid authority; A → B → A aborts old reads and late settlement cannot alter the active composer or render raw fields.
3. Focused prerequisite regressions `3/3`, complete App suite `187/187`, full Studio Vitest `450/450`, TypeScript, full ESLint, production build, lightweight checks, and `git diff --check` pass.

Functional completion is **100% (`3/3`)** on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`.

Readiness gate: branch publication, required PR-head/exact-main CI, and merge remain separately required before READY. They are intentionally open under the current local-only instruction, so lifecycle status remains IN PROGRESS despite 100% functional completion.

Non-goals: no credential mutation, local-upload mutation/recovery semantics, Google/Picker behavior, API/schema/migration, deploy, or production mutation.

### Focused acceptance histories

#### Overview collection boundaries

`PWA-OVERVIEW-COLLECTION-BOUNDARY-29` functional acceptance checks:

1. Overview project and credential summaries use the same exact runtime-validated collection requesters as Projects and Settings. Malformed or duplicate IDs fail closed without rendering raw response fields.
2. Both Overview reads are independently latest-request-wins, bounded to 15 seconds, and cancelled on teardown. Each summary exposes its own safe retry; a failed refresh preserves last-known valid data and cannot erase an independently successful summary.
3. Focused Overview boundary regressions `3/3`, complete App suite `184/184`, full Studio Vitest `447/447`, TypeScript, full ESLint, production build, lightweight checks, and `git diff --check` pass.

Functional completion is **100% (`3/3`)** locally. Readiness remains IN PROGRESS because branch publication, required PR-head/exact-main CI, and merge are intentionally open under the current local-only instruction.

Non-goals: no Projects mutations, Settings credential mutations, Google/OAuth behavior, API/schema/migration, deploy, or production mutation.
#### Google connection consumers

`PWA-GOOGLE-CONNECTION-CONSUMERS-28` functional acceptance checks:

1. Overview, Projects, and Settings use one exact runtime-validated Google connection requester; no Overview/Projects consumer can accept a malformed or semantically contradictory DTO. The shared request contract carries cancellation without broad component or API churn.
2. Overview and Projects reads are latest-request-wins, bounded to 15 seconds, and cancelled on component teardown. Both expose an explicit safe retry; Projects performs a new authoritative read whenever its persistently mounted page is reactivated after Settings or another route, and a late response from the prior activation cannot replace the newer state.
3. Projects distinguishes loading/unavailable authority from a confirmed disconnected account. While loading or unavailable, source and folder Picker entrypoints are disabled and programmatic folder entry fails closed; raw response fields are not rendered. Focused consumer regressions `3/3`, complete App suite `181/181`, full Studio Vitest `444/444`, TypeScript, full ESLint, production build, lightweight checks, and `git diff --check` pass.

Functional completion is **100% (`3/3`)** locally. Readiness remains IN PROGRESS because branch publication, required PR-head/exact-main CI, and merge are intentionally open under the current local-only instruction.

Non-goals: no Overview project/credential read change, OAuth mutation, maintenance OAuth, Picker session/selection change, backend/API/schema/migration, deploy, or production mutation.

#### Primary Google connection lifecycle

`PWA-GOOGLE-CONNECTION-BOUNDARY-27` acceptance checks:

1. The Settings browser surface accepts only the exact server-authoritative Google connection DTO and its semantic invariants: active status is the only connected state, Picker readiness equals configured plus scope-ready, reconnect is required only for a connected account missing Picker scope, and a null status carries no stale account metadata. OAuth start accepts only an HTTPS `accounts.google.com/o/oauth2/v2/auth` capability with the exact single-valued query contract and exact `openid email drive.file` scope set.
2. Initial/repeated `GET /google/connection` requests are latest-request-wins, abortable, and bounded to 15 seconds. OAuth start and disconnect, including any CSRF refresh, are bounded to 20 seconds and guarded synchronously by one parent-owned operation; Settings → Projects → Settings restores disabled/`aria-busy` state and same-act duplicates cannot issue another mutation. Logout/login invalidates stale ownership and a late OAuth success cannot redirect a new session.
3. Timeout, transport loss, HTTP 408/5xx, or malformed mutation success triggers one bounded authoritative connection GET and never automatically repeats POST or DELETE. Disconnect is confirmed only by authoritative revoked/null state; active state is preserved as connected, while OAuth start remains safely unconfirmed because connection state cannot prove capability creation. Sequential backend disconnect replay returns the original terminal metadata without changing the timestamp or duplicating the audit event. Focused Google regressions `11/11`, complete App suite `178/178`, full Studio Vitest `441/441`, TypeScript, full ESLint, production build, Python syntax checks, lightweight checks, and `git diff --check` pass; the authored service-backed regression is not locally executable because bundled Python lacks `pytest`.
Readiness gate: Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Functional completion is **100% (`3/3`)** locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. The readiness gate is intentionally open under the current local-only instruction.

Non-goals: no maintenance OAuth, Google Picker composer flow, OAuth callback/start-server business-rule, token format/encryption, API shape, schema/migration, concurrent database-lock redesign, browser persistence, automatic mutation replay, deploy, or production mutation.

#### Retention preference boundary

`PWA-RETENTION-PREFERENCE-BOUNDARY-26` acceptance checks:

1. The browser accepts only the exact server-authoritative five-value retention DTO defined by `project-spec.md` and backend source: one hour, 24 hours, three days, seven days, and 30 days, with the selected value present in that ordered set. The setting remains owner-scoped PostgreSQL state, applies only to future verified local-upload completions, and never changes Google Drive inputs, Google Docs outputs, existing expiry, or browser storage.
2. Initial/repeated `GET /account/preferences` requests are latest-request-wins, abortable, and bounded to 15 seconds. PATCH, including any CSRF refresh, is bounded to 20 seconds and guarded synchronously by one parent-owned operation; Settings → Projects → Settings restores disabled/`aria-busy` state and a same-act duplicate cannot issue a second PATCH.
3. Timeout, transport loss, HTTP 408/5xx, or malformed success triggers one bounded authoritative GET and never automatically repeats PATCH. Exact selected TTL confirms success; a different authoritative TTL restores that value; failed reconciliation restores the last confirmed value. Safe outcomes survive remount, detached settlement gets one post-remount refresh, raw backend detail is never rendered, and logout/login invalidates stale ownership. Focused retention regressions `7/7`, complete App suite `171/171`, full Studio Vitest `434/434`, TypeScript, full ESLint, production build, lightweight checks, and `git diff --check` pass.
Readiness gate: Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Functional completion is **100% (`3/3`)** locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. The readiness gate is intentionally open under the current local-only instruction.

Non-goals: no retention option/default/business-rule change, backend/API/schema/migration/audit change, storage cleanup execution, browser persistence, automatic PATCH replay, Google OAuth/connection change, deploy, or production mutation.

#### Credential lifecycle boundary

`PWA-CREDENTIAL-LIFECYCLE-BOUNDARY-25` acceptance checks:

1. Repository evidence defines the server authority: create and replace have no idempotency/correlation input and are never replayed automatically; revoked credentials may be replaced explicitly; permanent deletion is terminal, hides the row from owner lists, clears every encrypted version exactly once, and rejects later replace/revoke. Repeated revoke/delete returns success without another state transition or audit event.
2. Settings credential-list reads accept only canonical unique DTOs, are latest-request-wins, abortable, and bounded to 15 seconds. Create, replace, revoke, and delete, including any CSRF refresh, are bounded to 20 seconds and guarded synchronously by create or exact credential ID. Parent-owned pending/outcome state survives Settings remounts, and matching controls expose disabled/`aria-busy` state.
3. Timeout, transport loss, HTTP 408/5xx, or malformed success triggers at most one bounded authoritative list reconciliation and never automatically repeats a mutation. Replace is confirmed only by a newer active version; revoke only by exact revoked state; delete only by exact ID absence; create remains explicitly ambiguous without correlation. Raw key input is cleared immediately after capture, never enters parent/browser state, and raw backend detail is never rendered. Focused credential regressions `11/11`, complete App suite `165/165`, full Studio Vitest `428/428`, TypeScript, full ESLint, production build, Python syntax, lightweight checks, and `git diff --check` pass.
Readiness gate: The new service-backed PostgreSQL/Redis credential regression, branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Functional completion is **100% (`3/3`)** locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. The readiness gate is open: the bundled local Python runtime has no `pytest`, and the current instruction remains local-only without push or PR.

Non-goals: no automatic create/replace/revoke/delete replay, idempotency-key/API-shape/schema/migration change, browser persistence of secrets or mutation bodies, Google OAuth/connection or retention-preference change, deploy, or production mutation. The existing unique `(user_id, provider, label)` constraint still reserves a deleted label; changing that requires a separate product/schema decision.


#### Project mutation boundary

`PWA-PROJECT-MUTATION-BOUNDARY-24` acceptance checks:

1. Repository evidence defines the safe boundary: project creation has no idempotency/correlation input, update targets one owner-scoped project, archive removes the active row and is not safely replayable from an ambiguous browser outcome. Active project-list responses must contain canonical project DTOs with unique IDs before they can replace browser state.
2. Initial and reconciliation `GET /projects` requests are latest-request-wins, abortable, and bounded to 15 seconds. Create, update, and archive, including any CSRF refresh, are bounded to 20 seconds and guarded synchronously by exact operation/project key; matching controls expose disabled/`aria-busy` pending state and a same-act duplicate cannot issue a second mutation.
3. Timeout, transport loss, HTTP 408/5xx, or malformed success never triggers automatic mutation replay. One authoritative collection read leaves create explicitly ambiguous because no exact correlation exists, confirms update only from exact requested fields plus evidence of change, and confirms archive only from project absence. Outcomes remain project-scoped, raw backend detail is not rendered, a failed create preserves its form, and same-project metadata refresh preserves unrelated composer state. Focused regressions, complete App suite, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
Readiness gate: Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Functional completion is **100% (`3/3`)** locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. The readiness gate is intentionally open under the current local-only instruction.

Non-goals: no backend idempotency/API/schema/business-rule change, no automatic create/update/archive replay, no durable/browser-storage mutation state, no global API timeout, deploy, or production mutation.

#### Google Picker ownership across project remounts

`PWA-GOOGLE-PICKER-REMOUNT-23` acceptance checks:

1. Replace the unowned global Picker boolean with one synchronous parent-owned operation carrying only `projectId`, `panelId`, `rowId`, and source/first-folder/second-folder kind. A second source or folder attempt in any project is rejected before rerender until the exact matching operation settles; an old or mismatched settlement cannot unlock a newer operation.
2. A → B → A while Picker interaction, source creation, or folder verification is pending preserves a project-scoped pending explanation and disabled controls. Settlement while the originating PreparationPanel is detached stores only predefined safe text and tone for its project; project B cannot see project A's result, and the next explicit project-A Picker attempt clears the prior outcome.
3. Source success explains that authoritative project sources were refreshed and rows must be selected again after remount; folder success explains that the non-persisted row selection must be repeated. No token, Google Drive file/folder ID, selected document, API payload, or raw error enters parent state or browser storage. The focused source/folder remount regression, related Google Picker cluster, complete App suite, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
Readiness gate: Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Functional completion is **100% (`3/3`)** locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. The readiness gate is intentionally open under the current local-only instruction.

Non-goals: no Picker token or Drive identity persistence, no automatic source/folder replay, no composer draft persistence redesign, no backend/API/schema/OAuth change, deploy, or production mutation.

#### Bounded post-selection Google requests

`PWA-GOOGLE-SELECTION-BOUNDARY-22` acceptance checks:

1. Repository evidence records the recovery boundary: Google Picker source creation is state-changing, accepts no `Idempotency-Key`, and its public source DTO deliberately omits Drive file IDs, so an ambiguous response cannot be matched exactly from the active-sources list. Output-folder verification is non-persisting and therefore needs no mutation replay.
2. Source creation, including any CSRF refresh, stops waiting after 20 seconds and is attempted exactly once per explicit selection. Timeout, transport loss, HTTP 408, or 5xx triggers one authoritative sources reload, predefined safe text, and no automatic POST replay or row placement; definitive 4xx behavior remains explicit. A successful response must contain the exact ordered batch size and canonical project-owned source DTOs before rows are changed.
3. Output-folder verification, including any CSRF refresh, stops waiting after 20 seconds, validates a non-empty name plus nullable/string `web_view_url`, never mutates a row on timeout/failure/malformed data, and always releases source and folder Picker controls. Focused regressions, complete App suite, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
Readiness gate: Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Functional completion is **100% (`3/3`)** locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. The readiness gate is intentionally open under the current local-only instruction.

Non-goals: no backend/API/schema/idempotency change, no exact automatic recovery where the API exposes no correlation identity, no automatic source-creation replay, no Google Picker remount-ownership redesign, deploy, or production mutation.

#### Bounded Google Picker session and interaction lifecycle

`PWA-GOOGLE-PICKER-TIMEOUT-21` acceptance checks:

1. Both composer entrypoints acquire the secret-bearing Google Picker session through one 20-second request bound shared with any CSRF refresh, and validate non-empty token/public configuration plus `scope_ready === true` before opening Picker. Timeout, transport loss, and malformed payload fail closed with predefined safe text, release composer controls, create no source/folder selection mutation, and are not automatically replayed outside the existing CSRF-rejection contract.
2. The existing 10-second script-loader guard remains intact. Once Picker is built, a five-minute interaction deadline closes it, clears the request-local token copy, settles one safe error, and lets each caller's `finally` release its synchronous ref and shared `pickerBusy` lock. The idempotent settlement guard ignores any callback arriving after timeout.
3. Regressions prove one aborted session POST per explicit attempt, no automatic replay, malformed-session rejection without token exposure, callback-timeout close/unlock, ignored late selection, and no source mutation. Existing cancel/error/duplicate/folder tests, complete App suite, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
Readiness gate: Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Functional completion is **100% (`3/3`)** locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. The readiness gate is intentionally open under the current local-only instruction.

Non-goals: no backend/API/OAuth/schema change, no automatic source/folder mutation replay, no timeout yet for post-selection source creation or folder verification, no maintenance-panel session refactor, deploy, or production mutation.

#### Local-upload ownership and outcomes across remounts

`PWA-LOCAL-UPLOAD-REMOUNT-20` acceptance checks:

1. `ProjectsPage` owns a synchronous operation registry containing only project, panel-instance, and row IDs. It rejects an exact same-act duplicate before React rerender while preserving independent uploads for different rows in the same mounted panel. Because composer row IDs are regenerated after project remount, any still-pending operation from an older panel instance conservatively blocks all new local intake only in its originating project until settlement.
2. Returning A → B → A while initiation/PUT/completion is pending restores disabled/`aria-busy` input plus a safe pending status. Off-panel settlement stores only predefined project-scoped failure/partial/success text; no `File`, presigned capability, filename, raw response, or failure cause enters parent or browser persistence. A new explicit selection after unlock clears prior outcomes for that project before one new chain begins.
3. One A → B → A regression proves pending restoration, duplicate rejection, project isolation, off-panel safe failure, explicit-retry clearing, later success persistence, authoritative source-list refresh, and exact initiation/PUT/completion counts. Existing same-row dedup/multi-file tests, complete App suite, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
Readiness gate: Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Functional completion is **100% (`3/3`)** locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. The readiness gate is intentionally open under the current local-only instruction.

Non-goals: no `File`/capability persistence, no automatic initiation or PUT replay, no composer-draft persistence redesign, backend/API/schema/storage change, deploy, or production mutation.

#### Bounded local-upload initiation and object PUT
`PWA-LOCAL-UPLOAD-BOUNDARY-19` acceptance checks:

1. Repository evidence records the recovery boundary: initiation commits a new pending source before returning a presigned capability, accepts no `Idempotency-Key`, and cannot be identified uniquely from active-sources filename/MIME/size data; after a valid response, PUT recovery has exact `source_id` authority and uses only the existing verified completion/reconciliation path.
2. Each initiation POST, any CSRF refresh, and each object PUT stop waiting after 20 seconds. Timeout, transport loss, HTTP 408, or 5xx initiation ambiguity causes one safe sources reload and no automatic POST or PUT; timeout/transport ambiguity after PUT causes no second PUT and invokes only bounded exact-source completion/reconciliation. Definitive storage HTTP rejection remains fail-closed.
3. Regressions cover stalled initiation abort, ambiguous 5xx initiation, stalled PUT abort, exact request counts, source reload, safe unlock/recovery, and absence of raw response/private upload identity. Complete App suite, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
Readiness gate: Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Functional completion is **100% (`3/3`)** locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. The readiness gate is intentionally open under the current local-only instruction.

Non-goals: no initiation idempotency/API/schema change, no automatic initiation or object PUT replay, no browser persistence of files/capabilities, backend/storage mutation, deploy, or production mutation.


#### Source-deletion ownership and outcomes across remounts
`PWA-SOURCE-DELETE-REMOUNT-18` acceptance checks:

1. A synchronous exact-source deletion registry and its predefined result notices live in persistent `ProjectsPage` memory, remain keyed by source ID and originating project, and cannot be reset by a `PreparationPanel` project remount.
2. Returning A → B → A while DELETE or its authoritative reconciliation is pending restores disabled/`aria-busy` UI and rejects another DELETE before React rerender. Settlement is visible only in the originating project, never renders raw backend detail, and an explicit retry clears only the matching previous outcome before one new request.
3. A project-switch regression proves one DELETE while pending, a fail-closed 5xx/reconciliation outcome after settlement on another project, retry unlock and outcome clearing, a second confirmed deletion, project isolation, authoritative source disappearance, and no raw failure text. Complete App suite, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
Readiness gate: Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Functional completion is **100% (`3/3`)** locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. The readiness gate is intentionally open under the current local-only instruction.

Non-goals: no automatic DELETE replay, backend/API/schema/business-rule change, browser persistence, storage cleanup execution, deploy, or production mutation.


#### Bounded local-upload completion recovery
`PWA-LOCAL-UPLOAD-COMPLETE-17` acceptance checks:

1. Repository evidence establishes completion replay authority: backend completion returns an already uploaded exact source without another storage `HEAD`, preserves `uploaded_at`/`expires_at`, and does not extend retention; pending completion revalidates exact object metadata and source/project state under a row lock before commit.
2. Each completion POST and any CSRF refresh share a 20-second deadline. Timeout or retryable ambiguity triggers one separately bounded no-store active-sources read: an exact validated `uploaded` source completes locally without replay; only an exact matching `pending` source permits one bounded completion replay. No path repeats source initiation or object PUT.
3. Regressions cover ambiguous PUT recovery, authoritative uploaded suppression, pending-state replay, stalled completion abort/replay, single initiation/PUT counts, safe failure text, and no raw upload identity. Complete App suite, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
Readiness gate: Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Functional completion is **100% (`3/3`)** locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. The readiness gate is intentionally open under the current local-only instruction.

Non-goals: no initiation/PUT retry, backend/API/schema/storage change, browser persistence of upload capability/source body, source-deletion change, deploy, or production mutation.


#### Bounded source deletion and authoritative absence recovery
`PWA-SOURCE-DELETE-RECOVERY-16` acceptance checks:

1. Repository evidence establishes deletion authority: the backend locks the owner-scoped source and referencing jobs, repeated accepted deletion preserves timestamps and creates no duplicate audit/diagnostic events, and the owner-scoped active-sources list excludes exactly the durably deleted source.
2. A synchronous per-source guard rejects same-act duplicate removal before React rerender. DELETE and any CSRF refresh share a 20-second deadline and are never replayed automatically; timeout, transport loss, HTTP 408, and 5xx trigger one separately bounded active-sources read. Only absence of the exact source ID confirms deletion; presence, malformed data, read failure, or read timeout preserves the source and reports a predefined ambiguous outcome.
3. Regressions cover one DELETE under duplicate clicks, deadline abort plus confirmed absence, fail-closed source presence after transport/5xx ambiguity, safe text, and explicit-retry unlock. Complete App suite, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
Readiness gate: Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Functional completion is **100% (`3/3`)** locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. The readiness gate is intentionally open under the current local-only instruction.

Non-goals: no automatic DELETE replay, backend/API/schema/business-rule change, browser persistence, storage cleanup execution, local-upload completion change, deploy, or production mutation.



#### Bounded batch creation and exact idempotent recovery
`PWA-BATCH-CREATE-RECOVERY-15` acceptance checks:

1. Repository evidence establishes the recovery authority: a complete exact replay is project/owner/key/request-hash scoped, returns the original ordered jobs with `replayed: true`, and is protected by the backend unique constraint/transaction. The ordinary jobs list is explicitly not treated as batch-membership evidence because its browser DTO omits the idempotency key and batch positions.
2. Batch preflight and create stop waiting after 20 seconds with one shared abort signal across any CSRF refresh. A timed-out or transport-ambiguous create is never repeated automatically; its exact request body and `Idempotency-Key` remain in owner-scoped memory across A → B → A, block a new key, and require one explicit user replay.
3. Regression tests prove one POST before timeout, abort at the deadline, no hidden second POST, project isolation, and byte-identical body/key on explicit replay. Complete App suite, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
Readiness gate: Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Functional completion is **100% (`3/3`)** locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. The readiness gate is intentionally open under the current local-only instruction.

Non-goals: no automatic POST replay, jobs-list inference, backend/API/schema/business-rule change, browser persistence of request bodies, provider or Google Drive call, deploy, or production mutation.



#### Bounded job mutations and authoritative timeout reconciliation

`PWA-JOB-MUTATION-TIMEOUT-14` acceptance checks:

1. Cancel, provider-cost retry, output reconciliation, and terminal dismissal stop waiting after 20 seconds. The same abort signal also bounds a CSRF refresh, and no timed-out mutation is ever repeated automatically.
2. A timeout triggers one separately bounded authoritative read before ownership is released: job detail confirms cancellation only through `cancelled`/`cancel_requested_at` and dismissal only through `terminal_dismissed_at`; retry readiness confirms queueing/running/completion or an advanced attempt; reconciliation metadata confirms only an observable status/count/check-time transition.
3. Confirmed and still-ambiguous outcomes use predefined safe owner-scoped notices. Integration tests prove exactly one POST for each action, the matching GET reconciliation, and no raw backend/provider/Google response in UI or storage; helper/API tests, complete App suite, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
Readiness gate: Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Functional completion is **100% (`3/3`)** locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. The readiness gate is intentionally open under the current local-only instruction.

Non-goals: no automatic POST retry, backend idempotency/business-rule change, API/schema change, provider or Google Drive call in local tests, deploy, or production mutation.


#### Safe job mutation outcomes across project switches

`PWA-JOB-MUTATION-OUTCOME-13` acceptance checks:

1. Settlement of cancel, provider retry, output reconciliation, and terminal dismissal produces only predefined safe success/failure notices in persistent ProjectsPage memory, keyed by mutation kind/job and scoped to the originating project; no raw response, path, identifier, or transcript body is copied into notice text or browser storage.
2. A notice remains available after the originating PreparationPanel remounts, is absent in another project, and is cleared when the user explicitly begins the same mutation again. Current-panel retry/reconciliation inline feedback suppresses the owner notice so text is not duplicated; cancel/dismiss feedback uses the owner path directly.
3. Existing four-kind dedup regressions, A → B → A failure/success/clearing/isolation regression, complete App suite, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
Readiness gate: Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Functional completion is **100% (`3/3`)** locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. The readiness gate is intentionally open under the current local-only instruction.

Non-goals for this completed item: no mutation timeout, automatic retry, durable/browser-storage notice persistence, backend idempotency/business-rule change, API/schema change, deploy, or production mutation.


#### Job mutation ownership across projects

`PWA-JOB-MUTATION-OWNERSHIP-12` acceptance checks:

1. A synchronous owner-scoped registry in persistent ProjectsPage tracks cancel, provider retry, output reconciliation, and terminal dismissal independently by mutation kind and job ID; PreparationPanel project remounts cannot clear it.
2. Every covered mutation rejects a duplicate begin before React rerender. Returning to the originating project while the request is pending restores disabled/`aria-busy` UI, and settlement releases only the matching key for one explicit retry without exposing raw backend detail.
3. Existing four-kind dedup regressions, a real A → B → A pending-cancellation regression, complete App suite, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
Readiness gate: Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Functional completion is **100% (`3/3`)** locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. The readiness gate is intentionally open under the current local-only instruction.

Non-goals: no mutation timeout, automatic retry, backend idempotency/business-rule change, cross-project success/failure message persistence, API/schema change, deploy, or production mutation.


#### Project collection read timeouts

`PWA-PROJECT-COLLECTION-TIMEOUT-11` acceptance checks:

1. Same-project sources and jobs collection GETs receive independent AbortSignals and cannot remain pending beyond 15 seconds; only the matching project/resource key is affected.
2. A newer collection read aborts the older same-key request without committing stale failure or emitting an intentional-abort diagnostic. ProjectsPage teardown invalidates and aborts all active collection reads; real timeout/failure resolves loading to safe Russian UI while preserving last-known successfully loaded items.
3. Focused collection-timeout and failed-refresh preservation regressions, complete App suite, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
Readiness gate: Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Functional completion is **100% (`3/3`)** locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. The readiness gate is intentionally open under the current local-only instruction.

Non-goals: no mutation timeout or retry, no global API timeout, no backend/API/schema change, no project-list or Google-connection behavior change, deploy, or production mutation.


#### Job detail read timeouts

`PWA-JOB-READ-TIMEOUT-10` acceptance checks:

1. Job detail, outputs, retry metadata, and output-reconciliation metadata GETs receive independent AbortSignals and cannot remain pending beyond 15 seconds; only the matching resource/job key is affected.
2. A newer read aborts the older same-key request without committing stale failure or emitting an intentional-abort diagnostic. PreparationPanel teardown invalidates and aborts all active job reads; a real timeout remains observable and replaces indefinite detail/output loading with existing safe messages.
3. Focused ordering/timeout tests, complete App and latestRequest suites, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
Readiness gate: Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Functional completion is **100% (`3/3`)** locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. The readiness gate is intentionally open under the current local-only instruction.

Non-goals: no mutation timeout or retry, no global API timeout, no backend/API/schema change, no progress-polling behavior change, deploy, or production mutation.


#### Terminal dismissal deduplication

`PWA-JOB-DISMISS-DEDUP-09` acceptance checks:

1. Two terminal-dismiss attempts for the same job while the first request is in flight produce at most one mutation request; the synchronous per-job guard does not depend on a React rerender.
2. The pinned-terminal dismissal control is disabled and exposes `aria-busy=true` while pending. A safe failure message unlocks one explicit retry, raw backend detail is not rendered, and a successful response preserves the authoritative jobs reload and existing backend idempotency contract.
3. Focused App and JobCard regressions, complete suites, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
Readiness gate: Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Functional completion is **100% (`3/3`)** locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. The readiness gate is intentionally open under the current local-only instruction.

Non-goals: no terminal-visibility/business-rule change, backend idempotency or audit change, API/schema changes, deploy, or production mutation.

#### Output reconciliation deduplication

`PWA-JOB-RECONCILIATION-DEDUP-08` acceptance checks:

1. Two output-reconciliation checks for the same job while the first request is in flight produce at most one mutation request; the synchronous per-job guard does not depend on a React rerender.
2. The explicit Google Drive check is disabled and exposes `aria-busy=true` while pending. A safe failure message unlocks one explicit retry, raw backend detail is not rendered, and no automatic reconciliation is introduced.
3. Focused App and OutputReconciliationNotice regressions, complete suites, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
Readiness gate: Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Functional completion is **100% (`3/3`)** locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. The readiness gate is intentionally open under the current local-only instruction.

Non-goals: no reconciliation eligibility/business-rule change, backend idempotency change, automatic Google Drive check, API/schema changes, deploy, or production mutation.

#### Provider-cost retry deduplication

`PWA-JOB-RETRY-DEDUP-07` acceptance checks:

1. Two retry attempts for the same job while the first request is in flight produce at most one mutation request; this includes partial resume/restart requests carrying explicit remaining-provider-cost confirmation and does not depend on a React rerender.
2. An available retry control is disabled and exposes `aria-busy=true` while pending. A safe failure message unlocks one explicit retry, raw backend detail is not rendered, and no automatic provider retry is introduced.
3. Focused App and JobDetailSection regressions, complete suites, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
Readiness gate: Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Functional completion is **100% (`3/3`)** locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. The readiness gate is intentionally open under the current local-only instruction.

Non-goals: no retry eligibility/business-rule change, backend idempotency change, automatic provider retry, API/schema changes, deploy, or production mutation.

#### Job cancellation deduplication

`PWA-JOB-CANCEL-DEDUP-06` acceptance checks:

1. Two cancellation attempts for the same job while the first request is in flight produce at most one mutation request; the synchronous guard does not depend on a React rerender.
2. Queued and processing cancellation controls are disabled and expose `aria-busy=true` while pending. A safe failure message unlocks one explicit retry, raw backend detail is not rendered, and a successful response preserves the existing authoritative jobs reload.
3. Focused action/component regressions, complete App and JobCard suites, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
Readiness gate: Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Functional completion is **100% (`3/3`)** locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. The readiness gate is intentionally open under the current local-only instruction.

Non-goals: no backend idempotency contract, API/schema changes, automatic mutation retry, cancellation semantics change, deploy, or production mutation.

#### Job detail ordering

`PWA-JOB-DETAIL-ORDERING-05` acceptance checks:

1. For repeated loads of one job, only the newest detail and outputs requests may commit success or failure state; a stale response cannot restore obsolete source/output data or replace a newer safe error.
2. Retry and output-reconciliation metadata use independent per-job request epochs, so a stale response cannot restore obsolete action availability. After a successful retry or reconciliation mutation, authoritative jobs reload remains immediate and is not blocked by the four detail reads.
3. Shared ordering tests, a component-level repeated-open regression, complete App tests, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
Readiness gate: Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Functional completion is **100% (`3/3`)** locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. The readiness gate is intentionally open under the current local-only instruction.

Non-goals: no API/backend/schema changes, no global request cache, no mutation retry, no deploy, and no production mutation.

#### Project list ordering

`PWA-PROJECT-LIST-ORDERING-04` acceptance checks:

1. For repeated source-list loads of one project, only the newest request may commit success or failure state; stale responses cannot restore removed sources or erase newly loaded sources.
2. For repeated job-list loads of one project, only the newest request may commit success or failure state; stale responses cannot hide newly created/retried jobs or replace fresh status.
3. Request epochs are isolated by resource and project key. Focused ordering tests, complete App tests, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
Readiness gate: Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Functional completion is **100% (`3/3`)** locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. The readiness gate is intentionally open under the current local-only instruction.

Non-goals: no request cancellation, API/backend/schema changes, cache persistence, cross-owner state, deploy, or production mutation.

#### Polling resilience

`PWA-JOB-PROGRESS-POLLING-03` acceptance checks:

1. An initial or later transient `/jobs/progress` rejection cannot permanently stop polling; retry does not depend on a previously confirmed response.
2. A stalled request is aborted after 15 seconds and enters the same bounded retry path; project switch/unmount aborts the current request immediately. Intentional cleanup abort is excluded from API-failure diagnostics while timeout/unexpected abort remains observable.
3. Consecutive failures use bounded exponential backoff up to 30 seconds; success resets the normal five-second cadence and outages preserve the last confirmed snapshot.
4. Missing requested jobs trigger authoritative jobs reconciliation without terminating polling; cleanup prevents stale scheduling. Focused tests, full Studio Vitest, TypeScript, ESLint, production build, lightweight checks, and `git diff --check` pass.
Readiness gate: Branch publication, required PR-head/exact-main CI, and merge are separately evidenced before READY.

Functional completion is **100% (`4/4`)** locally on `codex/pwa-stability-hardening`, based on `main@7871b31dc47158c43c3572612a8d0aa3242d018f`. The readiness gate is intentionally open: the current instruction is local implementation without push or PR.

Non-goals: no API/worker/schema/provider changes, no changed progress semantics, no fabricated within-request percentage, no deploy, and no production mutation.

### Local validation histories

- `PWA-PREPARATION-PREREQUISITE-BOUNDARY-30` local evidence: focused timeout/retry, malformed-response, and A → B → A teardown regressions `3/3`, complete App suite `187/187`, and full Studio Vitest `450/450` passed. Credential and source-upload-policy reads have independent 15-second latest-request boundaries, timeout and project remount abort their exact signals, and recovery requires separate explicit retry. The credential path reuses the shared duplicate-rejecting validator; malformed policy data is rejected by the existing browser-safe policy validator. Both failures disable their dependent controls and render only predefined text. The first focused runs corrected test-only assumptions about duplicate safe blocker text and shared credential consumers; the first full App run exposed one obsolete fixture that still returned backend-impossible `status=deleted`, which was removed while secret-like extra-field non-rendering coverage remains. TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` pass. No credential/upload mutation, backend/API/schema, deploy, or production state is changed.
- `PWA-OVERVIEW-COLLECTION-BOUNDARY-29` local evidence: focused collection-boundary regressions `3/3`, the two adjusted cross-page timeout regressions `2/2`, complete App suite `184/184`, and full Studio Vitest `447/447` passed. Overview projects and credentials share the exact collection requesters used by their primary consumers; duplicate/malformed collections fail closed without raw-field rendering. Both summaries have independent 15-second latest-request-wins/teardown boundaries and explicit retry while preserving the other summary and any last-known valid data. The first full App run exposed two obsolete signal-count assumptions: navigation now correctly aborts the new Overview request before the destination page creates and times out its own request; the assertions were tightened to verify both aborts. TypeScript, full ESLint, and Vite/PWA production build pass. No backend/API/schema, mutation, deploy, or production state is changed.
- `PWA-GOOGLE-CONNECTION-CONSUMERS-28` local evidence: focused Overview/Projects connection regressions `3/3`, complete App suite `181/181`, and standalone full Studio Vitest `444/444` passed. Overview aborts a stalled read after 15 seconds, reports only safe unavailable state, and succeeds through explicit retry. Projects rejects a contradictory DTO without rendering its raw field, distinguishes unavailable from disconnected, disables source and folder Picker controls, refreshes on every active return, and ignores a late connected response after a newer disconnected read. The two older Settings regressions were updated only for the now-intentional additional Overview/Projects GETs and remain green. TypeScript, full ESLint, and Vite/PWA production build pass. A first parallel four-process gate also completed all `444/444` assertions but hit a post-suite `tinypool` teardown exception; the standalone rerun exited cleanly and is the claimed test evidence. No OAuth mutation, backend/API/schema, deploy, or production mutation is claimed.
- `PWA-GOOGLE-CONNECTION-BOUNDARY-27` local evidence: focused Settings connection regressions `11/11`, complete App suite `178/178`, and full Studio Vitest `441/441` passed. Stalled/malformed connection reads fail closed after 15 seconds with explicit retry and no raw detail. OAuth start and disconnect reject same-act duplicates, expose disabled/`aria-busy`, abort after 20 seconds, perform one authoritative connection read on uncertainty, and never replay POST/DELETE automatically. The exact Google authorization origin/path/query/scope contract rejects hostile or malformed redirect capabilities; logout invalidates late success before navigation. Settings → Projects → Settings preserves detached disconnect ownership/outcome and requests exactly one post-remount refresh. Sequential backend disconnect replay preserves the original terminal timestamp, wipes primary and maintenance token material, and emits one audit event. Python syntax, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` pass. The backend service regression is authored but was not executed locally because bundled Python lacks `pytest`, so TEST remains partial and CI remains open. No maintenance OAuth, Picker, API shape/schema/migration, deploy, or production mutation is claimed.
- `PWA-RETENTION-PREFERENCE-BOUNDARY-26` local evidence: focused retention regressions `7/7`, complete App suite `171/171`, and full Studio Vitest `434/434` passed. Stalled/malformed initial GET fails closed after 15 seconds without rendering choices; PATCH rejects a same-act duplicate, exposes disabled/`aria-busy`, aborts after 20 seconds, performs exactly one authoritative read, and is never replayed automatically. A → Projects → Settings preserves pending ownership, detached 5xx settlement is confirmed from the exact selected server TTL, then performs one post-remount refresh without repeated extra reads. Failed write plus failed reconciliation restores the last confirmed TTL and renders neither raw write nor read detail. TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` pass. Backend source/test evidence already proves exact five-option validation and repeated-same-value audit idempotence; no backend/API/schema/audit, storage cleanup, Google, deploy, or production mutation is claimed.
- `PWA-CREDENTIAL-LIFECYCLE-BOUNDARY-25` local evidence: focused credential frontend regressions `11/11`, complete App suite `165/165`, and full Studio Vitest `428/428` passed. A stalled/malformed list fails closed after 15 seconds; create clears the raw DOM value immediately, rejects a same-act duplicate, aborts after 20 seconds, performs one authoritative GET, and never replays the POST. Replacement ownership and safe outcomes survive Settings → Projects → Settings without persisting or rendering raw key/backend detail; ambiguous permanent deletion is confirmed only after the exact credential disappears. Backend source now makes deleted credentials terminal/hidden and revoke/delete replay audit-idempotent; a service-backed regression covers two encrypted versions, one revoke/delete audit, crypto erasure, replay stability, hidden list state, and rejected resurrection. Python syntax, full TypeScript/ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` pass. The backend regression was not executed locally because the available bundled Python lacks `pytest`; service-backed CI remains the explicit TEST/CI gate. No API shape/schema/migration, automatic mutation replay, Google/retention, deploy, or production mutation is claimed.
- `PWA-PROJECT-MUTATION-BOUNDARY-24` local evidence: focused project-list/create/update/archive boundary regressions `4/4`, complete App suite `159/159`, and full Studio Vitest `422/422` passed. A stalled project-list read aborts after 15 seconds; a stalled create aborts after 20 seconds, issues one POST plus one list reconciliation, preserves both draft fields, and remains explicitly ambiguous. A deferred update blocks a same-act duplicate, keeps pending/result state scoped across A → B → A, performs one reconciliation after 5xx, and renders no raw detail. An ambiguous archive disappears only after the authoritative list omits the exact project. Existing same-project composer-preservation coverage remains green. TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. No backend/API/schema/idempotency change, automatic replay, PR, CI, deploy, or live evidence is claimed.
- `PWA-GOOGLE-PICKER-REMOUNT-23` local evidence: one A → B → A regression covers both source creation and folder verification `1/1`; the related Google Picker cluster passes `12/12`, complete App suite `155/155`, full Studio Vitest `418/418`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. The restored project-A panel exposes a safe pending status and disabled source/folder actions, a programmatic duplicate leaves source/verify mutation counts at one, project B sees only the cross-project busy explanation, and off-panel settlements produce safe project-A notices only after return. A subsequent explicit Picker begin clears the prior project notice. Parent state contains only project/panel/row/kind plus predefined message/tone; token, Drive IDs, selected docs, raw payloads, and raw failures remain request-local and are not persisted. No backend/API/schema/OAuth change, automatic replay, PR, CI, deploy, or live evidence is claimed.
- `PWA-GOOGLE-SELECTION-BOUNDARY-22` local evidence: focused source/folder deadline, ambiguity, validation, and unlock regressions `4/4`, complete App suite `154/154`, full Studio Vitest `417/417`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. A stalled source POST is aborted after 20 seconds, a 5xx remains ambiguous, both issue exactly one POST and one authoritative sources reload without row placement or raw detail; stalled folder verification aborts and unlocks all Picker actions, while malformed verification cannot enter row state. The first full regression run exposed six legacy custom fixtures that returned non-canonical `{}` verification payloads; the project-agnostic shared helper now preserves any valid scenario DTO and supplies only the historical canonical fallback, without weakening production validation. No backend/API/schema/idempotency change, automatic mutation replay, PR, CI, deploy, or live evidence is claimed.
- `PWA-GOOGLE-PICKER-TIMEOUT-21` local evidence: focused deadline/validation regressions `3/3`, complete App suite `150/150`, full Studio Vitest `413/413`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. A stalled session is aborted after 20 seconds with one POST per explicit attempt and no Picker/selection mutation; malformed capability data is rejected without rendering its token; a Picker that never calls back is hidden after five minutes, releases the source/folder lock, and ignores a late `picked` callback. Six legacy composer tests initially failed because their custom fixtures returned `{}` for the session endpoint while stubbing Picker itself; the shared test helper now supplies the real validated session shape, preserving rather than weakening production validation. No backend/API/OAuth/schema change, automatic selection mutation replay, PR, CI, deploy, or live evidence is claimed.
- `PWA-LOCAL-UPLOAD-REMOUNT-20` local evidence: the A → B → A ownership/outcome regression `1/1`, complete App suite `147/147`, full Studio Vitest `410/410`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. The original input returns disabled and `aria-busy`, a programmatic duplicate keeps initiation at one, project B sees neither pending nor result text, and off-panel storage failure is reduced to predefined safe project-A text. Explicit retry clears that outcome, produces exactly one additional initiation/PUT, completes once, refreshes the authoritative source list, and exposes the safe success only after another project-A remount. Parent state contains only operation IDs and predefined notices; `File`, presigned URL/headers, filenames, and raw failure data remain component/request-local and are not persisted. No backend/API/schema/storage change, PR, CI, deploy, or live evidence is claimed.
- `PWA-LOCAL-UPLOAD-BOUNDARY-19` local evidence: backend route/tests show that initiation creates and commits a fresh pending source without idempotency input, while completion is exact-source, owner/project constrained, metadata verified, race revalidated, and replay-safe. Frontend regressions cover stalled initiation `1/1`, ambiguous 5xx initiation `1/1`, and stalled PUT `1/1`; complete App suite `146/146`, full Studio Vitest `409/409`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. The initiation cases emit one POST, no PUT/completion, safe text, and one sources refresh; the PUT case aborts one PUT and succeeds only through one exact-source completion, with no second initiation/PUT or raw response/upload identity. No backend/API/schema/storage change, browser persistence, PR, CI, deploy, or live evidence is claimed.
- `PWA-SOURCE-DELETE-REMOUNT-18` local evidence: the A → B → A regression `1/1`, complete App suite `143/143`, full Studio Vitest `406/406`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. While the first DELETE and its 5xx reconciliation settle off-panel, the restored source control remains disabled/`aria-busy` and a duplicate begin is rejected synchronously. The predefined ambiguous outcome is absent from project B and retained in project A; explicit retry clears it, one second DELETE can complete while off-panel, and the safe success plus authoritative source disappearance remain visible only on return to project A. Raw backend detail is absent. No backend/API/schema change, automatic DELETE replay, browser persistence, PR, CI, deploy, cleanup execution, or live evidence is claimed.
- `PWA-LOCAL-UPLOAD-COMPLETE-17` local evidence: backend API tests verify replay returns the exact source without another storage `HEAD` and preserves upload/retention timestamps; race tests verify metadata and source lifecycle revalidation before commit. Frontend recovery regressions cover ambiguous PUT `1/1`, authoritative uploaded suppression `1/1`, exact-pending replay `1/1`, and stalled completion deadline/replay `1/1`. Complete App suite `142/142`, full Studio Vitest `405/405`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. Each completion attempt and CSRF refresh share a 20-second signal; initiation and object PUT stay single-shot, and no upload URL/private identity or raw error detail is rendered or stored. No backend/API/schema/storage change, PR, CI, deploy, or live evidence is claimed.
- `PWA-SOURCE-DELETE-RECOVERY-16` local evidence: backend source-deletion code/tests verify owner/project locking, job-readiness gates, repeat idempotence, stable deletion/cleanup timestamps, and no duplicate audit/diagnostic events; the active-sources endpoint excludes deleted rows. Recovery regressions cover deadline/dedup/confirmed absence `1/1`, transport ambiguity with source presence `1/1`, and 5xx ambiguity with source presence `1/1`. Complete App suite `140/140`, full Studio Vitest `403/403`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. DELETE and CSRF refresh share the 20-second signal; no DELETE is automatically replayed, and raw error detail is absent. The first full run correctly exposed that the old 5xx test treated a state-changing server error as definitive; it now verifies the fail-closed ambiguous outcome after source-list reconciliation. No backend/API/schema change, cleanup execution, PR, CI, deploy, or live evidence is claimed.
- `PWA-BATCH-CREATE-RECOVERY-15` local evidence: backend route/model/tests verify owner/project/idempotency-key/request-hash replay, ordered complete-batch recovery, transaction rollback, and a unique `(owner_id, project_id, batch_idempotency_key, batch_position)` constraint. The ordinary jobs-list DTO omits batch identity, so no unsafe list inference was implemented. Preflight/create timeout regressions `2/2`, A → B → A exact-replay/isolation regression `1/1`, complete App suite `138/138`, full Studio Vitest `401/401`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. Preflight and create share a 20-second bound; a timed-out create issues exactly one POST, and explicit recovery reuses the exact body/key without browser storage. No backend/API/schema change, automatic POST replay, PR, CI, deploy, provider/Google call, or live evidence is claimed.
- `PWA-JOB-MUTATION-TIMEOUT-14` local evidence: endpoint audit verified durable idempotency for cancel/dismiss, transactional queue authority for retry, and fail-closed Google reconciliation metadata. Bounded-request helper tests `5/5`, timeout integration regressions `4/4`, API client tests `7/7`, complete App suite `136/136`, full Studio Vitest `399/399`, TypeScript, full ESLint, Vite/PWA production build, and `git diff --check` passed. Each timeout produces exactly one POST followed by the endpoint-specific authoritative GET; provider-cost retry and Google Drive check are never automatically repeated, CSRF refresh shares the deadline signal, and confirmed/ambiguous text is predefined. Initial integration runs exposed two fixture-only assumptions: the test timer also accelerated existing 15-second detail reads, and terminal failed jobs preloaded readiness before explicit open. A distinct 20-second mutation deadline plus abort-driven fixture transition resolved both without weakening production assertions. No PR, CI, deploy, provider/Google call, or live evidence is claimed.
- `PWA-JOB-MUTATION-OUTCOME-13` local evidence: existing same-act mutation regressions plus the expanded project-switch outcome regression `5/5`, complete App suite `132/132`, full Studio Vitest `389/389`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. A safe cancellation failure remains visible after remount, disappears on explicit retry, the later safe success is absent in project B and visible on return to project A, and raw backend detail remains absent. Retry/reconciliation current-panel inline feedback suppresses duplicate owner notices; all notice state remains owner-scoped in memory only. One intermediate focused run caught a mechanically malformed template-literal path before tests executed; all four paths were restored by function-bounded replacement and TypeScript plus all final gates pass. No mutation timeout, automatic retry, PR, CI, deploy, or live evidence is claimed.
- `PWA-JOB-MUTATION-OWNERSHIP-12` local evidence: four existing same-act mutation dedup regressions `4/4`, project-switch ownership regression `1/1`, complete App suite `132/132`, full Studio Vitest `389/389`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. A pending cancellation remains disabled and `aria-busy` after A → B → A remount, a second POST is rejected synchronously, settlement releases the matching owner-scoped key for explicit retry, and raw backend failures remain absent from the DOM. The same persistent registry is wired to retry, reconciliation, and dismissal, whose existing same-act regressions remain green. No mutation timeout, automatic retry, PR, CI, deploy, or live evidence is claimed.
- `PWA-PROJECT-COLLECTION-TIMEOUT-11` local evidence: focused collection timeout and failed-refresh preservation regressions `2/2`, complete App suite `131/131`, full Studio Vitest `388/388`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. Sources/jobs collection requests receive independent signals and abort after 15 seconds; teardown/supersede cancellation is silent, while real failure resolves loading to safe Russian UI and retains last-known items. The production timeout remains 15 seconds; tests accelerate only that exact timer. No PR, CI, deploy, or live evidence is claimed.
- `PWA-JOB-READ-TIMEOUT-10` local evidence: latestRequest ordering/abort/timeout/teardown suite `6/6`, App stalled-read regression `1/1`, complete App suite `130/130`, full Studio Vitest `387/387`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. All four job-read signals abort at 15 seconds, detail/output loading resolves to safe retryable UI, a newer same-key request cancels its predecessor without stale failure, and teardown cancellation is explicitly ignored by API diagnostics while timeout aborts remain observable. The first App run exposed the existing terminal auto-load path and was narrowed to a processing-job fixture so timeout and supersede cases remain independent. No PR, CI, deploy, or live evidence is claimed.
- `PWA-JOB-DISMISS-DEDUP-09` local evidence: App terminal-dismiss regression `1/1`, complete JobCard suite `4/4`, complete App suite `129/129`, full Studio Vitest `383/383`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. A same-act double click produces one POST; pending action is disabled with `aria-busy`, failure unlocks explicit retry, authoritative jobs reload remains intact, and raw backend detail remains absent from the DOM. The first focused run exposed an incomplete fixture that omitted canonical `terminal_dismissed_at: null`; the corrected fixture and repeated gates pass. No PR, CI, deploy, or live evidence is claimed.
- `PWA-JOB-RECONCILIATION-DEDUP-08` local evidence: App reconciliation regression `1/1`, complete OutputReconciliationNotice suite `2/2`, complete App suite `128/128`, full Studio Vitest `381/381`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. A same-act double click produces one POST; pending action is disabled with `aria-busy`, failure unlocks explicit retry, the existing authoritative jobs/detail reload remains intact, and raw backend detail remains absent from the DOM. No PR, CI, deploy, Google Drive call, or live evidence is claimed.
- `PWA-JOB-RETRY-DEDUP-07` local evidence: App provider-cost retry regression `1/1`, complete JobDetailSection suite `8/8`, complete App suite `127/127`, full Studio Vitest `380/380`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. A same-act double click produces one POST; pending action is disabled with `aria-busy`, failure unlocks explicit retry, both explicit partial requests preserve `{confirm_remaining_provider_cost: true}`, and raw backend detail remains absent from the DOM. No PR, CI, deploy, provider call, or live evidence is claimed.
- `PWA-JOB-CANCEL-DEDUP-06` local evidence: focused cancellation regressions `6/6`, complete App suite `126/126`, complete JobCardActions suite `8/8`, full Studio Vitest `378/378`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. A same-act double click produces one POST; pending queued/processing controls are disabled with `aria-busy`, a failed request unlocks explicit retry, and raw backend detail remains absent from the DOM. No PR, CI, deploy, or live evidence is claimed.
- `PWA-JOB-DETAIL-ORDERING-05` local evidence: ordering helper `3/3`, component repeated-open regression `1/1`, complete App suite `125/125`, full Studio Vitest `375/375`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. Evidence covers stale success and failure suppression, independent resource keys, and integration wiring for out-of-order detail/output responses. Jobs reconciliation remains immediate after retry/reconciliation mutations. No PR, CI, deploy, or live evidence is claimed.
- `PWA-PROJECT-LIST-ORDERING-04` local evidence: ordering helper `3/3`, complete App suite `124/124`, full Studio Vitest `374/374`, TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. Tests prove stale success suppression, stale failure suppression, newest failure visibility, and independent resource keys. One pre-commit run caught and prevented an accidental recursive helper implementation; the corrected implementation passed all repeated gates. No PR, CI, deploy, or live evidence is claimed.
- `PWA-JOB-PROGRESS-POLLING-03` local evidence: focused polling Vitest `7/7` plus API abort diagnostics `6/6`; full Studio Vitest `371/371`; TypeScript, full ESLint, Vite/PWA production build, lightweight repository checks, and `git diff --check` passed. Fake-timer evidence covers initial rejection, bounded exponential backoff, cadence reset, 15-second stalled-request abort, retry after timeout, reconciliation continuity, timer cleanup, in-flight abort, suppression of the exact intentional stop reason, and continued timeout-abort diagnostics. The first Vite attempt exposed an incomplete local pnpm link layout (`workbox-window` unresolved); an npm-compatible hoisted local `node_modules` layout fixed the environment without manifest/lockfile changes. No PR, CI, deploy, or live evidence is claimed.

## Archived PR #208 PWA hardening closure

PR #208 (`codex/pwa-session-bootstrap-hardening`) closed the focused PWA hardening sequence 31–47 and was merged into `main` on 2026-08-14.

- Base: `main@26ecae6e6cd0ec0c8a3fd2307b7434970c11edf4`.
- Final PR head: `62f2ea844e71071c151066c2538f6ef9e340c0bd`.
- Merge commit: `830bd00754567dfa6809e1e36bb7fcbaa145b824`.
- Functional denominator for tasks 31–47: `51/51 = 100%` (17 items × 3 equal-weight criteria).
- Exact-main repository CI run `31818095906`: `checks` success.
- Exact-main Studio run `31818095864`: `studio` and `browser-e2e` success.
- Component CD run `31818095877`: `studio-web` selected and successful; worker/API/migration jobs correctly skipped.
- VPS checkout fast-forwarded to exact merge commit, target-built/running web image identity matched, localhost `/healthz` passed, and `STUDIO_PLATFORM_WEB_DEPLOY_OK` was emitted.
- Local and remote working branches were deleted only after merge ancestry and clean synchronized `main` were verified.

The completed sequence covered bounded/latest-wins auth and collection reads, credential/diagnostics/analytics DTO boundaries, project/job recovery authority, mutation outcome invariants, focused batch review, and CI portability corrections. Detailed code/test history remains recoverable from PR #208 and its atomic commits; this archive does not duplicate raw logs.

Readiness at closure:

- project-wide percentage remained `N/A` because `docs/project-spec.md` had no single closed non-overlapping project denominator;
- Colab batch + Realtime remained `2/2 = 100%` under owner-accepted scope;
- Studio PWA Live functional contract remained `7/7 = 100%`;
- Studio PWA Live delivery Evidence remained `5/6 = 83%` because microphone-only, mixed and negative lifecycle canaries were still absent.

## Archived PR #210 product requirements baseline closure

PR #210 (`feature/product-requirements-v2`) зафиксировал owner requirements как два production-продукта, четыре runtime contour и 109 равновесных atomic AC. Он merged в `main` 2026-08-15.

- Base: `main@a252a1efa54ba952ec4eb04405fae5722f15d7b5`.
- Final PR head: `e3d4521c30effbd1baa082d4c49abf543e28146a`.
- Merge commit: `8fe0dd722d0433440b41ef6dfe0fa0489f8f8fb8`.
- Exact PR-head CI run `31842755434`: success.
- Exact-main CI run `31842984066`: success.
- Scope был docs-only; Studio path detection не запускал component CD, GitHub Deployments для revision отсутствовали, поэтому `DEPLOY` и `LIVE` были N/A.
- Baseline readiness: Colab `22/29 = 75,9%`, Studio PWA `51/80 = 63,8%`, project `73/109 = 67,0%`.
- Локальный `main` синхронизирован с exact merge commit; merged local/remote branch удалена после ancestry/clean-state проверки.
- Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`), поэтому отдельный follow-up docs-only PR не создавался; closure переносится в archive при начале следующего авторизованного scope.

## Archived PR #211 language and diagnostics closure

PR #211 (`feature/pwa-language-diagnostics`) закрыл scoped explicit-English, diagnostics-export и analytics-percentage slice и был merged в `main` 2026-08-15.

- Base: `main@8fe0dd722d0433440b41ef6dfe0fa0489f8f8fb8`.
- Final PR head: `f689ab09675ac7d899c040e05c3ed097632a74da`.
- Merge commit: `f90e0d7b3b10d345a9ea6ff34f5b8c3025d818d7`.
- Scoped completion: `5/5 = 100%`; readiness после merge: Studio PWA `56/80 = 70,0%`, project `78/109 = 71,6%`.
- Exact PR-head checks: CI run `31848205846`, Studio/browser run `31848205831` — success.
- Exact-main checks: CI run `31848408225`, Studio/browser run `31848408202` — success.
- Component CD run `31848408276`: `deploy-web` и `deploy-api` success; worker и migration jobs корректно skipped для scope.
- GitHub Deployments API record отсутствует; approved post-deploy metadata writer также отсутствует (`metadata_sync.enabled=false`). Фактический merge/CD state восстановлен в следующем authorized scope без отдельного follow-up PR.

## Archived PR #213 goal-driven repository policy closure

Goal `DOCS-GOAL-DRIVEN-01` migrated the repository policy to `goal-driven-v1` and was merged through PR #213 on 2026-08-20.

- Base: `main@f3a3f33fb0ce019c1916d95f754ed72d1d56ee01`.
- Final PR head: `4ee8f65cf6a16b9190ddedefd4024a2ca03d0978`.
- Merge commit: `3ef4a45e9e17be7ae78bd574f5e0de6f101a4b55`.
- Exact PR-head CI run `32344744575`: `checks` success.
- Exact-main CI run `32345079183`: `checks` success.
- Scope был docs-only: `DEPLOY` и `LIVE` — `N/A`; product readiness не изменилась и осталась `78/109 = 71,6%`.
- Standalone `docs/agent-delivery-workflow.md` удалён намеренно; session orchestration и Goal lifecycle теперь определяются root `AGENTS.md` и current user instruction.
- Stale active checkpoint обнаружен при начале следующей авторизованной Goal и перенесён в archive без отдельного follow-up PR.

## Archived PR #214 dependency remediation closure

Goal `SECURITY-DEPENDENCY-REMEDIATION-01` removed the current High findings from the installed Node/Python dependency graphs and was merged through PR #214 on 2026-08-20.

- Base: `main@3ef4a45e9e17be7ae78bd574f5e0de6f101a4b55`.
- Final PR head: `f53cd37ee23f8fb77f50500b2bb57937a1672e5c`.
- Merge commit: `50dff6f7401a08393137d5bd5e28162bd8df1133`.
- Fixed graph: `brace-expansion 5.0.9`, `fast-uri 3.1.5`, `nanoid 3.3.18`, `cryptography 50.0.0`; exact-main Dependency audit run `32351941880` completed with both `node` and `python` success.
- Exact-main repository CI run `32351540609` and Studio/browser CI run `32351540560` completed successfully.
- Component CD run `32351540606` deployed web and API. Worker lifecycle used status `32351708257`, graceful drain `32351908990`, manual deploy `32352024954`, and final status `32352126674`; the final running image matched the merge-SHA tag and was healthy.
- Public web/API health returned `200`; API reported reachable database and current migrations. No provider/Google transcription canary was run, so this LIVE evidence is bounded to dependency-bearing runtime health.
- Product readiness remained `78/109 = 71,6%`: the Goal changed no product AC or denominator.
- Approved post-deploy metadata writer remained absent; actual closure was reconciled at the start of the next authorized Goal without a follow-up docs-only PR. Local `main` was synchronized and the merged local/remote Goal branch was safely removed.

## Archived PR #215 arbitrary segments closure

Goal `PWA-ARBITRARY-SEGMENTS-01` generalized the segment composer from a narrow two-part case to an ordered arbitrary-`N` plan and was merged through PR #215 on 2026-08-20.

- Base: `main@50dff6f7401a08393137d5bd5e28162bd8df1133`.
- Merge commit: `919e6137ed0e806db168a43d292ab7874293549e`.
- Exact-main repository CI run `32376152400`: `checks` success.
- Exact-main Studio/browser CI run `32376152418`: `studio` and `browser-e2e` success.
- Component CD run `32376152217`: `studio-web` and `studio-api` success; worker rollout correctly `N/A` for unchanged worker runtime.
- Production API/web exact revision and health were confirmed.
- Bounded LIVE canary job `69fe73ed-8769-4806-ae35-7616594cbf13` used one reviewed short synthetic source and clip `00:01–00:05`; it completed with one `transcript_doc_v1.2` Google Docs output. Private URLs, document IDs, source metadata and transcript body are intentionally omitted.
- `PWA-SEGMENTS-01` reached `5/5 = 100%`, status `READY`, Evidence `SPEC/CODE/TEST/CI/DEPLOY/LIVE ✅`.
- The same canary exposed a separate browser-contract regression: canonical English `language_mode=en` was rejected by list/detail parsing, producing false collection/detail errors and stale `40%` while outputs already reported completion. `PB-05` was therefore corrected from ✅ to ❌ at the start of Goal `PWA-JOB-STATE-CONSISTENCY-01`; project readiness changed from `83/109` to `82/109` without denominator change.
- Approved post-deploy metadata writer remained absent (`metadata_sync.enabled=false`); closure was reconciled in the next authorized Goal rather than a follow-up docs-only PR. Local and remote merged branches were safely removed after clean synchronized `main` verification.

## Archived PR #216 job state consistency closure

Goal `PWA-JOB-STATE-CONSISTENCY-01` устранила рассинхронизацию terminal job между list, progress, detail и output UI и была merged через PR #216 2026-08-20.

- Base: `main@919e6137ed0e806db168a43d292ab7874293549e`.
- Final PR head: `ec88934f1dc730a63bcdf076e19e4639a5102938`.
- Merge commit: `ebf02da1636d9362131a1b44161cda1c68f06080`.
- Exact PR-head CI: repository run `32399832182` и Studio/browser run `32399832196` — success; conditional failure-artifact upload единственный ожидаемый skip.
- Exact-main CI: repository run `32400141331` и Studio/browser run `32400141449` — success.
- Component CD run `32400141509`: `deploy-web` и deployment summary success; API, worker и migration корректно skipped для frontend-only diff. VPS fast-forward, running image identity и localhost `/healthz` подтвердили exact merge revision; marker `STUDIO_PLATFORM_WEB_DEPLOY_OK` получен.
- Public API health подтвердил reachable database и current migrations. GitHub Deployment record для merge SHA отсутствовал.
- Fresh authorized production session повторно открыла исходную bounded canary job `69fe73ed-8769-4806-ae35-7616594cbf13`: list/card/detail одновременно показали terminal completed/`100%`, один safe Google Docs output и canonical English без ложных collection/detail errors. Второй provider job не создавался.
- `PB-05` подтверждён; readiness на closure: `PWA-BATCH-01 9/10 = 90,0%`, Studio PWA `61/80 = 76,3%`, project `83/109 = 76,1%`.
- Required Goal Evidence: `SPEC/CODE/TEST/CI/DEPLOY/LIVE ✅`. Approved post-deploy metadata writer отсутствовал; closure reconciled в начале следующей authorized Goal. Local и remote merged branches удалены после проверки ancestry и clean synchronized `main`.

## Archived PR #217 ingest metadata polish closure

Goal `PWA-INGEST-METADATA-POLISH-01` была merged через PR #217 и завершила source creation metadata, output-folder Favorites и active-source expiry boundary.

- Base: `main@ebf02da1636d9362131a1b44161cda1c68f06080`.
- Final PR head: `5e0f4f40f5cbcb6ce7b7e3edd5234be812ca0c32`.
- Merge commit: `6bcb0ed49aeb6e491765fda45bf74b6e68f7b67e`.
- Exact PR-head checks: repository run `32417379985` (`checks`) success; Studio run `32417379977` (`studio`, `browser-e2e`) success.
- Protected migration `0021_source_creation_and_folder_favorites`: run `32419734240` success.
- Worker rollout: deploy run `32419939486` success; terminal status run `32420035216` success. API/web applicable deployment gates also completed successfully; migration gate returned to closed state.
- Bounded LIVE canary persisted one favorite and created one accepted Google Docs output. Source creation metadata correctly failed closed as `Created at: unknown`, rather than substituting modified/upload/job/output time.
- PR evidence record: https://github.com/Just9120/Elevenlabs-API/pull/217#issuecomment-5362405098.
- Product readiness at closure: Studio PWA `63/80 = 78,8%`, project `85/109 = 78,0%`; `PC-11` and `PI-02` closed, while `PB-10`/`PD-06` remained open because unknown source creation time is honest but does not satisfy their full-scope requirement.
- The same LIVE session exposed a separate duplicate-state inconsistency: an accepted completed output was visible while provider authority was reported unresolved. This was not counted as a new denominator item and is addressed in the next authorized Goal.
- Required Goal Evidence: `SPEC/CODE/TEST/CI/DEPLOY/LIVE ✅`. Approved post-deploy metadata writer remained absent; closure was reconciled at the start of the next authorized Goal without a follow-up docs-only PR.

## Archived PRs #218–#221 PWA operability closure

Goal `PWA-OPERABILITY-POLISH-02` и три bounded production-preflight follow-ups были завершены и merged в `main` 2026-08-22.

- Goal implementation PR #218 merged как `1fc868847377ad059743ac4d1aa3ae0573d27507`; последующие safe diagnostics/runtime-secret validator PRs #219–#221 merged до `main@dd194c929d957e822ff618df294dc54e72d5971e`.
- Exact-main CI для финального revision: repository run `32575534468` success; Studio run `32575534462` success.
- Read-only production preflight `32575670127` success подтвердил reviewed mounted-secret validation boundary без раскрытия values.
- Manual worker deploy `32575720276` success; final worker status `32575774151` success на exact `dd194c9`.
- Protected migration `0022_account_operability`, API deployment и bounded owner LIVE validation были завершены ранее в этом chain; migration gate после release возвращён в закрытое состояние.
- Scope закрыл `PM-03`, `PO-10/11/17/18`, persistent accent и false unresolved provider-attempt defect. Archived/clear destructive paths не запускались в production.
- Approved post-deploy metadata writer отсутствовал; closure reconciled при старте следующей authorized Goal без docs-only follow-up PR.

## Archived PRs #225–#226 source-folder ingestion closure

Goal `PWA-INGEST-FOLDERS-01` завершила bounded local/Google Drive folder intake и shared target-folder semantics 2026-08-23.

- OAuth/source-folder implementation PR #225 merged как `main@17a9fc408a2d352005be08d981325c21de4d1dc0`; exact-main repository CI `32642653678`, Studio/browser CI `32642653695` и component CD `32642653667` завершились успешно.
- Runtime scope correction была доставлена API-only CD `32654826834`, job `97231852416`, marker `STUDIO_PLATFORM_API_DEPLOY_OK`; primary и maintenance OAuth grants были переподключены.
- Shared target propagation fix PR #226 имел exact head `443c61212d6f1f10efa531b34b0d4c1981d7391c` и merged как `cb3a9e9216521c56e07b6f7b6fda9bf8eb8051f8`.
- PR-head repository CI `32656908141`/job `97236994175` и Studio CI `32656908153`/jobs `97236993792`, `97236993909` — success. Exact-main repository CI `32657081954` и Studio CI `32657081982` — success.
- Web deployment run `32657081893`, job `97237430813`, достиг `STUDIO_PLATFORM_WEB_DEPLOY_OK`; target revision и running image identity соответствовали merge SHA, localhost health прошёл. API, migration и worker были корректно skipped для frontend-only diff.
- Bounded LIVE после deployment импортировал девять supported Drive files в девять composer rows. Первая verified target folder заполнила все девять ранее unassigned rows, все флаги `До конца файла` остались включены, status показал `Готово: 9 из 9`, review control был доступен. Provider job не создавался.
- Closure readiness: `PWA-INGEST-01 11/11 = 100%`, Studio PWA `83/91 = 91,2%`, project `105/120 = 87,5%`; required Evidence `SPEC/CODE/TEST/CI/DEPLOY/LIVE ✅`.
- Approved post-deploy metadata writer отсутствовал (`metadata_sync.enabled=false`), поэтому фактический closure reconciled в начале следующей authorized Goal. После проверки ancestry и clean state локальная/remote branch была удалена, `main` синхронизирован.

## Archived PR #227 timestamp authority closure

Goal `PWA-TIMESTAMP-AUTHORITY-01` закрыла canonical `PB-10` и `PD-06` и была merged через PR #227 2026-08-23.

- Base: `main@cb3a9e9216521c56e07b6f7b6fda9bf8eb8051f8`.
- Final PR head: `e83a497e5364c19eeee48146aa56ea8fa7f7ad4b`.
- Merge commit: `800bcc820529ff3c78214c129c593d182c621c62`.
- Exact PR-head required checks: repository run `32660004784` (`checks`) success; Studio/browser run `32660004726` (`studio`, `browser-e2e`) success.
- Exact-main CI: repository run `32660175995` и Studio/browser run `32660175973` — success.
- Component CD run `32660176008`: `deploy-web`, `deploy-api` и deployment summary success; migration и worker корректно skipped, потому что schema/worker не менялись.
- После explicit owner action-time approval ровно один bounded production canary `00:01–00:05` завершился `100%`, создал один persisted `transcript_doc_v1.2` Google Docs output и не запускался повторно.
- Два последовательных single-document standardization dry-run классифицировали новый документ как current standard с authoritative source creation date: `0` изменений, `1` без изменений, `0` blocked, `0` unreadable. Отдельный recursive dry-run подтвердил fail-closed blocked outcome для двух legacy документов без source authority и не выполнил mutation.
- `PWA-BATCH-01` достиг `10/10 = 100%`, `PWA-STANDARDIZATION-01` — `6/6 = 100%`; Studio PWA `85/91 = 93,4%`, project `107/120 = 89,2%`.
- Required Goal Evidence: `SPEC/CODE/TEST/CI/DEPLOY/LIVE ✅`. Safe delivery record: https://github.com/Just9120/Elevenlabs-API/pull/227#issuecomment-5388439165.
- Approved post-deploy metadata writer отсутствовал (`metadata_sync.enabled=false`); closure reconciled в начале следующей authorized Goal без docs-only follow-up PR. Local `main` был clean и синхронизирован с merge SHA; merged branch удалена local/remote.

## Archived PRs #231–#232 Colab production completion closure

Goal `COLAB-PRODUCTION-COMPLETION-01` завершила canonical Colab batch/realtime scope 2026-08-24.

- Base chain начат от `main@ebbba50a938feb2d06b2ec59e828834ff204988d`; implementation PR `#231` merged как `ceab95988b4a16f36e76134d6312a10c60d72fe5`.
- Auto-detection-default extension PR `#232` merged как `c9ac43fc71a97a868db744088c06c69882a555fa`.
- Exact PR-head CI `32738379146` и exact-main CI `32738787968` завершились success; Studio workflows корректно не запускались из-за Colab-only path filter.
- Bounded batch LIVE обработал nested local-folder fixture, создал один native Google Doc с authoritative `2026-08-01T09:10:11Z` source creation time и подтвердил document-before-manifest ordering. Повторный provider charge не выполнялся.
- Owner-controlled ordinary-Chrome realtime matrix подтвердила microphone/display/mixed, repeated start/stop, permission cancel и resource release; шесть bounded provider sessions не выявили воспроизводимого capture break.
- `COLAB-BATCH-01` достиг `23/23`, `COLAB-REALTIME-01` — `6/6`, Google Colab — `29/29`; project readiness стала `115/120 = 95,8%`.
- Colab не имеет VPS deployment unit, поэтому `DEPLOY N/A`; reviewed repository revision/launcher и manual runtime составили applicable delivery Evidence.
- Approved post-deploy metadata writer отсутствовал; closure reconciled при старте следующей authorized code-bearing Goal без отдельного docs-only PR.

## Archived PR #233 speaker identity closure

Goal `PWA-SPEAKER-IDENTITY-01` завершена 2026-08-24.

- Base: `main@c9ac43fc71a97a868db744088c06c69882a555fa`; merge commit PR `#233`: `5e4a3aae8b79f2cb69c6c2efc8282d961b0392e6`.
- Exact-main repository CI `32760830338` и Studio/browser CI `32760830386` завершились success.
- Worker drain `32762666106`, protected migration/API release `32762815131` и worker deployment `32763111064` завершились success; production schema достигла `0024_speaker_identity`.
- Bounded synthetic two-speaker LIVE завершил diarized job без повторного canary, создал два owner profiles, отдал bounded samples и persisted explicit label-to-profile assignments в exact Google Docs и History metadata.
- Required Goal Evidence: `SPEC/CODE/TEST/CI/DEPLOY/LIVE ✅`; `PWA-SPEAKER-IDENTITY-01 5/5`.
- Approved post-deploy metadata writer отсутствовал (`metadata_sync.enabled=false`), поэтому closure reconciled в начале следующей authorized code-bearing Goal. После проверки ancestry merged branch была удалена, local `main` синхронизирован с exact merge SHA.

## Archived PRs #234–#235 Audio Preparation closure

Goal `PWA-AUDIO-PREPARATION-01` завершила canonical Audio Preparation scope 2026-08-25.

- Implementation PR `#234` merged как `1751d34ce44a33b8d9f28bff8642fe8d62fe7e4c`; terminal-cleanup hotfix PR `#235` merged как current main `16badb0aa4404ae2616a3d46070925b54b043963`.
- Exact-main repository CI runs `32813529065` и `32813529090` завершились success.
- API deployment run `32813529033`, worker drain `32816893138`, worker deployment `32816951174` и terminal worker status `32818291988` завершились success; running revision identity совпала с exact main.
- Production schema достигла `0025_audio_preparation`; migration release gate после rollout возвращён в закрытое состояние.
- Bounded LIVE operation `2ad99ead-1c45-4439-8e8a-d64c2bcc3037` подтвердила preview `0:04 → 0:02`, terminal `completed · 100%`, retained reusable result и удаление ephemeral source после reload.
- Hotfix устранил production-only cleanup drift при `SessionLocal(autoflush=False)`: terminal state теперь flush-ится до readiness query.
- Required Goal Evidence: `SPEC/CODE/TEST/CI/DEPLOY/LIVE ✅`; `PWA-AUDIO-PREPARATION-01 16/16`, Studio PWA `107/107`, project `136/136`.
- Approved post-deploy metadata writer отсутствовал (`metadata_sync.enabled=false`), поэтому closure reconciled в начале следующей authorized Goal. Local `main` clean и синхронизирован, merged branches удалены.

## Archived PR #236 UX/IA polish closure

Goal `PWA-UX-IA-POLISH-01` завершена 2026-08-25.

- Base: `main@16badb0aa4404ae2616a3d46070925b54b043963`; final PR head `86232adf67d6d3fa5fe8b5a6d910ff04dd951bfd`; merge commit PR `#236`: `091e558ebe5c369486056f2ef94f67f99a459ee0`.
- Exact-head required CI завершился success: repository run `32832630083`; Studio/browser run `32832630155`.
- Exact-main CI завершился success: repository run `32832907020`; Studio/browser run `32832906999`.
- Studio Platform CD run `32832907052` развернул web и API; web job `97755369406`, API job `97755621970` завершились success с exact merge revision. Migration была N/A, worker manual-only unit не изменялся.
- Bounded authenticated LIVE после normal service-worker reload подтвердил task terminology, default-closed fragmentation, пять Settings routes, Files & Storage catalog, simplified diagnostic bundle и Audio source disclosure/terminal actions. Browser console errors не наблюдались; exact click handoff Audio → Transcriptions дополнительно покрыт automated tests, но не был повторно dispatch-нут во встроенном browser из-за CDP timeout.
- Product denominator не менялся: `PWA-AUDIO-PREPARATION-01 16/16`, Studio PWA `107/107`, project `136/136`; required Goal Evidence `SPEC/CODE/TEST/CI/DEPLOY/LIVE ✅` с указанным ограничением handoff observation.
- Approved post-deploy metadata writer отсутствовал (`metadata_sync.enabled=false`), поэтому closure reconciled в начале следующей authorized Goal без docs-only follow-up PR. Local `main` был clean и синхронизирован; merged branch удалена local/remote.

## Archived PRs #237–#243 Audio workspace production completion

Goal `PWA-AUDIO-WORKSPACE-02` завершила production UX/runtime stabilization Audio workspace и observable uploads 2026-08-26.

- Базовый implementation chain завершён PR `#237`; OBS/Matroska duration и long-running concat follow-ups доставлены через PR `#238–#242`.
- Финальный FLAC precision fix PR `#243`: head `0a01c1c3bc11ef4c0e7082caaf30e0e634d1ec35`, merge `018b560035e4ff2219c246f734216f76537875ee`.
- Required PR-head checks: repository `32899723581`, Studio/browser `32899723679` — success. Exact-main CI: repository `32900076070`, Studio/browser `32900076159` — success.
- Component CD `32900076101`, worker drain `32904910880`, deploy `32904997797` и status `32905120372` завершились success на exact merge revision; schema migration не требовалась.
- Production concat `9010f902-145b-4ef0-bfef-0416a20daeaf` подтвердил обработку трёх OBS/MKV (`137:36 → 129:48`). Финальный FLAC output `78da8f8e-dfb4-47f7-b6db-fb9a64995fb0` подтверждён как `s16`, `48 kHz`, mono, `7907.718563` секунд, `334113611` bytes (`318.64 MiB`).
- Audio и Transcriptions production uploads показали реальный per-file/aggregate progress; Transcriptions прошла стадии `16% → 22% → 30% → 34% → 51% → 74% → ready` без запуска provider job.
- Product readiness на closure: `PWA-CORE-01 14/14`, `PWA-AUDIO-PREPARATION-01 24/24`, Studio PWA `116/116`, project `145/145`; required Goal Evidence `SPEC/CODE/TEST/CI/DEPLOY/LIVE ✅`.
- Approved post-deploy metadata writer отсутствовал (`metadata_sync.enabled=false`); closure reconciled в начале следующей authorized code-bearing Goal без отдельного docs-only PR.

## Archived PR #244 source-cache/branding external-gate checkpoint

Goal `PWA-SOURCE-CACHE-01` была merged и deployed 2026-08-27, но осталась в `PENDING_EXTERNAL_GATE` из-за отсутствующего authenticated owner LIVE.

- Base chain завершён PR `#244`, merge `18cbd46e9361a66bfbc1f2265d0820aa72aedf50`.
- Exact-main repository CI `32959921859`, Studio/browser CI `32959921773` и Studio Platform CD `32959921827` — success; web deployed, API/worker/migration N/A.
- Source-cache remediation и user-visible VoiceOps Studio branding находятся в main.
- Required Goal Evidence на перенос: `SPEC/CODE/TEST/CI/DEPLOY ✅ | LIVE —`.
- Remaining external gate: удалить test source через Settings в authenticated owner session, вернуться в уже смонтированные `Транскрибации` и подтвердить authoritative list, сохранность draft и fail-closed selected source без provider call.
- Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- Explicit user instruction 2026-08-27 «ставь цель и приступай» отдельно авторизовала переход к `PWA-GOOGLE-PICKER-UX-01`; это не превращает отсутствующий source-cache LIVE в success.

## Archived PR #245 Google Picker UX delivery

Goal `PWA-GOOGLE-PICKER-UX-01` была реализована и merged через PR `#245`, после чего остановлена как `PENDING_EXTERNAL_GATE`: code, tests, exact-main CI и web deployment подтверждены, но owner-controlled authenticated LIVE исправления не зафиксировано отдельным Evidence record.

- Base: `main@18cbd46e9361a66bfbc1f2265d0820aa72aedf50`.
- Final implementation commits: `a197e39` и `60c4ec23bdd4afa6dcbff25633cdd96121b4704f`.
- Merge commit: `8761e86808e8562eff05588f6f60d15dd04dbcf4`.
- Exact PR-head repository CI `33103790793` и Studio/browser CI `33103790818`: success.
- Exact-main repository CI `33104113256` и Studio/browser CI `33104113243`: success.
- Studio Platform CD `33104113313`: web deployment success; API/migration/worker корректно не выбирались для frontend-only diff.
- Product AC: `PG-01..PG-03 = 3/3`; Evidence на archive: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE —`.
- Approved post-deploy metadata writer отсутствовал, поэтому stale pre-push checkpoint был reconciled в начале следующей explicitly authorized Goal.
- Explicit user instruction 2026-08-27 «формируй общую цель под техдолгу, документам и CI, и приступай» авторизовала переход к `REPO-HARDENING-01`; она не превращает отсутствующий Picker LIVE в success.

## Archived PRs #246–#247 repository hardening closure

Goal `REPO-HARDENING-01` завершена 2026-08-27 после bounded documentation, manifest MIME и CI-efficiency hardening.

- Основной PR `#246` merged как `5a4115aed22497c7cb5c6a4d38258dbcf27641bd`; cache-hit Playwright fast-path hotfix PR `#247` merged как `f6b0d70e751673ea4edb11c655a732d594ff8f31`.
- Финальный exact-main repository CI `33116072365` и Studio/browser CI `33116072392` завершились success; browser job занял `89s`, Studio job — `97s`.
- Representative warm PR+main runner pair сократился с baseline `874s` до `629s` (`302s + 327s`), то есть на `28,0%`, без удаления pytest, lint, unit, build, authenticated browser E2E, Compose, image, secret или non-root gates.
- Active cache был `1,81 GiB`, ниже bounded limit `4 GiB`; external actions в active workflows pinned на immutable SHA.
- Studio Platform CD `33114690923` доставил web-only manifest remediation; public `/manifest.webmanifest` вернул `200` и `Content-Type: application/manifest+json`.
- Required Goal Evidence: `SPEC/CODE/TEST/CI/DEPLOY/LIVE ✅`; product AC/denominator не менялись.
- После проверки ancestry обе созданные ветки удалены local/remote; local `main` синхронизирован с `origin/main@f6b0d70`. Approved metadata writer отсутствовал, поэтому closure reconciled в начале `SPEC-RECONCILIATION-01`.

## Archived local SPEC reconciliation

Goal `SPEC-RECONCILIATION-01` завершила read-only reconciliation exact upstream Google Doc revision 2026-08-28.

- Полный inventory: `283` source units = `275` list items + `8` narrative paragraphs.
- Атомизация подготовила `142` non-commercial, `50` cross-contour и `192` commercial AC; все `384` новых IDs уникальны.
- Independent actual-state numerator: `55/142` новых non-commercial AC; commercial/cross-contour `0/242`.
- Публикация отдельного non-canonical audit-report была остановлена safety gate; explicit owner instruction затем отказалась от report и отдельно авторизовала перенос требований в canonical `docs/project-spec.md`.
- Локальные reconciliation commits `7e6139c`, `be30f0a`, `a87b254` не публиковались отдельно; дальнейшее состояние отражает `SPEC-CANONICALIZATION-02`.

## Archived PR #248 canonical requirements closure

Goal `SPEC-CANONICALIZATION-02` завершена 2026-08-28 без публикации отдельного audit-report.

- PR `#248` head `6a817f403ece8b33d6c2a55fa6e164fbfe6099e8` merged как `baa55d695c015385ba992b87c505d1a1fc116df3`.
- Exact-head repository CI `33147462748` и exact-main CI `33147622878` завершились success, включая Alembic validation, lightweight checks и полный pytest.
- Canonical denominator стал `532`: `203/290` non-commercial и `0/242` commercial/cross-contour; full readiness `203/532 = 38,2%`.
- Separate non-canonical reconciliation report отсутствует в main и PR history. Studio CI/CD корректно не запускались по docs-only path; `DEPLOY/LIVE N/A`.
- Remote/local feature branches удалены; `main` синхронизирован с `origin/main@baa55d6`. Approved metadata writer отсутствовал, поэтому closure reconciled в начале `PWA-SESSION-CONTROL-01`.

## Archived PR #249 session-control closure

Goal `PWA-SESSION-CONTROL-01` завершена 2026-08-28 полным delivery flow.

- PR `#249` head `1267358129295cb66d6a34ae62a43136b8a3b0e4` merged как `3e80fef58f8aab94c5727a7fc7acef300fd8b099`.
- Exact PR-head repository CI `33150834580` и Studio/browser CI `33150834557` завершились success.
- Exact-main repository CI `33151098282` и Studio/browser CI `33151098265` завершились success.
- Studio Platform CD `33151098248` доставил API+web; worker и migration корректно были skipped.
- Authenticated production LIVE подтвердил current + четыре другие active sessions, три targeted revoke audit events и один bulk revoke; после reload сохранилась только current session.
- Canonical `PWASEC-07..09` выполнены; required Goal Evidence `SPEC/CODE/TEST/CI/DEPLOY/LIVE ✅`.
- После ancestry/status checks branch удалена local/remote, local `main` синхронизирован с exact merge SHA. Approved metadata writer отсутствовал, поэтому closure reconciled в начале `PWA-OBSERVABILITY-RUNTIME-01`.

## Archived PR #250 runtime observability closure

Goal `PWA-OBSERVABILITY-RUNTIME-01` завершена 2026-08-28 полным protected delivery flow.

- Base: `main@3e80fef58f8aab94c5727a7fc7acef300fd8b099`; PR `#250` merged как `6cb067d1acea09bc82b70be4c415b6babdce31b2`.
- Exact PR-head и exact-main repository/Studio/browser required CI завершились success; confirmed repository failure на initial head был исправлен одним grouped follow-up batch без speculative rerun.
- Web CD `33156427664`, protected migration/API run `33156906021` и manual worker deploy `33157220511` завершились success; final worker status `33157438236` подтвердил `running/healthy/identity_match=yes`.
- Production schema достигла `0026_runtime_component_status`; protected migration прошла `0025_audio_preparation -> 0026_runtime_component_status` с pre-migration snapshot `a8de340691e3`.
- Authenticated bounded LIVE подтвердил exact одинаковый commit SHA для web/API/worker, release `0.1.0`, exact schema `0026_runtime_component_status`, backend/PostgreSQL/queue/worker/object-storage readiness и safe STT `configured/probe=not_run`; queue была `0 queued / 0 processing`, browser console warnings/errors отсутствовали.
- Canonical `OBSERV-06`, `OBSERV-08`, `OBSERV-09`, `OBSERV-11..OBSERV-14`, `OBSERV-22`, `OBSERV-24..OBSERV-28` выполнены (`13/13`); `OBSERVABILITY-AUDIT-02 25/35`, personal PWA `185/259`, non-commercial `216/290`, full canonical `216/532`.
- Required Goal Evidence: `SPEC/CODE/TEST/CI/DEPLOY/LIVE ✅`. Approved post-deploy metadata writer отсутствовал (`metadata_sync.enabled=false`), поэтому closure reconciled в начале следующей authorized code-bearing Goal без отдельного docs-only PR.

## Archived PRs #251–#252 bounded-query closure

Goal `PWA-QUERY-BOUNDS-01` завершена 2026-08-28 полным delivery flow; web presentation defect, найденный authenticated LIVE, исправлен bounded hotfix в той же Goal.

- Base: `main@6cb067d1acea09bc82b70be4c415b6babdce31b2`; implementation PR `#251` merged как `cc4347758ebae849c963cbf11be253862c6a1402`; web-only hotfix PR `#252` merged как current main `ea92ac671a31cb70dd8f59c78561ee1e5fcf4fbe`.
- Exact PR-head и exact-main repository/Studio/browser required CI завершились success. Implementation PR runs `33166365989`/`33166365983`; post-merge runs `33166563412`/`33166563432`.
- Web deploy `33166563572`, worker drain `33166775059`, protected migration/API `33166862214`, worker deploy `33167793153` и terminal status `33168001735` завершились success; pre-migration snapshot `e73c606741e0`, schema `0027_query_bounds`.
- Authenticated LIVE подтвердил deterministic bounded pagination/cursors, exact bounded analytics shape, cleanup readiness, component identities и safe provider `probe=not_run`; первоначально обнаруженный audit-list presentation cap был устранён PR `#252` и доставлен web-only.
- Required Goal Evidence: `SPEC/CODE/TEST/CI/DEPLOY/LIVE ✅`. Goal была infrastructure/performance remediation и не меняла canonical product AC numerator/denominator: closure snapshot оставался `216/532`.
- Approved post-deploy metadata writer отсутствовал (`metadata_sync.enabled=false`), поэтому closure reconciled в начале следующей authorized code-bearing Goal. Local `main` был clean и синхронизирован с `origin/main@ea92ac67`; merged branches удалены после ancestry checks.

## Archived PRs #253–#254 transcription UX closure

Goal `PWA-TRANSCRIPTION-UX-POLISH-01` завершена 2026-08-28 полным web delivery flow без provider call.

- PR `#253` реализовал app-owned source-file/source-folder/output-folder dialogs, bounded search/pagination/current-folder behavior и явные diarization states; PR `#254` исправил обнаруженную LIVE-проверкой canonical Drive query для shared folders.
- Final repository/web revision: `main@535a015dcef211a930faefe443245ee85ace38b8`; production API/worker остались на совместимом `cc4347758ebae849c963cbf11be253862c6a1402`, schema — `0027_query_bounds`.
- Exact-main runs: repository CI `33194034264`, Studio PWA CI `33194034189`, Studio Platform CD `33194034216`; required checks и web deployment завершились success.
- Authenticated LIVE подтвердил три picker modes, folder/file search, current empty folder, shared folders/drives, modal scroll lock/release, source multi-selection `2 → 1 → 2` и обе diarization states. Transcription job/provider call не запускались.
- Canonical closure: `PG 8/8`, `PB 11/11`; readiness `222/546 = 40,7%`, personal PWA `191/272 = 70,2%`, non-commercial `222/304 = 73,0%`; required Evidence `SPEC/CODE/TEST/CI/DEPLOY/LIVE ✅`.
- После safe ancestry/status checks созданные ветки удалены local/remote, local `main` синхронизирован с exact merge SHA. Approved post-deploy metadata writer отсутствовал (`metadata_sync.enabled=false`), поэтому closure reconciled в начале следующей authorized code-bearing Goal.

## Archived PR #255 direct Drive upload closure

Goal `PWA-AUDIO-DIRECT-DRIVE-UPLOAD-01` завершена 2026-08-28 полным API+web delivery flow без provider call.

- Base: `main@535a015dcef211a930faefe443245ee85ace38b8`; PR `#255` merged squash commit `26fb497496ed2a418a12afc6b3cf081e45075e57`.
- Exact PR-head repository CI `33204929949` и Studio PWA CI `33204929954` завершились success после одного grouped follow-up fix stale E2E selector; browser job `98963445432` выполнил `12` authenticated scenarios.
- Exact-main repository CI `33205123663`, Studio PWA CI `33205123676` и Studio Platform CD `33205123712` завершились success; web и API deployed, worker и migration корректно skipped.
- Authenticated production LIVE подтвердил sidebar/hero `Подготовка аудио`, четыре accessible source tabs, app-owned target-folder picker, cancel обоих файлов, explicit safe retry, aggregate `7.74 MB / 7.74 MB`, `100%`, `2/2` verified Drive results и safe links без transcription/provider action.
- Canonical `AP-01` и `AP-25..30` выполнены; `PWA-AUDIO-PREPARATION-01 30/30`, closure readiness `228/552`, non-commercial `228/310`, personal PWA `197/278`; required Evidence `SPEC/CODE/TEST/CI/DEPLOY/LIVE ✅`.
- Feature branch удалена local/remote после проверки identical tree с `origin/main`; local `main` синхронизирован с exact merge SHA. Approved metadata writer отсутствовал (`metadata_sync.enabled=false`), поэтому closure reconciled в начале `TRANSCRIPT-DOC-STANDARD-01`.

## Current non-authority warning

If this archive conflicts with `docs/project-spec.md`, `docs/delivery-plan.md`, `docs/architecture.md`, `docs/ci-cd-rules.md`, or the current user task, treat the current documents/task as authoritative and this archive as historical context only.

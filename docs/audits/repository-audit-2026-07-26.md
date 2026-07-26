# Repository audit — 2026-07-26

This document records audit evidence, readiness scoring, and a recommended
delivery sequence. It is not a product contract and does not replace
`docs/project-spec.md`, `docs/delivery-plan.md`, `docs/ci-cd-rules.md`, or an
operator decision.

Audit baseline:

- local branch: `codex/deep-repository-audit-2026-07-26`;
- audited `main` / `origin/main`: `c02accd77f37fa09a35a3c505fcfbf6359bd7954`;
- GitHub repository: `Just9120/Elevenlabs-API`;
- audit date: 2026-07-26.

## Executive conclusion

No confirmed P0 data-loss, secret-exposure, or duplicate-provider-call defect
was found. The repository is a viable development baseline: local portable
Python, frontend lint/unit/build, and lightweight checks pass; exact-current
`main` repository and Studio CI are green; and the public PWA/API health
boundary currently responds successfully with the required security headers.

The most important conclusion is that source readiness and production
readiness are materially different:

- selected Studio v1 source/CI readiness is **96%** under the gate method below;
- selected Studio v1 production-evidence readiness is **57%**;
- the already completed bounded one-small-source canary remains **100% proven
  only for that exact scenario and validated component baseline**;
- transcript-catalog production rollout remains **20%**: source and web are
  present, while the backup, production migration `0016`, intended API rollout,
  authenticated dry-run, and separately authorized apply remain.

The previous single combined estimate of about 94–95% hides the release-limiting
production gaps. Future commit reports should carry the two readiness numbers
separately. A documentation-only commit does not increase either number.

The first local engineering batch should address deterministic browser
behavior, build-context reproducibility, worker-change detection, and
authentication/runtime hygiene before the catalog stateful rollout. No push,
merge, migration, deployment, worker change, provider call, Google mutation, or
production database mutation was performed during this audit.

## Scope and method

The audit covered:

- all source-of-truth documents named by the user and `AGENTS.md`;
- supporting processing, security, validation, and operations documents;
- the Colab batch and experimental realtime contours;
- Studio frontend, API, persistence models, migrations, worker, processing,
  diagnostics, retention, and catalog modules;
- GitHub Actions CI, dependency audit, component CD, deployment scripts,
  Dockerfiles, Compose, and public host configuration;
- current local validation and current GitHub run evidence;
- dated historical audit and delivery-plan/archive disposition.

The audit deliberately did not:

- run a paid provider request;
- authenticate to a production user account;
- read private Google Drive/Docs content;
- SSH to or mutate the VPS;
- run a migration, backup, deployment, worker operation, or canary;
- run the stable or realtime notebook in Google Colab;
- inspect or print secret values.

### Stage self-review — scope

The audit distinguishes repository source, automated verification, deployment
identity, database revision, worker identity, public health, and controlled
external-effect evidence. Public health does not prove repository-head equality,
and a green CD workflow does not prove that skipped components were deployed.
The lack of a production SSH inspection is recorded as uncertainty rather than
silently converted into a pass or failure.

## Baseline evidence

| Evidence | Result | Interpretation |
| --- | --- | --- |
| Git baseline | Clean `main`, `origin/main`, and audit branch start at `c02accd`; ahead/behind `0/0` before audit edits | Reliable comparison baseline |
| Repository inventory | 241 tracked/searchable repository files; 130 Python, 34 TypeScript, 29 TSX, 14 Markdown; 16 Alembic migrations through `0016_transcript_catalog_entries` | Two mature but differently shaped contours |
| Documentation | 14 Markdown documents, about 3,182 lines; no broken relative Markdown links found | Link topology is healthy; status duplication is the larger issue |
| Lightweight checks | `scripts/ci_checks.py` passed all checks | Notebook/source/logging/temp-cleanup guards pass |
| Portable Python | 788 passed, 6 skipped in 14.20 seconds | Strong local cross-platform source evidence |
| Frontend | ESLint passed; 285 Vitest tests passed; TypeScript build and Vite production build passed | Current unit/component/build baseline is green |
| Browser discovery | 9 authenticated Playwright scenarios discovered | Suite topology is present; local service-backed execution was not claimed |
| Exact-main CI | CI run `30207923222` and Studio run `30207923262` passed at `c02accd`; Studio passed both `studio` and `browser-e2e` jobs | Current GitHub main is green |
| Flake evidence | Studio run `30202031078` failed the first browser scenario at `625cd33`; `c02accd` later passed with no application-code change | The project-create race remains latent despite a later green run |
| Dependency audit | Exact-revision run `30175970003` passed Python and Node; audited lock/constraint files are unchanged through `c02accd` | No current known-advisory release blocker from that dependency graph |
| Latest component CD | Run `30202031076` deployed web successfully at `625cd33`, skipped API with `manual_migration_required`, and skipped worker with `manual_only` | Green workflow, but only web has evidence from that run |
| Public web | `200`; CSP, HSTS, `nosniff`, no-referrer, restrictive permissions, and framing denial present | Public edge/header boundary currently responds as documented |
| Public API | `{"ok":true,"database":"reachable","migrations":"current"}` | Deployed API and its database agree with each other, not necessarily with repository head |
| GitHub work queue | No open pull requests or issues found during the audit | `docs/delivery-plan.md` is the active backlog authority |

Current maintainability concentrations:

| File | Approximate size | Audit interpretation |
| --- | ---: | --- |
| `elevenlabs_api.py` | 8,984 lines | Stable Colab baseline; freeze against opportunistic refactoring |
| `apps/studio/src/App.test.tsx` | 8,549 lines | Test ownership/concurrency hotspot |
| `apps/studio/src/App.tsx` | 4,090 lines | Frontend state/navigation coupling hotspot |
| `tests/test_studio_api_core.py` | 4,810 lines | API fixture and refactor-coupling hotspot |
| `tests/test_text_processing_helpers.py` | 4,008 lines | Stable batch regression concentration |
| `apps/studio-api/studio_api/main.py` | 1,397 lines | HTTP/router/model coupling hotspot |

### Stage self-review — baseline

Large files are treated as maintainability signals, not proof of defects.
Likewise, a Windows shell/tooling limitation is not treated as product failure.
The current GitHub browser pass is retained as factual evidence, while the prior
same-code failure prevents the audit from calling that scenario deterministic.

## Findings

### P1 — release and runtime blockers

#### 1. Project-create navigation has a confirmed timing race

`ProjectsPage` defers a requested `browse` action while `/projects` is loading.
The page-level `Новый проект` button toggles only local `createOpen`. If the user
clicks it before the projects request finishes, the still-pending `browse`
action later closes the form. The unit test exercises the settled path and does
not delay `/projects`.

Evidence:

- `apps/studio/src/App.tsx`: `requestedProjectsView`, the loading guard, and
  local `setCreateOpen` button action;
- `apps/studio/e2e/authenticated-workflow.spec.ts`: first scenario clicks the
  page button immediately;
- GitHub run `30202031078`: timed out waiting for the project title field;
- GitHub run `30207923262`: passed after documentation-only commits, proving
  intermittency rather than a code fix.

Required exit: explicit create wins over stale browse intent, a delayed-projects
regression test passes, and the exact changed revision passes authenticated
Chromium repeatedly enough to demonstrate the race is removed.

#### 2. Docker build contexts are not isolated

Neither `apps/studio` nor `apps/studio-api` has a `.dockerignore`.
The frontend Dockerfile runs container `npm ci`, then `COPY . .`. In the current
local checkout the build context can include 19,903 `node_modules` files
totalling about 174 MB, plus generated `dist`, test results, and TypeScript build
state. GitHub CI also runs host `npm ci` before `docker build`, so the same
ordering can merge host-platform modules into the Alpine build stage.

This is a reproducibility, context-size, and future secret-artifact boundary
problem even though current Linux CI happens to pass.

Required exit: narrow `.dockerignore` files, a regression assertion for excluded
artifacts, green image builds, and no required source omitted from either
context.

#### 3. Worker change detection misses shared worker dependencies

Component CD labels worker source changes only for `worker.py` and
`worker_health.py`. The worker imports shared Studio API orchestration,
provider, catalog, storage, credential, lease, diagnostics, and configuration
modules. A change to those modules can deploy the API while the CD summary still
reports worker `manual_only`, not `manual_only_source_changed`.

The worker must remain manual-only. The defect is missing operator visibility,
not a request for automatic worker deployment.

Required exit: a conservative dependency/path contract, workflow tests for
representative shared modules, and an explicit manual-worker-review reason
without broadening deployment authority.

#### 4. Production client-IP trust is unverified

Nginx sends `X-Forwarded-For`, but Compose does not set
`STUDIO_TRUSTED_PROXY_IP`; the API default is `127.0.0.1`. A request forwarded
through Docker commonly reaches the container from a bridge/gateway address.
If that is true here, login throttling keys use one proxy peer instead of the
real client IP. Five failed attempts against one email could then throttle that
email globally from all clients.

This is a production configuration risk, not a confirmed live defect, because
the audit did not inspect the actual peer address on the VPS.

Required exit: read-only, secret-free peer evidence; an exact trusted-proxy
configuration that cannot trust arbitrary forwarded headers; unit/config tests;
and a separately authorized API deployment/verification if a change is needed.

#### 5. Catalog rollout is intentionally incomplete

Repository head is `0016_transcript_catalog_entries`, while production is
operator-evidenced through `0015_user_source_retention`. The web UI is deployed;
the intended API, migration, authenticated approved-folder dry-run, and apply
are not.

This is a planned fail-closed boundary, not a broken health endpoint. It remains
a release blocker for catalog production claims.

### P2 — important hardening and maintainability

#### Documentation authority drift and history accumulation

- `README.md`, `docs/architecture.md`, `docs/delivery-plan.md`, and
  `docs/project-spec.md` still describe exact-main browser CI as red, while
  current exact-main CI is green without a race fix.
- `SECURITY.md` says Studio is not confirmed production-live, while the bounded
  small-source core has a completed controlled canary. The whole selected-v1
  contour is not production-ready; the bounded core is production-live.
- `docs/runbooks/studio-platform-ops.md` says the controlled canary is still
  not run, which conflicts with the current product/delivery evidence.
- The same runbook numbers two bootstrap steps as `7`.
- `docs/delivery-plan.md` is about 40 KB and retains completed Gates 0–7,
  detailed run chains, and long historical validation notes despite its compact
  dashboard role.
- `docs/ai-coding-workflow.md` is 619 lines and repeats source priority, focused
  task, documentation, CI/CD, and done rules already routed by `AGENTS.md` and
  dedicated contracts.
- Volatile SHAs, run results, and current rollout statements appear in
  `docs/project-spec.md` and `docs/architecture.md`, causing predictable drift.

`docs/project-spec.md` was not edited by this audit. Moving its volatile status
text or changing durable scope requires explicit user approval.

#### Auth state has no general retention cleanup

Expired/used `login_contexts`, expired/used `google_oauth_states`, and
expired/revoked sessions have indexed timestamps but no discovered purge path.
Over time these tables can grow without a stated privacy/retention boundary.

#### Session reads write on every authenticated request

`current_session` updates `last_seen_at` and commits on every authenticated
request. The frontend polls progress every five seconds while work is active,
so a read-heavy user can create persistent PostgreSQL write/WAL and row-contention
pressure. Throttling the timestamp update preserves the feature without turning
every read into a write.

#### Rate-limit increment/expiry is non-atomic

Redis `INCR` and `EXPIRE` are separate commands. A process interruption between
them can leave a key without TTL. `bootstrap-status` also uses one global key,
allowing unrelated clients to consume the shared allowance.

#### Container/runtime reproducibility and least privilege are incomplete

Base images use mutable tags (`python:3.11-slim`, `node:22-alpine`,
`nginx:1.27-alpine`, `postgres:17`, `redis:7-alpine`). Containers run with image
defaults and no explicit non-root user, capability drop, read-only filesystem,
or resource policy. Loopback-only web/API publication and secret files are good
mitigations, but rebuild inputs and least privilege remain incomplete.

#### CSRF retry classification is broader than the server contract

The frontend retries every mutation once after any `401`, `403`, or `419`,
although only explicit same-origin/CSRF rejection should qualify. Current catalog
domain/Google errors map to other statuses and apply is designed to converge
idempotently, so no duplicate catalog mutation was confirmed. Narrowing the
classification to a stable safe error reason would reduce future coupling.

#### Frontend/API monoliths increase regression cost

`App.tsx` and `main.py` have useful extracted domain modules, but navigation,
session, project preparation, diagnostics, and large fixture surfaces remain
coupled. Refactoring should follow behavior boundaries with fixture-preserving
tests, never a broad rewrite.

### P3 — cleanup candidates requiring authority checks

- Two deprecated compatibility endpoints remain:
  `POST /api/projects/{project_id}/sources/google-drive` and
  `POST /api/projects/{project_id}/jobs`. They are hardened and tested; removal
  still requires external-consumer review.
- `studio_api/source_cleanup.py` is a legacy wrapper used by the CLI path while
  the worker uses `source_deletion.run_one_source_cleanup` directly. Confirm
  operator use before removal or consolidation.
- The frontend lock contains three deprecated transitive packages. The exact
  dependency audit is green, so these are maintenance signals rather than a
  current vulnerability blocker.
- Empty tracked `studio_api/__init__.py` and
  `deploy/studio/optional-empty-secret` are intentional functional files, not
  junk.

### Stage self-review — findings

The audit did not label compatibility code as dead merely because it is old or
deprecated. Removal requires usage authority. Potential trusted-proxy behavior
is explicitly marked unverified. The generic CSRF retry was traced through the
catalog route and exception mapping before being downgraded from a suspected
critical duplicate-side-effect issue to a P2 contract-hardening item.

## Documentation disposition

| Document/surface | Disposition |
| --- | --- |
| `README.md` | Keep as short entrypoint; remove exact run/SHA status in favor of a current dashboard pointer |
| `AGENTS.md` | Keep as the lightweight agent router |
| `docs/project-spec.md` | Keep as durable product authority; with explicit user approval, move volatile run/SHA/current-rollout text to delivery plan |
| `docs/delivery-plan.md` | Compact to active, next, near backlog, blockers, current evidence, and readiness tuple |
| `docs/delivery-plan-archive.md` | Move completed Gates 0–7, long PR/run chains, and superseded validation narrative here during a focused archive commit |
| `docs/ai-coding-workflow.md` | Keep but reduce duplication with `AGENTS.md` and `docs/ci-cd-rules.md` in a focused docs task |
| `docs/ci-cd-rules.md` | Keep unchanged unless an explicit safety/blocker decision requires an update |
| `docs/architecture.md` | Keep component/data-flow map; replace volatile deployment SHAs with a delivery-plan pointer |
| `docs/studio-processing-contract.md` | Keep separate as processing invariant authority; collapse exact duplicate prose by linking to one owner |
| `docs/runbooks/studio-platform-ops.md` | Keep; correct stale canary status and duplicate numbering, but do not merge operator procedure into product/architecture docs |
| `docs/runbooks/validation.md` | Keep as unified validation command/checklist owner |
| `SECURITY.md` | Keep; distinguish bounded production-live core from incomplete whole-contour readiness |
| `docs/runbooks/repository-audit-2026-07-21.md` | Preserve as dated evidence, then move under `docs/audits/` when references are updated; do not merge old percentages into current authority |
| Optional Context Bundle Builder / AI delivery plan docs | Correctly absent; do not create without a real requested workstream |

No current document is safe to delete immediately without either moving unique
historical evidence or confirming external/operator use. The cleanup target is
authority compaction, not indiscriminate deletion.

## Architecture assessment

### Strong boundaries

- PostgreSQL, not Redis, is durable job/lease/output/reconciliation authority.
- Provider attempts and Google output uncertainty fail closed.
- Owner scoping, encrypted BYOK/Google tokens, minimal browser DTOs, and safe
  diagnostics are consistently implemented and heavily tested.
- Local source deletion and retention use durable cleanup state and fencing.
- Worker deployment is manual-only and standard CD does not run migrations.
- Component deploy scripts verify clean/fast-forward checkout, image identity,
  schema compatibility, health, and bounded component selection.
- The one-time catalog apply performs non-mutating preflight, in-place
  standardization, idempotent metadata convergence, and safe error mapping.

### Architectural pressure points

- Browser navigation intent and page-local state have no single event authority.
- API routing/auth/session/domain functions remain concentrated in `main.py`.
- One API image supplies both API and worker runtime, while CD change detection
  models them as if worker dependencies were only two files.
- Deployment reproducibility is stronger for application dependencies than for
  Docker contexts/base images.
- Operational auth retention/client-IP trust is less explicit than product
  ownership and credential safety.
- Production evidence is one-worker and one-small-source; concurrency and
  selected-mode behavior remain unproven.

### Stage self-review — architecture

The architecture is not characterized as fundamentally broken. Its strongest
property is fail-closed state/side-effect handling. The priority is to remove
specific authority and reproducibility gaps without weakening worker,
migration, or provider/Google safety boundaries.

## Readiness scoring

The score is evidence coverage, not a probability or delivery-date forecast.

Source/CI uses four equal gates:

1. current contract/design is resolved;
2. source implementation is present;
3. targeted automated evidence passes;
4. relevant exact-main CI passes.

Production/operations uses only applicable gates drawn from:

1. schema/config prerequisite;
2. intended deployed component identity;
3. intended worker identity/health;
4. authenticated/public functional evidence;
5. controlled real external-effect canary.

A partial gate contributes one half. The fraction is shown so the percentage can
be reproduced and revised when evidence changes.

| Contour/epic | Source/CI | Production/operations | Evidence boundary |
| --- | ---: | ---: | --- |
| Stable Colab batch | **4/4 = 100%** | **4/4 = 100%** | Accepted operational baseline; manual Colab validation remains the runtime authority |
| Realtime Colab experiment | **4/4 = 100%** | **1/4 = 25%** | Source/static guards exist; no accepted manual realtime runtime evidence in this audit |
| Studio auth, ownership, privacy | **3.5/4 = 88%** | **3/4 = 75%** | Core controls pass; trusted-proxy and auth-retention boundaries remain |
| Projects, sources, credentials, Picker | **4/4 = 100%** | **4/5 = 80%** | Authenticated preparation/Picker/local-upload evidence exists; broader processing is separate |
| Jobs, leases, worker, retry, reconciliation | **4/4 = 100%** | **3/5 = 60%** | Strong source/E2E; one worker/canary, stale source identity, no retained rollback candidate |
| ElevenLabs to Google Docs bounded core | **4/4 = 100%** | **4/5 = 80%** | One exactly-one-output canary; arbitrary failures/broader load are not proven |
| Language auto-detect and diarization | **4/4 = 100%** | **2/5 = 40%** | Source and automated evidence complete; dedicated live canaries absent |
| Video and long-media preparation | **4/4 = 100%** | **2/5 = 40%** | Source and automated evidence complete; dedicated live canaries absent |
| Local/Picker multi-source processing | **4/4 = 100%** | **2/5 = 40%** | Intake source/tests complete; no controlled multi-source processing canary |
| Preflight, progress, analytics | **4/4 = 100%** | **3/5 = 60%** | Deployed baseline and safe UI evidence; selected-mode production coverage incomplete |
| Transcript catalog migration/duplicate authority | **4/4 = 100%** | **1/5 = 20%** | Source and web present; backup/schema/API/dry-run/apply gates remain |
| Continuous Drive-backed catalog sync | **0.5/4 = 13%** | **0/5 = 0%** | Desired but explicitly deferred; system-of-record/design unresolved |
| Frontend UX/modularization | **3/4 = 75%** | **3/4 = 75%** | Broad usable UI; confirmed race and large coupled state/test surfaces |
| Authenticated browser E2E foundation | **3.5/4 = 88%** | **N/A** | Nine scenarios; same-code fail/pass means stability gate is partial |
| CI/CD, dependency, build reproducibility | **3/4 = 75%** | **3/4 = 75%** | CI/CD works; Docker contexts/base images and worker detection remain |
| Deprecated API authority | **3/4 = 75%** | **1/3 = 33%** | Endpoints hardened/deprecated; consumer decision and removal/support contract absent |
| Diagnostics, source retention/cleanup | **3.5/4 = 88%** | **3/4 = 75%** | Durable source path; broader cleanup outcome and auth-row retention evidence incomplete |
| Deferred Studio OpenAI/keyterms/manual editing | **0/4 = 0%** | **N/A** | Intentionally outside current selected scope; not counted against selected-v1 average |

Selected Studio v1 aggregate:

- source/CI: **96%** average across required selected-v1 source epics;
- production evidence: **57%** average across applicable selected-v1 rollout
  epics;
- bounded historical small-source canary: **100% of its explicit scenario
  gates**, without generalizing to the selected-v1 scope;
- catalog rollout: **20%**.

### Stage self-review — readiness

The scoring denominator is visible and intentionally refuses to blend source
and production into one optimistic number. Equal gates do not express business
value or incident probability. A future task should change a score only by
adding/removing named evidence, never by intuition. The audit documentation
commit leaves all values unchanged versus `main`.

## Recommended 12-task local batch

Each item should be one focused task and one commit unless investigation proves
that it must be split. Do not push merely to reach a commit count, and do not
combine production operator actions with the source batch.

1. `AUDIT-BASELINE-2026-07-26` — record this audit and reconcile the current
   dashboard without changing product/runtime code.
2. `PWA-PROJECT-CREATE-NAVIGATION-RACE-01` — make explicit create supersede
   pending browse; add a delayed-load regression test.
3. `PWA-DOCKER-CONTEXT-01` — add minimal frontend/API `.dockerignore` files and
   context-contract tests.
4. `PWA-WORKER-CHANGE-DETECTION-01` — flag representative shared worker
   dependencies as manual worker review, never automatic deployment.
5. `PWA-TRUSTED-PROXY-01` — obtain read-only peer evidence, then implement only
   the exact trusted-hop/config/test correction that evidence supports.
6. `PWA-RATE-LIMIT-ATOMICITY-01` — make increment/expiry atomic and scope the
   bootstrap-status allowance without weakening login protection.
7. `PWA-SESSION-LAST-SEEN-01` — throttle durable `last_seen_at` updates and prove
   session expiry/revocation semantics remain unchanged.
8. `PWA-AUTH-RETENTION-01` — define and implement bounded cleanup for expired or
   consumed login/OAuth/session rows with migration/ops impact reviewed first.
9. `PWA-CSRF-RETRY-CONTRACT-01` — retry only a stable explicit CSRF rejection;
   cover ordinary `401/403` and mutation scenarios.
10. `PWA-CONTAINER-REPRODUCIBILITY-02` — pin reviewed base-image inputs and add
    least-privilege changes in small component-specific slices.
11. `PWA-FRONTEND-MODULARIZATION-03` — extract one preparation/navigation
    boundary and matching tests without a broad UI rewrite.
12. `DOCS-AUTHORITY-COMPACTION-03` — archive completed Gates 0–7/status chains,
    correct stale status, and reduce workflow duplication. Any
    `docs/project-spec.md` edit requires explicit user approval.

Items 5, 8, and 10 may require new evidence or a narrower split before editing.
That is a planning dependency, not permission to change production.

## Batch and release pipeline

For every task/commit:

1. verify branch, clean tree, and `main...HEAD`;
2. state scope, non-goals, source authorities, and acceptance test;
3. implement the smallest safe change;
4. run focused checks plus the relevant wider gate;
5. review the complete diff for secrets, scope creep, and state/side-effect
   safety;
6. commit once;
7. report commit, validation, `main...HEAD`, and the readiness tuple. A
   docs/test-only commit normally leaves production readiness unchanged.

After 10–15 coherent commits:

1. run the full portable Python and frontend gates, lightweight checks,
   `git diff --check`, link checks, Playwright discovery, and all focused tests;
2. review every commit and the entire `main...HEAD` diff;
3. push the batch branch and open a draft PR;
4. wait for repository, Studio, browser E2E, and applicable dependency checks;
5. fix failures with focused commits and reassess readiness;
6. mark the PR ready only when the exact head is green and the diff remains in
   scope;
7. report whether merge is safe; merge remains a user-authorized action;
8. after merge, verify post-merge CI and component CD job-by-job;
9. fast-forward local `main`, close the branch lifecycle, and start the next
   `codex/` branch.

Catalog production rollout remains a separate operator pipeline after a green
merged source baseline:

**read-only preflight → explicit authorization → tagged backup → manual
`0016` migration → intended API deployment/identity/health → authenticated
approved-folder dry-run → separate apply authorization → one bounded apply →
post-apply stabilization**

No failure in that sequence authorizes an automatic migration, retry, worker
rollout, provider call, or repeated Google side effect.

### Stage self-review — roadmap

The sequence puts deterministic CI and build/deploy observability before a
stateful rollout. It preserves manual-only worker and migration boundaries.
Potential runtime configuration work stops at read-only evidence until the
exact production topology is known. The roadmap does not treat deferred product
scope as an implementation defect or authorize merge/deployment.

## Immediate decision

The next coding task should be
`PWA-PROJECT-CREATE-NAVIGATION-RACE-01`. The next infrastructure task should be
`PWA-DOCKER-CONTEXT-01`. Catalog production rollout should wait until those
source risks and the worker-change visibility gap are cleared through a green
PR/merge cycle.

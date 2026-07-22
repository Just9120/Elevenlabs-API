# Repository audit — 2026-07-21

This document records audit evidence and recommendations. It is not a product contract and does not replace `docs/project-spec.md`, `docs/delivery-plan.md`, or the CI/CD safety contract.

## Executive summary

- The repository is healthy enough to continue development: the audited branch started clean at `6ee51994de90bbfe7852cf1bd7618397b00e52b3`, local lightweight checks passed, Studio frontend lint/tests/build passed, and GitHub CI passed for the same `main` revision.
- The latest `main` revision is not deployed successfully. GitHub run `29815613081` failed because the CD workflow executed the new component deploy script against the old server checkout. The script required `worker_health.py` before it fast-forwarded the checkout that contained that file.
- The stable Colab batch contour should remain frozen except for explicit maintenance. Its main risk is maintainability and dependency/runtime drift, not a demonstrated functional regression.
- The Studio PWA has broad source-level implementation but limited production evidence. Estimated combined delivery readiness is **63% (uncertainty ±5 percentage points)**. Source breadth is approximately 75–80%; production readiness is materially lower because CD, dependency security, end-to-end evidence, parity, and rollout remain incomplete.
- Several current documents lag the code. The active delivery item is already merged; README and project-spec still call source-complete retry, heartbeat, reconciliation, and source deletion unfinished in some sections.
- Two browser contracts conflict with implemented architecture: Google Picker receives a short-lived OAuth access token, and direct local upload receives a short-lived presigned PUT URL. These may be valid narrow exceptions, but the current product contract prohibits both without exception.
- The largest cleanup opportunity is a legacy Studio contour: static demo UI, permissive pre-Picker endpoints, and stateless/manual deployment scripts coexist with the current platform path.

## Scope and method

The audit covered:

- all current source-of-truth documents named in `AGENTS.md` and the user brief;
- subordinate contracts, runbooks, historical pointers, workflows, and deployment scripts;
- the Colab launchers, batch implementation shape, realtime implementation, and their tests;
- Studio frontend, API routes/models/migrations, processing/worker modules, source lifecycle, and deployment shape;
- local repository checks, Python tests, frontend lint/tests/build, dependency audits, and the latest GitHub CI/CD result.

The audit did not:

- execute a paid provider request;
- run a Google OAuth/Drive/Docs production flow;
- deploy, migrate, restart, or otherwise mutate production;
- run the Colab notebook in a live Google Colab runtime;
- print or inspect secret values.

### Stage self-review: audit baseline

The findings distinguish repository evidence from runtime evidence. A passing source test is not treated as proof of production readiness, while Windows-only tool failures are not treated as product defects. The audit can still miss behavior that exists only in external infrastructure or undocumented operator practice.

## Repository baseline and validation evidence

| Check | Result | Interpretation |
| --- | --- | --- |
| Working tree and remote | Clean `main`, equal to `origin/main`; audit branch created from full SHA `6ee51994de90bbfe7852cf1bd7618397b00e52b3` | Reliable audit baseline |
| `python scripts/ci_checks.py` | Passed all 7 checks | Repository/static and notebook hygiene passed |
| Studio `npm ci` | Passed from committed lockfile | Reproducible frontend install succeeded |
| Studio lint | Passed | No current ESLint failure |
| Studio tests | 114 passed | Frontend unit/component suite is green |
| Studio typecheck/build | Passed | TypeScript and production Vite/PWA build are green |
| Alembic heads | One head: `0014_source_deletion_retention` | Migration graph has one current head |
| Full local `pytest -q` | 620 passed, 1 skipped, 46 failed, 131 errors | Not a clean Windows/local result; see classification below |
| GitHub CI for audited `main` | Passed | PostgreSQL/Redis CI environment passed the repository suite |
| GitHub Studio PWA CI for audited `main` | Passed | Frontend/build/container checks passed remotely |
| GitHub Studio Platform CD for audited `main` | Failed | Latest source is not successfully deployed |

Local Python failures were classified as follows:

- 131 setup errors require the PostgreSQL service used by `tests/test_studio_api_core.py`; no local service was running.
- Most remaining failures invoke `bash` deployment/backup/worker scripts, which is unavailable in the audited Windows shell.
- One test is genuinely nondeterministic: `test_audit_source_lifecycle_metadata_contract` orders rows by timestamps and random UUID IDs, then assumes insertion order. It should select rows by event type/metadata or set deterministic order values.

The local remediation adds an opt-in `pytest --portable` profile that excludes the PostgreSQL/Redis and bash integration modules before collection/import. Plain `pytest` and GitHub CI remain full-suite gates.

Dependency evidence:

- `npm audit` reported 6 frontend-development dependency findings: 2 low, 1 moderate, 2 high, and 1 critical. Direct affected tools include Vite, Vitest, and ESLint. The critical Vitest report concerns the development/test server rather than the shipped browser bundle, but it still affects developer and CI safety.
- `pip-audit -r requirements-dev.txt` reported 20 advisories across three pinned packages: `cryptography==44.0.0`, `python-multipart==0.0.19`, and the resolved `starlette==0.41.3`.
- `pytest` and Colab dependencies are not fully pinned, and Python transitive dependencies have no committed lock/constraints artifact. CI behavior can drift without a repository change.

Remediation refresh on 2026-07-21 found 18 Node advisories after the registry database had advanced, including two critical Vitest findings. A focused upgrade to Vite 6.4.3, Vitest 3.2.6, vite-plugin-pwa 1.3.0, and compatible ESLint tooling reduced the current npm audit result to zero without changing React, TypeScript, or runtime UI dependencies. Python remediation then pinned FastAPI 0.139.2 with Starlette 1.3.1 and cryptography 48.0.1, removed the unused `python-multipart` package, and added `httpx2` only for the Starlette test client. The refreshed pip audit also reports zero known vulnerabilities. Committed pip-tools constraints now bound Studio Docker and repository-CI transitive resolution without changing the standalone Colab install. A separate scheduled/manual workflow now audits the npm lock and an installed Linux/Python 3.11 graph without adding advisory-service calls to ordinary CI; its first GitHub execution remains unproven.

The local remediation batch now also contains a deterministic API/worker processing E2E. It creates the authenticated preparation state through public API routes, runs the real PostgreSQL-backed claim/orchestration/output persistence path, and verifies the safe output API while injecting controlled storage, ElevenLabs, and Google boundaries. Local collection and static checks pass, but the test is skipped without PostgreSQL/Redis and therefore remains pending service-backed GitHub CI. Browser automation and the production canary remain separate gaps.

### Stage self-review: validation

The failed local total is not reported as a blanket regression because GitHub's service-backed CI passed the same revision. Conversely, green GitHub CI does not override the confirmed CD failure or dependency advisories. Dependency counts are point-in-time audit evidence and must be refreshed during the upgrade task.

## Documentation audit

### Confirmed drift and contradictions

1. `docs/delivery-plan.md` still described `PWA-SOURCE-DELETION-01` as the focused unimplemented item, although PR #174 is merged and migration `0014_source_deletion_retention`, code, and tests are present.
2. `README.md` says retry/recovery, bounded lease heartbeat, and automated output reconciliation remain unfinished. Those capabilities are source-complete; production rollout evidence remains unfinished.
3. `docs/project-spec.md` lists retry/recovery twice in the unfinished list. It also lists reconciliation, heartbeat, retry/recovery, and source deletion as unfinished/backlog without consistently distinguishing source completion from rollout completion, while later sections describe them as implemented.
4. `docs/studio-processing-contract.md` says there is no safe stage-specific retry/recovery system, then immediately defines the implemented safe retry/recovery contract.
5. `.github/workflows/studio-ci.yml` watches nonexistent `docs/runbooks/studio-deploy.md` paths instead of the current runbook paths.
6. `SECURITY.md` remains Colab-first and does not adequately route Studio/PWA security reporting and boundaries.

### Consolidation decisions recommended

| Document | Recommendation | Reason and prerequisite |
| --- | --- | --- |
| `docs/provider-transcription-contract.md` | Fold unique provider details into `docs/project-spec.md`, then delete | It is almost entirely duplicated by the product spec. Update explicit test references in the same task. |
| `VALIDATION_MATRIX.md` | Move its small realtime compatibility note to the realtime runbook, then delete | The file is a historical pointer to `docs/runbooks/validation.md`. Update explicit test references and check for external links first. |
| `SECURITY.md` | Keep, but rewrite as the GitHub-standard security entry point | It should cover reporting/support and route durable Colab, Studio, secrets, browser, and deploy rules to their authorities. |
| `docs/delivery-plan-archive.md` | Keep separate and read only for archive/reconciliation tasks | It is compact, historical, and follows the intended authority model. |
| `docs/studio-processing-contract.md` | Keep separate; correct stale limitations | Its processing invariants are specialized and materially useful. |
| `docs/runbooks/studio-platform-ops.md` | Keep; consider a future split only if operator navigation becomes difficult | It is long but contains real operational contracts, not obsolete prose. |
| `docs/ai-coding-workflow.md` | Keep as authority; simplify duplication only in a dedicated workflow task | Its size is a maintenance concern, but collapsing it during product cleanup would mix scopes. |
| Optional Context Bundle Builder / AI infrastructure plans | Do not create | No corresponding workstream exists in the audited repository. |

### Stage self-review: documentation

Deletion recommendations are based on duplicated or pointer-only content, not file age. Standard entry points, specialized contracts, current runbooks, and the delivery archive are intentionally retained. External inbound links are not visible from repository search, so deletion tasks need a final link check before removal.

## Colab contour

### Current assessment

The batch Colab contour matches the user's stable-baseline description and should be treated as **100% complete for current accepted operation**, subject to the user's existing live evidence. This audit found no source-level reason to reopen that product scope.

The repository nevertheless contains maintainability risks:

- `elevenlabs_api.py` is approximately 8,984 lines and combines UI, providers, Drive/Docs, manifest migration, analytics, segmentation, and orchestration.
- `tests/test_text_processing_helpers.py` is approximately 3,096 lines and often extracts code/AST fragments because importing the main notebook-oriented module has runtime side effects.
- Legacy `_transcription_state` and document-standardization compatibility code is deliberate migration support, not junk. It must not be removed without data reconciliation evidence.
- Unpinned Colab dependencies can drift in a hosted runtime despite unchanged repository source.

Recommended policy:

- freeze product behavior and avoid opportunistic refactors;
- keep the Colab launcher and manifest behavior stable;
- if future Colab work is explicitly requested, first add characterization/golden tests, then extract pure helpers one boundary at a time without changing the launcher API;
- capture tested dependency constraints only together with a manual Colab smoke test;
- treat `elevenlabs_realtime.py` and `notebooks/elevenlabs_realtime_colab.ipynb` as a separate experimental contour. Current documentation does not call realtime production-ready.

### Stage self-review: Colab

The 100% statement applies only to the accepted batch contour and relies partly on the user's months of live operation. No paid or live Colab execution was performed in this audit. File size alone is not used as justification to disturb the stable implementation.

## Studio PWA audit

### What is already implemented

- authenticated sessions, CSRF and same-origin checks, owner-scoped data access, and Argon2id identities;
- encrypted versioned BYOK credentials and server-side Google refresh-token storage;
- projects, Google Picker/Drive sources, direct local upload, source deletion/retention/cleanup, and migrations;
- idempotent batch creation, persisted jobs and job-source relations, cancellation, bounded leases and heartbeat;
- source availability checks, ElevenLabs provider execution, Google Docs output persistence, explicit output reconciliation, retry/recovery, diagnostics, and worker operations;
- PWA shell, project/preparation/settings/diagnostics UI, service worker, tests, Docker definitions, and guarded component deployment scripts.

### High-priority correctness and delivery gaps

#### P0 — current CD executes new code against an old checkout

The workflow fetches `origin/main`, extracts the new `deploy_studio_platform_component.sh` into a temporary file, and executes it before the server working tree is updated. The script validates new versioned files at lines 145–152 but fast-forwards only at lines 164–165. On the latest run the old checkout did not contain `worker_health.py`, so web deploy failed and API deploy was skipped.

The focused repair should preserve pre-update directory/branch/remote/clean-tree checks, fast-forward, then validate versioned files and compose content from the updated tree. A regression test must simulate an old checkout executing a newer script.

#### P1 — product contract conflicts with direct browser integrations

- `POST /api/google/picker/session` returns a short-lived Google Drive access token because Google Picker requires a browser token.
- `POST /api/projects/{id}/sources/local-upload/initiate` returns a short-lived presigned S3/R2 PUT URL for direct upload.
- `docs/project-spec.md` currently prohibits browser OAuth tokens and presigned URLs without any exception.

This needs an explicit architectural decision. If direct-browser flows remain, the product contract should permit narrowly scoped, short-lived, no-store values; implementation and tests should prove no persistence/logging/service-worker caching, strict origin/CSRF controls, minimum Google scope, PUT-only object capability, exact metadata validation, and suitable CSP/security headers. Otherwise, upload and Picker mediation must move server-side.

The audited local upload completion path validated maximum size and supported MIME type but did not require the stored object size to equal the size declared at initiation. The local remediation now requires complete object-storage head metadata plus exact normalized MIME and byte-size equality; rejected objects stay pending and remain eligible for the existing expiry-driven cleanup lifecycle. Service-backed API verification is still pending.

The audit found that the same `source_upload_ttl_seconds` value expired a source one hour after initiation and was not extended on successful completion. The local remediation keeps the one-hour pending-upload default, resets verified sources from an allowlisted PostgreSQL-backed user preference with a 24-hour default, exposes one-hour through 30-day choices in PWA settings, and surfaces the exact retained expiry. Existing sources keep their persisted deadline; migration and service-backed API/Linux preflight verification are pending.

The audit also found a duplicated 512 MB constant and MIME allowlist in the PWA. The local remediation exposes only those safe server-policy values through an authenticated `no-store` DTO, validates the DTO at runtime, disables direct local selection when policy discovery fails, and keeps every server-side validation boundary intact.

#### P1 — legacy API and UI authority is ambiguous

- The frontend defaults to static demo mode unless `VITE_STUDIO_PLATFORM_MODE=platform`; ordinary `npm run dev` therefore does not open the real PWA.
- `StaticShell`, `NewTranscription`, demo jobs, and `segments.ts` coexist in the production `App.tsx`; only four tests exercise static mode versus 83 explicit platform renders.
- PlatformShell still has unreachable `new` and `jobs` branches left from the demo navigation.
- The old `/sources/google-drive` route trusts browser-supplied Drive metadata, whereas the Picker route revalidates metadata server-side.
- Generic project PATCH accepts output-folder ID/URL/name directly, bypassing the current Picker verification path.
- The old single-job route accepts any active credential provider and can create a job that the implemented ElevenLabs worker path cannot execute. The current batch route correctly requires an active ElevenLabs credential and verified output folder.

Before deletion, verify that no external client uses these endpoints. Then make the platform UI the only/default application and remove, deprecate, or harden the obsolete routes in one authority-focused workstream.

#### P1 — dependency and browser-edge security debt

- Refresh affected Node and Python dependencies in focused, test-backed changes. Do not run an unreviewed bulk audit fix.
- Add a committed Python constraints/lock strategy and pin development tooling.
- Add an automated dependency update/audit policy after the baseline is clean.
- The application/container and host nginx configurations lack an explicit CSP, HSTS, `X-Content-Type-Options`, referrer, permissions, and framing policy. Google Picker requires a carefully tested allowlist; headers must be introduced with browser integration tests and host TLS validation.
- The audited browser DTOs exposed internal IDs such as `owner_user_id` and `provider_credential_id` that the current UI did not need. The local remediation batch removes those two fields from the explicit project/job serializers while retaining request-side credential selection and server-side authority; service-backed API verification remains pending.
- The audited generic 500 middleware returned safe error text and correlation IDs but emitted no server evidence. The local remediation batch now logs only sanitized request/correlation IDs plus endpoint group and, after successful owner authentication, emits one allowlisted owner-scoped aggregate diagnostic. Tests reject exception text, raw path/query/header data, and recursive writer failures.

#### P1 — insufficient release evidence

- The local remediation batch adds controlled API/database/worker/provider/Google processing coverage, but there is still no automated real-browser E2E spanning authenticated preparation through completed-output rendering.
- There is no repository evidence of a successful controlled production canary at the latest migration and worker revision.
- Backup/restore rehearsal, worker rollout identity, and production migration evidence are operator tasks still requiring safe records.
- Accessibility, offline/update behavior, performance/capacity, and multi-worker behavior have no complete validation evidence.

### Maintainability debt

- `apps/studio/src/App.tsx` was approximately 4,098 lines and `App.test.tsx` approximately 7,205 lines. The local batch begins the split by extracting the API/CSRF/safe-diagnostic transport into `src/apiClient.ts`; domain routes/features, hooks, and test modules remain maintainability work.
- `apps/studio-api/studio_api/main.py` is approximately 1,106 lines and mixes schemas, serializers, middleware, and around 40 routes. Split into domain routers and explicit response models while preserving route behavior.
- `tests/test_studio_api_core.py` is approximately 3,096 lines. Split by auth, projects/sources, jobs, Google, credentials, diagnostics, and lifecycle fixtures after the API boundary is stable.
- The top-level `deploy_studio.sh`, stateless compose file, legacy web runbook, and manual full-platform deploy script are not the active component CD path. Confirm operator usage, then delete or rename/guard them as explicit bootstrap-only tools.
- The audited `.gitignore` omitted common pytest/tool caches. The local remediation now ignores repository-local pytest, type/lint, coverage, Vite/Vitest, and future browser-test artifacts.

### Stage self-review: PWA code

Severity is based on effect: deployability, contract integrity, paid/external side effects, security exposure, and evidence quality. Large files are classified as maintainability debt, not automatic bugs. Legacy removal remains gated by external-consumer/operator confirmation that repository search cannot provide.

## PWA readiness estimate

The primary estimate is **63% complete toward a production-ready v1**, with an uncertainty range of roughly 58–68% until product parity and production evidence are clarified.

| Dimension | Weight | Score | Evidence summary |
| --- | ---: | ---: | --- |
| Core user workflow/source implementation | 25% | 80% | Major auth/project/source/batch/worker/output flows exist; some old routes and browser contracts remain unresolved. |
| Data, lifecycle, and side-effect safety | 20% | 80% | Strong leases, attempts, reconciliation, retry and deletion contracts; rollout and a few boundary checks remain. |
| Frontend/PWA product UX | 15% | 60% | Real platform UI exists, but legacy default mode, monolith shape, offline/update/accessibility evidence, and polish remain. |
| Colab feature parity | 15% | 35% | ElevenLabs core path exists; OpenAI, long-media, manifest, segmentation, speaker/keyterm workflows, and golden parity remain. |
| Automated quality evidence | 15% | 60% | Large unit/integration suites pass in CI; no product-level E2E, dependency gate, or complete cross-platform local harness. |
| Production operations and security | 10% | 35% | Operational contracts are strong, but latest CD failed; canary, migration, backup rehearsal, headers, and dependency remediation are incomplete. |

This percentage is a delivery-readiness estimate, not a line-count or checklist-completion claim. Source-level feature breadth alone is approximately 75–80%; production readiness is closer to 45–50% until deployment and canary evidence exist.

### Stage self-review: readiness scoring

The estimate deliberately penalizes missing operational evidence and parity rather than equating implemented modules with completion. A narrower v1 that explicitly excludes full Colab parity would score higher; a release requiring all Colab provider and long-media behavior would score lower.

## Recommended implementation sequence

### Batch 1 — restore a trustworthy baseline

Keep the batch thematic and keep every narrow task in its own green commit. A reasonable first 10–12 task/commit PR is:

1. Repair component CD old-checkout/new-script ordering and add the regression scenario.
2. Make the audit-event test deterministic and document local PostgreSQL/bash prerequisites or supported skips.
3. Correct Studio CI path filters and add the current runbook paths.
4. Reconcile README, project-spec, processing-contract, and delivery-plan source-vs-rollout status claims.
5. Fold the provider transcription pointer into project-spec and update affected tests/references.
6. Fold the historical validation pointer into the realtime/validation runbooks and update affected tests/references.
7. Reframe `SECURITY.md` as the repository security entry point with Studio coverage and reporting guidance.
8. Resolve legacy deployment authority: remove or explicitly bootstrap-gate unused stateless/full-platform paths after operator confirmation.
9. Make platform mode the development and production default; remove static demo UI and dead branches after consumer confirmation.
10. Deprecate or harden unverified legacy Drive/output-folder/single-job APIs, with compatibility tests and a removal notice if required.
11. Add small repository hygiene ignores and a documented cross-platform test profile.
12. Run the full pre-PR gate, push once, open a draft PR, and wait for CI before requesting merge.

The CD repair is the first coding task and should not wait for the rest of the batch to be designed.

### Batch 2 — close security and test-foundation gaps

1. Decide and document the Google Picker token and presigned upload exceptions or replace the direct-browser architecture.
2. Harden upload size/retention behavior and browser response models. Exact metadata verification and separate post-completion retention are source-complete in the local batch; service-backed verification remains pending.
3. Apply non-breaking Vite/ESLint patches; migrate Vitest separately with the full frontend suite.
4. Upgrade `cryptography`, remove the unused multipart parser, and coordinate FastAPI/Starlette upgrades with API tests.
5. Introduce Python constraints/lock and automated dependency reporting.
6. Add carefully tested nginx/browser security headers.
7. Add safe unhandled-error diagnostics.
8. Establish deterministic API/worker E2E tests with fake provider/Google boundaries and PostgreSQL/Redis services.

### Batch 3 — implement the agreed v1 parity slice

Sequence product work from `docs/project-spec.md` after explicitly defining which Colab behaviors are required for v1:

1. OpenAI processing path and credential UX;
2. long-media splitting, size/duration policy, and resumable evidence;
3. manifest/skip behavior or an explicit web-native replacement;
4. manual segmentation and speaker/keyterm/diarization parity as accepted scope requires;
5. golden fixtures comparing Colab and PWA normalization/output behavior;
6. frontend/API modularization along the stabilized domain boundaries.

### Batch 4 — production proof

1. Review and approve migration/deploy plan under `docs/ci-cd-rules.md`.
2. Rehearse backup/restore and rollback without exposing production data.
3. Deploy web/API, verify commit and image identity, and apply the approved migration manually.
4. Deploy exactly one worker through the manual worker path and verify health/identity.
5. Run one approved canary with exactly one small source and one expected output.
6. Record only safe pass/fail evidence, reconcile any output uncertainty, and update readiness claims only after evidence is complete.

## Branch, commit, and PR cadence

- Use one `codex/` branch per thematic batch.
- One narrow task equals one reviewable commit containing its tests/docs where applicable.
- Run targeted checks before each commit; do not accumulate known red commits.
- Before the batch PR, run `git diff --check`, `python scripts/ci_checks.py`, the service-backed Python suite, and Studio install/lint/test/build/container checks applicable to the changed paths.
- Push after the planned 10–15-task batch, open a draft PR through GitHub CLI, and let CI finish before marking it ready.
- Do not auto-deploy workers, run migrations, or treat merge as proof of production rollout.
- After merge, fast-forward local `main` from GitHub, create the next thematic branch, and repeat.

The 10–15 task cadence is safe only when the tasks belong to one milestone and every commit remains green. Unrelated product, dependency, deployment, and documentation changes should not be hidden in one review unit merely to reach a count.

### Final self-review

The immediate plan prioritizes restoring deployment correctness and authority clarity before feature expansion. The largest uncertainties are external operator use of legacy paths, the intended security contract for direct browser integrations, and the exact v1 parity target. None of those uncertainties prevent the first CD repair task.

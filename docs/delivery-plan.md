# Delivery plan

## Current dashboard

- ✅ `PWA-RETRY-RECOVERY-01` — Safe stage-specific retry/recovery — Done/source-complete, merged via PR #173.
- ✅ `PWA-SOURCE-DELETION-01` — Safe Studio source deletion, retention, and storage cleanup — Done/source-complete, merged via PR #174.
- ✅ `DOCS-AUTHORITY-SYNC-02` — Reconcile stale source-complete versus production-rollout claims and consolidate pointer-only documents — Done, merged via PR #177.
- ✅ `SECURITY-ENTRYPOINT-01` — Reframe `SECURITY.md` for both contours, private reporting, and authority routing — Done, merged via PR #177.
- ✅ `PWA-LEGACY-AUTHORITY-01` — Remove obsolete Studio UI/deploy surfaces and close legacy project, Drive-source, and job-creation authority bypasses — Done, merged via PR #177.
- ✅ `PWA-BROWSER-INTEGRATION-BOUNDARY-01` — Define and enforce bounded OAuth-start, Picker-token, and direct-upload browser capabilities — Done, merged via PR #177.
- ✅ `PWA-WEB-SECURITY-HEADERS-01` — Add a single host-level Picker-compatible CSP and browser security-header policy — Source-complete via PR #177; live host nginx/TLS validation remains operator evidence.
- ✅ `PWA-CD-RECOVERY-01` — Repair component CD old-checkout/new-script ordering and validate the latest `main` web deployment — Done; Studio Platform CD run `29898198997` deployed web successfully from merge SHA `9f85ffe`, while API and worker were intentionally skipped.
- ✅ `PWA-DEPENDENCY-SECURITY-01` — Reproduce and remediate actionable Studio Node/Python dependency findings without broad upgrades — Done via PR #177; current npm and pip audits have zero known vulnerabilities.
- ✅ `PWA-DEPENDENCY-REPRODUCIBILITY-01` — Add deterministic Python transitive constraints without changing the Colab runtime install — Done, merged via PR #177.
- ✅ `PWA-DEPENDENCY-REPORTING-01` — Add automated dependency reporting without coupling ordinary CI to advisory-service availability — Source-complete via PR #177; the first scheduled/manual GitHub run remains external evidence.
- ✅ `PWA-E2E-FOUNDATION-01A` — Establish a deterministic API/worker processing E2E with fake storage/provider/Google boundaries and real PostgreSQL/Redis services — Done via PR #177 and verified by service-backed GitHub CI.
- ✅ `PWA-BROWSER-DTO-MINIMIZATION-01` — Remove UI-unused owner and provider-credential IDs from project/job browser payloads while preserving server-side authority — Done via PR #177 and verified by service-backed GitHub CI.
- ✅ `PWA-UNHANDLED-DIAGNOSTICS-01` — Emit safe server evidence and an owner-scoped aggregate diagnostic for otherwise unhandled API exceptions without exposing exception details — Done, merged via PR #177.
- ✅ `PWA-UPLOAD-VERIFIED-METADATA-01A` — Require complete uploaded-object metadata and exact normalized MIME/byte-size equality before local-upload completion — Done via PR #177 and verified by service-backed GitHub CI.
- ✅ `REPO-HYGIENE-01` — Ignore repository-local Python and Studio test/cache artifacts — Done, merged via PR #177.
- ✅ `TEST-PORTABLE-PROFILE-01` — Limit pytest discovery to repository tests and add an opt-in cross-platform profile that excludes service/shell modules before import while leaving the full CI suite unchanged — Done, merged via PR #177.
- ✅ `PWA-FRONTEND-MODULARIZATION-01A` — Extract the tested API/CSRF/diagnostic transport from the monolithic application component — Done via PR #177 with no API or UI behavior change.
- ✅ `PWA-UPLOAD-RETENTION-CONTRACT-01B` — Keep a one-hour pending-upload deadline, reset verified local sources to a user-configurable 24-hour default retained-source deadline, and surface exact expiry in the PWA — Source-complete via PR #177 and verified by service-backed GitHub CI; production migration/runtime state remains unproven.
- ✅ `PWA-UPLOAD-RETENTION-PREFERENCES-02` — Persist allowlisted one-hour/24-hour/three-day/seven-day/30-day account choices in PostgreSQL and expose them in PWA settings; changes apply to future verified uploads — Source-complete via PR #177 and verified by service-backed GitHub CI; production migration/runtime state remains unproven.
- ✅ `PWA-UPLOAD-POLICY-DISCOVERY-01C` — Remove the frontend's hard-coded upload-size/MIME policy by exposing a runtime-validated safe server DTO and disabling direct local selection when discovery fails — Done via PR #177 and verified by service-backed GitHub CI.
- 👉 `PWA-E2E-FOUNDATION-01B` — Add authenticated real-browser coverage on top of the API/worker processing foundation — Source-complete on `codex/pwa-browser-e2e-01`; first service-backed GitHub execution is pending.
- ⛔ `PWA-PROCESSING-ROLLOUT-01A` — Production processing rollout/canary — Operator item not run; production-live claims remain prohibited.

## Current repository state

- Current repository Alembic head: `0015_user_source_retention`.
- PostgreSQL remains the durable authority for Studio processing, retry/recovery, source deletion, retention, and cleanup state.
- Redis is not cleanup authority, scheduler, retry authority, or lease authority.
- Repository CI run `29898199041` and Studio PWA CI run `29898198991` passed for `main` merge revision `9f85ffe93102354869f37f60fd525dd60404b878`.
- Studio Platform CD run `29898198997` successfully fast-forwarded to that revision, built and deployed the web component, verified its running image identity, and passed its post-check. API and worker deploy jobs were intentionally skipped because the batch includes a migration and worker rollout is manual-only.
- The component deploy path preserves pre-update identity/clean-tree checks, fast-forwards before versioned-file validation, and requires exact fetched-target revision identity before build.
- The legacy stateless web-only contour and the non-authoritative full-platform deploy helper are removed; documented bootstrap steps and platform component deployment remain authoritative.
- The Studio frontend has one authoritative authenticated platform shell; the static demo shell, demo jobs/segments, and obsolete frontend build-mode flags are removed.
- Generic project PATCH now rejects browser-supplied output-folder identity and unknown fields; output-folder binding remains server-verified through the Picker route.
- The deprecated single-file Google Drive source route now ignores browser metadata and reuses the canonical Picker route's owner-scoped metadata and source-policy validation.
- The deprecated single-job route now requires project output-folder authority and resolves only an active, non-deleted ElevenLabs credential; the idempotent batch route remains canonical.
- OAuth-start, Picker access-token, and direct-upload responses are now explicit browser-bound capabilities with no-store responses; Picker rejects broader scope sets/incremental grants and direct PUT uses a validated 60–900 second TTL without cookies, referrer, redirects, or service-worker runtime caching.
- The host nginx source now enforces one CSP/HSTS/nosniff/referrer/permissions/framing policy across PWA and API; standard component CD does not apply host config, so production header state is still unproven.
- Studio frontend build/test tooling now uses the minimum compatible patched Vite 6/Vitest 3 line plus refreshed ESLint tooling; `npm audit`, lint, 114 tests, TypeScript, and the production PWA build pass locally.
- Studio API now pins a patched FastAPI/Starlette pair and cryptography release, removes the unused multipart parser, and uses `httpx2` only for Starlette TestClient compatibility; the current pip audit has zero known vulnerabilities.
- Studio API Docker and repository CI now install their input requirements under committed pip-tools constraints; Colab continues to install its independent runtime requirements.
- A separate weekly/manual GitHub workflow audits the exact npm graph and an installed Linux/Python 3.11 graph; it is deliberately absent from pull-request and push triggers.
- A dedicated processing E2E creates a project, encrypted ElevenLabs credential, local-upload source, verified output destination, and idempotent batch through the API; the real runner/worker then persists one completed output through controlled external fakes and the public output API is checked for its explicit safe DTO. GitHub CI verified the full 837-test suite against PostgreSQL and Redis on merge revision `9f85ffe`.
- Project serializers no longer expose `owner_user_id`, and job serializers no longer expose `provider_credential_id`; the PWA did not consume either field, while credential selection and persisted worker authority remain unchanged server-side.
- Unhandled API exceptions now produce a fixed safe 500 response, a sanitized server log record, and—only after owner authentication—one allowlisted aggregate diagnostic; raw exception/path/query/header/body data is excluded and diagnostic-write failure is non-recursive.
- Local-upload completion now requires present object-storage size/MIME metadata, enforces policy on the verified values, and requires exact normalized equality with the initiation contract. Rejected objects remain pending and retain their expiry-driven cleanup path.
- Local uploads now keep separate persisted lifecycle windows: unfinished uploads default to one hour from initiation, while exact verified completion resets expiry from the owner's PostgreSQL-backed account choice. PWA settings offer one hour, 24 hours (default), three days, seven days, and 30 days; existing uploaded sources retain their already persisted deadline, and the PWA shows the exact server expiry.
- The authenticated PWA now reads maximum upload bytes and supported MIME rules from a safe `no-store` server DTO, validates it at runtime, and disables direct local selection when discovery fails; the API remains authoritative at initiation, stored-object verification, and processing boundaries.
- The current browser-E2E branch adds one real Chromium scenario through the Vite same-origin proxy and live FastAPI/PostgreSQL/Redis services. It verifies login/session/CSRF behavior, authenticated project creation, safe completed-result visibility, and logout against an isolated synthetic seed without provider, Google, S3, production, or canary side effects.
- `SECURITY.md` is now a repository-wide reporting and routing entry point; it does not duplicate detailed Colab or Studio product contracts.
- Production migration state for `0015_user_source_retention` is not proven by repository evidence.
- Latest production web/API deployment, worker rollout, and controlled canary are not proven complete.

## Near backlog

- `PWA-FRONTEND-MODULARIZATION-01B` — continue splitting domain UI/hooks and their tests out of the monolithic `App.tsx`/`App.test.tsx` after the browser E2E boundary is established.
- OpenAI processing parity, long-media parity, manifest behavior, and golden Colab/PWA parity validation remain product backlog items in `docs/project-spec.md`.

## Active item validation

`PWA-E2E-FOUNDATION-01B` keeps the existing API/worker E2E as backend processing evidence and adds a separate browser boundary. Local validation covers Studio ESLint, all 114 Vitest tests, the production PWA build, Playwright discovery, two browser-E2E contract guards, the 645-test portable Python profile, lightweight CI checks, and zero known npm audit findings. The real Chromium scenario requires Linux plus PostgreSQL/Redis and remains pending until the branch reaches a pull request; it is not production-canary evidence.

## Blockers and risks

- The latest automatic component CD proves only the web deployment at merge revision `9f85ffe`; API deployment, migration `0015`, worker rollout, and processing canary remain separate operator-controlled evidence.
- No current repository evidence proves a successful production controlled canary after the latest worker/source lifecycle work.
- Browser-bound capabilities increase the impact of frontend injection; the committed host header policy is not production evidence until an operator applies it, runs `nginx -t`, and validates public Picker/upload flows over TLS.
- The dependency-audit workflow has not yet run through its scheduled/manual GitHub path; merged source and local audit probes are not remote execution evidence.
- The processing E2E remains skipped in the current Windows environment because PostgreSQL/Redis are not running, but GitHub CI has verified it against service containers.
- The authenticated Chromium scenario cannot run in the current Windows environment because Docker/PostgreSQL/Redis are unavailable; its isolated GitHub job must pass before `PWA-E2E-FOUNDATION-01B` becomes CI-verified.

## Sources of truth

- Product contract: `docs/project-spec.md`.
- Processing contract: `docs/studio-processing-contract.md`.
- Workflow: `docs/ai-coding-workflow.md`.
- CI/CD and deployment safety: `docs/ci-cd-rules.md`.
- Architecture map: `docs/architecture.md`.
- Audit evidence and recommended sequence: `docs/runbooks/repository-audit-2026-07-21.md`.
- Historical traceability only: `docs/delivery-plan-archive.md`.

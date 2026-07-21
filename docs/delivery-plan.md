# Delivery plan

## Current dashboard

- ✅ `PWA-RETRY-RECOVERY-01` — Safe stage-specific retry/recovery — Done/source-complete, merged via PR #173.
- ✅ `PWA-SOURCE-DELETION-01` — Safe Studio source deletion, retention, and storage cleanup — Done/source-complete, merged via PR #174.
- ✅ `DOCS-AUTHORITY-SYNC-02` — Reconcile stale source-complete versus production-rollout claims and consolidate pointer-only documents — Complete in the local stabilization batch.
- ✅ `SECURITY-ENTRYPOINT-01` — Reframe `SECURITY.md` for both contours, private reporting, and authority routing — Complete in the local stabilization batch.
- ✅ `PWA-LEGACY-AUTHORITY-01` — Remove obsolete Studio UI/deploy surfaces and close legacy project, Drive-source, and job-creation authority bypasses — Complete in the local stabilization batch.
- ✅ `PWA-BROWSER-INTEGRATION-BOUNDARY-01` — Define and enforce bounded OAuth-start, Picker-token, and direct-upload browser capabilities — Complete in the local stabilization batch.
- ✅ `PWA-WEB-SECURITY-HEADERS-01` — Add a single host-level Picker-compatible CSP and browser security-header policy — Source-complete in the local stabilization batch; live nginx/TLS validation remains operator evidence.
- ⛔ `PWA-CD-RECOVERY-01` — Repair component CD old-checkout/new-script ordering and validate the latest `main` deployment — Source fix implemented; live validation is blocked until the batch is merged and CD is run again.
- ✅ `PWA-DEPENDENCY-SECURITY-01` — Reproduce and remediate actionable Studio Node/Python dependency findings without broad upgrades — Complete in the local batch; current npm and pip audits have zero known vulnerabilities.
- ✅ `PWA-DEPENDENCY-REPRODUCIBILITY-01` — Add deterministic Python transitive constraints without changing the Colab runtime install — Source-complete in the local batch.
- ✅ `PWA-DEPENDENCY-REPORTING-01` — Add automated dependency reporting without coupling ordinary CI to advisory-service availability — Source-complete in the local batch; the first GitHub run remains external evidence.
- ✅ `PWA-E2E-FOUNDATION-01A` — Establish a deterministic API/worker processing E2E with fake storage/provider/Google boundaries and real PostgreSQL/Redis services — Source-complete in the local batch; service-backed GitHub CI verification is pending.
- ✅ `PWA-BROWSER-DTO-MINIMIZATION-01` — Remove UI-unused owner and provider-credential IDs from project/job browser payloads while preserving server-side authority — Source-complete in the local batch; service-backed API verification is pending.
- ✅ `PWA-UNHANDLED-DIAGNOSTICS-01` — Emit safe server evidence and an owner-scoped aggregate diagnostic for otherwise unhandled API exceptions without exposing exception details — Source-complete in the local batch.
- ✅ `PWA-UPLOAD-VERIFIED-METADATA-01A` — Require complete uploaded-object metadata and exact normalized MIME/byte-size equality before local-upload completion — Source-complete in the local batch; service-backed API verification is pending.
- ✅ `REPO-HYGIENE-01` — Ignore repository-local Python and Studio test/cache artifacts — Complete in the local batch.
- ✅ `TEST-PORTABLE-PROFILE-01` — Limit pytest discovery to repository tests and add an opt-in cross-platform profile that excludes service/shell modules before import while leaving the full CI suite unchanged — Complete in the local batch.
- 👉 `PWA-UPLOAD-RETENTION-CONTRACT-01B` — Separate upload-session expiry from retained-source expiry or make the current one-hour lifetime an explicit surfaced product rule — Next focused item; requires a product retention decision.
- ⛔ `PWA-PROCESSING-ROLLOUT-01A` — Production processing rollout/canary — Operator item not run; production-live claims remain prohibited.

## Current repository state

- Current repository Alembic head: `0014_source_deletion_retention`.
- PostgreSQL remains the durable authority for Studio processing, retry/recovery, source deletion, retention, and cleanup state.
- Redis is not cleanup authority, scheduler, retry authority, or lease authority.
- Repository CI and Studio PWA CI passed for `main` revision `6ee51994de90bbfe7852cf1bd7618397b00e52b3`.
- Studio Platform CD run `29815613081` failed before the server checkout fast-forward because the new deploy script required a file present only in the new revision.
- The local source fix now preserves pre-update identity/clean-tree checks, fast-forwards before versioned-file validation, and requires exact fetched-target revision identity before build.
- The legacy stateless web-only contour and the non-authoritative full-platform deploy helper are removed in the local batch; documented bootstrap steps and platform component deployment remain authoritative.
- The Studio frontend has one authoritative authenticated platform shell; the static demo shell, demo jobs/segments, and obsolete frontend build-mode flags are removed locally.
- Generic project PATCH now rejects browser-supplied output-folder identity and unknown fields; output-folder binding remains server-verified through the Picker route.
- The deprecated single-file Google Drive source route now ignores browser metadata and reuses the canonical Picker route's owner-scoped metadata and source-policy validation.
- The deprecated single-job route now requires project output-folder authority and resolves only an active, non-deleted ElevenLabs credential; the idempotent batch route remains canonical.
- OAuth-start, Picker access-token, and direct-upload responses are now explicit browser-bound capabilities with no-store responses; Picker rejects broader scope sets/incremental grants and direct PUT uses a validated 60–900 second TTL without cookies, referrer, redirects, or service-worker runtime caching.
- The host nginx source now enforces one CSP/HSTS/nosniff/referrer/permissions/framing policy across PWA and API; standard component CD does not apply host config, so production header state is still unproven.
- Studio frontend build/test tooling now uses the minimum compatible patched Vite 6/Vitest 3 line plus refreshed ESLint tooling; `npm audit`, lint, 111 tests, TypeScript, and the production PWA build pass locally.
- Studio API now pins a patched FastAPI/Starlette pair and cryptography release, removes the unused multipart parser, and uses `httpx2` only for Starlette TestClient compatibility; the current pip audit has zero known vulnerabilities.
- Studio API Docker and repository CI now install their input requirements under committed pip-tools constraints; Colab continues to install its independent runtime requirements.
- A separate weekly/manual GitHub workflow audits the exact npm graph and an installed Linux/Python 3.11 graph; it is deliberately absent from pull-request and push triggers.
- A dedicated processing E2E now creates a project, encrypted ElevenLabs credential, local-upload source, verified output destination, and idempotent batch through the API; the real runner/worker then persists one completed output through controlled external fakes and the public output API is checked for its explicit safe DTO. The test fails rather than skips when CI lacks PostgreSQL or Redis, but its first service-backed execution is still pending.
- Project serializers no longer expose `owner_user_id`, and job serializers no longer expose `provider_credential_id`; the PWA did not consume either field, while credential selection and persisted worker authority remain unchanged server-side.
- Unhandled API exceptions now produce a fixed safe 500 response, a sanitized server log record, and—only after owner authentication—one allowlisted aggregate diagnostic; raw exception/path/query/header/body data is excluded and diagnostic-write failure is non-recursive.
- Local-upload completion now requires present object-storage size/MIME metadata, enforces policy on the verified values, and requires exact normalized equality with the initiation contract. Rejected objects remain pending and retain their expiry-driven cleanup path.
- `SECURITY.md` is now a repository-wide reporting and routing entry point; it does not duplicate detailed Colab or Studio product contracts.
- Production migration state for `0014_source_deletion_retention` is not proven by repository evidence.
- Latest production web/API deployment, worker rollout, and controlled canary are not proven complete.

## Near backlog

- `PWA-E2E-FOUNDATION-01B` — authenticated browser E2E on top of the API/worker processing foundation.
- `PWA-UPLOAD-RETENTION-CONTRACT-01B` — explicit post-upload retention semantics, separately from the bounded presign lifetime.
- OpenAI processing parity, long-media parity, manifest behavior, and golden Colab/PWA parity validation remain product backlog items in `docs/project-spec.md`.

## Blockers and risks

- The latest component CD failure blocks a claim that current `main` is deployed; the local source fix is not runtime evidence until merged and validated by a new CD run.
- No current repository evidence proves a successful production controlled canary after the latest worker/source lifecycle work.
- Browser-bound capabilities increase the impact of frontend injection; the committed host header policy is not production evidence until an operator applies it, runs `nginx -t`, and validates public Picker/upload flows over TLS.
- The dependency-audit workflow has not yet run on GitHub from the local batch; its source and local audit probes are not remote execution evidence.
- The new processing E2E is skipped in the current Windows environment because PostgreSQL/Redis are not running; GitHub CI must execute it against its service containers before it can be called CI-verified.

## Sources of truth

- Product contract: `docs/project-spec.md`.
- Processing contract: `docs/studio-processing-contract.md`.
- Workflow: `docs/ai-coding-workflow.md`.
- CI/CD and deployment safety: `docs/ci-cd-rules.md`.
- Architecture map: `docs/architecture.md`.
- Audit evidence and recommended sequence: `docs/runbooks/repository-audit-2026-07-21.md`.
- Historical traceability only: `docs/delivery-plan-archive.md`.

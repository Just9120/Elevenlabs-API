# Delivery plan

## Current dashboard

- ✅ `PWA-RETRY-RECOVERY-01` — Safe stage-specific retry/recovery — Done/source-complete, merged via PR #173.
- ✅ `PWA-SOURCE-DELETION-01` — Safe Studio source deletion, retention, and storage cleanup — Done/source-complete, merged via PR #174.
- ✅ `DOCS-AUTHORITY-SYNC-02` — Reconcile stale source-complete versus production-rollout claims and consolidate pointer-only documents — Complete in the local stabilization batch.
- ✅ `SECURITY-ENTRYPOINT-01` — Reframe `SECURITY.md` for both contours, private reporting, and authority routing — Complete in the local stabilization batch.
- ✅ `PWA-LEGACY-AUTHORITY-01` — Remove obsolete Studio UI/deploy surfaces and close legacy project, Drive-source, and job-creation authority bypasses — Complete in the local stabilization batch.
- ✅ `PWA-BROWSER-INTEGRATION-BOUNDARY-01` — Define and enforce bounded OAuth-start, Picker-token, and direct-upload browser capabilities — Complete in the local stabilization batch.
- ⛔ `PWA-CD-RECOVERY-01` — Repair component CD old-checkout/new-script ordering and validate the latest `main` deployment — Source fix implemented; live validation is blocked until the batch is merged and CD is run again.
- 👉 `PWA-WEB-SECURITY-HEADERS-01` — Add and test a Picker-compatible browser security-header policy at the authoritative nginx boundary — Current local coding item.
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
- `SECURITY.md` is now a repository-wide reporting and routing entry point; it does not duplicate detailed Colab or Studio product contracts.
- Production migration state for `0014_source_deletion_retention` is not proven by repository evidence.
- Latest production web/API deployment, worker rollout, and controlled canary are not proven complete.

## Near backlog

- `PWA-WEB-SECURITY-HEADERS-01` — add a carefully tested CSP, HSTS, MIME-sniffing, referrer, permissions, and framing policy compatible with Google Picker and upload storage.
- `PWA-DEPENDENCY-SECURITY-01` — remediate audited Node/Python dependency findings with focused upgrades and reproducible constraints.
- `PWA-E2E-FOUNDATION-01` — automated end-to-end validation foundation for Studio.
- OpenAI processing parity, long-media parity, manifest behavior, and golden Colab/PWA parity validation remain product backlog items in `docs/project-spec.md`.

## Blockers and risks

- The latest component CD failure blocks a claim that current `main` is deployed; the local source fix is not runtime evidence until merged and validated by a new CD run.
- No current repository evidence proves a successful production controlled canary after the latest worker/source lifecycle work.
- Browser-bound capabilities increase the impact of frontend injection; production rollout still requires the separate tested nginx/CSP security-header item.
- Dependency audits report actionable findings in frontend development tooling and pinned Studio API dependencies.

## Sources of truth

- Product contract: `docs/project-spec.md`.
- Processing contract: `docs/studio-processing-contract.md`.
- Workflow: `docs/ai-coding-workflow.md`.
- CI/CD and deployment safety: `docs/ci-cd-rules.md`.
- Architecture map: `docs/architecture.md`.
- Audit evidence and recommended sequence: `docs/runbooks/repository-audit-2026-07-21.md`.
- Historical traceability only: `docs/delivery-plan-archive.md`.

# Delivery plan

## Current dashboard

- ✅ `PWA-RETRY-RECOVERY-01` — Safe stage-specific retry/recovery — Done/source-complete, merged via PR #173.
- ✅ `PWA-SOURCE-DELETION-01` — Safe Studio source deletion, retention, and storage cleanup — Done/source-complete, merged via PR #174.
- ✅ `DOCS-AUTHORITY-SYNC-02` — Reconcile stale source-complete versus production-rollout claims and consolidate pointer-only documents — Complete in the local stabilization batch.
- ✅ `SECURITY-ENTRYPOINT-01` — Reframe `SECURITY.md` for both contours, private reporting, and authority routing — Complete in the local stabilization batch.
- ⛔ `PWA-CD-RECOVERY-01` — Repair component CD old-checkout/new-script ordering and validate the latest `main` deployment — Source fix implemented; live validation is blocked until the batch is merged and CD is run again.
- 👉 `PWA-LEGACY-AUTHORITY-01` — Review legacy UI, API, deployment, and runtime authority — Current local coding item.
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
- `SECURITY.md` is now a repository-wide reporting and routing entry point; it does not duplicate detailed Colab or Studio product contracts.
- Production migration state for `0014_source_deletion_retention` is not proven by repository evidence.
- Latest production web/API deployment, worker rollout, and controlled canary are not proven complete.

## Near backlog

- `PWA-LEGACY-AUTHORITY-01` — harden or retire the unverified Drive-source and legacy single-job creation routes after closing the generic project PATCH bypass.
- `PWA-BROWSER-INTEGRATION-BOUNDARY-01` — decide and enforce the security contract for Google Picker access tokens and direct presigned uploads.
- `PWA-DEPENDENCY-SECURITY-01` — remediate audited Node/Python dependency findings with focused upgrades and reproducible constraints.
- `PWA-E2E-FOUNDATION-01` — automated end-to-end validation foundation for Studio.
- OpenAI processing parity, long-media parity, manifest behavior, and golden Colab/PWA parity validation remain product backlog items in `docs/project-spec.md`.

## Blockers and risks

- The latest component CD failure blocks a claim that current `main` is deployed; the local source fix is not runtime evidence until merged and validated by a new CD run.
- No current repository evidence proves a successful production controlled canary after the latest worker/source lifecycle work.
- The product contract currently prohibits browser OAuth tokens and presigned URLs while the implemented Google Picker and local-upload flows require them; this needs an explicit architecture/security decision.
- Dependency audits report actionable findings in frontend development tooling and pinned Studio API dependencies.
- Remaining legacy UI and permissive API authority is unresolved and must not be hidden by documentation cleanup.

## Sources of truth

- Product contract: `docs/project-spec.md`.
- Processing contract: `docs/studio-processing-contract.md`.
- Workflow: `docs/ai-coding-workflow.md`.
- CI/CD and deployment safety: `docs/ci-cd-rules.md`.
- Architecture map: `docs/architecture.md`.
- Audit evidence and recommended sequence: `docs/runbooks/repository-audit-2026-07-21.md`.
- Historical traceability only: `docs/delivery-plan-archive.md`.

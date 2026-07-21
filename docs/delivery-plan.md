# Delivery plan

## Current dashboard

- ✅ `PWA-RETRY-RECOVERY-01` — Safe stage-specific retry/recovery — Done/source-complete, CI-verified, merged via PR #173.
- ✅ `PWA-SOURCE-DELETION-01` — Safe Studio source deletion, retention, and storage cleanup — Done/source-complete, CI-verified, merged via PR #174 (`6ee51994de90bbfe7852cf1bd7618397b00e52b3`).
- ✅ `PWA-LEGACY-AUTHORITY-01` — Studio runtime/deployment authority reconciliation — Done/source-complete and CI-verified for this PR.
- 👉 `PWA-E2E-FOUNDATION-01` — Automated end-to-end validation foundation for Studio — Next recommended focused coding item.
- ⛔ `PWA-PROCESSING-ROLLOUT-01A` — Production processing rollout/canary — Separate operator item not run; production-live claims remain prohibited.

## Current repository state

- Current repository Alembic head: `0014_source_deletion_retention`.
- PostgreSQL remains the durable authority for Studio processing, retry/recovery, source deletion, retention, cleanup, leases, jobs, outputs, and reconciliation state.
- Redis is not durable cleanup authority, job authority, scheduler, retry authority, lease authority, source-retention authority, or output-reconciliation authority.
- `PWA-RETRY-RECOVERY-01` is implemented at source level and CI-verified via PR #173; production rollout/canary remains unproven.
- `PWA-SOURCE-DELETION-01` is implemented at source level and CI-verified via PR #174 (`6ee51994de90bbfe7852cf1bd7618397b00e52b3`).
- Production migration rollout for `0014_source_deletion_retention` has not been applied by PR #174 or this PR.
- Production deploy has not been run by PR #174 or this PR.
- Worker rollout has not been run by PR #174 or this PR.
- Controlled canary has not been run by PR #174 or this PR.
- Production-live claims remain prohibited until factual operator evidence satisfies `docs/project-spec.md` and `docs/runbooks/studio-platform-ops.md`.

## Runtime/deployment authority status

- `PWA-LEGACY-AUTHORITY-01` reconciled authoritative Studio runtime paths in `docs/architecture.md`, README navigation, and the Studio platform operations runbook.
- Current authoritative platform path is `deploy/studio/compose.platform.yml` with web/API/worker services and operator-managed `.env`/secret files.
- Legacy stateless web-only path remains compatibility-only and explicitly marked, with replacement `deploy/studio/compose.platform.yml` plus `scripts/deploy_studio_platform_component.sh`.
- No legacy paths were removed in this item because the preserved stateless web path still has a documented compatibility runbook and no proof it is safe to delete from operator history.

## Near backlog

- `PWA-E2E-FOUNDATION-01` — automated end-to-end validation foundation for Studio.
- `PWA-PROCESSING-ROLLOUT-01A` — separate operator validation for migration/deploy/worker rollout and one controlled canary.
- OpenAI processing parity, long-media parity, manifest behavior, and golden Colab/PWA parity validation remain product backlog items in `docs/project-spec.md`.

## Blockers and risks

- No current repository evidence proves a successful production controlled canary after the latest worker/source lifecycle work.
- Source-complete and CI-verified PRs do not prove production migration, deployment, worker-running, controlled canary, or production-live state.
- Any future removal of compatibility-only legacy paths requires call-site, workflow, docs, tests, and operator rollback/recovery review.

## Sources of truth

- Product contract: `docs/project-spec.md`.
- Processing contract: `docs/studio-processing-contract.md`.
- Workflow: `docs/ai-coding-workflow.md`.
- CI/CD and deployment safety: `docs/ci-cd-rules.md`.
- Architecture map: `docs/architecture.md`.
- Historical traceability only: `docs/delivery-plan-archive.md`.

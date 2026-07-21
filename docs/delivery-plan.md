# Delivery plan

## Current dashboard

- ✅ `PWA-RETRY-RECOVERY-01` — Safe stage-specific retry/recovery — Done/source-complete, merged via PR #173.
- 👉 `PWA-SOURCE-DELETION-01` — Safe Studio source deletion, retention, and storage cleanup — Current focused coding item; source-complete only after implementation and green CI.
- 📋 `PWA-LEGACY-AUTHORITY-01` — Review legacy deployment/runtime authority — Next recommended coding item.
- ⛔ `PWA-PROCESSING-ROLLOUT-01A` — Production processing rollout/canary — Operator item not run; production-live claims remain prohibited.

## Current repository state

- Current repository Alembic head: `0014_source_deletion_retention`.
- PostgreSQL remains the durable authority for Studio processing, retry/recovery, source deletion, retention, and cleanup state.
- Redis is not cleanup authority, scheduler, retry authority, or lease authority.
- Production migration rollout for `0014_source_deletion_retention` has not been performed by this PR.
- Production deploy, worker rollout, and controlled canary have not been performed by this PR.

## Near backlog

- `PWA-LEGACY-AUTHORITY-01` — review legacy deployment/runtime paths and remove or formally mark them.
- `PWA-E2E-FOUNDATION-01` — automated end-to-end validation foundation for Studio.
- OpenAI processing parity, long-media parity, manifest behavior, and golden Colab/PWA parity validation remain product backlog items in `docs/project-spec.md`.

## Blockers and risks

- No current repository evidence proves a successful production controlled canary after the latest worker/source lifecycle work.
- Source deletion source-complete status must not be claimed until repository checks and CI are green for this PR.
- Legacy deployment paths may still exist and must not be hidden by documentation cleanup.

## Sources of truth

- Product contract: `docs/project-spec.md`.
- Processing contract: `docs/studio-processing-contract.md`.
- Workflow: `docs/ai-coding-workflow.md`.
- CI/CD and deployment safety: `docs/ci-cd-rules.md`.
- Architecture map: `docs/architecture.md`.
- Historical traceability only: `docs/delivery-plan-archive.md`.

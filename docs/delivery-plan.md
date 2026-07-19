# Delivery plan

This is the compact current delivery dashboard. It is not a historical journal. Historical PR chains, old checkpoints, rollout notes, and closed status transitions live in `docs/delivery-plan-archive.md` and do not define current scope.

## Current status

- Google Colab batch workflow is stable, ready, and used in real operation; it remains the baseline and fallback contour.
- Studio PWA is in development. The repository contains source-level authentication, projects/sources, BYOK, Google OAuth/Drive, jobs persistence, worker, processing orchestration, ElevenLabs provider path, Google Docs output path, diagnostics, migrations, and tests.
- Studio processing is not yet confirmed production-live. Worker production deployment and a successful controlled canary after the latest fix still require operator evidence.
- Current repository Alembic head: `0011_diagnostic_debug_sessions`.

## Current operator validation

### `PWA-PROCESSING-ROLLOUT-01A`

Goal: deploy the fixed worker and confirm one controlled end-to-end canary with exactly one intended output.

Validation boundary:

- Separate source-done, CI-verified, deployed, migration-applied, worker-running, and production-live states.
- Do not create multiple smoke jobs or retry automatically.
- Do not claim production-live processing unless factual operator evidence shows one successful controlled canary with exactly one persisted output and no unsafe evidence.

## Completed/source-complete item

### `PWA-WORKER-OPS-01`

Source-level worker operations are done in this PR: worker health, manual-only worker deploy, image/commit identity checks, drain/pause/resume, explicit worker-only rollback, workflow boundary, and operator runbook are present. No production deployment or canary was run.

## Active coding item / next item

### `PWA-OUTPUT-RECONCILIATION-01`

Goal: define and implement safe reconciliation for cases where Google Docs creation may have succeeded but persisted output evidence is missing, partial, or uncertain.

## Near backlog

- `PWA-LEASE-HEARTBEAT-01` — renew leases safely during long external calls.
- `PWA-RETRY-RECOVERY-01` — stage-specific retry/recovery without duplicate provider or Google side effects.
- `PWA-SOURCE-DELETION-01` — source deletion, retention, and processing-time access semantics.
- `PWA-LEGACY-AUTHORITY-01` — review legacy deployment/runtime paths and remove or mark them formally.
- `PWA-E2E-FOUNDATION-01` — automated end-to-end validation foundation for Studio.
- OpenAI processing parity, long-media parity, manifest behavior, and golden Colab/PWA parity validation remain product backlog items in `docs/project-spec.md`.

## Blockers and risks

- No current repository evidence proves a successful production controlled canary after the latest worker fix.
- No automated output reconciliation exists for uncertain Google Docs side effects.
- No background lease heartbeat covers one long materialization/provider/output call.
- Safe retry/recovery behavior remains unfinished.
- Legacy deployment paths may still exist and must not be hidden by documentation cleanup.

## Latest validation notes

- Documentation authority reset is docs-only and must not change product code, runtime behavior, CI/CD, deployment, migrations, or notebooks.
- Use `docs/studio-processing-contract.md` for current Studio processing rules.
- Use `docs/runbooks/studio-platform-ops.md` for Studio operator rollout/smoke validation.
- Use `docs/runbooks/validation.md` for repository documentation and lightweight validation commands.

## Sources of truth

- Product contract: `docs/project-spec.md`.
- Workflow: `docs/ai-coding-workflow.md`.
- CI/CD and deployment safety: `docs/ci-cd-rules.md`.
- Architecture map: `docs/architecture.md`.
- Historical traceability only: `docs/delivery-plan-archive.md`.

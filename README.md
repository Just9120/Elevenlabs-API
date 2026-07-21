# ElevenLabs API / VoiceOps Studio

This repository contains two related transcription contours:

- **Stable Google Colab contour** — the current ready baseline used in real operation for batch transcription and Google Docs delivery.
- **Studio PWA contour** — a platform/PWA implementation in development at source level, intended to move the Colab workflow into a web product without changing the Colab baseline.

## Current status

The Colab workflow is stable, ready, and remains the behavioral baseline for future PWA parity. Do not refactor or change the Colab contour unless a task explicitly asks for it.

The Studio PWA is not a blank or record-only prototype. Source currently present in the repository includes authentication/sessions, projects/sources, BYOK credentials, Google OAuth/Drive integration, persisted batches/jobs, a worker entrypoint, processing orchestration, the ElevenLabs provider path, Google Docs output, diagnostics, Alembic migrations, and tests.

That source-level implementation is **not yet confirmed production-live**. Source-level retry/recovery, lease heartbeat during long external calls, output reconciliation, and source deletion/retention/cleanup are implemented and CI-verified, but production migration, production deploy, worker rollout, and a controlled end-to-end canary with exactly one output still require operator validation.

## Minimal commands

```bash
# Lightweight repository checks
python scripts/ci_checks.py

# Python tests
pytest -q

# Documentation/whitespace diff check
git diff --check
```

Runtime validation for the stable batch path is manual in Google Colab via `notebooks/elevenlabs_api_colab.ipynb`. Studio runtime authority is summarized in `docs/architecture.md`; deployment and rollout validation must follow `docs/runbooks/studio-platform-ops.md`. Current authoritative platform paths are `deploy/studio/compose.platform.yml`, `apps/studio/Dockerfile`, `apps/studio-api/Dockerfile`, `scripts/deploy_studio_platform_component.sh`, `scripts/manage_studio_worker.sh`, `scripts/migrate_studio_platform.sh`, and `deploy/studio/.env.example`. The legacy stateless web-only path is compatibility-only and not authoritative for production platform rollout.

## Main documentation map

| Document | Role |
| --- | --- |
| `AGENTS.md` | Lightweight routing rules for coding agents. |
| `docs/ai-coding-workflow.md` | AI-assisted development workflow and PR boundaries. |
| `docs/project-spec.md` | Current product/project contract and backlog authority. |
| `docs/delivery-plan.md` | Compact current delivery dashboard. |
| `docs/delivery-plan-archive.md` | Historical delivery archive; not current authority. |
| `docs/architecture.md` | Architecture map and runtime boundaries. |
| `docs/studio-processing-contract.md` | Current Studio processing invariants. |
| `docs/ci-cd-rules.md` | CI/CD, deployment, migration, and runtime safety rules. |
| `docs/runbooks/studio-platform-ops.md` | Main Studio operations and rollout runbook. |
| `docs/runbooks/legacy-studio-web-deploy.md` | LEGACY / COMPATIBILITY ONLY / NOT AUTHORITATIVE FOR PRODUCTION stateless web-only deploy path; replacement is the platform Compose/component runbook. |
| `docs/runbooks/validation.md` | Unified validation checklist and commands. |
| `docs/runbooks/realtime-colab.md` | Realtime Colab experimental validation guide. |

## Scope reminders

- Colab is stable and must remain available as the fallback/baseline contour.
- Studio PWA source can be ahead of production evidence; documentation must distinguish implemented-at-source-level from deployed or production-live.
- Do not claim ready Studio processing without factual controlled rollout evidence.

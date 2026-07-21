# ElevenLabs API / VoiceOps Studio

This repository contains two related transcription contours:

- **Stable Google Colab contour** — the current ready baseline used in real operation for batch transcription and Google Docs delivery.
- **Studio PWA contour** — a platform/PWA implementation in development at source level, intended to move the Colab workflow into a web product without changing the Colab baseline.

## Current status

The Colab workflow is stable, ready, and remains the behavioral baseline for future PWA parity. Do not refactor or change the Colab contour unless a task explicitly asks for it.

The Studio PWA is not a blank or record-only prototype. Source currently present in the repository includes authentication/sessions, projects/sources, BYOK credentials, Google OAuth/Drive integration, persisted batches/jobs, a worker entrypoint, processing orchestration, the ElevenLabs provider path, Google Docs output, diagnostics, Alembic migrations, and tests.

That source-level implementation is **not yet confirmed production-live**. Safe stage-specific retry/recovery, bounded lease heartbeat during long external calls, explicit output reconciliation, and source deletion/cleanup are implemented in repository source. Production migration/deployment, worker rollout, and a controlled end-to-end canary with exactly one output still require operator evidence.

## Minimal commands

```bash
# Lightweight repository checks
python scripts/ci_checks.py

# Python tests
pytest -q

# Documentation/whitespace diff check
git diff --check
```

Runtime validation for the stable batch path is manual in Google Colab via `notebooks/elevenlabs_api_colab.ipynb`. Studio deployment and rollout validation must follow the Studio operations runbook.

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
| `docs/runbooks/validation.md` | Unified validation checklist and commands. |
| `docs/runbooks/realtime-colab.md` | Realtime Colab experimental validation guide. |

## Scope reminders

- Colab is stable and must remain available as the fallback/baseline contour.
- Studio PWA source can be ahead of production evidence; documentation must distinguish implemented-at-source-level from deployed or production-live.
- Do not claim ready Studio processing without factual controlled rollout evidence.

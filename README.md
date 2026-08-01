# ElevenLabs API / VoiceOps Studio

This repository contains two related transcription contours:

- **Stable Google Colab contour** — the current ready baseline used in real operation for batch transcription and Google Docs delivery.
- **Studio PWA contour** — a platform/PWA in active development with a bounded production-proven core, intended to move selected Colab behavior into a web product without changing the Colab baseline.

## Current status

The Colab workflow is stable, ready, and remains the behavioral baseline for future PWA parity. Do not refactor or change the Colab contour unless a task explicitly asks for it.

The Studio PWA is not a blank or record-only prototype. Source currently includes authentication/sessions, projects/sources, BYOK credentials, Google OAuth/Drive integration, local/R2 intake, persisted batches/jobs, typed transcription options, video/long-media preparation, preflight/progress, a worker runtime, ElevenLabs processing, Google Docs output, analytics, reconciliation/recovery/retention, and separate transcript-standardization and Studio-manifest maintenance with recursive-folder or single-document targets.

The bounded one-small-source ElevenLabs-to-Google-Docs canary remains evidence only for that exact earlier scenario. Transcript maintenance now has operator evidence for production migration `0017_google_maintenance_oauth`, separate same-account server-only Google consent, and exact API health; the worker is intentionally stopped. The target-mode dry-run matrix and bounded apply/post-apply evidence remain incomplete. In particular, durable **Манифест Studio** membership must survive a fresh dry-run after apply; source code or a green workflow cannot close that gate without exact deployment and production revalidation. Current commits, percentages, blockers, and next actions live only in `docs/delivery-plan.md`.

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
| `docs/audits/repository-audit-2026-07-26.md` | Current dated repository audit evidence and recommended batch roadmap. |

## Scope reminders

- Colab is stable and must remain available as the fallback/baseline contour.
- Studio PWA source can be ahead of production evidence; documentation must distinguish implemented-at-source-level from deployed or production-live.
- Claim Studio readiness only for the exact source, component, migration, worker, provider/Google path, and canary evidence that was actually verified.

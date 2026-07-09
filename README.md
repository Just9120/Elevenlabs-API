# Elevenlabs-API

Russian-first repository for a quality-first transcription product. The primary working contour is still the Google Colab batch workflow: users select local or Google Drive sources, run provider transcription, create Google Docs transcripts, and rely on `manifest` progress/skip protection.

Studio PWA is the current development contour. Its target is to duplicate the Google Colab product scope with PWA/platform adaptations, but source-merged Studio work does not automatically mean production rollout, production processing, worker execution, provider calls, Google Docs output, or manifest mutation.

## Current contours

- **Google Colab batch workflow** — primary working contour and current stable/fallback production workflow through `notebooks/elevenlabs_api_colab.ipynb` and `elevenlabs_api.py`.
- **Studio PWA** — development/platform contour for `studio.librechat.online`; current source foundations include account/session/BYOK, projects, sources, Google Drive OAuth/metadata/folder-child selection, local temporary upload intake, persisted job records, job UI, and preflight/readiness guardrails. Studio jobs remain record-only until a separately scoped worker/provider/output pipeline exists.
- **Realtime Colab prototype / proxy** — experimental browser-capture validation contour using single-use token semantics; it does not replace batch Colab, has no Google Docs save/output, has no manifest mutation, and still requires manual Colab runtime validation.

## Main documents

- `docs/project-spec.md` — active product contract, contours, requirements, durable boundaries, and safety rules.
- `docs/delivery-plan.md` — current delivery dashboard, active item, near backlog, blockers, and status vocabulary.
- `docs/ai-coding-workflow.md` — AI-assisted development workflow and focused-task rules.
- `docs/ci-cd-rules.md` — CI/CD, deployment, runtime, migration, stateful-service, and secret-safety boundaries.
- `docs/architecture.md` — supporting observed component map and runtime/data-flow boundaries.
- `AGENTS.md` — first-read routing guide for coding agents.

## Minimal run and check guidance

- Colab runtime validation: launch `notebooks/elevenlabs_api_colab.ipynb` in Google Colab.
- Lightweight repository check: `python scripts/ci_checks.py`.
- Whitespace/diff check: `git diff --check`.
- Full local tests, when appropriate: `pytest -q` (may require services such as PostgreSQL/Redis/Alembic depending on touched areas).

Do not commit or print real secrets, tokens, environment values, private source bytes, transcript bodies, Google Docs body content, provider payloads, OAuth responses, presigned URLs, or file-mounted secret contents.

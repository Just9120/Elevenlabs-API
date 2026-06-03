# AI Coding Workflow

Status: Skeleton / needs full workflow synchronization.

This file is the repo-local entry point for AI-assisted development workflow expectations. It intentionally does not paste the full universal workflow document.

## Local source-of-truth documents

- Project source of truth: `docs/project-spec.md`.
- Operational delivery source of truth: `docs/delivery-plan.md`.
- CI/CD boundaries and repository governance: `docs/ci-cd-rules.md`.

## Agent expectations

- Codex/agents must read `docs/project-spec.md` and `docs/delivery-plan.md` before scoped PRs.
- Codex/agents must respect the CI/CD boundary in `docs/ci-cd-rules.md`.
- Changes should stay scoped to the requested delivery item and must not invent product requirements beyond accepted project context.
- Documentation-only governance work must not be described as runtime E2E validation.

## Synchronization status

The full workflow text is not yet synchronized in this repository. For now, the user-provided workflow source remains the external reference when explicitly provided:

- `AI_Coding_Workflow_with_CI_CD.updated.v4.md`

A future synchronization item may expand this skeleton if the repository adopts the full workflow text locally.

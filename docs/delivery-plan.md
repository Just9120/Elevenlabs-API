# Delivery Plan

Status: Initial synchronized delivery plan.

## Progress dashboard

- ✅ Structured Google Docs transcript output v1.2 — Done
- ✅ Docs-only existing Google Docs standardization — Done
- ✅ Strict current-standard detection — Done
- ✅ Manifest v2 migration and maintenance — Done
- ✅ Unified manifest UI — Done
- ✅ Manifest/docs report clarity — Done
- ✅ Documentation refresh for Docs standardization and manifest v2 — Done
- 👉 BOOTSTRAP-01 — Adopt docs-first workflow and CI-only governance — Current
- 📋 SYNC-01 — Review and refine project-spec.md after PR #30 — Planned
- 📋 SYNC-02 — Review and refine delivery-plan.md after PR #30 — Planned
- 📋 RUNTIME-01 — Run final Colab smoke-check on main — Planned
- 📋 DOCS-STD-01 — Apply docs-only standardization to small selected folders — Planned
- ⛔ CD-01 — CD/deploy adoption — Blocked/not applicable: no VPS/server deploy target

## Current position

- Current repository mode: Colab runtime + CI only.
- Active focus: adopt repo-local workflow docs and CI governance.
- Last completed phase: manifest v2, unified UI, report clarity, docs refresh.
- Next recommended item after this PR: review/refine project-spec and delivery-plan, then runtime smoke-check.

## Delivery checkpoints / backlog

### Checkpoint A — Google Docs transcript standard

Status: ✅ Done.

Summary/results:

- Structured Google Docs transcript output v1.2 is implemented.
- Current metadata block includes provider, model, language, speakers, and created-at timestamp.
- `Source file` and `Source mode` are intentionally not visible in Google Doc metadata.
- Strict detection treats old structured Docs containing `Source file` / `Source mode` as outdated.
- Unit coverage exists for the pure text builder; real Google Docs creation/update still requires conservative runtime validation before E2E claims.

### Checkpoint B — Existing Google Docs standardization

Status: ✅ Done.

Summary/results:

- Existing Google Docs docs-only standardization is available from the destination/output folder workflow.
- It scans selected Google Docs, optionally including nested transcript folders.
- It ignores source audio/video input, does not retranscribe, does not call provider/STT/LLM APIs, does not create new Google Docs, and does not mutate manifest.
- Dry-run is the default; explicit apply rewrites selected Google Docs in place.
- Reports separate selected folder scan, current standard status, apply impact, and safety.

### Checkpoint C — Manifest v2

Status: ✅ Done.

Summary/results:

- Manifest v2 is available at `VoiceOps Workspace/manifest/elevenlabs_transcription_manifest.json`.
- Manifest is a global workspace catalog, not a per-folder manifest.
- Manifest v2 separates documents and sources.
- Documents are keyed by Google Doc ID.
- Sources are keyed by `source_signature`.
- `standard_check` is a replaceable observation.
- Manifest schema version is independent from transcript document standard version.
- Manifest must not store transcript body text or Google Docs body content.

### Checkpoint D — UX/report clarity and documentation

Status: ✅ Done.

Summary/results:

- Unified Manifest UI exposes one manifest button: `Проверить / обновить manifest`.
- Manifest reports separate selected folder scan, manifest before, changes from selected folder, manifest after preview, and safety.
- Docs-only standardization reports separate selected folder scan, current standard status, apply impact, and safety.
- README, SECURITY, and VALIDATION_MATRIX were refreshed before PR #30 to describe Docs standardization and manifest v2 behavior.

### Checkpoint E — AI workflow and CI-only governance

Status: 👉 Current / In PR.

Work item:

- BOOTSTRAP-01 — Adopt docs-first workflow and CI-only governance.

Acceptance criteria:

- `docs/project-spec.md` exists and reflects current project.
- `docs/delivery-plan.md` exists and reflects current delivery state.
- `docs/ai-coding-workflow.md` exists as skeleton/entry point.
- `docs/ci-cd-rules.md` exists as CI-only adaptation/skeleton.
- README links to docs.
- CI has `workflow_dispatch`, concurrency, `ci_checks`, `pytest -q`, and `CI_OK`.
- No CD/deploy added.

### Checkpoint F — Runtime validation and staged rollout

Status: 📋 Planned.

Planned items:

- RUNTIME-01 — final Colab smoke-check after workflow/CI adoption.
- DOCS-STD-01 — standardize one small selected folder in apply mode after dry-run.
- DOCS-STD-02 — expand standardization gradually.
- VALIDATION-01 — update validation matrix with observed runtime evidence.

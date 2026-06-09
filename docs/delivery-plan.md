# Delivery Plan

Status: Post-PR #38/#41 synchronized delivery plan; Drive UX docs reflect safe conflict default and conservative picker double-click behavior, with Colab runtime smoke-check still pending.

## Progress dashboard

- ✅ Structured Google Docs transcript output v1.2 — Done
- ✅ Docs-only existing Google Docs standardization — Done
- ✅ Strict current-standard detection — Done
- ✅ Current manifest format migration and maintenance — Done
- ✅ Unified manifest UI — Done
- ✅ Manifest/docs report clarity — Done
- ✅ Documentation refresh for Docs standardization and current manifest behavior — Done
- ✅ PR #30 — Docs-first workflow and CI-only governance — Done
- ✅ BOOTSTRAP-01 — Adopt docs-first workflow and CI-only governance — Done
- ✅ SYNC-01 — Review and refine project-spec.md after PR #30 — Done in PR #37
- ✅ SYNC-02 — Review and refine delivery-plan.md after PR #30 — Done in PR #37
- ✅ PR #31 — Existing Docs Created at/backfill metadata fix — Done
- ✅ PR #32 — Manifest source/document sync and Russian reports — Done
- ✅ PR #33 — Manifest report scope split and simplified manifest UX wording — Done
- ✅ PR #34 — Google Drive picker-only source UX — Done
- ✅ PR #35 — Google Drive multi-file source mode — Done
- ✅ PR #36 — Legacy source-selection UI remnants cleanup — Done
- ✅ CLEANUP-01 — Document cleanup inventory and legacy boundaries — Done in PR #37
- ✅ PR #38 — Drive source selected-card dark-theme readability and safe conflict default — Done
- ✅ PR #41 — Conservative optional Drive picker double-click UX — Done
- 👉 RUNTIME-01 — Colab smoke-check after Drive UX changes — Current recommended next item
- 📋 DOCS-STD-01 — Apply docs-only standardization to small selected folders — Planned
- ⛔ CD-01 — CD/deploy adoption — Blocked/not applicable: no VPS/server deploy target

## Current position

- Current repository mode: Colab runtime + Google Drive/Docs + CI only.
- Last completed phase: post-picker Drive UX hardening: PR #38 fixed selected-card readability in Colab dark theme and changed the conflict mode default from `update` to safe `skip`; PR #41 added conservative optional double-click behavior for supported Drive picker modes.
- Cleanup inventory and legacy boundaries were documented in PR #37 and are no longer the current active item.
- Current recommended next item: RUNTIME-01 — manual Colab smoke-check after Drive UX changes. Validate these scenarios without claiming E2E success until evidence is recorded:
  - `Google Drive: 1 файл`
  - double-click folder navigation in `drive_file`
  - double-click file selection in `drive_file`
  - `Google Drive: несколько файлов`
  - manifest skip after repeat run
  - `Google Drive: папка`
- CD/deploy remains blocked/not applicable; keep CI-only governance.

## Cleanup inventory / legacy boundaries

This inventory is a cleanup guardrail for future PRs. It documents what is active, what is compatibility, what is legacy/import-only, and what must not be deleted without a separate decision. It does not authorize runtime-code removal.

### A. Active runtime flows

- `local_file`
- `local_multi`
- `drive_file`
- `drive_multi`
- `drive_folder`
- Google Docs transcript output v1.2
- manifest skip during transcription
- manifest maintenance
- docs-only existing Google Docs standardization
- runtime analytics JSONL
- CI checks

### B. Compatibility / internal migration layer

- current manifest schema version internals
- migration from old manifest entries to current manifest structure
- internal function names that still contain `v2`
- `resolve_drive_source_input(...)` and related Drive resolvers when still used by picker-generated links/IDs or tests
- legacy/current standard detection for old Google Docs with `Source file` / `Source mode` metadata

Rule: compatibility code can be cleaned only in separate PRs with tests and an explicit migration/removal decision.

### C. Legacy/import-only flows

- `import_existing_transcripts_by_name(...)`
- `on_import_existing_clicked(...)`
- `import_existing_button`

Rule: keep these for now. Do not broaden them. Do not present them as the primary workflow. Primary manifest maintenance is the manifest maintenance action. A future decision is needed: keep, hide deeper, or remove.

### D. User-facing wording policy

- Users see “manifest”, not “manifest v2”.
- Internal schema/version wording may remain technical.
- Users see Google Drive picker-first source selection.
- Picker buttons remain the reliable primary selection path; optional double-click is convenience behavior only where supported.
- Manual Drive path/link entry is not the normal UX.

### E. Do-not-delete-without-decision list

- manifest migration compatibility
- legacy import flow
- old transcript standard detection
- Drive resolver helpers used by picker/runtime/tests
- docs-only standardization safety checks
- manifest no-transcript-body protections

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
- PR #31 fixed existing Docs `Created at`/backfill metadata behavior, including visible backfill timestamp formatting.

### Checkpoint C — Manifest

Status: ✅ Done.

Summary/results:

- The manifest is available at `VoiceOps Workspace/manifest/elevenlabs_transcription_manifest.json`.
- Manifest is a global workspace catalog, not a per-folder manifest.
- The current manifest format separates documents and sources.
- Documents are keyed by Google Doc ID.
- Sources are keyed by `source_signature`.
- `standard_check` is a replaceable observation.
- Manifest schema version is independent from transcript document standard version.
- Manifest must not store transcript body text or Google Docs body content.
- PR #32 synchronized manifest source/document updates during transcription and improved Russian reports.
- PR #33 separated selected-folder report scope from global manifest report scope and simplified user-facing manifest wording.

### Checkpoint D — UX/report clarity and documentation

Status: ✅ Done.

Summary/results:

- Unified Manifest UI exposes one manifest button: `Проверить / обновить manifest`.
- Manifest reports separate selected folder scan, manifest before, changes from selected folder, manifest after preview, and safety.
- Docs-only standardization reports separate selected folder scan, current standard status, apply impact, and safety.
- PR #34 moved Google Drive source selection to picker-only UX.
- PR #35 added Google Drive multi-file source mode.
- PR #36 cleaned up legacy source-selection UI remnants.
- PR #38 fixed Drive source selected-card readability in Colab dark theme and changed the conflict mode default to safe `skip`.
- PR #41 added conservative optional double-click behavior: `drive_file` supports folder double-click navigation and file double-click selection, `drive_folder` supports folder double-click navigation only, and `drive_multi` remains explicit/button-based for safety.
- README, SECURITY, and VALIDATION_MATRIX were refreshed before PR #30 to describe Docs standardization and manifest behavior.

### Checkpoint E — AI workflow and CI-only governance

Status: ✅ Done.

Completed item:

- BOOTSTRAP-01 — Adopt docs-first workflow and CI-only governance.

Results:

- `docs/project-spec.md` exists and reflects current project scope.
- `docs/delivery-plan.md` exists and reflects current delivery state.
- `docs/ai-coding-workflow.md` exists as the workflow entry point.
- `docs/ci-cd-rules.md` exists as CI-only adaptation/skeleton.
- README links to docs.
- CI has `workflow_dispatch`, concurrency, `ci_checks`, `pytest -q`, and `CI_OK`.
- No CD/deploy was added.

### Checkpoint F — Runtime validation and staged rollout

Status: 📋 Planned.

Planned items:

- RUNTIME-01 — Colab smoke-check after Drive UX changes for Drive single-file, optional `drive_file` double-click folder navigation, optional `drive_file` double-click file selection, Drive multi-file, repeat-run manifest skip, and Drive folder.
- DOCS-STD-01 — standardize one small selected folder in apply mode after dry-run.
- DOCS-STD-02 — expand standardization gradually.
- VALIDATION-01 — update validation matrix with observed runtime evidence.

Compact RUNTIME-01 checklist:

- Start a fresh Colab runtime from the latest `main` branch.
- Validate Drive single-file selection for `Google Drive: 1 файл` using the reliable button path.
- Validate optional double-click behavior: folder navigation in `drive_file` and file selection in `drive_file`.
- Validate `Google Drive: несколько файлов` processes exactly the selected supported files and remains explicit/button-based.
- Repeat a controlled run and confirm manifest skip prevents duplicate source processing.
- Validate `Google Drive: папка` with a small folder run.
- Confirm logs/manifest do not include secrets, transcript body, provider raw responses, or Google Docs body content.

### Checkpoint G — Cleanup inventory and safe boundaries

Status: ✅ Done in PR #37.

Work item:

- CLEANUP-01 — Document cleanup inventory and legacy boundaries.

Acceptance criteria:

- Delivery plan reflects the post-PR #30–36 state.
- Project spec describes active runtime, compatibility, and legacy/import-only boundaries.
- User-facing delivery wording says “manifest” or “current manifest format” instead of “manifest v2”.
- Validation matrix captures cleanup-inventory validation conservatively.
- Future coding workflow warns against opportunistic deletion of migration/recovery code.
- No runtime code, manifest schema, transcript standard, Google Docs behavior, provider/STT/LLM behavior, deploy/CD, DB/cache/queue/vector store, or CI governance change is introduced.

### Checkpoint G — Optional speaker projects for diarized Google Docs

Status: ✅ Implemented for pure helpers and Colab UI; live Google Docs apply requires manual Colab validation.

Summary/results:

- Added an optional section for `Проекты и спикеры / Переименовать спикеров в Google Doc` after a diarized Google Doc already exists.
- The workflow detects `Speaker N:` labels at turn boundaries, shows first meaningful samples, lets the user create/select projects and active speakers, accepts a manual mapping, previews replacement counts, and requires an explicit apply.
- Speaker projects are stored separately from the manifest in `VoiceOps Workspace/projects/speaker_projects.json` and do not store transcript body text, samples, provider responses, or Google Docs body content.
- This is manual speaker naming, not voice identification: no voice samples, voiceprints, embeddings, biometric matching, provider/STT calls, or LLM calls are used.
- The MVP apply path rewrites the Google Doc as plain text and warns the user before applying; manual Colab validation on a copy is required to confirm live Docs behavior and formatting expectations.

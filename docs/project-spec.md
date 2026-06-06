# Project Specification

Status: Post-PR #30–36 synchronized project spec; PR #37 documents cleanup boundaries only.
Source basis: current README, SECURITY, VALIDATION_MATRIX, current code behavior, accepted PR state through PR #36, and the PR #37 cleanup inventory.

## 1. Product goal

Provide a Google Colab-based workflow for quality-first transcription of long audio/video files into Google Docs, with manifest protection against repeated transcription and repeated provider billing.

## 2. Current scope

Current supported scope is limited to the repository's Colab + Google Drive/Docs operating model:

- Google Colab launcher workflow.
- `Компьютер: 1 файл` and `Компьютер: несколько файлов` source modes.
- `Google Drive: 1 файл`, `Google Drive: несколько файлов`, and `Google Drive: папка` source modes.
- Audio extraction from video when enabled.
- ElevenLabs main provider path.
- OpenAI manual fallback / alternative provider path.
- Google Docs output as the primary transcript artifact.
- Structured Google Docs transcript standard v1.2.
- Existing Google Docs docs-only standardization.
- Manifest maintenance.
- Runtime analytics JSONL as diagnostics.
- CI-only GitHub Actions validation.

## 3. Active vs compatibility vs legacy

This section defines cleanup boundaries. It is documentation-only and does not authorize deleting runtime code without a separate scoped PR.

### Active runtime flows

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

### Compatibility / internal migration layer

- current manifest schema version internals
- migration from old manifest entries to current manifest structure
- internal function names that still contain `v2`
- `resolve_drive_source_input(...)` and related Drive resolvers when still used by picker-generated links/IDs or tests
- legacy/current standard detection for old Google Docs with `Source file` / `Source mode` metadata

Compatibility code can be cleaned only in separate PRs with tests and an explicit migration/removal decision. User-facing docs and UI should say “manifest” or “current manifest format”; technical schema names, versions, JSON keys, function names, and migration explanations may remain technical.

### Legacy/import-only helper

- `import_existing_transcripts_by_name(...)`
- `on_import_existing_clicked(...)`
- `import_existing_button`

Keep these for now. Do not broaden them. Do not present them as the primary workflow. Primary manifest maintenance is the manifest maintenance action. A future decision is needed: keep, hide deeper, or remove.

### Do not delete without explicit decision

- manifest migration compatibility
- legacy import flow
- old transcript standard detection
- Drive resolver helpers used by picker/runtime/tests
- docs-only standardization safety checks
- manifest no-transcript-body protections

## 4. Out of scope

The following are not part of the current repository scope:

- CD/deploy/VPS automation.
- Docker deployment.
- Database/persistence layer outside Google Drive/Docs runtime artifacts.
- Mandatory GitHub Issues backlog.
- Semantic summarization or LLM enrichment of transcript body.
- Creating Markdown/JSON mirrored transcript exports as primary output.
- Calling provider/STT/LLM APIs during docs-only standardization or manifest maintenance.
- Storing transcript body text in manifest.
- Multi-user concurrent runtime coordination.

## 5. User roles

- Primary operator using Colab to configure sources, provider path, output folder, manifest actions, and docs-only standardization.
- Reviewer/maintainer checking pull requests, documentation consistency, validation evidence, and CI results.
- Coding agent / Codex working through repository docs and scoped PRs without changing runtime behavior beyond the requested delivery item.

## 6. Core scenarios

- Transcribe one local file.
- Transcribe multiple local files.
- Transcribe one Google Drive file.
- Transcribe selected specific Google Drive files.
- Transcribe a Google Drive folder.
- Standardize existing Google Docs transcripts.
- Update/refresh manifest.
- Runtime smoke-check after changes.

## 7. Functional requirements

- Allow source selection across `Компьютер: 1 файл`, `Компьютер: несколько файлов`, `Google Drive: 1 файл`, `Google Drive: несколько файлов` (`drive_multi`), and `Google Drive: папка`. In the normal runtime UX, Google Drive sources are selected through the Drive picker / folder scrolling UI, not through manual Google Drive path/link entry.
- Google Drive multi-file selection (`drive_multi`) is picker-only: it processes exactly the selected supported files in the current picker folder, does not recurse, does not process folders, and writes all selected files for one run into one selected destination/output folder.
- Allow destination/output Google Docs folder selection. One destination/output folder is used per run, and all outputs from that run are saved into the selected folder.
- Allow provider selection for the supported ElevenLabs and OpenAI paths.
- Support optional speaker split where the selected provider path supports it.
- Support optional keyterms where the selected provider path supports them.
- Support conflict mode for existing Google Docs outputs.
- Produce structured Google Docs output according to transcript document standard v1.2:

  ```text
  Document title

  Transcript metadata
  Provider: <ElevenLabs | OpenAI | unknown>
  Model: <model id | unknown>
  Language: <Русский | Автоопределение | unknown>
  Speakers: <yes | no | unknown>
  Created at: <runtime-created timestamp | YYYY-MM-DD HH:MM UTC | unknown>

  Transcript

  <body>
  ```

- Use manifest skip behavior to avoid repeated source processing where manifest state indicates a source has already been processed with matching settings.
- Provide docs-only standardization for existing Google Docs that scans a selected destination/output folder, optionally recurses into nested transcript folders, ignores source audio/video input, does not retranscribe, does not call STT/provider/LLM APIs, does not create new Google Docs, does not mutate manifest, defaults to dry-run, and rewrites selected Google Docs in place only in explicit apply mode.
- Existing Google Docs backfill, including refresh of already-current-shaped old backfill Docs that still contain old `unknown` defaults or non-visible timestamp formatting, uses temporary known defaults for historical transcript Docs: `Provider: ElevenLabs`, `Model: scribe_v2`, `Language: Русский`, and `Speakers: unknown`. Speakers are not inferred automatically.
- Existing Google Docs backfill preserves visible `Created at` from existing transcript metadata first, falls back to Google Drive `createdTime`, and otherwise uses `unknown`; `Created at` must not mean standardization time. Newly created transcript Docs may use the runtime-created timestamp format as currently implemented. Existing Docs backfill visible `Created at` uses `YYYY-MM-DD HH:MM UTC`, while internal manifest/check/report timestamps may remain full ISO. No new visible metadata fields are added.
- Maintain manifest as a global workspace catalog with separate `documents`, `sources`, and `summary` sections. Successful transcription completion must immediately mark `sources` done, upsert the matching `documents` record, link `source_signatures`, and refresh summary totals. Manifest maintenance is a reconciliation/refresh action, not the normal way new transcription Docs enter the document catalog.

## 8. Business rules

- Avoid repeated provider billing through manifest skip behavior.
- Dry-run is the default for docs-only standardization and manifest maintenance.
- Apply mode must be explicit.
- Existing Docs standardization rewrites selected Google Docs in place only.
- Manifest maintenance updates manifest only and does not mutate Google Docs. It must not be required to repair every normal successful transcription before the document catalog sees the new Google Doc.
- Strict standard detection is required: old structured Docs with visible `Source file` / `Source mode` metadata are outdated, not current.

## 9. Data and state model

- No database is currently used.
- The system of record for transcript content is Google Docs.
- Operational metadata is stored in Google Drive manifest JSON at `VoiceOps Workspace/manifest/elevenlabs_transcription_manifest.json`.
- Runtime diagnostics are stored as Google Drive analytics JSONL at `VoiceOps Workspace/analytics/elevenlabs_transcription_runs.jsonl`.
- Manifest separates `documents`, `sources`, and `summary` in the current internal schema.
- Manifest documents are keyed by Google Doc ID.
- Manifest sources are keyed by `source_signature`.
- Manifest runtime source/document sync stores document metadata and standard status only; it must not store transcript body text or Google Docs body content.
- User-facing UI/report/docs wording refers to this as manifest; internal schema version 2 remains a technical implementation detail.
- `standard_check` is a replaceable observation, not the transcript body.
- Manifest schema version is independent from transcript document standard version.
- Manifest must not store transcript body text or Google Docs body content.
- Vector DB, cache, and queue systems are not used.
- Any future DB, object storage, queue, cache, or scaling storage change must be handled as a separate delivery item.

## 10. Integrations

- Google Colab.
- Google Drive API.
- Google Docs API.
- ElevenLabs API.
- OpenAI API optional/experimental paths.
- GitHub Actions CI.

## 11. Non-functional requirements

- Quality-first transcription.
- Long-file robustness.
- Safe dry-run UX for maintenance flows.
- Clear reports that separate selected folder scan, current state, proposed changes, preview, apply impact, and safety notes.
- No transcript text in logs or manifest.
- Conservative retry behavior for transient Google Drive/Docs write/update failures.
- CI must be lightweight and must not rely on external runtime secrets.

## 12. Architecture constraints

- Main runtime is Colab, not a server.
- No CD/deploy is adopted.
- No database is used.
- Manifest is a global workspace catalog, not a per-folder manifest.
- Docs-only actions use destination/output folder, not source folder.
- Source folder recursion applies to source transcription workflows only.
- Destination/output recursion applies to existing Google Docs maintenance flows.

## 13. Security and safety constraints

- Secrets must come from Colab userdata only.
- API keys must not be committed.
- Raw provider responses must not be logged.
- Transcript body text must not be stored in manifest, reports, or analytics.
- Google Docs body content must not be stored in manifest, reports, or analytics.
- Docs-only standardization and manifest maintenance must not call provider/STT/LLM APIs.
- Manifest backups are sensitive operational metadata.

## 14. Observability, logging and diagnostics

- Colab preflight summary must show operational configuration without secret values.
- Analytics JSONL provides runtime diagnostics.
- Provider HTTP error logging must be safe and must not include raw provider response bodies.
- Standardization and manifest reports should make scan scope, status, apply impact, previews, and safety boundaries clear. User-visible Colab report labels are localized to Russian; internal manifest schema keys, JSON keys, report dict keys, function names, and tests remain English.

## 15. Testing and validation requirements

- Run `python scripts/ci_checks.py` for repository hygiene checks.
- Run `pytest -q` for unit tests.
- Use GitHub Actions CI for pull request and main-branch validation.
- Runtime E2E/smoke checks remain manual and must be explicitly recorded.
- Do not overclaim E2E validation from unit tests, CI checks, or documentation-only changes.

## 16. MVP / release readiness criteria

Current practical readiness means:

- Colab launcher works.
- CI is green.
- Structured Docs output is covered by tests.
- Docs-only standardization dry-run/apply is validated cautiously on small folders before broad use.
- Manifest is runtime smoke-checked.
- Further provider paths require scenario-specific E2E validation before stronger claims.

## 17. Open questions

- Whether to eventually add database or object storage.
- Whether to formalize E2E runtime checklists.
- Whether OpenAI diarization path should become supported or remain experimental.
- Whether CD/deploy will ever be relevant; currently no.

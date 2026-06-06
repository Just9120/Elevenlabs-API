# Workflow транскрибации в Google Docs

Colab-based workflow для quality-first транскрибации длинных аудио- и видеофайлов в Google Docs с защитой от повторной траты кредитов через manifest.

## Overview

Проект — это не просто API-обёртка, а целостный workflow:

- выбрать источник аудио/видео;
- при необходимости извлечь аудио из видео;
- выполнить транскрибацию через выбранного provider path;
- объединить результат;
- записать финальный transcript сразу в Google Docs;
- сохранить операционное состояние в manifest, чтобы повторные запуски могли пропускать уже обработанные source-файлы.

Основные runtime-артефакты в Google Drive:

- `VoiceOps Workspace/manifest/elevenlabs_transcription_manifest.json`
- `VoiceOps Workspace/analytics/elevenlabs_transcription_runs.jsonl`

Провайдерная стратегия:

- основной provider path: `ElevenLabs / scribe_v2`;
- manual fallback / alternative provider path: `OpenAI / gpt-4o-transcribe`;
- speaker-aware experimental path: `OpenAI / gpt-4o-transcribe-diarize`.

OpenAI fallback добавлен архитектурно, но не все ветки подтверждены полными E2E-прогонами. `OpenAI diarization + chunking` остаётся high-risk из-за возможной inconsistency speaker labels across chunks.

## Quick start in Colab

Основной поддерживаемый способ запуска — Google Colab launcher:

- `notebooks/elevenlabs_api_colab.ipynb`

Как открыть:

1. В Google Colab выберите **Open notebook → GitHub**.
2. Укажите репозиторий и откройте `notebooks/elevenlabs_api_colab.ipynb`.
3. По умолчанию launcher использует `GITHUB_REF = "main"`.
4. Если нужна фиксированная версия, замените `GITHUB_REF` на конкретный commit SHA в первой code-ячейке launcher-ноутбука.
5. Добавьте секреты через Google Colab Secrets / `userdata`:
   - `ELEVENLABS_API_KEY` — нужен для ElevenLabs;
   - `OPENAI_API_KEY` — опционально, только для OpenAI paths.
6. Запустите ячейки launcher-ноутбука: он установит `requirements-colab.txt`, подтянет `elevenlabs_api.py` из выбранного GitHub ref и выполнит workflow в текущем runtime.

Перед transcription run Colab выводит read-only preflight summary: provider/model, наличие нужных API keys без печати значений, source mode, output destination, manifest status, keyterms и risk notes.

## Main workflows

### 1. Transcription workflow

Используется, когда нужно создать новый Google Docs transcript из audio/video source.

Поддерживаемые source modes:

- computer: single file;
- computer: multiple files;
- Google Drive: single file;
- Google Drive: folder.

В нормальном Colab UX Google Drive source выбирается через встроенный Drive picker / folder scrolling UI: для режима single file нужно выбрать один поддерживаемый файл в списке, а для режима folder — открыть нужную папку и нажать `Выбрать текущую папку`. Ручной ввод Google Drive path/link не является обычным пользовательским workflow; низкоуровневые helpers для legacy/compatibility могут сохраняться внутри кода. Local computer upload modes остаются без изменений.

Source folder и destination/output folder — разные понятия:

- **Source folder** содержит audio/video/source files. Он используется только transcription workflows. Recursive source scan применяется только к этому folder concept.
- **Destination/output folder** содержит Google Docs transcript outputs. Он используется для записи новых Docs, docs-only standardization и Manifest maintenance. Для docs-only actions source input игнорируется. Папка назначения одна на запуск: все результаты текущего запуска сохраняются в выбранную destination/output folder.

Финальный transcription result сохраняется только в Google Docs. Локальные transcript-файлы, Markdown-зеркала и JSON-экспорты не являются основным конечным артефактом.

### 2. Existing Google Docs standardization

UI label: `Проверить / стандартизировать существующие Google Docs`.

Этот workflow приводит уже существующие Google Docs transcripts к текущему document standard без retranscription. Он работает по выбранному destination/output folder, а не по source folder.

### 3. Manifest maintenance

UI label: `Проверить / обновить manifest`.

Этот workflow обслуживает глобальный workspace catalog `VoiceOps Workspace/manifest/elevenlabs_transcription_manifest.json`. Он сканирует выбранный destination/output folder, но manifest остаётся глобальным, а не per-folder. После успешной обычной транскрибации manifest сразу синхронизирует запись `sources` с соответствующей записью `documents`; maintenance нужен для последующей сверки/refresh, а не как основной способ появления новых transcription Docs в каталоге.

## Google Docs transcript standard

Current transcript document standard: `transcript_doc_v1.2`.

Новые Google Docs создаются с компактной LLM-readable структурой: document title, metadata block, heading `Transcript`, then body.

```text
Document title

Transcript metadata
Provider: <ElevenLabs | OpenAI | unknown>
Model: <model id | unknown>
Language: <Русский | Автоопределение | unknown>
Speakers: <yes | no | unknown>
Created at: <ISO timestamp>

Transcript

<body>
```

Important details:

- `Source file` and `Source mode` are intentionally **not visible** in Google Doc metadata.
- Old structured docs that still include `Source file` / `Source mode` in visible metadata are outdated, not current.
- Detection is strict: old-standard docs appear as “would standardize” during dry-run.
- Body wording is preserved when a Doc is standardized.
- No semantic segmentation, summarization, rewriting, or LLM enrichment is performed.
- Metadata is built from already available runtime state for new transcription Docs and does not require extra readback, LLM, or provider calls.

## Existing Google Docs standardization

UI label: `Проверить / стандартизировать существующие Google Docs`.

Use this for already completed transcript Docs that should be normalized to `transcript_doc_v1.2`.

Behavior:

- scans the selected **destination/output folder**;
- optionally scans nested transcript folders when recursive scan is enabled;
- ignores source audio/video input, source mode, source path and source link;
- does not retranscribe;
- does not call ElevenLabs, OpenAI, STT, diarization, provider, or LLM APIs;
- does not create new Google Docs;
- does not create Markdown/JSON/mirrored folders/export artifacts;
- does not read manifest for decisions and does not mutate manifest;
- ignores PDFs, audio/video files and other non-Google-Docs files;
- defaults to dry-run;
- apply mode is explicit and rewrites selected Google Docs in place;
- user-visible Colab report labels are localized to Russian while internal report dict keys and manifest JSON keys remain English;
- recommended operational practice: apply on small folders first, review the result, then proceed to larger folders.

Existing Google Docs backfill, including refresh of already-current-shaped old backfill Docs that still contain `unknown` defaults or full-ISO visible timestamps, uses temporary known defaults for historical transcript Docs produced through ElevenLabs: `Provider: ElevenLabs`, `Model: scribe_v2`, `Language: Русский`, and `Speakers: unknown`. Speakers are not inferred automatically. `Created at` is preserved from existing visible transcript metadata when present, otherwise it falls back to Google Drive `createdTime`, and otherwise becomes `unknown`; it must not mean the standardization time. The visible backfill timestamp format is `YYYY-MM-DD HH:MM UTC`, while internal manifest/check/report timestamps may remain full ISO. Source filename/mode are not added to visible metadata, and no new visible metadata fields such as `Standardized at` are added.

## Manifest

UI label: `Проверить / обновить manifest`.

Manifest is a **global workspace catalog**, not a per-folder report. The unified Manifest action scans the selected destination/output folder and adds or refreshes records in the same global manifest. Selecting another folder later adds/refreshes records for that folder; it does not remove older records from other folders.

Successful transcription completion updates manifest immediately: `sources[source_signature]` is marked `done`, `documents[doc_id]` is upserted, `document.source_signatures` is linked, and summary totals are refreshed without storing transcript body text. Manifest maintenance is therefore a reconciliation/refresh action for selected-folder observations, not the normal path by which newly created transcription Google Docs enter the document catalog.

Manifest maintenance:

- scans the selected destination/output folder;
- optionally scans nested transcript folders when recursive scan is enabled;
- does not change Google Docs content;
- does not create Google Docs;
- does not call ElevenLabs, OpenAI, STT, diarization, provider, or LLM APIs;
- dry-run is read-only: no folder creation, backup creation, active manifest write, Docs mutation or provider calls;
- apply updates manifest only;
- if the active manifest uses the old format, apply creates a timestamped backup and updates it to the current format;
- if the active manifest is already in the current format, apply refreshes `documents`, `sources` and `standard_check` only when material changes exist;
- checked-at-only differences should not be treated as material changes;
- manifest must not store transcript body text or Google Docs body content;
- user-visible Colab manifest reports are localized to Russian while manifest schema keys, JSON keys, internal report dict keys, and code identifiers remain English.

Internal schema (technical detail):

Internally, the manifest uses schema version 2, but the UI refers to it simply as manifest.

Conceptual schema:

Top-level:

- `version`
- `schema`
- `updated_at`
- `documents`
- `sources`
- `summary`

`documents`:

- keyed by Google Doc ID;
- stores `doc_id`, `doc_name`, `doc_link`, `doc_path`, `doc_mime_type`;
- stores `source_signatures`;
- stores `standard_check`.

`sources`:

- keyed by `source_signature`;
- stores source processing state;
- preserves skip behavior for repeated transcription runs, including already-processed sources.

`standard_check`:

- `target_standard`
- `detected_standard`
- `status`
- `checked_at`
- `checker_version`

Manifest schema version is independent from transcript document standard version. For example, moving from `transcript_doc_v1.2` to a future `transcript_doc_v1.3` should update `standard_check` observations, not require a manifest format change by itself.

## Report semantics

### Manifest report

- **МАНИФЕСТ — ВЫБРАННАЯ ПАПКА** = what happened to the current selected destination/output folder.
- **Скан выбранной папки** and **Изменения по выбранной папке** are selected-folder-only counters.
- **ГЛОБАЛЬНЫЙ MANIFEST — СПРАВОЧНО** = reference statistics for the whole global manifest, not only the selected folder.
- **Проверка стандарта по глобальному каталогу** makes scope explicit so global unstructured/error counts are not confused with the selected-folder result.
- **БЕЗОПАСНОСТЬ** confirms no Google Docs content changes, no provider/STT/LLM calls, and whether manifest/backup writes are needed.

### Docs standardization report

- **Скан выбранной папки** = selected Google Docs only, optionally including nested folders when recursive scan is enabled.
- **Текущий статус стандарта** = `current`, `outdated`, `unstructured`, or `unreadable`.
- **Влияние apply** = documents that would be rewritten in place.
- **Безопасность** = no provider calls, no new Docs, no manifest mutation.

## Safety model

- Secrets must come from Google Colab Secrets / `userdata`; never commit API keys.
- Reports and analytics must not print transcript body text, Google Docs body content, raw provider responses, or secret values.
- Manifest must not store transcript body text or Google Docs body content.
- Docs-only standardization reads Google Docs and rewrites them only in explicit apply mode.
- Manifest maintenance may read Docs to classify `standard_check`, but stores only document/source metadata and classification status.
- Provider/STT/LLM APIs are not called by docs-only standardization or manifest maintenance.
- Manifest is designed for single-user / single-runtime Colab usage. Parallel runs from two Colab tabs are not supported.
- Google Drive write/update requests use conservative retry for transient Google API failures. Google Docs text insertion retry is intentionally narrower because `insertText` is not fully idempotent. STT provider calls are unchanged.
- Runtime analytics JSONL in Google Drive are diagnostic only and must not include secrets, transcript text, raw provider responses, or Google Docs contents.

## Troubleshooting

### “I selected a folder with 5 Docs but manifest says 86 documents”

That is expected when the global manifest already contains records from other folders. **Скан выбранной папки** is the 5 Docs in the folder you selected. **ГЛОБАЛЬНЫЙ MANIFEST — СПРАВОЧНО** is the whole manifest reference catalog, so it can show 86 total documents. Successful transcription-created Docs should already enter `documents` immediately; if maintenance still proposes additions, they are reconciliation/backfill candidates rather than the normal runtime catalog path.

### “Why are old structured docs shown as Would standardize?”

Current detection is strict for `transcript_doc_v1.2`. Old structured Docs with outdated visible metadata such as `Source file` / `Source mode` are not considered current and are reported as `would_standardize` in dry-run.

### “Why are most docs unstructured?”

They likely do not have the expected `Transcript metadata` block and `Transcript` structure. They can still be readable Google Docs, but they are not current structured transcript Docs.

### “Why do I have archive manifest files?”

When apply migrates an active v1 manifest to v2, it creates a timestamped backup in `VoiceOps Workspace/manifest/archive` before replacing the active manifest.

### “Can I delete archive backups?”

Deletion is manual and not required. Keep at least the latest backups until successful runtime validation confirms that the migrated v2 manifest works for your workspace.

### “Does Manifest change Google Docs?”

No. `Проверить / обновить manifest` updates manifest only in apply mode and never changes Google Docs content.

### “Does docs-only standardization call ElevenLabs/OpenAI?”

No. `Проверить / стандартизировать существующие Google Docs` reads selected Google Docs and, only in apply mode, rewrites those Docs in place. It does not call ElevenLabs, OpenAI, STT, diarization, provider, or LLM APIs.

## Developer validation

Local repository checks:

```bash
python scripts/ci_checks.py
pytest -q
```

GitHub Actions CI is intentionally lightweight:

- static repository hygiene checks;
- notebook JSON and clean-output checks;
- launcher notebook thinness guard;
- conservative static guards for raw provider `resp.text` logging and broad `/tmp` cleanup patterns;
- `pytest` when tests exist.

Non-goals of CI:

- no real Colab transcription runs;
- no ElevenLabs/OpenAI/Google API calls;
- no provider or Google credentials required;
- no deployment/CD.

Runtime confidence is tracked conservatively in `VALIDATION_MATRIX.md`. Unit tests and smoke observations must not be described as formal E2E validation unless a reproducible E2E run has actually been performed.

## Documentation

- [`docs/project-spec.md`](docs/project-spec.md) — current project source of truth.
- [`docs/delivery-plan.md`](docs/delivery-plan.md) — operational delivery state and next steps.
- [`docs/ai-coding-workflow.md`](docs/ai-coding-workflow.md) — repo-local AI coding workflow entry point.
- [`docs/ci-cd-rules.md`](docs/ci-cd-rules.md) — CI-only governance boundaries; CD/deploy is not adopted.
- [`SECURITY.md`](SECURITY.md) — security and safety guidance.
- [`VALIDATION_MATRIX.md`](VALIDATION_MATRIX.md) — conservative validation evidence and gaps.
- [`docs/VOICEOPS_RUNTIME_VALIDATION_CHECKLIST.md`](docs/VOICEOPS_RUNTIME_VALIDATION_CHECKLIST.md) — manual runtime validation checklist.
- [`TECHNICAL_SPECIFICATION.md`](TECHNICAL_SPECIFICATION.md) — legacy technical specification reference.

# Workflow транскрибации в Google Docs

Colab-based workflow для quality-first транскрибации длинных аудио- и видеофайлов в Google Docs.

## Что это за проект

Проект предназначен для транскрибации длинных русскоязычных лекций, вебинаров, созвонов и учебных записей с упором на:
- качество распознавания;
- устойчивость на длинных файлах;
- финальный результат сразу в Google Docs;
- защиту от повторной траты кредитов через manifest.

Это не просто API-обёртка, а целостный workflow:
- выбор источника;
- извлечение аудио из видео при необходимости;
- транскрибация через выбранного провайдера;
- постобработка и merge;
- запись результата в Google Docs;
- фиксация состояния в manifest.

Drive runtime state artifacts are organized under:
- `VoiceOps Workspace/manifest/elevenlabs_transcription_manifest.json`
- `VoiceOps Workspace/analytics/elevenlabs_transcription_runs.jsonl`

## Провайдерная стратегия

- Основной провайдер: `ElevenLabs / scribe_v2`
- Fallback: `OpenAI / gpt-4o-transcribe`
- Speaker-aware сценарий: `OpenAI / gpt-4o-transcribe-diarize`

Важно:
- основной production-путь сейчас — ElevenLabs;
- OpenAI fallback добавлен архитектурно, но не все его ветки ещё подтверждены полными end-to-end прогонами;
- для OpenAI diarization + chunking есть известные ограничения.

## Поддерживаемые режимы источника

- computer: single file;
- computer: multiple files;
- Google Drive: single file;
- Google Drive: folder.

## Формат результата

Финальный результат сохраняется:
- только в Google Docs.

Новые Google Docs создаются с компактной LLM-readable структурой v1.2: title, transcript metadata, heading `Transcript`, then transcript body. Metadata is built from already available runtime state (provider/model/language/speaker setting/timestamp) and does not require extra readback, LLM, or provider calls. New transcriptions remain structured by default; there is no extra setting that makes users choose whether new Docs are structured.

Current transcript document standard v1.2:

```text
Document title

Transcript metadata
Provider: <ElevenLabs | OpenAI | unknown>
Model: <model id | unknown>
Language: <Русский | Автоопределение | unknown>
Speakers: <yes | no | unknown>
Created at: <ISO timestamp>

Transcript

<transcript body>
```

Source filename and source mode are intentionally not included in the visible Google Doc metadata block. The document is optimized for downstream text analysis in tools such as LLMs and NotebookLM, where provider/model/language/speaker/timestamp context is useful and source-routing details add little value.

### Existing transcript standardization

Primary recommended flow for existing transcripts is docs-only standardization:
- it works directly on already completed Google Docs in the selected destination/output Google Docs folder;
- the docs-only controls are tied to the destination folder picker, not the source/input section;
- source audio/video recordings, source mode, and source path/link are not needed and are ignored;
- no retranscription happens;
- no ElevenLabs, OpenAI, STT, diarization, or LLM APIs are called;
- no new Google Docs, Markdown, JSON, mirrored folders, or export artifacts are created;
- manifest is not read for decisions and is not mutated;
- PDFs, audio/video files, folders as targets, and all non-Google-Docs files are ignored; folders are counted separately as `folders_seen`;
- enable recursive scan when transcripts live inside nested folders/modules under the selected destination folder;
- dry-run is the default and reports `google_docs_scanned`, `folders_seen`, `skipped_non_google_docs`, `already_structured`, `would_standardize`, `standardized`, and `errors`;
- apply mode is explicit and rewrites the same existing Google Doc in place with the current v1.2 structure;
- old-standard structured docs that still include `Source file:` / `Source mode:` are treated as outdated and appear in dry-run as `would_standardize`, not `already_structured`.

Metadata for docs-only standardization is intentionally conservative: `Provider` / `Model` / `Language` / `Speakers` are `unknown`, `Created at` is the current timestamp, and no source filename or source mode is embedded in the visible metadata block.

### Existing Google Docs manifest registration

A separate docs-only button can register already existing Google Docs transcripts in `VoiceOps Workspace/manifest/elevenlabs_transcription_manifest.json` without requiring source audio/video files. This mode:

- scans the selected destination/output Google Docs folder (and optionally nested folders when recursive scan is enabled);
- ignores source audio/video input, source mode, and source path/link;
- does not retranscribe and does not call ElevenLabs, OpenAI, STT, diarization, or LLM APIs;
- does not create Google Docs and does not change Google Docs document contents;
- defaults to dry-run (`Только проверить manifest, не изменять`);
- in apply mode writes or updates manifest entries only;
- keys entries by a stable hash of `{ "source_type": "existing_google_doc", "doc_id": "<google_doc_id>" }`, so later document renames do not create a different primary manifest key.

The flow classifies each readable Google Doc as `current_standard`, `outdated_standard`, or `unstructured`; unreadable Docs are reported as `unreadable`. The manifest stays at `version: 1` and adds human-readable entry fields for existing Docs, for example:

```json
{
  "source_signature": "<sha256>",
  "source_type": "existing_google_doc",
  "status": "doc_registered",
  "standard": "transcript_doc_v1.2",
  "doc_id": "<google_doc_id>",
  "doc_name": "Existing transcript",
  "doc_link": "https://docs.google.com/document/d/<google_doc_id>/edit",
  "doc_path": "MyDrive/Transcripts/Existing transcript",
  "doc_mime_type": "application/vnd.google-apps.document",
  "structured_status": "current_standard",
  "source_name": "Existing transcript",
  "note": "",
  "updated_at": "<ISO timestamp>",
  "source_meta": {
    "folder_id": "<selected_output_folder_id>",
    "folder_path": "MyDrive/Transcripts",
    "recursive_scan": false,
    "registration_mode": "existing_google_doc_manifest_registration"
  }
}
```

This registration flow is intentionally separate from docs-only standardization: standardization rewrites Docs in explicit apply mode; manifest registration writes only manifest entries and never mutates document text.

Doc registry entries created by this flow are also intentionally separate from older source-based transcription manifest entries. A Google Doc may already be referenced by a normal source audio/video/file transcription entry through `doc_id` or `doc_link`, but still appear as `would_register` because it does not yet have the new `source_type: existing_google_doc` / `status: doc_registered` registry entry keyed by Google Doc ID. To make that reconciliation clear, dry-run/apply reports source-linked manifest matches separately; those matches are informational only and are not counted as `already_registered`. Apply mode writes or updates only the doc registry entry and does not modify, merge, delete, or rewrite existing source-based entries.

The older source-matching standardization/import flow remains an optional advanced/legacy path for cases where someone specifically wants source-to-doc matching. It is not required for normal existing transcript standardization. Runtime E2E validation in Colab/Drive remains required before broad use of docs-only apply mode.

Локальные transcript-файлы, Markdown-зеркала и JSON-экспорты не считаются основным конечным артефактом.

## Секреты

Секреты не должны храниться в коде.

Для работы используются Google Colab Secrets / `userdata`:
- `ELEVENLABS_API_KEY`
- `OPENAI_API_KEY` — опционально, нужен только для OpenAI fallback
- другие Google-related credentials при необходимости

Пример доступа к секретам:

```python
from google.colab import userdata

ELEVENLABS_API_KEY = userdata.get("ELEVENLABS_API_KEY")
OPENAI_API_KEY = userdata.get("OPENAI_API_KEY")
```


## Статус Colab workflow и границы валидации

- **Google Colab остаётся основным и поддерживаемым способом запуска**.
- Текущий workflow используется в практике **более месяца без критических user-reported проблем**.
- Эта практическая стабильность **не равна формальной E2E-валидации каждого отдельного сценария**; для этого используется отдельная validation matrix.
- `ElevenLabs / scribe_v2` остаётся основным provider path.
- `OpenAI` сейчас используется как **manual fallback / alternative provider path**.
- **Automatic fallback не реализован**: для него нужен отдельный дизайн billing-safety, retry-политики и контроль повторных списаний.
- `OpenAI diarization` и особенно `OpenAI diarization + chunking` считаются **experimental / high risk** сценариями; preflight summary дополнительно предупреждает, что speaker labels могут быть inconsistent across chunks, потому что текущий merge text-based, а не speaker-aware.
- Изменения для длинных ElevenLabs-файлов должны быть **консервативными и evidence-driven**; до введения client-side split нужны реальные E2E-валидации.
- Manifest сейчас рассчитан на **single-user / single-runtime Colab**; параллельные запуски из двух вкладок Colab официально не поддерживаются.
- Для provider HTTP ошибок используется **safe logging**: без печати raw response body в notebook output.
- Перед запуском транскрибации в Colab выводится **read-only preflight summary** (provider/model/API key presence/source mode/conflict/manifest/keyterms/risk notes) без вызовов STT API и без мутации manifest.
- На старте запуска выполняется **best-effort cleanup** устаревших временных файлов workflow в системной temp-директории:
  - только для артефактов с project-owned префиксом `elevenlabs_api_`;
  - только при возрасте старше TTL (по умолчанию 24 часа);
  - без удаления произвольных пользовательских `/tmp`-файлов и generic media.
- После каждого запуска в Colab выводится **локальная timing summary** по основным фазам (cleanup/context/source/provider/docs/manifest/per-file/run total), включая проценты от `run_total`, подсказки по bottleneck и `approx_unaccounted_run_time` для более точной диагностики без изменения provider/runtime поведения.
- Runtime analytics JSONL in Google Drive are **diagnostic only**; they must not include secrets, transcript text, raw provider responses, or Google Docs contents.
- Если заметна большая доля `local_upload_wait`, для крупных файлов может быть эффективнее режим источника из Google Drive (file/folder), чем browser upload.

## Документация

Основной документ по проекту:
- `TECHNICAL_SPECIFICATION.md`
- `docs/VOICEOPS_RUNTIME_VALIDATION_CHECKLIST.md` (runtime migration/analytics validation runbook for later execution)

Именно там собраны:
- описание цели проекта;
- архитектура pipeline;
- runbook по использованию;
- модель работы с секретами;
- known limitations и текущие риск-зоны.

## Текущее состояние репозитория

Канонический кодовый артефакт уже присутствует в репозитории: `elevenlabs_api.py`.

Google Colab остаётся основным способом запуска workflow; файл `elevenlabs_api.py` используется как текущий source of truth для review и PR workflow.


## Запуск через Google Colab GitHub picker

Чтобы открыть workflow через **Google Colab → Open notebook → GitHub**, используйте launcher-ноутбук:
- `notebooks/elevenlabs_api_colab.ipynb`

Как это работает:
- launcher по умолчанию использует `GITHUB_REF = "main"`;
- подтягивает `requirements-colab.txt` и устанавливает зависимости в runtime Colab;
- подтягивает канонический `elevenlabs_api.py` из того же GitHub ref и запускает его в текущем runtime.

Если нужна фиксированная версия, замените `GITHUB_REF` на конкретный commit SHA в первой code-ячейке launcher-ноутбука.

## Lightweight GitHub Actions CI

Repository includes a lightweight GitHub Actions CI workflow for pull requests and pushes to `main`.

Scope:
- static repository hygiene checks only;
- notebook JSON and clean-output checks;
- launcher notebook thinness guard;
- conservative static guards for raw provider `resp.text` logging and broad `/tmp` cleanup patterns;
- `pytest` run when tests exist.

Non-goals:
- no real Colab transcription runs;
- no ElevenLabs/OpenAI/Google API calls;
- no provider or Google credentials required;
- no deployment/CD configuration.

- Google Drive write/update requests use conservative retry with exponential backoff for transient Google API failures (429/500/502/503/504). Google Docs text insertion retry is intentionally narrower because `insertText` is not fully idempotent. STT provider calls are unchanged.

# Project spec: Elevenlabs-API / Google Docs transcription workflow

## 1. Статус документа

Этот документ — основной Russian-first source of truth для текущего состояния проекта `Just9120/Elevenlabs-API` после merge PR #47. Он синхронизирует продуктовый scope, runtime flows, docs-only workflows, safety boundaries и validation requirements.

Документ описывает ожидаемое поведение проекта, но сам по себе не доказывает runtime/E2E validation. Все статусы валидации должны сверяться с `VALIDATION_MATRIX.md` и фактическими CI/runtime записями.

## 2. Цель продукта

Цель продукта — дать пользователю Google Colab workflow для quality-first транскрибации длинных audio/video sources в Google Docs с защитой от повторной обработки через `manifest`, интеграцией Google Drive/Docs, понятным выбором provider path и безопасными docs-only maintenance сценариями.

Продукт должен:

- выбирать source files из компьютера или Google Drive;
- создавать Google Docs transcript в выбранной папке результата;
- обновлять `manifest` так, чтобы повторные runs могли безопасно пропускать уже обработанные sources;
- поддерживать `transcript_doc_v1.2` для новых и существующих Google Docs;
- давать docs-only tools для стандартизации документов и обслуживания `manifest` без provider/STT/LLM calls;
- фиксировать diagnostics/analytics без transcript body и без Google Docs body content;
- предоставлять опциональный post-processing workflow для ручного переименования `Speaker N labels` в diarized Google Docs.

## 3. Поддерживаемый scope

В текущем scope находятся:

- Google Colab launcher workflow через `notebooks/elevenlabs_api_colab.ipynb`;
- основной canonical runtime в `elevenlabs_api.py`;
- source selection для локальных файлов и Google Drive;
- provider paths `ElevenLabs / scribe_v2`, `OpenAI / gpt-4o-transcribe`, `OpenAI / gpt-4o-transcribe-diarize`;
- создание Google Docs transcript;
- `manifest` skip protection и source/document synchronization;
- docs-only standardization существующих Google Docs к `transcript_doc_v1.2`;
- docs-only manifest maintenance для reconciliation/refresh;
- analytics JSONL и startup timing instrumentation;
- optional speaker project rename workflow для существующих diarized Google Docs;
- unit/static validation для helper logic и UI guardrails.

## 4. Активные runtime flows

### 4.1 Транскрибация нового source

Runtime flow:

1. Пользователь выбирает provider path и source mode.
2. Colab показывает preflight summary.
3. Workflow проверяет наличие нужных secrets без печати значений.
4. Workflow вычисляет `source_signature` и проверяет `manifest`.
5. Если source уже обработан совместимыми настройками, default conflict handling — безопасное `Пропустить`.
6. Если обработка разрешена, workflow извлекает аудио при необходимости, вызывает выбранный provider/STT path, формирует transcript и создает Google Doc.
7. После успешного создания Google Doc workflow обновляет `sources` и `documents` в `manifest`.
8. Analytics фиксирует run metadata/status/timing без transcript body.

### 4.2 Docs-only standardization

Docs-only standardization работает с папкой результата и существующими Google Docs. Она проверяет документы, определяет current/outdated/unstructured/unreadable status и при apply приводит поддерживаемые документы к `transcript_doc_v1.2`.

Требования:

- dry-run должен быть доступен и понятен;
- workflow не вызывает provider/STT/LLM APIs;
- workflow не создает транскрипт из source file;
- workflow не должен сохранять Google Docs body content в `manifest` или analytics.

### 4.3 Manifest maintenance

Manifest maintenance — docs-only reconciliation/refresh flow для выбранной папки результата. Он обновляет связи и standard check metadata между Google Docs и `manifest`.

Требования:

- не вызывать provider/STT/LLM APIs;
- не создавать и не мутировать Google Docs body;
- не хранить transcript body или Docs body content;
- не использовать maintenance как основной catalog path для новых transcription Docs, потому что успешная транскрибация сама синхронизирует `sources` и `documents`.

### 4.4 Optional speaker project rename workflow

Speaker project workflow — optional post-processing для уже существующего Google Docs transcript.

Flow:

1. Пользователь выбирает существующий Google Doc.
2. Workflow извлекает plain text для анализа labels.
3. Workflow допускает сценарий только для документов с diarized labels:
   - `Speakers: no` блокирует workflow с пояснением;
   - `Speakers: yes` допускает workflow при наличии detected labels;
   - unknown metadata может продолжаться только с warning, если detected labels найдены.
4. Workflow показывает найденные `Speaker N labels`, counts и несколько sample phrases.
5. Пользователь вручную сопоставляет `Speaker N` с active speakers выбранного проекта.
6. Preview показывает planned replacements и оставляет unmapped labels unchanged.
7. Apply выполняется только явно и проверяет stale preview context.
8. Current MVP apply переписывает Google Doc как plain text, поэтому runtime validation должна выполняться на копиях.

Этот flow не является частью транскрибации, не вызывает provider/STT/LLM APIs и не выполняет voice identification.

## 5. Compatibility / migration layer

Compatibility layer может существовать для чтения старых manifest shapes, old standard Docs и legacy metadata. Его задача — сохранить возможность безопасного чтения/обновления существующих артефактов без изменения runtime behavior и без потери skip protection.

Правила:

- internal schema keys остаются техническими identifiers на English;
- user-facing wording может быть Russian-first;
- migration/maintenance не должны молча менять manifest schema beyond documented current behavior;
- old-format data should be interpreted conservatively;
- backup behavior for destructive manifest migration/apply paths должен сохраняться там, где уже предусмотрен.

## 6. Legacy / import-only helpers

В коде могут сохраняться helpers, которые не являются primary user workflow: legacy import/backfill, path parsing, compatibility readers, low-level Drive helpers. Они не должны рекламироваться в README как основной UX.

Удалять такие helpers можно только после отдельного решения, потому что они могут поддерживать старые manifest/docs или тесты совместимости.

## 7. Что вне scope

Вне текущего scope:

- автоматический provider fallback без явного решения пользователя;
- гарантированная поддержка параллельных Colab tabs или multi-user manifest writes;
- хранение transcript body в `manifest` или analytics;
- хранение Google Docs body content в `manifest` или analytics;
- voice identification, speaker verification, biometric matching;
- использование voice samples, voiceprints или embeddings для speaker projects;
- автоматическое определение реальных имен людей по голосу;
- гарантия formatting preservation при текущем speaker rename apply;
- заявление live E2E success для flows, которые прошли только unit/static validation.

## 8. Пользовательские роли

- **Оператор транскрибации**: запускает Colab, выбирает source, provider path и папку результата, следит за preflight и итоговым отчетом.
- **Куратор документов**: проверяет и стандартизирует существующие Google Docs transcript, выполняет manifest maintenance.
- **Редактор diarized transcript**: вручную сопоставляет `Speaker N labels` со спикерами проекта и применяет rename на копии документа.
- **Maintainer проекта**: обновляет docs, tests, CI guardrails и validation matrix без нарушения runtime safety boundaries.

## 9. Основные сценарии

### 9.1 Source files

Поддерживаемые source modes:

- `Компьютер: 1 файл`;
- `Компьютер: несколько файлов`;
- `Google Drive: 1 файл`;
- `Google Drive: несколько файлов`;
- `Google Drive: папка`.

Google Drive picker buttons являются primary reliable path. Double-click — только convenience. Для `drive_multi` нужен explicit/button-based fallback, потому что multi-select должен быть безопасным и предсказуемым.

### 9.2 Папка источника и папка результата

Папка источника содержит audio/video files и используется для transcription. Папка результата содержит Google Docs transcript и используется для output, docs-only standardization и manifest maintenance.

Recursive scan применим только к source folder scenario, если явно включен.

### 9.3 Conflict handling

Если source уже обработан, пользовательский default должен быть safe skip / `Пропустить`. Любое поведение, которое может повторно вызвать provider/STT и потратить credits, должно требовать явного действия.

### 9.4 Existing Docs maintenance

Пользователь может выбрать папку результата и выполнить:

- dry-run standardization report;
- apply standardization к поддерживаемым Docs;
- manifest maintenance для reconciliation/refresh.

### 9.5 Speaker projects

Пользователь может открыть optional post-processing UI для уже существующего diarized Google Doc, создать или выбрать проект спикеров, добавить roster, preview mapping и явно apply rename.

## 10. Функциональные требования

### 10.1 Transcription

- Поддерживать `ElevenLabs / scribe_v2` как основной provider path.
- Поддерживать ручные OpenAI paths без заявления автоматического fallback.
- Проверять API key availability без вывода секретов.
- Создавать Google Docs transcript в выбранной папке результата.
- Обновлять `manifest` после успешного завершения.
- Не записывать transcript body в `manifest` или analytics.

### 10.2 Manifest

- Вычислять и использовать `source_signature` для skip protection.
- Разделять `sources` и `documents` в current-format manifest.
- Связывать documents через `doc_id`/`doc_link` и source references.
- Сохранять orphan source records conservatively.
- Различать selected-folder scan counters и global manifest statistics в reports.
- Не хранить Google Docs body content.

### 10.3 Google Docs transcript standard

- Новый Google Docs transcript должен соответствовать `transcript_doc_v1.2`, насколько это покрыто текущей runtime implementation.
- Existing Docs standardization должна уметь распознавать current, outdated, unstructured и unreadable documents.
- Metadata defaults для legacy/backfill должны быть консервативными и не придумывать неизвестные данные сверх documented fallback behavior.

### 10.4 Analytics и diagnostics

- Записывать run-level status, timing, startup timing и operational metadata.
- Не записывать secrets, transcript body, Docs body content или raw provider body.
- Startup timing summary должен помогать performance diagnostics, но не должен трактоваться как evidence of transcription success.

### 10.5 Speaker project workflow

- Работать только с уже существующим Google Doc.
- Блокировать `Speakers: no`.
- Разрешать `Speakers: yes` при наличии detected `Speaker N labels`.
- При unknown metadata разрешать preview только с warning, если labels detected.
- Detect labels только на границах speaker turns, а не inline mentions.
- Показывать counts и ограниченные sample phrases без persistence.
- Хранить project roster отдельно в `VoiceOps Workspace/projects/speaker_projects.json`.
- Принимать mapping только к active project speakers.
- Оставлять unmapped labels unchanged.
- Refuse stale preview plans, если поменялись document, selected project, mapping text или active roster.
- Apply должен менять только speaker-turn labels.
- Current MVP apply переписывает Google Doc как plain text и должен предупреждать пользователя.

## 11. Бизнес-правила

- Safety first: при сомнении пропустить, предупредить или потребовать явное действие.
- `Пропустить` — default для конфликтов повторной обработки.
- Provider/STT calls нельзя выполнять из docs-only workflows.
- Provider/STT retries не должны маскировать duplicate billing risk.
- Google Docs mutation должна быть explicit для apply flows.
- Speaker projects не определяют личность по голосу; пользователь сам делает mapping на основе visible text context.
- Speaker project samples — UI aid, не persisted data.
- Unmapped speaker labels остаются как есть.
- Runtime validation claims должны соответствовать фактическим проверкам.

## 12. Data/state model

### 12.1 `manifest`

`manifest` хранит state, links и status metadata. Current model разделяет:

- `sources` — source processing state keyed by `source_signature` или compatible source identity;
- `documents` — Google Docs transcript records keyed by `doc_id`;
- summary/statistics fields для reports и maintenance.

Запрещено хранить:

- transcript body;
- Google Docs body content;
- sample phrases;
- API keys/secrets;
- raw provider response body.

### 12.2 Analytics

Analytics JSONL хранит run-level operational data. Допустимы statuses, durations, provider/model identifiers, source mode, high-level counters and errors. Недопустимы transcript text, Google Docs content, secrets и raw provider bodies.

### 12.3 Speaker projects

Speaker project data хранится отдельно от `manifest`:

- путь: `VoiceOps Workspace/projects/speaker_projects.json`;
- содержит project metadata and speaker roster;
- archive/deactivate должен скрывать элементы без hard delete там, где это предусмотрено;
- не содержит voice samples, voiceprints, embeddings или biometric data;
- не должен хранить transcript body или sample phrases.

## 13. Интеграции

- **Google Colab**: runtime environment, UI widgets, Secrets/userdata.
- **Google Drive API**: source file access, folder selection, artifact storage.
- **Google Docs API**: create/update transcript documents.
- **ElevenLabs**: `scribe_v2` transcription provider path.
- **OpenAI**: `gpt-4o-transcribe` and `gpt-4o-transcribe-diarize` manual provider paths.

Integration behavior must be conservative under transient failures. Google Docs text insertion/update idempotency risks should be handled more narrowly than generic Drive metadata operations.

## 14. Нефункциональные требования

- Colab UX должен быть readable in light/dark themes where feasible.
- Startup path должен быть observable через timing instrumentation.
- Long-running operations должны давать понятные status messages.
- Docs-only reports должны быть Russian-first и не смешивать user-facing English labels без необходимости.
- CI checks должны оставаться lightweight и запускаться локально.
- Documentation must not overclaim unvalidated runtime behavior.

## 15. Архитектурные ограничения

- Launcher notebook должен оставаться thin launcher; canonical workflow живет в `elevenlabs_api.py`.
- Runtime code не должен переноситься в notebook.
- Manifest schema changes require explicit task and validation; docs cleanup не меняет schema.
- Single-user/single-runtime manifest model; parallel notebooks/tabs are not supported.
- Source folder and destination/output folder are separate concepts.
- Drive picker buttons remain primary reliable UX path; double-click remains optional convenience.
- Current speaker rename apply uses plain-text rewrite and does not preserve full Google Docs formatting.

## 16. Безопасность

Обязательные safety caveats:

- no transcript body in `manifest`/analytics;
- no Google Docs body content stored in `manifest`/analytics;
- no provider/STT/LLM calls in docs-only workflows;
- no raw provider body logging;
- no secrets/API keys in logs or artifacts;
- speaker projects are not voice identification;
- speaker projects do not use voice samples, voiceprints, embeddings, or biometric matching;
- speaker project apply should be validated on copied Docs first because current MVP rewrites plain text.

## 17. Observability / diagnostics

Observability includes:

- preflight summary before transcription run;
- manifest skip/conflict reporting;
- docs-only dry-run/apply reports;
- analytics JSONL;
- startup timing summary;
- error/status messages in Colab UI.

Diagnostics must be useful without exposing sensitive content. Timing and status are allowed; transcript text and Docs body content are not.

## 18. Testing / validation

Validation layers:

- `python scripts/ci_checks.py` — notebook hygiene, launcher thinness, logging guards, temp cleanup guards and pytest invocation;
- `pytest -q` — unit/static tests for helpers, reports, manifest logic, UI guardrails and speaker project logic;
- manual/runtime Colab validation — required for Google Drive picker behavior, real Google Docs creation/update, provider calls, manifest skip in live runs and speaker apply on copied Docs.

Conservative validation rules:

- Unit/static tests do not prove live Colab browser behavior.
- Docs-only CI success does not prove provider/STT success.
- Startup timing summary does not prove transcription success.
- Speaker project unit tests do not prove Google Docs formatting safety.
- Do not upgrade validation status without evidence.

## 19. Release readiness

A release/readiness claim for current docs/runtime should require:

- local CI checks pass;
- `pytest -q` pass;
- validation matrix updated with conservative statuses;
- README, project spec and delivery plan synchronized;
- runtime smoke-check for source picker / manifest skip / Docs output before claiming E2E success;
- speaker workflow manual validation on copied diarized Google Doc before claiming live E2E success;
- startup timing summary collected in a real Colab run before making performance claims.

## 20. Open questions

- What exact runtime evidence is sufficient to mark `OpenAI / gpt-4o-transcribe-diarize` as non-experimental for non-chunked sources?
- What evidence is sufficient for `OpenAI diarization + chunking`, given possible inconsistent `Speaker N labels` across chunks?
- Should future speaker apply preserve Google Docs formatting through structured Docs API operations instead of plain-text rewrite?
- Should manifest support multi-runtime locking, or should single-runtime remain an explicit permanent constraint?
- Which analytics fields are most useful for startup performance without increasing privacy risk?

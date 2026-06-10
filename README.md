# Elevenlabs-API: транскрибация в Google Docs

## Что делает проект

Этот репозиторий содержит Google Colab workflow для транскрибации аудио- и видеофайлов в Google Docs. Основной сценарий: выбрать файл или папку, выполнить транскрибацию через выбранный provider path, сохранить результат как Google Docs transcript и зафиксировать состояние в `manifest`, чтобы повторный запуск безопасно пропускал уже обработанные источники.

Проект также поддерживает docs-only workflow для стандартизации уже существующих Google Docs, обслуживания `manifest`, сбора diagnostics/analytics и опционального post-processing workflow для переименования `Speaker N labels` в diarized-документах.

Основные артефакты в Google Drive:

- `VoiceOps Workspace/manifest/elevenlabs_transcription_manifest.json`
- `VoiceOps Workspace/analytics/elevenlabs_transcription_runs.jsonl`
- `VoiceOps Workspace/projects/speaker_projects.json` — отдельный roster для проектов спикеров.

Поддерживаемые provider paths:

- `ElevenLabs / scribe_v2` — основной путь;
- `OpenAI / gpt-4o-transcribe` — ручной альтернативный путь;
- `OpenAI / gpt-4o-transcribe-diarize` — speaker-aware путь, требующий отдельной валидации, особенно при chunking.

## Быстрый старт в Google Colab

Основная точка входа — тонкий launcher notebook:

- `notebooks/elevenlabs_api_colab.ipynb`

Как запустить:

1. Откройте Google Colab.
2. Выберите **Open notebook → GitHub**.
3. Укажите репозиторий `Just9120/Elevenlabs-API` и откройте `notebooks/elevenlabs_api_colab.ipynb`.
4. По умолчанию launcher использует `GITHUB_REF = "main"`.
5. Если нужна фиксированная версия, замените `GITHUB_REF` на конкретный commit SHA в первой code-ячейке.
6. Запустите ячейки notebook. Launcher установит зависимости из `requirements-colab.txt`, загрузит `elevenlabs_api.py` из выбранного GitHub ref и выполнит workflow в текущем Colab runtime.

Перед запуском транскрибации Colab показывает read-only preflight summary: выбранный provider/model, наличие нужных секретов без вывода значений, source mode, папку результата, состояние `manifest`, keyterms и risk notes.


## Realtime Colab prototype

`LIVE-COLAB-01` — experimental realtime Colab prototype for runtime validation of live browser audio capture + ElevenLabs realtime STT. It is separate from the current batch transcription mode and is not a replacement for `notebooks/elevenlabs_api_colab.ipynb` or `elevenlabs_api.py`; Colab batch mode remains the working/fallback channel.

Launcher and runtime:

- `notebooks/elevenlabs_realtime_colab.ipynb` — thin launcher for the realtime prototype;
- `elevenlabs_realtime.py` — standalone realtime runtime that does not import the batch runtime.

Supported source modes for manual validation:

- microphone;
- browser tab/screen audio when the browser returns an audio track;
- browser tab/screen audio + microphone mixed in the browser;
- virtual input device / loopback route for desktop app audio.

Current limitations:

- experimental only; live/browser/provider behavior needs manual Colab runtime validation before any E2E success claim;
- no Google Docs save yet;
- no manifest reads/writes or schema changes;
- no speaker projects integration;
- no guarantee of system-wide audio capture from desktop apps because browsers may require tab audio sharing or OS-level virtual audio/loopback devices;
- Colab cold start may not meet a 20–30 second live-start requirement unless the runtime is pre-warmed.

Main `ELEVENLABS_API_KEY` remains Python-side only. Browser JavaScript receives only a temporary single-use realtime token created by Python.

## Секреты и API-ключи

Секреты добавляются через Google Colab Secrets / `userdata`:

- `ELEVENLABS_API_KEY` — нужен для `ElevenLabs / scribe_v2`;
- `OPENAI_API_KEY` — нужен только для OpenAI paths.

Значения ключей не должны попадать в logs, `manifest`, analytics или Google Docs. Docs-only workflows не вызывают provider/STT/LLM API и не требуют транскрибационных provider calls.

## Основные сценарии

### Транскрибация

Транскрибация создает новый Google Docs transcript из audio/video source. Workflow выбирает источник, при необходимости извлекает аудио из видео, отправляет данные выбранному provider path, собирает результат, создает Google Doc и обновляет `manifest`.

Если `manifest` показывает, что источник уже был успешно обработан с совместимыми настройками, безопасное поведение по умолчанию — `Пропустить`. Это защищает от повторной траты provider credits. Перезапись или повторная обработка не должны быть неявным default.

### Стандартизация существующих Google Docs

Docs-only standardization приводит уже существующие Google Docs transcript к текущему `transcript_doc_v1.2` без provider/STT/LLM calls. Сценарий работает с папкой результата, а не с папкой источника.

Dry-run должен использоваться первым: он показывает, какие документы уже соответствуют стандарту, какие устарели, а какие не распознаны. Apply меняет только выбранные Google Docs и требует обычной осторожности при работе с реальными документами.

### Обслуживание manifest

Manifest maintenance — это docs-only workflow для проверки и обновления связей между Google Docs transcript и записями `manifest`. Он не создает транскрипты, не вызывает provider/STT/LLM API и не хранит тело transcript или содержимое Google Docs.

Сценарий нужен для reconciliation/refresh, а не как основной способ регистрации новых транскриптов: успешная транскрибация сама синхронизирует `sources` и `documents`.

### Проекты и спикеры после diarized-транскрибации

Опциональный workflow проектов спикеров доступен только после того, как Google Doc уже существует. Он предназначен для diarized-документов с `Speaker N labels` вроде `Speaker 1:` и `Speaker 2:`.

Как это работает:

- пользователь выбирает существующий diarized Google Docs transcript;
- workflow показывает найденные `Speaker N labels`, counts и короткие sample phrases;
- пользователь вручную сопоставляет `Speaker N` со спикерами проекта;
- roster хранится отдельно в `VoiceOps Workspace/projects/speaker_projects.json`;
- apply выполняется только по явному действию пользователя;
- unmapped labels остаются без изменений.

Важные ограничения:

- это post-processing, а не часть транскрибации;
- workflow не вызывает provider/STT/LLM API;
- это не voice identification;
- не используются voice samples, voiceprints, embeddings или biometric matching;
- sample phrases показываются для ручной ориентации пользователя и не должны сохраняться в `manifest` или analytics;
- текущий MVP apply переписывает Google Doc как plain text, поэтому первую runtime validation нужно выполнять только на копиях документов.

## Источники файлов

Google Drive picker buttons — надежный основной способ выбора. Double-click поддерживается только как удобство там, где Colab/browser ведет себя ожидаемо; он не должен считаться единственным надежным path.

### Компьютер: 1 файл

Загрузка одного локального audio/video file из компьютера в текущий Colab runtime. Подходит для одиночной транскрибации без Drive source selection.

### Компьютер: несколько файлов

Загрузка нескольких локальных audio/video files. Каждый файл обрабатывается отдельно, а `manifest` skip применяется отдельно к каждому source.

### Google Drive: 1 файл

Выбор одного поддерживаемого Drive file через picker. Buttons остаются primary path; double-click может открывать папки и выбирать файл только как convenience.

### Google Drive: несколько файлов

Выбор нескольких конкретных файлов в текущей папке Drive picker. Этот режим explicit/button-based for safety: он обрабатывает только выбранные files, не сканирует папки, не обходит вложенные папки и не обрабатывает folders. Если double-click в `drive_multi` недоступен или ненадежен, используется button fallback.

### Google Drive: папка

Выбор папки Google Drive и обработка поддерживаемых файлов внутри нее. Recursive scan должен включаться отдельной настройкой и относится только к папке источника.

## Папка источника vs папка результата

**Папка источника** содержит audio/video/source files. Она используется в transcription workflows и может участвовать в recursive source scan.

**Папка результата** содержит Google Docs transcript outputs. Она используется для создания новых Docs, docs-only standardization и manifest maintenance.

Не смешивайте эти понятия: выбор source folder не означает выбор output folder, а обслуживание существующих Google Docs работает с папкой результата.

## Google Docs transcript standard v1.2

`transcript_doc_v1.2` — текущий стандарт структуры Google Docs transcript. Он нужен, чтобы документы можно было проверять, обслуживать и связывать с `manifest` предсказуемым способом.

README дает только практический обзор. Детальные правила стандарта, migration layer, business rules и ограничения описаны в `docs/project-spec.md`.

## Manifest и защита от повторной обработки

`manifest` хранит операционное состояние обработки источников и документов. Ключевые технические идентификаторы включают `source_signature`, `doc_id`, `doc_link`, `sources` и `documents`.

Safety rule: `manifest` не должен хранить тело transcript, sample phrases или содержимое Google Docs. Он используется для skip protection, статусов, связей и диагностики.

При конфликте или повторном запуске безопасный default — `Пропустить`. Это особенно важно для provider paths, где повторная обработка может повторно потратить credits.

## Analytics и startup timing

Analytics хранится в JSONL-артефакте `VoiceOps Workspace/analytics/elevenlabs_transcription_runs.jsonl`. Она предназначена для операционной диагностики: run metadata, статусы, ошибки, timing и startup timing summary.

Analytics не должна содержать тело transcript, содержимое Google Docs, provider response body, секреты или API keys.

Startup timing instrumentation помогает понять, сколько времени занимает подготовка Colab runtime, установка зависимостей, импорт workflow и инициализация UI. Это diagnostic signal, а не доказательство успешной транскрибации.

## Безопасность и ограничения

- Не хранить transcript body в `manifest` или analytics.
- Не хранить Google Docs body content в `manifest` или analytics.
- Не логировать secrets, API keys или raw provider response body.
- Docs-only workflows не должны вызывать provider/STT/LLM APIs.
- OpenAI diarization + chunking остается risk area из-за возможной inconsistency `Speaker N labels` across chunks.
- Проекты спикеров — это ручное переименование labels, не voice identification и не biometric matching.
- Текущий speaker apply переписывает Google Doc как plain text; используйте копии для первой проверки.
- Manifest model рассчитан на single-user/single-runtime usage; параллельные Colab tabs не являются поддерживаемым сценарием.

## Что пока требует runtime validation

Не следует заявлять live E2E успех без отдельной проверки в Google Colab/Google Drive/Google Docs. Консервативно требуют runtime validation:

- smoke-check source picker / `manifest` skip / Google Docs output;
- Drive picker double-click behavior и `drive_multi` fallback в реальном браузере Colab;
- speaker projects workflow на копии diarized Google Doc;
- plain-text apply caveat для speaker rename;
- startup timing summary collection;
- provider-specific OpenAI paths, особенно diarization + chunking.

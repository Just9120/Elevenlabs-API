# Project spec: Elevenlabs-API

## 1. Статус документа

Этот документ — активный Russian-first product contract для `Just9120/Elevenlabs-API`. Он фиксирует текущий scope, durable constraints, runtime/data boundaries и safety rules. Validation evidence хранится отдельно в `VALIDATION_MATRIX.md`; delivery state — в `docs/delivery-plan.md`; observed component map — в `docs/architecture.md`.

## 2. Цель продукта

Проект даёт пользователю Google Colab workflow для quality-first транскрибации audio/video sources в Google Docs с защитой от повторной обработки через `manifest`, интеграцией Google Drive/Docs, понятным provider selection и безопасными docs-only maintenance сценариями.

Основной продуктовый результат batch workflow: Google Docs transcript в выбранной папке результата и обновлённый `manifest`, позволяющий безопасно пропустить уже обработанный source при повторном запуске.

## 3. Текущие продуктовые контуры

### 3.1 Стабильный batch Colab workflow

Активный стабильный workflow использует `notebooks/elevenlabs_api_colab.ipynb` как launcher и `elevenlabs_api.py` как canonical runtime. В scope входят:

- локальный и Google Drive source selection;
- provider paths `ElevenLabs / scribe_v2`, `OpenAI / gpt-4o-transcribe`, `OpenAI / gpt-4o-transcribe-diarize`;
- создание Google Docs transcript;
- `manifest` skip protection и source/document synchronization;
- `transcript_doc_v1.2` для новых и обслуживаемых документов;
- analytics JSONL и startup timing diagnostics без transcript body и без Google Docs body content.

### 3.2 Docs-only maintenance workflows

Docs-only workflows работают с уже существующими Google Docs или existing `manifest` records. Они не должны вызывать provider/STT/LLM APIs и не должны регистрировать новые transcription outputs вместо основного runtime success path.

В scope входят:

- dry-run/apply стандартализация существующих Google Docs к `transcript_doc_v1.2`;
- `manifest` reconciliation/refresh для связей между Docs и source records;
- optional speaker project rename для diarized Google Docs с ручным mapping `Speaker N labels` → project speakers.

Speaker projects не являются voice identification, speaker verification или biometric matching. Workflow не использует voice samples, voiceprints, embeddings или автоматическое определение людей по голосу. Roster хранится отдельно: `VoiceOps Workspace/projects/speaker_projects.json`.

### 3.3 Experimental realtime Colab/proxy contour

Realtime — отдельный экспериментальный контур через `notebooks/elevenlabs_realtime_colab.ipynb` и `elevenlabs_realtime.py`. Он предназначен для проверки browser audio capture + ElevenLabs realtime STT через одноразовый token и WebSocket.

Realtime не является заменой stable batch workflow и не меняет batch runtime contract. Realtime не сохраняет Google Docs, не читает/пишет `manifest`, не обновляет analytics batch workflow и не интегрируется с speaker projects.

Текущая user-visible realtime model:

- отдельные controls для `Аудио вкладки / экрана` и `Микрофон / аудиовход`;
- virtual/loopback/system audio route выбирается как обычное browser/OS audio input device, если он доступен;
- ElevenLabs provider VAD через `commit_strategy=vad` управляет partial-to-committed transitions;
- committed events показываются только в браузере как `realtime_live_transcript_v1`;
- `Скопировать текст` и `Скачать .txt` работают с browser-only committed text;
- нет Google Docs save, `manifest` mutation, speaker project integration или provider raw payload persistence.

## 4. Source и output boundaries

Папка источника содержит audio/video source files и используется только для transcription flows. Папка результата содержит Google Docs transcript outputs и используется для создания Docs, docs-only standardization и manifest maintenance.

Поддерживаемые source modes:

- `Компьютер: 1 файл`;
- `Компьютер: несколько файлов`;
- `Google Drive: 1 файл`;
- `Google Drive: несколько файлов`;
- `Google Drive: папка`.

Google Drive picker buttons — primary reliable path. Double-click — convenience only. `drive_multi` должен оставаться explicit/button-based for safety: он обрабатывает выбранные files, а не folders, recursion или folder scan.

## 5. Manifest, Docs и analytics authority

`manifest` хранит processing state, source/document links, statuses и diagnostics metadata. Он не является storage для transcript body, Google Docs body content, sample phrases или raw provider payloads.

Ключевые boundaries:

- successful transcription runtime синхронизирует `sources` и `documents`;
- repeated source с совместимым successful record должен default to safe skip / `Пропустить`;
- manifest maintenance выполняет reconciliation/refresh, но не заменяет provider transcription success path;
- analytics JSONL хранит operational run metadata, timing и statuses без secrets, transcript body, Docs body content или raw provider bodies;
- startup timing summary — diagnostic signal, а не доказательство успешной транскрибации.

## 6. Google Docs transcript standard

`transcript_doc_v1.2` — текущий стандарт Google Docs transcript для batch/docs-only контуров. Existing Docs standardization должна различать current, outdated, unstructured и unreadable documents. Backfill/default metadata должны быть консервативными и не придумывать неизвестные facts.

Realtime `realtime_live_transcript_v1` — отдельный browser-only presentation format. Он не является Google Docs standardization и не должен автоматически превращаться в batch transcript или `manifest` entry.

## 7. Safety and privacy constraints

Общие constraints:

- не логировать secrets, API keys, one-time tokens или raw provider response bodies;
- не сохранять transcript body/audio chunks/private audio в `manifest` или analytics;
- не сохранять Google Docs body content в `manifest` или analytics;
- docs-only workflows не вызывают provider/STT/LLM APIs;
- safe conflict default — `Пропустить`, а не повторная платная provider transcription;
- manifest model рассчитан на single-user/single-runtime usage; параллельные Colab tabs не являются supported scenario.

Realtime-specific constraints:

- основной ElevenLabs key читается Python-side из Colab Secrets/userdata/environment;
- preferred secret: `ELEVEN_API_KEY`; `ELEVENLABS_API_KEY` — compatibility alias;
- browser получает только одноразовый realtime token/WebSocket URL, не основной API key;
- WebSocket использует `scribe_v2_realtime`, `pcm_16000`, `commit_strategy=vad`;
- realtime не должен делать Google Docs save, `manifest` mutation, speaker project integration или batch workflow side effects.

## 8. Validation/readiness rules

Локальные CI/static checks подтверждают только то, что они реально покрывают. Full runtime success нельзя заявлять без ручной Google Colab/Drive/Docs/browser/provider evidence.


Permission-cancellation intended behavior: explicit `Остановить` during pending display/microphone/mixed capture must keep final visible status `Статус: Остановлено`, re-enable source controls, prevent late WebSocket creation, and immediately stop stale streams/resources returned after cancellation. Browser denial/cancel before WebSocket creation must return to a safe retry state with Russian diagnostics, not a misleading WebSocket-close status. Runtime validation of this behavior remains pending.

Текущая realtime evidence ограничена: standalone page boot, display+microphone capture, WebSocket open, `session_started`, partial transcript, committed transcript, user Stop, media-track release и WebSocket close. Pending gaps перечислены в `VALIDATION_MATRIX.md` и `docs/realtime-colab.md`.

## 9. Supporting detail map

- `README.md` — short entrypoint и navigation.
- `docs/architecture.md` — observed component/data-flow map and future refactor seams.
- `docs/realtime-colab.md` — realtime operator/validation guide.
- `VALIDATION_MATRIX.md` — validation evidence/status truth table.
- `docs/delivery-plan.md` — current operational delivery dashboard.

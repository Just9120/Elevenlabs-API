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
- optional manual pre-transcription segmentation for one source recording (`Компьютер: 1 файл` and `Google Drive: 1 файл` only);
- provider paths `ElevenLabs / scribe_v2`, `OpenAI / gpt-4o-transcribe`, `OpenAI / gpt-4o-transcribe-diarize`;
- создание Google Docs transcript;
- `manifest` skip protection и source/document synchronization;
- `transcript_doc_v1.2` для новых и обслуживаемых документов;
- analytics JSONL и startup timing diagnostics без transcript body и без Google Docs body content.

Batch provider boundary: selected provider determines the outbound STT request path. Enabling both ElevenLabs and OpenAI secrets in Colab is allowed; the selected provider controls which key and endpoint are used for a batch transcription request. OpenAI batch long-file handling prepares mono AAC M4A and applies both 25 MB upload-size and 1320-second safe-duration splitting safeguards before the first provider request. Manual user segmentation, when enabled for one-source modes, runs before provider transcription, creates temporary audio-only segment files, creates one Google Doc per user segment, and does not change provider contracts or replace OpenAI technical smart split inside an OpenAI segment. OpenAI realtime remains out of scope for this batch workflow.

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

### 3.4 Studio PWA contour (current product scope)

Studio is the new desktop-first responsive web application contour for the initial public address `studio.librechat.online`. It has PWA enhancements: installability, standalone-window behavior, and a cached app shell for reopening the application shell after a successful online visit. Studio is not an offline-first transcription product. Offline app-shell behavior must never imply offline transcription, provider execution, Google integration, credential use, authentication, job processing, or local browser processing of private source media.

`PWA-FOUNDATION-01` is completed/merged and remains UI-only. The current Studio application is limited to Russian-first UI navigation, prototype browser-only project/job state, browser-only file metadata display, and visual sequential multi-document segment planning. It does not upload source media to a server and does not persist transcription processing state.

Colab batch remains the stable fallback during the PWA transition and the only current production path for provider transcription, Google Drive/Docs output, Drive integration and `manifest` mutation. The current Studio foundation does not include a backend API, authentication, provider keys, provider calls, Google OAuth/Drive/Docs integration, server-side file uploads, transcription jobs, database, Redis, queue, worker, persistent storage, migrations, existing Colab runtime changes, or any production transcription job pipeline.

### 3.5 PWA-DEPLOY-01 first-deploy contract and evidence

`PWA-DEPLOY-01` is complete for the first stateless Studio deployment at `https://studio.librechat.online`. The deployment validates public app-shell availability only; it does not create a production transcription platform.

Verified deployment facts:

- an isolated operator-managed deployment checkout exists on branch `main`;
- the existing stateless `studio-web` container was built and started successfully;
- the container is healthy and binds only to `127.0.0.1:8181`;
- host nginx proxies `studio.librechat.online` to the local Studio container;
- a Let's Encrypt certificate for `studio.librechat.online` was issued and HTTPS works;
- `https://studio.librechat.online/healthz` returned HTTP 200;
- HTTP redirects to HTTPS;
- the public homepage exposes `manifest.webmanifest`;
- the public service worker `sw.js` is present and precaches the app shell.

Manual browser/PWA evidence:

- Studio UI opens in a normal desktop browser;
- the browser offers PWA installation;
- the installed app opens in a separate window;
- after a successful online visit, the app shell appears to reopen offline. Browser/version were not recorded; this is manual user-reported confirmation and is not proof of offline transcription, provider execution, Google integration, authentication, credentials, uploads, or job processing.

Current deployment boundaries remain unchanged:

- current Studio is still UI-only;
- PWA offline behavior covers the app shell after a prior online visit only;
- no production transcription platform exists yet;
- CD remains disabled;
- no backend API, user authentication, provider keys, provider calls, Google OAuth, Google Drive, Google Docs, server-side file uploads, transcription jobs, database, Redis, queue, worker, persistence, persistent storage, or migrations were added;
- no changes were made to Colab, realtime, provider contracts, Google Docs behavior, or manifest behavior.

### 3.6 Approved future Studio platform direction, not implementation authorization

The following is approved product direction and architecture intent only. It does not authorize implementation, deployment, migrations, stateful services, OAuth client setup, or credential storage until a later explicitly scoped delivery item.

- Studio is designed to become multi-user-ready, although initial use is personal.
- Local password login is supported in the future, but public registration is initially disabled; bootstrap-admin or invite-only access is the intended policy.
- Google sign-in is an additional future login option.
- Google Drive connection requires explicit user consent. A Google sign-in journey may request Drive authorization as part of the same consent flow, but Drive must not be described as automatically connected without user consent.
- Authentication uses server-side sessions with `__Host-*` cookies using `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, and no `Domain`.
- Auth JWTs, Google refresh tokens, and provider keys must not be stored in browser local storage.
- Passwords are stored only as Argon2id hashes.
- Studio uses a BYOK model: each user supplies their own ElevenLabs/OpenAI provider credential; there is no shared global provider key for all users.
- Provider credentials and Google refresh tokens must be reversibly encrypted at rest.
- Encryption material is outside Git and outside the database.
- Browser UI must never receive raw stored provider credentials or raw refresh tokens.
- Provider credentials are masked in UI and must not appear in API responses, logs, analytics, job payloads, or browser storage.
- Future jobs reference a credential identity/version rather than embedding secrets.
- A worker may decrypt a credential only immediately before making the provider request.
- Future architecture separates browser UI, backend API, session/auth boundary, encrypted credential/token boundary, persistent user/project/job/output state, asynchronous worker/queue boundary, and Google integration boundary.
- Technology choices for backend framework, database, queue, storage, and OAuth client configuration are deliberately not yet fixed.
- A future domain migration is possible only through a separate explicit decision.
- The supporting implementation-contract preparation document is `docs/studio-platform-01-prep.md`; it provides release slicing, domain boundaries, lifecycle expectations, validation categories, and open decisions without replacing this product spec.
- The approved first stateful platform direction is a future account/session/BYOK foundation only: bootstrap-admin or invite-only access, local sessions, user-owned encrypted provider credentials, and security/audit lifecycle boundaries. This direction does not implement or authorize provider execution, server uploads, Google Drive/Docs, job workers, queues, databases, migrations, or stateful deployment by itself.

## 4. Source и output boundaries

Папка источника содержит audio/video source files и используется только для transcription flows. Папка результата содержит Google Docs transcript outputs и используется для создания Docs, docs-only standardization и manifest maintenance.

Поддерживаемые source modes:

- `Компьютер: 1 файл`;
- `Компьютер: несколько файлов`;
- `Google Drive: 1 файл`;
- `Google Drive: несколько файлов`;
- `Google Drive: папка`.

Google Drive picker buttons — primary reliable path. Double-click — convenience only. `drive_multi` должен оставаться explicit/button-based for safety: он обрабатывает выбранные files, а не folders, recursion или folder scan.

Manual pre-transcription segmentation v1 is available only for `Компьютер: 1 файл` and `Google Drive: 1 файл`. It is enabled by the optional `Разделить запись на несколько документов` control and uses a visual card builder instead of a visible raw pipe-delimited textarea. Each card is a visible `Часть N` output Google Doc with an optional `Название выходного Google Doc`; blank titles generate `<original source stem> — Часть N`, while filled titles become the requested Doc title after existing title safety normalization. The first card starts at `00:00`, every later card automatically inherits the previous valid end time, non-final cards require an explicit `MM:SS` or `HH:MM:SS` end, and the final card always shows the fixed `До конца записи`/`end` boundary, so the plan covers the file contiguously without user-maintained starts. Optional local suffix allocation for manual segment document title collisions is disabled by default; when enabled it reserves current destination-folder titles and earlier titles in the same run case-insensitively and emits numeric suffixes such as `(1)` and `(2)`. Requested/final segment document titles and suffix policy do not alter segment manifest identity, which is based on the original source identity plus exact segment range and source reference. Existing Google Docs standardization treats the actual current Drive document title as the authority for the structured transcript heading, preserving custom text and numeric suffixes while keeping segment metadata lines. Multi-file, folder, recursive folder and `drive_multi` modes do not support manual segmentation in v1.

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
- `docs/provider-transcription-contract.md` — concise current batch provider contract.
- `VALIDATION_MATRIX.md` — validation evidence/status truth table.
- `docs/delivery-plan.md` — current operational delivery dashboard.

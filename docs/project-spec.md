# Project spec: Elevenlabs-API

## 1. Статус документа

Этот документ — активный Russian-first product contract для `Just9120/Elevenlabs-API`. Он фиксирует текущий scope, durable constraints, runtime/data boundaries и safety rules. Validation evidence хранится отдельно в `VALIDATION_MATRIX.md`; delivery state — в `docs/delivery-plan.md`; observed component map — в `docs/architecture.md`.

## 2. Цель продукта

Проект даёт пользователю Google Colab workflow для quality-first транскрибации audio/video sources в Google Docs с защитой от повторной обработки через `manifest`, интеграцией Google Drive/Docs, понятным provider selection и безопасными docs-only maintenance сценариями.

Основной продуктовый результат batch workflow: Google Docs transcript в выбранной папке результата и обновлённый `manifest`, позволяющий безопасно пропустить уже обработанный source при повторном запуске.

## 3. Текущие продуктовые контуры

### 3.1 Google Colab contour: primary working workflow

Google Colab is the primary working product contour and the current stable/fallback production workflow. Studio PWA work must not break this contour or silently change its runtime contract. The active stable workflow uses `notebooks/elevenlabs_api_colab.ipynb` as launcher and `elevenlabs_api.py` as canonical runtime. В scope входят:

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

### 3.4 Studio PWA contour (current development product scope)

Studio is the current development contour for the initial public address `studio.librechat.online`. Its product target is to duplicate the Google Colab product scope with PWA/platform adaptations: browser app UX, account/session boundaries, user-owned credential handling, project/source/job records, explicit Google consent, and future server-side processing boundaries. Studio must not be described as replacing the working Colab production contour until production runtime/operator evidence exists.

Studio has PWA enhancements: installability, standalone-window behavior, and a cached app shell for reopening the application shell after a successful online visit. Studio is not an offline-first transcription product. Offline app-shell behavior must never imply offline transcription, provider execution, Google integration, credential use, authentication, job processing, or local browser processing of private source media.

Current Studio source state includes account/session/BYOK foundation, projects, sources, Google Drive OAuth connection status/start/disconnect UI, safe Drive metadata lookup, direct folder-children selection for one explicitly supplied Drive folder, local temporary upload source intake, persisted transcription job records, job UI, processing preflight snapshots, and claim-readiness guardrails for future processing. Studio can attach an existing active BYOK provider credential identity to a queued job record through safe credential metadata only; raw provider credentials are never exposed to the browser. Source, credential, and output-folder readiness indicators are explanatory prerequisites for future processing and do not start processing today. Internal Studio lease metadata, when present, is coordination/fencing state only and is not browser-safe metadata. Studio jobs may now enter an explicit `processing` lifecycle state with attempt counting and request/acknowledge cancellation semantics after a valid internal lease, but this still performs no provider processing by itself.

Current Studio non-goals/deferred boundaries remain: no worker, no queue consumer, no provider execution, no credential decryption/use for processing, no Google Drive download/export processing, no source byte access by the processing pipeline, no Google Docs output creation, no output persistence, no manifest mutation, no production processing pipeline, no automatic migration rollout, and no production-live claim without runtime/operator evidence. Studio job records are record-only until separately scoped worker/provider/output work changes that boundary.

Shared product safety rules across Colab and Studio: no raw secrets/tokens in browser responses, logs, docs, examples, test output, or generated artifacts; raw provider credentials are never sent to the browser; transcript body, Google Docs body content, raw provider payloads, source bytes, OAuth responses, private storage keys, presigned URLs, environment values, and file-mounted secret contents must stay out of safe metadata. Source ownership, user, project, OAuth, credential, output-folder, and source-state boundaries must be re-checked server-side before any real Studio processing. `source-done/merged` means repository source or docs are merged to main; it does not mean `production-live`.

Studio output/transcript parity contract: where applicable, Studio should target the same user-facing result as the working Google Colab batch contour: a Google Docs transcript in the selected output Drive folder. Unless a later explicit product decision changes the standard, Studio output should align with the existing batch/docs transcript standard, currently `transcript_doc_v1.2`. Transcript body and Google Docs body content must not be stored in job metadata, safe metadata, logs, analytics, browser storage, PR bodies, examples, or generated artifacts. The current selected output folder metadata is a readiness signal only; real provider processing must not be claimed until output-destination behavior is explicitly implemented and validated. Before any future provider call, provider execution should not proceed into irreversible output-producing work without a valid owner-scoped output destination unless a later accepted design introduces a safe pending-output state. No Google Docs output creation exists today in Studio PWA.

Studio processing-time source access contract: existing Studio source records, processing preflight, and claim-readiness helpers inspect safe metadata only. Metadata readiness is not proof that source bytes or Drive content are still accessible. A future worker must re-check source availability at processing time before any provider request. For Google Drive sources, future processing must re-check that the current user owns or has access through an active Google connection, that the Drive file still exists and is accessible, and that MIME/export/download mode is supported; raw Google API payloads, owners, permissions, tokens, and OAuth responses must not be exposed as safe metadata. For `local_upload` sources, future processing must re-check that the object still exists, has not expired or been deleted, and remains accessible only through private server-side storage; presigned URLs, object keys, storage credentials, source bytes, and temporary file paths must not be exposed as safe metadata. The current internal processing-time availability foundation performs those checks as read-only Drive metadata and S3/R2 HEAD verification for leased `processing` jobs only. A newer internal source-only materialization boundary may then materialize exactly one verified source into bounded ephemeral temporary storage, re-checking lease, cancellation, project, relation, source identity, MIME, and size before yielding an internal handle; it still does not call providers, create Google Docs, persist outputs, complete jobs, mutate manifests, expose source bytes to browsers, or claim a production processing pipeline.

Studio/Colab manifest authority contract: the Google Colab `manifest` remains the current working production authority for batch progress, skip protection, and source-document synchronization. Studio PWA does not mutate the Colab manifest today and must not claim full Colab parity until manifest/skip behavior has an approved and implemented design. For now, Studio manifest mutation is deferred; Studio job/source/output records are separate source state and do not replace the Colab manifest. Any future Studio manifest behavior must decide whether authority remains the Drive manifest, moves to PostgreSQL, or uses a bridge/export/sync design. Future manifest design must preserve skip protection, avoid duplicate provider processing, and must not store transcript body, Google Docs body content, raw provider payloads, source bytes, secrets, tokens, presigned URLs, or private storage keys.

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
- Studio platform CD exists for isolated platform deployment, but CD changes are out of scope for this item;
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
- Studio transcription job records may reference a credential identity without embedding secrets; job API payloads must never expose raw or encrypted credential material.
- A worker may decrypt a credential only immediately before making the provider request.
- Future architecture separates browser UI, backend API, session/auth boundary, encrypted credential/token boundary, persistent user/project/job/output state, asynchronous worker/queue boundary, and Google integration boundary. The current job foundation persists queued/cancelled job metadata only; provider execution, workers, Google Docs output, manifest mutation, and production processing remain deferred.
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

### 3.7 PWA-PLATFORM-01 implemented platform core boundary

PWA-PLATFORM-01 adds the first stateful Studio platform core in source form only: FastAPI backend, PostgreSQL schema/migrations, Redis-backed rate limits, server-side cookie sessions, bootstrap-admin provisioning, safe audit events, and encrypted BYOK credential lifecycle for ElevenLabs/OpenAI. It does not claim production deployment until the operator completes the platform runbook validation.

PWA-SOURCES backend work adds project CRUD, selected output Google Drive folder metadata on projects, Google Drive source metadata records, and temporary local-upload source records through private S3/R2-compatible browser direct PUT. Studio platform UI can bind output Drive folder metadata on projects, verify one explicitly supplied Drive file/folder ID through safe backend metadata, list direct children of one explicitly supplied Drive folder ID through backend safe metadata, create source metadata records from verified metadata or selected safe file-like child metadata, create local temporary upload source records, and create/list/read/cancel queued/cancelled transcription job records from existing uploaded project sources. Transcription outputs still target the user-selected Google Drive folder recorded on the project. Local computer source files remain temporary inputs only and must not be proxied through FastAPI or stored as raw bytes in PostgreSQL, browser storage, repo files, or VPS disk.

The current Studio platform boundary includes account/session/BYOK plus project/source metadata, temporary upload intake, Google Drive OAuth connection status/start/disconnect UI, and backend safe metadata lookup plus frontend verification for one explicitly supplied Google Drive file/folder ID, and backend safe direct-children metadata listing for one explicitly supplied Google Drive folder ID, using the current user's active Google connection. Google Drive connection requires explicit user consent, stores refresh tokens encrypted at rest, keeps provider credentials and Google tokens as separate secret boundaries, and never returns raw Google tokens to the browser; the frontend may render only safe connection metadata and the metadata and folder-children endpoints may return only normalized safe Drive metadata. OAuth URLs, state, codes, tokens, provider credentials, raw Google payloads, owners, permissions, sharing details, and secrets must not be stored in browser storage or returned by Studio APIs. Drive picker, recursive folder browsing, Drive search, Google Docs output creation, provider execution, worker/queue processing, output persistence, manifest mutation, the production transcription pipeline, project sharing, public registration, invites, and password recovery remain deferred. Studio jobs are still persisted records only and are not processed; source/credential/output-folder readiness indicators are explanatory and do not start provider execution, worker/queue processing, Google Docs output, output persistence, manifest mutation, or production processing. Studio platform CD exists, but CD changes are out of scope for focused Studio frontend work.

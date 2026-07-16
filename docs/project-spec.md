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

Current Studio source now includes a dedicated polling worker entrypoint and source-only Compose wiring, but no queue consumer, no public processing pipeline, no manifest mutation, no production processing pipeline, no automatic migration rollout, and no production-live claim without runtime/operator evidence. PostgreSQL remains the processing authority; Redis is not a processing queue, lock, scheduler, retry mechanism, or worker heartbeat. Studio source now contains all internal per-stage boundaries through safe output persistence and fenced completion, plus an internal synchronous orchestrator for one already-leased job, an internal one-shot explicit-job claim boundary, an internal single-iteration claim-next boundary that may select one ready queued PostgreSQL job and invoke that orchestrator once, and a dedicated worker loop that can call that iteration when separately run. These boundaries are not automatically invoked and are not a public or production processing pipeline. Persisted output references now exist internally for per-source Google Docs results, and the source now includes a browser-safe output API for authenticated, owner-scoped, read-only discovery of persisted output metadata with validated Google web-view links or `null`. Existing job list/detail payloads remain unchanged and do not include output records or output URLs. Platform-mode frontend output rendering now requests that explicit endpoint only when a user opens job details, displays lifecycle status separately from output count/availability, preserves partial outputs for non-completed jobs, and does not add polling. Worker/API production rollout remains unclaimed without runtime/operator evidence.

Shared product safety rules across Colab and Studio: no raw secrets/tokens in browser responses, logs, docs, examples, test output, or generated artifacts; raw provider credentials are never sent to the browser; transcript body, Google Docs body content, raw provider payloads, source bytes, OAuth responses, private storage keys, presigned URLs, environment values, and file-mounted secret contents must stay out of safe metadata. Source ownership, user, project, OAuth, credential, output-folder, and source-state boundaries must be re-checked server-side before any real Studio processing. `source-done/merged` means repository source or docs are merged to main; it does not mean `production-live`.

Studio output/transcript parity contract: where applicable, Studio should target the same user-facing result as the working Google Colab batch contour: a Google Docs transcript in the selected output Drive folder. Unless a later explicit product decision changes the standard, Studio output should align with the existing batch/docs transcript standard, currently `transcript_doc_v1.2`. Transcript body and Google Docs body content must not be stored in job metadata, safe metadata, logs, analytics, browser storage, PR bodies, examples, or generated artifacts. The current selected output folder metadata is a readiness signal only; internal processing-time server boundaries may re-verify that configured folder for existence, folder type, access, and writability before provider and output side effects. Studio output creation now has an internal single-transcript Google Docs boundary that writes a document aligned with `transcript_doc_v1.2` from one active ephemeral transcript and yields only an ephemeral redacted document reference. Transcript body and Google Docs body content are not persisted in job metadata. The source now includes internal safe per-source output-reference persistence and a fenced completion transition that completes a job only when every non-skipped relation has a persisted output record. Those references can now be discovered through the explicit browser-safe output API in source, using a closed metadata allowlist and validated Google web-view URL only; transcript/document bodies remain server-ephemeral and are never returned. Source now contains an internal synchronous orchestrator for one already-leased job, an internal one-shot explicit-job boundary that acquires and commits a lease before invoking that orchestrator, and an internal claim-next iteration that atomically selects the oldest unlocked ready queued job in PostgreSQL, commits its lease, and invokes the orchestrator once or returns idle; public processing endpoints, manifest mutation, operator rollout evidence, and production processing claims remain deferred; frontend rendering of safe output metadata in source does not by itself prove deployment or production-live processing. Existing job list/detail payloads remain unchanged; transcript/document bodies remain server-ephemeral and are never returned.

Studio processing-time source access contract: existing Studio source records, processing preflight, and claim-readiness helpers inspect safe metadata only. Metadata readiness is not proof that source bytes or Drive content are still accessible. A future worker must re-check source availability at processing time before any provider request. For Google Drive sources, future processing must re-check that the current user owns or has access through an active Google connection, that the Drive file still exists and is accessible, and that MIME/export/download mode is supported; raw Google API payloads, owners, permissions, tokens, and OAuth responses must not be exposed as safe metadata. For `local_upload` sources, future processing must re-check that the object still exists, has not expired or been deleted, and remains accessible only through private server-side storage; presigned URLs, object keys, storage credentials, source bytes, and temporary file paths must not be exposed as safe metadata. The current internal processing-time availability foundation performs those checks as read-only Drive metadata and S3/R2 HEAD verification for leased `processing` jobs only. A newer internal source-only materialization boundary may then materialize exactly one verified source into bounded ephemeral temporary storage, re-checking lease, cancellation, project, relation, source identity, MIME, and size before yielding an internal handle; it still does not call providers, create Google Docs, persist outputs, complete jobs, mutate manifests, expose source bytes to browsers, or claim a production processing pipeline. A separate internal prerequisites boundary may decrypt the current owner-scoped BYOK provider credential and verify the configured output Drive folder immediately before future provider execution, with post-I/O lifecycle revalidation and redacted ephemeral handles only. Studio source now also contains an internal ElevenLabs single-source execution boundary for exactly one already-materialized source of an already-leased `processing` job; it performs one synchronous `scribe_v2` request with pre/post DB-only lifecycle checks and yields only an ephemeral redacted transcript result. An internal output boundary can take that active ephemeral transcript, freshly verify Google output authorization, perform one Google Docs creation request, and yield only an ephemeral redacted document reference. A persistence boundary can then store only safe owner-scoped Google document references and aggregate metadata, and complete a job only after every non-skipped source relation has persisted output evidence. An internal synchronous orchestrator can compose these boundaries for one already-leased job, an internal one-shot boundary can claim one explicitly identified queued job, and an internal single-iteration boundary can discover at most one oldest unlocked ready queued PostgreSQL job, commit the lease, and invoke that orchestrator with the committed owner/generation. This source includes a dedicated worker entrypoint, Compose wiring, a public authenticated output-read API, and platform-mode output browser links for explicitly opened jobs, but it does not claim production rollout, public processing pipeline, manifest mutation, manifest parity, exactly-once Google document creation, or production-live processing.

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
- Internal server-side processing prerequisites may decrypt a credential only for a leased `processing` job immediately before a future provider request boundary; decrypted values are ephemeral, redacted, never browser-visible, and must be revalidated against job/project/lease/cancellation/credential state after decryption.
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

PWA-SOURCES backend work adds project CRUD, selected output Google Drive folder metadata on projects, Google Drive source metadata records, and temporary local-upload source records through private S3/R2-compatible browser direct PUT. Studio platform UI uses the project workspace structure `Обзор` plus the combined `Подготовка` tab for source intake, row composition, and current/recent jobs; the older separate normal-platform `Источники` and `Задачи` tabs are no longer the intended UI. The UI can bind output Drive folder metadata on projects, revalidate Picker-selected source and output-folder metadata through backend safe endpoints, create local temporary upload source records, and create/list/read/cancel queued/cancelled transcription job records from existing uploaded project sources. Transcription outputs target each job's immutable output-folder snapshot. Local computer source files remain temporary inputs only and must not be proxied through FastAPI or stored as raw bytes in PostgreSQL, browser storage, repo files, or VPS disk.

The current Studio platform boundary includes account/session/BYOK plus project/source metadata, temporary upload intake, Google Drive OAuth connection status/start/disconnect UI, backend safe metadata lookup for one explicitly supplied Google Drive file/folder ID, backend safe direct-children metadata listing for one explicitly supplied Google Drive folder ID, persisted job records, processing lifecycle/lease foundations, the dedicated `studio-worker` entrypoint and Compose source wiring, ElevenLabs processing boundaries, Google Docs creation, safe output persistence and fenced completion, the browser-safe output API, and platform frontend output rendering. Google Drive connection requires explicit user consent, stores refresh tokens encrypted at rest, keeps provider credentials and Google tokens as separate secret boundaries, and never returns raw Google tokens to the browser; the frontend may render only safe connection/output metadata and the metadata, folder-children, job, and output endpoints may return only normalized safe records. OAuth URLs, state, codes, tokens, provider credentials, raw Google payloads, owners, permissions, sharing details, transcript bodies, document bodies, source bytes, and secrets must not be stored in browser storage or returned by Studio APIs. Drive picker, recursive folder browsing, Drive search, Studio manifest mutation, the production transcription pipeline, project sharing, public registration, invites, and password recovery remain deferred. The merged worker/processing/output source does not prove production migration rollout, a deployed or running worker, production-live Studio processing, Studio manifest mutation, or exactly-once Google document creation. Studio platform CD exists, but CD changes are out of scope for focused Studio frontend work.

### Studio diagnostics backend foundation

`PWA-DIAGNOSTICS-01A` adds the backend-only foundation for the Studio diagnostics surface. The backend now has a separate `diagnostic_events` table and ORM model for general diagnostics; the existing `audit_events` model and `/api/audit-events` endpoint remain the separate security/account audit surface and are not reused for diagnostics. The diagnostics backend records only server-owned, event-specific allowlisted API and worker event codes with bounded safe scalar metadata, validated owner/project/job scope, opaque request/correlation identifiers, finite retention, five-minute deduplication buckets, opportunistic expired-row cleanup, authenticated owner-scoped querying with safe filters and signed context-bound cursor pagination, a safe authenticated system summary, and a same-origin CSRF-protected Markdown `.md` report endpoint.

Every API response receives a generated opaque `X-Request-ID`; an inbound `X-Correlation-ID` is preserved only when it matches the strict opaque identifier format, otherwise a fresh opaque correlation id is generated and returned. Diagnostic event persistence is best-effort and uses independent short-lived database transactions so diagnostics failures must not block API requests, job creation/cancellation, worker claim/processing, provider calls, Google Docs output, or job completion/failure/cancellation transitions.

The normalized server/worker lifecycle event allowlist covers job creation, claim, processing start, source validation/readiness, provider request start/completion/failure, output creation/persistence, job completion/failure/cancellation, and tightly scoped API/worker failure summaries. Diagnostic metadata must not include arbitrary messages, raw exceptions, stack traces, request/response bodies, URLs, filenames, transcript text, source bytes, tokens, credentials, Google document ids/URLs, environment values, project titles, task titles, or user email. Normal INFO/WARNING/ERROR diagnostics retain for 14 days by default; DEBUG retention is capped at 24 hours.

`PWA-DIAGNOSTICS-01A` does not implement the Settings diagnostics page, frontend export button, browser/PWA event capture, browser error handlers, service-worker diagnostics, bounded DEBUG UI/control, arbitrary client ingestion, remote telemetry, third-party analytics, public report URLs, `.txt` reports, or HTML reports. The read-only Settings diagnostics UI and Markdown export are split into `PWA-DIAGNOSTICS-01B-A`; client/PWA event ingestion and bounded DEBUG controls remain in `PWA-DIAGNOSTICS-01B-B`.

### Studio processing rollout contract

`PWA-PROCESSING-ROLLOUT-01-PREP` is documentation and operator-contract preparation only. It does not connect to production, use SSH/VPS access, run backups, run migrations, deploy containers, start workers, create jobs, call ElevenLabs, call Google APIs, mutate production, change source code, change workflows, change Compose, change environment templates, add migrations, edit secrets, or claim production Studio processing.

The future `PWA-PROCESSING-ROLLOUT-01A — Manual Studio processing rollout and controlled smoke validation` is the only approved follow-up after this PREP item. It is operator-run and may apply the reviewed migration and start exactly one worker only after prerequisites, explicit confirmation, and tagged pre-migration backup evidence. It must collect only secret-free runtime evidence and must not be represented as completed by a coding agent.

Product state terms remain strict: `source-done/merged`, `CI-verified`, `deployed`, `migration-applied`, `worker-running`, and `production-live` are distinct. No production-live Studio claim is allowed without factual operator evidence. The current Alembic head for the Studio processing/output/diagnostics schema is `0010_diagnostic_events`; production migration rollout remains manual/operator-scoped and must not run at API startup or through standard CD. Standard Studio Platform CD deploys only `web` or `api`; it does not deploy `studio-worker` or execute migrations.

The first smoke validation, if performed by the future operator item, is limited to one operator-approved test account/project, exactly one small supported source, the existing ElevenLabs path only, one active owner-scoped BYOK credential, one authenticated Google connection, one selected writable output folder, one queued job, safe UI/API lifecycle observation, and manual confirmation that the validated Google link opens the expected Google document in the selected folder. Evidence must not include transcript text, document ids/URLs, source bytes, tokens, credential values, private paths, raw provider responses, or raw Google responses.

Residual limitations remain product constraints: no exactly-once Google document creation, no automatic reconciliation, no automatic retry, no background lease heartbeat during one long materialization/provider stage, one continuous materialization/provider stage must fit the configured worker lease TTL, no Studio manifest mutation, no OpenAI processing rollout in this item, no multi-worker production validation, no production-live claim from documentation or CI alone, and Colab remains the fallback production contour until factual Studio runtime evidence exists.

### PWA-UX-UI-01 Studio workspace UX contract

Studio platform navigation is project-centric: normal platform mode exposes `Обзор`, `Проекты`, and `Настройки`. Demo-only New Transcription and global demo Jobs pages must not be presented as real platform product functionality.

The global sidebar `Обзор` is the account/workspace dashboard: it summarizes project count, Google Drive connection state, provider-key readiness, recent active projects, and concise setup actions. It is not a permanent onboarding placeholder once projects exist.

Projects owns the real source, output-folder, and job workflow. A selected project opens directly into the preparation workspace without a redundant project-level `Обзор` tab. The project header keeps title, optional description, last-updated metadata, edit/archive actions, and compact default output-folder controls directly above the composer. The preparation workspace is row-first and uses compact preparation row cards: one row maps one source to one result folder, with optional task title and row ordering/removal controls when multiple rows exist. At least one editable row remains visible; deleting rows must not produce a zero-row composer. Existing project sources, Google Drive Picker source intake, and local-device source intake are presented as one coherent `Источник` group while preserving current Picker, upload, validation, safety, and selection-order contracts. Readiness is compact and actionable rather than a repeated large checklist: it shows row totals, complete rows, and row-specific missing requirements such as source, result folder, unavailable source, or duplicate source/folder pair. The submit area shows the total row count, complete row count, the current blocker when submission is unavailable, and an explicit row-count button; it does not require a provider credential. Current batch endpoint, safe metadata, Google Picker, source/folder verification, same-project draft preservation, different-project state isolation, and idempotency/retry contracts remain unchanged. Current/recent job history remains below the composer. Future distinct sections such as tasks or results may introduce navigation only when they represent meaningful independent workspaces.

For source selection, the Google Picker may display all Drive file types in `ViewId.DOCS` list mode without source MIME filters. Backend source validation remains authoritative, and the client may reject clearly unsupported explicit MIME values only with safe Russian copy. Output-folder selection remains folder-only.

Normal user-facing platform copy is Russian-first and should avoid implementation or delivery terminology such as Platform API, Platform core, metadata, worker rollout, provider processing, lifecycle, source/job/output jargon, and BYOK wording when a plain product phrase exists.

### PWA-GOOGLE-PICKER-01 Studio Drive Picker contract

Platform-mode Studio source selection now uses the official Google Picker modal for Drive navigation and search. The browser receives only a short-lived access token through an authenticated same-origin CSRF-protected Picker-session endpoint; Google refresh tokens, encrypted token material, credential ids, key ids, raw OAuth responses, and raw Google errors remain server-only. Studio continues to request only `openid`, `email`, and `https://www.googleapis.com/auth/drive.file`; restricted Drive scopes such as `drive`, `drive.readonly`, `drive.metadata`, and `drive.metadata.readonly` are out of scope.

Picker callbacks are display hints only. Persisted source and output-folder metadata must be re-fetched and validated server-side with the active owner-scoped Google connection before Studio mutates project records. Source selection accepts one to fifty unique files, rejects folders and unsupported media, and stores backend-normalized safe metadata. Output-folder selection is a separate single-folder Picker flow and stores only normalized folder id, safe approved web-view URL, and display name. Static Studio mode must not call `/api`, load Google Picker scripts, or expose Picker configuration.


## PWA job output destination contract

A project does not expose or manage a default Google Drive output folder in the active Studio product workflow. Destination authority belongs first to each preparation row and then to the immutable created-job output snapshot.

Every preparation row owns exactly one explicit result folder. A row without a result folder is incomplete, and every row must have a result folder before batch submission is enabled. Selecting or changing a row folder affects only that row. Reordering rows preserves each row's source, result folder, title, status, and retry identity.

Multi-file Google Drive intake and local-device intake create ordered rows with no preselected output folder. Adding an empty row creates a row with no source, no output folder, and no title. Successful batch submission resets the composer to exactly one fresh row with no source, no output folder, no title, no selected credential, and no pending idempotency state while job history reload remains unchanged.

Existing jobs retain immutable persisted `output_drive_folder_id`, `output_drive_folder_url`, and `output_drive_folder_name` snapshots. Those job snapshots remain the runtime authority for readiness, claiming, processing revalidation, Google Docs creation, output persistence, browser-safe job metadata, historical job display, existing results, and approved Google links.

Legacy project output-folder fields may temporarily remain in backend models, database columns, endpoints, and API responses for compatibility. They are not active product behavior: the normal Studio frontend must not display them, use them to initialize rows, mutate them, or treat them as destination authority. This contract does not require migrating or erasing existing project-folder values.

The normal platform-mode Studio composer is implemented directly in the selected project preparation workspace. One ordered row represents one ready project source mapped to one independently selected Google Drive output folder; one row creates one independent one-source job; several rows are submitted atomically through the batch endpoint. Source selection is inline in each row: users may choose one or more Google Drive files, choose one or more local files, or reuse an already-existing usable project source. Source-management cards such as safe metadata, Drive links, and project removal are secondary to preparation rows and must not be the mandatory first step. Row folder selection revalidates Picker output without mutating legacy project-level output-folder fields, duplicate `(source_id, output_folder_id)` rows are rejected before submission, and browser UI must not render folder ids, idempotency keys, tokens, raw Picker payloads, request hashes, or batch positions. Manifest behavior remains deferred and unchanged.

`POST /api/projects/{project_id}/jobs/batch` creates several one-source jobs atomically. It stores bounded idempotency metadata and a SHA-256 canonical request hash without storing unredacted request JSON, access tokens, URLs from Google verification, folder names in the hash, secrets, timestamps, or unredacted Google responses.

## Studio diagnostics product contract

`PWA-DIAGNOSTICS-01-PREP` is documentation-only. It defines future product behavior and does not implement diagnostic event storage, APIs, UI, exports, migrations, worker instrumentation, correlation middleware, retention jobs, cleanup, remote telemetry, or third-party analytics.

Studio diagnostics are three separate surfaces, not one undifferentiated log:

1. `Диагностика транскрибации` for normalized transcription/job timeline events.
2. `Диагностика PWA` for safe client/application diagnostics.
3. `Аудит безопасности` for security/account events.

Security audit events remain a separate security/account surface. Future diagnostics must use a separate diagnostic event model rather than turning the existing audit table into a general debug log.

Planned destination: `Настройки → Диагностика`. Planned sections are `Состояние системы`, `Транскрибация`, `PWA`, and `Аудит безопасности`. `Состояние системы` may show only safe coarse information: separate web, API, and worker build identities; PWA mode; online/offline state; Google Drive connection state; provider-key readiness; and diagnostic recording state. Web, API, and worker identities remain separate because they can deploy independently.

Diagnostic levels are `ERROR`, `WARNING`, `INFO`, and `DEBUG`. Normal product diagnostics use `ERROR`, `WARNING`, and `INFO`. `DEBUG` is opt-in, time-bounded, stops automatically, must not become permanent always-on telemetry, and one session may last no more than 30 minutes. Enabling `DEBUG` must show the user when it expires.

Future diagnostic events must be strict and allowlisted. Conceptual fields are: opaque event id, occurred-at timestamp, level, component (`web`, `api`, or `worker`), stable event code, correlation id, request id where relevant, opaque project scope where relevant, opaque job scope where relevant, bounded safe metadata, and occurrence count for deduplicated repeated events. The server must allowlist event codes and metadata keys. Diagnostics must not accept arbitrary frontend event names, free-form log messages, or arbitrary JSON metadata. Correlation and request identifiers must be opaque and must not contain user data, tokens, URLs, filenames, transcript content, or secrets.

Planned normalized transcription events include `JOB_CREATED`, `JOB_CLAIMED`, `PROCESSING_STARTED`, `SOURCE_VALIDATION_STARTED`, `SOURCE_READY`, `PROVIDER_REQUEST_STARTED`, `PROVIDER_REQUEST_COMPLETED`, `PROVIDER_REQUEST_FAILED`, `OUTPUT_CREATION_STARTED`, `OUTPUT_PERSISTED`, `JOB_COMPLETED`, `JOB_FAILED`, `JOB_CANCEL_REQUESTED`, and `JOB_CANCELLED`. The contract does not require storing provider payloads, transcript text, source bytes, Google document body, private object keys, or raw exceptions. Failures use normalized safe fields such as boundary, stable error code, retryable boolean, attempt number, safe duration, and safe HTTP status category where appropriate. Raw provider or Google response bodies must not be exposed.

Planned PWA diagnostics include application boot, session check outcome, route/page changes, project selection changes, composer row add/remove/reorder, Picker open/cancel/safe failure, local upload start/safe result, endpoint group with status category and duration, online/offline transitions, service-worker update state, sanitized React errors, sanitized `window.error`, and sanitized `unhandledrejection`. PWA diagnostics must not record keystrokes, field values, project title or description, task title, filenames by default, full URL or query string, request or response body, raw stack trace, or browser-storage contents.

Diagnostics, exports, and future logs must not contain passwords, API keys, credential values, cookies, CSRF tokens, OAuth code or state, access tokens, refresh tokens, authorization headers, transcript text, source media or bytes, Google document body, raw provider requests or responses, raw Google requests or responses, upload URLs, private storage paths or object keys, database DSNs, environment values, full URLs with query parameters, arbitrary form values, or full external stack traces. Filenames are excluded from diagnostic reports by default. Any future optional inclusion of display filenames requires an explicit user action and must still apply redaction.

Diagnostics retention must be finite and configurable. Default normal diagnostic retention is 14 days. `DEBUG` event retention is no more than 24 hours. One export request may cover no more than 7 days, and one report may contain no more than 5,000 timeline events. Repeated equivalent events should be deduplicated with occurrence counts. Truncation must be explicit in the report. Future ingestion must be rate-limited per user/session. Diagnostics failure must never block task creation or processing. Security audit retention is governed separately and must not silently inherit diagnostic retention.

Users may access diagnostics only for their own account and owned projects/jobs. Project/job identifiers in reports are opaque. Diagnostics must not provide cross-user visibility. Public or anonymous diagnostic export is not allowed. Export requires an authenticated same-origin action. Future state-changing diagnostic controls require CSRF protection. Downloading a report must not expose a reusable server-side secret URL.

The only planned report format is Markdown (`.md`); `.txt` is not a planned diagnostic report format. A Markdown report must contain report generation timestamp, selected period, redaction declaration, separate web/API/worker build identities, safe environment and PWA-mode summary, connection/readiness summary, selected project/job scope using opaque identifiers, event summary counts by level and component, chronological diagnostic timeline, deduplication/occurrence counts, truncation notice where applicable, and a statement of fields intentionally excluded. The export must not contain HTML, executable scripts, embedded remote content, raw JSON dumps, or secrets.

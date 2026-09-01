# Спецификация проекта VoiceOps

## 1. Назначение и authority

Этот документ — canonical product/project contract и backlog верхнего уровня. Он определяет актуальный scope, business rules, durable constraints, эпики и atomic acceptance criteria. Текущий delivery state, blockers, readiness и Evidence ведутся в `docs/delivery-plan.md`; история delivery — в `docs/delivery-plan-archive.md`.

Приоритет источников задаёт `AGENTS.md`. Инструкция владельца от 2026-08-14 заменила прежнюю модель «стабильный Colab batch + развиваемый Studio» моделью двух production-продуктов, каждый из которых содержит batch и realtime:

1. Google Colab: обычная транскрибация и realtime-транскрибация.
2. VoiceOps Studio PWA: обычная транскрибация и realtime-транскрибация.

Инструкциями владельца от 2026-08-27 и 2026-08-28 полный однозначно атомизированный scope upstream-документа включён в этот canonical contract. Commercial contour включён как `BACKLOG`, но его implementation не авторизована. Source traceability ниже использует `R001–R275` для list items и `N001–N008` для narrative paragraphs в порядке exact Google Doc revision `AIroW35q7CRMBmxDiv0eGwPndvIoeukwsYt52lE34wuTXCS_BKknSg_YarWNdCVNZv0r7sEFvECkb0g7Di32L3qLiCh2_BuJvkFKwtWra6M` от `2026-08-27T11:38:21.346Z`.

Статусы и Evidence в этом документе — operational metadata, а не изменение scope. Их нельзя принимать на веру при следующем аудите.

## 2. Модель готовности

- `⬜ BACKLOG` — эпик определён, но реализация не начата или не авторизована.
- `🟦 IN PROGRESS` — реализация начата, но Definition of Done ещё не выполнен.
- `🟩 READY` — выполнены 100% atomic acceptance criteria и все обязательные Evidence имеют `✅`.
- `⛔ BLOCKED` — дополнительный modifier к lifecycle state.

Evidence: `SPEC | CODE | TEST | CI | DEPLOY | LIVE`.

- `✅` — подтверждено.
- `◐` — подтверждено частично.
- `❌` — проверка выполнена и не пройдена.
- `—` — evidence отсутствует.
- `N/A` — evidence не требуется по Definition of Done.

Процент эпика — число выполненных равновесных atomic AC / число всех AC эпика. Процент продукта и проекта — сумма выполненных AC / сумма всех AC соответствующего текущего scope, а не среднее процентов эпиков. Evidence gate-ит `READY`, но не добавляет проценты.

Verified repository/runtime baseline: `main@11a9d1692c76e0e68d1176114bd6ca0fbe76eab0` has successful exact-main repository/Studio CI, platform CD and manual worker delivery recorded in `docs/delivery-plan.md`; public web/API/worker identity и schema `0031` подтверждены. Owner-authorized long-media LIVE evidence proved continuous progress and the transaction-free source-preparation boundary. A later multi-part attempt confirmed provider usage `801.689 s`, then exposed a checkpoint persistence regression caused by `SELECT ... FOR UPDATE` against the intentionally immutable restricted-worker checkpoint grant. The focused checkpoint-role hotfix is local-only until its PR/CI/deployment completes.

Current operational Goal: `PWA-TRANSCRIPTION-PROGRESS-HOTFIX-01`, state `IN_PROGRESS`. `PUX-13` и `JOBREL-17` закрыты exact-main CI/deployment/LIVE на `11a9d169`: единый live-updating progress meter работает без fabricated percentage, long-I/O worker boundaries не удерживают idle transaction, fresh fail-closed revalidation выполняется до provider spend, а safe provider diagnostics доставлена. Текущий follow-up исправляет immutable checkpoint persistence под restricted worker role и сохраняет automatic retry blocked; для confirmed-but-uncheckpointed результата допустим только explicit cost-confirmed full restart. Worker isolation, `idle_in_transaction_session_timeout=60s`, provider-cost/lifecycle gates, realtime STT и commercial contour остаются вне разрешённых изменений.

| Scope | Готовность | Метод |
|---|---:|---|
| Google Colab | **100% (`32/32`)** | completed exact-main CODE/TEST/CI и applicable LIVE; Colab deployment unit N/A |
| Personal Studio PWA | **78,8% (`241/306`)** | `PUX-13` и `JOBREL-17` закрыты exact-main CI/deployment/LIVE; current delivered baseline `11a9d169` |
| Non-commercial scope | **80,8% (`273/338`)** | Colab `32/32` + personal PWA `241/306` |
| Commercial/cross-contour BACKLOG | **0% (`0/242`)** | `ENVIRONMENT-CAPABILITIES-01 0/50` + commercial epics `0/192`; personal reuse не является commercial Evidence |
| Полный canonical scope | **47,1% (`273/580`)** | `273 / (338 non-commercial + 242 commercial/cross-contour)` |

Denominator исходного reconciliation был пересчитан из exact upstream revision: `283` raw source units (`275` list items + `8` narrative paragraphs) дали `384` новых уникальных atomic AC после удаления duplicates и исключения неатомизируемых conflicts/ambiguities. Owner decisions 2026-08-28 сначала добавили `14` atomic AC по Picker/diarization UX и versionless `transcript_doc`; direct Drive upload добавил ещё `6`, сформировав baseline `552`. Explicit owner instruction 2026-08-29 добавила `PTM-01..08`, затем `PD-14` и `PTM-09`, подняв denominator до `562` и completed numerator до `246`. Explicit owner approval 2026-08-30 добавил `12` atomic UX AC `PUX-01..12`, подняв denominator до `574`; previous delivery закрыл `STORAG-17..21` и довёл exact-main numerator до `264`. Explicit owner decision о provider account reconciliation добавил `USAGEC-03..06`, подняв denominator до `578`, non-commercial до `336`, personal PWA до `304`. Worker runtime Evidence подняло numerator до `266`; account LIVE — до `269`; одна persisted canary закрыла `USAGEC-01/02` и дала `271/578`. Explicit owner Goal 2026-09-01 добавила `PUX-13` и `JOBREL-17`, поэтому current denominator равен `580`, non-commercial `338`, personal PWA `306`; exact CI/deployment/LIVE сначала на `295033c8`, затем delivered baseline `11a9d169` закрыли оба AC и сохранили numerator `273`. Проценты не означают READY; unresolved `SPEC gaps` не входят в denominator.

### Commercial scope decision

Owner decision от 2026-08-27: отдельный commercial production для российских пользователей **включён в durable product scope**, но implementation сейчас **не авторизована**. Commercial contour имеет lifecycle state **⬜ BACKLOG** и modifier **⛔ BLOCKED (implementation authorization / external legal decisions)**.

Commercial scope атомизирован ниже в `242` AC без silent omission: российская infrastructure/data localization; independent environment/resources; registration/auth/TOTP; personal-data lifecycle; cross-border/provider legal gates; replaceable Russian STT production path; quotas/cost accounting; queue fairness; payments/subscriptions/fiscalization; unit economics; least privilege/RLS/audit/backup controls; notifications; legal readiness. Все `242` AC считаются невыполненными до contour-specific Evidence. Product implementation, CI/CD или production changes этим решением не разрешены.

## 3. Общие product rules

1. Primary batch artifact — Google Docs transcript; realtime должен позволять скачать подтверждённый текст как `.txt`.
2. Фраза владельца «импорт транскрипции в виде документа `.txt`» в текущем контракте означает выгрузку/скачивание результата. Import внешнего `.txt` обратно в продукт не включён без отдельного уточнения.
3. Языковые режимы обоих batch-продуктов: русский, английский и provider auto-detection. В Google Colab auto-detection выбран по умолчанию; русский и английский остаются optional explicit overrides.
4. Для нового transcript время в metadata документа — ISO 8601 и отражает фактическое создание исходного media file. При explicit standardization существующего legacy Google Doc без доступного исходного файла уже присутствующий валидный `Created at` сохраняется; если такого значения нет или оно невалидно, поле полностью пропускается. Время изменения файла, время job/Google Doc, filename и текущее время не являются допустимой заменой; подтверждённый conflict source dates блокирует mutation.
5. Duplicate protection использует устойчивую source identity: Google Drive file ID и доступные metadata; для local files — content fingerprint и доступные metadata. Filename alone недостаточен.
6. Accepted-output manifest/catalog record создаётся только после подтверждённого создания Google Docs результата. Operational job state может храниться отдельно, но не должен становиться ложным доказательством успешной транскрибации.
7. Transcript standardization добавляет metadata header и читабельные абзацы; folder operation охватывает выбранную папку и все вложенные подпапки.
8. Секреты, transcript/document bodies, private source bytes, provider/Google payloads и tokens не попадают в repository, browser-safe metadata, diagnostics или delivery evidence. Explicit owner-scoped Live draft API может возвращать владельцу только его зашифрованный-at-rest transcript draft через authenticated `no-store` response; это content response, а не browser-safe metadata или diagnostic payload.
9. Production/LIVE claims требуют exact revision/artifact identity и фактического runtime evidence; source presence и CI сами по себе этого не доказывают.
10. Primary Google OAuth grant для Studio ограничен exact набором identity + `drive.file` + `drive.readonly`: `drive.readonly` разрешает source ingestion из произвольных доступных пользователю Drive files/folders, а `drive.file` сохраняет write boundary для созданных или явно открытых приложением объектов. Full `drive` scope и любые иные дополнительные scopes запрещены. Расширение до `drive.readonly` явно авторизовано владельцем 2026-08-23; существующее подключение без этого scope требует disconnect/reconnect и нового consent.

## 4. Google Colab

### Эпик `COLAB-BATCH-01` — batch-транскрибация

Status: **🟩 READY — 100% (`24/24`)**. `CB-24` и весь batch contour подтверждены CODE/TEST, exact-main CI и bounded owner LIVE на reviewed revision; отдельный deployment unit для Colab не требуется.

Owner runtime evidence: существующий batch contour используется около четырёх месяцев и в целом стабилен; расширенный language-default scope также прошёл applicable CI и owner LIVE gates.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `CB-01` | Provider API keys читаются из Colab Secrets. | ✅ |
| `CB-02` | Пользователь выбирает target folder на Google Drive. | ✅ |
| `CB-03` | С компьютера выбирается один файл. | ✅ |
| `CB-04` | С компьютера выбираются несколько файлов. | ✅ |
| `CB-05` | С компьютера выбирается целая папка с файлами. | ✅ |
| `CB-06` | На Google Drive выбирается один source file. | ✅ |
| `CB-07` | На Google Drive выбираются несколько source files. | ✅ |
| `CB-08` | На Google Drive выбирается source folder. | ✅ |
| `CB-09` | Доступно разделение на спикеров. | ✅ |
| `CB-10` | Доступен явный русский язык. | ✅ |
| `CB-11` | Доступен явный английский язык. | ✅ |
| `CB-12` | Доступно auto-detection языка и оно выбрано по умолчанию; русский и английский остаются optional overrides. | ✅ |
| `CB-13` | Manifest защищает от повторной платной транскрибации. | ✅ |
| `CB-14` | Пользователь может явно пропустить manifest check. | ✅ |
| `CB-15` | Пользователь может безопасно очистить manifest. | ✅ |
| `CB-16` | Пользователь может зарегистрировать выбранную папку в manifest. | ✅ |
| `CB-17` | Manifest не записывает source до подтверждённого Google Docs результата. | ✅ |
| `CB-18` | Source identity основана на Drive metadata/content fingerprint, а не только на имени. | ✅ |
| `CB-19` | Новый transcript document разбит на читабельные абзацы. | ✅ |
| `CB-20` | В начало документа добавлен metadata header. | ✅ |
| `CB-21` | Видимое время документа записано в ISO 8601. | ✅ |
| `CB-22` | Время получено из фактического creation time исходного media file. | ✅ |
| `CB-23` | Есть быстрая dry-run/apply стандартизация выбранной папки и всех подпапок. | ✅ |
| `CB-24` | Каждый новый Colab transcript создаётся в canonical versionless формате `transcript_doc`: название документа — Google Docs `Heading 2`, метка `Спикер N:` — русская, bold и `14 pt`, обычный текст — `11 pt`; устойчивые technical terms и metadata keys остаются на английском. | ✅ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ◐ | DEPLOY N/A | LIVE ◐`.

Verified state: `main@c9ac43fc71a97a868db744088c06c69882a555fa` выбирает auto-detection по умолчанию без удаления explicit Russian/English overrides. Exact-main batch canary обработал supported media из вложенной local folder, создал native Google Doc с authoritative embedded creation time в strict ISO 8601 и обновил manifest после создания документа; CODE/TEST также подтверждают English, safe manifest clear и post-output-only source persistence.

Definition of Done: `24/24`, релевантные tests/CI green, ручной Colab validation на reviewed SHA и LIVE batch canary без повторного provider charge или утечки private data. `CB-24` включён в durable scope и авторизован current Goal `TRANSCRIPT-DOC-STANDARD-01`.

### Эпик `COLAB-REALTIME-01` — realtime-транскрибация

Status: **🟩 READY — 100% (`6/6`)**.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `CR-01` | В Windows/Chrome выбирается вкладка, окно или экран через display capture. | ✅ |
| `CR-02` | Захватывается передаваемый browser/system audio track. | ✅ |
| `CR-03` | Микрофон включается опционально и может смешиваться с display audio. | ✅ |
| `CR-04` | Partial и committed transcript отображаются live в окне. | ✅ |
| `CR-05` | Подтверждённый transcript скачивается как `.txt`. | ✅ |
| `CR-06` | Захват не рвётся в согласованной серии representative Windows/Chrome sessions. | ✅ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY N/A | LIVE ✅`.

`main@ceab95988b4a16f36e76134d6312a10c60d72fe5` добавляет track-ended cleanup, session/WebSocket timeouts и backpressure guard; automatic reconnect намеренно отсутствует, поскольку новый Start обязан получить новый single-use token. Owner-controlled ordinary-Chrome matrix подтвердила microphone/display/mixed, repeated start/stop, permission cancel и resource release без воспроизводимого capture break. Realtime Colab не создаёт Google Docs и manifest.

## 5. Studio PWA

### Эпик `PWA-CORE-01` — application shell, auth и integrations

Status: **🟩 READY — 100% (`14/14`)**. Все product AC, exact-main CI/deployment и bounded production upload-progress обоих workspace подтверждены.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `PC-01` | Интерфейс адаптивен на desktop и narrow viewport без document-level overflow и недоступных controls. | ✅ |
| `PC-02` | Sidebar содержит Dashboard. | ✅ |
| `PC-03` | Primary navigation и page title используют пользовательскую сущность `Транскрибации`, а не технический `Project`. | ✅ |
| `PC-04` | Sidebar содержит Settings. | ✅ |
| `PC-05` | Admin входит по login/password и получает server session. | ✅ |
| `PC-06` | Provider API keys добавляются и управляются в Settings. | ✅ |
| `PC-07` | Google Drive подключается через owner-scoped OAuth flow. | ✅ |
| `PC-08` | Local uploads хранятся в Cloudflare R2 через S3-compatible boundary. | ✅ |
| `PC-09` | В Settings выбирается retention period local uploads. | ✅ |
| `PC-10` | После expiry object удаляется из R2 идемпотентным cleanup. | ✅ |
| `PC-11` | После expiry local source исчезает из active web UI. | ✅ |
| `PC-12` | Доступны system, light и dark themes. | ✅ |
| `PC-13` | Пользователь выбирает accent/interface color. | ✅ |
| `PC-14` | Direct local upload в `Обработке аудио` и `Транскрибациях` показывает реальный progress текущего файла в bytes/percent и aggregate queue progress; timeout/network outcome проходит completion reconciliation без автоматического повторного PUT. | ✅ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`.

UX/UI-аудит production на viewport `390x844` ранее выявил document-level horizontal overflow в Diagnostics; deployed remediation заменила unbounded metadata grid и добавила narrow single-column layout. Read-only production inspection 2026-08-23 подтвердил authenticated shell, три primary navigation controls, active provider credential, Google Drive connection, retention/theme/accent controls и отсутствие browser console warnings/errors. Эмуляция narrow viewport не выявила overflow относительно фактического layout viewport, но не подтверждает production expiry/cleanup lifecycle.

Expired source metadata может сохраняться для history/audit, но current owner instruction требует скрывать expired local files из active intake UI. Это заменяет старое UI-допущение о видимости недоступной metadata.

Verified implementation: active project source collection исключает local rows при `expires_at <= now` либо durable status `expired`, не удаляя `Source`, job relations или history evidence. Exact-main CI и subsequent production component deployments подтверждены; bounded LIVE expiry/cleanup coverage остаётся неполным.

### Эпик `PWA-USER-EXPERIENCE-02` — пользовательский язык и progressive disclosure

Status: **🟩 READY — 100% (`13/13`)**. Все product AC, exact-main CI/deployment и authenticated production progress LIVE подтверждены.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `PUX-01` | Обзор приоритетно показывает пользовательские действия, текущую работу и доступные результаты; configuration counters не выступают главным содержанием страницы. | ✅ |
| `PUX-02` | Основной flow `Подготовка аудио` описывает варианты выбора по пользовательскому результату; S3, server-side FFmpeg, MIME, bytes и иные implementation details не показываются без явного раскрытия технических деталей. | ✅ |
| `PUX-03` | Composer и preflight транскрибации используют понятные русские действия и явную non-color-only индикацию важных опций; internal source/output type names и identifiers не входят в default presentation. | ✅ |
| `PUX-04` | Одиночная job отображается как `Транскрибация`, а batch с несколькими jobs — как `Группа транскрибаций`; служебные labels `Мульти-транскрибация` и `Элемент N` отсутствуют в default presentation. | ✅ |
| `PUX-05` | Terminal notice имеет семантически корректный visual/ARIA tone для success, failure и cancellation; failed/cancelled state не использует success styling. | ✅ |
| `PUX-06` | Пользователь видит локализованную actionable ошибку; raw backend/provider error code не показывается по умолчанию и доступен только в явно раскрытых данных для поддержки. | ✅ |
| `PUX-07` | Job/History cards не дублируют одинаковые timestamps и metadata; UUID, storage/source/output technical types и расширенные processing details находятся под явным disclosure. | ✅ |
| `PUX-08` | Основной Live flow объясняет захват, временное восстановление и результат пользовательским русским языком; model/VAD/checkpoint/storage/reconnect implementation details находятся под disclosure `Технические детали`. | ✅ |
| `PUX-09` | Transcript maintenance использует user-task terms (`проверка`, `применение`, `актуальный формат`) в основных controls/messages; `dry-run`, metadata, catalog и standard identifiers показываются только как secondary technical help. | ✅ |
| `PUX-10` | Maintenance result сначала показывает summary и доступные действия, а длинные document lists имеют filter и bounded pagination/progressive disclosure без unbounded render всех строк. | ✅ |
| `PUX-11` | В Settings обычные подключения и пользовательские storage preferences отделены от diagnostics, runtime identity, debug/export и maintenance access, которые явно обозначены как раздел для поддержки/расширенные настройки. | ✅ |
| `PUX-12` | App-owned Google Drive dialog на viewport `390x844` не имеет horizontal overflow, сохраняет читаемые названия и доступные primary/close controls; modal scroll остаётся изолирован от страницы. | ✅ |
| `PUX-13` | Running transcription отображается одним постоянно активным user-facing progress meter с текущим действием и активным файлом; owner-scoped automatic refresh обновляет state без ручного reload/tab switch, exact percentage отражает только подтверждённые checkpoints, а technical stages доступны под progressive disclosure. | ✅ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`. Exact `main@295033c8b4481528ffcb739bf9c017e22a05e9c9`, repository CI `33495743363`, Studio/browser `33495743357` и platform/worker delivery `33495743305` / `33496421647` подтверждены. Owner-authorized long-media job `66e70976-2f26-4ed0-93d6-8436784b9fdd` обновляла единый meter без reload/tab switch на протяжении source preparation за прежней 60-second границей; provider rejection произошёл уже после подтверждённого dispatch boundary и не отменяет progress Evidence.

### Эпик `PWA-TRANSCRIPTIONS-UX-01` — пользовательская модель транскрибаций

Status: **🟦 IN PROGRESS — 100% (`4/4`)**. Все product AC, exact-main CI и web deployment подтверждены; authenticated production LIVE для source-cache/navigation behavior ещё не выполнен, поэтому эпик не `READY`.

`Project` остаётся допустимой внутренней ownership/data boundary, но не является обязательной пользовательской сущностью. Основной user flow начинается с обычной или Live-транскрибации; технический workspace выбирается или создаётся автоматически и не требует ручного lifecycle management.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `PT-01` | В `Транскрибациях` доступны отдельные вкладки обычной и Live-транскрибации. | ✅ |
| `PT-02` | Для запуска новой транскрибации пользователь не создаёт, не редактирует и не архивирует технический Project вручную. | ✅ |
| `PT-03` | Один массовый запуск отображается как одна мульти-транскрибация с отдельными source/fragment items. | ✅ |
| `PT-04` | Существующие active legacy workspaces, sources, jobs и outputs остаются доступны без destructive migration; archived production data не восстанавливается автоматически. | ✅ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE —`.

Verified implementation: backend не раскрывает raw batch idempotency key/request hash и выдаёт только deterministic owner/project/key-scoped `multi_*` reference с bounded position. Frontend fail-closed валидирует reference, не допускает duplicate positions, отображает batch одной multi-transcription и сохраняет отдельные progress/output/recovery controls каждого source/fragment item. Exact-main repository и Studio/browser CI прошли на `18cbd46`; web deployment подтверждён. Bounded narrow browser fixture также прошёл; authenticated production source-cache/navigation behavior ожидает LIVE Evidence.

### Эпик `PWA-INGEST-01` — target и source selection, multi-transcription

Status: **🟩 READY — 100% (`11/11`)**. Exact `drive.file + drive.readonly`, reconnect, folder intake, shared target propagation и per-row override подтверждены source, tests, CI, deployment и bounded production LIVE.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `PI-01` | Выбирается target Google Drive folder. | ✅ |
| `PI-02` | Target folder можно добавить в Favorites и выбрать повторно. | ✅ |
| `PI-03` | С компьютера выбирается один файл. | ✅ |
| `PI-04` | С компьютера выбираются несколько файлов. | ✅ |
| `PI-05` | С компьютера выбирается целая папка с файлами. | ✅ |
| `PI-06` | На Google Drive выбирается один source file. | ✅ |
| `PI-07` | На Google Drive выбираются несколько source files. | ✅ |
| `PI-08` | На Google Drive выбирается source folder. | ✅ |
| `PI-09` | Один batch принимает одну target folder и несколько явно выбранных files. | ✅ |
| `PI-10` | Один batch принимает одну target folder и source folder. | ✅ |
| `PI-11` | Для каждой composer row можно независимо выбрать source и target folder. | ✅ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`.

Verified implementation: Favorites и local folder flow подтверждены. `main@cb3a9e9216521c56e07b6f7b6fda9bf8eb8051f8` использует exact `drive.file + drive.readonly`, требует reconnect для старых grants, отдельно gate-ит source-folder traversal по `drive.readonly` и отклоняет full `drive`/unrelated scopes. Exact-main CI, web deployment, оба OAuth reconnect и bounded LIVE подтвердили рекурсивный import девяти supported Drive files в девять composer rows без запуска provider job. Первая поздно выбранная verified target folder заполняет только unassigned rows, последующий per-row override сохраняется; все девять строк сохранили `До конца файла` и достигли ready state.

### Эпик `PWA-GOOGLE-PICKER-UX-01` — app-owned Drive selection, search и viewport

Status: **🟩 READY — 100% (`8/8`)**. App-owned source/output Drive dialogs, bounded search/pagination/current-folder semantics и viewport behavior подтверждены completed delivery.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `PG-01` | Во всех source-file/source-folder/output-folder Picker flows открытая Google Picker modal остаётся зафиксированной относительно viewport и не смещается вслед за document scroll. | ✅ |
| `PG-02` | Пока Google Picker открыт, background document scroll заблокирован; после pick/cancel/error/timeout предыдущие scroll position и body styles восстанавливаются без page jump. | ✅ |
| `PG-03` | В output-folder flow текущая открытая папка является допустимым default selection: кнопка `Выбрать` активна без выбора вложенной папки, включая папку без дочерних папок. | ✅ |
| `PG-04` | App-owned output-folder dialog позволяет искать доступные папки по имени, открывать найденную папку и выбрать её как current target без обязательного выбора вложенной папки. | ✅ |
| `PG-05` | Source-file flow использует app-owned интерфейс, визуально и поведенчески согласованный с output-folder dialog; native Google Picker для этого flow не используется. | ✅ |
| `PG-06` | Source-file dialog позволяет искать поддерживаемые audio/video files по имени и выбрать до `50` файлов; navigation/search/pagination не теряют уже выбранные элементы и не создают duplicates. | ✅ |
| `PG-07` | Source-folder flow использует app-owned интерфейс, визуально и поведенчески согласованный с output-folder dialog; текущая открытая папка является допустимым selection, включая empty folder. | ✅ |
| `PG-08` | Source-folder dialog позволяет искать доступные папки по имени, открыть найденную папку и выбрать её как current source folder. | ✅ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`.

Verified implementation: `main@535a015dcef211a930faefe443245ee85ace38b8` сохраняет scroll/focus/current-folder boundaries и использует согласованные app-owned dialogs для трёх picker modes. PR `#253` и hotfix PR `#254`, exact-head/main CI, web deployment и authenticated LIVE подтвердили folder/file search, current empty folder, shared folders/drives и source-file multi-selection `2 → 1 → 2` без provider call.

### Эпик `PWA-SEGMENTS-01` — произвольные пользовательские фрагменты

Status: **🟩 READY — 100% (`5/5`)**.

Generalized composer принимает ordered plan из `N >= 1` фрагментов в пределах batch maximum. Browser и API отклоняют malformed, reversed, overlapping, out-of-order и over-limit планы; каждый принятый фрагмент становится отдельной job с immutable clip/output-folder snapshot и проходит существующий one-job/one-Google-Docs-output pipeline.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `PS-01` | Пользователь задаёт число фрагментов. | ✅ |
| `PS-02` | Поддерживается произвольное число `N >= 1`, а не только две части. | ✅ |
| `PS-03` | Для каждого фрагмента задаётся start time. | ✅ |
| `PS-04` | Для каждого фрагмента задаётся end time либо явный `Конец`. | ✅ |
| `PS-05` | Для каждого валидного фрагмента создаётся отдельный transcript document. | ✅ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`.

### Эпик `PWA-BATCH-01` — transcription options, progress и output

Status: **🟩 READY — 100% (`11/11`)**. Existing transcription behavior и явная non-color-only индикация diarization подтверждены completed delivery.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `PB-01` | Доступно разделение на спикеров. | ✅ |
| `PB-02` | Доступен явный русский язык. | ✅ |
| `PB-03` | Доступен явный английский язык. | ✅ |
| `PB-04` | Доступно auto-detection языка. | ✅ |
| `PB-05` | Job progress отображается live в процентах из server checkpoints. | ✅ |
| `PB-06` | Успешная job создаёт Google Docs transcript и safe output link. | ✅ |
| `PB-07` | Transcript document разбит на читабельные абзацы. | ✅ |
| `PB-08` | В начало документа добавлен metadata header. | ✅ |
| `PB-09` | Видимый timestamp имеет ISO 8601 format. | ✅ |
| `PB-10` | Timestamp получен из фактического creation time исходного media file. | ✅ |
| `PB-11` | Composer и preflight явно текстом показывают `Разделение спикеров: включено` или `Разделение спикеров: выключено`; включённое состояние визуально заметно и не передаётся только цветом. | ✅ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`.

`main@800bcc820529ff3c78214c129c593d182c621c62` передаёт persisted source creation authority в output/maintenance contract и запрещает fallback на Google Doc/job/upload/modified clocks. Exact-main CI/CD и bounded production canary подтверждены delivery record PR #227. Явные states diarization в composer/preflight подтверждены PR `#253`, hotfix PR `#254`, exact-main web delivery и authenticated LIVE на `main@535a015dcef211a930faefe443245ee85ace38b8`.

### Эпик `PWA-AUDIO-PREPARATION-01` — самостоятельная обработка аудио

Status: **🟩 READY — 100% (`30/30`)**. Все atomic AC, exact-main CI, API/web/worker delivery и authenticated direct-upload/audio-processing LIVE подтверждены completed delivery chain.

Audio preparation — отдельный пользовательский workspace до транскрибации. Он может завершиться самостоятельным processed-media output без provider call; результат скачивается на устройство либо загружается в явно выбранную Google Drive folder. Отдельный direct-upload mode переносит исходные audio/video с устройства непосредственно в Google Drive без обработки и без промежуточного хранения в Studio.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `AP-01` | Sidebar содержит отдельный пункт `Подготовка аудио` непосредственно перед `Транскрипциями`, а hero той же страницы использует заголовок `Подготовка аудио`. | ✅ |
| `AP-02` | Пользователь выбирает один или несколько доступных owner-scoped media sources и запускает обработку независимо от транскрибации. | ✅ |
| `AP-03` | До обработки каждый input проверяется через bounded probe на container, codec, duration, audio-stream presence и media integrity; invalid input fail-closed. | ✅ |
| `AP-04` | Несколько inputs по умолчанию упорядочиваются по authoritative creation time, а пользователь может явно изменить порядок до запуска. | ✅ |
| `AP-05` | Совместимые inputs могут быть склеены без перекодирования и потери качества; несовместимый copy plan блокируется до явного выбора conversion path. | ✅ |
| `AP-06` | Processed output можно явно преобразовать в `WAV` или `FLAC`. | ✅ |
| `AP-07` | Для stereo input доступен явный mono mode: mixdown, left channel или right channel; недоступный channel mode отклоняется до processing. | ✅ |
| `AP-08` | Silence processing позволяет задать threshold, минимальную длительность тишины и сколько тишины оставить; значения имеют bounded safe limits. | ✅ |
| `AP-09` | До mutation пользователь получает preview общей исходной длительности и оценочной длительности после silence processing. | ✅ |
| `AP-10` | Склейка, silence processing, conversion и переименование могут выполняться отдельно или в комбинации без обязательной последующей транскрибации. | ✅ |
| `AP-11` | Output filename формируется из безопасного пользовательского имени либо bounded шаблона с доступными date/time/project/title metadata. | ✅ |
| `AP-12` | Доступны bounded presets для типовых сценариев `Лекция`, `Созвон` и `Только обработать аудио`, причём пользователь видит и может изменить итоговые параметры до запуска. | ✅ |
| `AP-13` | Processing имеет durable owner-scoped queue state, server checkpoints, live progress, cancellation и безопасное восстановление после worker restart. | ✅ |
| `AP-14` | Успешный output хранится в configured S3-compatible temporary storage по owner retention policy, доступен для authenticated download и может быть выбран как новый source. | ✅ |
| `AP-15` | Пользователь может загрузить successful output в явно выбранную Google Drive folder через owner grant с `drive.file`; persisted result содержит safe Drive link без token/object identity. | ✅ |
| `AP-16` | Ephemeral reference uploads хранятся в S3-compatible storage только до terminal state операции и имеют hard failsafe TTL 24 часа; request-scoped FFmpeg files и failed partial output удаляются после success/failure/cancel, а API/UI/logs/diagnostics не раскрывают private paths, object keys или source bytes. | ✅ |
| `AP-17` | Пользователь может обработать device media browser-side без передачи source bytes в API/S3/provider; результат существует только в текущей вкладке и скачивается как WAV. | ✅ |
| `AP-18` | Browser-local path имеет явные file-count/input-size/decoded-memory bounds и при неподдерживаемом codec/channel/resources выдаёт понятную ошибку с предложением server-side Studio path. | ✅ |
| `AP-19` | Для нескольких inputs пользователь явно выбирает `Обработать каждый отдельно` (default, отдельный output на source) либо `Склеить в один файл` (один ordered output). | ✅ |
| `AP-20` | До запуска UI показывает numbered result/concat plan, origin, size и authoritative creation metadata where available, позволяет manual reorder и не использует filename как creation/order authority. | ✅ |
| `AP-21` | Default plan сохраняет исходный format/container; изменение каналов или пауз требует явного WAV/FLAC conversion path без скрытого перекодирования. | ✅ |
| `AP-22` | Primary UI использует user-facing scenario/title controls, не показывает technical filename template, называет функцию `Уменьшить длинные паузы в аудио или видео`, использует default `-45 dB` и раскрывает остальные silence parameters только после включения функции. | ✅ |
| `AP-23` | Download, optional save в явно выбранную Google Drive folder и handoff/reuse в транскрибацию или новую обработку представлены независимыми terminal actions, а не взаимоисключающим выбором результата. | ✅ |
| `AP-24` | Server-side FLAC создаётся с явной 16-bit sample precision и исходной sample rate, UI раскрывает эти параметры, а FFmpeg filter graph не может неявно повысить output до избыточного 24-bit. | ✅ |
| `AP-25` | Source actions оформлены как доступный tablist; mode `В Google Drive без обработки` принимает bounded multi-select только поддерживаемых audio/video с устройства и сохраняет исходные bytes, filename и MIME без преобразования. | ✅ |
| `AP-26` | Для direct-upload mode целевая folder выбирается существующим app-owned output-folder dialog с search/navigation/shared drives и возможностью выбрать current folder, включая empty folder. | ✅ |
| `AP-27` | Resumable transfer идёт напрямую browser → Google Drive и не отправляет source bytes в Studio API, S3, Studio Source, FFmpeg, transcription или provider; используются только существующие Google OAuth scopes без expansion. | ✅ |
| `AP-28` | UI показывает current-file и aggregate progress в bytes и процентах, текущую стадию и cancellation; automatic retry/replay отсутствует. | ✅ |
| `AP-29` | File count, per-file/aggregate size и MIME имеют явные bounds; partial failures изолированы, а manual retry использует устойчивый idempotency marker и не дублирует уже подтверждённые uploads. | ✅ |
| `AP-30` | API server-side проверяет owner destination и result metadata: file ID, parent, name, MIME, size и idempotency marker; UI показывает только safe Drive links, а token/resumable upload URL/private diagnostics не логируются и не сохраняются. | ✅ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ◐ | CI — | DEPLOY — | LIVE —`.

Current Goal local Evidence: backend descriptor/capability/result unit tests `3/3`; direct uploader and component regressions cover invalid MIME/bounds, resumable session validation, marker reuse, partial failure, per-file/aggregate progress, multi-file cancellation and explicit safe retry. Full portable Python suite is `1095 passed, 5 skipped`; full Studio Vitest is `627/627`; ESLint, TypeScript/Vite/PWA production build and lightweight repository checks pass. DB-backed API regression is authored but local PostgreSQL/Redis/Docker are unavailable, so `TEST` remains partial until exact-head repository CI.

Verified base delivery: PRs `#234–#235`, final merge `16badb0aa4404ae2616a3d46070925b54b043963`; exact-main repository/Studio CI, protected migration `0025_audio_preparation`, API/worker/web rollout и bounded operation `2ad99ead-1c45-4439-8e8a-d64c2bcc3037` подтвердили preview `0:04 → 0:02`, terminal `completed`, download/Drive/reuse и ephemeral cleanup. PR `#237`, exact-main CI/CD и browser-local production WAV подтвердили новый UX, локальную обработку и независимые actions. Последующий exact worker retest на двух сохранённых OBS/MKV sources дал два независимых `invalid_input` на 5%; initial stream/container numeric-duration fallback оказался недостаточным, поэтому `AP-10` остаётся reopened до hotfix CI/deploy и успешного server concat LIVE.

Latest verified runtime: PR `#242` merged как `main@bffbdb11b882701226898b9f7d03062fd69b2679`; exact-main CI/CD и manual worker rollout подтверждены. Production job `9010f902-145b-4ef0-bfef-0416a20daeaf` обработал три реальных OBS/MKV (`137:36 → 129:48`) до `completed`, download action доступен, client warnings/errors отсутствуют. Полученный FLAC оказался больше `600 MB`; локальная FFmpeg diagnosis подтвердила неявный `s32`/24-bit output и стала основанием для `AP-24`.

Final FLAC remediation: PR `#243` merged как `main@018b560035e4ff2219c246f734216f76537875ee`; exact-main CI/CD и manual worker rollout завершились success. Повторный production output `78da8f8e-dfb4-47f7-b6db-fb9a64995fb0` имеет `s16`, `48 kHz`, mono, duration `7907.718563` секунд и размер `334113611` bytes (`318.64 MiB`), закрывая `AP-24`.

Definition of Done: `30/30`, relevant backend/frontend tests и required exact-head CI green, applicable API/web deployment, bounded owner-controlled server concat/browser-local processing LIVE и direct browser-to-Drive upload LIVE с короткими media fixtures, progress/cancel/manual idempotent retry и server-verified safe links без provider call. Worker/deployment migration для direct-upload Goal не требуются.

### Эпик `PWA-SPEAKER-IDENTITY-01` — имена и роли спикеров

Status: **🟩 READY — 100% (`5/5`)**. Exact-main CI, protected migration, API/worker/web deployment и bounded owner-controlled LIVE подтверждены.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `SP-01` | Есть owner-scoped база имён спикеров. | ✅ |
| `SP-02` | Для speaker identity хранится роль. | ✅ |
| `SP-03` | Пользователь может прослушать bounded voice fragment обнаруженного спикера. | ✅ |
| `SP-04` | Пользователь явно связывает provider speaker label с выбранным именем. | ✅ |
| `SP-05` | Подтверждённое имя/роль используется в transcript output и history metadata. | ✅ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`.

Verified delivery: PR `#233` merged как `main@5e4a3aae8b79f2cb69c6c2efc8282d961b0392e6`; exact-main CI `32760830338`/`32760830386`, protected migration `0024_speaker_identity`, API/worker/web delivery и bounded synthetic two-speaker LIVE подтвердили profile → sample → explicit assignment → Google Docs/History flow.

Автоматическое biometric matching, voiceprints и embeddings не следуют из требования. Текущий scope — manual listen-and-assign; иная модель требует отдельного privacy/security решения.

### Эпик `PWA-MANIFEST-01` — duplicate protection и каталог

Status: **🟦 IN PROGRESS — 100% (`6/6`)**. Product AC и delivery до production подтверждены; current owner UI и accepted-output catalog path наблюдались LIVE, но representative folder import/clear mutation не выполнялись в bounded production validation этой Goal.

В PWA роль manifest выполняет PostgreSQL-backed `Манифест Studio`, а не общий JSON-файл Colab.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `PM-01` | Accepted output evidence блокирует неявную повторную транскрибацию. | ✅ |
| `PM-02` | Явный reprocess/bypass требует отдельного user confirmation. | ✅ |
| `PM-03` | Пользователь может безопасно очистить owner-scoped manifest/catalog. | ✅ |
| `PM-04` | Выбранная Google Drive folder tree регистрируется отдельным dry-run/apply flow. | ✅ |
| `PM-05` | Accepted-output record появляется только после Google Docs creation evidence. | ✅ |
| `PM-06` | Duplicate identity использует Drive file ID/Studio source identity и settings, не filename alone. | ✅ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ◐`.

### Эпик `PWA-STANDARDIZATION-01` — стандартизация Google Docs

Status: **🟩 READY — 100% (`14/14`)**. Exact-main CI, API/web/worker delivery и owner LIVE подтвердили новые `transcript_doc`, recursive preview и explicit массовую legacy standardization `141/141` без ошибок.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `PD-01` | Есть отдельная быстрая selected-folder dry-run/apply operation. | ✅ |
| `PD-02` | Folder mode обходит все вложенные подпапки в bounded tree. | ✅ |
| `PD-03` | Документ нормализуется в читабельные абзацы. | ✅ |
| `PD-04` | Документ получает standard metadata header. | ✅ |
| `PD-05` | Timestamp нормализуется в ISO 8601. | ✅ |
| `PD-06` | Timestamp отражает creation time исходного media file, а не Google Doc/job time. | ✅ |
| `PD-07` | Canonical identifier текущего document standard — versionless `transcript_doc`; user-facing flow не предлагает выбор версии стандарта. | ✅ |
| `PD-08` | Название документа в новых и стандартизированных transcripts оформлено Google Docs style `Heading 2`. | ✅ |
| `PD-09` | Метка каждого блока спикера имеет русскую форму `Спикер N:`, bold и размер `14 pt`. | ✅ |
| `PD-10` | Обычный текст транскрибации по умолчанию имеет размер `11 pt`. | ✅ |
| `PD-11` | Пользовательские структурные labels документа русифицированы; устойчивые technical terms и metadata keys сохраняются на английском. | ✅ |
| `PD-12` | Каждый новый Studio PWA transcript создаётся в текущем canonical формате `transcript_doc`. | ✅ |
| `PD-13` | Existing eligible Google Docs приводятся к текущему `transcript_doc` через существующий explicit dry-run/apply standardization flow одной пользовательской операцией; historical version selection не требуется. | ✅ |
| `PD-14` | Existing legacy Google Doc стандартируется без обязательной связи с исходным media file: валидный существующий `Created at` сохраняется, отсутствующий/невалидный не создаётся и не заменяется `unknown` или догадкой; подтверждённый source-date conflict остаётся blocker. | ✅ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`.

Standardization и manifest import остаются разными authority: preview/confirmation одной операции не авторизует другую.

Authoritative source date по-прежнему имеет приоритет и должна точно совпадать с видимым ISO timestamp. Для explicit legacy mutation при `source_creation_status=unavailable` существующий валидный `Created at` сохраняется, отсутствующий или невалидный удаляется; `conflict` остаётся fail-closed. Это поведение подтверждено exact-main CI/deployment и owner LIVE.

### Эпик `PWA-TRANSCRIPT-MAINTENANCE-01` — workspace и durable execution обслуживания

Status: **🟩 READY — 100% (`9/9`)**. Exact-main CI, protected API/web/worker delivery и authenticated recursive preview/apply подтвердили durable execution и continuous progress.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `PTM-01` | Стандартизация Google Docs и `Манифест Studio` находятся в отдельном workspace `Транскрибации → Обслуживание`; `Настройки → Подключения` содержит только connection/consent controls и ссылку в workspace. | ✅ |
| `PTM-02` | Выбор root folder и одного native Google Doc использует app-owned Google Drive dialog с навигацией, bounded search, выбором текущей папки и блокировкой фонового scroll. | ✅ |
| `PTM-03` | Dry-run и apply выполняются как durable owner-scoped background runs и восстанавливают состояние после navigation/reload, worker restart или истечения lease; длительный Google traversal не удерживает browser HTTP request. | ✅ |
| `PTM-04` | UI показывает persisted stage, bounded progress и terminal result; Drive/document IDs, OAuth tokens, document contents и raw Google errors не возвращаются в browser DTO и не попадают в operational logs. | ✅ |
| `PTM-05` | Apply создаётся только из успешного owner-scoped preview, наследует его exact workflow/target, выполняет fresh server-side revalidation и остаётся explicit user-confirmed operation. | ✅ |
| `PTM-06` | Повтор запроса idempotent, conflicting replay fail-closed, а один owner не может одновременно запустить два runs одного workflow. | ✅ |
| `PTM-07` | Timeout, rate limit, auth/scope, selection, revision/write conflict и exhausted retry возвращаются как structured safe error codes с понятным русским действием без raw backend detail. | ✅ |
| `PTM-08` | Worker обрабатывает maintenance runs только после normal audio-preparation/transcription work; lease generation и heartbeat не позволяют потерявшему lease worker перезаписать reclaimed run. | ✅ |
| `PTM-09` | Пока owner-scoped maintenance run имеет status `queued` или `running`, открытый workspace автоматически запрашивает fresh `no-store` state и обновляет progress до terminal status без reload, remount или переключения вкладки. | ✅ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`.

### Эпик `PWA-REALTIME-01` — realtime-транскрибация

Status: **🟩 READY — 100% (`13/13`)**.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `PR-01` | В Windows/Chrome выбирается вкладка, окно или экран. | ✅ |
| `PR-02` | Захватывается передаваемый browser/system audio track. | ✅ |
| `PR-03` | Микрофон включается опционально и смешивается с display audio. | ✅ |
| `PR-04` | Partial и committed transcript отображаются live. | ✅ |
| `PR-05` | Подтверждённый transcript скачивается как `.txt`. | ✅ |
| `PR-06` | Representative microphone/display/mixed sessions стабильно проходят production LIVE canaries. | ✅ |
| `PR-07` | Каждый committed fragment немедленно сохраняется в owner/browser-scoped local draft. | ✅ |
| `PR-08` | Последний partial fragment сохраняется с bounded debounce и явно остаётся неподтверждённым. | ✅ |
| `PR-09` | Live draft синхронизируется в owner-scoped server storage с encryption at rest, bounded size и idempotent monotonic revision. | ✅ |
| `PR-10` | После refresh, browser crash или перезапуска компьютера пользователь получает явное предложение восстановить незавершённый draft. | ✅ |
| `PR-11` | Найденный draft можно восстановить, скачать как `.txt` или удалить явным действием. | ✅ |
| `PR-12` | Server Live draft имеет TTL 72 часа, исчезает из recovery после expiry и удаляется idempotent cleanup. | ✅ |
| `PR-13` | Live draft не сохраняет audio и не включает transcript body в logs, diagnostics, audit events или ordinary History/Analytics. | ✅ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`.

Realtime использует short-lived single-use capability. Он не создаёт batch jobs, Google Docs, manifest/catalog records, analytics records или audio records. Transcript body может существовать только как explicit temporary recovery draft по `PR-07..13`; ordinary diagnostics/history/analytics boundary его не получает. `main@ebbba50a938feb2d06b2ec59e828834ff204988d` завершает representative display/microphone/mixed matrix: owned resources освобождаются при stop/error/retry, source meters не сохраняют samples, display ducking при microphone activity снижает masking, а bounded ordinary-Chrome LIVE подтвердил одновременное поступление обоих signals.

### Эпик `PWA-OPERABILITY-01` — diagnostics, history и analytics

Status: **🟩 READY — 100% (`18/18`)**.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `PO-01` | Собираются safe backend diagnostics. | ✅ |
| `PO-02` | Собираются safe frontend/PWA diagnostics. | ✅ |
| `PO-03` | Диагностический summary отражает safe configuration state. | ✅ |
| `PO-04` | Diagnostics экспортируются в Markdown. | ✅ |
| `PO-05` | Diagnostics экспортируются в JSON. | ✅ |
| `PO-06` | Diagnostics экспортируются в YAML. | ✅ |
| `PO-07` | Diagnostics экспортируются в TOML. | ✅ |
| `PO-08` | History показывает safe transcription metadata. | ✅ |
| `PO-09` | Успешная history entry содержит safe Google Docs link. | ✅ |
| `PO-10` | History можно очистить owner-scoped action. | ✅ |
| `PO-11` | Очистка History требует подтверждения Да/Нет. | ✅ |
| `PO-12` | Analytics показывает количество транскрибаций. | ✅ |
| `PO-13` | Analytics показывает execution/stage durations. | ✅ |
| `PO-14` | Analytics показывает provider/model. | ✅ |
| `PO-15` | Analytics явно показывает success percentage. | ✅ |
| `PO-16` | Analytics показывает дополнительные safe outcome/options metadata. | ✅ |
| `PO-17` | Analytics можно очистить owner-scoped action. | ✅ |
| `PO-18` | Очистка Analytics требует подтверждения Да/Нет. | ✅ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`.

Verified delivery: operability chain through `main@dd194c929d957e822ff618df294dc54e72d5971e` имеет exact-main repository CI `32575534468`, Studio/browser CI `32575534462`, protected migration/API/worker rollout и terminal preflight/status Evidence. Read-only production inspection 2026-08-23 подтвердила safe API/worker/browser diagnostics, четыре export entrypoint, actual canary analytics (count/outcome/provider/stage durations), safe Google Docs result link, а security audit — ранее выполненные owner-scoped History и Analytics clear operations с confirmation flow; raw transcript/provider payload в наблюдаемой surface отсутствовал.

## 6. Расширенный canonical scope из upstream revision

В этот раздел включены все однозначно атомизированные требования exact upstream revision. Existing capability может подтверждать AC, но не авторизует дальнейшую implementation. Новые non-commercial эпики остаются `⬜ BACKLOG`, пока для них не согласована implementation Goal; commercial/cross-contour эпики дополнительно заблокированы до такой authorization и применимых legal/external gates.

`PARTIAL` не даёт долю numerator: AC либо выполнен полностью, либо считается невыполненным. Для operational/live эпиков `DEPLOY` и `LIVE` обязательны перед `READY`, даже если все AC выполнены по source/tests.

### Нерешённые upstream decisions и SPEC gaps (вне denominator)

Эти записи сохраняют неоднозначные или конфликтующие требования, но не превращают их в выдуманные AC:

| ID | Нерешённый вопрос | Current boundary до owner decision |
|---|---|---|
| `SPEC-GAP-UX-01` | Пункт `R031` называет меню `Проекты`, тогда как текущий canonical UX использует `Транскрибации`. | Сохраняется `Транскрибации`; новое переименование не авторизовано. |
| `SPEC-GAP-AUTH-01` | `R039` объединяет optional TOTP и только рассматриваемый Cloudflare Zero Trust. | TOTP включён в AC; Zero Trust исключён до отдельного security decision. |
| `SPEC-GAP-DRIVE-01` | `R053` говорит об automatic Drive upload, но `AP-15/AP-23` требуют явное optional действие. | Сохраняется явное optional сохранение без скрытого side effect. |
| `SPEC-GAP-AUDIO-01` | `R107` не различает MKV/M4A/MP3/WAV/FLAC как input и output formats. | Current WAV/FLAC output contract сохраняется; отдельные input/output matrices требуют решения. |
| `SPEC-GAP-RT-01` | `R134–R135` требуют auto reconnect/backfill, что конфликтует с current single-use capability/no-auto-reconnect boundary. | Требуется protocol design replay window, dedupe и token rotation. |
| `SPEC-GAP-RT-02` | `R138` не определяет, означает ли запись realtime session аудио или durable final transcript. | Canonical outcome — durable final text; запись аудио требует отдельного privacy/storage consent. |
| `SPEC-GAP-CLEAR-01` | `R148/R152` требуют TOTP confirmation для очистки History/Analytics до появления TOTP lifecycle. | Исключено до реализации и отдельной авторизации TOTP. |
| `SPEC-GAP-CSTAGE-01` | `R029` требует commercial staging только «если нужно», без trigger/DoD. | Не входит в denominator до определения trigger. |
| `SPEC-GAP-COAUTH-01` | `R193` требует «другие популярные российские OAuth providers» без списка. | Yandex ID и VK ID включены; остальные providers требуют явного решения. |
| `RUNTIME-RISK-COLAB-01` | `N001` сообщает о периодическом пропадании Colab realtime capture. | `CR-06` сохраняет completed Evidence, но zero-known-risk не заявляется; нужна bounded reproduction Goal. |

### Эпик `COLAB-LIFECYCLE-02` — замороженный lifecycle Colab

Status: **🟩 READY — 100% (`2/2`)**. Это durable scope boundary, а не feature implementation.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `COLABL-01` | Новые PWA/commercial features не переносятся в Colab. | ✅ |
| `COLABL-02` | После feature freeze Colab изменяется только через явно авторизованные bugfixes. | ✅ |

Evidence: `SPEC ✅ | CODE N/A | TEST N/A | CI N/A | DEPLOY N/A | LIVE N/A`.

### Эпик `PWA-SECURITY-HARDENING-02` — personal auth и security lifecycle

Status: **🟦 IN PROGRESS — 50,0% (`9/18`)**. `PWASEC-07..PWASEC-09` реализованы Goal `PWA-SESSION-CONTROL-01` на exact local revision `2b75d033c832fd57787c5a3635f6c42a40dbecbe`; exact-head CI, deployment и LIVE ещё обязательны. Optional TOTP и остальные AC вне текущего implementation scope.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `PWASEC-01` | Provider API keys шифруются at rest. | ✅ |
| `PWASEC-02` | Google OAuth refresh tokens шифруются at rest. | ✅ |
| `PWASEC-03` | Local passwords хранятся только как one-way password hash. | ✅ |
| `PWASEC-04` | Upload policy ограничивает максимальный размер source file. | ✅ |
| `PWASEC-05` | Batch/upload policy ограничивает максимальное число files. | ✅ |
| `PWASEC-06` | Transcription policy ограничивает максимальную media duration. | — |
| `PWASEC-07` | Пользователь может просмотреть active sessions. | ✅ |
| `PWASEC-08` | Пользователь может отозвать одну выбранную active session. | ✅ |
| `PWASEC-09` | Пользователь может отозвать все другие active sessions. | ✅ |
| `PWASEC-10` | Critical actions требуют recent re-authentication. | — |
| `PWASEC-11` | Login защищён отдельным brute-force limit. | ✅ |
| `PWASEC-12` | Password reset защищён отдельным brute-force limit. | — |
| `PWASEC-13` | TOTP verification защищена отдельным brute-force limit. | — |
| `PWASEC-14` | Personal TOTP остаётся optional, пока пользователь явно его не включил. | — |
| `PWASEC-15` | TOTP использует стандартный protocol и не привязан к одному authenticator app. | — |
| `PWASEC-16` | TOTP enrollment имеет проверяемую secret-confirmation boundary. | — |
| `PWASEC-17` | TOTP recovery определён и протестирован. | — |
| `PWASEC-18` | TOTP disable требует безопасной owner verification. | — |

Evidence: `SPEC ✅ | CODE ✅ | TEST ◐ | CI ◐ | DEPLOY — | LIVE —`.

### Эпик `GOOGLE-DRIVE-RELIABILITY-02` — Drive upload/token/preflight reliability

Status: **⬜ BACKLOG — 100% (`6/6`)**. AC выполнены existing implementation, но эпик не `READY` до отдельной exact-revision delivery/LIVE verification новых canonical gates.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `GOOGLE-01` | Upload обработанного media в Google Drive поддерживает resumable protocol. | ✅ |
| `GOOGLE-02` | Invalid/revoked Google grant создаёт явное состояние reconnect. | ✅ |
| `GOOGLE-03` | Disconnect удаляет сохранённый Google token material. | ✅ |
| `GOOGLE-04` | Disconnect пытается выполнить provider-side token revocation, когда это поддерживается. | ✅ |
| `GOOGLE-05` | До provider spend повторно проверяется доступность source. | ✅ |
| `GOOGLE-06` | До provider spend повторно проверяется возможность записи в target folder. | ✅ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ◐ | LIVE ◐`.

### Эпик `STORAGE-LIFECYCLE-02` — полный storage lifecycle

Status: **🟦 IN PROGRESS — 57,1% (`12/21`)**. Persisted data-class boundary `STORAG-16` и distinct buckets/lifecycle/access `STORAG-17..21` подтверждены предыдущей Goal на `c443de6855b02c3d0e5e0021ca76d56b52a2a9bc`: protected API `33302350705`, worker `33302841078`, status `33302990622`, owner/provider evidence и bounded LIVE. Эти пять operational markers синхронизированы с уже учтённым dashboard numerator; durable requirements не меняются. Остальные незавершённые AC эпика остаются вне implementation scope текущей Goal.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `STORAG-01` | Все большие S3-compatible uploads поддерживают resumable или multipart protocol. | — |
| `STORAG-02` | Abandoned upload sessions периодически очищаются. | — |
| `STORAG-03` | Failed/request-scoped FFmpeg temporary files очищаются. | ✅ |
| `STORAG-04` | Orphaned storage objects периодически reconciliate и очищаются. | — |
| `STORAG-05` | Cleanup удаляет obsolete object versions при включённом storage versioning. | — |
| `STORAG-06` | Original transcription sources имеют явную retention policy. | ✅ |
| `STORAG-07` | Processed audio outputs имеют явную retention policy. | ✅ |
| `STORAG-08` | Audio-processing reference files имеют явную retention policy. | ✅ |
| `STORAG-09` | Transcription reference files имеют отдельную явную retention policy. | — |
| `STORAG-10` | Internal transcript data имеет явную retention policy. | — |
| `STORAG-11` | Temporary files имеют явную retention/TTL policy. | ✅ |
| `STORAG-12` | History data имеет явную retention policy. | — |
| `STORAG-13` | Analytics data имеет явную retention policy. | — |
| `STORAG-14` | Diagnostic/log data имеет явную retention policy. | ✅ |
| `STORAG-15` | Deletion считается завершённым только после подтверждения cleanup всеми internal stores. | — |
| `STORAG-16` | Audio-processing references и transcription references являются разными data classes. | ✅ |
| `STORAG-17` | Audio-reference использует отдельный S3 bucket. | ✅ |
| `STORAG-18` | Transcription-reference использует отдельный S3 bucket. | ✅ |
| `STORAG-19` | Audio-reference bucket имеет независимые lifecycle rules. | ✅ |
| `STORAG-20` | Transcription-reference bucket имеет независимые lifecycle rules. | ✅ |
| `STORAG-21` | Два reference buckets имеют независимо ограниченные access permissions. | ✅ |

Evidence: `SPEC ✅ | CODE ◐ | TEST ◐ | CI ◐ | DEPLOY — | LIVE —`.

### Эпик `STT-PROVIDER-ABSTRACTION-01` — provider-neutral STT contract

Status: **⬜ BACKLOG — 7,1% (`1/14`)**.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `STTPRO-01` | Batch STT выполняется через provider-neutral interface. | — |
| `STTPRO-02` | Realtime STT выполняется через provider-neutral interface. | — |
| `STTPRO-03` | Provider capability metadata фиксирует supported operating modes. | — |
| `STTPRO-04` | Provider capability metadata фиксирует supported languages. | — |
| `STTPRO-05` | Provider capability metadata фиксирует diarization support. | — |
| `STTPRO-06` | Provider capability metadata фиксирует dictionary support. | — |
| `STTPRO-07` | Provider capability metadata фиксирует file constraints. | — |
| `STTPRO-08` | User-facing economic mode маппится на configured provider capability. | — |
| `STTPRO-09` | User-facing standard mode маппится на configured provider capability. | — |
| `STTPRO-10` | User-facing premium mode маппится на configured provider capability. | — |
| `STTPRO-11` | User-facing realtime mode маппится на configured provider capability. | — |
| `STTPRO-12` | Provider/mode health может остановить новый dispatch после массовых failures. | — |
| `STTPRO-13` | Automatic cross-provider fallback не выполняется. | ✅ |
| `STTPRO-14` | BYOK eligibility конфигурируется отдельно для каждого provider. | — |

Evidence: `SPEC ✅ | CODE ◐ | TEST ◐ | CI ◐ | DEPLOY — | LIVE —`.

### Эпик `YANDEX-STT-01` — Yandex SpeechKit provider

Status: **⬜ BACKLOG — 0% (`0/5`)**.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `YANDEX-01` | Yandex SpeechKit поддерживает обычную batch transcription. | — |
| `YANDEX-02` | Yandex SpeechKit поддерживает deferred transcription. | — |
| `YANDEX-03` | Yandex SpeechKit поддерживает realtime transcription. | — |
| `YANDEX-04` | Deferred Yandex jobs сохраняют provider operation ID. | — |
| `YANDEX-05` | Deferred Yandex jobs poll и сохраняют terminal provider result. | — |

Evidence: `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.

### Эпик `PWA-DICTIONARIES-01` — пользовательские словари

Status: **⬜ BACKLOG — 0% (`0/1`)**.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `PWADIC-01` | Owner-scoped dictionaries поддерживают terms, surnames, names и abbreviations для улучшения STT. | — |

Evidence: `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.

### Эпик `PWA-WORKER-ISOLATION-02` — worker resource и privilege boundary

Status: **🟩 READY — 100% (`3/3`)**. Resource/privilege isolation, exact worker delivery и bounded production execution подтверждены.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `PWAWOR-01` | Media/FFmpeg worker работает как component, отделённый от API process. | ✅ |
| `PWAWOR-02` | Media/FFmpeg worker имеет явные CPU/memory/process resource bounds. | ✅ |
| `PWAWOR-03` | Media/FFmpeg worker имеет минимально необходимые filesystem/network/database privileges. | ✅ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`. После operator master-key ownership correction worker deployment `33388441193`/job `99476297938` и status `33388535135` подтвердили 2 CPU, 4 GiB memory, 256 PID, read-only rootfs, no-new-privileges, две разрешённые сети, restricted DB role и UID/GID `10001`. PR `#270` перенёс archive serialization на допустимую API boundary, а PR `#271` устранил idle transaction во время long source/media I/O. Exact `main@295033c8` repository CI `33495743363`, worker deploy `33496421647` и final status `33496797208` прошли. Owner-authorized production job `66e70976-2f26-4ed0-93d6-8436784b9fdd` реально выполняла длительную source preparation в изолированном worker и достигла provider dispatch; subsequent zero-usage provider rejection не отменяет runtime isolation Evidence. Изменение `+66,7` п.п. — выполнение двух runtime AC, denominator не изменён.

### Эпик `JOB-RELIABILITY-02` — durable batch execution contract

Status: **🟦 IN PROGRESS — 82,4% (`14/17`)**.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `JOBREL-01` | Transcription jobs используют durable queue. | ✅ |
| `JOBREL-02` | Каждая job сохраняет явное processing-stage state. | ✅ |
| `JOBREL-03` | Каждая job сохраняет last safe checkpoint. | ✅ |
| `JOBREL-04` | Interrupted jobs восстанавливаются после backend/worker restart. | ✅ |
| `JOBREL-05` | Автоматически повторяются только доказуемо безопасные transient failures. | — |
| `JOBREL-06` | Retry/recovery не дублирует provider operations. | ✅ |
| `JOBREL-07` | Retry/recovery не дублирует Google Docs outputs. | ✅ |
| `JOBREL-08` | Retry/recovery не дублирует storage files. | ✅ |
| `JOBREL-09` | Retry/recovery не дублирует notifications. | — |
| `JOBREL-10` | Critical job/queue/service events имеют guaranteed-delivery mechanism. | — |
| `JOBREL-11` | Queued transcription можно отменить. | ✅ |
| `JOBREL-12` | Для running transcription можно запросить cancel; она останавливается на safe boundaries. | ✅ |
| `JOBREL-13` | Server job продолжается после закрытия PWA пользователем. | ✅ |
| `JOBREL-14` | UI показывает текущую processing stage. | ✅ |
| `JOBREL-15` | Source availability проверяется до provider dispatch. | ✅ |
| `JOBREL-16` | Target write readiness проверяется до provider dispatch. | ✅ |
| `JOBREL-17` | После immutable authoritative snapshot долгие source availability/materialization и media preparation операции не удерживают idle worker DB transaction; после I/O выполняется fresh fail-closed lifecycle/source/credential/output revalidation до любого provider call. | ✅ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅` для выполненных AC. Exact `main@295033c8`, repository CI `33495743363`, platform/worker delivery `33495743305` / `33496421647` и final worker status `33496797208` подтверждены. Production job `66e70976-2f26-4ed0-93d6-8436784b9fdd` прошла long source preparation за прежней `idle_in_transaction_session_timeout=60s` boundary и достигла provider dispatch без `lifecycle_changed_before_provider_call`; subsequent provider rejection не создал usage и сохранил fail-closed retry state.

### Эпик `JOB-NOTIFICATIONS-01` — уведомления о завершении/error

Status: **⬜ BACKLOG — 0% (`0/6`)**.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `JOBNOT-01` | Web Push уведомляет об успешном завершении. | — |
| `JOBNOT-02` | Web Push уведомляет о terminal error. | — |
| `JOBNOT-03` | Email уведомляет об успешном завершении. | — |
| `JOBNOT-04` | Email уведомляет о terminal error. | — |
| `JOBNOT-05` | Telegram может уведомлять об успешном завершении. | — |
| `JOBNOT-06` | Telegram может уведомлять о terminal error. | — |

Evidence: `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.

### Эпик `REALTIME-CONTINUITY-02` — expanded realtime consumers

Status: **⬜ BACKLOG — 0% (`0/5`)**.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `REALTI-01` | Capture-source loss и STT-connection loss отображаются как разные user-visible errors. | — |
| `REALTI-02` | Realtime subtitles доступны через отдельный browser/OBS overlay. | — |
| `REALTI-03` | Realtime subtitles могут передаваться в YouTube Live. | — |
| `REALTI-04` | Realtime subtitles могут передаваться другому явно поддержанному external consumer. | — |
| `REALTI-05` | Failure одного external realtime consumer не останавливает primary session. | — |

Evidence: `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.

### Эпик `TRANSCRIPT-EXPORTS-02` — дополнительные export formats

Status: **⬜ BACKLOG — 0% (`0/3`)**.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `TRANSC-01` | Confirmed transcript экспортируется как Markdown. | — |
| `TRANSC-02` | Confirmed timed transcript экспортируется как SRT. | — |
| `TRANSC-03` | Confirmed timed transcript экспортируется как VTT. | — |

Evidence: `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.

### Эпик `USAGE-COST-ACCOUNTING-01` — personal usage/cost evidence

Status: **🟦 IN PROGRESS — 83,3% (`5/6`)**. Выполнены `USAGEC-01/02/03/04/06`; `USAGEC-05` implemented locally but is not counted before exact CI/deploy/LIVE. Изменение `+83,3` п.п. связано с verified account Evidence и одной persisted canary; denominator `6` не изменён.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `USAGEC-01` | Каждая transcription job хранит подтверждённую длительность audio, фактически отправленную provider; uncertain outcome не выдаётся за exact billed usage. | ✅ |
| `USAGEC-02` | Каждая transcription job хранит nominal attributable cost как `confirmed duration × immutable public tariff snapshot`, currency и provenance; этот расчёт явно не выдаётся за invoice debit после подписки или квоты. | ✅ |
| `USAGEC-03` | Для каждого активного ElevenLabs credential Studio server-side получает из official account API tier/status, period usage/limit, reset, usage-based billing entitlement/cap, current overage и open/next invoice без передачи API key в браузер. | ✅ |
| `USAGEC-04` | Studio получает из official workspace analytics API credit usage по продуктам за применимый billing/rolling period, сохраняет нормализованный bounded snapshot и не преобразует credits в минуты без provider Evidence. | ✅ |
| `USAGEC-05` | Owner UI раздельно показывает job-level nominal cost и provider account actuals, включая provider-reported remaining period units, overage и invoice amounts; unavailable или semantically incomparable данные не подменяются расчётной цифрой. | — |
| `USAGEC-06` | Account snapshot имеет видимые `fetched_at`, period/window provenance и current/stale/unavailable state; при открытом экране выполняется bounded refresh, ручное обновление доступно, а provider error сохраняет последний успешный snapshot только как stale. | ✅ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ◐ | LIVE ◐`. Delivered account/accounting components passed exact CI and API deployment. One canary persisted `12.612426 s` and nominal `0.00077073 USD`; analytics explicitly separated this from invoice debit. Current account/product snapshot verifies subscription/period/remaining/reset/overage/invoice and product credits with explicit provenance, supporting `USAGEC-01/02/03/04/06`. PR `#270` adds the missing bounded per-job API/UI projection with explicit unavailable/partial/uncertain states and immutable tariff details. Corrected main PostgreSQL CI `33479042277` passed `1591` tests; Studio/browser CI `33479042292` passed all gates. Portable Python `1267 passed` and focused/compile/lightweight checks pass. `USAGEC-05` remains uncompleted until deploy/LIVE. Initial Google confirmation failed, one approved reconciliation recovered the existing result, and the repaired path remains undelivered. No second STT, provider retry or worker resume occurred.

### Эпик `OBSERVABILITY-AUDIT-02` — health, tracing, alerts и protected audit

Status: **🟦 IN PROGRESS — 71,4% (`25/35`)**.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `OBSERV-01` | `job_id` проходит через весь batch pipeline. | ✅ |
| `OBSERV-02` | `request_id` проходит через request-to-job boundary. | ✅ |
| `OBSERV-03` | `trace_id` проходит через весь cross-service pipeline. | — |
| `OBSERV-04` | Admin health показывает backend status. | ✅ |
| `OBSERV-05` | Admin health показывает PostgreSQL status. | ✅ |
| `OBSERV-06` | Admin health показывает queue status. | ✅ |
| `OBSERV-07` | Admin health показывает worker status. | ✅ |
| `OBSERV-08` | Admin health показывает S3 status. | ✅ |
| `OBSERV-09` | Admin health показывает STT provider status. | ✅ |
| `OBSERV-10` | Admin health показывает email status. | — |
| `OBSERV-11` | Backend предоставляет отдельный liveness probe. | ✅ |
| `OBSERV-12` | Backend предоставляет отдельный readiness probe. | ✅ |
| `OBSERV-13` | Worker предоставляет отдельный liveness probe. | ✅ |
| `OBSERV-14` | Worker предоставляет отдельный readiness probe. | ✅ |
| `OBSERV-15` | Critical-error alerts отправляются. | — |
| `OBSERV-16` | Stuck-queue alerts отправляются. | — |
| `OBSERV-17` | Provider-unavailability alerts отправляются. | — |
| `OBSERV-18` | Backup/cleanup failure alerts отправляются. | — |
| `OBSERV-19` | Alerts отправляются при приближении к storage/API limits. | — |
| `OBSERV-20` | Secrets исключены из logs и diagnostics. | ✅ |
| `OBSERV-21` | User data по умолчанию минимизированы в logs и diagnostics. | ✅ |
| `OBSERV-22` | Diagnostics показывают release version. | ✅ |
| `OBSERV-23` | Diagnostics показывают environment. | ✅ |
| `OBSERV-24` | Diagnostics показывают web build identity. | ✅ |
| `OBSERV-25` | Diagnostics показывают API build identity. | ✅ |
| `OBSERV-26` | Diagnostics показывают worker build identity. | ✅ |
| `OBSERV-27` | Diagnostics показывают exact commit identity. | ✅ |
| `OBSERV-28` | Diagnostics показывают exact DB schema revision. | ✅ |
| `OBSERV-29` | Audit record идентифицирует actor. | ✅ |
| `OBSERV-30` | Audit record идентифицирует время действия. | ✅ |
| `OBSERV-31` | Audit record идентифицирует action. | ✅ |
| `OBSERV-32` | Audit record идентифицирует operation outcome. | — |
| `OBSERV-33` | Ordinary application flows не могут изменять прошлые audit records. | — |
| `OBSERV-34` | Ordinary application flows не могут удалять audit records. | — |
| `OBSERV-35` | Очистка History/Analytics не удаляет audit records. | ✅ |

Evidence: `SPEC ✅ | CODE ◐ | TEST ◐ | CI ◐ | DEPLOY ◐ | LIVE ◐`.

### Эпик `RELEASE-SAFETY-02` — personal release safety

Status: **⬜ BACKLOG — 100% (`5/5`)**. AC подтверждены existing repository contracts, но lifecycle остаётся BACKLOG до отдельной closure Goal.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `RELEAS-01` | Все PostgreSQL schema changes используют versioned migrations. | ✅ |
| `RELEAS-02` | Personal production имеет tested rollback procedure. | ✅ |
| `RELEAS-03` | Deployment валидирует required environment configuration. | ✅ |
| `RELEAS-04` | Deployment валидирует required secrets без раскрытия values. | ✅ |
| `RELEAS-05` | Deployment fail-closed при отсутствии critical settings. | ✅ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE N/A`.

### Commercial/cross-contour boundary

Следующие `242` AC имеют status **⬜ BACKLOG ⛔ BLOCKED — 0% (`0/242`)**. Их implementation не авторизована. Existing personal code не считается `CODE/TEST/CI/DEPLOY/LIVE` Evidence для отдельного commercial contour.

### Эпик `ENVIRONMENT-CAPABILITIES-01` — единый codebase и изолированные contours

Status: **⬜ BACKLOG ⛔ BLOCKED — 0% (`0/50`)**.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `EVC-01` | Personal и commercial используют единый основной codebase. | — |
| `EVC-02` | Personal и commercial используют единый `main`. | — |
| `EVC-03` | Commercial не поддерживается как постоянно расходящаяся branch. | — |
| `EVC-04` | Personal и commercial разворачиваются как отдельные environments. | — |
| `EVC-05` | Personal и commercial имеют отдельные configs. | — |
| `EVC-06` | Personal и commercial имеют отдельные secrets. | — |
| `EVC-07` | Personal и commercial имеют отдельные databases. | — |
| `EVC-08` | Personal и commercial имеют отдельные S3 resources. | — |
| `EVC-09` | Personal и commercial имеют отдельные API keys. | — |
| `EVC-10` | Personal и commercial имеют отдельные OAuth credentials. | — |
| `EVC-11` | Personal и commercial имеют отдельные domains. | — |
| `EVC-12` | Остальные environment-specific settings разделены по contour. | — |
| `EVC-13` | Personal включает все approved commercial capabilities. | — |
| `EVC-14` | Personal может включать дополнительные foreign/experimental/admin capabilities. | — |
| `EVC-15` | Commercial изолирован инфраструктурно, а не только frontend visibility. | — |
| `EVC-16` | Credentials неиспользуемого commercial provider отсутствуют в commercial environment. | — |
| `EVC-17` | Contour differences задаются configuration. | — |
| `EVC-18` | Contour differences задаются capability model. | — |
| `EVC-19` | Contour differences задаются bounded feature flags. | — |
| `EVC-20` | Contour differences задаются подключаемыми modules/providers. | — |
| `EVC-21` | Contour differences не размазаны множеством ad-hoc conditionals. | — |
| `EVC-22` | Personal и commercial деплоятся независимо. | — |
| `EVC-23` | Personal UI имеет режим `только commercial capabilities`. | — |
| `EVC-24` | Personal UI имеет режим `только personal-only capabilities`. | — |
| `EVC-25` | Personal UI имеет режим `все capabilities`. | — |
| `EVC-26` | Personal UI capability mode не меняет backend. | — |
| `EVC-27` | Personal UI capability mode не меняет environment. | — |
| `EVC-28` | Personal UI capability mode не меняет database. | — |
| `EVC-29` | Personal UI capability mode не меняет S3/storage. | — |
| `EVC-30` | Personal UI capability mode не меняет STT credentials. | — |
| `EVC-31` | Commercial-view mode в personal воспроизводит approved commercial UX/UI. | — |
| `EVC-32` | Personal и commercial имеют независимый rollback. | — |
| `EVC-33` | STT provider заменяется через bounded interface. | — |
| `EVC-34` | S3/storage provider заменяется через bounded interface. | — |
| `EVC-35` | Authorization provider заменяется через bounded interface. | — |
| `EVC-36` | Notification provider заменяется через bounded interface. | — |
| `EVC-37` | Core entities поддерживают `user_id`/`tenant_id` ownership. | — |
| `EVC-38` | Personal admin auth не блокирует future user roles/access control. | — |
| `EVC-39` | STT provider implementations являются отдельными modules. | — |
| `EVC-40` | Storage implementations являются отдельными modules. | — |
| `EVC-41` | Authorization implementations являются отдельными modules. | — |
| `EVC-42` | Notification implementations являются отдельными modules. | — |
| `EVC-43` | Другие external integrations являются capability-scoped modules. | — |
| `EVC-44` | Audio processing boundary заменяема независимо. | — |
| `EVC-45` | Transcription boundary заменяема независимо. | — |
| `EVC-46` | Google Drive boundary заменяема независимо. | — |
| `EVC-47` | File-storage boundary заменяема независимо. | — |
| `EVC-48` | Document-creation boundary заменяема независимо. | — |
| `EVC-49` | Unused integration code не делает capability доступной в commercial. | — |
| `EVC-50` | Российские и иностранные providers используют общий interface, когда capabilities совместимы. | — |

Evidence: `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.

### Эпик `COMMERCIAL-INFRA-DATA-01` — infrastructure и localization

Status: **⬜ BACKLOG ⛔ BLOCKED — 0% (`0/20`)**.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `CINF-01` | Основной commercial production backend размещается на российской инфраструктуре, пригодной для обработки данных российских пользователей. | — |
| `CINF-02` | Основная PostgreSQL database размещается на территории РФ. | — |
| `CINF-03` | Commercial S3 использует S3-compatible storage российского provider вместо Cloudflare R2. | — |
| `CINF-04` | PostgreSQL backups соблюдают localization requirements. | — |
| `CINF-05` | Backups пользовательских данных соблюдают localization requirements. | — |
| `CINF-06` | Temporary FFmpeg files хранятся на российской инфраструктуре. | — |
| `CINF-07` | Intermediate processing results хранятся на российской инфраструктуре. | — |
| `CINF-08` | Logs, analytics и diagnostics не отправляют персональные данные в зарубежные services без контроля. | — |
| `CINF-09` | Cloudflare и другие foreign infrastructure services проверяются по фактическому data flow. | — |
| `CINF-10` | Commercial использует отдельный PostgreSQL. | — |
| `CINF-11` | Commercial использует отдельное S3 storage. | — |
| `CINF-12` | Commercial использует отдельные secrets. | — |
| `CINF-13` | Commercial использует отдельные API keys. | — |
| `CINF-14` | Commercial использует отдельные OAuth credentials. | — |
| `CINF-15` | Остальные production resources commercial изолированы от personal. | — |
| `CINF-16` | Для PostgreSQL утверждён RPO. | — |
| `CINF-17` | Для PostgreSQL утверждён RTO. | — |
| `CINF-18` | Point-in-time restore реализован и проверен. | — |
| `CINF-19` | Реальное восстановление данных из backup регулярно проверяется. | — |
| `CINF-20` | Удалённые пользователем данные не возвращаются в production после restore старого backup. | — |

Evidence: `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.

### Эпик `COMMERCIAL-IDENTITY-01` — registration, auth и TOTP

Status: **⬜ BACKLOG ⛔ BLOCKED — 0% (`0/18`)**.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `CID-01` | Основной способ registration/auth пользователей — email + password. | — |
| `CID-02` | Registration допускает Gmail и другие foreign email addresses. | — |
| `CID-03` | Foreign email не интерпретируется как Google OAuth login. | — |
| `CID-04` | После registration email подтверждается. | — |
| `CID-05` | Password reset использует one-time token. | — |
| `CID-06` | Password reset token имеет ограниченный lifetime. | — |
| `CID-07` | Password reset не раскрывает existence account и fail-closed обрабатывает повтор. | — |
| `CID-08` | System emails отправляет transactional email provider. | — |
| `CID-09` | Transactional email использует собственный domain. | — |
| `CID-10` | Google OAuth не используется для registration/auth в российском commercial production. | — |
| `CID-11` | Yandex ID доступен как optional OAuth provider. | — |
| `CID-12` | VK ID доступен как optional OAuth provider. | — |
| `CID-13` | Google OAuth используется только для подключения Google Drive. | — |
| `CID-14` | Допустимость Google Drive OAuth подтверждена актуальным legal gate. | — |
| `CID-15` | Доступна optional TOTP 2FA. | — |
| `CID-16` | TOTP совместим с разными standard authenticator apps. | — |
| `CID-17` | Определён безопасный account recovery. | — |
| `CID-18` | Определён безопасный second-factor reset. | — |

Evidence: `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.

### Эпик `COMMERCIAL-DATA-GOVERNANCE-01` — персональные данные

Status: **⬜ BACKLOG ⛔ BLOCKED — 0% (`0/26`)**.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `CDG-01` | Первичная запись персональных данных выполняется в РФ. | — |
| `CDG-02` | Систематизация персональных данных выполняется в РФ. | — |
| `CDG-03` | Накопление персональных данных выполняется в РФ. | — |
| `CDG-04` | Хранение персональных данных выполняется в РФ. | — |
| `CDG-05` | Изменение персональных данных выполняется в РФ. | — |
| `CDG-06` | Извлечение персональных данных выполняется в РФ. | — |
| `CDG-07` | Определён полный перечень персональных данных сервиса. | — |
| `CDG-08` | Определены data rules для audio recordings. | — |
| `CDG-09` | Определены data rules для transcripts. | — |
| `CDG-10` | Определены data rules для speaker voices. | — |
| `CDG-11` | Определены data rules для email. | — |
| `CDG-12` | Определены data rules для IP addresses. | — |
| `CDG-13` | Определены data rules для OAuth tokens. | — |
| `CDG-14` | Определены data rules для diagnostic data. | — |
| `CDG-15` | Для каждого data type определена processing purpose. | — |
| `CDG-16` | Для каждого data type определено legal basis. | — |
| `CDG-17` | Для каждого data type определён retention period. | — |
| `CDG-18` | Данные удаляются после истечения retention period. | — |
| `CDG-19` | Данные удаляются по подтверждённому user request. | — |
| `CDG-20` | Пользователь может удалить account. | — |
| `CDG-21` | Account deletion очищает связанные user data. | — |
| `CDG-22` | Account deletion очищает сохранённые OAuth tokens. | — |
| `CDG-23` | Подготовлена policy обработки персональных данных. | — |
| `CDG-24` | Подготовлено user agreement и/или public offer. | — |
| `CDG-25` | Подготовлены необходимые consents на обработку персональных данных. | — |
| `CDG-26` | Проверена необходимость уведомления Роскомнадзора как operator персональных данных. | — |

Evidence: `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.

### Эпик `COMMERCIAL-CROSS-BORDER-01` — foreign services и legal gates

Status: **⬜ BACKLOG ⛔ BLOCKED — 0% (`0/14`)**.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `CXB-01` | Для каждого foreign service определён передаваемый набор user data. | — |
| `CXB-02` | Foreign STT provider проверен по законодательству РФ. | — |
| `CXB-03` | Foreign STT provider проверен по своим terms of use. | — |
| `CXB-04` | Cross-border data transfer foreign STT provider отдельно проверен. | — |
| `CXB-05` | Российский STT provider является полноценным production вариантом. | — |
| `CXB-06` | Commercial production не зависит от ElevenLabs или другого foreign STT provider. | — |
| `CXB-07` | ElevenLabs может быть включён только как additional provider. | — |
| `CXB-08` | Использование ElevenLabs в commercial разрешено отдельным legal opinion. | — |
| `CXB-09` | Техническая возможность foreign provider не считается legal permission для commercial. | — |
| `CXB-10` | Production не зависит полностью от одного foreign AI provider. | — |
| `CXB-11` | STT architecture позволяет отключить/заменить provider без переделки всей системы. | — |
| `CXB-12` | Google Drive является external user integration. | — |
| `CXB-13` | Google Drive не является primary internal storage сервиса. | — |
| `CXB-14` | Google Drive OAuth отделён от OAuth login в сам сервис. | — |

Evidence: `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.

### Эпик `COMMERCIAL-STT-QUOTA-01` — provider tariffs, quotas и dispatch

Status: **⬜ BACKLOG ⛔ BLOCKED — 0% (`0/16`)**.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `CSQ-01` | Для каждого STT provider хранится applicable tariff. | — |
| `CSQ-02` | Для каждого STT provider хранится transcription cost. | — |
| `CSQ-03` | Для каждой job учитываются фактически использованные minutes/hours. | — |
| `CSQ-04` | Пользователи имеют monthly quotas. | — |
| `CSQ-05` | User quota проверяется до job. | — |
| `CSQ-06` | Global quota проверяется до job. | — |
| `CSQ-07` | Expected job spend резервируется на время выполнения. | — |
| `CSQ-08` | Parallel jobs не могут потратить один и тот же quota balance. | — |
| `CSQ-09` | Global API spend limits предотвращают accidental/malicious balance exhaustion. | — |
| `CSQ-10` | Пользователь выбирает понятный режим по price/capabilities. | — |
| `CSQ-11` | Конкретный STT provider скрыт из обычного commercial UX. | — |
| `CSQ-12` | Отдельный STT provider можно аварийно отключить. | — |
| `CSQ-13` | При provider outage связанный mode временно блокируется. | — |
| `CSQ-14` | Job не переключается автоматически на другой provider. | — |
| `CSQ-15` | BYOK доступен только при technical compatibility provider. | — |
| `CSQ-16` | BYOK доступен только после legal permission provider. | — |

Evidence: `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.

### Эпик `COMMERCIAL-SPEAKER-PRIVACY-01` — diarization без biometrics

Status: **⬜ BACKLOG ⛔ BLOCKED — 0% (`0/3`)**.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `CSP-01` | Commercial показывает обычные diarization labels `Speaker 1`, `Speaker 2`. | — |
| `CSP-02` | Commercial не выполняет automatic voice-reference/voiceprint identification. | — |
| `CSP-03` | Voice identification не добавляется до отдельной legal проработки biometric personal data. | — |

Evidence: `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.

### Эпик `COMMERCIAL-QUEUE-FAIRNESS-01` — fair resource allocation

Status: **⬜ BACKLOG ⛔ BLOCKED — 0% (`0/6`)**.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `CQF-01` | Ограничены concurrently running jobs пользователя/тарифа. | — |
| `CQF-02` | Ограничены queued jobs пользователя/тарифа. | — |
| `CQF-03` | Ограничены concurrently running jobs всей системы. | — |
| `CQF-04` | Ограничены queued jobs всей системы. | — |
| `CQF-05` | Один пользователь не может занять всю queue. | — |
| `CQF-06` | Один пользователь не может занять все worker resources. | — |

Evidence: `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.

### Эпик `COMMERCIAL-BILLING-01` — payments, subscriptions и fiscalization

Status: **⬜ BACKLOG ⛔ BLOCKED — 0% (`0/27`)**.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `CBI-01` | Определена legal form коммерческой деятельности, например ИП. | — |
| `CBI-02` | Выбран российский payment provider. | — |
| `CBI-03` | Payment provider поддерживает recurring payments. | — |
| `CBI-04` | Payments fiscalized. | — |
| `CBI-05` | Пользователю отправляется receipt. | — |
| `CBI-06` | Определены tariffs. | — |
| `CBI-07` | Реализованы subscriptions. | — |
| `CBI-08` | Реализованы quota по tariffs. | — |
| `CBI-09` | Реализована purchase дополнительных hours. | — |
| `CBI-10` | Ведётся internal payment accounting. | — |
| `CBI-11` | Ведётся internal accounting оказанных услуг. | — |
| `CBI-12` | Billing/usage accounting отделён от ordinary analytics. | — |
| `CBI-13` | Очистка ordinary analytics не удаляет billing/usage accounting. | — |
| `CBI-14` | Job хранит immutable tariff snapshot. | — |
| `CBI-15` | Job хранит immutable mode snapshot. | — |
| `CBI-16` | Job хранит immutable calculation-rules snapshot. | — |
| `CBI-17` | Payment/subscription state восстанавливается после missed webhook. | — |
| `CBI-18` | Repeated webhook обрабатывается idempotently. | — |
| `CBI-19` | Repeated provider event не создаёт double charge. | — |
| `CBI-20` | Repeated provider event не начисляет quota дважды. | — |
| `CBI-21` | Repeated provider event не продлевает subscription дважды. | — |
| `CBI-22` | Subscription cancellation обрабатывается корректно. | — |
| `CBI-23` | Payment refund обрабатывается корректно. | — |
| `CBI-24` | Failed recurring charge обрабатывается корректно. | — |
| `CBI-25` | Admin видит tariffs. | — |
| `CBI-26` | Admin видит payments. | — |
| `CBI-27` | Admin видит API spend. | — |

Evidence: `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.

### Эпик `COMMERCIAL-ECONOMICS-01` — unit economics

Status: **⬜ BACKLOG ⛔ BLOCKED — 0% (`0/15`)**.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `CEC-01` | Для каждой job собирается STT cost. | — |
| `CEC-02` | Собирается storage cost. | — |
| `CEC-03` | Собирается compute cost. | — |
| `CEC-04` | Собирается network traffic cost. | — |
| `CEC-05` | Учитывается payment-provider commission. | — |
| `CEC-06` | Учитывается fiscalization cost. | — |
| `CEC-07` | Учитываются taxes. | — |
| `CEC-08` | Учитываются другие mandatory business expenses. | — |
| `CEC-09` | Рассчитывается cost per transcription hour для каждого provider/mode. | — |
| `CEC-10` | Рассчитывается average cost одного active user. | — |
| `CEC-11` | Рассчитывается ARPU. | — |
| `CEC-12` | Рассчитывается contribution margin. | — |
| `CEC-13` | Рассчитывается retention. | — |
| `CEC-14` | Рассчитывается LTV. | — |
| `CEC-15` | До advertising launch определён maximum allowed acquisition cost. | — |

Evidence: `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.

### Эпик `COMMERCIAL-SECURITY-01` — least privilege, tenancy и backups

Status: **⬜ BACKLOG ⛔ BLOCKED — 0% (`0/21`)**.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `CSEC-01` | Все STT provider API keys хранятся только на backend. | — |
| `CSEC-02` | API keys шифруются at rest. | — |
| `CSEC-03` | OAuth refresh tokens шифруются at rest. | — |
| `CSEC-04` | Другие application secrets шифруются at rest. | — |
| `CSEC-05` | Encryption keys хранятся отдельно от primary database. | — |
| `CSEC-06` | Database не доступна напрямую из internet. | — |
| `CSEC-07` | Production app не подключается к database как superuser. | — |
| `CSEC-08` | Все user data разделены по `user_id` или `tenant_id`. | — |
| `CSEC-09` | File access проверяется по current user/tenant. | — |
| `CSEC-10` | Job access проверяется по current user/tenant. | — |
| `CSEC-11` | Transcription access проверяется по current user/tenant. | — |
| `CSEC-12` | Integration access проверяется по current user/tenant. | — |
| `CSEC-13` | Основные user-owned tables используют PostgreSQL RLS как дополнительную isolation layer. | — |
| `CSEC-14` | Critical actions записываются в audit log. | — |
| `CSEC-15` | User/API rate limits включены. | — |
| `CSEC-16` | Concurrent running jobs ограничены. | — |
| `CSEC-17` | Media/FFmpeg workers отделены от API. | — |
| `CSEC-18` | Media/FFmpeg workers имеют minimum required privileges. | — |
| `CSEC-19` | Database backup выполняется регулярно. | — |
| `CSEC-20` | Database restore регулярно проверяется. | — |
| `CSEC-21` | Credentials personal и commercial production никогда не переиспользуются между contours. | — |

Evidence: `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.

### Эпик `COMMERCIAL-NOTIFICATIONS-01` — replaceable notification providers

Status: **⬜ BACKLOG ⛔ BLOCKED — 0% (`0/8`)**.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `CNOT-01` | Для transactional email выбран российский provider. | — |
| `CNOT-02` | Для system notifications выбран российский provider. | — |
| `CNOT-03` | Для external notification services определён передаваемый набор personal data. | — |
| `CNOT-04` | Web Push реализован отдельным module. | — |
| `CNOT-05` | Email реализован отдельным module. | — |
| `CNOT-06` | Messenger notifications реализованы отдельным module. | — |
| `CNOT-07` | Notification provider можно заменить. | — |
| `CNOT-08` | Notification provider можно отключить. | — |

Evidence: `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.

### Эпик `COMMERCIAL-LEGAL-01` — launch legal readiness

Status: **⬜ BACKLOG ⛔ BLOCKED — 0% (`0/18`)**.

| AC | Requirement | Выполнено |
|---|---|:---:|
| `CLEG-01` | До public commercial launch проведена legal review фактического user-data flow. | — |
| `CLEG-02` | Personal-data policy соответствует фактическому backend behavior. | — |
| `CLEG-03` | Cross-border transfer через Google Drive проверен отдельно. | — |
| `CLEG-04` | Cross-border transfer для каждого foreign STT provider проверен отдельно. | — |
| `CLEG-05` | Допустимость ElevenLabs проверена отдельно. | — |
| `CLEG-06` | Допустимость каждой другой foreign integration проверена отдельно. | — |
| `CLEG-07` | Подготовлено user agreement/public offer. | — |
| `CLEG-08` | Подготовлена personal-data processing policy. | — |
| `CLEG-09` | Подготовлены необходимые consents. | — |
| `CLEG-10` | Определён retention audio recordings. | — |
| `CLEG-11` | Определено deletion audio recordings. | — |
| `CLEG-12` | Определён retention transcripts. | — |
| `CLEG-13` | Определено deletion transcripts. | — |
| `CLEG-14` | Пользователь подтверждает право загружать и обрабатывать передаваемые audio recordings. | — |
| `CLEG-15` | Пользователь может отозвать consents. | — |
| `CLEG-16` | Пользователь может отключить external integrations. | — |
| `CLEG-17` | При отключении integration связанные tokens удаляются. | — |
| `CLEG-18` | Перед production launch актуальные legal requirements проверяются повторно. | — |

Evidence: `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.

## 7. Durable technical и safety constraints

### Colab

- Provider failures показывают только safe scalar diagnostics: provider, status, endpoint без query и `detail`, `message`, `code`, `type`, `error.message`, `error.type`, `error.code`.
- Temporary cleanup ограничен TTL и prefix `elevenlabs_api_`; произвольные пользовательские файлы не удаляются.
- Parallel notebooks or tabs не являются поддерживаемой concurrency model manifest.
- Launcher исполняет repository code из `GITHUB_REF`; для production предпочтителен reviewed commit SHA.
- Existing-doc normalization остаётся selected-folder workflow that defaults to dry-run и разделяет selected-folder scan counters от apply-impact counters.
- `standard_check` хранит только target/detected standard, status, checked-at и checker version.
- Timestamped backups старого manifest содержат sensitive operational metadata и защищаются как active manifest.
- Visible metadata не публикует source filename/source mode.

### PWA ownership и processing

- Все projects, sources, jobs, credentials, connections, diagnostics, outputs, history и analytics owner-scoped.
- User-facing segment/project labels уникальны case-insensitively в своём owner/project scope.
- BYOK credentials encrypted at rest, расшифровываются server-side только для авторизованной операции и не возвращаются browser.
- Google tokens хранятся encrypted server-side; Picker access capability bounded, `no-store`, CSRF-protected и перепроверяется API.
- R2 object keys, presigned URLs, lease authority, transcript bodies и external payloads не входят в обычные browser DTO/logs/diagnostics.
- Batch creation сохраняет immutable per-job output-folder snapshot. Изменение project default не перенаправляет существующую job.
- Claim/lease/cancellation checks выполняются на stage boundaries. Uncertain provider/output side effect не запускает automatic retry и переводится в explicit reconciliation.
- Exactly-once Google document creation не заявляется; успешное завершение требует persisted output evidence для каждого non-skipped source/fragment.
- Video audio extraction и automatic long-media split/merge остаются server-side, bounded и deterministic.
- Existing-document standardization мутирует только подходящие Google Docs; manifest import мутирует только PostgreSQL catalog metadata.
- Service worker не runtime-cache-ит API responses или upload requests.
- CI/CD, migrations, environments, production operations и rollback регулирует `docs/ci-cd-rules.md`.

## 8. Runtime и delivery baseline

- Verified repository/VPS web/API/worker baseline: exact `main@11a9d1692c76e0e68d1176114bd6ca0fbe76eab0`. Repository CI `33502300963`, Studio/browser `33502301058`, platform CD `33502301037`, worker pre-status `33502795373`, drain `33502878967`, deploy `33502953019` и final status `33503286433` завершились success. Public build identity/health, API readiness и worker identity совпали с exact merge; schema остаётся `0031`.
- Production schema — `0031_provider_account_snapshots`, confirmed by protected release and owner preflight. Existing picker/server verification и OAuth boundary — identity + `drive.file` + `drive.readonly`; maintenance grant остаётся отдельным server-only consent.
- Distinct audio/transcription reference buckets, lifecycle rules и scoped credentials подтверждены предыдущей Goal. Existing legacy Sources сохраняют прежний routing; текущая Goal не переносит bytes и не меняет retention.

## 9. Current critical path

1. Progress/transaction hotfix завершён в PR `#271`; safe provider diagnostics завершена в PR `#272`, exact delivered baseline `main@11a9d169`; CI и web/API/worker identity подтверждены.
2. Последняя owner-started multi-part job подтвердила provider usage `801.689 s`, но первый returned part не был checkpointed: restricted worker role не имеет `UPDATE`, а idempotency read ошибочно использовал PostgreSQL `FOR UPDATE`.
3. Текущий focused follow-up убирает несовместимый lock, закрепляет immutable checkpoint grants real-PostgreSQL regression и даёт existing confirmed-but-uncheckpointed job только explicit cost-confirmed full restart. Automatic recovery и новый provider call запрещены.
4. Production schema `0031` current; повторная migration не требуется. Existing worker isolation, account snapshots, lifecycle/provider-cost gates и duplicate protection не ослабляются.
5. После exact PR/CI/deployment нужен отдельный owner-authorized sufficiently-long retry для `TPH-10`. Commercial contour, новый STT provider, realtime/storage cost, `STORAG-01..15`, system-wide API/DB least privilege и CI/CD policy вне current Goal.

## 10. Supporting documents

- `README.md` — русскоязычная точка входа.
- `AGENTS.md` — repository router и authority.
- `docs/delivery-plan.md` — текущий dashboard, readiness и checkpoint.
- `docs/delivery-plan-archive.md` — завершённая delivery history.
- `docs/architecture.md` — actual logical/runtime architecture.
- `docs/studio-processing-contract.md` — детальные processing invariants PWA.
- `docs/ci-cd-rules.md` — CI/CD и production safety contract.
- `docs/runbooks/studio-platform-ops.md` — production operations.
- `docs/runbooks/validation.md` — validation commands.
- `docs/runbooks/realtime-colab.md` — manual Colab realtime validation.

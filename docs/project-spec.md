# Спецификация проекта VoiceOps

## 1. Назначение и authority

Этот документ — canonical product/project contract и backlog верхнего уровня. Он определяет актуальный scope, business rules, durable constraints, эпики и atomic acceptance criteria. Текущий delivery state, blockers, readiness и Evidence ведутся в `docs/delivery-plan.md`; история delivery — в `docs/delivery-plan-archive.md`.

Приоритет источников задаёт `AGENTS.md`. Последняя явная инструкция владельца от 2026-08-14 заменила прежнюю модель «стабильный Colab batch + развиваемый Studio» моделью двух production-продуктов, каждый из которых содержит batch и realtime:

1. Google Colab: обычная транскрибация и realtime-транскрибация.
2. VoiceOps Studio PWA: обычная транскрибация и realtime-транскрибация.

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

Verified main baseline: `main@8761e86808e8562eff05588f6f60d15dd04dbcf4`. PR `#245`, exact-main repository CI `33104113256`, Studio/browser CI `33104113243` и Studio Platform CD `33104113313` подтвердили merge, CI и web-only Google Picker deployment; authenticated production LIVE Evidence исправления ещё отсутствует. PR `#244` source-cache/branding также merged/deployed, но его authenticated LIVE остаётся archived external gate. Более ранний exact-main delivery подтвердил web/API/worker Audio scope без migration. Bounded production FLAC output `78da8f8e-dfb4-47f7-b6db-fb9a64995fb0` подтверждён как 16-bit mono FLAC с исходной sample rate `48 kHz`, duration `7907.718563` секунд и размером `334113611` bytes. Отдельный production upload в `Транскрибациях` показал per-file и aggregate progress от `16%` до `ready` без запуска provider job; ранее Audio upload progress уже наблюдался LIVE.

Current operational Goal: `REPO-HARDENING-01` на branch `codex/repository-stabilization-01` от verified base `main@8761e86808e8562eff05588f6f60d15dd04dbcf4`; она не меняет product AC/denominator.

| Scope | Готовность | Метод |
|---|---:|---|
| Google Colab | **100% (`29/29`)** | `COLAB-BATCH 23/23` + `COLAB-REALTIME 6/6` |
| Studio PWA | **100% (`119/119`)** | выполненные AC всех PWA-эпиков / все PWA AC; Google Picker UX `3/3`, CI/DEPLOY подтверждены, LIVE отсутствует |
| Согласованный current canonical scope | **100% (`148/148`)** | выполненные AC двух продуктов / все утверждённые AC current scope; READY отдельно зависит от обязательных Evidence gates каждого эпика |

Это не оценка всей upstream product vision. Upstream Google Doc текущей revision содержит `275` list-item requirements (`16` Colab, `158` PWA и `101` commercial), многие из которых compound, future-marked, внешне gated или конфликтуют с current contract. До requirement-by-requirement reconciliation, owner decisions и atomic decomposition корректный denominator и процент полного upstream scope отсутствуют: status — `SPEC RECONCILIATION REQUIRED`, percentage — `N/A`, а не `100%`.

### Commercial scope decision

Owner decision от 2026-08-27: отдельный commercial production для российских пользователей **включён в durable product scope**, но implementation сейчас **не авторизована**. До завершения `SPEC-RECONCILIATION-01` commercial contour имеет lifecycle state **⬜ BACKLOG** и modifier **⛔ BLOCKED (SPEC decomposition / external legal decisions)**.

Обязательная scope boundary для будущей atomic decomposition берётся из upstream commercial section без silent omission: российская infrastructure/data localization; independent environment/resources; registration/auth/TOTP; personal-data lifecycle; cross-border/provider legal gates; replaceable Russian STT production path; quotas/cost accounting; queue fairness; payments/subscriptions/fiscalization; unit economics; least privilege/RLS/audit/backup controls; notifications; legal readiness. Эти категории не считаются выполненными и пока не образуют числовой denominator. Product implementation, CI/CD или production changes этим решением не разрешены.

## 3. Общие product rules

1. Primary batch artifact — Google Docs transcript; realtime должен позволять скачать подтверждённый текст как `.txt`.
2. Фраза владельца «импорт транскрипции в виде документа `.txt`» в текущем контракте означает выгрузку/скачивание результата. Import внешнего `.txt` обратно в продукт не включён без отдельного уточнения.
3. Языковые режимы обоих batch-продуктов: русский, английский и provider auto-detection. В Google Colab auto-detection выбран по умолчанию; русский и английский остаются optional explicit overrides.
4. Время в metadata документа — ISO 8601 и отражает фактическое создание исходного media file. Время изменения файла, время job и время создания transcript document не являются допустимой заменой.
5. Duplicate protection использует устойчивую source identity: Google Drive file ID и доступные metadata; для local files — content fingerprint и доступные metadata. Filename alone недостаточен.
6. Accepted-output manifest/catalog record создаётся только после подтверждённого создания Google Docs результата. Operational job state может храниться отдельно, но не должен становиться ложным доказательством успешной транскрибации.
7. Transcript standardization добавляет metadata header и читабельные абзацы; folder operation охватывает выбранную папку и все вложенные подпапки.
8. Секреты, transcript/document bodies, private source bytes, provider/Google payloads и tokens не попадают в repository, browser-safe metadata, diagnostics или delivery evidence. Explicit owner-scoped Live draft API может возвращать владельцу только его зашифрованный-at-rest transcript draft через authenticated `no-store` response; это content response, а не browser-safe metadata или diagnostic payload.
9. Production/LIVE claims требуют exact revision/artifact identity и фактического runtime evidence; source presence и CI сами по себе этого не доказывают.
10. Primary Google OAuth grant для Studio ограничен exact набором identity + `drive.file` + `drive.readonly`: `drive.readonly` разрешает source ingestion из произвольных доступных пользователю Drive files/folders, а `drive.file` сохраняет write boundary для созданных или явно открытых приложением объектов. Full `drive` scope и любые иные дополнительные scopes запрещены. Расширение до `drive.readonly` явно авторизовано владельцем 2026-08-23; существующее подключение без этого scope требует disconnect/reconnect и нового consent.

## 4. Google Colab

### Эпик `COLAB-BATCH-01` — batch-транскрибация

Status: **🟩 READY — 100% (`23/23`)**. Product AC, exact CI и bounded owner-controlled LIVE подтверждены.

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

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY N/A | LIVE ✅`.

Verified state: `main@c9ac43fc71a97a868db744088c06c69882a555fa` выбирает auto-detection по умолчанию без удаления explicit Russian/English overrides. Exact-main batch canary обработал supported media из вложенной local folder, создал native Google Doc с authoritative embedded creation time в strict ISO 8601 и обновил manifest после создания документа; CODE/TEST также подтверждают English, safe manifest clear и post-output-only source persistence.

Definition of Done: `23/23`, релевантные tests/CI green, ручной Colab validation на reviewed SHA и LIVE batch canary без повторного provider charge или утечки private data.

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

### Эпик `PWA-GOOGLE-PICKER-UX-01` — viewport и выбор текущей папки

Status: **🟦 IN PROGRESS — 100% (`3/3`)**. Все atomic AC, exact-main `CI` и web `DEPLOY` подтверждены; authenticated `LIVE` Evidence исправления ещё отсутствует, поэтому эпик не `READY`.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `PG-01` | Во всех source-file/source-folder/output-folder Picker flows открытая Google Picker modal остаётся зафиксированной относительно viewport и не смещается вслед за document scroll. | ✅ |
| `PG-02` | Пока Google Picker открыт, background document scroll заблокирован; после pick/cancel/error/timeout предыдущие scroll position и body styles восстанавливаются без page jump. | ✅ |
| `PG-03` | В output-folder flow текущая открытая папка является допустимым default selection: кнопка `Выбрать` активна без выбора вложенной папки, включая папку без дочерних папок. | ✅ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE —`.

Verified implementation: `main@8761e86808e8562eff05588f6f60d15dd04dbcf4` блокирует background wheel/touch/scroll через `documentScrollLock.ts`, сохраняет exact inline styles/position и idempotently восстанавливает их; `googlePicker.ts` применяет lifecycle ко всем native Picker terminal paths. Поскольку documented Picker callback не предоставляет navigation event/current-folder authority, output-folder flow использует bounded app-owned Drive folder dialog с ephemeral access token, folder-only Drive REST listing и сохранённой server-side write verification. Текущая папка становится selection сразу после загрузки и остаётся selectable при loading/empty/error child-list state. PR `#245`, exact PR/main CI и web deployment прошли. Owner LIVE 2026-08-27 пока подтверждает только исходные defects, не исправление.

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

Status: **🟩 READY — 100% (`10/10`)**.

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

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`.

`main@800bcc820529ff3c78214c129c593d182c621c62` передаёт persisted source creation authority в output/maintenance contract и запрещает fallback на Google Doc/job/upload/modified clocks. Exact-main CI/CD и bounded production canary подтверждены delivery record PR #227.

### Эпик `PWA-AUDIO-PREPARATION-01` — самостоятельная обработка аудио

Status: **🟩 READY — 100% (`24/24`)**. Полный Audio Preparation scope, включая явный 16-bit FLAC output contract, подтверждён exact-main delivery и bounded production LIVE.

Audio preparation — отдельный пользовательский workspace до транскрибации. Он может завершиться самостоятельным processed-media output без provider call; результат скачивается на устройство либо загружается в явно выбранную Google Drive folder.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `AP-01` | Sidebar содержит отдельный пункт `Обработка аудио` непосредственно перед `Транскрипциями`. | ✅ |
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

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`.

Verified base delivery: PRs `#234–#235`, final merge `16badb0aa4404ae2616a3d46070925b54b043963`; exact-main repository/Studio CI, protected migration `0025_audio_preparation`, API/worker/web rollout и bounded operation `2ad99ead-1c45-4439-8e8a-d64c2bcc3037` подтвердили preview `0:04 → 0:02`, terminal `completed`, download/Drive/reuse и ephemeral cleanup. PR `#237`, exact-main CI/CD и browser-local production WAV подтвердили новый UX, локальную обработку и независимые actions. Последующий exact worker retest на двух сохранённых OBS/MKV sources дал два независимых `invalid_input` на 5%; initial stream/container numeric-duration fallback оказался недостаточным, поэтому `AP-10` остаётся reopened до hotfix CI/deploy и успешного server concat LIVE.

Latest verified runtime: PR `#242` merged как `main@bffbdb11b882701226898b9f7d03062fd69b2679`; exact-main CI/CD и manual worker rollout подтверждены. Production job `9010f902-145b-4ef0-bfef-0416a20daeaf` обработал три реальных OBS/MKV (`137:36 → 129:48`) до `completed`, download action доступен, client warnings/errors отсутствуют. Полученный FLAC оказался больше `600 MB`; локальная FFmpeg diagnosis подтвердила неявный `s32`/24-bit output и стала основанием для `AP-24`.

Final FLAC remediation: PR `#243` merged как `main@018b560035e4ff2219c246f734216f76537875ee`; exact-main CI/CD и manual worker rollout завершились success. Повторный production output `78da8f8e-dfb4-47f7-b6db-fb9a64995fb0` имеет `s16`, `48 kHz`, mono, duration `7907.718563` секунд и размер `334113611` bytes (`318.64 MiB`), закрывая `AP-24`.

Definition of Done: `24/24`, relevant backend/frontend tests и required exact-head CI green, applicable API/worker/web deployment, bounded owner-controlled server concat and browser-local LIVE with short fixtures, authenticated download and optional Google Drive upload without provider call.

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

Status: **🟩 READY — 100% (`6/6`)**.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `PD-01` | Есть отдельная быстрая selected-folder dry-run/apply operation. | ✅ |
| `PD-02` | Folder mode обходит все вложенные подпапки в bounded tree. | ✅ |
| `PD-03` | Документ нормализуется в читабельные абзацы. | ✅ |
| `PD-04` | Документ получает standard metadata header. | ✅ |
| `PD-05` | Timestamp нормализуется в ISO 8601. | ✅ |
| `PD-06` | Timestamp отражает creation time исходного media file, а не Google Doc/job time. | ✅ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`.

Standardization и manifest import остаются разными authority: preview/confirmation одной операции не авторизует другую.

`main@800bcc820529ff3c78214c129c593d182c621c62` разрешает mutation только при owner-scoped persisted source authority, сравнивает видимый ISO timestamp с exact source time и возвращает explicit blocked reason для unavailable/conflict. Bounded production output и repeated single-document dry-run подтвердили authoritative и idempotent path; legacy unknown path остался fail-closed.

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

## 6. Future scope, не включённый в denominator `148`

### Эпик `PWA-AUTH-HARDENING-02`

Status: **⬜ BACKLOG**. Владелец 2026-08-24 разрешил optional TOTP как отдельную следующую Goal: 2FA должна оставаться добровольной и не блокировать вход, пока пользователь её не включил. Cloudflare Zero Trust и TOTP-подтверждение очистки History/Analytics не авторизованы этой Goal.

Future auth criteria исключены из текущего denominator до отдельной Goal с согласованными enrollment, recovery, disable и credential-storage boundaries.

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

- Current verified revision: `main@5a4115aed22497c7cb5c6a4d38258dbcf27641bd` (PR `#246`).
- Exact-main repository CI: run `33114690918`, success.
- Exact-main Studio/browser CI: run `33114690898`, jobs `studio` и `browser-e2e` success.
- Studio Platform CD run `33114690923` завершил web-only deployment; migration/API/worker были корректно skipped. Public `/api/healthz` 2026-08-27 ранее вернул `database=reachable`, `migrations=current`, но exact production schema/component identities этим не доказаны.
- Public root и login shell доступны, required security headers присутствуют. `/manifest.webmanifest?rev=5a4115a` 2026-08-27 вернул `200` и `Content-Type: application/manifest+json`; MIME remediation имеет `DEPLOY/LIVE ✅`. Authenticated source-cache LIVE не выполнен. Historical runtime identifiers находятся в delivery archive.

## 9. Current critical path

1. Выполнить current operational `REPO-HARDENING-01`: documentation truth, bounded manifest MIME remediation и CI efficiency без сокращения quality gates.
2. Не менять product AC/denominator, OAuth scopes, backend/schema/worker, production CD safety contract или commercial implementation.
3. Google Picker и source-cache authenticated LIVE остаются archived external gates и не считаются выполненными.
4. DB least privilege, exact-revision CD redesign, query bounds/storage isolation и legacy removal остаются отдельными Goals.
5. Commercial contour включён в durable BACKLOG, но implementation не входит в текущую Goal.

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

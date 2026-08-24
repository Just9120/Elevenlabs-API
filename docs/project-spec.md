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

Verified main baseline: `main@ebbba50a938feb2d06b2ec59e828834ff204988d`. Текущие Colab проценты дополнительно включают independently tested working-branch criteria `CB-11/15/17`; до merge это не exact-main Evidence. Exact-main CI, Studio/browser CI, web deployment и owner-controlled Chrome LIVE matrix подтвердили ранее закрытые PWA timestamp AC и `PR-06`; PWA realtime принимает display и microphone signals в mixed capture, а residual simultaneous-speaker masking на laptop speakers явно принят владельцем как non-critical limitation.

| Scope | Готовность | Метод |
|---|---:|---|
| Google Colab | **86,2% (`25/29`)** | working-branch snapshot: `COLAB-BATCH 20/23` + `COLAB-REALTIME 5/6` |
| Studio PWA | **94,5% (`86/91`)** | сумма десяти PWA-эпиков ниже; `PR-06` подтверждён exact CI/deploy и bounded Chrome LIVE |
| Весь проект | **92,5% (`111/120`)** | все выполненные AC двух продуктов / все AC текущего scope |

## 3. Общие product rules

1. Primary batch artifact — Google Docs transcript; realtime должен позволять скачать подтверждённый текст как `.txt`.
2. Фраза владельца «импорт транскрипции в виде документа `.txt`» в текущем контракте означает выгрузку/скачивание результата. Import внешнего `.txt` обратно в продукт не включён без отдельного уточнения.
3. Языковые режимы обоих batch-продуктов: русский, английский и provider auto-detection.
4. Время в metadata документа — ISO 8601 и отражает фактическое создание исходного media file. Время изменения файла, время job и время создания transcript document не являются допустимой заменой.
5. Duplicate protection использует устойчивую source identity: Google Drive file ID и доступные metadata; для local files — content fingerprint и доступные metadata. Filename alone недостаточен.
6. Accepted-output manifest/catalog record создаётся только после подтверждённого создания Google Docs результата. Operational job state может храниться отдельно, но не должен становиться ложным доказательством успешной транскрибации.
7. Transcript standardization добавляет metadata header и читабельные абзацы; folder operation охватывает выбранную папку и все вложенные подпапки.
8. Секреты, transcript/document bodies, private source bytes, provider/Google payloads и tokens не попадают в repository, browser-safe metadata, diagnostics или delivery evidence. Explicit owner-scoped Live draft API может возвращать владельцу только его зашифрованный-at-rest transcript draft через authenticated `no-store` response; это content response, а не browser-safe metadata или diagnostic payload.
9. Production/LIVE claims требуют exact revision/artifact identity и фактического runtime evidence; source presence и CI сами по себе этого не доказывают.
10. Primary Google OAuth grant для Studio ограничен exact набором identity + `drive.file` + `drive.readonly`: `drive.readonly` разрешает source ingestion из произвольных доступных пользователю Drive files/folders, а `drive.file` сохраняет write boundary для созданных или явно открытых приложением объектов. Full `drive` scope и любые иные дополнительные scopes запрещены. Расширение до `drive.readonly` явно авторизовано владельцем 2026-08-23; существующее подключение без этого scope требует disconnect/reconnect и нового consent.

## 4. Google Colab

### Эпик `COLAB-BATCH-01` — batch-транскрибация

Status: **🟦 IN PROGRESS — 87,0% (`20/23`)**.

Owner runtime evidence: существующий batch contour используется около четырёх месяцев и в целом стабилен. Новый scope добавляет отсутствующие AC, поэтому эпик больше не может считаться `READY`.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `CB-01` | Provider API keys читаются из Colab Secrets. | ✅ |
| `CB-02` | Пользователь выбирает target folder на Google Drive. | ✅ |
| `CB-03` | С компьютера выбирается один файл. | ✅ |
| `CB-04` | С компьютера выбираются несколько файлов. | ✅ |
| `CB-05` | С компьютера выбирается целая папка с файлами. | ❌ |
| `CB-06` | На Google Drive выбирается один source file. | ✅ |
| `CB-07` | На Google Drive выбираются несколько source files. | ✅ |
| `CB-08` | На Google Drive выбирается source folder. | ✅ |
| `CB-09` | Доступно разделение на спикеров. | ✅ |
| `CB-10` | Доступен явный русский язык. | ✅ |
| `CB-11` | Доступен явный английский язык. | ✅ |
| `CB-12` | Доступно auto-detection языка. | ✅ |
| `CB-13` | Manifest защищает от повторной платной транскрибации. | ✅ |
| `CB-14` | Пользователь может явно пропустить manifest check. | ✅ |
| `CB-15` | Пользователь может безопасно очистить manifest. | ✅ |
| `CB-16` | Пользователь может зарегистрировать выбранную папку в manifest. | ✅ |
| `CB-17` | Manifest не записывает source до подтверждённого Google Docs результата. | ✅ |
| `CB-18` | Source identity основана на Drive metadata/content fingerprint, а не только на имени. | ✅ |
| `CB-19` | Новый transcript document разбит на читабельные абзацы. | ✅ |
| `CB-20` | В начало документа добавлен metadata header. | ✅ |
| `CB-21` | Видимое время документа записано в ISO 8601. | ❌ |
| `CB-22` | Время получено из фактического creation time исходного media file. | ❌ |
| `CB-23` | Есть быстрая dry-run/apply стандартизация выбранной папки и всех подпапок. | ✅ |

Evidence: `SPEC ✅ | CODE ◐ | TEST ◐ | CI ✅ | DEPLOY ◐ | LIVE ◐`.

Verified gaps: local folder реализован и покрыт focused tests в Current Goal branch, но `CB-05` требует representative Colab browser LIVE; `CB-21/22` требуют representative Colab LIVE с embedded/Drive creation authority. English, safe manifest clear с backup/explicit confirmation и post-output-only source persistence закрыты CODE/TEST в Current Goal branch.

Definition of Done: `23/23`, релевантные tests/CI green, ручной Colab validation на reviewed SHA и LIVE batch canary без повторного provider charge или утечки private data.

### Эпик `COLAB-REALTIME-01` — realtime-транскрибация

Status: **🟦 IN PROGRESS — 83,3% (`5/6`)**, приоритет ниже PWA.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `CR-01` | В Windows/Chrome выбирается вкладка, окно или экран через display capture. | ✅ |
| `CR-02` | Захватывается передаваемый browser/system audio track. | ✅ |
| `CR-03` | Микрофон включается опционально и может смешиваться с display audio. | ✅ |
| `CR-04` | Partial и committed transcript отображаются live в окне. | ✅ |
| `CR-05` | Подтверждённый transcript скачивается как `.txt`. | ✅ |
| `CR-06` | Захват не рвётся в согласованной серии representative Windows/Chrome sessions. | ❌ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ◐ | CI ✅ | DEPLOY ◐ | LIVE ◐`.

Owner LIVE evidence подтверждает работоспособность и исторические периодические разрывы захвата вкладки. Current Goal branch добавляет track-ended cleanup, session/WebSocket timeouts и backpressure guard; automatic reconnect намеренно отсутствует, поскольку новый Start обязан получить новый single-use token. До закрытия `CR-06` нужен воспроизводимый manual Colab runtime validation по bounded Windows/Chrome matrix; это остаётся experimental Realtime Colab prototype, не создающий Google Docs и manifest.

## 5. Studio PWA

### Эпик `PWA-CORE-01` — application shell, auth и integrations

Status: **🟦 IN PROGRESS — 100% (`13/13`)**. Product AC, current code/tests, exact-main CI и deployment подтверждены; bounded production inspection подтверждает shell/auth/integrations/settings, но LIVE breadth для retention expiry/cleanup остаётся частичным, поэтому эпик не `READY`.

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

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ◐`.

UX/UI-аудит production на viewport `390x844` ранее выявил document-level horizontal overflow в Diagnostics; deployed remediation заменила unbounded metadata grid и добавила narrow single-column layout. Read-only production inspection 2026-08-23 подтвердил authenticated shell, три primary navigation controls, active provider credential, Google Drive connection, retention/theme/accent controls и отсутствие browser console warnings/errors. Эмуляция narrow viewport не выявила overflow относительно фактического layout viewport, но не подтверждает production expiry/cleanup lifecycle.

Expired source metadata может сохраняться для history/audit, но current owner instruction требует скрывать expired local files из active intake UI. Это заменяет старое UI-допущение о видимости недоступной metadata.

Verified implementation: active project source collection исключает local rows при `expires_at <= now` либо durable status `expired`, не удаляя `Source`, job relations или history evidence. Exact-main CI и subsequent production component deployments подтверждены; bounded LIVE expiry/cleanup coverage остаётся неполным.

### Эпик `PWA-TRANSCRIPTIONS-UX-01` — пользовательская модель транскрибаций

Status: **🟦 IN PROGRESS — 100% (`4/4`)**. Все product AC и exact-head CI подтверждены; DEPLOY и LIVE для текущей ветки ещё не выполнены, поэтому эпик не `READY`.

`Project` остаётся допустимой внутренней ownership/data boundary, но не является обязательной пользовательской сущностью. Основной user flow начинается с обычной или Live-транскрибации; технический workspace выбирается или создаётся автоматически и не требует ручного lifecycle management.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `PT-01` | В `Транскрибациях` доступны отдельные вкладки обычной и Live-транскрибации. | ✅ |
| `PT-02` | Для запуска новой транскрибации пользователь не создаёт, не редактирует и не архивирует технический Project вручную. | ✅ |
| `PT-03` | Один массовый запуск отображается как одна мульти-транскрибация с отдельными source/fragment items. | ✅ |
| `PT-04` | Существующие active legacy workspaces, sources, jobs и outputs остаются доступны без destructive migration; archived production data не восстанавливается автоматически. | ✅ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY — | LIVE —`.

Verified implementation: backend не раскрывает raw batch idempotency key/request hash и выдаёт только deterministic owner/project/key-scoped `multi_*` reference с bounded position. Frontend fail-closed валидирует reference, не допускает duplicate positions, отображает batch одной multi-transcription и сохраняет отдельные progress/output/recovery controls каждого source/fragment item. Exact-head CI: Python `1252/1252`, Studio `539/539`, browser E2E `10/10`, builds и safety markers PASS. Bounded narrow browser fixture также прошёл; production behavior ожидает DEPLOY/LIVE Evidence.

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

### Эпик `PWA-SPEAKER-IDENTITY-01` — имена и роли спикеров

Status: **⬜ BACKLOG — 0,0% (`0/5`)**.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `SP-01` | Есть owner-scoped база имён спикеров. | ❌ |
| `SP-02` | Для speaker identity хранится роль. | ❌ |
| `SP-03` | Пользователь может прослушать bounded voice fragment обнаруженного спикера. | ❌ |
| `SP-04` | Пользователь явно связывает provider speaker label с выбранным именем. | ❌ |
| `SP-05` | Подтверждённое имя/роль используется в transcript output и history metadata. | ❌ |

Evidence: `SPEC ✅ | CODE — | TEST — | CI N/A | DEPLOY — | LIVE —`.

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

## 6. Future scope, не включённый в denominator `120`

### Эпик `PWA-AUTH-HARDENING-02`

Status: **⬜ BACKLOG**. Владелец явно отнёс TOTP/Google Authenticator и Cloudflare Zero Trust к будущему. TOTP-подтверждение очистки History/Analytics также future hardening и не заменяет текущий обязательный Да/Нет confirmation.

Эти future criteria исключены из текущего denominator до отдельной авторизации реализации и выбора architecture/credential model.

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

- Current verified revision: `main@ebbba50a938feb2d06b2ec59e828834ff204988d`.
- Exact-main repository CI: run `32706218832`, success.
- Exact-main Studio/browser CI: run `32706218892`, jobs `studio` и `browser-e2e` success.
- Studio web deployment: run `32706218830`, success; API, migration и worker корректно skipped для browser-only realtime diff. Migration `0023_realtime_drafts` и worker rollout остаются подтверждены предыдущим operational chain.
- Production API/worker/migration evidence предыдущего processing rollout привязано к `main@66fb098` и Alembic head `0020_provider_part_checkpoints`; оно не доказывает более поздние UI/realtime requirements.
- Bounded production canary на `919e613` подтвердил arbitrary-fragment Google Docs output и закрыл `PWA-SEGMENTS-01`, одновременно выявив `PB-05` regression; safe execution identifiers находятся в delivery archive.

## 9. Current critical path

1. Закрыть шесть verified `COLAB-BATCH-01` gaps без ослабления manifest и source-time authority.
2. Закрыть `CR-06` representative Colab realtime stability по Windows/Chrome LIVE matrix.
3. PWA speaker names/roles и manual listen-and-assign остаются явно отложены владельцем.

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

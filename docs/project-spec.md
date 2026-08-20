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

Текущий independently verified baseline: `main@50dff6f7401a08393137d5bd5e28162bd8df1133`:

| Scope | Готовность | Метод |
|---|---:|---|
| Google Colab | **75,9% (`22/29`)** | `COLAB-BATCH 17/23` + `COLAB-REALTIME 5/6` |
| Studio PWA | **76,3% (`61/80`)** | сумма девяти PWA-эпиков ниже |
| Весь проект | **76,1% (`83/109`)** | все выполненные AC двух продуктов / все AC текущего scope |

## 3. Общие product rules

1. Primary batch artifact — Google Docs transcript; realtime должен позволять скачать подтверждённый текст как `.txt`.
2. Фраза владельца «импорт транскрипции в виде документа `.txt`» в текущем контракте означает выгрузку/скачивание результата. Import внешнего `.txt` обратно в продукт не включён без отдельного уточнения.
3. Языковые режимы обоих batch-продуктов: русский, английский и provider auto-detection.
4. Время в metadata документа — ISO 8601 и отражает фактическое создание исходного media file. Время изменения файла, время job и время создания transcript document не являются допустимой заменой.
5. Duplicate protection использует устойчивую source identity: Google Drive file ID и доступные metadata; для local files — content fingerprint и доступные metadata. Filename alone недостаточен.
6. Accepted-output manifest/catalog record создаётся только после подтверждённого создания Google Docs результата. Operational job state может храниться отдельно, но не должен становиться ложным доказательством успешной транскрибации.
7. Transcript standardization добавляет metadata header и читабельные абзацы; folder operation охватывает выбранную папку и все вложенные подпапки.
8. Секреты, transcript/document bodies, private source bytes, provider/Google payloads и tokens не попадают в repository, browser-safe metadata, diagnostics или delivery evidence.
9. Production/LIVE claims требуют exact revision/artifact identity и фактического runtime evidence; source presence и CI сами по себе этого не доказывают.

## 4. Google Colab

### Эпик `COLAB-BATCH-01` — batch-транскрибация

Status: **🟦 IN PROGRESS — 73,9% (`17/23`)**.

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
| `CB-11` | Доступен явный английский язык. | ❌ |
| `CB-12` | Доступно auto-detection языка. | ✅ |
| `CB-13` | Manifest защищает от повторной платной транскрибации. | ✅ |
| `CB-14` | Пользователь может явно пропустить manifest check. | ✅ |
| `CB-15` | Пользователь может безопасно очистить manifest. | ❌ |
| `CB-16` | Пользователь может зарегистрировать выбранную папку в manifest. | ✅ |
| `CB-17` | Manifest не записывает source до подтверждённого Google Docs результата. | ❌ |
| `CB-18` | Source identity основана на Drive metadata/content fingerprint, а не только на имени. | ✅ |
| `CB-19` | Новый transcript document разбит на читабельные абзацы. | ✅ |
| `CB-20` | В начало документа добавлен metadata header. | ✅ |
| `CB-21` | Видимое время документа записано в ISO 8601. | ❌ |
| `CB-22` | Время получено из фактического creation time исходного media file. | ❌ |
| `CB-23` | Есть быстрая dry-run/apply стандартизация выбранной папки и всех подпапок. | ✅ |

Evidence: `SPEC ✅ | CODE ◐ | TEST ◐ | CI ✅ | DEPLOY ◐ | LIVE ◐`.

Verified gaps: UI содержит `local_file`, `local_multi`, `drive_file`, `drive_multi`, `drive_folder`, но не local folder; language contract содержит только `ru` и `detect`; manifest сохраняет `in_progress`/`failed` до Google Docs output; видимый timestamp имеет legacy-формат и новый output использует job time.

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

Owner LIVE evidence подтверждает работоспособность и периодические разрывы захвата вкладки. Automatic reconnect сейчас отсутствует. До закрытия `CR-06` нужен воспроизводимый manual Colab runtime validation; это остаётся experimental Realtime Colab prototype, не создающий Google Docs и manifest.

## 5. Studio PWA

### Эпик `PWA-CORE-01` — application shell, auth и integrations

Status: **🟦 IN PROGRESS — 84,6% (`11/13`)**.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `PC-01` | Интерфейс адаптивен на desktop и narrow viewport. | ✅ |
| `PC-02` | Sidebar содержит Dashboard. | ✅ |
| `PC-03` | Sidebar содержит Projects. | ✅ |
| `PC-04` | Sidebar содержит Settings. | ✅ |
| `PC-05` | Admin входит по login/password и получает server session. | ✅ |
| `PC-06` | Provider API keys добавляются и управляются в Settings. | ✅ |
| `PC-07` | Google Drive подключается через owner-scoped OAuth flow. | ✅ |
| `PC-08` | Local uploads хранятся в Cloudflare R2 через S3-compatible boundary. | ✅ |
| `PC-09` | В Settings выбирается retention period local uploads. | ✅ |
| `PC-10` | После expiry object удаляется из R2 идемпотентным cleanup. | ✅ |
| `PC-11` | После expiry local source исчезает из active web UI. | ❌ |
| `PC-12` | Доступны system, light и dark themes. | ✅ |
| `PC-13` | Пользователь выбирает accent/interface color. | ❌ |

Evidence: `SPEC ✅ | CODE ◐ | TEST ◐ | CI ✅ | DEPLOY ◐ | LIVE ◐`.

Expired source metadata может сохраняться для history/audit, но current owner instruction требует скрывать expired local files из active intake UI. Это заменяет старое UI-допущение о видимости недоступной metadata.

### Эпик `PWA-INGEST-01` — target и source selection, multi-transcription

Status: **🟦 IN PROGRESS — 63,6% (`7/11`)**.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `PI-01` | Выбирается target Google Drive folder. | ✅ |
| `PI-02` | Target folder можно добавить в Favorites и выбрать повторно. | ❌ |
| `PI-03` | С компьютера выбирается один файл. | ✅ |
| `PI-04` | С компьютера выбираются несколько файлов. | ✅ |
| `PI-05` | С компьютера выбирается целая папка с файлами. | ❌ |
| `PI-06` | На Google Drive выбирается один source file. | ✅ |
| `PI-07` | На Google Drive выбираются несколько source files. | ✅ |
| `PI-08` | На Google Drive выбирается source folder. | ❌ |
| `PI-09` | Один batch принимает одну target folder и несколько явно выбранных files. | ✅ |
| `PI-10` | Один batch принимает одну target folder и source folder. | ❌ |
| `PI-11` | Для каждой composer row можно независимо выбрать source и target folder. | ✅ |

Evidence: `SPEC ✅ | CODE ◐ | TEST ◐ | CI ✅ | DEPLOY ◐ | LIVE ◐`.

### Эпик `PWA-SEGMENTS-01` — произвольные пользовательские фрагменты

Status: **🟦 IN PROGRESS — 100% (`5/5`)**.

Generalized composer принимает ordered plan из `N >= 1` фрагментов в пределах batch maximum. Browser и API отклоняют malformed, reversed, overlapping, out-of-order и over-limit планы; каждый принятый фрагмент становится отдельной job с immutable clip/output-folder snapshot и проходит существующий one-job/one-Google-Docs-output pipeline.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `PS-01` | Пользователь задаёт число фрагментов. | ✅ |
| `PS-02` | Поддерживается произвольное число `N >= 1`, а не только две части. | ✅ |
| `PS-03` | Для каждого фрагмента задаётся start time. | ✅ |
| `PS-04` | Для каждого фрагмента задаётся end time либо явный `Конец`. | ✅ |
| `PS-05` | Для каждого валидного фрагмента создаётся отдельный transcript document. | ✅ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI — | DEPLOY — | LIVE —`.

### Эпик `PWA-BATCH-01` — transcription options, progress и output

Status: **🟦 IN PROGRESS — 90,0% (`9/10`)**.

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
| `PB-10` | Timestamp получен из фактического creation time исходного media file. | ❌ |

Evidence: `SPEC ✅ | CODE ◐ | TEST ◐ | CI ✅ | DEPLOY ◐ | LIVE ◐`.

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

Status: **🟦 IN PROGRESS — 83,3% (`5/6`)**.

В PWA роль manifest выполняет PostgreSQL-backed `Манифест Studio`, а не общий JSON-файл Colab.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `PM-01` | Accepted output evidence блокирует неявную повторную транскрибацию. | ✅ |
| `PM-02` | Явный reprocess/bypass требует отдельного user confirmation. | ✅ |
| `PM-03` | Пользователь может безопасно очистить owner-scoped manifest/catalog. | ❌ |
| `PM-04` | Выбранная Google Drive folder tree регистрируется отдельным dry-run/apply flow. | ✅ |
| `PM-05` | Accepted-output record появляется только после Google Docs creation evidence. | ✅ |
| `PM-06` | Duplicate identity использует Drive file ID/Studio source identity и settings, не filename alone. | ✅ |

Evidence: `SPEC ✅ | CODE ◐ | TEST ◐ | CI ✅ | DEPLOY ◐ | LIVE ◐`.

### Эпик `PWA-STANDARDIZATION-01` — стандартизация Google Docs

Status: **🟦 IN PROGRESS — 83,3% (`5/6`)**.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `PD-01` | Есть отдельная быстрая selected-folder dry-run/apply operation. | ✅ |
| `PD-02` | Folder mode обходит все вложенные подпапки в bounded tree. | ✅ |
| `PD-03` | Документ нормализуется в читабельные абзацы. | ✅ |
| `PD-04` | Документ получает standard metadata header. | ✅ |
| `PD-05` | Timestamp нормализуется в ISO 8601. | ✅ |
| `PD-06` | Timestamp отражает creation time исходного media file, а не Google Doc/job time. | ❌ |

Evidence: `SPEC ✅ | CODE ◐ | TEST ◐ | CI ✅ | DEPLOY ◐ | LIVE ◐`.

Standardization и manifest import остаются разными authority: preview/confirmation одной операции не авторизует другую.

### Эпик `PWA-REALTIME-01` — realtime-транскрибация

Status: **🟦 IN PROGRESS — 83,3% (`5/6`)**.

| AC | Atomic acceptance criterion | Выполнено |
|---|---|:---:|
| `PR-01` | В Windows/Chrome выбирается вкладка, окно или экран. | ✅ |
| `PR-02` | Захватывается передаваемый browser/system audio track. | ✅ |
| `PR-03` | Микрофон включается опционально и смешивается с display audio. | ✅ |
| `PR-04` | Partial и committed transcript отображаются live. | ✅ |
| `PR-05` | Подтверждённый transcript скачивается как `.txt`. | ✅ |
| `PR-06` | Representative microphone/display/mixed sessions стабильно проходят production LIVE canaries. | ❌ |

Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ◐ | LIVE ◐`.

Realtime использует short-lived single-use capability. Он не создаёт batch jobs, Google Docs, manifest/catalog records, analytics records или durable transcript-body state. Automatic reconnect отсутствует и не считается выполнением `PR-06`.

### Эпик `PWA-OPERABILITY-01` — diagnostics, history и analytics

Status: **🟦 IN PROGRESS — 77,8% (`14/18`)**.

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
| `PO-10` | History можно очистить owner-scoped action. | ❌ |
| `PO-11` | Очистка History требует подтверждения Да/Нет. | ❌ |
| `PO-12` | Analytics показывает количество транскрибаций. | ✅ |
| `PO-13` | Analytics показывает execution/stage durations. | ✅ |
| `PO-14` | Analytics показывает provider/model. | ✅ |
| `PO-15` | Analytics явно показывает success percentage. | ✅ |
| `PO-16` | Analytics показывает дополнительные safe outcome/options metadata. | ✅ |
| `PO-17` | Analytics можно очистить owner-scoped action. | ❌ |
| `PO-18` | Очистка Analytics требует подтверждения Да/Нет. | ❌ |

Evidence: `SPEC ✅ | CODE ◐ | TEST ◐ | CI ✅ | DEPLOY ◐ | LIVE ◐`.

## 6. Future scope, не включённый в denominator `109`

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

- Current audit revision: `main@50dff6f7401a08393137d5bd5e28162bd8df1133`.
- Exact-main repository CI: run `32351540609`, success.
- Exact-main Studio/browser CI: run `32351540560`, jobs `studio` и `browser-e2e` success.
- Studio component CD run `32351540606` доставил `studio-web` и `studio-api`; manual worker deploy/status runs `32352024954`/`32352126674` подтвердили healthy worker image exact merge revision. Это component DEPLOY/health evidence, а не доказательство product transcription canary.
- Production API/worker/migration evidence предыдущего processing rollout привязано к `main@66fb098` и Alembic head `0020_provider_part_checkpoints`; оно не доказывает более поздние UI/realtime requirements.
- GitHub Deployments API не содержит deployment records для `50dff6f`; authoritative operational evidence находится в Actions runs и archive.

## 9. Current critical path

1. Закрыть PWA contract gaps без новой architecture boundary: explicit English, target Favorites, source creation timestamp propagation, JSON/YAML/TOML diagnostics exports, success percentage и safe clear confirmations.
2. Реализовать folder intake для local/Drive и обе multi-transcription modes с bounded enumeration, duplicate handling и preflight.
3. Заменить narrow two-part model на arbitrary N-fragment plan с server validation, immutable job snapshots и one-output-per-fragment semantics.
4. Реализовать PWA speaker names/roles и manual listen-and-assign после отдельного privacy/data-retention design внутри уже авторизованного feature scope.
5. Стабилизировать PWA runtime и провести component-specific deploy/LIVE canaries; затем вернуться к Colab realtime capture stability.

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

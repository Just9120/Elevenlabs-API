# Спецификация проекта VoiceOps Studio

## 1. Назначение, источники и область

Canonical продуктовый контракт на русском языке. AC и правила находятся здесь; текущие статусы, Evidence, readiness, findings и checkpoint — только в [delivery-plan.md](delivery-plan.md). История исполнения — в [delivery-plan-archive.md](delivery-plan-archive.md).

Основание актуализации: explicit AUDIT instruction владельца 2026-09-05 разрешает локальную сверку и актуализацию документации, включая декомпозицию согласованного результата. Она запрещает реализацию, resume, commit, push, PR, merge и deploy до нового поручения. В этой сессии это приоритетнее старого router, который считал upstream несогласованным и предлагал auto-resume.

[Исходные требования](https://docs.google.com/document/d/1uaYvnqpbns_iyHTtQDZYjNYygT4ikUhmhuhRDWySrzI/edit) прочитаны через Google Drive; modifiedTime `2026-09-05T09:31:26.419Z`, Google revision `ANLCKQnVfm_EtgFLB0o55UiZZ4i8uq16A700xp0wG1GHyC3kk_gZAVlMlxSeBvaDLUdisiOWP9U8M987txWQoLV7tDmnJxNJh2ElGGTMG74`, один tab `t.0`. Нумерация `S001–S289` ниже относится к 289 bullet paragraphs этой revision. Старые `R001–R275/N001–N008` относились к revision от 2026-08-27 и не применяются к новому порядку пунктов.

Стабильные 610 прежних AC сохранены; 77 недостающих проверяемых AC добавлены в пределах текущего intent. Изменены формулировки PB-06/PM-05 (независимый результат), PTM-01 (название workspace), CID-13/14 (облака по контурам); основание — S007/031/122/123/138/143/176. Это не реализация и не расширение прежней Goal. Детализация, явно не отменённая последующим решением, сохранена; отсутствие повтора старого AC в новом документе само по себе его не удаляет.

## 2. Статусы и расчёт

Реализация: число AC с подтверждённой CODE-поверхностью / число уникальных canonical AC; частичный AC не даёт дробной доли. Для runtime-only AC документация/исходник недостаточны. Подтверждённая приёмка: AC с полным требуемым Evidence dossier / тот же denominator. `READY` требует 100% приёмки. Количество пройденных тестов не равно количеству принятых AC.

Evidence: SPEC, CODE, TEST, CI, DEPLOY, LIVE. Значения: ✅ подтверждено, ◐ частично, ❌ failed, — отсутствует, N/A неприменимо. Для выполняемых PWA сценариев необходимы CI, delivery соответствующих компонентов и AC-specific runtime Evidence. Для Colab DEPLOY N/A; capture/платные/Google сценарии требуют соответствующей runtime проверки. Commercial Evidence никогда не выводится из personal deployment.

Общие функции описаны один раз; EVC-13 требует их покрытия в commercial. Не добавлять повторный процент за shared code или одно и то же Evidence. Отдельно определённые старые environment AC сохранены как проверяемые проекции (например EVC-07 и CINF-10), их пересечение раскрыто в плане; denominator считает уникальные ID, а не независимые по смыслу функции.

## 3. Общие продуктовые правила

1. Подтверждённый Studio transcript хранится независимо от облачного экспорта. Google Docs — personal export, Яндекс Диск/DOCX — cloud export обоих контуров. Colab сохраняет прежний Google Docs flow.
2. Фраза владельца «импорт транскрипции в виде документа `.txt`» в текущем контракте означает выгрузку/скачивание результата. Import внешнего `.txt` обратно в продукт не включён без отдельного уточнения.
3. Языковые режимы обоих batch-продуктов: русский, английский и provider auto-detection. В Google Colab auto-detection выбран по умолчанию; русский и английский остаются optional explicit overrides.
4. Для нового transcript время в metadata документа — ISO 8601 и отражает фактическое создание исходного media file. При explicit standardization существующего legacy Google Doc без доступного исходного файла уже присутствующий валидный `Created at` сохраняется; если такого значения нет или оно невалидно, поле полностью пропускается. Время изменения файла, время job/Google Doc, filename и текущее время не являются допустимой заменой; подтверждённый conflict source dates блокирует mutation.
5. Duplicate protection использует устойчивую source identity: Google Drive file ID и доступные metadata; для local files — content fingerprint и доступные metadata. Filename alone недостаточен.
6. Распознавание и экспорт имеют отдельные подтверждённые состояния; manifest не ставит success до фактического результата соответствующего этапа.
7. Transcript standardization добавляет metadata header и читабельные абзацы; folder operation охватывает выбранную папку и все вложенные подпапки.
8. Секреты, transcript/document bodies, private source bytes, provider/Google payloads и tokens не попадают в repository, browser-safe metadata, diagnostics или delivery evidence. Explicit owner-scoped Live draft API может возвращать владельцу только его зашифрованный-at-rest transcript draft через authenticated `no-store` response; это content response, а не browser-safe metadata или diagnostic payload.
9. Production/LIVE claims требуют exact revision/artifact identity и фактического runtime evidence; source presence и CI сами по себе этого не доказывают.
10. Primary Google OAuth grant для Studio ограничен exact набором identity + `drive.file` + `drive.readonly`: `drive.readonly` разрешает source ingestion из произвольных доступных пользователю Drive files/folders, а `drive.file` сохраняет write boundary для созданных или явно открытых приложением объектов. Full `drive` scope и любые иные дополнительные scopes запрещены. Расширение до `drive.readonly` явно авторизовано владельцем 2026-08-23; существующее подключение без этого scope требует disconnect/reconnect и нового consent.
11. S001–S289 ниже — обязательный текущий intent. Personal и commercial изолированы; общие пользовательские функции применимы к обоим. Их commercial интеграция и проверка целиком gate-ятся EVC-13/31 и contour-specific AC: переиспользуемый personal код не доказывает commercial delivery. Организации и collaboration вне scope.
12. S3 — внутреннее хранение; Google Drive и Яндекс Диск — внешние пользовательские подключения. Cloud failure не блокирует сохранение распознавания в Studio.
13. Single-use token нельзя переиспользовать; требуемый reconnect получает новый capability, сохраняет session identity и явно обрабатывает replay/dedup. Это новый product scope, не разрешение исполнить его в AUDIT.
14. Новые документы пропускают неизвестную дату записи (S135); это заменяет прежний placeholder `Created at: unknown`.
15. Существующий скрытый технический Project не требует ручного создания для транскрибации. Новый отдельный раздел «Проекты» обязателен по S014; дополнительные правила его пользовательского lifecycle определяются перед соответствующей Goal.
16. Заданные технологии S264–S281 являются durable constraints. Конкретные версии и команды принадлежат code/config и Project CI/CD profile. Cloudflare Zero Trust остаётся опциональным, не обязательным deliverable.

## 4. Эпики и атомарные AC

### Эпик `COLAB-BATCH-01` — batch-транскрибация

| AC | Проверяемое требование |
|---|---|
| `CB-01` | Provider API keys читаются из Colab Secrets. |
| `CB-02` | Пользователь выбирает target folder на Google Drive. |
| `CB-03` | С компьютера выбирается один файл. |
| `CB-04` | С компьютера выбираются несколько файлов. |
| `CB-05` | С компьютера выбирается целая папка с файлами. |
| `CB-06` | На Google Drive выбирается один source file. |
| `CB-07` | На Google Drive выбираются несколько source files. |
| `CB-08` | На Google Drive выбирается source folder. |
| `CB-09` | Доступно разделение на спикеров. |
| `CB-10` | Доступен явный русский язык. |
| `CB-11` | Доступен явный английский язык. |
| `CB-12` | Доступно auto-detection языка и оно выбрано по умолчанию; русский и английский остаются optional overrides. |
| `CB-13` | Manifest защищает от повторной платной транскрибации. |
| `CB-14` | Пользователь может явно пропустить manifest check. |
| `CB-15` | Пользователь может безопасно очистить manifest. |
| `CB-16` | Пользователь может зарегистрировать выбранную папку в manifest. |
| `CB-17` | Manifest не записывает source до подтверждённого Google Docs результата. |
| `CB-18` | Source identity основана на Drive metadata/content fingerprint, а не только на имени. |
| `CB-19` | Новый transcript document разбит на читабельные абзацы. |
| `CB-20` | В начало документа добавлен metadata header. |
| `CB-21` | Видимое время документа записано в ISO 8601. |
| `CB-22` | Время получено из фактического creation time исходного media file. |
| `CB-23` | Есть быстрая dry-run/apply стандартизация выбранной папки и всех подпапок. |
| `CB-24` | Каждый новый Colab transcript создаётся в canonical versionless формате `transcript_doc`: название документа — Google Docs `Heading 2`, метка `Спикер N:` — русская, bold и `14 pt`, обычный текст — `11 pt`; устойчивые technical terms и metadata keys остаются на английском. |

### Эпик `COLAB-REALTIME-01` — realtime-транскрибация

| AC | Проверяемое требование |
|---|---|
| `CR-01` | В Windows/Chrome выбирается вкладка, окно или экран через display capture. |
| `CR-02` | Захватывается передаваемый browser/system audio track. |
| `CR-03` | Микрофон включается опционально и может смешиваться с display audio. |
| `CR-04` | Partial и committed transcript отображаются live в окне. |
| `CR-05` | Подтверждённый transcript скачивается как `.txt`. |
| `CR-06` | Захват не рвётся в согласованной серии representative Windows/Chrome sessions. |

### Эпик `PWA-CORE-01` — application shell, auth и integrations

| AC | Проверяемое требование |
|---|---|
| `PC-01` | Интерфейс адаптивен на desktop и narrow viewport без document-level overflow и недоступных controls. |
| `PC-02` | Sidebar содержит Dashboard. |
| `PC-03` | Primary navigation и page title используют пользовательскую сущность `Транскрибации`, а не технический `Project`. |
| `PC-04` | Sidebar содержит Settings. |
| `PC-05` | Admin входит по login/password и получает server session. |
| `PC-06` | Provider API keys добавляются и управляются в Settings. |
| `PC-07` | Google Drive подключается через owner-scoped OAuth flow. |
| `PC-08` | Local uploads хранятся в Cloudflare R2 через S3-compatible boundary. |
| `PC-09` | В Settings выбирается retention period local uploads. |
| `PC-10` | После expiry object удаляется из R2 идемпотентным cleanup. |
| `PC-11` | После expiry local source исчезает из active web UI. |
| `PC-12` | Доступны system, light и dark themes. |
| `PC-13` | Пользователь выбирает accent/interface color. |
| `PC-14` | Direct local upload в `Обработке аудио` и `Транскрибациях` показывает реальный progress текущего файла в bytes/percent и aggregate queue progress; timeout/network outcome проходит completion reconciliation без автоматического повторного PUT. |

### Эпик `PWA-USER-EXPERIENCE-02` — пользовательский язык и progressive disclosure

| AC | Проверяемое требование |
|---|---|
| `PUX-01` | Обзор приоритетно показывает пользовательские действия, текущую работу и доступные результаты; configuration counters не выступают главным содержанием страницы. |
| `PUX-02` | Основной flow `Подготовка аудио` описывает варианты выбора по пользовательскому результату; S3, server-side FFmpeg, MIME, bytes и иные implementation details не показываются без явного раскрытия технических деталей. |
| `PUX-03` | Composer и preflight транскрибации используют понятные русские действия и явную non-color-only индикацию важных опций; internal source/output type names и identifiers не входят в default presentation. |
| `PUX-04` | Одиночная job отображается как `Транскрибация`, а batch с несколькими jobs — как `Группа транскрибаций`; служебные labels `Мульти-транскрибация` и `Элемент N` отсутствуют в default presentation. |
| `PUX-05` | Terminal notice имеет семантически корректный visual/ARIA tone для success, failure и cancellation; failed/cancelled state не использует success styling. |
| `PUX-06` | Пользователь видит локализованную actionable ошибку; raw backend/provider error code не показывается по умолчанию и доступен только в явно раскрытых данных для поддержки. |
| `PUX-07` | Job/History cards не дублируют одинаковые timestamps и metadata; UUID, storage/source/output technical types и расширенные processing details находятся под явным disclosure. |
| `PUX-08` | Основной Live flow объясняет захват, временное восстановление и результат пользовательским русским языком; model/VAD/checkpoint/storage/reconnect implementation details находятся под disclosure `Технические детали`. |
| `PUX-09` | Transcript maintenance использует user-task terms (`проверка`, `применение`, `актуальный формат`) в основных controls/messages; `dry-run`, metadata, catalog и standard identifiers показываются только как secondary technical help. |
| `PUX-10` | Maintenance result сначала показывает summary и доступные действия, а длинные document lists имеют filter и bounded pagination/progressive disclosure без unbounded render всех строк. |
| `PUX-11` | В Settings обычные подключения и пользовательские storage preferences отделены от diagnostics, runtime identity, debug/export и maintenance access, которые явно обозначены как раздел для поддержки/расширенные настройки. |
| `PUX-12` | App-owned Google Drive dialog на viewport `390x844` не имеет horizontal overflow, сохраняет читаемые названия и доступные primary/close controls; modal scroll остаётся изолирован от страницы. |
| `PUX-13` | Running transcription отображается одним постоянно активным user-facing progress meter с текущим действием и активным файлом; owner-scoped automatic refresh обновляет state без ручного reload/tab switch, exact percentage отражает только подтверждённые checkpoints, а technical stages доступны под progressive disclosure. |

### Эпик `PWA-UX-POLISH-03` — содержательный dashboard и сворачиваемые support/maintenance details

| AC | Проверяемое требование |
|---|---|
| `UXPOL-01` | Owner dashboard показывает полезные незавершённые/последние транскрибации, последние документы, connection/system attention и быстрые действия; корректные loading/empty/error states не подменяются техническими counters. |
| `UXPOL-02` | Maintenance-вкладка называется `Подготовка документов` и объясняет проверку/стандартизацию текущего формата без двусмысленного обещания, что все документы уже готовы. |
| `UXPOL-03` | Завершённый scan/apply plan сначала показывает summary; document list сворачивается, а весь завершённый результат можно явно убрать/reset без удаления durable run/history или влияния на running operation. |
| `UXPOL-04` | System state в `Для поддержки` по умолчанию показывает понятный readiness summary, а component identities, commits, schema и technical probes находятся под доступным disclosure. |
| `UXPOL-05` | Diagnostic events отображаются bounded страницами; каждая строка имеет понятный human label/summary и раскрывает technical code/metadata только по запросу пользователя. |
| `UXPOL-06` | Diagnostic bundle UI предлагает `JSON — для анализа моделью` и `Markdown — для человека`, ясно объясняет выбор и не требует DOCX/YAML/TOML для обычного flow; backend compatibility может сохраняться. |
| `UXPOL-07` | Связанная операция/задача выбирается или ищется по понятному названию/ID case-insensitively; поле остаётся optional, объясняет назначение и не требует угадать exact register/internal identifier. |
| `UXPOL-08` | ElevenLabs account/cost panel объясняет план, использовано/осталось, overage и invoice простым русским языком; raw provider units/provenance находятся под optional disclosure. |

### Эпик `PWA-UX-CONTROLS-04` — честные controls, recovery и compact diagnostics

| AC | Проверяемое требование |
|---|---|
| `UXCTL-01` | Отдельный STT mode показывается только если effective provider capability реально отличается model, transport, features, speed или cost; эквивалентные modes объединяются. |
| `UXCTL-02` | Для каждого различающегося STT mode до dispatch доступно краткое понятное объяснение фактических отличий без неподтверждённых обещаний. |
| `UXCTL-03` | Fragmentation включается отдельным явным checkbox и в выключенном состоянии не создаёт segment-specific controls. |
| `UXCTL-04` | Общая output folder является default destination всех fragments. |
| `UXCTL-05` | Каждый fragment может переопределить output folder; composer/preflight показывает resolved destination каждого fragment до создания jobs. |
| `UXCTL-06` | Attention-required terminal job остаётся видимой до решения, но её подробности можно свернуть без изменения durable state. |
| `UXCTL-07` | Пользователь может повторно проверить uncertain result, связать job с подтверждённым более поздним результатом либо явно подтвердить отсутствие результата с предупреждением о возможном расходе; только resolved job переходит в обычный history lifecycle, audit сохраняется. |
| `UXCTL-08` | ElevenLabs account UI отдельно показывает base subscription plan и PAYG/prepaid balance и переводит raw provider values в понятные пользовательские labels. |
| `UXCTL-09` | Порядок расходования subscription credits и PAYG отображается только при наличии подтверждённых provider data и не выводится из предположений Studio. |
| `UXCTL-10` | Bulk cleanup preview показывает eligible/blocked Studio-owned files, aggregate bytes и явно сообщает, что Google Drive sources/documents не удаляются. |
| `UXCTL-11` | Bulk cleanup apply требует explicit confirmation, удаляет только eligible Studio-owned files, безопасно пропускает blocked files и возвращает bounded summary по причинам. |
| `UXCTL-12` | Diagnostic event сначала показывает human-readable problem/action summary; technical event code, request/trace IDs и расширенные metadata находятся под disclosure. |
| `UXCTL-13` | Diagnostic projection сохраняет safe blocker reason и source/object type, необходимые для понимания failed или blocked действия. |
| `UXCTL-14` | Весь diagnostic event log можно свернуть; errors/warnings приоритетны, informational events доступны по запросу, список остаётся bounded/paginated. |

### Эпик `PWA-TRANSCRIPTIONS-UX-01` — пользовательская модель транскрибаций

| AC | Проверяемое требование |
|---|---|
| `PT-01` | В `Транскрибациях` доступны отдельные вкладки обычной и Live-транскрибации. |
| `PT-02` | Для запуска новой транскрибации пользователь не создаёт, не редактирует и не архивирует технический Project вручную. |
| `PT-03` | Один массовый запуск отображается как одна мульти-транскрибация с отдельными source/fragment items. |
| `PT-04` | Существующие active legacy workspaces, sources, jobs и outputs остаются доступны без destructive migration; archived production data не восстанавливается автоматически. |

### Эпик `PWA-INGEST-01` — target и source selection, multi-transcription

| AC | Проверяемое требование |
|---|---|
| `PI-01` | Выбирается target Google Drive folder. |
| `PI-02` | Target folder можно добавить в Favorites и выбрать повторно. |
| `PI-03` | С компьютера выбирается один файл. |
| `PI-04` | С компьютера выбираются несколько файлов. |
| `PI-05` | С компьютера выбирается целая папка с файлами. |
| `PI-06` | На Google Drive выбирается один source file. |
| `PI-07` | На Google Drive выбираются несколько source files. |
| `PI-08` | На Google Drive выбирается source folder. |
| `PI-09` | Один batch принимает одну target folder и несколько явно выбранных files. |
| `PI-10` | Один batch принимает одну target folder и source folder. |
| `PI-11` | Для каждой composer row можно независимо выбрать source и target folder. |

### Эпик `PWA-GOOGLE-PICKER-UX-01` — app-owned Drive selection, search и viewport

| AC | Проверяемое требование |
|---|---|
| `PG-01` | Во всех source-file/source-folder/output-folder Picker flows открытая Google Picker modal остаётся зафиксированной относительно viewport и не смещается вслед за document scroll. |
| `PG-02` | Пока Google Picker открыт, background document scroll заблокирован; после pick/cancel/error/timeout предыдущие scroll position и body styles восстанавливаются без page jump. |
| `PG-03` | В output-folder flow текущая открытая папка является допустимым default selection: кнопка `Выбрать` активна без выбора вложенной папки, включая папку без дочерних папок. |
| `PG-04` | App-owned output-folder dialog позволяет искать доступные папки по имени, открывать найденную папку и выбрать её как current target без обязательного выбора вложенной папки. |
| `PG-05` | Source-file flow использует app-owned интерфейс, визуально и поведенчески согласованный с output-folder dialog; native Google Picker для этого flow не используется. |
| `PG-06` | Source-file dialog позволяет искать поддерживаемые audio/video files по имени и выбрать до `50` файлов; navigation/search/pagination не теряют уже выбранные элементы и не создают duplicates. |
| `PG-07` | Source-folder flow использует app-owned интерфейс, визуально и поведенчески согласованный с output-folder dialog; текущая открытая папка является допустимым selection, включая empty folder. |
| `PG-08` | Source-folder dialog позволяет искать доступные папки по имени, открыть найденную папку и выбрать её как current source folder. |

### Эпик `PWA-SEGMENTS-01` — произвольные пользовательские фрагменты

| AC | Проверяемое требование |
|---|---|
| `PS-01` | Пользователь задаёт число фрагментов. |
| `PS-02` | Поддерживается произвольное число `N >= 1`, а не только две части. |
| `PS-03` | Для каждого фрагмента задаётся start time. |
| `PS-04` | Для каждого фрагмента задаётся end time либо явный `Конец`. |
| `PS-05` | Для каждого валидного фрагмента создаётся отдельный transcript document. |

### Эпик `PWA-BATCH-01` — transcription options, progress и output

| AC | Проверяемое требование |
|---|---|
| `PB-01` | Доступно разделение на спикеров. |
| `PB-02` | Доступен явный русский язык. |
| `PB-03` | Доступен явный английский язык. |
| `PB-04` | Доступно auto-detection языка. |
| `PB-05` | Job progress отображается live в процентах из server checkpoints. |
| `PB-06` | При явно выбранном Google Docs export создаётся оформленный transcript и safe output link; сохранение распознавания в Studio имеет отдельный lifecycle (RS-04..08). |
| `PB-07` | Transcript document разбит на читабельные абзацы. |
| `PB-08` | В начало документа добавлен metadata header. |
| `PB-09` | Видимый timestamp имеет ISO 8601 format. |
| `PB-10` | Timestamp получен из фактического creation time исходного media file. |
| `PB-11` | Composer и preflight явно текстом показывают `Разделение спикеров: включено` или `Разделение спикеров: выключено`; включённое состояние визуально заметно и не передаётся только цветом. |

### Эпик `PWA-AUDIO-PREPARATION-01` — самостоятельная обработка аудио

| AC | Проверяемое требование |
|---|---|
| `AP-01` | Sidebar содержит отдельный пункт `Подготовка аудио` непосредственно перед `Транскрипциями`, а hero той же страницы использует заголовок `Подготовка аудио`. |
| `AP-02` | Пользователь выбирает один или несколько доступных owner-scoped media sources и запускает обработку независимо от транскрибации. |
| `AP-03` | До обработки каждый input проверяется через bounded probe на container, codec, duration, audio-stream presence и media integrity; invalid input fail-closed. |
| `AP-04` | Несколько inputs по умолчанию упорядочиваются по authoritative creation time, а пользователь может явно изменить порядок до запуска. |
| `AP-05` | Совместимые inputs могут быть склеены без перекодирования и потери качества; несовместимый copy plan блокируется до явного выбора conversion path. |
| `AP-06` | Processed output можно явно преобразовать в `WAV` или `FLAC`. |
| `AP-07` | Для stereo input доступен явный mono mode: mixdown, left channel или right channel; недоступный channel mode отклоняется до processing. |
| `AP-08` | Silence processing позволяет задать threshold, минимальную длительность тишины и сколько тишины оставить; значения имеют bounded safe limits. |
| `AP-09` | До mutation пользователь получает preview общей исходной длительности и оценочной длительности после silence processing. |
| `AP-10` | Склейка, silence processing, conversion и переименование могут выполняться отдельно или в комбинации без обязательной последующей транскрибации. |
| `AP-11` | Пользователь может задать optional output name; если поле пусто, output наследует stem соответствующего исходного filename (для concat — первого source в подтверждённом порядке). User-visible Unicode/кириллическое имя сохраняется в Studio Source, Google Drive и download, а internal storage key формируется отдельно и не подменяет видимое имя. |
| `AP-12` | Доступны bounded presets для типовых сценариев `Лекция`, `Созвон` и `Только обработать аудио`, причём пользователь видит и может изменить итоговые параметры до запуска. |
| `AP-13` | Processing имеет durable owner-scoped queue state, server checkpoints, live progress, cancellation и безопасное восстановление после worker restart. |
| `AP-14` | Успешный output хранится в configured S3-compatible temporary storage по owner retention policy, доступен для authenticated download и может быть выбран как новый source. |
| `AP-15` | Пользователь может загрузить successful output в явно выбранную Google Drive folder через owner grant с `drive.file`; persisted result содержит safe Drive link без token/object identity. |
| `AP-16` | Ephemeral reference uploads хранятся в S3-compatible storage только до terminal state операции и имеют hard failsafe TTL 24 часа; request-scoped FFmpeg files и failed partial output удаляются после success/failure/cancel, а API/UI/logs/diagnostics не раскрывают private paths, object keys или source bytes. |
| `AP-17` | Пользователь может обработать device media browser-side без передачи source bytes в API/S3/provider; результат существует только в текущей вкладке и скачивается как WAV. |
| `AP-18` | Browser-local path имеет явные file-count/input-size/decoded-memory bounds и при неподдерживаемом codec/channel/resources выдаёт понятную ошибку с предложением server-side Studio path. |
| `AP-19` | Для нескольких inputs пользователь явно выбирает `Обработать каждый отдельно` (default, отдельный output на source) либо `Склеить в один файл` (один ordered output). |
| `AP-20` | До запуска UI показывает numbered result/concat plan, origin, size и authoritative creation metadata where available, позволяет manual reorder и не использует filename как creation/order authority. |
| `AP-21` | Default plan сохраняет исходный format/container; изменение каналов или пауз требует явного WAV/FLAC conversion path без скрытого перекодирования. |
| `AP-22` | Primary UI использует user-facing scenario/title controls, не показывает technical filename template, называет функцию `Уменьшить длинные паузы в аудио или видео`, использует default `-45 dB` и раскрывает остальные silence parameters только после включения функции. |
| `AP-23` | Download, optional save в явно выбранную Google Drive folder и handoff/reuse в транскрибацию или новую обработку представлены независимыми terminal actions, а не взаимоисключающим выбором результата. |
| `AP-24` | Server-side FLAC создаётся с явной 16-bit sample precision и исходной sample rate, UI раскрывает эти параметры, а FFmpeg filter graph не может неявно повысить output до избыточного 24-bit. |
| `AP-25` | Source actions оформлены как доступный tablist; mode `В Google Drive без обработки` принимает bounded multi-select только поддерживаемых audio/video с устройства и сохраняет исходные bytes, filename и MIME без преобразования. |
| `AP-26` | Для direct-upload mode целевая folder выбирается существующим app-owned output-folder dialog с search/navigation/shared drives и возможностью выбрать current folder, включая empty folder. |
| `AP-27` | Resumable transfer идёт напрямую browser → Google Drive и не отправляет source bytes в Studio API, S3, Studio Source, FFmpeg, transcription или provider; используются только существующие Google OAuth scopes без expansion. |
| `AP-28` | UI показывает current-file и aggregate progress в bytes и процентах, текущую стадию и cancellation; automatic retry/replay отсутствует. |
| `AP-29` | File count, per-file/aggregate size и MIME имеют явные bounds; partial failures изолированы, а manual retry использует устойчивый idempotency marker и не дублирует уже подтверждённые uploads. |
| `AP-30` | API server-side проверяет owner destination и result metadata: file ID, parent, name, MIME, size и idempotency marker; UI показывает только safe Drive links, а token/resumable upload URL/private diagnostics не логируются и не сохраняются. |

### Эпик `PWA-SPEAKER-IDENTITY-01` — имена и роли спикеров

| AC | Проверяемое требование |
|---|---|
| `SP-01` | Есть owner-scoped база имён спикеров. |
| `SP-02` | Для speaker identity хранится роль. |
| `SP-03` | Пользователь может прослушать bounded voice fragment обнаруженного спикера. |
| `SP-04` | Пользователь явно связывает provider speaker label с выбранным именем. |
| `SP-05` | Подтверждённое имя/роль используется в transcript output и history metadata. |

### Эпик `PWA-MANIFEST-01` — duplicate protection и каталог

| AC | Проверяемое требование |
|---|---|
| `PM-01` | Accepted output evidence блокирует неявную повторную транскрибацию. |
| `PM-02` | Явный reprocess/bypass требует отдельного user confirmation. |
| `PM-03` | Пользователь может безопасно очистить owner-scoped manifest/catalog. |
| `PM-04` | Выбранная Google Drive folder tree регистрируется отдельным dry-run/apply flow. |
| `PM-05` | Манифест отдельно регистрирует подтверждённое сохранение распознавания и подтверждённое создание облачного документа; намерение экспорта не считается успехом. |
| `PM-06` | Duplicate identity использует Drive file ID/Studio source identity и settings, не filename alone. |

### Эпик `PWA-STANDARDIZATION-01` — стандартизация Google Docs

| AC | Проверяемое требование |
|---|---|
| `PD-01` | Есть отдельная быстрая selected-folder dry-run/apply operation. |
| `PD-02` | Folder mode обходит все вложенные подпапки в bounded tree. |
| `PD-03` | Документ нормализуется в читабельные абзацы. |
| `PD-04` | Документ получает standard metadata header. |
| `PD-05` | Timestamp нормализуется в ISO 8601. |
| `PD-06` | Timestamp отражает creation time исходного media file, а не Google Doc/job time. |
| `PD-07` | Canonical identifier текущего document standard — versionless `transcript_doc`; user-facing flow не предлагает выбор версии стандарта. |
| `PD-08` | Название документа в новых и стандартизированных transcripts оформлено Google Docs style `Heading 2`. |
| `PD-09` | Метка каждого блока спикера имеет русскую форму `Спикер N:`, bold и размер `14 pt`. |
| `PD-10` | Обычный текст транскрибации по умолчанию имеет размер `11 pt`. |
| `PD-11` | Пользовательские структурные labels документа русифицированы; устойчивые technical terms и metadata keys сохраняются на английском. |
| `PD-12` | Каждый новый Studio PWA transcript создаётся в текущем canonical формате `transcript_doc`. |
| `PD-13` | Existing eligible Google Docs приводятся к текущему `transcript_doc` через существующий explicit dry-run/apply standardization flow одной пользовательской операцией; historical version selection не требуется. |
| `PD-14` | Existing legacy Google Doc стандартируется без обязательной связи с исходным media file: валидный существующий `Created at` сохраняется, отсутствующий/невалидный не создаётся и не заменяется `unknown` или догадкой; подтверждённый source-date conflict остаётся blocker. |

### Эпик `PWA-TRANSCRIPT-MAINTENANCE-01` — workspace и durable execution обслуживания

| AC | Проверяемое требование |
|---|---|
| `PTM-01` | Стандартизация Google Docs и манифест находятся в «Транскрибации → Обслуживание»; Settings содержит connection/consent controls и ссылку на workspace. |
| `PTM-02` | Выбор root folder и одного native Google Doc использует app-owned Google Drive dialog с навигацией, bounded search, выбором текущей папки и блокировкой фонового scroll. |
| `PTM-03` | Dry-run и apply выполняются как durable owner-scoped background runs и восстанавливают состояние после navigation/reload, worker restart или истечения lease; длительный Google traversal не удерживает browser HTTP request. |
| `PTM-04` | UI показывает persisted stage, bounded progress и terminal result; Drive/document IDs, OAuth tokens, document contents и raw Google errors не возвращаются в browser DTO и не попадают в operational logs. |
| `PTM-05` | Apply создаётся только из успешного owner-scoped preview, наследует его exact workflow/target, выполняет fresh server-side revalidation и остаётся explicit user-confirmed operation. |
| `PTM-06` | Повтор запроса idempotent, conflicting replay fail-closed, а один owner не может одновременно запустить два runs одного workflow. |
| `PTM-07` | Timeout, rate limit, auth/scope, selection, revision/write conflict и exhausted retry возвращаются как structured safe error codes с понятным русским действием без raw backend detail. |
| `PTM-08` | Worker обрабатывает maintenance runs только после normal audio-preparation/transcription work; lease generation и heartbeat не позволяют потерявшему lease worker перезаписать reclaimed run. |
| `PTM-09` | Пока owner-scoped maintenance run имеет status `queued` или `running`, открытый workspace автоматически запрашивает fresh `no-store` state и обновляет progress до terminal status без reload, remount или переключения вкладки. |

### Эпик `PWA-REALTIME-01` — realtime-транскрибация

| AC | Проверяемое требование |
|---|---|
| `PR-01` | В Windows/Chrome выбирается вкладка, окно или экран. |
| `PR-02` | Захватывается передаваемый browser/system audio track. |
| `PR-03` | Микрофон включается опционально и смешивается с display audio. |
| `PR-04` | Partial и committed transcript отображаются live. |
| `PR-05` | Подтверждённый transcript скачивается как `.txt`. |
| `PR-06` | Representative microphone/display/mixed sessions стабильно проходят production LIVE canaries. |
| `PR-07` | Каждый committed fragment немедленно сохраняется в owner/browser-scoped local draft. |
| `PR-08` | Последний partial fragment сохраняется с bounded debounce и явно остаётся неподтверждённым. |
| `PR-09` | Live draft синхронизируется в owner-scoped server storage с encryption at rest, bounded size и idempotent monotonic revision. |
| `PR-10` | После refresh, browser crash или перезапуска компьютера пользователь получает явное предложение восстановить незавершённый draft. |
| `PR-11` | Найденный draft можно восстановить, скачать как `.txt` или удалить явным действием. |
| `PR-12` | Server Live draft имеет TTL 72 часа, исчезает из recovery после expiry и удаляется idempotent cleanup. |
| `PR-13` | Live draft не сохраняет audio и не включает transcript body в logs, diagnostics, audit events или ordinary History/Analytics. |

### Эпик `PWA-OPERABILITY-01` — diagnostics, history и analytics

| AC | Проверяемое требование |
|---|---|
| `PO-01` | Собираются safe backend diagnostics. |
| `PO-02` | Собираются safe frontend/PWA diagnostics. |
| `PO-03` | Диагностический summary отражает safe configuration state. |
| `PO-04` | Diagnostics экспортируются в Markdown. |
| `PO-05` | Diagnostics экспортируются в JSON. |
| `PO-06` | Diagnostics экспортируются в YAML. |
| `PO-07` | Diagnostics экспортируются в TOML. |
| `PO-08` | History показывает safe transcription metadata. |
| `PO-09` | Успешная history entry содержит safe Google Docs link. |
| `PO-10` | History можно очистить owner-scoped action. |
| `PO-11` | Очистка History требует подтверждения Да/Нет. |
| `PO-12` | Analytics показывает количество транскрибаций. |
| `PO-13` | Analytics показывает execution/stage durations. |
| `PO-14` | Analytics показывает provider/model. |
| `PO-15` | Analytics явно показывает success percentage. |
| `PO-16` | Analytics показывает дополнительные safe outcome/options metadata. |
| `PO-17` | Analytics можно очистить owner-scoped action. |
| `PO-18` | Очистка Analytics требует подтверждения Да/Нет. |

### Эпик `COLAB-LIFECYCLE-02` — замороженный lifecycle Colab

| AC | Проверяемое требование |
|---|---|
| `COLABL-01` | Новые PWA/commercial features не переносятся в Colab. |
| `COLABL-02` | После feature freeze Colab изменяется только через явно авторизованные bugfixes. |

### Эпик `PWA-SECURITY-HARDENING-02` — personal auth и security lifecycle

| AC | Проверяемое требование |
|---|---|
| `PWASEC-01` | Provider API keys шифруются at rest. |
| `PWASEC-02` | Google OAuth refresh tokens шифруются at rest. |
| `PWASEC-03` | Local passwords хранятся только как one-way password hash. |
| `PWASEC-04` | Upload policy ограничивает максимальный размер source file. |
| `PWASEC-05` | Batch/upload policy ограничивает максимальное число files. |
| `PWASEC-06` | Общая максимальная длительность одного исходника настраивается; значение по умолчанию — 12 часов (S051). |
| `PWASEC-07` | Пользователь может просмотреть active sessions. |
| `PWASEC-08` | Пользователь может отозвать одну выбранную active session. |
| `PWASEC-09` | Пользователь может отозвать все другие active sessions. |
| `PWASEC-10` | Critical actions требуют recent re-authentication. |
| `PWASEC-11` | Login защищён отдельным brute-force limit. |
| `PWASEC-12` | Password reset защищён отдельным brute-force limit. |
| `PWASEC-13` | TOTP verification защищена отдельным brute-force limit. |
| `PWASEC-14` | Personal TOTP остаётся optional, пока пользователь явно его не включил. |
| `PWASEC-15` | TOTP использует стандартный protocol и не привязан к одному authenticator app. |
| `PWASEC-16` | TOTP enrollment имеет проверяемую secret-confirmation boundary. |
| `PWASEC-17` | TOTP recovery определён и протестирован. |
| `PWASEC-18` | TOTP disable требует безопасной owner verification. |

### Эпик `GOOGLE-DRIVE-RELIABILITY-02` — Drive upload/token/preflight reliability

| AC | Проверяемое требование |
|---|---|
| `GOOGLE-01` | Upload обработанного media в Google Drive поддерживает resumable protocol. |
| `GOOGLE-02` | Invalid/revoked Google grant создаёт явное состояние reconnect. |
| `GOOGLE-03` | Disconnect удаляет сохранённый Google token material. |
| `GOOGLE-04` | Disconnect пытается выполнить provider-side token revocation, когда это поддерживается. |
| `GOOGLE-05` | До provider spend повторно проверяется доступность source. |
| `GOOGLE-06` | До provider spend повторно проверяется возможность записи в target folder. |

### Эпик `STORAGE-LIFECYCLE-02` — полный storage lifecycle

| AC | Проверяемое требование |
|---|---|
| `STORAG-01` | Все большие S3-compatible uploads поддерживают resumable или multipart protocol. |
| `STORAG-02` | Abandoned upload sessions периодически очищаются. |
| `STORAG-03` | Failed/request-scoped FFmpeg temporary files очищаются. |
| `STORAG-04` | Orphaned storage objects периодически reconciliate и очищаются. |
| `STORAG-05` | Cleanup удаляет obsolete object versions при включённом storage versioning. |
| `STORAG-06` | Original transcription sources имеют явную retention policy. |
| `STORAG-07` | Processed audio outputs имеют явную retention policy. |
| `STORAG-08` | Audio-processing reference files имеют явную retention policy. |
| `STORAG-09` | Transcription reference files имеют отдельную явную retention policy. |
| `STORAG-10` | Internal transcript data имеет явную retention policy. |
| `STORAG-11` | Temporary files имеют явную retention/TTL policy. |
| `STORAG-12` | History data имеет явную retention policy. |
| `STORAG-13` | Analytics data имеет явную retention policy. |
| `STORAG-14` | Diagnostic/log data имеет явную retention policy. |
| `STORAG-15` | Deletion считается завершённым только после подтверждения cleanup всеми internal stores. |
| `STORAG-16` | Audio-processing references и transcription references являются разными data classes. |
| `STORAG-17` | Audio-reference использует отдельный S3 bucket. |
| `STORAG-18` | Transcription-reference использует отдельный S3 bucket. |
| `STORAG-19` | Audio-reference bucket имеет независимые lifecycle rules. |
| `STORAG-20` | Transcription-reference bucket имеет независимые lifecycle rules. |
| `STORAG-21` | Два reference buckets имеют независимо ограниченные access permissions. |

### Эпик `STT-PROVIDER-ABSTRACTION-01` — provider-neutral STT contract

| AC | Проверяемое требование |
|---|---|
| `STTPRO-01` | Batch STT выполняется через provider-neutral interface. |
| `STTPRO-02` | Realtime STT выполняется через provider-neutral interface. |
| `STTPRO-03` | Provider capability metadata фиксирует supported operating modes. |
| `STTPRO-04` | Provider capability metadata фиксирует supported languages. |
| `STTPRO-05` | Provider capability metadata фиксирует diarization support. |
| `STTPRO-06` | Provider capability metadata фиксирует dictionary support. |
| `STTPRO-07` | Provider capability metadata фиксирует file constraints. |
| `STTPRO-08` | User-facing economic mode маппится на configured provider capability. |
| `STTPRO-09` | User-facing standard mode маппится на configured provider capability. |
| `STTPRO-10` | User-facing premium mode маппится на configured provider capability. |
| `STTPRO-11` | User-facing realtime mode маппится на configured provider capability. |
| `STTPRO-12` | Provider/mode health может остановить новый dispatch после массовых failures. |
| `STTPRO-13` | Automatic cross-provider fallback не выполняется. |
| `STTPRO-14` | BYOK eligibility конфигурируется отдельно для каждого provider. |

### Эпик `YANDEX-STT-01` — Yandex SpeechKit provider

| AC | Проверяемое требование |
|---|---|
| `YANDEX-01` | Yandex SpeechKit поддерживает обычную batch transcription. |
| `YANDEX-02` | Yandex SpeechKit поддерживает deferred transcription. |
| `YANDEX-03` | Yandex SpeechKit поддерживает realtime transcription. |
| `YANDEX-04` | Deferred Yandex jobs сохраняют provider operation ID. |
| `YANDEX-05` | Deferred Yandex jobs poll и сохраняют terminal provider result. |

### Эпик `PWA-DICTIONARIES-01` — пользовательские словари

| AC | Проверяемое требование |
|---|---|
| `PWADIC-01` | Owner-scoped dictionaries поддерживают terms, surnames, names и abbreviations для улучшения STT. |

### Эпик `PWA-WORKER-ISOLATION-02` — worker resource и privilege boundary

| AC | Проверяемое требование |
|---|---|
| `PWAWOR-01` | Media/FFmpeg worker работает как component, отделённый от API process. |
| `PWAWOR-02` | Media/FFmpeg worker имеет явные CPU/memory/process resource bounds. |
| `PWAWOR-03` | Media/FFmpeg worker имеет минимально необходимые filesystem/network/database privileges. |

### Эпик `PWA-DATABASE-LEAST-PRIVILEGE-03` — отдельные PostgreSQL owner, migrator и runtime roles

| AC | Проверяемое требование |
|---|---|
| `DBLP-01` | Running API использует отдельную login role без `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION`, `BYPASSRLS`, schema ownership или DDL privileges. |
| `DBLP-02` | Protected migrations используют отдельную migrator login role, не доступную API/worker и ограниченную одной Studio database/schema ownership boundary. |
| `DBLP-03` | Schema/tables/sequences принадлежат отдельной `NOLOGIN` owner role; bootstrap/admin login не является ordinary runtime owner. |
| `DBLP-04` | API, worker, migrator и bootstrap credentials хранятся в разных root-owned secret files; bootstrap credential не монтируется в API/worker containers. |
| `DBLP-05` | Reviewed API/worker direct-grant manifests сначала revoke broad access/memberships, затем выдают минимальные table/sequence grants; public schema CREATE и implicit grants запрещены. |
| `DBLP-06` | Default privileges и protected migration flow fail closed re-apply/verify API/worker grants после additive schema change до component recreation. |
| `DBLP-07` | Clean initialization и upgrade проверяют positive/negative role matrix, schema ownership, Alembic current/head, API/worker readiness и отсутствие privilege escalation. |
| `DBLP-08` | Production switch имеет verified pre-change backup, staged credential/role preflight, bounded API smoke и explicit compatible rollback/recovery без возврата bootstrap/superuser credential в runtime. |

### Эпик `JOB-RELIABILITY-02` — durable batch execution contract

| AC | Проверяемое требование |
|---|---|
| `JOBREL-01` | Transcription jobs используют durable queue. |
| `JOBREL-02` | Каждая job сохраняет явное processing-stage state. |
| `JOBREL-03` | Каждая job сохраняет last safe checkpoint. |
| `JOBREL-04` | Interrupted jobs восстанавливаются после backend/worker restart. |
| `JOBREL-05` | Автоматически повторяются только доказуемо безопасные transient failures. |
| `JOBREL-06` | Retry/recovery не дублирует provider operations. |
| `JOBREL-07` | Retry/recovery не дублирует Google Docs outputs. |
| `JOBREL-08` | Retry/recovery не дублирует storage files. |
| `JOBREL-09` | Retry/recovery не дублирует notifications. |
| `JOBREL-10` | Critical job/queue/service events имеют guaranteed-delivery mechanism. |
| `JOBREL-11` | Queued transcription можно отменить. |
| `JOBREL-12` | Для running transcription можно запросить cancel; она останавливается на safe boundaries. |
| `JOBREL-13` | Server job продолжается после закрытия PWA пользователем. |
| `JOBREL-14` | UI показывает текущую processing stage. |
| `JOBREL-15` | Source availability проверяется до provider dispatch. |
| `JOBREL-16` | Target write readiness проверяется до provider dispatch. |
| `JOBREL-17` | После immutable authoritative snapshot долгие source availability/materialization и media preparation операции не удерживают idle worker DB transaction; после I/O выполняется fresh fail-closed lifecycle/source/credential/output revalidation до любого provider call. |

### Эпик `JOB-NOTIFICATIONS-01` — уведомления о завершении/error

| AC | Проверяемое требование |
|---|---|
| `JOBNOT-01` | Web Push уведомляет об успешном завершении. |
| `JOBNOT-02` | Web Push уведомляет о terminal error. |
| `JOBNOT-03` | Email уведомляет об успешном завершении. |
| `JOBNOT-04` | Email уведомляет о terminal error. |
| `JOBNOT-05` | Telegram может уведомлять об успешном завершении. |
| `JOBNOT-06` | Telegram может уведомлять о terminal error. |

### Эпик `REALTIME-CONTINUITY-02` — expanded realtime consumers

| AC | Проверяемое требование |
|---|---|
| `REALTI-01` | Capture-source loss и STT-connection loss отображаются как разные user-visible errors. |
| `REALTI-02` | Realtime subtitles доступны через отдельный browser/OBS overlay. |
| `REALTI-03` | Realtime subtitles могут передаваться в YouTube Live. |
| `REALTI-04` | Realtime subtitles могут передаваться другому явно поддержанному external consumer. |
| `REALTI-05` | Failure одного external realtime consumer не останавливает primary session. |

### Эпик `TRANSCRIPT-EXPORTS-02` — дополнительные export formats

| AC | Проверяемое требование |
|---|---|
| `TRANSC-01` | Confirmed transcript экспортируется как Markdown. |
| `TRANSC-02` | Confirmed timed transcript экспортируется как SRT. |
| `TRANSC-03` | Confirmed timed transcript экспортируется как VTT. |

### Эпик `USAGE-COST-ACCOUNTING-01` — personal usage/cost evidence

| AC | Проверяемое требование |
|---|---|
| `USAGEC-01` | Каждая transcription job хранит подтверждённую длительность audio, фактически отправленную provider; uncertain outcome не выдаётся за exact billed usage. |
| `USAGEC-02` | Каждая transcription job хранит nominal attributable cost как `confirmed duration × immutable public tariff snapshot`, currency и provenance; этот расчёт явно не выдаётся за invoice debit после подписки или квоты. |
| `USAGEC-03` | Для каждого активного ElevenLabs credential Studio server-side получает из official account API tier/status, period usage/limit, reset, usage-based billing entitlement/cap, current overage и open/next invoice без передачи API key в браузер. |
| `USAGEC-04` | Studio получает из official workspace analytics API credit usage по продуктам за применимый billing/rolling period, сохраняет нормализованный bounded snapshot и не преобразует credits в минуты без provider Evidence. |
| `USAGEC-05` | Owner UI раздельно показывает job-level nominal cost и provider account actuals, включая provider-reported remaining period units, overage и invoice amounts; unavailable или semantically incomparable данные не подменяются расчётной цифрой. |
| `USAGEC-06` | Account snapshot имеет видимые `fetched_at`, period/window provenance и current/stale/unavailable state; при открытом экране выполняется bounded refresh, ручное обновление доступно, а provider error сохраняет последний успешный snapshot только как stale. |

### Эпик `OBSERVABILITY-AUDIT-02` — health, tracing, alerts и protected audit

| AC | Проверяемое требование |
|---|---|
| `OBSERV-01` | `job_id` проходит через весь batch pipeline. |
| `OBSERV-02` | `request_id` проходит через request-to-job boundary. |
| `OBSERV-03` | `trace_id` проходит через весь cross-service pipeline. |
| `OBSERV-04` | Admin health показывает backend status. |
| `OBSERV-05` | Admin health показывает PostgreSQL status. |
| `OBSERV-06` | Admin health показывает queue status. |
| `OBSERV-07` | Admin health показывает worker status. |
| `OBSERV-08` | Admin health показывает S3 status. |
| `OBSERV-09` | Admin health показывает STT provider status. |
| `OBSERV-10` | Admin health показывает email status. |
| `OBSERV-11` | Backend предоставляет отдельный liveness probe. |
| `OBSERV-12` | Backend предоставляет отдельный readiness probe. |
| `OBSERV-13` | Worker предоставляет отдельный liveness probe. |
| `OBSERV-14` | Worker предоставляет отдельный readiness probe. |
| `OBSERV-15` | Critical-error alerts отправляются. |
| `OBSERV-16` | Stuck-queue alerts отправляются. |
| `OBSERV-17` | Provider-unavailability alerts отправляются. |
| `OBSERV-18` | Backup/cleanup failure alerts отправляются. |
| `OBSERV-19` | Alerts отправляются при приближении к storage/API limits. |
| `OBSERV-20` | Secrets исключены из logs и diagnostics. |
| `OBSERV-21` | User data по умолчанию минимизированы в logs и diagnostics. |
| `OBSERV-22` | Diagnostics показывают release version. |
| `OBSERV-23` | Diagnostics показывают environment. |
| `OBSERV-24` | Diagnostics показывают web build identity. |
| `OBSERV-25` | Diagnostics показывают API build identity. |
| `OBSERV-26` | Diagnostics показывают worker build identity. |
| `OBSERV-27` | Diagnostics показывают exact commit identity. |
| `OBSERV-28` | Diagnostics показывают exact DB schema revision. |
| `OBSERV-29` | Audit record идентифицирует actor. |
| `OBSERV-30` | Audit record идентифицирует время действия. |
| `OBSERV-31` | Audit record идентифицирует action. |
| `OBSERV-32` | Audit record идентифицирует operation outcome. |
| `OBSERV-33` | Ordinary application flows не могут изменять прошлые audit records. |
| `OBSERV-34` | Ordinary application flows не могут удалять audit records. |
| `OBSERV-35` | Очистка History/Analytics не удаляет audit records. |

### Эпик `RELEASE-SAFETY-02` — personal release safety

| AC | Проверяемое требование |
|---|---|
| `RELEAS-01` | Все PostgreSQL schema changes используют versioned migrations. |
| `RELEAS-02` | Personal production имеет tested rollback procedure. |
| `RELEAS-03` | Deployment валидирует required environment configuration. |
| `RELEAS-04` | Deployment валидирует required secrets без раскрытия values. |
| `RELEAS-05` | Deployment fail-closed при отсутствии critical settings. |

### Эпик `ENVIRONMENT-CAPABILITIES-01` — единый codebase и изолированные contours

| AC | Проверяемое требование |
|---|---|
| `EVC-01` | Personal и commercial используют единый основной codebase. |
| `EVC-02` | Personal и commercial используют единый `main`. |
| `EVC-03` | Commercial не поддерживается как постоянно расходящаяся branch. |
| `EVC-04` | Personal и commercial разворачиваются как отдельные environments. |
| `EVC-05` | Personal и commercial имеют отдельные configs. |
| `EVC-06` | Personal и commercial имеют отдельные secrets. |
| `EVC-07` | Personal и commercial имеют отдельные databases. |
| `EVC-08` | Personal и commercial имеют отдельные S3 resources. |
| `EVC-09` | Personal и commercial имеют отдельные API keys. |
| `EVC-10` | Personal и commercial имеют отдельные OAuth credentials. |
| `EVC-11` | Personal и commercial имеют отдельные domains. |
| `EVC-12` | Остальные environment-specific settings разделены по contour. |
| `EVC-13` | Personal включает все approved commercial capabilities. |
| `EVC-14` | Personal может включать дополнительные foreign/experimental/admin capabilities. |
| `EVC-15` | Commercial изолирован инфраструктурно, а не только frontend visibility. |
| `EVC-16` | Credentials неиспользуемого commercial provider отсутствуют в commercial environment. |
| `EVC-17` | Contour differences задаются configuration. |
| `EVC-18` | Contour differences задаются capability model. |
| `EVC-19` | Contour differences задаются bounded feature flags. |
| `EVC-20` | Contour differences задаются подключаемыми modules/providers. |
| `EVC-21` | Contour differences не размазаны множеством ad-hoc conditionals. |
| `EVC-22` | Personal и commercial деплоятся независимо. |
| `EVC-23` | Personal UI имеет режим `только commercial capabilities`. |
| `EVC-24` | Personal UI имеет режим `только personal-only capabilities`. |
| `EVC-25` | Personal UI имеет режим `все capabilities`. |
| `EVC-26` | Personal UI capability mode не меняет backend. |
| `EVC-27` | Personal UI capability mode не меняет environment. |
| `EVC-28` | Personal UI capability mode не меняет database. |
| `EVC-29` | Personal UI capability mode не меняет S3/storage. |
| `EVC-30` | Personal UI capability mode не меняет STT credentials. |
| `EVC-31` | Commercial-view mode в personal воспроизводит approved commercial UX/UI. |
| `EVC-32` | Personal и commercial имеют независимый rollback. |
| `EVC-33` | STT provider заменяется через bounded interface. |
| `EVC-34` | S3/storage provider заменяется через bounded interface. |
| `EVC-35` | Authorization provider заменяется через bounded interface. |
| `EVC-36` | Notification provider заменяется через bounded interface. |
| `EVC-37` | Core entities поддерживают `user_id`/`tenant_id` ownership. |
| `EVC-38` | Personal admin auth не блокирует future user roles/access control. |
| `EVC-39` | STT provider implementations являются отдельными modules. |
| `EVC-40` | Storage implementations являются отдельными modules. |
| `EVC-41` | Authorization implementations являются отдельными modules. |
| `EVC-42` | Notification implementations являются отдельными modules. |
| `EVC-43` | Другие external integrations являются capability-scoped modules. |
| `EVC-44` | Audio processing boundary заменяема независимо. |
| `EVC-45` | Transcription boundary заменяема независимо. |
| `EVC-46` | Google Drive boundary заменяема независимо. |
| `EVC-47` | File-storage boundary заменяема независимо. |
| `EVC-48` | Document-creation boundary заменяема независимо. |
| `EVC-49` | Unused integration code не делает capability доступной в commercial. |
| `EVC-50` | Российские и иностранные providers используют общий interface, когда capabilities совместимы. |

### Эпик `COMMERCIAL-INFRA-DATA-01` — infrastructure и localization

| AC | Проверяемое требование |
|---|---|
| `CINF-01` | Основной commercial production backend размещается на российской инфраструктуре, пригодной для обработки данных российских пользователей. |
| `CINF-02` | Основная PostgreSQL database размещается на территории РФ. |
| `CINF-03` | Commercial S3 использует S3-compatible storage российского provider вместо Cloudflare R2. |
| `CINF-04` | PostgreSQL backups соблюдают localization requirements. |
| `CINF-05` | Backups пользовательских данных соблюдают localization requirements. |
| `CINF-06` | Temporary FFmpeg files хранятся на российской инфраструктуре. |
| `CINF-07` | Intermediate processing results хранятся на российской инфраструктуре. |
| `CINF-08` | Logs, analytics и diagnostics не отправляют персональные данные в зарубежные services без контроля. |
| `CINF-09` | Cloudflare и другие foreign infrastructure services проверяются по фактическому data flow. |
| `CINF-10` | Commercial использует отдельный PostgreSQL. |
| `CINF-11` | Commercial использует отдельное S3 storage. |
| `CINF-12` | Commercial использует отдельные secrets. |
| `CINF-13` | Commercial использует отдельные API keys. |
| `CINF-14` | Commercial использует отдельные OAuth credentials. |
| `CINF-15` | Остальные production resources commercial изолированы от personal. |
| `CINF-16` | Для PostgreSQL утверждён RPO. |
| `CINF-17` | Для PostgreSQL утверждён RTO. |
| `CINF-18` | Point-in-time restore реализован и проверен. |
| `CINF-19` | Реальное восстановление данных из backup регулярно проверяется. |
| `CINF-20` | Удалённые пользователем данные не возвращаются в production после restore старого backup. |

### Эпик `COMMERCIAL-IDENTITY-01` — registration, auth и TOTP

| AC | Проверяемое требование |
|---|---|
| `CID-01` | Основной способ registration/auth пользователей — email + password. |
| `CID-02` | Registration допускает Gmail и другие foreign email addresses. |
| `CID-03` | Foreign email не интерпретируется как Google OAuth login. |
| `CID-04` | После registration email подтверждается. |
| `CID-05` | Password reset использует one-time token. |
| `CID-06` | Password reset token имеет ограниченный lifetime. |
| `CID-07` | Password reset не раскрывает existence account и fail-closed обрабатывает повтор. |
| `CID-08` | System emails отправляет transactional email provider. |
| `CID-09` | Transactional email использует собственный domain. |
| `CID-10` | Google OAuth не используется для registration/auth в российском commercial production. |
| `CID-11` | Yandex ID доступен как optional OAuth provider. |
| `CID-12` | VK ID доступен как optional OAuth provider. |
| `CID-13` | Google OAuth не предоставляется как commercial login; Google Drive является personal integration, commercial использует Яндекс Диск. |
| `CID-14` | Любое будущее включение Google Drive в commercial требует отдельного explicit product decision и applicable legal gate; наличие personal OAuth кода не включает его автоматически. |
| `CID-15` | Доступна optional TOTP 2FA. |
| `CID-16` | TOTP совместим с разными standard authenticator apps. |
| `CID-17` | Определён безопасный account recovery. |
| `CID-18` | Определён безопасный second-factor reset. |

### Эпик `COMMERCIAL-DATA-GOVERNANCE-01` — персональные данные

| AC | Проверяемое требование |
|---|---|
| `CDG-01` | Первичная запись персональных данных выполняется в РФ. |
| `CDG-02` | Систематизация персональных данных выполняется в РФ. |
| `CDG-03` | Накопление персональных данных выполняется в РФ. |
| `CDG-04` | Хранение персональных данных выполняется в РФ. |
| `CDG-05` | Изменение персональных данных выполняется в РФ. |
| `CDG-06` | Извлечение персональных данных выполняется в РФ. |
| `CDG-07` | Определён полный перечень персональных данных сервиса. |
| `CDG-08` | Определены data rules для audio recordings. |
| `CDG-09` | Определены data rules для transcripts. |
| `CDG-10` | Определены data rules для speaker voices. |
| `CDG-11` | Определены data rules для email. |
| `CDG-12` | Определены data rules для IP addresses. |
| `CDG-13` | Определены data rules для OAuth tokens. |
| `CDG-14` | Определены data rules для diagnostic data. |
| `CDG-15` | Для каждого data type определена processing purpose. |
| `CDG-16` | Для каждого data type определено legal basis. |
| `CDG-17` | Для каждого data type определён retention period. |
| `CDG-18` | Данные удаляются после истечения retention period. |
| `CDG-19` | Данные удаляются по подтверждённому user request. |
| `CDG-20` | Пользователь может удалить account. |
| `CDG-21` | Account deletion очищает связанные user data. |
| `CDG-22` | Account deletion очищает сохранённые OAuth tokens. |
| `CDG-23` | Подготовлена policy обработки персональных данных. |
| `CDG-24` | Подготовлено user agreement и/или public offer. |
| `CDG-25` | Подготовлены необходимые consents на обработку персональных данных. |
| `CDG-26` | Проверена необходимость уведомления Роскомнадзора как operator персональных данных. |

### Эпик `COMMERCIAL-CROSS-BORDER-01` — foreign services и legal gates

| AC | Проверяемое требование |
|---|---|
| `CXB-01` | Для каждого foreign service определён передаваемый набор user data. |
| `CXB-02` | Foreign STT provider проверен по законодательству РФ. |
| `CXB-03` | Foreign STT provider проверен по своим terms of use. |
| `CXB-04` | Cross-border data transfer foreign STT provider отдельно проверен. |
| `CXB-05` | Российский STT provider является полноценным production вариантом. |
| `CXB-06` | Commercial production не зависит от ElevenLabs или другого foreign STT provider. |
| `CXB-07` | ElevenLabs может быть включён только как additional provider. |
| `CXB-08` | Использование ElevenLabs в commercial разрешено отдельным legal opinion. |
| `CXB-09` | Техническая возможность foreign provider не считается legal permission для commercial. |
| `CXB-10` | Production не зависит полностью от одного foreign AI provider. |
| `CXB-11` | STT architecture позволяет отключить/заменить provider без переделки всей системы. |
| `CXB-12` | Google Drive является external user integration. |
| `CXB-13` | Google Drive не является primary internal storage сервиса. |
| `CXB-14` | Google Drive OAuth отделён от OAuth login в сам сервис. |

### Эпик `COMMERCIAL-STT-QUOTA-01` — provider tariffs, quotas и dispatch

| AC | Проверяемое требование |
|---|---|
| `CSQ-01` | Для каждого STT provider хранится applicable tariff. |
| `CSQ-02` | Для каждого STT provider хранится transcription cost. |
| `CSQ-03` | Для каждой job учитываются фактически использованные minutes/hours. |
| `CSQ-04` | Пользователи имеют monthly quotas. |
| `CSQ-05` | User quota проверяется до job. |
| `CSQ-06` | Global quota проверяется до job. |
| `CSQ-07` | Expected job spend резервируется на время выполнения. |
| `CSQ-08` | Parallel jobs не могут потратить один и тот же quota balance. |
| `CSQ-09` | Global API spend limits предотвращают accidental/malicious balance exhaustion. |
| `CSQ-10` | Пользователь выбирает понятный режим по price/capabilities. |
| `CSQ-11` | Конкретный STT provider скрыт из обычного commercial UX. |
| `CSQ-12` | Отдельный STT provider можно аварийно отключить. |
| `CSQ-13` | При provider outage связанный mode временно блокируется. |
| `CSQ-14` | Job не переключается автоматически на другой provider. |
| `CSQ-15` | BYOK доступен только при technical compatibility provider. |
| `CSQ-16` | BYOK доступен только после legal permission provider. |

### Эпик `COMMERCIAL-SPEAKER-PRIVACY-01` — diarization без biometrics

| AC | Проверяемое требование |
|---|---|
| `CSP-01` | Commercial показывает обычные diarization labels `Speaker 1`, `Speaker 2`. |
| `CSP-02` | Commercial не выполняет automatic voice-reference/voiceprint identification. |
| `CSP-03` | Voice identification не добавляется до отдельной legal проработки biometric personal data. |

### Эпик `COMMERCIAL-QUEUE-FAIRNESS-01` — fair resource allocation

| AC | Проверяемое требование |
|---|---|
| `CQF-01` | Ограничены concurrently running jobs пользователя/тарифа. |
| `CQF-02` | Ограничены queued jobs пользователя/тарифа. |
| `CQF-03` | Ограничены concurrently running jobs всей системы. |
| `CQF-04` | Ограничены queued jobs всей системы. |
| `CQF-05` | Один пользователь не может занять всю queue. |
| `CQF-06` | Один пользователь не может занять все worker resources. |

### Эпик `COMMERCIAL-BILLING-01` — payments, subscriptions и fiscalization

| AC | Проверяемое требование |
|---|---|
| `CBI-01` | Определена legal form коммерческой деятельности, например ИП. |
| `CBI-02` | Выбран российский payment provider. |
| `CBI-03` | Payment provider поддерживает recurring payments. |
| `CBI-04` | Payments fiscalized. |
| `CBI-05` | Пользователю отправляется receipt. |
| `CBI-06` | Определены tariffs. |
| `CBI-07` | Реализованы subscriptions. |
| `CBI-08` | Реализованы quota по tariffs. |
| `CBI-09` | Реализована purchase дополнительных hours. |
| `CBI-10` | Ведётся internal payment accounting. |
| `CBI-11` | Ведётся internal accounting оказанных услуг. |
| `CBI-12` | Billing/usage accounting отделён от ordinary analytics. |
| `CBI-13` | Очистка ordinary analytics не удаляет billing/usage accounting. |
| `CBI-14` | Job хранит immutable tariff snapshot. |
| `CBI-15` | Job хранит immutable mode snapshot. |
| `CBI-16` | Job хранит immutable calculation-rules snapshot. |
| `CBI-17` | Payment/subscription state восстанавливается после missed webhook. |
| `CBI-18` | Repeated webhook обрабатывается idempotently. |
| `CBI-19` | Repeated provider event не создаёт double charge. |
| `CBI-20` | Repeated provider event не начисляет quota дважды. |
| `CBI-21` | Repeated provider event не продлевает subscription дважды. |
| `CBI-22` | Subscription cancellation обрабатывается корректно. |
| `CBI-23` | Payment refund обрабатывается корректно. |
| `CBI-24` | Failed recurring charge обрабатывается корректно. |
| `CBI-25` | Admin видит tariffs. |
| `CBI-26` | Admin видит payments. |
| `CBI-27` | Admin видит API spend. |

### Эпик `COMMERCIAL-ECONOMICS-01` — unit economics

| AC | Проверяемое требование |
|---|---|
| `CEC-01` | Для каждой job собирается STT cost. |
| `CEC-02` | Собирается storage cost. |
| `CEC-03` | Собирается compute cost. |
| `CEC-04` | Собирается network traffic cost. |
| `CEC-05` | Учитывается payment-provider commission. |
| `CEC-06` | Учитывается fiscalization cost. |
| `CEC-07` | Учитываются taxes. |
| `CEC-08` | Учитываются другие mandatory business expenses. |
| `CEC-09` | Рассчитывается cost per transcription hour для каждого provider/mode. |
| `CEC-10` | Рассчитывается average cost одного active user. |
| `CEC-11` | Рассчитывается ARPU. |
| `CEC-12` | Рассчитывается contribution margin. |
| `CEC-13` | Рассчитывается retention. |
| `CEC-14` | Рассчитывается LTV. |
| `CEC-15` | До advertising launch определён maximum allowed acquisition cost. |

### Эпик `COMMERCIAL-SECURITY-01` — least privilege, tenancy и backups

| AC | Проверяемое требование |
|---|---|
| `CSEC-01` | Все STT provider API keys хранятся только на backend. |
| `CSEC-02` | API keys шифруются at rest. |
| `CSEC-03` | OAuth refresh tokens шифруются at rest. |
| `CSEC-04` | Другие application secrets шифруются at rest. |
| `CSEC-05` | Encryption keys хранятся отдельно от primary database. |
| `CSEC-06` | Database не доступна напрямую из internet. |
| `CSEC-07` | Production app не подключается к database как superuser. |
| `CSEC-08` | Все user data разделены по `user_id` или `tenant_id`. |
| `CSEC-09` | File access проверяется по current user/tenant. |
| `CSEC-10` | Job access проверяется по current user/tenant. |
| `CSEC-11` | Transcription access проверяется по current user/tenant. |
| `CSEC-12` | Integration access проверяется по current user/tenant. |
| `CSEC-13` | Основные user-owned tables используют PostgreSQL RLS как дополнительную isolation layer. |
| `CSEC-14` | Critical actions записываются в audit log. |
| `CSEC-15` | User/API rate limits включены. |
| `CSEC-16` | Concurrent running jobs ограничены. |
| `CSEC-17` | Media/FFmpeg workers отделены от API. |
| `CSEC-18` | Media/FFmpeg workers имеют minimum required privileges. |
| `CSEC-19` | Database backup выполняется регулярно. |
| `CSEC-20` | Database restore регулярно проверяется. |
| `CSEC-21` | Credentials personal и commercial production никогда не переиспользуются между contours. |

### Эпик `COMMERCIAL-NOTIFICATIONS-01` — replaceable notification providers

| AC | Проверяемое требование |
|---|---|
| `CNOT-01` | Для transactional email выбран российский provider. |
| `CNOT-02` | Для system notifications выбран российский provider. |
| `CNOT-03` | Для external notification services определён передаваемый набор personal data. |
| `CNOT-04` | Web Push реализован отдельным module. |
| `CNOT-05` | Email реализован отдельным module. |
| `CNOT-06` | Messenger notifications реализованы отдельным module. |
| `CNOT-07` | Notification provider можно заменить. |
| `CNOT-08` | Notification provider можно отключить. |

### Эпик `COMMERCIAL-LEGAL-01` — launch legal readiness

| AC | Проверяемое требование |
|---|---|
| `CLEG-01` | До public commercial launch проведена legal review фактического user-data flow. |
| `CLEG-02` | Personal-data policy соответствует фактическому backend behavior. |
| `CLEG-03` | Cross-border transfer через Google Drive проверен отдельно. |
| `CLEG-04` | Cross-border transfer для каждого foreign STT provider проверен отдельно. |
| `CLEG-05` | Допустимость ElevenLabs проверена отдельно. |
| `CLEG-06` | Допустимость каждой другой foreign integration проверена отдельно. |
| `CLEG-07` | Подготовлено user agreement/public offer. |
| `CLEG-08` | Подготовлена personal-data processing policy. |
| `CLEG-09` | Подготовлены необходимые consents. |
| `CLEG-10` | Определён retention audio recordings. |
| `CLEG-11` | Определено deletion audio recordings. |
| `CLEG-12` | Определён retention transcripts. |
| `CLEG-13` | Определено deletion transcripts. |
| `CLEG-14` | Пользователь подтверждает право загружать и обрабатывать передаваемые audio recordings. |
| `CLEG-15` | Пользователь может отозвать consents. |
| `CLEG-16` | Пользователь может отключить external integrations. |
| `CLEG-17` | При отключении integration связанные tokens удаляются. |
| `CLEG-18` | Перед production launch актуальные legal requirements проверяются повторно. |

### Эпик `RESULTS-STUDIO-02` — Результат в Studio и независимый экспорт

| AC | Проверяемое требование |
|---|---|
| `RS-01` | Dropdown результата открывает owner-scoped просмотр текста с абзацами, спикерами и metadata. Основание: S120,S121. |
| `RS-02` | Dropdown результата скачивает оформленный DOCX по стандарту transcript_doc. Основание: S120,S126. |
| `RS-03` | Dropdown результата позволяет явно удалить сохранённую внутреннюю копию. Основание: S120,S156. |
| `RS-04` | Device batch работает без облачного подключения и без целевой облачной папки. Основание: S031,S032,S122. |
| `RS-05` | Распознавание и экспорт имеют раздельные сохраняемые состояния. Основание: S123. |
| `RS-06` | Подтверждённая транскрипция сохраняется до облачного экспорта и переживает его ошибку. Основание: S124. |
| `RS-07` | Сохранённый результат можно повторно скачать без нового STT вызова. Основание: S125. |
| `RS-08` | Сохранённый результат можно повторно экспортировать без нового STT вызова. Основание: S043,S125. |
| `RS-09` | Подтверждённый batch transcript скачивается как TXT. Основание: S126. |
| `RS-10` | Экспортированные таймкоды привязаны к той версии аудио, которая распознавалась. Основание: S128. |
| `RS-11` | Если временных данных нет, SRT/VTT недоступны с понятным объяснением. Основание: S129. |
| `RS-12` | Манифест различает сохранённое распознавание и облачный экспорт; потеря облачного файла не требует нового STT. Основание: S138,S141. |
| `RS-13` | Манифест можно сохранить в выбранную пользователем папку. Основание: S140. |
| `RS-14` | Полная сохранённая транскрипция размещается во внутреннем S3 своего окружения. Основание: S152. |
| `RS-15` | Для сохранённой транскрипции выбирается общий срок 3, 7 или 30 дней и видна дата удаления. Основание: S153,S154. |
| `RS-16` | Expired transcript недоступен для просмотра и скачивания, включая старые ссылки. Основание: S155,S169. |
| `RS-17` | Удаление внутреннего результата подтверждается фактическим cleanup и не удаляет пользовательский облачный экспорт. Основание: S159,S165. |

### Эпик `YANDEX-DISK-01` — Яндекс Диск в personal и commercial

| AC | Проверяемое требование |
|---|---|
| `YD-01` | Яндекс Диск подключается отдельно от входа в Studio в каждом разрешённом окружении. Основание: S007,S041. |
| `YD-02` | На Яндекс Диске выбираются один или несколько исходников. Основание: S025,S027,S041. |
| `YD-03` | На Яндекс Диске выбирается текущая папка исходников, включая пустую. Основание: S025,S027,S041. |
| `YD-04` | Выбор целевой папки Яндекс Диска имеет folder-only search, loading/empty/error states. Основание: S028,S029,S041. |
| `YD-05` | Транскрипция экспортируется в выбранную папку Яндекс Диска как оформленный DOCX. Основание: S041,S042. |
| `YD-06` | Подготовленное аудио сохраняется в выбранную папку Яндекс Диска. Основание: S041. |
| `YD-07` | Повторный экспорт revalidate-ит версию и не перезаписывает изменённый пользователем файл незаметно. Основание: S044. |
| `YD-08` | Истёкший или отозванный доступ требует восстановления; отключение удаляет токены и пытается отозвать grant. Основание: S034,S035. |
| `YD-09` | Quota/access/destination failure Яндекс Диска сохраняет результат Studio и допускает повторный экспорт. Основание: S043. |

### Эпик `REALTIME-RECOVERY-03` — Непрерывность и запись realtime

| AC | Проверяемое требование |
|---|---|
| `RTC-01` | Переподключения и внутренние части потока сохраняют одну пользовательскую сессию. Основание: S109. |
| `RTC-02` | После краткого обрыва автоматически запрашивается новый разрешённый transport capability и восстанавливается соединение. Основание: S110. |
| `RTC-03` | Доступный непереданный аудиобуфер передаётся после восстановления с deduplication результата. Основание: S110. |
| `RTC-04` | Невосстановимый или незахваченный интервал явно отображается как разрыв. Основание: S111. |
| `RTC-05` | По явному выбору пользователя записывается и сохраняется полное аудио realtime-сессии. Основание: S113. |
| `RTC-06` | Сессия сохраняет итоговую транскрипцию с исправлениями провайдера по идентичности сегмента. Основание: S113,S115. |
| `RTC-07` | Итог realtime защищён от reload и подчиняется выбранной политике хранения результата. Основание: S114,S153. |
| `RTC-08` | Дополнительная платная обработка записи требует явного пользовательского запуска. Основание: S116. |

### Эпик `PWA-REQUIREMENTS-05` — Уточнения пользовательских сценариев

| AC | Проверяемое требование |
|---|---|
| `UXN-01` | В навигации присутствует отдельный раздел «Проекты» наряду с «Транскрибациями». Основание: S014. |
| `UXN-02` | Пользователь выбирает шаблон имени с известными датой, временем, проектом и названием; отсутствующие значения не придумываются. Основание: S060. |
| `UXN-03` | До постановки fragment jobs проверяется выход интервалов за известную длительность исходника. Основание: S064. |
| `UXN-04` | Preflight каждого фрагмента показывает разрешённое назначение «только Studio». Основание: S067. |
| `UXN-05` | После изменения длительности подготовкой UI явно указывает версию аудио для интервалов и таймкодов. Основание: S068. |
| `UXN-06` | Новый документ при неизвестной дате записи полностью пропускает поле даты. Основание: S135. |
| `UXN-07` | Документ фрагмента или склейки сохраняет проверяемую связь с исходниками и преобразованиями. Основание: S136. |
| `UXN-09` | Diagnostics позволяет выбрать недавнюю операцию или найти её без знания exact ID и без чувствительности к регистру. Основание: S250. |

### Эпик `MEDIA-CONTRACT-03` — Полнота проверки и распознавания

| AC | Проверяемое требование |
|---|---|
| `MC-01` | До первого STT вызова исходник проходит проверку реального container/codec, длительности и целостности. Основание: S049. |
| `MC-03` | Для исходника свыше 4 и до 12 часов до затратного запуска видны оценка расхода и отдельное подтверждение. Основание: S052. |
| `MC-04` | Общий лимит проверяется по всему исходнику до внутреннего provider splitting и не обходится внутренним разбиением провайдера. Основание: S053. |
| `MC-05` | Provider split/merge не теряет и не дублирует речь на границах частей. Основание: S101. |
| `MC-06` | Итоговый timeline согласован по всей записи и явно раскрывает ограничения сопоставления спикеров между частями. Основание: S102. |
| `MC-07` | Partial result показывает конкретные необработанные части и не выдаётся за полный. Основание: S103. |
| `MC-08` | Provider/model и временные данные результата соответствуют фактическому STT; официальный JSON числовых строк нормализуется без потери таймкодов. Основание: S077,S130. |
| `MC-09` | Realtime diarization показывается доступной только для документированного рабочего режима провайдера. Основание: S107. |

### Эпик `PERSONAL-VOICE-02` — Опциональная голосовая идентификация

| AC | Проверяемое требование |
|---|---|
| `VID-01` | Personal может явно включить автоматическое сопоставление спикера с сохранёнными голосовыми образцами. Основание: S008,S086. |
| `VID-02` | Голосовые образцы имеют отдельный owner-scoped доступ. Основание: S089. |
| `VID-03` | Голосовые образцы имеют явную политику хранения. Основание: S089. |
| `VID-04` | Голосовые образцы и результат идентификации можно удалить по соответствующей политике. Основание: S089. |
| `VID-05` | Голосовая идентификация не обязательна для обычного распознавания и diarization. Основание: S088. |

### Эпик `SECURITY-LIFECYCLE-03` — Дополнение жизненного цикла доступа

| AC | Проверяемое требование |
|---|---|
| `SECX-01` | Personal password reset использует ограниченный по времени одноразовый механизм. Основание: S177. |
| `SECX-02` | Подтверждённое TOTP enrollment выдаёт одноразовые recovery codes. Основание: S182. |
| `SECX-03` | Перевыпуск recovery codes требует свежего безопасного подтверждения личности. Основание: S183. |
| `SECX-04` | Изменение второго фактора отзывает остальные активные сессии. Основание: S185. |
| `SECX-05` | Recovery codes хранятся как невосстановимый verifier. Основание: S189. |
| `SECX-06` | Системные письма personal об access/security используют собственный домен. Основание: S257. |

### Эпик `RECOVERY-DATA-03` — Хранение и проверенное восстановление

| AC | Проверяемое требование |
|---|---|
| `REC-01` | Backup data имеет явно определённый срок хранения. Основание: S164. |
| `REC-02` | Personal резервное копирование выполняется регулярно. Основание: S261. |
| `REC-03` | Восстановление personal данных из backup проверяется на изолированном target. Основание: S261. |
| `REC-04` | Для personal определён допустимый RPO. Основание: S262. |
| `REC-05` | Для personal определён допустимый RTO. Основание: S262. |
| `REC-06` | Restore drill измеряет фактические потерю данных и время относительно RPO/RTO. Основание: S262. |
| `REC-07` | После restore удалённые пользователем данные не возвращаются в активное использование. Основание: S263. |

### Эпик `COMMERCIAL-COMPLETENESS-02` — Дополнение commercial и personal preview

| AC | Проверяемое требование |
|---|---|
| `CX-01` | Commercial-набор personal воспроизводит тарифные ограничения и соответствующие состояния UI. Основание: S012. |
| `CX-02` | Проверка commercial-набора владельцем personal не требует реальной покупки подписки. Основание: S013. |
| `CX-03` | Пользователь commercial может запретить последующие списания и использование сохранённых платёжных реквизитов. Основание: S206. |
| `CX-04` | Для cancellation, partial, failure и retry определены и показаны правила расхода квоты. Основание: S209. |
| `CX-05` | Admin видит подписки и возвраты со связанным расходом. Основание: S210. |
| `CX-06` | Правила обработки записей и текста действуют независимо от отказа от идентификации спикеров. Основание: S213. |
| `CX-07` | Account deletion объясняет сохранение обязательных учётных записей. Основание: S216. |
| `CX-08` | Отдельно требуемые согласия не объединяются скрыто с офертой. Основание: S217. |
| `CX-09` | LTV estimate отличается от фактических исторических данных; доступна выручка. Основание: S242. |

## 5. Durable technical и safety constraints

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
- R2 object keys, presigned URLs, lease authority, transcript bodies и external payloads не входят в metadata DTO/logs/diagnostics; явный owner-scoped content endpoint для RS-01 является отдельным authenticated no-store boundary.
- Batch creation сохраняет immutable per-job output-folder snapshot. Изменение project default не перенаправляет существующую job.
- Claim/lease/cancellation checks выполняются на stage boundaries. Uncertain provider/output side effect не запускает automatic retry и переводится в explicit reconciliation.
- Exactly-once Google document creation не заявляется; успешное завершение требует persisted output evidence для каждого non-skipped source/fragment.
- Video audio extraction и automatic long-media split/merge остаются server-side, bounded и deterministic.
- Existing-document standardization мутирует только подходящие Google Docs; manifest import мутирует только PostgreSQL catalog metadata.
- Service worker не runtime-cache-ит API responses или upload requests.
- CI/CD, migrations, environments, production operations и rollback регулирует `docs/ci-cd-rules.md`.

## 6. Решения, которые ещё нужны

Существование Projects, Studio result, Yandex Disk, realtime recording/reconnect и voice identification уже задано и не требует повторного согласования как scope. Для реализации остаются конкретные варианты: содержание Projects и связь с техническими workspaces; параметры ограниченного realtime replay buffer; алгоритм и срок хранения voice samples; значения personal RPO/RTO; коммерческие тарифы, quota outcome rules, продавец/оператор и legal gates. Эти параметры не исключают соответствующие AC из denominator и не разрешают агенту придумывать продуктовые значения.

Старые SPEC-GAP-RT-01/02 разрешены новым intent S109–S113 (нужны reconnect/backfill и аудиозапись), AUDIO-01 — S056 (перечислены входные форматы, не все выходные), COAUTH-01 — S176 (Yandex ID/VK ID). Zero Trust и staging остаются опциональными. Нет требования заново добавлять обязательный TOTP для обычной очистки истории. Старое Colab capture concern — вопрос проверки CR-06, а не дополнительный AC.

При самопроверке два предложенных новых критерия не добавлены в denominator: default 12h закреплён в существующем PWASEC-06 вместо MC-02; название обслуживания — в PTM-01 вместо UXN-08. Идентификаторы MC-02/UXN-08 зарезервированы как aliases и не являются отдельными AC.

## 7. Трассировка актуального исходника

Каждая строка содержит исходный согласованный пункт и соответствующую AC-поверхность. Ссылки на широкий диапазон означают распределённое покрытие и не утверждают, что одна строка реализует весь диапазон. Проверенные gaps и недостающие Evidence перечислены по отдельным AC в delivery-plan. Старые AC без нового узкого аналога сохраняют основание в прежнем canonical contract, доступном через Git revision до этого аудита.

| Источник | Согласованное требование | AC / constraint |
|---|---|---|
| S001 | VoiceOps Studio — PWA для подготовки аудио, транскрибации созвонов и лекций, работы с результатами и их сохранения в оформленные документы. | AP-01..30,PS-01..05,PI-01..11 |
| S002 | Один созвон можно разделить на несколько временных фрагментов, например по последовательно обсуждаемым проектам, и получить отдельную транскрипцию каждого фрагмента. | AP-01..30,PS-01..05,PI-01..11 |
| S003 | Должна быть возможность обрабатывать один файл, несколько файлов или группу транскрибаций с разными исходниками и целевыми папками. | AP-01..30,PS-01..05,PI-01..11 |
| S004 | Personal production предназначен для владельца проекта. Commercial production — отдельный SaaS для российских пользователей с индивидуальными аккаунтами. | EVC-01..50,CID-01..18,CSP-01..03 |
| S005 | Организации, командные пространства и совместная работа не входят в текущий scope. | EVC-01..50,CID-01..18,CSP-01..03 |
| S006 | Общие пользовательские функции доступны в обоих контурах. Personal дополнительно поддерживает иностранные integrations, личные и экспериментальные возможности. | EVC-01..50,CID-01..18,CSP-01..03 |
| S007 | В commercial использовать Яндекс Диск. В personal доступны Яндекс Диск и Google Drive. | EVC-01..50,CID-01..18,CSP-01..03, YD-01 |
| S008 | Автоматическая идентификация человека по сохранённому голосу доступна только как отдельная опциональная возможность personal. | EVC-01..50,CID-01..18,CSP-01..03, VID-01 |
| S009 | Personal и commercial должны быть изолированы друг от друга и обновляться независимо. Персональные данные, подключения и секреты между ними не переносятся автоматически. | EVC-01..50,CID-01..18,CSP-01..03 |
| S010 | В personal должно быть три отображаемых набора функций: commercial, дополнительные personal-функции и все функции. | EVC-01..50,CID-01..18,CSP-01..03 |
| S011 | Выбор набора меняет доступный интерфейс, сохраняя текущее personal-окружение и его данные. | EVC-01..50,CID-01..18,CSP-01..03 |
| S012 | Commercial-набор в personal должен позволять проверять пользовательские сценарии коммерческой версии, включая тарифные ограничения и связанные состояния интерфейса. | EVC-01..50,CID-01..18,CSP-01..03, CX-01 |
| S013 | Использование владельцем personal не должно требовать реальной покупки подписки самому себе. | EVC-01..50,CID-01..18,CSP-01..03, CX-02 |
| S014 | Адаптивный интерфейс с разделами «Дашборд», «Проекты», «Подготовка аудио», «Транскрибации» и «Настройки». | PC-01..14,PUX-01..13,UXPOL-01..08,UXCTL-01..14, UXN-01 |
| S015 | Дашборд показывает активную обработку, последние задания и результаты, состояние подключений и основные доступные действия. | PC-01..14,PUX-01..13,UXPOL-01..08,UXCTL-01..14 |
| S016 | Одиночное задание называть «Транскрибация», несколько заданий — «Группа транскрибаций». | PC-01..14,PUX-01..13,UXPOL-01..08,UXCTL-01..14 |
| S017 | Поддержка светлой, тёмной и системной темы, возможность выбрать цвет интерфейса. | PC-01..14,PUX-01..13,UXPOL-01..08,UXCTL-01..14 |
| S018 | Основные действия и пояснения должны быть на понятном русском языке. Устойчивые technical terms, identifiers и metadata keys сохранять на английском. | PC-01..14,PUX-01..13,UXPOL-01..08,UXCTL-01..14 |
| S019 | Ошибки, успешное завершение и отмена должны различаться текстом, визуально и для средств доступности, включая ARIA. | PC-01..14,PUX-01..13,UXPOL-01..08,UXCTL-01..14 |
| S020 | Основные экраны показывают пользовательские действия и результаты. Подробности обработки, служебные идентификаторы и диагностика раскрываются отдельно. | PC-01..14,PUX-01..13,UXPOL-01..08,UXCTL-01..14 |
| S021 | В карточках заданий и истории не должно быть случайных дублей дат, статусов и метаданных. | PC-01..14,PUX-01..13,UXPOL-01..08,UXCTL-01..14 |
| S022 | Длинные списки должны оставаться управляемыми: поиск или фильтры по назначению раздела, загрузка результатов частями, возможность свернуть подробности. | PC-01..14,PUX-01..13,UXPOL-01..08,UXCTL-01..14 |
| S023 | Модальные окна должны оставаться доступны при прокрутке, блокировать фоновый scroll и сохранять читаемые названия и кнопки на смартфоне. | PC-01..14,PUX-01..13,UXPOL-01..08,UXCTL-01..14 |
| S024 | Если функция недоступна в текущем браузере или на устройстве, это должно быть понятно до запуска соответствующего действия. | PC-01..14,PUX-01..13,UXPOL-01..08,UXCTL-01..14 |
| S025 | Выбор исходников с устройства или подключённого облачного диска: отдельный файл, несколько файлов или папка. | PI-01..11,PG-01..08,GOOGLE-01..06, YD-02, YD-03 |
| S026 | Выбор файлов и папок должен быть визуально и поведенчески согласован во всех сценариях PWA. | PI-01..11,PG-01..08,GOOGLE-01..06 |
| S027 | Для файлов доступен множественный выбор. При выборе папки можно выбрать текущую открытую папку, включая пустую. | PI-01..11,PG-01..08,GOOGLE-01..06, YD-02, YD-03 |
| S028 | Поиск должен соответствовать назначению выбора: файлы и папки для исходников, папки для целевого размещения. | PI-01..11,PG-01..08,GOOGLE-01..06, YD-04 |
| S029 | У поиска должны быть понятные состояния загрузки, отсутствия результатов и ошибки. Область поиска и ограничения подключённого диска должны быть видны пользователю. | PI-01..11,PG-01..08,GOOGLE-01..06, YD-04 |
| S030 | Целевые папки можно добавлять в избранное и повторно выбирать при подготовке задания. | PI-01..11,PG-01..08,GOOGLE-01..06 |
| S031 | Перед запуском проверять доступность исходников и ограничения выбранного назначения. Проблема облачного экспорта не должна скрывать возможность сохранить результат в Studio. | PI-01..11,PG-01..08,GOOGLE-01..06, RS-04 |
| S032 | Подключение облачного диска выполняется отдельно от входа в Studio и не должно быть обязательным для обработки файлов с устройства. | PI-01..11,PG-01..08,GOOGLE-01..06, RS-04 |
| S033 | Запрашивать только разрешения, необходимые для доступных функций подключения. Пользователь должен понимать, к каким данным получает доступ приложение. | PI-01..11,PG-01..08,GOOGLE-01..06 |
| S034 | При истечении или отзыве доступа показывать понятное состояние подключения и действие для восстановления доступа. | PI-01..11,PG-01..08,GOOGLE-01..06, YD-08 |
| S035 | При отключении интеграции удалять сохранённые токены и по возможности отзывать предоставленный доступ. | PI-01..11,PG-01..08,GOOGLE-01..06, YD-08 |
| S036 | Переименование, перемещение или удаление выбранного файла либо папки не должно приводить к незаметной обработке другого объекта. | PI-01..11,PG-01..08,GOOGLE-01..06 |
| S037 | Поддержка «Моего диска», доступных Shared drives и общих папок в пределах предоставленных разрешений. | PI-01..11,PG-01..08,GOOGLE-01..06 |
| S038 | Выбор исходников, целевых папок и документов для обслуживания через общий интерфейс Google Drive внутри Studio. | PI-01..11,PG-01..08,GOOGLE-01..06 |
| S039 | Сохранение транскрипций в Google Docs и обработанных аудиофайлов в выбранные папки Google Drive. | PB-06,AP-15,AP-25..30,GOOGLE-01..06 |
| S040 | Большие загрузки должны поддерживать продолжение после обрыва, когда Google Drive позволяет восстановить передачу. | PB-06,AP-15,AP-25..30,GOOGLE-01..06 |
| S041 | Выбор записей с Яндекс Диска, целевых папок для документов и папок для сохранения подготовленного аудио. | PB-06,AP-15,AP-25..30,GOOGLE-01..06, YD-01, YD-02, YD-03, YD-04, YD-05, YD-06 |
| S042 | Транскрипции сохраняются на Яндекс Диск как оформленные DOCX-документы. | PB-06,AP-15,AP-25..30,GOOGLE-01..06, YD-05 |
| S043 | При недостатке места, потере доступа или конфликте назначения результат остаётся доступен в Studio для скачивания и повторного экспорта. | PB-06,AP-15,AP-25..30,GOOGLE-01..06, RS-08, YD-09 |
| S044 | Повторный экспорт не должен незаметно перезаписывать документ, который пользователь уже изменил. | PB-06,AP-15,AP-25..30,GOOGLE-01..06, YD-07 |
| S045 | В personal должна быть возможность загрузить выбранные файлы с устройства в Google Drive без обработки и транскрибации. | PB-06,AP-15,AP-25..30,GOOGLE-01..06 |
| S046 | При такой передаче сохраняются исходное содержимое, имя и тип файла; запись не должна попадать в обработку Studio или STT. | PB-06,AP-15,AP-25..30,GOOGLE-01..06 |
| S047 | Для каждого файла показывать прогресс, состояние и ссылку на результат. Доступны отмена незавершённой передачи и ручная повторная попытка. | PB-06,AP-15,AP-25..30,GOOGLE-01..06 |
| S048 | Повтор подтверждённой передачи не должен создавать второй экземпляр того же результата. | PB-06,AP-15,AP-25..30,GOOGLE-01..06 |
| S049 | До обработки и обращения к STT проверять реальный формат, кодек, длительность и целостность медиафайла. | AP-02..12,AP-21..24,PWASEC-04..06, MC-01 |
| S050 | Ограничения размера, длительности и количества файлов должны быть известны до начала затратной обработки. | AP-02..12,AP-21..24,PWASEC-04..06 |
| S051 | Общий лимит длительности одного исходника должен настраиваться. Значение по умолчанию — 12 часов. | AP-02..12,AP-21..24,PWASEC-04..06, PWASEC-06 |
| S052 | Для записей свыше 4 и до 12 часов перед запуском показывать оценку расхода и получать явное подтверждение пользователя. | AP-02..12,AP-21..24,PWASEC-04..06, MC-03 |
| S053 | Запись, превышающая общий лимит, отклоняется до обращения к STT с предложением подготовить или разделить файл. Внутреннее разбиение для провайдера не обходит этот лимит. | AP-02..12,AP-21..24,PWASEC-04..06, MC-04 |
| S054 | Склейка нескольких аудиофайлов с автоматическим предложением порядка по доступным датам и возможностью вручную изменить порядок. | AP-02..12,AP-21..24,PWASEC-04..06 |
| S055 | Склейка совместимых файлов без перекодирования и потери качества, когда исходные форматы позволяют это сделать. | AP-02..12,AP-21..24,PWASEC-04..06 |
| S056 | Конвертация поддерживаемых аудио- и видеоисточников, включая MKV, M4A, MP3, WAV и FLAC, в доступные выходные аудиоформаты. | AP-02..12,AP-21..24,PWASEC-04..06 |
| S057 | Усечение длинных участков тишины с настройкой порога, минимальной длительности паузы и длительности сохраняемой тишины. | AP-02..12,AP-21..24,PWASEC-04..06 |
| S058 | Предварительный анализ тишины с отображением длительности записи до и после предполагаемой обработки. | AP-02..12,AP-21..24,PWASEC-04..06 |
| S059 | Склейка, конвертация, усечение тишины и переименование должны быть доступны без последующей транскрибации. | AP-02..12,AP-21..24,PWASEC-04..06 |
| S060 | Переименование готовых файлов по шаблонам с датой, временем, проектом и названием, когда соответствующие данные известны. | AP-02..12,AP-21..24,PWASEC-04..06, UXN-02 |
| S061 | Шаблоны настроек для повторяющихся сценариев, например «Лекция», «Созвон» и «Только обработать аудио». | AP-02..12,AP-21..24,PWASEC-04..06 |
| S062 | Разделение исходника на фрагменты включается отдельной опцией. Количество фрагментов задаёт пользователь. | PS-01..05,UXCTL-03..05 |
| S063 | Для каждого фрагмента можно указать время начала и окончания, включая начало и конец всей записи. | PS-01..05,UXCTL-03..05 |
| S064 | До запуска должна быть видна итоговая последовательность фрагментов. Невалидные интервалы и выход за длительность исходника должны быть обнаружены заранее. | PS-01..05,UXCTL-03..05, UXN-03 |
| S065 | Для каждого выбранного фрагмента создаётся отдельный документ с транскрипцией. Создание отдельных аудиофайлов для этого сценария не требуется. | PS-01..05,UXCTL-03..05 |
| S066 | Общая целевая папка используется для всех фрагментов по умолчанию. Для каждого фрагмента можно выбрать другую папку. | PS-01..05,UXCTL-03..05 |
| S067 | Перед запуском показывать границы фрагментов и итоговое назначение каждого документа, включая сохранение только в Studio. | PS-01..05,UXCTL-03..05, UXN-04 |
| S068 | Если подготовка аудио меняет длительность записи, пользователь должен понимать, к какой версии относятся выбранные интервалы и таймкоды. | PS-01..05,UXCTL-03..05, UXN-05 |
| S069 | Отдельный режим обработки файлов непосредственно на устройстве пользователя без обязательной загрузки исходника в Studio или S3. | AP-17..18,AP-23 |
| S070 | В local processing доступны те операции, которые поддерживаются текущим браузером и укладываются в ограничения устройства. | AP-17..18,AP-23 |
| S071 | Если после локальной обработки серверная операция не нужна, исходник остаётся на устройстве пользователя. | AP-17..18,AP-23 |
| S072 | Для тяжёлых файлов и неподдерживаемых локальных операций должна оставаться доступна серверная обработка. | AP-17..18,AP-23 |
| S073 | Переход от локальной обработки к передаче файла на сервер должен быть явным для пользователя. | AP-17..18,AP-23 |
| S074 | Выбор русского, английского языка или автоопределения в пределах возможностей выбранного режима. | PB-01..04,PB-11,STTPRO-01..14,YANDEX-01..05,PWADIC-01,UXCTL-01..02,CSQ-10..16 |
| S075 | Опциональное разделение на спикеров. Включённое состояние должно быть явно видно в настройках и перед запуском. | PB-01..04,PB-11,STTPRO-01..14,YANDEX-01..05,PWADIC-01,UXCTL-01..02,CSQ-10..16 |
| S076 | Пользовательские словари терминов, фамилий, названий и аббревиатур для режимов, которые поддерживают такие подсказки. | PB-01..04,PB-11,STTPRO-01..14,YANDEX-01..05,PWADIC-01,UXCTL-01..02,CSQ-10..16 |
| S077 | До запуска показывать существенные ограничения выбранного режима: языки, разделение спикеров, допустимые исходники и другие влияющие на результат возможности. | PB-01..04,PB-11,STTPRO-01..14,YANDEX-01..05,PWADIC-01,UXCTL-01..02,CSQ-10..16, MC-08 |
| S078 | Поддержка нескольких STT-провайдеров с возможностью отключить или заменить провайдера без изменения основных пользовательских сценариев. | PB-01..04,PB-11,STTPRO-01..14,YANDEX-01..05,PWADIC-01,UXCTL-01..02,CSQ-10..16 |
| S079 | Personal поддерживает ElevenLabs и Yandex SpeechKit. Commercial должен иметь полноценный российский вариант STT. | PB-01..04,PB-11,STTPRO-01..14,YANDEX-01..05,PWADIC-01,UXCTL-01..02,CSQ-10..16 |
| S080 | Поддержка обычной, отложенной и realtime-транскрибации в пределах подтверждённых возможностей соответствующего провайдера. | PB-01..04,PB-11,STTPRO-01..14,YANDEX-01..05,PWADIC-01,UXCTL-01..02,CSQ-10..16 |
| S081 | Экономичный, стандартный и premium-режимы показывать отдельно только при реальном различии возможностей, скорости, модели или стоимости. | PB-01..04,PB-11,STTPRO-01..14,YANDEX-01..05,PWADIC-01,UXCTL-01..02,CSQ-10..16 |
| S082 | Перед запуском пользователь должен видеть понятное объяснение различий режимов. Эквивалентные режимы объединяются. | PB-01..04,PB-11,STTPRO-01..14,YANDEX-01..05,PWADIC-01,UXCTL-01..02,CSQ-10..16 |
| S083 | В commercial пользователь выбирает режим по цене и возможностям; технический выбор STT-провайдера не должен быть обязательной частью основного интерфейса. | PB-01..04,PB-11,STTPRO-01..14,YANDEX-01..05,PWADIC-01,UXCTL-01..02,CSQ-10..16 |
| S084 | При массовых ошибках или недоступности провайдера соответствующий режим временно перестаёт принимать новые задания. | PB-01..04,PB-11,STTPRO-01..14,YANDEX-01..05,PWADIC-01,UXCTL-01..02,CSQ-10..16 |
| S085 | Автоматический переход задания на другого STT-провайдера не входит в текущий scope. | PB-01..04,PB-11,STTPRO-01..14,YANDEX-01..05,PWADIC-01,UXCTL-01..02,CSQ-10..16 |
| S086 | Опциональная идентификация спикера по имени с использованием сохранённых голосовых образцов. | SP-01..05,CSP-01..03, VID-01 |
| S087 | Личная база имён и ролей спикеров с возможностью прослушать фрагмент голоса для подтверждения соответствия. | SP-01..05,CSP-01..03 |
| S088 | Идентификация не должна быть обязательным шагом обычной транскрибации или разделения на спикеров. | SP-01..05,CSP-01..03, VID-05 |
| S089 | Сохранённые голосовые образцы и результаты идентификации должны подчиняться отдельным правилам доступа, хранения и удаления. | SP-01..05,CSP-01..03, VID-02, VID-03, VID-04 |
| S090 | Группа с одной целевой папкой и несколькими исходниками, выбранными по отдельности или из папки. | PI-09..11,PT-03,JOBREL-01..17,UXCTL-06..07 |
| S091 | Группа, в которой для каждой транскрибации задаются собственные исходники, настройки и целевая папка. | PI-09..11,PT-03,JOBREL-01..17,UXCTL-06..07 |
| S092 | Результат и состояние каждого задания должны оставаться доступны независимо от успешности остальных заданий группы. | PI-09..11,PT-03,JOBREL-01..17,UXCTL-06..07 |
| S093 | Очередь должна сохранять задания, их состояния и завершённые этапы при перезапуске сервиса. | PI-09..11,PT-03,JOBREL-01..17,UXCTL-06..07 |
| S094 | Отложенные задания продолжают выполняться после закрытия PWA. При возвращении пользователь видит актуальное состояние и результат. | PI-09..11,PT-03,JOBREL-01..17,UXCTL-06..07 |
| S095 | Доступна отмена ожидающего или выполняющегося задания с понятным результатом отмены и информацией о возможном расходе. | PI-09..11,PT-03,JOBREL-01..17,UXCTL-06..07 |
| S096 | Показывать текущий этап обработки. Процент выполнения отображать, когда он известен или может быть явно обозначен как оценочный. | PI-09..11,PT-03,JOBREL-01..17,UXCTL-06..07 |
| S097 | После сбоя продолжать с доступного завершённого этапа, сохраняя уже полученные результаты. | PI-09..11,PT-03,JOBREL-01..17,UXCTL-06..07 |
| S098 | Повторные попытки не должны создавать повторные документы, файлы, уведомления и повторно учитывать подтверждённый расход. | PI-09..11,PT-03,JOBREL-01..17,UXCTL-06..07 |
| S099 | Если провайдер не гарантирует безопасный повтор платного запроса, неизвестный исход нельзя автоматически считать неуспехом и повторять без проверки. | PI-09..11,PT-03,JOBREL-01..17,UXCTL-06..07 |
| S100 | Незавершённые или зависшие операции должны обнаруживаться и оставаться видимыми до восстановления, отмены либо разрешения неопределённости. | PI-09..11,PT-03,JOBREL-01..17,UXCTL-06..07 |
| S101 | Внутреннее разделение записи из-за лимитов провайдера не должно приводить к незаметной потере или дублированию речи на границах частей. | PWASEC-06,JOBREL-03..06, MC-05 |
| S102 | Итоговые таймкоды должны быть согласованы по всей записи. Ограничения сопоставления спикеров между частями должны быть явно отражены. | PWASEC-06,JOBREL-03..06, MC-06 |
| S103 | Частичный результат должен отличаться от полного; пользователь должен видеть, какие части не были обработаны. | PWASEC-06,JOBREL-03..06, MC-07 |
| S104 | Realtime-транскрибация звука вкладки браузера или окна в Windows в поддерживаемых браузерах и доступных режимах захвата. | PR-01..13,REALTI-01,STTPRO-02,STTPRO-05 |
| S105 | Возможность включать звук выбранного источника, микрофон пользователя или оба источника. | PR-01..13,REALTI-01,STTPRO-02,STTPRO-05 |
| S106 | Текст транскрибации отображается в PWA по мере поступления. Промежуточные гипотезы должны отличаться от подтверждённых сегментов. | PR-01..13,REALTI-01,STTPRO-02,STTPRO-05 |
| S107 | Опциональное разделение на спикеров должно быть доступно и в realtime при наличии провайдера, который обеспечивает эту возможность. | PR-01..13,REALTI-01,STTPRO-02,STTPRO-05, MC-09 |
| S108 | Ограничения захвата, разрешений и текущего режима должны быть понятны до начала сессии. | PR-01..13,REALTI-01,STTPRO-02,STTPRO-05 |
| S109 | Для пользователя realtime остаётся одной сессией при технических переподключениях и смене внутренних частей потока. | PR-01..13,REALTI-01,STTPRO-02,STTPRO-05, RTC-01 |
| S110 | После кратковременного обрыва соединение восстанавливается автоматически; доступный непереданный участок аудио передаётся без дублирования результата. | PR-01..13,REALTI-01,STTPRO-02,STTPRO-05, RTC-02, RTC-03 |
| S111 | Если часть аудио не была захвачена или восстановить её невозможно, разрыв должен быть обозначен, а не скрыт. | PR-01..13,REALTI-01,STTPRO-02,STTPRO-05, RTC-04 |
| S112 | Потеря источника захвата и потеря связи с STT отображаются как разные ситуации с соответствующими действиями пользователя. | PR-01..13,REALTI-01,STTPRO-02,STTPRO-05 |
| S113 | Возможность записи полной realtime-сессии с сохранением аудио и итоговой транскрипции. | PR-01..13,REALTI-01,STTPRO-02,STTPRO-05, RTC-05, RTC-06 |
| S114 | Полученный текст должен быть защищён от потери при перезагрузке интерфейса в пределах установленного срока хранения результата. | PR-01..13,REALTI-01,STTPRO-02,STTPRO-05, RTC-07 |
| S115 | Завершение сессии должно сохранять итоговый текст с учётом подтверждённых исправлений провайдера. | PR-01..13,REALTI-01,STTPRO-02,STTPRO-05, RTC-06 |
| S116 | Дополнительная платная обработка записи не должна запускаться незаметно для пользователя. | PR-01..13,REALTI-01,STTPRO-02,STTPRO-05, RTC-08 |
| S117 | Вывод realtime-субтитров в отдельный browser/OBS overlay. | REALTI-02..05 |
| S118 | Передача realtime-субтитров в YouTube Live и другие явно поддерживаемые системы, разрешённые для соответствующего окружения. | REALTI-02..05 |
| S119 | Ошибка внешнего потребителя субтитров не должна останавливать основную realtime-транскрибацию. | REALTI-02..05 |
| S120 | Для результата в dropdown меню доступны просмотр текста в PWA, скачивание DOCX и ручное удаление сохранённой копии. | TRANSC-01..03,STORAG-10, RS-01, RS-02, RS-03 |
| S121 | Просмотр должен сохранять читаемые абзацы, метки спикеров и доступные метаданные транскрипции. | TRANSC-01..03,STORAG-10, RS-01 |
| S122 | Результат доступен в Studio независимо от подключения облачного диска и выбора целевой папки. | TRANSC-01..03,STORAG-10, RS-04 |
| S123 | Успешное распознавание и успешный экспорт должны иметь отдельные состояния. | TRANSC-01..03,STORAG-10, RS-05 |
| S124 | Ошибка облачного экспорта не должна приводить к потере уже сохранённой транскрипции. | TRANSC-01..03,STORAG-10, RS-06 |
| S125 | Пока сохранённая транскрипция доступна, её можно повторно скачать или экспортировать без новой платной транскрибации. | TRANSC-01..03,STORAG-10, RS-07, RS-08 |
| S126 | Экспорт транскрипции в DOCX, TXT и Markdown. | TRANSC-01..03,STORAG-10, RS-02, RS-09 |
| S127 | Экспорт субтитров в SRT и VTT при наличии необходимых временных данных. | TRANSC-01..03,STORAG-10 |
| S128 | Таймкоды экспортируемых субтитров должны соответствовать той версии аудио, для которой подготовлен результат. | TRANSC-01..03,STORAG-10, RS-10 |
| S129 | При отсутствии необходимых временных данных ограничение экспорта должно быть объяснено пользователю. | TRANSC-01..03,STORAG-10, RS-11 |
| S130 | Новые документы должны соответствовать единому стандарту transcript_doc: абзацы, метаданные в начале и согласованное оформление спикеров. | CB-19..24,PB-07..10,PD-03..14, MC-08 |
| S131 | Название документа оформляется стилем Heading 2, основной текст — размером 11 pt. | CB-19..24,PB-07..10,PD-03..14 |
| S132 | Метки спикеров оформляются в виде «Спикер N:», полужирным шрифтом размером 14 pt. | CB-19..24,PB-07..10,PD-03..14 |
| S133 | Даты и время записываются в ISO 8601. Устойчивые technical terms и metadata keys сохраняются на английском. | CB-19..24,PB-07..10,PD-03..14 |
| S134 | Дату записи указывать только при наличии подтверждённого значения. Дату изменения файла или транскрибации нельзя выдавать за дату записи. | CB-19..24,PB-07..10,PD-03..14 |
| S135 | Если дата исходной записи неизвестна, соответствующий пункт пропускается; отсутствующие данные не придумываются. | CB-19..24,PB-07..10,PD-03..14, UXN-06 |
| S136 | Для фрагментов и объединённых записей метаданные должны позволять понять происхождение документа и связь с исходниками. | CB-19..24,PB-07..10,PD-03..14, UXN-07 |
| S137 | Пользователь работает с актуальным стандартом оформления без выбора его внутренних или исторических версий. | CB-19..24,PB-07..10,PD-03..14 |
| S138 | Манифест должен учитывать обработанные исходники и связанные результаты, различая распознавание и экспорт. | PM-01..06, RS-12 |
| S139 | Определение повторной обработки не должно зависеть только от имени файла: существенны исходник, выбранные фрагменты и настройки обработки. | PM-01..06 |
| S140 | Должны быть доступны просмотр и очистка манифеста, его сохранение в выбранную папку и явный запуск с пропуском проверки. | PM-01..06, RS-13 |
| S141 | Утрата экспортированного документа не должна автоматически означать необходимость повторного обращения к STT, если транскрипция ещё сохранена в Studio. | PM-01..06, RS-12 |
| S142 | Повторная обработка с изменёнными настройками должна отличаться от случайного повтора прежнего задания. | PM-01..06 |
| S143 | Проверка оформления документов и работа с манифестом размещаются в «Транскрибации → Обслуживание». В настройках остаются подключения и разрешения. | PTM-01..09,PD-01..14,PUX-09..10, PTM-01 |
| S144 | Выбор отдельного Google Doc или папки с вложенными папками для проверки и приведения документов к актуальному стандарту. | PTM-01..09,PD-01..14,PUX-09..10 |
| S145 | Проверка и применение изменений выполняются отдельно. Перед применением показываются найденные изменения и запрашивается подтверждение пользователя. | PTM-01..09,PD-01..14,PUX-09..10 |
| S146 | Перед записью повторно проверяются доступ и актуальное состояние документа. Чужие изменения и конфликтующие версии нельзя перезаписывать незаметно. | PTM-01..09,PD-01..14,PUX-09..10 |
| S147 | Старые документы можно стандартизировать без обязательной связи с исходной аудиозаписью. | PTM-01..09,PD-01..14,PUX-09..10 |
| S148 | Валидную существующую дату сохранять. Отсутствующую или невалидную дату пропускать; подтверждённый конфликт с исходником блокирует изменение документа. | PTM-01..09,PD-01..14,PUX-09..10 |
| S149 | Операция обслуживания сохраняет состояние при закрытии страницы и перезапуске сервиса. Повтор запроса не должен повторно применять уже выполненные изменения. | PTM-01..09,PD-01..14,PUX-09..10 |
| S150 | Одновременно выполняемые конфликтующие операции обслуживания должны быть ограничены; обычная обработка записей имеет приоритет. | PTM-01..09,PD-01..14,PUX-09..10 |
| S151 | Отчёт показывает итог, изменённые и пропущенные документы с причинами. Длинный список можно свернуть или убрать с экрана без удаления результатов операции. | PTM-01..09,PD-01..14,PUX-09..10 |
| S152 | Исходники, загруженные для серверной обработки, подготовленное аудио и сохранённые транскрипции размещаются в S3 соответствующего окружения. | STORAG-01..21,PC-08..11,UXCTL-10..11, RS-14 |
| S153 | Для записей и транскрипций доступна единая политика автоматического удаления: через 3, 7 или 30 дней. | STORAG-01..21,PC-08..11,UXCTL-10..11, RS-15, RTC-07 |
| S154 | Для сохранённого результата должны быть видны выбранный срок хранения и дата предстоящего удаления. | STORAG-01..21,PC-08..11,UXCTL-10..11, RS-15 |
| S155 | По истечении срока файлы удаляются из внутреннего хранения и становятся недоступны для просмотра и скачивания в PWA. | STORAG-01..21,PC-08..11,UXCTL-10..11, RS-16 |
| S156 | Записи и транскрипции можно удалить вручную из меню PWA до окончания срока хранения. | STORAG-01..21,PC-08..11,UXCTL-10..11, RS-03 |
| S157 | Большие загрузки должны поддерживать продолжение после обрыва в пределах возможностей используемого S3-хранилища. | STORAG-01..21,PC-08..11,UXCTL-10..11 |
| S158 | Временные файлы обработки, незавершённые загрузки и оставшиеся после сбоев объекты должны очищаться автоматически. | STORAG-01..21,PC-08..11,UXCTL-10..11 |
| S159 | Удаление файла из Studio не должно незаметно удалять исходник или экспортированный документ на пользовательском облачном диске. | STORAG-01..21,PC-08..11,UXCTL-10..11, RS-17 |
| S160 | Перед массовым удалением показывать количество и объём файлов, а также объекты, удаление которых сейчас заблокировано. | STORAG-01..21,PC-08..11,UXCTL-10..11 |
| S161 | После массового удаления показывать фактически удалённые и пропущенные объекты с причинами. | STORAG-01..21,PC-08..11,UXCTL-10..11 |
| S162 | Удаление не должно незаметно ломать активную обработку; связанные ограничения и необходимые действия должны быть видны пользователю. | STORAG-01..21,PC-08..11,UXCTL-10..11 |
| S163 | При удалении учитывать внутренние копии и старые версии объектов, а не только текущий видимый файл. | STORAG-01..21,PC-08..11,UXCTL-10..11 |
| S164 | Для исходников, результатов, reference-файлов, истории, аналитики, журналов и резервных копий должны действовать соответствующие их назначению правила хранения. | STORAG-01..21,PC-08..11,UXCTL-10..11, REC-01 |
| S165 | Состояние удаления должно отражать реальный результат. Неуспешная очистка остаётся видимой и подлежит повторной обработке. | STORAG-01..21,PC-08..11,UXCTL-10..11, RS-17 |
| S166 | Reference-файлы подготовки аудио и reference-файлы транскрибаций должны храниться раздельно. | STORAG-01..21,PC-08..11,UXCTL-10..11 |
| S167 | Для каждой категории reference-файлов должны отдельно настраиваться сроки хранения, очистка и права доступа. | STORAG-01..21,PC-08..11,UXCTL-10..11 |
| S168 | История показывает задания, их метаданные, состояние результатов и доступные ссылки на документы. | PO-08..11,STORAG-12,UXCTL-06..07 |
| S169 | Удалённый по сроку хранения файл не должен отображаться как доступный для скачивания. | PO-08..11,STORAG-12,UXCTL-06..07, RS-16 |
| S170 | Очистка истории и удаление сохранённых файлов должны быть понятными отдельными действиями. | PO-08..11,STORAG-12,UXCTL-06..07 |
| S171 | Очистка истории выполняется с подтверждением и не удаляет обязательный платёжный учёт или защищённый audit log. | PO-08..11,STORAG-12,UXCTL-06..07 |
| S172 | Задание с неопределённым ответом провайдера остаётся доступным до разрешения ситуации; его карточку можно свернуть. | PO-08..11,STORAG-12,UXCTL-06..07 |
| S173 | Для неопределённого результата доступны повторная проверка, связь с подтверждённым поздним результатом и явное подтверждение отсутствия результата с предупреждением о возможном расходе. | PO-08..11,STORAG-12,UXCTL-06..07 |
| S174 | В personal — вход владельца по логину и паролю. В commercial — регистрация и вход по email и паролю с подтверждением email. | PC-05..07,PWASEC-01..18,CID-01..18,CSEC-01..05 |
| S175 | В commercial можно использовать адрес любого почтового провайдера; иностранный email не означает подключение иностранного OAuth. | PC-05..07,PWASEC-01..18,CID-01..18,CSEC-01..05 |
| S176 | Дополнительные способы входа в commercial — Yandex ID и VK ID. Google OAuth для входа в commercial не используется. | PC-05..07,PWASEC-01..18,CID-01..18,CSEC-01..05 |
| S177 | Безопасное восстановление пароля через ограниченный по времени одноразовый механизм. | PC-05..07,PWASEC-01..18,CID-01..18,CSEC-01..05, SECX-01 |
| S178 | Управление активными сессиями с возможностью завершить отдельную сессию или все сессии. | PC-05..07,PWASEC-01..18,CID-01..18,CSEC-01..05 |
| S179 | Для критических действий требуется недавнее подтверждение личности; устаревшее подтверждение запрашивается повторно. | PC-05..07,PWASEC-01..18,CID-01..18,CSEC-01..05 |
| S180 | Вход, восстановление пароля и проверка второго фактора должны быть защищены от массового перебора без раскрытия существования чужих аккаунтов. | PC-05..07,PWASEC-01..18,CID-01..18,CSEC-01..05 |
| S181 | Опциональный стандартный TOTP в обоих контурах, совместимый с разными authenticator-приложениями. | PC-05..07,PWASEC-01..18,CID-01..18,CSEC-01..05 |
| S182 | TOTP включается после подтверждения первого кода. При подключении выдаются одноразовые recovery codes. | PC-05..07,PWASEC-01..18,CID-01..18,CSEC-01..05, SECX-02 |
| S183 | Повторная выдача recovery codes, отключение и сброс второго фактора требуют безопасного подтверждения личности. | PC-05..07,PWASEC-01..18,CID-01..18,CSEC-01..05, SECX-03 |
| S184 | Должна быть предусмотрена процедура восстановления доступа при утрате второго фактора с фиксацией критических действий в audit log. | PC-05..07,PWASEC-01..18,CID-01..18,CSEC-01..05 |
| S185 | После изменения второго фактора остальные активные сессии завершаются. | PC-05..07,PWASEC-01..18,CID-01..18,CSEC-01..05, SECX-04 |
| S186 | Добавление и замена собственных API-ключей STT в настройках для разрешённых провайдеров. | PC-05..07,PWASEC-01..18,CID-01..18,CSEC-01..05 |
| S187 | BYOK доступен только там, где это допускают технические возможности и условия использования соответствующего провайдера. | PC-05..07,PWASEC-01..18,CID-01..18,CSEC-01..05 |
| S188 | Сохранённые API-ключи, OAuth-токены и секреты второго фактора должны быть защищены шифрованием. | PC-05..07,PWASEC-01..18,CID-01..18,CSEC-01..05 |
| S189 | Пароли и recovery codes должны храниться в форме, которая не позволяет восстановить их исходное значение. | PC-05..07,PWASEC-01..18,CID-01..18,CSEC-01..05, SECX-05 |
| S190 | Секреты не должны попадать в обычные ответы интерфейса, журналы и диагностические выгрузки. | PC-05..07,PWASEC-01..18,CID-01..18,CSEC-01..05 |
| S191 | Пользователь commercial получает доступ только к собственным файлам, заданиям, транскрипциям, подключениям и настройкам. | CSEC-08..18,DBLP-01..08,PWAWOR-01..03,OBSERV-29..35 |
| S192 | Проверка доступа должна действовать независимо от того, видит ли пользователь ссылку или элемент интерфейса. | CSEC-08..18,DBLP-01..08,PWAWOR-01..03,OBSERV-29..35 |
| S193 | Пользовательские, административные и служебные возможности должны иметь соответствующие их назначению права. | CSEC-08..18,DBLP-01..08,PWAWOR-01..03,OBSERV-29..35 |
| S194 | Обработка медиа должна быть ограничена по ресурсам и доступам, чтобы повреждённый или тяжёлый файл не нарушал работу всего сервиса. | CSEC-08..18,DBLP-01..08,PWAWOR-01..03,OBSERV-29..35 |
| S195 | Рабочие компоненты не должны иметь административных прав, которые не нужны для выполнения их задач. | CSEC-08..18,DBLP-01..08,PWAWOR-01..03,OBSERV-29..35 |
| S196 | Критические изменения безопасности, ключей, подключений и пользовательских данных должны фиксироваться в audit log. | CSEC-08..18,DBLP-01..08,PWAWOR-01..03,OBSERV-29..35 |
| S197 | Месячные пользовательские квоты, ограничения размера файлов и числа одновременно ожидающих и выполняющихся заданий. | CSQ-01..16,CQF-01..06 |
| S198 | Доступный остаток проверяется до запуска. Параллельные задания не должны одновременно расходовать один и тот же остаток квоты. | CSQ-01..16,CQF-01..06 |
| S199 | Отдельные глобальные ограничения расходов STT, загрузок и фоновой обработки. | CSQ-01..16,CQF-01..06 |
| S200 | Один пользователь не должен занимать всю очередь или доступные ресурсы обработки. | CSQ-01..16,CQF-01..06 |
| S201 | До запуска показывать применимый режим, оценку расхода и ограничения тарифа. | CSQ-01..16,CQF-01..06 |
| S202 | Тарифы, подписки и дополнительные оплачиваемые часы обработки. | CBI-01..27 |
| S203 | Приём платежей через российский платёжный сервис с поддержкой рекуррентных списаний. | CBI-01..27 |
| S204 | Отправка чеков и фискализация в форме, соответствующей выбранной модели работы и применимым требованиям. | CBI-01..27 |
| S205 | Отмена подписки, обработка неуспешных продлений и возвратов с понятным состоянием доступа и остатка квоты. | CBI-01..27 |
| S206 | Пользователь должен иметь доступный способ отказаться от дальнейших списаний и использования сохранённых платёжных реквизитов. | CBI-01..27, CX-03 |
| S207 | Повторные или пропущенные уведомления платёжного сервиса не должны приводить к двойному списанию, начислению квоты или продлению подписки. | CBI-01..27 |
| S208 | Для каждой операции сохраняются применённые тариф, режим и правила расчёта, даже если действующие тарифы позже изменились. | CBI-01..27 |
| S209 | Правила расхода квоты при отмене, частичном результате, ошибке и повторной попытке должны быть определены и доступны пользователю. | CBI-01..27, CX-04 |
| S210 | Администратор может просматривать тарифы, подписки, платежи, возвраты и связанный расход обработки. | CBI-01..27, CX-05 |
| S211 | Для аккаунтов, аудиозаписей, транскрипций, голосовых образцов, подключений и диагностических данных должны быть определены цели, основания и сроки обработки. | CDG-01..26,CLEG-01..18 |
| S212 | Российские пользовательские данные и промежуточные результаты commercial обрабатываются и хранятся с соблюдением требований к локализации. | CDG-01..26,CLEG-01..18 |
| S213 | Отказ от идентификации спикеров не отменяет правил обработки персональных данных, содержащихся в самих записях и текстах. | CDG-01..26,CLEG-01..18, CX-06 |
| S214 | Пользователь должен подтверждать наличие права передавать записи на обработку; условия сервиса должны учитывать записи с участием третьих лиц. | CDG-01..26,CLEG-01..18 |
| S215 | Должны быть доступны удаление аккаунта, отзыв применимых согласий и отключение внешних интеграций. | CDG-01..26,CLEG-01..18 |
| S216 | Удаление аккаунта охватывает пользовательские файлы, транскрипции и токены; обязательное хранение отдельных учётных записей должно быть объяснено. | CDG-01..26,CLEG-01..18, CX-07 |
| S217 | Согласия, для которых требуется отдельное оформление, не должны незаметно объединяться с офертой или другими документами. | CDG-01..26,CLEG-01..18, CX-08 |
| S218 | Для commercial должны быть определены продавец и оператор персональных данных, опубликованы применимые условия использования, оферта и политика обработки данных. | CXB-01..14,CLEG-01..18,EVC-49 |
| S219 | Документы и согласия должны соответствовать фактическому движению данных, срокам хранения и работе подключённых сервисов. | CXB-01..14,CLEG-01..18,EVC-49 |
| S220 | Использование зарубежного сервиса допускается только после проверки конкретных передаваемых данных, условий провайдера и применимых требований. | CXB-01..14,CLEG-01..18,EVC-49 |
| S221 | Commercial не должен зависеть от ElevenLabs или другого иностранного STT-провайдера. | CXB-01..14,CLEG-01..18,EVC-49 |
| S222 | Неиспользуемые или неразрешённые интеграции не должны становиться доступны только из-за присутствия их кода в общем проекте. | CXB-01..14,CLEG-01..18,EVC-49 |
| S223 | До публичного запуска должны быть выполнены применимые обязанности оператора, включая уведомления уполномоченных органов, когда они необходимы. | CXB-01..14,CLEG-01..18,EVC-49 |
| S224 | Статистика количества транскрибаций, времени выполнения, успешности, обработанной длительности и использованных режимов. | PO-12..18,USAGEC-01..06,UXCTL-08..09 |
| S225 | Для задания сохраняются подтверждённая длительность обработки и данные, необходимые для расчёта расхода. | PO-12..18,USAGEC-01..06,UXCTL-08..09 |
| S226 | Повторная попытка или восстановление задания не должны повторно учитывать уже подтверждённое использование. | PO-12..18,USAGEC-01..06,UXCTL-08..09 |
| S227 | Неопределённый ответ провайдера должен отличаться от подтверждённого расхода. | PO-12..18,USAGEC-01..06,UXCTL-08..09 |
| S228 | Очистка обычной аналитики доступна с подтверждением и не затрагивает платёжный учёт или обязательные журналы. | PO-12..18,USAGEC-01..06,UXCTL-08..09 |
| S229 | Расчётная стоимость задания должна учитывать применимый тариф, единицы расчёта и подтверждённые правила округления. | PO-12..18,USAGEC-01..06,UXCTL-08..09 |
| S230 | Изменение тарифа не должно изменять расчёты ранее запущенных заданий. | PO-12..18,USAGEC-01..06,UXCTL-08..09 |
| S231 | Расчётная стоимость задания и фактическое списание по аккаунту провайдера должны отображаться раздельно. | PO-12..18,USAGEC-01..06,UXCTL-08..09 |
| S232 | Источник данных, валюта, период и время получения информации о расходах должны быть доступны для проверки. | PO-12..18,USAGEC-01..06,UXCTL-08..09 |
| S233 | Отсутствующие сведения о списаниях нельзя подменять нулём или выдавать расчётную оценку за подтверждённый счёт. | PO-12..18,USAGEC-01..06,UXCTL-08..09 |
| S234 | Для подключённого аккаунта показывать доступные через официальный API сведения о плане, статусе, расходе, лимитах, остатке и обновлении периода. | PO-12..18,USAGEC-01..06,UXCTL-08..09 |
| S235 | Основной план, PAYG/prepaid balance, дополнительные списания и счета должны быть различимы в интерфейсе. | PO-12..18,USAGEC-01..06,UXCTL-08..09 |
| S236 | Расход credits по продуктам показывать с указанием периода и единиц, предоставленных провайдером. | PO-12..18,USAGEC-01..06,UXCTL-08..09 |
| S237 | Credits и characters нельзя переводить в минуты без подтверждённого основания, а общий счёт — произвольно распределять по заданиям. | PO-12..18,USAGEC-01..06,UXCTL-08..09 |
| S238 | Данные аккаунта должны иметь состояния актуальности, устаревания и недоступности; доступны обновление при открытом экране и ручное обновление. | PO-12..18,USAGEC-01..06,UXCTL-08..09 |
| S239 | При ошибке провайдера можно сохранить последний успешный результат с явной отметкой, что он устарел. | PO-12..18,USAGEC-01..06,UXCTL-08..09 |
| S240 | Учёт стоимости STT, хранения, вычислений, сетевого трафика, платёжных комиссий, фискализации и обязательных расходов. | CEC-01..15 |
| S241 | Расчёт себестоимости часа обработки по режимам и средней себестоимости активного пользователя. | CEC-01..15 |
| S242 | Аналитика выручки, ARPU, contribution margin и retention; оценка LTV должна отличаться от подтверждённых исторических данных. | CEC-01..15, CX-09 |
| S243 | До масштабирования платного привлечения должна быть определена допустимая стоимость привлечения с учётом фактической экономики сервиса. | CEC-01..15 |
| S244 | Административная диагностика состояния приложения, базы данных, очереди, обработки, хранилища и внешних интеграций. | OBSERV-01..35,PO-01..07,UXCTL-12..14 |
| S245 | Должна быть возможность проследить задание через этапы обработки и связанные ошибки. | OBSERV-01..35,PO-01..07,UXCTL-12..14 |
| S246 | Отдельно показывать, работает ли компонент и готов ли он принимать новые операции. | OBSERV-01..35,PO-01..07,UXCTL-12..14 |
| S247 | Диагностический пакет доступен в JSON для машинного анализа и Markdown для чтения человеком. | OBSERV-01..35,PO-01..07,UXCTL-12..14 |
| S248 | Версия release, окружение, build/commit и версия схемы данных доступны администратору. | OBSERV-01..35,PO-01..07,UXCTL-12..14 |
| S249 | Диагностические события сначала объясняют проблему и безопасное действие; технические идентификаторы и расширенные поля раскрываются отдельно. | OBSERV-01..35,PO-01..07,UXCTL-12..14 |
| S250 | Поиск связанной операции не должен требовать знания её точного ID: доступен выбор недавней операции или поиск без чувствительности к регистру. | OBSERV-01..35,PO-01..07,UXCTL-12..14, UXN-09 |
| S251 | Журналы должны минимизировать пользовательское содержимое и исключать секреты. | OBSERV-01..35,PO-01..07,UXCTL-12..14 |
| S252 | Автоматические уведомления администратору о критических ошибках, зависшей очереди, недоступности провайдеров и проблемах очистки или резервного копирования. | OBSERV-01..35,PO-01..07,UXCTL-12..14 |
| S253 | Предупреждения о приближении к ограничениям хранилища, API и расходов. | OBSERV-01..35,PO-01..07,UXCTL-12..14 |
| S254 | Отдельный audit log с информацией о том, кто, когда и какое критическое действие выполнил и чем оно завершилось. | OBSERV-01..35,PO-01..07,UXCTL-12..14 |
| S255 | Audit log защищён от обычного изменения и удаления и не очищается вместе с пользовательской историей или аналитикой. | OBSERV-01..35,PO-01..07,UXCTL-12..14 |
| S256 | Уведомления о готовности результата или ошибке через Web Push и email с учётом разрешений пользователя и возможностей устройства. | JOBNOT-01..06,CNOT-01..08,CID-08..09 |
| S257 | Системные письма о подтверждении email, восстановлении доступа и безопасности отправляются с собственного домена. | JOBNOT-01..06,CNOT-01..08,CID-08..09, SECX-06 |
| S258 | Ошибка канала уведомлений не должна отменять выполненную обработку или делать результат недоступным в PWA. | JOBNOT-01..06,CNOT-01..08,CID-08..09 |
| S259 | Personal и commercial должны обновляться и откатываться независимо. | EVC-22,EVC-32,RELEAS-01..05,CINF-16..20,CSEC-19..20 |
| S260 | Перед обновлением проверяется наличие обязательных настроек и доступность необходимых ресурсов соответствующего окружения. | EVC-22,EVC-32,RELEAS-01..05,CINF-16..20,CSEC-19..20 |
| S261 | Регулярное резервное копирование данных с проверкой реального восстановления. | EVC-22,EVC-32,RELEAS-01..05,CINF-16..20,CSEC-19..20, REC-02, REC-03 |
| S262 | Должны быть определены допустимые потеря данных и время восстановления, а восстановление — проверено относительно этих ориентиров. | EVC-22,EVC-32,RELEAS-01..05,CINF-16..20,CSEC-19..20, REC-04, REC-05, REC-06 |
| S263 | Удалённые пользователем данные не должны незаметно возвращаться в активное использование после восстановления старой резервной копии. | EVC-22,EVC-32,RELEAS-01..05,CINF-16..20,CSEC-19..20, REC-07 |
| S264 | Frontend: React, TypeScript, Vite и PWA. | EVC-01..50,CINF-01..20,DBLP-01..08,PWAWOR-01..03,STORAG-16..21 |
| S265 | Backend: Python и FastAPI. | EVC-01..50,CINF-01..20,DBLP-01..08,PWAWOR-01..03,STORAG-16..21 |
| S266 | Основная база данных: PostgreSQL; работа с данными — SQLAlchemy, изменения схемы — Alembic migrations. | EVC-01..50,CINF-01..20,DBLP-01..08,PWAWOR-01..03,STORAG-16..21 |
| S267 | Redis используется для ограничений запросов и других явно обоснованных общих служебных задач. | EVC-01..50,CINF-01..20,DBLP-01..08,PWAWOR-01..03,STORAG-16..21 |
| S268 | Серверная подготовка медиа — FFmpeg. Локальная обработка — поддерживаемые браузерные возможности с отдельными ограничениями. | EVC-01..50,CINF-01..20,DBLP-01..08,PWAWOR-01..03,STORAG-16..21 |
| S269 | Файловое хранение — S3-совместимые хранилища; развёртывание — Docker Compose и Nginx. | EVC-01..50,CINF-01..20,DBLP-01..08,PWAWOR-01..03,STORAG-16..21 |
| S270 | Основной codebase и main общие для personal и commercial, без постоянно расходящейся commercial-ветки. | EVC-01..50,CINF-01..20,DBLP-01..08,PWAWOR-01..03,STORAG-16..21 |
| S271 | В personal для серверных файлов используется Cloudflare R2. | EVC-01..50,CINF-01..20,DBLP-01..08,PWAWOR-01..03,STORAG-16..21 |
| S272 | Backend, PostgreSQL, S3, промежуточные файлы и резервные копии commercial размещаются на подходящей российской инфраструктуре. | EVC-01..50,CINF-01..20,DBLP-01..08,PWAWOR-01..03,STORAG-16..21 |
| S273 | У окружений отдельные базы, хранилища, домены, API-ключи, OAuth credentials, секреты и настройки. | EVC-01..50,CINF-01..20,DBLP-01..08,PWAWOR-01..03,STORAG-16..21 |
| S274 | Reference-файлы подготовки аудио и транскрибаций используют отдельные S3 buckets с независимыми политиками. | EVC-01..50,CINF-01..20,DBLP-01..08,PWAWOR-01..03,STORAG-16..21 |
| S275 | Google Drive и Яндекс Диск являются пользовательскими внешними подключениями, отдельными от внутреннего S3-хранения Studio. | EVC-01..50,CINF-01..20,DBLP-01..08,PWAWOR-01..03,STORAG-16..21 |
| S276 | Длительная обработка медиа должна быть отделена от обслуживания пользовательских запросов и ограничена по CPU, памяти и другим ресурсам. | EVC-01..50,CINF-01..20,DBLP-01..08,PWAWOR-01..03,STORAG-16..21 |
| S277 | Production-компоненты работают с минимально необходимыми правами; изменение схемы данных требует отдельных полномочий. | EVC-01..50,CINF-01..20,DBLP-01..08,PWAWOR-01..03,STORAG-16..21 |
| S278 | PostgreSQL не должен быть напрямую доступен из интернета. Для пользовательских данных commercial использовать RLS как дополнительный уровень изоляции. | EVC-01..50,CINF-01..20,DBLP-01..08,PWAWOR-01..03,STORAG-16..21 |
| S279 | Ключи шифрования хранятся отдельно от основной базы, а секреты одного окружения не используются в другом. | EVC-01..50,CINF-01..20,DBLP-01..08,PWAWOR-01..03,STORAG-16..21 |
| S280 | В personal Cloudflare Zero Trust может быть дополнительным внешним уровнем доступа, сохраняя собственную авторизацию и TOTP приложения. | EVC-01..50,CINF-01..20,DBLP-01..08,PWAWOR-01..03,STORAG-16..21 |
| S281 | Конкретные версии зависимостей, эксплуатационные настройки и технические детали ведутся вместе с кодом и документацией проекта. | EVC-01..50,CINF-01..20,DBLP-01..08,PWAWOR-01..03,STORAG-16..21 |
| S282 | Colab остаётся отдельным персональным вариантом с ограниченным набором функций; новые возможности PWA и commercial в него автоматически не переносятся. | COLABL-01..02 |
| S283 | Поддержка Colab ограничена исправлением необходимых ошибок в пределах его существующего назначения. | COLABL-01..02 |
| S284 | API-ключи задаются через Colab Secrets. | CB-01..24 |
| S285 | Выбор файлов или папки с устройства либо Google Drive, выбор целевой папки и языка, опциональное разделение на спикеров. | CB-01..24 |
| S286 | Создание Google Docs по общему стандарту оформления, учёт обработанных исходников в манифесте и возможность явно пропустить либо очистить его. | CB-01..24 |
| S287 | Стандартизация документов выбранной папки Google Drive и её вложенных папок. | CB-01..24 |
| S288 | Захват доступного звука вкладки или окна в Windows с возможностью включить микрофон. | CR-01..06 |
| S289 | Отображение live-текста и экспорт транскрипции в TXT в пределах поддерживаемых возможностей браузера и STT. | CR-01..06 |

## 8. Навигация

[README](../README.md), [AGENTS](../AGENTS.md), [delivery-plan](delivery-plan.md), [archive](delivery-plan-archive.md), [architecture](architecture.md), [processing contract](studio-processing-contract.md), [CI/CD rules](ci-cd-rules.md), [validation](runbooks/validation.md), [operations](runbooks/studio-platform-ops.md), [Colab realtime](runbooks/realtime-colab.md).

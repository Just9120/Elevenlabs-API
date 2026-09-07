# Спецификация проекта VoiceOps Studio

## 1. Назначение, источники и область

Canonical продуктовый контракт на русском языке. AC и правила находятся здесь; текущие статусы, Evidence, readiness, findings и checkpoint — только в [delivery-plan.md](delivery-plan.md). История исполнения — в [delivery-plan-archive.md](delivery-plan-archive.md).

Исходная декомпозиция выполнена в разрешённом AUDIT 2026-09-06. Правила workflow и оценки актуализированы по отдельному поручению владельца 2026-09-07. Product intent и стабильные AC сохранены; текущие полномочия и границы исполнения определяет [AGENTS](../AGENTS.md), а не исторический checkpoint.

Исходные требования (`Google Doc ID 1uaYvnqpbns_iyHTtQDZYjNYygT4ikUhmhuhRDWySrzI`) прочитаны через Google Drive; modifiedTime `2026-09-05T09:31:26.419Z`, Google revision `ANLCKQnVfm_EtgFLB0o55UiZZ4i8uq16A700xp0wG1GHyC3kk_gZAVlMlxSeBvaDLUdisiOWP9U8M987txWQoLV7tDmnJxNJh2ElGGTMG74`, один tab `t.0`. Повторное чтение текста/modifiedTime 2026-09-06 совпало с этим snapshot; revision ID/tab сохранены из прежней проверки. Нумерация `S001–S289` в source trace относится к 289 bullet paragraphs этой revision. Старые `R001–R275/N001–N008` относились к revision от 2026-08-27 и не применяются к новому порядку пунктов.

При предыдущей декомпозиции 2026-09-05 стабильные 610 прежних AC сохранены; 77 недостающих проверяемых AC добавлены в пределах текущего intent. Изменены формулировки PB-06/PM-05 (независимый результат), PTM-01 (название workspace), CID-13/14 (облака по контурам); основание — S007/031/122/123/138/143/176. Это не реализация и не расширение прежней Goal. Детализация, явно не отменённая последующим решением, сохранена; отсутствие повтора старого AC в новом документе само по себе его не удаляет.

## 2. Статусы и расчёт

Готовность = READY / все актуальные продуктовые и технические AC проверенного origin/main. READY подтверждают исполняемый код и подходящие автоматические проверки; известный дефект возвращает AC в работу. Статусы/Evidence — [AGENTS](../AGENTS.md#требования-findings-и-готовность); текущие числа — [delivery-plan](delivery-plan.md). Частичный AC не даёт доли, ALIAS/SUPERSEDED исключаются без потери трассировки. Ad-hoc/dogfooding сохраняется: плановая программа ручных тестов пользователя не требуется и не является gate. Незамерженные изменения показываются отдельно; продуктовые и технические критерии равноправны, finding сам по себе не создаёт AC. CR-06/PR-06 сохраняют согласованную revision 2 от 2026-09-06: требование стабильности остаётся, обязательной серии пользовательских sessions нет.

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
16. Заданные технологии S264–S281 являются durable constraints. Конкретные версии и команды принадлежат code/config и действующим [процедурам](runbooks/validation.md). Cloudflare Zero Trust остаётся опциональным, не обязательным deliverable.

## 4. Индекс эпиков и AC

| Canonical формулировки | Текущий реестр |
|---|---|
| [Colab](spec/colab.md) | [Статусы/Evidence](delivery/colab.md) |
| [Studio: существующие personal-подсистемы](spec/studio.md) | [Статусы/Evidence](delivery/studio.md) |
| [Studio: расширение согласованных сценариев](spec/extensions.md) | [Статусы/Evidence](delivery/extensions.md) |
| [Commercial и разделение контуров](spec/commercial.md) | [Статусы/Evidence](delivery/commercial.md) |

[Все исходные пункты S001–S289 и трассировка](spec/source-trace.md). Для каждого AC условие — разрешённый контур, роль и доступные prerequisites; действие/наблюдаемый результат заданы строкой, метод — под таблицей эпика. Неопределённый существенный параметр остаётся вопросом §6, а не произвольным default.

### Связи исключённых и изменённых ID

| Прежний ID | Canonical замена | Основание |
|---|---|---|
| `UXPOL-02` | `PTM-01` | Старое название заменено S143; актуальное workspace requirement в PTM-01. |
| `UXN-09` | `UXPOL-07` | Повторный подсчёт того же результата устранён; исходная формулировка сохранена в подсистеме. |
| `CINF-10` | `EVC-07` | Повторный подсчёт того же результата устранён; исходная формулировка сохранена в подсистеме. |
| `CINF-11` | `EVC-08` | Повторный подсчёт того же результата устранён; исходная формулировка сохранена в подсистеме. |
| `CINF-12` | `EVC-06` | Повторный подсчёт того же результата устранён; исходная формулировка сохранена в подсистеме. |
| `CINF-13` | `EVC-09` | Повторный подсчёт того же результата устранён; исходная формулировка сохранена в подсистеме. |
| `CINF-14` | `EVC-10` | Повторный подсчёт того же результата устранён; исходная формулировка сохранена в подсистеме. |
| `CLEG-07` | `CDG-24` | Повторный подсчёт того же результата устранён; исходная формулировка сохранена в подсистеме. |
| `CLEG-08` | `CDG-23` | Повторный подсчёт того же результата устранён; исходная формулировка сохранена в подсистеме. |
| `CLEG-09` | `CDG-25` | Повторный подсчёт того же результата устранён; исходная формулировка сохранена в подсистеме. |
| `CSEC-20` | `CINF-19` | Повторный подсчёт того же результата устранён; исходная формулировка сохранена в подсистеме. |
| `CSEC-16` | `CQF-01, CQF-03` | Повторный подсчёт того же результата устранён; исходная формулировка сохранена в подсистеме. |

Revision 2026-09-06: PT-03 использует согласованное название «Группа транскрибаций» (S016), UXPOL-07 явно включает выбор недавней операции без знания exact ID (S250; UXN-09 является alias). PB-06 сохраняет изменённый контракт независимого lifecycle; старое подтверждение Google-only реализации не подтверждает этот AC. Неизменившиеся ID и требования сохранены. Другие пересекающиеся AC имеют разный observable scope (например, общий contour contract и production verification); они не объединяются только из-за общего кода.

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

## 7. Навигация

- [Исходные требования и трассировка](spec/source-trace.md).
- [Dashboard и bounded Goal proposal](delivery-plan.md).
- [Архитектура](architecture.md), [processing contract](studio-processing-contract.md), [validation](runbooks/validation.md), [Studio operations](runbooks/studio-platform-ops.md).

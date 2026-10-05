# Реестр AC: Studio: расширение согласованных сценариев

Часть [delivery dashboard](../delivery-plan.md). Аудит 2026-10-04 на `origin/main` `9be46234b6961da076c6360adead845f382d592b`; текущие формулировки — [spec](../spec/extensions.md), источники — [trace](../spec/source-trace.md). CODE — проверка entrypoints/adapters/ownership; TEST — подходящие существующие synthetic suites, полный Linux CI A20261004-CI. ◐ означает ограниченное покрытие условий, а не долю AC. Runtime Evidence — в плане, не выводится из значка CI. Все строки повторно сверены; нерешённые внешние сценарии указаны в findings. ALIAS/SUPERSEDED исключены; отдельного процента ручной приёмки нет.

### `RESULTS-STUDIO-02`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `RS-01` | IN_PROGRESS | ◐ | ◐ | ✅ | A20261004; LiveTranscriptionPanel.tsx отображает текст, но canonical speaker/timed metadata и экспортируемая модель ещё не реализованы (F01/F05). |
| `RS-02` | BACKLOG | — | — | ✅ | A20261004; F01: downloadTranscript формирует только text/plain TXT; DOCX отсутствует. |
| `RS-03` | READY | ✅ | ✅ | ✅ | A20261004; LiveTranscriptionPanel.tsx explicit clear и generation fencing; realtime_drafts.py owner delete; realtime draft API/component regressions. |
| `RS-04` | SUPERSEDED | — | — | — | A20261004; Q125/Q128/Q129: cloud-free текст относится к Live, обычный результат — внешний документ; ID/связи сохранены, реализация отменённого поведения не требуется. |
| `RS-05` | READY | ✅ | ✅ | ✅ | A20261004; Durable job stages, attempt/output evidence, Google output tests; внешний реальный canary не выполнялся. |
| `RS-06` | IN_PROGRESS | ◐ | ◐ | ✅ | A20261004; F01: provider_part_checkpoint_ttl_seconds=86400; expired checkpoints отклоняются и очищаются. |
| `RS-07` | ALIAS | — | — | — | Audit quality review: Live TXT/recovered download уже PR-05/11; не считать дважды. |
| `RS-08` | IN_PROGRESS | ◐ | ◐ | ✅ | A20261004; Cached-result recovery не требует cost confirmation для полного cache (F43 fixed #319); F01: cache исчезает через24h, cancel lifecycle требует расширения. |
| `RS-09` | ALIAS | — | — | — | Audit quality review: Live TXT/recovered download уже PR-05/11; не считать дважды. |
| `RS-10` | BACKLOG | — | — | ✅ | A20261004; F01/F05: Live storage хранит строки, SRT/VTT download отсутствует. |
| `RS-11` | BACKLOG | — | — | ✅ | A20261004; F01: соответствующий export UI отсутствует. |
| `RS-12` | SUPERSEDED | — | — | — | A20261004; Q146/Q150: success только полный документ, без обещания восстановления утраченного внешнего документа; ID/связи сохранены, реализация отменённого поведения не требуется. |
| `RS-13` | BACKLOG | — | — | — | F01 |
| `RS-14` | SUPERSEDED | — | — | — | A20261004; Q125/Q131: постоянная обычная копия в S3 исключена; Live и transient text отдельны; ID/связи сохранены, реализация отменённого поведения не требуется. |
| `RS-15` | SUPERSEDED | — | — | — | A20261004; Q118/Q162: 3/7/30 относится к device source, Live без TTL; ID/связи сохранены, реализация отменённого поведения не требуется. |
| `RS-16` | SUPERSEDED | — | — | — | A20261004; Q118/Q164: expiry источника не expiry Live; ID/связи сохранены, реализация отменённого поведения не требуется. |
| `RS-17` | SUPERSEDED | — | — | — | A20261004; Q165/Q170/Q174: очистка текста/исходников разделена; ID/связи сохранены, реализация отменённого поведения не требуется. |

### `YANDEX-DISK-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `YD-01` | BACKLOG | — | — | — | F02 |
| `YD-02` | BACKLOG | — | — | — | F02 |
| `YD-03` | BACKLOG | — | — | — | F02 |
| `YD-04` | BACKLOG | — | — | — | F02 |
| `YD-05` | BACKLOG | — | — | — | F02 |
| `YD-06` | SUPERSEDED | — | — | — | A20261004; Q169: готовое подготовленное аудио скачивается либо сохраняется в Google Drive; ID/связи сохранены, реализация отменённого поведения не требуется. |
| `YD-07` | BACKLOG | — | — | — | F02 |
| `YD-08` | BACKLOG | — | — | — | F02 |
| `YD-09` | BACKLOG | — | — | — | F02 |

### `REALTIME-RECOVERY-03`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `RTC-01` | IN_PROGRESS | ◐ | ◐ | ✅ | F03 |
| `RTC-02` | IN_PROGRESS | ◐ | ◐ | ✅ | F03 |
| `RTC-03` | IN_PROGRESS | ◐ | ◐ | ✅ | F03 |
| `RTC-04` | IN_PROGRESS | ◐ | ◐ | ✅ | F03 |
| `RTC-05` | SUPERSEDED | — | — | — | A20261004; Q117: полная аудиозапись Live не требуется; ID/связи сохранены, реализация отменённого поведения не требуется. |
| `RTC-06` | IN_PROGRESS | ◐ | ◐ | ✅ | A20261004; F05: relay pending_final не индексирован; UI append committed strings. |
| `RTC-07` | SUPERSEDED | — | — | — | A20261004; Q118/Q120: вместо выбранного TTL — до ручной очистки; ID/связи сохранены, реализация отменённого поведения не требуется. |
| `RTC-08` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-REQUIREMENTS-05`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `UXN-01` | SUPERSEDED | — | — | — | A20261004; Q015: пользовательские Projects явно исключены; ID/связи сохранены, реализация отменённого поведения не требуется. |
| `UXN-02` | IN_PROGRESS | ◐ | ◐ | ✅ | Goal naming diff2026-10-06: title/date/dateTime choices, known UTC metadata preview/submission; missing dates остаются отсутствующими, local File.lastModified не используется.44 Python и affected component PASS; required CI/browser PENDING. |
| `UXN-03` | IN_PROGRESS | ◐ | ◐ | ✅ | F07 |
| `UXN-04` | IN_PROGRESS | ◐ | ◐ | ✅ | A20261004; Google destination реализован; Yandex Disk отсутствует (F02). |
| `UXN-05` | IN_PROGRESS | ◐ | ◐ | ✅ | F07 |
| `UXN-06` | IN_PROGRESS | ◐ | ◐ | ✅ | F07 |
| `UXN-07` | IN_PROGRESS | ◐ | ◐ | ✅ | F07 |
| `UXN-09` | ALIAS | — | — | — | Вне denominator; актуальные AC: UXPOL-07 |

### `MEDIA-CONTRACT-03`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `MC-01` | IN_PROGRESS | ◐ | ◐ | ✅ | F06 |
| `MC-03` | IN_PROGRESS | ◐ | ◐ | ✅ | F17; measured whole/selected duration и immutable tariff quote до STT, explicit exact token confirmation, unknown/legacy без fake0.173 Python/23 UI и App confirmation PASS; PG/CI/browser PENDING. |
| `MC-04` | IN_PROGRESS | ◐ | ◐ | ✅ | F17; a8bd66d whole-source limits4h/12h до provider clip/split;58 boundary/media tests PASS, required CI PENDING. |
| `MC-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `MC-06` | IN_PROGRESS | ◐ | ◐ | ✅ | F06 |
| `MC-07` | IN_PROGRESS | ◐ | ◐ | ✅ | F06 |
| `MC-08` | IN_PROGRESS | ◐ | ◐ | ✅ | F04/F06 |
| `MC-09` | IN_PROGRESS | ◐ | ◐ | ✅ | F05 |

### `PERSONAL-VOICE-02`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `VID-01` | IN_PROGRESS | ◐ | ◐ | ✅ | F08 |
| `VID-02` | IN_PROGRESS | ◐ | ◐ | ✅ | F08 |
| `VID-03` | IN_PROGRESS | ◐ | ◐ | ✅ | F08 |
| `VID-04` | IN_PROGRESS | ◐ | ◐ | ✅ | F08 |
| `VID-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `SECURITY-LIFECYCLE-03`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `SECX-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `SECX-02` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `SECX-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `SECX-04` | READY | ✅ | ✅ | ✅ | F52 исправлен #320/a666df1: enable TOTP/rotate recovery atomic revoke other owner sessions/devices, текущая/чужая session сохранены; Linux/main CI 37154958672/37155276745 PASS. |
| `SECX-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `SECX-06` | IN_PROGRESS | ◐ | ◐ | ✅ | CODE gap: job_notifications.py:205,468 поддерживает job completion/failure email с configurable From; отдельный flow системных access/security писем по S257 не подтверждён |

### `RECOVERY-DATA-03`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `REC-01` | IN_PROGRESS | ◐ | ◐ | ✅ | F10 |
| `REC-02` | IN_PROGRESS | ◐ | ◐ | ✅ | F10 |
| `REC-03` | IN_PROGRESS | ◐ | ◐ | ✅ | F10 |
| `REC-04` | IN_PROGRESS | ◐ | ◐ | ✅ | F10 |
| `REC-05` | IN_PROGRESS | ◐ | ◐ | ✅ | F10 |
| `REC-06` | IN_PROGRESS | ◐ | ◐ | ✅ | F10 |
| `REC-07` | IN_PROGRESS | ◐ | ◐ | ✅ | F10 |

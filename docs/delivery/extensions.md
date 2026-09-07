# Реестр AC: Studio: расширение согласованных сценариев

Часть [delivery dashboard](../delivery-plan.md), snapshot 2026-09-05T22:52:40+00:00, source `b8babc257abf7a33cda2df3c36c33570ee043108`. Формулировки — в [spec](../spec/extensions.md). SPEC PASS означает проверенную трассировку, CODE — source review, TEST PARTIAL — subsystem coverage без полного assertion dossier. По решению владельца 2026-09-06 `IMPLEMENTED` означает реализацию требования в коде и входит в готовность проекта. Прежний `READY` объединён с `IMPLEMENTED`; Evidence сохранено. `ALIAS`/`SUPERSEDED` не входят в счётчик. TEST/CI/DEPLOY/LIVE показывают технические проверки и поставку; их пробелы не создают обязательных заданий пользователю.

### `RESULTS-STUDIO-02`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `RS-01` | BACKLOG | — | — | — | — | — | F01 |
| `RS-02` | BACKLOG | — | — | — | — | — | F01 |
| `RS-03` | BACKLOG | — | — | — | — | — | F01 |
| `RS-04` | BACKLOG | — | — | — | — | — | F01 |
| `RS-05` | BACKLOG | — | — | — | — | — | F01 |
| `RS-06` | BACKLOG | — | — | — | — | — | F01 |
| `RS-07` | BACKLOG | — | — | — | — | — | F01 |
| `RS-08` | BACKLOG | — | — | — | — | — | F01 |
| `RS-09` | BACKLOG | — | — | — | — | — | F01 |
| `RS-10` | BACKLOG | — | — | — | — | — | F01 |
| `RS-11` | BACKLOG | — | — | — | — | — | F01 |
| `RS-12` | BACKLOG | — | — | — | — | — | F01 |
| `RS-13` | BACKLOG | — | — | — | — | — | F01 |
| `RS-14` | BACKLOG | — | — | — | — | — | F01 |
| `RS-15` | BACKLOG | — | — | — | — | — | F01 |
| `RS-16` | BACKLOG | — | — | — | — | — | F01 |
| `RS-17` | BACKLOG | — | — | — | — | — | F01 |

### `YANDEX-DISK-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `YD-01` | BACKLOG | — | — | — | — | — | F02 |
| `YD-02` | BACKLOG | — | — | — | — | — | F02 |
| `YD-03` | BACKLOG | — | — | — | — | — | F02 |
| `YD-04` | BACKLOG | — | — | — | — | — | F02 |
| `YD-05` | BACKLOG | — | — | — | — | — | F02 |
| `YD-06` | BACKLOG | — | — | — | — | — | F02 |
| `YD-07` | BACKLOG | — | — | — | — | — | F02 |
| `YD-08` | BACKLOG | — | — | — | — | — | F02 |
| `YD-09` | BACKLOG | — | — | — | — | — | F02 |

### `REALTIME-RECOVERY-03`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `RTC-01` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F03 |
| `RTC-02` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F03 |
| `RTC-03` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F03 |
| `RTC-04` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F03 |
| `RTC-05` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F03 |
| `RTC-06` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F03 |
| `RTC-07` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F03 |
| `RTC-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-REQUIREMENTS-05`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `UXN-01` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F07 |
| `UXN-02` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F07 |
| `UXN-03` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F07 |
| `UXN-04` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F07 |
| `UXN-05` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F07 |
| `UXN-06` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F07 |
| `UXN-07` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F07 |
| `UXN-09` | ALIAS | — | — | — | — | — | Вне denominator; актуальные AC: UXPOL-07 |

### `MEDIA-CONTRACT-03`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `MC-01` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F06 |
| `MC-03` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F06 |
| `MC-04` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F06 |
| `MC-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `MC-06` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F06 |
| `MC-07` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F06 |
| `MC-08` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F04/F06 |
| `MC-09` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F05 |

### `PERSONAL-VOICE-02`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `VID-01` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F08 |
| `VID-02` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F08 |
| `VID-03` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F08 |
| `VID-04` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F08 |
| `VID-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `SECURITY-LIFECYCLE-03`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `SECX-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `SECX-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `SECX-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `SECX-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `SECX-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `SECX-06` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | CODE gap: job_notifications.py:205,468 поддерживает job completion/failure email с configurable From; отдельный flow системных access/security писем по S257 не подтверждён |

### `RECOVERY-DATA-03`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `REC-01` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F10 |
| `REC-02` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F10 |
| `REC-03` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F10 |
| `REC-04` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F10 |
| `REC-05` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F10 |
| `REC-06` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F10 |
| `REC-07` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F10 |

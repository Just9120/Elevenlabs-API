# Реестр AC: Studio: существующие personal-подсистемы

Часть [delivery dashboard](../delivery-plan.md), snapshot 2026-09-06T14:36Z (AP-11/UXCTL-07: deployed 84ae25f, V27; прочие строки — аудит 2026-09-06 MSK), source `b8babc257abf7a33cda2df3c36c33570ee043108`. Формулировки — в [spec](../spec/studio.md). SPEC PASS означает проверенную трассировку, CODE — source review, TEST PARTIAL — subsystem coverage без полного assertion dossier. По решению владельца 2026-09-06 `IMPLEMENTED` означает реализацию требования в коде и входит в готовность проекта. Прежний `READY` объединён с `IMPLEMENTED`; Evidence сохранено. `ALIAS`/`SUPERSEDED` не входят в счётчик. TEST/CI/DEPLOY/LIVE показывают технические проверки и поставку; их пробелы не создают обязательных заданий пользователю.

### `PWA-CORE-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PC-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PC-02` | IMPLEMENTED | ✅ | ✅ | ✅ | ✅ | ✅ | V26-BROWSER + V26-CD + V26-CI; полный узкий AC подтверждён |
| `PC-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PC-04` | IMPLEMENTED | ✅ | ✅ | ✅ | ✅ | ✅ | V26-BROWSER + V26-CD + V26-CI; полный узкий AC подтверждён |
| `PC-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PC-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PC-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PC-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PC-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PC-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PC-11` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PC-12` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PC-13` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PC-14` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-USER-EXPERIENCE-02`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PUX-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PUX-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PUX-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PUX-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PUX-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PUX-06` | IMPLEMENTED | ✅ | ◐ | — | — | — | V28-LOCAL / 9ab6926: исправлены F22–F24 (reauth/retry, preview cancellation, notices); targeted и full tests PASS; CI/CD/LIVE этой revision PENDING. Предыдущие Evidence V27 сохранены в dashboard. |
| `PUX-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PUX-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PUX-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PUX-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PUX-11` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PUX-12` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PUX-13` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-UX-POLISH-03`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `UXPOL-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXPOL-02` | SUPERSEDED | — | — | — | — | — | Вне denominator; актуальные AC: PTM-01 |
| `UXPOL-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXPOL-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXPOL-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXPOL-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXPOL-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Поиск/выбор уже реализован, App.tsx:9437–9454; V26-WEB PASS; browser scenario PENDING |
| `UXPOL-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-UX-CONTROLS-04`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `UXCTL-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXCTL-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXCTL-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXCTL-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXCTL-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXCTL-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXCTL-07` | IMPLEMENTED | ✅ | ✅ | — | — | — | V28-LOCAL / 9ab6926: исправлены F22–F24 (reauth/retry, preview cancellation, notices); targeted и full tests PASS; CI/CD/LIVE этой revision PENDING. Предыдущие Evidence V27 сохранены в dashboard. |
| `UXCTL-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXCTL-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXCTL-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXCTL-11` | IMPLEMENTED | ✅ | ◐ | — | — | — | V28-LOCAL / 9ab6926: исправлены F22–F24 (reauth/retry, preview cancellation, notices); targeted и full tests PASS; CI/CD/LIVE этой revision PENDING. Предыдущие Evidence V27 сохранены в dashboard. |
| `UXCTL-12` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXCTL-13` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXCTL-14` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-TRANSCRIPTIONS-UX-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PT-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PT-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PT-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PT-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-INGEST-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PI-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PI-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PI-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PI-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PI-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PI-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PI-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PI-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PI-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PI-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PI-11` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-GOOGLE-PICKER-UX-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PG-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PG-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PG-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PG-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PG-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PG-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PG-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PG-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-SEGMENTS-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PS-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PS-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PS-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PS-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PS-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-BATCH-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PB-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PB-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PB-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PB-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PB-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PB-06` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F01: lifecycle Studio/export пока общий |
| `PB-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PB-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PB-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PB-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PB-11` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-AUDIO-PREPARATION-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `AP-01` | IMPLEMENTED | ✅ | ✅ | ✅ | ✅ | ✅ | V26-BROWSER + V26-CD + V26-CI; полный узкий AC подтверждён |
| `AP-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-11` | IMPLEMENTED | ✅ | ✅ | ✅ | ✅ | ◐ | V27 / PR #302: full dotted Unicode title, processor/API и actual local download; web/API/worker 84ae25f. Новый Drive side effect не выполнялся в проверках агента; это ограничение Evidence |
| `AP-12` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-13` | IMPLEMENTED | ✅ | ◐ | — | — | — | V28-LOCAL / 9ab6926: исправлены F22–F24 (reauth/retry, preview cancellation, notices); targeted и full tests PASS; CI/CD/LIVE этой revision PENDING. Предыдущие Evidence V27 сохранены в dashboard. |
| `AP-14` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-15` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-16` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-17` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-18` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-19` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-20` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-21` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-22` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-23` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-24` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-25` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-26` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-27` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-28` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-29` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-30` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-SPEAKER-IDENTITY-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `SP-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `SP-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `SP-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `SP-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `SP-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-MANIFEST-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PM-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PM-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PM-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PM-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PM-05` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F01 |
| `PM-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-STANDARDIZATION-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PD-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-11` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-12` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-13` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-14` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-TRANSCRIPT-MAINTENANCE-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PTM-01` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F07 |
| `PTM-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PTM-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PTM-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PTM-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PTM-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PTM-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PTM-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PTM-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-REALTIME-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PR-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PR-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PR-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PR-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PR-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PR-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE 84ae25f: realtimeSession.ts:340–439 — capture ownership, source loss, mix и cleanup; realtimeSession.test.ts:222–402 — permission/source cases. Full production capture matrix не запускалась |
| `PR-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PR-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PR-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PR-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PR-11` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PR-12` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PR-13` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-OPERABILITY-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PO-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-11` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-12` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-13` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-14` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F06: Yandex в analytics отображается как unknown |
| `PO-15` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-16` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-17` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-18` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-SECURITY-HARDENING-02`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PWASEC-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-11` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-12` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-13` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-14` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-15` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-16` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-17` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-18` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `GOOGLE-DRIVE-RELIABILITY-02`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `GOOGLE-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `GOOGLE-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `GOOGLE-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `GOOGLE-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `GOOGLE-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `GOOGLE-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `STORAGE-LIFECYCLE-02`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `STORAG-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-05` | BACKLOG | — | — | — | — | — | F10 |
| `STORAG-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-10` | BACKLOG | — | — | — | — | — | F10 |
| `STORAG-11` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-12` | BACKLOG | — | — | — | — | — | F10 |
| `STORAG-13` | BACKLOG | — | — | — | — | — | F10 |
| `STORAG-14` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-15` | BACKLOG | — | — | — | — | — | F10 |
| `STORAG-16` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-17` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-18` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-19` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-20` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-21` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `STT-PROVIDER-ABSTRACTION-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `STTPRO-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STTPRO-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STTPRO-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STTPRO-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STTPRO-05` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F05 |
| `STTPRO-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STTPRO-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STTPRO-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STTPRO-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STTPRO-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STTPRO-11` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STTPRO-12` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STTPRO-13` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STTPRO-14` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `YANDEX-STT-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `YANDEX-01` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F04 |
| `YANDEX-02` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F04 |
| `YANDEX-03` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F05 |
| `YANDEX-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `YANDEX-05` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F04 |

### `PWA-DICTIONARIES-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PWADIC-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-WORKER-ISOLATION-02`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PWAWOR-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWAWOR-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWAWOR-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-DATABASE-LEAST-PRIVILEGE-03`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `DBLP-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `DBLP-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `DBLP-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `DBLP-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `DBLP-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `DBLP-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `DBLP-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `DBLP-08` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | V-RESTORE: role/preflight scripts есть; полнота всей backup→switch→compatible recovery процедуры требует технического разбора агентом |

### `JOB-RELIABILITY-02`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `JOBREL-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-11` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-12` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-13` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-14` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-15` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-16` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-17` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `JOB-NOTIFICATIONS-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `JOBNOT-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBNOT-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBNOT-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBNOT-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBNOT-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBNOT-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `REALTIME-CONTINUITY-02`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `REALTI-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `REALTI-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `REALTI-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `REALTI-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `REALTI-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `TRANSCRIPT-EXPORTS-02`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `TRANSC-01` | BACKLOG | — | — | — | — | — | F01 |
| `TRANSC-02` | BACKLOG | — | — | — | — | — | F01 |
| `TRANSC-03` | BACKLOG | — | — | — | — | — | F01 |

### `USAGE-COST-ACCOUNTING-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `USAGEC-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `USAGEC-02` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F11 |
| `USAGEC-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `USAGEC-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `USAGEC-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `USAGEC-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `OBSERVABILITY-AUDIT-02`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `OBSERV-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-11` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-12` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-13` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-14` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-15` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-16` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-17` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-18` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-19` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-20` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-21` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-22` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-23` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-24` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-25` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-26` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-27` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-28` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-29` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-30` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-31` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-32` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-33` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-34` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-35` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `RELEASE-SAFETY-02`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `RELEAS-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `RELEAS-02` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | V-RESTORE: worker rollback реализован в manage_studio_worker.sh:230; полнота recovery для всей personal topology не установлена, технический gap агента |
| `RELEAS-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `RELEAS-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `RELEAS-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

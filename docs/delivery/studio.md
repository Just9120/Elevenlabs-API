# Реестр AC: Studio: существующие personal-подсистемы

Часть [delivery dashboard](../delivery-plan.md), snapshot 2026-09-06T14:36Z (AP-11/UXCTL-07: deployed 84ae25f, V27; прочие строки — аудит 2026-09-06 MSK), source `b8babc257abf7a33cda2df3c36c33570ee043108`. Формулировки — в [spec](../spec/studio.md). SPEC PASS означает проверенную трассировку, CODE — source review, TEST PARTIAL — subsystem coverage без полного assertion dossier. `IMPLEMENTED` не означает приёмку. `ALIAS`/`SUPERSEDED` не входят в счётчик. У READY строк закрыт узкий наблюдаемый AC; остальная историческая приёмка требует проверки records.

### `PWA-CORE-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PC-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PC-02` | READY | ✅ | ✅ | ✅ | ✅ | ✅ | V26-BROWSER + V26-CD + V26-CI; полный узкий AC подтверждён |
| `PC-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PC-04` | READY | ✅ | ✅ | ✅ | ✅ | ✅ | V26-BROWSER + V26-CD + V26-CI; полный узкий AC подтверждён |
| `PC-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PC-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PC-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PC-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PC-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PC-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PC-11` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PC-12` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PC-13` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PC-14` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `PWA-USER-EXPERIENCE-02`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PUX-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PUX-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PUX-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PUX-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PUX-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PUX-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PUX-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PUX-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PUX-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PUX-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PUX-11` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PUX-12` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PUX-13` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `PWA-UX-POLISH-03`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `UXPOL-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `UXPOL-02` | SUPERSEDED | — | — | — | — | — | Вне denominator; актуальные AC: PTM-01 |
| `UXPOL-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `UXPOL-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `UXPOL-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `UXPOL-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `UXPOL-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | Поиск/выбор уже реализован, App.tsx:9437–9454; V26-WEB PASS; browser scenario PENDING |
| `UXPOL-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `PWA-UX-CONTROLS-04`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `UXCTL-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `UXCTL-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `UXCTL-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `UXCTL-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `UXCTL-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `UXCTL-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `UXCTL-07` | IMPLEMENTED | ✅ | ✅ | ✅ | ✅ | ◐ | V27 / PR #302: explicit closure, owner/source/clip matching, no-case, timeout/reauth; real API E2E и production read-only UI PASS. Решение по старому результату за владельцем |
| `UXCTL-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `UXCTL-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `UXCTL-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `UXCTL-11` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `UXCTL-12` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `UXCTL-13` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `UXCTL-14` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `PWA-TRANSCRIPTIONS-UX-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PT-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PT-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PT-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PT-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `PWA-INGEST-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PI-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PI-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PI-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PI-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PI-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PI-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PI-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PI-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PI-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PI-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PI-11` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `PWA-GOOGLE-PICKER-UX-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PG-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PG-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PG-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PG-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PG-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PG-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PG-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PG-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `PWA-SEGMENTS-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PS-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PS-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PS-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PS-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PS-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `PWA-BATCH-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PB-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PB-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PB-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PB-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PB-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PB-06` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F01: lifecycle Studio/export пока общий |
| `PB-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PB-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PB-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PB-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PB-11` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `PWA-AUDIO-PREPARATION-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `AP-01` | READY | ✅ | ✅ | ✅ | ✅ | ✅ | V26-BROWSER + V26-CD + V26-CI; полный узкий AC подтверждён |
| `AP-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-11` | IMPLEMENTED | ✅ | ✅ | ✅ | ✅ | ◐ | V27 / PR #302: full dotted Unicode title, processor/API и actual local download; web/API/worker 84ae25f. Новое реальное Drive сохранение владельцем PENDING |
| `AP-12` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-13` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-14` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-15` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-16` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-17` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-18` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-19` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-20` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-21` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-22` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-23` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-24` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-25` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-26` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-27` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-28` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-29` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `AP-30` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `PWA-SPEAKER-IDENTITY-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `SP-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `SP-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `SP-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `SP-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `SP-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `PWA-MANIFEST-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PM-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PM-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PM-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PM-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PM-05` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F01 |
| `PM-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `PWA-STANDARDIZATION-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PD-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PD-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PD-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PD-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PD-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PD-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PD-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PD-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PD-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PD-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PD-11` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PD-12` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PD-13` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PD-14` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `PWA-TRANSCRIPT-MAINTENANCE-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PTM-01` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F07 |
| `PTM-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PTM-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PTM-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PTM-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PTM-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PTM-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PTM-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PTM-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `PWA-REALTIME-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PR-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PR-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PR-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PR-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PR-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PR-06` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | Полнота реализации или runtime-only условие не подтверждены; dossier PENDING |
| `PR-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PR-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PR-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PR-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PR-11` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PR-12` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PR-13` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `PWA-OPERABILITY-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PO-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PO-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PO-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PO-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PO-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PO-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PO-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PO-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PO-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PO-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PO-11` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PO-12` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PO-13` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PO-14` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F06: Yandex в analytics отображается как unknown |
| `PO-15` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PO-16` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PO-17` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PO-18` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `PWA-SECURITY-HARDENING-02`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PWASEC-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PWASEC-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PWASEC-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PWASEC-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PWASEC-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PWASEC-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PWASEC-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PWASEC-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PWASEC-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PWASEC-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PWASEC-11` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PWASEC-12` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PWASEC-13` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PWASEC-14` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PWASEC-15` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PWASEC-16` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PWASEC-17` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PWASEC-18` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `GOOGLE-DRIVE-RELIABILITY-02`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `GOOGLE-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `GOOGLE-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `GOOGLE-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `GOOGLE-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `GOOGLE-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `GOOGLE-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `STORAGE-LIFECYCLE-02`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `STORAG-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STORAG-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STORAG-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STORAG-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STORAG-05` | BACKLOG | — | — | — | — | — | F10 |
| `STORAG-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STORAG-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STORAG-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STORAG-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STORAG-10` | BACKLOG | — | — | — | — | — | F10 |
| `STORAG-11` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STORAG-12` | BACKLOG | — | — | — | — | — | F10 |
| `STORAG-13` | BACKLOG | — | — | — | — | — | F10 |
| `STORAG-14` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STORAG-15` | BACKLOG | — | — | — | — | — | F10 |
| `STORAG-16` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STORAG-17` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STORAG-18` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STORAG-19` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STORAG-20` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STORAG-21` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `STT-PROVIDER-ABSTRACTION-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `STTPRO-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STTPRO-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STTPRO-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STTPRO-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STTPRO-05` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F05 |
| `STTPRO-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STTPRO-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STTPRO-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STTPRO-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STTPRO-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STTPRO-11` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STTPRO-12` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STTPRO-13` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `STTPRO-14` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `YANDEX-STT-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `YANDEX-01` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F04 |
| `YANDEX-02` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F04 |
| `YANDEX-03` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F05 |
| `YANDEX-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `YANDEX-05` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F04 |

### `PWA-DICTIONARIES-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PWADIC-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `PWA-WORKER-ISOLATION-02`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `PWAWOR-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PWAWOR-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `PWAWOR-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `PWA-DATABASE-LEAST-PRIVILEGE-03`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `DBLP-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `DBLP-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `DBLP-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `DBLP-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `DBLP-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `DBLP-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `DBLP-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `DBLP-08` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | V-RESTORE |

### `JOB-RELIABILITY-02`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `JOBREL-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `JOBREL-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `JOBREL-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `JOBREL-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `JOBREL-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `JOBREL-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `JOBREL-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `JOBREL-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `JOBREL-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `JOBREL-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `JOBREL-11` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `JOBREL-12` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `JOBREL-13` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `JOBREL-14` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `JOBREL-15` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `JOBREL-16` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `JOBREL-17` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `JOB-NOTIFICATIONS-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `JOBNOT-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `JOBNOT-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `JOBNOT-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `JOBNOT-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `JOBNOT-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `JOBNOT-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `REALTIME-CONTINUITY-02`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `REALTI-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `REALTI-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `REALTI-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `REALTI-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `REALTI-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `TRANSCRIPT-EXPORTS-02`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `TRANSC-01` | BACKLOG | — | — | — | — | — | F01 |
| `TRANSC-02` | BACKLOG | — | — | — | — | — | F01 |
| `TRANSC-03` | BACKLOG | — | — | — | — | — | F01 |

### `USAGE-COST-ACCOUNTING-01`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `USAGEC-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `USAGEC-02` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | F11 |
| `USAGEC-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `USAGEC-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `USAGEC-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `USAGEC-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `OBSERVABILITY-AUDIT-02`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `OBSERV-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-02` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-06` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-07` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-08` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-09` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-10` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-11` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-12` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-13` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-14` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-15` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-16` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-17` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-18` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-19` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-20` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-21` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-22` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-23` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-24` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-25` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-26` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-27` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-28` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-29` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-30` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-31` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-32` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-33` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-34` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `OBSERV-35` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

### `RELEASE-SAFETY-02`

| AC | Состояние | CODE | TEST | CI | DEPLOY | LIVE | Остаток / Evidence |
|---|---|---|---|---|---|---|---|
| `RELEAS-01` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `RELEAS-02` | IN_PROGRESS | ◐ | ◐ | ✅ | ◐ | — | V-RESTORE |
| `RELEAS-03` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `RELEAS-04` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |
| `RELEAS-05` | IMPLEMENTED | ✅ | ◐ | ✅ | ◐ | — | CODE/subsystem checks есть; dossier сценария и применимый LIVE PENDING |

# Реестр AC: Studio: существующие personal-подсистемы

Часть [delivery dashboard](../delivery-plan.md). Аудит 2026-10-04 на `origin/main` `9be46234b6961da076c6360adead845f382d592b`; текущие формулировки — [spec](../spec/studio.md), источники — [trace](../spec/source-trace.md). CODE — проверка entrypoints/adapters/ownership; TEST — подходящие существующие synthetic suites, полный Linux CI A20261004-CI. ◐ означает ограниченное покрытие условий, а не долю AC. Runtime Evidence — в плане, не выводится из значка CI. Все строки повторно сверены; нерешённые внешние сценарии указаны в findings. ALIAS/SUPERSEDED исключены; отдельного процента ручной приёмки нет.

### `PWA-CORE-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `PC-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PC-02` | READY | ✅ | ✅ | ✅ | V26-BROWSER + V26-CD + V26-CI; полный узкий AC подтверждён |
| `PC-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PC-04` | READY | ✅ | ✅ | ✅ | V26-BROWSER + V26-CD + V26-CI; полный узкий AC подтверждён |
| `PC-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PC-06` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PC-07` | READY | ✅ | ✅ | ✅ | F46 исправлен #320/a666df1: exact initiating-session binding, чужая/отозванная/истёкшая session fail-closed; Linux CI 37154958672 и main CI 37155276745 PASS. |
| `PC-08` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PC-09` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PC-10` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PC-11` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PC-12` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PC-13` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PC-14` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PC-15` | READY | ✅ | ✅ | ✅ | Восстановлено по code и primary records 2026-09-30: PR #312/e01bc91, CI 35970014222/35970014302, web CD 35970355470 SUCCESS. |
| `PC-16` | READY | ✅ | ✅ | ✅ | Восстановлено по code и primary records 2026-09-30: PR #312/e01bc91, CI 35970014222/35970014302, web CD 35970355470 SUCCESS. |

### `PWA-USER-EXPERIENCE-02`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `PUX-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PUX-02` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PUX-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PUX-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PUX-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PUX-06` | READY | ✅ | ✅ | ✅ | PR #309 merge 0d41180: local audio validation раскрывает настройки, фокусирует неверное поле и показывает inline/ARIA error; Vitest 751/751, Studio CI и browser-e2e PASS, web/API CD 35962179284 PASS. |
| `PUX-07` | READY | ✅ | ✅ | ✅ | PR #310 доставил `source_names`, PR #311 убрал второе отображение имени внутри группы; targeted/full Vitest 239/752 PASS, PR CI 35967620882/35967621016 и main CI 35967953699/35967953526 PASS. Web CD 35967953684, live web `02fc21d`: имя ровно один раз, номер элемента сохранён. |
| `PUX-08` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PUX-09` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PUX-10` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PUX-11` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PUX-12` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PUX-13` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-UX-POLISH-03`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `UXPOL-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXPOL-02` | SUPERSEDED | — | — | — | Вне denominator; актуальные AC: PTM-01 |
| `UXPOL-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXPOL-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXPOL-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXPOL-06` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXPOL-07` | READY | ✅ | ◐ | ✅ | Поиск/выбор уже реализован, App.tsx:9437–9454; V26-WEB PASS; browser scenario PENDING |
| `UXPOL-08` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-UX-CONTROLS-04`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `UXCTL-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXCTL-02` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXCTL-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXCTL-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXCTL-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXCTL-06` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXCTL-07` | READY | ✅ | ✅ | ✅ | V28-DELIVERY / PR #303 / web 3e65322: F22–F24 закрыты; PR/main CI PASS. Read-only LIVE подтверждает доступность интерфейса; destructive production scenario не выполнялся. Regression поведение проверено synthetic tests. |
| `UXCTL-08` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXCTL-09` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXCTL-10` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXCTL-11` | READY | ✅ | ◐ | ✅ | V28-DELIVERY / PR #303 / web 3e65322: F22–F24 закрыты; PR/main CI PASS. Read-only LIVE подтверждает доступность интерфейса; destructive production scenario не выполнялся. Regression поведение проверено synthetic tests. |
| `UXCTL-12` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXCTL-13` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `UXCTL-14` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-TRANSCRIPTIONS-UX-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `PT-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PT-02` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PT-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PT-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-INGEST-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `PI-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PI-02` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PI-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PI-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PI-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PI-06` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PI-07` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PI-08` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PI-09` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PI-10` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PI-11` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-GOOGLE-PICKER-UX-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `PG-01` | READY | ✅ | ✅ | ◐ | V30-LAYOUT-LOCAL: исправлена grid regression после #305; geometry PASS desktop/mobile, remote E2E/merge и production smoke этой поправки PENDING |
| `PG-02` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PG-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PG-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PG-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PG-06` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PG-07` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PG-08` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PG-09` | READY | ✅ | ✅ | ⏳ | V30-DELIVERY: #305/a56afb8, required CI и web/API/worker CD PASS; real numeric/sorting smoke PASS, Google writes покрыты fakes |

### `PWA-SEGMENTS-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `PS-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PS-02` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PS-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PS-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PS-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-BATCH-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `PB-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PB-02` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PB-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PB-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PB-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PB-06` | READY | ✅ | ✅ | ✅ | A20261004; job_processing_orchestrator.py, job_google_docs_output.py; тесты Google output/orchestration. Яндекс Диск учитывается отдельно YD-05; не реализован. |
| `PB-07` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PB-08` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PB-09` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PB-10` | IN_PROGRESS | ◐ | ◐ | ✅ | A20261004; F06: unknown creation metadata подставляется как placeholder; корректная дата для доступного источника есть, отсутствие даты и provenance не закрыты. |
| `PB-11` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-AUDIO-PREPARATION-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `AP-01` | READY | ✅ | ✅ | ✅ | V26-BROWSER + V26-CD + V26-CI; полный узкий AC подтверждён |
| `AP-02` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-06` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-07` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-08` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-09` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-10` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-11` | READY | ✅ | ✅ | ✅ | V27 / PR #302: full dotted Unicode title, processor/API и actual local download; web/API/worker 84ae25f. Новый Drive side effect не выполнялся в проверках агента; это ограничение Evidence |
| `AP-12` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-13` | READY | ✅ | ✅ | ✅ | F41 исправлен #318/8d9f45d: output сохранён до initial Drive export, cancellation/recovery; CI 36701312137/36701312154 PASS, current main CI 37155276745/37155276751 PASS. |
| `AP-14` | IN_PROGRESS | ◐ | ◐ | ✅ | Goal local audio diff2026-10-06: processor сохраняет только metadata, download/Drive заново собирает bytes из originals через worker; finished S3 writer удалён, legacy reads сохранены. Synthetic worker/lifecycle tests PASS; PostgreSQL/API/Linux/browser gate PENDING. |
| `AP-15` | READY | ✅ | ✅ | ✅ | F41 исправлен #318/8d9f45d: output сохранён до initial Drive export, cancellation/recovery; CI 36701312137/36701312154 PASS, current main CI 37155276745/37155276751 PASS. |
| `AP-16` | IN_PROGRESS | ◐ | ◐ | ✅ | b46f6f1 + Goal audio diff: выбранные3/7/30 дней и exact deadline, request-scoped scratch/partial cleanup, active regeneration source fence. Synthetic local tests PASS; PostgreSQL/Linux gate PENDING. |
| `AP-17` | READY | ✅ | ✅ | ✅ | PR #309 merge 0d41180: локальный результат остаётся доступным при переходе между разделами той же вкладки; regression App component и 751/751 Vitest PASS, Studio CI/browser-e2e и web CD 35962179284 PASS. Обновление/закрытие вкладки не обещает durable storage. |
| `AP-18` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-19` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-20` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-21` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-22` | READY | ✅ | ✅ | ⏳ | V30-DELIVERY: #305/a56afb8, required CI и web/API/worker CD PASS; real numeric/sorting smoke PASS, Google writes покрыты fakes |
| `AP-23` | IN_PROGRESS | ◐ | ◐ | ✅ | Owner decision2026-10-05 заменяет finished-storage reload контракт сборкой из retained originals. Goal diff: streamed download/restart/cancel/deadline, posthoc Drive idempotency, confirmed Drive Source handoff;24 component tests PASS. PostgreSQL/API/Linux/browser gate PENDING; historical F41/PR318 Evidence относится к прежнему storage contract. |
| `AP-24` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-25` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-26` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-27` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-28` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-29` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `AP-31` | IN_PROGRESS | ◐ | ◐ | ✅ | Goal audio visual diff2026-10-06: bounded waveform/паузы/сокращения и длительности; local PCM playback, server preview sample до30s и regenerated result native playback.82 Python PASS (real mono/stereo decoder),37 UI PASS, TypeScript/ESLint PASS. Owner/CSRF/Sec-Fetch/range API tests добавлены; Linux/PostgreSQL/browser gate PENDING. |
| `AP-30` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-SPEAKER-IDENTITY-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `SP-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `SP-02` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `SP-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `SP-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `SP-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-MANIFEST-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `PM-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PM-02` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PM-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PM-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PM-05` | IN_PROGRESS | ◐ | ◐ | ✅ | A20261004; Полный Google Doc и failed export guards реализованы; общий контракт для DOCX на Яндекс Диске не реализован (F02). Восстановление текста до явной отмены нарушено TTL (F01). |
| `PM-06` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PM-07` | READY | ✅ | ✅ | ✅ | PR #313–#316 поставлены; последний merge `3902b2a`, main CI 36285760379/36285760427 и web/API CD 36285760435 PASS. Принятый связанный catalog-result блокирует подтверждение отсутствия; private replay исходного файла не проверен. |

### `PWA-STANDARDIZATION-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `PD-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-02` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-06` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-07` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-08` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-09` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-10` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-11` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-12` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-13` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PD-14` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-TRANSCRIPT-MAINTENANCE-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `PTM-01` | IN_PROGRESS | ◐ | ◐ | ✅ | F07 |
| `PTM-02` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PTM-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PTM-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PTM-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PTM-06` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PTM-07` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PTM-08` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PTM-09` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-REALTIME-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `PR-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PR-02` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PR-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PR-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PR-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PR-06` | READY | ✅ | ◐ | ✅ | CODE 84ae25f: realtimeSession.ts:340–439 — capture ownership, source loss, mix и cleanup; realtimeSession.test.ts:222–402 — permission/source cases. Full production capture matrix не запускалась |
| `PR-07` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PR-08` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PR-09` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PR-10` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PR-11` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PR-12` | IN_PROGRESS | ◐ | ◐ | ✅ | A20261004; F58: config.py realtime_draft_ttl_seconds=259200 (фиксированное 72h); realtime_drafts.py фильтрует и удаляет expired rows. Начало сессии само текст не очищает. |
| `PR-13` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-OPERABILITY-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `PO-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-02` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-06` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-07` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-08` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-09` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-10` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-11` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-12` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-13` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-14` | IN_PROGRESS | ◐ | ◐ | ✅ | F06: Yandex в analytics отображается как unknown |
| `PO-15` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-16` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-17` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PO-18` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-SECURITY-HARDENING-02`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `PWASEC-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-02` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-06` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-07` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-08` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-09` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-10` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-11` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-12` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-13` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-14` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-15` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-16` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-17` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-18` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWASEC-19` | READY | ✅ | ✅ | ✅ | Восстановлено по code и primary records 2026-09-30: PR #317/5dcd3e6, migration/CD 36299859149, worker CD 36300397903 и status 36300716206 SUCCESS. |
| `PWASEC-20` | READY | ✅ | ✅ | ✅ | Восстановлено по code и primary records 2026-09-30: PR #317/5dcd3e6, migration/CD 36299859149, worker CD 36300397903 и status 36300716206 SUCCESS. |
| `PWASEC-21` | READY | ✅ | ✅ | ✅ | Восстановлено по code и primary records 2026-09-30: PR #317/5dcd3e6, migration/CD 36299859149, worker CD 36300397903 и status 36300716206 SUCCESS. |

### `GOOGLE-DRIVE-RELIABILITY-02`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `GOOGLE-01` | READY | ✅ | ✅ | ✅ | F41 исправлен #318/8d9f45d: output сохранён до initial Drive export, cancellation/recovery; CI 36701312137/36701312154 PASS, current main CI 37155276745/37155276751 PASS. |
| `GOOGLE-02` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `GOOGLE-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `GOOGLE-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `GOOGLE-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `GOOGLE-06` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `STORAGE-LIFECYCLE-02`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `STORAG-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-02` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-05` | BACKLOG | — | — | — | F10 |
| `STORAG-06` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-07` | IN_PROGRESS | ◐ | ◐ | ✅ | Goal audio diff2026-10-06: finished audio writer удалён, result metadata + worker regeneration/transient transfer, zero storage puts regression. Legacy historical Sources не удаляются rollout. Linux/PG gate PENDING. |
| `STORAG-08` | IN_PROGRESS | ◐ | ◐ | ✅ | A20261004; F10/AP-16: отдельный bucket есть, current audio reference hard TTL 24h. |
| `STORAG-09` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-10` | IN_PROGRESS | ◐ | ◐ | ✅ | A20261004; F01/F58: Live TTL72h и provider checkpoint TTL24h нарушают контракт. После успеха checkpoints удаляются. |
| `STORAG-11` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-12` | BACKLOG | — | — | — | F10 |
| `STORAG-13` | BACKLOG | — | — | — | F10 |
| `STORAG-14` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-15` | BACKLOG | — | — | — | F10 |
| `STORAG-16` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-17` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-18` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-19` | IN_PROGRESS | ◐ | ◐ | ✅ | A20261004; F10: independent audio lifecycle настроен, но его 24h TTL не совпадает с Q162/Q178. |
| `STORAG-20` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STORAG-22` | BACKLOG | — | — | — | F10: orchestrator удаляет text checkpoints после полного документа, Source/S3 исходника сохраняет прежний expires_at; отдельного all-documents cleanup нет. |
| `STORAG-21` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `STT-PROVIDER-ABSTRACTION-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `STTPRO-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STTPRO-02` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STTPRO-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STTPRO-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STTPRO-05` | IN_PROGRESS | ◐ | ◐ | ✅ | F05 |
| `STTPRO-06` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STTPRO-07` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STTPRO-08` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STTPRO-09` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STTPRO-10` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STTPRO-11` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STTPRO-12` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STTPRO-13` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `STTPRO-14` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `YANDEX-STT-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `YANDEX-01` | IN_PROGRESS | ◐ | ◐ | ✅ | F04 |
| `YANDEX-02` | IN_PROGRESS | ◐ | ◐ | ✅ | F04 |
| `YANDEX-03` | IN_PROGRESS | ◐ | ◐ | ✅ | F05 |
| `YANDEX-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `YANDEX-05` | IN_PROGRESS | ◐ | ◐ | ✅ | F04 |

### `PWA-DICTIONARIES-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `PWADIC-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-WORKER-ISOLATION-02`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `PWAWOR-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWAWOR-02` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `PWAWOR-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-DATABASE-LEAST-PRIVILEGE-03`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `DBLP-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `DBLP-02` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `DBLP-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `DBLP-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `DBLP-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `DBLP-06` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `DBLP-07` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `DBLP-08` | IN_PROGRESS | ◐ | ◐ | ✅ | V-RESTORE: role/preflight scripts есть; полнота всей backup→switch→compatible recovery процедуры требует технического разбора агентом |

### `JOB-RELIABILITY-02`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `JOBREL-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-02` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-06` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-07` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-08` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-09` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-10` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-11` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-12` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-13` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-14` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-15` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-16` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBREL-17` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `JOB-NOTIFICATIONS-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `JOBNOT-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBNOT-02` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBNOT-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBNOT-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBNOT-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `JOBNOT-06` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `REALTIME-CONTINUITY-02`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `REALTI-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `REALTI-02` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `REALTI-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `REALTI-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `REALTI-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `TRANSCRIPT-EXPORTS-02`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `TRANSC-01` | BACKLOG | — | — | ✅ | A20261004; F01: только TXT download. |
| `TRANSC-02` | BACKLOG | — | — | ✅ | A20261004; F01/F05: Live SRT отсутствует. |
| `TRANSC-03` | BACKLOG | — | — | ✅ | A20261004; F01/F05: Live VTT отсутствует. |

### `USAGE-COST-ACCOUNTING-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `USAGEC-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `USAGEC-02` | IN_PROGRESS | ◐ | ◐ | ✅ | F11 |
| `USAGEC-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `USAGEC-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `USAGEC-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `USAGEC-06` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `OBSERVABILITY-AUDIT-02`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `OBSERV-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-02` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-06` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-07` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-08` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-09` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-10` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-11` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-12` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-13` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-14` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-15` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-16` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-17` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-18` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-19` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-20` | READY | ✅ | ✅ | ✅ | F47 code READY #320/a666df1: HTTP/WS query redaction и exact nginx access_log off; main CI 37155276745 PASS, API CD 37155276752 PASS. Protected nginx delivery не завершён: run 37156564109 host verification FAIL; см. F55. |
| `OBSERV-21` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-22` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-23` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-24` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-25` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-26` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-27` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-28` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-29` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-30` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-31` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-32` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-33` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-34` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `OBSERV-35` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `RELEASE-SAFETY-02`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `RELEAS-01` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `RELEAS-02` | IN_PROGRESS | ◐ | ◐ | ✅ | V-RESTORE: worker rollback реализован в manage_studio_worker.sh:230; полнота recovery для всей personal topology не установлена, технический gap агента |
| `RELEAS-03` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `RELEAS-04` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `RELEAS-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |


### `PERSONAL-TECHNICAL-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `TECH-01` | READY | ✅ | ✅ | ✅ | A20261004; package.json, vite.config.ts, pwaUpdate.ts; Studio build/component/browser CI; runtime claims только A20261004-RUNTIME. |
| `TECH-02` | READY | ✅ | ✅ | ✅ | A20261004; API requirements/models, migrations 0038; CI PostgreSQL/migration tests; runtime claims только A20261004-RUNTIME. |
| `TECH-03` | READY | ✅ | ✅ | ✅ | A20261004; rate_limit.py, realtime replay guard; API/security/Redis CI; runtime claims только A20261004-RUNTIME. |
| `TECH-04` | READY | ✅ | ✅ | ✅ | A20261004; audio processor/browserAudioProcessing; preparation/security/resource/component tests; runtime claims только A20261004-RUNTIME. |
| `TECH-05` | READY | ✅ | ✅ | ✅ | A20261004; source_storage.py, deploy/studio, API/Compose/edge tests; Yandex Disk feature отдельно YD; runtime claims только A20261004-RUNTIME. |

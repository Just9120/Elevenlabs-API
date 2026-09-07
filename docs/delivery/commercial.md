# Реестр AC: Commercial и разделение контуров

Часть [delivery dashboard](../delivery-plan.md), snapshot 2026-09-05T22:52:40+00:00, source `b8babc257abf7a33cda2df3c36c33570ee043108`. Формулировки — в [spec](../spec/commercial.md). SPEC PASS означает проверенную трассировку, CODE — source review, TEST PARTIAL — subsystem coverage без полного assertion dossier. По новым правилам владельца 2026-09-07 `READY` означает выполненный в коде AC с подходящими автоматическими проверками. Прежние 355 IMPLEMENTED перенесены в READY по сохранённому CODE и subsystem TEST Evidence; это миграция словаря, а не новый полный аудит или расширение test coverage. `ALIAS`/`SUPERSEDED` не входят в счётчик. TEST/CI показывают проверки; факты поставки и их ограничения сохранены в Evidence/primary records. Отдельные DEPLOY/LIVE колонки удалены; обязательных заданий пользователю нет.

### `ENVIRONMENT-CAPABILITIES-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `EVC-01` | BACKLOG | — | — | — | BACKLOG |
| `EVC-02` | BACKLOG | — | — | — | BACKLOG |
| `EVC-03` | BACKLOG | — | — | — | BACKLOG |
| `EVC-04` | BACKLOG | — | — | — | BACKLOG |
| `EVC-05` | BACKLOG | — | — | — | BACKLOG |
| `EVC-06` | BACKLOG | — | — | — | BACKLOG |
| `EVC-07` | BACKLOG | — | — | — | BACKLOG |
| `EVC-08` | BACKLOG | — | — | — | BACKLOG |
| `EVC-09` | BACKLOG | — | — | — | BACKLOG |
| `EVC-10` | BACKLOG | — | — | — | BACKLOG |
| `EVC-11` | BACKLOG | — | — | — | BACKLOG |
| `EVC-12` | BACKLOG | — | — | — | BACKLOG |
| `EVC-13` | BACKLOG | — | — | — | BACKLOG |
| `EVC-14` | BACKLOG | — | — | — | BACKLOG |
| `EVC-15` | BACKLOG | — | — | — | BACKLOG |
| `EVC-16` | BACKLOG | — | — | — | BACKLOG |
| `EVC-17` | BACKLOG | — | — | — | BACKLOG |
| `EVC-18` | BACKLOG | — | — | — | BACKLOG |
| `EVC-19` | BACKLOG | — | — | — | BACKLOG |
| `EVC-20` | BACKLOG | — | — | — | BACKLOG |
| `EVC-21` | BACKLOG | — | — | — | BACKLOG |
| `EVC-22` | BACKLOG | — | — | — | BACKLOG |
| `EVC-23` | BACKLOG | — | — | — | BACKLOG |
| `EVC-24` | BACKLOG | — | — | — | BACKLOG |
| `EVC-25` | BACKLOG | — | — | — | BACKLOG |
| `EVC-26` | BACKLOG | — | — | — | BACKLOG |
| `EVC-27` | BACKLOG | — | — | — | BACKLOG |
| `EVC-28` | BACKLOG | — | — | — | BACKLOG |
| `EVC-29` | BACKLOG | — | — | — | BACKLOG |
| `EVC-30` | BACKLOG | — | — | — | BACKLOG |
| `EVC-31` | BACKLOG | — | — | — | BACKLOG |
| `EVC-32` | BACKLOG | — | — | — | BACKLOG |
| `EVC-33` | BACKLOG | — | — | — | BACKLOG |
| `EVC-34` | BACKLOG | — | — | — | BACKLOG |
| `EVC-35` | BACKLOG | — | — | — | BACKLOG |
| `EVC-36` | BACKLOG | — | — | — | BACKLOG |
| `EVC-37` | BACKLOG | — | — | — | BACKLOG |
| `EVC-38` | BACKLOG | — | — | — | BACKLOG |
| `EVC-39` | BACKLOG | — | — | — | BACKLOG |
| `EVC-40` | BACKLOG | — | — | — | BACKLOG |
| `EVC-41` | BACKLOG | — | — | — | BACKLOG |
| `EVC-42` | BACKLOG | — | — | — | BACKLOG |
| `EVC-43` | BACKLOG | — | — | — | BACKLOG |
| `EVC-44` | BACKLOG | — | — | — | BACKLOG |
| `EVC-45` | BACKLOG | — | — | — | BACKLOG |
| `EVC-46` | BACKLOG | — | — | — | BACKLOG |
| `EVC-47` | BACKLOG | — | — | — | BACKLOG |
| `EVC-48` | BACKLOG | — | — | — | BACKLOG |
| `EVC-49` | BACKLOG | — | — | — | BACKLOG |
| `EVC-50` | BACKLOG | — | — | — | BACKLOG |

### `COMMERCIAL-INFRA-DATA-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `CINF-01` | BACKLOG | — | — | — | BACKLOG |
| `CINF-02` | BACKLOG | — | — | — | BACKLOG |
| `CINF-03` | BACKLOG | — | — | — | BACKLOG |
| `CINF-04` | BACKLOG | — | — | — | BACKLOG |
| `CINF-05` | BACKLOG | — | — | — | BACKLOG |
| `CINF-06` | BACKLOG | — | — | — | BACKLOG |
| `CINF-07` | BACKLOG | — | — | — | BACKLOG |
| `CINF-08` | BACKLOG | — | — | — | BACKLOG |
| `CINF-09` | BACKLOG | — | — | — | BACKLOG |
| `CINF-10` | ALIAS | — | — | — | Вне denominator; актуальные AC: EVC-07 |
| `CINF-11` | ALIAS | — | — | — | Вне denominator; актуальные AC: EVC-08 |
| `CINF-12` | ALIAS | — | — | — | Вне denominator; актуальные AC: EVC-06 |
| `CINF-13` | ALIAS | — | — | — | Вне denominator; актуальные AC: EVC-09 |
| `CINF-14` | ALIAS | — | — | — | Вне denominator; актуальные AC: EVC-10 |
| `CINF-15` | BACKLOG | — | — | — | BACKLOG |
| `CINF-16` | BACKLOG | — | — | — | BACKLOG |
| `CINF-17` | BACKLOG | — | — | — | BACKLOG |
| `CINF-18` | BACKLOG | — | — | — | BACKLOG |
| `CINF-19` | BACKLOG | — | — | — | BACKLOG |
| `CINF-20` | BACKLOG | — | — | — | BACKLOG |

### `COMMERCIAL-IDENTITY-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `CID-01` | BACKLOG | — | — | — | BACKLOG |
| `CID-02` | BACKLOG | — | — | — | BACKLOG |
| `CID-03` | BACKLOG | — | — | — | BACKLOG |
| `CID-04` | BACKLOG | — | — | — | BACKLOG |
| `CID-05` | BACKLOG | — | — | — | BACKLOG |
| `CID-06` | BACKLOG | — | — | — | BACKLOG |
| `CID-07` | BACKLOG | — | — | — | BACKLOG |
| `CID-08` | BACKLOG | — | — | — | BACKLOG |
| `CID-09` | BACKLOG | — | — | — | BACKLOG |
| `CID-10` | BACKLOG | — | — | — | BACKLOG |
| `CID-11` | BACKLOG | — | — | — | BACKLOG |
| `CID-12` | BACKLOG | — | — | — | BACKLOG |
| `CID-13` | BACKLOG | — | — | — | BACKLOG |
| `CID-14` | BACKLOG | — | — | — | BACKLOG |
| `CID-15` | BACKLOG | — | — | — | BACKLOG |
| `CID-16` | BACKLOG | — | — | — | BACKLOG |
| `CID-17` | BACKLOG | — | — | — | BACKLOG |
| `CID-18` | BACKLOG | — | — | — | BACKLOG |

### `COMMERCIAL-DATA-GOVERNANCE-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `CDG-01` | BACKLOG | — | — | — | BACKLOG |
| `CDG-02` | BACKLOG | — | — | — | BACKLOG |
| `CDG-03` | BACKLOG | — | — | — | BACKLOG |
| `CDG-04` | BACKLOG | — | — | — | BACKLOG |
| `CDG-05` | BACKLOG | — | — | — | BACKLOG |
| `CDG-06` | BACKLOG | — | — | — | BACKLOG |
| `CDG-07` | BACKLOG | — | — | — | BACKLOG |
| `CDG-08` | BACKLOG | — | — | — | BACKLOG |
| `CDG-09` | BACKLOG | — | — | — | BACKLOG |
| `CDG-10` | BACKLOG | — | — | — | BACKLOG |
| `CDG-11` | BACKLOG | — | — | — | BACKLOG |
| `CDG-12` | BACKLOG | — | — | — | BACKLOG |
| `CDG-13` | BACKLOG | — | — | — | BACKLOG |
| `CDG-14` | BACKLOG | — | — | — | BACKLOG |
| `CDG-15` | BACKLOG | — | — | — | BACKLOG |
| `CDG-16` | BACKLOG | — | — | — | BACKLOG |
| `CDG-17` | BACKLOG | — | — | — | BACKLOG |
| `CDG-18` | BACKLOG | — | — | — | BACKLOG |
| `CDG-19` | BACKLOG | — | — | — | BACKLOG |
| `CDG-20` | BACKLOG | — | — | — | BACKLOG |
| `CDG-21` | BACKLOG | — | — | — | BACKLOG |
| `CDG-22` | BACKLOG | — | — | — | BACKLOG |
| `CDG-23` | BACKLOG | — | — | — | BACKLOG |
| `CDG-24` | BACKLOG | — | — | — | BACKLOG |
| `CDG-25` | BACKLOG | — | — | — | BACKLOG |
| `CDG-26` | BACKLOG | — | — | — | BACKLOG |

### `COMMERCIAL-CROSS-BORDER-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `CXB-01` | BACKLOG | — | — | — | BACKLOG |
| `CXB-02` | BACKLOG | — | — | — | BACKLOG |
| `CXB-03` | BACKLOG | — | — | — | BACKLOG |
| `CXB-04` | BACKLOG | — | — | — | BACKLOG |
| `CXB-05` | BACKLOG | — | — | — | BACKLOG |
| `CXB-06` | BACKLOG | — | — | — | BACKLOG |
| `CXB-07` | BACKLOG | — | — | — | BACKLOG |
| `CXB-08` | BACKLOG | — | — | — | BACKLOG |
| `CXB-09` | BACKLOG | — | — | — | BACKLOG |
| `CXB-10` | BACKLOG | — | — | — | BACKLOG |
| `CXB-11` | BACKLOG | — | — | — | BACKLOG |
| `CXB-12` | BACKLOG | — | — | — | BACKLOG |
| `CXB-13` | BACKLOG | — | — | — | BACKLOG |
| `CXB-14` | BACKLOG | — | — | — | BACKLOG |

### `COMMERCIAL-STT-QUOTA-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `CSQ-01` | BACKLOG | — | — | — | BACKLOG |
| `CSQ-02` | BACKLOG | — | — | — | BACKLOG |
| `CSQ-03` | BACKLOG | — | — | — | BACKLOG |
| `CSQ-04` | BACKLOG | — | — | — | BACKLOG |
| `CSQ-05` | BACKLOG | — | — | — | BACKLOG |
| `CSQ-06` | BACKLOG | — | — | — | BACKLOG |
| `CSQ-07` | BACKLOG | — | — | — | BACKLOG |
| `CSQ-08` | BACKLOG | — | — | — | BACKLOG |
| `CSQ-09` | BACKLOG | — | — | — | BACKLOG |
| `CSQ-10` | BACKLOG | — | — | — | BACKLOG |
| `CSQ-11` | BACKLOG | — | — | — | BACKLOG |
| `CSQ-12` | BACKLOG | — | — | — | BACKLOG |
| `CSQ-13` | BACKLOG | — | — | — | BACKLOG |
| `CSQ-14` | BACKLOG | — | — | — | BACKLOG |
| `CSQ-15` | BACKLOG | — | — | — | BACKLOG |
| `CSQ-16` | BACKLOG | — | — | — | BACKLOG |

### `COMMERCIAL-SPEAKER-PRIVACY-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `CSP-01` | BACKLOG | — | — | — | BACKLOG |
| `CSP-02` | BACKLOG | — | — | — | BACKLOG |
| `CSP-03` | BACKLOG | — | — | — | BACKLOG |

### `COMMERCIAL-QUEUE-FAIRNESS-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `CQF-01` | BACKLOG | — | — | — | BACKLOG |
| `CQF-02` | BACKLOG | — | — | — | BACKLOG |
| `CQF-03` | BACKLOG | — | — | — | BACKLOG |
| `CQF-04` | BACKLOG | — | — | — | BACKLOG |
| `CQF-05` | BACKLOG | — | — | — | BACKLOG |
| `CQF-06` | BACKLOG | — | — | — | BACKLOG |

### `COMMERCIAL-BILLING-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `CBI-01` | BACKLOG | — | — | — | BACKLOG |
| `CBI-02` | BACKLOG | — | — | — | BACKLOG |
| `CBI-03` | BACKLOG | — | — | — | BACKLOG |
| `CBI-04` | BACKLOG | — | — | — | BACKLOG |
| `CBI-05` | BACKLOG | — | — | — | BACKLOG |
| `CBI-06` | BACKLOG | — | — | — | BACKLOG |
| `CBI-07` | BACKLOG | — | — | — | BACKLOG |
| `CBI-08` | BACKLOG | — | — | — | BACKLOG |
| `CBI-09` | BACKLOG | — | — | — | BACKLOG |
| `CBI-10` | BACKLOG | — | — | — | BACKLOG |
| `CBI-11` | BACKLOG | — | — | — | BACKLOG |
| `CBI-12` | BACKLOG | — | — | — | BACKLOG |
| `CBI-13` | BACKLOG | — | — | — | BACKLOG |
| `CBI-14` | BACKLOG | — | — | — | BACKLOG |
| `CBI-15` | BACKLOG | — | — | — | BACKLOG |
| `CBI-16` | BACKLOG | — | — | — | BACKLOG |
| `CBI-17` | BACKLOG | — | — | — | BACKLOG |
| `CBI-18` | BACKLOG | — | — | — | BACKLOG |
| `CBI-19` | BACKLOG | — | — | — | BACKLOG |
| `CBI-20` | BACKLOG | — | — | — | BACKLOG |
| `CBI-21` | BACKLOG | — | — | — | BACKLOG |
| `CBI-22` | BACKLOG | — | — | — | BACKLOG |
| `CBI-23` | BACKLOG | — | — | — | BACKLOG |
| `CBI-24` | BACKLOG | — | — | — | BACKLOG |
| `CBI-25` | BACKLOG | — | — | — | BACKLOG |
| `CBI-26` | BACKLOG | — | — | — | BACKLOG |
| `CBI-27` | BACKLOG | — | — | — | BACKLOG |

### `COMMERCIAL-ECONOMICS-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `CEC-01` | BACKLOG | — | — | — | BACKLOG |
| `CEC-02` | BACKLOG | — | — | — | BACKLOG |
| `CEC-03` | BACKLOG | — | — | — | BACKLOG |
| `CEC-04` | BACKLOG | — | — | — | BACKLOG |
| `CEC-05` | BACKLOG | — | — | — | BACKLOG |
| `CEC-06` | BACKLOG | — | — | — | BACKLOG |
| `CEC-07` | BACKLOG | — | — | — | BACKLOG |
| `CEC-08` | BACKLOG | — | — | — | BACKLOG |
| `CEC-09` | BACKLOG | — | — | — | BACKLOG |
| `CEC-10` | BACKLOG | — | — | — | BACKLOG |
| `CEC-11` | BACKLOG | — | — | — | BACKLOG |
| `CEC-12` | BACKLOG | — | — | — | BACKLOG |
| `CEC-13` | BACKLOG | — | — | — | BACKLOG |
| `CEC-14` | BACKLOG | — | — | — | BACKLOG |
| `CEC-15` | BACKLOG | — | — | — | BACKLOG |

### `COMMERCIAL-SECURITY-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `CSEC-01` | BACKLOG | — | — | — | BACKLOG |
| `CSEC-02` | BACKLOG | — | — | — | BACKLOG |
| `CSEC-03` | BACKLOG | — | — | — | BACKLOG |
| `CSEC-04` | BACKLOG | — | — | — | BACKLOG |
| `CSEC-05` | BACKLOG | — | — | — | BACKLOG |
| `CSEC-06` | BACKLOG | — | — | — | BACKLOG |
| `CSEC-07` | BACKLOG | — | — | — | BACKLOG |
| `CSEC-08` | BACKLOG | — | — | — | BACKLOG |
| `CSEC-09` | BACKLOG | — | — | — | BACKLOG |
| `CSEC-10` | BACKLOG | — | — | — | BACKLOG |
| `CSEC-11` | BACKLOG | — | — | — | BACKLOG |
| `CSEC-12` | BACKLOG | — | — | — | BACKLOG |
| `CSEC-13` | BACKLOG | — | — | — | BACKLOG |
| `CSEC-14` | BACKLOG | — | — | — | BACKLOG |
| `CSEC-15` | BACKLOG | — | — | — | BACKLOG |
| `CSEC-16` | ALIAS | — | — | — | Вне denominator; актуальные AC: CQF-01, CQF-03 |
| `CSEC-17` | BACKLOG | — | — | — | BACKLOG |
| `CSEC-18` | BACKLOG | — | — | — | BACKLOG |
| `CSEC-19` | BACKLOG | — | — | — | BACKLOG |
| `CSEC-20` | ALIAS | — | — | — | Вне denominator; актуальные AC: CINF-19 |
| `CSEC-21` | BACKLOG | — | — | — | BACKLOG |

### `COMMERCIAL-NOTIFICATIONS-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `CNOT-01` | BACKLOG | — | — | — | BACKLOG |
| `CNOT-02` | BACKLOG | — | — | — | BACKLOG |
| `CNOT-03` | BACKLOG | — | — | — | BACKLOG |
| `CNOT-04` | BACKLOG | — | — | — | BACKLOG |
| `CNOT-05` | BACKLOG | — | — | — | BACKLOG |
| `CNOT-06` | BACKLOG | — | — | — | BACKLOG |
| `CNOT-07` | BACKLOG | — | — | — | BACKLOG |
| `CNOT-08` | BACKLOG | — | — | — | BACKLOG |

### `COMMERCIAL-LEGAL-01`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `CLEG-01` | BACKLOG | — | — | — | BACKLOG |
| `CLEG-02` | BACKLOG | — | — | — | BACKLOG |
| `CLEG-03` | BACKLOG | — | — | — | BACKLOG |
| `CLEG-04` | BACKLOG | — | — | — | BACKLOG |
| `CLEG-05` | BACKLOG | — | — | — | BACKLOG |
| `CLEG-06` | BACKLOG | — | — | — | BACKLOG |
| `CLEG-07` | ALIAS | — | — | — | Вне denominator; актуальные AC: CDG-24 |
| `CLEG-08` | ALIAS | — | — | — | Вне denominator; актуальные AC: CDG-23 |
| `CLEG-09` | ALIAS | — | — | — | Вне denominator; актуальные AC: CDG-25 |
| `CLEG-10` | BACKLOG | — | — | — | BACKLOG |
| `CLEG-11` | BACKLOG | — | — | — | BACKLOG |
| `CLEG-12` | BACKLOG | — | — | — | BACKLOG |
| `CLEG-13` | BACKLOG | — | — | — | BACKLOG |
| `CLEG-14` | BACKLOG | — | — | — | BACKLOG |
| `CLEG-15` | BACKLOG | — | — | — | BACKLOG |
| `CLEG-16` | BACKLOG | — | — | — | BACKLOG |
| `CLEG-17` | BACKLOG | — | — | — | BACKLOG |
| `CLEG-18` | BACKLOG | — | — | — | BACKLOG |

### `COMMERCIAL-COMPLETENESS-02`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `CX-01` | BACKLOG | — | — | — | F09 |
| `CX-02` | BACKLOG | — | — | — | F09 |
| `CX-03` | BACKLOG | — | — | — | F09 |
| `CX-04` | BACKLOG | — | — | — | F09 |
| `CX-05` | BACKLOG | — | — | — | F09 |
| `CX-06` | BACKLOG | — | — | — | F09 |
| `CX-07` | BACKLOG | — | — | — | F09 |
| `CX-08` | BACKLOG | — | — | — | F09 |
| `CX-09` | BACKLOG | — | — | — | F09 |

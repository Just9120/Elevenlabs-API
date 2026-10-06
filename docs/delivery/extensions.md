# Реестр AC: Studio: расширение согласованных сценариев

Часть [delivery dashboard](../delivery-plan.md). Аудит 2026-10-04 на `origin/main` `9be46234b6961da076c6360adead845f382d592b`; текущие формулировки — [spec](../spec/extensions.md), источники — [trace](../spec/source-trace.md). CODE — проверка entrypoints/adapters/ownership; TEST — подходящие существующие synthetic suites, полный Linux CI A20261004-CI. ◐ означает ограниченное покрытие условий, а не долю AC. Runtime Evidence — в плане, не выводится из значка CI. Все строки повторно сверены; нерешённые внешние сценарии указаны в findings. ALIAS/SUPERSEDED исключены; отдельного процента ручной приёмки нет.

Checkpoint06Oct: выбранные AC ниже относятся к локальной ветке/current diff и таблице Evidence в [delivery dashboard](../delivery-plan.md). Заголовок аудита — исторический baseline origin/main. Для изменённого поведения current-revision CI PENDING; старый PASS не доказывает эту ветку.

### `RESULTS-STUDIO-02`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `RS-01` | READY | ✅ | ✅ | ✅ | PR326 code f20ce3e; Linux CI37428475481, Studio/E2E37428475455 PASS06Oct (test-merge6b9e752). Durable unfinished cache до full document/cancel, export-only retry без STT; Live DOCX/MD/timed export и отдельные capture clocks; JSON manifest выбранной Drive folder идемпотентен. Format/privacy/worker/UI/fake Google checks PASS. Merge/CD ещё PENDING; это прогресс Goal branch, не новая оценка main. |
| `RS-02` | READY | ✅ | ✅ | ✅ | PR326 code f20ce3e; Linux CI37428475481, Studio/E2E37428475455 PASS06Oct (test-merge6b9e752). Durable unfinished cache до full document/cancel, export-only retry без STT; Live DOCX/MD/timed export и отдельные capture clocks; JSON manifest выбранной Drive folder идемпотентен. Format/privacy/worker/UI/fake Google checks PASS. Merge/CD ещё PENDING; это прогресс Goal branch, не новая оценка main. |
| `RS-03` | READY | ✅ | ✅ | ✅ | A20261004; LiveTranscriptionPanel.tsx explicit clear и generation fencing; realtime_drafts.py owner delete; realtime draft API/component regressions. |
| `RS-04` | SUPERSEDED | — | — | — | A20261004; Q125/Q128/Q129: cloud-free текст относится к Live, обычный результат — внешний документ; ID/связи сохранены, реализация отменённого поведения не требуется. |
| `RS-05` | READY | ✅ | ✅ | ✅ | A20261004; Durable job stages, attempt/output evidence, Google output tests; внешний реальный canary не выполнялся. |
| `RS-06` | READY | ✅ | ✅ | ✅ | PR326 code f20ce3e; Linux CI37428475481, Studio/E2E37428475455 PASS06Oct (test-merge6b9e752). Durable unfinished cache до full document/cancel, export-only retry без STT; Live DOCX/MD/timed export и отдельные capture clocks; JSON manifest выбранной Drive folder идемпотентен. Format/privacy/worker/UI/fake Google checks PASS. Merge/CD ещё PENDING; это прогресс Goal branch, не новая оценка main. |
| `RS-07` | ALIAS | — | — | — | Audit quality review: Live TXT/recovered download уже PR-05/11; не считать дважды. |
| `RS-08` | READY | ✅ | ✅ | ✅ | PR326 code f20ce3e; Linux CI37428475481, Studio/E2E37428475455 PASS06Oct (test-merge6b9e752). Durable unfinished cache до full document/cancel, export-only retry без STT; Live DOCX/MD/timed export и отдельные capture clocks; JSON manifest выбранной Drive folder идемпотентен. Format/privacy/worker/UI/fake Google checks PASS. Merge/CD ещё PENDING; это прогресс Goal branch, не новая оценка main. |
| `RS-09` | ALIAS | — | — | — | Audit quality review: Live TXT/recovered download уже PR-05/11; не считать дважды. |
| `RS-10` | READY | ✅ | ✅ | ✅ | PR326 code f20ce3e; Linux CI37428475481, Studio/E2E37428475455 PASS06Oct (test-merge6b9e752). Durable unfinished cache до full document/cancel, export-only retry без STT; Live DOCX/MD/timed export и отдельные capture clocks; JSON manifest выбранной Drive folder идемпотентен. Format/privacy/worker/UI/fake Google checks PASS. Merge/CD ещё PENDING; это прогресс Goal branch, не новая оценка main. |
| `RS-11` | READY | ✅ | ✅ | ✅ | PR326 code f20ce3e; Linux CI37428475481, Studio/E2E37428475455 PASS06Oct (test-merge6b9e752). Durable unfinished cache до full document/cancel, export-only retry без STT; Live DOCX/MD/timed export и отдельные capture clocks; JSON manifest выбранной Drive folder идемпотентен. Format/privacy/worker/UI/fake Google checks PASS. Merge/CD ещё PENDING; это прогресс Goal branch, не новая оценка main. |
| `RS-12` | SUPERSEDED | — | — | — | A20261004; Q146/Q150: success только полный документ, без обещания восстановления утраченного внешнего документа; ID/связи сохранены, реализация отменённого поведения не требуется. |
| `RS-13` | READY | ✅ | ✅ | ✅ | PR326 code f20ce3e; Linux CI37428475481, Studio/E2E37428475455 PASS06Oct (test-merge6b9e752). Durable unfinished cache до full document/cancel, export-only retry без STT; Live DOCX/MD/timed export и отдельные capture clocks; JSON manifest выбранной Drive folder идемпотентен. Format/privacy/worker/UI/fake Google checks PASS. Merge/CD ещё PENDING; это прогресс Goal branch, не новая оценка main. |
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
| `RTC-01` | READY | ✅ | ✅ | ✅ | PR326 code f20ce3e; Linux CI37428475481, Studio/E2E37428475455 PASS06Oct (test-merge6b9e752). Новые single-use capabilities в одной сессии, bounded unsent replay, явные gaps и indexed final corrections; client/protocol/relay checks PASS. Реальная provider/poor-network сессия не запускалась. Merge/CD ещё PENDING; это прогресс Goal branch, не новая оценка main. |
| `RTC-02` | READY | ✅ | ✅ | ✅ | PR326 code f20ce3e; Linux CI37428475481, Studio/E2E37428475455 PASS06Oct (test-merge6b9e752). Новые single-use capabilities в одной сессии, bounded unsent replay, явные gaps и indexed final corrections; client/protocol/relay checks PASS. Реальная provider/poor-network сессия не запускалась. Merge/CD ещё PENDING; это прогресс Goal branch, не новая оценка main. |
| `RTC-03` | READY | ✅ | ✅ | ✅ | PR326 code f20ce3e; Linux CI37428475481, Studio/E2E37428475455 PASS06Oct (test-merge6b9e752). Новые single-use capabilities в одной сессии, bounded unsent replay, явные gaps и indexed final corrections; client/protocol/relay checks PASS. Реальная provider/poor-network сессия не запускалась. Merge/CD ещё PENDING; это прогресс Goal branch, не новая оценка main. |
| `RTC-04` | READY | ✅ | ✅ | ✅ | PR326 code f20ce3e; Linux CI37428475481, Studio/E2E37428475455 PASS06Oct (test-merge6b9e752). Новые single-use capabilities в одной сессии, bounded unsent replay, явные gaps и indexed final corrections; client/protocol/relay checks PASS. Реальная provider/poor-network сессия не запускалась. Merge/CD ещё PENDING; это прогресс Goal branch, не новая оценка main. |
| `RTC-05` | SUPERSEDED | — | — | — | A20261004; Q117: полная аудиозапись Live не требуется; ID/связи сохранены, реализация отменённого поведения не требуется. |
| `RTC-06` | READY | ✅ | ✅ | ✅ | PR326 code f20ce3e; Linux CI37428475481, Studio/E2E37428475455 PASS06Oct (test-merge6b9e752). Новые single-use capabilities в одной сессии, bounded unsent replay, явные gaps и indexed final corrections; client/protocol/relay checks PASS. Реальная provider/poor-network сессия не запускалась. Merge/CD ещё PENDING; это прогресс Goal branch, не новая оценка main. |
| `RTC-07` | SUPERSEDED | — | — | — | A20261004; Q118/Q120: вместо выбранного TTL — до ручной очистки; ID/связи сохранены, реализация отменённого поведения не требуется. |
| `RTC-08` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |

### `PWA-REQUIREMENTS-05`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `UXN-01` | SUPERSEDED | — | — | — | A20261004; Q015: пользовательские Projects явно исключены; ID/связи сохранены, реализация отменённого поведения не требуется. |
| `UXN-02` | READY | ✅ | ✅ | ✅ | PR326 code f20ce3e; Linux CI37428475481, Studio/E2E37428475455 PASS06Oct (test-merge6b9e752). Authoritative known UTC metadata naming без fabricated date; fragment bounds по measured whole source; parser/API/worker/UI checks PASS. Merge/CD ещё PENDING; это прогресс Goal branch, не новая оценка main. |
| `UXN-03` | READY | ✅ | ✅ | ✅ | PR326 code f20ce3e; Linux CI37428475481, Studio/E2E37428475455 PASS06Oct (test-merge6b9e752). Authoritative known UTC metadata naming без fabricated date; fragment bounds по measured whole source; parser/API/worker/UI checks PASS. Merge/CD ещё PENDING; это прогресс Goal branch, не новая оценка main. |
| `UXN-04` | IN_PROGRESS | ◐ | ◐ | ✅ | A20261004; Google destination реализован; Yandex Disk отсутствует (F02). |
| `UXN-05` | IN_PROGRESS | ◐ | ◐ | ✅ | F07 |
| `UXN-06` | READY | ✅ | ✅ | ✅ | PR327: unknown recording date omitted, no job/export/current-time fallback; focused document regressions PASS. Linux CI/delivery PENDING. |
| `UXN-07` | READY | ✅ | ✅ | ✅ | PR327: owned original sources/ordered preparation recipe/source clip provenance retained through document standardization; foreign-owner/lifecycle regressions PASS. Linux CI/delivery PENDING. |
| `UXN-09` | ALIAS | — | — | — | Вне denominator; актуальные AC: UXPOL-07 |

### `MEDIA-CONTRACT-03`

| AC | Состояние | CODE | TEST | CI | Остаток / Evidence |
| --- | --- | --- | --- | --- | --- |
| `MC-01` | IN_PROGRESS | ◐ | ◐ | ✅ | F06 |
| `MC-03` | READY | ✅ | ✅ | ✅ | PR326 code f20ce3e; Linux CI37428475481, Studio/E2E37428475455 PASS06Oct (test-merge6b9e752). Whole-source4h warning/12h max до clip/split, exact measured duration/source/clip/tariff consent token; negative/concurrent/legacy quote tests PASS. Merge/CD ещё PENDING; это прогресс Goal branch, не новая оценка main. |
| `MC-04` | READY | ✅ | ✅ | ✅ | PR326 code f20ce3e; Linux CI37428475481, Studio/E2E37428475455 PASS06Oct (test-merge6b9e752). Whole-source4h warning/12h max до clip/split, exact measured duration/source/clip/tariff consent token; negative/concurrent/legacy quote tests PASS. Merge/CD ещё PENDING; это прогресс Goal branch, не новая оценка main. |
| `MC-05` | READY | ✅ | ◐ | ✅ | Код реализован; subsystem checks есть, полный сценарий LIVE отдельно не проверен |
| `MC-06` | IN_PROGRESS | ◐ | ◐ | ✅ | F06 |
| `MC-07` | IN_PROGRESS | ◐ | ◐ | ✅ | F06 |
| `MC-08` | IN_PROGRESS | ◐ | ◐ | ✅ | PR327 закрывает provider/model provenance F06; numeric REST/timing F04 вне этой Goal и остаётся незавершённым. |
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
| `REC-01` | READY | ✅ | ✅ | ✅ | PR326 code f20ce3e; Linux CI37428475481, Studio/E2E37428475455 PASS06Oct (test-merge6b9e752). Backup timer10h и retention7d/30daily/12monthly/pre-migration90d явно определены. Linux synthetic PG dump/restore + authenticated API decrypt PASS, deleted-after-backup draft не активируется, old sessions revoked; измерения сравнены с выбранными RPO12h/RTO4h. Production restore/SLA и текущее состояние host timer отдельно не проверены. Merge/CD ещё PENDING; это прогресс Goal branch, не новая оценка main. |
| `REC-02` | READY | ✅ | ✅ | ✅ | PR326 code f20ce3e; Linux CI37428475481, Studio/E2E37428475455 PASS06Oct (test-merge6b9e752). Backup timer10h и retention7d/30daily/12monthly/pre-migration90d явно определены. Linux synthetic PG dump/restore + authenticated API decrypt PASS, deleted-after-backup draft не активируется, old sessions revoked; измерения сравнены с выбранными RPO12h/RTO4h. Production restore/SLA и текущее состояние host timer отдельно не проверены. Merge/CD ещё PENDING; это прогресс Goal branch, не новая оценка main. |
| `REC-03` | READY | ✅ | ✅ | ✅ | PR326 code f20ce3e; Linux CI37428475481, Studio/E2E37428475455 PASS06Oct (test-merge6b9e752). Backup timer10h и retention7d/30daily/12monthly/pre-migration90d явно определены. Linux synthetic PG dump/restore + authenticated API decrypt PASS, deleted-after-backup draft не активируется, old sessions revoked; измерения сравнены с выбранными RPO12h/RTO4h. Production restore/SLA и текущее состояние host timer отдельно не проверены. Merge/CD ещё PENDING; это прогресс Goal branch, не новая оценка main. |
| `REC-04` | READY | ✅ | ✅ | ✅ | PR326 code f20ce3e; Linux CI37428475481, Studio/E2E37428475455 PASS06Oct (test-merge6b9e752). Backup timer10h и retention7d/30daily/12monthly/pre-migration90d явно определены. Linux synthetic PG dump/restore + authenticated API decrypt PASS, deleted-after-backup draft не активируется, old sessions revoked; измерения сравнены с выбранными RPO12h/RTO4h. Production restore/SLA и текущее состояние host timer отдельно не проверены. Merge/CD ещё PENDING; это прогресс Goal branch, не новая оценка main. |
| `REC-05` | READY | ✅ | ✅ | ✅ | PR326 code f20ce3e; Linux CI37428475481, Studio/E2E37428475455 PASS06Oct (test-merge6b9e752). Backup timer10h и retention7d/30daily/12monthly/pre-migration90d явно определены. Linux synthetic PG dump/restore + authenticated API decrypt PASS, deleted-after-backup draft не активируется, old sessions revoked; измерения сравнены с выбранными RPO12h/RTO4h. Production restore/SLA и текущее состояние host timer отдельно не проверены. Merge/CD ещё PENDING; это прогресс Goal branch, не новая оценка main. |
| `REC-06` | READY | ✅ | ✅ | ✅ | PR326 code f20ce3e; Linux CI37428475481, Studio/E2E37428475455 PASS06Oct (test-merge6b9e752). Backup timer10h и retention7d/30daily/12monthly/pre-migration90d явно определены. Linux synthetic PG dump/restore + authenticated API decrypt PASS, deleted-after-backup draft не активируется, old sessions revoked; измерения сравнены с выбранными RPO12h/RTO4h. Production restore/SLA и текущее состояние host timer отдельно не проверены. Merge/CD ещё PENDING; это прогресс Goal branch, не новая оценка main. |
| `REC-07` | READY | ✅ | ✅ | ✅ | PR326 code f20ce3e; Linux CI37428475481, Studio/E2E37428475455 PASS06Oct (test-merge6b9e752). Backup timer10h и retention7d/30daily/12monthly/pre-migration90d явно определены. Linux synthetic PG dump/restore + authenticated API decrypt PASS, deleted-after-backup draft не активируется, old sessions revoked; измерения сравнены с выбранными RPO12h/RTO4h. Production restore/SLA и текущее состояние host timer отдельно не проверены. Merge/CD ещё PENDING; это прогресс Goal branch, не новая оценка main. |

# Delivery plan

## Current Goal

- **ID / title:** `PWA-ARBITRARY-SEGMENTS-01` — generalized ordered N-fragment transcription plan.
- **State:** `IN_PROGRESS`.
- **Authorization source:** explicit owner instruction `ставь цель и начинай реализацию` от 2026-08-20 после согласования bounded Goal.
- **Scope:** заменить narrow two-part composer на пользовательский план из `N >= 1` упорядоченных фрагментов; дать каждому фрагменту start и numeric end либо явный `Конец`; выполнять browser и server validation; создавать ordered batch jobs с immutable clip/output-folder snapshots; сохранить existing preflight, duplicate protection, reprocess authority и one-Google-Docs-output-per-job processing semantics; выполнить tests, PR, merge и applicable deployment/LIVE flow.
- **Non-goals:** folder intake, target Favorites, source-created timestamp, speaker identity, clear operations, Realtime/Colab changes; новые provider/storage/auth dependencies; новая persistence/queue boundary; Alembic migration; изменение CI/CD policy или deployment topology.
- **Goal AC:**
  1. Пользователь задаёт число фрагментов `N >= 1`, ограниченное существующим batch maximum.
  2. Для каждого фрагмента задаётся валидный start time.
  3. Для каждого фрагмента задаётся numeric end time либо явный `Конец`; open-ended fragment допустим только последним.
  4. Browser и API fail-closed отклоняют malformed, reversed, overlapping, out-of-order и over-limit планы до создания jobs.
  5. Валидный план создаёт ровно `N` ordered jobs с immutable media clip и output-folder snapshots; idempotency/preflight decisions различают каждый clip.
  6. Каждый non-skipped fragment использует существующий processing pipeline и создаёт отдельный Google Docs transcript output.
  7. Relevant unit/integration/browser tests, full repository/Studio validation, required exact-head CI, merge и applicable DEPLOY/LIVE gates успешны.
- **Required Evidence:** `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`.
- **Current Evidence:** `SPEC ✅ | CODE ◐ | TEST ◐ | CI — | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** browser preflight не знает media duration до server preparation, поэтому out-of-bounds media проверяется существующим worker boundary; approved post-deploy metadata writer отсутствует; standard component CD требует отдельного exact-revision подтверждения. Production canary ограничивается одним reviewed small source и не запускается без удовлетворённых runtime preconditions.
- **Stop condition:** все Goal AC и required Evidence подтверждены либо flow достиг `BLOCKED` / `PENDING_EXTERNAL_GATE`; затем остановиться и не переходить к следующей Goal без explicit authorization.

## Active execution checkpoint

- Updated (UTC): 2026-08-20T13:18:51Z
- Session mode: FOCUSED_TASK после RECOVERY stale checkpoint завершённого `SECURITY-DEPENDENCY-REMEDIATION-01`
- Base branch: `main`
- Base SHA: `50dff6f7401a08393137d5bd5e28162bd8df1133`
- Working branch: `codex/pwa-arbitrary-segments-01`
- Last verified revision: `81a34de82ebf1a22e38d68b9cd99b46112bef396`
- Working tree: backend generalized segment validation завершена; frontend composer/UI refactor остаётся локальным незавершённым delta
- Completed since base: Goal/checkpoint contract зафиксирован commit `81a34de`; API теперь принимает ordered non-overlapping arbitrary-N fragment plans одного source без прежнего ограничения «ровно две части/две папки»; integration/pure regression coverage подготовлено
- Current step: замена frontend two-part state и UI на N-segment plan
- Next exact action: завершить UI редактора фрагментов, preflight/reprocess mapping и Studio component tests
- Validation and Evidence: backend `py_compile` ✅; direct valid arbitrary-N domain smoke ✅; repository lightweight checks ✅; `git diff --check` ✅; service-backed pytest отложен до доступного test environment/CI; product readiness остаётся `78/109`
- Pull Request: отсутствует
- CI/checks: для working branch ещё не запускались
- Deployment/environment: baseline production revision `50dff6f` подтверждена; новая Goal не deploy-илась
- Blockers: нет на локальной стадии
- Unverified assumptions: existing one-job/one-output processing полностью покрывает arbitrary `N`; schema migration не требуется; эти assumptions должны быть подтверждены code/tests
- Preserved pre-existing changes: none

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Goal AC не добавляются в product denominator. До фактического выполнения `PS-01`–`PS-05` readiness не меняется.

| Product/epic | Current | Previous snapshot | Readiness/Evidence |
|---|---:|---:|---|
| **Project** | **71,6% (`78/109`)** | **71,6% (`78/109`)** | Без изменения scope или product AC. |
| **Google Colab** | **75,9% (`22/29`)** | **75,9% (`22/29`)** | Без изменений в docs-policy Goal. |
| `COLAB-BATCH-01` | **73,9% (`17/23`)** | **73,9% (`17/23`)** | 🟦 IN PROGRESS; functional и dependency/security CI подтверждены на exact material head; `SPEC ✅ CODE ◐ TEST ◐ CI ✅ DEPLOY ◐ LIVE ◐`. |
| `COLAB-REALTIME-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; capture stability не подтверждена полностью. |
| **Studio PWA** | **70,0% (`56/80`)** | **70,0% (`56/80`)** | Без изменений в docs-policy Goal. |
| `PWA-CORE-01` | **84,6% (`11/13`)** | **84,6% (`11/13`)** | 🟦 IN PROGRESS; нет active-UI expiry removal и color selector. |
| `PWA-INGEST-01` | **63,6% (`7/11`)** | **63,6% (`7/11`)** | 🟦 IN PROGRESS; нет Favorites и folder intake. |
| `PWA-SEGMENTS-01` | **0,0% (`0/5`)** | **0,0% (`0/5`)** | 🟦 IN PROGRESS; текущий two-part split не выполняет arbitrary-N AC. |
| `PWA-BATCH-01` | **90,0% (`9/10`)** | **90,0% (`9/10`)** | 🟦 IN PROGRESS; source-created timestamp отсутствует. |
| `PWA-SPEAKER-IDENTITY-01` | **0,0% (`0/5`)** | **0,0% (`0/5`)** | ⬜ BACKLOG; names/roles/listen-and-assign отсутствуют. |
| `PWA-MANIFEST-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; нет safe clear action. |
| `PWA-STANDARDIZATION-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; нет original-source creation authority. |
| `PWA-REALTIME-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; capture fix deployed и Chrome LIVE подтверждён, но full microphone/display/mixed matrix для `PR-06` остаётся неполной; functional и dependency/security CI подтверждены: `SPEC ✅ CODE ✅ TEST ✅ CI ✅ DEPLOY ✅ LIVE ◐`. |
| `PWA-OPERABILITY-01` | **77,8% (`14/18`)** | **77,8% (`14/18`)** | 🟦 IN PROGRESS; clear-operation AC остаются. |

Изменение current Goal на checkpoint старта: `0` product AC при неизменном denominator `109`.

## Candidate next Goals

Эти items — proposals и не авторизуют implementation:

1. `DELIVERY-EXACT-SHA-01` — exact-SHA standard component deploy и observable build identity.
2. `PWA-INGEST-FAVORITES-01` — owner-scoped target-folder Favorites после выбора persistence semantics.
3. `PWA-INGEST-FOLDERS-01` — bounded local/Drive folder intake и одна target folder для folder batch.
4. `PWA-SOURCE-TIME-01` — source-created timestamp authority для local/Drive intake, output и standardization.
5. `PWA-CLEAR-OPERATIONS-01` — manifest/history/analytics clear flows с explicit confirmation и audit semantics.
6. `PWA-SPEAKER-IDENTITY-01` — names/roles и manual listen-and-assign после privacy/data-retention design.
7. `PWA-REALTIME-MATRIX-01` — representative microphone/display/mixed production LIVE matrix.
8. `COLAB-REALTIME-STABILITY-01` — capture stability после PWA priority scope.

## Blockers и risks

- Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`); это project delivery debt. Current Goal фиксирует pre-merge metadata в своём PR, а фактический post-deploy state останется в GitHub/final report до следующего authorized reconciliation.
- `main` не имеет platform branch protection/rulesets; documented merge gates проверяются вручную без bypass.
- Scheduled Dependency audit failure `31996248930` устранён PR #214; exact-main manual run `32351941880` green. Следующий weekly schedule остаётся independent regression gate.
- Verified project CI/CD profile датирован 2026-08-14; будущий audit обязан повторно сверить изменяемые GitHub settings/runtime configuration.

## Sources of truth

- Repository instructions и Goal process: `AGENTS.md`.
- Product scope/AC: `docs/project-spec.md`.
- Current Goal/checkpoint/readiness: этот документ.
- CI/CD и production safety: `docs/ci-cd-rules.md`.
- Actual architecture: `docs/architecture.md`.
- Detailed PWA processing: `docs/studio-processing-contract.md`.
- Historical evidence: `docs/delivery-plan-archive.md` только при reconciliation.

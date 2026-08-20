# Delivery plan

## Current Goal

- **ID / title:** `PWA-JOB-STATE-CONSISTENCY-01` — authoritative job state across list, progress, detail and outputs.
- **State:** `IN_PROGRESS`.
- **Authorization source:** explicit owner instruction `начинай` от 2026-08-20 после выбора следующей bounded Goal.
- **Scope:** устранить подтверждённую production-рассинхронизацию PWA, при которой English job успешно завершается и имеет Google Docs output, но strict browser DTO отклоняет list/detail response, оставляя карточку на stale progress и показывая ложные ошибки; унифицировать language-mode validation; сохранить latest-wins/polling boundaries; добавить regression tests; выполнить PR, merge и applicable deployment/LIVE flow.
- **Non-goals:** backend job lifecycle, provider/Google processing semantics, schema/queue/migration changes, новые product AC, folder intake, Favorites, source-created timestamp, speaker identity, Realtime/Colab и CI/CD policy/topology.
- **Goal AC:**
  1. Browser contract одинаково принимает canonical `ru`, `en` и `detect` во всех job list/detail/summary paths и fail-closed отклоняет другие значения.
  2. Исчезновение terminal job из active-progress response приводит к authoritative jobs reload; accepted terminal state заменяет stale active state.
  3. Completed English job отображается как завершённая с `100%` и safe output без ложных collection/detail errors.
  4. Existing latest-wins, timeout, owner/project validation и browser-safe DTO filtering не регрессируют.
  5. Relevant local tests, full validation, exact-head CI, merge, applicable DEPLOY и bounded LIVE canary успешны.
- **Required Evidence:** `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`.
- **Current Evidence:** `SPEC ✅ | CODE ✅ | TEST ✅ | CI — | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** approved post-deploy metadata writer отсутствует; финальный LIVE canary требует доступной production session и reviewed small source; provider/Google side effect допускается только для одного bounded canary после green deployment.
- **Stop condition:** все Goal AC и required Evidence подтверждены либо flow достиг `BLOCKED` / `PENDING_EXTERNAL_GATE`; затем остановиться и не переходить к следующей Goal без explicit authorization.

## Active execution checkpoint

- Updated (UTC): 2026-08-20T17:43:25Z
- Session mode: FOCUSED_TASK после reconciliation завершённой Goal `PWA-ARBITRARY-SEGMENTS-01`
- Base branch: `main`
- Base SHA: `919e6137ed0e806db168a43d292ab7874293549e`
- Working branch: `codex/pwa-job-state-consistency-01`
- Last verified revision: `32c7f871e04c` (Goal/checkpoint activation); implementation поверх него локально validated
- Working tree: только scoped implementation/tests/readiness update; unrelated changes отсутствуют
- Completed since base: canonical `isTranscriptionLanguageMode` shared между composer и job DTO; `TranscriptionJob.language_mode` сужен до canonical enum; list/detail/summary regressions покрывают все три режима и invalid fail-closed case; completed English job UI regression подтверждает terminal `100%`, safe output и отсутствие ложных ошибок
- Current step: создать atomic implementation commit
- Next exact action: commit validated code/tests/readiness, затем выполнить repository-level checks и подготовить PR
- Validation and Evidence: focused Vitest `5 files, 239/239` ✅; full Studio Vitest `39 files, 507/507` ✅; TypeScript build ✅; full ESLint ✅; production Vite/PWA build ✅; `git diff --check` ✅
- Pull Request: отсутствует
- CI/checks: для current branch не запускались
- Deployment/environment: production baseline exact revision `919e6137ed0e806db168a43d292ab7874293549e`; prior Goal component CD success; current Goal не deploy-илась
- Blockers: нет на локальной стадии
- Unverified assumptions: production deployment устранит observed runtime symptom; требуется exact-revision LIVE canary
- Preserved pre-existing changes: none

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Goal AC не добавляются в product denominator. Snapshot пересчитан независимо по canonical 109 AC; code и tests снова подтверждают `PB-05`, denominator не изменился.

| Product/epic | Current | Previous snapshot | Readiness/Evidence |
|---|---:|---:|---|
| **Project** | **76,1% (`83/109`)** | **75,2% (`82/109`)** | Scoped fix и regressions восстановили `PB-05`; required CI/DEPLOY/LIVE Evidence ещё gate-ят Goal closure. |
| **Google Colab** | **75,9% (`22/29`)** | **75,9% (`22/29`)** | Без изменений в PWA Goal. |
| `COLAB-BATCH-01` | **73,9% (`17/23`)** | **73,9% (`17/23`)** | 🟦 IN PROGRESS; `SPEC ✅ CODE ◐ TEST ◐ CI ✅ DEPLOY ◐ LIVE ◐`. |
| `COLAB-REALTIME-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; capture stability не подтверждена полностью. |
| **Studio PWA** | **76,3% (`61/80`)** | **75,0% (`60/80`)** | `PB-05` подтверждён shared contract и full local tests; production recheck pending. |
| `PWA-CORE-01` | **84,6% (`11/13`)** | **84,6% (`11/13`)** | 🟦 IN PROGRESS; нет active-UI expiry removal и color selector. |
| `PWA-INGEST-01` | **63,6% (`7/11`)** | **63,6% (`7/11`)** | 🟦 IN PROGRESS; нет Favorites и folder intake. |
| `PWA-SEGMENTS-01` | **100% (`5/5`)** | **100% (`5/5`)** | 🟩 READY; `SPEC ✅ CODE ✅ TEST ✅ CI ✅ DEPLOY ✅ LIVE ✅`. |
| `PWA-BATCH-01` | **90,0% (`9/10`)** | **80,0% (`8/10`)** | 🟦 IN PROGRESS; `PB-05` локально восстановлен, source-created timestamp отсутствует; `LIVE ❌` до успешного production recheck. |
| `PWA-SPEAKER-IDENTITY-01` | **0,0% (`0/5`)** | **0,0% (`0/5`)** | ⬜ BACKLOG; names/roles/listen-and-assign отсутствуют. |
| `PWA-MANIFEST-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; нет safe clear action. |
| `PWA-STANDARDIZATION-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; нет original-source creation authority. |
| `PWA-REALTIME-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; `SPEC ✅ CODE ✅ TEST ✅ CI ✅ DEPLOY ✅ LIVE ◐`. |
| `PWA-OPERABILITY-01` | **77,8% (`14/18`)** | **77,8% (`14/18`)** | 🟦 IN PROGRESS; clear-operation AC остаются. |

Изменение относительно предыдущего snapshot: `+1` выполненный AC при неизменном denominator `109`. Shared canonical language contract и regressions закрывают подтверждённую причину `PB-05`; Evidence `CI/DEPLOY/LIVE` будет обновлено только после соответствующих событий.

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

- Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`); это project delivery debt. Фактический post-deploy state фиксируется в GitHub/final report и reconciled в следующем authorized scope без отдельного docs-only PR.
- `main` не имеет platform branch protection/rulesets; documented merge gates проверяются вручную без bypass.
- Job collection/detail parsers являются fail-closed boundary; исправление должно расширить только canonical language enum и не ослабить private-field filtering.
- Verified project CI/CD profile датирован 2026-08-14; перед delivery нужно повторно сверить relevant workflows/runtime configuration.

## Sources of truth

- Repository instructions и Goal process: `AGENTS.md`.
- Product scope/AC: `docs/project-spec.md`.
- Current Goal/checkpoint/readiness: этот документ.
- CI/CD и production safety: `docs/ci-cd-rules.md`.
- Actual architecture: `docs/architecture.md`.
- Detailed PWA processing: `docs/studio-processing-contract.md`.
- Historical evidence: `docs/delivery-plan-archive.md` только при reconciliation.

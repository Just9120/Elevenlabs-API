# Delivery plan

## Current Goal

- **ID / title:** `PWA-OPERABILITY-POLISH-02` — persistent accent color, safe clear operations и duplicate-state consistency.
- **State:** `IN_PROGRESS`.
- **Authorization source:** explicit owner instruction `ок, приступай` от 2026-08-21 после согласования объединённой bounded Goal.
- **Scope:** реализовать persistent accent/interface color; owner-scoped clear для manifest/catalog, History и Analytics с обязательным Да/Нет confirmation и audit semantics; устранить подтверждённое противоречие, при котором accepted completed output одновременно показывается как unresolved provider attempt; добавить additive migration, API/UI contracts, tests и выполнить полный delivery flow.
- **Non-goals:** физическое удаление jobs, outputs, Google Docs, R2 objects, sources или audit events; folder intake; speaker identity; Realtime; Colab; TOTP; изменение CI/CD policy или deployment topology.
- **Goal AC:**
  1. Пользователь выбирает поддерживаемый accent/interface color; выбор применяется без reload и сохраняется как owner-scoped account preference.
  2. Manifest/catalog можно очистить только явным подтверждённым owner-scoped action; очистка перестаёт использовать прежние accepted-result записи для duplicate decision, но не удаляет outputs, Google Docs, sources или audit.
  3. History можно очистить только после Да/Нет confirmation; active jobs сохраняются, historical jobs скрываются owner-scoped, durable job/output/audit records не удаляются.
  4. Analytics можно очистить только после Да/Нет confirmation; новые агрегаты считаются от owner-scoped reset boundary, durable jobs/attempts/outputs/audit records не удаляются.
  5. Completed provider attempt с persisted accepted output не создаёт ложный `unresolved` conflict; реальный in-flight/uncertain attempt продолжает fail closed.
  6. Relevant backend/frontend tests, full local validation, exact-head CI, merge, applicable protected migration/deployment и bounded LIVE validation успешны.
- **Required Evidence:** `SPEC ✅ | CODE ✅ | TEST ◐ | CI ❌ | DEPLOY — | LIVE —` (initial exact-head CI выявил два локализованных regression defects; fixes ожидают новый CI run).
- **Known blockers/dependencies:** Goal требует additive PostgreSQL migration и protected `MANUAL_GATED` migration lane; approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** все Goal AC и required Evidence подтверждены либо flow достиг `BLOCKED` / `PENDING_EXTERNAL_GATE`; затем остановиться и не переходить к следующей Goal без explicit authorization.

## Active execution checkpoint

- Updated (UTC): 2026-08-22T08:21:38Z
- Session mode: новая explicit-authorized bounded Goal после reconciliation merged PR #217
- Base branch: `main`
- Base SHA: `6bcb0ed49aeb6e491765fda45bf74b6e68f7b67e`
- Working branch: `codex/pwa-operability-polish-02`
- Last verified revision: `0472a7c58d9a63908d34ceac21db4d1d5f566f28`
- Working tree: fixes для initial CI failures и checkpoint pending commit; preserved unrelated untracked pnpm artifacts excluded from scope/commits
- Completed since base: Goal activation; additive `0022_account_operability` schema; owner-scoped persistent accent preference; confirmed owner-scoped reset boundaries for manifest, History and Analytics; durable jobs/outputs/Google Docs/R2/sources/audit preserved; completed attempt authority reconciled only when accepted output is actually persisted; missing-output/in-flight/uncertain cases remain fail closed; regression tests added
- Current step: resolve initial PR #218 `checks` failure without weakening safety/privacy contracts
- Next exact action: commit/push corrected preflight head and audit assertion, then wait for terminal checks on the new exact head
- Validation and Evidence: full frontend ESLint and Vitest suite passed; TypeScript `tsc -b` and production Vite/PWA build passed; repository lightweight CI checks passed; focused safety regression `14/14`, catalog/analytics contracts `22/22`, clear frontend tests `23/23`, App History clear `1/1`, Login contract `5/5` passed. PostgreSQL-backed regressions are authored but local PostgreSQL/Redis are unavailable; bash-dependent tests are unavailable on Windows. A broader non-infrastructure Python run passed through 37% without a new failure after the safety correction but was not treated as terminal evidence; exact full suite remains a CI gate.
- Pull Request: [#218](https://github.com/Just9120/Elevenlabs-API/pull/218), OPEN, non-draft; current pushed head `e4dadc49d4312f104b6c44588d7348cab8fe4b4a`, base `6bcb0ed49aeb6e491765fda45bf74b6e68f7b67e`
- CI/checks: exact-head runs — CI `32561875043` / job `97004595856` failed: one test incorrectly expected private `project_id` in audit metadata and processing preflight still expected Alembic `0021`; Studio PWA CI `32561875118` passed both `studio` job `97004596003` and `browser-e2e` job `97004596152`. Fix keeps audit metadata private and advances only the preflight expected source head to additive `0022`; replacement checks pending.
- Deployment/environment: production baseline `main@6bcb0ed49aeb6e491765fda45bf74b6e68f7b67e`; Goal revision not deployed
- Blockers: none at implementation stage
- Unverified assumptions: production database accepts planned additive migration; clear reset boundaries and completed-attempt correction require bounded LIVE verification after deploy
- Preserved pre-existing changes: `.pnpm-store/`, `apps/studio/pnpm-lock.yaml`, `apps/studio/pnpm-workspace.yaml` remain untracked and are not part of this Goal

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Goal AC не добавляются в product denominator. Branch-level CODE/TEST evidence засчитано для выполненных product AC; READY по-прежнему требует все обязательные gates.

| Product/epic | Current | Previous snapshot | Readiness/Evidence |
|---|---:|---:|---|
| **Project** | **83,5% (`91/109`)** | **78,9% (`86/109`)** | Выполнены ещё пять targeted AC: `PM-03`, `PO-10/11/17/18`; denominator не изменился. |
| **Google Colab** | **75,9% (`22/29`)** | **75,9% (`22/29`)** | Без изменений в PWA Goal. |
| `COLAB-BATCH-01` | **73,9% (`17/23`)** | **73,9% (`17/23`)** | 🟦 IN PROGRESS; `SPEC ✅ CODE ◐ TEST ◐ CI ✅ DEPLOY ◐ LIVE ◐`. |
| `COLAB-REALTIME-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; capture stability не подтверждена полностью. |
| **Studio PWA** | **86,3% (`69/80`)** | **80,0% (`64/80`)** | Safe manifest/History/Analytics clear AC выполнены на branch CODE/TEST evidence. |
| `PWA-CORE-01` | **100% (`13/13`)** | **100% (`13/13`)** | Product AC выполнены; 🟦 IN PROGRESS до required CI/DEPLOY/LIVE Evidence. |
| `PWA-INGEST-01` | **72,7% (`8/11`)** | **72,7% (`8/11`)** | Без изменений в Goal. |
| `PWA-SEGMENTS-01` | **100% (`5/5`)** | **100% (`5/5`)** | 🟩 READY; `SPEC ✅ CODE ✅ TEST ✅ CI ✅ DEPLOY ✅ LIVE ✅`. |
| `PWA-BATCH-01` | **90,0% (`9/10`)** | **90,0% (`9/10`)** | Без изменения numerator; duplicate fix — consistency defect существующего AC. |
| `PWA-SPEAKER-IDENTITY-01` | **0,0% (`0/5`)** | **0,0% (`0/5`)** | ⬜ BACKLOG. |
| `PWA-MANIFEST-01` | **100% (`6/6`)** | **83,3% (`5/6`)** | `PM-03` выполнен; 🟦 IN PROGRESS до required CI/DEPLOY/LIVE Evidence. |
| `PWA-STANDARDIZATION-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | Без изменений в Goal. |
| `PWA-REALTIME-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | Без изменений в Goal. |
| `PWA-OPERABILITY-01` | **100% (`18/18`)** | **77,8% (`14/18`)** | `PO-10/11/17/18` выполнены; 🟦 IN PROGRESS до required CI/DEPLOY/LIVE Evidence. |

## Candidate next Goals

Эти items — proposals и не авторизуют implementation:

1. `PWA-INGEST-FOLDERS-01` — bounded local/Drive folder intake и одна target folder для folder batch.
2. `PWA-SPEAKER-IDENTITY-01` — names/roles и manual listen-and-assign после privacy/data-retention design.
3. `PWA-REALTIME-MATRIX-01` — representative microphone/display/mixed production LIVE matrix.
4. `COLAB-REALTIME-STABILITY-01` — capture stability после PWA priority scope.

## Blockers и risks

- Clear actions обязаны менять только owner-scoped visibility/decision boundaries; destructive cascade на output/source/audit запрещён текущей Goal.
- Manifest reset не может делать старый completed provider attempt `unresolved`; иначе пользователь не сможет безопасно запустить новый explicit reprocess после очистки.
- Analytics reset должен фильтровать jobs, attempts, sources и outputs по одной согласованной boundary, не смешивая до- и после-reset counts.
- Approved post-deploy metadata writer отсутствует; фактический post-deploy state будет reconciled в следующем authorized scope без docs-only PR.
- `main` не имеет platform branch protection/rulesets; documented merge gates проверяются вручную без bypass.

## Sources of truth

- Repository instructions и Goal process: `AGENTS.md`.
- Product scope/AC: `docs/project-spec.md`.
- Current Goal/checkpoint/readiness: этот документ.
- CI/CD и production safety: `docs/ci-cd-rules.md`.
- Actual architecture: `docs/architecture.md`.
- Detailed PWA processing: `docs/studio-processing-contract.md`.
- Historical evidence: `docs/delivery-plan-archive.md` только при reconciliation.

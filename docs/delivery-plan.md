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
- **Required Evidence:** `SPEC ✅ | CODE ✅ | TEST ✅ | CI ❌ | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** Goal требует additive PostgreSQL migration и protected `MANUAL_GATED` migration lane; approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** все Goal AC и required Evidence подтверждены либо flow достиг `BLOCKED` / `PENDING_EXTERNAL_GATE`; затем остановиться и не переходить к следующей Goal без explicit authorization.

## Active execution checkpoint

- Updated (UTC): 2026-08-22T08:34:45Z
- Session mode: новая explicit-authorized bounded Goal после reconciliation merged PR #217
- Base branch: `main`
- Base SHA: `6bcb0ed49aeb6e491765fda45bf74b6e68f7b67e`
- Working branch: `codex/pwa-operability-polish-02`
- Last verified revision: `d9e94d4e39479e62ed91d7c68c9d285adc3796ee`
- Working tree: локальный regression fix устраняет race между route-request `browse` и кликом `Новый проект`; implementation и regression test ещё не committed/pushed; preserved unrelated untracked pnpm artifacts excluded from scope/commits
- Completed since base: Goal activation; additive `0022_account_operability` schema; owner-scoped persistent accent preference; confirmed owner-scoped reset boundaries for manifest, History and Analytics; durable jobs/outputs/Google Docs/R2/sources/audit preserved; completed attempt authority reconciled only when accepted output is actually persisted; missing-output/in-flight/uncertain cases remain fail closed; regression tests added; stale project-view synchronization перенесена до paint, а открытие формы сделано deterministic
- Current step: commit/push UI race fix и повторить exact-head merge gates
- Next exact action: создать atomic commit, push в PR #218 и дождаться terminal state всех replacement checks
- Validation and Evidence: после UI race fix полный frontend ESLint, TypeScript `tsc -b`, production Vite/PWA build и Vitest `519/519` прошли; focused regression `2/2` прошёл. Ранее repository lightweight CI checks, focused safety regression `14/14`, catalog/analytics contracts `22/22`, clear frontend tests `23/23`, App History clear `1/1`, Login contract `5/5` прошли. PostgreSQL-backed regressions authored, но local PostgreSQL/Redis недоступны; bash-dependent tests недоступны на Windows. Более широкий non-infrastructure Python run ранее прошёл до 37% без нового failure после safety correction, но не считается terminal evidence; exact full suite остаётся CI gate.
- Pull Request: [#218](https://github.com/Just9120/Elevenlabs-API/pull/218), OPEN, non-draft; pushed head `d9e94d4e39479e62ed91d7c68c9d285adc3796ee`, base `6bcb0ed49aeb6e491765fda45bf74b6e68f7b67e`; replacement fix pending push
- CI/checks: на code head `9a26f81806ffb93377e9956e784d98a5dcea6602` все checks были SUCCESS: CI `32562099317` / job `97005161601`, Studio `32562099341` / job `97005161698`, browser-e2e job `97005161750`. На metadata head `d9e94d4e39479e62ed91d7c68c9d285adc3796ee` CI `32562273548` / job `97005600728` и Studio job `97005601044` SUCCESS, но browser-e2e run `32562273555` / job `97005600759` FAILURE: форма создания проекта закрывалась stale `browse` effect после клика. Локальный product fix подтверждён tests; replacement exact-head checks pending.
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

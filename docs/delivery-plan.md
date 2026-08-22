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
- **Required Evidence:** `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ◐ | LIVE ◐`.
- **Known blockers/dependencies:** production processing preflight блокирует worker deploy из-за неидентифицированного non-secret runtime setting; текущий hotfix добавляет secret-free key/reason diagnostics. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** все Goal AC и required Evidence подтверждены либо flow достиг `BLOCKED` / `PENDING_EXTERNAL_GATE`; затем остановиться и не переходить к следующей Goal без explicit authorization.

## Active execution checkpoint

- Updated (UTC): 2026-08-22T10:35:20Z
- Session mode: RESUME после explicit authorization protected migration/API/worker/LIVE flow
- Base branch: `main`
- Base SHA: `1fc868847377ad059743ac4d1aa3ae0573d27507` (merged implementation baseline; original Goal base `6bcb0ed49aeb6e491765fda45bf74b6e68f7b67e`)
- Working branch: `codex/pwa-operability-preflight-diagnostics`
- Last verified revision: `1fc868847377ad059743ac4d1aa3ae0573d27507`
- Working tree: secret-free preflight diagnostic hotfix и regression test изменены, не committed; preserved unrelated untracked pnpm artifacts excluded from scope/commits
- Completed since original base: implementation и UI race fix merged через PR #218; exact-head PR и post-merge CI green; web deployed; worker graceful-drained; protected migration `0021_source_creation_favorites → 0022_account_operability` и API deploy successful; migration gate снова disabled; bounded LIVE подтвердил accent persistence, три Да/Нет dialogs с cancel path и отсутствие ложного unresolved blocker для visible completed output
- Current step: сделать preflight runtime blocker actionable без раскрытия config values, затем повторить read-only preflight
- Next exact action: validate/commit/push hotfix, открыть PR и дождаться exact-head CI
- Validation and Evidence: implementation head прошёл CI `32562849717`, Studio/browser-e2e `32562849719`; local hotfix `git diff --check`, shell syntax и lightweight CI прошли, Python test file компилируется; local pytest недоступен, focused Ubuntu integration tests остаются CI gate. LIVE accent `blue → teal → reload teal → restore blue → reload blue`; manifest/History/Analytics confirmation dialogs проверены с `Нет`; duplicate preflight на existing completed source разрешил processing и не показал `equivalent_provider_outcome_unresolved`, job не создавался.
- Pull Request: [#218](https://github.com/Just9120/Elevenlabs-API/pull/218) MERGED as `1fc868847377ad059743ac4d1aa3ae0573d27507`; hotfix PR pending
- CI/checks: PR #218 exact head `9c2ec47ed1b099958576d31204ff3d776210c242` — all required checks SUCCESS; post-merge CI run `32562849717` and Studio PWA CI `32562849719` — SUCCESS
- Deployment/environment: web CD `32562849732` SUCCESS; worker drain `32563012779` SUCCESS (`exited`, `exit_code=0`); protected migration/API run `32567261404` SUCCESS, snapshot `ab9189f05e33`, API image `sha256:9ed9b467bb46`, `api_deployed=yes`; migration enable variable restored to `false`. GitHub approval history API reports `state=skipped` despite observed waiting state and user action, so required-review audit evidence remains limited.
- Blockers: read-only processing preflight `32567439693` failed at `runtime setting completeness`; worker remains stopped and must not deploy until a repeated preflight passes
- Unverified assumptions: exact invalid runtime setting неизвестен до deployment/use of hotfix diagnostic; clear mutation paths не запускались в production, чтобы не скрывать реальные user data
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

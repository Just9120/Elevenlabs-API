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
- **Known blockers/dependencies:** production processing preflight блокирует worker deploy: исправленный canonical primary OAuth scope прошёл проверку, но deploy-user не может напрямую читать runtime-owned `0600` R2 credential files. Текущий hotfix переносит structural validation внутрь существующего API runtime boundary без раскрытия values или расширения permissions. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** все Goal AC и required Evidence подтверждены либо flow достиг `BLOCKED` / `PENDING_EXTERNAL_GATE`; затем остановиться и не переходить к следующей Goal без explicit authorization.

## Active execution checkpoint

- Updated (UTC): 2026-08-22T12:56:00Z
- Session mode: RESUME после explicit authorization protected migration/API/worker/LIVE flow
- Base branch: `main`
- Base SHA: `cd84cab2ae20a92360f931a027e0424ccce6d2f4` (merged diagnostic baseline; original Goal base `6bcb0ed49aeb6e491765fda45bf74b6e68f7b67e`)
- Working branch: `codex/pwa-operability-preflight-runtime-secrets`
- Last verified revision: `a12b86c3ace11903c6ff6e3c4750fc81c6739eb4`
- Working tree: one-line test-harness compatibility fix и этот checkpoint изменены после initial hotfix commit; preserved unrelated untracked pnpm artifacts excluded from scope/commits
- Completed since original base: implementation и UI race fix merged через PR #218; diagnostic hotfix merged через PR #219; exact-head/post-merge CI green; web deployed; worker graceful-drained; protected migration `0021_source_creation_favorites → 0022_account_operability` и API deploy successful; migration gate снова disabled; canonical primary OAuth scope установлен operator action и подтверждён progression следующего preflight; bounded LIVE подтвердил accent persistence, три Да/Нет dialogs с cancel path и отсутствие ложного unresolved blocker для visible completed output
- Current step: исправить выявленную CI test-double collision (`startswith` совпал с запрещённым mock lifecycle token `start`) без изменения production logic
- Next exact action: validate/commit/push focused CI fix и дождаться повторного exact-head CI PR #220
- Validation and Evidence: implementation head прошёл CI `32562849717`, Studio/browser-e2e `32562849719`; diagnostic merge `cd84cab2ae20a92360f931a027e0424ccce6d2f4` прошёл post-merge CI `32568203798`; initial PR #220 CI `32574115317` — FAILED: `1230 passed`, `6 failed` из-за одной test-double token collision до actual validation branch; production logic не запускалась. Текущий hotfix прошёл `git diff --check`, shell syntax и lightweight CI; local pytest/PyYAML недоступны. LIVE accent `blue → teal → reload teal → restore blue → reload blue`; manifest/History/Analytics confirmation dialogs проверены с `Нет`; duplicate preflight на existing completed source разрешил processing и не показал `equivalent_provider_outcome_unresolved`, job не создавался.
- Pull Request: [#218](https://github.com/Just9120/Elevenlabs-API/pull/218) MERGED as `1fc868847377ad059743ac4d1aa3ae0573d27507`; [#219](https://github.com/Just9120/Elevenlabs-API/pull/219) MERGED as `cd84cab2ae20a92360f931a027e0424ccce6d2f4`; [#220](https://github.com/Just9120/Elevenlabs-API/pull/220) OPEN
- CI/checks: PR #218 exact head `9c2ec47ed1b099958576d31204ff3d776210c242` — all required checks SUCCESS; implementation post-merge CI `32562849717` and Studio PWA CI `32562849719` — SUCCESS; diagnostic post-merge CI `32568203798` — SUCCESS; PR #220 initial run `32574115317` — FAILED, focused fix pending push
- Deployment/environment: web CD `32562849732` SUCCESS; worker drain `32563012779` SUCCESS (`exited`, `exit_code=0`); protected migration/API run `32567261404` SUCCESS, snapshot `ab9189f05e33`, API image `sha256:9ed9b467bb46`, `api_deployed=yes`; migration enable variable restored to `false`. GitHub approval history API reports `state=skipped` despite observed waiting state and user action, so required-review audit evidence remains limited.
- Blockers: read-only preflight `32573837941` подтвердил прохождение исправленного OAuth scope и затем failed из-за direct read `Permission denied` для runtime-owned R2 access-key file; worker остаётся stopped и не deploy-ится до merged hotfix и успешного repeated preflight
- Unverified assumptions: runtime-mounted R2 credentials структурно валидны до container-boundary validation; clear mutation paths не запускались в production, чтобы не скрывать реальные user data
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

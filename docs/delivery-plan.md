# Delivery plan

## Current Goal

- **ID / title:** `SECURITY-DEPENDENCY-REMEDIATION-01` — устранение текущих High findings Dependency audit.
- **State:** `IN_PROGRESS`.
- **Authorization source:** explicit owner instruction `начинай` от 2026-08-20 после согласования bounded Goal по результатам evidence-based audit.
- **Scope:** устранить текущие Node findings для `brace-expansion`, `fast-uri`, `nanoid` и Python findings для `cryptography`; минимально обновить pins/lock dependency graph; выполнить repository/Studio validation и оба dependency audits; провести PR, merge и applicable deployment затронутых runtime components; подтвердить deployed revision и bounded health/LIVE smoke.
- **Non-goals:** product features или изменение product AC; refactoring монолитов; branch protection/rulesets; immutable pinning GitHub Actions; изменение CI/CD safety contract или deployment topology; новые providers/auth/storage; reconciliation upstream requirements.
- **Goal AC:**
  1. Node dependency audit не содержит текущие findings `brace-expansion`, `fast-uri` и `nanoid`.
  2. Python dependency audit не содержит текущие `cryptography` findings.
  3. Full repository tests, Studio tests, lint, typecheck и production build проходят.
  4. Required PR checks завершаются terminal success без unexplained skips.
  5. PR merged и затронутые runtime components проходят applicable deployment flow.
  6. Deployed revision подтверждена; health и bounded non-side-effecting LIVE smoke успешны.
- **Required Evidence:** `SPEC N/A | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`.
- **Current Evidence:** `SPEC N/A | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** standard web/API/worker CD не принимает expected `github.sha`; exact deployed identity должна быть подтверждена отдельной композицией workflow logs и post-deploy exact-SHA preflight, иначе Goal переходит в `BLOCKED` / `PENDING_EXTERNAL_GATE`. Approved post-deploy metadata writer отсутствует.
- **Stop condition:** все Goal AC и required Evidence подтверждены либо flow достиг `BLOCKED` / `PENDING_EXTERNAL_GATE`; затем остановиться и не переходить к следующей Goal без explicit authorization.

## Active execution checkpoint

- Updated (UTC): 2026-08-20T08:54:46Z
- Session mode: FOCUSED_TASK после RECOVERY stale checkpoint завершённого `DOCS-GOAL-DRIVEN-01`
- Base branch: `main`
- Base SHA: `3ef4a45e9e17be7ae78bd574f5e0de6f101a4b55`
- Working branch: `codex/security-dependency-remediation-01`
- Last verified revision: `080fbd3e4833d33b9b5c2ca6e97dece3601bb472`
- Working tree: CLEAN на published material revision; текущая CI checkpoint update является единственным tracked delta
- Completed since base: commit `aa6b21a` восстановил active Goal/checkpoint и архивировал closure PR #213; commit `bb69760` обновил `brace-expansion 5.0.9`, `fast-uri 3.1.5`, `nanoid 3.3.18`, `cryptography 50.0.0` и reproducible locks/constraints; commit `080fbd3` обновил regression contracts для fixed versions
- Current step: запись exact material-head CI Evidence перед final docs-only checkpoint head
- Next exact action: commit/push checkpoint, дождаться terminal green functional CI exact final head, снять draft и проверить merge gates
- Validation and Evidence: local Node/Python audits ✅; focused dependency contracts `12/12` ✅; portable Python suite `955 passed, 6 skipped` ✅; Studio ESLint/Vitest `503/503`/TypeScript/Vite build ✅; exact material-head CI run `32350859254`, `checks` ✅, `1214 passed`; Studio PWA CI run `32350859278`, `studio` ✅ и `browser-e2e` ✅; manual Dependency audit run `32350895472`, `node` ✅ и `python` ✅; browser failure-artifact upload ожидаемо skipped при success; product readiness не изменилась — `78/109`
- Pull Request: #214 — `https://github.com/Just9120/Elevenlabs-API/pull/214`; draft, `MERGEABLE`, base `main@3ef4a45`, published head `c4948e10204347950735331e9aa4c98cbdd9560c`
- CI/checks: exact material head `c4948e1` — repository CI `32350859254` ✅; Studio PWA CI `32350859278` ✅; Dependency audit `32350895472` ✅
- Deployment/environment: не начато
- Blockers: нет на локальной стадии; exact deployment identity остаётся известным delivery risk
- Unverified assumptions: exploitability advisory в фактических runtime paths ещё не определена; upgrade compatibility должна быть подтверждена tests/build
- Preserved pre-existing changes: none

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Goal AC не добавляются в product denominator. Этот docs-only Goal не меняет ни один product AC.

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

Изменение current Goal: `0` product AC при неизменном denominator `109`.

## Candidate next Goals

Эти items — proposals и не авторизуют implementation:

1. `DELIVERY-EXACT-SHA-01` — exact-SHA standard component deploy и observable build identity.
2. `PWA-INGEST-FAVORITES-01` — owner-scoped target-folder Favorites после выбора persistence semantics.
3. `PWA-INGEST-FOLDERS-01` — bounded local/Drive folder intake и одна target folder для folder batch.
4. `PWA-ARBITRARY-SEGMENTS-01` — generalized ordered N-fragment model вместо narrow two-part split.
5. `PWA-SOURCE-TIME-01` — source-created timestamp authority для local/Drive intake, output и standardization.
6. `PWA-CLEAR-OPERATIONS-01` — manifest/history/analytics clear flows с explicit confirmation и audit semantics.
7. `PWA-SPEAKER-IDENTITY-01` — names/roles и manual listen-and-assign после privacy/data-retention design.
8. `PWA-REALTIME-MATRIX-01` — representative microphone/display/mixed production LIVE matrix.
9. `COLAB-REALTIME-STABILITY-01` — capture stability после PWA priority scope.

## Blockers и risks

- Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`); это project delivery debt, но для docs-only Goal `DEPLOY/LIVE N/A`.
- `main` не имеет platform branch protection/rulesets; documented merge gates проверяются вручную без bypass.
- Scheduled Dependency audit run `31996248930` на baseline `f3a3f33` завершился failure; findings устранены на Current Goal material head и подтверждены green manual run `32350895472`, merge/deploy ещё не выполнены.
- Verified project CI/CD profile датирован 2026-08-14; будущий audit обязан повторно сверить изменяемые GitHub settings/runtime configuration.

## Sources of truth

- Repository instructions и Goal process: `AGENTS.md`.
- Product scope/AC: `docs/project-spec.md`.
- Current Goal/checkpoint/readiness: этот документ.
- CI/CD и production safety: `docs/ci-cd-rules.md`.
- Actual architecture: `docs/architecture.md`.
- Detailed PWA processing: `docs/studio-processing-contract.md`.
- Historical evidence: `docs/delivery-plan-archive.md` только при reconciliation.

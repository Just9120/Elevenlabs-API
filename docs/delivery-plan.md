# Delivery plan

## Current Goal

- **ID / title:** `DOCS-GOAL-DRIVEN-01` — миграция repository policy на `goal-driven-v1`.
- **State:** `IN_PROGRESS`.
- **Authorization source:** explicit owner instruction от 2026-08-20: заменить присланные `AGENTS.md` и `ci-cd-rules.md`, отдельный agent delivery workflow убрать полностью.
- **Scope:** принять новый Goal-driven repository kernel; обновить universal CI/CD contract с сохранением verified project profile; удалить standalone workflow и устранить active/stale references; согласовать README, project-spec navigation, delivery plan и archive.
- **Non-goals:** product/code/runtime behavior, workflows, GitHub settings, dependencies, architecture, deployments, production operations и изменение product AC/denominator.
- **Goal AC:**
  1. Root `AGENTS.md` использует contract `goal-driven-v1` и содержит Goal authorization, readiness, checkpoint/recovery, Git и delivery boundaries без зависимости от standalone workflow.
  2. `docs/ci-cd-rules.md` использует universal contract `goal-driven-v1`; verified project-specific profile и configuration gaps сохранены.
  3. Standalone agent delivery workflow удалён; active canonical navigation и source lists больше на него не ссылаются, historical archive явно помечает superseded policy.
  4. Delivery dashboard содержит один актуальный Current Goal/checkpoint; documentation consistency checks и applicable CI проходят.
- **Required Evidence:** `SPEC N/A | CODE N/A | TEST ✅ | CI — | DEPLOY N/A | LIVE N/A`.
- **Known blockers/dependencies:** нет; scheduled Dependency audit failure baseline рассматривается отдельно и не входит в docs Goal.
- **Stop condition:** Goal AC выполнены, PR merged после applicable terminal green checks, local base синхронизирован, созданные merged branches очищены; после `DONE` не переходить к следующей Goal без explicit authorization.

## Active execution checkpoint

- Updated (UTC): 2026-08-20T07:29:53Z
- Session mode: FOCUSED_TASK после RECOVERY завершённого `PWA-REALTIME-CAPTURE-01`
- Base branch: `main`
- Base SHA: `f3a3f33fb0ce019c1916d95f754ed72d1d56ee01`
- Working branch: `codex/docs-goal-driven-policy`
- Last verified revision: `f3a3f33fb0ce019c1916d95f754ed72d1d56ee01`
- Working tree: DIRTY — только owned documentation changes: `AGENTS.md`, `README.md`, удаление standalone workflow, `docs/ci-cd-rules.md`, `docs/delivery-plan.md`, `docs/delivery-plan-archive.md` и `docs/project-spec.md`
- Completed since base: принят новый `AGENTS.md`; новый universal CI/CD contract объединён с существующим verified project profile; standalone workflow удалён; active README/project-spec references удалены; stale README readiness синхронизирована; предыдущий realtime checkpoint перенесён в archive
- Current step: final pre-commit diff/scope review
- Next exact action: stage только семь intended documentation paths и создать один docs-policy commit
- Validation and Evidence: supplied/repository `AGENTS.md` exact normalized match; universal CI/CD sections exact normalized match; previous verified project profile preserved; standalone workflow и stale references отсутствуют; Markdown local links `14/14` OK; bundled Python `scripts/ci_checks.py` passed; `git diff --check` passed
- Pull Request: N/A
- CI/checks: для текущей branch ещё не запускались; baseline scheduled Dependency audit run `31996248930` завершился failure 2026-08-17 и не является обычным PR gate
- Deployment/environment: N/A для docs-only Goal; baseline `main@f3a3f33` имел successful Studio Platform CD run `31872181463`
- Blockers: none
- Unverified assumptions: owner-provided `UNSET` CI/CD profile является универсальным template, поэтому более сильный verified repository profile сохранён; причина scheduled Dependency audit failure не анализировалась в этом scope
- Preserved pre-existing changes: none

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Goal AC не добавляются в product denominator. Этот docs-only Goal не меняет ни один product AC.

| Product/epic | Current | Previous snapshot | Readiness/Evidence |
|---|---:|---:|---|
| **Project** | **71,6% (`78/109`)** | **71,6% (`78/109`)** | Без изменения scope или product AC. |
| **Google Colab** | **75,9% (`22/29`)** | **75,9% (`22/29`)** | Без изменений в docs-policy Goal. |
| `COLAB-BATCH-01` | **73,9% (`17/23`)** | **73,9% (`17/23`)** | 🟦 IN PROGRESS; `SPEC ✅ CODE ◐ TEST ◐ CI ✅ DEPLOY ◐ LIVE ◐`. |
| `COLAB-REALTIME-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; capture stability не подтверждена полностью. |
| **Studio PWA** | **70,0% (`56/80`)** | **70,0% (`56/80`)** | Без изменений в docs-policy Goal. |
| `PWA-CORE-01` | **84,6% (`11/13`)** | **84,6% (`11/13`)** | 🟦 IN PROGRESS; нет active-UI expiry removal и color selector. |
| `PWA-INGEST-01` | **63,6% (`7/11`)** | **63,6% (`7/11`)** | 🟦 IN PROGRESS; нет Favorites и folder intake. |
| `PWA-SEGMENTS-01` | **0,0% (`0/5`)** | **0,0% (`0/5`)** | 🟦 IN PROGRESS; текущий two-part split не выполняет arbitrary-N AC. |
| `PWA-BATCH-01` | **90,0% (`9/10`)** | **90,0% (`9/10`)** | 🟦 IN PROGRESS; source-created timestamp отсутствует. |
| `PWA-SPEAKER-IDENTITY-01` | **0,0% (`0/5`)** | **0,0% (`0/5`)** | ⬜ BACKLOG; names/roles/listen-and-assign отсутствуют. |
| `PWA-MANIFEST-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; нет safe clear action. |
| `PWA-STANDARDIZATION-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; нет original-source creation authority. |
| `PWA-REALTIME-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; capture fix deployed и Chrome LIVE подтверждён, но full microphone/display/mixed matrix для `PR-06` остаётся неполной: `SPEC ✅ CODE ✅ TEST ✅ CI ✅ DEPLOY ✅ LIVE ◐`. |
| `PWA-OPERABILITY-01` | **77,8% (`14/18`)** | **77,8% (`14/18`)** | 🟦 IN PROGRESS; clear-operation AC остаются. |

Изменение current Goal: `0` product AC при неизменном denominator `109`.

## Candidate next Goals

Эти items — proposals и не авторизуют implementation:

1. `PWA-INGEST-FAVORITES-01` — owner-scoped target-folder Favorites после выбора persistence semantics.
2. `PWA-INGEST-FOLDERS-01` — bounded local/Drive folder intake и одна target folder для folder batch.
3. `PWA-ARBITRARY-SEGMENTS-01` — generalized ordered N-fragment model вместо narrow two-part split.
4. `PWA-SOURCE-TIME-01` — source-created timestamp authority для local/Drive intake, output и standardization.
5. `PWA-CLEAR-OPERATIONS-01` — manifest/history/analytics clear flows с explicit confirmation и audit semantics.
6. `PWA-SPEAKER-IDENTITY-01` — names/roles и manual listen-and-assign после privacy/data-retention design.
7. `PWA-REALTIME-MATRIX-01` — representative microphone/display/mixed production LIVE matrix.
8. `COLAB-REALTIME-STABILITY-01` — capture stability после PWA priority scope.

## Blockers и risks

- Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`); это project delivery debt, но для docs-only Goal `DEPLOY/LIVE N/A`.
- `main` не имеет platform branch protection/rulesets; documented merge gates проверяются вручную без bypass.
- Scheduled Dependency audit run `31996248930` на baseline `f3a3f33` завершился failure; root cause и remediation не входят в текущий docs-policy scope.
- Verified project CI/CD profile датирован 2026-08-14; будущий audit обязан повторно сверить изменяемые GitHub settings/runtime configuration.

## Sources of truth

- Repository instructions и Goal process: `AGENTS.md`.
- Product scope/AC: `docs/project-spec.md`.
- Current Goal/checkpoint/readiness: этот документ.
- CI/CD и production safety: `docs/ci-cd-rules.md`.
- Actual architecture: `docs/architecture.md`.
- Detailed PWA processing: `docs/studio-processing-contract.md`.
- Historical evidence: `docs/delivery-plan-archive.md` только при reconciliation.

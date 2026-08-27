# Delivery plan

## Current Goal

- **ID / title:** `REPO-HARDENING-01` — первая очередь технического долга, documentation truth и CI efficiency.
- **State:** `IN_PROGRESS` — Goal явно авторизована, exact base проверен, отдельная feature branch создана.
- **Authorization source:** explicit user instruction 2026-08-27 «формируй общую цель под техдолгу, документам и CI, и приступай»; audit findings — supporting evidence, а не отдельная authorization.
- **Scope:** восстановить operational metadata после PR `#245`; синхронизировать README, security/processing/runbook facts и placement dated audit; исправить подтверждённый `.webmanifest` MIME defect с regression; ускорить repository и Studio CI через content-addressed caches и эквивалентное более частое service-health polling; pin actions в затронутых CI workflows на verified immutable SHA; выполнить bounded cold/warm benchmark без сокращения validation surface; applicable PR/merge/web delivery/public LIVE.
- **Non-goals:** изменение product requirements/AC или commercial implementation; удаление deprecated/legacy API без usage evidence; big-bang refactor крупных frontend/API modules; DB roles/schema/data migration; pagination/load/multi-worker work; branch protection/rulesets; exact-revision CD redesign; CI/CD safety-contract change; paid/provider/Google mutations; larger/self-hosted runners и новые scheduled workflows.
- **Goal AC:**
  1. `RH-01`: README и current canonical/operational documents описывают exact merged/runtime state, source priority и current Goal без stale candidate claims; archive не используется как current readiness input.
  2. `RH-02`: stale security/processing/runbook statements исправлены или явно отделены как historical examples; dated audit находится вне operational runbooks; links проходят проверку.
  3. `RH-03`: container nginx отдаёт `/manifest.webmanifest` как `application/manifest+json`; focused regression и public post-deploy header check проходят.
  4. `RH-04`: существующие `pytest`, lightweight checks, frontend lint/unit/build, authenticated browser E2E, Compose, image build и secret/non-root validations не удалены и не ослаблены; PR-head и exact-main gates сохраняются.
  5. `RH-05`: pip, exact Playwright browser и Docker layers используют bounded content-addressed caches; PostgreSQL/Redis readiness проверяется чаще при не меньшем total retry window; active cache остаётся не более `4 GiB`.
  6. `RH-06`: все third-party actions в затронутых CI workflows pinned на verified full commit SHA; permissions не расширены.
  7. `RH-07`: один заранее разрешённый warm-cache benchmark подтверждает не менее `20%` уменьшения raw runner time representative web-only PR+main validation относительно baseline `14,57 min` (target `<= 11,66 min`); cold-cache regression не превышает `10%`. Если target недостижим без ослабления gates, Goal не объявляется `DONE` и blocker фиксируется.
  8. `RH-08`: local validation, exact PR-head CI, merge, applicable web deployment и public MIME LIVE завершены; failures/skips классифицированы, а product readiness не изменена без изменения atomic AC.
- **Required Evidence:** target `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`; current `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** первый cache run является cold; Goal разрешает ровно один дополнительный controlled warm-cache benchmark после наполнения cache. Account-level billing attribution недоступна текущему `gh` token без дополнительного `user` scope, но repository public и использует только standard `ubuntu-latest`. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** все Goal AC подтверждены required Evidence либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; после closure к следующей Goal без новой authorization не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-27T19:56:00Z.
- Session mode: authorized bounded implementation Goal.
- Base branch/SHA: fetched `origin/main@8761e86808e8562eff05588f6f60d15dd04dbcf4`; default branch `main`; local `main` совпадал перед branch creation. GitHub auth active для `Just9120` с `repo/workflow` scopes.
- Working branch: `codex/repository-stabilization-01`; создана от exact base SHA выше.
- Last verified revision: `8761e86808e8562eff05588f6f60d15dd04dbcf4` — clean merged baseline PR `#245`; exact-main repository CI `33104113256`, Studio CI `33104113243` и web CD `33104113313` success.
- Working tree at Goal start: clean; unrelated pre-existing changes absent.
- Completed: Git/GitHub recovery; PR `#245` merge/CI/deploy reconciled; CI step-level baseline measured. Exact web-only PR+main validation baseline is `14,57` raw runner-minutes; full merge cycle including CD is `15,96`. Current Actions cache is `113103350` bytes, unexpired failure artifacts are about `4,4 MB`.
- Current step: зафиксировать durable Goal и archived state предыдущей Goal первым documentation commit.
- Next exact action: синхронизировать README/canonical operational metadata и stale documentation claims, затем выполнить link/static checks.
- Validation and Evidence: repository is public; all declared runners are standard `ubuntu-latest`. PR `#245` and exact-main required jobs passed. No validation for current branch changes yet.
- Pull Request / CI / deployment: branch local only; push/PR отсутствуют; initial push будет выполнен только после полной local validation всего scope.
- Blockers: отсутствуют для local implementation. Metadata writer отсутствует; post-delivery final metadata может быть reconciled только approved механизмом или в следующей authorized Goal.
- Unverified assumptions: BuildKit/Playwright warm-cache hit rate и final savings должны быть измерены GitHub run evidence; public repo billing rule не доказывает account-level attribution.
- Preserved pre-existing changes: отсутствуют.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Текущая operational Goal не добавляет product AC и не меняет denominator.

| Product/epic | Current independent snapshot | Previous independent snapshot | Основание |
|---|---:|---:|---|
| **Current canonical scope** | **100% (`148/148`)** | **100% (`148/148`)** | Product denominator и AC completion не изменились; PR `#245` добавил exact-main CI/DEPLOY evidence, но authenticated Picker LIVE остаётся неподтверждённым. |
| **Full upstream scope** | **N/A — `SPEC RECONCILIATION REQUIRED`** | **N/A** | Commercial production включён owner decision 2026-08-27 как BACKLOG без implementation authorization; `275` raw list-item requirements ещё не преобразованы в согласованные atomic AC, denominator отсутствует. |
| **Google Colab** | **100% (`29/29`)** | **100% (`29/29`)** | Scope не затронут. |
| **Studio PWA** | **100% (`119/119`)** | **100% (`119/119`)** | Все current PWA AC выполнены; Google Picker UX получил CI/DEPLOY, но authenticated LIVE остаётся `—`; Transcriptions UX LIVE `—`, Manifest LIVE `◐`. |
| `PWA-GOOGLE-PICKER-UX-01` | **100% (`3/3`)** | **100% (`3/3`)** | PR `#245`, exact-main CI и web deployment подтверждены; authenticated source/output-folder LIVE исправления ещё не зафиксировано как Evidence. |
| `PWA-TRANSCRIPTIONS-UX-01` | **100% (`4/4`)** | **100% (`4/4`)** | DEPLOY теперь ✅ после PR `#244`; authenticated LIVE остаётся `—`. |
| `PWA-MANIFEST-01` | **100% (`6/6`)** | **100% (`6/6`)** | Representative folder import/clear mutation LIVE остаётся `◐`. |
| Остальные existing epics | **100% (`135/135`)** | **100% (`135/135`)** | AC completion не изменился; current audit не отменяет ранее зафиксированные required Evidence. |

## Candidate next Goals

1. `SPEC-RECONCILIATION-01` — сопоставить все upstream requirements с canonical contract, сформировать эпики/atomic AC и новый denominator; commercial production уже включён owner decision как BACKLOG, implementation продукта не входит.
2. `CI-CD-HARDENING-02` — exact deployed revision contract, branch/ruleset/Environment enforcement и metadata synchronization; текущая Goal не меняет production safety contract.
3. `DB-LEAST-PRIVILEGE-01` — evidence actual roles и отдельные migration/application roles с backup/rollback plan.
4. `PWA-QUERY-BOUNDS-01` — pagination/retention/query budgets и load/concurrency validation растущих collections.
5. `PWA-STORAGE-ISOLATION-01` — разделить Audio Preparation references и transcription intake на разные lifecycle namespaces/buckets после architecture decision.

## Risks и boundaries

- API collection остаётся authority для active source picker; transient reload failure не должен молча удалять last-known metadata или разрешать mutation по неподтверждённому state.
- Ручное удаление object напрямую в R2 обходит application lifecycle и не определяется текущим list endpoint; per-object `HEAD` в hot path не добавляется без отдельной architecture/performance оценки.
- Переименование user-visible brand не означает автоматический rename repository, packages, routes, domain, Compose project или persistent identities.

## Sources of truth

- Repository instructions: `AGENTS.md`.
- Product scope/AC: `docs/project-spec.md`.
- Current Goal/checkpoint/readiness: этот документ.
- CI/CD safety: `docs/ci-cd-rules.md`.
- Actual architecture: `docs/architecture.md`.
- Historical evidence: `docs/delivery-plan-archive.md`.

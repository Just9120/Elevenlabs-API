# Delivery plan

## Current Goal

- **ID / title:** `REPO-HARDENING-01` — первая очередь технического долга, documentation truth и CI efficiency.
- **State:** `IN_PROGRESS` — Goal явно авторизована, exact base проверен, отдельная feature branch создана.
- **Authorization source:** explicit user instruction 2026-08-27 «формируй общую цель под техдолгу, документам и CI, и приступай»; audit findings — supporting evidence, а не отдельная authorization.
- **Scope:** восстановить operational metadata после PR `#245`; синхронизировать README, security/processing/runbook facts и placement dated audit; исправить подтверждённый `.webmanifest` MIME defect с regression; ускорить repository и Studio CI через content-addressed caches и эквивалентное более частое service-health polling; pin все external actions в active workflows на verified immutable SHA без изменения production workflow logic; выполнить bounded cold/warm benchmark без сокращения validation surface; applicable PR/merge/web delivery/public LIVE.
- **Non-goals:** изменение product requirements/AC или commercial implementation; удаление deprecated/legacy API без usage evidence; big-bang refactor крупных frontend/API modules; DB roles/schema/data migration; pagination/load/multi-worker work; branch protection/rulesets; exact-revision CD redesign; CI/CD safety-contract change; paid/provider/Google mutations; larger/self-hosted runners и новые scheduled workflows.
- **Goal AC:**
  1. `RH-01`: README и current canonical/operational documents описывают exact merged/runtime state, source priority и current Goal без stale candidate claims; archive не используется как current readiness input.
  2. `RH-02`: stale security/processing/runbook statements исправлены или явно отделены как historical examples; dated audit находится вне operational runbooks; links проходят проверку.
  3. `RH-03`: container nginx отдаёт `/manifest.webmanifest` как `application/manifest+json`; focused regression и public post-deploy header check проходят.
  4. `RH-04`: существующие `pytest`, lightweight checks, frontend lint/unit/build, authenticated browser E2E, Compose, image build и secret/non-root validations не удалены и не ослаблены; PR-head и exact-main gates сохраняются.
  5. `RH-05`: pip, exact Playwright browser и Docker layers используют bounded content-addressed caches; PostgreSQL/Redis readiness проверяется чаще при не меньшем total retry window; active cache остаётся не более `4 GiB`.
  6. `RH-06`: все external actions в active workflows pinned на verified full commit SHA; permissions и production workflow logic не изменены.
  7. `RH-07`: один заранее разрешённый warm-cache benchmark подтверждает не менее `20%` уменьшения raw runner time representative web-only PR+main validation относительно baseline `14,57 min` (target `<= 11,66 min`); cold-cache regression не превышает `10%`. Если target недостижим без ослабления gates, Goal не объявляется `DONE` и blocker фиксируется.
  8. `RH-08`: local validation, exact PR-head CI, merge, applicable web deployment и public MIME LIVE завершены; failures/skips классифицированы, а product readiness не изменена без изменения atomic AC.
- **Required Evidence:** target `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`; current `SPEC ✅ | CODE ✅ | TEST ✅ | CI ◐ | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** первый cache run является cold; Goal разрешает ровно один дополнительный controlled warm-cache benchmark после наполнения cache. Account-level billing attribution недоступна текущему `gh` token без дополнительного `user` scope, но repository public и использует только standard `ubuntu-latest`. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** все Goal AC подтверждены required Evidence либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; после closure к следующей Goal без новой authorization не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-27T20:41:30Z.
- Session mode: authorized bounded implementation Goal.
- Base branch/SHA: fetched `origin/main@8761e86808e8562eff05588f6f60d15dd04dbcf4`; default branch `main`; local `main` совпадал перед branch creation. GitHub auth active для `Just9120` с `repo/workflow` scopes.
- Working branch: `codex/repository-stabilization-01`; создана от exact base SHA выше.
- Last verified revision: `a86eb28388bfa8abfa5c2f0aad868bbc6ce9fd66` — grouped cache fix; functional CI и performance target green, review gate требует concurrency fix ниже.
- Working tree at Goal start: clean; unrelated pre-existing changes absent.
- Completed: Git/GitHub recovery и PR `#245` reconciliation; documentation consolidation; historical audit move; manifest MIME remediation/regression; all-workflow immutable action pinning; pip/Playwright/BuildKit caches; equivalent 2s/25 service-health polling; PR-only stale-run cancellation and main-only BuildKit cache writes. Commits: `98d8062`, `a54935f`, `11b3a47`, `abfc212`, `72a6724`, `07cc122`, `a86eb28`.
- Current step: закрыть valid review finding: ref-based concurrency может вытеснить pending exact-main run даже при `cancel-in-progress=false`.
- Next exact action: локально проверить revision-specific non-PR concurrency groups, выполнить grouped review-fix push и дождаться новых exact-head checks/review resolution.
- Validation and Evidence: isolated Python 3.11 portable suite `1072 passed, 5 skipped`; frontend ESLint PASS, Vitest `603/603`, TypeScript/Vite production build PASS, Playwright discovery `11`; all 9 workflow YAML parse PASS; immutable-action/CI-efficiency/browser contracts PASS; authority-document relative links PASS; `scripts/ci_checks.py` и `git diff --check` PASS. PR `#246` initial head `07cc122`: functional gates green, но raw `519s / 8,65 min` не прошёл cold regression AC. Grouped fix head `a86eb28`: repository CI run `33114036739` `134s`, Studio run `33114036741` jobs `studio=96s`, `browser-e2e=92s`, raw sum `322s / 5,37 min`, то есть `25,6%` быстрее PR baseline `433s / 7,22 min`; все checks green. Review thread `PRRT_kwDOSEKZn86c-Hu9` подтвердил exact-main concurrency gap. Local Docker unavailable. Initial in-place npm failed из-за OneDrive lock; isolated npm 10 validation прошла и не изменила workspace.
- Pull Request / CI / deployment: PR `#246`; merge не выполняется до concurrency fix, новых exact-head checks и resolution review thread.
- Blockers: текущий review gate не пройден из-за valid exact-main concurrency finding; fix находится в текущем scope. Metadata writer отсутствует; post-delivery final metadata может быть reconciled только approved механизмом или в следующей authorized Goal.
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

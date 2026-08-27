# Delivery plan

## Current Goal

- **ID / title:** `PWA-GOOGLE-PICKER-UX-01` — стабильный viewport и выбор текущей output folder.
- **State:** `IN_PROGRESS` — Goal явно авторизована и feature branch создана; implementation начата.
- **Authorization source:** explicit user instruction 2026-08-27 «ставь цель и приступай» после согласования bounded Goal; durable product AC — `PG-01..PG-03` в `docs/project-spec.md`.
- **Scope:** source-file, source-folder и output-folder Google Picker flows; lock/restore document scroll; viewport-stable modal lifecycle; verified способ выбрать текущую открытую output folder, включая empty folder; focused unit/DOM/browser tests и applicable web delivery/LIVE.
- **Non-goals:** изменение Google OAuth scopes; общий Drive file manager; source ingestion/storage semantics; provider calls; backend/schema/worker changes; CI/CD safety policy; commercial implementation.
- **Goal AC:**
  1. `PG-01`: Picker не смещается относительно viewport при попытке прокрутки document во всех трёх flows.
  2. `PG-02`: background scroll заблокирован на всём Picker lifecycle и точно восстановлен после pick/cancel/error/timeout без page jump.
  3. `PG-03`: текущую output folder можно подтвердить без выбора child, включая отсутствие child folders.
  4. Focused regression tests воспроизводят оба исходных defect и проходят вместе с applicable lint/build/full frontend suite и exact-head CI.
  5. Applicable web deployment и owner-controlled authenticated browser LIVE подтверждают source и output-folder flows.
- **Required Evidence:** target `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`; current `SPEC ✅ | CODE ✅ | TEST ✅ | CI — | DEPLOY — | LIVE ❌`.
- **Known blockers/dependencies:** authenticated production LIVE требует owner session. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** все Goal AC подтверждены required Evidence либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; после closure к следующей Goal без новой authorization не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-27T18:27:05Z.
- Session mode: authorized bounded implementation Goal.
- Base branch/SHA: verified fetched `origin/main@18cbd46e9361a66bfbc1f2265d0820aa72aedf50`; default branch `main`; local `main` совпадает. GitHub auth active для `Just9120` с `repo/workflow` scopes.
- Working branch: `codex/fix-google-picker-ux`; merge-base с `origin/main` — exact base SHA выше.
- Last verified revision: `60c4ec23bdd4afa6dcbff25633cdd96121b4704f` — оба implementation slices; focused/full frontend tests, lint, typecheck, production build, E2E discovery, `scripts/ci_checks.py` и `git diff --check` PASS.
- Working tree at Goal start: clean; unrelated pre-existing changes absent.
- Completed: `PG-01/PG-02` реализованы общим document scroll lock с idempotent cleanup; `PG-03` реализован bounded app-owned output-folder dialog, который позволяет подтвердить current/empty folder и возвращает exact folder ID для существующей server-side verification. Commits: `a197e39` и `60c4ec2`.
- Current step: синхронизировать operational readiness/checkpoint, затем выполнить единственный initial push и открыть PR.
- Next exact action: проверить included GitHub Actions usage, закоммитить этот readiness checkpoint, выполнить initial push и создать PR.
- Validation and Evidence: terminal-path regressions `6/6` PASS; полный frontend Vitest `603/603` PASS; ESLint, `tsc -b`, production Vite build, E2E discovery `11` tests, `scripts/ci_checks.py` и `git diff --check` PASS. Local Python `pytest` unavailable (`No module named pytest`) и не считается success. Current AC: canonical `148/148`, Colab `29/29`, PWA `119/119`.
- Pull Request / CI / deployment: PR отсутствует; push до полной local validation не выполнялся; CI/DEPLOY для Goal не запускались.
- Blockers: authenticated production LIVE зависит от owner session; metadata writer отсутствует.
- Unverified assumptions: production OAuth token/CSP фактически допускают direct Drive REST listing из web origin; это требует exact-head CI и authenticated LIVE, а не вывода только по source/config.
- Preserved pre-existing changes: audit/spec commits `172f6af`, `0686a1d`, `46fa05d`, `720f046` созданы в рамках текущей user-requested audit chain и сохранены в feature branch; unrelated user state отсутствует.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Текущая cache-coherency remediation подтверждает existing product behavior, но не добавляет новый product denominator без отдельного durable scope decision.

| Product/epic | Current independent snapshot | Previous independent snapshot | Основание |
|---|---:|---:|---|
| **Current canonical scope** | **100% (`148/148`)** | **99,3% (`147/148`)** | `PG-03` выполнен локально; изменение `+0,7 pp`. Это не percentage полного upstream scope и не production READY без Evidence gates. |
| **Full upstream scope** | **N/A — `SPEC RECONCILIATION REQUIRED`** | **N/A** | Commercial production включён owner decision 2026-08-27 как BACKLOG без implementation authorization; `275` raw list-item requirements ещё не преобразованы в согласованные atomic AC, denominator отсутствует. |
| **Google Colab** | **100% (`29/29`)** | **100% (`29/29`)** | Scope не затронут. |
| **Studio PWA** | **100% (`119/119`)** | **99,2% (`118/119`)** | Все current PWA AC выполнены, но Google Picker UX остаётся IN PROGRESS до CI/DEPLOY/LIVE; Transcriptions UX LIVE `—`, Manifest LIVE `◐`. |
| `PWA-GOOGLE-PICKER-UX-01` | **100% (`3/3`)** | **66,7% (`2/3`)** | Current/empty output-folder selection и scroll lifecycle локально подтверждены; required CI/DEPLOY/LIVE ещё отсутствуют. |
| `PWA-TRANSCRIPTIONS-UX-01` | **100% (`4/4`)** | **100% (`4/4`)** | DEPLOY теперь ✅ после PR `#244`; authenticated LIVE остаётся `—`. |
| `PWA-MANIFEST-01` | **100% (`6/6`)** | **100% (`6/6`)** | Representative folder import/clear mutation LIVE остаётся `◐`. |
| Остальные existing epics | **100% (`135/135`)** | **100% (`135/135`)** | AC completion не изменился; current audit не отменяет ранее зафиксированные required Evidence. |

## Candidate next Goals

1. `SPEC-RECONCILIATION-01` — сопоставить все upstream requirements с canonical contract, сформировать эпики/atomic AC и новый denominator; commercial production уже включён owner decision как BACKLOG, implementation продукта не входит.
2. `PWA-MANIFEST-MIME-01` — standards-compliant `.webmanifest` response после closure текущей Goal и reconciliation priority decision.
3. `CI-CD-HARDENING-01` — immutable action SHAs и exact deployed revision contract; требует explicit CI/CD policy task.
4. `PWA-STORAGE-ISOLATION-01` — разделить Audio Preparation references и transcription intake на разные lifecycle namespaces/buckets после architecture decision.
5. `COMMERCIAL-FOUNDATION-01` — единый codebase, изолированные environments и capability boundaries после утверждения reconciled commercial scope.

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

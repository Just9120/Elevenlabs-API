# Delivery plan

## Current Goal

- **ID / title:** `SPEC-CANONICALIZATION-02` — перенос согласованного upstream scope в canonical spec.
- **State:** `IN_PROGRESS` — canonical AC перенесены локально; validation/commit/PR/CI ещё не завершены.
- **Authorization source:** explicit user instruction 2026-08-28 «отчет в репозитории не нужен. добавь эти требования в project-spec»; ранее owner включил commercial scope, но запретил его текущую implementation.
- **Scope:** перенести все однозначно атомизированные upstream requirements в `docs/project-spec.md`; включить `142` non-commercial и `242` commercial/cross-contour AC; оставить commercial в `BACKLOG`; сохранить conflicts/ambiguities как SPEC gaps вне denominator; пересчитать readiness; удалить локальный non-canonical report и его ссылки; обновить operational docs; выполнить docs validation, PR и required CI.
- **Non-goals:** product/commercial implementation; самостоятельное разрешение неоднозначных product/legal решений; CI/CD/production logic; migrations, provider/Google mutations, deployment или LIVE проверки.
- **Goal AC:**
  1. `SC-01`: `142` новых non-commercial AC перечислены atomically и имеют уникальные IDs; current completion `55/142` воспроизводим по строкам `Выполнено`.
  2. `SC-02`: `50` cross-contour и `192` commercial AC перечислены atomically как `BACKLOG`, `0/242`; personal evidence не присвоено commercial contour.
  3. `SC-03`: canonical denominator равен `148 + 142 + 50 + 192 = 532`; numerator `203`, full readiness `38,2%`, non-commercial `203/290 = 70,0%`.
  4. `SC-04`: десять conflict/ambiguity/runtime-risk records сохранены как SPEC gaps вне denominator; решения не придуманы.
  5. `SC-05`: non-canonical audit-report отсутствует в итоговом repository diff, а README/delivery/spec не ссылаются на него.
  6. `SC-06`: local structure/count/link checks, `ci_checks`, exact PR-head CI и merge завершены; `DEPLOY/LIVE` имеют `N/A` для docs-only Goal.
- **Required Evidence:** target `SPEC ✅ | CODE N/A | TEST ✅ | CI ✅ | DEPLOY N/A | LIVE N/A`; current `SPEC ✅ | CODE N/A | TEST ✅ | CI — | DEPLOY N/A | LIVE N/A`.
- **Known blockers/dependencies:** отдельные SPEC gaps требуют будущих owner decisions; legal/commercial AC требуют внешней юридической проверки и отдельной implementation authorization. Approved post-merge metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** все Goal AC подтверждены required Evidence либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; после closure к следующей Goal без новой authorization не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-28T06:16:42Z.
- Session mode: authorized docs-only canonicalization; product/commercial implementation запрещена.
- Base branch/SHA: fetched `origin/main@f6b0d70e751673ea4edb11c655a732d594ff8f31`; local `main` clean и совпадал с origin; open PR отсутствовали.
- Working branch: `codex/spec-canonicalization-02`; чистая публикационная branch создана от exact verified `origin/main` SHA выше, итоговый net diff перенесён через squash без истории удалённого audit-report.
- Last verified revision: branch commit `3ff3fbd90a3cd1bc6bd1b7c15e6b83950ff952f7`; base `main@f6b0d70e751673ea4edb11c655a732d594ff8f31`.
- Working tree at Goal start: clean; unrelated pre-existing changes absent.
- Completed: exact upstream revision/tab/counts зафиксированы; `docs/project-spec.md` содержит `142 + 50 + 192 = 384` новых AC, canonical denominator `532`, readiness `203/532`, commercial `0/242` и десять явных SPEC-gap/risk records. Чистая branch от `origin/main` содержит только итоговый net diff четырёх документов; non-canonical report отсутствует в tree и history branch.
- Current step: выполнить один initial push, создать PR и дождаться exact-head required CI/review.
- Next exact action: `git push -u origin codex/spec-canonicalization-02`, затем создать PR в `main`.
- Validation and Evidence: upstream counts `275 + 8 = 283`; canonical `532` AC, unique `532`, done `203`; new non-commercial `142`, done `55`; commercial/cross-contour `242`, done `0`; relative Markdown links PASS; stale report/reference search PASS; `python scripts/ci_checks.py` PASS; staged `git diff --check` PASS. Exact-main full CI `33116072365` и Studio/browser CI `33116072392` success; exact PR-head CI остаётся обязательным.
- Pull Request / CI / deployment: PR/push отсутствуют. `DEPLOY/LIVE` — `N/A` для docs-only Goal.
- Blockers: отсутствуют для docs scope; будущие product/legal decisions и commercial authorization не блокируют canonicalization.
- Unverified assumptions: сохранённые SPEC gaps не входят в denominator; existing personal capability не доказывает commercial isolation/runtime readiness.
- Preserved pre-existing changes: отсутствуют.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Текущий snapshot пересчитан после явного расширения canonical scope; previous snapshot сохранён для сравнения.

| Product/epic | Current independent snapshot | Previous independent snapshot | Основание |
|---|---:|---:|---|
| **Полный canonical scope** | **38,2% (`203/532`)** | **100% (`148/148`)** | Разница `−61,8 pp`: denominator расширен на `384` явно согласованных AC; existing completion не регрессировал. |
| **Non-commercial scope** | **70,0% (`203/290`)** | **100% (`148/148`)** | Разница `−30,0 pp`: добавлено `142` AC, из которых `55` подтверждены; `PARTIAL` считается невыполненным. |
| **Commercial/cross-contour** | **0% (`0/242`)** | **N/A** | Commercial включён как BACKLOG; personal reuse не доказывает isolated commercial contour. |
| **Google Colab canonical** | **100% (`31/31`)** | **100% (`29/29`)** | Добавлены два выполненных lifecycle AC; intermittent capture сохранён как runtime risk. |
| **Personal Studio PWA canonical** | **66,4% (`172/259`)** | **100% (`119/119`)** | Добавлено `140` AC, из них `53` выполнены. Existing LIVE gates остаются без изменений. |
| `PWA-GOOGLE-PICKER-UX-01` | **100% (`3/3`)** | **100% (`3/3`)** | PR `#245`, exact-main CI и web deployment подтверждены; authenticated source/output-folder LIVE исправления ещё не зафиксировано как Evidence. |
| `PWA-TRANSCRIPTIONS-UX-01` | **100% (`4/4`)** | **100% (`4/4`)** | DEPLOY теперь ✅ после PR `#244`; authenticated LIVE остаётся `—`. |
| `PWA-MANIFEST-01` | **100% (`6/6`)** | **100% (`6/6`)** | Representative folder import/clear mutation LIVE остаётся `◐`. |
| Остальные existing epics | **100% (`135/135`)** | **100% (`135/135`)** | AC completion не изменился; current audit не отменяет ранее зафиксированные required Evidence. |

## Candidate next Goals

1. `SPEC-GAPS-DECISIONS-03` — принять bounded решения по сохранённым conflicts/ambiguities; implementation не начинается автоматически.
2. `CI-CD-HARDENING-02` — exact deployed revision contract, branch/ruleset/Environment enforcement и metadata synchronization.
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

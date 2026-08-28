# Delivery plan

## Current Goal

- **ID / title:** `PWA-QUERY-BOUNDS-01` — bounded growing collections, analytics и cleanup без commercial contour.
- **State:** `IN_PROGRESS` — Goal явно авторизована, exact base/branch зафиксированы, evidence-based inventory начат.
- **Authorization source:** explicit user instruction 2026-08-28 «приступай» после согласования substantial Goal без commercial scope.
- **Scope:** evidence-based inventory owner-scoped projects, sources, transcription jobs/progress/analytics, transcript duplicate/catalog authority, diagnostics, audit, sessions и applicable cleanup paths; deterministic signed keyset pagination и hard page limits для подтверждённых unbounded browser collections; устранение подтверждённых N+1/unbounded materialization; только доказанные PostgreSQL composite indexes; batch-bounded и идемпотентные retention/cleanup paths; focused/full PostgreSQL и frontend contract tests, query/load/concurrency budgets; exact-head CI, protected additive migration, API/web/manual worker delivery и bounded authenticated production LIVE. В том же implementation PR синхронизируется фактическое closure предыдущей Goal.
- **Non-goals:** commercial contour; новые product features; изменение canonical requirements/AC/denominator; storage bucket/lifecycle redesign; DB-role/least-privilege redesign; provider calls/spend; alert delivery; broad retention-policy change; unrelated refactors.
- **Goal AC:**
  1. `PQB-01`: inventory классифицирует каждую in-scope collection/query/cleanup surface как already bounded, remediation или explicit defer с фактическим основанием; generated/vendored code не смешивается с runtime findings.
  2. `PQB-02`: projects, sources, transcription jobs и audit history возвращаются owner-scoped страницами с deterministic `(timestamp, id)` order, hard page maximum, signed session-bound cursor и filter/scope binding; invalid/cross-owner/cross-surface cursor fail closed.
  3. `PQB-03`: web client валидирует page envelope, не создаёт duplicates при append, сбрасывает stale cursor при authoritative reload и даёт пользователю bounded доступ к следующей странице без eager all-pages fetch.
  4. `PQB-04`: job progress принимает только bounded explicit displayed job set; compatibility read без IDs имеет hard maximum и сообщает truncation, не создавая N+1.
  5. `PQB-05`: transcription analytics сохраняет exact current semantics, но не materialize все jobs, attempts или ID list; query count остаётся constant относительно cardinality, а PostgreSQL выполняет aggregate/percentile work server-side.
  6. `PQB-06`: transcript duplicate/catalog и competing-provider authority не загружают unlimited duplicate history; aggregation/dedup или explicit budget exhaustion сохраняют fail-closed paid-call boundary и exact accepted-result counts.
  7. `PQB-07`: auth/diagnostics/source cleanup остаются подтверждённо bounded; provider-checkpoint и realtime-draft cleanup удаляют deterministic limited batches, повторный запуск идемпотентен и не пропускает оставшийся backlog.
  8. `PQB-08`: additive Alembic revision добавляет только indexes, соответствующие exact owner/project/filter/order query shapes; upgrade/downgrade и schema-head validation подтверждены на PostgreSQL.
  9. `PQB-09`: focused tests подтверждают hard maxima, stable/non-overlapping cursors при equal timestamps и concurrent newer inserts, owner/surface binding, frontend append/reset, constant query budgets, exact analytics и cleanup backlog batching; full backend/frontend/static/build suites зелёные.
  10. `PQB-10`: exact PR-head required CI, protected migration, API/web deployment, drained manual worker deployment и bounded authenticated LIVE подтверждают page limits/cursors, analytics shape, cleanup readiness и exact running revision без provider mutation.
- **Required Evidence:** target `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`; current `SPEC ✅ | CODE ◐ | TEST — | CI — | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** production migration требует protected `studio-production-migration` gate; worker deploy manual-only и требует verified drain/status; LIVE требует authenticated admin session. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** все Goal AC подтверждены required Evidence либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; после closure к следующей Goal без новой authorization не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-28T10:00:29Z.
- Session mode: authorized full-delivery Goal; commercial и перечисленные non-goals запрещены.
- Base branch/SHA: fetched clean `origin/main@6cb067d1acea09bc82b70be4c415b6babdce31b2`; local `main` был exact и clean, open PR отсутствовали.
- Working branch: `codex/pwa-query-bounds-01`; создана от exact verified base SHA выше, tracks `origin/main` до первого push.
- Last verified revision: `6cb067d1acea09bc82b70be4c415b6babdce31b2`.
- Working tree at Goal start: clean; unrelated pre-existing changes отсутствовали.
- Completed: previous observability closure reconciled from exact GitHub/runtime evidence; initial inventory подтвердил signed pagination diagnostics, bounded sessions/audio-preparation/auth/diagnostic/source cleanup и выявил unbounded projects/sources/jobs/progress, all-history analytics materialization, audit history without continuation, two unlimited bulk-cleanup paths и недостающие composite order indexes.
- Current step: завершить exact catalog/query-shape inventory и реализовать backend pagination/analytics/cleanup slice.
- Next exact action: добавить reusable signed collection-page contract, применить его к projects/sources/jobs/audit и покрыть equal-timestamp/owner/surface tests.
- Validation and Evidence: base ancestry/worktree/remotes verified; `gh pr list --state open` пуст. Implementation checks ещё не запускались.
- Pull Request / CI / deployment: отсутствуют; initial push и PR допустимы только после полной local validation согласованного scope.
- Blockers: implementation blocker отсутствует. PostgreSQL-specific migration/percentile/concurrency evidence требует CI host; protected migration, worker drain/deploy и authenticated LIVE являются ожидаемыми external gates.
- Unverified assumptions: production query plans выберут новые indexes на representative cardinality; cleanup backlog и audit/source/job cardinality достаточны для bounded LIVE без создания provider work. Проверить фактически.
- Preserved pre-existing changes: отсутствуют.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Технические Goal AC не добавлены в canonical denominator. Current snapshot независимо пересчитан после фактического delivery предыдущей Goal; previous snapshot сохранён только для сравнения.

| Product/epic | Current independent snapshot | Previous independent snapshot | Основание |
|---|---:|---:|---|
| **Полный canonical scope** | **40,6% (`216/532`)** | **38,2% (`203/532`)** | 13 observability AC подтверждены exact code/test/CI/deploy/LIVE на PR `#250`; denominator не менялся. |
| **Non-commercial scope** | **74,5% (`216/290`)** | **70,0% (`203/290`)** | Colab `31/31` + personal PWA `185/259`. |
| **Commercial/cross-contour** | **0% (`0/242`)** | **0% (`0/242`)** | Вне Goal; implementation запрещена. |
| **Google Colab canonical** | **100% (`31/31`)** | **100% (`31/31`)** | Вне Goal; numerator не менялся. |
| **Personal Studio PWA canonical** | **71,4% (`185/259`)** | **66,4% (`172/259`)** | `OBSERV-06/08/09/11..14/22/24..28` подтверждены полным delivery. |
| `PWA-SECURITY-HARDENING-02` | **50,0% (`9/18`)** | **50,0% (`9/18`)** | Не затронут. |
| `OBSERVABILITY-AUDIT-02` | **71,4% (`25/35`)** | **34,3% (`12/35`)** | `13/13` AC предыдущей Goal подтверждены exact running web/API/worker/schema identity и bounded runtime health. |
| Остальные existing epics | **100% (`132/132`)** | **100% (`132/132`)** | Product AC completion не изменился. |

Расхождение current/previous больше 10 п.п. у observability (`+37,1` п.п.): причина — полный delivery 13 заранее определённых canonical AC, а не новый denominator. `PWA-QUERY-BOUNDS-01` не повышает product readiness без выполнения уже существующего canonical AC.

## Candidate next Goals

1. `SPEC-GAPS-DECISIONS-03` — принять bounded решения по сохранённым conflicts/ambiguities; implementation не начинается автоматически.
2. `DB-LEAST-PRIVILEGE-01` — evidence actual roles и отдельные migration/application roles с backup/rollback plan.
3. `PWA-STORAGE-ISOLATION-01` — разделить Audio Preparation references и transcription intake на разные lifecycle namespaces/buckets после architecture decision.

## Risks и boundaries

- Pagination не должна скрывать current active jobs, ломать optimistic source reconciliation или превращаться в eager fetch всего backlog.
- Exact all-time analytics имеет O(N) database work; Goal ограничивает browser payload, application memory и query count, но не подменяет exact totals sampling-оценкой.
- Transcript duplicate/provider authority fail-closed важнее latency: budget exhaustion не может разрешать paid provider call.
- Composite indexes имеют write/storage cost; migration добавляет только подтверждённые query-shape indexes и проверяется `EXPLAIN`/schema evidence.
- Post-deploy metadata writer отсутствует; protections не обходятся и отдельный docs-only follow-up PR не создаётся.

## Sources of truth

- Repository instructions: `AGENTS.md`.
- Product scope/AC: `docs/project-spec.md`.
- Current Goal/checkpoint/readiness: этот документ.
- CI/CD safety: `docs/ci-cd-rules.md`.
- Current architecture/runtime boundaries: `docs/architecture.md` и applicable runbooks.

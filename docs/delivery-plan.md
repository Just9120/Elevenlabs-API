# Delivery plan

## Current Goal

- **ID / title:** `PWA-QUERY-BOUNDS-01` — bounded growing collections, analytics и cleanup без commercial contour.
- **State:** `IN_PROGRESS` — PR `#251` merged и основной delivery выполнен, но authenticated LIVE выявил presentation defect audit continuation; bounded hotfix готовится в той же Goal.
- **Authorization source:** explicit user instruction 2026-08-28 «приступай» после согласования substantial Goal без commercial scope; explicit user instruction 2026-08-28 «разрешаю» на exceptional correction push после подтверждённых CI test-contract failures.
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
- **Required Evidence:** target `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`; current `SPEC ✅ | CODE ✅ | TEST ✅ | CI ◐ | DEPLOY ◐ | LIVE ❌`.
- **Known blockers/dependencies:** immediate blocker отсутствует. Hotfix требует exact-head CI, merge, web-only delivery и повторный authenticated LIVE cursor append. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** все Goal AC подтверждены required Evidence либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; после closure к следующей Goal без новой authorization не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-28T11:48:24Z.
- Session mode: authorized full-delivery Goal; commercial и перечисленные non-goals запрещены.
- Base branch/SHA: original Goal base `origin/main@6cb067d1acea09bc82b70be4c415b6babdce31b2`; LIVE hotfix branch создана от verified merged `origin/main@cc4347758ebae849c963cbf11be253862c6a1402`.
- Working branch: `codex/pwa-query-bounds-live-fix`; clean branch от exact merge SHA до двух focused source/test изменений.
- Last verified revision: production `cc4347758ebae849c963cbf11be253862c6a1402`; web/API/worker exact identity, schema `0027_query_bounds` и dependencies ready подтверждены, но audit cursor append скрыт presentation cap в Settings UI.
- Working tree at Goal start: clean; unrelated pre-existing changes отсутствовали.
- Completed: PR `#251` merged as `cc434775`; exact PR-head и post-merge CI зелёные; web deployed run `33166563572`; worker safely drained run `33166775059`; protected approved migration/API run `33166862214` применил `0026 -> 0027` с verified snapshot `e73c606741e0`; worker deploy run `33167793153` и independent status `33168001735` подтвердили exact healthy image. Authenticated LIVE подтвердил analytics shape, cleanup events, provider `probe=not_run` и exact component identities, затем выявил скрытый audit append.
- Current step: удалить только presentation cap audit list и добавить regression `50 + cursor` с duplicate dedup и visible append.
- Next exact action: зафиксировать локально validated hotfix, выполнить один initial push и открыть focused hotfix PR; дождаться automatic exact-head CI.
- Validation and Evidence: основной scope подтверждён PR/post-merge CI. Hotfix locally passed: focused regression `1/1`; full frontend Vitest `614/614`; lint; production build; repository `ci_checks`; `git diff --check`. Browser LIVE на deployed `cc434775`: cursor control enabled и request не создаёт duplicates, но visible count остаётся `20 -> 20`, поэтому `PQB-03` не выполнен до hotfix delivery.
- Pull Request / CI / deployment: PR `#251` merged `cc434775`; PR CI runs `33166365989`/`33166365983` success; post-merge runs `33166563412`/`33166563432` success. Deployment runs перечислены в Completed. Hotfix PR ещё не создан; deployed web остаётся на defect revision `cc434775` до green hotfix flow.
- Blockers: immediate blocker отсутствует; обязательны hotfix PR CI, merge, web deploy и повторный authenticated cursor LIVE. Migration/API/worker повторно deploy-ить не требуется, если hotfix diff останется web-only.
- Unverified assumptions: production audit backlog останется достаточным для повторного cursor append после hotfix; если second page к тому времени исчерпается, LIVE подтвердит visibility текущего loaded page, а `50 + cursor` останется exact TEST/CI evidence. Production planner index choice на representative cardinality отдельно не наблюдался.
- Preserved pre-existing changes: отсутствуют.

### In-scope query inventory

| Surface | До Goal | Decision / фактическое основание |
|---|---|---|
| Projects, project Sources, transcription Jobs, Audit events | Owner/project filters, но три primary browser reads materialize весь результат; audit возвращал только первые 50 без continuation | `REFACTOR`: signed session-bound keyset `(timestamp, id)`, default `50`, hard max `100`, `limit + 1`, scope/surface binding; frontend append/reset/dedup. |
| Displayed job progress | Project-wide materialization | `REFACTOR`: repeated explicit `job_id`, не более 50 unique UUID; compatibility read bounded `100 + 1` и сообщает `truncated`. |
| Transcription analytics | Загружала all-time jobs/attempts и строила `job_id IN (...)` в application memory | `REFACTOR`: exact grouped counts и PostgreSQL aggregate/percentile queries; constant query count относительно cardinality, без entity/ID-list materialization. |
| Transcript duplicate/catalog и competing-provider authority | История evidence могла materialize unlimited rows/IDs | `CONSOLIDATE`: SQL grouping/counts, общий evidence budget `1000`, source-lock budget `1000`; exhaustion возвращает indeterminate/unresolved и не разрешает paid boundary. |
| Provider-part checkpoints и realtime drafts expiry | Один cleanup мог удалить весь backlog | `REFACTOR`: deterministic `(expires_at, id)` batches, default `500`, hard max `1000`; повторный запуск обрабатывает остаток. |
| Diagnostics events/reports/expiry | Уже signed keyset max `200`, report/cleanup hard limits | `DOCUMENT`: сохранить существующий bounded contract; reusable signing вынесен без изменения diagnostic cursor namespace. |
| Active auth sessions | Уже `limit + 1`, hard max `100`, explicit `truncated` | `DOCUMENT`: remediation не требуется. |
| Audio-preparation jobs | Уже owner/project scoped и hard max `100` | `DOCUMENT`: payload остаётся bounded; добавить supporting owner/project/order index, соответствующий существующему query shape. |
| Source storage cleanup | Уже bounded deterministic worker maintenance | `DOCUMENT`: behavior не менять в этой Goal. |
| Output-folder Favorites, speaker profiles и credential lists | Owner-scoped, текущая ожидаемая cardinality мала, но hard pagination отсутствует; speaker-profile payload имеет отдельные relationship reads | `DEFER`: не являются growing primary browser collections текущей Goal; будущая pagination/N+1 Goal требует отдельного UI/API contract. |
| Generated/vendored code | Не является runtime query authority этого repository | `N/A`: исключено из findings и изменений. |

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

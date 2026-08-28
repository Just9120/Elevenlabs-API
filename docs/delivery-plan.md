# Delivery plan

## Current Goal

- **ID / title:** `PWA-OBSERVABILITY-RUNTIME-01` — substantial runtime observability без commercial contour.
- **State:** `IN_PROGRESS` — Goal явно авторизована, exact base/branch зафиксированы, implementation начата.
- **Authorization source:** explicit user instruction 2026-08-28 «если все ок, то давай делать более существенный goal» после review production diagnostics.
- **Scope:** закрыть canonical `OBSERV-06`, `OBSERV-08`, `OBSERV-09`, `OBSERV-11..OBSERV-14`, `OBSERV-22`, `OBSERV-24..OBSERV-28`: точные release/build/commit identities реально запущенных web/API/worker и exact DB schema revision; отдельные API и worker liveness/readiness contracts; authenticated admin health с bounded queue, object-storage и STT-provider status без paid/provider mutation; safe frontend incident correlation для 4xx и unhandled rejections; automated unit/integration/UI/contract coverage; exact-head CI, protected backward-compatible migration, API/web/manual worker deployment и bounded authenticated production LIVE.
- **Non-goals:** commercial contour; external alert delivery; active paid STT probes; `trace_id` через весь pipeline; audit-role/DB least-privilege redesign; storage lifecycle redesign; provider fallback; unrelated product features.
- **Goal AC:**
  1. `POR-01`: diagnostics fail closed и показывают отдельные exact release/build/commit identities реально запущенных web, API и worker, а также exact DB schema revision; `unknown`, target-only identity и подмена одного компонента другим не считаются success.
  2. `POR-02`: backend предоставляет отдельные process-only liveness и dependency/schema-aware readiness probes; legacy `/api/healthz` остаётся backward-compatible readiness alias, ответы bounded и не раскрывают secrets/user data.
  3. `POR-03`: worker предоставляет отдельные process liveness и dependency/schema readiness contracts; Docker healthcheck использует readiness, а diagnostics отличают absent/stale worker от healthy.
  4. `POR-04`: authenticated admin health показывает bounded queue, object-storage и STT-provider status; storage check read-only, provider check не вызывает paid transcription и не мутирует provider state.
  5. `POR-05`: frontend 4xx и unhandled rejection evidence сохраняет safe original response request ID, bounded exact HTTP status и endpoint group либо safe rejection category, без stack/raw payload/message/user data/secrets.
  6. `POR-06`: authoritative runtime component identity/heartbeat persistence backward-compatible; diagnostic reads не изменяют состояние, stale/absent distinguishable, rollback старого API/worker безопасен.
  7. `POR-07`: Compose/build/deploy передают и проверяют exact component identities без broad env rewrite, secret changes или ослабления migration/worker/Environment gates.
  8. `POR-08`: focused и full tests, exact PR-head required CI, protected migration, API/web deployment, manual drained worker deployment и bounded authenticated production LIVE подтверждают все applicable contracts.
- **Required Evidence:** target `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`; current `SPEC ✅ | CODE ✅ | TEST ◐ | CI — | DEPLOY — | LIVE ❌`.
- **Known blockers/dependencies:** production migration требует protected `studio-production-migration` gate; worker deploy manual-only и требует verified drain/status; LIVE требует authenticated admin session. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** все Goal AC подтверждены required Evidence либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; после closure к следующей Goal без новой authorization не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-28T08:30:57Z.
- Session mode: authorized full delivery Goal; commercial и перечисленные non-goals запрещены.
- Base branch/SHA: fetched clean `origin/main@3e80fef58f8aab94c5727a7fc7acef300fd8b099`; open PR отсутствовали.
- Working branch: `codex/pwa-observability-runtime-01`; создана от exact verified base SHA выше.
- Last verified revision: `53a69ac`; commits `0f8a3d7`, `9eb5447`, `53a69ac` покрывают Goal contract, runtime implementation и heartbeat write-path optimization.
- Working tree at Goal start: clean; unrelated pre-existing changes absent.
- Completed: additive `0026_runtime_component_status`; exact component-baked web/API/worker release/build/commit metadata; coherent platform release fail-closed across all three components; exact schema read; API and worker split liveness/readiness; process-incarnation-aware worker heartbeat; bounded queue/read-only storage/config-only STT health; safe frontend exact HTTP/request/rejection correlation; diagnostics UI/export; Compose/deploy/migration/preflight wiring; architecture/runbook/security current-head synchronization. Secondary `last_seen_at` indexes intentionally отсутствуют, чтобы repeated heartbeat updates оставались PostgreSQL HOT-capable.
- Current step: финальная local validation exact commit state перед единственным initial push и PR.
- Next exact action: повторить full portable/backend и frontend/static checks на branch head, затем выполнить initial push и создать PR.
- Validation and Evidence: `python scripts/ci_checks.py` passed; portable backend `1083 passed, 5 skipped`; full frontend Vitest `611 passed`; ESLint passed; production build passed с existing chunk-size warning; exact build-meta smoke produced synthetic component/release/40-char commit and then restored fail-closed generated metadata; focused runtime/worker/diagnostics suites passed, latest changed subset `28 passed`; static Linux CI/CD contracts `13 passed, 47 deselected`. `git diff --check` passed. TEST остаётся partial до Linux shell + PostgreSQL/Redis integration и browser/CI checks на exact PR head.
- Pull Request / CI / deployment: absent. Expected changed components: migration + API + web + worker; full protected delivery обязателен.
- Blockers: implementation blocker отсутствует. На Windows host отсутствуют `bash`, Docker/PostgreSQL/Redis, поэтому shell/service integration не считается локально подтверждённым и должен пройти exact-head CI. External gates ожидаются на protected migration, manual worker drain/deploy и authenticated LIVE.
- Unverified assumptions: production storage `head_bucket` и provider configured-status будут bounded с actual runtime credentials; проверка должна подтвердить отсутствие paid/provider mutation и safe report fields. Exact component identities ещё не подтверждены running production evidence.
- Preserved pre-existing changes: отсутствуют.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Текущий snapshot независимо пересчитан после сверки production diagnostics; previous snapshot сохранён только для сравнения.

| Product/epic | Current independent snapshot | Previous independent snapshot | Основание |
|---|---:|---:|---|
| **Полный canonical scope** | **38,2% (`203/532`)** | **38,7% (`206/532`)** | `PWASEC-07..09` теперь подтверждены полным delivery; `OBSERV-24..26` сняты из numerator, потому что production diagnostics показал три `unknown`. Net numerator вернулся к `203`, но состав выполненных AC изменился. |
| **Non-commercial scope** | **70,0% (`203/290`)** | **71,0% (`206/290`)** | Colab `31/31` + personal PWA `172/259`; denominator не менялся. |
| **Commercial/cross-contour** | **0% (`0/242`)** | **0% (`0/242`)** | Вне Goal; implementation запрещена. |
| **Google Colab canonical** | **100% (`31/31`)** | **100% (`31/31`)** | Вне Goal; runtime risk не меняет numerator. |
| **Personal Studio PWA canonical** | **66,4% (`172/259`)** | **67,6% (`175/259`)** | Session-control `3/3` подтверждены, но три ранее засчитанные build-identity AC фактически не выполнены. |
| `PWA-SECURITY-HARDENING-02` | **50,0% (`9/18`)** | **50,0% (`9/18`)** | `PWASEC-07..09` подтверждены PR/CI/deploy/LIVE. |
| `OBSERVABILITY-AUDIT-02` | **34,3% (`12/35`)** | **42,9% (`15/35`)** | `OBSERV-24..26` false positive: exact production report показывает `unknown`; Goal target после 13 AC — `25/35 = 71,4%`. |
| Остальные existing epics | **100% (`132/132`)** | **100% (`132/132`)** | AC completion в этом аудите не изменился. |

Target при выполнении всех 13 canonical Goal AC: observability `25/35 = 71,4%`; personal PWA `185/259 = 71,4%`; non-commercial `216/290 = 74,5%`; full canonical `216/532 = 40,6%`.

## Candidate next Goals

1. `SPEC-GAPS-DECISIONS-03` — принять bounded решения по сохранённым conflicts/ambiguities; implementation не начинается автоматически.
2. `DB-LEAST-PRIVILEGE-01` — evidence actual roles и отдельные migration/application roles с backup/rollback plan.
3. `PWA-QUERY-BOUNDS-01` — pagination/retention/query budgets и load/concurrency validation растущих collections.
4. `PWA-STORAGE-ISOLATION-01` — разделить Audio Preparation references и transcription intake на разные lifecycle namespaces/buckets после architecture decision.

## Risks и boundaries

- Liveness доказывает только жизнь процесса; readiness отдельно проверяет dependencies/schema и не должна превращаться в расходный provider probe.
- Build identities независимы по компонентам: target Git SHA нельзя выдавать за фактически запущенный web/API/worker без component-specific Evidence.
- Diagnostic ingestion request ID не является original failed request ID; поля должны оставаться раздельными и safe.
- Ручное удаление object напрямую в R2 обходит application lifecycle; Goal не меняет storage ownership/lifecycle.

## Sources of truth

- Repository instructions: `AGENTS.md`.
- Product scope/AC: `docs/project-spec.md`.
- Current Goal/checkpoint/readiness: этот документ.
- CI/CD safety: `docs/ci-cd-rules.md`.
- Actual architecture: `docs/architecture.md`.
- Historical evidence: `docs/delivery-plan-archive.md`.

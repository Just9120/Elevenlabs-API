# Delivery plan

## Current Goal

- **ID / title:** `TRANSCRIPT-MAINTENANCE-WORKSPACE-01` — app-owned workspace и durable transcript maintenance.
- **State:** `IN_PROGRESS`.
- **Authorization source:** explicit owner instruction 2026-08-29 «ставь цель и приступай» после production observations: legacy Google picker, неудачное расположение maintenance flow и generic standardization failure.
- **Scope:** перенести две независимые операции в `Транскрибации → Обслуживание`; оставить в Connections только grants/consent; использовать app-owned searchable folder/Google Doc dialogs; заменить long-running synchronous dry-run/apply на owner-scoped durable background runs с progress, idempotency, preview-bound apply, lease heartbeat/recovery и structured safe errors; добавить additive schema, API/worker/web wiring, tests, documentation, protected delivery и bounded authenticated LIVE.
- **Non-goals:** commercial contour; provider/STT calls или spend; изменение `transcript_doc`; automatic apply; произвольный Drive/Docs browser access; расширение OAuth scopes; повышение nginx timeout как замена durable execution; изменение `docs/ci-cd-rules.md`; unrelated refactors.
- **Goal AC:**
  1. `TMW-01`: canonical `PTM-01..08`, denominator и current checkpoint отражают согласованный scope.
  2. `TMW-02`: Settings содержит только connection/maintenance consent и переход; обе операции доступны в отдельном Transcriptions workspace.
  3. `TMW-03`: folder/document selection использует app-owned searchable dialog с navigation/current-folder/scroll-lock boundaries; legacy native Picker остаётся только для явно совместимого catalog-folder flow вне maintenance.
  4. `TMW-04`: POST создаёт durable owner-scoped run и быстро возвращает `202`; GET восстанавливает persisted progress/result после remount/reload.
  5. `TMW-05`: worker claim/reclaim/heartbeat/fencing, bounded attempts и normal-work priority не допускают concurrent overwrite или starvation обычной обработки.
  6. `TMW-06`: apply принимает только successful owner preview ID, server-side наследует target и fresh revalidates перед mutation; idempotency/conflict fail closed.
  7. `TMW-07`: browser DTO/logs не раскрывают Drive/document IDs, tokens, contents или raw Google detail; terminal failures имеют structured safe code/retryability и русское действие.
  8. `TMW-08`: focused/full local validation, exact-head CI, protected additive migration, API/worker/web delivery и bounded authenticated dry-run/apply LIVE завершаются без provider call.
- **Required Evidence:** target `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`; current `SPEC ✅ | CODE ✅ | TEST ✅ | CI — | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** migration `0028_transcript_maintenance_runs` должна пройти только protected migration lane до dependent API/worker rollout; worker получает existing separate maintenance OAuth client secret server-side, browser/web — никогда; approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`). Immediate implementation blocker отсутствует.
- **Stop condition:** все Goal AC и `PTM-01..08` имеют required Evidence либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; после closure к другой Goal без новой authorization не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-28T23:55:49Z.
- Session mode: authorized full-delivery Goal; все non-goals выше запрещены.
- Base branch/SHA: verified `origin/main@c065b629db9875ddd92bf30ce67d8290c018f067`.
- Working branch: `codex/transcript-maintenance-workspace-01`.
- Last verified revision: initial PR head `fffd196c706f0482d18e75e193be7860058d9b1b` (`735c02c` frontend, `5b7ded4` backend, `fffd196` docs); CI-fix successor пока только local.
- Working tree at Goal start: clean; unrelated pre-existing changes отсутствовали.
- Completed: commit `5b7ded4` добавил durable backend/schema/worker; commit `735c02c` добавил app-owned folder/document dialogs, `Транскрибации → Обслуживание`, persisted progress/error UX, Settings connection-only view и frontend regressions; commit `fffd196` синхронизировал canonical/operational docs. Initial push выполнен, открыт PR `#257`. First-head CI классифицирован без rerun: `studio` прошёл; `browser-e2e` ожидал прежнее расположение maintenance в Settings; repository `checks` использовал stale expected Alembic head `0027` в production preflight contract. Оба test-contract drift исправлены локально.
- Current step: завершить local validation CI-fix successor, выполнить единственный сгруппированный follow-up push и получить exact-successor required checks.
- Next exact action: после зелёной local validation commit/push CI-fix batch один раз, затем ждать required checks PR `#257` без speculative rerun.
- Validation and Evidence: исходный scope — maintenance backend focused `31 passed`; worker Compose `6 passed`; portable Python `1113 passed, 5 skipped`. После CI-fix: `scripts/ci_checks.py` success; focused UI `238 passed`; полный Studio Vitest `632 passed`; ESLint success; Playwright inventory `12 tests`; TypeScript/Vite/PWA production build success; `git diff --check` success. POSIX preflight suite локально на Windows не является переносимым из-за Windows/Git-Bash path semantics; exact Linux CI остаётся обязательным gate.
- Pull Request / CI / deployment: PR `#257`; initial head `fffd196c706f0482d18e75e193be7860058d9b1b`; repository CI run `33221674226` / job `99016825003` failed только на 5 stale-head preflight assertions; Studio PWA run `33221674235`: job `99016824963` passed, browser E2E job `99016825106` failed на одном stale navigation assertion. Deployment не начинался. Repository public и использует standard GitHub-hosted runners, поэтому private-repository included Actions minutes не расходуются.
- Blockers: отсутствуют.
- Unverified assumptions: production maintenance grant для того же owner остаётся refreshable из worker; representative canary folder укладывается в bounded traversal; exact production schema/runtime identities будут проверены перед protected delivery.
- Preserved pre-existing changes: отсутствуют.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Current snapshot независимо пересчитан по current local CODE/TEST; previous snapshot — последний расчёт до добавления `PTM-01..08`. Evidence gate-ит READY, но не меняет numerator.

| Product/epic | Current independent snapshot | Previous independent snapshot | Основание |
|---|---:|---:|---|
| **Полный canonical scope** | **43,6% (`244/560`)** | **42,8% (`236/552`)** | Owner-approved Goal добавила и local CODE/TEST выполняют `PTM-01..08`; denominator `+8`, numerator `+8`. |
| **Non-commercial scope** | **76,7% (`244/318`)** | **76,1% (`236/310`)** | Colab `32/32` + personal PWA `212/286`; commercial не включена в numerator. |
| **Commercial/cross-contour** | **0% (`0/242`)** | **0% (`0/242`)** | В durable BACKLOG, implementation не авторизована. |
| **Google Colab canonical** | **100% (`32/32`)** | **100% (`32/32`)** | Current Goal Colab не затрагивает. |
| **Personal Studio PWA canonical** | **74,1% (`212/286`)** | **73,4% (`204/278`)** | `PTM-01..08` реализованы и локально протестированы; CI/deployment/LIVE ещё gate-ят lifecycle. |
| `PWA-TRANSCRIPT-MAINTENANCE-01` | **100% (`8/8`)** | **N/A** | Новый explicit scope; local CODE/TEST complete, required CI/DEPLOY/LIVE отсутствуют. |
| `PWA-STANDARDIZATION-01` | **100% (`13/13`)** | **100% (`13/13`)** | Document-format AC не изменены; current Goal ремонтирует operation UX/execution boundary. |
| `PWA-MANIFEST-01` | **100% (`6/6`)** | **100% (`6/6`)** | Business rules не изменены; representative import/clear LIVE остаётся отдельным Evidence gap эпика. |

Ни одна сопоставимая оценка не изменилась более чем на `10` п.п. Новый эпик не имеет предыдущего denominator и поэтому обозначен `N/A`, а не искусственным процентом.

## Candidate next Goals

1. `DB-LEAST-PRIVILEGE-01` — actual roles Evidence и отдельные migration/application roles с backup/rollback plan.
2. `PWA-STORAGE-ISOLATION-01` — разделение Audio Preparation references и transcription intake после architecture decision.

## Risks и boundaries

- Additive schema — protected stateful release; ordinary component CD не применяет migration.
- Maintenance worker использует отдельный server-only grant; token/secret/Drive IDs не входят в browser state или validation evidence.
- Dry-run не мутирует. Apply требует explicit owner confirmation и successful preview, но всё равно свежо проверяет Google state перед mutation.
- Maintenance имеет более низкий claim priority, чем audio preparation и transcription jobs.
- Authenticated LIVE выполняется только на owner-approved small target и без provider call.
- Approved post-deploy metadata writer отсутствует; protection rules не обходятся и отдельный docs-only follow-up PR не создаётся.

## Sources of truth

- Repository instructions: `AGENTS.md`.
- Product scope/AC: `docs/project-spec.md`.
- Current Goal/checkpoint/readiness: этот документ.
- CI/CD safety: `docs/ci-cd-rules.md`.
- Current architecture/runtime boundaries: `docs/architecture.md` и applicable runbooks.
- Completed delivery history: `docs/delivery-plan-archive.md` (не current source of truth).

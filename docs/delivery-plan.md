# Delivery plan

## Current Goal

- **ID / title:** `PWA-WORKER-USAGE-ACCOUNTING-01` — worker isolation и personal provider usage/cost accounting.
- **State:** `IN_PROGRESS`.
- **Authorization source:** explicit owner instruction 2026-08-30: следующей единой Goal взять `Worker isolation` и `Usage/cost accounting`.
- **Scope:** закрыть canonical `PWAWOR-02..03` и `USAGEC-01..02`: задать и проверить CPU/memory/PID bounds worker; ограничить его writable filesystem, Linux capabilities, privilege escalation и network reachability; отделить worker от API database credential и DDL/superuser capability; сохранять фактически подтверждённую billed STT duration, provider usage cost, currency и accounting provenance на job; добавить additive migration, safe owner API/UI/diagnostics projection, tests/docs, reviewable PR, exact-head CI, applicable protected migration/API/worker delivery и одну bounded owner-authorized LIVE transcription.
- **Non-goals:** commercial contour; пользовательские платежи, invoice reconciliation, остаток бесплатной квоты, тарифы/квоты/лимиты для пользователей; новый STT provider или automatic fallback; storage/compute/network cost; изменение `docs/ci-cd-rules.md`, GitHub protections или unrelated refactors.
- **Goal AC:**
  1. `WUA-01`: canonical closure предыдущей Goal и baseline readiness reconciled; durable scope/denominator не изменены.
  2. `WUA-02`: worker Compose имеет explicit CPU, memory/swap и PID bounds, а tests проверяют rendered effective configuration.
  3. `WUA-03`: worker root filesystem read-only; writable paths bounded; capabilities dropped; privilege escalation disabled; runtime после secret bootstrap остаётся UID/GID `10001`.
  4. `WUA-04`: Compose networks дают worker только PostgreSQL и отдельный outbound boundary, без API/web/Redis discovery и published ports.
  5. `WUA-05`: worker использует отдельный non-superuser login без DDL/role capability; read/write grants ограничены documented current worker tables и проверены integration test/runtime preflight.
  6. `WUA-06`: каждый фактически подтверждённый provider part идемпотентно учитывается ровно один раз; retries/checkpoint resume не дублируют confirmed usage, а uncertain provider outcome не выдаётся за exact billed usage.
  7. `WUA-07`: job хранит confirmed billed duration, provider cost, currency, rate snapshot/provenance и accounting completeness; unsupported/missing tariff fail closed before spend.
  8. `WUA-08`: owner API/UI и diagnostics показывают безопасную duration/cost summary без credential, raw provider payload или internal request identifiers.
  9. `WUA-09`: additive migration и backward-compatible reads корректны для existing jobs; downgrade/rollback boundary documented и tested.
  10. `WUA-10`: focused/full local validation, один initial push, reviewable PR и exact-head required CI завершаются success; confirmed failure исправляется одним grouped follow-up batch.
  11. `WUA-11`: protected migration/API и manual worker status→drain→deploy→status соответствуют exact merge SHA; resource/network/DB role runtime evidence подтверждено без secret values.
  12. `WUA-12`: одна owner-approved bounded transcription подтверждает persisted billed duration/cost/currency и отсутствие regression; до такого call Goal остаётся `PENDING_EXTERNAL_GATE`.
- **Required Evidence:** target `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`; current `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** owner должен подтвердить, что `provider cost` означает attributable usage cost по фактически подтверждённой duration и сохранённому tariff snapshot, а не invoice debit после free quota; production потребует отдельный worker DB credential и manual protected migration approval. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** все Goal AC и required Evidence выполнены либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; к следующей Goal без новой authorization не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-30T10:40:04Z.
- Session mode: authorized full-delivery Goal; все non-goals выше запрещены.
- Base branch/SHA: verified `origin/main@c443de6855b02c3d0e5e0021ca76d56b52a2a9bc`.
- Working branch: `codex/pwa-worker-usage-accounting`.
- Isolated worktree: `C:/Users/wait9/AppData/Local/Temp/codex-elevenlabs-worker-usage-accounting`.
- Last verified revision: local `95350a3` (`feat: persist provider usage accounting`) поверх isolation commit `0f11d48`; base остаётся `c443de6855b02c3d0e5e0021ca76d56b52a2a9bc`.
- Working tree at Goal start: isolated worktree clean. Основной checkout содержит unknown/unrelated `.pytest-tmp-*` directories; они сохранены нетронутыми.
- Completed: worker получил Compose CPU/memory/no-swap/PID/read-only/tmpfs/capability/network boundaries, отдельный direct-grant `studio_worker` login и fail-closed runtime/preflight inspection; additive `0030_provider_usage_accounting` сохраняет pending/confirmed/uncertain provider-part boundary, job totals, USD tariff snapshot и owner-safe analytics/UI. Public Scribe v2 rate `$0.22/hour` перепроверен 2026-08-30 по official ElevenAPI pricing; invoice/free-quota reconciliation явно исключена.
- Current step: завершить operational preflight/docs и полную локальную validation перед единственным initial push.
- Next exact action: создать operations/checkpoint commit, выполнить CI-equivalent локальные проверки, проверить Actions budget/текущие runs и только затем сделать один initial push с PR.
- Validation and Evidence: backend focused sets `88 passed` и `70 passed`; frontend full Vitest `637 passed`, current focused Vitest `11 passed`, ESLint и production build success; Python compileall, YAML parse, Bash syntax и `git diff --check` success. Docker отсутствует локально; Linux shell integration остаётся обязательным CI gate. Windows-wide pytest не считается authoritative: системный temp ACL и Windows/Git-Bash path conversion воспроизводимо ломают fixtures до product assertions.
- Pull Request / CI / deployment: отсутствуют для текущей Goal; initial push запрещён до полной local validation.
- Blockers: owner decision по semantics `provider cost`; production setup отдельного worker DB password и protected migration approval будут external gates после CI.
- Unverified assumptions: допустимые resource values должны быть подтверждены effective Compose config и фактической ёмкостью VPS; public provider docs не доказывают invoice debit с учётом free quota.
- Preserved pre-existing changes: `.pytest-tmp-*` directories в основном checkout; текущая Goal их не читает, не изменяет и не удаляет.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Current snapshot независимо reconciled по merged code, exact-main CI, protected deployment и LIVE предыдущей Goal; новая Goal пока numerator не меняет. Evidence gate-ит READY, но не меняет numerator.

| Product/epic | Current independent snapshot | Previous independent snapshot | Основание |
|---|---:|---:|---|
| **Полный canonical scope** | **46,0% (`264/574`)** | **45,1% (`259/574`)** | Previous Goal фактически закрыла ещё `STORAG-17..21`; denominator не изменился. Изменение `+0,9` п.п. |
| **Non-commercial scope** | **79,5% (`264/332`)** | **78,0% (`259/332`)** | Colab `32/32` + personal PWA `232/300`. Изменение `+1,5` п.п. |
| **Commercial/cross-contour** | **0% (`0/242`)** | **0% (`0/242`)** | Durable BACKLOG, implementation не авторизована. |
| **Google Colab canonical** | **100% (`32/32`)** | **100% (`32/32`)** | Current Goal Colab не затрагивает; applicable delivery Evidence closed. |
| **Personal Studio PWA canonical** | **77,3% (`232/300`)** | **75,7% (`227/300`)** | Previous Goal закрыла `PUX-01..12` и `STORAG-16..21`; текущая Goal пока не изменила AC. Изменение `+1,6` п.п. |
| `PWA-USER-EXPERIENCE-02` | **100% (`12/12`)** | **100% (`12/12`)** | PR `#259/#260`, CI, DEPLOY и bounded owner LIVE закрыли required Evidence; эпик READY. |
| `STORAGE-LIFECYCLE-02` | **57,1% (`12/21`)** | **33,3% (`7/21`)** | Distinct buckets, credentials, lifecycle rules и cross-access denial подтвердили `STORAG-17..21`. Изменение `+23,8` п.п. объясняется закрытием пяти external/runtime AC. |
| `PWA-WORKER-ISOLATION-02` | **33,3% (`1/3`)** | **33,3% (`1/3`)** | Отдельный worker component существует; resource/privilege AC текущей Goal ещё не выполнены. |
| `USAGE-COST-ACCOUNTING-01` | **0% (`0/2`)** | **0% (`0/2`)** | Persisted factual accounting ещё отсутствует. |

Только storage epic изменился более чем на `10` п.п.: причина — пять ранее external AC получили provider/runtime Evidence в предыдущем delivery flow. Новая Goal может добавить максимум четыре AC (`PWAWOR-02..03`, `USAGEC-01..02`); до фактического выполнения они не засчитываются.

## Candidate next Goals

1. `STORAGE-LIFECYCLE-FOLLOWUP-01` — только после отдельного owner decision выбрать bounded subset из `STORAG-01..15`.
2. `DB-LEAST-PRIVILEGE-01` — после текущего worker-only role boundary отдельно ограничить API/migration roles; current Goal не закрывает system-wide DB least privilege.

## Risks и boundaries

- Разделение buckets/credentials меняет stateful external configuration. Code/config schema можно доставить reviewably, но production switch требует explicit operator setup и fail-closed preflight.
- Существующие local Sources остаются в legacy/transcription bucket; Goal не перемещает bytes, не меняет owner retention и не выполняет broad cleanup.
- API и worker deployment/state различаются; migration остаётся protected `MANUAL_GATED`, worker — manual status/drain/deploy/status.
- UX не должен скрыть recovery/spend/security warnings: они упрощаются, но actionable confirmation и safety detail остаются доступны.
- Approved post-deploy metadata writer отсутствует; protection rules не обходятся и отдельный docs-only follow-up PR не создаётся.

## Sources of truth

- Repository instructions: `AGENTS.md`.
- Product scope/AC: `docs/project-spec.md`.
- Current Goal/checkpoint/readiness: этот документ.
- CI/CD safety: `docs/ci-cd-rules.md`.
- Current architecture/runtime boundaries: `docs/architecture.md` и applicable runbooks.
- Completed delivery history: `docs/delivery-plan-archive.md` (не current source of truth).

# Delivery plan

## Current Goal

- **ID / title:** `PWA-WORKER-USAGE-ACCOUNTING-01` — worker isolation и reconciled ElevenLabs usage/cost accounting.
- **State:** `IN_PROGRESS`.
- **Authorization source:** explicit owner instructions 2026-08-30: следующей единой Goal взять `Worker isolation` и `Usage/cost accounting`; затем расширить её server-side синхронизацией всегда актуальных данных ElevenLabs subscription/usage/overage/invoice и всеми расчётами, которые допускает official provider Evidence.
- **Scope:** закрыть canonical `PWAWOR-02..03` и `USAGEC-01..06`: задать и проверить CPU/memory/PID bounds worker; ограничить его writable filesystem, Linux capabilities, privilege escalation и network reachability; отделить worker от API database credential и DDL/superuser capability; сохранять подтверждённую STT duration и immutable nominal tariff snapshot на job; server-side получать official ElevenLabs subscription и workspace product-credit usage, сохранять bounded owner/credential-version-scoped current snapshot с freshness/error provenance; раздельно показывать job nominal estimate и account actual overage/invoices/period units; добавить additive migrations, safe owner API/UI/diagnostics projection, tests/docs, reviewable PR, exact-head CI, applicable protected migration/API/worker delivery и одну bounded owner-authorized LIVE transcription с account refresh.
- **Non-goals:** commercial contour и пользовательский billing; scraping pricing page или автоматическое изменение public tariff snapshot без verified release input; выдуманное распределение account invoice/overage по отдельным jobs; преобразование ElevenLabs credits/characters в минуты без provider Evidence; новый STT provider или automatic fallback; realtime cost accounting; storage/compute/network cost; изменение `docs/ci-cd-rules.md`, GitHub protections или unrelated refactors.
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
  13. `WUA-13`: server-side ElevenLabs account transport валидирует bounded official subscription response и workspace product-credit response; API key, raw provider payload и provider user identifiers не попадают в browser/cache/logs.
  14. `WUA-14`: owner/credential-version-scoped snapshot хранит plan/status, provider period usage/limit/remaining, reset, usage-based billing entitlement/cap, actual current overage, invoice aggregates и product credits с explicit units/window provenance.
  15. `WUA-15`: automatic refresh при открытом UI использует максимум пятиминутный successful snapshot, visible timestamp и bounded polling; manual refresh доступен, а provider failure возвращает last successful snapshot как stale либо explicit unavailable без fabricated values.
  16. `WUA-16`: UI и API раздельно обозначают local job nominal estimate, provider account usage units, current overage и invoice; model-specific minutes/remaining или per-job invoice allocation показываются только при direct provider Evidence.
- **Required Evidence:** target `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`; current `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ◐ | LIVE —`.
- **Known blockers/dependencies:** production DB уже на `0030_provider_usage_accounting`, но API предыдущего schema head временно unready; требуется reviewed forward-only hotfix и новый protected approval для `0031_provider_account_snapshots`. Worker остаётся safely stopped до завершения migration/API и отдельного DB-role preflight. Existing ElevenLabs key должен иметь read scopes для user subscription и workspace analytics, иначе UI обязан показать actionable partial/unavailable state. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** все Goal AC и required Evidence выполнены либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; к следующей Goal без новой authorization не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-30T18:21:38Z.
- Session mode: authorized full-delivery Goal; все non-goals выше запрещены.
- Base branch/SHA: verified `origin/main@8ab3410312e0be5c7e5303ca514a199969d9f602`.
- Working branch: `codex/pwa-worker-usage-accounting-hotfix`.
- Isolated worktree: `C:/Users/wait9/AppData/Local/Temp/codex-elevenlabs-worker-usage-accounting`.
- Last verified revision: hotfix `0a9f548d0d80c066a422f339b21e8ee37c9a41da` поверх merged Goal implementation `8ab3410312e0be5c7e5303ca514a199969d9f602`.
- Working tree at Goal start: isolated worktree clean. Основной checkout содержит unknown/unrelated `.pytest-tmp-*` directories; они сохранены нетронутыми.
- Completed: PR `#261` merged как `8ab3410312e0be5c7e5303ca514a199969d9f602`; exact-main repository/Studio CI success. Worker configuration и dedicated credential files staged, old worker gracefully drained (`exited`, code `0`). Protected run `33322760011` создал и проверил snapshot `ee9c4b84b51c…`, затем успешно применил `0029_source_reference_class → 0030_provider_usage_accounting`. После migration old API закономерно стал unready, и release выявил orchestration defect: intermediate target ошибочно требовал `/api/readyz`. Новый fail-closed hotfix разрешает recovery только при точной цепочке running API head → current DB → requested successor и проверяет `/api/livez` для intermediate target.
- Current step: отправить reviewable hotfix, получить exact-head CI и merge до нового protected migration approval.
- Next exact action: commit этого checkpoint, выполнить один initial push и создать hotfix PR от `8ab3410`.
- Validation and Evidence: merged PR exact-head CI success; push-main runs `33318370362` и `33318370360` success. Hotfix local: exact Git Bash `bash -n` success; `tests/test_studio_migration_release.py` — `13 passed`, включая positive schema-ahead recovery и negative mismatched-head gate. Первый sandbox pytest не исполнил Git Bash из-за WindowsApps/ACL и не является test result.
- Pull Request / CI / deployment: PR `#261` MERGED. Initial CD `33318370347` failed before deploy on missing runtime settings. Migration run `33319551039` applied nothing; run `33322760011` applied `0030` and then stopped on old API readiness. Production DB=`0030`; running API image head=`0029`, API unready; worker safely stopped. `STUDIO_MIGRATION_RELEASE_ENABLED=false` confirmed after diagnosis. Hotfix PR not yet created.
- Blockers: новый protected `0031` approval возможен только после hotfix merge и terminal required CI; затем нужны worker DB-role apply/verify, worker deploy и owner-authorized bounded LIVE transcription/account refresh.
- Unverified assumptions: provider account `character_count/character_limit` остаются provider-defined period units и не равны минутам Scribe; product usage endpoint возвращает credits, которые нельзя безопасно распределить по job или перевести в invoice amount без additional provider Evidence.
- Preserved pre-existing changes: `.pytest-tmp-*` directories в основном checkout; текущая Goal их не читает, не изменяет и не удаляет.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Current snapshot независимо reconciled по merged code, exact-main CI, protected deployment и LIVE предыдущей Goal; новая Goal пока numerator не меняет. Evidence gate-ит READY, но не меняет numerator.

| Product/epic | Current independent snapshot | Previous independent snapshot | Основание |
|---|---:|---:|---|
| **Полный canonical scope** | **45,7% (`264/578`)** | **46,0% (`264/574`)** | Denominator увеличен на четыре явно согласованных provider-account AC; numerator не изменён до Evidence. Изменение `-0,3` п.п. |
| **Non-commercial scope** | **78,6% (`264/336`)** | **79,5% (`264/332`)** | Colab `32/32` + personal PWA `232/304`; denominator увеличен на четыре AC. Изменение `-0,9` п.п. |
| **Commercial/cross-contour** | **0% (`0/242`)** | **0% (`0/242`)** | Durable BACKLOG, implementation не авторизована. |
| **Google Colab canonical** | **100% (`32/32`)** | **100% (`32/32`)** | Current Goal Colab не затрагивает; applicable delivery Evidence closed. |
| **Personal Studio PWA canonical** | **76,3% (`232/304`)** | **77,3% (`232/300`)** | Denominator увеличен на `USAGEC-03..06`; до CODE/TEST/CI/DEPLOY/LIVE numerator не меняется. Изменение `-1,0` п.п. |
| `PWA-USER-EXPERIENCE-02` | **100% (`12/12`)** | **100% (`12/12`)** | PR `#259/#260`, CI, DEPLOY и bounded owner LIVE закрыли required Evidence; эпик READY. |
| `STORAGE-LIFECYCLE-02` | **57,1% (`12/21`)** | **33,3% (`7/21`)** | Distinct buckets, credentials, lifecycle rules и cross-access denial подтвердили `STORAG-17..21`. Изменение `+23,8` п.п. объясняется закрытием пяти external/runtime AC. |
| `PWA-WORKER-ISOLATION-02` | **33,3% (`1/3`)** | **33,3% (`1/3`)** | Отдельный worker component существует; resource/privilege AC текущей Goal ещё не выполнены. |
| `USAGE-COST-ACCOUNTING-01` | **0% (`0/6`)** | **0% (`0/2`)** | Четыре новые AC добавлены explicit owner decision; текущая ветка ещё не получила provider-account reconciliation Evidence. |

Только storage epic в previous snapshot изменился более чем на `10` п.п.: причина — пять external AC получили provider/runtime Evidence в предыдущем delivery flow. Текущая независимая переоценка изменила denominator на четыре согласованных `USAGEC-03..06`; ни одно изменение current snapshot не превышает `10` п.п.

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

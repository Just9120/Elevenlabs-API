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
- **Known blockers/dependencies:** migration/API release `33360460155` success: production schema `0031_provider_account_snapshots`, API ready on exact merge `bd51e7569370ec059b5926cee974c63a2d5c168f`. Owner role apply committed, but its verifier incorrectly expected `true:false:...` from PostgreSQL `concat_ws` (`t:f:...`); worker remains safely stopped. Deliver the reviewed verifier correction and perform read-only `verify` before any worker deploy; do not repeat role mutation speculatively. Existing ElevenLabs key должен иметь read scopes для user subscription и workspace analytics, иначе UI обязан показать actionable partial/unavailable state. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** все Goal AC и required Evidence выполнены либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; к следующей Goal без новой authorization не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-31T07:35:00Z.
- Session mode: authorized full-delivery Goal; все non-goals выше запрещены.
- Base branch/SHA: verified `origin/main@bd51e7569370ec059b5926cee974c63a2d5c168f`.
- Working branch: `codex/pwa-worker-role-verification`.
- Isolated worktree: `C:/Users/wait9/AppData/Local/Temp/codex-elevenlabs-worker-usage-accounting`.
- Last verified revision: local verifier correction `6ac1ec84002e1335d9621bec3b0d74e4273f7592` on deployed/CI-verified `bd51e7569370ec059b5926cee974c63a2d5c168f`. Preserved post-merge metadata from the previous session is included in this necessary production hotfix, not a separate metadata-only PR.
- Working tree at Goal start: isolated worktree clean. Основной checkout содержит unknown/unrelated `.pytest-tmp-*` directories; они сохранены нетронутыми.
- Completed: implementation PR `#261` и sequential-migration hotfix PR `#262` merged; exact-main CI success. Worker configuration/credential staged, old worker gracefully drained. Protected run `33322760011` verified snapshot `ee9c4b84b51c…` и применил `0029 → 0030`. Run `33328210998` после owner approval остановился до backup/migration (`running_api_head_probe_failed`, `migration_applied=no`). Owner VPS Evidence 2026-08-31 подтвердило: running API container существует, но image `sha256:75cda05ecfcbf87a5b7d86bcc17fce0b42a69c00988296f96ba88d333fd86420` отсутствует в local image store. Local correction читает baked head через exact running container под UID/GID `10001`, сохраняя schema-chain и container-identity gates.
- Current step: owner Evidence confirmed `exit_code=0`, graceful drain and committed role manifest; verification failed before any worker start. Regression reproduced the PostgreSQL boolean-format mismatch. Correction uses one SQL predicate and also stops when Git status cannot be read. Grants, password handling and runtime topology are unchanged.
- Next exact action: commit this checkpoint, perform one initial push and create the narrow verifier hotfix PR; require real PostgreSQL/Linux CI evidence before merge and read-only VPS verification.
- Validation and Evidence: container-probe local migration/release suite `23 passed`, lightweight CI checks, release/CI shell syntax success. Exact PR CI `33360042003` and Studio/browser CI `33360042022` success; exact merge CI `33360260838` and Studio/browser CI `33360260703` success. Real Docker probe printed `STUDIO_RUNNING_CONTAINER_METADATA_OK` on PR and merge SHA (main job `99390105887`). Regression covers absent old image, container replacement, failed probe and mismatched schema head. Local Docker daemon remains unavailable; runtime-container validation is Linux CI Evidence, not local evidence.
- Verifier-hotfix validation: expected red regression on old script; corrected focused verifier/worker-health/Compose tests `33 passed`, Bash/Python syntax, lightweight checks and diff checks success. Additional existing preflight suite on Windows: `21 failed, 5 passed` due native/MSYS path assumptions and Windows-invalid fixture names; its test/script files match the verified base and are unchanged. This is not passing local Evidence; full Linux CI (including the added real-PostgreSQL predicate test) is required. Native PostgreSQL and Docker daemon are unavailable locally.
- Pull Request / CI / deployment: PR `#261/#262/#263` MERGED. Owner `Just9120` approval confirmed for run `33360460155`; selected migration job `99390681629` and workflow completed `success`. Safe marker at `2026-08-31T06:37:38Z`: `commit=bd51e7569370 from=0030_provider_usage_accounting to=0031_provider_account_snapshots head=0031_provider_account_snapshots snapshot=332e51d65a9d image=sha256:2067381f6e2a api_deployed=yes`. Reviewed script enforces newly restored/dump-verified backup, exact built/running image equality and local/public readiness before this marker. Independent public check at `2026-08-31T07:22:00Z`: `/api/readyz` HTTP 200, schema `0031`, database/Redis reachable; `/api/livez` HTTP 200. `deploy-web`, `deploy-api`, `deploy-worker` were intentionally skipped; API deployment is evidenced by the protected release, not the skipped standard API job. Release-selection flag remains `false`. Worker has not been deployed or resumed.
- Blockers: verifier hotfix exact-head CI/merge and operator read-only role verification; then worker deploy/status and owner-authorized bounded LIVE transcription/account refresh. No schema downgrade/restore, speculative rerun or protection bypass is authorized. API health is operational evidence, not product LIVE accounting proof. No approved post-deploy metadata writer exists; no metadata-only PR is created.
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

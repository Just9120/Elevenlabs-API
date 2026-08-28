# Delivery plan

## Current Goal

- **ID / title:** `TRANSCRIPT-DOC-STANDARD-01` — versionless rich-text standard `transcript_doc`.
- **State:** `IN_PROGRESS`.
- **Authorization source:** explicit owner instruction 2026-08-28 «ставь цель и приступай к фиксу» после подтверждения legacy output в новых transcripts.
- **Scope:** единый versionless `transcript_doc` для всех новых Google Docs transcripts Studio PWA и Colab; внутридокументное название `HEADING_2`; русские structural labels `Метаданные транскрипта`, `Транскрипция`, `Спикер N:`; English metadata keys и устойчивые technical terms; speaker label bold `14 pt`; обычный transcript body `11 pt`; rich-text Google Docs `batchUpdate`; existing explicit recursive dry-run/apply standardization; idempotent/fail-closed mutation; focused/full validation, exact-head CI, applicable delivery и authenticated LIVE на новом и существующем документе.
- **Non-goals:** commercial scope; provider/STT behavior или spend; transcript content rewriting; speaker identity mapping; OAuth scope expansion; DB migration; arbitrary Docs editor; automatic bulk mutation без explicit apply; unrelated refactors.
- **Goal AC:**
  1. `TDS-01`: canonical `CB-24` и `PD-07..13`, versionless identifier, readiness denominator и checkpoint отражают owner-approved contract без изменения durable semantics.
  2. `TDS-02`: один deterministic document model строит localized plain text и exact UTF-16 Google Docs style ranges; legacy `transcript_doc_v1.2` распознаётся как outdated, current `transcript_doc` — как current.
  3. `TDS-03`: каждый новый Studio Google Doc создаётся с preserved Drive file title и затем получает verified rich-text formatting: `HEADING_2`, speaker label bold `14 pt`, обычный transcript body `11 pt`.
  4. `TDS-04`: все create/update/recreate/copy paths Colab используют тот же versionless contract и rich-text formatting без изменения provider/transcription behavior.
  5. `TDS-05`: existing explicit recursive dry-run/apply standardization переводит eligible legacy/current documents в `transcript_doc`, сохраняет authoritative title/metadata/transcript content и повторный apply не создаёт semantic/style drift.
  6. `TDS-06`: Studio mutation остаётся revision-controlled/fail-closed; creation reconciliation не допускает silent duplicate; unsupported/multi-tab/conflicting documents не мутируются; secrets/document content не попадают в logs.
  7. `TDS-07`: focused tests покрывают text model, UTF-16 ranges, Studio transport/create, Colab paths, dry-run/apply/idempotency/conflict; полные Python/Studio/lint/build checks green.
  8. `TDS-08`: один initial push/PR после полной local validation; required exact-head checks green; merge gates, applicable API/worker/web/Colab delivery и authenticated owner LIVE подтверждают один новый и один existing standardized document.
- **Required Evidence:** target `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`; current `SPEC ✅ | CODE ✅ | TEST ✅ | CI — | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** exact rich-text ranges используют Google Docs UTF-16 indices; Studio create + format должна сохранять existing reconciliation boundary; Colab launcher читает `elevenlabs_api.py` из `main`; approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`). Immediate implementation blocker отсутствует.
- **Stop condition:** все Goal AC и canonical `CB-24`/`PD-07..13` подтверждены required Evidence либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; после closure к другой Goal без новой authorization не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-28T20:40:34Z.
- Session mode: authorized full-delivery Goal; все non-goals выше запрещены.
- Base branch/SHA: verified `origin/main@26fb497496ed2a418a12afc6b3cf081e45075e57`.
- Working branch: `codex/transcript-doc-standard-01`.
- Last verified revision: local `f4ed35c2e623b7cc4c1151d9d56f4d97482e6b97` plus reviewed uncommitted operational documentation only.
- Working tree at Goal start: clean; unrelated pre-existing changes отсутствовали.
- Completed: Studio deterministic document model использует exact UTF-16 ranges, versionless/localized text и H2/11 pt/14 pt styles; create transport fail-closed форматирует Drive-created document и сохраняет reconciliation authority при ошибке; revision-controlled standardization меняет text+styles одним bounded batch; standalone Colab creation/update применяет тот же semantic contract; Studio frontend runtime validator и copy принимают только `transcript_doc`. Созданы commits `8f1c4cf`, `aeac68c`, `f4ed35c`.
- Current step: синхронизировать architecture/runbook/readiness/checkpoint и создать documentation commit после full local validation.
- Next exact action: проверить remaining stale current-standard references и Actions included-minutes state, затем выполнить единственный initial push и открыть PR.
- Validation and Evidence: `scripts/ci_checks.py` success; Python portable `1106 passed, 5 skipped`; focused Colab `201 passed`; Studio Vitest `627 passed`, ESLint success, TypeScript/Vite/PWA build success; `git diff --check` success. Полный service-backed Python/browser E2E остаётся exact-head CI gate. Baseline exact-main CI `33205123663`, Studio PWA CI `33205123676` и CD `33205123712` относятся к предыдущей revision.
- Pull Request / CI / deployment: отсутствуют для current Goal. Production repository/web/API `26fb497496ed2a418a12afc6b3cf081e45075e57`; worker остаётся на совместимой предыдущей revision; schema `0027_query_bounds`.
- Blockers: implementation/local validation отсутствуют; до hosted CI сначала требуется безопасно проверить остаток included Actions minutes.
- Unverified assumptions: existing Google OAuth scopes разрешают требуемые Docs `batchUpdate`; current single-tab standardization snapshot даёт достаточные exact indices для style replacement; LIVE можно выполнить без нового provider call на уже завершённом transcript output.
- Preserved pre-existing changes: отсутствуют.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Current snapshot независимо пересчитан по exact-main code/tests/CI/deployment/LIVE; previous snapshot — состояние до завершения direct-upload Goal.

| Product/epic | Current independent snapshot | Previous independent snapshot | Основание |
|---|---:|---:|---|
| **Полный canonical scope** | **42,8% (`236/552`)** | **41,3% (`228/552`)** | Local CODE/TEST выполняют `CB-24` и `PD-07..13`; CI/deployment/LIVE gate-ят READY, но не добавляют AC к numerator. |
| **Non-commercial scope** | **76,1% (`236/310`)** | **73,5% (`228/310`)** | Colab `32/32` + personal PWA `204/278`; denominator не менялся. |
| **Commercial/cross-contour** | **0% (`0/242`)** | **0% (`0/242`)** | В durable BACKLOG, вне Goal; implementation запрещена. |
| **Google Colab canonical** | **100% (`32/32`)** | **96,9% (`31/32`)** | `CB-24` подтверждён local CODE/TEST; CI/LIVE ещё gate-ят lifecycle READY. |
| **Personal Studio PWA canonical** | **73,4% (`204/278`)** | **70,9% (`197/278`)** | `PD-07..13` подтверждены local CODE/TEST; production delivery ещё не выполнена. |
| `PWA-AUDIO-PREPARATION-01` | **100% (`30/30`)** | **100% (`30/30`)** | Не затронут current Goal; PR `#255` остаётся exact-main delivery Evidence. |
| `PWA-STANDARDIZATION-01` | **100% (`13/13`)** | **46,2% (`6/13`)** | Рост `+53,8` п.п. вызван выполнением семи owner-approved format AC `PD-07..13`; READY ожидает CI/deployment/LIVE Evidence. |
| `PWA-GOOGLE-PICKER-UX-01` | **100% (`8/8`)** | **100% (`8/8`)** | PR `#253/#254`, exact-main CI/web/LIVE. |
| `PWA-BATCH-01` | **100% (`11/11`)** | **100% (`11/11`)** | PR `#253/#254`, exact-main CI/web/LIVE. |

Изменение `PWA-STANDARDIZATION-01` больше `10` п.п. (`+53,8` п.п.) обусловлено не переоценкой старого scope, а реализацией всех семи ранее открытых atomic AC current Goal. Denominator `13` не изменился.

## Candidate next Goals

1. `DB-LEAST-PRIVILEGE-01` — actual roles Evidence и отдельные migration/application roles с backup/rollback plan.
2. `PWA-STORAGE-ISOLATION-01` — разделение Audio Preparation references и transcription intake после architecture decision.

## Risks и boundaries

- Google Docs indices используют UTF-16 code units; emoji/non-BMP text обязаны быть покрыты tests.
- File title и in-document title различны: standardization не переименовывает Drive file и использует authoritative current title.
- Creation reconciliation не разрешает повторно создавать документ после ambiguous Drive/Docs response.
- Standardization dry-run не мутирует; apply работает только по explicit owner action и required revision.
- Authenticated LIVE не запускает новый provider call: используется уже завершённый output или synthetic owner-controlled fixture.
- GitHub Actions minutes проверяются перед единственным initial push; speculative reruns запрещены.
- Approved post-deploy metadata writer отсутствует; protections не обходятся и отдельный docs-only follow-up PR не создаётся.

## Sources of truth

- Repository instructions: `AGENTS.md`.
- Product scope/AC: `docs/project-spec.md`.
- Current Goal/checkpoint/readiness: этот документ.
- CI/CD safety: `docs/ci-cd-rules.md`.
- Current architecture/runtime boundaries: `docs/architecture.md` и applicable runbooks.
- Completed delivery history: `docs/delivery-plan-archive.md` (не current source of truth).

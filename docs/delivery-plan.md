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
- **Required Evidence:** target `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`; current `SPEC ✅ | CODE ❌ | TEST — | CI — | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** exact rich-text ranges используют Google Docs UTF-16 indices; Studio create + format должна сохранять existing reconciliation boundary; Colab launcher читает `elevenlabs_api.py` из `main`; approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`). Immediate implementation blocker отсутствует.
- **Stop condition:** все Goal AC и canonical `CB-24`/`PD-07..13` подтверждены required Evidence либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; после closure к другой Goal без новой authorization не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-28T20:11:00Z.
- Session mode: authorized full-delivery Goal; все non-goals выше запрещены.
- Base branch/SHA: verified `origin/main@26fb497496ed2a418a12afc6b3cf081e45075e57`.
- Working branch: `codex/transcript-doc-standard-01`.
- Last verified revision: base `26fb497496ed2a418a12afc6b3cf081e45075e57`; новая implementation ещё не создана.
- Working tree at Goal start: clean; unrelated pre-existing changes отсутствовали.
- Completed: recovered exact main/GitHub state; confirmed legacy Studio `format_transcript_doc_v1_2`, plain-text Drive multipart creation, Colab `TRANSCRIPT_STANDARD_TARGET = transcript_doc_v1.2`, `TITLE` style и text-only standardization; user-authorized Goal создана.
- Current step: определить единый document model и все creation/standardization call paths до записи implementation.
- Next exact action: добавить focused failing tests для versionless localized text и exact rich-text requests, затем реализовать smallest shared builders для Studio и Colab.
- Validation and Evidence: baseline exact-main CI `33205123663`, Studio PWA CI `33205123676` и CD `33205123712` success для предыдущей revision; новая Goal пока не валидировалась.
- Pull Request / CI / deployment: отсутствуют для current Goal. Production repository/web/API `26fb497496ed2a418a12afc6b3cf081e45075e57`; worker остаётся на совместимой предыдущей revision; schema `0027_query_bounds`.
- Blockers: отсутствуют.
- Unverified assumptions: existing Google OAuth scopes разрешают требуемые Docs `batchUpdate`; current single-tab standardization snapshot даёт достаточные exact indices для style replacement; LIVE можно выполнить без нового provider call на уже завершённом transcript output.
- Preserved pre-existing changes: отсутствуют.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Current snapshot независимо пересчитан по exact-main code/tests/CI/deployment/LIVE; previous snapshot — состояние до завершения direct-upload Goal.

| Product/epic | Current independent snapshot | Previous independent snapshot | Основание |
|---|---:|---:|---|
| **Полный canonical scope** | **41,3% (`228/552`)** | **40,0% (`221/552`)** | Exact-main delivery выполняет `AP-01` и `AP-25..30`; current Goal пока numerator не меняет. |
| **Non-commercial scope** | **73,5% (`228/310`)** | **71,3% (`221/310`)** | Colab `31/32` + personal PWA `197/278`; current Goal затрагивает восемь открытых AC. |
| **Commercial/cross-contour** | **0% (`0/242`)** | **0% (`0/242`)** | В durable BACKLOG, вне Goal; implementation запрещена. |
| **Google Colab canonical** | **96,9% (`31/32`)** | **96,9% (`31/32`)** | Открыт `CB-24`; legacy versioned formatter подтверждён code Evidence. |
| **Personal Studio PWA canonical** | **70,9% (`197/278`)** | **68,3% (`190/278`)** | Direct-upload delivery закрыла семь audio AC; `PD-07..13` открыты. |
| `PWA-AUDIO-PREPARATION-01` | **100% (`30/30`)** | **76,7% (`23/30`)** | Exact-main CI/CD и authenticated LIVE подтверждены PR `#255`. |
| `PWA-STANDARDIZATION-01` | **46,2% (`6/13`)** | **46,2% (`6/13`)** | `PD-07..13` остаются невыполненными до current Goal Evidence. |
| `PWA-GOOGLE-PICKER-UX-01` | **100% (`8/8`)** | **100% (`8/8`)** | PR `#253/#254`, exact-main CI/web/LIVE. |
| `PWA-BATCH-01` | **100% (`11/11`)** | **100% (`11/11`)** | PR `#253/#254`, exact-main CI/web/LIVE. |

Изменение `PWA-AUDIO-PREPARATION-01` больше `10` п.п. (`+23,3` п.п.) вызвано выполнением семи AC в завершённом delivery PR `#255`; current Goal readiness пока не повышает.

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

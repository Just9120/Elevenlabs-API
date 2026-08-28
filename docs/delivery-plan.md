# Delivery plan

## Current Goal

- **ID / title:** `PWA-AUDIO-DIRECT-DRIVE-UPLOAD-01` — прямая загрузка исходных audio/video с устройства в Google Drive.
- **State:** `IN_PROGRESS`.
- **Authorization source:** explicit owner instruction 2026-08-28 «Да, ставь цель и приступай» после согласования состава Goal.
- **Scope:** переименовать sidebar и hero audio workspace в `Подготовка аудио`; оформить source actions как доступный tablist и добавить mode `В Google Drive без обработки`; bounded multi-select audio/video с устройства; existing app-owned output-folder dialog с search/navigation/current empty folder/shared drives; resumable browser-to-Drive transfer с сохранением исходных bytes/name/MIME; per-file и aggregate progress, cancellation, isolated partial failures и explicit idempotent manual retry; action-scoped API capability и server-side verification destination/result metadata; safe Drive links; focused/full validation, exact-head CI, applicable API+web delivery и authenticated LIVE.
- **Non-goals:** arbitrary file manager; commercial scope; `transcript_doc`; OAuth scope expansion; S3 staging; Studio Source creation; FFmpeg/processing; transcription/provider calls или spend; automatic retry/replay; DB migration; worker changes; CI/CD contract/topology changes; unrelated refactors.
- **Goal AC:**
  1. `DDU-01`: canonical `AP-01` и `AP-25..30`, readiness denominator и active checkpoint отражают owner-approved scope до implementation.
  2. `DDU-02`: sidebar/hero показывают `Подготовка аудио`; source modes представлены keyboard-accessible tablist с понятным active state.
  3. `DDU-03`: direct-upload mode принимает только bounded audio/video multi-select и выбирает target через existing app-owned folder dialog, включая search/shared/current empty folder.
  4. `DDU-04`: resumable browser-to-Drive transfer не передаёт media bytes в Studio API/S3/Source/FFmpeg/provider, сохраняет bytes/name/MIME и не расширяет existing OAuth scopes.
  5. `DDU-05`: UI показывает current/aggregate bytes и percent, stage, cancellation и изолированные per-file results; retry только explicit и не дублирует verified successes.
  6. `DDU-06`: API action-scoped session fail-closed проверяет owner/folder/policy, completion повторно читает и проверяет result parent/name/MIME/size/idempotency; tokens/upload-session URLs не логируются, не сохраняются и не попадают в diagnostics.
  7. `DDU-07`: focused frontend/backend tests покрывают bounds, invalid MIME, folder/session/result verification, progress/cancel/partial failure/idempotent retry; full frontend, Python и repository checks green.
  8. `DDU-08`: один validated push/PR; required exact-head checks green; merge gates выполнены; applicable API+web deployment и authenticated owner LIVE подтверждают short-fixture upload, Drive result, progress/cancel/retry без provider call.
- **Required Evidence:** target `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`; current `SPEC ✅ | CODE ✅ | TEST ◐ | CI — | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** Google resumable upload CORS и exact browser behavior требуют focused/LIVE verification; approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`). Immediate implementation blocker отсутствует.
- **Stop condition:** все Goal AC и canonical `AP-01`/`AP-25..30` подтверждены required Evidence либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; после closure к другой Goal без новой authorization не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-28T19:39:30Z.
- Session mode: authorized full-delivery Goal; все non-goals выше запрещены.
- Base branch/SHA: verified `origin/main@535a015dcef211a930faefe443245ee85ace38b8`.
- Working branch: `codex/pwa-audio-direct-drive-upload-01`.
- Last verified revision: implementation commit `ce126b3e986b` поверх base `535a015dcef211a930faefe443245ee85ace38b8`; API/frontend source, focused/full local tests, lint и production build подтверждены.
- Working tree at Goal start: clean; unrelated pre-existing changes отсутствовали.
- Completed: commits `7b8d579` (Goal/spec), `edfd6f6` (descriptor-bound API issuance/completion verification), `91e5942` (accessible direct-upload UI/resumable transport/tests) и `ce126b3` (multi-file cancellation recovery) созданы reviewable increments. Browser bytes обходят API/S3/Source/FFmpeg/provider; retry сначала ищет exact Drive appProperty marker; API повторно проверяет owner destination и exact result metadata. Architecture и independent readiness синхронизируются в текущем docs increment.
- Current step: initial PR checks проанализированы; исправить stale browser E2E navigation contract и выполнить единственный разрешённый grouped follow-up push.
- Next exact action: проверить updated Playwright discovery/related tests/lint, создать fix commit и одним batch push обновить PR #255; затем дождаться новых exact-head required checks.
- Validation and Evidence: focused backend unit `3/3`; direct uploader/component/Audio/sidebar/App related suite `239/239`; full portable Python `1095 passed, 5 skipped`; full Studio Vitest `627/627`; ESLint и production TypeScript/Vite/PWA build success. Initial exact-head repository CI `33204614886` и Studio job `98962371576` passed, включая DB-backed pytest/API regression и image/runtime gates. Browser E2E job `98962371932` failed только на stale sidebar selector `Обработка аудио` до выполнения Audio scenario; selector и новый explicit local tab transition исправлены локально, rerun ещё не запускался.
- Pull Request / CI / deployment: PR `#255`, initial head `c91bfe84772f35b2a61323e851bd284b9daf761d`; repository CI passed, Studio job passed, browser-e2e failed as classified above. Follow-up push ещё не выполнен. Deployment/LIVE отсутствуют. Current production web/repository `535a015dcef211a930faefe443245ee85ace38b8`; API/worker `cc4347758ebae849c963cbf11be253862c6a1402`; schema `0027_query_bounds`.
- Blockers: local service-backed pytest недоступен из-за отсутствующих PostgreSQL/Redis/Docker; это не delivery blocker, потому что unchanged exact-head CI profile поднимает оба сервиса и остаётся обязательным gate.
- Unverified assumptions: Google upload REST endpoint допускает required production-origin CORS для resumable browser transfer; capability token может безопасно использоваться только в памяти текущего action; Drive eventual consistency не ломает bounded completion verification.
- Preserved pre-existing changes: отсутствуют.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Current snapshot независимо пересчитан после завершения прошлой Goal и добавления current audio scope. Previous snapshot — independently verified closure прошлой Goal, а не основание current numerator.

| Product/epic | Current independent snapshot | Previous independent snapshot | Основание |
|---|---:|---:|---|
| **Полный canonical scope** | **41,3% (`228/552`)** | **40,0% (`221/552`)** | Local CODE/TEST Evidence выполняет `AP-01` и `AP-25..30`; denominator не менялся. |
| **Non-commercial scope** | **73,5% (`228/310`)** | **71,3% (`221/310`)** | Colab `31/32` + personal PWA `197/278`. |
| **Commercial/cross-contour** | **0% (`0/242`)** | **0% (`0/242`)** | В durable BACKLOG, вне Goal; implementation запрещена. |
| **Google Colab canonical** | **96,9% (`31/32`)** | **96,9% (`31/32`)** | Current Goal Colab не меняет. |
| **Personal Studio PWA canonical** | **70,9% (`197/278`)** | **68,3% (`190/278`)** | Семь current audio AC получили local implementation Evidence. |
| `PWA-AUDIO-PREPARATION-01` | **100% (`30/30`)** | **76,7% (`23/30`)** | `AP-01` и `AP-25..30` выполнены локально; READY требует CI/DEPLOY/LIVE. |
| `PWA-GOOGLE-PICKER-UX-01` | **100% (`8/8`)** | **100% (`8/8`)** | PR `#253/#254`, exact-main CI/web/LIVE. |
| `PWA-BATCH-01` | **100% (`11/11`)** | **100% (`11/11`)** | PR `#253/#254`, exact-main CI/web/LIVE. |

Изменение `PWA-AUDIO-PREPARATION-01` больше `10` п.п. (`+23,3` п.п.) вызвано выполнением семи ранее открытых AC в local implementation. Статус остаётся `IN PROGRESS`, потому что operational epic требует exact-head CI, API/web deployment и authenticated LIVE.

## Candidate next Goals

1. `TRANSCRIPT-DOC-STANDARD-01` — versionless `transcript_doc` для новых Colab/PWA outputs и one-click existing-document standardization; implementation не авторизована current Goal.
2. `DB-LEAST-PRIVILEGE-01` — actual roles Evidence и отдельные migration/application roles с backup/rollback plan.
3. `PWA-STORAGE-ISOLATION-01` — разделение Audio Preparation references и transcription intake после architecture decision.

## Risks и boundaries

- Resumable upload URL является ephemeral capability: не логировать, не хранить и не возвращать в diagnostics.
- Browser progress/cancel не доказывает Drive persistence; success появляется только после server-side metadata verification.
- Manual retry должен сначала искать exact idempotency marker в verified target folder и fail-closed при неоднозначности.
- Existing folder picker/OAuth boundary, S3 processing flows и transcription flows не должны регрессировать.
- Authenticated LIVE использует только короткие owner-controlled fixtures и не запускает provider/job side effects.
- GitHub Actions minutes проверяются перед единственным initial push; speculative reruns запрещены.
- Approved post-deploy metadata writer отсутствует; protections не обходятся и отдельный docs-only follow-up PR не создаётся.

## Sources of truth

- Repository instructions: `AGENTS.md`.
- Product scope/AC: `docs/project-spec.md`.
- Current Goal/checkpoint/readiness: этот документ.
- CI/CD safety: `docs/ci-cd-rules.md`.
- Current architecture/runtime boundaries: `docs/architecture.md` и applicable runbooks.
- Completed delivery history: `docs/delivery-plan-archive.md` (не current source of truth).

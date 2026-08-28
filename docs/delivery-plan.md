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
- **Required Evidence:** target `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`; current `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** Google resumable upload CORS и exact browser behavior требуют focused/LIVE verification; approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`). Immediate implementation blocker отсутствует.
- **Stop condition:** все Goal AC и canonical `AP-01`/`AP-25..30` подтверждены required Evidence либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; после closure к другой Goal без новой authorization не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-28T18:55:41Z.
- Session mode: authorized full-delivery Goal; все non-goals выше запрещены.
- Base branch/SHA: verified `origin/main@535a015dcef211a930faefe443245ee85ace38b8`.
- Working branch: `codex/pwa-audio-direct-drive-upload-01`.
- Last verified revision: documentation commit `7b8d579` поверх base `535a015dcef211a930faefe443245ee85ace38b8`; canonical Goal/spec/readiness прошли lightweight repository checks.
- Working tree at Goal start: clean; unrelated pre-existing changes отсутствовали.
- Completed: Git/GitHub baseline подтверждён; `docs/ci-cd-rules.md` и current architecture/code boundaries прочитаны; approved scope атомизирован в `AP-01`/`AP-25..30`; предыдущая Goal reconciled по exact repository/runtime Evidence; commit `7b8d579` создан после `scripts/ci_checks.py` и `git diff --check`.
- Current step: action-scoped API session/result verification и focused backend tests реализованы локально; подготовить backend commit, затем browser resumable uploader/UI.
- Next exact action: зафиксировать backend boundary commit; затем реализовать `directDriveUpload.ts` и интеграцию direct-upload tab в `AudioPreparationPage`.
- Validation and Evidence: backend unit `tests/test_studio_direct_drive_upload.py` — `3 passed`; `compileall` для нового module/main success. Focused DB/API test добавлен, но системный Python 3.12 не содержит `argon2`; он будет выполнен в repository Python 3.11 dependency graph до push. CI/deployment/LIVE отсутствуют.
- Pull Request / CI / deployment: PR не создан; push запрещён до полной local validation. Current web/repository `535a015dcef211a930faefe443245ee85ace38b8`; API/worker `cc4347758ebae849c963cbf11be253862c6a1402`; schema `0027_query_bounds`.
- Blockers: отсутствуют.
- Unverified assumptions: Google upload REST endpoint допускает required production-origin CORS для resumable browser transfer; capability token может безопасно использоваться только в памяти текущего action; Drive eventual consistency не ломает bounded completion verification.
- Preserved pre-existing changes: отсутствуют.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Current snapshot независимо пересчитан после завершения прошлой Goal и добавления current audio scope. Previous snapshot — independently verified closure прошлой Goal, а не основание current numerator.

| Product/epic | Current independent snapshot | Previous independent snapshot | Основание |
|---|---:|---:|---|
| **Полный canonical scope** | **40,0% (`221/552`)** | **40,7% (`222/546`)** | `+6` AP AC; изменённый `AP-01` reopened до Evidence. |
| **Non-commercial scope** | **71,3% (`221/310`)** | **73,0% (`222/304`)** | Colab `31/32` + personal PWA `190/278`. |
| **Commercial/cross-contour** | **0% (`0/242`)** | **0% (`0/242`)** | В durable BACKLOG, вне Goal; implementation запрещена. |
| **Google Colab canonical** | **96,9% (`31/32`)** | **96,9% (`31/32`)** | Current Goal Colab не меняет. |
| **Personal Studio PWA canonical** | **68,3% (`190/278`)** | **70,2% (`191/272`)** | `+6` AP AC и reopened `AP-01`. |
| `PWA-AUDIO-PREPARATION-01` | **76,7% (`23/30`)** | **100% (`24/24`)** | Scope расширен прямой загрузкой; это denominator change, не regression existing processing. |
| `PWA-GOOGLE-PICKER-UX-01` | **100% (`8/8`)** | **100% (`8/8`)** | PR `#253/#254`, exact-main CI/web/LIVE. |
| `PWA-BATCH-01` | **100% (`11/11`)** | **100% (`11/11`)** | PR `#253/#254`, exact-main CI/web/LIVE. |

Изменение `PWA-AUDIO-PREPARATION-01` больше `10` п.п. (`−23,3` п.п.) вызвано owner-approved расширением denominator с `24` до `30` и заменой user-facing `AP-01`; existing processing behavior не признано регрессировавшим.

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

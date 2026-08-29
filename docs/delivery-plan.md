# Delivery plan

## Current Goal

- **ID / title:** `TRANSCRIPT-MAINTENANCE-LEGACY-DATE-LIVE-01` — live progress и safe legacy `Created at`.
- **State:** `IN_PROGRESS`.
- **Authorization source:** explicit owner reports 2026-08-29 о stale progress и массовой блокировке legacy Docs; owner decision: существующий валидный `Created at` не менять, а при отсутствии даты не писать `unknown`, а пропускать поле.
- **Scope:** непрерывно обновлять queued/running maintenance progress без remount; разрешить explicit legacy Google Docs standardization без исходного media file; сохранять существующий валидный `Created at`, а отсутствующий/невалидный не создавать; сохранить exact-authority/conflict safety; добавить regressions, canonical rule, PR/CI, applicable web/API/worker delivery и bounded authenticated LIVE без provider call.
- **Non-goals:** commercial contour; provider/STT calls или spend; изменение формата новых transcripts; подстановка Google Doc/job/modified/current time или filename; automatic/bulk apply без explicit preview/confirmation; manifest business rules; OAuth scopes; migration/schema; CI/CD policy/workflow changes; unrelated refactors.
- **Goal AC:**
  1. `TML-01`: canonical `PD-14`, `PTM-09`, denominator и current checkpoint отражают exact owner decision без ослабления правил новых transcripts.
  2. `TML-02`: `source_creation_status=unavailable` не блокирует outdated/unstructured legacy Doc; `conflict` и unreadable document остаются blocked.
  3. `TML-03`: standardization без authoritative source сохраняет валидный существующий `Created at`, а отсутствующий/невалидный полностью пропускает; `Created at: unknown` не генерируется.
  4. `TML-04`: при authoritative source visible timestamp по-прежнему обязан точно совпадать с source creation time и при необходимости заменяет legacy value.
  5. `TML-05`: mounted UI автоматически получает fresh `no-store` state queued/running run каждые bounded `2s`, обновляет progress и продолжает до terminal state без reload/tab switch.
  6. `TML-06`: focused/full local regressions подтверждают legacy date branches, conflict safety, continuous polling и existing maintenance/document behavior.
  7. `TML-07`: exact-head CI, applicable API/web/worker delivery и bounded authenticated dry-run подтверждают, что legacy rows больше не blocked; representative apply выполняется только после explicit owner preview/confirmation и без provider call.
- **Required Evidence:** target `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`; current `SPEC ✅ | CODE ✅ | TEST ✅ | CI ◐ | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** worker исполняет standardization apply, поэтому backend change требует совместимого API+worker rollout; worker lifecycle остаётся manual status/drain/deploy/status. Для representative Google Docs mutation нужен explicit owner preview/confirmation и подходящий legacy Doc. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** все Goal AC, `PD-14` и `PTM-09` имеют required Evidence либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; после closure к другой Goal без новой authorization не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-29T08:04:05Z.
- Session mode: authorized full-delivery Goal; все non-goals выше запрещены.
- Base branch/SHA: verified `origin/main@52c2adb4621f23fda34dece8a9096b36ae92504a`.
- Working branch: `codex/maintenance-live-progress-fix`.
- Last verified revision: initial PR head `131b0506e445e23a5996e94951b8b5d4c069cdef`; current local HEAD содержит локально проверенную grouped review-remediation и ещё не pushed.
- Working tree at Goal start: clean; unrelated pre-existing changes отсутствовали.
- Completed: reproduced polling defect in code — success branch did not schedule the next queued/running poll and requests lacked `no-store`; commit `fa75184` implements bounded recurring polling. Commit `3d45298` removes only the `unavailable` planning blocker, preserves conflict/unreadable safety, makes `Created at` optional for legacy standardization, preserves valid existing date and omits missing/invalid date. Commit `131b050` added canonical `PD-14`/`PTM-09`, Goal/checkpoint и factual archive. Initial branch push и PR `#258` выполнены; exact-head CI прошёл. Automated review выявил три valid consistency defects: unstructured legacy header, Colab fallback через Google Doc `createdTime` и stale checkpoint action. Локальная grouped remediation извлекает date только из существующей transcript metadata, сохраняет exact valid value, пропускает missing/invalid date, не теряет первую строку body и синхронизирует Studio/Colab behavior.
- Current step: выполнить единственный grouped follow-up push в PR `#258`.
- Next exact action: после review-remediation commit выполнить один grouped follow-up push и дождаться exact-successor CI/review.
- Validation and Evidence: review-focused Python `218 passed`; full portable Python `1119 passed, 5 skipped`; full Studio Vitest `633 passed`; ESLint, TypeScript/Vite/PWA production build и `scripts/ci_checks.py` passed. Initial PR head `131b0506e445e23a5996e94951b8b5d4c069cdef` также имел successful repository CI `33241637298` и Studio PWA CI `33241637305`; successor CI после pending follow-up ещё не запускался.
- Pull Request / CI / deployment: PR `#258` открыт: `https://github.com/Just9120/Elevenlabs-API/pull/258`. Initial exact-head checks successful; review comments `3885974359`, `3885974360`, `3885974362` подтверждены как valid и локально исправлены. Follow-up push, successor CI, merge и deployment ещё не выполнены. Repository public и standard GitHub-hosted CI не расходует private-repository included minutes.
- Blockers: отсутствуют.
- Unverified assumptions: representative production dry-run завершится после current owner run; suitable single legacy Doc для mutation может потребовать owner confirmation; exact deployed API/worker/web identities будут проверены после delivery.
- Preserved pre-existing changes: отсутствуют.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Current snapshot независимо пересчитан по current local CODE/TEST; previous snapshot — последний расчёт до добавления `PD-14` и `PTM-09`. Evidence gate-ит READY, но не меняет numerator.

| Product/epic | Current independent snapshot | Previous independent snapshot | Основание |
|---|---:|---:|---|
| **Полный canonical scope** | **43,8% (`246/562`)** | **43,6% (`244/560`)** | Owner decision добавила `PD-14` и `PTM-09`; local CODE/TEST выполняют оба, поэтому denominator `+2`, numerator `+2`. |
| **Non-commercial scope** | **76,9% (`246/320`)** | **76,7% (`244/318`)** | Colab `32/32` + personal PWA `214/288`; commercial не включена в numerator. |
| **Commercial/cross-contour** | **0% (`0/242`)** | **0% (`0/242`)** | В durable BACKLOG, implementation не авторизована. |
| **Google Colab canonical** | **100% (`32/32`)** | **100% (`32/32`)** | Current Goal Colab не затрагивает. |
| **Personal Studio PWA canonical** | **74,3% (`214/288`)** | **74,1% (`212/286`)** | `PD-14` и `PTM-09` реализованы и локально протестированы; CI/deployment/LIVE текущего исправления ещё gate-ят lifecycle. |
| `PWA-TRANSCRIPT-MAINTENANCE-01` | **100% (`9/9`)** | **100% (`8/8`)** | `PTM-09` имеет local CODE/TEST; exact-head CI/DEPLOY/LIVE ещё отсутствуют. |
| `PWA-STANDARDIZATION-01` | **100% (`14/14`)** | **100% (`13/13`)** | `PD-14` реализует exact owner legacy-date rule; exact-head CI/DEPLOY/LIVE ещё отсутствуют. |
| `PWA-MANIFEST-01` | **100% (`6/6`)** | **100% (`6/6`)** | Business rules не изменены; representative import/clear LIVE остаётся отдельным Evidence gap эпика. |

Ни одна сопоставимая оценка не изменилась более чем на `10` п.п.; расхождение объясняется только двумя новыми owner-approved atomic AC, оба подтверждены local CODE/TEST.

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

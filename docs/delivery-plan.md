# Delivery plan

## Current Goal

- **ID / title:** `PWA-AUDIO-PREPARATION-01` — самостоятельная обработка аудио до транскрибации.
- **State:** `IN_PROGRESS` — scope явно авторизован владельцем 2026-08-24 решениями реализовать Audacity-like PWA contour и отдельный menu item перед `Транскрипциями`.
- **Authorization source:** explicit current user instructions 2026-08-24; durable product scope — `AP-01..AP-16` из `docs/project-spec.md`.
- **Scope:** отдельный owner-scoped PWA workspace `Обработка аудио`; ephemeral reference uploads в S3-compatible storage с terminal cleanup и hard TTL 24 часа; source selection и ordered concat; bounded FFprobe validation; compatible stream-copy concat; WAV/FLAC conversion; mono mix/left/right; configurable silence processing и preview; standalone processing without provider call; safe rename templates и editable presets; durable queue/progress/cancel/recovery; retained S3-compatible output, authenticated download/reuse as source либо explicit upload в выбранную Google Drive folder; cleanup, tests, architecture/docs и полный delivery flow.
- **Non-goals:** optional TOTP, Cloudflare Zero Trust, STT/provider changes, Colab changes, commercial Russian S3 migration, billing/multi-user и unrelated redesign.
- **Goal AC:**
  1. `AP-01..AP-02`: отдельный sidebar/workspace перед `Транскрипциями` выбирает один или несколько доступных owner sources и не требует provider credential/job.
  2. `AP-03..AP-05`: inputs fail-closed probes, authoritative default order/manual reorder и copy-only concat compatibility работают до mutation.
  3. `AP-06..AP-08`: exact WAV/FLAC, mono mix/left/right и bounded silence parameters формируют deterministic FFmpeg plan.
  4. `AP-09`: preview возвращает безопасные aggregate durations и применённые параметры без создания output.
  5. `AP-10..AP-12`: operations compose independently; safe naming и editable presets показывают exact effective parameters.
  6. `AP-13`: durable worker-owned state переживает restart и поддерживает progress/cancel без duplicate output.
  7. `AP-14..AP-15`: completed output хранится по retention policy, owner-authenticated download/reuse и explicit Google Drive upload не раскрывают storage/token identity.
  8. `AP-16`: ephemeral references удаляются при terminal state и не живут более 24 часов; temporary files и failed partial output удаляются; DTO/logs/diagnostics исключают bytes/private paths/object keys.
  9. Relevant migration/backend/frontend/browser tests, full required CI, deployment и bounded LIVE проходят на exact revision.
- **Required Evidence:** `SPEC ✅ | CODE ✅ | TEST ✅ | CI — | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** durable job/output lifecycle потребует additive migration `0025_audio_preparation` и после merge отдельного action-time authorization для worker drain и `MANUAL_GATED` release; production LIVE требует только короткие owner-controlled media fixtures и не расходует provider quota. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** `AP-01..AP-16` и required Evidence подтверждены либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; optional TOTP не начинается в этой Goal.

## Active execution checkpoint

- Updated (UTC): 2026-08-24T20:38:00Z.
- Session mode: authorized Goal implementation.
- Base branch/SHA: `main@5e4a3aae8b79f2cb69c6c2efc8282d961b0392e6`, verified equal to `origin/main` after fetch.
- Working branch: `codex/pwa-audio-preparation`.
- Last verified revision: `4a63dd1` — committed backend/API/worker workflow; frontend/reliability completion is validated in the current worktree and awaits its atomic commit.
- Working tree at Goal start: clean; unrelated pre-existing changes absent.
- Completed: all `AP-01..AP-16` source-level flows, including separate PWA workspace, local/Drive source selection, editable presets, preview, progress/cancel/recovery heartbeat, S3 retention/download/reuse, idempotent Drive upload and terminal ephemeral cleanup.
- Current step: commit the validated frontend/reliability slice, then run final diff/schema checks and prepare PR.
- Next exact action: create the atomic frontend/reliability commit and run final branch validation.
- Validation and Evidence: portable repository suite `1057 passed, 6 skipped`; Studio Vitest `571/571`; focused audio/backend set `69/69`; ESLint, TypeScript and Vite production build passed. Non-portable Windows suite is inapplicable because its bash tests require Linux; CI remains required. Product readiness is now `16/16`, while READY remains gated by CI/DEPLOY/LIVE.
- Pull Request / CI / deployment: not created / not started / not started.
- Blockers: none for local implementation. Production stateful release remains future action-time gate.
- Unverified assumptions: stream-copy compatibility across selected containers/codecs and silence-preview precision must be bounded by tests; browser download path must reuse existing authenticated storage boundary without exposing object keys.
- Preserved pre-existing changes: none.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Denominator вырос с `120` до `136` после explicit authorization `AP-01..AP-16`; это объясняет изменение более чем на 10 процентных пунктов и не является regression существующих функций.

| Product/epic | Current | Previous independent snapshot | Readiness/Evidence |
|---|---:|---:|---|
| **Project** | **100% (`136/136`)** | **88,2% (`120/136`)** | `AP-01..AP-16` реализованы; обязательные delivery Evidence ещё открыты. |
| **Google Colab** | **100% (`29/29`)** | **100% (`29/29`)** | Batch `23/23`, realtime `6/6`; READY. |
| **Studio PWA** | **100% (`107/107`)** | **85,0% (`91/107`)** | Все PWA product AC выполнены; delivery Evidence для нового эпика открыты. |
| `PWA-AUDIO-PREPARATION-01` | **100% (`16/16`)** | **0% (`0/16`)** | 🟦 IN PROGRESS; `SPEC/CODE/TEST ✅`, `CI/DEPLOY/LIVE —`. |
| `PWA-SPEAKER-IDENTITY-01` | **100% (`5/5`)** | **100% (`5/5`)** | 🟩 READY; PR #233 delivery/LIVE reconciled. |
| Остальные existing epics | **100% (`115/115`)** | **100% (`115/115`)** | Completion не изменилась; individual Evidence остаётся в project-spec. |

## Candidate next Goals

1. `PWA-OPTIONAL-TOTP-01` — добровольная TOTP 2FA, disabled by default; enrollment/recovery/disable/security AC требуют отдельного согласования Goal.

## Risks и boundaries

- FFmpeg command строится только из allowlisted enums/bounded numbers и передаётся без shell; filenames/paths не становятся command fragments.
- Preview не является output evidence и не создаёт reusable source.
- Stream copy допустим только при exact probed compatibility; иначе пользователь выбирает WAV/FLAC conversion.
- Ephemeral reference objects удаляются при terminal state и имеют hard TTL 24 часа; reusable output retention отделён от reference lifecycle. Cleanup не удаляет transcript/history metadata и не затрагивает arbitrary bucket keys.
- Provider и Google Docs не вызываются в bounded LIVE этой Goal.
- MANUAL_GATED migration и worker lifecycle не выполняются без action-time authorization.

## Sources of truth

- Repository instructions: `AGENTS.md`.
- Product scope/AC: `docs/project-spec.md`.
- Current Goal/checkpoint/readiness: этот документ.
- CI/CD safety: `docs/ci-cd-rules.md`.
- Actual architecture: `docs/architecture.md`.
- Historical evidence: `docs/delivery-plan-archive.md` только для reconciliation.

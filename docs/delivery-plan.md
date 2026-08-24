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
- **Required Evidence:** `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** durable job/output lifecycle потребует additive migration `0025_audio_preparation` и после merge отдельного action-time authorization для worker drain и `MANUAL_GATED` release; production LIVE требует только короткие owner-controlled media fixtures и не расходует provider quota. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** `AP-01..AP-16` и required Evidence подтверждены либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; optional TOTP не начинается в этой Goal.

## Active execution checkpoint

- Updated (UTC): 2026-08-24T20:18:00Z.
- Session mode: authorized Goal implementation.
- Base branch/SHA: `main@5e4a3aae8b79f2cb69c6c2efc8282d961b0392e6`, verified equal to `origin/main` after fetch.
- Working branch: `codex/pwa-audio-preparation`.
- Last verified revision: `e5983f3` — deterministic audio-preparation probe/plan/processing core with `21/21` focused tests.
- Working tree at Goal start: clean; unrelated pre-existing changes absent.
- Completed: deterministic core; additive direct-successor migration `0025_audio_preparation`; owner/project job, ordered input, destination/output, progress/cancel/lease and ephemeral-reference schema models; repository preflight expected-head markers advanced to `0025`.
- Current step: implement owner-scoped API and worker state transitions around schema/domain.
- Next exact action: add create/list/detail/start/cancel/download routes and worker preview/processing runner.
- Validation and Evidence: focused deterministic contract `21/21` passed; full SQLite Alembic chain reached `0025_audio_preparation (head)`. Broader focused schema run reached `58 passed` before three sandbox temp-directory errors and one unrelated speaker temp-directory failure; these are local filesystem limitations, not accepted success and remain covered by Linux CI. Product AC remain `0/16` until integrated user flows exist.
- Pull Request / CI / deployment: not created / not started / not started.
- Blockers: none for local implementation. Production stateful release remains future action-time gate.
- Unverified assumptions: stream-copy compatibility across selected containers/codecs and silence-preview precision must be bounded by tests; browser download path must reuse existing authenticated storage boundary without exposing object keys.
- Preserved pre-existing changes: none.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Denominator вырос с `120` до `136` после explicit authorization `AP-01..AP-16`; это объясняет изменение более чем на 10 процентных пунктов и не является regression существующих функций.

| Product/epic | Current | Previous independent snapshot | Readiness/Evidence |
|---|---:|---:|---|
| **Project** | **88,2% (`120/136`)** | **100% (`120/120`)** | Новый audio-preparation epic `0/16`; существующие AC не регрессировали. |
| **Google Colab** | **100% (`29/29`)** | **100% (`29/29`)** | Batch `23/23`, realtime `6/6`; READY. |
| **Studio PWA** | **85,0% (`91/107`)** | **100% (`91/91`)** | Новый audio-preparation epic `0/16`. |
| `PWA-AUDIO-PREPARATION-01` | **0% (`0/16`)** | **N/A** | 🟦 IN PROGRESS; `SPEC ✅`, implementation Evidence open. |
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

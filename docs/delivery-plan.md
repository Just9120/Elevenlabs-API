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
- **Required Evidence:** `SPEC ✅ | CODE ✅ | TEST ✅ | CI ◐ | DEPLOY ◐ | LIVE ❌` — исходный merge и stateful release прошли, но LIVE выявил terminal-cleanup defect; exact hotfix ещё не прошёл CI/deploy/retest.
- **Known blockers/dependencies:** migration `0025_audio_preparation` уже применена и migration gate отключён; для hotfix требуется новый exact-revision CI, API/worker deploy и повторный bounded cleanup canary. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** `AP-01..AP-16` и required Evidence подтверждены либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; optional TOTP не начинается в этой Goal.

## Active execution checkpoint

- Updated (UTC): 2026-08-25T05:31:07Z.
- Session mode: authorized Goal implementation.
- Base branch/SHA: `main@1751d34ce44a33b8d9f28bff8642fe8d62fe7e4c`, verified equal to `origin/main` after fetch.
- Working branch: `codex/pwa-audio-preparation-cleanup-fix`.
- Last verified revision: `main@1751d34ce44a33b8d9f28bff8642fe8d62fe7e4c` — merged/deployed production baseline; hotfix working tree покрыт focused tests, commit pending.
- Working tree at Goal start: clean; unrelated pre-existing changes absent.
- Completed: PR `#234` merged как `1751d34`; exact-main CI, migration `0025`, web/API/worker deployment, preview `0:46 → 0:43`, completed processing, authenticated download и Drive artifact `Audio Preparation LIVE 2026-08-25.flac` подтверждены. LIVE cleanup canary выявил production-only drift: `SessionLocal(autoflush=False)` оставлял terminal job видимым как active во время deletion readiness check.
- Current step: узкий hotfix добавляет explicit `db.flush()` перед ephemeral cleanup и regression test с production-like `autoflush=False`.
- Next exact action: создать atomic hotfix commit, push/PR и дождаться required CI.
- Validation and Evidence: hotfix focused processor/worker suite `34 passed`; production-like processor regression `3 passed`. Targeted API suite локально не запускалась из-за отсутствующего local PostgreSQL (`127.0.0.1:5432`), поэтому её покрытие остаётся обязательным CI gate. Base exact-main runs `32777664803` и `32777664779` success; migration run `32778661217` и worker deploy `32778896943` success.
- Pull Request / CI / deployment: merged PR `#234`; hotfix PR not created / hotfix CI pending / base production deployed, hotfix not deployed.
- Blockers: none для hotfix implementation; CI и production retest являются открытыми gates.
- Unverified assumptions: physical R2 deletion должен быть подтверждён через исчезновение ephemeral source после terminal state и повторного reload; до hotfix LIVE это не выполнено.
- Preserved pre-existing changes: none.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Denominator вырос с `120` до `136` после explicit authorization `AP-01..AP-16`; это объясняет изменение более чем на 10 процентных пунктов и не является regression существующих функций.

| Product/epic | Current | Previous independent snapshot | Readiness/Evidence |
|---|---:|---:|---|
| **Project** | **100% (`136/136`)** | **100% (`136/136`)** | Denominator не изменился; `AP-16` hotfix реализован локально, обязательные CI/deploy/LIVE gates переоткрыты. |
| **Google Colab** | **100% (`29/29`)** | **100% (`29/29`)** | Batch `23/23`, realtime `6/6`; READY. |
| **Studio PWA** | **100% (`107/107`)** | **100% (`107/107`)** | Все PWA product AC выполнены в рабочей ветке; hotfix delivery Evidence открыты. |
| `PWA-AUDIO-PREPARATION-01` | **100% (`16/16`)** | **100% (`16/16`)** | 🟦 IN PROGRESS; `SPEC/CODE/TEST ✅`, `CI/DEPLOY ◐`, `LIVE ❌`. |
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

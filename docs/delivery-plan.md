# Delivery plan

## Current Goal

- **ID / title:** `PWA-AUDIO-WORKSPACE-02` — production-ready Audio workspace и observable local uploads.
- **State:** `IN_PROGRESS` — scope авторизован владельцем 2026-08-25 инструкцией «формируй цель и приступай» и последующим явным расширением на все browser-аннотации текущего цикла.
- **Authorization source:** текущие explicit user instructions; existing durable product scope — `docs/project-spec.md`; новые явно согласованные requirements будут атомарно reconciled в canonical Audio Preparation AC в этой ветке.
- **Scope:** исправить `invalid_input` для валидных OBS/Matroska inputs и подтвердить multi-file combination; разделить `Google Drive`, browser-local processing и temporary S3 upload; показывать измеримый per-file/aggregate upload progress в Audio и Transcriptions; сделать явный выбор `обработать отдельно`/`склеить`, понятный ordered timeline и metadata-based default order без filename inference; упростить presets/labels/defaults и скрыть advanced silence controls; сделать download, optional Google Drive save и transcription handoff независимыми terminal actions; сохранить regression coverage предыдущей UX/IA Goal.
- **Non-goals:** S3 bucket split/object migration; commercial/Russian production contour, billing/legal/provider changes; speaker identity; TOTP; CI/CD safety contract; unrelated Settings/Diagnostics redesign beyond regression fixes; destructive production operations.
- **Goal AC:**
  1. Валидный OBS Matroska input с stream duration sentinel (`N/A`) использует валидную container duration; invalid/missing duration по-прежнему fail-closed.
  2. Несколько sources имеют явный operation mode: отдельные outputs либо один concatenated output; для concat UI показывает numbered order, creation metadata/duration where available, reorder controls и unambiguous summary.
  3. Device intake разделяет `Обработать на устройстве` без S3 upload и `Загрузить в Studio` с explicit temporary-storage disclosure; unsupported/oversized local cases завершаются понятным bounded failure/fallback.
  4. Audio и Transcriptions показывают реальный per-file byte/percentage stage и aggregate queue progress при direct S3 upload; stalled/failed upload не выглядит как зависший и не запускает ambiguous duplicate PUT.
  5. Default Audio plan сохраняет исходный формат; conversion-required options переключают пользователя на explicit WAV/FLAC path без скрытой потери качества.
  6. Primary settings используют production-facing labels: filename template скрыт из основного flow, long-pause wording относится к аудио/видео, default threshold `-45 dB`, advanced silence values раскрываются только при включённой функции.
  7. Download всегда доступен как terminal action; optional Google Drive save/folder и transcription/reuse actions независимы и не представлены как misleading mutually-exclusive radio choice.
  8. Server и browser-local paths сохраняют owner/security boundaries, не включают private bytes/paths в diagnostics и не ослабляют existing source validation/retention/cleanup semantics.
  9. Relevant backend/frontend/browser tests, required exact-head CI, applicable API/worker/web deployment и bounded owner-controlled LIVE проходят; прошлые Settings/Diagnostics/fragmentation flows не регрессируют.
- **Required Evidence:** `SPEC ✅ | CODE ✅ | TEST ✅ | CI ◐ | DEPLOY ◐ | LIVE ❌`.
- **Known blockers/dependencies:** browser-local decoding зависит от поддерживаемых браузером codecs и device memory; production concat retest потребует owner-controlled source selection; approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`). Migration сейчас не ожидается.
- **Stop condition:** все Goal AC подтверждены required Evidence либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; после closure к следующей Goal без нового согласования не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-25T15:57:06Z.
- Session mode: authorized Goal implementation.
- Base branch/SHA: `main@23f3636e914d89e3158f770ecf6828cc10587bff`, verified equal to `origin/main` after fetch.
- Working branch: `codex/fix-audio-obs-duration-metadata` from exact base; предыдущая merged branch `codex/pwa-audio-workspace-02` сохранена только до Goal closure/cleanup.
- Last verified revision: `22d3910a755eae2f38e9adf91ba0139f14b2e136` — bounded parser принимает Matroska `DURATION` clock tags и `duration_ts × time_base`, сохраняя numeric/7-day fail-closed bounds; focused Audio backend suite `37/37` PASS.
- Working tree at Goal start: clean; unrelated pre-existing changes absent.
- Completed: PR `#237` merged как `main@23f3636e914d89e3158f770ecf6828cc10587bff`; exact-main CI `32864333001`/`32864333013`, web/API CD `32864332962`, authorized worker drain/deploy/status `32865914275`/`32866007887`/`32866139787` terminal success и `identity_match=yes`. Bounded production LIVE подтвердил browser-local WAV result без console errors, explicit source/mode/order/default/action UX, Settings/Diagnostics/fragmentation regressions. Separate preview обоих сохранённых OBS/MKV sources после rollout независимо завершился `invalid_input` на 5%, что опровергло initial numeric container-duration hypothesis. Hotfix `22d3910` добавляет bounded Matroska clock-tag/time-base duration fallbacks.
- Current step: отправить hotfix code/docs commits в PR и получить authoritative containerized CI; при green merge/deploy повторить worker drain/deploy и exact production preview/concat LIVE.
- Next exact action: commit checkpoint, push `codex/fix-audio-obs-duration-metadata`, создать hotfix PR и дождаться required checks.
- Validation and Evidence: hotfix focused Audio backend `37/37` PASS; `scripts/ci_checks.py` PASS. Полный локальный pytest: `1076 passed`, `7 skipped`, `187 errors` из-за отсутствующего PostgreSQL `127.0.0.1:5432`, плюс `65 failed` в environment-dependent Windows groups; authoritative GitHub CI с PostgreSQL остаётся required gate. Baseline Studio Vitest `591/591`, ESLint/build и authenticated Chromium `11/11` подтверждены PR/main CI.
- Pull Request / CI / deployment: PR `#237` merged; exact-main web/API/worker deployed. Hotfix PR/CI ещё не созданы; migration не требуется.
- Blockers: production `AP-10` остаётся failed до hotfix delivery и exact retest; approved post-deploy metadata writer отсутствует.
- Unverified assumptions: оба production MKV имеют OBS-style duration в strict `DURATION` tag либо `duration_ts/time_base`; hotfix обязан пройти exact source retest, а не считаться достаточным по unit fixture.
- Preserved pre-existing changes: none.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Новые owner-authorized annotations декомпозированы в `PC-14` и `AP-17..AP-23`; branch CODE/TEST не считается production completion до delivery/LIVE.

| Product/epic | Current independent snapshot | Previous independent snapshot | Основание |
|---|---:|---:|---|
| **Project** | **98,6% (`142/144`)** | **93,8% (`135/144`)** | `AP-17..AP-23` подтверждены delivery/LIVE; `PC-14` и `AP-10` остаются открыты. |
| **Google Colab** | **100% (`29/29`)** | **100% (`29/29`)** | Scope не затронут. |
| **Studio PWA** | **98,3% (`113/115`)** | **92,2% (`106/115`)** | Семь Audio UX/browser-local AC выполнены; `PC-14` и `AP-10` остаются открыты. |
| `PWA-CORE-01` | **92,9% (`13/14`)** | **92,9% (`13/14`)** | `PC-14` требует representative production upload-progress обоих экранов; transport/E2E/deploy уже подтверждены. |
| `PWA-AUDIO-PREPARATION-01` | **95,7% (`22/23`)** | **65,2% (`15/23`)** | Рост более 10 п.п.: `AP-17..AP-23` подтверждены exact-main delivery и bounded browser LIVE; `AP-10` всё ещё failed на production OBS preview. |
| Остальные existing PWA epics | **100% (`78/78`)** | **100% (`78/78`)** | Completion и denominator не изменились. |

## Candidate next Goals

1. `PWA-STORAGE-ISOLATION-01` — разделить Audio Preparation reference objects и transcription intake на разные lifecycle namespaces/buckets после отдельного architecture decision.
2. `PWA-OPTIONAL-TOTP-01` — добровольная TOTP 2FA, disabled by default.
3. `COMMERCIAL-EDITION-DISCOVERY-01` — отдельный российский production contour и legal/data-residency/provider discovery.

## Risks и boundaries

- Browser-local processing не должен молча отправлять source bytes в API/S3 и не должен обещать codecs, которые браузер не декодирует.
- Direct S3 progress transport обязан сохранять `credentials=omit`, bounded timeout, allowlisted capability method/headers и reconciliation после ambiguous PUT outcome.
- Filename не является creation/order authority. При отсутствии trustworthy metadata UI сохраняет explicit user order и сообщает uncertainty.
- `Без перекодирования` допустимо только для совместимого server-side concat; mono/silence требуют explicit conversion.
- Download, Drive save и transcription handoff являются независимыми действиями; Drive mutation требует exact user choice и owner grant.
- Production operation не запускается без required CI/deployment gates и bounded user-controlled LIVE authorization where applicable.

## Sources of truth

- Repository instructions: `AGENTS.md`.
- Product scope/AC: `docs/project-spec.md`.
- Current Goal/checkpoint/readiness: этот документ.
- CI/CD safety: `docs/ci-cd-rules.md`.
- Actual architecture: `docs/architecture.md`.
- Historical evidence: `docs/delivery-plan-archive.md` only for reconciliation.

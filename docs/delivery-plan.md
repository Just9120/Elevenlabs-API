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

- Updated (UTC): 2026-08-25T17:21:13Z.
- Session mode: authorized Goal implementation.
- Base branch/SHA: `main@86b0c98f5681ae29ecdd1cf3c0d1a2740ee153cd`, verified equal to fetched `origin/main` before branch creation.
- Working branch: `codex/fix-audio-direct-upload` from exact base; merged branches `codex/pwa-audio-workspace-02`, `codex/fix-audio-obs-duration-metadata` и `codex/fix-audio-obs-packet-duration` сохранены только до Goal closure/cleanup.
- Last verified revision: `7fbc41e27f95450c2efb2e7885f39664782cfe9a` — direct S3/R2 upload использует один raw-`File` `XMLHttpRequest` PUT с native byte progress, disabled cross-origin credentials, bounded timeout/abort, redirected terminal-response rejection и existing completion reconciliation без automatic PUT replay.
- Working tree at Goal start: clean; unrelated pre-existing changes absent.
- Completed: PR `#237` merged как `main@23f3636e914d89e3158f770ecf6828cc10587bff`; PR `#238` merged как `main@50c5817378c8e77a8bc9d0665e1cceae606d93ca`; packet-duration fallback PR `#239` merged как `main@86b0c98f5681ae29ecdd1cf3c0d1a2740ee153cd`. Exact-main CI `32871622334`/`32871622307`, API CD `32871620010`, authorized worker status/drain/deploy/status `32871936411`/`32872021556`/`32872102665`/`32872254959` terminal success, migration skipped и `identity_match=yes`. Production retest затем выявил следующий prerequisite defect: Chrome и встроенный Chromium успешно создают pending source, но streaming-fetch PUT не создаёт R2 object; completion получает `sources 4xx`, `source.local_upload.completed` отсутствует.
- Current step: доставить browser-compatible direct-upload fix, затем повторить exact production OBS/MKV upload, concat preview/process и terminal actions.
- Next exact action: push `codex/fix-audio-direct-upload`, создать PR и дождаться required CI checks.
- Validation and Evidence: focused transport `5/5` PASS; Audio workspace `6/6` PASS; focused shared Transcriptions upload `1/1` PASS; full Studio Vitest `591/591` PASS; Studio ESLint PASS; TypeScript build PASS; Vite/PWA production build PASS; `scripts/ci_checks.py` PASS; `git diff --check` PASS. Авторитетные CI/deploy нового exact revision ещё не выполнялись.
- Pull Request / CI / deployment: PR ещё не создан. Новый fix меняет только Studio web/runtime docs, не требует schema migration, API или worker rollout; applicable deployment — `studio-web` после merge.
- Blockers: production `PC-14` и `AP-10` остаются открыты до exact-main web deploy и bounded Chrome LIVE; approved post-deploy metadata writer отсутствует.
- Unverified assumptions: raw-`File` XHR PUT устранит production R2 failure для реальных OBS/MKV; это подтверждается стандартным browser transport contract и local tests, но не считается LIVE до exact production retest.
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

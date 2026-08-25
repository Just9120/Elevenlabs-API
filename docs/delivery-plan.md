# Delivery plan

## Current Goal

- **ID / title:** `PWA-AUDIO-WORKSPACE-02` — production-ready Audio workspace и observable local uploads.
- **State:** `IN_PROGRESS` — scope авторизован владельцем 2026-08-25 инструкцией «формируй цель и приступай» и последующим явным расширением на все browser-аннотации текущего цикла.
- **Authorization source:** текущие explicit user instructions; existing durable product scope — `docs/project-spec.md`; новые явно согласованные requirements будут атомарно reconciled в canonical Audio Preparation AC в этой ветке.
- **Scope:** исправить `invalid_input` для валидных OBS/Matroska inputs и подтвердить multi-file combination; разделить `Google Drive`, browser-local processing и temporary S3 upload; показывать измеримый per-file/aggregate upload progress в Audio и Transcriptions; сделать явный выбор `обработать отдельно`/`склеить`, понятный ordered timeline и metadata-based default order без filename inference; упростить presets/labels/defaults и скрыть advanced silence controls; сделать download, optional Google Drive save и transcription handoff независимыми terminal actions; добавить прямой переход в Audio workspace с dashboard; нормализовать server-side FLAC в явный 16-bit output с сохранением исходной sample rate и раскрыть формат пользователю; сохранить regression coverage предыдущей UX/IA Goal.
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
  10. Dashboard явно предлагает Audio workspace рядом с транскрибациями и открывает route `/audio` без промежуточного navigation flow.
  11. Server-side FLAC не повышается неявно до 24-bit после FFmpeg filters: output использует 16-bit, сохраняет исходную sample rate, UI раскрывает параметры, focused probe подтверждает sample format и заметное уменьшение размера.
- **Required Evidence:** `SPEC ✅ | CODE ✅ | TEST ✅ | CI — | DEPLOY — | LIVE ◐`.
- **Known blockers/dependencies:** browser-local decoding зависит от поддерживаемых браузером codecs и device memory; production concat retest потребует owner-controlled source selection; approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`). Migration сейчас не ожидается.
- **Stop condition:** все Goal AC подтверждены required Evidence либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; после closure к следующей Goal без нового согласования не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-25T21:09:56Z.
- Session mode: authorized Goal implementation.
- Base branch/SHA: `main@bffbdb11b882701226898b9f7d03062fd69b2679`, verified equal to fetched `origin/main` 2026-08-25 перед новой branch write.
- Working branch: `codex/fix-flac-output-size` from exact base.
- Last verified revision: `f304ae5fbfd73819d593261a135e29775390c781` — FLAC conversion явно использует `s16` при сохранении исходной sample rate, UI раскрывает contract, focused backend/frontend/FFmpeg validation проходит.
- Working tree at Goal start: clean; unrelated pre-existing changes absent.
- Completed: PR `#242` merged как `main@bffbdb11b882701226898b9f7d03062fd69b2679`; exact-main CI `32886126936`/`32886126975`, component CD `32886126962` и worker drain/deploy/status `32894632672`/`32894727612`/`32894867214` successful. Owner production concat `9010f902-145b-4ef0-bfef-0416a20daeaf` на трёх OBS/MKV завершился `completed` (`137:36 → 129:48`) и закрыл `AP-10`. Полученный FLAC больше `600 MB`; exact code и local FFmpeg probe подтвердили output `s32`/24-bit при неявном sample format.
- Current step: PR `#243` открыт из `codex/fix-flac-output-size`; required exact-head CI выполняется.
- Next exact action: дождаться terminal state всех required checks PR `#243`, проанализировать failures/skips и при green gates выполнить merge.
- Validation and Evidence: backend Audio command/processor tests `32/32` PASS; Studio Audio component `7/7` PASS после устранения календарно-зависимых expired fixtures; Studio ESLint PASS; TypeScript/Vite/PWA production build PASS с existing non-blocking chunk-size warning; Python compileall PASS; `git diff --check` PASS. Real FFmpeg smoke подтвердил fixed output `s16`, `48 kHz`, mono и уменьшение `284343 → 95292` bytes на одинаковом input. CI ещё не запущен.
- Pull Request / CI / deployment: PR `#243` — `https://github.com/Just9120/Elevenlabs-API/pull/243`; required checks pending. Изменение затрагивает Studio web, API и worker; schema migration не требуется. После merge web/API идут standard CD, worker rollout требует отдельного approved drain/deploy exact merged SHA.
- Blockers: `AP-24` требует exact-head CI, merge, API/web/worker delivery и bounded LIVE sample-format/size confirmation; `PC-14` upload-progress ещё требует отдельного representative Transcriptions LIVE. Approved post-deploy metadata writer отсутствует.
- Unverified assumptions: уменьшение конкретного 129:48 production output зависит от signal/noise content; local representative smoke дал почти трёхкратное уменьшение, но точный production ratio до LIVE не подтверждён.
- Preserved pre-existing changes: none.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Новые owner-authorized annotations декомпозированы в `PC-14` и `AP-17..AP-23`; branch CODE/TEST не считается production completion до delivery/LIVE.

| Product/epic | Current independent snapshot | Previous independent snapshot | Основание |
|---|---:|---:|---|
| **Project** | **98,6% (`143/145`)** | **98,6% (`142/144`)** | `AP-10` подтверждён LIVE; denominator вырос на owner-authorized `AP-24`, который вместе с `PC-14` остаётся открытым. |
| **Google Colab** | **100% (`29/29`)** | **100% (`29/29`)** | Scope не затронут. |
| **Studio PWA** | **98,3% (`114/116`)** | **98,3% (`113/115`)** | `AP-10` выполнен; denominator вырос на `AP-24`, открыты `PC-14` и `AP-24`. |
| `PWA-CORE-01` | **92,9% (`13/14`)** | **92,9% (`13/14`)** | `PC-14` требует representative production upload-progress обоих экранов; transport/E2E/deploy уже подтверждены. |
| `PWA-AUDIO-PREPARATION-01` | **95,8% (`23/24`)** | **95,7% (`22/23`)** | `AP-10` закрыт production concat; denominator вырос на новый `AP-24`, открытый до delivery/LIVE 16-bit FLAC. |
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

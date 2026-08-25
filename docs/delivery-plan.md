# Delivery plan

## Current Goal

- **ID / title:** `PWA-AUDIO-WORKSPACE-02` — production-ready Audio workspace и observable local uploads.
- **State:** `IN_PROGRESS` — scope авторизован владельцем 2026-08-25 инструкцией «формируй цель и приступай» и последующим явным расширением на все browser-аннотации текущего цикла.
- **Authorization source:** текущие explicit user instructions; existing durable product scope — `docs/project-spec.md`; новые явно согласованные requirements будут атомарно reconciled в canonical Audio Preparation AC в этой ветке.
- **Scope:** исправить `invalid_input` для валидных OBS/Matroska inputs и подтвердить multi-file combination; разделить `Google Drive`, browser-local processing и temporary S3 upload; показывать измеримый per-file/aggregate upload progress в Audio и Transcriptions; сделать явный выбор `обработать отдельно`/`склеить`, понятный ordered timeline и metadata-based default order без filename inference; упростить presets/labels/defaults и скрыть advanced silence controls; сделать download, optional Google Drive save и transcription handoff независимыми terminal actions; добавить прямой переход в Audio workspace с dashboard; сохранить regression coverage предыдущей UX/IA Goal.
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
- **Required Evidence:** `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ◐ | LIVE ❌`.
- **Known blockers/dependencies:** browser-local decoding зависит от поддерживаемых браузером codecs и device memory; production concat retest потребует owner-controlled source selection; approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`). Migration сейчас не ожидается.
- **Stop condition:** все Goal AC подтверждены required Evidence либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; после closure к следующей Goal без нового согласования не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-25T18:48:00Z.
- Session mode: authorized Goal implementation.
- Base branch/SHA: `main@97cd438616620b09fc74a25a61d7cd8a91a40ab7`, повторно verified equal to fetched `origin/main` 2026-08-25 перед branch write.
- Working branch: `codex/fix-audio-processing-runtime` from exact base.
- Last verified revision: `e65bd65d55218ce8758be737c14f15653b317bda` — long Audio processing выполняет один preview decode и один processing pass, нормализует input timestamps, сообщает FFmpeg progress, использует отдельный bounded output limit и пишет safe failure diagnostic.
- Working tree at Goal start: clean; unrelated pre-existing changes absent.
- Completed: PR `#237`–`#241` merged; current production/main baseline `97cd438616620b09fc74a25a61d7cd8a91a40ab7`. Owner LIVE подтвердил direct upload реальных OBS/MKV, dashboard Audio action и создание preview `137:36 → 129:48`. Production execution трёх MKV завершился failure на прежнем условном checkpoint `45%`; read-only Worker Status run `32883439861`, job `97918200968` подтвердил running/healthy worker без crash/restart.
- Current step: merge-ready PR `#242`; все required checks terminal SUCCESS для implementation/checkpoint head `0603afc52093e84cdec8a6a7225d70842be9ad69`.
- Next exact action: зафиксировать CI checkpoint, дождаться required checks metadata-only head и merge PR `#242`.
- Validation and Evidence: clean-process Audio backend `47/47` PASS; diagnostics `18/18` PASS; Studio Audio component `6/6` PASS; Studio ESLint PASS; TypeScript/Vite/PWA production build PASS; real local FFmpeg progress smoke PASS; Python compileall PASS; `git diff --check` PASS. Full Windows pytest был остановлен после CI time budget: ранние unrelated environment/fixture failures и медленные legacy tests не дали terminal result; authoritative full suite остаётся required CI gate. Product readiness не изменилась до production retest.
- Pull Request / CI / deployment: PR `#242`; CI run `32885462001` / job `checks` `97924737223` SUCCESS; Studio PWA CI run `32885461983`, jobs `studio` `97924737722` и `browser-e2e` `97924737464` SUCCESS. Единственный skip — failure-artifact upload после successful E2E, expected/non-gating. Изменение затрагивает Studio web, API и worker; schema migration не требуется. API/web могут идти standard CD, но worker rollout требует отдельного approved drain/deploy operation для exact merged SHA.
- Blockers: `AP-10` остаётся failed до exact-main API/worker/web deployment и bounded production concat LIVE; `PC-14` upload-progress ещё требует отдельного representative Transcriptions LIVE. Approved post-deploy metadata writer отсутствует.
- Unverified assumptions: прежний terminal failure наиболее вероятно вызван общим `512 MiB` output guard либо OBS timestamp/filter edge; старый runtime не сохранял точный Audio error event. Fix покрывает оба probable пути и добавляет будущий exact safe diagnostic, но root cause текущего исторического запуска остаётся `PROBABLE`, не `VERIFIED`.
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

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
- **Required Evidence:** `SPEC ✅ | CODE ✅ | TEST ✅ | CI — | DEPLOY — | LIVE ❌`.
- **Known blockers/dependencies:** browser-local decoding зависит от поддерживаемых браузером codecs и device memory; production concat retest потребует owner-controlled source selection; approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`). Migration сейчас не ожидается.
- **Stop condition:** все Goal AC подтверждены required Evidence либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; после closure к следующей Goal без нового согласования не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-25T14:58:51Z.
- Session mode: authorized Goal implementation.
- Base branch/SHA: `main@091e558ebe5c369486056f2ef94f67f99a459ee0`, verified equal to `origin/main` after fetch.
- Working branch: `codex/pwa-audio-workspace-02` from exact base.
- Last verified revision: `1af4574267ce92acaeb856867d956ed13cf426fa` — full Studio suite exercises the actual streaming upload transport; Audio workspace implementation is `8394e68`, upload-progress foundation `51f8e07`, OBS duration fix `616250c`.
- Working tree at Goal start: clean; unrelated pre-existing changes absent.
- Completed: production `failed · 5% · invalid_input` mapped to truthy ffprobe stream sentinel and fixed without relaxing duration bounds; shared streaming-fetch direct upload exposes real per-file/aggregate progress while preserving no-credentials/no-referrer/no-redirect and ambiguous completion reconciliation; Audio UI now separates browser-local vs Studio upload, defaults multi-inputs to separate results, provides explicit concat/order plan, uses user-facing defaults/advanced controls and independent terminal actions; browser-local Web Audio path applies bounded separate/concat/channel/silence processing and emits temporary WAV downloads.
- Current step: commit canonical spec/architecture/readiness reconciliation, then push and open the Goal PR.
- Next exact action: create the documentation/checkpoint commit, verify branch diff/ancestry, push and create one PR against `main`.
- Validation and Evidence: Studio Vitest `591/591`, ESLint PASS, TypeScript/build PASS (PWA precache generated; existing >500 kB chunk warning only); backend Audio `34/34`; `scripts/ci_checks.py` PASS. DB-backed API suite cannot run authoritatively in the local Windows environment without CI Postgres; its attempted local run produced environment setup errors, not product assertions, and remains a required GitHub CI gate.
- Pull Request / CI / deployment: not created; branch is local only.
- Blockers: none.
- Unverified assumptions: the observed production OBS files use the common `stream.duration=N/A`/valid container-duration shape; exact production retest remains required. Browser-local codec/memory bounds must be derived and exposed, not guessed.
- Preserved pre-existing changes: none.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Новые owner-authorized annotations декомпозированы в `PC-14` и `AP-17..AP-23`; branch CODE/TEST не считается production completion до delivery/LIVE.

| Product/epic | Current independent snapshot | Previous independent snapshot | Основание |
|---|---:|---:|---|
| **Project** | **93,8% (`135/144`)** | **99,3% (`135/136`)** | Выполненные AC не изменились; denominator вырос на восемь новых atomic AC. |
| **Google Colab** | **100% (`29/29`)** | **100% (`29/29`)** | Scope не затронут. |
| **Studio PWA** | **92,2% (`106/115`)** | **99,1% (`106/107`)** | `PC-14` и `AP-17..AP-23` добавлены в denominator; `AP-10` остаётся reopened до LIVE. |
| `PWA-CORE-01` | **92,9% (`13/14`)** | **100% (`13/13`)** | Новый `PC-14` требует delivery/LIVE upload-progress обоих экранов. |
| `PWA-AUDIO-PREPARATION-01` | **65,2% (`15/23`)** | **93,8% (`15/16`)** | Снижение более 10 п.п. вызвано не регрессией семи старых AC, а materialized denominator: семь новых Audio AC плюс уже reopened `AP-10`; branch имеет CODE/focused TEST, но production ещё прежний. |
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

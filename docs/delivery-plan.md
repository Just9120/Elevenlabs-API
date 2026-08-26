# Delivery plan

## Current Goal

- **ID / title:** `PWA-SOURCE-CACHE-01` — authoritative source-list refresh и согласованное product branding.
- **State:** `IN_PROGRESS` — авторизована текущей owner instruction «продолжай» после production browser findings 2026-08-26.
- **Authorization source:** текущие explicit user browser comments и последующая инструкция продолжить; durable product scope — `docs/project-spec.md`.
- **Scope:** убрать из Transcriptions stale sources после удаления через Settings/Storage; при возврате на уже смонтированный workspace выполнять bounded authoritative reload; не позволять optimistic recently-created cache повторно подмешивать source после успешного ответа API; сохранить composer draft и fail-closed source validation; после выбора владельцем нового имени согласованно обновить user-visible PWA brand в Sidebar, document title и web manifest.
- **Non-goals:** физическая проверка каждого R2 object через N+1 `HEAD`; автоматическое удаление metadata при transient storage error; repository/package/API/domain rename; S3 bucket split; изменение retention/cleanup semantics; migration; CI/CD safety contract.
- **Goal AC:**
  1. После удаления source в Settings возврат в `Транскрибации` перечитывает owner/project source collection и удалённый source отсутствует в picker без hard reload.
  2. Optimistic sources используются только до успешной authoritative collection; authoritative empty/changed response не дополняется stale cache.
  3. Навигационный refresh не сбрасывает подготовленный composer draft, а исчезнувший selected source остаётся fail-closed и не может создать job.
  4. User-visible brand согласован в Sidebar, HTML title и PWA manifest после explicit owner choice точного имени и subtitle.
  5. Focused frontend tests, lint/build, required exact-head CI, applicable web deployment и bounded production LIVE проходят.
- **Required Evidence:** `SPEC ✅ | CODE ✅ | TEST ✅ | CI — | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`). Backend/schema/worker changes сейчас не ожидаются.
- **Stop condition:** все Goal AC подтверждены required Evidence либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; после closure к следующей Goal без новой authorization не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-26T10:37:31Z.
- Session mode: authorized Goal implementation.
- Base branch/SHA: `main@018b560035e4ff2219c246f734216f76537875ee`, verified equal fetched `origin/main` перед branch write.
- Working branch: `codex/fix-source-cache-coherency`.
- Last verified revision: `bfcd1e9dd51e18852919ff84d6eeca5cb173016a` — source cache remediation и user-visible VoiceOps Studio branding.
- Working tree at Goal start: clean; unrelated pre-existing changes absent.
- Completed: предыдущая Goal reconciled/archive; source cache root cause подтверждён. `ProjectsPage` остаётся mounted после первого открытия, а Settings deletion меняет только Settings state. Добавлен authoritative reload при повторной активации; optimistic source снимается с local cache после первого подтверждения exact ID API и больше не воскресает после удаления. Canonical `VoiceOps Studio` и subtitle `Транскрибация и обработка аудио` применены к Sidebar, Dashboard, HTML title, Apple PWA title и manifest; repository/domain/runtime identities не менялись.
- Current step: local implementation scope завершён; branch готовится к push и Pull Request.
- Next exact action: push exact branch head, создать PR и дождаться terminal state required checks.
- Validation and Evidence: полный `App.test.tsx` + `sourceModel.test.ts` suite `236/236` PASS; targeted cache regression `12/12` PASS; branding/source smoke `5/5` PASS; manifest JSON parse PASS; Studio ESLint, TypeScript и Vite/PWA production build PASS с existing non-blocking chunk-size warning; repository lightweight `scripts/ci_checks.py` PASS; branch `git diff --check` PASS.
- Pull Request / CI / deployment: отсутствуют; migration N/A; expected deployment unit — Studio web only.
- Blockers: none for local implementation; CI/DEPLOY/LIVE ещё не запускались.
- Unverified assumptions: browser finding относится к source, удалённому через Settings API. Ручное удаление object напрямую из R2 не покрывается и требует отдельной reconciliation architecture.
- Preserved pre-existing changes: none.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Текущая cache-coherency remediation подтверждает existing product behavior, но не добавляет новый product denominator без отдельного durable scope decision.

| Product/epic | Current independent snapshot | Previous independent snapshot | Основание |
|---|---:|---:|---|
| **Project** | **100% (`145/145`)** | **98,6% (`143/145`)** | `PC-14` и `AP-24` закрыты exact-main delivery и bounded production LIVE предыдущей Goal. |
| **Google Colab** | **100% (`29/29`)** | **100% (`29/29`)** | Scope не затронут. |
| **Studio PWA** | **100% (`116/116`)** | **98,3% (`114/116`)** | Все current product AC выполнены; READY отдельных эпиков по-прежнему gate-ится их обязательным Evidence. |
| `PWA-CORE-01` | **100% (`14/14`)** | **92,9% (`13/14`)** | Direct upload progress подтверждён production LIVE на Audio и Transcriptions. |
| `PWA-AUDIO-PREPARATION-01` | **100% (`24/24`)** | **95,8% (`23/24`)** | Production FLAC подтвердил exact `s16`, исходные `48 kHz` и уменьшенный output. |
| Остальные existing epics | **100% (`78/78`)** | **100% (`78/78`)** | Completion и denominator не изменились. |

## Candidate next Goals

1. `PWA-STORAGE-ISOLATION-01` — разделить Audio Preparation references и transcription intake на разные lifecycle namespaces/buckets после architecture decision.
2. `PWA-OPTIONAL-TOTP-01` — добровольная TOTP 2FA, disabled by default.
3. `COMMERCIAL-EDITION-DISCOVERY-01` — отдельный российский production contour и legal/data-residency/provider discovery.

## Risks и boundaries

- API collection остаётся authority для active source picker; transient reload failure не должен молча удалять last-known metadata или разрешать mutation по неподтверждённому state.
- Ручное удаление object напрямую в R2 обходит application lifecycle и не определяется текущим list endpoint; per-object `HEAD` в hot path не добавляется без отдельной architecture/performance оценки.
- Переименование user-visible brand не означает автоматический rename repository, packages, routes, domain, Compose project или persistent identities.

## Sources of truth

- Repository instructions: `AGENTS.md`.
- Product scope/AC: `docs/project-spec.md`.
- Current Goal/checkpoint/readiness: этот документ.
- CI/CD safety: `docs/ci-cd-rules.md`.
- Actual architecture: `docs/architecture.md`.
- Historical evidence: `docs/delivery-plan-archive.md`.

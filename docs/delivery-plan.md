# Delivery plan

## Current Goal

- **ID / title:** `PWA-SOURCE-CACHE-01` — authoritative source-list refresh и согласованное product branding.
- **State:** `PENDING_EXTERNAL_GATE` — implementation merged и deployed; required authenticated production LIVE недоступен в текущем audit context.
- **Authorization source:** текущие explicit user browser comments и последующая инструкция продолжить; durable product scope — `docs/project-spec.md`.
- **Scope:** убрать из Transcriptions stale sources после удаления через Settings/Storage; при возврате на уже смонтированный workspace выполнять bounded authoritative reload; не позволять optimistic recently-created cache повторно подмешивать source после успешного ответа API; сохранить composer draft и fail-closed source validation; после выбора владельцем нового имени согласованно обновить user-visible PWA brand в Sidebar, document title и web manifest.
- **Non-goals:** физическая проверка каждого R2 object через N+1 `HEAD`; автоматическое удаление metadata при transient storage error; repository/package/API/domain rename; S3 bucket split; изменение retention/cleanup semantics; migration; CI/CD safety contract.
- **Goal AC:**
  1. После удаления source в Settings возврат в `Транскрибации` перечитывает owner/project source collection и удалённый source отсутствует в picker без hard reload.
  2. Optimistic sources используются только до успешной authoritative collection; authoritative empty/changed response не дополняется stale cache.
  3. Навигационный refresh не сбрасывает подготовленный composer draft, а исчезнувший selected source остаётся fail-closed и не может создать job.
  4. User-visible brand согласован в Sidebar, HTML title и PWA manifest после explicit owner choice точного имени и subtitle.
  5. Focused frontend tests, lint/build, required exact-head CI, applicable web deployment и bounded production LIVE проходят.
- **Required Evidence:** `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE —`.
- **Known blockers/dependencies:** required authenticated production source-delete/navigation LIVE требует owner-controlled session; approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`). Backend/schema/worker changes не требовались.
- **Stop condition:** все Goal AC подтверждены required Evidence либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; после closure к следующей Goal без новой authorization не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-27T15:37:08Z.
- Session mode: evidence-based audit/recovery; новая implementation Goal не авторизована.
- Base branch/SHA: local clean `main@18cbd46e9361a66bfbc1f2265d0820aa72aedf50`; public GitHub `main` history показывает ту же latest revision. `git fetch` не выполнен из sandbox (`FETCH_HEAD` permission), `gh` authentication invalid (401).
- Working branch: `codex/repository-audit-2026-08-27`, создана от verified local/public main только для audit metadata.
- Last verified revision: `18cbd46e9361a66bfbc1f2265d0820aa72aedf50` — merge PR `#244`.
- Working tree at audit start: clean; unrelated pre-existing changes absent.
- Completed: PR `#244` merged; source-cache remediation и VoiceOps Studio branding находятся в main. Exact-main repository CI `32959921859` и Studio/browser CI `32959921773` success. Studio Platform CD `32959921827` success, web deployed; API/worker/migration skipped. Public root и `/api/healthz` доступны; production manifest MIME defect зафиксирован отдельным audit finding.
- Current step: Goal implementation/delivery recovery завершён до external LIVE gate; Goal переведена в `PENDING_EXTERNAL_GATE`.
- Next exact action: выполнить owner-controlled authenticated production canary без provider call: удалить test source через Settings, вернуться в уже смонтированные `Транскрибации`, подтвердить authoritative empty/changed list, сохранность composer draft и fail-closed selected source.
- Validation and Evidence: branch до merge — полный frontend cache suite, lint/build и focused tests PASS по checkpoint; exact-main required CI runs success. В текущем аудите `scripts/ci_checks.py` PASS, public health/header checks PASS кроме manifest MIME, `git diff --check` выполняется перед handoff. Full local pytest/npm validation не повторена из-за отсутствующих local dependencies/OneDrive npm environment; это покрыто exact-main CI.
- Pull Request / CI / deployment: PR `#244` — `https://github.com/Just9120/Elevenlabs-API/pull/244`, merge `18cbd46`; repository CI `32959921859`, Studio/browser CI `32959921773`, Studio Platform CD `32959921827`, all success. Web deploy ✅; API/worker/migration N/A для Goal.
- Blockers: authenticated production LIVE недоступен; post-deploy metadata writer отсутствует. GitHub settings/push operations недоступны до восстановления `gh` credential.
- Unverified assumptions: actual production DB role/schema/component image identities; browser finding относится к source, удалённому через Settings API. Ручное удаление object напрямую из R2 не покрывается и требует отдельной reconciliation architecture.
- Preserved pre-existing changes: none.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Текущая cache-coherency remediation подтверждает existing product behavior, но не добавляет новый product denominator без отдельного durable scope decision.

| Product/epic | Current independent snapshot | Previous independent snapshot | Основание |
|---|---:|---:|---|
| **Project** | **100% (`145/145`)** | **100% (`145/145`)** | Независимый audit подтвердил прежний AC numerator; изменение `0 pp`. Evidence gates отдельных эпиков учитываются отдельно. |
| **Google Colab** | **100% (`29/29`)** | **100% (`29/29`)** | Scope не затронут. |
| **Studio PWA** | **100% (`116/116`)** | **100% (`116/116`)** | 9/11 PWA epics READY; UX LIVE `—`, Manifest LIVE `◐`. |
| `PWA-TRANSCRIPTIONS-UX-01` | **100% (`4/4`)** | **100% (`4/4`)** | DEPLOY теперь ✅ после PR `#244`; authenticated LIVE остаётся `—`. |
| `PWA-MANIFEST-01` | **100% (`6/6`)** | **100% (`6/6`)** | Representative folder import/clear mutation LIVE остаётся `◐`. |
| Остальные existing epics | **100% (`135/135`)** | **100% (`135/135`)** | AC completion не изменился; current audit не отменяет ранее зафиксированные required Evidence. |

## Candidate next Goals

1. `PWA-MANIFEST-MIME-01` — standards-compliant `.webmanifest` response после closure текущей Goal; proposed, implementation не авторизована.
2. `CI-CD-HARDENING-01` — immutable action SHAs и exact deployed revision contract; требует explicit CI/CD policy task.
3. `PWA-STORAGE-ISOLATION-01` — разделить Audio Preparation references и transcription intake на разные lifecycle namespaces/buckets после architecture decision.
4. `PWA-OPTIONAL-TOTP-01` — добровольная TOTP 2FA, disabled by default; atomic AC ещё не определены.
5. `COMMERCIAL-EDITION-DISCOVERY-01` — отдельный российский production contour и legal/data-residency/provider discovery.

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

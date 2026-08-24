# Delivery plan

## Current Goal

- **ID / title:** `PWA-REALTIME-STABILITY-READINESS-01` — representative Studio PWA realtime stability и PWA Evidence reconciliation.
- **State:** `IN_PROGRESS` — Goal авторизована, clean working branch создана; выполняется targeted audit текущего realtime contour.
- **Authorization source:** explicit owner instruction 2026-08-24: `да, делаем 1 и 3 пункты, формируй цель` после выбора realtime stability и readiness hardening без speaker identity.
- **Scope:** независимо reconcile фактическое закрытие timestamp Goal; определить и выполнить representative Windows/Chrome production matrix для display/tab audio, microphone и mixed capture; проверить повторные start/stop и bounded draft recovery; диагностировать и исправить только воспроизводимые capture/session/recovery defects; сохранить owner/privacy/security boundaries; добавить relevant frontend/backend/regression tests; независимо перепроверить operational status/Evidence полностью выполненных по product AC эпиков `PWA-CORE-01`, `PWA-MANIFEST-01`, `PWA-BATCH-01`, `PWA-STANDARDIZATION-01`, `PWA-OPERABILITY-01`; выполнить atomic commits и полный PR → CI → merge → applicable deployment → bounded LIVE flow.
- **Non-goals:** `PWA-SPEAKER-IDENTITY-01`; Colab; новые product AC или denominator; biometric matching/voiceprints; новые OAuth scopes; credential/deployment topology changes; unrelated UI, batch/provider или architecture changes.
- **Goal AC:**
  1. Previous timestamp Goal reconciled по exact PR/CI/deployment/LIVE Evidence без изменения product scope.
  2. Realtime source/test/runtime audit определяет фактические start/stop, capture ownership, WebSocket и draft-recovery boundaries; гипотезы не выдаются за defects.
  3. Representative matrix явно покрывает display/tab audio, microphone и mixed capture, повторные start/stop и refresh/crash recovery; каждый case имеет safe pass/fail/not-run Evidence.
  4. Каждый воспроизводимый in-scope capture/session/recovery defect исправлен с regression test; неподтверждённые или external-browser gaps остаются явными.
  5. Stop/error/retry не оставляют owned media tracks, AudioContext/WebSocket или stale session state; поздние async results не оживляют остановленную session.
  6. Live draft recovery сохраняет committed/partial semantics, monotonic owner-scoped server revision, TTL/encryption/no-store и не раскрывает transcript/audio/provider payloads в diagnostics, logs, history или Evidence.
  7. Status/Evidence пяти полностью реализованных PWA-эпиков повышаются только по independently verified code/test/CI/deployment/LIVE records; readiness denominator остаётся `120`.
  8. Relevant local tests/full validation и exact-head required CI проходят; applicable exact-revision deployment и bounded production LIVE подтверждают `PR-06` либо фиксируют конкретный внешний gate.
- **Required Evidence:** `SPEC ✅ | CODE ✅ | TEST ✅ | CI — | DEPLOY — | LIVE ◐`.
- **Known blockers/dependencies:** финальная representative matrix требует owner-controlled Windows/Chrome permission prompts и выбора реальных capture surfaces; этот внешний gate будет запрошен только после source/test/deployment readiness. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`), поэтому фактический post-deploy state фиксируется GitHub Evidence/final report и reconciled в следующей authorized Goal без docs-only follow-up PR. Diagnostics build identifiers сейчас безопасно показываются как `не настроено`: config defaults существуют, но independent component deploy не передаёт достоверные web/API/worker revisions; исправление требует отдельного field-scoped delivery-metadata design и не входит в эту Goal.
- **Stop condition:** все Goal AC и required Evidence подтверждены либо flow достиг `BLOCKED` / `PENDING_EXTERNAL_GATE`; затем остановиться и не переходить к следующей Goal без explicit authorization.

## Active execution checkpoint

- Updated (UTC): 2026-08-24T08:16:17Z
- Session mode: authorized Goal implementation
- Base branch: `main`
- Base SHA: `b214a160999ae3ac953f2b57d472fe886a66fa4e`
- Working branch: `codex/pwa-realtime-source-ducking`
- Last verified revision: `42e76e1be86f56d1d91e2c35c262715d1cd3efa6` (per-source meters, microphone-triggered ducking, UI guidance, regression coverage and architecture update validated locally).
- Working tree at branch start: clean `main`; `HEAD = origin/main`; divergence `0/0`; открытых PR не было; unrelated pre-existing changes отсутствовали.
- Completed: PR #229 merged as `main@b214a160`; exact-main CI `32696791719`, Studio/browser CI `32696791700` and web deployment `32696791720` passed; API, migration and worker correctly skipped. Static voice-priority gain staging is deployed. Post-deploy Chrome canary on laptop speakers still reproduced microphone speech not being recognized while display playback continued; both sources work separately. Headphones are unavailable, so the owner explicitly authorized continued software diagnosis instead of stopping at that external gate. Commit `42e76e1` inserts non-persistent analysers into each real mixed-source path, exposes separate UI meters, ducks display gain `0.35 → 0.08` on microphone activity with hysteresis recovery and clears all levels/monitor ownership during cleanup.
- Current step: PR #230 открыт; required checks выполняются для опубликованной source-ducking ветки.
- Next exact action: дождаться terminal state `checks`, `studio` и `browser-e2e`, разобрать failures/skips и при green gates выполнить merge.
- Validation and Evidence: focused realtime/UI `46/46` PASS; full Studio `562/562` PASS; full ESLint PASS; TypeScript project build PASS; exact-worktree production PWA build PASS; `git diff --check` PASS. Product numerator remains unchanged until required CI/deploy and a successful representative mixed LIVE canary.
- Pull Request: #230 — `https://github.com/Just9120/Elevenlabs-API/pull/230`; base `b214a160`, initial published head `e783ec8`.
- CI/checks: `checks`, `studio` и `browser-e2e` запущены; terminal state ещё не подтверждён.
- Deployment/environment: web deployment `32696791720` succeeded for `b214a160`; migration class for the planned browser-only diff is expected `NONE`.
- Blockers: none for implementation. Headphones remain unavailable, but the new same-device canary will expose whether microphone samples reach the browser graph during playback.
- Unverified assumptions: microphone-triggered ducking can reduce provider masking only when Chrome supplies non-zero microphone samples; a zero microphone source meter during playback would instead confirm browser/AEC or device-level suppression. Full-AC epics may still lack required LIVE breadth despite historical deployment records.
- Preserved pre-existing changes: none.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Новый независимый snapshot не добавляет AC: timestamp closure подтверждает delivery gates для уже посчитанных `PB-10`/`PD-06`, а `PR-06` остаётся невыполненным до representative LIVE matrix. Denominator не изменился.

| Product/epic | Current | Previous independent snapshot | Readiness/Evidence |
|---|---:|---:|---|
| **Project** | **89,2% (`107/120`)** | **87,5% (`105/120`)** | Numerator без изменения на старте Goal; previous snapshot предшествовал закрытию `PB-10`/`PD-06`. |
| **Google Colab** | **75,9% (`22/29`)** | **75,9% (`22/29`)** | Вне Goal. |
| `COLAB-BATCH-01` | **73,9% (`17/23`)** | **73,9% (`17/23`)** | 🟦 IN PROGRESS; вне Goal. |
| `COLAB-REALTIME-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; вне Goal. |
| **Studio PWA** | **93,4% (`85/91`)** | **91,2% (`83/91`)** | `PB-10`/`PD-06` delivery Evidence reconciled; `PR-06` остаётся open. |
| `PWA-CORE-01` | **100% (`13/13`)** | **100% (`13/13`)** | 🟦 IN PROGRESS; `SPEC/CODE/TEST/CI/DEPLOY ✅`, `LIVE ◐` из-за неполного retention expiry/cleanup breadth. |
| `PWA-TRANSCRIPTIONS-UX-01` | **100% (`4/4`)** | **100% (`4/4`)** | 🟩 READY. |
| `PWA-INGEST-01` | **100% (`11/11`)** | **100% (`11/11`)** | 🟩 READY. |
| `PWA-SEGMENTS-01` | **100% (`5/5`)** | **100% (`5/5`)** | 🟩 READY. |
| `PWA-BATCH-01` | **100% (`10/10`)** | **90,0% (`9/10`)** | 🟩 READY; timestamp Goal confirmed exact CI/DEPLOY/LIVE. |
| `PWA-SPEAKER-IDENTITY-01` | **0% (`0/5`)** | **0% (`0/5`)** | Explicitly deferred; вне Goal. |
| `PWA-MANIFEST-01` | **100% (`6/6`)** | **100% (`6/6`)** | 🟦 IN PROGRESS; `SPEC/CODE/TEST/CI/DEPLOY ✅`, `LIVE ◐`: controls/catalog path наблюдались, bounded import/clear mutation не запускалась. |
| `PWA-STANDARDIZATION-01` | **100% (`6/6`)** | **83,3% (`5/6`)** | 🟩 READY; timestamp Goal confirmed authoritative/idempotent LIVE path. |
| `PWA-REALTIME-01` | **92,3% (`12/13`)** | **92,3% (`12/13`)** | 🟦 IN PROGRESS; `PR-06` — primary product target этой Goal. |
| `PWA-OPERABILITY-01` | **100% (`18/18`)** | **100% (`18/18`)** | 🟩 READY; exact CI/deploy и production diagnostics/analytics/history Evidence независимо подтверждены. |

## Candidate next Goals

Эти items — proposals и не авторизуют implementation:

1. `COLAB-BATCH-PARITY-01` — шесть оставшихся batch gaps после PWA priority scope.
2. `COLAB-REALTIME-STABILITY-01` — representative capture stability после PWA priority scope.
3. `PWA-SPEAKER-IDENTITY-01` — owner explicitly deferred; names/roles и manual listen-and-assign требуют отдельного решения.

## Risks и boundaries

- Transcript body — sensitive content. Browser/server draft endpoints обязаны быть owner-scoped, `no-store`, encrypted at rest и исключены из diagnostics/audit payloads.
- Browser checkpoint не полагается на `beforeunload`; committed fragment сохраняется до UI acknowledgement, partial — bounded debounce.
- Server revision monotonically increases; stale/same-revision-conflicting writes fail closed и не перезаписывают newer text.
- Browser capture permission и surface selection остаются user gesture; automated tests не заменяют owner-controlled Chrome/Windows matrix.
- Internal-browser result не переносится автоматически на обычный Chrome и не закрывает `PR-06`.
- Diagnostics корректно не придумывает component build IDs, но отсутствие trustworthy independent web/API/worker revision wiring остаётся operational debt; подстановка одного repository `HEAD` для всех компонентов дала бы ложное Evidence.
- Ordinary component CD не применяет migration; worker lifecycle и stateful release остаются отдельными gates.
- Approved post-deploy metadata writer отсутствует; фактический state фиксируется в final report/GitHub records и reconciled в следующем authorized scope без docs-only follow-up PR.

## Sources of truth

- Repository instructions и Goal process: `AGENTS.md`.
- Product scope/AC: `docs/project-spec.md`.
- Current Goal/checkpoint/readiness: этот документ.
- CI/CD и production safety: `docs/ci-cd-rules.md`.
- Actual architecture: `docs/architecture.md`.
- Detailed PWA processing: `docs/studio-processing-contract.md`.
- Historical evidence: `docs/delivery-plan-archive.md` только при reconciliation.

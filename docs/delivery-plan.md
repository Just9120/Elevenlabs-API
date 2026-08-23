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
- **Required Evidence:** `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** финальная representative matrix требует owner-controlled Windows/Chrome permission prompts и выбора реальных capture surfaces; этот внешний gate будет запрошен только после source/test/deployment readiness. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`), поэтому фактический post-deploy state фиксируется GitHub Evidence/final report и reconciled в следующей authorized Goal без docs-only follow-up PR.
- **Stop condition:** все Goal AC и required Evidence подтверждены либо flow достиг `BLOCKED` / `PENDING_EXTERNAL_GATE`; затем остановиться и не переходить к следующей Goal без explicit authorization.

## Active execution checkpoint

- Updated (UTC): 2026-08-23T21:20:31Z
- Session mode: authorized Goal implementation
- Base branch: `main`
- Base SHA: `800bcc820529ff3c78214c129c593d182c621c62`
- Working branch: `codex/pwa-realtime-stability-readiness`
- Last verified revision: `800bcc820529ff3c78214c129c593d182c621c62` (clean synchronized Goal base).
- Working tree at branch start: clean `main`; `HEAD = origin/main`; divergence `0/0`; открытых PR не было; unrelated pre-existing changes отсутствовали.
- Completed: previous Goal closure recovered from PR #227, exact-main CI/CD and bounded LIVE; local/remote baseline verified; working branch created; repository instructions, CI/CD profile, current product AC and validation runbook read.
- Current step: trace Studio realtime capture/session/draft architecture and run focused baseline tests before deciding whether code changes are required.
- Next exact action: inspect `LiveTranscriptionPanel`, realtime session/protocol/draft modules and their tests for lifecycle races, cleanup gaps and matrix coverage, then execute the focused existing suites.
- Validation and Evidence: previous timestamp closure independently verified and archived. Current Goal implementation tests not run yet.
- Pull Request: none.
- CI/checks: not started.
- Deployment/environment: not started; migration class currently expected `NONE`, subject to actual diff; no production operation authorized before required gates.
- Blockers: none for source/test audit. Final Chrome/Windows LIVE requires owner interaction.
- Unverified assumptions: current source may already satisfy some matrix cases; internal-browser success does not prove representative Chrome/Windows stability; full-AC epics may still lack required LIVE breadth despite historical deployment records.
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
| `PWA-CORE-01` | **100% (`13/13`)** | **100% (`13/13`)** | Operational Evidence audit в этой Goal; READY пока не переутверждён. |
| `PWA-TRANSCRIPTIONS-UX-01` | **100% (`4/4`)** | **100% (`4/4`)** | 🟩 READY. |
| `PWA-INGEST-01` | **100% (`11/11`)** | **100% (`11/11`)** | 🟩 READY. |
| `PWA-SEGMENTS-01` | **100% (`5/5`)** | **100% (`5/5`)** | 🟩 READY. |
| `PWA-BATCH-01` | **100% (`10/10`)** | **90,0% (`9/10`)** | 🟩 READY; timestamp Goal confirmed exact CI/DEPLOY/LIVE. |
| `PWA-SPEAKER-IDENTITY-01` | **0% (`0/5`)** | **0% (`0/5`)** | Explicitly deferred; вне Goal. |
| `PWA-MANIFEST-01` | **100% (`6/6`)** | **100% (`6/6`)** | Operational Evidence audit в этой Goal; READY пока не переутверждён. |
| `PWA-STANDARDIZATION-01` | **100% (`6/6`)** | **83,3% (`5/6`)** | 🟩 READY; timestamp Goal confirmed authoritative/idempotent LIVE path. |
| `PWA-REALTIME-01` | **92,3% (`12/13`)** | **92,3% (`12/13`)** | 🟦 IN PROGRESS; `PR-06` — primary product target этой Goal. |
| `PWA-OPERABILITY-01` | **100% (`18/18`)** | **100% (`18/18`)** | Operational Evidence audit в этой Goal; READY пока не переутверждён. |

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

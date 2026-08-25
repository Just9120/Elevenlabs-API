# Delivery plan

## Current Goal

- **ID / title:** `PWA-UX-IA-POLISH-01` — task-centric UX и information architecture personal Studio PWA.
- **State:** `IN_PROGRESS` — scope явно авторизован владельцем 2026-08-25 после серии browser-аннотаций.
- **Authorization source:** explicit current user instruction «формируй цель и приступай»; durable product scope и denominator — `docs/project-spec.md`.
- **Scope:** унифицировать terminal actions Audio Preparation; сделать fragmentation явно optional и скрытой по умолчанию; заменить row-centric terminology на task-centric; убрать постоянно отображаемый общий source catalog из рабочих экранов и перенести управление local files/retention в Settings; перестроить Settings на разделы Account, Connections, Files & Storage, Appearance и Diagnostics; упростить основной Diagnostics flow вокруг безопасного diagnostic bundle с advanced technical filters; улучшить Audio Preparation source selection и явный переход результата в transcription flow.
- **Non-goals:** изменение S3 bucket topology или object migration; client-local FFmpeg/WASM processing; commercial/Russian edition; provider, OAuth, legal или billing scope; TOTP; изменение durable product requirements/AC; CI/CD safety contract или deployment topology.
- **Goal AC:**
  1. `Скачать результат` в Audio Preparation выглядит как штатный action control, сохраняя корректную link/download semantics.
  2. Fragmentation по умолчанию выключена; whole-file task не показывает segment editor; explicit toggle раскрывает editor, а collapse не теряет введённый plan.
  3. Composer использует task-centric terminology: `Добавить задачу`, `Задача N`, task count и task validation messages; file/folder/multi-source semantics не искажаются.
  4. Settings имеют понятные responsive sections: `Аккаунт`, `Подключения`, `Файлы и хранилище`, `Оформление`, `Диагностика`, без horizontal overflow.
  5. Owner local-source catalog, retention и cleanup управляются в `Файлы и хранилище`; устаревший общий block `Файлы проекта` удалён из Transcriptions; task-scoped source selection сохранён.
  6. Основной Diagnostics flow формирует sanitized diagnostic bundle по периоду, описанию проблемы, optional operation/task reference и формату; component/level/event code/raw identifiers спрятаны в advanced filters; существующие redaction и safe export не ослаблены.
  7. Audio Preparation не показывает полный source catalog автоматически: saved sources открываются explicit action; completed output можно скачать, сделать новым source и передать точный owned source в Transcriptions.
  8. Relevant unit/integration/browser tests, required CI, applicable deployment и bounded LIVE validation проходят на exact revision.
- **Required Evidence:** `SPEC ✅ | CODE ✅ | TEST ◐ | CI — | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`); migration не ожидается, deployment units определяются фактическим diff; authenticated LIVE session потребуется после merge.
- **Stop condition:** Goal AC подтверждены required Evidence либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; после closure к следующей Goal без нового согласования не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-25T09:15:29Z.
- Session mode: authorized Goal implementation.
- Base branch/SHA: `main@16badb0aa4404ae2616a3d46070925b54b043963`, verified equal to `origin/main` after fetch.
- Working branch: `codex/pwa-ux-ia-polish`, tracking `origin/main` from exact base.
- Last verified revision: `4a54cac` — complete UX/IA implementation covered by focused backend tests, full frontend unit suite, lint, typecheck/build and lightweight repository checks.
- Working tree at Goal start: clean; unrelated pre-existing changes absent.
- Completed: task-centric composer terminology; default-closed fragmentation disclosure with state preservation; five URL-backed Settings sections; reusable Source catalog moved to Files & Storage and lazy-loaded; source deletion stale-reload race removed; one diagnostic-bundle flow with bounded untrusted problem context and advanced filters; Audio saved-source disclosure, consistent terminal actions and exact owned Source handoff into Transcriptions; visible source-load retry restored in composer.
- Current step: commit the final source-status expectation alignment, push the complete Goal branch and open one Pull Request.
- Next exact action: create a narrow validation-alignment commit, then verify origin divergence and push `codex/pwa-ux-ia-polish`.
- Validation and Evidence: backend diagnostic suites `20/20` passed; full Studio Vitest `579/579` passed; full Studio ESLint passed; TypeScript/Vite production build passed; `scripts/ci_checks.py` passed. A local full pytest attempt was not CI-equivalent because the workflow's PostgreSQL 17, Redis and protected secret fixtures were absent; it produced broad environment/setup failures and was stopped after exceeding the CI test command's 180-second budget. Authoritative full backend and browser-e2e results remain required from GitHub CI.
- Pull Request / CI / deployment: PR not created; CI/deployment not started.
- Blockers: none.
- Unverified assumptions: production visual behavior at desktop/mobile widths and authenticated exact-source handoff require post-deploy bounded LIVE validation.
- Preserved pre-existing changes: none.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Эта Goal улучшает UX существующих completed AC и не меняет canonical denominator; проценты не повышаются выше `100%`, а delivery gates новой Goal учитываются отдельно.

| Product/epic | Current | Previous independent snapshot | Readiness/Evidence |
|---|---:|---:|---|
| **Project** | **100% (`136/136`)** | **100% (`136/136`)** | Canonical AC выполнены; новая polishing Goal открыла собственные CODE/TEST/CI/DEPLOY/LIVE gates без изменения product denominator. |
| **Google Colab** | **100% (`29/29`)** | **100% (`29/29`)** | Batch `23/23`, realtime `6/6`; scope не затронут. |
| **Studio PWA** | **100% (`107/107`)** | **100% (`107/107`)** | Product AC не изменились; UX Goal `IN_PROGRESS`. |
| `PWA-AUDIO-PREPARATION-01` | **100% (`16/16`)** | **100% (`16/16`)** | 🟩 READY; PRs #234–#235 и bounded LIVE reconciled в archive. |
| Остальные existing epics | **100% (`120/120`)** | **100% (`120/120`)** | Completion и denominator не изменились. |

## Candidate next Goals

1. `PWA-STORAGE-ISOLATION-01` — разделить reference objects Audio Preparation и transcription intake на разные lifecycle namespaces/buckets только после отдельного architecture decision.
2. `PWA-LOCAL-AUDIO-PREPARATION-01` — optional browser-local FFmpeg/WASM path без server upload; upstream idea, ещё не canonical requirement.
3. `PWA-OPTIONAL-TOTP-01` — добровольная TOTP 2FA, disabled by default.
4. `COMMERCIAL-EDITION-DISCOVERY-01` — отдельный российский production contour, data residency/legal/provider constraints; discovery, не implementation.

## Risks и boundaries

- Перемещение UI не должно менять owner isolation, retention, cleanup semantics или storage keys.
- Diagnostic bundle не включает secrets, token values, private storage paths или unrestricted payloads; problem description является user-entered context, а не trusted runtime evidence.
- Fragmentation off должна сохранять canonical whole-file payload; UI collapse не должен незаметно менять plan.
- Передача Audio Preparation output в Transcriptions должна ссылаться на exact owned reusable source, не дублировать upload и не обходить source validation.
- Migration и privileged production operation не планируются; если фактический diff потребует их, нужна отдельная action-time authorization согласно safety contract.

## Sources of truth

- Repository instructions: `AGENTS.md`.
- Product scope/AC: `docs/project-spec.md`.
- Current Goal/checkpoint/readiness: этот документ.
- CI/CD safety: `docs/ci-cd-rules.md`.
- Actual architecture: `docs/architecture.md`.
- Historical evidence: `docs/delivery-plan-archive.md` только для reconciliation.

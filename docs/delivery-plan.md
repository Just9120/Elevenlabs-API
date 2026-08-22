# Delivery plan

## Current Goal

- **ID / title:** `PWA-TRANSCRIPTIONS-UX-AND-LIVE-RECOVERY-01` — Transcriptions-first UX, recoverable Live drafts и bounded UX/UI remediation.
- **State:** `IN_PROGRESS`.
- **Authorization source:** owner decision в текущей task: Projects не являются основной пользовательской сущностью; обычная и Live-транскрибации должны быть primary flow; Live text должен временно восстанавливаться после refresh/crash/restart; затем explicit instruction `формируй цель по найденным гэпам и данному вопросу`.
- **Scope:** заменить user-facing Projects flow на `Транскрибации` с ordinary/Live tabs и history surfaces; удалить ручные create/edit/archive Project controls, сохранив safe internal ownership boundary и legacy active data; реализовать IndexedDB + encrypted owner-scoped server Live drafts с 72-hour TTL и restore/download/delete UX; исправить verified narrow Diagnostics overflow, dark-theme contrast, dialog keyboard/focus behavior, heading/touch/tab accessibility, maintenance-access diagnosis и unsupported-provider explanation; добавить migration, API/UI contracts, tests и полный delivery flow.
- **Non-goals:** local/Drive source-folder intake; speaker identity; source creation timestamps; новые STT providers; automatic realtime reconnect; audio/session recording; subtitle exports; другие upstream proposals; automatic unarchive или privileged recovery production data.
- **Goal AC:**
  1. Primary navigation/page semantics используют `Транскрибации`; ручные create/edit/archive Project отсутствуют.
  2. Ordinary и Live доступны отдельными tabs без ручного выбора технического Project; один batch представлен как одна multi-transcription с item-level progress/results.
  3. Existing active legacy workspaces, sources, jobs и outputs остаются доступны; archived state не изменяется автоматически.
  4. Committed Live fragments checkpoint-ятся local immediately; latest partial checkpoint-ится с bounded debounce и маркируется unconfirmed.
  5. Server draft owner/project scoped, encrypted at rest, size-bounded, monotonic-revision idempotent и возвращается только authenticated owner через `no-store`.
  6. Reload/crash/restart показывает recovery prompt; draft можно restore, скачать `.txt` или удалить.
  7. Draft TTL равен 72 часам; expired drafts логически недоступны и физически удаляются idempotent cleanup.
  8. Audio и transcript body не попадают в logs, diagnostics, audit events, ordinary History/Analytics или Google Docs без отдельного user action.
  9. Narrow Diagnostics не создаёт document-level overflow; supported theme/accent primary controls имеют WCAG AA contrast.
  10. Modal confirmation имеет initial focus, focus trap, Escape, focus return; heading hierarchy, touch targets и mobile tab affordance исправлены.
  11. Maintenance access показывает точную safe blocker category; OpenAI key storage ясно помечено как недоступное для current transcription execution.
  12. Existing batch/realtime behavior не регрессирует; relevant backend/frontend/security/responsive/accessibility tests проходят.
  13. Exact-head CI, applicable MANUAL_GATED migration/API/web/worker deployment и bounded LIVE recovery validation успешны.
- **Required Evidence:** `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** additive migration `0023` потребует отдельного protected Environment approval после merge; production archived project `Транскрибации` не может быть восстановлен этой Goal без отдельной exact-data authorization; approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** все Goal AC и required Evidence подтверждены либо flow достиг `BLOCKED` / `PENDING_EXTERNAL_GATE`; затем остановиться и не переходить к следующей Goal без explicit authorization.

## Active execution checkpoint

- Updated (UTC): 2026-08-22T14:40:00Z
- Session mode: new authorized Goal
- Base branch: `main`
- Base SHA: `dd194c929d957e822ff618df294dc54e72d5971e`
- Working branch: `codex/pwa-transcriptions-live-recovery-01`
- Last verified revision: `dd194c929d957e822ff618df294dc54e72d5971e`
- Working tree at branch start: tracked clean; preserved unrelated untracked `.pnpm-store/`, `apps/studio/pnpm-lock.yaml`, `apps/studio/pnpm-workspace.yaml`
- Completed: Git/GitHub recovery, exact base verification, Current Goal/product AC reconciliation and implementation design boundary.
- Current step: implement additive Live draft persistence model/service/API and focused backend tests.
- Next exact action: add migration `0023_realtime_transcript_drafts`, encrypted owner-scoped service/routes and schema/security tests.
- Validation and Evidence: UX/runtime audit demoted `PC-01`; no branch validation yet.
- Pull Request: not created.
- CI/checks: not started.
- Deployment/environment: not started; migration class `MANUAL_GATED`.
- Blockers: no implementation blocker; production recovery remains separately unauthorized.
- Unverified assumptions: 72-hour draft TTL and existing credential master key boundary are compatible with production operational policy; exact deployment requires post-merge verification.
- Preserved pre-existing changes: three untracked pnpm artifacts listed above remain outside scope/commits.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Goal expansion добавила `PT-01..04` и `PR-07..13`; production audit повторно открыл `PC-01`, а approved product-model replacement — `PC-03`. Поэтому PWA denominator изменился `80 → 91`, project denominator `109 → 120`, а numerator `69 → 67`.

| Product/epic | Current | Previous independent snapshot | Readiness/Evidence |
|---|---:|---:|---|
| **Project** | **74,2% (`89/120`)** | **82,6% (`90/109`)** | Denominator расширен на 11 AC и два прежних AC повторно открыты. |
| **Google Colab** | **75,9% (`22/29`)** | **75,9% (`22/29`)** | Без изменений в PWA Goal. |
| `COLAB-BATCH-01` | **73,9% (`17/23`)** | **73,9% (`17/23`)** | 🟦 IN PROGRESS. |
| `COLAB-REALTIME-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS. |
| **Studio PWA** | **73,6% (`67/91`)** | **85,0% (`68/80`)** | Снижение на 11,4 п.п.: scope expansion и replacement `Projects → Transcriptions`. |
| `PWA-CORE-01` | **84,6% (`11/13`)** | **92,3% (`12/13`)** | `PC-01` открыт по 390px runtime overflow; `PC-03` — по approved navigation replacement. |
| `PWA-TRANSCRIPTIONS-UX-01` | **0% (`0/4`)** | N/A | Новый owner-authorized epic. |
| `PWA-INGEST-01` | **72,7% (`8/11`)** | **72,7% (`8/11`)** | Вне Goal. |
| `PWA-SEGMENTS-01` | **100% (`5/5`)** | **100% (`5/5`)** | 🟩 READY. |
| `PWA-BATCH-01` | **90,0% (`9/10`)** | **90,0% (`9/10`)** | Вне Goal. |
| `PWA-SPEAKER-IDENTITY-01` | **0% (`0/5`)** | **0% (`0/5`)** | Вне Goal. |
| `PWA-MANIFEST-01` | **100% (`6/6`)** | **100% (`6/6`)** | Required delivery Evidence неполные. |
| `PWA-STANDARDIZATION-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | Вне Goal. |
| `PWA-REALTIME-01` | **38,5% (`5/13`)** | **83,3% (`5/6`)** | Denominator расширен на семь recovery/privacy AC. |
| `PWA-OPERABILITY-01` | **100% (`18/18`)** | **100% (`18/18`)** | Required delivery Evidence неполные. |

## Candidate next Goals

Эти items — proposals и не авторизуют implementation:

1. `PWA-INGEST-FOLDERS-01` — local/Drive folder intake и folder batch.
2. `PWA-SPEAKER-IDENTITY-01` — names/roles и manual listen-and-assign.
3. `PWA-REALTIME-MATRIX-01` — representative microphone/display/mixed production stability после recovery Goal.
4. `COLAB-REALTIME-STABILITY-01` — capture stability после PWA priority scope.

## Risks и boundaries

- Transcript body — sensitive content. Browser/server draft endpoints обязаны быть owner-scoped, `no-store`, encrypted at rest и исключены из diagnostics/audit payloads.
- Browser checkpoint не полагается на `beforeunload`; committed fragment сохраняется до UI acknowledgement, partial — bounded debounce.
- Server revision monotonically increases; stale/same-revision-conflicting writes fail closed и не перезаписывают newer text.
- Existing archived project не unarchive-ится schema migration, workspace resolution или page load.
- Ordinary component CD не применяет migration; worker cleanup deploy отделён от API/web rollout.
- Approved post-deploy metadata writer отсутствует; фактический state фиксируется в final report/GitHub records и reconciled в следующем authorized scope без docs-only follow-up PR.

## Sources of truth

- Repository instructions и Goal process: `AGENTS.md`.
- Product scope/AC: `docs/project-spec.md`.
- Current Goal/checkpoint/readiness: этот документ.
- CI/CD и production safety: `docs/ci-cd-rules.md`.
- Actual architecture: `docs/architecture.md`.
- Detailed PWA processing: `docs/studio-processing-contract.md`.
- Historical evidence: `docs/delivery-plan-archive.md` только при reconciliation.

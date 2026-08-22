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
- **Required Evidence:** `SPEC ✅ | CODE ✅ | TEST ◐ | CI — | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** additive migration `0023` потребует отдельного protected Environment approval после merge; production archived project `Транскрибации` не может быть восстановлен этой Goal без отдельной exact-data authorization; approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** все Goal AC и required Evidence подтверждены либо flow достиг `BLOCKED` / `PENDING_EXTERNAL_GATE`; затем остановиться и не переходить к следующей Goal без explicit authorization.

## Active execution checkpoint

- Updated (UTC): 2026-08-22T16:58:06Z
- Session mode: new authorized Goal
- Base branch: `main`
- Base SHA: `dd194c929d957e822ff618df294dc54e72d5971e`
- Working branch: `codex/pwa-transcriptions-live-recovery-01`
- Last verified revision: `645b51f6372d2343691fda620ac8f23700a2afa0`
- Working tree at branch start: tracked clean; preserved unrelated untracked `.pnpm-store/`, `apps/studio/pnpm-lock.yaml`, `apps/studio/pnpm-workspace.yaml`
- Completed: Git/GitHub recovery; product reconciliation; additive `0023` encrypted owner/project Live-draft model/service/API; monotonic/size/TTL boundaries; idle-worker physical cleanup; removal of autosave audit churn; IndexedDB checkpoint module; server sync; reload recovery restore/download/delete UX; canonical `/transcriptions` route; ordinary/Live tabs; removal of manual Project create/edit/archive UX; idempotent internal workspace ensure; non-destructive legacy workspace compatibility selector; bounded metadata layout; dark primary contrast; accessible confirmation dialog; keyboard-operable tabs; heading/touch/mobile affordance corrections; exact maintenance blocker copy; current-provider limitation copy; safe deterministic batch presentation reference; one grouped multi-transcription per batch with ordered source/fragment items and preserved item-level progress/output/recovery controls; review-driven frontend recovery hardening: serialized final DELETE, bounded server requests, restore resync, partial-only actions and same-session revision authority; review-driven backend hardening: redacted draft validation errors, `no-store` on all draft-route responses, sustainable checkpoint limit, one-shot idempotent insert-race reconciliation and exact 72-hour configuration boundary.
- Current step: validate and commit the backend review-remediation slice.
- Next exact action: commit backend hardening, push both review-fix commits and obtain exact-head CI/re-review evidence.
- Validation and Evidence: bundled Python 3 syntax compile and `scripts/ci_checks.py` PASS for the backend review slice; local Python runtime does not include `pytest`, so PostgreSQL/Redis integration tests remain delegated to exact-head CI. TypeScript build, ESLint and production Vite build PASS; full Studio suite `528/528` PASS across `43/43` files; focused Live/recovery tests now `25/25` PASS; Transcriptions IA/App/routing regression `223/223` PASS; focused UX regression `229/229` PASS. Bounded local browser validation PASS at desktop `1280x720` and narrow `390x844`: no document-level overflow (`documentWidth=375` at layout viewport 375), all three primary navigation controls visible, ordinary/Live keyboard tab switching works, visible sampled targets are at least 66 px high; batch fixture renders one multi-transcription with two ordered item cards and no narrow overflow. First PR-head Studio workflow run `32584676612`: `studio` success; `browser-e2e` failed because its serial first scenario still searched removed `Проекты`/`Новый проект` controls, so nine tests did not run. Browser contract is updated to the canonical Transcriptions-first flow; TypeScript, focused ESLint and Playwright discovery `10/10` PASS locally. Backend integration tests, including validation redaction and insert-race reconciliation, are authored but not runnable locally without the repository PostgreSQL/Redis Python test environment; replacement exact-head CI remains required.
- Pull Request: `#222` — `https://github.com/Just9120/Elevenlabs-API/pull/222`, open; remote pre-fix head `e591652815f9110ea92cbd55d357132602566ef7`, two review-remediation commits local.
- CI/checks: exact-head `e591652` passed repository CI run `32585455284` (`checks`) and Studio run `32585455279` (`studio`, full serial `browser-e2e`); merge remains blocked until replacement exact-head evidence and review reconciliation. All nine substantive automated findings are fixed locally: five frontend findings have focused TypeScript/ESLint and `25/25` test Evidence, four backend findings have syntax/lightweight checks and new integration tests pending CI execution.
- Deployment/environment: not started; migration class `MANUAL_GATED`.
- Blockers: no implementation blocker; production recovery remains separately unauthorized.
- Unverified assumptions: 72-hour draft TTL and existing credential master key boundary are compatible with production operational policy; exact deployment requires post-merge verification.
- Preserved pre-existing changes: three untracked pnpm artifacts listed above remain outside scope/commits.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Новый независимый пересчёт подтвердил `PT-03`: API выдаёт только safe derived batch reference, а UI группирует один batch в одну multi-transcription с ordered item-level progress/results/recovery controls. Denominator не изменился; numerator вырос на 1 AC.

| Product/epic | Current | Previous independent snapshot | Readiness/Evidence |
|---|---:|---:|---|
| **Project** | **85,0% (`102/120`)** | **84,2% (`101/120`)** | +1 AC: один batch представлен одной multi-transcription; delivery Evidence ещё неполные. |
| **Google Colab** | **75,9% (`22/29`)** | **75,9% (`22/29`)** | Без изменений в PWA Goal. |
| `COLAB-BATCH-01` | **73,9% (`17/23`)** | **73,9% (`17/23`)** | 🟦 IN PROGRESS. |
| `COLAB-REALTIME-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS. |
| **Studio PWA** | **87,9% (`80/91`)** | **86,8% (`79/91`)** | +1 AC: grouped multi-transcription presentation. |
| `PWA-CORE-01` | **100% (`13/13`)** | **100% (`13/13`)** | Все product AC выполнены; exact-head delivery Evidence ещё не подтверждены. |
| `PWA-TRANSCRIPTIONS-UX-01` | **100% (`4/4`)** | **75,0% (`3/4`)** | Все product AC выполнены; exact-head CI/DEPLOY/LIVE ещё gate-ят `READY`. |
| `PWA-INGEST-01` | **72,7% (`8/11`)** | **72,7% (`8/11`)** | Вне Goal. |
| `PWA-SEGMENTS-01` | **100% (`5/5`)** | **100% (`5/5`)** | 🟩 READY. |
| `PWA-BATCH-01` | **90,0% (`9/10`)** | **90,0% (`9/10`)** | Вне Goal. |
| `PWA-SPEAKER-IDENTITY-01` | **0% (`0/5`)** | **0% (`0/5`)** | Вне Goal. |
| `PWA-MANIFEST-01` | **100% (`6/6`)** | **100% (`6/6`)** | Required delivery Evidence неполные. |
| `PWA-STANDARDIZATION-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | Вне Goal. |
| `PWA-REALTIME-01` | **92,3% (`12/13`)** | **92,3% (`12/13`)** | Без изменения; `PR-06` production stability остаётся открытым. |
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

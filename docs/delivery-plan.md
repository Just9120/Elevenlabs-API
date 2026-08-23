# Delivery plan

## Current Goal

- **ID / title:** `PWA-TIMESTAMP-AUTHORITY-01` — authoritative source creation time для batch output и transcript standardization.
- **State:** `IN_PROGRESS` — implementation и local validation завершены; требуется exact-head delivery Evidence.
- **Authorization source:** explicit owner instruction 2026-08-23: `формируй цель и приступай` после согласования timestamp-authority scope.
- **Scope:** reconcile фактического closure предыдущей Goal; инвентаризация Google Drive/local source creation provenance; единый fail-closed timestamp contract; передача authoritative source time в новые Google Docs transcript metadata и selected-folder/single-document standardization; запрет подмены Google Doc/job/upload/modified time; explicit safe outcome при отсутствии доказуемой authority; relevant API/worker/frontend/security/regression tests; atomic commits и полный PR → CI → merge → applicable deployment → bounded LIVE flow.
- **Non-goals:** speaker identity; realtime stability; Colab; automatic guessing legacy timestamps; новые OAuth scopes; unrelated UI, provider или processing architecture; изменение product AC или denominator.
- **Goal AC:**
  1. Google Drive source использует нормализованный Drive `createdTime`; local source использует только embedded media `creation_time`; provenance сохраняется вместе со значением.
  2. Browser `lastModified`, upload/job/output clocks, Drive `modifiedTime` и Google Doc creation time не используются как fallback source timestamp.
  3. Новый Google Docs transcript получает ISO 8601 source timestamp из immutable source snapshot; отсутствие authority отображается честно и не подменяется.
  4. Standardization dry-run/apply различает authoritative source timestamp и document clock; mutation с недоказуемой authority fail-closed/skip с безопасной явной причиной.
  5. Existing authoritative ISO timestamp сохраняется идемпотентно; repeated apply не изменяет его и не создаёт competing authority.
  6. Owner boundaries, Google maintenance consent, transcript-body secrecy, batch processing и unrelated PWA flows не регрессируют.
  7. Relevant backend/worker/frontend/security tests, full local validation и exact-head CI проходят.
  8. Applicable API/worker/web deployment и bounded production LIVE подтверждают новый batch output и maintenance behavior на exact revision без лишнего provider charge.
- **Required Evidence:** `SPEC ✅ | CODE ✅ | TEST ✅ | CI — | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** legacy Google Docs могут не иметь доказуемой связи с source media; такие документы нельзя автоматически датировать. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`), поэтому итоговый state фиксируется GitHub Evidence/final report и reconciled в следующей authorized Goal без docs-only follow-up PR.
- **Stop condition:** все Goal AC и required Evidence подтверждены либо flow достиг `BLOCKED` / `PENDING_EXTERNAL_GATE`; затем остановиться и не переходить к следующей Goal без explicit authorization.

## Active execution checkpoint

- Updated (UTC): 2026-08-23T18:59:00Z
- Session mode: authorized Goal implementation
- Base branch: `main`
- Base SHA: `cb3a9e9216521c56e07b6f7b6fda9bf8eb8051f8`
- Working branch: `codex/pwa-timestamp-authority`
- Last verified revision: `18e64d1276d71f698cedcdad0a0bbeeb36e9e609` (`feat(studio): enforce source timestamp authority`).
- Working tree at branch start: clean synchronized `main`; предыдущая merged branch удалена local/remote; only `main` existed.
- Completed: recovered PR #226/merge/CD/LIVE closure; traced source intake/output/maintenance data flow; added owner-scoped persisted source authority resolver; removed Google Doc/body clock fallback; enforced exact ISO source timestamp matching and fail-closed unavailable/conflict outcomes; exposed authority state in PWA; committed implementation and regression tests.
- Current step: final diff/checks перед публикацией delivery branch.
- Next exact action: push branch, open PR и дождаться terminal state всех required checks.
- Validation and Evidence: `scripts/ci_checks.py` PASS; Python compile PASS; focused+adjacent backend regression `345 passed`; Studio ESLint PASS; TypeScript build-check PASS; full Studio Vitest `558 passed`. No exact-head CI/deployment/LIVE yet.
- Pull Request: not created.
- CI/checks: not started.
- Deployment/environment: not started; migration class `NONE` — existing `sources.source_created_at` and provenance columns are sufficient; applicable deployment is API + web, worker unchanged.
- Blockers: none. Potential design constraint: legacy documents without verifiable source linkage cannot receive a fabricated creation timestamp.
- Unverified assumptions: production legacy documents have source linkage coverage comparable to test evidence; documents without it intentionally remain blocked rather than receiving a fabricated timestamp.
- Preserved pre-existing changes: none.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Новый независимый snapshot учитывает подтверждённую реализацию и local automated tests для `PB-10` и `PD-06`: source timestamp берётся только из persisted source authority, Google Doc/job/upload/modified clocks не используются, а maintenance без authority блокируется. Denominator не изменился; numerator вырос на 2 AC. READY пока не заявляется без exact-head CI/DEPLOY/LIVE Evidence.

| Product/epic | Current | Previous independent snapshot | Readiness/Evidence |
|---|---:|---:|---|
| **Project** | **89,2% (`107/120`)** | **87,5% (`105/120`)** | Numerator +2 за `PB-10` и `PD-06`; denominator без изменений. |
| **Google Colab** | **75,9% (`22/29`)** | **75,9% (`22/29`)** | Без изменений в PWA Goal. |
| `COLAB-BATCH-01` | **73,9% (`17/23`)** | **73,9% (`17/23`)** | 🟦 IN PROGRESS. |
| `COLAB-REALTIME-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS. |
| **Studio PWA** | **93,4% (`85/91`)** | **91,2% (`83/91`)** | Numerator +2 за `PB-10` и `PD-06`. |
| `PWA-CORE-01` | **100% (`13/13`)** | **100% (`13/13`)** | Все product AC выполнены; exact-head delivery Evidence ещё не подтверждены. |
| `PWA-TRANSCRIPTIONS-UX-01` | **100% (`4/4`)** | **100% (`4/4`)** | 🟩 READY. |
| `PWA-INGEST-01` | **100% (`11/11`)** | **100% (`11/11`)** | 🟩 READY; `SPEC/CODE/TEST/CI/DEPLOY/LIVE ✅`. |
| `PWA-SEGMENTS-01` | **100% (`5/5`)** | **100% (`5/5`)** | 🟩 READY. |
| `PWA-BATCH-01` | **100% (`10/10`)** | **90,0% (`9/10`)** | 🟦 IN PROGRESS до exact-head CI/DEPLOY/LIVE Evidence. |
| `PWA-SPEAKER-IDENTITY-01` | **0% (`0/5`)** | **0% (`0/5`)** | Вне Goal. |
| `PWA-MANIFEST-01` | **100% (`6/6`)** | **100% (`6/6`)** | Required delivery Evidence неполные. |
| `PWA-STANDARDIZATION-01` | **100% (`6/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS до exact-head CI/DEPLOY/LIVE Evidence. |
| `PWA-REALTIME-01` | **92,3% (`12/13`)** | **92,3% (`12/13`)** | Без изменения; `PR-06` production stability остаётся открытым. |
| `PWA-OPERABILITY-01` | **100% (`18/18`)** | **100% (`18/18`)** | Required delivery Evidence неполные. |

## Candidate next Goals

Эти items — proposals и не авторизуют implementation:

1. `PWA-SPEAKER-IDENTITY-01` — names/roles и manual listen-and-assign.
2. `PWA-REALTIME-MATRIX-01` — representative microphone/display/mixed production stability.
3. `COLAB-BATCH-PARITY-01` — оставшиеся batch gaps после PWA priority scope.
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

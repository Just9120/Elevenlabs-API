# Delivery plan

## Current Goal

- **ID / title:** `PWA-TIMESTAMP-AUTHORITY-01` — authoritative source creation time для batch output и transcript standardization.
- **State:** `IN_PROGRESS` — Goal явно авторизована, recovery завершён, implementation audit начат.
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
- **Required Evidence:** `SPEC ✅ | CODE ◐ | TEST — | CI — | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** legacy Google Docs могут не иметь доказуемой связи с source media; такие документы нельзя автоматически датировать. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`), поэтому итоговый state фиксируется GitHub Evidence/final report и reconciled в следующей authorized Goal без docs-only follow-up PR.
- **Stop condition:** все Goal AC и required Evidence подтверждены либо flow достиг `BLOCKED` / `PENDING_EXTERNAL_GATE`; затем остановиться и не переходить к следующей Goal без explicit authorization.

## Active execution checkpoint

- Updated (UTC): 2026-08-23T18:28:45Z
- Session mode: authorized Goal implementation
- Base branch: `main`
- Base SHA: `cb3a9e9216521c56e07b6f7b6fda9bf8eb8051f8`
- Working branch: `codex/pwa-timestamp-authority`
- Last verified revision: `cb3a9e9216521c56e07b6f7b6fda9bf8eb8051f8` (exact synchronized base; no Goal code changes yet).
- Working tree at branch start: clean synchronized `main`; предыдущая merged branch удалена local/remote; only `main` existed.
- Completed: recovered PR #226/merge/CD/LIVE closure; independently recalculated readiness; read applicable repository, product, architecture, processing and CI/CD contracts; created isolated Goal branch.
- Current step: trace timestamp authority through source intake, worker immutable snapshot, Google Docs output and maintenance dry-run/apply.
- Next exact action: prove the current gap with focused tests, define the smallest fail-closed contract, then implement it without schema change unless code evidence requires one.
- Validation and Evidence: previous Goal exact-main CI and web CD are archived below; current branch has no new validation yet.
- Pull Request: not created.
- CI/checks: not started.
- Deployment/environment: not started; migration class currently `UNSET` pending code/data-flow audit.
- Blockers: none. Potential design constraint: legacy documents without verifiable source linkage cannot receive a fabricated creation timestamp.
- Unverified assumptions: existing `sources.source_created_at` columns and catalog/output linkage are sufficient, so a new migration may be unnecessary.
- Preserved pre-existing changes: none.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Новый независимый snapshot учитывает production LIVE PR #226: folder import создал девять ready rows, одна target folder распространилась на все девять unassigned rows, все сохранили `До конца файла`, review был доступен. Поэтому `PI-10` закрыт. Denominator не изменился; numerator вырос на 1 AC.

| Product/epic | Current | Previous independent snapshot | Readiness/Evidence |
|---|---:|---:|---|
| **Project** | **87,5% (`105/120`)** | **86,7% (`104/120`)** | Numerator +1 за подтверждённый `PI-10`; denominator без изменений. |
| **Google Colab** | **75,9% (`22/29`)** | **75,9% (`22/29`)** | Без изменений в PWA Goal. |
| `COLAB-BATCH-01` | **73,9% (`17/23`)** | **73,9% (`17/23`)** | 🟦 IN PROGRESS. |
| `COLAB-REALTIME-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS. |
| **Studio PWA** | **91,2% (`83/91`)** | **90,1% (`82/91`)** | Numerator +1 за production LIVE `PI-10`. |
| `PWA-CORE-01` | **100% (`13/13`)** | **100% (`13/13`)** | Все product AC выполнены; exact-head delivery Evidence ещё не подтверждены. |
| `PWA-TRANSCRIPTIONS-UX-01` | **100% (`4/4`)** | **100% (`4/4`)** | 🟩 READY. |
| `PWA-INGEST-01` | **100% (`11/11`)** | **90,9% (`10/11`)** | 🟩 READY; `SPEC/CODE/TEST/CI/DEPLOY/LIVE ✅`. |
| `PWA-SEGMENTS-01` | **100% (`5/5`)** | **100% (`5/5`)** | 🟩 READY. |
| `PWA-BATCH-01` | **90,0% (`9/10`)** | **90,0% (`9/10`)** | Вне Goal. |
| `PWA-SPEAKER-IDENTITY-01` | **0% (`0/5`)** | **0% (`0/5`)** | Вне Goal. |
| `PWA-MANIFEST-01` | **100% (`6/6`)** | **100% (`6/6`)** | Required delivery Evidence неполные. |
| `PWA-STANDARDIZATION-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | Вне Goal. |
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

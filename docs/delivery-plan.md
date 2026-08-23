# Delivery plan

## Current Goal

- **ID / title:** `PWA-INGEST-FOLDERS-01` — bounded local/Drive source-folder intake и folder-to-batch flow.
- **State:** `IN_PROGRESS`.
- **Authorization source:** explicit owner instruction в текущей task: `ставь goal и начинай реализацию` после согласования proposed scope.
- **Scope:** отдельный local folder picker и Google Drive source-folder Picker; recursive bounded enumeration; preview/explicit confirmation; максимум 50 supported items; safe filtering и partial local-upload reporting; server-side Drive revalidation, cycle/pagination/duplicate/drift guards; создание individual Source/composer rows с общей target folder и per-row override; existing manifest/preflight/batch/multi-transcription integration; relevant tests и полный delivery flow. В execution scope также входят recovery post-deploy metadata предыдущей Goal, archive reconciliation и tracked ignore для repo-local pnpm cache.
- **Non-goals:** расширение Google OAuth scopes; background Drive sync; более 50 items; speaker identity; timestamp/standardization policy; realtime stability; Colab; local content fingerprinting; новая provider/worker architecture.
- **Goal AC:**
  1. Local folder выбирается отдельным control; nested files перечисляются рекурсивно без передачи absolute local paths.
  2. Unsupported, empty и oversized local files исключаются до PUT с видимыми bounded причинами/counts.
  3. Google Drive source folder выбирается отдельным Picker flow и повторно валидируется server-side.
  4. Drive traversal bounded по items/pages/depth, отклоняет cycles, repeated page tokens, duplicate IDs, incomplete traversal и preview/apply drift.
  5. Preview не создаёт Source, upload или provider side effects и показывает accepted/skipped/count/target summary.
  6. Более 50 supported items fail-closed до import/upload; silent truncation и partial apply запрещены.
  7. Explicit confirmation разворачивает accepted files в individual Source/composer rows с одной общей target folder и сохранённым per-row override.
  8. Ambiguous mutations не replay-ятся автоматически; authoritative source collection перечитывается и требует explicit user decision.
  9. Folder-generated batch использует existing manifest/preflight/create authority и отображается одной multi-transcription с item-level progress/results.
  10. Existing single/multi-file, Favorites, segmentation, batch, realtime и responsive behavior не регрессируют.
  11. Relevant backend/frontend/security/browser tests и exact-head CI проходят.
  12. Applicable web/API deployment и bounded production LIVE canary успешны.
- **Required Evidence:** `SPEC ✅ | CODE ✅ | TEST ◐ | CI — | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** primary Google OAuth остаётся exact narrow `drive.file`; если Picker-selected folder не даёт runtime access к children, Goal становится `BLOCKED` до owner decision. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** все Goal AC и required Evidence подтверждены либо flow достиг `BLOCKED` / `PENDING_EXTERNAL_GATE`; затем остановиться и не переходить к следующей Goal без explicit authorization.

## Active execution checkpoint

- Updated (UTC): 2026-08-23T11:22:52Z
- Session mode: authorized Goal implementation
- Base branch: `main`
- Base SHA: `ccb067d05d5225a3178b21cd239bd65c0764f1fb`
- Working branch: `codex/pwa-ingest-folders-01`
- Last verified revision: `00c736bbdb4760635224386d019d88de14cfc309` (local-folder intake commit)
- Working tree at branch start: clean `main`; post-deploy docs diff previous Goal restored from named stash after branch creation.
- Completed: local-folder slice committed; Google Drive source-folder Picker, server-side bounded traversal, strict listing validation, preview/no-side-effect contract, re-traversal drift token, atomic apply, composer expansion and ambiguous-no-replay UX implemented; architecture synchronized.
- Current step: atomic commit Google Drive folder slice and exact-head validation preparation.
- Next exact action: commit the Drive folder slice, run remaining repository/browser gates, then push and open the Goal PR.
- Validation and Evidence: pure backend folder traversal/transport tests `7/7` PASS; lightweight CI checks PASS; full Studio Vitest `555/555` PASS; full Studio ESLint PASS; TypeScript and Vite production build PASS. PostgreSQL-backed endpoint test is authored but local execution is unavailable because local PostgreSQL/Redis services are absent; exact test is delegated to required CI.
- Pull Request: not created.
- CI/checks: not started.
- Deployment/environment: not started; migration currently expected `N/A`, web/API deploy applicable after merge.
- Blockers: Google `drive.file` child enumeration remains unverified at production runtime; no current local implementation blocker.
- Unverified assumptions: Picker-selected folder grants sufficient child metadata/content access under the exact primary scope; recursive traversal semantics remain bounded to 50 supported media items.
- Preserved pre-existing changes: none; previous generated artifacts removed under explicit authorization.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Новый независимый пересчёт подтвердил `PI-08` и `PI-10`: отдельный Drive source-folder Picker проходит server-side bounded traversal/preview/apply, а подтверждённые Sources разворачиваются в composer с общей target folder и существующим per-row override. Denominator не изменился; numerator вырос на 2 AC.

| Product/epic | Current | Previous independent snapshot | Readiness/Evidence |
|---|---:|---:|---|
| **Project** | **87,5% (`105/120`)** | **85,8% (`103/120`)** | `PI-08` и `PI-10` подтверждены code/tests; CI/DEPLOY/LIVE ещё не подтверждены. |
| **Google Colab** | **75,9% (`22/29`)** | **75,9% (`22/29`)** | Без изменений в PWA Goal. |
| `COLAB-BATCH-01` | **73,9% (`17/23`)** | **73,9% (`17/23`)** | 🟦 IN PROGRESS. |
| `COLAB-REALTIME-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS. |
| **Studio PWA** | **91,2% (`83/91`)** | **89,0% (`81/91`)** | Numerator +2 за `PI-08` и `PI-10`; readiness gate Goal ещё не выполнен. |
| `PWA-CORE-01` | **100% (`13/13`)** | **100% (`13/13`)** | Все product AC выполнены; exact-head delivery Evidence ещё не подтверждены. |
| `PWA-TRANSCRIPTIONS-UX-01` | **100% (`4/4`)** | **100% (`4/4`)** | 🟩 READY. |
| `PWA-INGEST-01` | **100% (`11/11`)** | **81,8% (`9/11`)** | Все product AC выполнены; эпик остаётся 🟦 IN PROGRESS до required CI/DEPLOY/LIVE Evidence. |
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
2. `PWA-TIMESTAMP-AUTHORITY-01` — source creation и legacy-standardization gaps.
3. `PWA-REALTIME-MATRIX-01` — representative microphone/display/mixed production stability.
4. `COLAB-BATCH-PARITY-01` — оставшиеся batch gaps после PWA priority scope.
5. `COLAB-REALTIME-STABILITY-01` — capture stability после PWA priority scope.

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

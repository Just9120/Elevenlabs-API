# Delivery plan

## Current Goal

- **ID / title:** `PWA-INGEST-FOLDERS-01` — bounded local/Drive source-folder intake и folder-to-batch flow.
- **State:** `IN_PROGRESS` — OAuth/reconnect и source-folder LIVE подтверждены; production LIVE выявил order-dependent shared target-folder gap, локальный fix ожидает CI/DEPLOY/LIVE.
- **Authorization source:** initial Goal — explicit owner instruction `ставь goal и начинай реализацию`; material scope change — explicit owner authorization 2026-08-23: `Авторизую расширение primary Google OAuth scopes до openid email drive.file drive.readonly, включая доступ приложения на чтение всех файлов Google Drive, обязательный reconnect и последующее production deployment.`
- **Scope:** отдельный local folder picker и Google Drive source-folder Picker; recursive bounded enumeration; preview/explicit confirmation; максимум 50 supported items; safe filtering и partial local-upload reporting; server-side Drive revalidation, cycle/pagination/duplicate/drift guards; создание individual Source/composer rows с общей target folder и per-row override; existing manifest/preflight/batch/multi-transcription integration; exact primary OAuth grant `openid email drive.file drive.readonly`, mandatory reconnect, relevant tests и полный delivery flow. В execution scope также входят recovery post-deploy metadata предыдущей Goal, archive reconciliation и tracked ignore для repo-local pnpm cache.
- **Non-goals:** full `drive` или иные дополнительные Google scopes; background Drive sync; более 50 items; speaker identity; timestamp/standardization policy; realtime stability; Colab; local content fingerprinting; новая provider/worker architecture.
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
- **Required Evidence:** `SPEC ✅ | CODE ✅ | TEST ✅ | CI — | DEPLOY — | LIVE ❌`.
- **Known blockers/dependencies:** exact-head CI, web deployment и повторный bounded LIVE для shared target-folder fix. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`); финальный state фиксируется GitHub Evidence и итоговым отчётом без docs-only follow-up PR.
- **Stop condition:** все Goal AC и required Evidence подтверждены либо flow достиг `BLOCKED` / `PENDING_EXTERNAL_GATE`; затем остановиться и не переходить к следующей Goal без explicit authorization.

## Active execution checkpoint

- Updated (UTC): 2026-08-23T18:01:03Z
- Session mode: authorized Goal implementation
- Base branch: `main`
- Base SHA: `17a9fc408a2d352005be08d981325c21de4d1dc0`
- Working branch: `codex/pwa-folder-target-propagation`
- Last verified revision: `2fa36efe3aeeb6f09aeb5b7a54fd0900cd217b9f` (local focused/full Studio validation passed).
- Working tree at branch start: clean synchronized `main`; PR #225 branch had been fully merged and safely removed locally/remotely; only `main` existed before this fix branch.
- Completed: PR #225 merged as `main@17a9fc408a2d352005be08d981325c21de4d1dc0`; exact-main CI/Studio/browser checks and API/web CD succeeded. Production runtime scopes were corrected, primary и maintenance Google OAuth reconnect completed. Bounded LIVE imported one Drive source folder as three ready Source/composer rows. Selecting the target folder afterward changed only row 1, while rows 2–3 required repeated manual selection. Commit `2fa36ef` seeds a verified target into all rows that are still unassigned and preserves later per-row overrides.
- Current step: operational checkpoint/readiness reconciliation after green local validation.
- Next exact action: commit documentation checkpoint, push branch, create PR and require exact-head CI.
- Validation and Evidence: PR #225 exact-main `CI/checks` `32642653678` SUCCESS; Studio jobs `32642653695` SUCCESS; initial CD `32642653667` SUCCESS. Runtime scope correction followed by API-only CD `32654826834/97231852416` SUCCESS with `STUDIO_PLATFORM_API_DEPLOY_OK`. Bounded LIVE confirmed both OAuth contours and recursive Drive folder import of three supported files; no provider job was created. Fix regression initially failed because row 2 lacked the shared target, then passed. Current local Studio Vitest `558/558`, focused regressions `3/3`, ESLint, TypeScript and Vite build PASS.
- Pull Request: not created for current fix branch. PR #225 is merged and historical.
- CI/checks: current fix revision has no GitHub checks yet.
- Deployment/environment: `main@17a9fc4` web/API deployed; current fix is frontend-only and not deployed. Migration/API/worker changes are N/A for this fix.
- Blockers: none before PR. Goal completion requires exact-head CI, web deploy and repeated source-folder-first/shared-target LIVE.
- Unverified assumptions: production rerun will seed the first verified target folder into all still-unassigned folder-generated rows while preserving an explicit later row override.
- Preserved pre-existing changes: none; previous generated artifacts removed under explicit authorization.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Exact scopes, reconnect и production LIVE подтвердили `PI-08`: Drive source folder рекурсивно импортирован в три composer rows. `PI-10` остаётся incomplete, поскольку общий target пришлось повторно выбрать для строк 2–3. Denominator не изменился; numerator вырос на 1 AC относительно предыдущего snapshot.

| Product/epic | Current | Previous independent snapshot | Readiness/Evidence |
|---|---:|---:|---|
| **Project** | **86,7% (`104/120`)** | **85,8% (`103/120`)** | Numerator +1: production LIVE подтвердил `PI-08`; расхождение меньше 10 п.п. |
| **Google Colab** | **75,9% (`22/29`)** | **75,9% (`22/29`)** | Без изменений в PWA Goal. |
| `COLAB-BATCH-01` | **73,9% (`17/23`)** | **73,9% (`17/23`)** | 🟦 IN PROGRESS. |
| `COLAB-REALTIME-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS. |
| **Studio PWA** | **90,1% (`82/91`)** | **89,0% (`81/91`)** | Numerator +1 за подтверждённый `PI-08`; `PI-10` остаётся открытым. |
| `PWA-CORE-01` | **100% (`13/13`)** | **100% (`13/13`)** | Все product AC выполнены; exact-head delivery Evidence ещё не подтверждены. |
| `PWA-TRANSCRIPTIONS-UX-01` | **100% (`4/4`)** | **100% (`4/4`)** | 🟩 READY. |
| `PWA-INGEST-01` | **90,9% (`10/11`)** | **81,8% (`9/11`)** | 🟦 IN PROGRESS: `PI-08` LIVE подтверждён; shared target-folder fix для `PI-10` ожидает CI/DEPLOY/LIVE. |
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

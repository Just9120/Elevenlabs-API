# Delivery plan

## Current Goal

- **ID / title:** `PWA-INGEST-FOLDERS-01` — bounded local/Drive source-folder intake и folder-to-batch flow.
- **State:** `BLOCKED` — production runtime подтвердил, что exact narrow `drive.file` не раскрывает descendants выбранной папки; требуется owner decision по OAuth boundary.
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
- **Required Evidence:** `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ❌`.
- **Known blockers/dependencies:** primary Google OAuth остаётся exact narrow `drive.file`; если Picker-selected folder не даёт runtime access к children, Goal становится `BLOCKED` до owner decision. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** все Goal AC и required Evidence подтверждены либо flow достиг `BLOCKED` / `PENDING_EXTERNAL_GATE`; затем остановиться и не переходить к следующей Goal без explicit authorization.

## Active execution checkpoint

- Updated (UTC): 2026-08-23T12:42:12Z
- Session mode: authorized Goal implementation
- Base branch: `main`
- Base SHA: `e94605c07ebe2d88396aaa05edb5095079ba6eeb`
- Working branch: `codex/pwa-ingest-folder-diagnostics`
- Last verified revision: `e94605c07ebe2d88396aaa05edb5095079ba6eeb` (merged/deployed PR #223 revision)
- Working tree at branch start: clean `main`, fast-forward synchronized with `origin/main`; merged branch `codex/pwa-ingest-folders-01` safely removed local/remote after ancestry verification.
- Completed: PR #223 merged as `e94605c07ebe2d88396aaa05edb5095079ba6eeb`; exact-main `CI` run `32637083255` SUCCESS, `Studio PWA CI` run `32637083140` SUCCESS; `Studio Platform CD` run `32637083174` deployed web/API successfully, migration and worker correctly skipped. Production PWA loaded the new controls, local folder input exposed `webkitdirectory + multiple`, and Google Picker opened in folder-only mode without browser errors.
- Current step: bounded diagnostic preview UX implemented and locally validated without expanding OAuth scope.
- Next exact action: commit the focused fix, push `codex/pwa-ingest-folder-diagnostics`, create a PR and wait for exact-head required CI.
- Validation and Evidence: original implementation and post-merge main CI PASS; web/API deployment health and image identity checks PASS. LIVE folder selection reached the preview endpoint but returned no importable descendants, so `PI-08`/`PI-10` remain incomplete and LIVE is failed for the Goal. Diagnostic fix validation: focused Vitest `227/227` PASS; full Studio Vitest `558/558` PASS; ESLint PASS; TypeScript PASS; Vite production build PASS; Playwright discovery `10/10` PASS. A preliminary `pnpm` attempt was invalid for this npm/package-lock repository and stopped before tests; canonical direct Node/npm-equivalent commands produced the reported results.
- Pull Request: merged `#223` — `https://github.com/Just9120/Elevenlabs-API/pull/223`; merge SHA `e94605c07ebe2d88396aaa05edb5095079ba6eeb`. Diagnostic fix PR not created yet.
- CI/checks: main exact SHA `e94605c07ebe2d88396aaa05edb5095079ba6eeb`: `CI` `32637083255` SUCCESS; `Studio PWA CI` `32637083140` SUCCESS.
- Deployment/environment: `Studio Platform CD` `32637083174` SUCCESS; `deploy-web` and `deploy-api` SUCCESS; migration `N/A`, worker `N/A` for this change.
- Blockers: exact `drive.file` is per-file access; selecting a parent folder via Picker does not authorize arbitrary descendants. Full source-folder import requires an explicit OAuth/product decision; current fix remains limited to truthful diagnostics and safe fallback guidance.
- Unverified assumptions: whether a separately authorized broader Drive scope will be accepted for this deployment model; no scope expansion is authorized in the current Goal.
- Preserved pre-existing changes: none; previous generated artifacts removed under explicit authorization.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Production runtime опроверг достаточность code/test evidence для `PI-08` и `PI-10`: Picker выбирает папку, но exact `drive.file` не даёт доступ к произвольным descendants, поэтому реальный folder-to-batch flow не выполнен. Denominator не изменился; numerator уменьшен на 2 AC.

| Product/epic | Current | Previous independent snapshot | Readiness/Evidence |
|---|---:|---:|---|
| **Project** | **85,8% (`103/120`)** | **87,5% (`105/120`)** | Numerator −2: production LIVE опроверг `PI-08` и `PI-10`; расхождение меньше 10 п.п. |
| **Google Colab** | **75,9% (`22/29`)** | **75,9% (`22/29`)** | Без изменений в PWA Goal. |
| `COLAB-BATCH-01` | **73,9% (`17/23`)** | **73,9% (`17/23`)** | 🟦 IN PROGRESS. |
| `COLAB-REALTIME-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS. |
| **Studio PWA** | **89,0% (`81/91`)** | **91,2% (`83/91`)** | Numerator −2 за runtime failure `PI-08` и `PI-10`. |
| `PWA-CORE-01` | **100% (`13/13`)** | **100% (`13/13`)** | Все product AC выполнены; exact-head delivery Evidence ещё не подтверждены. |
| `PWA-TRANSCRIPTIONS-UX-01` | **100% (`4/4`)** | **100% (`4/4`)** | 🟩 READY. |
| `PWA-INGEST-01` | **81,8% (`9/11`)** | **100% (`11/11`)** | ⛔ BLOCKED: `PI-08` и `PI-10` не работают для произвольных folder descendants под `drive.file`. |
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

# Delivery plan

## Current Goal

- **ID / title:** `PWA-INGEST-FOLDERS-01` — bounded local/Drive source-folder intake и folder-to-batch flow.
- **State:** `IN_PROGRESS` — OAuth blocker снят явной owner authorization; exact-head CI, production config/reconnect и LIVE ещё не подтверждены.
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
- **Required Evidence:** `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY — | LIVE ❌`.
- **Known blockers/dependencies:** production Google OAuth consent configuration and target-host `STUDIO_GOOGLE_OAUTH_SCOPES` must accept exact `drive.file + drive.readonly`; existing account must disconnect/reconnect. Google verification/security-assessment gate is external if enforced. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** все Goal AC и required Evidence подтверждены либо flow достиг `BLOCKED` / `PENDING_EXTERNAL_GATE`; затем остановиться и не переходить к следующей Goal без explicit authorization.

## Active execution checkpoint

- Updated (UTC): 2026-08-23T13:25:07Z
- Session mode: authorized Goal implementation
- Base branch: `main`
- Base SHA: `295438056dc7352b00ce41a05349445c5ec83f60`
- Working branch: `codex/pwa-drive-readonly-sources`
- Last verified revision: `eb862f64bb5f1842ce8621f01268ba3d1cd542ae` (all expected PR checks passed at this exact head).
- Working tree at branch start: clean `main`, fast-forward synchronized with `origin/main`; only `main` existed locally/remotely before creating this branch.
- Completed: PR #224 merged as `main@295438056dc7352b00ce41a05349445c5ec83f60`; exact-main CI/Studio CI/CD succeeded and safe diagnostic UX is deployed. Owner then explicitly authorized `drive.readonly`. Commit `3419c4f` adds exact `drive.file + drive.readonly`, rejects old/additional grants, requires source-folder read scope, updates runtime/preflight defaults, and preserves narrow output writes.
- Current step: exact-head required checks green; final metadata checkpoint before merge.
- Next exact action: push this checkpoint, require green checks on its docs-only exact head, recheck mergeability/divergence, then merge PR #225.
- Validation and Evidence: backend `CI/checks` rerun `32642110998/97200689867` SUCCESS at `eb862f6` after the narrow status fix; all `1262` tests passed. `Studio PWA CI/studio` `32642110943/97200689818` SUCCESS and `browser-e2e` `32642110943/97200689757` SUCCESS. Pre-PR local Studio Vitest `558/558`, ESLint, TypeScript, Vite build and Playwright discovery `10/10` PASS.
- Pull Request: #225 — `https://github.com/Just9120/Elevenlabs-API/pull/225`; initial head `239d19821e59687e46a45cad51f412a8734bffad`, base `295438056dc7352b00ce41a05349445c5ec83f60`, mergeable at checkpoint. Historical PRs #223/#224 are merged into the base.
- CI/checks: head `eb862f6`: `CI/checks` `32642110998/97200689867` SUCCESS; `Studio PWA CI/studio` `32642110943/97200689818` SUCCESS; `Studio PWA CI/browser-e2e` `32642110943/97200689757` SUCCESS. PR is mergeable, not draft, no review decision is required, and `origin/main` has not diverged at checkpoint.
- Deployment/environment: current branch not deployed. No migration is required; scope/config change requires API and web deployment, while worker remains unchanged unless workflow path selection proves otherwise.
- Blockers: none for pre-merge implementation. Production phase depends on exact OAuth consent configuration, target-host scope update, mandatory reconnect and any external Google verification gate.
- Unverified assumptions: Google will issue exact `drive.file + drive.readonly` for the current OAuth client/consent configuration; production account reconnect will complete without an external verification block.
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
| `PWA-INGEST-01` | **81,8% (`9/11`)** | **100% (`11/11`)** | 🟦 IN PROGRESS: OAuth decision принят, но `PI-08`/`PI-10` ожидают exact-head CI, reconnect и LIVE. |
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

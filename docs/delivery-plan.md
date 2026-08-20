# Delivery plan

## Current Goal

- **ID / title:** `PWA-INGEST-METADATA-POLISH-01` — source creation metadata, output-folder Favorites и active-source expiry boundary.
- **State:** `IN_PROGRESS`.
- **Authorization source:** explicit owner instruction `начинай` от 2026-08-20 после согласования объединить несколько небольших PWA-доработок в одной Goal.
- **Scope:** сохранить authoritative creation time и provenance для Google Drive/local media sources и передать его в Google Docs transcript metadata; реализовать owner-scoped Favorites проверенных target Google Drive folders с повторным выбором; исключить expired local sources из active intake collection/UI без удаления job/history/audit metadata; добавить migrations, API/UI contracts, tests и выполнить полный delivery flow.
- **Non-goals:** local/Drive folder intake, manifest/history/analytics clear operations, speaker identity, accent color, Realtime, Colab, изменение provider semantics, CI/CD policy или deployment topology.
- **Goal AC:**
  1. Google Drive source сохраняет нормализованный `createdTime` и его provenance; modified/upload/job/output time не подменяет source creation time.
  2. Local source использует только доступное authoritative media creation evidence; если browser/runtime не может его подтвердить, значение остаётся unknown, а не заменяется `File.lastModified`.
  3. Processing snapshot передаёт source creation time в `transcript_doc_v1.2`; видимый timestamp остаётся ISO 8601 и не берётся из времени создания Google Docs/job.
  4. Пользователь может сохранить проверенную target Google Drive folder в owner-scoped Favorites, повторно выбрать её в composer и удалить из Favorites; browser DTO не раскрывает tokens/private storage identity.
  5. Expired local sources отсутствуют в active project source collection/composer, но durable Source/job/output/history/audit records не удаляются этим read boundary.
  6. Additive migration, relevant backend/frontend tests, full local validation, exact-head CI, merge, protected migration/deployment и bounded LIVE validation успешны.
- **Required Evidence:** `SPEC ✅ | CODE ✅ | TEST ◐ | CI — | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** standard browser `File` не предоставляет достоверный filesystem creation time; local source authority должен быть получен из embedded media metadata либо остаться unknown. Goal содержит additive PostgreSQL migration, поэтому production migration выполняется только через protected migration lane по `docs/ci-cd-rules.md`. Approved post-deploy metadata writer отсутствует.
- **Stop condition:** все Goal AC и required Evidence подтверждены либо flow достиг `BLOCKED` / `PENDING_EXTERNAL_GATE`; затем остановиться и не переходить к следующей Goal без explicit authorization.

## Active execution checkpoint

- Updated (UTC): 2026-08-20T20:53:54Z
- Session mode: `RESUME` после reconciliation merged Goal `PWA-JOB-STATE-CONSISTENCY-01`; новая bounded Goal активирована explicit owner instruction
- Base branch: `main`
- Base SHA: `ebf02da1636d9362131a1b44161cda1c68f06080`
- Working branch: `codex/pwa-ingest-metadata-polish-01`
- Last verified revision: `ccd3f66ced833a2332bdc91708e5f4f07fcfdcbc`
- Working tree: два implementation commits; documentation reconciliation pending; сохранённые untracked pnpm artifacts исключены из scope/commits
- Completed since base: additive migration `0021_source_creation_favorites`; Drive/embedded-media creation authority и propagation в transcript formatter; owner-scoped Favorites с повторной Drive verification; expired-local active collection boundary; browser-safe DTO/UI; backend и frontend tests
- Current step: documentation/readiness reconciliation и final local validation перед push
- Next exact action: commit architecture/checkpoint/readiness, прочитать CI/CD contract и выполнить CI-equivalent checks перед PR
- Validation and Evidence: Python worker focused suite `144/144` ✅; Studio Vitest `509/509` ✅; TypeScript `tsc -b` ✅; focused ESLint ✅; compileall ✅; Alembic/Studio API DB integration локально не выполнен, потому что fixture child process не видит isolated `alembic` dependency, поэтому `TEST ◐` до Linux CI
- Pull Request: отсутствует
- CI/checks: не запускались для новой ветки
- Deployment/environment: baseline production revision `ebf02da1636d9362131a1b44161cda1c68f06080`; новая Goal не deploy-илась
- Blockers: нет на pre-PR стадии; migration approval может стать external gate после merge
- Unverified assumptions: production Google Drive files/local media действительно предоставляют ожидаемый creation metadata; это требует bounded LIVE canary после protected migration/deploy
- Preserved pre-existing changes: `.pnpm-store/`, `apps/studio/pnpm-lock.yaml`, `apps/studio/pnpm-workspace.yaml` оставлены untracked и не включаются в Goal, поскольку safety gate не подтвердил их принадлежность текущей работе

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Goal AC не добавляются в product denominator. `PC-11` и `PI-02` закрыты branch-level CODE и local TEST evidence; `PB-10`/`PD-06` не засчитаны, потому что local media без authoritative embedded timestamp остаётся unknown, а legacy standardization не восстанавливает source creation time. Current и previous snapshots независимо сверены по canonical 109 AC.

| Product/epic | Current | Previous snapshot | Readiness/Evidence |
|---|---:|---:|---|
| **Project** | **78,0% (`85/109`)** | **76,1% (`83/109`)** | `+2` AC: `PC-11`, `PI-02`; denominator не изменился. |
| **Google Colab** | **75,9% (`22/29`)** | **75,9% (`22/29`)** | Без изменений в PWA Goal. |
| `COLAB-BATCH-01` | **73,9% (`17/23`)** | **73,9% (`17/23`)** | 🟦 IN PROGRESS; `SPEC ✅ CODE ◐ TEST ◐ CI ✅ DEPLOY ◐ LIVE ◐`. |
| `COLAB-REALTIME-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; capture stability не подтверждена полностью. |
| **Studio PWA** | **78,8% (`63/80`)** | **76,3% (`61/80`)** | `PC-11` и `PI-02` выполнены; `PB-10`/`PD-06` остаются открыты. |
| `PWA-CORE-01` | **92,3% (`12/13`)** | **84,6% (`11/13`)** | 🟦 IN PROGRESS; `PC-11` выполнен, `PC-13` остаётся. |
| `PWA-INGEST-01` | **72,7% (`8/11`)** | **63,6% (`7/11`)** | 🟦 IN PROGRESS; `PI-02` выполнен, folder intake остаётся. |
| `PWA-SEGMENTS-01` | **100% (`5/5`)** | **100% (`5/5`)** | 🟩 READY; `SPEC ✅ CODE ✅ TEST ✅ CI ✅ DEPLOY ✅ LIVE ✅`. |
| `PWA-BATCH-01` | **90,0% (`9/10`)** | **90,0% (`9/10`)** | 🟦 IN PROGRESS; `PB-10` входит в Goal. |
| `PWA-SPEAKER-IDENTITY-01` | **0,0% (`0/5`)** | **0,0% (`0/5`)** | ⬜ BACKLOG. |
| `PWA-MANIFEST-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; без изменений. |
| `PWA-STANDARDIZATION-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; `PD-06` входит в Goal. |
| `PWA-REALTIME-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; без изменений. |
| `PWA-OPERABILITY-01` | **77,8% (`14/18`)** | **77,8% (`14/18`)** | 🟦 IN PROGRESS; без изменений. |

`PB-10` и `PD-06` не закрыты этим snapshot: implementation не подменяет unknown недостоверным clock, но canonical AC требуют фактический source creation timestamp для полного scope. Их корректное закрытие требует отдельного authority design для local media без embedded metadata и legacy documents.

## Candidate next Goals

Эти items — proposals и не авторизуют implementation:

1. `PWA-INGEST-FOLDERS-01` — bounded local/Drive folder intake и одна target folder для folder batch.
2. `PWA-CLEAR-OPERATIONS-01` — manifest/history/analytics clear flows с explicit confirmation и audit semantics.
3. `PWA-SPEAKER-IDENTITY-01` — names/roles и manual listen-and-assign после privacy/data-retention design.
4. `PWA-REALTIME-MATRIX-01` — representative microphone/display/mixed production LIVE matrix.
5. `COLAB-REALTIME-STABILITY-01` — capture stability после PWA priority scope.

## Blockers и risks

- `File.lastModified` — время изменения, а не создания; оно запрещено canonical rule как fallback для `PB-10`/`PD-06`.
- Source creation metadata участвует в immutable processing snapshot; concurrent mutation должна fail closed до irreversible Google Docs side effect.
- Favorites обязаны быть owner-scoped и повторно проверяться через Google Drive перед назначением output destination; сохранённый ID сам по себе не является текущим write authorization.
- Active-source expiry filtering не должно ломать job/history/detail paths, которые используют durable relations отдельно от active collection.
- Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`); фактический post-deploy state будет reconciled в следующем authorized scope без docs-only PR.
- `main` не имеет platform branch protection/rulesets; documented merge gates проверяются вручную без bypass.

## Sources of truth

- Repository instructions и Goal process: `AGENTS.md`.
- Product scope/AC: `docs/project-spec.md`.
- Current Goal/checkpoint/readiness: этот документ.
- CI/CD и production safety: `docs/ci-cd-rules.md`.
- Actual architecture: `docs/architecture.md`.
- Detailed PWA processing: `docs/studio-processing-contract.md`.
- Historical evidence: `docs/delivery-plan-archive.md` только при reconciliation.

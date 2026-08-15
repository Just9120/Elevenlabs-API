# Delivery plan

## Current dashboard

- 👉 `PWA-REALTIME-CAPTURE-01` — локальный Chrome lifecycle fix реализован и проверен: `3/3`; требуются exact-head CI, deploy и representative Chrome LIVE validation.
- ⏭️ `PWA-INGEST-FAVORITES-01` — отдельный design/implementation slice для owner-scoped target-folder Favorites после выбора persistence semantics.
- 📋 `PWA-INGEST-FOLDERS-01` — затем bounded local/Drive folder intake и одна target folder для folder batch.
- 📋 `PWA-ARBITRARY-SEGMENTS-01` — затем arbitrary N-fragment plan вместо narrow two-project split.
- 💤 `COLAB-REALTIME-STABILITY-01` — подтверждённый gap, но owner установил более низкий приоритет относительно PWA.

## Readiness snapshot

Процент — выполненные равновесные atomic acceptance criteria / все AC текущего scope. Project percentage считается по `78/109`, а не как среднее эпиков. Evidence — отдельные readiness gates.

| Product/epic | Current | Previous snapshot | Readiness/Evidence |
|---|---:|---:|---|
| **Project** | **71,6% (`78/109`)** | **71,6% (`78/109`)** | Product AC не изменились: scoped capture fix не закрывает `PR-06` без production LIVE matrix. |
| **Google Colab** | **75,9% (`22/29`)** | **75,9% (`22/29`)** | Без изменений в current PWA scope. |
| `COLAB-BATCH-01` | **73,9% (`17/23`)** | **73,9% (`17/23`)** | 🟦 IN PROGRESS; `SPEC ✅ CODE ◐ TEST ◐ CI ✅ DEPLOY ◐ LIVE ◐`. |
| `COLAB-REALTIME-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; capture stability не подтверждена. |
| **Studio PWA** | **70,0% (`56/80`)** | **70,0% (`56/80`)** | Capture lifecycle fix локально готов; `PR-06` остаётся незакрытым до representative production canaries. |
| `PWA-CORE-01` | **84,6% (`11/13`)** | **84,6% (`11/13`)** | 🟦 IN PROGRESS; нет active-UI expiry removal и color selector. |
| `PWA-INGEST-01` | **63,6% (`7/11`)** | **63,6% (`7/11`)** | 🟦 IN PROGRESS; нет Favorites и folder intake. |
| `PWA-SEGMENTS-01` | **0,0% (`0/5`)** | **0,0% (`0/5`)** | 🟦 IN PROGRESS; текущий two-part split не выполняет arbitrary-N AC целиком. |
| `PWA-BATCH-01` | **90,0% (`9/10`)** | **90,0% (`9/10`)** | 🟦 IN PROGRESS; explicit English закрыт, source-created timestamp отсутствует. |
| `PWA-SPEAKER-IDENTITY-01` | **0,0% (`0/5`)** | **0,0% (`0/5`)** | ⬜ BACKLOG; PWA names/roles/listen-and-assign отсутствуют. |
| `PWA-MANIFEST-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; нет safe clear action. |
| `PWA-STANDARDIZATION-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; нет original-source creation authority. |
| `PWA-REALTIME-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; local fix `3/3`, `SPEC ✅ CODE ✅ TEST ✅ CI ◐ DEPLOY ◐ LIVE ◐`; full production live matrix отсутствует. |
| `PWA-OPERABILITY-01` | **77,8% (`14/18`)** | **77,8% (`14/18`)** | 🟦 IN PROGRESS; exports/success percentage закрыты, clear-operation AC остаются. |

Изменение current scope: `0` product AC при неизменном denominator `109`. Scoped fix выполнен на `3/3`, но `PR-06` остаётся невыполненным до representative production LIVE canaries.

## Active execution checkpoint

- Updated (UTC): 2026-08-15T06:13:13Z
- Session mode: FOCUSED_TASK
- Delivery stage: VALIDATING
- Work item / epic: `PWA-REALTIME-CAPTURE-01` / `PWA-REALTIME-01`
- Authorization source: explicit owner command «ок, делай» от 2026-08-15 после evidence-backed Chrome capture diagnosis
- Authorized scope: продолжать live capture при `visibilitychange=hidden`; завершать capture только по audio-track lifecycle, а не вспомогательному display video track; regression tests, truthful UI limitation, operational docs и delivery flow
- Non-goals: automatic reconnect, provider/API behavior, transcript persistence, batch flow, Colab realtime, migrations, dependencies, CI/CD policy и unrelated cleanup
- Base branch: `main`
- Base SHA: `f90e0d7b3b10d345a9ea6ff34f5b8c3025d818d7`
- Working branch: `codex/fix-pwa-realtime-capture`
- Last verified revision: `907ba24d5e0a058bbacf04f28dc98f6d2fac8676`
- Working tree: CLEAN — implementation commit `907ba24` проверен; operational documentation фиксируется отдельным pre-push commit
- Completed since base: commit `907ba24` удалил hidden-tab auto-stop, сохранил `pagehide`/unmount cleanup, ограничил `ended` listener audio tracks и добавил regressions
- Current step: synchronizing independently recalculated readiness and checkpoint before branch publication
- Next exact action: commit operational docs, push branch and create one focused Pull Request
- Validation and Evidence: focused Vitest `29/29`, full Studio Vitest `503/503`, ESLint, TypeScript `tsc -b`, production Vite/PWA build и `git diff --check` прошли локально
- Pull Request: N/A — branch пока не опубликована
- CI/checks: exact branch head не проверен; baseline `main@f90e0d7` имел успешные `CI` и `Studio PWA CI`
- Deployment/environment: fix revision не merged и не deployed; baseline CD run `31848408276` успешно доставил web/API для `main@f90e0d7`
- Blockers: none before PR; product `PR-06` требует post-deploy representative Chrome canary
- Unverified assumptions: точный Chrome event sequence владельца не наблюдался агентом; исходный hidden-tab stop и auxiliary-video subscription подтверждены code/tests, а прежняя production session работала во внутреннем браузере при видимой Studio вкладке
- Preserved pre-existing changes: none; branch создана из clean synchronized main

## Active item — `PWA-REALTIME-CAPTURE-01`

Goal: устранить подтверждённые browser lifecycle stop-trigger’ы, из-за которых Chrome мог сбрасывать display capture при переходе на захватываемую вкладку или завершении вспомогательного video track.

Atomic delivery AC:

1. Active live capture не останавливается при `document.visibilityState=hidden`; `pagehide`, unmount, explicit stop и переход в batch сохраняют существующий cleanup.
2. Display video track не управляет audio-session lifetime; окончание выбранного audio track по-прежнему останавливает session с безопасной ошибкой.
3. UI больше не заявляет скрытие вкладки причиной остановки; focused regressions и full Studio validation проходят.

Readiness item: **100% (`3/3`)** по завершённым local delivery AC. Required Evidence: `SPEC ✅ | CODE ✅ | TEST ✅ | CI — | DEPLOY — | LIVE —`; Evidence gates не меняют percentage. Product AC `PR-06` остаётся **❌**, поэтому `PWA-REALTIME-01` сохраняет **83,3% (`5/6`)**.

## Roadmap и critical path

1. **PWA realtime capture:** local fix `3/3`; пройти exact-head CI, merge, `studio-web` deployment и representative Windows/Chrome display-session LIVE validation.
2. **Target-folder Favorites:** выбрать owner-scoped persistence semantics, затем реализовать отдельным slice без смешивания с diagnostics.
3. **Source creation authority:** добавить source-created timestamp в local upload/Drive snapshots, migration/backfill semantics и Google Docs/standardization flow. Prerequisite для двух эпиков; требует data/schema review.
4. **Folder intake:** bounded Drive folder enumeration и browser directory upload; reuse multi-source preflight, R2 lifecycle и duplicate authority.
5. **Arbitrary fragments:** generalized ordered fragment model, API schema, immutable snapshots, preflight, worker clipping/output, migrations и UI builder. На critical path после стабильного source intake.
6. **Clear operations:** manifest, history и analytics с owner scope, explicit Да/Нет, retention/audit semantics и protection от accidental/partial delete.
7. **Speaker identity:** names/roles persistence и bounded manual sample playback/assignment. Перед кодом нужен privacy/data-retention design; automatic biometric matching не предполагается.
8. **Runtime stabilization:** authenticated UX/UI audit, representative batch/live canaries, exact component deploy identity, health/smoke и rollback readiness.
9. **Colab follow-up:** local-folder intake, English, manifest semantics/source time; realtime capture stability после PWA priority scope.

Validation gates для каждого implementation slice: focused tests → relevant Python/Studio regression → lint/type/build → PR exact-head checks → merge gates → component-specific CD → exact revision health/smoke/LIVE evidence → safe branch cleanup.

## Verified drift и debt

- **VERIFIED — DOCUMENT / CONSOLIDATE:** old `project-spec` был English, не epic-structured и конфликтовал с новым scope по Drive folder intake, arbitrary cutting, explicit English и speaker identity. Он заменён одним canonical requirements matrix.
- **VERIFIED — DOCUMENT:** old delivery dashboard показывал project `N/A` и Colab `2/2`; он не измерял текущий product scope и архивирован как incomparable snapshot.
- **VERIFIED — REFACTOR:** Colab visible timestamp использует legacy display format/job time, PWA output использует worker clock; оба расходятся с source-created ISO rule. Blast radius: source models, Drive/local intake, output formatter, standardization/backfill, tests и migration.
- **VERIFIED — REFACTOR:** PWA composer ограничен `full|first|second` и одним boundary. Blast radius: frontend model/UI, API request schema, job rows/migration, duplicate identity, preflight, worker media clipping и output/history.
- **VERIFIED — CONSOLIDATE:** `docs/studio-processing-contract.md` и `docs/architecture.md` остаются supporting detailed contracts; их нельзя превращать во второй product backlog. При последующих code slices обновлять только затронутые actual boundaries.
- **PROBABLE — DOCUMENT/DEFER:** dated audit `docs/audits/repository-audit-2026-07-26.md` stale как current navigation label, но полезен как historical supporting evidence; удаление не авторизовано и не требуется.
- **VERIFIED — DOCUMENT:** approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`); post-deploy status нельзя синхронизировать direct push без отдельного approved mechanism.

## Blockers и risks

- `PWA-SPEAKER-IDENTITY-01` требует design решения о lifetime/access для voice fragments; automatic biometrics не входят в current interpretation.
- Source creation time доступно у Drive metadata, но browser-local file creation semantics и trustworthy fallback требуют явного технического contract.
- Folder intake увеличивает cost/size/duplicate blast radius; нужны server bounds и preview до persistence/provider execution.
- Current GitHub Settings не обеспечивают platform required checks на `main`; агент всё равно применяет documented acceptance gates и не использует bypass.
- Последний exact Studio code deployment обновил только web; broad PWA LIVE claims остаются частичными.

## Audit quality review

- Coverage gaps: не выполнялся authenticated browser UX/UI audit, production DB query, paid ElevenLabs call, Google Docs write, R2 expiry wait или manual Colab run.
- Unverified assumptions: `.txt` трактуется как export; login допускает email как login identifier; voice identification трактуется как manual assignment после прослушивания, не biometrics.
- Возможные false positives: hidden operator-only manifest cleanup или UI color feature могли быть пропущены при static search; production runtime может опережать repository evidence.
- Возможные false negatives: source-level tests могут подтверждать happy path, но не выявлять browser capture instability, provider/Google/R2 failures или deployment drift.
- Confidence: **MEDIUM** — code/test/config и GitHub evidence покрыты хорошо, но полный authenticated/runtime product audit ещё не выполнен.

## Sources of truth

- Instructions/authority: `AGENTS.md`.
- Product scope/AC: `docs/project-spec.md`.
- Current execution: этот документ.
- Delivery lifecycle: `docs/agent-delivery-workflow.md`.
- CI/CD safety: `docs/ci-cd-rules.md`.
- Actual architecture: `docs/architecture.md`.
- Detailed PWA processing: `docs/studio-processing-contract.md`.
- Historical evidence: `docs/delivery-plan-archive.md` только при reconciliation.

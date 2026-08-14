# Delivery plan

## Current dashboard

- 👉 `PWA-LANGUAGE-DIAGNOSTICS-01` — explicit English реализован end-to-end; далее в этой ветке JSON/YAML/TOML diagnostics exports и explicit analytics success percentage.
- ⏭️ `PWA-INGEST-FAVORITES-01` — отдельный design/implementation slice для owner-scoped target-folder Favorites после выбора persistence semantics.
- 📋 `PWA-INGEST-FOLDERS-01` — затем bounded local/Drive folder intake и одна target folder для folder batch.
- 📋 `PWA-ARBITRARY-SEGMENTS-01` — затем arbitrary N-fragment plan вместо narrow two-project split.
- 💤 `COLAB-REALTIME-STABILITY-01` — подтверждённый gap, но owner установил более низкий приоритет относительно PWA.

## Readiness snapshot

Процент — выполненные равновесные atomic acceptance criteria / все AC текущего scope. Project percentage считается по `74/109`, а не как среднее эпиков. Evidence — отдельные readiness gates.

| Product/epic | Current | Previous snapshot | Readiness/Evidence |
|---|---:|---:|---|
| **Project** | **67,9% (`74/109`)** | **67,0% (`73/109`)** | `PB-03` закрыт; Project не `READY`. |
| **Google Colab** | **75,9% (`22/29`)** | **75,9% (`22/29`)** | Без изменений в current PWA scope. |
| `COLAB-BATCH-01` | **73,9% (`17/23`)** | **73,9% (`17/23`)** | 🟦 IN PROGRESS; `SPEC ✅ CODE ◐ TEST ◐ CI ✅ DEPLOY ◐ LIVE ◐`. |
| `COLAB-REALTIME-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; capture stability не подтверждена. |
| **Studio PWA** | **65,0% (`52/80`)** | **63,8% (`51/80`)** | Explicit English добавлен в batch/realtime и safe analytics DTO. |
| `PWA-CORE-01` | **84,6% (`11/13`)** | **84,6% (`11/13`)** | 🟦 IN PROGRESS; нет active-UI expiry removal и color selector. |
| `PWA-INGEST-01` | **63,6% (`7/11`)** | **63,6% (`7/11`)** | 🟦 IN PROGRESS; нет Favorites и folder intake. |
| `PWA-SEGMENTS-01` | **0,0% (`0/5`)** | **0,0% (`0/5`)** | 🟦 IN PROGRESS; текущий two-part split не выполняет arbitrary-N AC целиком. |
| `PWA-BATCH-01` | **90,0% (`9/10`)** | **80,0% (`8/10`)** | 🟦 IN PROGRESS; explicit English закрыт, source-created timestamp отсутствует. |
| `PWA-SPEAKER-IDENTITY-01` | **0,0% (`0/5`)** | **0,0% (`0/5`)** | ⬜ BACKLOG; PWA names/roles/listen-and-assign отсутствуют. |
| `PWA-MANIFEST-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; нет safe clear action. |
| `PWA-STANDARDIZATION-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; нет original-source creation authority. |
| `PWA-REALTIME-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; source/tests есть, full production live matrix отсутствует. |
| `PWA-OPERABILITY-01` | **55,6% (`10/18`)** | **55,6% (`10/18`)** | 🟦 IN PROGRESS; missing export/clear/success-percentage AC. |

Изменение current scope: `+1` выполненный AC (`PB-03`), при неизменном denominator `109`.

## Active execution checkpoint

- Updated (UTC): 2026-08-14T21:48:08Z
- Session mode: FOCUSED_TASK
- Delivery stage: IMPLEMENTING
- Work item / epic: `PWA-LANGUAGE-DIAGNOSTICS-01` / `PWA-BATCH-01`, `PWA-OPERABILITY-01`
- Authorization source: explicit owner requirements от 2026-08-14 и непрерывная команда продолжать PWA implementation
- Authorized scope: explicit English end-to-end; safe diagnostics export в Markdown/JSON/YAML/TOML; explicit analytics success percentage; related tests, operational docs и delivery flow
- Non-goals: Favorites/persistence, folder intake, arbitrary fragments, clear operations, source-created timestamp, speaker identity, migrations, production dependencies, CI/CD policy и unrelated cleanup
- Base branch: `main`
- Base SHA: `8fe0dd722d0433440b41ef6dfe0fa0489f8f8fb8`
- Working branch: `feature/pwa-language-diagnostics`
- Last verified revision: `8fe0dd722d0433440b41ef6dfe0fa0489f8f8fb8`
- Working tree: DIRTY — intended English implementation, tests и operational docs only
- Completed since base: previous PR #210 closure reconciled; English `en` добавлен в typed API, batch/realtime UI, provider boundary, preflight parser, display labels и safe analytics language bucket; `PB-03` пересчитан как выполненный
- Current step: English slice локально validated; readiness/checkpoint подготовлены к atomic commit
- Next exact action: review diff и создать atomic commit English slice
- Validation and Evidence: Python option/analytics unit tests `5/5`; focused Studio Vitest `257/257`; TypeScript build mode и focused ESLint прошли; integration tests для API route сохранены, но локально не собраны из-за отсутствующего Alembic в bundled runtime и остаются exact-head CI gate; `git diff --check` прошёл
- Pull Request: N/A
- CI/checks: N/A before push; last exact-main baseline CI success at merge commit `8fe0dd722d0433440b41ef6dfe0fa0489f8f8fb8`
- Deployment/environment: code scope требует component-specific CD и LIVE evidence после merge; пока N/A before PR
- Blockers: none for current local implementation
- Unverified assumptions: no paid provider call или authenticated browser LIVE canary; API integration coverage ожидает CI runtime
- Preserved pre-existing changes: none; branch создана из clean synchronized main

## Active item — `PWA-LANGUAGE-DIAGNOSTICS-01`

Goal: закрыть пять малорисковых PWA AC без новой dependency, persistence или architecture boundary.

Atomic delivery AC:

1. `PB-03`: explicit English проходит через PWA batch/realtime UI, typed API/preflight, provider mapping, persisted/displayed language mode и safe analytics.
2. `PO-05`: safe filtered diagnostics report скачивается как valid JSON.
3. `PO-06`: тот же safe report скачивается как valid YAML без новой production dependency.
4. `PO-07`: тот же safe report скачивается как valid TOML без новой production dependency.
5. `PO-15`: analytics явно показывает success percentage с определённым denominator terminal outcomes.

Readiness item: **20,0% (`1/5`)** по завершённым AC. Required Evidence: `SPEC ✅ | CODE ◐ | TEST ◐ | CI — | DEPLOY — | LIVE —`; отсутствие CI/deploy/LIVE gate-ит delivery, но не percentage.

## Roadmap и critical path

1. **PWA language/diagnostics:** завершить JSON/YAML/TOML diagnostics и explicit success percentage после уже реализованного English. Низкий migration risk, быстрый measurable uplift.
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

# Delivery plan

## Current dashboard

- 👉 `PRODUCT-REQUIREMENTS-REFRESH-01` — новая explicit owner baseline разложена на два production-продукта, четыре runtime contour и 109 равновесных atomic AC; выполняется validation и публикация canonical docs.
- ⏭️ `PWA-QUICK-GAPS-01` — следующий implementation slice после merge baseline: explicit English, target-folder Favorites и PWA diagnostics export formats/success percentage без новой architecture boundary.
- 📋 `PWA-INGEST-FOLDERS-01` — затем bounded local/Drive folder intake и одна target folder для folder batch.
- 📋 `PWA-ARBITRARY-SEGMENTS-01` — затем arbitrary N-fragment plan вместо narrow two-project split.
- 💤 `COLAB-REALTIME-STABILITY-01` — подтверждённый gap, но owner установил более низкий приоритет относительно PWA.

## Readiness snapshot

Процент — выполненные равновесные atomic acceptance criteria / все AC текущего scope. Project percentage считается по `73/109`, а не как среднее эпиков. Evidence — отдельные readiness gates.

| Product/epic | Current | Previous snapshot | Readiness/Evidence |
|---|---:|---:|---|
| **Project** | **67,0% (`73/109`)** | **N/A** | Первый закрытый project-wide denominator. Project не `READY`. |
| **Google Colab** | **75,9% (`22/29`)** | **100% (`2/2`)** | Previous denominator учитывал только два contour labels и не измерял feature AC; сравнение не является регрессией. |
| `COLAB-BATCH-01` | **73,9% (`17/23`)** | N/A | 🟦 IN PROGRESS; `SPEC ✅ CODE ◐ TEST ◐ CI ✅ DEPLOY ◐ LIVE ◐`. |
| `COLAB-REALTIME-01` | **83,3% (`5/6`)** | N/A | 🟦 IN PROGRESS; capture stability не подтверждена. |
| **Studio PWA** | **63,8% (`51/80`)** | **N/A** | В старом dashboard полного PWA denominator не было. |
| `PWA-CORE-01` | **84,6% (`11/13`)** | N/A | 🟦 IN PROGRESS; нет active-UI expiry removal и color selector. |
| `PWA-INGEST-01` | **63,6% (`7/11`)** | N/A | 🟦 IN PROGRESS; нет Favorites и folder intake. |
| `PWA-SEGMENTS-01` | **0,0% (`0/5`)** | N/A | 🟦 IN PROGRESS; текущий two-part split не выполняет arbitrary-N AC целиком. |
| `PWA-BATCH-01` | **80,0% (`8/10`)** | N/A | 🟦 IN PROGRESS; нет explicit English и source-created timestamp. |
| `PWA-SPEAKER-IDENTITY-01` | **0,0% (`0/5`)** | N/A | ⬜ BACKLOG; PWA names/roles/listen-and-assign отсутствуют. |
| `PWA-MANIFEST-01` | **83,3% (`5/6`)** | N/A | 🟦 IN PROGRESS; нет safe clear action. |
| `PWA-STANDARDIZATION-01` | **83,3% (`5/6`)** | N/A | 🟦 IN PROGRESS; нет original-source creation authority. |
| `PWA-REALTIME-01` | **83,3% (`5/6`)** | N/A | 🟦 IN PROGRESS; source/tests есть, full production live matrix отсутствует. |
| `PWA-OPERABILITY-01` | **55,6% (`10/18`)** | N/A | 🟦 IN PROGRESS; missing export/clear/success-percentage AC. |

Изменение project readiness более чем на 10 percentage points объясняется созданием нового denominator: previous snapshot был `N/A`, а прежние `2/2` для Colab были contour labels, не feature acceptance criteria.

## Active execution checkpoint

- Updated (UTC): 2026-08-14T21:29:13Z
- Session mode: INITIAL_AUDIT
- Delivery stage: VALIDATING
- Work item / epic: `PRODUCT-REQUIREMENTS-REFRESH-01`
- Authorization source: explicit owner requirements от 2026-08-14 и команда продолжать от 2026-08-15
- Authorized scope: зафиксировать два production-продукта и четыре contour, независимо сверить requirements с code/tests/CI/runtime evidence, создать atomic AC denominator, обновить русскоязычные canonical docs и delivery roadmap
- Non-goals: implementation product gaps в этой docs baseline branch; workflows, GitHub Settings, secrets, production runtime, migrations, CI/CD policy, destructive cleanup
- Base branch: `main`
- Base SHA: `a252a1efa54ba952ec4eb04405fae5722f15d7b5`
- Working branch: `feature/product-requirements-v2`
- Last verified revision: `a0195b9f243bc32f0d7e062c6c9b8b5cc237d578`
- Working tree: DIRTY — intended final checkpoint update after clean commit `a0195b9`
- Completed since base: owner requirements mapped to 109 atomic AC; code/test/config evidence inspected; exact remote CI/CD evidence queried; README/spec translated and restructured; stale PR #209 checkpoint moved to archive; commit `a0195b9` created
- Current step: all available local validation passed; recording pre-push checkpoint
- Next exact action: commit this final checkpoint, push branch and open one Pull Request
- Validation and Evidence: denominator script reproduced every epic and total `73/109`; bundled-Python `scripts/ci_checks.py` passed all lightweight checks; `git diff --check`, Markdown relative-link check, required security/realtime marker assertions and provider-doc sentinel passed; focused documentation pytest passed `7/7`; broader focused selection passed `237` tests but had `7` environment-only setup errors because pytest could not access its Windows temp root, with no assertion failures; run `31823766931` succeeded for exact main; Studio CI `31818095864` and repository CI `31818095906` succeeded at last code revision `830bd007`; web-only CD run `31818095877` succeeded
- Pull Request: N/A
- CI/checks: N/A before push
- Deployment/environment: docs-only scope; deployment expected N/A under path detection
- Blockers: none for documentation baseline
- Unverified assumptions: `.txt` wording interpreted as export/download; no authenticated UX session or paid provider/Google canary was run; Colab four-month stability is owner runtime evidence without exact SHA
- Preserved pre-existing changes: none; branch started clean and remains limited to intended docs

## Active item — `PRODUCT-REQUIREMENTS-REFRESH-01`

Goal: заменить неполную и конфликтующую product baseline на проверяемый русский contract, не выдавая source presence за LIVE readiness.

Atomic delivery AC:

1. `docs/project-spec.md` описывает Colab batch/realtime и PWA batch/realtime, структурирован по эпикам и содержит все owner requirements без старых contradictory non-goals.
2. Для каждого текущего эпика и всего проекта указан numerator/denominator и равновесный метод; сумма эпиков воспроизводимо даёт `73/109`.
3. `README.md` на русском, показывает два production-продукта и ссылается на все applicable canonical/operational документы.
4. `docs/delivery-plan.md` содержит только current dashboard, один previous snapshot и active checkpoint; obsolete PR #209 state перенесён в archive.
5. Required repository documentation/security markers, Markdown links, whitespace и relevant repository tests проходят.

Readiness item: **100% (`5/5`)** по content/local validation. Required Evidence: `SPEC ✅ | CODE N/A | TEST ✅ | CI — | DEPLOY N/A | LIVE N/A`; отсутствие CI пока gate-ит delivery, но не percentage.

## Roadmap и critical path

1. **PWA quick gaps:** English mode end-to-end; Favorites; diagnostics JSON/YAML/TOML; explicit success percentage. Низкий migration risk, быстрый measurable uplift.
2. **Source creation authority:** добавить source-created timestamp в local upload/Drive snapshots, migration/backfill semantics и Google Docs/standardization flow. Prerequisite для двух эпиков; требует data/schema review.
3. **Folder intake:** bounded Drive folder enumeration и browser directory upload; reuse multi-source preflight, R2 lifecycle и duplicate authority.
4. **Arbitrary fragments:** generalized ordered fragment model, API schema, immutable snapshots, preflight, worker clipping/output, migrations и UI builder. На critical path после стабильного source intake.
5. **Clear operations:** manifest, history и analytics с owner scope, explicit Да/Нет, retention/audit semantics и protection от accidental/partial delete.
6. **Speaker identity:** names/roles persistence и bounded manual sample playback/assignment. Перед кодом нужен privacy/data-retention design; automatic biometric matching не предполагается.
7. **Runtime stabilization:** authenticated UX/UI audit, representative batch/live canaries, exact component deploy identity, health/smoke и rollback readiness.
8. **Colab follow-up:** local-folder intake, English, manifest semantics/source time; realtime capture stability после PWA priority scope.

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

# Технический аудит репозитория — 2026-08-27

## 1. Scope и метод

Аудит выполнен для локального clean `main@18cbd46e9361a66bfbc1f2265d0820aa72aedf50` и публичного GitHub repository `Just9120/Elevenlabs-API`. Upstream Google Doc «Требования к проекту VoiceOps Studio» прочитан как источник сырых/несогласованных требований, но не использован как implementation authorization или denominator готовности. Canonical product denominator взят только из `docs/project-spec.md` и пересчитан по atomic AC.

Проверены:

- root и applicable repository instructions; nested `AGENTS.md` / `AGENTS.override.md` отсутствуют;
- README, canonical/operational документы, architecture, CI/CD safety contract и relevant runbooks;
- структура, import/reference surfaces, explicit deprecated/legacy paths, migrations, frontend/API/worker boundaries;
- тесты, workflow definitions, dependency-lock state, deployment configuration, defaults и secret handling;
- публичные GitHub PR/run records exact revision;
- безопасная read-only production surface `https://studio.librechat.online/`, `/api/healthz` и `/manifest.webmanifest` без входа в аккаунт, paid/provider calls и mutations.

Не проверены из-за отсутствия доступной authority/evidence:

- GitHub repository settings, Environments, current secret names и branch/ruleset state: локальный `gh auth status` вернул 401;
- authenticated production source workflow, representative manifest mutation, private R2 state, database roles и component image/revision labels;
- реальные Google/ElevenLabs calls и multi-worker processing;
- количественное line/branch coverage: coverage collection/gate в repository не настроены.

## 2. Executive result

- Уже согласованный canonical AC completion после Google Picker correction: **98,0% (`145/148`)** — Colab `29/29`, Studio PWA `116/119`. Это не percentage всей upstream product vision.
- Upstream содержит `275` raw list-item requirements: Colab `16`, PWA `158`, commercial production `101`. Они ещё не reconciled и не atomic, поэтому общий product denominator отсутствует; status полного scope — **`SPEC RECONCILIATION REQUIRED`**, percentage — **`N/A`**.
- Project нельзя обозначить единым `READY`: три из 14 эпиков не READY — `PWA-GOOGLE-PICKER-UX-01` имеет `0/3`, а `PWA-TRANSCRIPTIONS-UX-01` (`LIVE —`) и `PWA-MANIFEST-01` (`LIVE ◐`) не закрыли обязательный LIVE gate. Evidence gate-ит status, но не добавляет проценты.
- Current Goal `PWA-SOURCE-CACHE-01` восстановлена как **`PENDING_EXTERNAL_GATE`**: merge, exact-main CI и web deployment подтверждены; authenticated production LIVE отсутствует.
- Exact `main` подтверждён публичной GitHub history: PR `#244` merged в `18cbd46`; repository CI `32959921859`, Studio/browser CI `32959921773` и Studio Platform CD `32959921827` завершились success.
- Публичный root и `/api/healthz` отвечают `200`; health сообщает `database=reachable`, `migrations=current`. Это не доказывает authenticated flows, exact schema revision или worker state.
- Подтверждён один текущий runtime defect: `/manifest.webmanifest` отдаётся как `application/octet-stream` при `X-Content-Type-Options: nosniff`; W3C media type — `application/manifest+json`.
- Подтверждён один configuration-level least-privilege risk: Compose задаёт `POSTGRES_USER=studio`, а API/worker подключаются как `studio`. Docker Official Image создаёт указанный `POSTGRES_USER` с superuser privileges. Фактическая production role не проверена.
- CI/CD contract требует immutable action SHA, но workflows используют `actions/checkout@v7`, `actions/setup-*@v6`, `actions/upload-artifact@v7`. Текущие GitHub settings повторно не проверены из-за 401.

## 3. Requirements и documentation audit

### 3.1 Upstream reconciliation status

Upstream Google Doc — обязательный вход для reconciliation, а не требования, которые можно просто исключить. В document revision зафиксированы `275` list-item requirements: `16` Colab, `158` PWA и `101` commercial production. Это не готовый denominator: часть пунктов compound, часть помечена «в дальнейшем»/«если потребуется», часть задаёт architecture/legal constraints, а некоторые конфликтуют с current canonical decisions.

Предварительная reconciliation:

| Класс | Upstream groups | Current relation | Требуемое решение |
|---|---|---|---|
| `ALIGNED` | Colab batch; Google Drive intake; language/diarization; fragments; multi-transcriptions; manifest; standardization; большая часть Audio Preparation; history/analytics/diagnostics basics | Уже покрыто current canonical epics полностью или частично. | Сопоставить каждый bullet с exact existing AC и не создавать duplicates. |
| `PARTIAL` | Google Picker viewport/scroll/current-folder UX; themes/accent; session management/re-auth; Drive resumable upload; full storage deletion/version cleanup; audio rename/templates; local processing breadth; job event delivery; cost analytics; admin health/alerts; tamper-resistant audit log | Picker gap уже принят в canonical epic `PWA-GOOGLE-PICKER-UX-01`; для остальных групп код покрывает только часть поведения. | Сохранить Picker как `0/3 BACKLOG`; создать новые atomic AC только для missing remainder остальных групп. |
| `APPROVED BACKLOG` | commercial environment/isolation; Russian infrastructure/data governance; commercial auth; replaceable Russian STT path; quotas/costs; queue fairness; payments; unit economics; security/RLS; notifications; legal readiness | Owner decision `REQ-DEC-001` включил commercial production в durable scope без implementation authorization. | Декомпозировать в отдельные atomic epics и включить в новый denominator; оставить lifecycle `BACKLOG`. |
| `NEW / UNRESOLVED` | personal feature-display modes; expanded realtime continuity/recording/overlay/YouTube; Markdown/SRT/VTT export и другие non-commercial additions | В current denominator отсутствует и отдельного owner decision ещё нет. | Согласовать отдельно; не смешивать автоматически с approved commercial backlog. |
| `EXTERNAL GATE` | российская data localization; legal basis/consents; cross-border transfer; payment/fiscalization; provider permissibility; RPO/RTO | Нельзя закрыть только repository code. | Определить owner/expert evidence, legal decisions и `PENDING_EXTERNAL_GATE` criteria. |
| `CONFLICT` | Upstream menu содержит `Проекты`, canonical UI заменил их на `Транскрибации`; upstream допускает safe automatic retry, current contract fail-closed при uncertain side effects; commercial запрещает voice identification, personal требует её; Colab объявлен frozen, но upstream отмечает intermittent realtime capture break | Нельзя молча выбрать одну сторону. | Owner decision или явное разделение по contour/capability; для realtime — новый bounded LIVE evidence. |

Предлагаемое разбиение missing scope на candidate epics:

1. `ENVIRONMENT-CAPABILITIES-01` — единый main, независимые personal/commercial deployments, isolated resources и capability model.
2. `COMMERCIAL-DATA-GOVERNANCE-01` — РФ infrastructure, data map, retention/deletion, backup restore и legal gates.
3. `COMMERCIAL-IDENTITY-01` — registration/email verification/reset, sessions, re-auth, TOTP и Russian OAuth options.
4. `STT-PROVIDER-ABSTRACTION-01` и `YANDEX-STT-01` — provider capabilities, operational modes, health disablement без automatic cross-provider fallback.
5. `QUOTA-USAGE-ACCOUNTING-01` — reservation, user/global limits, provider cost и immutable job pricing context.
6. `STORAGE-LIFECYCLE-02` — multipart/resumable flows, separated reference buckets, orphan/version cleanup и end-to-end deletion evidence.
7. `JOB-DELIVERY-NOTIFICATIONS-01` — durable event delivery, Web Push/email и replaceable provider modules.
8. `REALTIME-CONTINUITY-02` — reconnect/backfill, recording, overlays/external consumers и expanded exports.
9. `COMMERCIAL-BILLING-01` — tariffs/subscriptions/payments/fiscalization/refunds/idempotent webhooks; gated by business/legal decisions.
10. `OBSERVABILITY-AUDIT-02` — trace correlation, integration health/readiness, alerts и protected audit retention.

До утверждения reconciliation matrix эти эпики — proposals, но они обязаны оставаться видимыми в roadmap. Формулировка «проект 100%» для combined canonical + upstream scope недопустима.

Owner decision log:

| ID | Decision | Consequence |
|---|---|---|
| `REQ-DEC-001` | 2026-08-27: commercial production включить в durable product scope, но пока не реализовывать. | Commercial requirements переходят из `NEW PRODUCT SCOPE` в **approved ⬜ BACKLOG**. Они должны получить отдельные epics/atomic AC и войти в новый denominator после `SPEC-RECONCILIATION-01`; implementation/CI/CD/deploy не авторизованы. |
| `REQ-DEC-002` | 2026-08-27: Google Picker должен оставаться привязанным к viewport с заблокированным background scroll; текущая открытая output folder выбирается без обязательного выбора child, включая empty folder. | Три требования приняты в canonical epic `PWA-GOOGLE-PICKER-UX-01` как **⬜ BACKLOG `0/3`**; denominator Studio увеличен с `116` до `119`, current canonical — с `145` до `148`. Implementation не авторизована. |

### 3.2 Drift и consolidation findings

| Severity | Finding | Evidence | Action |
|---|---|---|---|
| HIGH | Delivery dashboard оставался на открытом PR `#244`, хотя PR merged, CI/CD success. | `docs/delivery-plan.md`; GitHub PR/runs exact `18cbd46`. | `CONSOLIDATE`: восстановить checkpoint и Goal state. |
| HIGH | `docs/project-spec.md` runtime baseline и critical path указывали старые revisions/Goal; future heading содержал denominator `144` вместо `145`. | Sections 6, 8, 9 canonical spec. | `DOCUMENT`: менять только operational metadata/heading, не AC/scope. |
| MEDIUM | README указывал удалённую merged branch и незапущенные CI/DEPLOY. | `README.md`; GitHub history. | `DOCUMENT`: синхронизировать entry point. |
| MEDIUM | `SECURITY.md` описывает Studio и schema `0016` как почти не production-proven, тогда как repository head содержит migrations through `0025` и несколько bounded LIVE records. | `SECURITY.md:8-15`; architecture/delivery records. | `DOCUMENT`: переписать maturity summary без ослабления safety boundaries. |
| MEDIUM | Main operations runbook содержит current-candidate statements для `0018`/`0020` и limitation «no Studio manifest mutation», противоречащие current head `0025` и implemented manifest UI/API. | `docs/runbooks/studio-platform-ops.md:239-277,429-511,650`; architecture/code. | `CONSOLIDATE`: отделить immutable historical rollout examples от current procedure; заменить moving head literals на verified placeholders. |
| MEDIUM | `docs/studio-processing-contract.md` содержит stale limitation «No Studio manifest mutation». | `docs/studio-processing-contract.md:97-104`; manifest routes/frontend/tests. | `DOCUMENT`: уточнить, что mutation ограничена PostgreSQL catalog metadata. |
| LOW | Исторический аудит `docs/runbooks/repository-audit-2026-07-21.md` находится в operational runbooks и ссылается на superseded/удалённые sources. | Сам документ и current router. | `REMOVE` из runbooks navigation и `CONSOLIDATE`/move в `docs/audits/`; сохранить историю, если нужны ссылки. |
| LOW | README смешивает canonical/operational navigation и dated historical audit в одной таблице. | `README.md:42-56`. | `CONSOLIDATE`: отдельные «Current authorities» и «Historical evidence». |
| LOW | `AGENTS.md` command profile остаётся `UNSET`, хотя repository commands определены README/runbook/workflows. | `AGENTS.md` command table. | `DEFER`: это repository-agent-policy change и требует explicit task. |

Подтверждённых duplicate canonical product contracts нет. `docs/delivery-plan-archive.md` — легитимный historical store и не использован для readiness. Опциональные Context Bundle Builder/AI delivery infrastructure документы и реальные workstreams отсутствуют.

### 3.3 Рекомендуемый consolidation plan

1. Закрыть recovery текущего checkpoint, сохранив только current/previous readiness snapshot.
2. В отдельной documentation Goal синхронизировать `SECURITY.md`, processing contract и Studio ops runbook с head `0025`, не меняя CI/CD safety policy.
3. Переместить dated repository audit из `docs/runbooks/` в `docs/audits/` либо заменить его redirect/index note; проверить inbound links.
4. Разделить README navigation на authoritative current docs и historical evidence.
5. После owner reconciliation upstream создать canonical epics/AC только для явно утверждённых новых capabilities.

## 4. Code и architecture audit

### 4.1 Legacy/dead/duplicate/orphaned code

| Confidence | Surface | Finding | Action |
|---|---|---|---|
| HIGH | `apps/studio-api/studio_api/main.py:1568,1842` | Два API endpoint явно `deprecated=True`, но тесты и compatibility behavior сохранены. Usage telemetry отсутствует. | `DEPRECATE`: документировать clients/removal window; не удалять до доказательства отсутствия consumers. |
| HIGH | `transcript_catalog_routes.py:62,222,242` | Legacy combined `/api/transcript-catalog/migration/*` routes остаются fail-closed compatibility layer; frontend использует split maintenance surfaces. | `CONSOLIDATE`: добавить deprecation contract/telemetry, затем удалить отдельной Goal. |
| MEDIUM | `studio_api/cli.py:23-30` | `cleanup-expired-sources` почти не документирован и использует owner label `legacy-source-cleanup`; worker idle cleanup покрывает operational path. | `DOCUMENT` ownership/usage; затем `DEPRECATE`, если production callers отсутствуют. |
| HIGH | `elevenlabs_api.py` | 9,472-line Colab-generated canonical source содержит notebook magic и не является valid standalone Python. Это intentional artifact, проверяемый `scripts/ci_checks.py`, а не dead code. | `DOCUMENT`; не refactor/remove без отдельной Colab Goal. |
| HIGH | notebooks, migrations, `package-lock.json`, `vite-env.d.ts` | Generated/history/ambient surfaces имеют действующую build/test/schema роль. | `DEFER`: keep; не классифицировать как dead/vendored. |

Статический reference/import review не подтвердил иной unreachable/orphaned application module. Отсутствие runtime telemetry означает, что negative finding имеет `MEDIUM` confidence: dynamic imports, CLI/operator calls и external API consumers могут дать false negative.

### 4.2 Architecture и технический долг

| Priority | Finding | Evidence | Action |
|---|---|---|---|
| P1 | Production manifest MIME неверен. | LIVE `Content-Type: application/octet-stream`; `apps/studio/nginx.conf` не задаёт `.webmanifest` type. | `REFACTOR` в bounded Goal: type mapping + regression/live checks. |
| P1 | Google Picker modal не lock-ит background scroll и не сохраняет viewport position; текущую открытую/empty target folder нельзя подтвердить без child selection. | Owner LIVE 2026-08-27; `googlePicker.ts:185-298`; tests проверяют builder config, но не required behavior. | `REFACTOR` отдельной Goal: scroll lifecycle + verified folder-browser/Picker selection design + browser regression. |
| P1 | DB least privilege не доказан и по clean initialization нарушается. | `compose.platform.yml`: `POSTGRES_USER=studio`, API/worker `STUDIO_DATABASE_USER=studio`; official image semantics. | `REFACTOR`: отдельные bootstrap/migration и application roles; сначала read-only production role evidence и migration plan. |
| P1 | CI action integrity ниже собственного contract. | Workflows используют version tags; `docs/ci-cd-rules.md:82,521-525`. | `REFACTOR`: pin verified full SHAs и включить applicable policy отдельной CI/CD Goal. |
| P1 | Component CD может deploy более новый `origin/main`, чем triggering SHA. | Deploy script materialизуется из `origin/main`; contract уже фиксирует gap. | `REFACTOR`: передавать/проверять exact expected SHA; не менять без CI/CD Goal. |
| P2 | Frontend и API — large change hotspots. | `App.tsx` 8,885 lines; `App.test.tsx` 15,108; `main.py` 2,816; wildcard imports в API. | `REFACTOR` постепенно по feature slices/router boundaries; не делать big-bang rewrite. |
| P2 | Несколько owner/project collections не paginated. | Projects/sources/favorites/speakers/jobs используют `.all()`; history clear скрывает, но не удаляет terminal jobs. | `REFACTOR`: cursor pagination, retention/archival decision, query budgets и indexes/perf tests. |
| P2 | SQLAlchemy engine использует только `pool_pre_ping`, без explicit pool/timeout budget. | `studio_api/db.py:7`. | `DOCUMENT` expected concurrency; затем tune на основании load evidence. |
| P2 | API/worker/Postgres/Redis image tags не immutable digest-pinned. | API `python:3.11-slim`; Compose `postgres:17`, `redis:7-alpine`; web stages pinned. | `CONSOLIDATE`: immutable base/runtime image policy и update procedure. |
| P2 | Multi-worker correctness не подтверждена. | Lease design/tests есть; delivery records — bounded single-worker. | `DEFER` READY claim; добавить controlled concurrency tests/canary до scaling. |
| P3 | Provider/storage boundaries hard-coded под current ElevenLabs + один S3/R2 namespace. | Config, processing modules, canonical scope. | `DEFER`: это upstream future scope, не current defect. |

Положительные architecture findings: явные browser/API/worker/DB/storage trust boundaries; owner-scoped durable state; Argon2id и AES-GCM; server-only BYOK/OAuth secrets; fail-closed uncertain external side effects; PostgreSQL leases/checkpoints; bounded TTL/size policies; private presigned upload capabilities; additive linear migrations; безопасные diagnostics contracts.

## 5. Tests и coverage

### 5.1 Фактический test surface

- 1,069 Python `def test_*` declarations в 85 test files; parametrization увеличивает фактическое число cases.
- 462 frontend `it/test` declarations в 52 test/spec files, включая 11 Playwright E2E scenarios.
- Exact-main repository CI run `32959921859` success.
- Exact-main Studio CI run `32959921773`: `studio` и `browser-e2e` success.
- Latest scheduled dependency audit `32692078587` success на `d11120c`; dependency manifests/locks между этой revision и `18cbd46` не менялись.
- Локально: `scripts/ci_checks.py` PASS; `git diff --check` PASS.
- Локальный syntax review: 194 standard Python files успешно parsed через `ast`; intentional Colab-magic source `elevenlabs_api.py` исключён как не standalone Python.
- Локальный full pytest/frontend suite не повторён: system Python не содержит pytest/dependencies; `npm ci` в OneDrive sandbox не завершился и был остановлен, tracked tree остался clean. Это limitation локального environment, а не test failure продукта.

### 5.2 Coverage gaps

| Gap | Risk | Action |
|---|---|---|
| Coverage collection/threshold отсутствуют. | Нельзя evidence-based назвать line/branch percentage или регрессию coverage. | `DOCUMENT` baseline, затем scoped coverage gate для critical modules. |
| Real Google, ElevenLabs, R2 и signed-in production flows исключены из CI. | Mocked/fake boundaries могут не поймать provider/runtime drift. | Bounded owner-controlled smoke matrix; никаких paid calls без отдельной authority. |
| Source-cache Goal не прошла authenticated production LIVE. | Текущая Goal и UX epic остаются open по Evidence. | Закрыть existing external gate до новой implementation Goal. |
| Google Picker tests не моделируют page scroll и navigation в empty/current folder. | Builder-level test даёт false confidence при фактически сломанном LIVE UX. | Добавить DOM scroll lifecycle и authenticated browser/current-folder scenarios в отдельной Goal. |
| Manifest folder import/clear LIVE только partial. | `PWA-MANIFEST-01` не READY несмотря на `6/6` AC. | Отдельный bounded dry-run/apply/clear canary с backup/confirmation. |
| Нет evidence performance/load/multi-worker. | Unbounded collections и lease races могут проявиться при росте. | Query/load/concurrency test plan с явными limits/SLO. |
| Colab LIVE evidence историческое/owner-reported, в этом аудите не повторено. | Runtime/provider drift может остаться незамеченным. | Periodic manual validation record, не GitHub-hosted long monitoring. |

## 6. Configuration и security audit

### Confirmed/likely findings

1. **Manifest MIME — HIGH confidence.** Production response неверен; влияние на конкретный browser install flow — `MEDIUM`, потому что браузер не сообщил ошибку на unauthenticated load, а installability не проверялась.
2. **DB superuser reuse — HIGH confidence для clean Compose initialization, LOW для actual production role.** Нужен `SELECT rolname, rolsuper` через approved read-only operator procedure; не печатать credentials.
3. **Mutable action tags — HIGH confidence.** Прямое несоответствие repository safety contract и GitHub secure-use recommendation.
4. **Unpinned runtime images — HIGH confidence.** Rebuild reproducibility и supply-chain identity не гарантированы.
5. **`.env.example` не перечисляет часть operational defaults.** В частности provider checkpoint TTL, realtime draft TTL, diagnostics retention/cleanup/build IDs/report limit; defaults есть в `config.py`. Действие `DOCUMENT`, не дублировать secret values.
6. **GitHub protections/settings — UNKNOWN.** Старый project profile нельзя считать current evidence; `gh` token вернул 401.

### Positive controls

- `.dockerignore` есть для web/API и тестируется на исключение dependencies, caches, coverage и secret-shaped files.
- API container после bounded secret copy запускается как UID/GID `10001`.
- Session cookie default `__Host-*`, `Secure`; CSRF/same-origin и exact trusted proxy validation реализованы.
- Rate limiter использует Redis atomic pipeline; TTL/limits валидируются Pydantic constraints.
- Production root отдал CSP, HSTS, `nosniff`, referrer, permissions и frame headers; public console на login page без errors/warnings.
- `/api/healthz` подтвердил только availability/database/migration-current booleans, без sensitive payload.

## 7. Независимый readiness calculation

Denominator: равновесные atomic AC, перечисленные в canonical spec. Выполненность перепроверена по current code/tests, exact-main CI/CD records и доступным runtime/durable evidence. Historical delivery archive не использован как denominator или current state.

| Epic | Calculation | AC readiness | Required Evidence | Status | Confidence |
|---|---:|---:|---|---|---|
| `COLAB-BATCH-01` | `23/23` | 100% | SPEC/CODE/TEST/CI/LIVE ✅; DEPLOY N/A | 🟩 READY | MEDIUM — LIVE не повторён |
| `COLAB-REALTIME-01` | `6/6` | 100% | SPEC/CODE/TEST/CI/LIVE ✅; DEPLOY N/A | 🟩 READY | MEDIUM — LIVE не повторён |
| `PWA-CORE-01` | `14/14` | 100% | все ✅ | 🟩 READY | MEDIUM |
| `PWA-TRANSCRIPTIONS-UX-01` | `4/4` | 100% | SPEC/CODE/TEST/CI/DEPLOY ✅; LIVE — | 🟦 IN PROGRESS | HIGH для AC; LIVE blocked |
| `PWA-INGEST-01` | `11/11` | 100% | все ✅ | 🟩 READY | MEDIUM |
| `PWA-GOOGLE-PICKER-UX-01` | `0/3` | 0% | SPEC ✅; CODE/DEPLOY ◐; TEST/CI —; LIVE ❌ | ⬜ BACKLOG | HIGH |
| `PWA-SEGMENTS-01` | `5/5` | 100% | все ✅ | 🟩 READY | MEDIUM |
| `PWA-BATCH-01` | `10/10` | 100% | все ✅ | 🟩 READY | MEDIUM |
| `PWA-AUDIO-PREPARATION-01` | `24/24` | 100% | все ✅ | 🟩 READY | HIGH |
| `PWA-SPEAKER-IDENTITY-01` | `5/5` | 100% | все ✅ | 🟩 READY | MEDIUM |
| `PWA-MANIFEST-01` | `6/6` | 100% | SPEC/CODE/TEST/CI/DEPLOY ✅; LIVE ◐ | 🟦 IN PROGRESS | HIGH |
| `PWA-STANDARDIZATION-01` | `6/6` | 100% | все ✅ | 🟩 READY | MEDIUM |
| `PWA-REALTIME-01` | `13/13` | 100% | все ✅ | 🟩 READY | MEDIUM |
| `PWA-OPERABILITY-01` | `18/18` | 100% | все ✅ | 🟩 READY | MEDIUM |
| **Google Colab** | `29/29` | **100%** | 2/2 epics READY | — | MEDIUM |
| **Studio PWA** | `116/119` | **97,5%** | 9/12 epics READY | — | HIGH |
| **Current canonical scope** | `145/148` | **98,0%** | 11/14 epics READY | не global READY | HIGH |
| **Full upstream scope** | denominator отсутствует | **N/A** | reconciliation не завершена | `SPEC RECONCILIATION REQUIRED` | HIGH |

Previous independent snapshot утверждённого canonical scope был `145/145`; после добавления трёх ранее пропущенных Google Picker AC current snapshot — `145/148`, то есть `98,0%` и изменение `−2,0 pp`. Разница не превышает `10 pp`, но причина зафиксирована: upstream requirements существовали, user LIVE подтвердил failure, а audit ошибочно принял builder-level configuration за покрытие поведения. Comparison неприменим к полному upstream scope, у которого ещё нет согласованного denominator.

`PWA-AUTH-HARDENING-02` и commercial capabilities не имеют утверждённых atomic AC/denominator. Корректный percentage для них определить нельзя: это `SPEC gap`, а не `0%` или subjective estimate.

## 8. Audit quality review

- **Общая уверенность: MEDIUM.** Source/config/test/CI evidence сильны и exact-revision; authenticated runtime, DB roles, GitHub settings и external integrations не доступны.
- **Coverage blind spots:** dynamic/external API consumers, operator-only CLI calls, real Google/R2/provider behavior, GitHub settings, production worker/schema identity, Colab runtime drift.
- **Possible false positives:** DB superuser reuse может быть устранено operator-side на уже существующем volume; manifest MIME может терпимо обрабатываться конкретным browser; stale runbook passages могут считаться historical examples, хотя они не отделены как history.
- **Possible false negatives:** static reference review не видит dynamic imports/external clients; green CI без coverage threshold не доказывает полноту critical paths; public health не доказывает processing correctness.
- **Safety limitation:** production проверялся только read-only unauthenticated GET; никаких account/data/provider/Google mutations не выполнялось.

## 9. Roadmap и working pipeline

1. **External gate:** закрыть `PWA-SOURCE-CACHE-01` authenticated bounded LIVE и синхронизировать metadata approved механизмом; при отсутствии механизма оставить explicit blocker.
2. **SPEC-RECONCILIATION-01:** requirement-by-requirement mapping всех `275` upstream bullets, owner decisions по conflicts/future markers, atomic decomposition и новый denominator.
3. **PWA-GOOGLE-PICKER-UX-01:** исправить scroll/viewport lifecycle и выбор текущей/empty target folder для source/target flows с browser LIVE.
4. **PWA-MANIFEST-MIME-01:** исправить manifest media type, regression tests, exact-head CI, web deploy и public LIVE header/installability check.
5. **CI-CD-HARDENING-01:** immutable action SHAs, exact deploy revision contract и повторный audit branch/ruleset/Environment settings. Требует explicit CI/CD policy authorization.
6. **DB-LEAST-PRIVILEGE-01:** evidence actual roles, separate migration/application roles, backup/rollback and compatibility plan.
7. **PWA-QUERY-BOUNDS-01:** pagination/retention/query budgets и load/concurrency validation для growing collections.
8. **DOC-CONSOLIDATION-01:** stale runtime/runbook/security facts и dated audit placement без изменения durable product scope.

Рабочий pipeline для любой согласованной implementation Goal: recover/sync verified base → отдельная branch → bounded code/tests/docs → local validation → reviewable commits → один initial push/PR после full local validation → exact-head required CI → один grouped fix batch только при confirmed failure → merge только после gates → applicable CD/LIVE → metadata sync → safe local cleanup → stop.

## 10. Предлагаемая следующая bounded Goal

Следующую product implementation Goal нельзя начинать до closure либо explicit pause текущей `PWA-SOURCE-CACHE-01`. С учётом подтверждённого LIVE defect следующая candidate Goal:

- **ID/title:** `PWA-GOOGLE-PICKER-UX-01` — стабильный viewport и выбор текущей output folder.
- **Scope:** оба source Picker flow и output-folder flow; lock/restore document scroll; viewport-stable modal lifecycle; verified способ выбрать текущую открытую folder, включая empty folder; focused unit/DOM/browser tests и applicable web delivery/LIVE.
- **Non-goals:** изменение Google OAuth scopes; собственный общий Drive file manager; source ingestion/storage semantics; provider calls; backend/schema/worker/CI-CD policy changes.
- **Goal AC:**
  1. `PG-01`: Picker не смещается относительно viewport при попытке прокрутки страницы во всех трёх flows.
  2. `PG-02`: background scroll заблокирован на всём lifecycle Picker и точно восстановлен после pick/cancel/error/timeout без page jump.
  3. `PG-03`: current output folder можно подтвердить без выбора child, в том числе если child folders отсутствуют.
  4. Focused tests воспроизводят оба исходных regression и проходят локально/exact-head CI.
  5. Applicable web deployment и owner-controlled authenticated browser LIVE подтверждают source и output-folder flows.
- **Required Evidence:** `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`.
- **Known blockers:** стандартный Google Picker API может не предоставлять current navigated folder identity отдельным navigation callback; implementation strategy нужно подтвердить prototype/test, при необходимости использовать bounded app-owned folder browser. Текущая Goal всё ещё `PENDING_EXTERNAL_GATE`; GitHub credential в audit session возвращает 401.
- **Stop condition:** все Goal AC и Evidence подтверждены либо Goal переходит в `BLOCKED` / `PENDING_EXTERNAL_GATE`; затем остановиться.

`SPEC-RECONCILIATION-01` остаётся обязательной planning Goal для остальных upstream bullets, но не маскирует уже согласованный Picker defect.

Product implementation не авторизована этим аудитом.

## 11. External evidence links

- Upstream raw requirements: <https://docs.google.com/document/d/1uaYvnqpbns_iyHTtQDZYjNYygT4ikUhmhuhRDWySrzI/edit?tab=t.0>
- GitHub main history: <https://github.com/Just9120/Elevenlabs-API/commits/main>
- PR `#244`: <https://github.com/Just9120/Elevenlabs-API/pull/244>
- Exact-main repository CI: <https://github.com/Just9120/Elevenlabs-API/actions/runs/32959921859>
- Exact-main Studio/browser CI: <https://github.com/Just9120/Elevenlabs-API/actions/runs/32959921773>
- Studio Platform CD: <https://github.com/Just9120/Elevenlabs-API/actions/runs/32959921827>
- Dependency audit: <https://github.com/Just9120/Elevenlabs-API/actions/runs/32692078587>
- W3C Web Application Manifest media type: <https://www.w3.org/TR/appmanifest/>
- Docker Official Image `POSTGRES_USER` semantics: <https://github.com/docker-library/docs/blob/master/postgres/content.md>
- GitHub Actions secure use / immutable SHA pinning: <https://docs.github.com/en/actions/reference/security/secure-use>

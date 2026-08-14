# CI/CD Rules

## 1. Назначение

Этот документ — universal safety contract для CI, build/artifact pipelines, CD/deployment и связанных production operations.

Он задаёт обязательные boundaries, но не является готовым workflow recipe. Каждый adopted project должен заполнить **Project CI/CD profile** в конце документа либо вынести его в один явно указанный canonical file.

Читать документ нужно при изменении workflows, runners, artifacts, secrets, environments, deploy, migrations, rollback, runtime configuration или post-deploy automation. Изменять contract — только по explicit CI/CD policy task.

---

## 2. Universal invariants

1. **CI и CD разделены.** Standard CI проверяет revision и не deploy-ит; CD запускается только от trusted trigger.
2. **Least privilege.** Tokens, Actions permissions, credentials, runner access и environment access минимальны по scope/time.
3. **Untrusted code не получает trusted capability.** PR/fork content не исполняется с production secrets, write token или privileged runner.
4. **Exact identity.** Build/deploy всегда связывается с exact repository, revision/artifact, target и deployment unit.
5. **Fail closed.** Unknown input, identity mismatch, unresolved secret и failed/skipped required gate останавливают flow.
6. **Build once where applicable.** Deploy использует идентифицированный artifact, прошедший required validation.
7. **Stateful work is explicit.** Destructive migration, backup/restore, cleanup и persistent-data operation не скрываются в standard CD.
8. **No secret disclosure.** Secret values не попадают в code, docs, logs, artifacts, caches или generated context.
9. **Auditable outcome.** Run IDs, revision/artifact identity, target environment и post-check result восстанавливаются без raw secret values.
10. **Success after verification.** Deployment success не объявляется до required health/LIVE check.

---

## 3. Required project inputs

До создания или изменения pipeline установи по repository/settings или safe diagnostics:

### CI

- repository и production/default branch;
- supported events и trust model;
- stack, package manager, lockfiles;
- install, lint, typecheck, test и build commands;
- required checks и runner model;
- build outputs/artifacts, если есть.

### CD

- trusted trigger и deploy branch/tag;
- target environment/account/host/cluster;
- target directory/namespace и expected remote/registry, когда применимо;
- expected branch/tag/release и deploy model;
- intended deployment unit;
- exact commit/artifact identity model;
- credential и runtime-config owner;
- environment protection/approval rules;
- health/LIVE checks;
- concurrency/cancellation policy;
- stateful services и migration class;
- rollback/forward-fix policy;
- post-deploy metadata mechanism.

Неизвестные значения не придумывай. Используй `UNSET`, safe diagnostic или blocker.

---

## 4. Trust boundaries и GitHub Actions security

### 4.1. Untrusted pull requests

Workflow, исполняющий untrusted PR/fork code, не получает:

- production secrets/credentials;
- write-capable repository token без narrowly justified job;
- production environment access;
- privileged persistent self-hosted runner;
- право публиковать production-trusted artifact без отдельной trusted validation.

`pull_request_target` и аналогичный privileged context запрещено сочетать с checkout/execute/build untrusted PR code. Для labels/comments/metadata обрабатывай PR values как untrusted data.

### 4.2. Permissions и dependencies

- Задавай `permissions` явно на workflow/job уровне; default — read-only или none.
- Write permissions и `id-token: write` выдавай только нужному job.
- Не передавай write token в steps, которым он не нужен.
- External actions/reusable workflows фиксируй по полному immutable commit SHA; tag допустим только как комментарий.
- Оцени owner, source, permissions, maintenance и supply-chain risk новой dependency.
- Inputs/secrets reusable workflow объявляются явно; broad secret inheritance не используется без необходимости.

### 4.3. Script injection

Не вставляй untrusted GitHub expression напрямую в shell/program source. Передавай значение через quoted environment variable/structured input и валидируй формат. `eval` и dynamic command construction из untrusted data запрещены.

### 4.4. Runners

- Для untrusted PR предпочитай ephemeral GitHub-hosted runner.
- Self-hosted runner должен иметь isolation, patching, cleanup и ограниченный repository/network access.
- Untrusted public-fork code не запускается на runner с internal network, production credentials или persistent sensitive state.
- Deploy runner не используется как общий PR runner.

### 4.5. Credentials, environments и logs

- Предпочитай short-lived/OIDC credentials long-lived static secrets, если provider это поддерживает.
- Production jobs используют protected Environment или эквивалентный gate.
- Allowed branches/tags, required reviewers и approvals не обходятся.
- Не печатай `.env`, resolved secret-bearing config, tokens, private keys или authorization headers.
- Persistent debug, раскрывающий environment/credentials, запрещён.

### 4.6. Concurrency, timeout и retry

- CI может отменять stale runs, если это безопасно.
- Production deploy сериализуется по target environment.
- Cancellation in-progress production deploy задаётся явно; unsafe cancellation запрещена.
- Jobs имеют разумный timeout.
- Retry допустим только для idempotent/transient operations и не скрывает deterministic failure.

---

## 5. CI contract

CI должен:

- запускаться на project-approved events;
- использовать intended revision и clean isolated workspace;
- устанавливать dependencies reproducibly с lockfile при наличии;
- выполнять existing relevant checks;
- валидировать build/configuration, если это часть Definition of Done;
- иметь однозначные required check names;
- завершаться non-zero при required failure;
- сохранять только необходимые artifacts/results.

CI не должен:

- deploy-ить;
- использовать production credentials без отдельного narrowly scoped security job;
- менять protected branch или создавать auto-fix commits по умолчанию;
- ослаблять tests/lint/type gates ради green status;
- считать skipped/cancelled/timed-out required job успешным;
- выполнять unrelated cleanup, migrations или infrastructure operations.

Если конкретный check отсутствует, используй smallest available useful validation и зафиксируй gap. Не добавляй heavy infrastructure только ради формального соответствия.

---

## 6. Build и artifact contract

Если проект deploy-ит package/image/archive:

- artifact создаётся в trusted build context;
- связывается с source SHA и build run ID;
- получает immutable digest/checksum, когда формат это поддерживает;
- не пересобирается молча при promotion между environments;
- не содержит secrets, runtime state или unintended source files;
- имеет подходящие retention и access controls;
- provenance/attestation применяется, когда этого требует risk/profile.

Mutable tag (`latest`, branch tag) не является достаточной identity без immutable digest/version. Artifact untrusted PR не становится production-trusted только из-за успешного workflow.

---

## 7. CD contract

CD запускается только от trusted event/revision согласно Project CI/CD profile.

До изменения target state deployment проверяет:

- expected repository и exact source revision/artifact;
- intended branch/tag/release;
- target environment/account/host/cluster;
- target directory/namespace и expected remote/registry, когда применимо;
- deployment unit/service;
- credentials и runtime configuration presence;
- отсутствие unsafe local tracked changes для git-based deploy;
- migration/stateful preconditions.

CD должен:

- использовать minimal permissions;
- изменять только intended deployment unit;
- быть idempotent или иметь documented safe retry boundary;
- сериализовать production deploy;
- сохранять existing runtime secrets;
- выполнять required post-deploy health/LIVE check;
- публиковать deployment Evidence;
- сообщать success только после required post-check.

CD не должен:

- deploy-ить unreviewed/unverified revision;
- автоматически выбирать неизвестный target;
- выполнять broad cleanup, hardening или bootstrap;
- менять firewall/users/SSH policy без отдельной task;
- удалять persistent data/volumes;
- запускать uncontrolled migration;
- маскировать failed post-check;
- импровизировать destructive rollback.

---

## 8. Runtime configuration и secrets

Canonical runtime-config owner указывается в profile: Environment secrets, secret manager, platform config, target-host file или иной mechanism.

Rules:

- real secret values не коммитятся и не копируются в docs/tests/prompts/bundles;
- `.env.example`, `.env.sample`, `.env.template` содержат только safe schema/examples;
- production `.env` не перезаписывается template-файлом целиком;
- missing non-secret keys можно добавлять только documented idempotent mechanism без изменения existing values;
- unresolved required placeholder блокирует deploy;
- validation проверяет presence/shape без раскрытия value;
- long-lived credentials имеют rotation/revocation procedure.

Не используй команды, способные вывести resolved secrets, только ради validation.

---

## 9. Stateful services и migrations

Stateful services включают databases, queues, Redis, vector/object/file storage, persistent volumes и другие owners невосстанавливаемых данных.

Migration class:

```text
NONE
BACKWARD_COMPATIBLE_AUTOMATED
MANUAL_GATED
```

`BACKWARD_COMPATIBLE_AUTOMATED` допустима в CD только если migration versioned/reviewable, совместима на rollout window, safe on retry, имеет известные timeout/locking/failure behavior, выполненные backup/recovery preconditions и post-check.

`MANUAL_GATED` требует отдельной explicit task со scope/owner, preconditions, backup/recovery plan, downtime/compatibility expectation, validation и stop/rollback/forward-fix criteria.

Standard CD не выполняет backup/restore, volume recreation, destructive cleanup, data move, reindex или irreversible migration без такого contract.

---

## 10. Rollback и forward-fix

Automatic rollback разрешён только когда documented strategy безопасна для deployed artifact, schema и persistent state.

Если rollback safety не доказана:

- останови flow после failed post-check;
- сохрани Evidence;
- не выполняй destructive recovery;
- используй approved forward-fix или manual gated procedure.

Rollback не удаляет/recreate persistent data и не разворачивает application version, несовместимую с уже применённой migration.

---

## 11. Git-based VPS / Docker Compose profile

Этот раздел применяется только к mutable Git checkout + Docker Compose на VPS/server.

До deploy проверь deploy directory, remote URL, branch, target commit, worktree, runtime config, intended Compose project/services и stateful volumes. Для SSH access используй явную host-key verification policy; отключение проверки host identity запрещено.

Code update должен быть fast-forward/checkout exact reviewed revision или эквивалентной безопасной операцией. Broad `reset --hard`/`clean` не является normal deploy strategy.

Deployment изменяет только allowlisted application services. `docker compose down`, volume removal и system-wide prune не входят в standard CD.

Initial bootstrap, deploy-user/SSH setup, directory migration, firewall/hardening и repository access model требуют отдельной setup/maintenance task.

Не путай:

```text
Deploy Key / target credential = target получает repository/artifact
DEPLOY_* workflow secret = GitHub Actions получает доступ к target/provider
```

---

## 12. Forbidden by default

Без отдельной explicit task и safety plan запрещены:

- deploy из обычного CI job;
- production credentials в untrusted workflow;
- direct/force push в protected production branch;
- workflow self-modification или auto-fix commits;
- broad variable-path delete/reset/clean;
- Compose down, volume prune/removal, system-wide prune;
- recursive broad ownership/permission changes;
- printing `.env` или resolved secret-bearing config;
- uncontrolled migration, backup/restore или reindex;
- hidden bootstrap, hardening, cleanup или access-model change;
- destructive rollback без verified recovery path.

Команда оценивается по effect и scope, а не только по имени. Narrow reviewed operation может быть допустима в отдельной maintenance task; broad mutable path остаётся blocker.

---

## 13. Post-deploy metadata mechanism

Автоматическая synchronization status/Evidence после LIVE допустима только если mechanism:

- запускается от trusted deployment result exact revision;
- пишет только allowlisted metadata paths/fields;
- использует minimal write permission;
- не изменяет durable requirements/acceptance criteria;
- защищён от recursive runs;
- создаёт auditable commit/status record;
- не используется для произвольных code changes.

При отсутствии mechanism deployment может быть `LIVE_VERIFIED`, но workflow closure остаётся blocked. Direct push в обход protection rules запрещён.

---

## 14. Evidence contract

### CI Evidence

- workflow/check name и run ID/URL;
- event и exact head SHA;
- required jobs и terminal statuses.

### Build Evidence

- source SHA и build run;
- artifact name/version;
- digest/checksum и provenance reference, если применимо.

### Deployment/LIVE Evidence

- deployment/run ID и target environment;
- deployed commit/artifact identity;
- migration class/result;
- terminal status и post-check result;
- endpoint/service, timestamp и limitations проверки.

Raw logs без exact identity не заменяют Evidence.

---

## 15. Exceptions

Исключение допустимо только по explicit owner/user decision и содержит:

```text
Rule being overridden
Reason
Scope and duration
Risk
Compensating controls
Authorization source
Validation and rollback/stop criteria
```

Исключение narrow и временное, если иное не утверждено явно; оно не становится universal precedent автоматически.

---

## 16. Project CI/CD profile

Заполни profile по фактическому проекту. `UNSET` блокирует соответствующий production flow. Если CD не используется, укажи `cd_enabled: false` и `N/A` для неприменимых полей.

```yaml
profile_version: 1
verified_at_utc: 2026-08-14
status: CONFIGURED

repository:
  expected_repository: Just9120/Elevenlabs-API
  visibility: public
  production_branch: main
  release_tag_policy: N/A
  main_branch_protection: absent
  repository_rulesets: []

ci:
  events:
    repository_ci: [pull_request, push-main, workflow_dispatch]
    studio_ci: [path-filtered-pull_request, path-filtered-push-main, workflow_dispatch]
    dependency_audit: [weekly-schedule, workflow_dispatch]
  runner: GitHub-hosted ubuntu-latest
  install_command:
    python: python -m pip install -r requirements-dev.txt -c constraints-dev.txt
    studio: cd apps/studio && npm ci
  lint_command: cd apps/studio && npm run lint
  typecheck_command: cd apps/studio && npm run build
  test_command:
    repository: pytest -q
    repository_portable: pytest -q --portable
    studio: cd apps/studio && npm run test -- --run
    studio_browser: cd apps/studio && npm run test:e2e
  build_command:
    studio: cd apps/studio && npm run build
    containers: docker build for apps/studio and apps/studio-api
  required_checks:
    platform_enforced: []
    expected_acceptance: [CI / checks, Studio PWA CI / studio, Studio PWA CI / browser-e2e]
    path_note: Studio PWA CI jobs run only for its configured Studio/deploy path set
  lockfile:
    node: apps/studio/package-lock.json
    python: [constraints-dev.txt, apps/studio-api/constraints.txt]
  untrusted_pr_policy: read-only GITHUB_TOKEN; no production secrets or Environment; GitHub-hosted runners

artifacts:
  enabled: true
  type: target-built local Docker images
  identity: immutable Docker image ID captured after build and compared with the running container image ID
  registry_or_storage: N/A
  provenance_required: false

deployment:
  cd_enabled: true
  trusted_trigger:
    component_cd: path-filtered push to main or workflow_dispatch from main
    migration: selected Studio Platform CD job from main
    edge: manual Studio Edge CD dispatch from main with exact full SHA
    worker_operations: manual workflow_dispatch from main with expected full SHA where required
  target_environment: production VPS serving studio.librechat.online
  target_host_or_account: repository/environment secret reference; value is not documentation
  target_directory_or_namespace: /opt/elevenlabs-studio
  expected_remote_or_registry: Just9120/Elevenlabs-API
  expected_branch_tag_or_release: main; protected migration/edge lanes bind an exact 40-character main SHA
  environment_protection:
    standard_component_cd: no GitHub Environment; repository-scoped deploy secrets
    protected_lanes: studio-production-migration
    protected_branch_policy: main only
    required_reviewers: one configured reviewer; prevent_self_review=false
  host_identity_verification: dedicated known-hosts secret for each SSH credential boundary
  deploy_model: mutable trusted VPS checkout plus Docker Compose target-side build/recreate
  deploy_command_or_workflow:
    component_cd: .github/workflows/studio-platform-cd.yml
    migration_probe: .github/workflows/studio-migration-environment-probe.yml
    edge: .github/workflows/studio-edge-cd.yml
    preflight: .github/workflows/studio-processing-preflight.yml
    worker_status: .github/workflows/studio-worker-status.yml
    worker_drain: .github/workflows/studio-worker-drain.yml
  deployment_unit: [studio-web, studio-api, studio-worker, one direct additive Alembic migration, host security-header snippet]
  concurrency_group:
    platform: studio-platform-production
    edge: studio-edge-production
    migration_probe: studio-migration-environment-probe
  cancel_in_progress_policy: false for all production/operations groups
  health_check:
    web: http://127.0.0.1:8181/healthz
    api: http://127.0.0.1:8182/api/healthz
    worker: Docker healthcheck via python -m studio_api.worker_health
    edge: nginx syntax plus local/public TLS headers and local/public API health
  live_check: separate operator-approved canary required for product/runtime behavior; deployment health alone is insufficient

credentials:
  model: repository Actions secrets for ordinary component/worker operations; Environment secrets plus dedicated forced-command SSH identities for migration and edge
  runtime_config_owner: operator-managed target-host deploy/studio/.env and root/operator-owned secret files
  required_secret_names:
    repository: [DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY, DEPLOY_KNOWN_HOSTS]
    migration_environment: [STUDIO_MIGRATION_DEPLOY_HOST, STUDIO_MIGRATION_SSH_KEY, STUDIO_MIGRATION_KNOWN_HOSTS]
    edge_environment: [STUDIO_EDGE_DEPLOY_HOST, STUDIO_EDGE_SSH_KEY, STUDIO_EDGE_KNOWN_HOSTS]
  repository_variable_names: [STUDIO_PLATFORM_CD_ENABLED, STUDIO_MIGRATION_RELEASE_ENABLED, STUDIO_EDGE_RELEASE_ENABLED]

stateful:
  services:
    postgres: persistent Docker volume studio-postgres-data
    redis: non-persistent runtime coordination service
    source_storage: private external S3/R2-compatible object storage
    google_docs: external side-effect owner; not transactionally rollbackable by database restore
  migration_class: MANUAL_GATED
  backup_recovery_contract: one direct additive successor per protected approval and newly verified pre-migration snapshot; restore verification is isolated and never targets production

recovery:
  rollback_or_forward_fix: manual diagnosis and approved forward-fix by default; edge snippet has narrow automatic backup restore; worker rollback is manual and schema-compatible only
  failed_post_check_action: fail loudly, preserve safe Evidence, do not retry or perform destructive rollback automatically

metadata_sync:
  enabled: false
  mechanism: N/A
  allowlisted_paths_or_fields: N/A
  loop_protection: N/A
```

`status: CONFIGURED` допустим только после того, как все применимые поля перестали быть `UNSET` и были сверены с repository/settings или safe diagnostics. Для `cd_enabled: false` CD-only поля должны быть `N/A`, а не фиктивно заполнены.

Profile может быть вынесен в отдельный canonical file, но не дублируется в competing sources.

### 16.1. Verified configuration sources

Profile выше сверён 2026-08-14 с:

- `.github/workflows/*.yml` — девять active workflows;
- `apps/studio/package.json`, `requirements-dev.txt`, `constraints-dev.txt` и `apps/studio-api/constraints.txt`;
- `deploy/studio/compose.platform.yml`, `deploy/studio/.env.example` и project deploy/operations scripts;
- GitHub repository settings API для Actions permissions, Environments, branch protection/rulesets, variables и secret names;
- `docs/runbooks/studio-platform-ops.md` для operator procedures и stop/recovery boundaries.

Secret values, private keys, host values и runtime `.env` values не читались и не являются частью profile.

### 16.2. Active workflow map

| Workflow | Trigger | Jobs/назначение | Production capability |
|---|---|---|---|
| `CI` | `pull_request`, push в `main`, manual | `checks`: PostgreSQL/Redis, Alembic, lightweight checks, full pytest | Нет |
| `Studio PWA CI` | path-filtered PR/push в `main`, manual | `studio`, `browser-e2e`: lint/test/build/images/Compose/authenticated Chromium | Нет |
| `Dependency audit` | weekly schedule, manual | npm и Python advisory audit | Нет; не является обычным PR gate |
| `Studio Platform CD` | path-filtered push в `main`, manual component selection | web/API component CD, protected migration release, manual worker deploy | Да |
| `Studio Migration Environment Probe` | manual from `main` | no-op verification of Environment reviewer gate | Environment gate only; no checkout/secrets/SSH/VPS action |
| `Studio Edge CD` | manual from `main` с exact SHA | protected host security-header release | Да |
| `Studio Processing Preflight` | manual from `main` с expected SHA | read-only production readiness probe | Read-only SSH capability |
| `Studio Worker Status` | manual from `main` с expected SHA | read-only worker identity/health state | Read-only SSH capability |
| `Studio Worker Drain` | manual from `main` с expected SHA | controlled graceful drain and stopped-state verification | Да, mutates worker process state |

Baseline repository and Studio CI must remain secretless: они используют только synthetic test values, не получают production credentials и не делают реальные ElevenLabs, Google, S3/R2 или production calls. Любой credentialed integration/E2E flow требует отдельного explicit scope, isolated trust boundary и approval design.

### 16.3. GitHub repository и Environment state

Фактически подтверждено:

- repository public, default/production branch — `main`;
- workflow token default — `contents: read`; Actions не могут approve Pull Request reviews;
- repository variables: `STUDIO_PLATFORM_CD_ENABLED`, `STUDIO_MIGRATION_RELEASE_ENABLED`, `STUDIO_EDGE_RELEASE_ENABLED`;
- единственный GitHub Environment — `studio-production-migration`;
- Environment ограничен custom branch policy `main` и имеет одного required reviewer;
- Environment содержит отдельные migration и edge secret-name sets; environment variables отсутствуют;
- обычные component/worker/preflight workflows используют repository-scoped `DEPLOY_*` secret names;
- production deployment concurrency не отменяется (`cancel-in-progress: false`).

Environment approval, secret presence и green workflow summary не доказывают deployment конкретного component. Evidence существует только для selected job, exact actual target revision/image и successful post-check.

### 16.4. Current configuration gaps

Это factual gaps, а не authorization на изменение workflows/settings:

1. `main` не имеет branch protection, repository rulesets отсутствуют; GitHub не enforces required checks/reviews. До отдельной настройки `MERGE_GATES_PASSED` требует ручной проверки exact PR head, relevant CI jobs, review/conversation state и mergeability.
2. Repository Actions settings разрешают `allowed_actions: all`, `sha_pinning_required: false`; current workflows используют version tags (`actions/checkout@v7`, `actions/setup-*`, `actions/upload-artifact@v7`), а не full immutable action SHAs. Это не соответствует разделу 4.2 и требует отдельного workflow-hardening scope.
3. Environment API сообщает `can_admins_bypass: true` и `prevent_self_review: false`. Agent/operator не использует admin bypass; каждое фактическое approval проверяется по deployment review history. Изменение Environment settings требует отдельной explicit task.
4. Обычные `deploy-web`, `deploy-api`, `deploy-worker`, preflight/status/drain jobs не bound к GitHub Environment и используют repository secrets. Protected reviewer gate применяется только к migration/edge jobs и no-op probe.
5. Standard component CD fetches current `origin/main` на VPS и проверяет reached target revision, но workflow не передаёт/не сравнивает expected `github.sha`. Если `main` продвинется между trigger и remote fetch, job может развернуть более новый commit. До отдельного fix `DEPLOY` Evidence допустимо только когда logs/target state отдельно подтверждают равенство intended merge SHA и фактически deployed revision.
6. Component images строятся на target VPS и не promotion-ятся из CI registry artifact. Running image ID проверяется против только что built image ID, но отдельная supply-chain provenance/attestation отсутствует.
7. Approved post-deploy metadata writer отсутствует. Не создавай автоматический follow-up PR или direct push только ради deployment IDs; фактический state фиксируется в final report/GitHub records и синхронизируется в следующем authorized scope.

Gap не делает старый run автоматически failed, но запрещает заявлять Evidence шире реально подтверждённой identity/gate surface.

### 16.5. Standard Studio component CD

`.github/workflows/studio-platform-cd.yml` — единственный standard component router:

- automatic push flow включается только при `STUDIO_PLATFORM_CD_ENABLED=true`;
- `apps/studio/**` выбирает `studio-web`;
- non-migration `apps/studio-api/**` выбирает `studio-api`;
- Alembic change не deploy-ит API обычным путём: он выбирает protected migration lane только при `STUDIO_MIGRATION_RELEASE_ENABLED=true`, иначе API/migration остаются intentionally skipped/blocked;
- worker dependency changes не auto-deploy-ят worker; `studio-worker` остаётся manual-only;
- green `deployment-summary` с skipped component jobs не является component deployment Evidence.

Target contract:

- deploy directory `/opt/elevenlabs-studio`;
- expected repository `Just9120/Elevenlabs-API`, branch `main`, clean tracked worktree;
- Compose project `elevenlabs-studio-platform` из `deploy/studio/compose.platform.yml` и operator-owned `deploy/studio/.env`;
- web/API bind только localhost ports `8181`/`8182`; worker не публикует port;
- deploy script materialизуется из trusted fetched `origin/main` и исполняется как файл;
- build/recreate затрагивает только selected service с `--no-deps --force-recreate`;
- PostgreSQL/Redis/volumes/runtime secrets не создаются и не пересоздаются;
- API/worker deploy требует schema equality между current database revision и Alembic head нового image;
- success marker возможен только после built/running image-ID equality и localhost/Docker health.

Standard component CD не выполняет migration, backup/restore, nginx change, provider/Google call, production canary или automatic rollback. Failed health/schema/identity gate завершает job non-zero и требует diagnosis/forward-fix.

### 16.6. Protected additive migration lane

`release-api-migration` — `MANUAL_GATED` stateful release, а не standard component CD.

Обязательные boundaries:

- Environment `studio-production-migration`, branch `main`, explicit reviewer approval и repository variable `STUDIO_MIGRATION_RELEASE_ENABLED=true`;
- отдельные Environment secrets `STUDIO_MIGRATION_DEPLOY_HOST`, `STUDIO_MIGRATION_SSH_KEY`, `STUDIO_MIGRATION_KNOWN_HOSTS`;
- dedicated root SSH identity restricted forced command принимает только `release <40-hex-sha> <head-or-revision>`;
- exact selected SHA должен быть current remote `main`, checkout clean/trusted;
- worker остановлен; PostgreSQL, Redis и API healthy; required runtime/backup/OAuth secret files присутствуют без раскрытия values;
- candidate API image и immutable image ID фиксируются до backup/migration;
- один run выбирает ровно одного direct Alembic successor на single linear repository-head chain, declared `additive`;
- каждый successor требует новое approval и новый tagged pre-migration snapshot;
- snapshot определяется относительно pre-run inventory, восстанавливается только в isolated temporary directory и принимается только после non-empty custom dump + `pg_restore --list` в network-disabled/read-only helper container на immutable healthy PostgreSQL image ID;
- migration выполняется один раз; current revision должен равняться reviewed target;
- intermediate target сохраняет running API и повторно проверяет local/public health; только repository-head target recreates API из captured candidate image ID;
- success требует migration wrapper/program markers и applicable local/public health.

Lane не выполняет downgrade, production restore, automatic retry/rollback, worker deploy, provider/Google call, nginx change, volume operation или stateful-service recreation. Multiple/branched/unclassified/destructive migration fail-closed. Если safe output сообщает `migration_applied=yes`, повторный workflow run запрещён до отдельной диагностики schema/API image state и recovery decision.

`Studio Migration Environment Probe` используется для проверки реального Waiting/reviewer history без checkout, credentials, SSH или runtime mutation. Green no-op job без зафиксированного reviewer pause не доказывает protection gate.

### 16.7. Protected Studio edge lane

`Studio Edge CD` — manual-only release exact current `main` SHA, gated repository variable `STUDIO_EDGE_RELEASE_ENABLED=true` и Environment `studio-production-migration`.

- Используются отдельные `STUDIO_EDGE_DEPLOY_HOST`, `STUDIO_EDGE_SSH_KEY`, `STUDIO_EDGE_KNOWN_HOSTS`; migration/component SSH identities не переиспользуются.
- Dedicated root forced command принимает только `release <40-hex-sha>`.
- Единственная mutable target surface — allowlisted root-owned Studio security-header snippet; active site обязан уже include-ить его.
- Перед mutation создаётся timestamped backup; проверяются шесть allowlisted header directives, `nginx -t`, reload, local/public TLS header values и local/public API health.
- Failure после mutation восстанавливает exact backup, повторяет nginx validation и reload; blind rerun запрещён.

Lane не меняет active site routing, repository source, `.env`, Docker/Compose, containers, PostgreSQL, Redis, migrations, volumes, credentials, Google/provider state.

### 16.8. Worker и operational workflows

Worker lifecycle manual-only:

```text
status → drain → confirm stopped → deploy worker → verify image/commit identity → verify healthy → leave idle
```

- Drain использует normal SIGTERM/Docker stop и считается graceful только при single worker container с `exit_code=0`; `137`, `143`, multiple containers и unknown state fail-closed.
- Worker deploy запрещён при active/restarting/abnormally stopped previous worker, не drains автоматически и не запускает canary.
- New worker image получает commit-specific tag; running image ID и schema compatibility проверяются.
- Resume/rollback выполняются только отдельной approved operator procedure из `docs/runbooks/studio-platform-ops.md`; automatic rollback запрещён.
- Worker health подтверждает process shape, configuration и read-only PostgreSQL connectivity, но не queue progress, provider/Google readiness или production-live behavior.

Processing preflight/status не авторизуют provider call или canary. Controlled canary остаётся отдельным operator-approved LIVE gate с exactly one intended job/output и safe evidence boundary.

---

## 17. Done

### CI

- trust boundary, permissions и intended events явны;
- exact checks воспроизводимы настолько, насколько позволяет проект;
- production secrets/deploy отсутствуют;
- required failures не маскируются.

### CD

- trusted trigger, target и exact revision/artifact подтверждены;
- credentials/runtime config обрабатываются безопасно;
- stateful/migration, concurrency и failure policy соблюдены;
- post-check и Evidence присутствуют;
- success объявлен только после required validation.

### Maintenance/migration

- есть отдельный scope/owner, preconditions, backup/recovery и stop criteria;
- destructive surface минимальна;
- result и residual risk подтверждены Evidence.

# CI/CD Rules

## Purpose

This document defines CI/CD boundaries for repositories that use GitHub Actions, deploy automation, Docker, server/VPS deploy, runtime secrets, or stateful services.

It is a safety and responsibility contract, not a detailed implementation recipe.

Project-specific implementation may evolve, but it must preserve the boundaries below.

---

## Core principle

CI verifies the project.

CD delivers the project.

`source-done/merged` means repository source/docs reached the target branch; it is not the same as `production-live`. Coding-agent PRs must not claim production rollout, migration rollout, runtime processing, or stateful-service changes without explicit runtime/operator evidence.

CI must not deploy.

CD must not perform cleanup, hardening, destructive operations, uncontrolled migrations, backup/restore, or stateful service maintenance unless this is an explicit separate maintenance task.

---

## Scope

This document applies when a task touches:

- GitHub Actions;
- CI workflows;
- CD workflows;
- deploy scripts;
- server/VPS deploy;
- Docker or Docker Compose deploy;
- runtime `.env`;
- Repository Secrets;
- post-checks;
- rollback;
- databases, Redis, queues, vector databases, object/file storage, volumes, or other stateful services.

For ordinary product/code tasks, do not read or apply this document unless CI/CD, deployment, operations, runtime environment, or stateful infrastructure is affected.

---

## Required project inputs

Before preparing or changing CI/CD, determine the relevant values from the repository or safe diagnostics.

Do not invent unknown values.

Minimum CI inputs:

- repository;
- production branch;
- stack and package manager;
- install command;
- lint command, if available;
- typecheck command, if available;
- test command, if available;
- build command, if available;
- lockfile presence;
- existing workflows.

Additional CD inputs:

- target environment;
- deploy branch;
- deploy directory, for example `APP_DIR`;
- expected remote, for example `EXPECTED_REMOTE`;
- expected branch, for example `EXPECTED_BRANCH`;
- target service, for example `COMPOSE_SERVICE`;
- deploy command/model;
- runtime env model;
- health check or post-check;
- secrets required by the workflow, usually `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`;
- stateful services and volumes;
- rollback expectation, if any.

If values are unknown, ask for them or provide safe read-only diagnostic commands.

---

## CI boundaries

CI should:

- run on `pull_request`;
- run on `push` to the production branch, usually `main`;
- support `workflow_dispatch`;
- use minimal `permissions`;
- use a `concurrency` guard;
- use existing project commands;
- use lockfiles when present;
- install dependencies reproducibly where possible;
- run available checks;
- avoid production secrets;
- avoid production infrastructure;
- not deploy;
- clearly report success, for example with `CI_OK`.

Network-backed dependency advisory scans run in a separate scheduled/manual workflow so advisory-service availability cannot block ordinary pull-request or `main` CI. A vulnerability finding fails that audit workflow. A registry or advisory-service outage requires a later rerun and must not be reported as a confirmed product vulnerability or as green audit evidence.

If the project has no tests, CI may run the smallest available useful checks.

Do not introduce heavy testing infrastructure as part of a CI setup unless explicitly requested.

Do not add auto-fix commits, direct pushes to the production branch, or self-modifying workflow behavior unless explicitly requested and reviewed as a separate automation policy.

---

## CD boundaries

CD should:

- run only on intended production delivery events or `workflow_dispatch`;
- use minimal `permissions`;
- use a `concurrency` guard;
- use Repository Secrets without printing values;
- explicitly verify target directory, branch, remote, and service identity before deploy;
- fail safely when required inputs are missing;
- refuse deploy when local tracked changes make update unsafe;
- update code safely, preferably by fast-forward when using git-based deploy;
- preserve existing runtime secrets;
- block deploy when required runtime secrets are unresolved;
- deploy only the intended application service;
- run a post-check;
- when CD builds or pulls an image through a mutable tag, verify before reporting success that the running container uses the intended newly built or pulled image identity because health alone is not sufficient deployment evidence;
- report success, for example `DEPLOY_OK`, only after post-check passes.

Deployment programs must not be executed from stdin when child commands may inherit or consume stdin. Materialize the trusted script or deploy program and execute it as a file; for non-interactive container commands, detach stdin explicitly (for example Docker Compose `-T` plus stdin redirected from `/dev/null`) so a child process cannot consume the remaining deploy program and create a false-success run.

CD implementation details may differ by project. The safety boundaries above must remain intact.

For git-based server/VPS deploy, the expected repository access model must be explicit.

Prefer SSH-based repository access on the target server when that is the established project model. Do not introduce HTTPS/PAT-based deploy access unless explicitly requested.

Initial server bootstrap, SSH/server hardening, deploy-user setup, firewall changes, directory migration, and production cleanup are not standard CD.

They require a separate explicit setup, maintenance, or migration task with scope, validation, and rollback expectations.

Do not hide bootstrap or hardening inside an ordinary CD workflow change.

---

## Secrets and `.env`

Secrets must not be committed, printed, logged, copied into prompts, copied into generated bundles, exposed in examples, or written into tests. Tests and CI must not expose real secrets, mutate secret/env fixtures globally, or write secret fixture files at import time.

`.env.example`, `.env.sample`, or `.env.template` may describe required runtime variables.

Runtime `.env` values must be preserved.

If `.env.example` is used as a runtime schema, CD should safely add missing keys to runtime `.env` without overwriting existing values.

After safe `.env.example` to runtime `.env` sync, deploy scripts must check runtime `.env` for unresolved required placeholders and block deployment with a non-zero exit code before `docker build`, `docker compose up`, restart, migration, or any action that touches the target service.

Use placeholders such as `__REQUIRED_SECRET__` only as schema markers, not as real values.

Do not print or validate runtime secrets with unsafe commands such as `cat .env`, `docker compose config`, or any command that can expose resolved secret values.

Baseline repository and Studio CI must remain secretless: use synthetic test values,
do not require real ElevenLabs, OpenAI, Google, or production credentials, and do
not make real transcription/provider calls. Any future credentialed integration or
end-to-end workflow requires a separate explicitly approved, isolated, and gated
design before credentials are introduced.

---

## Stateful services

Stateful services include:

- databases;
- Redis;
- queues;
- vector databases;
- object/file storage;
- persistent volumes;
- any service that owns data that cannot be casually recreated.

Standard CD must not:

- delete or recreate stateful services;
- remove volumes;
- run destructive migrations;
- run backup/restore;
- reindex vector databases;
- move persistent data;
- perform cleanup that can affect state.

Migrations, runtime changes, and stateful-service work must be separate explicit manual/operator-aware tasks with scope, validation, and rollback expectations.

### Protected stateful release lane

A dedicated stateful release lane is not standard component CD. It may automate
one explicitly approved migration release only when all of these boundaries are
present:

- a protected GitHub environment pauses the job for a required reviewer before
  production credentials or VPS commands are available;
- a separate enable variable defaults to disabled and is switched on only after
  the environment, secrets, runtime configuration, and VPS boundary are ready;
- the VPS identity is dedicated to this lane and restricted by a root-owned
  forced command; workflow input must never become arbitrary root shell;
- the release is bound to the exact current `main` SHA and a clean trusted
  checkout;
- the candidate image is built and its immutable image identity is captured
  before backup or migration;
- PostgreSQL and Redis are healthy, the worker is safely stopped, and required
  runtime secret files are present without printing their values;
- each approved run selects exactly one direct Alembic successor, either the
  repository head or an explicit ancestor target on the repository head's
  single linear chain, and that target revision explicitly declares the
  reviewed `additive` release class;
- a new tagged pre-migration snapshot is created, identified relative to the
  pre-run inventory, restored only into an isolated temporary verification
  directory, and accepted only after one non-empty custom dump passes
  `pg_restore --list` in a network-disabled, read-only helper container bound
  to the immutable image identity of the healthy production PostgreSQL
  service, without an image pull or persistent Docker volume;
- the migration executes once and revision equality is rechecked. An
  intermediate target preserves the running API and rechecks its health; only
  the final repository-head target recreates the API from the captured image.
  Localhost plus public health must pass before either success marker is
  emitted.

Consecutive pending migrations require one protected approval, one new verified
backup, and one workflow run per direct successor. A single run must never
traverse multiple revisions.

The lane must not run a downgrade, database restore, automatic retry, automatic
rollback, worker deployment, provider call, Google side effect, nginx change,
volume operation, or stateful-service recreation. A multiple, branched,
unclassified, destructive, or already-partially-applied migration remains a
separate operator task and must fail closed.

An explicit manual dispatch may select the same protected lane for first
activation or diagnosed recovery before any migration was applied. It does not
authorize blind retry. If safe output reports `migration_applied=yes`, another
workflow run is prohibited until an operator has diagnosed schema and API image
state and selected a separate recovery action.

### Protected host-edge release lane

The Studio public-host nginx boundary is not an ordinary web/API component and
is not a stateful migration. It may use a separate manual-only protected release
lane when all of these controls remain present:

- the workflow has no `push` or `pull_request` trigger and accepts only one full
  lowercase commit SHA;
- a disabled-by-default repository variable and the existing
  `studio-production-migration` protected environment both gate the release.
  Migration and edge releases share this human-approval boundary, while their
  SSH identities, forced commands, enable variables, and secret names remain
  separate;
- the selected SHA is the exact current `main` checkout before production
  credentials become useful;
- GitHub Actions uses a dedicated SSH identity whose root-owned forced command
  accepts only `release <40-hex-sha>`; it must not expose arbitrary shell;
- the VPS fast-forwards a clean trusted `main` checkout and materializes the
  release program from that exact remote-main commit;
- the only mutable runtime target is the allowlisted root-owned Studio security
  header snippet. The active site must already include that exact snippet;
- the release creates a timestamped backup before change, validates the six
  allowlisted header directives, runs `nginx -t`, reloads nginx, and verifies
  both local-TLS and public-TLS exact header values plus local/public API health;
- any failure after mutation restores the exact backup, revalidates nginx, and
  reloads it. Success requires both wrapper and release-program markers.

This lane must not modify the active site, repository source files, `.env`,
Docker/Compose, API/web/worker containers, PostgreSQL, Redis, migrations,
volumes, credentials, Google resources, or provider state. Installing the
forced-command wrapper and authorized key, and adding the lane-specific secrets
and enable variable to the existing protected environment, is a separate
operator-reviewed bootstrap; the workflow must not bootstrap its own trust
boundary.

---

## Forbidden by default

Do not add these to standard CI/CD unless an explicit separate maintenance task justifies them:

- deploy from CI;
- production SSH from CI;
- printing secret values;
- destructive file deletion;
- broad cleanup;
- `rm -rf` cleanup against broad or variable paths;
- `git reset --hard`;
- `git clean -fdx`;
- destructive Docker prune/down operations such as `docker compose down`, `docker system prune -a`, `docker volume prune`, or `docker image prune -a`;
- deleting or recreating volumes;
- printing or validating secrets by unsafe commands such as `cat .env`;
- using `docker compose config` when it can expose resolved secrets;
- changing ownership or permissions recursively with broad `chmod -R` or `chown -R`;
- uncontrolled database migrations;
- backup/restore;
- vector reindex;
- moving production directories;
- changing production `.env` values;
- CI auto-fix commits;
- direct pushes to the production branch from automation;
- workflow self-modification without explicit request and review.

---

## Rollback boundary

Automatic rollback is allowed only when the project has an explicit, safe, documented rollback strategy.

If rollback is not clearly safe, CD should fail loudly after failed post-check and avoid destructive recovery attempts.

Rollback must not violate stateful service boundaries.

Rollback must not delete or recreate persistent data unless the maintenance task explicitly scopes that action and includes validation and recovery expectations.

---

## Deploy Key vs Repository Secrets

Do not confuse:

```text
Deploy Key = target server access to the GitHub repository
DEPLOY_* Repository Secrets = GitHub Actions access to the target server
```

Use the model that matches the project. Do not invent access details.

---

## Environment and branch identity

CD must verify that it is deploying the intended repository, branch, directory, and service before changing runtime state.

Recommended checks for git-based deploy:

- current directory matches expected deploy directory;
- configured remote matches expected repository;
- current branch matches expected deploy branch;
- working tree has no unsafe local tracked changes;
- target service name matches configured service;
- required runtime files exist;
- required runtime placeholders are resolved.

If any identity check fails, deployment must stop before build/restart/up.

---

## Codex task boundary

For CI/CD tasks, Codex may create or update workflow files and supporting scripts only within the requested scope.

Codex must not:

- add real secrets;
- change unrelated application behavior;
- change architecture;
- touch stateful services;
- add migrations or backup/restore to ordinary CI/CD; a user-requested,
  separately protected stateful release lane must satisfy the contract above;
- perform cleanup/hardening;
- expand CI/CD beyond the requested task;
- introduce a new deploy access model without explicit request;
- convert local/dev Docker usage into production deployment semantics unless explicitly scoped.

---

## Done means

CI is done when:

- it runs on `pull_request`;
- it runs on `push` to the production branch;
- `workflow_dispatch` is available;
- minimal `permissions` and a `concurrency` guard are present;
- it uses existing project checks;
- it avoids deploy and production secrets;
- it passes with a clear success marker such as `CI_OK` or reports clear missing project prerequisites.

CD is done when:

- it deploys only the intended target service;
- target directory, expected remote, expected branch, and service identity are explicit;
- required secrets and runtime env are handled safely;
- unresolved required runtime secrets block deploy before build/up/restart;
- stateful services and volumes are not touched;
- post-check is present;
- when an image is built or pulled through a mutable tag, the running container image identity is verified against the intended newly built or pulled image before success is reported;
- failed post-check cannot produce a success marker such as `DEPLOY_OK`;
- success is reported only after validation;
- rollback behavior is explicit or safely absent.

A protected stateful release lane is done only when its ordinary source/CI
checks pass and its setup prerequisites are documented. Source completion does
not prove that the GitHub environment, forced-command key, VPS wrapper, backup,
migration, deployed image, or public health has been configured or exercised.

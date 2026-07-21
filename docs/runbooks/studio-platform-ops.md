# Studio platform operations runbook

This is the main Studio operations runbook. It covers platform bootstrap, runtime files, secrets, backups, migrations, component deployment, source storage, Google OAuth, worker rollout, and recovery stop conditions. Processing invariants live in `docs/studio-processing-contract.md`. It does not authorize coding agents to deploy, run migrations, start workers, call providers, or mutate production.

## State vocabulary

Keep these states separate in every report:

- `source-done/merged` — repository source reached the target branch.
- `CI-verified` — checks passed for that source.
- `deployed` — a component is deployed to the target runtime.
- `migration-applied` — production database revision is updated and verified.
- `worker-running` — the intended worker instance is running from the intended image.
- `production-live` — factual controlled end-to-end processing evidence exists.

Do not claim production-live Studio processing without a controlled canary proving exactly one intended output and no unsafe evidence.

## Runtime files and secrets

Studio platform runtime configuration uses operator-managed files and runtime environment paths. Values ending in `_FILE` must contain host file paths, not secret contents.

Required secret-file classes include:

- PostgreSQL password secret file;
- Studio credential master key file;
- Google OAuth client secret file when OAuth is enabled;
- source-storage access-key files for the private S3/R2-compatible upload bucket;
- backup/restic repository/password/access secret files when backup automation is used.

Rules:

- Secret files must be readable only by the deployment operator/runtime boundary, normally `0600`.
- Do not print, `cat`, copy into prompts, or commit secret file contents.
- Do not use unsafe `docker compose config` output as evidence because it can resolve and expose secret values.
- Runtime `.env` review may record variable presence and path shape, but never secret values.

## Platform bootstrap

Canonical stateful platform deployment uses the platform Compose stack under `deploy/studio/` and the approved platform scripts/runbooks, not the legacy stateless web-only path.

Bootstrap boundary:

1. Verify the intended deploy checkout, branch, remote, and clean/reviewed tracked tree.
2. Start or verify PostgreSQL and Redis as stateful platform services without recreating volumes unless a separate maintenance task authorizes it.
3. Prepare runtime `.env` and secret files before API startup.
4. Start API and web components separately.
5. Bootstrap the initial admin only through the approved server-side bootstrap admin command and without printing credentials.
6. Verify nginx routes browser traffic to the web component and `/api/*` traffic to the API component.
7. Verify localhost and public health endpoints for the intended components.

After migrations and successful API/database configuration, bootstrap the first admin with the approved interactive command:

```bash
docker compose \
  --env-file deploy/studio/.env \
  -f deploy/studio/compose.platform.yml \
  run --rm studio-api \
  python -m studio_api.cli admin@example.com
```

Replace `admin@example.com` with the approved admin email. The admin password is entered interactively; never pass it through shell arguments, environment variables, documentation, or logs. The command refuses to create a second active admin. For a restored database, first check whether an active admin already exists instead of running bootstrap automatically.

Health evidence should include only safe status booleans/markers, component names, and revision labels.

## Backup and migration order

Manual migration rollout order is strict:

1. Verify PostgreSQL and Redis health/stateful-service identity.
2. Create a tagged pre-migration PostgreSQL backup through the approved backup boundary.
3. Confirm the backup completed and record only safe snapshot metadata.
4. Run the manual migration command/script only after explicit operator confirmation.
5. Verify production database revision equals repository Alembic head `0014_source_deletion_retention` where the deployment is expected to be current.
6. Deploy or restart only the intended components.

Operator-safe tagged backup command:

```bash
cd /opt/elevenlabs-studio

STUDIO_BACKUP_TAG=pre-migration \
  scripts/backup_studio_postgres_r2.sh
```

Only documented backup tags are allowed by the script: `scheduled` and `pre-migration`. Confirm backup success before setting migration confirmation.

Operator-safe migration command after backup confirmation:

```bash
STUDIO_DEPLOY_DIR=/opt/elevenlabs-studio \
STUDIO_PRE_MIGRATION_BACKUP_CONFIRMED=yes \
  scripts/migrate_studio_platform.sh
```

The migration script requires explicit `STUDIO_PRE_MIGRATION_BACKUP_CONFIRMED=yes`; it does not create a backup automatically. These commands must not print secret values. Backup/restore remains operator-scoped, and standard CD must not perform these steps.

Do not claim or implement automatic migrations. Standard CD must not run migrations.

## Backup and restore rehearsal

Backup/restore rehearsal is manual and isolated:

- restore only into a separate temporary PostgreSQL database/target;
- invalidate restored sessions before any access test;
- run read-only smoke checks only;
- destroy only the temporary target after verification;
- never delete, overwrite, prune, or reset live production data from the rehearsal path.

## Source-upload storage

Temporary local-computer Studio source uploads use a private dedicated S3/R2-compatible bucket scoped to input objects only. Transcript outputs remain in Google Drive/Docs, not in this bucket.

Configuration requirements:

- endpoint URL, region, bucket, upload TTL, presign TTL, and maximum upload bytes are non-secret runtime settings;
- access key ID and secret access key are provided through operator-managed secret files;
- browser payloads must never expose object keys, private bucket names when sensitive, presigned URLs, secret-file paths, or source bytes;
- rollout of source-storage config is API-only unless another component is explicitly in scope.

## Google OAuth runtime configuration

Google OAuth runtime config is fail-closed. OAuth endpoints must remain unavailable or reject safely until required non-secret settings and a non-empty client secret file are present.

Required settings include client ID, redirect URI, scopes, state TTL, and the client-secret file path. The client secret itself stays in an operator-managed file. Current Drive/Picker integration requires `openid`, `email`, and `https://www.googleapis.com/auth/drive.file`; do not invent broader scopes. If OAuth scopes change, existing Google connections may require disconnect/reconnect before validation.

Picker readiness is separate from OAuth readiness. `STUDIO_GOOGLE_PICKER_API_KEY` and `STUDIO_GOOGLE_PICKER_APP_ID` must be configured, non-empty, and not placeholder values. OAuth connection, Picker configuration, and writable output folder selection are three different preconditions. Do not record Picker key/app ID values in validation evidence.

Roll out OAuth/Picker config through API deployment only when runtime files are ready. Validate with authenticated owner-scoped flows and confirm unauthenticated connection/status endpoints still reject as expected.

## Component deployment

Web and API are separate deployable components.

- Web deployment rebuilds/recreates only the web component, verifies image identity, then checks localhost health.
- API deployment rebuilds/recreates only the API component, verifies image identity, then checks localhost API health and migration readiness.
- A migration mismatch blocks API deploy success/readiness.
- Standard CD does not deploy/start/recreate `studio-worker` and does not maintain PostgreSQL, Redis, migrations, backups, restores, nginx, volumes, runtime secrets, or stateful services.
- Failed component health checks fail loudly and must not trigger unreviewed destructive rollback.

## Manual processing preflight

Before any processing rollout or canary, verify without printing sensitive values:

- target checkout, branch, remote, and deploy directory identity;
- tracked working tree state is clean or explicitly reviewed;
- runtime env/secret files exist where expected, without displaying values;
- PostgreSQL and Redis health;
- source-upload storage config is complete;
- Google OAuth config is complete and authenticated for the smoke account;
- Picker runtime config has non-placeholder `STUDIO_GOOGLE_PICKER_API_KEY` and `STUDIO_GOOGLE_PICKER_APP_ID` values without recording them;
- OAuth scopes include `https://www.googleapis.com/auth/drive.file` where required, and changed scopes have been handled by disconnect/reconnect if needed;
- credential master key and encrypted BYOK records are usable;
- exactly one intended active ElevenLabs BYOK credential exists for the smoke account;
- writable Google output folder selection exists;
- production database revision is known and compared to repository Alembic head `0014_source_deletion_retention`;
- exactly one worker instance is intended for the canary.

## Controlled worker rollout sequence

1. Keep `studio-worker` stopped until migration and runtime readiness are confirmed.
2. Create/confirm the tagged pre-migration database backup if a migration or stateful rollout is involved.
3. Verify production database revision equals repository head `0014_source_deletion_retention` where the deployment is expected to be current.
4. Deploy web/API only through the approved isolated component deployment model.
5. Verify intended commit/image identity, running component identity, localhost health, public health, authenticated session behavior, and output endpoint availability without exposing another owner’s data.
6. Start exactly one `studio-worker` from the intended image with no public HTTP port.
7. Verify worker configuration, bounded opaque process identity, and idle polling without creating or mutating jobs.

Starting or deploying the API does not prove the worker was recreated or that processing is production-live.

## Controlled canary

Run exactly one bounded canary:

- one approved smoke account and project;
- one small supported source;
- existing ElevenLabs path only;
- one active owner-scoped BYOK credential;
- one authenticated Google connection;
- one selected writable output folder;
- one queued job only after prerequisites pass;
- no automatic retry and no second job.

Observe safe metadata only: claim, lifecycle, terminal success/failure, attempt count, output count, and browser-safe output metadata. On success, confirm exactly one persisted output entry and manually verify that the expected Google document opens in the selected folder without recording its URL/ID/body.

## Stop conditions

Stop the worker and do not retry automatically on:

- database revision mismatch;
- missing runtime config or secret file presence;
- unexpected worker startup error;
- lease expiry, lease ambiguity, fencing loss, or cancellation uncertainty;
- provider or Google authentication rejection;
- output side-effect uncertainty;
- duplicate or unexpected Google document creation;
- wrong output folder;
- missing persisted output after possible external document creation;
- unsafe/secret-bearing evidence;
- unknown exception or state transition.

Any exception between claim commit and transition to `processing` blocks the smoke and blocks a production-live claim.

## Recovery boundary

Stopping the worker must not automatically requeue, delete, retry, downgrade, remove output rows, or delete Google documents. Do not clear leases with direct SQL during smoke recovery. Do not run destructive Docker Compose `down`, prune, volume removal, automatic downgrade, automatic job reset, provider retry, Google document deletion/recreation, or output-row deletion.

Output-side-effect uncertainty requires a separate reconciliation item. API/web rollback requires an explicitly reviewed database-compatible operator decision.

## Legacy deployment pointer

The legacy stateless web-only path remains documented separately in `docs/runbooks/legacy-studio-web-deploy.md` until `PWA-LEGACY-AUTHORITY-01` removes or formally supersedes that runtime code. Do not use the legacy path for platform API, worker, processing, PostgreSQL, Redis, migrations, or production processing rollout.

## Residual limitations

Current known limitations remain:

- no exactly-once Google document creation guarantee;
- no automated output reconciliation;
- no safe automatic retry/recovery;
- bounded PostgreSQL lease heartbeat is source-level only until deployed/validated; it is not a retry system and does not prove production-live processing;
- no Studio manifest mutation;
- no OpenAI Studio processing parity;
- no multi-worker production validation;
- no production-live claim from documentation, CI, deployment, or idle worker evidence alone.

## Runtime report template

```text
Date:
Operator:
Commit:
Database revision:
Web/API deployed: pass/fail/blocked/not-run
Worker running exactly once: pass/fail/blocked/not-run
Canary job created exactly once: pass/fail/blocked/not-run
Terminal job state:
Persisted output count:
Expected document opened in selected folder: pass/fail/blocked/not-run
Unsafe evidence avoided: pass/fail
Stop condition triggered:
Production-live claim allowed: yes/no
Notes:
```

## Official worker lifecycle operations (`PWA-WORKER-OPS-01`)

The `studio-worker` is an explicit manual-only component. Worker deployment success is operational evidence for a started process and image identity only; it is not queue progress, provider readiness, Google readiness, production-live processing, or canary success. An idle healthy worker is not processing proof.

### Worker operational health meaning

The worker healthcheck runs inside the worker container with:

```bash
python -m studio_api.worker_health
```

It verifies PID 1 has the worker process shape, worker configuration loads, and PostgreSQL answers a read-only `SELECT 1`. It does not claim jobs, read jobs, mutate the database, call providers, call Google, use Redis as queue logic, or check object storage.

### Worker status

```bash
cd /opt/elevenlabs-studio
STUDIO_DEPLOY_DIR=/opt/elevenlabs-studio scripts/manage_studio_worker.sh status
```

The status command reports only safe container state, exit code, drain state, Docker health, running/stopped container image ID, current commit tag presence, commit tag image ID, identity match, and rollback-candidate presence. Any worker lifecycle operation, including status, drain, pause, resume, deploy, and rollback, blocks fail-closed with `STUDIO_WORKER_OP_BLOCKED reason=multiple_worker_containers` (or the deploy equivalent) if more than one `studio-worker` container is discovered; multiple containers are an invalid topology, not a supported mode. Only `container_state=exited` with `exit_code=0` is `drain_state=gracefully-drained`; non-zero exits, including `137` and `143`, are `abnormal-exit` and are not paused/drained. It prints `STUDIO_WORKER_STATUS_OK` when the read-only status check completes, even when the worker state itself requires operator review.

### Initial worker deploy

A worker deploy is manual-only and must be run only when the worker is absent or already drained/stopped:

```bash
cd /opt/elevenlabs-studio
STUDIO_DEPLOY_DIR=/opt/elevenlabs-studio scripts/deploy_studio_platform_component.sh worker
```

The deploy script fast-forwards the trusted branch, preserves a previous stopped `exit_code=0` worker image as `elevenlabs-studio-worker:rollback-candidate` before building, builds only `studio-worker`, verifies PostgreSQL health without requiring Redis, compares current database revision with the new worker image Alembic head, tags the new worker image with the current commit, recreates only `studio-worker` with `--no-deps`, verifies the exact running image identity, waits for Docker health `healthy`, and only then prints `STUDIO_PLATFORM_WORKER_DEPLOY_OK`. API and worker use separate local image tags: `elevenlabs-studio-api:local` and `elevenlabs-studio-worker:local`. Worker operations must not retag or overwrite the API local image. It does not run migrations, recreate API/web/PostgreSQL/Redis, drain an active worker, run a canary, or perform automatic rollback.

### Worker drain and paused state

```bash
cd /opt/elevenlabs-studio
STUDIO_DEPLOY_DIR=/opt/elevenlabs-studio scripts/manage_studio_worker.sh drain
STUDIO_DEPLOY_DIR=/opt/elevenlabs-studio scripts/manage_studio_worker.sh pause
```

Drain uses normal Docker stop/SIGTERM with a timeout derived from the actual configured `STUDIO_WORKER_LEASE_TTL_SECONDS` plus a safety buffer. Compose `stop_grace_period: 86460s` covers the maximum supported lease TTL (`86400` seconds) plus a 60-second safety buffer as a fallback, but normal operator updates must still use explicit `status → drain → deploy`; the large Compose grace is not a replacement for operator drain. After SIGTERM, the worker stop flag prevents new claims; the current synchronous iteration and any stage-scoped heartbeat stop/join path finish or fail normally before exit. Heartbeat renewal sessions use transaction-local database timeouts and bounded stop joins; the heartbeat thread is daemon as a final process-exit safety net if a driver/network operation ignores the database timeout. `pause` is an idempotent safe-drain wrapper. Paused means stopped/drained container, never `docker pause`, `SIGSTOP`, or a frozen active process. A graceful drain prints `STUDIO_WORKER_DRAINED`; pause also prints `STUDIO_WORKER_PAUSED`. Repeated drain/pause is safe only when the worker is absent or the single existing container is already `exited` with `exit_code=0`.

If Docker forced-kills the worker, the process exits `143`, another non-zero exit occurs, the container is already stopped abnormally, or the container remains running/restarting, automation stops with a blocked reason and the operator must perform lease/output reconciliation review. Only exit code `0` is a graceful drain; `137` is forced kill, `143` is abnormal SIGTERM termination, and any other non-zero code is abnormal termination. Already stopped abnormal workers are not drained and are not paused; `pause` must not print `STUDIO_WORKER_PAUSED` after a failed drain. Do not automatically resume, redeploy, retry providers, clear leases, reset jobs, or delete/recreate Google documents.

### Worker resume

```bash
cd /opt/elevenlabs-studio
STUDIO_DEPLOY_DIR=/opt/elevenlabs-studio scripts/manage_studio_worker.sh resume
```

Resume only starts an existing single `exited` worker container with `exit_code=0` after checking schema compatibility for that exact stopped image ID. Before `docker start`, it reads the Alembic head from the stopped container image, reads the current production database revision non-interactively through the Compose/API operational boundary, requires exactly one revision on each side, and requires an exact match; schema mismatch prints `STUDIO_WORKER_RESUME_BLOCKED reason=schema_mismatch` and does not start the container. It then verifies the same image identity becomes healthy. It refuses absent, running/restarting, created, dead/unknown, `137`, `143`, or any other non-zero previous exit. It does not build, pull, fast-forward code, retag images, run migrations/downgrades, or recreate API/web/PostgreSQL/Redis. If the container is absent, use the official worker deploy path instead.

### Worker update sequence

Recommended operator sequence:

```text
status
→ drain
→ confirm stopped
→ deploy worker manually
→ verify image/commit identity
→ verify healthy
→ leave idle
→ operator separately decides whether to run controlled canary
```

Source merge does not deploy the worker. A successful worker deploy does not prove production-live processing; `PWA-PROCESSING-ROLLOUT-01A` remains a separate controlled canary decision and is still not-run until operator evidence exists.

### Worker rollback

Rollback is an explicit worker-only operator action and requires the worker to be drained/stopped first:

```bash
cd /opt/elevenlabs-studio
STUDIO_DEPLOY_DIR=/opt/elevenlabs-studio scripts/manage_studio_worker.sh rollback
```

Rollback requires the current worker to be absent or `exited` with `exit_code=0`. It requires `elevenlabs-studio-worker:rollback-candidate`, verifies image identity, reads Alembic head directly from the rollback candidate image, compares it with the current database revision, and refuses schema mismatch before changing the worker local tag. It performs no downgrade, does not touch `elevenlabs-studio-api:local`, recreates only `studio-worker`, waits for health, verifies the running rollback image, and prints `STUDIO_WORKER_ROLLBACK_OK`. Automatic rollback is prohibited.

### Image/commit identity evidence

Safe evidence may include the intended repository commit SHA, the commit-specific worker tag `elevenlabs-studio-worker:<commit>`, whether that tag exists, the commit tag image ID, the running/stopped container image ID, explicit `identity_match=yes|no|unknown`, and rollback candidate presence. Do not print `.env`, secret-file contents, provider payloads, Google payloads, transcript bodies, document IDs, source names, or job/output records.

### Manual-only workflow dispatch

GitHub Actions supports manual `workflow_dispatch(component=worker)` using the same SSH access model and a materialized trusted deploy script. Push events never auto-deploy the worker, including worker-only source changes. The workflow does not automatically drain, run migrations, run backups, run canaries, or run rollback.

## Output reconciliation operations boundary

`PWA-OUTPUT-RECONCILIATION-01` is source-level only until an operator manually applies migration `0014_source_deletion_retention` in the target database and verifies API/worker image compatibility. Standard CD must not run this migration automatically.

When a job fails with `output_reconciliation_required`, the owner may use the Studio PWA action or API check endpoint to query Drive by the internal opaque appProperty token and the job output-folder snapshot. Operators must not ask users for raw Google document IDs, must not create duplicate Google Docs, must not delete possible duplicates, must not retry provider processing as reconciliation, and must not inspect transcript/document bodies as evidence. Zero matches remain unresolved for later explicit checks. Multiple matches are a conflict requiring manual investigation outside the automated path.

No production deployment, migration rollout, worker rollout, or controlled canary was performed by the source change.


### Studio output reconciliation runtime guardrails

- Existing unresolved reconciliation cases are treated as permanent create blockers for the affected job-source relation; operators must not restart processing to create another Google Doc with the same appProperty token.
- A `prepared` case alone is internal evidence and should not be interpreted as owner reconciliation availability; pre-create persistence failure is a normal safe processing failure, not output uncertainty.
- Source retention cleanup does not block reconciliation because the recovery path uses durable case metadata and a verified Drive candidate rather than source bytes or object storage.
- Conflict is stable and fail-closed: repeated checks may report the conflict, but the system must not choose the first candidate, delete documents, or ask for a manual document ID.

## Source cleanup operations note

Repository Alembic head is `0014_source_deletion_retention`. Source cleanup is durable PostgreSQL state on `sources` and is processed as bounded worker idle maintenance after normal job claim/orchestration finds no job. Safe diagnostics use normalized source deletion/retention/cleanup events and must not log object keys, buckets, filenames, Drive file IDs, presigned URLs, raw storage errors, or secrets. Production migration, deployment, worker rollout, and controlled canary remain manual operator actions and were not run by this source-level PR.

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
5. Verify production database revision equals repository Alembic head `0011_diagnostic_debug_sessions` where the deployment is expected to be current.
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
- production database revision is known and compared to repository Alembic head `0011_diagnostic_debug_sessions`;
- exactly one worker instance is intended for the canary.

## Controlled worker rollout sequence

1. Keep `studio-worker` stopped until migration and runtime readiness are confirmed.
2. Create/confirm the tagged pre-migration database backup if a migration or stateful rollout is involved.
3. Verify production database revision equals repository head `0011_diagnostic_debug_sessions` where the deployment is expected to be current.
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
- no background lease heartbeat during one long external call;
- one continuous materialization/provider/output stage must fit the worker lease TTL;
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

The status command reports only safe container state, Docker health, image identity, intended commit tag when available, rollback-candidate presence, and whether the worker is in the stopped/drained paused state. It prints `STUDIO_WORKER_STATUS_OK` when the read-only status check completes.

### Initial worker deploy

A worker deploy is manual-only and must be run only when the worker is absent or already drained/stopped:

```bash
cd /opt/elevenlabs-studio
STUDIO_DEPLOY_DIR=/opt/elevenlabs-studio scripts/deploy_studio_platform_component.sh worker
```

The deploy script fast-forwards the trusted branch, builds only `studio-worker`, verifies PostgreSQL health, compares current database revision with the new worker image Alembic head, preserves the previous worker image as `elevenlabs-studio-worker:rollback-candidate` when one exists, tags the new worker image with the current commit, recreates only `studio-worker` with `--no-deps`, verifies the exact running image identity, waits for Docker health `healthy`, and only then prints `STUDIO_PLATFORM_WORKER_DEPLOY_OK`. It does not run migrations, recreate API/web/PostgreSQL/Redis, drain an active worker, run a canary, or perform automatic rollback.

### Worker drain and paused state

```bash
cd /opt/elevenlabs-studio
STUDIO_DEPLOY_DIR=/opt/elevenlabs-studio scripts/manage_studio_worker.sh drain
STUDIO_DEPLOY_DIR=/opt/elevenlabs-studio scripts/manage_studio_worker.sh pause
```

Drain uses normal Docker stop/SIGTERM with a timeout derived from `STUDIO_WORKER_LEASE_TTL_SECONDS` plus a safety buffer. After SIGTERM, the worker stop flag prevents new claims; the current synchronous iteration finishes or fails normally before exit. `pause` is an idempotent safe-drain wrapper. Paused means stopped/drained container, never `docker pause`, `SIGSTOP`, or a frozen active process. A graceful drain prints `STUDIO_WORKER_DRAINED`; pause also prints `STUDIO_WORKER_PAUSED`.

If Docker forced-kills the worker or the container remains running, automation stops with a blocked reason and the operator must perform lease/output reconciliation review. Do not automatically resume, redeploy, retry providers, clear leases, reset jobs, or delete/recreate Google documents.

### Worker resume

```bash
cd /opt/elevenlabs-studio
STUDIO_DEPLOY_DIR=/opt/elevenlabs-studio scripts/manage_studio_worker.sh resume
```

Resume only starts an existing stopped worker container and verifies the same image identity becomes healthy. It does not build, pull, fast-forward code, or recreate API/web/PostgreSQL/Redis. If the container is absent, use the official worker deploy path instead.

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

Source merge does not deploy the worker. A successful worker deploy does not prove production-live processing; `PWA-PROCESSING-ROLLOUT-01A` remains a separate controlled canary decision.

### Worker rollback

Rollback is an explicit worker-only operator action and requires the worker to be drained/stopped first:

```bash
cd /opt/elevenlabs-studio
STUDIO_DEPLOY_DIR=/opt/elevenlabs-studio scripts/manage_studio_worker.sh rollback
```

Rollback requires `elevenlabs-studio-worker:rollback-candidate`, verifies image identity, compares rollback image Alembic head with the current database revision, refuses schema mismatch, performs no downgrade, recreates only `studio-worker`, waits for health, verifies the running rollback image, and prints `STUDIO_WORKER_ROLLBACK_OK`. Automatic rollback is prohibited.

### Image/commit identity evidence

Safe evidence may include the intended repository commit SHA, the commit-specific worker tag `elevenlabs-studio-worker:<commit>`, the built Docker image ID, the running container image ID, and rollback candidate presence. Do not print `.env`, secret-file contents, provider payloads, Google payloads, transcript bodies, document IDs, source names, or job/output records.

### Manual-only workflow dispatch

GitHub Actions supports manual `workflow_dispatch(component=worker)` using the same SSH access model and a materialized trusted deploy script. Push events never auto-deploy the worker, including worker-only source changes. The workflow does not automatically drain, run migrations, run backups, run canaries, or run rollback.

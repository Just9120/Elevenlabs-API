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

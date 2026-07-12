# Studio platform operations runbook

This runbook covers the operator-run stateful Studio platform path introduced by PWA-PLATFORM-01. Standard CD is isolated and gated: it may deploy only the Studio web or API component, never provider execution, uploads, Google integration, queues, workers, jobs, PostgreSQL, Redis, migrations, backups, restores, nginx, volumes, or runtime credential secrets.

## Secrets and preconditions

Create operator-managed `0600` files readable by the deployment operator only. Keep values outside Git and PostgreSQL:

- PostgreSQL password file, mounted as `/run/secrets/studio_postgres_password` read-only into PostgreSQL and `studio-api`.
- Base64-encoded 32-byte credential master key file, mounted read-only as `/run/secrets/studio_credential_master_key` only into `studio-api`.
- Restic password and scoped Cloudflare R2 S3 access-key files for backups.

Copy `deploy/studio/.env.example` to `deploy/studio/.env` and set only paths/placeholders, never secret values.

## Migration order

1. Start PostgreSQL and Redis with `scripts/deploy_studio_platform.sh` or reviewed Compose commands.
2. Run a tagged pre-migration backup first: `STUDIO_BACKUP_TAG=pre-migration scripts/backup_studio_postgres_r2.sh`.
3. Run migrations only after backup confirmation: `STUDIO_PRE_MIGRATION_BACKUP_CONFIRMED=yes scripts/migrate_studio_platform.sh`.
4. Start or restart `studio-api` and `studio-web`.

Migrations never run automatically at API startup. Rollback is forward-fix by default; downgrade requires deliberate operator approval for a reversible migration.

## Bootstrap admin

Run inside the API container after migrations:

```bash
docker compose --env-file deploy/studio/.env -f deploy/studio/compose.platform.yml run --rm studio-api python -m studio_api.cli admin@example.com
```

The command prompts without echo and refuses to create a second active admin.

## nginx rollout

Review and install `deploy/studio/studio.librechat.online.nginx.conf`. It proxies `/api/` to `127.0.0.1:8182` and keeps static PWA traffic on `127.0.0.1:8181`. Host nginx and certificates remain operator-managed.

## Backups and restore rehearsal

Install `deploy/studio/systemd/studio-postgres-backup.service` and `.timer` only after manually initializing the restic repository. The timer uses `OnUnitActiveSec=10h`. Scheduled retention keeps 7 days of scheduled snapshots, daily snapshots for 30 days, monthly snapshots for 12 months, and tagged pre-migration snapshots for 90 days by operator policy.

Restore rehearsal is manual: restore a snapshot into a separate temporary PostgreSQL target, invalidate restored sessions before any access test, run read-only smoke checks, then destroy only the temporary target. Backup and restore scripts must never auto-delete live data.


## Temporary source upload storage

Temporary local computer source uploads use a private, dedicated S3/R2-compatible bucket scoped to Studio source-upload inputs. These objects are temporary inputs only; transcript outputs remain in the user-selected Google Drive folder. Do not use this bucket as transcript output storage.

Before deploying `studio-api` with source uploads enabled:

1. Create operator-managed `0600` secret files readable by the deployment operator only:
   - `studio_source_s3_access_key_id`
   - `studio_source_s3_secret_access_key`
2. Add the non-secret source storage settings to production `deploy/studio/.env`: endpoint URL, region, bucket, upload TTL, presign TTL, and maximum upload bytes.
3. Add `STUDIO_SOURCE_S3_ACCESS_KEY_ID_FILE` and `STUDIO_SOURCE_S3_SECRET_ACCESS_KEY_FILE` to production `deploy/studio/.env` as file paths to the operator-managed secret files. Values ending in `_FILE` are paths, not secret contents.
4. Do not print, `cat`, or otherwise log the secret files. Do not use `docker compose config` for validation because it can expose resolved secrets.
5. Roll out manually after the runtime `.env` and secret files are prepared: deploy only `studio-api`, then verify `http://127.0.0.1:8182/api/healthz`.

No Alembic migration, database backup, restore, nginx change, queue, worker, provider execution, Google OAuth, Drive picker, or Google Docs creation is required for this config-only rollout.

## Google OAuth runtime config

Google OAuth is configured through the same operator-managed runtime `.env` plus read-only secret-file model as other Studio API secrets. The backend remains fail-closed when the OAuth client id, redirect URI, scopes, state TTL, or non-empty client-secret file are not configured.

Before deploying `studio-api` with Google OAuth enabled:

1. Create an operator-managed `0600` Google OAuth client-secret file readable by the deployment operator only, for example under the runtime secret directory.
2. Set `STUDIO_GOOGLE_OAUTH_CLIENT_ID`, `STUDIO_GOOGLE_OAUTH_REDIRECT_URI`, `STUDIO_GOOGLE_OAUTH_SCOPES`, and `STUDIO_GOOGLE_OAUTH_STATE_TTL_SECONDS` in production `deploy/studio/.env`.
3. Set `STUDIO_GOOGLE_OAUTH_CLIENT_SECRET_FILE` in production `deploy/studio/.env` to the host path of the operator-managed client-secret file. Values ending in `_FILE` are paths, not secret contents.
4. Do not print, `cat`, or otherwise log the runtime `.env` or client-secret file. Do not use `docker compose config` for validation because it can expose resolved secrets.
5. Roll out manually after the runtime `.env` and secret file are prepared: deploy only `studio-api`, then verify `http://127.0.0.1:8182/api/healthz` and the authenticated OAuth flow. Unauthenticated `GET /api/google/connection` should still return `401`.

If Google OAuth is not being enabled for a rollout, leave `STUDIO_GOOGLE_OAUTH_CLIENT_SECRET_FILE` blank so Compose mounts the committed empty optional placeholder. The OAuth endpoints continue to fail closed until the operator provides complete runtime values and a non-empty client-secret file.

## Validation evidence to record

Record secret-free evidence for platform health, migration revision, bootstrap status, login/logout/session rotation, CSRF rejection, credential create/list/replace/revoke/delete masking, Redis rate limits, backup snapshot creation, restore rehearsal, and browser acceptance. Do not claim production provider execution, uploads, Google integration, queues, jobs, or transcript output.

## Hardening notes for PWA-PLATFORM-01 follow-up

The API constructs its PostgreSQL SQLAlchemy URL from non-secret connection fields plus the read-only `/run/secrets/studio_postgres_password` file. Do not export the raw password into `STUDIO_POSTGRES_PASSWORD` or interpolate it into Compose environment variables.

Forwarded client IP handling assumes only the local host nginx proxy boundary. The API may parse `X-Forwarded-For` only when the direct peer is the configured trusted local proxy; arbitrary forwarded headers from other peers are ignored.

Use only documented backup tags:

```bash
STUDIO_BACKUP_TAG=scheduled scripts/backup_studio_postgres_r2.sh
STUDIO_BACKUP_TAG=pre-migration scripts/backup_studio_postgres_r2.sh
```

The backup script uses a fixed logical restic host and `--group-by host,tags` so the temporary dump path does not fragment retention. Scheduled backups retain all snapshots within 7 days plus daily snapshots for 30 days and monthly snapshots for 12 months. Pre-migration snapshots are retained for 90 days. Restore rehearsal remains manual and must target a separate temporary database.

## Isolated platform CD scope

The active production stack is `deploy/studio/compose.platform.yml`. Standard CD uses one GitHub Actions workflow, `Studio Platform CD`, with two isolated component deploy jobs sharing the `studio-platform-production` concurrency group. The workflow fetches `origin/main`, materializes the trusted `scripts/deploy_studio_platform_component.sh` content into a temporary file on the production host, executes that file with exactly `web` or `api`, and removes the temporary file on success or failure. Do not execute this nontrivial deploy program through stdin.

### Platform web deployment

The `deploy-web` job deploys only the `studio-web` service. Automatic push-to-main deployments are limited to frontend changes under `apps/studio/**` and run only when the repository variable `STUDIO_PLATFORM_CD_ENABLED` is set to `true`. Manual `workflow_dispatch` remains available at all times and requires choosing the `web` component explicitly.

The web deploy builds only `studio-web`, captures the newly built `elevenlabs-studio-web:local` image ID, force-recreates only `studio-web` with `--no-deps --force-recreate`, verifies the running container image ID matches the newly built tagged image ID, then checks `http://127.0.0.1:8181/healthz`. `STUDIO_PLATFORM_WEB_DEPLOY_OK` proves both image replacement and localhost health passed. PostgreSQL and Redis remain untouched.

### Platform API deployment

The `deploy-api` job deploys only the `studio-api` service. Automatic push-to-main deployments are limited to non-migration backend changes under `apps/studio-api/**`. Changes under `apps/studio-api/alembic/**` or `apps/studio-api/alembic.ini` suppress automatic API deployment, including pushes that combine migration-related files with normal API files. Manual `workflow_dispatch` remains available at all times and requires choosing the `api` component explicitly.

The API deploy builds only `studio-api`, captures the newly built `elevenlabs-studio-api:local` image ID, verifies PostgreSQL and Redis are already healthy, compares the current database revision with the Alembic head in the newly built API image using non-interactive Compose runs detached from stdin, refuses to proceed with a clear manual-migration-required error if revisions differ or cannot be compared, force-recreates only `studio-api` with `--no-deps --force-recreate`, verifies the running container image ID matches the newly built tagged image ID, then checks `http://127.0.0.1:8182/api/healthz`. `STUDIO_PLATFORM_API_DEPLOY_OK` proves PostgreSQL/Redis health, Alembic revision equality, forced API recreation, running-image identity verification, and localhost health all passed in that order. PostgreSQL and Redis remain untouched by the component update.

When one automatic push selects both components, `deploy-web` runs first and `deploy-api` runs only after the web deployment succeeds. If no web deployment is selected, the API job may run independently.

### Manual maintenance boundary

Standard platform CD never deploys or maintains PostgreSQL, Redis, migrations, backups, restores, nginx, volumes, runtime credential secrets, or the legacy `compose.prod.yml` stack. Those changes require separate, deliberate manual maintenance with explicit operator scope and validation. Failed platform web or API health checks fail loudly and do not trigger automatic rollback.

## Initial platform CD enablement and validation

1. Configure the GitHub Actions secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, and `DEPLOY_KNOWN_HOSTS`.
2. `STUDIO_DEPLOY_DIR` is not a secret. The workflow uses the fixed production checkout `/opt/elevenlabs-studio`.
3. Merge the single `Studio Platform CD` workflow and component deploy script.
4. Run `workflow_dispatch` for `Studio Platform CD` once with `web`, then once with `api`.
5. Verify public and localhost health/routing through the operator-managed nginx boundary.
6. Set the repository variable `STUDIO_PLATFORM_CD_ENABLED=true` only after both manual component deployments pass.

Operator validation recorded on 2026-07-01: manual `web` and manual `api` dispatches completed successfully. Automatic push deployment remains off until the repository variable is explicitly set to `true`.

## Manual Studio processing rollout and controlled smoke contract

This runbook section supports `PWA-PROCESSING-ROLLOUT-01A — Manual Studio processing rollout and controlled smoke validation`. It is an operator contract, not a coding-agent task. `PWA-PROCESSING-ROLLOUT-01-PREP` only documents this boundary and does not connect to production, run backups, run migrations, deploy containers, start workers, create jobs, call providers, call Google APIs, or mutate production.

### State and responsibility boundary

Keep these states separate in all reports: source-done/merged, CI-verified, deployed, migration-applied, worker-running, and production-live. Do not claim production-live Studio processing unless factual operator evidence exists. The operator must not record secrets, token values, document ids, folder ids, account data, source bytes, transcript body, document URLs, private paths, raw provider responses, or raw Google responses.

### Preconditions

Before rollout, confirm without printing values:

- target checkout, remote, branch, and deploy directory identity;
- tracked working tree is clean or explicitly reviewed as safe;
- production runtime `.env` paths and secret files exist;
- PostgreSQL and Redis are healthy;
- source-upload storage config is complete;
- Google OAuth config is complete and authenticated for the smoke account;
- credential master key and encrypted BYOK records are usable;
- an active ElevenLabs BYOK credential exists for the smoke account;
- an accessible writable Google Drive output folder is selected;
- exactly one `studio-worker` instance is intended;
- current production database revision is known before migration.

### Rollout sequence

1. Stop or keep stopped `studio-worker` while migration readiness is uncertain.
2. Create and confirm a tagged pre-migration PostgreSQL backup using the reviewed backup boundary.
3. Compare production database revision with repository Alembic head `0008_transcription_job_outputs`.
4. Require explicit operator confirmation, then run the existing manual migration script if needed.
5. Verify production database revision equals `0008_transcription_job_outputs` before processing.
6. Deploy `web` and `api` through the existing isolated component deployment model only after migration equality is confirmed; standard CD must not run migrations and does not deploy the worker.
7. Verify intended commit, built image identity, running image identity, localhost health, public routing health, authenticated login/session behavior, and output endpoint availability without exposing another owner's output data.
8. Manually start exactly one `studio-worker` using the intended `studio-api` image, with no HTTP port published.
9. Verify PostgreSQL health, valid worker configuration, one bounded opaque process owner identity without recording the full raw value, and idle polling that does not create or mutate jobs.

Starting `studio-api` does not prove `studio-worker` was recreated with the intended image.

### Controlled smoke

Run exactly one bounded smoke: one operator-approved test account/project, one small supported source, the existing ElevenLabs path only, one active owner-scoped BYOK credential, one authenticated Google connection, and one selected writable output folder. Create one queued job only after prerequisites pass. Do not create multiple jobs and do not retry automatically. Observe lifecycle through safe UI/API metadata; verify worker claim, terminal success or normalized failure, exactly one persisted output entry on success, approved frontend output metadata, and manual confirmation that the validated Google link opens the expected document in the selected folder. Do not copy transcript text into logs or evidence.

### Stop conditions and recovery boundary

Stop the worker and avoid automatic retry on database revision mismatch, missing runtime config, unexpected worker startup error, lease expiry or fencing loss, cancellation uncertainty, provider or Google authentication rejection, output side-effect uncertainty, duplicate or unexpected Google document creation, wrong output folder, missing persisted output after external document side effect, unsafe/secret-bearing evidence, or unknown exception/state transition.

Stopping the worker must not automatically requeue, delete, retry, downgrade, remove output rows, or delete Google documents. Recovery allows no automatic database downgrade, no automatic job reset, no automatic provider retry, no automatic Google document deletion/recreation, no automatic output-row deletion, and no destructive Docker Compose `down`, prune, or volume removal. Stop or recreate only the intended worker component when safely required. API/web rollback requires an explicitly reviewed database-compatible operator decision. Output-side-effect uncertainty requires separate reconciliation work, and failed post-checks must fail loudly while preserving evidence.

### Evidence record

Classify every evidence item as `pass`, `fail`, `blocked`, or `not-run`. Safe evidence may include deployed commit, web/api/worker image identity confirmation, database revision, PostgreSQL/Redis/API/web health, worker instance count, startup/idle confirmation, safe job id if allowed, job status and attempt count, source count, persisted output count, output link availability boolean, confirmation that the validated link opened the expected Google document, and confirmation that no secrets, transcript bodies, document ids/URLs, source bytes, raw external responses, or copied transcript text were recorded.

Residual limitations remain: no exactly-once Google document creation, no automatic reconciliation, no automatic retry, no background lease heartbeat during one long materialization/provider stage, one continuous materialization/provider stage must fit the worker lease TTL, no Studio manifest mutation, no OpenAI rollout, no multi-worker production validation, no production-live claim from documentation/CI alone, and Colab remains the fallback production contour until factual Studio runtime evidence exists.

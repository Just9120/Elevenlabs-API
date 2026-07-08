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

The active production stack is `deploy/studio/compose.platform.yml`. Standard CD uses one GitHub Actions workflow, `Studio Platform CD`, with two isolated component deploy jobs sharing the `studio-platform-production` concurrency group. The workflow calls `scripts/deploy_studio_platform_component.sh` on the production host and passes exactly `web` or `api`.

### Platform web deployment

The `deploy-web` job deploys only the `studio-web` service. Automatic push-to-main deployments are limited to frontend changes under `apps/studio/**` and run only when the repository variable `STUDIO_PLATFORM_CD_ENABLED` is set to `true`. Manual `workflow_dispatch` remains available at all times and requires choosing the `web` component explicitly.

The web deploy builds only `studio-web`, updates it with `--no-deps`, checks `http://127.0.0.1:8181/healthz`, and prints `STUDIO_PLATFORM_WEB_DEPLOY_OK` only after that health check passes.

### Platform API deployment

The `deploy-api` job deploys only the `studio-api` service. Automatic push-to-main deployments are limited to non-migration backend changes under `apps/studio-api/**`. Changes under `apps/studio-api/alembic/**` or `apps/studio-api/alembic.ini` suppress automatic API deployment, including pushes that combine migration-related files with normal API files. Manual `workflow_dispatch` remains available at all times and requires choosing the `api` component explicitly.

The API deploy verifies PostgreSQL and Redis are already healthy, builds only `studio-api`, compares the current database revision with the Alembic head in the newly built API image, refuses to proceed with a clear manual-migration-required error if revisions differ or cannot be compared, updates `studio-api` with `--no-deps`, checks `http://127.0.0.1:8182/api/healthz`, and prints `STUDIO_PLATFORM_API_DEPLOY_OK` only after that health check passes.

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

# Studio platform operations runbook

This runbook covers the operator-run stateful Studio platform path introduced by PWA-PLATFORM-01. It does not deploy automatically and does not authorize provider execution, uploads, Google integration, queues, workers, or jobs.

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

## nginx rollout

Review and install `deploy/studio/studio.librechat.online.nginx.conf`. It proxies `/api/` to `127.0.0.1:8182` and keeps static PWA traffic on `127.0.0.1:8181`.

## Backups and restore rehearsal

Install systemd timer only after restic init.

Restore rehearsal is manual and must use a temporary database.

## Platform CD scope

The active production stack is `deploy/studio/compose.platform.yml`. Standard CD is now a single workflow named `Studio Platform CD` with two isolated jobs: `deploy-web` and `deploy-api`.

### Automatic behavior

- Push to `main` triggers detection.
- `apps/studio/**` triggers web deployment.
- `apps/studio-api/**` triggers API deployment.
- API migration folders are excluded from automatic deployment.
- Both components may deploy in a single workflow run.

### Manual behavior

Manual `workflow_dispatch` requires selecting `web` or `api` explicitly.

### Safety boundary

Deploy jobs never manage PostgreSQL, Redis, migrations, backups, restores, nginx, or secrets.

## Initial platform enablement

1. Configure GitHub secrets.
2. Merge platform CD workflow.
3. Run manual web deployment once.
4. Validate health.
5. Enable `STUDIO_PLATFORM_CD_ENABLED=true`.

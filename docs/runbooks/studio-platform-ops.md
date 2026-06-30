# Studio platform operations runbook

This runbook covers the operator-run stateful Studio platform path introduced by PWA-PLATFORM-01. It does not deploy automatically and does not authorize provider execution, uploads, Google integration, queues, workers, or jobs.

## Secrets and preconditions

Create operator-managed `0600` files readable by the deployment operator only. Keep values outside Git and PostgreSQL:

- PostgreSQL password file, mounted as `/run/secrets/studio_postgres_password` only into PostgreSQL.
- Base64-encoded 32-byte credential master key file, mounted read-only as `/run/secrets/studio_credential_master_key` only into the API.
- Restic password and scoped Cloudflare R2 S3 access-key files for backups.

Copy `deploy/studio/.env.example` to `deploy/studio/.env` and set only paths/placeholders, never secret values.

## Migration order

1. Start PostgreSQL and Redis with `scripts/deploy_studio_platform.sh` or reviewed Compose commands.
2. Run a tagged pre-migration backup first: `STUDIO_BACKUP_TAG=pre-migration-YYYYMMDD scripts/backup_studio_postgres_r2.sh`.
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

## Validation evidence to record

Record secret-free evidence for platform health, migration revision, bootstrap status, login/logout/session rotation, CSRF rejection, credential create/list/replace/revoke/delete masking, Redis rate limits, backup snapshot creation, restore rehearsal, and browser acceptance. Do not claim production provider execution, uploads, Google integration, queues, jobs, or transcript output.

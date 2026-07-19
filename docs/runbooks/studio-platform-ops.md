# Studio platform operations runbook

This is the main Studio operations runbook. It covers safe operator validation, deployment-state vocabulary, worker rollout boundaries, and recovery stop conditions. It does not authorize coding agents to deploy, run migrations, start workers, call providers, or mutate production.

## State vocabulary

Keep these states separate in every report:

- `source-done/merged` — repository source reached the target branch.
- `CI-verified` — checks passed for that source.
- `deployed` — a component is deployed to the target runtime.
- `migration-applied` — production database revision is updated and verified.
- `worker-running` — the intended worker instance is running from the intended image.
- `production-live` — factual controlled end-to-end processing evidence exists.

Do not claim production-live Studio processing without a controlled canary proving exactly one intended output and no unsafe evidence.

## Secrets and evidence boundary

Never record secret values, tokens, refresh tokens, document IDs/URLs, folder IDs, account data, source bytes, transcript bodies, document bodies, raw provider responses, raw Google responses, private paths, or sensitive runtime values.

Safe evidence can include pass/fail status, intended commit, component names, redacted image identity confirmation, database revision label, health booleans, worker count, safe job status, output count, and confirmation that the expected document opened in the selected folder without copying the link or content.

## Component deployment boundary

Studio has separate web, API, database/migration, and worker concerns.

- Standard CI must not deploy.
- Standard Studio CD must not run migrations, deploy/start/recreate workers, perform stateful-service maintenance, prune volumes/images, or claim processing readiness.
- API/web deployment does not prove worker-running.
- Worker-running does not prove provider execution or Google Docs output.
- Migration equality does not prove processing success.

Follow `docs/ci-cd-rules.md` for CI/CD, deployment, backup, migration, rollback, secrets, and stateful-service safety.

## Legacy deployment path note

Legacy web/API deployment paths may still exist in `deploy/studio/` or workflows. Do not hide or reinterpret them as worker-capable processing rollout paths. Treat legacy/stateless deployment behavior as legacy until a focused `PWA-LEGACY-AUTHORITY-01` task removes it or marks it formally. This docs task does not change deployment code.

## Manual preflight

Before any processing rollout or canary, verify without printing sensitive values:

- target checkout, branch, remote, and deploy directory identity;
- tracked working tree state is clean or explicitly reviewed;
- runtime env/secret files exist where expected, without displaying values;
- PostgreSQL and Redis health;
- source-upload object storage configuration is present;
- Google OAuth configuration and smoke-account connection are usable;
- credential master key is usable and exactly one intended active ElevenLabs BYOK credential exists for the smoke account;
- writable Google output folder selection exists;
- production database revision is known and compared to repository Alembic head `0011_diagnostic_debug_sessions`;
- exactly one worker instance is intended for the canary.

## Controlled rollout sequence

1. Keep `studio-worker` stopped until migration and runtime readiness are confirmed.
2. Create/confirm a tagged pre-migration database backup through the approved operator boundary.
3. If needed, apply migrations manually according to `docs/ci-cd-rules.md`; standard CD must not do this.
4. Verify production database revision equals repository head `0011_diagnostic_debug_sessions` where the deployment is expected to be current.
5. Deploy web/API only through the approved isolated component deployment model.
6. Verify intended commit/image identity, running component identity, localhost health, public health, authenticated session behavior, and output endpoint availability without exposing another owner’s data.
7. Start exactly one `studio-worker` from the intended image with no public HTTP port.
8. Verify worker configuration, bounded opaque process identity, and idle polling without creating or mutating jobs.

Starting or deploying the API does not prove the worker was recreated or that processing is production-live.

## Controlled smoke

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

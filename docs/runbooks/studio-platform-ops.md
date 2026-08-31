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
- primary Google OAuth client secret file when Picker/browser OAuth is enabled;
- separate maintenance Google OAuth client secret file when recursive transcript maintenance is enabled;
- separate transcription-reference and audio-reference access-key files for two private S3/R2-compatible buckets;
- backup/restic repository/password/access secret files when backup automation is used.

Rules:

- Secret files must be readable only by the deployment operator/runtime boundary, normally `0600`.
- Do not print, `cat`, copy into prompts, or commit secret file contents.
- Do not use unsafe `docker compose config` output as evidence because it can resolve and expose secret values.
- Runtime `.env` review may record variable presence and path shape, but never secret values.

Compose file-backed secrets retain host-file ownership and permissions. The shared
API/worker container therefore starts its reviewed entrypoint as container root
only long enough to copy the mounted allowlisted secrets into a root-owned private
tmpfs runtime directory as `0400` files owned by UID/GID `10001`. It then clears
supplementary groups, drops irreversibly to `10001`, and execs the API, worker,
Alembic, or health command. Do not relax host secret permissions, add broad ACLs,
or bypass the entrypoint for commands that need database/runtime secrets.

## Trusted reverse-proxy peer

`STUDIO_TRUSTED_PROXY_IP` is one exact IP address, never a hostname, CIDR, wildcard,
or forwarded client address. The API accepts the first `X-Forwarded-For` value only
when the direct request peer equals that configured address; otherwise it uses the
direct peer and ignores the header. The default `127.0.0.1` is fail-closed for
local direct proxying but must not be assumed correct for a host nginx request
crossing a Docker-published port.

Before changing the production value:

1. Keep the current value and issue one safe public `/api/healthz` request in a
   bounded observation window.
2. Inspect only the matching API access-log row and record the direct peer IP,
   timestamp, endpoint group, and status. Do not retain unrelated request paths,
   headers, query strings, cookies, or bodies.
3. Repeat once to confirm the same direct peer and reconcile it with the intended
   host-nginx-to-published-port topology. Stop if the peer is absent, changes, or
   cannot be distinguished from another proxy hop.
4. Set only the observed exact IP in the operator-managed runtime `.env`. Never
   use `0.0.0.0`, `::`, a subnet, or a value copied from `X-Forwarded-For`.
5. Treat the resulting API deployment and verification as a separate authorized
   runtime action. Confirm distinct safe client requests no longer collapse onto
   one proxy rate-limit key, while a spoofed forwarded header from an untrusted
   direct peer remains ignored.

## Platform bootstrap

Canonical stateful platform deployment uses the platform Compose stack under `deploy/studio/` and the approved platform scripts/runbooks, not the legacy stateless web-only path.

Bootstrap boundary:

1. Verify the intended deploy checkout, branch, remote, and clean/reviewed tracked tree.
2. Start or verify PostgreSQL and Redis as stateful platform services without recreating volumes unless a separate maintenance task authorizes it.
3. Prepare runtime `.env` and secret files before API startup.
4. Start API and web components separately.
5. Bootstrap the initial admin only through the approved server-side bootstrap admin command and without printing credentials.
6. Verify nginx routes browser traffic to the web component and `/api/*` traffic to the API component.
7. Validate the public HTTPS response carries the repository CSP, HSTS, `nosniff`, origin-only referrer policy, permissions, and framing headers; confirm Picker open/select/cancel and one bounded local PUT still work without CSP violations. The local PUT must omit browser credentials, expose no referrer path/query beyond the public Studio origin, and reject a redirected terminal response. Do not infer live header state from the committed nginx file.
8. Verify localhost and public health endpoints for the intended components.

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

Migration rollout order is strict:

1. Verify PostgreSQL and Redis health/stateful-service identity.
2. Build the exact candidate API image and select exactly one direct migration
   target on the repository head's single linear chain. Verify that target is
   the current database revision's direct successor and is classified
   `additive`.
3. Create a new tagged pre-migration PostgreSQL backup through the approved
   backup boundary.
4. Identify that new snapshot relative to the pre-run inventory, restore it only
   into an isolated temporary verification directory, and require one non-empty
   custom dump with a valid `pg_restore --list`. Run that parser in a
   network-disabled, read-only helper container from the immutable image ID of
   the already healthy PostgreSQL service; do not require a separately managed
   host PostgreSQL client.
5. Run the migration once only after explicit operator or protected-environment
   approval.
6. Verify production database revision equals the explicitly reviewed target.
7. For an intermediate target, preserve the running API and recheck localhost
   and public `/api/livez`. The old API can be intentionally unready while its
   Alembic head is one revision behind the migrated database. For the repository
   head, recreate only `studio-api` from
   the already captured candidate image, verify running image identity, then
   verify localhost and public API health.

Ordinary web/API/worker component CD does not own this sequence. The preferred
automated path is the separately protected migration release lane below. The
manual commands remain a fallback for a diagnosed operator task.

### Approval-gated migration release lane

`.github/workflows/studio-platform-cd.yml` detects Alembic changes but keeps the
lane disabled unless repository variable
`STUDIO_MIGRATION_RELEASE_ENABLED=true`. A selected release job enters GitHub
environment `studio-production-migration`. When that environment is correctly
protected, GitHub pauses the job for its required reviewer before environment
secrets or VPS steps become available. Environment binding or a green job alone
is not evidence that the pause and approval occurred. The job sends exactly
`release <main-sha> <target>` to a dedicated root SSH key whose forced command is
`/usr/local/sbin/studio-migration-release-wrapper`.

The root-owned wrapper accepts only that command, where target is `head` or one
bounded Alembic revision identifier. It locks the release,
fast-forwards the clean `studio-deploy` checkout to the exact current remote
`main`, materializes the versioned runner from that SHA, clears the SSH
environment, and executes the runner. The runner requires root-owned protected
backup/OAuth secret files, the health/schema conditions below, and a stopped worker.
It requires healthy PostgreSQL/Redis, a running API process and local API
liveness. A non-healthy API is accepted only for diagnosed schema-ahead recovery
when the running image head is exactly the current database revision's direct
predecessor and the selected migration is exactly the current database
revision's direct successor. It builds the API candidate, verifies the selected one direct additive
migration is an ancestor of the single repository head,
creates and restores a new tagged snapshot for dump validation, migrates once,
recreates API from the captured image ID only for the repository-head target,
and emits success only after local/public health. Dump parsing uses the exact running PostgreSQL image ID in
an ephemeral container with no network, a read-only root filesystem, dropped
capabilities, no image pull, and only the restored dump mounted read-only. An
ephemeral tmpfs covers the image-declared PostgreSQL data path so the validation
does not create or attach a persistent Docker volume.

Schema-ahead recovery reads `alembic heads` from the exact captured running API
container ID with `docker exec --user 10001:10001`, bytecode writes disabled and
no database command. A running container can outlive its local image-store
entry; a missing old image must not trigger an image rebuild, API restart or a
skipped schema check. Container replacement, an unsuccessful metadata probe or
anything other than one matching head blocks before backup/migration.

One-time setup must be completed in this order:

1. Merge the reviewed workflow, wrapper, runner, and tests to `main`; keep
   `STUDIO_MIGRATION_RELEASE_ENABLED` absent or `false`.
2. Create GitHub environment `studio-production-migration`, add at least one
   required reviewer, and keep environment secrets scoped to that environment.
   If the sole operator is also the workflow initiator, do not enable
   prevent-self-review or that operator cannot approve the deployment.
3. Add environment secrets `STUDIO_MIGRATION_DEPLOY_HOST`,
   `STUDIO_MIGRATION_SSH_KEY`, and `STUDIO_MIGRATION_KNOWN_HOSTS`. Use a new
   dedicated Ed25519 key; do not reuse the ordinary deploy key. Verify the host
   key out of band before storing the known-hosts entry.
4. On the VPS, require a clean `main` checkout owned by `studio-deploy`.
   Because the lane is still disabled, the merge-triggered workflow may select
   no VPS deploy job and therefore may not update this checkout. Fast-forward it
   explicitly as `studio-deploy`, verify `HEAD` equals the reviewed merge SHA,
   then install the wrapper as a root-owned regular file:

   ```bash
   sudo -u studio-deploy \
     git -C /opt/elevenlabs-studio fetch --prune origin main
   sudo -u studio-deploy \
     git -C /opt/elevenlabs-studio merge --ff-only origin/main
   sudo -u studio-deploy \
     git -C /opt/elevenlabs-studio status --short
   sudo -u studio-deploy \
     git -C /opt/elevenlabs-studio rev-parse HEAD

   sudo install \
     -o root -g root -m 0755 \
     /opt/elevenlabs-studio/deploy/studio/studio-migration-release-wrapper.sh \
     /usr/local/sbin/studio-migration-release-wrapper
   ```

   Stop if status is non-empty or the printed SHA is not the reviewed merge
   SHA. Do not fetch/merge this checkout as root.

5. Add only the dedicated public key to root's `authorized_keys` with this
   forced-command shape; replace the placeholder with the public key, never the
   private key:

   ```text
   restrict,command="/usr/local/sbin/studio-migration-release-wrapper" ssh-ed25519 <DEDICATED_MIGRATION_PUBLIC_KEY>
   ```

6. Verify `/etc/elevenlabs-studio/backup.env`, its referenced restic/R2 files,
   and the primary plus maintenance OAuth secret files are root-owned regular
   files with mode `0400` or `0600`. Runtime `.env` must contain complete,
   distinct primary/maintenance OAuth configuration without multiline or
   placeholder assignments.
7. Keep `STUDIO_MIGRATION_RELEASE_ENABLED=false` and dispatch the separate
   `Studio Migration Environment Probe` workflow from `main`, supplying the
   exact current 40-character `main` SHA. This environment-bound probe has no
   checkout, token permissions, secrets, SSH, database, API, or VPS action.
   Verify that GitHub first shows the job as `Waiting`, approve it as the
   configured required reviewer, and then verify the deployment review history
   records that approval. If the job starts immediately or no review is
   recorded, stop and repair environment protection; a green probe alone is not
   approval evidence.
8. Set `STUDIO_MIGRATION_RELEASE_ENABLED=true` only when a reviewed direct
   migration is actually pending and every release prerequisite is current.
   Dispatch `component=migration` from `main` with `migration_target` set to the
   one direct successor, then approve the waiting environment deployment in the
   GitHub UI. For consecutive pending revisions, repeat this as a new protected
   run for each direct successor; never select the final head while an earlier
   successor is still pending. `migration_target=head` remains appropriate when
   the repository head itself is the one direct successor. Later merged
   migration changes may select the same approval gate automatically. If
   production is already at repository Alembic head, leave the variable `false`
   and do not dispatch the migration release merely to test the gate.

When a merged change modifies the forced-command wrapper contract, reinstall
the reviewed exact-main wrapper before enabling the lane:

```bash
sudo install \
  -o root -g root -m 0755 \
  /opt/elevenlabs-studio/deploy/studio/studio-migration-release-wrapper.sh \
  /usr/local/sbin/studio-migration-release-wrapper
```

The following `0017 -> 0018 -> 0019 -> 0020` sequence is a superseded historical example, not a current migration instruction. Repository history now extends through additive `0031_provider_account_snapshots`. For every future release, first read the exact production revision and the exact reviewed repository head, then apply only one direct additive successor per approval and verified backup. Never copy historical literal revisions into a live command:

1. `migration_target=0018_job_part_progress`; approve and require
   `api_deployed=no` plus local/public liveness. Readiness may be intentionally
   unavailable until the repository-head successor recreates the API.
2. `migration_target=0019_job_media_clip`; approve and require
   `api_deployed=no` while repository head remains `0020`.
3. `migration_target=0020_provider_part_checkpoints`; approve and require
   `api_deployed=yes` plus localhost/public API health.
4. Disable the enable variable before the separate worker deployment.

The lane never starts or deploys the worker, calls providers or Google, reloads
nginx, restores into PostgreSQL, downgrades, retries, or rolls back. A manual
dispatch is not retry authority. If a failure marker reports
`migration_applied=yes`, do not rerun that workflow: inspect the exact database
revision and candidate/running API image, then choose a separately approved
forward recovery. The protected lane may perform the next direct successor only
when its schema-ahead proof succeeds; otherwise stop for a manual recovery
decision. If it reports `migration_applied=no`, correct the diagnosed blocker and
obtain a new environment approval before another attempt.

### Manual fallback

```bash
cd /opt/elevenlabs-studio

STUDIO_BACKUP_TAG=pre-migration \
  scripts/backup_studio_postgres_r2.sh
```

Only documented backup tags are allowed by the script: `scheduled` and `pre-migration`. Confirm backup success before setting migration confirmation.

The fallback migration command also requires the verified full snapshot ID,
the exact current and target revisions, and the captured API image ID:

```bash
STUDIO_DEPLOY_DIR=/opt/elevenlabs-studio \
STUDIO_PRE_MIGRATION_BACKUP_CONFIRMED=yes \
STUDIO_PRE_MIGRATION_BACKUP_SNAPSHOT=__REQUIRED_64_HEX_SNAPSHOT_ID__ \
STUDIO_EXPECTED_MIGRATION_FROM=__EXACT_CURRENT_PRODUCTION_REVISION__ \
STUDIO_EXPECTED_MIGRATION_TO=__ONE_DIRECT_ADDITIVE_SUCCESSOR__ \
STUDIO_EXPECTED_REPOSITORY_HEAD=__EXACT_REVIEWED_REPOSITORY_HEAD__ \
STUDIO_EXPECTED_API_IMAGE_ID=sha256:__REQUIRED_64_HEX_IMAGE_ID__ \
  scripts/migrate_studio_platform.sh
```

The migration script does not create or verify the backup and does not deploy
API; the caller must establish every value above from the same reviewed
candidate. These commands must not print secret values. Do not use the manual
fallback to bypass the protected lane or to retry a partially applied release.

## Backup and restore rehearsal

Backup/restore rehearsal is manual and isolated:

- restore only into a separate temporary PostgreSQL database/target;
- invalidate restored sessions before any access test;
- run read-only smoke checks only;
- destroy only the temporary target after verification;
- never delete, overwrite, prune, or reset live production data from the rehearsal path.

## Reference storage isolation

Studio persists every local reference with an exact class: `transcription` or `audio_processing`. Existing rows and objects remain `transcription`; migration `0029_source_reference_class` adds the class with that safe default and does not move or delete objects. New transcription uploads use the transcription-reference boundary. New Audio uploads and reusable Audio outputs use the audio-reference boundary. Transcript outputs remain in Google Drive/Docs, not in either reference bucket.

Configuration requirements:

- `STUDIO_SOURCE_S3_*` configures transcription references and `STUDIO_AUDIO_REFERENCE_S3_*` configures audio references;
- the two bucket identities, access-key file paths, secret-key file paths and non-empty lifecycle rule identifiers must be distinct; equality or any missing boundary fails closed before upload, processing or cleanup;
- each credential pair must be restricted by the storage provider to its own bucket and required object operations only; distinct file paths alone are not permission evidence;
- each bucket must have an independently verified provider-side lifecycle rule matching its declared identifier; the identifier is configuration evidence, not proof that the rule exists or is enabled;
- endpoint URL, region, bucket, lifecycle rule identifier, pending-upload TTL, presign TTL, and maximum upload bytes are non-secret runtime settings; maximum upload bytes must be within `1..2147483647` and is exposed to authenticated browsers only through the safe `no-store` upload-policy DTO;
- both access key IDs and secret access keys are provided through separate operator-managed secret files;
- object keys, private bucket names when sensitive, secret-file paths, and source bytes remain server-only;
- only the authenticated owner-scoped upload-initiation response may expose a PUT-only presigned URL; it must be `no-store`, expire within 60–900 seconds, and must not appear in logs, diagnostics, evidence, later metadata responses, or browser storage;
- `STUDIO_SOURCE_UPLOAD_TTL_SECONDS` defaults to 3600 seconds for unfinished uploads; post-completion retention is an allowlisted per-user PostgreSQL preference managed in PWA settings, not a runtime env value;
- API and worker must receive the same complete isolation config and secret mounts; runtime health performs a read-only `HEAD` against both exact buckets and exposes only safe per-class status values;
- deploy order is external provider setup -> protected additive migration `0029` -> API/web -> stopped-worker config validation -> worker deploy. Do not deploy the fail-closed API/worker against the old one-bucket runtime configuration;
- no rollout step copies, renames or deletes existing objects. Legacy reads and cleanup continue through the persisted/default `transcription` class after both boundaries are configured.

Before enabling the release, an operator must confirm without recording names or secrets: two distinct private buckets exist; each independently scoped credential can access only its intended bucket; each declared lifecycle rule exists and is enabled; both safe runtime health boundaries are `ready`. Missing evidence is `PENDING_EXTERNAL_GATE`, not authority to reuse the legacy bucket or credential.

## Google OAuth runtime configuration

Google OAuth runtime config is fail-closed. OAuth endpoints must remain unavailable or reject safely until required non-secret settings and a non-empty client secret file are present.

Primary Picker settings include client ID, redirect URI, scopes, state TTL, and the client-secret file path. The client secret itself stays in an operator-managed file. Current Drive/Picker integration permits only exact `openid`, email identity, `https://www.googleapis.com/auth/drive.file`, and `https://www.googleapis.com/auth/drive.readonly`. `drive.readonly` is a restricted broad-read scope required for arbitrary source-folder descendants; `drive.file` remains the output-write boundary. Full `drive` and unrelated scopes are forbidden. A primary connection missing either Drive scope or reporting an additional scope is not Picker-ready and must be disconnected/reconnected before browser-token issuance. Scope rollout may require Google OAuth consent-screen publication/verification or a security assessment; never weaken the boundary to bypass an external Google gate.

Transcript maintenance uses a second OAuth client and a different client-secret file. Its exact server-only grant is `openid email https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/documents`. Configure `STUDIO_GOOGLE_MAINTENANCE_OAUTH_CLIENT_ID`, `STUDIO_GOOGLE_MAINTENANCE_OAUTH_CLIENT_SECRET_FILE`, `STUDIO_GOOGLE_MAINTENANCE_OAUTH_REDIRECT_URI`, and `STUDIO_GOOGLE_MAINTENANCE_OAUTH_SCOPES` before the dependent API and worker rollout. The maintenance client ID and secret file must differ from the primary client. The redirect may use the same reviewed callback route. The maintenance grant must resolve to the same Google subject as the active primary connection; a mismatch is rejected and must not replace either grant.

Only `studio-api` and `studio-worker` receive and copy the maintenance client secret: API owns consent/status/enqueue authority, while worker refreshes the stored owner grant for durable execution. Do not mount it into `studio-web`, do not issue its access token to a browser, and do not record client IDs, secret paths, grant tokens, Google subjects, or email values as validation evidence.

Picker readiness is separate from OAuth readiness. `STUDIO_GOOGLE_PICKER_API_KEY` and `STUDIO_GOOGLE_PICKER_APP_ID` must be configured, non-empty, and not placeholder values. OAuth connection, Picker configuration, and writable output folder selection are three different preconditions. Do not record Picker key/app ID values in validation evidence.

The host nginx file is the single browser security-header authority. Keep script and frame sources limited to the documented Google Picker hosts; do not add `unsafe-eval` or wildcard script sources. Its `Referrer-Policy` must be `origin`: the website-restricted Picker developer key needs the public origin, while paths and query strings remain undisclosed. Do not weaken the API-key website restriction to compensate for a missing referrer. The PWA's presigned local-upload PUT uses the same origin-only document policy, disables cross-origin browser credentials and never persists or reflects the capability URL. The runtime-configured upload destination currently requires general HTTPS in `connect-src`; narrow it only after all intended production S3/R2 origins are explicit and a real Picker/upload smoke test is available. Standard component CD still does not apply or reload host nginx. Once separately bootstrapped, the protected manual Studio edge lane may update only the canonical security-header snippet under the boundary below.

### Protected Studio host-edge release

Bootstrap is a separate root/operator action. Before enabling the workflow:

1. Review `deploy/studio/studio-edge-release-wrapper.sh`, install it as
   `/usr/local/sbin/studio-edge-release-wrapper`, root-owned and mode `0755`,
   and verify its installed hash against the merged source without printing key
   material.
2. Create a dedicated SSH key for this lane. Add only its public key to root's
   `authorized_keys` with
   `restrict,command="/usr/local/sbin/studio-edge-release-wrapper"`. Do not
   reuse the component or migration deployment identity.
3. Reuse the existing protected GitHub environment
   `studio-production-migration`, already restricted to `main` and the intended
   human reviewer. Add the separately named environment secrets
   `STUDIO_EDGE_DEPLOY_HOST`, `STUDIO_EDGE_SSH_KEY`, and
   `STUDIO_EDGE_KNOWN_HOSTS` without copying their values into evidence. Do not
   reuse the migration SSH identity for the edge lane.
4. Keep repository variable `STUDIO_EDGE_RELEASE_ENABLED=false` except for one
   reviewed release window. Confirm the active site contains exactly one
   include of `/etc/nginx/snippets/studio-security-headers.conf`; the lane will
   not edit the site to create or repair that include.

For a reviewed release, use `Studio Edge CD` manual dispatch with the full
current `main` SHA. Approve only after repository/Studio CI for that SHA is
green and the intended canonical snippet diff is reviewed. The workflow must
show both `[studio-edge-release] OK` and
`[studio-edge-release-wrapper] OK`; then verify the public response and the
feature whose browser policy changed. Return the enable variable to `false`.

On failure, stop. The release program automatically restores the exact prior
snippet only when mutation already began, runs `nginx -t`, and reloads nginx.
Do not blindly rerun a failed release, manually edit the snippet concurrently,
or treat a green skipped job as deployment evidence. Inspect the safe phase,
reason, rollback state, backup path, exact checkout SHA, and public health
before selecting a separate recovery action.

Roll out OAuth/Picker and maintenance config through API deployment only when runtime files are ready and production is migrated through `0017_google_maintenance_oauth`. Validate the primary and maintenance connection states separately with authenticated owner-scoped flows, confirm maintenance consent is required before maintenance actions, and confirm unauthenticated connection/status endpoints still reject as expected.

## Transcript maintenance target-mode canary

Google Docs standardization and **Манифест Studio** are two separately initiated stateful operations. Each panel independently offers one recursive folder tree or one Google Doc. A merged source revision, green CI, successful component deployment, maintenance consent, or an authenticated browser smoke does not authorize any `apply`. Every operation/mode pair requires its own selected target, reviewed dry-run, and explicit apply decision. Standardization may update eligible Google Docs in place; **Манифест Studio** does not change Docs and writes only eligible current-document metadata to PostgreSQL.

### Preconditions

- Use only merged `main` with green required CI and verified web/API commit and image identities.
- Transcript maintenance OAuth was introduced by `0017_google_maintenance_oauth`; durable execution requires additive `0028_transcript_maintenance_runs`. Repository history now extends through successor `0031_provider_account_snapshots`, but actual production revision must be read and checked against the exact deployed API before the canary. Apply only the direct reviewed successor with its own tagged pre-migration backup and protected release before dependent API/worker deployment.
- Verify public and localhost health, API migration readiness, and an authenticated owner-scoped session.
- Verify the primary Picker connection has exact `openid email drive.file drive.readonly`, then complete the separate server-only maintenance consent with the same Google account and exact maintenance scope boundary.
- Prepare a small approved recursive canary root containing copies or otherwise explicitly approved representative documents and one approved single-document canary. The server scans the entire selected root tree in folder mode and only the exact selected native Google Doc in document mode; stop if either boundary differs from the approved target.
- Keep transcription jobs and provider processing out of this operation. Maintenance runs use the worker only for Drive/Docs execution after normal audio/transcription claims; they must not create a transcription job or call a transcription provider. Worker rollout is therefore required for this revision but is not provider-call authority.

### Dry-run and authorization

1. Open `Транскрибации → Обслуживание`, select the separate **Стандартизация Google Docs** or **Манифест Studio** operation, choose the intended mode, and select exactly one approved root folder or Google Doc through the app-owned Drive dialog.
2. Run that operation's `dry-run` only. Enqueue must return promptly, after which the owner-scoped UI restores persisted stage/progress to a terminal preview. The preview is non-mutating, browser-safe, rate-limited and bound to that workflow/target; apply still performs fresh server revalidation.
3. In folder mode review selected, action, unchanged, blocked, skipped-file, and descendant-folder counts. In document mode verify exactly one document was checked. Current documents must be skipped by standardization; already-cataloged current documents must be skipped by **Манифест Studio**. Stop on an unexpected target boundary, global scan failure, or unexplained blocked candidate.
4. Record only the non-private mode, safe aggregate counts, and the operation-specific decision. Do not record folder IDs, document IDs, document names, document bodies, Google payloads, access tokens, subjects, emails, or URLs.
5. Authorize exactly one apply for exactly one operation/mode/target. A standardization preview or apply never authorizes **Манифест Studio**, the inverse is also true, and changing the mode or target requires a new dry-run.

### Apply and post-check

1. Apply once from the reviewed PWA panel. Do not send the endpoint manually or start parallel apply requests.
2. A per-document inaccessible, unreadable, empty, unsafe, unsupported, or conflicting candidate is reported as blocked without aborting safe siblings. A global authorization, rate-limit, availability, timeout, malformed-scan, or traversal-limit failure aborts the operation. On a global or incomplete result, stop and do not retry blindly.
3. Review aggregate apply outcomes, then run a new dry-run for the same mode,
   target, and operation. Successfully standardized documents should now be
   current; successfully imported catalog entries should now be
   unchanged/already present. If a successfully imported entry is offered for
   import again, do not apply again: record only safe aggregate evidence and
   stop for source/deployed-image/catalog-authority reconciliation.
4. For standardization only, manually inspect approved canary copies or Google version history to confirm content preservation and the intended versionless `transcript_doc` structure: title `Heading 2`, ordinary transcript body `11 pt`, and Russian `Спикер N:` bold `14 pt`. Do not copy transcript text into evidence. **Манифест Studio** must leave Google Docs unchanged.
5. Confirm that neither operation created a transcription job, provider attempt, output document, or worker activity. Record only safe aggregate or normalized audit evidence.

### Recovery boundary and evidence

A PostgreSQL restore can recover catalog metadata, but it does not automatically revert Google Docs changed by standardization before a database failure. Google recovery depends on approved canary copies or Google version history. If standardization may have partially changed external documents, do not automatically rerun apply, delete documents, restore production PostgreSQL, or broaden permissions. Stop and make recovery a separate operator-reviewed stateful task.

Safe evidence includes the merged commit, required CI result, deployed web/API image identities, database revision, backup snapshot ID, public and localhost health, non-private target mode, aggregate dry-run/apply counts, absence of provider/job mutations, and the explicit operator approval. It must exclude private folder/object identifiers, document names or bodies, Google responses, credentials, and tokens.

## Component deployment

Web and API are separate deployable components.

- Web deployment rebuilds/recreates only the web component, verifies image identity, then checks localhost health.
- API deployment rebuilds/recreates only the API component, verifies image identity, then checks dependency/schema-aware localhost `/api/readyz`; legacy `/api/healthz` remains a readiness alias.
- A migration mismatch blocks API deploy success/readiness.
- Ordinary component CD does not deploy/start/recreate `studio-worker` and does not maintain PostgreSQL, Redis, migrations, backups, restores, nginx, volumes, runtime secrets, or stateful services. The distinct protected migration lane is limited to the sequence documented above.
- Failed component health checks fail loudly and must not trigger unreviewed destructive rollback.

## Manual processing preflight

Before any processing rollout or canary, verify without printing sensitive values:

- target checkout, branch, remote, and deploy directory identity;
- tracked working tree state is clean or explicitly reviewed;
- runtime env/secret files exist where expected, without displaying values;
- PostgreSQL and Redis health;
- both reference-storage boundaries, distinct secret-file paths and declared lifecycle identifiers are complete;
- primary Google OAuth config is complete and authenticated for the smoke account;
- maintenance OAuth uses a separate client/secret, exact server-only scopes, and the same Google account;
- Picker runtime config has non-placeholder `STUDIO_GOOGLE_PICKER_API_KEY` and `STUDIO_GOOGLE_PICKER_APP_ID` values without recording them;
- primary OAuth scopes equal `openid email drive.file drive.readonly`; maintenance scopes equal `openid email drive.metadata.readonly documents`; changed scopes have been handled by the corresponding disconnect/reconnect if needed;
- credential master key and encrypted BYOK records are usable;
- exactly one intended active ElevenLabs BYOK credential exists for the smoke account;
- writable Google output folder selection exists;
- production database revision is known and compared to the exact reviewed repository Alembic head for the intended deployment;
- exactly one worker instance is intended for the canary.

The host preflight validates current Compose-mounted runtime secret files only
through the reviewed `container_entrypoint --validate-mounted-secret` mode inside
the healthy API container. That mode accepts only keys from the entrypoint's
secret allowlist, performs no copy or write, emits no value, and exits before
starting an application command. Both reference-storage credential pairs additionally receive
their bounded structural/placeholder validation. Do not replace this with direct
deploy-user reads, stale runtime-tmpfs inspection, relaxed host permissions, or
ad-hoc root commands.

## Controlled worker rollout sequence

1. Keep `studio-worker` stopped until migration and runtime readiness are confirmed.
2. Create/confirm the tagged pre-migration database backup if a migration or stateful rollout is involved.
3. Verify production database revision equals the exact reviewed repository head where the intended deployment is expected to be current.
4. Deploy web/API only through the approved isolated component deployment model.
5. Verify intended commit/image identity, component-baked release/build/commit identity, localhost readiness, public readiness, authenticated session behavior, and output endpoint availability without exposing another owner’s data.
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

### Partial-provider continuation

`partial_provider_result` is not automatic retry authority. On deployments containing migration `0020_provider_part_checkpoints`, the owner-scoped job detail may offer one of two explicit actions:

- continue only missing ElevenLabs parts when an exact contiguous set of encrypted, unexpired completed-part checkpoints validates; or
- restart the full file only when checkpoints are unavailable and the last durable underlying failure is safely classified as provider authentication rejection, request rejection, or rate limiting.

Both actions require an explicit provider-cost confirmation. A continuation may still charge for every missing part. A full restart may charge for the entire file. Never simulate either action with SQL, direct worker invocation, direct provider calls, or job-status edits. Automatic lease recovery must remain blocked for this state.

Before approving an owner retry, inspect browser-safe metadata only: job status, aggregate error, safe provider category, completed/total parts, checkpoint availability, attempt count, and selected action. Do not inspect transcript content, checkpoint ciphertext, raw provider response, source bytes, secrets, or external document identifiers. Stop if the category is timeout, unavailable, malformed response, lifecycle/lease loss, persistence failure, unknown, or if readiness reports unavailable. Checkpoints expire within 24 hours and are removed on completed output, cancellation, explicit full restart, or worker cleanup; expiry is expected and is not a reason to bypass the API gate.

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
python -m studio_api.worker_health --mode readiness
```

Readiness verifies PID 1 has the worker process shape, the runtime has exact UID/GID `10001` with no supplementary groups, the component-baked identity is exact, PostgreSQL answers as login `studio_worker`, that role has the expected non-superuser attributes and required/prohibited grants, the database is at the reviewed Alembic head, and the authoritative heartbeat belongs to this exact container-process incarnation and commit and is not stale. `python -m studio_api.worker_health --mode liveness` checks only PID 1 and process identity and deliberately does not load runtime configuration or touch dependencies. Neither mode claims jobs, reads job payloads, calls providers, calls Google, uses Redis as queue logic, or checks object storage. Readiness updates no state; the worker process owns the heartbeat write.

### Worker status

```bash
cd /opt/elevenlabs-studio
STUDIO_DEPLOY_DIR=/opt/elevenlabs-studio scripts/manage_studio_worker.sh status
```

The status command reports only safe container state, exit code, drain state, Docker health, running/stopped container image ID, current commit tag presence, commit tag image ID, identity match, rollback-candidate presence and effective Docker CPU/memory/swap/PID/read-only/capability/security/network values. `isolation_match=yes` requires the reviewed two-CPU, 4-GiB/no-swap, 256-PID, read-only-root, capability and two-network contract; any other effective state is `no`, not success. Any worker lifecycle operation, including status, drain, pause, resume, deploy, and rollback, blocks fail-closed with `STUDIO_WORKER_OP_BLOCKED reason=multiple_worker_containers` (or the deploy equivalent) if more than one `studio-worker` container is discovered; multiple containers are an invalid topology, not a supported mode. Only `container_state=exited` with `exit_code=0` is `drain_state=gracefully-drained`; non-zero exits, including `137` and `143`, are `abnormal-exit` and are not paused/drained. It prints `STUDIO_WORKER_STATUS_OK` when the read-only status check completes, even when the worker state itself requires operator review.

### Dedicated worker database role and tariff snapshot

Before the first isolated worker deploy, stage a separate root-owned password file outside the checkout, set `STUDIO_WORKER_POSTGRES_PASSWORD_FILE` in `deploy/studio/.env`, and configure the three non-secret tariff fields shown in `.env.example`. Do not reuse the PostgreSQL bootstrap password. With the worker absent or gracefully drained and the trusted checkout clean, apply and verify the reviewed direct-grant role:

```bash
cd /opt/elevenlabs-studio
STUDIO_DEPLOY_DIR=/opt/elevenlabs-studio scripts/configure_studio_worker_db_role.sh apply
STUDIO_DEPLOY_DIR=/opt/elevenlabs-studio scripts/configure_studio_worker_db_role.sh verify
```

The script reads the password only from the root-owned `0400`/`0600` file, sends it to `psql` over stdin and prints no credential. It revokes broad table/sequence access and any role memberships before granting the current worker allowlist; new tables receive no implicit worker access. `verify` is read-only. `disable` changes the role to `NOLOGIN` and is an explicit operator recovery action only after a safe worker drain; it is not a normal rollback step.

Attribute verification evaluates one boolean predicate in PostgreSQL and accepts only the single `psql` result `t`; an absent role, unexpected attributes, query failure or unavailable Git status must block. If `apply` committed but a verifier defect stopped the flow, deliver the reviewed correction and run `verify` first. Do not repeat grants/password activation or start the worker merely to bypass a failed verification.

`STUDIO_ELEVENLABS_SCRIBE_V2_RATE_PER_HOUR_USD`, `STUDIO_ELEVENLABS_PRICING_EFFECTIVE_DATE` and `STUDIO_ELEVENLABS_PRICING_SOURCE=elevenlabs_public_api_pricing` form one complete snapshot. The operator verifies the value and effective date against the [official ElevenAPI pricing page](https://elevenlabs.io/pricing/api?price.section=speech_to_text) before changing it. Missing/partial/unsupported pricing blocks a provider call. A job keeps the first accepted snapshot across all parts, so changing environment pricing affects only jobs that have not started provider usage. Studio shows attributable confirmed usage cost, not an ElevenLabs invoice debit after free quota or subscription credits.

The same active BYOK key is read server-side for the official `GET /v1/user/subscription` and `POST /v1/workspace/analytics/query/usage-by-product-over-time` account views. It must have the provider read scopes for subscription and workspace analytics and satisfy any configured IP allowlist. No second Studio credential is required. The UI shows an actionable unavailable/stale state when either scope, allowlist, authentication, rate limit or provider availability blocks a read; never broaden or replace a provider key during deploy merely to make this panel green.

Account actuals are refreshed through a five-minute server snapshot and a visible manual refresh. They include provider tier/status, period characters, reset, usage-based billing entitlement/cap, current overage, invoice aggregates and workspace credits by product. They do not replace the immutable job tariff snapshot: ElevenLabs does not expose an official structured price-catalog endpoint, so do not scrape the pricing page or derive an hourly Scribe price from account credits. When public Scribe pricing changes, update the three non-secret tariff fields together in a reviewed deployment; already-started jobs retain their first accepted snapshot.

### Initial worker deploy

A worker deploy is manual-only and must be run only when the worker is absent or already drained/stopped, the dedicated role verifies successfully, the runtime secret/pricing configuration is complete, and the production schema exactly matches the new worker image:

```bash
cd /opt/elevenlabs-studio
STUDIO_DEPLOY_DIR=/opt/elevenlabs-studio scripts/deploy_studio_platform_component.sh worker
```

The deploy script fast-forwards the trusted branch, exports the exact fetched commit and validated release version as component build arguments, preserves a previous stopped `exit_code=0` worker image as `elevenlabs-studio-worker:rollback-candidate` before building, builds only `studio-worker`, verifies PostgreSQL health without requiring Redis, compares current database revision with the new worker image Alembic head, tags the new worker image with the current commit, recreates only `studio-worker` with `--no-deps`, verifies the exact running image identity, waits for process-incarnation-aware Docker readiness, and only then prints `STUDIO_PLATFORM_WORKER_DEPLOY_OK`. API and worker use separate local image tags: `elevenlabs-studio-api:local` and `elevenlabs-studio-worker:local`. Worker operations must not retag or overwrite the API local image. It does not run migrations, recreate API/web/PostgreSQL/Redis, drain an active worker, run a canary, or perform automatic rollback.

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
→ apply/verify dedicated worker database role and runtime configuration
→ deploy worker manually
→ verify image/commit identity
→ verify `isolation_match=yes` and readiness as `studio_worker`
→ verify healthy
→ leave idle
→ operator separately decides whether to run controlled canary
```

Source merge does not deploy the worker. A successful worker deploy does not by itself prove production-live processing. The bounded `PWA-PROCESSING-ROLLOUT-01A` one-small-source canary is complete with exactly one persisted Google Docs output; broader selected-mode or workload claims still require separate operator evidence.

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

GitHub Actions supports manual `workflow_dispatch(component=worker)` using the
ordinary deploy SSH model and a materialized trusted deploy script. Push events
never auto-deploy the worker, including worker-only source changes. The separate
`workflow_dispatch(component=migration)` path uses the protected environment and
dedicated root forced-command identity described above; it is available for
first activation but is not blind retry authority. Neither path drains workers,
runs canaries, calls providers/Google, or performs automatic rollback.

## Output reconciliation operations boundary

`PWA-OUTPUT-RECONCILIATION-01` uses schema introduced by `0012_output_reconciliation_cases` and is part of the operator-evidenced production baseline migrated through `0015_user_source_retention`. The later catalog, maintenance OAuth, and progress migrations `0016_transcript_catalog_entries`, `0017_google_maintenance_oauth`, and `0018_job_part_progress` do not gate reconciliation behavior. Any future API/worker revision still requires schema compatibility and component identity checks; ordinary component CD must not run migrations.

When a job fails with `output_reconciliation_required`, the owner may use the Studio PWA action or API check endpoint to query Drive by the internal opaque appProperty token and the job output-folder snapshot. Operators must not ask users for raw Google document IDs, must not create duplicate Google Docs, must not delete possible duplicates, must not retry provider processing as reconciliation, and must not inspect transcript/document bodies as evidence. Zero matches remain unresolved for later explicit checks. Multiple matches are a conflict requiring manual investigation outside the automated path.

The bounded production canary produced one resolved reconciliation case and required no manual reconciliation mutation. That evidence proves the deployed read path for that case, not arbitrary uncertain-output recovery; an actual `output_reconciliation_required` case must still follow the fail-closed procedure above.


### Studio output reconciliation runtime guardrails

- Existing unresolved reconciliation cases are treated as permanent create blockers for the affected job-source relation; operators must not restart processing to create another Google Doc with the same appProperty token.
- A `prepared` case alone is internal evidence and should not be interpreted as owner reconciliation availability; pre-create persistence failure is a normal safe processing failure, not output uncertainty.
- Source retention cleanup does not block reconciliation because the recovery path uses durable case metadata and a verified Drive candidate rather than source bytes or object storage.
- Conflict is stable and fail-closed: repeated checks may report the conflict, but the system must not choose the first candidate, delete documents, or ask for a manual document ID.

## Source cleanup operations note

Repository Alembic history currently extends through additive `0031_provider_account_snapshots`. The deployed production head must always be read from PostgreSQL and verified rather than inferred from repository source or live screenshots; until protected delivery proves otherwise, production remains at the separately recorded revision. The older source-cleanup and retention schema through `0015_user_source_retention` has separate production evidence. Source cleanup is durable PostgreSQL state on `sources`; the persisted/default `reference_class` plus exact `s3_bucket` select the only permitted storage boundary, and mismatch or incomplete isolation fails closed without fallback. The allowlisted per-user retention preference is durable PostgreSQL state on `users`. Cleanup is processed as bounded worker idle maintenance after normal job claim/orchestration finds no job. Safe diagnostics use normalized source deletion/retention/cleanup events and must not log object keys, buckets, filenames, Drive file IDs, presigned URLs, raw storage errors, or secrets. The authenticated smoke proved that source removal queued background cleanup, but it did not inspect the later physical R2 deletion outcome.

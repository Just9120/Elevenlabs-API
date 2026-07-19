# Legacy Studio web deploy runbook

This runbook documents the legacy/stateless Studio web-only path until a separate `PWA-LEGACY-AUTHORITY-01` cleanup task removes or formally supersedes the runtime code.

This path:

- deploys only the stateless `studio-web` app shell;
- does not support the Studio API, worker, processing, PostgreSQL, Redis, migrations, source uploads, BYOK credentials, Google OAuth/Drive/Docs, or persisted jobs;
- is not a production processing rollout;
- must not be used instead of the platform Compose stack for current Studio platform work.

## Preflight identity checks

Before using the legacy path, verify without secrets:

- deploy directory is the expected Studio checkout, commonly `/opt/elevenlabs-studio`;
- remote is the expected `Just9120/Elevenlabs-API` repository;
- branch is the intended deployment branch;
- tracked working tree is clean or explicitly reviewed;
- intended Compose service identity is `studio-web`;
- service binds only to `127.0.0.1:8181`;
- no API, worker, database, Redis, queue, volume-backed state, migration, cleanup, or pruning is in scope.

## Host nginx and Certbot boundary

Host nginx and Certbot remain host-managed. Review the Studio vhost manually before installation/reload. The public route should serve the app shell and health endpoint only for the stateless web path.

## Legacy deploy command

On the deployment host, after preflight review:

```bash
cd /opt/elevenlabs-studio
STUDIO_DEPLOY_DIR=/opt/elevenlabs-studio bash scripts/deploy_studio.sh
```

The script is expected to verify directory, branch, remote, clean tracked tree, Compose identity, localhost-only bind, runtime `.env`, and required Studio files before it builds/restarts only `studio-web`.

## Postflight checks

Record factual secret-free evidence:

- local health: `curl -fsS http://127.0.0.1:8181/healthz`;
- public HTTPS health through nginx: `curl -fsS https://studio.librechat.online/healthz`;
- browser loads `https://studio.librechat.online`;
- web app manifest is reachable from the loaded page;
- service worker registers after online load;
- manual PWA install/open check passes with browser/OS context only;
- offline app-shell reopen works after a successful online load.

Confirm no provider calls, Google OAuth/Drive/Docs activity, server-side uploads, transcription jobs, database, Redis, queue, worker, persistent storage, migration, CD activation, cleanup, pruning, or host configuration changes occurred outside the explicit Studio web vhost.

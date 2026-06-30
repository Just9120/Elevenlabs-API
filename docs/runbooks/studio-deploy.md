# Studio PWA deploy runbook

This runbook is only for operator-run first deployment and verification of the existing stateless Foundation `studio-web` container at `studio.librechat.online`. Repository CD must not perform these steps automatically for the first deployment stage.

## Boundary

- Host nginx and Certbot remain host-managed.
- The Studio container binds only to `127.0.0.1:8181`.
- CD remains disabled for the first deployment stage; do not set repository deployment automation live as part of this runbook.
- This phase has no backend API, authentication, provider keys, provider calls, Google OAuth/Drive/Docs, server-side uploads, transcription jobs, database, Redis, queue, worker, volume-backed state, persistent storage, migrations, automatic rollback, cleanup, or pruning.

## Pre-flight checks

Before changing the host, record factual evidence without secret values or private user content:

1. Confirm DNS for `studio.librechat.online` resolves to the intended VPS address using the operator's trusted DNS tools.
2. Confirm there is no conflicting host nginx vhost for `studio.librechat.online` before installing the Studio vhost.
3. Confirm the deployment directory is the intended isolated clone, for example `/opt/elevenlabs-studio`.
4. Confirm the repository remote is the expected `Just9120/Elevenlabs-API` repository.
5. Confirm the checked-out branch is `main`.
6. Confirm the intended Compose service identity is `studio-web`.
7. Confirm Compose binds `studio-web` only to `127.0.0.1:8181`.
8. Confirm no existing service, container, volume, or host configuration changes are planned outside the explicit Studio vhost and stateless `studio-web` service.

## Operator bootstrap checklist

1. Create a dedicated non-root deploy user on the VPS if one does not already exist for this isolated Studio deployment.
2. Configure a server-side GitHub deploy key or another explicitly approved repository-access method for `Just9120/Elevenlabs-API`.
3. Create an isolated deployment clone, for example `/opt/elevenlabs-studio`, on branch `main`.
4. Copy `deploy/studio/.env.example` to `deploy/studio/.env` and keep `APP_PUBLIC_URL=https://studio.librechat.online`.
5. Review `deploy/studio/studio.librechat.online.nginx.conf`, install it manually into host nginx, and reload nginx only after local review.
6. Obtain or renew the Certbot certificate for `studio.librechat.online` using the host's established Certbot pattern.
7. Manually start or update only the stateless `studio-web` service using the repository deploy script or equivalent operator-reviewed Compose command.

## Manual deploy command on the VPS

```bash
cd /opt/elevenlabs-studio
STUDIO_DEPLOY_DIR=/opt/elevenlabs-studio bash scripts/deploy_studio.sh
```

The script verifies directory, branch, remote, clean tracked tree, compose identity, localhost-only bind, runtime `.env`, and required Studio files before it builds or restarts only `studio-web`.

## Post-flight checks

Record factual evidence without secret values or private user content:

1. Verify local health on the VPS: `curl -fsS http://127.0.0.1:8181/healthz`.
2. Verify public HTTPS health through host nginx: `curl -fsS https://studio.librechat.online/healthz`.
3. Load `https://studio.librechat.online` in a browser and confirm the Studio page renders.
4. Confirm the web app manifest is reachable from the loaded page.
5. Confirm the service worker registers after the online page load.
6. Perform one manual PWA install/open check and record browser/OS context without private content.
7. After a successful online load, disable network access and confirm one offline app-shell reopen check. This confirms only cached app-shell behavior, not offline transcription or offline processing.
8. Confirm no provider calls, Google OAuth/Drive/Docs activity, server-side uploads, transcription jobs, database, Redis, queue, worker, persistent storage, migration, CD activation, cleanup, pruning, or host configuration changes occurred outside the explicit Studio vhost.

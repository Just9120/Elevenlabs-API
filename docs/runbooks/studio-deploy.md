# Studio PWA deploy runbook

This runbook is for operator-run bootstrap and verification of `studio.librechat.online`. Repository CD must not perform these steps automatically.

## Boundary

- Host nginx and Certbot remain host-managed.
- The Studio container binds only to `127.0.0.1:8181`.
- CD is disabled unless repository variable `STUDIO_CD_ENABLED` is exactly `true`.
- This phase has no provider keys, Google credentials, uploads, database, Redis, queue, worker, volume-backed state, or migrations.

## Operator bootstrap checklist

1. Create a dedicated non-root deploy user on the VPS.
2. Configure a server-side GitHub deploy key or another explicitly approved repository-access method for `Just9120/Elevenlabs-API`.
3. Create an isolated deployment clone, for example `/opt/elevenlabs-studio`, on branch `main`.
4. Copy `deploy/studio/.env.example` to `deploy/studio/.env` and keep `APP_PUBLIC_URL=https://studio.librechat.online`.
5. Review `deploy/studio/studio.librechat.online.nginx.conf`, install it manually into host nginx, and reload nginx only after local review.
6. Obtain or renew the Certbot certificate for `studio.librechat.online` using the host's established Certbot pattern.
7. Verify local health after a manual compose start: `curl -fsS http://127.0.0.1:8181/healthz`.
8. Verify public health through host nginx: `curl -fsS https://studio.librechat.online/healthz`.
9. Add GitHub repository secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `STUDIO_DEPLOY_DIR`.
10. Set repository variable `STUDIO_CD_ENABLED=true` only after all previous steps are complete.

## Manual deploy command on the VPS

```bash
cd /opt/elevenlabs-studio
STUDIO_DEPLOY_DIR=/opt/elevenlabs-studio bash scripts/deploy_studio.sh
```

The script verifies directory, branch, remote, clean tracked tree, compose identity, localhost-only bind, runtime `.env`, and required Studio files before it builds or restarts only `studio-web`.

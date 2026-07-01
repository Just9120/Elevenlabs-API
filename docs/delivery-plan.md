# Delivery plan: Elevenlabs-API

## Operational dashboard

- ✅ DOCS-REF-01 — Documentation reconciliation and architecture baseline
- ... (unchanged items omitted for brevity in model reasoning)

## Current checkpoint

Batch Colab remains the stable/fallback product workflow and the only current production path for provider transcription.

`apps/studio/` remains UI-only PWA.

## Active deployment model

The system now uses a single **Studio Platform CD** workflow instead of separate web/API CD pipelines.

### Studio Platform CD

- One GitHub Actions workflow: `.github/workflows/studio-platform-cd.yml`
- Contains two isolated jobs:
  - `deploy-web`
  - `deploy-api`
- Both jobs share a production concurrency group to prevent overlapping deployments.

### Automatic behavior

- Push to `main`:
  - `apps/studio/**` → triggers web deployment
  - `apps/studio-api/**` → triggers API deployment
  - commits affecting both → sequential web then API deployment in one workflow run
- Migration/config/docs-only changes do not trigger deployments

### Manual behavior

- `workflow_dispatch` requires selecting `web` or `api`

### Safety model

- No automatic database migration execution
- No changes to Colab, Google Docs, provider execution, or runtime processing
- Deployment is limited to container updates only

## Notes

Legacy split CD workflows have been removed.

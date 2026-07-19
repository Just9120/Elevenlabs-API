# Historical validation matrix

This file is a historical pointer page kept for repository compatibility. It is not current validation authority.

Current validation guidance lives in `docs/runbooks/validation.md`. Current product status lives in `docs/project-spec.md`, and current delivery state lives in `docs/delivery-plan.md`.

The previous matrix contained obsolete statements about missing Studio backend/auth/database/worker foundations. Those statements are superseded: Studio PWA source-level authentication, persistence, worker, processing, output, diagnostics, migrations, and tests are present in the repository, but Studio processing is not yet confirmed production-live.

## Realtime Colab compatibility notes

Realtime Colab prototype status is experimental. It has no Google Docs output, no manifest mutation, uses a single-use realtime token boundary, and still requires manual Colab runtime validation before any broader claim.

# Architecture

This document is an architecture map, not a delivery plan, runbook, or production-readiness claim. It distinguishes source-level architecture from production deployment status.

## Contours

### Google Colab batch contour

The stable Colab contour runs through notebooks/scripts and remains the operational baseline for batch transcription and Google Docs delivery. It is independent from Studio PWA runtime services and must remain available as the fallback contour.

High-level Colab flow:

1. Operator launches the approved Colab notebook/script.
2. Runtime reads secrets from approved Colab/runtime secret sources without printing values.
3. Source media is processed through provider transcription logic.
4. Transcript output is delivered to Google Docs according to the Colab workflow.
5. Evidence must avoid secrets, transcript bodies, source bytes, document IDs/URLs, and raw external payloads.

Realtime Colab is an experimental standalone/proxy validation path described in `docs/runbooks/realtime-colab.md`.

### Studio PWA contour

Studio PWA is a web platform contour in development. Source-level architecture includes the web frontend, API, PostgreSQL, Redis, object storage, worker entrypoint, provider adapter path, Google Drive/Docs integration, diagnostics, and migrations. Production-live processing is not confirmed without controlled rollout evidence.

## Components

| Component | Source location | Responsibility | Production status note |
| --- | --- | --- | --- |
| Studio frontend | `apps/studio/` | Browser UI for sessions, projects, sources, credentials, Google connection, preparation, jobs, outputs, diagnostics. | Source present; deployment evidence is separate. |
| Studio API | `apps/studio-api/studio_api/` | FastAPI app, auth/session boundaries, owner-scoped APIs, job/source/credential/output/diagnostic services. | Source present; production API deployment does not imply worker processing. |
| Database | PostgreSQL via Studio deployment | Durable users/projects/sources/credentials/jobs/outputs/diagnostics state. | Migrations present through `0014_source_deletion_retention`; production revision requires operator evidence. |
| Alembic migrations | `apps/studio-api/alembic/versions/` | Schema authority for Studio persistence. | Current repository head is `0014_source_deletion_retention`. |
| Redis | Studio deployment | Platform support service; not a processing queue/lock/retry authority unless separately designed. | Production health is operator evidence, not source evidence. |
| Object storage | S3/R2-compatible source storage | Private temporary/local-upload source bytes. | Browser must not receive object keys, presigned URLs, or source bytes. |
| Worker | `apps/studio-api/studio_api/worker.py` and related runner/orchestrator modules | Poll/claim/process at most bounded work according to lease and lifecycle rules. | Implemented at source level; official production deployable component and canary still require validation. |
| Provider path | ElevenLabs modules under `apps/studio-api/studio_api/` | Owner-scoped BYOK transcription execution. | ElevenLabs path present; OpenAI Studio parity unfinished. |
| Google integration | Google OAuth/Drive/Docs modules under `apps/studio-api/studio_api/` | OAuth connection, safe Drive metadata/folder selection, Google Docs output creation. | Source present; exactly-once document creation is not claimed; source-level output reconciliation is present and runtime evidence is separate. |
| Diagnostics | API/frontend diagnostic modules and migrations `0010`/`0011` | Safe diagnostic event/report/debug-session foundation. | Source present; evidence must remain redacted. |
| Deployment | `deploy/studio/`, `.github/workflows/` | Component deployment and preflight automation boundaries. | Deployment changes are governed by `docs/ci-cd-rules.md`; standard CD must not deploy workers or run migrations. Legacy stateless web deploy is documented in `docs/runbooks/legacy-studio-web-deploy.md`. |


## Studio runtime authority map

This map is the compact repository authority for current Studio runtime and deployment paths. It is not production-live evidence.

| Component/path | Classification | Authoritative entrypoint | Image/build path | Runtime service | Durable state | Deployment authority | Legacy replacements / removal condition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Studio web PWA | `authoritative` | `apps/studio/src/main.tsx` built by Vite and served by `apps/studio/nginx.conf` with `/healthz` returning `ok`. Browser-facing config comes from `VITE_APP_PUBLIC_URL` and `VITE_STUDIO_PLATFORM_MODE` build args. | `apps/studio/Dockerfile` | `studio-web` in `deploy/studio/compose.platform.yml` | Browser-safe API metadata only; no durable browser authority. | `scripts/deploy_studio_platform_component.sh web`; standard CI validates lint/test/build/image/Compose only. | Replaces stateless web-only `deploy/studio/compose.prod.yml` for platform production. |
| Studio API | `authoritative` | ASGI app `studio_api.main:app` under `apps/studio-api/studio_api/main.py`. | `apps/studio-api/Dockerfile` | `studio-api` in `deploy/studio/compose.platform.yml` | PostgreSQL is durable authority; env/secret-file paths come from `deploy/studio/.env` based on `deploy/studio/.env.example`. | `scripts/deploy_studio_platform_component.sh api` after PostgreSQL/Redis health and image/database Alembic revision match. | Replaces any stateless web-only path for API, migrations, credentials, jobs, uploads, and Google integration. |
| Studio worker | `authoritative`, manual-only runtime | CLI module `python -m studio_api.worker`; health module `python -m studio_api.worker_health`. | Built from `apps/studio-api/Dockerfile`; operational image namespace `elevenlabs-studio-worker:*`. | `studio-worker` in `deploy/studio/compose.platform.yml` with no public port. | PostgreSQL owns jobs, claims, leases, retries, source cleanup, retention, outputs, and reconciliation. | `scripts/deploy_studio_platform_component.sh worker` only by manual dispatch/operator action after existing worker is absent or drained/stopped; lifecycle operations use `scripts/manage_studio_worker.sh`. Exactly one intended production worker is allowed until multi-worker rollout is separately validated. | No legacy worker replacement exists; any unmarked worker command is non-authoritative. |
| PostgreSQL | `authoritative` | `postgres:17` service data directory. | Upstream image in Compose. | `postgres` in `deploy/studio/compose.platform.yml` | Durable Studio state. Repository Alembic head is `0014_source_deletion_retention`. | Migration is explicit operator action only through `scripts/migrate_studio_platform.sh` after backup confirmation; standard CD must not migrate. | Not replaced by Redis, local files, CI fixtures, or browser state. |
| Redis | `operator-only support` | `redis:7-alpine` health/support service. | Upstream image in Compose. | `redis` in `deploy/studio/compose.platform.yml` | None for jobs, retries, leases, cleanup, source retention, or output reconciliation. | Started/verified as stateful support only; not a processing authority. | Must not be documented as durable queue/lease/retry/cleanup authority. |
| `deploy/studio/compose.platform.yml` | `authoritative` | Platform Compose stack with `studio-web`, `studio-api`, `studio-worker`, `postgres`, and `redis`. | Web/API Dockerfiles plus upstream stateful images. | Production/platform Compose file. | PostgreSQL volume `studio-postgres-data`. | Base platform and operator production path. | Replaces `deploy/studio/compose.prod.yml` for current platform production. |
| `deploy/studio/compose.prod.yml` | `compatibility-only` / `legacy-deprecated` | Stateless `studio-web` service only. | `apps/studio/Dockerfile`. | `studio-web` only. | None. | `scripts/deploy_studio.sh` and `docs/runbooks/legacy-studio-web-deploy.md` only. NOT AUTHORITATIVE FOR PRODUCTION platform rollout. | Replacement: `deploy/studio/compose.platform.yml`; remove only after operator confirms no stateless web-only rollback/history dependency remains. |
| `scripts/deploy_studio_platform_component.sh` | `authoritative` / `operator-only` | Component deploy helper for web/API/manual worker. | Builds selected Compose service only. | `studio-web`, `studio-api`, or manual `studio-worker`. | Reads DB revision; does not apply migrations. | Active component deploy authority; workflow materializes the script before execution. | Replaces direct ad hoc Compose up commands for component deploy. |
| `scripts/deploy_studio_platform.sh` | `operator-only` | Bootstrap helper for platform web/API/postgres/redis. | Uses platform Compose. | Starts web/API/postgres/redis, not worker. | Preserves stateful volumes. | Bootstrap/manual platform bring-up only, not standard CD and not migration/worker/canary authority. | Use component deploy helper for normal web/API updates. |
| `scripts/manage_studio_worker.sh` | `authoritative` / `operator-only` | Worker status, drain/pause, resume, rollback helper. | Uses platform Compose worker image tags. | `studio-worker`. | Checks PostgreSQL revision before resume/rollback; does not mutate jobs directly. | Worker lifecycle owner for pause/drain/resume/rollback. | No replacement; remove only with a new worker ops contract. |
| `scripts/migrate_studio_platform.sh` | `authoritative` / `operator-only` | Manual Alembic migration wrapper. | Runs API image Alembic. | `studio-api` one-shot command. | PostgreSQL schema revision. | Explicit operator migration only after tagged backup confirmation. | Not standard CD. |
| `scripts/backup_studio_postgres_r2.sh` | `authoritative` / `operator-only` | Tagged PostgreSQL backup helper. | Host script/restic boundary. | PostgreSQL backup path. | Backup repository outside app runtime. | Required before migration/restore workflows; not standard CD. | Do not remove solely for missing automated call site. |
| `scripts/studio_processing_preflight.sh` and `.github/workflows/studio-processing-preflight.yml` | `operator-only` | Read-only host preflight for intended commit. | N/A. | Remote host read-only checks. | Reads safe state only. | Manual workflow dispatch; no migration, provider call, Google mutation, worker rollout, or canary. | Complements, not replaces, runbook sequence. |
| `.github/workflows/ci.yml` and `.github/workflows/studio-ci.yml` | `authoritative` CI | Repository checks, tests, frontend build, Docker build, and Compose validation. | Test/validation images only. | CI services/runner only. | Ephemeral CI PostgreSQL/Redis only. | CI authority; no production deploy, cleanup, worker rollout, provider calls, Google Docs creation, canary, rollback, or production-live claim. | Not CD authority. |
| `.github/workflows/studio-platform-cd.yml` | `guarded CD / mixed trigger` | Web/API deploy can run on guarded push to `main` only when `STUDIO_PLATFORM_CD_ENABLED == true`, or by manual dispatch; worker deploy is manual dispatch only. | Materializes `scripts/deploy_studio_platform_component.sh` from the exact expected commit. | Selected platform component only. | Verifies DB revision compatibility; does not apply migrations. | Web/API: guarded push CD or manual dispatch; worker: manual dispatch only. No automatic worker deploy on push and no production-live claim. | Not migration/canary/cleanup/rollback authority. |
| `deploy/studio/.env.example` | `authoritative` env template | Runtime variable and secret-file path schema. | N/A. | Consumed by platform Compose/scripts. | Values ending `_FILE` are paths only. | Operators create `deploy/studio/.env` from this schema without committing secrets. | Replaces ad hoc env documentation. |
| `deploy/studio/systemd/*` | `operator-only` | Backup timer/service units. | Host systemd. | Backup automation only. | Backup repository/metadata. | Optional host-managed backup scheduling; not app deploy, migration, worker, cleanup, provider, or canary authority. | Keep until backup runbook is replaced. |
| `deploy/studio/studio.librechat.online.nginx.conf` | `operator-only` | Reverse proxy vhost for web and `/api/*` API routing. | Host nginx. | Host reverse proxy. | None. | Manual host-managed proxy config; not CD/stateful authority. | Replace only through explicit host ops task. |

## Runtime boundaries

- Browser is untrusted for secrets and raw content. It receives only safe normalized owner-scoped metadata.
- API owns authentication, authorization, encryption/decryption, Drive/provider calls, source storage access, and lifecycle checks.
- Worker uses the API codebase/internal services but must be deployed and validated as a distinct runtime component.
- PostgreSQL is the durable authority for Studio persisted state.
- Redis is not the durable job queue authority for current processing semantics.
- Object storage is private server-side source-byte storage.
- External providers and Google APIs are side-effect boundaries requiring pre/post lifecycle checks.

## Studio data flow

1. User authenticates and opens an owner-scoped project.
2. User adds sources from safe local upload or Google Drive metadata/folder selection.
3. User configures owner-scoped BYOK credentials and Google output destination.
4. API persists source/job/relation/output-destination records in PostgreSQL.
5. Worker claims one eligible queued job using fenced lease metadata.
6. Processing re-checks lifecycle, lease, cancellation, source availability, credentials, and output destination.
7. Source materialization provides an ephemeral server-side handle.
8. ElevenLabs provider path produces an ephemeral redacted transcript result.
9. Google Docs output path creates one document reference for the active output target.
10. API persists safe output metadata and completes the job only when every non-skipped relation has output evidence.
11. Frontend reads browser-safe job/output metadata; transcript/document bodies remain server-private and are not returned.

## High-level job state transitions

```text
queued
  -> processing (after atomic claim/lease and lifecycle checks)
  -> completed (only after persisted output evidence for all required relations)
  -> failed (normalized safe failure)
  -> cancelled (safe terminal cancellation where allowed)
```

Lease loss, cancellation uncertainty, provider/Google errors, output-side-effect uncertainty, or post-create persistence failures must fail closed and preserve safe evidence for reconciliation. The system must not automatically duplicate provider calls or Google document creation when side effects are uncertain.

## Trust and safety boundaries

- Credentials and tokens are server-only and encrypted at rest where persisted.
- OAuth/provider URLs, codes, tokens, raw payloads, owners/permissions, source bytes, transcript bodies, document bodies, object keys, private paths, and stack traces are not browser payloads.
- Diagnostics and validation evidence must be allowlisted and redacted.
- Output links shown to the browser must be validated safe Google web-view metadata and owner-scoped.
- Production evidence must not record secret values, document IDs/URLs, transcript bodies, private account data, source bytes, raw provider responses, or raw Google responses.

## Deployment shape

The repository contains Studio deployment and workflow files, but architecture does not authorize deployment behavior. CI/CD and runtime safety rules are in `docs/ci-cd-rules.md`; operator procedures are in `docs/runbooks/studio-platform-ops.md`.

Current important distinction: web/API deployment, migration application, worker-running, and production-live processing are separate states. Standard CD must not silently run migrations, start workers, or claim Studio processing readiness. Current processing invariants are in `docs/studio-processing-contract.md`.

## Worker operational boundary

The `studio-worker` is a distinct manual-only runtime component that uses the Studio API source build context but has its own operational image namespace (`elevenlabs-studio-worker:*`), process command, and Docker healthcheck. Worker health means only worker PID shape, configuration load, and PostgreSQL read-only `SELECT 1`; it is not a job-progress authority, provider/Google readiness check, lease-correctness proof, canary result, or production-live processing claim.

Worker image identity is verified separately from mutable local tags by comparing the intended commit-specific worker image identity with the running container image ID. Pause means a gracefully drained/stopped container, not a frozen process. The worker remains one-job-per-process and PostgreSQL remains the processing authority; Redis is not introduced as a queue, lease, retry, or heartbeat authority. Long source/provider and Google output stages use a bounded stage-scoped heartbeat thread that creates a fresh PostgreSQL session for each exact owner/generation lease renewal and stops before the worker iteration can continue.

## Studio output reconciliation component

Source-level Studio architecture now includes `TranscriptionOutputReconciliation` PostgreSQL rows, an internal Drive appProperty token on Google Docs creates, a reconciliation Drive lookup helper, a dedicated `job_output_reconciliation` service, owner-scoped API endpoints, safe diagnostics, and a minimal PWA action. The component bridges uncertain external Google Docs side effects back to PostgreSQL output evidence without provider calls, Google Docs create/delete, document-body reads, manual document-ID attachment, or title-only matching.

The API remains the trust boundary: browsers see only aggregate reconciliation status and safe counts. Tokens, document IDs, folder IDs, raw URLs before output persistence, appProperties, raw Google payloads, transcript text, document body, and lease metadata remain server-only.

## Studio source lifecycle component map

| Component | Responsibility | Boundary |
|---|---|---|
| Source deletion API | Owner-scoped logical deletion, safe blocker reasons, audit/diagnostics. | Commits durable PostgreSQL state before any local object cleanup attempt; never mutates Google Drive files. |
| Source cleanup service | PostgreSQL-backed cleanup claim, lease/generation fencing, idempotent local object delete, retention-expiry marking. | Holds row locks only for claim/finalization transactions, not during S3/R2 I/O; does not call providers, Google Drive, Google Docs, or output reconciliation. |
| Studio worker idle maintenance | Processes at most one source cleanup candidate only when no processing job is claimed. | No cleanup thread, Redis queue, production rollout, migration execution, or canary is implied by source-level code. |

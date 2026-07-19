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
| Database | PostgreSQL via Studio deployment | Durable users/projects/sources/credentials/jobs/outputs/diagnostics state. | Migrations present through `0011_diagnostic_debug_sessions`; production revision requires operator evidence. |
| Alembic migrations | `apps/studio-api/alembic/versions/` | Schema authority for Studio persistence. | Current repository head is `0011_diagnostic_debug_sessions`. |
| Redis | Studio deployment | Platform support service; not a processing queue/lock/retry authority unless separately designed. | Production health is operator evidence, not source evidence. |
| Object storage | S3/R2-compatible source storage | Private temporary/local-upload source bytes. | Browser must not receive object keys, presigned URLs, or source bytes. |
| Worker | `apps/studio-api/studio_api/worker.py` and related runner/orchestrator modules | Poll/claim/process at most bounded work according to lease and lifecycle rules. | Implemented at source level; official production deployable component and canary still require validation. |
| Provider path | ElevenLabs modules under `apps/studio-api/studio_api/` | Owner-scoped BYOK transcription execution. | ElevenLabs path present; OpenAI Studio parity unfinished. |
| Google integration | Google OAuth/Drive/Docs modules under `apps/studio-api/studio_api/` | OAuth connection, safe Drive metadata/folder selection, Google Docs output creation. | Source present; exactly-once document creation and output reconciliation unfinished. |
| Diagnostics | API/frontend diagnostic modules and migrations `0010`/`0011` | Safe diagnostic event/report/debug-session foundation. | Source present; evidence must remain redacted. |
| Deployment | `deploy/studio/`, `.github/workflows/` | Component deployment and preflight automation boundaries. | Deployment changes are governed by `docs/ci-cd-rules.md`; standard CD must not deploy workers or run migrations. Legacy stateless web deploy is documented in `docs/runbooks/legacy-studio-web-deploy.md`. |

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

The `studio-worker` is a distinct manual-only runtime component that uses the Studio API source image family but has its own process command and Docker healthcheck. Worker health means only worker PID shape, configuration load, and PostgreSQL read-only `SELECT 1`; it is not a job-progress authority, provider/Google readiness check, lease-correctness proof, canary result, or production-live processing claim.

Worker image identity is verified separately from mutable local tags by comparing the intended commit-specific worker image identity with the running container image ID. Pause means a gracefully drained/stopped container, not a frozen process. The worker remains one-job-per-process and PostgreSQL remains the processing authority; Redis is not introduced as a queue, lease, retry, or heartbeat authority.

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
| Studio frontend | `apps/studio/` | Browser UI for sessions, projects, sources, credentials, Google connection, preparation, jobs, outputs, diagnostics; `src/apiClient.ts` owns same-origin JSON/CSRF retry transport and its safe diagnostic emission. | Source present; deployment evidence is separate. |
| Studio API | `apps/studio-api/studio_api/` | FastAPI app, auth/session boundaries, owner-scoped APIs, job/source/credential/output/diagnostic services. | Source present; production API deployment does not imply worker processing. |
| Database | PostgreSQL via Studio deployment | Durable users/preferences/projects/sources/credentials/jobs/outputs/diagnostics state. | Migrations present through `0015_user_source_retention`; production revision requires operator evidence. |
| Alembic migrations | `apps/studio-api/alembic/versions/` | Schema authority for Studio persistence. | Current repository head is `0015_user_source_retention`. |
| Redis | Studio deployment | Platform support service; not a processing queue/lock/retry authority unless separately designed. | Production health is operator evidence, not source evidence. |
| Object storage | S3/R2-compatible source storage | Private temporary/local-upload source bytes. | Object keys/source bytes remain server-only; the upload initiator returns one bounded PUT-only browser capability. Pending uploads and verified-source retention use separate persisted expiry windows. |
| Worker | `apps/studio-api/studio_api/worker.py` and related runner/orchestrator modules | Poll/claim/process at most bounded work according to lease and lifecycle rules. | Implemented at source level; official production deployable component and canary still require validation. |
| Provider path | ElevenLabs modules under `apps/studio-api/studio_api/` | Owner-scoped BYOK transcription execution. | ElevenLabs path present; OpenAI Studio parity unfinished. |
| Google integration | Google OAuth/Drive/Docs modules under `apps/studio-api/studio_api/` | OAuth connection, safe Drive metadata/folder selection, Google Docs output creation. | Source present; exactly-once document creation is not claimed; source-level output reconciliation is present and runtime evidence is separate. |
| Diagnostics | API/frontend diagnostic modules and migrations `0010`/`0011` | Safe diagnostic event/report/debug-session foundation. | Source present; evidence must remain redacted. |
| Deployment | `deploy/studio/`, `.github/workflows/` | Component deployment and preflight automation boundaries. | Deployment changes are governed by `docs/ci-cd-rules.md`; standard CD must not deploy workers or run migrations. |

## Runtime boundaries

- Browser is untrusted for durable secrets and raw server-side content. It normally receives only safe normalized owner-scoped metadata; explicit OAuth-start, Picker, and direct-upload capabilities are bounded exceptions governed by the product contract.
- API owns authentication, authorization, encryption/decryption, Drive/provider calls, source storage access, and lifecycle checks.
- Worker uses the API codebase/internal services but must be deployed and validated as a distinct runtime component.
- PostgreSQL is the durable authority for Studio persisted state.
- Redis is not the durable job queue authority for current processing semantics.
- Object storage is private server-side source-byte storage.
- External providers and Google APIs are side-effect boundaries requiring pre/post lifecycle checks.

### Browser-bound integration capabilities

The Studio frontend keeps the direct-browser Google Picker and local-upload architecture. Google Picker requires a browser OAuth access token; local upload uses a short-lived S3/R2 presigned PUT so source bytes do not transit the API process. OAuth-start authorization URLs, Picker access tokens, and upload URLs are therefore capability responses rather than ordinary metadata.

These responses require authenticated same-origin CSRF-protected issuance, `Cache-Control: no-store`, no service-worker runtime caching, no browser persistence/diagnostic logging, and server-side revalidation of every selected Drive ID or completed object. Picker issuance additionally requires the narrow identity plus `drive.file` scope boundary and exact Picker origin. Upload issuance uses an opaque server-owned object key, exact content type, PUT-only operation, at most 900 seconds, omitted browser credentials/referrer, and refused redirects. Refresh tokens, ID tokens, object keys, source bytes, and provider secrets never cross this boundary.

Before enabling local file selection, the frontend reads an authenticated `no-store` source-upload policy DTO containing only an availability boolean, the deployment-configured maximum byte count, and supported MIME rules. The frontend validates the DTO at runtime and fails closed for direct local uploads when storage is unavailable or the policy is unavailable or malformed. This read-only metadata is not an upload capability and does not replace API initiation, object-storage metadata verification, or processing-time source checks.

The public host nginx is the authoritative browser-header boundary for both the PWA and `/api`; the loopback-only web-container nginx does not maintain a competing policy. CSP limits executable script to Studio plus the Google API loader hosts, limits frames to Google Picker hosts, and blocks external framing, objects, and unsafe evaluation. `connect-src https:` remains intentionally broader than the other directives only because the S3/R2-compatible upload origin is selected at runtime.

## Studio data flow

1. User authenticates and opens an owner-scoped project.
2. User adds sources from safe local upload or Google Drive metadata/folder selection.
3. User configures owner-scoped BYOK credentials and Google output destination.
4. Before job creation, the frontend requests a non-mutating server preflight. The API revalidates the active ElevenLabs credential, ordered sources, and writable output folders, then returns only safe source/display metadata, selected options, destination names, and planned outcomes. The preflight DTO does not echo source/folder identifiers or URLs and never returns storage paths, tokens, or raw external payloads.
5. The user explicitly confirms the unchanged preview. Batch creation remains the canonical authority and repeats current validation before persisting source/job/relation/output-destination records in PostgreSQL; editing the composer invalidates the preview.
6. Worker claims one eligible queued job using fenced lease metadata.
7. Processing re-checks lifecycle, lease, cancellation, source availability, credentials, and output destination.
8. Source materialization provides an ephemeral server-side handle.
9. The worker duration-probes every prepared source; video first becomes temporary AAC/M4A, while any source above the explicit size/duration policy becomes an ordered bounded set of overlapping mono AAC parts before the first provider request.
10. ElevenLabs processes parts in order under the source/provider heartbeat. The worker revalidates lifecycle authority between calls, fails closed after any partial provider result, and merges successful part words onto one deterministic source timeline.
11. Google Docs output path creates one document reference for the active output target.
12. API persists safe output metadata and completes the job only when every non-skipped relation has output evidence.
13. While queued or processing jobs exist, the frontend polls one owner-scoped project progress endpoint. The API projects only browser-safe filenames and a fixed preparation, video-audio extraction, conditional split, provider, conditional merge, and Google Docs pipeline from current durable attempt checkpoints plus persisted-output evidence. The DTO omits source IDs/URLs, storage identity, credentials, failure detail, and lease/claim authority.
14. Frontend reads browser-safe job/output metadata; transcript/document bodies remain server-private and are not returned.

The current preflight reports existing-result authority as unavailable and therefore plans every validated row for processing. It must not claim that no accepted output exists. Durable match/skip/conflict decisions remain part of the separately designed transcript-catalog migration and duplicate-protection workstream.

Progress tracking is deliberately checkpoint-based without a new persistence migration. The existing `prepared` attempt checkpoint covers source materialization plus media preparation, so audio extraction and split evaluation become confirmed when the provider checkpoint is reached rather than exposing fabricated sub-step timing. Split and merge are displayed as conditional checks: completion means the gate was evaluated and applied when required, not that every source was split. More granular live ffmpeg progress would require a separately authorized durable progress model.

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

- Durable credentials, refresh/ID tokens, and provider secrets are server-only and encrypted at rest where persisted.
- OAuth codes, raw payloads, owners/permissions, source bytes, transcript bodies, document bodies, object keys, private paths, and stack traces are not browser payloads. The three bounded capability responses above are the only integration exceptions.
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
| Source expiry authority | Stores the pending-upload deadline at initiation and replaces it after exact object metadata verification using the owner's durable account preference. | PostgreSQL user preference plus `sources.expires_at` are authoritative; the PWA changes the allowlisted preference through the API and displays the exact source deadline. |
| Source cleanup service | PostgreSQL-backed cleanup claim, lease/generation fencing, idempotent local object delete, retention-expiry marking. | Holds row locks only for claim/finalization transactions, not during S3/R2 I/O; does not call providers, Google Drive, Google Docs, or output reconciliation. |
| Studio worker idle maintenance | Processes at most one source cleanup candidate only when no processing job is claimed. | No cleanup thread, Redis queue, production rollout, migration execution, or canary is implied by source-level code. |

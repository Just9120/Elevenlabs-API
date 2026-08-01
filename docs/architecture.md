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

Studio PWA is a web platform contour in development. Source-level architecture includes the web frontend, API, PostgreSQL, Redis, object storage, worker entrypoint, provider adapter path, Google Drive/Docs integration, diagnostics, independent transcript-maintenance operations with recursive-folder and single-document targets, and migrations. The bounded single-worker/small-source processing path has controlled production evidence, while broader selected capabilities and every newer schema/API revision still require their own rollout evidence.

## Components

| Component | Source location | Responsibility | Production status note |
| --- | --- | --- | --- |
| Studio frontend | `apps/studio/` | Browser UI for sessions, projects, sources, credentials, primary Google/Picker connection, separate maintenance consent, preparation, jobs, outputs, diagnostics, standardization, and `Манифест Studio`; `src/apiClient.ts` owns same-origin JSON/CSRF retry transport and its safe diagnostic emission. | Current merge/CI/deployment evidence belongs in `docs/delivery-plan.md`; source presence is not live Google evidence. |
| Studio API | `apps/studio-api/studio_api/` | FastAPI app, auth/session boundaries, owner-scoped APIs, job/source/credential/output/diagnostic/catalog services, separate maintenance OAuth/token refresh, exact-document revalidation, and bounded recursive folder traversal. | Current merge/CI/deployment evidence belongs in `docs/delivery-plan.md`; newer schema/config requires a separately verified API rollout. |
| Database | PostgreSQL via Studio deployment | Durable users/preferences/projects/sources/credentials/jobs/outputs/diagnostics/catalog state plus separately encrypted maintenance grant fields. | Repository migrations are present through `0017_google_maintenance_oauth`; production revision evidence is tracked separately in `docs/delivery-plan.md`. |
| Alembic migrations | `apps/studio-api/alembic/versions/` | Schema authority for Studio persistence. | Current repository head is `0017_google_maintenance_oauth`; ordinary component CD does not apply it. A separately enabled, protected release lane may apply exactly one reviewed direct additive successor. |
| Redis | Studio deployment | Platform support service; not a processing queue/lock/retry authority unless separately designed. | Production health is operator evidence, not source evidence. |
| Object storage | S3/R2-compatible source storage | Private temporary/local-upload source bytes. | Object keys/source bytes remain server-only; the upload initiator returns one bounded PUT-only browser capability. Pending uploads and verified-source retention use separate persisted expiry windows. |
| Worker | `apps/studio-api/studio_api/worker.py` and related runner/orchestrator modules | Poll/claim/process at most bounded work according to lease and lifecycle rules. | Worker deployment is manual-only. Current running/stopped identity and canary evidence belong in `docs/delivery-plan.md`; multi-worker behavior remains unproven. |
| Provider path | ElevenLabs modules under `apps/studio-api/studio_api/` | Owner-scoped BYOK transcription execution. | One bounded ElevenLabs canary completed; dedicated option/video/long-media/multi-file canaries remain. OpenAI Studio processing is deferred. |
| Google integration | Google OAuth/Drive/Docs modules under `apps/studio-api/studio_api/` | Narrow primary `drive.file` Picker capability, separately encrypted server-only maintenance grant, safe exact-document validation or Drive traversal, Google Docs reads/writes, and output creation. | Primary Picker/output evidence does not prove the separate maintenance grant or either maintenance target mode. |
| Transcript maintenance | `transcript_catalog*.py`, `transcript_maintenance*.py`, migrations `0016`/`0017`, and frontend maintenance panel/model modules | Two owner-scoped operations with independent `folder_tree` or `single_document` targets: in-place standardization or PostgreSQL-only `Манифест Studio` import, with fresh server revalidation and explicit conflict outcomes. | Source and targeted-test state is tracked in `docs/delivery-plan.md`; migration/config/deployment/live dry-run/apply evidence remains separate. |
| Diagnostics | API/frontend diagnostic modules and migrations `0010`/`0011` | Safe diagnostic event/report/debug-session foundation. | Source present; evidence must remain redacted. |
| Deployment | `deploy/studio/`, `.github/workflows/` | Ordinary component deployment plus a distinct approval-gated stateful release boundary. | Ordinary CD must not deploy workers or run migrations. The migration lane is disabled by default and requires a protected environment, a dedicated root forced command, exact-main identity, a new verified backup, one additive migration, exact API image deployment, and health evidence. |

## Runtime boundaries

- Browser is untrusted for durable secrets and raw server-side content. It normally receives only safe normalized owner-scoped metadata; explicit OAuth-start, Picker, and direct-upload capabilities are bounded exceptions governed by the product contract.
- API owns authentication, authorization, encryption/decryption, Drive/provider calls, separate maintenance token refresh/traversal, source storage access, and lifecycle checks.
- Worker uses the API codebase/internal services but must be deployed and validated as a distinct runtime component.
- API/worker Compose services use a bounded root bootstrap only to copy allowlisted
  host-owned file-backed secrets into root-owned tmpfs runtime storage as `0400` files
  for UID/GID `10001`; the entrypoint then clears supplementary groups, drops to
  `10001`, and execs every ordinary API, worker, health, or Alembic command.
- PostgreSQL is the durable authority for Studio persisted state.
- Redis is not the durable job queue authority for current processing semantics.
- Object storage is private server-side source-byte storage.
- External providers and Google APIs are side-effect boundaries requiring pre/post lifecycle checks.

### Browser-bound integration capabilities

The Studio frontend keeps the direct-browser Google Picker and local-upload architecture. Google Picker requires an access token from the narrow primary `drive.file` connection; local upload uses a short-lived S3/R2 presigned PUT so source bytes do not transit the API process. OAuth-start authorization URLs, primary Picker access tokens, and upload URLs are therefore capability responses rather than ordinary metadata.

These responses require authenticated same-origin CSRF-protected issuance, `Cache-Control: no-store`, no service-worker runtime caching, no browser persistence/diagnostic logging, and server-side revalidation of every selected Drive ID or completed object. Picker issuance additionally requires the narrow identity plus `drive.file` scope boundary and exact Picker origin. Upload issuance uses an opaque server-owned object key, exact content type, PUT-only operation, at most 900 seconds, omitted browser credentials/referrer, and refused redirects. Refresh tokens, ID tokens, object keys, source bytes, provider secrets, and maintenance access/refresh tokens never cross this boundary.

Transcript maintenance starts through a second OAuth consent but remains a server-only integration after the authorization redirect. The API stores its encrypted refresh token in separate columns, requires the same Google subject as the primary connection, and accepts only identity plus `drive.metadata.readonly` and `documents`. The browser receives only safe maintenance connection state and operation results. For each operation it independently selects either one root folder or one native Google Doc through the primary Picker and sends `selection_mode` plus exactly one matching `folder_id` or `document_id`; it never supplies a document list or a saved candidate set.

Before enabling local file selection, the frontend reads an authenticated `no-store` source-upload policy DTO containing only an availability boolean, the deployment-configured maximum byte count, and supported MIME rules. The frontend validates the DTO at runtime and fails closed for direct local uploads when storage is unavailable or the policy is unavailable or malformed. This read-only metadata is not an upload capability and does not replace API initiation, object-storage metadata verification, or processing-time source checks.

The public host nginx is the authoritative browser-header boundary for both the PWA and `/api`; the loopback-only web-container nginx does not maintain a competing policy. CSP limits executable script to Studio plus the Google API loader hosts, limits frames to Google Picker hosts, and blocks external framing, objects, and unsafe evaluation. `connect-src https:` remains intentionally broader than the other directives only because the S3/R2-compatible upload origin is selected at runtime.

## Studio data flow

1. User authenticates and opens an owner-scoped project.
2. User adds sources from safe local upload or Google Drive metadata/folder selection.
3. User configures owner-scoped BYOK credentials and Google output destination.
4. Before job creation, the frontend requests a non-mutating server preflight. The API revalidates the active ElevenLabs credential, ordered sources, and writable output folders, evaluates owner-scoped accepted Studio output evidence, then returns only safe source/display metadata, selected options, destination names, match categories, counts, and planned outcomes. The preflight DTO does not echo source/folder identifiers or URLs and never returns storage paths, tokens, document references, or raw external payloads.
5. A row with an accepted exact match, matching-settings legacy standard, or indeterminate accepted evidence is blocked until the user explicitly chooses paid reprocessing. Editing the source or effective transcription settings clears that choice and invalidates the preview. Batch creation remains the canonical authority: after external target validation it deterministically locks all owner source rows that share the selected catalog identities, reloads source lifecycle state, repeats the accepted-output query, and refuses unresolved conflicts before persisting new jobs. The affirmative decision is persisted on that single job as a reserved server-owned option, is not returned to the browser, and cannot be supplied through the deprecated arbitrary-options endpoint. An unchanged idempotent replay remains a replay rather than a new decision.
6. Worker claims one eligible queued job using fenced lease metadata.
7. Processing re-checks lifecycle, lease, cancellation, source availability, credentials, and output destination.
8. Source materialization provides an ephemeral server-side handle.
9. The worker duration-probes every prepared source; video first becomes temporary AAC/M4A, while any source above the explicit size/duration policy becomes an ordered bounded set of overlapping mono AAC parts before the first provider request.
10. Immediately before the first paid provider call, a job locks its catalog source identity, rechecks accepted output evidence, and checks whether another equivalent job has durably crossed `provider_request_started`. The lock is held until the current job's own provider-start checkpoint commits, so only the first equivalent worker can cross the boundary. Processing attempts and terminal attempts without a retry-safe outcome remain conflicts; accepted outputs are evaluated separately, and a completed attempt missing its required output evidence fails closed as an inconsistency. A durable explicit-reprocess decision bypasses only an accepted-output conflict, never an in-flight or unresolved provider attempt. A losing job is classified non-retryable before any provider call. ElevenLabs then processes parts in order under the source/provider heartbeat. The worker revalidates lifecycle authority between calls, fails closed after any partial provider result, and merges successful part words onto one deterministic source timeline.
11. Google Docs output path creates one document reference for the active output target.
12. API persists safe output metadata and completes the job only when every non-skipped relation has output evidence.
13. While queued or processing jobs exist, the frontend polls one owner-scoped project progress endpoint. The API projects only browser-safe filenames and a fixed preparation, video-audio extraction, conditional split, provider, conditional merge, and Google Docs pipeline from current durable attempt checkpoints plus persisted-output evidence. The DTO omits source IDs/URLs, storage identity, credentials, failure detail, and lease/claim authority.
14. Frontend reads browser-safe job/output metadata; transcript/document bodies remain server-private and are not returned.

The current catalog authority defines one canonical settings tuple (`elevenlabs`, `scribe_v2`, `ru|detect`, diarization boolean), reuses `transcript_doc_v1.2` and the accepted Google Docs output kind as shared constants, and classifies persisted Studio output evidence plus explicitly source-linked imported catalog metadata as an accepted exact match, standardization-required, indeterminate, or no match. Classification is owner-scoped across projects: a Google source uses its private Drive file ID so reselecting the same file can retain identity, while a local upload uses its existing Studio source row because no content fingerprint is currently persisted. Duplicate Google document IDs are counted once when the same accepted document exists in both Studio output evidence and the imported catalog. These identities and output records remain server-only.

Transcript maintenance is not part of job creation. Standardization and `Манифест Studio` each own a separate target mode, selected target, preview, confirmation, and result. For dry-run and again for apply, the API revalidates the exact selected native Google Doc or traverses the selected root and descendants under explicit page/item/folder bounds. Recursive traversal rejects cycles, malformed listings, duplicate identities, repeated page tokens, incomplete search, or exceeded limits. Standardization skips current documents and may rewrite only eligible non-current documents in place. `Манифест Studio` skips already-target entries and may persist only eligible current-document metadata. Per-document unsafe/inaccessible outcomes do not abort safe siblings in folder mode; connection-wide auth, rate-limit, availability, timeout, or global scan failures abort.

Manifest membership authority is the owner-scoped reconciliation of two durable
PostgreSQL evidence sources: historical `TranscriptionJobOutput` rows and
`TranscriptCatalogEntry` rows written by manifest apply. A catalog row alone is
sufficient to classify that document as already imported on every later
dry-run, including a new database session. Historical output evidence may add
exact effective settings; incompatible exact settings, malformed authority, or
ambiguous evidence fails closed as a conflict. This maintenance-membership
lookup is distinct from the source-linked accepted-output matching used by paid
transcription preflight.

Preflight exposes this authority as `partial` with reason `unlinked_catalog_entries_excluded`. It can block accidental repeated paid transcription against current accepted Studio output evidence and exact source-linked catalog evidence, and create repeats the decision under PostgreSQL source locks so a concurrent output-persistence transaction cannot pass unnoticed. The worker repeats the accepted-evidence comparison at the final provider boundary and treats an equivalent in-flight or unresolved provider attempt with a durable provider-start checkpoint as a conflict; only an attempt explicitly classified retry-safe is exempt. The same identity lock serializes that comparison with the current attempt's own provider-start commit, covering two jobs that were both queued before either had an accepted output and preventing a new job from bypassing an uncertain failed attempt. A losing job cannot be retried from its stale decision; the user must run a fresh preflight after the winning job's outcome is known. The deprecated multi-source create route uses the same catalog comparison but can only create when no accepted evidence exists; callers must use batch preflight/create for an explicit paid reprocess decision. The browser receives only the category, accepted-output count, and required/reprocess resolution. The explicit reprocess flag participates in the canonical request and idempotency hash; there is no implicit overwrite, provider retry, skip, or reuse.

The authority remains partial by design: the separately initiated maintenance operations can standardize and import approved legacy evidence, but a document without explicit source identity cannot participate in duplicate matching and indeterminate settings require an explicit reprocess decision. The authority does not infer linkage from a document name, detect a separately uploaded copy of the same local file, treat queued/processing jobs as accepted outputs, or turn a bounded maintenance operation into continuous Drive synchronization. Reuse/skip needs an explicit accepted-output linkage design and is not inferred from a match.

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

Current important distinction: web/API deployment, migration application,
maintenance OAuth runtime configuration, worker-running, bounded core processing
evidence, and transcript-maintenance rollout are separate states. Ordinary
component CD must not silently run migrations, start workers, populate secrets,
or claim maintenance/processing readiness. The protected migration lane is a
separate stateful release path: an environment-bound job can expose the
exact-SHA forced-command release only after the externally configured
protection rules allow it to proceed, while the VPS runner owns candidate-image
identity, new tagged backup and isolated dump verification, exactly one
additive migration, API-only recreation, and health checks. Workflow binding or
success alone does not prove a reviewer pause; the separate no-op environment
probe validates that external control without checkout, secrets, or VPS access.
The release lane never owns worker, provider, Google, nginx, restore, downgrade,
retry, or rollback actions. Current factual revisions, run IDs, component
outcomes, and blockers belong in
`docs/delivery-plan.md`; current processing invariants are in
`docs/studio-processing-contract.md`.

## Worker operational boundary

The `studio-worker` is a distinct manual-only runtime component that uses the Studio API source build context but has its own operational image namespace (`elevenlabs-studio-worker:*`), process command, and Docker healthcheck. Worker health means only worker PID shape, configuration load, and PostgreSQL read-only `SELECT 1`; it is not a job-progress authority, provider/Google readiness check, lease-correctness proof, canary result, or production-live processing claim.

Worker image identity is verified separately from mutable local tags by comparing the intended commit-specific worker image identity with the running container image ID. Pause means a gracefully drained/stopped container, not a frozen process. The worker remains one-job-per-process and PostgreSQL remains the processing authority; Redis is not introduced as a queue, lease, retry, or heartbeat authority. Long source/provider and Google output stages use a bounded stage-scoped heartbeat thread that creates a fresh PostgreSQL session for each exact owner/generation lease renewal and stops before the worker iteration can continue.

## Studio output reconciliation component

Source-level Studio architecture now includes `TranscriptionOutputReconciliation` PostgreSQL rows, an internal Drive appProperty token on Google Docs creates, a reconciliation Drive lookup helper, a dedicated `job_output_reconciliation` service, owner-scoped API endpoints, safe diagnostics, and a minimal PWA action. The component bridges uncertain external Google Docs side effects back to PostgreSQL output evidence without provider calls, Google Docs create/delete, document-body reads, manual document-ID attachment, or title-only matching.

The API remains the trust boundary: browsers see only aggregate reconciliation status and safe counts. Tokens, document IDs, folder IDs, raw URLs before output persistence, appProperties, raw Google payloads, transcript text, document body, and lease metadata remain server-only.

## Studio transcription analytics component

The project-scoped transcription analytics read path aggregates existing PostgreSQL job, job-source, output, credential-provider, and source-attempt authority without adding a separate analytics table or browser-visible raw events. The API reports all-time safe totals, outcome/configuration counts, and duration summaries with sample coverage. Queue and whole-job processing use complete job lifecycle intervals; provider and combined post-provider-output timing use complete source-attempt intervals. Missing, unfinished, or negative intervals are excluded rather than estimated.

The PWA requests analytics only when the user opens the project analytics panel and validates an exact aggregate DTO before rendering it. Project/job/source/output identifiers, filenames, titles, credentials, storage metadata, Google identifiers/URLs, raw timestamps, failure detail, provider payloads, and transcript/document content remain server-only. The combined post-provider interval may include part merging and Google Docs persistence and must not be presented as a Google-only measurement.

## Studio source lifecycle component map

| Component | Responsibility | Boundary |
|---|---|---|
| Source deletion API | Owner-scoped logical deletion, safe blocker reasons, audit/diagnostics. | Commits durable PostgreSQL state before any local object cleanup attempt; never mutates Google Drive files. |
| Source expiry authority | Stores the pending-upload deadline at initiation and replaces it after exact object metadata verification using the owner's durable account preference. | PostgreSQL user preference plus `sources.expires_at` are authoritative; the PWA changes the allowlisted preference through the API and displays the exact source deadline. |
| Source cleanup service | PostgreSQL-backed cleanup claim, lease/generation fencing, idempotent local object delete, retention-expiry marking. | Holds row locks only for claim/finalization transactions, not during S3/R2 I/O; does not call providers, Google Drive, Google Docs, or output reconciliation. |
| Studio worker idle maintenance | Processes at most one source cleanup candidate only when no processing job is claimed. | No cleanup thread, Redis queue, production rollout, migration execution, or canary is implied by source-level code. |

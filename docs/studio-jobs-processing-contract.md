# Studio job processing execution contract

## Purpose

`PWA-JOBS-02-PREP` is a docs/design-only preparation item for a future Studio job processing implementation slice. It reconciles the current record-only job state and defines safe boundaries before any worker, queue consumer, provider request, Google Docs output, output persistence, or manifest mutation is implemented.

This document is not an implementation guide and does not authorize runtime changes, migrations, CI/CD changes, deployment, production rollout, or secret handling changes.

## Current state

Studio jobs are persisted records only. The current backend can create, list, read, and cancel job records for existing project sources, and the platform UI can show record-only lifecycle/status/readiness information. Jobs may reference safe BYOK credential metadata by identity, but raw provider credentials are never returned to the browser.

PR #103 merged `PWA-JOBS-01D`, improving the user-facing record-only readiness/status copy. That work did not add processing.

Production migration rollout for already-existing Studio job persistence remains manual/operator-scoped and must not be claimed by docs-only or future coding-only work unless separately validated by the operator.


## Future claim and lease semantics

`PWA-JOBS-02C` defines the contract for future server-side ownership of queued Studio transcription jobs. This section is design-only: it does not add a worker, queue consumer, status value, endpoint, database column, migration, runtime service, or production rollout. Current Studio jobs remain record-only. `PWA-JOBS-02D` may add an internal non-mutating claim-readiness planning helper over the existing read-only preflight snapshot; that helper is not a claim, lease, worker, queue, provider execution, output, schema, or runtime implementation.

### Claim

A future **claim** is the server-side exclusive intent to process one eligible queued job. Claiming is not a browser action and must not be inferred from the existing create/list/detail/cancel APIs or the read-only processing preflight snapshot. A valid claim should be established only by an authorized execution component after it re-checks the job, project, owner, source, credential-reference, and output-folder boundaries inside a transactional server-side boundary.

Expected future claim behavior:

- only one execution owner can claim a job at a time;
- claims must be owner/project scoped and must never cross users or projects;
- claim attempts should be idempotent for the same authorized owner when the job is already owned by that owner;
- competing claim attempts must fail closed or observe an already-owned state without processing;
- a claim must not decrypt credentials, download source bytes, call providers, create Google Docs, persist outputs, or mutate manifests by itself.

### Lease

A future **lease** is bounded processing ownership for a claimed job. A lease makes ownership recoverable by attaching an expiration boundary to the claim so a crashed or stalled worker does not permanently strand a queued or processing job. Lease acquisition, renewal, release, and expiry handling require an explicit future schema/runtime slice.

Expected future lease behavior:

- leases should record safe worker identity and lease expiration metadata;
- active processing may proceed only while the worker still owns a valid lease;
- lease renewal must be idempotent for the current owner and must not revive terminal jobs;
- lease expiry should make recovery possible without exposing secrets or private source details;
- release should be safe to retry and should not imply successful output creation unless the terminal completion transition has happened.

### Future transition categories

The current schema exposes queued, cancelled, failed, and completed records only. A real implementation may need additional status or transition semantics, but those are deferred. At a high level, future processing should distinguish these categories before any provider call is made:

- queued and unowned: persisted record exists but no valid server-side owner is processing it;
- claimed/leased for processing: one authorized server-side owner has bounded ownership;
- cancellation requested before work starts: queued jobs can terminate without provider/source/output work;
- cancellation requested during leased work: the worker must stop at safe boundaries and avoid new provider/output side effects where possible;
- recoverable failure or expired lease: ownership can be retried according to future attempt policy;
- terminal success/failure/cancellation: no future claim or lease should start processing unless a separately designed retry/reset transition exists.

### Owner, user, and project boundaries

Future claim/lease logic must authorize against the job owner through the job's project and sources, not just the job id. Every source must still belong to the same project and owner at claim time. Provider credential identity, if present, must belong to the same user and must be active/usable at the moment a future worker needs it. Output folder metadata is a readiness signal today and should become an explicit server-side output authorization boundary only in a future output slice.

A claim/lease contract must not allow one user's worker context, credential, Google connection, source, or output folder to be reused for another user's job.

### Idempotency, cancellation, retry, and recovery

Future claim, lease renewal, lease release, cancellation, retry, and terminal transitions should be idempotent where practical. Repeated requests by the same authorized execution owner should not duplicate provider calls, output documents, output records, audit events, or manifest mutations. Repeated or late requests by a stale owner should fail closed after lease loss or terminal transition.

Cancellation before processing should continue to be a safe terminal transition. Cancellation during future processing needs explicit checkpoints: before source-byte access, before provider submission, before Google Docs output creation, before output persistence, and before final terminal status. If external side effects have already occurred, future code should record only safe normalized metadata and avoid exposing provider payloads, transcript bodies, raw Google responses, tokens, or source bytes.

Retry/recovery behavior is blocked until the repository has explicit attempt counters or audit events, lease expiration metadata, and concurrency protection. A future retry policy should define which failures are retryable, the maximum attempts, backoff behavior, stale-owner handling, and whether terminal failed jobs can be reset.

### Safe metadata boundary

Claim/lease metadata may include only safe operational fields such as opaque worker identity, timestamps, attempt counts, high-level failure categories, and non-secret transition reasons. It must not include raw provider credentials, encrypted credential material, Google refresh or access tokens, OAuth responses, source bytes, private object keys, presigned URLs, transcript bodies, Google Docs body content, raw provider payloads, environment values, file-mounted secret paths, or secret file contents.

### Implementation blockers and follow-ups

A real claim/lease implementation is blocked on a separate future schema/runtime slice. Likely follow-ups include:

- new status or transition semantics, if needed, to distinguish queued, claimed/leased, processing, cancelling, retryable failure, and terminal states;
- lease owner or worker identity storage;
- lease expiration timestamp and renewal/release semantics;
- attempt/retry counters or safe audit events;
- transactional row locking, compare-and-swap updates, advisory locks, or equivalent concurrency protection;
- worker runtime configuration and operational ownership;
- explicit source-byte access, provider execution, Google Docs output, output persistence, and recovery contracts.

These blockers must be implemented in later focused PRs before production Studio job processing is claimed.

## Future lifecycle/state transition contract

A future execution slice should document and then implement explicit, owner-scoped state transitions before performing work. At a high level, the processing lifecycle should distinguish:

- record creation while processing has not started;
- transition into claimed/processing work by an authorized server-side execution component;
- cancellation requests before or during processing;
- terminal success with safe output references only after output work exists;
- terminal failure with safe diagnostic metadata only.

State transitions must be idempotent where practical and must not require the browser to hold provider credentials, Google tokens, transcript bodies, raw provider payloads, or private source bytes.

## Credential boundary

The browser must never receive raw provider credentials, encrypted credential material, Google refresh tokens, access tokens, client secrets, secret file paths, environment values, or file-mounted secret contents.

A future worker may decrypt a user-owned provider credential only inside the server-side execution boundary and only immediately before making the provider request that requires it. Decrypted credential material must not be persisted in job payloads, logs, analytics, output records, browser storage, or failure metadata.

Job records may reference a credential identity and safe credential metadata, but the reference is not proof that provider execution has occurred.

## Source access boundary

Future processing may operate only on existing owner-scoped source records that already belong to the job's project. Source records can represent safe Google Drive metadata or temporary local-upload storage metadata created by prior source workflows.

A future worker must re-check ownership, source existence, source type, processing eligibility, and expiry/availability before attempting access. The browser readiness checklist remains explanatory and must not be treated as authorization to process.

This preparation item does not add Drive picker, recursive Drive browsing, Drive search, local file proxying through FastAPI, source byte storage in PostgreSQL, or new source-ingestion behavior.

## Output boundary

Google Docs output creation, output persistence, and manifest mutation remain future separate slices. A future processing contract should keep these boundaries explicit:

- provider transcription execution can be designed separately from Google Docs creation;
- Google Docs output creation must require an explicit, valid output folder boundary;
- output persistence should store only safe references and metadata, not transcript body by default;
- manifest mutation is not part of Studio's current processing path and must be separately designed if ever needed.

Until those slices exist, Studio jobs remain record-only and must not imply production processing or generated transcript output.

## Failure and safe metadata boundary

Future failure/status metadata may record safe operational facts such as high-level error category, retry eligibility, timestamps, and non-secret provider/source/output boundary names. It must not include raw provider payloads, transcript body, Google Docs body content, source media bytes, tokens, secrets, raw OAuth responses, credential material, environment values, or file-mounted secret contents.

Provider-specific diagnostics should be normalized before persistence or display. User-facing copy should avoid implying that queued records have been processed unless a future execution component has actually completed the work.

## Rollout blocker and non-goals

Production migration rollout and production processing remain manual/operator-scoped or future explicitly approved work. This contract does not claim that migration `0005_transcription_jobs` has been applied in production, and it does not validate the VPS runtime.

Non-goals for `PWA-JOBS-02-PREP`:

- no worker implementation;
- no queue consumer;
- no provider API calls;
- no credential decryption or credential use at runtime;
- no Google Docs output creation;
- no output persistence;
- no manifest mutation;
- no backend schema changes or Alembic migrations;
- no CI/CD changes;
- no Docker/Compose/runtime changes;
- no production deployment;
- no automatic migration rollout;
- no secrets, tokens, environment values, or file-mounted secret contents.

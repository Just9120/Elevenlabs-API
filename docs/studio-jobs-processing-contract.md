# Studio job processing execution contract

## Purpose

`PWA-JOBS-02-PREP` is a docs/design-only preparation item for a future Studio job processing implementation slice. It reconciles the current record-only job state and defines safe boundaries before any worker, queue consumer, provider request, Google Docs output, output persistence, or manifest mutation is implemented.

This document is not an implementation guide and does not authorize runtime changes, migrations, CI/CD changes, deployment, production rollout, or secret handling changes.

## Current state

Studio jobs are persisted records only. The current backend can create, list, read, and cancel job records for existing project sources, and the platform UI can show record-only lifecycle/status/readiness information. Jobs may reference safe BYOK credential metadata by identity, but raw provider credentials are never returned to the browser.

PR #103 merged `PWA-JOBS-01D`, improving the user-facing record-only readiness/status copy. That work did not add processing.

Production migration rollout for already-existing Studio job persistence remains manual/operator-scoped and must not be claimed by docs-only or future coding-only work unless separately validated by the operator.

## PWA-JOBS-03A source-only lease foundation

`PWA-JOBS-03A` introduces internal PostgreSQL persistence and transactional primitives for claiming, renewing, and releasing bounded ownership of one eligible queued Studio job. This is coordination state only: a lease represents exclusive intent for a future execution component, not provider processing. A claimed job remains `queued`, and `started_at` remains reserved for a later real processing transition.

Lease owner identity, lease generation, claim timestamp, and lease expiration are internal server-side metadata and must not be exposed in browser/API payloads, user-facing errors, audit metadata, frontend state, logs, generated artifacts, or examples. Cancellation of a queued job invalidates active lease ownership and expiration in the same record-only transition while preserving generation history for fencing.

This slice still does not add a worker, queue consumer, scheduler, provider call, credential decryption/use, source-byte access, Google Drive download/export processing, Google Docs output, output persistence, manifest mutation, production migration rollout, VPS access, or secrets changes. Worker/provider execution remains a later separately scoped slice.


## PWA-JOBS-03B processing lifecycle foundation

`PWA-JOBS-03B` implements the internal state-machine layer after a valid lease has been acquired. A queued lease remains exclusive execution intent only. `begin_job_processing` is the first real processing state transition: it moves a valid leased queued job to `processing`, increments `attempt_count`, sets `started_at` only once, and still performs no provider work, credential use, source-byte access, Google API call, output persistence, completed transition, or manifest mutation.

Cancellation is now request/acknowledgement based while a job is `processing`. A queued job still transitions immediately to terminal `cancelled` and invalidates active lease ownership. A processing job records `cancel_requested_at`, remains `processing`, keeps its active lease, and is terminally cancelled only when the current fenced owner acknowledges cancellation or when explicit expired-lease recovery observes the pending request. Repeated processing cancellation requests are idempotent and preserve the first request timestamp.

Processing lease renewal is allowed for both `queued` and `processing` jobs when owner, generation, and unexpired lease match. Raw lease release is intentionally blocked for `processing` jobs so processing state cannot be orphaned; processing lease termination must happen through cancellation acknowledgement, safe failure, explicit expired-lease recovery, or a later separately scoped completion/output transition.

Expired processing lease recovery is an explicit internal primitive, not a scheduler or polling loop. If a processing job has no active unexpired lease and no cancellation request, recovery returns it to `queued` while preserving first `started_at` and `attempt_count`; a future claim may increment lease generation. If a cancellation request exists, recovery transitions the job to terminal `cancelled`. Completion remains deferred until Google Docs output and safe output persistence exist.


## PWA-JOBS-03C processing-time source availability verification foundation

`PWA-JOBS-03C` adds an internal, server-side, read-only availability boundary for jobs that are already in `processing` under an exact active lease owner and lease generation. It verifies the current ordered job sources immediately before a future source-materialization/provider boundary, but the verification result is only an ephemeral snapshot and is not permanent authorization to download bytes or call a provider.

For `local_upload` sources, verification uses private temporary source-storage metadata and S3/R2 `HEAD` only. It checks configured bucket identity, source expiry, object existence, current object MIME type, current content length, and conflicts between persisted and actual object metadata. It does not download objects, create local temp files, return bucket/key values, or generate presigned URLs.

For `google_drive` sources, verification resolves one ephemeral user-owned Google access token inside the server boundary and reuses it for all Drive sources in the verification call. It fetches current Drive file metadata, requires matching identity, rejects folders, validates supported audio/video/application-ogg MIME, and enforces the configured size limit when Drive reports a size. It does not expose Drive file IDs in the safe summary, return bearer/refresh tokens, include raw Google payloads, or use `alt=media`.

Because external metadata checks can take time, the helper reloads lifecycle and source state after external I/O before returning a ready result. Status must still be `processing`, lease owner/generation must still match, the lease must still be active, cancellation must still be absent, and sources must not have been deleted, expired, moved, replaced, or changed away from uploaded state. Future byte materialization/provider code must still re-check its own immediate side-effect boundary.


## PWA-JOBS-03D internal single-source byte materialization boundary

`PWA-JOBS-03D` adds an internal-only context-managed boundary for one ordered source relation on an already leased `processing` job. The helper re-runs the processing-time availability boundary immediately before byte access; an older browser payload or previous availability summary is never authorization to materialize bytes.

Before opening S3/R2 or Drive content, the boundary requires the job to exist, remain `processing`, retain the exact lease owner and generation, have an active unexpired lease, have no cancellation request, and belong to an existing owner-consistent non-archived project. The selected relation must belong to the job, remain processable, point at a source in the same project, have uploaded status, be neither deleted nor expired, and have supported MIME and bounded persisted size.

The selected relation/source identity is snapshotted immediately before external I/O and reloaded after byte copy. Lease loss, expiration, cancellation, job/project/source/relation identity mutation, deletion/expiry, MIME mutation, or size mutation fails closed before a handle is yielded. External S3/R2 `get_object` and Drive `alt=media` I/O happen outside any row-locking claim path.

Bytes are copied into bounded `SpooledTemporaryFile` storage and the configured maximum is enforced while streaming. The temporary stream is rewound before yield and is closed/deleted on success, failure, cancellation, or caller exceptions. Safe materialization errors expose only normalized reason values and never expose tokens, Drive ids, bucket/object keys, URLs, response bodies, filenames, source bytes, or temporary paths.

This slice is source-byte materialization only. It does not add a worker, queue consumer, provider request, provider credential use, Google Docs output, output persistence, completed transition, manifest mutation, public endpoint, production runtime, deployment, or production processing claim.


## PWA-JOBS-04A internal execution-prerequisites boundary

`PWA-JOBS-04A` adds an internal server-only prerequisites boundary for one already leased `processing` job. It composes two checks needed before a later provider execution slice: owner-scoped provider credential access and project-scoped output destination authorization. The yielded handle is ephemeral and internal; it is not returned by FastAPI, not persisted, and not an authorization to call a provider or create output.

The credential boundary reloads the job, project, credential, and active credential version; requires `processing` status, exact active lease owner/generation, no cancellation request, an existing non-archived owner-consistent project, an active non-deleted `elevenlabs` or `openai` credential owned by the job owner, and a usable active version with ciphertext, nonce, and the supported key id. Decryption uses the same AAD tuple as credential creation: user id, credential id, credential-version id, and provider value. The raw credential secret is held only inside the context-managed handle and is redacted from representation and normalized errors.

The output destination boundary derives the Drive folder id only from the current job project. It resolves one ephemeral Google access token through the Google connection boundary, fetches only folder authorization metadata, and requires that the returned identity matches the configured folder id, the MIME type is the Google Drive folder MIME type, the folder is not trashed, and `capabilities.canAddChildren` is positively true. Folder ids, tokens, URLs, raw Google payloads, permissions, owners, and authorization headers are not exposed by safe errors or default representations.

Both boundaries revalidate with a fresh clock after decryption or Google metadata I/O. Status, lease owner/generation, active lease, cancellation state, project owner/archive state, credential identity/version/provider state, and output folder identity must still match the pre-I/O snapshot or the helper fails closed with a normalized reason. External key loading, decryption, token refresh, and Drive metadata requests are outside any row-locking claim path. Caller exceptions raised inside the context manager propagate unchanged while cleanup drops context-local secret references.

This slice still does not call ElevenLabs or OpenAI transcription APIs, materialize source bytes, create Google Docs, persist transcript/output text, complete jobs, mutate manifests, add a worker or queue consumer, or expose a public endpoint.

## PWA-JOBS-04B internal ElevenLabs single-source transcription boundary

`PWA-JOBS-04B` adds an internal server-only boundary for exactly one already-materialized source of one already leased `processing` Studio job. It composes the existing execution-prerequisites context, the existing single-source materialization context, and exactly one synchronous ElevenLabs speech-to-text request using `scribe_v2`.

Immediately before the provider request, the boundary performs a fresh DB-only revalidation of job lifecycle, lease owner/generation/expiry, cancellation absence, project validity, provider credential identity/version/provider/usability, configured output-folder identity, and selected job-source/source identity/processability. This final check does not repeat credential decryption, Google metadata requests, Drive downloads, S3 downloads, or source copying, and no row lock is held during source I/O or the provider request. If the check fails, the provider is not called.

After a successful provider response, the boundary performs a fresh post-provider lifecycle check before yielding transcript content. If processing status, lease ownership, active lease, cancellation absence, or project validity changed, the transcript is discarded and no second provider request or automatic retry is attempted.

The normalized transcript result is ephemeral and redacted: transcript text and word text are available only while the context is active, retained handles fail closed after context exit, and representations expose only safe aggregate metadata such as text length and word count. Raw provider responses, provider error bodies, API keys, source identities, source bytes, Drive/private storage identifiers, transcript text, and word text are not exposed or persisted.

This slice still does not add a worker, queue consumer, public endpoint, OpenAI provider execution, Google Docs output, transcript/output persistence, job completion transition, job-source status persistence, manifest mutation, runtime/deploy behavior, production rollout, or automatic retry.

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

## Provider execution preconditions and side-effect boundaries

Future processing must not move from preflight, claim-readiness, claim, or lease ownership into provider execution unless processing-time source access and output-destination rules are satisfied inside the server-side execution boundary. Existing preflight snapshots and claim-readiness helpers are metadata-only, non-authorizing guardrails: they can explain missing prerequisites, but they do not prove that source bytes are accessible, Drive content still exists, provider credentials are usable, or Google Docs output can be created.

Provider execution, source byte access, Google Drive download/export processing, Google Docs output creation, output persistence, and manifest mutation remain separate future slices. A future worker must treat each external side effect as an explicit boundary rather than assuming a queued or claimed record authorizes the next step.

Cancellation and retry behavior must account for side-effect checkpoints before source access, before provider submission, before Google Docs creation, before output persistence, and before manifest update/export/sync if any manifest behavior is ever implemented. After any external side effect, retry/recovery design must avoid duplicate provider processing and must persist only safe normalized metadata, not transcript body, Google Docs body content, raw provider payloads, raw Google responses, source bytes, secrets, tokens, private storage keys, presigned URLs, or temporary file paths.

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

## PWA-OUTPUT-01A internal Google Docs single-transcript write boundary

`PWA-OUTPUT-01A` adds an internal server-only output boundary for exactly one active ephemeral transcript from exactly one source of an already leased `processing` Studio job. The boundary is not a worker and is not exposed through FastAPI.

The boundary requires the transcript handle to still be active, resolves one fresh user-owned Google access token, verifies the currently configured project output folder with Drive metadata, and performs one Google Drive multipart upload/conversion request to create one Google Docs transcript. The visible document body follows `transcript_doc_v1.2`: document title, transcript metadata for ElevenLabs `scribe_v2`, language, speakers `no`, UTC created timestamp, then transcript text. It does not add source-file/source-mode lines, provider raw JSON, word payloads, or persisted document body metadata.

Before Google Docs creation, the helper reloads and fences job lifecycle, lease owner/generation/expiry, cancellation absence, project owner/archive state, output folder identity, and selected relation/source identity/processability. It repeats DB-only checks after token refresh and folder metadata I/O, and immediately before the create request. After the create request succeeds, it performs a fresh lifecycle/output/source identity check. If state changed after the irreversible Google side effect, normal success is not yielded and only a safe normalized post-output reason is exposed; the helper does not retry, delete, move, or roll back the created file.

The yielded document reference is ephemeral and redacted. Internal code can read document id and web view link only while the context is active; retained handles fail closed after context exit. Representations and normalized errors must not expose access tokens, folder ids, document ids, URLs, titles, transcript text, multipart bodies, or raw Google response bodies.

This slice intentionally adds no output persistence, transcript persistence, job completion transition, job-source completion mutation, manifest mutation, worker, queue consumer, public processing endpoint, automatic retry, idempotency record, migration, runtime/deploy change, or production processing claim. Safe persistence/reconciliation after output creation is deferred to `PWA-OUTPUT-01B`.

## PWA-OUTPUT-01B safe output persistence and fenced completion

`PWA-OUTPUT-01B` adds an internal PostgreSQL-backed output authority for Google Docs transcript artifacts produced by the preceding internal output boundary. Each non-skipped job-source relation may have at most one persisted output row, and each Google Drive document id may be attached to at most one output row. The row stores only safe owner-scoped references and aggregate metadata: document id, web-view URL, output folder id, output kind, transcript standard, character count, Google document creation time, persistence time, and lease generation. It must not store transcript text, Google Docs body content, document titles, provider raw responses, word payloads, tokens, credential values, source bytes, private storage keys, multipart request bodies, or raw Google/database error payloads.

Persistence is an internal service-layer transaction boundary, not a FastAPI endpoint. The current processing owner must still own the exact lease generation, the lease must be active, cancellation must be absent, the project must remain owner-consistent and unarchived, the configured output folder must match the active revocable artifact, and the selected relation/source must still belong to the job and be processable. Artifact document id, URL, and folder id are readable only while the artifact context remains active; after context exit all fail closed with `context_closed`, and repr/error text redacts Google document and folder references. Repeating persistence for the same artifact metadata is idempotent while the job remains valid and processing; a different document for the same relation fails with a safe `output_conflict` and never overwrites the existing reference.

Completion authority is persisted-output coverage, not receipt of a single artifact. In the same transaction as output persistence, the helper counts all non-skipped job-source relations and their output rows. Multi-source jobs remain `processing` after partial output persistence, keep `finished_at` unset, and preserve the active lease. Only when every non-skipped relation has exactly one output row does the helper set the job to `completed`, set `finished_at`, clear safe failure fields, and invalidate lease ownership. Job-source statuses remain `queued`/`skipped`; no `completed` job-source status is introduced.

The Google Docs creation boundary now checks for an existing persisted output before token refresh or folder metadata I/O and again immediately before the Google create request. If an output row already exists, it raises the normalized `output_already_persisted` reason and makes no Google request. This prevents duplicate creation after successful persistence, but it is not full exactly-once output creation: a crash after Google creates a document and before database persistence can still leave an unpersisted external document. This slice deliberately adds no automatic retry, pending reservation, orphan discovery, reconciliation worker, or Google document delete/move/rollback behavior.

## PWA-PIPELINE-01-PREP internal single-job orchestration contract

`PWA-PIPELINE-01-PREP` defined the contract for `PWA-PIPELINE-01A — Internal synchronous single-job orchestrator`. Source now contains that internal synchronous orchestrator for one already-leased job. This remains not an implementation approval for a worker, queue consumer, scheduler, public processing endpoint, runtime service, automatic retry system, production migration execution, or production-live processing.

### Orchestrator identity

The `PWA-PIPELINE-01A` orchestrator is internal, server-only, and synchronous. It is invoked only with an existing database session, a job id, the exact lease owner id, the exact lease generation, settings, and a clock. It is not exposed through FastAPI, is not a worker, queue consumer, scheduler, CLI loop, background service, or runtime daemon, and is not authorized to claim an unowned job by itself.

The orchestrator operates only on a job that is already leased by the supplied owner/generation and is eligible to enter or remain in `processing`. Claiming an unowned job, choosing lease owners, runtime invocation, worker topology, queue technology, and production lease-renewal policy remain outside this contract.

### Deterministic source ordering and output authority

The orchestrator processes job-source relations in deterministic persisted order:

1. `position`;
2. relation id as the stable tie-breaker.

Relations with `JobSourceStatus.skipped` are ignored. Existing persisted outputs are authoritative: a relation with an existing output row must not repeat provider or Google Docs work, and the orchestrator may continue with the next required relation. Completion is determined by output coverage for every non-skipped relation, not by mutating job-source status. No `completed` job-source status is introduced.

### Per-source sequence

For each required non-skipped relation without persisted output, the orchestrator sequence is:

```text
fresh lifecycle/lease checkpoint
→ ElevenLabs transcription context
    └─ internally owns prerequisites, source materialization, and provider call
→ optional lease renewal, committed before Google I/O
→ Google Docs creation context
→ output persistence and possible completion
→ commit durable output progress
→ continue only if the job remains processing
```

The orchestrator calls the existing boundaries rather than duplicating authorization or integration logic. In the current callable composition, `transcribe_processing_job_source_with_elevenlabs` already opens processing execution prerequisites, source materialization, and the ElevenLabs provider call; `PWA-PIPELINE-01A` must not call `materialize_processing_job_source` separately before calling that transcription boundary. It must not retain source bytes, transcript text, provider results, Google tokens, Google response bodies, document bodies, or revocable handles outside their context lifetime.

### Transaction boundaries and commit ownership

The orchestrator must not intentionally hold `SELECT FOR UPDATE` locks or pending durable state mutations across source download/materialization I/O, provider HTTP requests, Google token refresh, Drive metadata requests, or Google Docs creation. Existing lower-level source-materialization, ElevenLabs, and Google Docs boundaries currently perform read-only validation through the supplied SQLAlchemy Session immediately before and after external I/O; `PWA-PIPELINE-01A` must not claim to eliminate those ambient read transactions unless those lower-level boundaries are explicitly refactored in approved scope. No new delivery item is created for transaction refactoring.

Output persistence remains the dedicated row-locking transaction. The orchestrator is the first internal layer allowed to own commits for the composed processing attempt. Lower-level boundaries continue to validate, perform scoped I/O, flush where designed, and never independently commit orchestration progress. The orchestrator must commit immediately after each successful per-source output persistence result; the final relation may persist its output and transition the job to `completed` in that same commit. It must not hold final-output locks while starting work on another source.

On exceptions, the orchestrator must roll back the active database transaction, preserve normalized typed boundary errors, avoid raw exception payloads in persistent failure metadata, and allow context-managed artifacts to revoke/close through normal context exit. A failed database commit must roll back the database transaction. A commit failure after Google document creation remains an output-reconciliation risk and must not trigger automatic Google creation retry.

### Lease checkpoints

`PWA-PIPELINE-01A` must not create a background heartbeat, thread, task, timer, worker loop, or scheduler. It may use the existing synchronous lease-renewal primitive only at deterministic safe checkpoints:

- before beginning work on the next source;
- after provider completion and before beginning Google output work;
- after durable per-source persistence and before continuing to another source.

Every existing boundary still performs its own active-lease and generation checks. Lease renewal uses a row-locking mutation and `flush()`; every successful renewal must be committed before the next external side effect begins, including Google token refresh, Drive metadata lookup, or Google Docs creation. If lease renewal, ownership validation, or a renewal commit fails, the orchestrator must roll back the active transaction, stop orchestration, perform no new provider or Google side effect, avoid completing the job, and avoid automatic retry. Lease renewal policy for a production worker remains a later separately approved runtime concern.

### Cancellation checkpoints

Cancellation must be checked before source materialization, before provider submission, after provider completion, before Google Docs creation, after Google Docs creation and before persistence, after persistence and before starting another source, and before final completion.

When cancellation is observed before an irreversible output side effect, the orchestrator must stop without starting the next side effect. When the current fenced owner can safely acknowledge cancellation, it must use the existing cancellation transition. It must never create another Google document after cancellation is observed, never discard or overwrite an already persisted output, and never delete a Google document as cancellation rollback.

### Failure categories and partial-output policy

Pre-output failures include source unavailability, source materialization failure, provider credential unavailability, provider request failure, malformed provider response, lease loss before Google creation, and cancellation before Google creation. These may transition the job through the existing safe failure or cancellation primitive when the current owner still holds a valid lease. Only normalized safe error codes/messages may be persisted.

Output-side-effect uncertainty includes cases where Google creation may have succeeded but post-create fencing fails, the artifact exists but database persistence or commit fails, lifecycle changes between Google creation and persistence, or an output-reference conflict requires reconciliation. In these cases the orchestrator must not repeat provider execution, must not create another Google document automatically, and must not delete, move, rename, or roll back the external document. It may record only a safe normalized reconciliation-required failure when the current fenced lifecycle still permits it; otherwise lifecycle resolution remains with the existing cancellation/lease-recovery authority. Manual or separately designed reconciliation is required.

### Retry and recovery boundary

`PWA-PIPELINE-01A` adds no automatic retry. It does not automatically retry source downloads, provider requests, Google Docs creation, output persistence after an uncertain external side effect, or completed, failed, or cancelled jobs.

Existing expired-lease recovery remains available, but recovery must not blindly re-run a relation when an unpersisted Google document may already exist. Exactly-once output creation is not claimed.

### Successful result metadata

A successful orchestration result may contain only safe operational metadata such as job id, final job status, attempt count, required source count, persisted output count, and whether completion occurred.

It must not contain document ids or URLs, folder ids, source identifiers intended to remain private, transcript text, document body, provider raw responses, tokens, credentials, source bytes, or private storage paths or keys.

### PWA-PIPELINE-01B explicit-job and PWA-WORKER-01A claim-next boundaries

`PWA-PIPELINE-01B` adds one internal, server-only, synchronous boundary for one explicitly identified queued Studio job:

```text
explicit queued job id
→ acquire lease for the supplied opaque owner and TTL
→ commit the acquired lease
→ existing synchronous orchestrator with the committed owner/generation
```

PWA-WORKER-01A adds one internal, server-only, synchronous claim-next iteration:

```text
one invocation
→ atomically select oldest unlocked ready queued job in PostgreSQL
→ acquire lease
→ commit lease
→ existing synchronous orchestrator
→ return result or idle
```

The claim-next iteration uses PostgreSQL row records as the discovery authority, deterministic `created_at` then job-id ordering among currently unlocked candidates, and row-level `SELECT FOR UPDATE SKIP LOCKED` selection so a locked candidate can be skipped without blocking. Unready candidates and active leases are skipped without mutation. Idle state returns `None` and ends the selection transaction.

These boundaries do not poll, loop, sleep, back off, run as a worker process, consume or create a Redis queue, use Redis for discovery/locks/notifications/retries/scheduling, start automatically, add a scheduler, expose a public processing API, change runtime deployment, retry failures, release committed leases on orchestration failure, or claim production-live processing. Provider, source, Google, and output work must not begin until the lease commit succeeds; the existing orchestrator remains responsible for the queued-to-processing transition and all per-source processing behavior.

### Residual limitations

This contract preserves these limitations: no worker process, no polling loop, no sleep/backoff, no Redis queue, no queue consumer, no public processing endpoint, no automatic startup, no scheduler, no OpenAI execution, no manifest mutation, no browser output API, no frontend output links, no automatic retry/reconciliation, no exactly-once guarantee, no runtime/deploy changes, no production migration execution, and no production-live processing claim.

### PWA-WORKER-01-PREP dedicated Studio polling worker runtime contract

`PWA-WORKER-01-PREP` is documentation-only preparation for the first dedicated Studio polling worker runtime. It does not implement a worker process, polling, signal handling, lease-renewal code, Docker/Compose wiring, deployment, operator procedure, migration, Redis behavior, retries, recovery, manifest mutation, or production-live processing.

#### Process topology

The future worker is a dedicated server-side Python process named conceptually `studio-worker`. It must run separately from the FastAPI/Uvicorn `studio-api` HTTP process, process at most one job at a time per process, use PostgreSQL as the job discovery and locking authority, and invoke the existing claim-next-and-orchestrate boundaries for exactly one iteration at a time.

The worker must expose no HTTP port and no public API. It must never execute inside a FastAPI request handler, startup hook, FastAPI background task, or the Studio browser/frontend container. The first implementation must reuse the existing Studio API application image with a different command override instead of creating a second divergent application image or Dockerfile.

The initial Compose topology is limited to one `studio-worker` service instance. PostgreSQL `SELECT FOR UPDATE SKIP LOCKED` makes future multiple replicas concurrency-safe in principle, but this preparation item does not approve autoscaling or replica-management behavior.

#### Worker lease owner identity

Each worker process must generate exactly one opaque lease owner id at process startup and keep it stable for that process lifetime. Restarting the process must generate a different owner id. The required format semantics are:

```text
studio-worker:<bounded-host-identity>:<random-process-uuid>
```

Exact implementation formatting may vary, but the value must fit the existing 128-character lease-owner limit. It must not contain a user id, email, project id, job id, source id, secret, token, credential, private hostname metadata, or deployment path. It is internal coordination metadata, not a secret, and must never be returned through browser APIs. The worker must not create a new owner id for each loop iteration.

#### Runtime configuration

The next implementation may add only these worker runtime settings and environment variables:

| Settings field | Environment variable | Default | Minimum | Maximum |
|---|---|---:|---:|---:|
| `worker_poll_interval_seconds` | `STUDIO_WORKER_POLL_INTERVAL_SECONDS` | 5 | 1 | 60 |
| `worker_error_backoff_seconds` | `STUDIO_WORKER_ERROR_BACKOFF_SECONDS` | 5 | 1 | 300 |
| `worker_lease_ttl_seconds` | `STUDIO_WORKER_LEASE_TTL_SECONDS` | 3600 | 300 | 86400 |

The lease TTL maximum matches the existing 24-hour lease maximum. Invalid worker configuration must fail fast during process startup with a normalized, non-secret configuration error. The process must not start polling with invalid values. Worker configuration must not be loaded from browser input, job metadata, Redis, or database rows.

#### Main worker loop

The future worker loop is:

```text
validate runtime configuration
→ create one process owner id
→ install SIGTERM/SIGINT stop handling
→ repeat until stop requested:
    create a fresh SQLAlchemy Session
    → call claim_next_and_orchestrate_processing_job once
    → close the Session
    → if a job was processed:
        continue without an idle sleep
    → if idle:
        interruptibly wait for poll interval
    → if a normalized iteration/job error occurred:
        safely report the reason
        interruptibly wait for error backoff
    → if stop was requested:
        do not claim another job
→ exit cleanly
```

The loop itself must not contain provider, Google, storage, lifecycle, or persistence logic. It delegates one iteration to the existing runner and orchestrator boundaries. It must not approve batch claims, multiple simultaneous jobs in one process, an in-memory queue, a Redis queue, a scheduler, cron behavior, recursive worker invocation, or automatic retry of the same processing attempt.

#### Database session lifecycle

The worker must create a fresh SQLAlchemy `Session` for each single iteration. It must not reuse one `Session` indefinitely across iterations, keep a `Session` open during idle sleep, keep a failed transaction alive for the next iteration, or retain ORM entities across iterations.

For every iteration, the existing iteration boundary owns its commits and rollbacks. The worker must close the `Session` in a `finally` block. An idle result must end the transaction before sleep. A raised exception must not leak a failed transaction into the next iteration. Database connection pooling remains owned by the existing SQLAlchemy engine.

#### PostgreSQL and Redis authority

PostgreSQL remains authoritative for job discovery, deterministic ordering, row locking, leases, lifecycle, output persistence, and completion.

Redis must not be used for job queues, job discovery, locks, lease ownership, retries, scheduling, wake-up notifications, or worker heartbeats. The existing Redis service remains unrelated rate-limit infrastructure. The worker contract must not add a Redis dependency beyond unrelated application configuration that already exists.

#### Lease TTL and renewal policy

The future runtime must use the existing synchronous `renew_job_lease` primitive only at deterministic orchestration checkpoints. It must not use a background heartbeat thread, asyncio task, timer thread, or second concurrent renewal `Session`.

The next implementation item must extend orchestration composition narrowly so that the active lease can be renewed and committed at these safe checkpoints:

- before starting external work for the first source;
- before starting external work for each later source;
- after provider completion and before Google token/Drive/Docs work;
- after each durable per-source output commit and before another source.

Every successful renewal must use the exact current owner and generation, use a fresh clock value, use the configured worker lease TTL, and commit before the next external side effect. If renewal, ownership validation, or renewal commit fails, the implementation must rollback, stop the current orchestration, perform no new provider or Google side effect, avoid automatic retry, and preserve normalized fencing behavior.

Residual limitation: there is no background renewal during one in-progress source materialization/provider call. One continuous source/provider stage must complete within the configured lease TTL. Expiry still fails closed. This limitation prevents a production-live claim until runtime validation exists.

#### Graceful shutdown

SIGTERM and SIGINT must request shutdown rather than abruptly starting new work. When idle, the worker must interrupt the wait and exit. Before claiming, it must check the stop flag. Once a job has been claimed and orchestration has begun, the worker must allow the current synchronous iteration to reach its normal completion or normalized failure. After that iteration returns or raises, it must not claim another job.

The worker must not automatically cancel the active job, release its lease, kill provider or Google calls from a signal handler, or perform database operations inside the signal handler. It should exit with status 0 after an orderly requested shutdown. Unexpected fatal startup/configuration failures may exit non-zero. Forced container termination and operator timeout behavior remain deployment/operator concerns and are not production evidence.

#### Error behavior

Startup/configuration errors must emit a safe normalized message, exit non-zero, and begin no polling. Idle is a normal result, must not be logged as warning/error, and waits for the poll interval.

Known `JobLeaseError`, `JobProcessingRunnerError`, or `JobProcessingOrchestrationError` from one iteration must rollback/close through existing boundaries, log only a safe type/reason and allowed operational metadata, avoid same-attempt retry, wait for error backoff, and continue the outer loop unless shutdown was requested.

Unexpected iteration exceptions must close/rollback the iteration `Session`, log a normalized `worker_iteration_failed` event without raw exception text, wait for error backoff, and continue unless shutdown was requested. The worker must not silently exit after one job-level failure. It must not convert failed, cancelled, completed, or uncertain-output jobs back to queued. Expired-processing recovery remains separate and must not be added to this worker loop.

#### Safe logging

Allowed safe operational fields are event name, normalized reason, job id when already present in a safe result/error context, final job status, attempt count, required source count, persisted output count, processed source count, completion boolean, and process owner id only in redacted/bounded internal startup diagnostics.

The worker must never log transcript text or words, private source filenames, source ids or job-source ids unless separately approved, document ids or URLs, Drive folder ids, provider responses, Google responses, OAuth tokens, provider credentials, object keys, presigned URLs, secret file contents, environment values, raw exception text, or tracebacks containing request data.

Python logging to stdout/stderr is sufficient for the first implementation. This contract does not approve a metrics backend, tracing platform, audit table, or new observability dependency.

#### Approved next implementation scope

The only explicitly approved next implementation item is `PWA-WORKER-01B — Dedicated Studio polling worker source and Compose wiring`.

That later source PR may add a worker loop/entrypoint module; add the three validated `Settings` fields; add the three keys to `deploy/studio/.env.example`; add one `studio-worker` service to `deploy/studio/compose.platform.yml`; reuse the `studio-api` image with a command override; mount the same required credential, Google, PostgreSQL, and source-storage secret files; depend on PostgreSQL health; use `restart: unless-stopped`; expose no port; add focused unit and Compose-contract tests; and update deployment source documentation narrowly.

The same `PWA-WORKER-01B` implementation item is also authorized and required to modify the existing synchronous orchestrator only as needed to perform the `renew_job_lease` checkpoints documented by this PREP contract. That narrow orchestration extension must use the configured worker lease TTL, commit every successful renewal before the next external side effect, and stop safely on renewal, ownership-validation, or renewal-commit failure. Focused tests must cover renewal ordering, commit-before-side-effect behavior, fencing failure, and no automatic retry.

This lease-renewal authorization does not permit a background heartbeat, second renewal thread/task/Session, unrelated orchestrator refactoring, automatic retry, recovery scans, public APIs, or production deployment. Do not create another delivery item for lease renewal.

That later item must not deploy to production, execute migrations, change volumes, recreate PostgreSQL or Redis, change production `.env` values, add a Redis queue, add a public endpoint, or claim production-live processing.

#### Deployment and production boundary

This preparation PR makes no runtime change. Even after the later source implementation, source-done/merged will not mean production-live; migration rollout remains manual/operator-scoped; deployment requires separate operator action and evidence; provider/Google processing success requires factual runtime evidence; Colab remains the working production contour until Studio runtime evidence exists; Studio manifest mutation remains unimplemented; and exactly-once Google document creation remains unclaimed.


## PWA-WORKER-01B dedicated polling worker source

`PWA-WORKER-01B` adds source for a dedicated synchronous `python -m studio_api.worker` process and source-only Compose wiring for one `studio-worker` service. The worker polls PostgreSQL through the internal claim-next runner, uses one process-lifetime opaque lease owner id, processes at most one job at a time, creates a fresh database Session per iteration, closes it before idle/backoff waits, and handles SIGTERM/SIGINT by setting a stop flag without cancelling jobs or releasing leases. Worker configuration is limited to the three validated `STUDIO_WORKER_*` timing settings and fails before polling or Session creation when invalid.

The runner now passes the exact lease TTL used for acquisition into the orchestrator. The orchestrator renews the existing PostgreSQL lease with that TTL and commits before each source's external provider boundary and again after provider transcription before Google Docs work. A single renewal at the next source boundary covers the post-output-commit/pre-next-external-work checkpoint. Renewal failures map to normalized orchestration reasons, stop the current orchestration, do not retry, do not release the lease, and leave continuation to the worker backoff loop.

This source does not add a background heartbeat: no renewal runs while one source materialization or provider call is in progress, one continuous provider stage must complete within `worker_lease_ttl_seconds`, expiry fails closed, and no exactly-once provider or Google behavior is claimed. `source-done` for this item is not `production-live`; operator rollout and evidence remain separate. Redis is not a processing queue, lock, scheduler, retry mechanism, notification channel, or heartbeat store.

## PWA-OUTPUT-02-PREP browser-safe Studio job output discovery contract

`PWA-OUTPUT-02-PREP` prepared the browser-safe discovery contract for Studio outputs already persisted by internal processing. `PWA-OUTPUT-02A` implements the source-only read API endpoint, closed allowlist serializer, parsed Google URL validation, partial output discovery, and deterministic ordering. `PWA-OUTPUT-02B` adds platform-mode frontend rendering for that explicit endpoint when a user opens job details. These items do not add polling, output persistence changes, processing behavior, worker behavior, Google API calls from the browser, migrations, Compose/runtime/deploy changes, production rollout, or a production-live processing claim.

### Approved endpoint shape

The only approved browser output-discovery endpoint is:

```text
GET /api/jobs/{job_id}/outputs
```

The endpoint is implemented as an internal authenticated browser API, is read-only, and requires the existing authenticated browser session. It does not require CSRF protection because it performs no mutation. Output URLs must not be added to project job-list responses, and the first implementation must not automatically widen every existing `GET /api/jobs/{job_id}` response with output records. Keeping output discovery explicit preserves list/detail compatibility, keeps URL-bearing metadata opt-in, and enables focused authorization and redaction tests.

Conceptual response shape:

```json
{
  "job_id": "<owned job id>",
  "job_status": "queued|processing|completed|failed|cancelled",
  "output_count": 0,
  "outputs": []
}
```

Each output entry may contain only `source_id`, `source_position`, `source_name`, `source_type`, `output_kind`, `transcript_standard`, `web_view_url`, `link_available`, `document_character_count`, `document_created_at`, and `persisted_at`. Field naming may follow current API conventions, but these semantics are fixed.

### Authorization and not-found behavior

The endpoint must use the same owner-scoped job authority as the existing job-detail endpoint. An authenticated user may read outputs only for a job whose `owner_user_id` matches the current user. Nonexistent jobs and cross-owner jobs must both return the existing generic 404 behavior, and no response may reveal whether another user's job exists.

Output rows must be constrained through the already-authorized job id. The implementation must not authorize by output id, source id, project id, document id, URL, or archived project state. Archived project state must not create broader access than the existing job-detail contract. No admin bypass, sharing path, public links endpoint, anonymous access, signed API token, or service-to-service output endpoint is approved.

The implementation joins output rows to the job-source relation and source record only after job ownership is established.

### Browser-safe and forbidden fields

Output entries may include only source metadata already available to the same owner through the existing job-detail response: source id, source position, original filename as `source_name`, and source type.

The following persisted output fields are approved for browser output: `output_kind`, `transcript_standard`, `document_character_count`, `document_created_at`, `persisted_at`, and a validated Google web-view URL. The URL is user-facing output navigation and may be returned only after validation.

The endpoint must not expose job-source ids, S3 buckets, S3 object keys, Drive source file ids beyond fields already deliberately exposed by the existing source contract, private storage paths, temporary file paths, source bytes, database output ids, Google document ids, output Drive folder ids, lease generation, raw provider responses, Google API responses, transcript text, document body content, credential metadata, OAuth metadata, tokens, secret values, or internal error detail.

Transcript bodies and Google Docs body content remain server-ephemeral and must never enter the API response.

### URL validation and fail-closed behavior

The API must never echo an arbitrary persisted URL directly. It may return `web_view_url` only when parsed URL components prove all of the following:

- scheme is exactly HTTPS;
- hostname is exactly `docs.google.com` or `drive.google.com`;
- no embedded credentials are present;
- there is no custom port;
- the value is not a non-HTTPS scheme, `javascript:`, `data:`, `file:`, `blob:`, localhost, IP-literal, protocol-relative URL, or substring-based hostname trick.

Validation must use parsed URL components rather than substring matching. The endpoint must not perform a live Google request merely to validate, verify, refresh, or repair the link.

When a persisted output row has a missing or unsafe URL, the endpoint must preserve the output metadata entry, return `web_view_url` as `null`, return `link_available` as `false`, avoid exposing the unsafe value, avoid failing the whole endpoint solely because one link is unsafe, avoid mutating or repairing the database row, and avoid logging the unsafe URL. For an approved URL, return the normalized persisted URL and set `link_available` to `true`.

### Partial-output, status, and ordering semantics

Persisted outputs may exist for jobs in `processing`, `failed`, `cancelled`, and `completed`. The endpoint must return all currently persisted owner-scoped outputs regardless of terminal status. A queued job with no outputs returns HTTP 200 with `output_count` `0` and `outputs` `[]`; a processing job may return partial outputs; a failed or cancelled job may return partial outputs created before failure or cancellation; and a completed job returns all persisted outputs.

The presence of one or more outputs must not imply job completion. `job_status` remains the lifecycle authority, and `output_count` is the count of returned persisted output entries. The read endpoint must not hide partial outputs merely because a job is not completed, and it must not create, retry, reconcile, delete, rename, move, refresh, or validate Google documents.

Outputs must be ordered deterministically by job-source position ascending, then `persisted_at` ascending, then output row id ascending only as an internal tie-breaker. The internal output-row id must not be returned. The endpoint must not order by filename, document id, URL, Google timestamp, or database default order.

### API error behavior and tests

Unauthenticated requests follow the existing session dependency behavior. Nonexistent or cross-owner jobs return generic 404. A valid owned job with no outputs returns HTTP 200 and an empty collection. Malformed internal output metadata must not expose raw values. One unsafe URL must not fail other valid output entries. Unexpected database failure uses the existing normalized server-error behavior and must not expose SQL, row contents, identifiers, URLs, or traceback details. No new browser-visible error fields may contain internal reasons.

`PWA-OUTPUT-02A` tests must cover at least: authentication/session dependency behavior; owner-scoped success; cross-owner and missing-job generic 404; empty owned job response; partial outputs for processing, failed, cancelled, and completed jobs; deterministic ordering; approved Google URL serialization; unsafe/missing URL fail-closed serialization without echoing unsafe values; forbidden-field redaction; `GET /api/jobs/{job_id}` and project job-list payloads remaining unwidened; and unexpected database-error normalization without internal details.

### Implementation, frontend, and production boundaries

`PWA-OUTPUT-02A — Browser-safe Studio job output API` is the active source implementation of this read path.

That implementation adds `GET /api/jobs/{job_id}/outputs`, a small focused output serializer/helper, parsed Google URL validation, deterministic persisted-output queries, authorized job-source/source joins limited to response metadata, PostgreSQL-backed API tests, DB-free helper tests, and narrow updates to the relevant documentation files.

It must not modify the database schema, add migrations, change output persistence, change processing or worker behavior, add frontend output links, add a public processing endpoint, add Google API calls, refresh Google tokens, verify document existence live, add sharing, add download/proxy behavior, expose transcript text or document body, deploy to production, or claim production-live processing. No additional delivery item id is approved or named after `PWA-OUTPUT-02A`.

`PWA-OUTPUT-02B — Studio job output links UI` requests `GET /api/jobs/{job_id}` and `GET /api/jobs/{job_id}/outputs` only when a user explicitly opens job details. The output request is a same-origin authenticated read and does not use CSRF mutation helpers. The UI may display only the approved output metadata, must render server ordering without re-sorting, must show unavailable-link entries instead of omitting them, must keep `job_status` separate from `output_count`, and must never gate outputs on `completed`. Clickable output links are allowed only when `link_available` is exactly `true` and the URL is a non-empty HTTPS URL on exact `docs.google.com` or `drive.google.com`; links open with `target="_blank"` and `rel="noopener noreferrer"`.

`PWA-OUTPUT-02A` and `PWA-OUTPUT-02B` are source-only; source-done/merged will not mean production-live; the `studio-worker` still requires separate operator rollout and evidence; browser output access requires source deployment before it is live; Colab remains the working production contour; Studio manifest mutation remains unimplemented; and exactly-once Google document creation remains unclaimed.

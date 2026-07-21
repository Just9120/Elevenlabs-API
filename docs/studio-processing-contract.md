# Studio processing contract

This is the current Studio processing contract. It is not a delivery plan, PR history, deployment runbook, or proof of production-live processing. Product scope lives in `docs/project-spec.md`; architecture lives in `docs/architecture.md`; rollout procedure lives in `docs/runbooks/studio-platform-ops.md`.

## Authority

- PostgreSQL is the durable authority for jobs, job-source relations, leases, lifecycle state, output destinations, output rows, and completion decisions.
- Redis is not the processing queue, lease authority, retry authority, scheduler, notification authority, or heartbeat authority.
- Browser clients do not start internal processing directly and must not receive internal lease/claim metadata.
- A worker process handles no more than one job at a time.
- Source-level code does not prove production-live processing; controlled rollout evidence is required.

## Claim and lease

- Claim is atomic and must establish exact owner and generation fencing before processing begins.
- Active processing requires an active unexpired lease owned by the exact owner/generation.
- Stale owners, stale generations, expired leases, terminal jobs, cancellation conflicts, or ownership ambiguity fail closed.
- Lease owner, generation, claim timestamp, and lease expiration are internal server-side metadata.
- Lease timestamps are normalized to timezone-aware UTC before comparison.
- A naive datetime value is interpreted as UTC.
- A lease is active only when `lease_expires_at > now`.
- `lease_expires_at == now` means the lease is expired.
- A bounded PostgreSQL-backed heartbeat may run only around one documented long external stage: source materialization/provider work or Google output authorization/metadata/create flow.
- Each heartbeat renewal uses its own database session, applies transaction-local PostgreSQL statement/lock timeouts before the fenced renewal, renews only `lease_expires_at` through exact owner/generation fencing, commits only if stop has not already been requested, and closes; the main orchestration session is never shared across threads.
- Heartbeat is stage-scoped and stops with a strictly bounded two-phase join after the external call; a production heartbeat thread is daemon as a final shutdown safety net, and failure or stop timeout has priority over any simultaneous provider/Google exception, fails closed with normalized `lease_heartbeat_*` reasons, and does not retry provider or Google work.
- `lease_expires_at` is mutable heartbeat state and must not be treated as immutable source/output snapshot identity; lease owner, generation, status, cancellation, project/source/output identity, and active-lease checks remain authoritative. Lease renewal may happen only at documented safe checkpoints or through this bounded PostgreSQL heartbeat, never as Redis, implicit lease recovery, or an unbounded background loop.

## Deterministic processing

- Job-source relations are processed in deterministic order by `position` and then a stable database tie-breaker.
- Skipped relations are ignored for required output coverage.
- An existing persisted output for a relation is authoritative.
- A relation with persisted output must not repeat provider transcription or Google Docs creation.
- Existing output coverage is considered before deciding whether more external work is required.

## Transaction and commit ownership

- Row locks must not be held across source storage, Drive, provider, or Google Docs external I/O.
- Output authorization and Google Docs creation use the persisted per-job output-folder snapshot.
- The mutable project default output folder must not replace the destination of an existing job.
- Changing a job output-folder snapshot after creation is prohibited except through a separately designed migration/reconciliation operation; no such operation exists now.
- Output persistence is a dedicated transaction boundary.
- The worker commits after each per-source output persistence boundary.
- A commit failure after Google Docs creation is a reconciliation risk.
- When Google creation outcome is uncertain, automatic second Google creation is prohibited.
- Provider calls and Google side effects must not be retried automatically inside the same attempt after an uncertain side effect.

## Output authority

- At most one output row may exist for each non-skipped job-source relation.
- The current schema enforces unique `job_source_id` and unique Google `document_id` for persisted Studio outputs.
- Completion is allowed only after persisted output coverage exists for every non-skipped relation.
- Partial outputs may exist for jobs that are still `processing` or that later become `failed` or `cancelled`.
- Exactly-once Google document creation is not claimed; the database can enforce persisted-row uniqueness but cannot prove external side-effect uniqueness by itself.

## Cancellation and side-effect checkpoints

Processing must re-check lifecycle, lease, ownership, and cancellation at safe boundaries:

1. before source access;
2. before provider submission;
3. after provider completion and before exposing transcript text to the next stage;
4. before Google Docs creation;
5. after Google creation and before output persistence, including heartbeat result validation;
6. after output persistence and before the next source;
7. before final completion.

If cancellation, lease loss, owner/generation mismatch, project/source mutation, credential mutation, output-folder mutation, or terminal transition is observed at a checkpoint, processing must fail closed and preserve only safe normalized evidence.

## Worker loop

- Each processing iteration uses a fresh database session.
- The worker must not keep a database session open during idle sleep.
- SIGTERM/SIGINT requests graceful stop.
- After stop is requested, the worker must not claim another job.
- The worker must not automatically retry the same attempt after provider, Google, persistence, or lifecycle failure.
- Logs and diagnostics must use normalized safe reason codes and must not include secrets, transcript text, source bytes, raw provider payloads, raw Google responses, document IDs/URLs, folder IDs, object keys, presigned URLs, or lease metadata in browser-visible surfaces.

## Browser-safe output

- Output read access is explicit, authenticated, and owner-scoped.
- Partial outputs may be returned for an owned job; job status remains the lifecycle authority.
- Browser payloads may include only validated safe Google web URL metadata and aggregate output metadata.
- Browser payloads must not include transcript body, Google document ID, folder ID, lease metadata, provider payloads, Google payloads, source bytes, object keys, private paths, or secret values.

## Known limitations

- Output reconciliation is source-level and explicit owner-driven; runtime rollout still requires operator migration/deployment evidence.
- Safe stage-specific retry/recovery is source-level and explicit owner-driven; runtime rollout evidence remains pending.
- No generic retry/recovery scheduler for failed long external calls.
- No OpenAI Studio processing path.
- No Studio manifest mutation.
- No multi-worker production validation.
- No production-live processing claim without controlled rollout validation.

## Output reconciliation

Studio output reconciliation is an explicit owner action for uncertain Google Docs side effects. Processing must prepare and commit a durable reconciliation case before Google Docs creation, then pass an opaque random token to Drive `appProperties`. When Google creation response, lifecycle, heartbeat state, context close, or output persistence is uncertain, the job records `output_reconciliation_required` where lifecycle permits and does not retry provider work or create a second Google Doc.

The reconciliation path performs exact Drive lookup using the opaque appProperty token and the job output-folder snapshot. It does not read transcript text, Google document body, raw provider responses, or raw Google responses. Zero matches remain unresolved; multiple matches become conflict; exactly one verified match may persist one missing output row. Reconciliation does not require an active worker lease, live source bytes, uploaded source status, object-storage availability, or source restoration, and it does not mutate lease owner, lease generation, attempt count, source bytes, or job output-folder snapshot.

An existing unresolved reconciliation case permanently blocks a new Google Docs create for that relation because Drive appProperties are correlation metadata, not an idempotency key. A `prepared` case by itself is internal evidence and does not make owner reconciliation available until it becomes `creation_returned`, `reconciliation_required`, or `conflict`. Pre-create reconciliation-case persistence failure is a safe processing failure, not output uncertainty and not an existing-output race. A `conflict` case is a stable fail-closed state: repeated owner checks report the conflict without selecting a candidate, creating/deleting Google Docs, or reading document body.

## Safe stage-specific retry and expired-lease recovery

Studio keeps a durable PostgreSQL per-source attempt ledger for retry/recovery decisions. A missing non-skipped job-source must have an attempt row committed before source/provider external work starts. The provider request-start marker is committed immediately before transport; a valid provider response is marked before Google/output work with `provider_result_lost` until output persistence completes.

Same-job retry is available only by explicit owner action and only when durable evidence proves the provider request did not start, or the provider definitively rejected the request before any successful transcription (`provider_authentication_rejected`, `provider_request_rejected`, or `provider_rate_limited`). Timeout, unavailable/connection interruption after request start, malformed response, unknown transport error, lifecycle/lease/heartbeat loss after request start, and a returned provider result without persisted output all block retry. Conservative blocking is preferred over another paid provider call.

Google uncertainty remains governed by output reconciliation. A provider-returned attempt entering Google handoff cannot be retried by calling the provider again; unresolved reconciliation evidence blocks a new Google Docs create. Existing persisted outputs remain authoritative, are skipped by retry/recovery, and partial outputs are preserved.

Expired processing lease recovery is stage-aware and database-only. It may requeue only when every missing required relation is retry-safe and the job has not reached the retry limit. Unknown/legacy execution state, provider uncertainty, provider-result-lost state, Google handoff/uncertainty, unresolved reconciliation, non-retryable evidence, or three job attempts fail closed. There is no automatic scheduler, backoff loop, Google retry, transcript persistence, or replacement-job creation.

The maximum processing attempts per job is three: the initial attempt plus at most two explicit/safe recovered attempts. Existing failed jobs without source-attempt evidence are treated as legacy/unknown and are not retryable.

### Studio source deletion, retention, and cleanup

Studio source removal is logical, owner-scoped, and durable in PostgreSQL. Source rows are never hard-deleted by the source lifecycle; display metadata, job-source relations, historical jobs, persisted outputs, attempt evidence, and reconciliation cases remain available for history. Google Drive source removal only removes the Studio reference: Studio must not delete, trash, update, or otherwise mutate the external Drive file, and Google Docs outputs are not removed by this flow.

Local-upload bytes use an asynchronous, idempotent cleanup lifecycle stored on `sources`. S3/R2 delete is allowed only after durable logical deletion or retention expiry state exists. A missing object is treated as successful physical cleanup; storage failures do not roll back logical deletion and are retried through durable cleanup state. Object storage identity is cleared only after successful cleanup finalization; browser payloads must not expose bucket/object keys, cleanup owners, cleanup generations, cleanup leases, cleanup attempt counts, cleanup errors, or internal job references.

Pending local uploads expire one hour after initiation by default. Verified completion resets `expires_at` to a retained-source deadline that defaults to 24 hours after completion. Runtime configuration bounds the pending window to 15 minutes–24 hours and the retained-source window to one hour–30 days; the browser presign remains a separate capability with a maximum lifetime of 15 minutes. Completed local-source payloads expose the exact expiry so the PWA can show it, while Google Drive inputs and Google Docs outputs are outside this retention rule.

Local sources expire when `expires_at <= now`. Expiry blocks new jobs, claims, explicit retries, expired-lease recovery, upload completion, and processing-time source access. Retention expiry may mark a local source `expired` with `delete_reason=retention_expired` without setting `deleted_at`, so unavailable metadata may remain visible. A referencing `processing` job defers physical cleanup until terminal/recovered state; cleanup never calls the provider, Google Drive, Google Docs, output reconciliation, or attempt-ledger mutation. Completed, cancelled, non-retryable failed, provider-uncertain/result-lost, and unresolved-reconciliation history does not block user source deletion; queued, processing, and actually retryable failed jobs do block deletion.

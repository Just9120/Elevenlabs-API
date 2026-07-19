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
- Background heartbeat during one long external call is not implemented.
- One continuous materialization/provider/output stage must complete within the configured lease TTL.
- Lease renewal may happen only at documented safe checkpoints, never as an implicit Redis heartbeat or unbounded background loop.

## Deterministic processing

- Job-source relations are processed in deterministic order by `position` and then a stable database tie-breaker.
- Skipped relations are ignored for required output coverage.
- An existing persisted output for a relation is authoritative.
- A relation with persisted output must not repeat provider transcription or Google Docs creation.
- Existing output coverage is considered before deciding whether more external work is required.

## Transaction and commit ownership

- Row locks must not be held across source storage, Drive, provider, or Google Docs external I/O.
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
5. after Google creation and before output persistence;
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

- No automated output reconciliation.
- No safe stage-specific retry/recovery system.
- No background lease heartbeat for long external calls.
- No OpenAI Studio processing path.
- No Studio manifest mutation.
- No multi-worker production validation.
- No production-live processing claim without controlled rollout validation.

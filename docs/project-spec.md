# Project specification

## Authority and status

This document is the current product/project contract. It is not delivery history and does not by itself prove runtime rollout. Historical delivery notes belong in `docs/delivery-plan-archive.md`; current delivery state belongs in `docs/delivery-plan.md`.

Status terms are strict:

- `implemented at source level` / `present in the repository` means code, migrations, docs, or tests exist in this repository.
- `CI-verified` means repository checks passed for a change.
- `deployed`, `migration-applied`, `worker-running`, and `production-live` require factual operator/runtime evidence.
- Studio processing must not be called `production-live` without a controlled end-to-end canary showing exactly one intended output.

## Product goal

VoiceOps helps operators transcribe source media with provider BYOK credentials and deliver safe transcript outputs to Google Docs. The product currently has two contours:

1. Stable Google Colab batch workflow.
2. Studio PWA in-development platform workflow.

The Studio PWA target is Colab parity where appropriate, with web-platform adaptations for authentication, project/source management, encrypted credentials, Google OAuth, persisted jobs, worker execution, diagnostics, and browser-safe output visibility.

## Stable Google Colab baseline

The Google Colab contour is stable, ready, and used in real operation. It remains the behavioral baseline for future PWA parity and is the fallback production contour until Studio has factual production processing evidence.

Durable Colab invariants:

- Batch transcription behavior and Google Docs delivery must remain available.
- Existing Colab notebooks/scripts must not be refactored as a side effect of Studio documentation or platform work.
- Secret values must be read from approved runtime secret mechanisms and never printed.
- Provider responses, transcript bodies, document content, Google tokens, and private source bytes must not be copied into repository docs, logs, examples, or validation evidence.
- Provider HTTP failures expose safe diagnostics only: provider name, status code, an endpoint without query parameters, and scalar fields `detail`, `message`, `code`, `type`, `error.message`, `error.type`, and `error.code`. Raw response bodies must not be printed. Google retry logs must likewise omit request/response bodies, transcript text, tokens, and secrets.
- Generated media, transcripts, private manifest exports, runtime analytics, and notebook outputs containing user data must not be committed.
- Runtime temp cleanup is TTL-based (24 hours by default), best-effort, and limited to stale artifacts with the `elevenlabs_api_` project prefix; it must not target generic temporary files or arbitrary user media.
- The manifest workflow supports one user in one runtime. Parallel notebooks or tabs are not an accepted concurrency model.
- The Colab launcher executes repository code from `GITHUB_REF`; only trusted reviewed refs may be used, and a reviewed commit SHA is preferred for reproducible runs.
- Long-media behavior and manifest behavior remain Colab baseline capabilities for parity analysis, not automatically proven Studio capabilities.

Realtime Colab is a separate experimental validation path. Its current runbook is `docs/runbooks/realtime-colab.md`; it does not replace the stable batch Colab workflow.


## Stable Colab product contract

The stable Colab contract is product behavior, not historical implementation detail.

### Source modes

Supported batch source modes are:

- local/computer single file;
- local/computer multiple files;
- Google Drive single file;
- Google Drive folder.

Manual user segmentation is available only in one-source modes where one source can be split deterministically before transcription.

### Provider paths

- ElevenLabs `scribe_v2` is the default and primary batch provider path.
- OpenAI `gpt-4o-transcribe` is the standard OpenAI batch path.
- OpenAI `gpt-4o-transcribe-diarize` is the speaker-aware OpenAI path.

### ElevenLabs batch defaults

Current batch defaults are:

- `model_id=scribe_v2`;
- Russian selected by default, with provider auto-detection available when no runtime language code is supplied;
- `no_verbatim=false`;
- `temperature=0`;
- `tag_audio_events=false`;
- optional keyterms;
- optional speaker separation in the Colab batch path.

The Studio source-level ElevenLabs subset is more conservative: one already-materialized source for one already-leased job, synchronous `scribe_v2`, `no_verbatim=false`, `temperature=0`, `tag_audio_events=false`, `diarize=false`, no multi-channel mode, and provider auto-detection when job language is absent.

### OpenAI long-media behavior

OpenAI batch inputs are prepared as mono AAC M4A before upload. Splitting happens before the first provider request and is based on both prepared file size and prepared audio duration.

Current constraints:

- provider hard upload limit: 25 MB;
- safe per-part size target: 20 MB;
- observed hard duration boundary: 1400 seconds;
- safe per-part duration target: 1320 seconds;
- diarization/chunk merging remains a quality-risk area because speaker labels and segment boundaries may be inconsistent across chunks.

### Manual segmentation

Manual segmentation:

- is available only in one-source modes;
- runs before provider transcription;
- creates one temporary audio input per user segment;
- preserves the selected provider request/payload contract for each segment;
- may allow OpenAI technical splitting inside an OpenAI segment;
- creates one intended Google Doc output per segment unless manifest/docs skip protection determines that the output already exists;
- uses deterministic segment order and unique user-facing labels/titles.

### Output, manifest, and analytics

- The primary product artifact is a Google Docs transcript.
- The current transcript document standard is `transcript_doc_v1.2`.
- Colab manifest state remains the authority for progress, skip protection, and source/document synchronization.
- Re-running a controlled batch must not repeat paid transcription without a manifest/source/settings reason.
- The Drive workspace is `VoiceOps Workspace/`; legacy `_transcription_state` history must not be deleted before reconciliation.
- Analytics JSONL is best-effort aggregate evidence and must not include transcript body, secrets, raw provider payloads, raw Google/Drive payloads, Google Docs body content, raw Drive URLs, or full local paths.
- New structured Google Docs output must use transcript text and provider/model/language/speaker/timestamp metadata already available in memory. It must not expose source filename/source mode in the visible metadata block, create mirrored Markdown output, or make extra provider/LLM/Docs readback calls only for formatting.

### Colab maintenance workflows

Existing Colab maintenance workflows are explicit operator actions, not new transcription runs:

- Existing Google Docs transcripts may be standardized to `transcript_doc_v1.2` through a selected-folder workflow that defaults to dry-run and separates selected-folder scan counters from apply-impact counters. Explicit apply may rewrite only the same selected Google Doc in place; it must not process PDFs/non-Google-Docs, create new Docs or mirrored artifacts, mutate manifest entries, call STT/provider/LLM APIs, or print document body text. The older source-matching standardization path is legacy/internal, not the primary maintenance path.
- Existing manifest records may be reconciled or refreshed through a schema-only workflow that defaults to read-only dry-run and separates selected-folder results from global manifest reference statistics. It may read a Google Doc only to classify transcript structure, and apply may persist operational document/source metadata, source processing state, and classification metadata, never transcript or document body text. `standard_check` stores only target/detected standard, status, checked-at time, and checker version.
- Manifest maintenance must not mutate Google Docs, create Docs, call STT/provider/LLM APIs, or register a new transcription output. Timestamped backups created during old-schema migration contain sensitive operational metadata and require the same access care as the active manifest.
- Speaker-project rename is a manual post-transcription workflow that maps `Speaker N` or provider speaker labels to project speaker names.
- Speaker-project rename does not perform voice identification, speaker verification, biometric matching, voiceprint extraction, embeddings, or automatic identity assignment from voice.
- The speaker roster is runtime Colab state normalized by the speaker-project helpers and contains only safe project/speaker display data, not transcript samples or voice data.

## Studio PWA current source-level state

Studio PWA is in development. It must not be described as only record-only, because the repository already contains source-level processing foundations.

Source currently present in the repository includes:

- authentication, sessions, and account boundaries;
- projects and sources;
- encrypted BYOK provider credentials;
- Google OAuth/Drive integration and safe Drive metadata/folder selection;
- persisted batch/job records and source-to-output-destination relations;
- job lifecycle, claim, lease, and readiness foundations;
- a dedicated worker entrypoint and Compose source wiring;
- processing-time source availability/materialization boundaries;
- processing prerequisites and owner-scoped credential/output checks;
- ElevenLabs provider execution path;
- Google Docs output creation path;
- safe output persistence and browser-safe output read path;
- diagnostics, diagnostic debug sessions, migrations, and tests.
- a deterministic API-to-worker processing E2E scenario that uses real PostgreSQL/Redis state and controlled in-process storage, ElevenLabs, and Google boundaries.

The processing E2E scenario is repository validation, not production evidence. It does not exercise a real browser, provider account, Google account, deployed worker, or public host, and it must not be used to claim exactly-once behavior outside its controlled fakes.

The current Alembic migration head in the repository is `0015_user_source_retention` under `apps/studio-api/alembic/versions/`.

## Studio production status and remaining capabilities

Studio processing is **not yet confirmed production-live**. Source-level implementation and CI do not prove production deployment, worker image parity, provider execution, Google Docs creation, or a successful controlled canary.

Source-complete capabilities that still lack current production rollout evidence:

- official worker lifecycle operations;
- bounded PostgreSQL-backed lease heartbeat;
- explicit output reconciliation for uncertain Google Docs side effects;
- safe stage-specific retry and expired-lease recovery;
- safe source deletion, retention, and local-object cleanup.

Unfinished or unproven delivery capabilities:

- production migration/deployment and worker rollout validation for the intended revision;
- controlled end-to-end canary after the latest fix with exactly one persisted output;
- browser-level automated E2E coverage for the authenticated preparation and job-result workflow;
- OpenAI PWA processing parity;
- long-media splitting parity with Colab;
- Studio manifest authority/update behavior;
- golden Colab/PWA parity validation;
- multi-worker production validation.

The Studio PWA may render implemented source-level output metadata for explicitly opened jobs, but that does not prove production-live processing or exactly-once Google document creation.

## Durable product and safety rules

### Authentication, ownership, and privacy

- Studio data is owner-scoped. Users may access only their own projects, sources, jobs, credentials, Google connections, diagnostics, and outputs.
- User-facing project segment labels must be unique case-insensitively within their owner/project scope.
- Provider credentials are BYOK, encrypted at rest, decrypted only server-side for authorized processing, and never returned to browsers.
- Google OAuth refresh tokens are encrypted server-side and separated from provider credential boundaries.
- Browser APIs may return only fields explicitly authorized by their endpoint contract. Ordinary metadata/read APIs must not return OAuth codes/tokens, provider secrets, raw Google payloads, owners/permissions, source bytes, transcript bodies, document bodies, object keys, private paths, presigned URLs, stack traces, or raw external responses. Authentication values and the browser-bound integration capabilities below are narrow exceptions, not generally safe metadata.
- Project title/description updates and Google output-folder selection are separate authorities. Generic project PATCH accepts only title/description and rejects output-folder IDs, URLs, names, and unknown fields; output folders may be bound only through the server-verified Google Picker route.
- Browser project/job DTOs expose only UI-required public fields. Project payloads omit the internal owner ID, and job payloads omit the selected provider-credential ID; request-side credential selection remains an authenticated write authority and server-side job state retains the resolved ID.
- An otherwise unhandled API exception returns only the fixed safe 500 body plus sanitized request/correlation headers. The server log records only those sanitized IDs and an endpoint group. If authentication already established an owner, one owner-scoped `API_UNHANDLED_EXCEPTION` diagnostic may persist only the endpoint group and `5xx` category; exception text, stack traces, raw paths, query strings, request bodies, and headers are forbidden.
- Google Drive source identity and metadata must be fetched and validated server-side under the current owner connection before a source is persisted. The multi-file Google Picker route is canonical; the deprecated single-file compatibility route must ignore browser-supplied filename, MIME type, size, and URL and apply the same server-side source policy.
- The authenticated read-only source-upload policy response exposes only whether local upload is enabled, the current maximum byte count, supported MIME prefixes, and exact MIME types; it is `no-store` and never exposes storage identity or credentials. The PWA must runtime-validate this response and keep local file selection disabled until a valid enabled policy is available. Maximum upload size remains deployment configuration, while account settings control only retained-source duration; initiation, object-head verification, and processing-time checks remain authoritative server-side.

Browser-bound integration capabilities are limited to three flows:

- Google OAuth start may return one authorization URL containing a hashed-at-rest, single-use, expiring state value. The authenticated same-origin CSRF-protected response is `no-store`; the callback never reflects the code, state, tokens, raw Google error, or account data into its browser redirect.
- Google Picker session may return one current owner access token only to an authenticated same-origin CSRF-protected request. The connection scope set must be limited to `openid`, email identity, and `drive.file`; incremental previously granted scopes are not requested. The response is `no-store`, the PWA passes the token directly to Picker with an exact origin and clears its own reference, and every selected ID/metadata value is revalidated server-side before persistence. Refresh and ID tokens remain server-only.
- Local-upload initiation may return one PUT-only presigned URL for the exact opaque source object key and content type, with a TTL from 60 through 900 seconds. The authenticated owner-scoped same-origin CSRF-protected response is `no-store`; the URL/key is never persisted in browser storage, rendered, logged, diagnosed, or returned by later metadata APIs. The PWA sends no cookies or referrer, refuses redirects, and the API requires a complete object-storage head plus exact normalized MIME and byte-size equality with the initiation contract before marking the source uploaded. Missing, unsupported, oversized, or mismatched metadata leaves the source pending so the existing expiry/cleanup lifecycle remains authoritative.

No other endpoint may expose these capabilities. The service worker must not runtime-cache API responses or upload requests.

The public Studio host must enforce one browser security-header policy across the PWA and `/api`: CSP with no script wildcard or `unsafe-eval`, Google Picker script/frame allowlists, self-only framing denial, MIME-sniffing denial, no-referrer, restrictive permissions, and HSTS. Because the S3/R2-compatible upload origin is runtime-configured, `connect-src` may temporarily permit HTTPS generally; narrowing it to explicit production storage origins is preferred when that deployment contract becomes fixed. Header source configuration is not proof that the live TLS/nginx boundary has applied it.

### Sources and processing prerequisites

- Source metadata readiness is not proof that source bytes remain accessible.
- Processing must re-check source availability immediately before external provider execution.
- Google Drive sources require current owner-scoped access, existence, and supported download/export mode.
- Local-upload sources require private server-side storage availability. Object keys remain server-only; a presigned URL may cross the browser boundary only in the bounded initiation capability above and must not appear in subsequent source/job/output payloads.
- Processing must re-check lifecycle, lease ownership/generation, cancellation, project/source relation, credential availability, and output destination authorization at stage boundaries.

### Jobs, leases, and terminal states

- Job claim/lease fields are internal server-side fencing metadata and must not be exposed to browsers.
- Claiming work must be atomic and owner/generation fenced.
- Lease expiry comparisons use normalized UTC semantics; equality at the expiry instant means expired.
- Each prepared batch row owns its selected output destination.
- The idempotent batch route is the canonical job-creation authority. The deprecated compatibility route may create a job only when the project already has an output-folder selection and the owner has an active, non-deleted ElevenLabs credential; it must reject OpenAI, foreign, inactive, deleted, ambiguous, or missing credential authority.
- Job creation copies that destination into a per-job output-folder snapshot.
- Processing uses the job snapshot as the runtime output authority.
- Later changes to a mutable project default output folder must not redirect an existing queued, processing, failed, cancelled, or completed job.
- Cancellation before processing is terminal and safe.
- Cancellation, lease loss, or lease heartbeat failure during processing must fail closed and must not automatically duplicate provider calls or Google document creation.
- Terminal completion requires persisted safe output evidence for every non-skipped relation.
- Output-side-effect uncertainty must preserve evidence and require reconciliation rather than automatic duplicate output creation or deletion.

### Provider and output boundaries

- ElevenLabs is the implemented source-level Studio provider path.
- OpenAI provider parity in Studio remains unfinished until separately implemented and validated.
- Provider transcript content is ephemeral server-side processing data unless explicitly persisted by an approved product rule; current browser-safe output APIs must not expose transcript/document body text.
- Google Docs output uses safe owner-scoped document reference metadata only. Exactly-once Google document creation is not claimed.

### CI/CD and deployment

- CI/CD, deployment, migrations, backups, rollback, runtime config, and stateful-service safety are governed by `docs/ci-cd-rules.md`.
- Standard CD must not run migrations, deploy workers, perform cleanup/hardening, recreate stateful services, or claim processing production readiness.
- Manual rollout evidence must keep source-done, CI-verified, deployed, migration-applied, worker-running, and production-live states separate.

## Acceptance criteria for Studio processing readiness

Studio processing can be considered production-live only after all of the following have factual operator evidence:

1. Repository source and CI are verified for the intended commit.
2. Production database migration head matches repository head `0015_user_source_retention` where required.
3. Web/API deployment identity and health are verified.
4. Exactly one intended worker instance is deployed from the intended image and shown idle before the smoke.
5. One controlled operator-approved job uses one small supported source, one owner-scoped ElevenLabs BYOK credential, one valid Google connection, and one writable output folder.
6. The job reaches a terminal successful state or a normalized safe failure without unsafe evidence.
7. Success shows exactly one persisted output entry and one validated Google Docs output in the selected folder.
8. Evidence contains no secrets, transcript bodies, source bytes, document IDs/URLs, raw provider responses, raw Google responses, or private account data.
9. No duplicate output, uncertain side effect, lease ambiguity, or manual retry occurred.

## Backlog authority

Current delivery sequencing is in `docs/delivery-plan.md`. Product backlog items that remain durable:

- `PWA-PROCESSING-ROLLOUT-01A` — operator validation for fixed worker rollout and one controlled end-to-end canary.
- `PWA-LEGACY-AUTHORITY-01` — remove or formally mark legacy deployment/runtime paths after review.
- `PWA-E2E-FOUNDATION-01B` — extend the source-level API/worker processing foundation through the authenticated browser workflow without replacing the production canary requirement.
- OpenAI processing parity, long-media parity, manifest behavior, and golden Colab/PWA parity validation.

Source-complete delivery items remain listed for traceability and still require applicable rollout evidence:

- `PWA-WORKER-OPS-01` — official worker deployable component with health, identity, pause/drain/resume, and rollback contract.
- `PWA-OUTPUT-RECONCILIATION-01` — reconcile uncertain or missing Google Docs output evidence without unsafe duplication.
- `PWA-LEASE-HEARTBEAT-01` — source-complete PostgreSQL-backed bounded heartbeat for long source/provider and Google output calls; rollout evidence remains separate.
- `PWA-RETRY-RECOVERY-01` — safe stage-specific retry and recovery design.
- `PWA-SOURCE-DELETION-01` — source deletion and retention behavior.
- `PWA-UPLOAD-RETENTION-PREFERENCES-02` — server-authoritative per-user retention choices and PWA settings UX for future verified local uploads.

## Supporting documents

- `README.md` — repository entrypoint.
- `AGENTS.md` and `docs/ai-coding-workflow.md` — agent/workflow rules.
- `docs/delivery-plan.md` — current delivery dashboard.
- `docs/delivery-plan-archive.md` — historical archive only.
- `docs/architecture.md` — architecture and runtime map.
- `docs/studio-processing-contract.md` — current Studio processing rules.
- `docs/ci-cd-rules.md` — deployment and stateful-service safety.
- `docs/runbooks/studio-platform-ops.md` — Studio operations and rollout runbook.
- `docs/runbooks/validation.md` — validation commands/checklists.
- `docs/runbooks/realtime-colab.md` — experimental realtime Colab validation.

## Studio worker deployment operations boundary

`PWA-WORKER-OPS-01` permits explicit manual-only worker deployment after the existing worker is absent or drained/stopped. The worker deploy path must verify image/commit identity, PostgreSQL health, database revision compatibility with the worker image Alembic head, and Docker worker health before reporting source-level deploy success.

This does not permit automatic worker deployment on push, migrations from standard CD, automatic rollback, retries, reconciliation, or production-live claims without a separate controlled canary. Worker deploy success, healthy idle state, and image identity evidence are operational prerequisites only, not proof of production processing.

## Studio output reconciliation source contract

`PWA-OUTPUT-RECONCILIATION-01` is implemented at source level to reconcile uncertain Google Docs output side effects. Before the first irreversible Google Docs create request, Studio prepares a durable PostgreSQL reconciliation case with an opaque random token, the job output-folder snapshot, deterministic document metadata, and character count. The token is written only to Google Drive `appProperties` under an internal key and must not contain owner, project, job, source, filename, email, title, or other domain identifiers.

Reconciliation is not processing retry, not provider retry, not automatic recovery, and not an exactly-once Google Docs creation claim. PostgreSQL remains the durable authority for output rows and completion. If Google creation or output persistence becomes uncertain, the case remains unresolved and the eligible processing job may fail with `output_reconciliation_required`; zero Drive matches do not permit a second document creation, and multiple or conflicting matches block resolution fail-closed.

Owner-scoped reconciliation is available only through an explicit Studio API/PWA action. It queries Google Drive by the exact opaque appProperty token plus the exact persisted job output-folder snapshot and `trashed = false`; it verifies Google Doc MIME type, exact parent folder, exact appProperty, safe Google web URL, relation/job ownership, and uniqueness before persisting missing output evidence. It never calls the transcription provider, never creates or deletes Google Docs, never reads or exports document body, never uses title-only/time-only/folder-wide guessing, and never returns the token, document ID, folder ID, raw Google payloads, transcript body, or document body to browsers.

After successful reconciliation persistence, cancelled jobs remain cancelled, actively queued/processing jobs are not reconciled, attempt counts and leases are not recreated or reset, unrelated failed jobs are not completed, and only a failed job with `error_code=output_reconciliation_required` can become completed when all non-skipped relations have persisted output coverage.

### Studio source deletion, retention, and cleanup

Studio source removal is logical, owner-scoped, and durable in PostgreSQL. Source rows are never hard-deleted by the source lifecycle; display metadata, job-source relations, historical jobs, persisted outputs, attempt evidence, and reconciliation cases remain available for history. Google Drive source removal only removes the Studio reference: Studio must not delete, trash, update, or otherwise mutate the external Drive file, and Google Docs outputs are not removed by this flow.

Local-upload bytes use an asynchronous, idempotent cleanup lifecycle stored on `sources`. S3/R2 delete is allowed only after durable logical deletion or retention expiry state exists. A missing object is treated as successful physical cleanup; storage failures do not roll back logical deletion and are retried through durable cleanup state. Object storage identity is cleared only after successful cleanup finalization; browser payloads must not expose bucket/object keys, cleanup owners, cleanup generations, cleanup leases, cleanup attempt counts, cleanup errors, or internal job references.

Pending local uploads expire one hour after initiation by default. Successful completion resets `expires_at` from that pending-upload deadline according to the authenticated owner's durable account preference. The supported choices are one hour, 24 hours (default), three days, seven days, and 30 days after verified completion. The setting is persisted in PostgreSQL, is changed through the owner-scoped CSRF-protected account-preferences API/PWA settings surface, applies only to future verified completions, and is never controlled by browser-local storage. The presigned PUT capability remains independently bounded to at most 15 minutes. The PWA must surface the exact retained-source expiry for a completed local source. This retention policy does not apply to referenced Google Drive inputs or Google Docs outputs.

Local sources expire when `expires_at <= now`. Expiry blocks new jobs, claims, explicit retries, expired-lease recovery, upload completion, and processing-time source access. Retention expiry may mark a local source `expired` with `delete_reason=retention_expired` without setting `deleted_at`, so unavailable metadata may remain visible. A referencing `processing` job defers physical cleanup until terminal/recovered state; cleanup never calls the provider, Google Drive, Google Docs, output reconciliation, or attempt-ledger mutation. Completed, cancelled, non-retryable failed, provider-uncertain/result-lost, and unresolved-reconciliation history does not block user source deletion; queued, processing, and actually retryable failed jobs do block deletion.

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

Realtime Colab is a separate experimental validation path. Its current runbook is `docs/runbooks/realtime-colab.md`; it does not replace the stable batch Colab workflow. Studio is expected to bring this capability into a separate tab on the existing PWA transcription page through workstream `PWA-REALTIME-TRANSCRIPTION-01`. That future tab must preserve batch behavior and must not inherit production-readiness claims from the experimental Colab prototype.


## Stable Colab product contract

The stable Colab contract is product behavior, not historical implementation detail.

### Source modes

Supported batch source modes are:

- local/computer single file;
- local/computer multiple files;
- Google Drive single file;
- Google Drive multiple files;
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
- typed Russian-default/auto-detect language and ElevenLabs diarization options;
- server-side video audio extraction plus deterministic long-media split/merge;
- validated local and Google Picker multi-file intake with batch preflight;
- staged browser-safe progress and aggregate transcription analytics;
- ElevenLabs provider execution and Google Docs `transcript_doc_v1.2` output paths;
- accepted-output/provider-attempt duplicate authority and output reconciliation;
- independent existing-document standardization and `Манифест Studio` services, routes, UI state, and safe results; each operation supports either one explicitly selected Google Doc or one bounded recursive folder tree under a separate server-only Google grant;
- safe output persistence and browser-safe output read path;
- diagnostics, diagnostic debug sessions, retry/recovery, source retention/cleanup, migrations, and tests;
- a deterministic API-to-worker processing E2E scenario that uses real PostgreSQL/Redis state and controlled in-process storage, ElevenLabs, and Google boundaries;
- an authenticated Chromium scenario against isolated FastAPI/PostgreSQL/Redis state for principal preparation, job-result, progress, cancellation, retry, reconciliation, diagnostics, and fail-closed catalog UI boundaries.

These controlled E2E scenarios are repository validation, not production evidence. The API-to-worker scenario does not exercise a real browser, provider account, Google account, deployed worker, or public host. The authenticated browser scenario exercises real Chromium but still uses isolated services and controlled external boundaries. Neither scenario may be used to claim production provider/Google behavior or exactly-once output creation.

The current branch candidate Alembic head is `0018_job_part_progress` under `apps/studio-api/alembic/versions/`; operator-verified production PostgreSQL and merged `main` remain at `0017_google_maintenance_oauth`. The production `0017` rollout used a verified tagged backup and separately verified migration/API health. Candidate `0018`, its API/worker consumers, and the new progress UI require their own protected rollout evidence.

## Studio PWA selected transcription scope

Studio targets selected product parity, not a literal copy of every Colab control or maintenance helper. The current small-source production rollout remains a separate baseline gate; completing that rollout does not claim that the selected feature scope below is already implemented.

Required Studio transcription capabilities:

- ElevenLabs `scribe_v2` remains the current PWA provider path.
- Job preparation must offer Russian by default and provider auto-detection as the alternative language mode. The selected mode must use a typed validated job contract and reach the worker/provider request.
- ElevenLabs speaker separation is required for PWA v1. A diarized result must produce deterministic `Speaker N` transcript blocks and `Speakers: yes` document metadata without exposing transcript text through browser metadata APIs.
- Video sources must have a server-side audio-extraction/preparation path before provider upload.
- Long ElevenLabs inputs must be prepared and automatically split by explicit safe size/duration policy before the first provider call, processed in deterministic part order, and merged without silently losing or duplicating boundary text. Provider and Google output timeouts must be compatible with the documented long-media policy.
- Existing local multi-file intake and Google Picker multi-file intake must be validated end to end. Google Drive folder ingestion and recursive source traversal are not part of ordinary transcription intake; this does not exclude the separately bounded recursive existing-document maintenance workflow.
- Before job creation, an explicit preflight must show safe source metadata, size and duration where available, selected language, speaker-separation mode, output destinations, existing-result matches, and the planned process/skip outcome. It must not expose source bytes, private storage identity, tokens, transcript bodies, or raw Google/provider payloads.
- The PWA must show a user-facing staged progress pipeline, including applicable preparation, audio extraction, splitting, provider processing, part merge, and Google Docs output stages. Internal lease/claim authority remains server-only.
- A newly terminal job must remain visible with its safe result until the user explicitly dismisses it into history. Displayed percentage must advance only from confirmed server checkpoints. For multi-part provider work, durable bounded completed/total part counters may contribute fractional progress inside the provider stage; elapsed time must never fabricate progress. Transcript content, raw provider payloads, private source/storage identity, failure detail, and lease authority remain forbidden in the progress DTO.
- New Google Docs transcripts must follow `transcript_doc_v1.2`, including its structured metadata and readable paragraph normalization.
- User-facing aggregate analytics may report safe counts, outcomes, selected provider/model/options, and stage durations. It must not contain transcript/document bodies, secrets, private source paths, raw external payloads, or private Google identifiers/URLs.

Existing-document standardization, catalog import, and duplicate protection are related but separate product workstreams:

- Studio must present existing-document standardization and catalog import as two distinct user-facing operations, not one combined migration action. User-facing copy calls catalog import `Манифест Studio`: it means the PostgreSQL-backed Studio metadata catalog, not a separate manifest file. Each operation has its own target-mode dropdown, selected target, non-mutating dry-run, safe result, and explicit apply confirmation. The available modes are `folder_tree` for one root folder plus all descendants and `single_document` for exactly one native Google Doc. A selection, dry-run, or confirmation for one operation must never authorize the other.
- The existing identity/Picker connection remains limited to `openid`, email identity, and `drive.file`. Both maintenance target modes use a separately consented, separately stored, server-only Google connection limited to identity scopes plus `drive.metadata.readonly` and `documents`. Its access or refresh tokens must never cross the browser boundary. The maintenance Google subject must exactly match the active Picker connection before either operation can scan or mutate data.
- In `folder_tree` mode each operation recursively scans the selected root and all descendants under explicit item, page, and folder bounds. The scan must fail closed on incomplete search, repeated page tokens, duplicate identities, malformed metadata, cycles, or exceeded limits. It processes only native Google Docs, counts nested folders and skipped non-Docs, and never treats folder selection as authority outside the selected subtree.
- Before either dry-run or apply, the server must use the separate maintenance connection to revalidate the exact selected Google Doc or rebuild the selected recursive subtree rather than trust Picker metadata or a saved preview. The request must contain `selection_mode` and exactly one matching `folder_id` or `document_id`; it must never contain a browser-supplied document list. Documents already at the operation's target state are idempotently skipped. Documents that are inaccessible, unreadable, structurally unsafe, empty, conflicting, or otherwise ineligible are reported as blocked without aborting eligible siblings in folder mode; connection-wide authentication, rate-limit, availability, malformed-scan, or limit failures abort the operation before mutation.
- Existing-document standardization may read selected document content transiently to classify and normalize it. Explicit standardization apply may rewrite only eligible non-current Google Docs inside the freshly revalidated target in place to `transcript_doc_v1.2`, including readable paragraph normalization. Current documents must be skipped. It must not create or update Studio catalog entries, persist source/job state, or call a transcription provider or LLM. A safe owner-scoped audit event is allowed.
- Catalog import may read selected document content transiently to classify its standard and may persist only the durable metadata needed for the Studio catalog and duplicate decisions. Catalog-import apply adds or refreshes only eligible current-standard documents from the freshly revalidated target and skips catalog entries already at the target state. It must not create, rewrite, standardize, move, or delete any Google Doc. Conflicting source/settings authority must remain blocked. Missing source/settings authority may be persisted only as explicit absent/indeterminate metadata, must never be inferred, and cannot support an exact duplicate match. A safe owner-scoped audit event is allowed.
- Neither operation may copy document/transcript bodies into browser payloads, logs, diagnostics, or long-term Studio storage.
- Studio must prevent accidental repeated paid transcription across separate job-creation requests when the same source and effective transcription settings already have accepted output evidence. A new explicit user decision is required when an existing-result conflict is found.
- Conflict handling must be designed together with the imported catalog and support explicit safe user choice rather than implicit overwrite or automatic provider retry. Exact matching, authority, and UX rules require a focused design before implementation.
- A continuously refreshed PWA transcript catalog backed by Google Drive is desired but deferred to backlog. Its synchronization flow, matching rules, refresh triggers, permissions, and system-of-record boundary must be designed before implementation; bounded maintenance operations must not silently become continuous synchronization.

Explicitly deferred or excluded from the current selected scope:

- keyterms are deferred;
- OpenAI job processing is deferred; the ability to store an OpenAI credential must not be presented as proof that OpenAI transcription is available;
- manual post-transcription speaker renaming is deferred;
- arbitrary user-directed media cutting and multi-file media concatenation remain deferred. The selected Studio scope now includes one narrow manual two-project split: before launch, one source may be divided at one whole-second boundary into `[start, boundary)` and `[boundary, end]`, producing two independent jobs and Google Docs in two different explicitly verified folders. The boundary and destinations are immutable after creation;
- Google Drive folder ingestion and recursive traversal for new transcription sources are excluded in favor of validating explicit multi-file selection. Recursive existing-document maintenance remains a separate operation and does not create sources or jobs.

Selected-scope completion requires source and applicable browser/service-backed evidence for the typed language and diarization options, multi-file intake, video preparation, long-media split/merge, safe preflight/progress, independently confirmed standardization and catalog import, duplicate protection, and aggregate analytics. The existing one-small-source production canary remains necessary but does not prove these additional capabilities.

## Studio production status and remaining capabilities

The bounded small-source Studio processing path is production-live with operator evidence: its original controlled canary ran against the `0015_user_source_retention` baseline with verified web/API identities, exactly one healthy worker from the commit-specific `900bf5b` image, and one operator-approved Drive source producing exactly one persisted `google_docs_transcript` and one non-empty native Google Doc without retry. Production PostgreSQL was subsequently protected by verified tagged backups and migrated through `0017_google_maintenance_oauth`; exact-main web/API and worker deployment/status evidence now exists for `main@bd8d513`, and the operator completed another real batch transcription successfully. That later run exposed terminal progress/result continuity as a usability defect. These facts prove only the controlled gates; they do not prove every selected capability, broader workload stability, exactly-once behavior under arbitrary failures, the candidate `0018` progress path, or every maintenance outcome.

Production-evidenced baseline capabilities:

- authenticated PWA access, project/source preparation, Google Picker source/folder roles, one single-attempt local upload completion, and public security headers;
- manual-only worker lifecycle, health, image identity, and single-worker operation;
- one controlled ElevenLabs-to-Google-Docs success with exactly one persisted output;
- deployed browser-safe provider-attempt preflight authority and the source-complete heartbeat, retry/recovery, reconciliation, retention, and cleanup boundaries.

Current unproven or incomplete delivery capabilities:

- authenticated recursive-folder dry-run and separately authorized apply for each of standardization and catalog import;
- dedicated production canaries for auto-detect language, diarization, video preparation, long-media split/merge, and multi-file processing;
- continuous or accepted-output reuse/skip catalog behavior beyond the current partial source-linked duplicate authority;
- golden validation for the selected Colab/PWA behaviors rather than literal full-feature parity;
- multi-worker production validation and a retained prior worker-image rollback candidate.

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
- Google maintenance OAuth start may return a separate authorization URL only after an authenticated same-origin CSRF-protected user action. It uses a separately configured OAuth client and requests exactly identity scopes plus `drive.metadata.readonly` and `documents`; it must not use incremental authorization or share an OAuth grant with the Picker client. The callback stores only the encrypted server-side refresh capability after exact scope and Google-subject matching. Maintenance access, refresh, and ID tokens are never returned to the browser.
- Local-upload initiation may return one PUT-only presigned URL for the exact opaque source object key and content type, with a TTL from 60 through 900 seconds. The authenticated owner-scoped same-origin CSRF-protected response is `no-store`; the URL/key is never persisted in browser storage, rendered, logged, diagnosed, or returned by later metadata APIs. The PWA sends no cookies or referrer, refuses redirects, and the API requires a complete object-storage head plus exact normalized MIME and byte-size equality with the initiation contract before marking the source uploaded. Missing, unsupported, oversized, or mismatched metadata leaves the source pending so the existing expiry/cleanup lifecycle remains authoritative.

No other endpoint may expose these capabilities. The service worker must not runtime-cache API responses or upload requests.

The public Studio host must enforce one browser security-header policy across the PWA and `/api`: CSP with no script wildcard or `unsafe-eval`, Google Picker script/frame allowlists, self-only framing denial, MIME-sniffing denial, an origin-only referrer policy so Google Picker can validate its website-restricted developer key without receiving path or query data, restrictive permissions, and HSTS. The local-upload presigned PUT must continue to override that host policy with `no-referrer`. Because the S3/R2-compatible upload origin is runtime-configured, `connect-src` may temporarily permit HTTPS generally; narrowing it to explicit production storage origins is preferred when that deployment contract becomes fixed. Header source configuration is not proof that the live TLS/nginx boundary has applied it.

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

- ElevenLabs is the implemented source-level Studio provider path and the selected PWA v1 provider. Russian-default/auto-detect language selection and optional speaker separation are required additions to its typed job options.
- OpenAI processing, keyterms, manual speaker renaming, arbitrary media cutting, and concatenation remain deferred until separately designed and authorized. The separately authorized Studio two-project split is limited to one source, one whole-second boundary, two non-overlapping outputs, and two different verified folders configured before launch. Persisted credential support alone is not a processing capability.
- Video audio preparation and automatic long-media split/merge must remain server-side, bounded, deterministic, and covered by explicit temporary-artifact cleanup. The browser must not become the media-processing authority.
- Provider transcript content is ephemeral server-side processing data unless explicitly persisted by an approved product rule; current browser-safe output APIs must not expose transcript/document body text.
- Google Docs output uses safe owner-scoped document reference metadata only. Exactly-once Google document creation is not claimed. Existing-document standardization and catalog import are explicit maintenance actions, not ordinary job execution. Standardization owns only in-place Google Doc normalization; catalog import owns only PostgreSQL catalog metadata persistence.
- Cross-run duplicate protection must use durable Studio authority for normalized source identity, effective transcription settings, and accepted output evidence. It must not copy the Colab single-runtime manifest as Studio's concurrency authority.

### CI/CD and deployment

- CI/CD, deployment, migrations, backups, rollback, runtime config, and stateful-service safety are governed by `docs/ci-cd-rules.md`.
- Standard CD must not run migrations, deploy workers, perform cleanup/hardening, recreate stateful services, or claim processing production readiness.
- Manual rollout evidence must keep source-done, CI-verified, deployed, migration-applied, worker-running, and production-live states separate.

## Acceptance criteria for Studio transcript maintenance

Existing-document standardization is ready only when:

1. The operation exposes an independent target-mode dropdown. The user selects either one root folder plus descendants (`folder_tree`) or exactly one native Google Doc (`single_document`) through Picker. The request contains `selection_mode` and exactly one matching `folder_id` or `document_id`, never both and never a browser-supplied document list.
2. The maintenance grant uses exactly identity scopes plus `drive.metadata.readonly` and `documents`, is stored separately from the primary `drive.file` grant, never crosses the browser boundary, and resolves to the same Google subject.
3. Dry-run independently revalidates the exact selected document or classifies native Google Docs across the selected root and descendants. Folder mode counts nested folders and skipped non-Docs; both modes skip current documents and perform no Google or PostgreSQL mutation.
4. Apply requires a fresh explicit confirmation and a fresh server revalidation of the same mode and target. Per-document inaccessible, unreadable, empty, unsafe, conflicting, or unsupported candidates are blocked without aborting safe siblings in folder mode; global auth, rate-limit, availability, timeout, malformed-scan, cycle, or limit failures abort.
5. Apply may update only eligible non-current Google Docs inside the revalidated target in place and creates no catalog row or source/job state; a safe owner-scoped audit event is allowed.
6. Browser/log evidence contains only safe names, statuses, actions, reasons, and aggregate counts; it contains no document IDs/URLs, bodies, tokens, Google subjects/emails, or raw Google payloads.

Catalog import is ready only when:

1. It owns a separate target-mode dropdown, selected target, dry-run result, and apply confirmation. The request contains `selection_mode` and exactly one matching `folder_id` or `document_id`, never both and never a browser-supplied document list.
2. It uses the same separately stored server-only maintenance scope boundary and same-account check as standardization, while keeping its selection, preview, confirmation, and result authority independent.
3. Dry-run independently revalidates the exact selected document or classifies native Google Docs across the selected root and descendants, selects only eligible current-standard documents, counts already-current/already-cataloged and blocked candidates, and performs no Google or PostgreSQL mutation.
4. Apply performs a fresh server revalidation of the same mode and target, persists only owner-scoped catalog/duplicate-authority metadata, skips entries already at target state, and never mutates Google Docs.
5. Conflicting, unreadable, inaccessible, out-of-target, duplicate, changed, or structurally unsafe documents fail closed with safe per-document outcomes unless a global scan/connection boundary requires abort. Missing source/settings authority remains explicitly absent/indeterminate, is never inferred, and cannot support an exact duplicate match.
6. A standardization preview or confirmation cannot authorize catalog import, and a catalog-import preview or confirmation cannot authorize standardization.

## Acceptance criteria for Studio processing readiness

Studio processing can be considered production-live only after all of the following have factual operator evidence:

1. Repository source and CI are verified for the intended commit.
2. Production database migration head matches the intended repository head where required. Production currently reports `0017_google_maintenance_oauth`; the progress candidate requires the direct additive successor `0018_job_part_progress`, while the bounded original processing canary ran against the older `0015_user_source_retention` baseline.
3. Web/API deployment identity and health are verified.
4. Exactly one intended worker instance is deployed from the intended image and shown idle before the smoke.
5. One controlled operator-approved job uses one small supported source, one owner-scoped ElevenLabs BYOK credential, one valid Google connection, and one writable output folder.
6. The job reaches a terminal successful state or a normalized safe failure without unsafe evidence.
7. Success shows exactly one persisted output entry and one validated Google Docs output in the selected folder.
8. Evidence contains no secrets, transcript bodies, source bytes, document IDs/URLs, raw provider responses, raw Google responses, or private account data.
9. No duplicate output, uncertain side effect, lease ambiguity, or manual retry occurred.

## Backlog authority

Current delivery sequencing is in `docs/delivery-plan.md`. The durable workstream list below records product authority; status annotations are factual delivery evidence, not changes to scope:

- `PWA-PROCESSING-ROLLOUT-01A` — bounded single-worker/small-source production rollout and controlled exactly-one-output canary are complete; broader workload evidence remains separate.
- `PWA-LEGACY-AUTHORITY-01` — pending external-consumer review before the two deprecated compatibility APIs are removed or assigned an explicit support/removal contract.
- `PWA-E2E-FOUNDATION-01B` — authenticated Chromium foundation is source-complete and exact-main browser CI is green at `5ab3b5f`; real provider/Google production evidence remains separate.
- `PWA-TRANSCRIPTION-OPTIONS-01` — typed Russian-default/auto-detect language selection and required ElevenLabs speaker separation are source-complete across PWA, API, worker, and Google Docs output; dedicated live canaries remain.
- `PWA-MEDIA-PREPARATION-01` — server-side video audio extraction plus deterministic long-media size/duration split and merge are source-complete; dedicated live canaries remain.
- `PWA-MULTI-SOURCE-VALIDATION-01` — local and Google Picker multi-file intake is source-complete with automated evidence; broader production processing validation remains, and folder/recursive ingestion is a non-goal.
- `PWA-PREFLIGHT-PROGRESS-01` — safe preflight and staged progress are source-complete, with the original provider-attempt authority deployed.
- `PWA-JOB-PROGRESS-02` — active branch work keeps a newly terminal job/result visible until explicit dismissal and adds confirmed checkpoint plus durable prepared-part progress through `0018_job_part_progress`. Source validation may be complete on a branch without implying merge, migration, API/worker deployment, or production UI evidence.
- `PWA-TRANSCRIPT-CATALOG-MIGRATION-01` — superseded by explicit product decision; the old combined standardize-and-import action is no longer the target contract and its compatibility routes fail closed.
- `PWA-TRANSCRIPT-STANDARDIZATION-01` — independent `folder_tree` or `single_document` dry-run/apply for in-place `transcript_doc_v1.2` normalization, with no catalog persistence. Source, exact-main CI, migration `0017`, and maintenance OAuth rollout are present; the complete production target-mode dry-run/apply matrix remains.
- `PWA-TRANSCRIPT-CATALOG-IMPORT-01` — independent `folder_tree` or `single_document` dry-run/apply for minimal source-linked catalog and duplicate-authority metadata, with no Google Doc mutation. Source, durable rediscovery, exact-main CI, migration `0017`, and maintenance OAuth rollout are present; the complete production target-mode dry-run/apply matrix remains.
- `PWA-TRANSCRIPTION-ANALYTICS-01` — safe aggregate outcomes and stage-duration analytics are source-complete; broader production evidence remains.
- `PWA-TRANSCRIPT-CATALOG-SYNC-01` — deferred design for a Google Drive-backed continuously refreshed PWA catalog and its system-of-record boundary; no continuous sync is implemented.
- `PWA-REALTIME-TRANSCRIPTION-01` — planned separate tab on the existing Studio transcription page, derived from the experimental Colab realtime contour. The first accepted slice requires a server-issued single-use realtime capability, browser microphone capture, safe partial/committed presentation, deterministic Stop/permission handling, and no batch-job, Google Docs, catalog, analytics, or transcript-body persistence side effects.
- OpenAI processing, keyterms, manual speaker rename, manual cutting/concatenation, and Drive folder/recursive intake remain deferred or excluded as defined above.

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

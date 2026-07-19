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

The current Alembic migration head in the repository is `0011_diagnostic_debug_sessions` under `apps/studio-api/alembic/versions/`.

## Studio production status and unfinished capabilities

Studio processing is **not yet confirmed production-live**. Source-level implementation and CI do not prove production deployment, worker image parity, provider execution, Google Docs creation, or a successful controlled canary.

Unfinished or unproven capabilities:

- production worker rollout validation;
- controlled end-to-end canary after the latest fix with exactly one persisted output;
- automated output reconciliation for uncertain Google Docs side effects;
- safe stage-specific retries/recovery;
- lease renewal/heartbeat during long external materialization/provider/output calls;
- OpenAI PWA processing parity;
- long-media splitting parity with Colab;
- Studio manifest authority/update behavior;
- golden Colab/PWA parity validation;
- multi-worker production validation and official worker operations contract.

The Studio PWA may render implemented source-level output metadata for explicitly opened jobs, but that does not prove production-live processing or exactly-once Google document creation.

## Durable product and safety rules

### Authentication, ownership, and privacy

- Studio data is owner-scoped. Users may access only their own projects, sources, jobs, credentials, Google connections, diagnostics, and outputs.
- User-facing project segment labels must be unique case-insensitively within their owner/project scope.
- Provider credentials are BYOK, encrypted at rest, decrypted only server-side for authorized processing, and never returned to browsers.
- Google OAuth refresh tokens are encrypted server-side and separated from provider credential boundaries.
- Browser APIs may return only normalized safe metadata. They must not return raw OAuth URLs/codes/tokens, provider secrets, raw Google payloads, owners/permissions, source bytes, transcript bodies, document bodies, object keys, private paths, presigned URLs, stack traces, or raw external responses.

### Sources and processing prerequisites

- Source metadata readiness is not proof that source bytes remain accessible.
- Processing must re-check source availability immediately before external provider execution.
- Google Drive sources require current owner-scoped access, existence, and supported download/export mode.
- Local-upload sources require private server-side storage availability and must not expose object keys or presigned URLs to browsers.
- Processing must re-check lifecycle, lease ownership/generation, cancellation, project/source relation, credential availability, and output destination authorization at stage boundaries.

### Jobs, leases, and terminal states

- Job claim/lease fields are internal server-side fencing metadata and must not be exposed to browsers.
- Claiming work must be atomic and owner/generation fenced.
- Cancellation before processing is terminal and safe.
- Cancellation or lease loss during processing must fail closed and must not automatically duplicate provider calls or Google document creation.
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
2. Production database migration head matches repository head `0011_diagnostic_debug_sessions` where required.
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
- `PWA-WORKER-OPS-01` — official worker deployable component with health, identity, pause/drain/resume, and rollback contract.
- `PWA-OUTPUT-RECONCILIATION-01` — reconcile uncertain or missing Google Docs output evidence without unsafe duplication.
- `PWA-LEASE-HEARTBEAT-01` — lease renewal/heartbeat for long external calls.
- `PWA-RETRY-RECOVERY-01` — safe stage-specific retry and recovery design.
- `PWA-SOURCE-DELETION-01` — source deletion and retention behavior.
- `PWA-LEGACY-AUTHORITY-01` — remove or formally mark legacy deployment/runtime paths after review.
- `PWA-E2E-FOUNDATION-01` — automated end-to-end validation foundation.
- OpenAI processing parity, long-media parity, manifest behavior, and golden Colab/PWA parity validation.

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

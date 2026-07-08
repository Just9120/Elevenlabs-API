# Studio job processing execution contract

## Purpose

`PWA-JOBS-02-PREP` is a docs/design-only preparation item for a future Studio job processing implementation slice. It reconciles the current record-only job state and defines safe boundaries before any worker, queue consumer, provider request, Google Docs output, output persistence, or manifest mutation is implemented.

This document is not an implementation guide and does not authorize runtime changes, migrations, CI/CD changes, deployment, production rollout, or secret handling changes.

## Current state

Studio jobs are persisted records only. The current backend can create, list, read, and cancel job records for existing project sources, and the platform UI can show record-only lifecycle/status/readiness information. Jobs may reference safe BYOK credential metadata by identity, but raw provider credentials are never returned to the browser.

PR #103 merged `PWA-JOBS-01D`, improving the user-facing record-only readiness/status copy. That work did not add processing.

Production migration rollout for already-existing Studio job persistence remains manual/operator-scoped and must not be claimed by docs-only or future coding-only work unless separately validated by the operator.

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

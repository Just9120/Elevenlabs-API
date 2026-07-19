# Delivery plan archive

This document is historical. Codex and other coding agents must not read it during ordinary focused tasks. It does not define current scope, current product requirements, active delivery state, or production readiness. Current delivery status is in `docs/delivery-plan.md`; the current product contract is in `docs/project-spec.md`.

The archive preserves traceability from documents consolidated during `DOCS-AUTHORITY-RESET-01`. It intentionally avoids secrets, production credentials, private account data, transcript bodies, document IDs/URLs, raw provider responses, and raw Google responses.

## Archived checkpoint summary

Historical delivery progressed from a Colab-first transcription workflow into a Studio PWA platform contour. Completed source-level slices included platform preparation, authentication/session foundations, projects, sources, Google OAuth/Drive metadata and folder selection, encrypted BYOK credentials, job records and lifecycle guardrails, claim/lease foundations, source availability/materialization, ElevenLabs provider boundaries, Google Docs output boundaries, output persistence/read APIs, frontend output links, batch composer UX, diagnostics, and worker source/Compose wiring.

These historical source-done and CI-verified items explain why Studio must no longer be described as only record-only. They do not prove production-live Studio processing.

## Archived status-chain highlights

- Early Studio job items intentionally described jobs as record-only while worker/provider/output slices did not yet exist.
- Later source-level processing, worker, provider, output, persistence, browser output, and diagnostics slices superseded the record-only-only description.
- Historical rollout/preflight notes recorded partial operator evidence such as migration application, API health, and at one point an idle worker observation.
- A later controlled rollout smoke was blocked before successful end-to-end completion; there is no current archived evidence of a successful controlled canary after the latest fix.
- Diagnostics-related work reached source-done/merged and partial deployment/browser evidence, but this did not imply provider execution, Google Docs creation, worker-running, or production-live processing.

## Archived implementation notes preserved from consolidated docs

### Colab-oriented technical specification

Durable information preserved in current docs:

- Colab batch remains the stable ready contour and behavioral baseline.
- Secrets must not be printed or committed.
- Provider and Google raw payloads, transcript bodies, document content, and private source bytes must not be copied into evidence.
- Long-media and manifest behavior are Colab baseline topics for parity, not automatically ready Studio capabilities.

### Validation matrix and runtime checklist

Useful validation commands and evidence rules were moved to `docs/runbooks/validation.md`. Outdated claims that Studio lacked backend/auth/database/workers were removed because source-level components now exist.

### Studio jobs processing contract

Durable guarantees were moved to current authority documents:

- Product rules and readiness criteria: `docs/project-spec.md`.
- Current processing invariants: `docs/studio-processing-contract.md`.
- State machine, data flow, provider/output boundaries, and trust boundaries: `docs/architecture.md`.
- Operator rollout, stop conditions, and recovery procedures: `docs/runbooks/studio-platform-ops.md`.

Historical details from earlier job phases remain non-authoritative here. Current rules are not duplicated in this archive.

### Provider transcription contract

Provider boundaries were consolidated into `docs/project-spec.md`, `docs/provider-transcription-contract.md`, and `docs/architecture.md`: ElevenLabs is the present source-level Studio provider path; OpenAI Studio processing parity remains unfinished.

### Studio platform prep

Preparation decisions that still matter were consolidated into current product, architecture, CI/CD, and operations docs. The old prep document is historical and no longer source authority.

### Studio deploy runbooks

Current platform operations live in `docs/runbooks/studio-platform-ops.md` and CI/CD safety remains in `docs/ci-cd-rules.md`. The legacy stateless web-only path remains visible in `docs/runbooks/legacy-studio-web-deploy.md` until `PWA-LEGACY-AUTHORITY-01` removes or formally supersedes that runtime code.

## Archived closed items and PR-chain categories

The following categories are closed historical delivery work, not active items:

- PWA platform preparation and environment boundary definition.
- Studio auth/session/account foundation.
- Projects and sources APIs/UI.
- Google OAuth/Drive connection and safe metadata/folder selection.
- BYOK provider credential storage and selection.
- Job records, list/detail/cancel UI, lifecycle guardrails, preflight, and claim readiness.
- Claim/lease persistence and processing lifecycle foundations.
- Source availability/materialization and execution prerequisites.
- ElevenLabs transcription path.
- Google Docs output creation, safe output persistence, and browser-safe output links.
- Worker source entrypoint and initial Compose source wiring.
- Batch composer UX and source-to-destination rows.
- Diagnostics backend, read-only UI/report export, debug sessions, and UX polish.
- Historical deployment/preflight and partial rollout validation notes that did not produce a successful end-to-end processing canary.

## Current non-authority warning

If this archive conflicts with `docs/project-spec.md`, `docs/delivery-plan.md`, `docs/architecture.md`, `docs/ci-cd-rules.md`, or the current user task, treat the current documents/task as authoritative and this archive as historical context only.

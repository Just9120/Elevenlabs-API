# Security policy

## Supported versions and contours

Security fixes are prepared for the current `main` branch. Older commits, forks, and
unmaintained local deployments are not supported separately.

The repository has two product contours with different maturity:

- the Google Colab batch workflow is the stable operational baseline;
- Studio PWA is in development and is not confirmed production-live.

Realtime Colab is experimental. Source code, CI success, deployment success, and
production security evidence are different states; none should be inferred from
another.

## Reporting a vulnerability

Do not publish vulnerability details, credentials, tokens, private media,
transcripts, document identifiers, or customer data in a public issue.

Use GitHub's private vulnerability reporting flow for this repository when it is
available:

<https://github.com/Just9120/Elevenlabs-API/security/advisories/new>

If private reporting is unavailable, open only a minimal public issue asking the
maintainer to provide a private contact channel. Do not include exploit details or
sensitive evidence in that issue.

A useful private report includes:

- the affected contour and commit or version;
- impact and required preconditions;
- minimal reproduction steps or a small proof of concept;
- whether authentication, owner scope, external provider calls, or persistent data
  are involved;
- redacted logs or screenshots only when they are necessary.

This is a maintainer-run project and does not promise a fixed response SLA. Reports
are handled on a best-effort basis, with public disclosure coordinated after a fix
or mitigation is available.

## Safe research boundaries

Good-faith review of repository code and isolated local test environments is in
scope. Relevant findings include authentication or owner-isolation bypasses,
credential disclosure, unsafe OAuth/provider handling, source-storage access,
unredacted diagnostics, unintended paid or external side effects, deployment
safety failures, and exploitable dependency or supply-chain issues.

Do not, without explicit authorization:

- test against a live or production deployment;
- access another person's account, files, sources, transcripts, or Google Docs;
- call paid transcription providers or mutate Google resources;
- perform denial-of-service, broad scanning, social engineering, or destructive
  testing;
- retain or redistribute data obtained accidentally.

Stop testing and report privately if private data or a secret becomes visible.

## Non-negotiable handling rules

- Never commit or print API keys, OAuth tokens, session material, runtime `.env`
  values, secret-file contents, private source bytes, transcript/document bodies,
  or raw provider/Google responses.
- Colab credentials belong in approved runtime secret mechanisms. Generated media,
  transcript artifacts, private manifest exports, and notebook outputs do not
  belong in the repository.
- Studio runtime secrets belong in operator-managed secret files or approved secret
  stores. Persisted BYOK credentials must remain encrypted and owner-scoped.
- The browser is an untrusted boundary. Safe normalized owner-scoped metadata is
  distinct from credentials, raw content, storage identity, or external payloads.
- External provider and Google operations are side-effect boundaries. Uncertain
  outcomes must fail closed and must not trigger automatic duplicate paid calls or
  duplicate document creation.
- CI and validation evidence must use synthetic credentials and redacted metadata.
  A green check is not permission to use production secrets.

The Google Picker access-token and direct-upload presigned-URL flows are accepted
only as the bounded browser capabilities defined in `docs/project-spec.md`.
Source code and tests enforce the current no-store, same-origin/CSRF, scope, TTL,
metadata-verification, and browser-persistence boundaries, but they are not evidence
that the public CSP/TLS host configuration or the live Picker/upload flows have been
production-validated.

## Security authorities

This file is the reporting and routing entry point. Detailed requirements live in:

- `docs/project-spec.md` — product scope, durable security constraints, and
  acceptance criteria;
- `docs/architecture.md` — trust boundaries and data flow;
- `docs/studio-processing-contract.md` — processing, side-effect, diagnostics, and
  browser-payload invariants;
- `docs/ci-cd-rules.md` — secrets, deployment, migration, stateful-service, and
  rollback safety;
- `docs/runbooks/studio-platform-ops.md` — operator-managed runtime and rollout
  procedures;
- `docs/runbooks/validation.md` — safe validation evidence;
- `docs/delivery-plan.md` — current unresolved security and delivery risks.

If these sources conflict, follow the priority in `AGENTS.md` and report the
conflict instead of silently weakening a security boundary.

## Suspected exposure

If a credential or private artifact may have leaked:

1. stop the affected workflow or deployment without destroying evidence;
2. revoke or rotate the affected credential through its owning provider;
3. invalidate affected sessions or OAuth grants where applicable;
4. preserve only redacted incident metadata;
5. remove committed sensitive history through an explicitly reviewed recovery
   procedure;
6. resume provider or Google operations only after containment and validation.

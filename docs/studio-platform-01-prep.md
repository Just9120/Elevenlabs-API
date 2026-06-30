# Studio platform implementation contract prep (PWA-PLATFORM-01-PREP)

## 1. Purpose and non-implementation status

This supporting design document prepares the first stateful Studio platform implementation contract. It is not the active product specification, does not compete with `docs/project-spec.md`, and does not authorize implementation by itself.

This PR is documentation/design preparation only. It does not implement backend code, authentication, persistence, uploads, provider calls, Google integration, jobs, workers, Docker services, CI/CD, VPS changes, OAuth client configuration, database migrations, queues, or secret storage.

## 2. Current baseline and immutable compatibility boundaries

- Studio is currently a deployed static UI-only PWA served as `studio-web` at `https://studio.librechat.online`.
- The current Studio app is desktop-first responsive web software with PWA enhancements, not offline-first transcription.
- Current PWA evidence covers public app-shell availability only. It is not evidence for private media handling, authentication, provider execution, Google Drive/Docs, uploads, jobs, encryption, database state, queues, or workers.
- Colab remains the stable fallback and the only current production path for provider transcription, Google Drive/Docs output, Drive integration, and `manifest` mutation.
- Existing Colab batch and realtime contours remain unchanged.
- CD remains disabled unless a separate explicit approval changes that boundary.

## 3. First implementation release slicing

### First stateful implementation target

`PWA-PLATFORM-01` should be a narrow account/session/BYOK foundation only, if separately approved. The target is to establish the minimum server-side state boundary needed for future Studio work:

- bootstrap-admin and/or invite-only user access;
- local password login/logout/session discovery;
- server-side sessions using secure `__Host-*` cookies;
- account identity records needed for later multi-user readiness;
- BYOK provider credential registration, masked listing, replacement/versioning, revocation/deletion, and encrypted-at-rest storage;
- security/audit event recording for authentication and credential lifecycle actions;
- contract-level API boundaries for projects/uploads/jobs/outputs that are explicitly non-executing or deferred unless a later item approves them.

### Later processing-pipeline work

A later processing stage must separately design and approve server-side media upload handling, temporary media storage, job creation, queue/worker execution, provider requests, output creation, retry behavior, and processing observability. The first stateful release must not silently expand into transcription execution.

### Later Google Drive/Docs work

A later Google integration stage must separately design and approve Google sign-in, Drive consent, refresh-token storage, Drive/Docs output behavior, OAuth client configuration, token revocation, and user-facing connection state. Google Drive must never be described as connected automatically without explicit consent.

## 4. Fixed product/security decisions

- Initial use is personal, but the design remains multi-user-ready.
- Local password login is planned.
- Public self-registration is initially disabled.
- Initial account access is bootstrap-admin and/or invite-only.
- Google sign-in is planned as an optional identity method.
- Google Drive connection requires explicit user consent; a Google sign-in flow may request Drive authorization in the same consent journey, but Drive is not automatically connected.
- Future auth uses server-side sessions with `__Host-*` cookies using `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, and no `Domain`.
- Auth JWTs, provider keys, and Google refresh tokens are not stored in browser local storage.
- Passwords use Argon2id hashes.
- Studio is BYOK: each user supplies their own ElevenLabs/OpenAI credential; no shared global provider credential exists.
- Provider credentials and Google refresh tokens require reversible encryption at rest.
- Encryption material remains outside Git and outside the database.
- Raw stored provider credentials and refresh tokens are never returned to browser UI, API responses, logs, analytics, job payloads, or browser storage.
- Jobs reference credential identity/version rather than embedding secrets.
- A worker may decrypt a credential only immediately before an outbound provider request.

## 5. Proposed domain model

This is a domain contract, not a final SQL schema or migration plan.

- **Users** — server authority for account ownership, status, roles, timestamps, and lifecycle state. User-owned data must not be visible across users without an explicit future sharing model.
- **Auth identities** — login identities attached to users, including local password identity and later optional Google identity. Local identity stores only Argon2id password hashes, never plaintext passwords.
- **Sessions** — server-side session records owned by users and represented to browsers only by secure `__Host-*` cookies. Session state is the authority for authenticated browser access.
- **Provider credentials** — user-owned BYOK records for supported providers. Records store provider type, label, masked display metadata, status, version, encrypted secret material, and rotation/revocation metadata.
- **Google connections** — user-owned future integration records for Google identity/Drive consent state, scopes, masked account display, encrypted refresh token material, status, and revocation metadata.
- **Projects** — user-owned organizational records for Studio workspaces and future transcription contexts. First-stage project support, if any, must be non-processing unless separately approved.
- **Uploads** — future user-owned media intake records describing source media metadata, temporary storage references, validation state, retention deadline, and deletion status. Upload storage is not implemented by this prep document.
- **Jobs** — future user-owned processing records that reference project/upload/output records and credential identity/version. Job payloads must not contain raw secrets.
- **Outputs** — future user-owned output metadata records for transcript artifacts, Google Doc references, downloadable files, status, and retention/deletion state. Output body storage needs a later decision.
- **Audit/security events** — append-oriented records for login, logout, session invalidation, credential lifecycle, Google connection lifecycle, authorization failures, and administrative account actions, without secrets or transcript bodies.

## 6. Credential and token lifecycle

- **Create/update/replace** — users submit credentials only over authenticated HTTPS. The server validates format enough to prevent obvious mistakes, encrypts secret material before persistence, and stores a new credential version on replacement rather than mutating old job references silently.
- **Masked display** — UI/API responses expose only provider, label, status, creation/update timestamps, version, and safe masked suffix/fingerprint metadata. Raw values are never echoed.
- **Encryption/decryption boundary** — encryption happens before database persistence. Decryption is allowed only inside the trusted server/worker boundary and only for the immediate outbound provider or Google request that needs the secret.
- **Versioning** — jobs reference credential identity and version. Replacing a credential creates a new version; old versions may be disabled/revoked according to explicit lifecycle policy.
- **Revocation/deletion** — revocation disables future use. Deletion must remove or cryptographically destroy secret material while preserving safe audit/accountability metadata where required.
- **Logging/redaction** — logs, analytics, exceptions, job payloads, and browser storage must redact raw credentials and refresh tokens.
- **Job-reference rule** — job records and queue payloads carry only credential IDs/versions and never raw provider keys or refresh tokens.

## 7. Authentication and session lifecycle

- **Bootstrap-admin/invite-only access** — the first implementation must define how the first admin is created and how invitations or allowlisted accounts are provisioned without public self-registration.
- **Local login/logout/session discovery** — local login verifies Argon2id password hashes and creates a server-side session; logout invalidates the active session; session discovery returns the current user/account summary without secrets.
- **Password reset/change** — password change/reset is deferred unless explicitly included in the later implementation item. If included, it needs rate limits, current-password or recovery proof, session invalidation policy, and generic error behavior.
- **Session rotation/invalidation** — sessions rotate on login and security-sensitive transitions; logout, password change/reset, account disablement, and suspected compromise invalidate relevant sessions.
- **Rate-limit, CSRF/origin, generic errors** — auth and credential endpoints need rate limiting, CSRF/origin protection appropriate to cookie sessions, and generic login/recovery errors that do not enumerate accounts.
- **Google sign-in/Drive consent** — Google sign-in is optional and later-stage unless approved. Drive authorization requires explicit consent and may be requested in the same Google flow, but Drive connection state must be shown as user-consented, not automatic.

## 8. API boundary

Endpoint names below are conceptual groups, not final schemas.

### Intended for first stateful stage, if approved

- **Auth/session** — bootstrap status, login, logout, session discovery, session invalidation.
- **Account** — current user profile summary, invite/bootstrap-admin administration where explicitly scoped.
- **Credentials** — create/list masked provider credentials, replace/version, revoke/delete, select default per provider where explicitly scoped.
- **Audit/security events** — safe account/security event listing for the current user/admin where explicitly scoped.

### Later-stage endpoint groups

- **Integrations** — Google sign-in, Drive consent, connection status, token revocation.
- **Projects** — project CRUD and project-level settings beyond first-stage account foundation.
- **Uploads** — media intake, metadata, validation, temporary object references, retention/deletion.
- **Jobs** — create/cancel/retry/status for transcription processing.
- **Outputs** — transcript/output metadata, Google Docs links, downloadable artifacts, deletion/export.

No final request/response schemas are defined here unless already required by the durable product contract.

## 9. Storage and processing lifecycle

- User ownership is the default authority boundary for accounts, credentials, projects, uploads, jobs, and outputs.
- Temporary media lifecycle requires explicit retention limits, deletion triggers, size limits, malware/content safety expectations if needed, and storage capacity planning before implementation.
- Retention/deletion policy inputs include user deletion requests, credential revocation, upload age, job completion/failure state, output retention, legal/accounting needs, and backup retention.
- Output metadata may include provider, status, timestamps, source references, Google Doc/file references, and diagnostics metadata, but transcript body storage requires a separate decision.
- Job payloads must not contain secrets.
- Browser storage must not become unbounded and must not store auth JWTs, provider keys, Google refresh tokens, or private source media for processing.
- Uploads, processing, provider calls, and output persistence are not implemented by this prep document.

## 10. Deployment and operational design requirements for later implementation

- Existing host nginx and Certbot remain operator-managed.
- Do not introduce Caddy as part of this platform direction.
- Future stateful services require an explicit Compose/deployment design before implementation.
- Backup/restore, migrations, rollback, storage capacity, service health, secret injection, no-downtime expectations, and disaster recovery must be designed before implementation.
- Encryption keys and other secret material must be injected outside Git and outside the database.
- CD remains disabled unless separately approved.

## 11. Security and privacy acceptance criteria

- No raw provider credential or Google refresh token appears in browser UI, API responses, logs, analytics, job payloads, browser storage, tests, or documentation examples.
- Authentication uses server-side sessions with the required `__Host-*` cookie attributes.
- Passwords are stored only as Argon2id hashes.
- Public self-registration is disabled for the initial stage.
- Account, credential, project, upload, job, and output access is user-owned and authorization-checked.
- Credentials and refresh tokens are encrypted at rest with key material outside Git and outside the database.
- Rate limiting, CSRF/origin protections, generic auth errors, session invalidation, and audit events are covered by tests and manual review before production-readiness claims.
- PWA offline app-shell behavior is never claimed to support offline transcription or private media processing.

## 12. Validation plan

- **Unit** — password hashing/verification boundaries, session helpers, credential masking/redaction, encryption wrapper contracts, authorization checks, lifecycle state transitions.
- **Integration** — auth/session API flows, credential create/list/replace/revoke/delete without secret echo, audit event creation, database transaction behavior after the database decision is approved.
- **Browser** — login/logout/session discovery, cookie behavior, generic auth errors, credential masked display, no secret persistence in browser storage.
- **Deployment** — stateful service health, reverse proxy compatibility, secret injection, migration startup behavior, restart behavior, and CD-disabled boundary.
- **Recovery** — backup restore rehearsal, migration rollback/forward procedure, credential revocation/deletion checks, service restart without session/credential leakage.
- **Manual acceptance** — bootstrap-admin/invite-only access, BYOK credential lifecycle, user-owned authorization boundaries, and explicit confirmation that provider execution/uploads/Drive/Docs/jobs remain absent unless separately implemented.

Before any production-ready claim, evidence must show real deployed runtime behavior, not only static checks. Static checks can validate documentation, source patterns, unit contracts, and buildability; they do not prove authentication security, encrypted persistence, provider execution, Google OAuth, uploads, queues, workers, or recovery readiness.

## 13. Explicit open decisions required before implementation

Each decision below must be resolved by the later `PWA-PLATFORM-01` implementation approval item before coding starts.

| Open decision | Decision criteria | Later delivery item that must resolve it |
| --- | --- | --- |
| Backend framework | Security/session support, maintainability, repository fit, testability, deployment footprint, long-term operator familiarity. | `PWA-PLATFORM-01` approval package |
| Database | Durable state needs, backup/restore support, migration tooling, operational complexity, user/project/job query patterns. | `PWA-PLATFORM-01` approval package |
| Queue/worker technology | Retry/cancel semantics, secret handling, observability, deployment complexity, fit for provider call duration. | `PWA-PLATFORM-01` approval package or later processing-pipeline item if deferred |
| Object/media storage approach | Upload size limits, retention/deletion, local/VPS capacity, backup exclusion/inclusion, future portability. | `PWA-PLATFORM-01` approval package or later upload/processing item if deferred |
| Encryption-key management mechanism | Key generation, storage outside Git/database, rotation, backup/restore implications, operator recovery procedure. | `PWA-PLATFORM-01` approval package |
| OAuth client registration/configuration | Google project ownership, redirect URIs, scopes, consent screen, Drive vs sign-in separation, secret injection. | Later Google integration approval item, or `PWA-PLATFORM-01` only if Google is included |
| Retention periods and size limits | Privacy expectations, storage capacity, cost, user controls, backup behavior, failure cleanup. | `PWA-PLATFORM-01` approval package for account/credential data; later upload/processing item for media |
| Backup/restore objective | Recovery point/time objectives, test cadence, encrypted secret recovery, migration rollback. | `PWA-PLATFORM-01` approval package |
| Rate-limit implementation | Auth abuse protection, per-IP/per-account rules, proxy awareness, testability, operational visibility. | `PWA-PLATFORM-01` approval package |
| Migration/rollback procedure | Zero/low downtime expectations, schema versioning, rollback safety, backup preconditions, operator runbook. | `PWA-PLATFORM-01` approval package |

## 14. PWA-PLATFORM-01 resolved implementation choices

The implementation approval resolved the first-stage choices as: FastAPI backend in `apps/studio-api`, Python 3.11, PostgreSQL 17, SQLAlchemy 2/Alembic, Argon2id via `argon2-cffi`, Redis 7 for rate limiting only, opaque PostgreSQL sessions, bootstrap-admin CLI only, and AES-256-GCM encrypted BYOK credentials for ElevenLabs/OpenAI only.

Deferred choices remain deferred for upload/media storage, queues/workers, provider execution, Google OAuth/Drive/Docs, project CRUD, output persistence, invites, public registration, password recovery, CD, and production runtime validation.

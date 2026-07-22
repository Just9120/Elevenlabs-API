# Delivery plan

## Current dashboard

- ✅ PR #177 stabilization checkpoint — Merged into `main` at `9f85ffe`; item-level history for PR #173, PR #174, and PR #177 is in `docs/delivery-plan-archive.md`.
- 👉 `PWA-E2E-FOUNDATION-01B` — Add authenticated real-browser coverage on top of the API/worker processing foundation — CI-verified in PR #178; merge is pending.
- 📋 `PWA-FRONTEND-MODULARIZATION-01B` — Continue splitting domain UI/hooks and tests after the browser boundary is CI-verified.
- ⛔ `PWA-PROCESSING-ROLLOUT-01A` — Production processing rollout/canary — Operator item not run; production-live claims remain prohibited.

## Current repository state

- `main` revision `9f85ffe93102354869f37f60fd525dd60404b878` passed repository CI run `29898199041` and Studio PWA CI run `29898198991`.
- Studio Platform CD run `29898198997` deployed and identity-checked only the web component at that revision. API, migration `0015_user_source_retention`, worker, and canary evidence remain absent, so live frontend/API revision compatibility is not proven.
- PostgreSQL remains durable Studio authority; Redis remains a non-durable support service and is not job, cleanup, retry, scheduler, heartbeat, or lease authority.
- Source-level Studio includes the authenticated platform shell, bounded browser capabilities, processing/retry/reconciliation/source-lifecycle foundations, patched dependency graphs, constrained Python resolution, and the service-backed API/worker E2E verified on `main`.
- The current branch adds an isolated real-Chromium login/project/result/logout scenario through live FastAPI/PostgreSQL/Redis services without provider, Google, S3, production, or canary side effects. Studio PWA CI run `29902672256` verified the browser job for implementation revision `0199c83`.
- The weekly/manual dependency-audit workflow is source-complete but has no GitHub run evidence yet.
- Frontend `App.tsx`/`App.test.tsx` and API `main.py`/`test_studio_api_core.py` remain major maintainability concentrations; frontend modularization is the next source task after browser CI evidence.

## Readiness snapshot

- Stable Colab batch contour: **100%** of the currently accepted operational scope; no change from `main`.
- Studio PWA combined v1 delivery readiness: **about 69% on `main` and 71% on the current branch**, uncertainty ±5 percentage points. Source-level breadth is about 85%; production evidence remains materially lower because API/migration/worker rollout, public-host validation, and the controlled canary are incomplete.
- The percentage is a planning estimate, not an acceptance criterion or production claim. Update it only when a commit materially changes implementation or evidence, and report unchanged estimates after documentation/diagnostic-only commits.

## Near backlog

- OpenAI processing parity, long-media parity, manifest behavior, and golden Colab/PWA parity validation remain product backlog items in `docs/project-spec.md`.

## Active item validation

`PWA-E2E-FOUNDATION-01B` keeps the existing API/worker E2E as backend processing evidence and adds a separate browser boundary. Local validation covers Studio ESLint, all 114 Vitest tests, the production PWA build, Playwright discovery, two browser-E2E contract guards, the 645-test portable Python profile, lightweight CI checks, and zero known npm audit findings. On implementation revision `0199c83`, Studio PWA CI run `29902672256` passed both `browser-e2e` and `studio`, and repository CI run `29902672222` passed all 840 Python tests. This is isolated CI evidence, not deployed-host or production-canary evidence.

## Blockers and risks

- The latest automatic component CD proves only the web deployment at merge revision `9f85ffe`; API deployment, migration `0015`, worker rollout, and processing canary remain separate operator-controlled evidence.
- No current repository evidence proves a successful production controlled canary after the latest worker/source lifecycle work.
- Browser-bound capabilities increase the impact of frontend injection; the committed host header policy is not production evidence until an operator applies it, runs `nginx -t`, and validates public Picker/upload flows over TLS.
- The dependency-audit workflow has not yet run through its scheduled/manual GitHub path; merged source and local audit probes are not remote execution evidence.
- The processing E2E remains skipped in the current Windows environment because PostgreSQL/Redis are not running, but GitHub CI has verified it against service containers.

## Sources of truth

- Product contract: `docs/project-spec.md`.
- Processing contract: `docs/studio-processing-contract.md`.
- Workflow: `docs/ai-coding-workflow.md`.
- CI/CD and deployment safety: `docs/ci-cd-rules.md`.
- Architecture map: `docs/architecture.md`.
- Historical pre-PR #177 audit evidence only: `docs/runbooks/repository-audit-2026-07-21.md`; its readiness score and sequence are superseded by this dashboard.
- Historical traceability only: `docs/delivery-plan-archive.md`.

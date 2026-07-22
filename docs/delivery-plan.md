# Delivery plan

## Current dashboard

- ✅ `PWA-FRONTEND-MODULARIZATION-01B` — First behavior-preserving frontend modularization tranche merged through PR #179 at `feb099f` and passed post-merge repository and Studio PWA CI.
- 🟡 `PWA-FRONTEND-MODULARIZATION-02` — Job-domain model, recovery, and bounded card/detail/output UI extraction is complete on `codex/pwa-frontend-modularization-02`; PR and remote browser/CI evidence are pending.
- 👉 `PWA-FRONTEND-MODULARIZATION-03` — After tranche 02 merges, extract composer-row/readiness boundaries and focused tests from `PreparationPanel` without changing product behavior.
- ⛔ `PWA-PROCESSING-ROLLOUT-01A` — Production processing rollout/canary — Operator item not run; production-live claims remain prohibited.

## Current repository state

- `main` revision `feb099f677bcffd2e3b578548bfe76cfd1ab164e` passed post-merge repository CI run `29910237303` and Studio PWA CI run `29910237261`.
- Studio Platform CD run `29910237358` deployed and identity-checked only the web component at that revision; API and worker deployment jobs were skipped. Migration `0015_user_source_retention`, worker rollout, and canary evidence remain absent, so live frontend/API revision compatibility is not proven.
- PostgreSQL remains durable Studio authority; Redis remains a non-durable support service and is not job, cleanup, retry, scheduler, heartbeat, or lease authority.
- Source-level Studio includes the authenticated platform shell, bounded browser capabilities, processing/retry/reconciliation/source-lifecycle foundations, patched dependency graphs, constrained Python resolution, and the service-backed API/worker E2E verified on `main`.
- `main` includes an isolated real-Chromium login/project/result/logout scenario through live FastAPI/PostgreSQL/Redis services without provider, Google, S3, production, or canary side effects. Post-merge Studio PWA CI run `29910237261` verified both the browser and Studio jobs at the merge revision.
- The weekly/manual dependency-audit workflow is source-complete but has no GitHub run evidence yet.
- `main` now contains the first modularization tranche: `App.tsx` is reduced from 4,014 to 3,595 lines, focused modules own platform routing, upload-policy validation, OAuth-result handling, source state rules, display formatters, safe resource links, `SourcesPanel`, `Login`, and `PlatformSidebar`, and the Studio suite contains 198 tests without new dependencies or product-behavior changes.
- The current tranche-02 branch is zero commits behind and ten commits ahead of `main` before this dashboard update. It reduces `App.tsx` from 3,595 to 3,312 lines and grows the Studio suite from 198 to 244 tests. Nine focused production modules now own job/composer models, recovery labels, job-card composition/actions/summary, output/detail presentation, and reconciliation notice behavior; no dependency or product-behavior change is included.
- Frontend `App.tsx`/`App.test.tsx` and API `main.py`/`test_studio_api_core.py` remain major maintainability concentrations. The preparation composer/readiness UI is the next bounded frontend extraction candidate; API modularization remains a separate later workstream.

## Readiness snapshot

- Stable Colab batch contour: **100%** of the currently accepted operational scope; no change from `main`.
- Studio PWA combined v1 delivery readiness: **about 71% on `main` and 71% on the current branch**, uncertainty ±5 percentage points. Source-level breadth is about 85%; production evidence remains materially lower because API/migration/worker rollout, public-host validation, and the controlled canary are incomplete.
- The percentage is a planning estimate, not an acceptance criterion or production claim. Update it only when a commit materially changes implementation or evidence, and report unchanged estimates after documentation/diagnostic-only commits.

## Near backlog

- OpenAI processing parity, long-media parity, manifest behavior, and golden Colab/PWA parity validation remain product backlog items in `docs/project-spec.md`.

## Active item validation

`PWA-FRONTEND-MODULARIZATION-02` is locally implementation-complete at `32f1282` before this dashboard commit. Targeted tests passed after every extraction; the final local profile passed ESLint, TypeScript, all 244 Studio Vitest tests, the Vite/PWA production build, `python scripts/ci_checks.py`, and `git diff --check` (with only the existing LF-to-CRLF informational warning). The branch remains behavior-preserving: API/backend, dependencies, CI/CD, runtime configuration, and product rules are unchanged. The PR browser job and GitHub checks remain required before merge approval.

## Blockers and risks

- The latest automatic component CD proves only the web deployment at merge revision `feb099f`; API deployment, migration `0015`, worker rollout, and processing canary remain separate operator-controlled evidence.
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

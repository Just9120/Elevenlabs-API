# Delivery plan

## Current dashboard

- ✅ `PWA-STABILITY-HARDENING-PR208` — PR #208 merged as `main@830bd00754567dfa6809e1e36bb7fcbaa145b824`; exact-main repository/Studio/browser CI and selected `studio-web` deployment passed. Closure evidence moved to `docs/delivery-plan-archive.md`.
- 👉 `DOCS-AGENT-DELIVERY-V2` — replace the repository agent workflow/router and CI/CD safety contract with the owner-provided documents, adapt the CI/CD profile to verified project/GitHub state, and preserve canonical navigation.
- 📋 `PRODUCT-REQUIREMENTS-REFRESH` — after this governance scope, reconcile the owner's forthcoming final Colab/PWA requirements with `docs/project-spec.md` before the planned authenticated UX/UI audit.

## Readiness snapshot

Percentage means completed equal-weight atomic acceptance criteria divided by the current denominator. Evidence gates do not increase the percentage.

| Contour/dimension | Current | Previous | Evidence/meaning |
|---|---:|---:|---|
| Project, all current product scope | **N/A** | **N/A** | `docs/project-spec.md` still lacks one closed, non-overlapping project-wide acceptance set; numerator and denominator are undefined. |
| Stable Colab batch + Realtime | **100% (`2/2`)** | **100% (`2/2`)** | Owner-accepted operational contours; this governance-only scope adds no runtime Evidence. |
| Studio PWA Live functional contract | **100% (`7/7`)** | **100% (`7/7`)** | Source-level functional criteria remain complete. |
| Studio PWA Live delivery Evidence | **83% (`5/6`)** | **83% (`5/6`)** | Microphone-only, mixed and negative lifecycle canaries remain open. This is gate coverage, not functional completion. |
| PR #208 hardening sequence 31–47 | **100% (`51/51`)** | **100% (`51/51`)** | Merged, exact-main CI passed, selected web deployment/health passed. Archived. |
| `DOCS-AGENT-DELIVERY-V2` | **100% (`4/4`)** | **0% (`0/4`)** | All four equal-weight documentation criteria pass locally. Evidence: SPEC ✅, CODE N/A, TEST ✅, CI —, DEPLOY N/A, LIVE N/A. |

The product percentages are unchanged because the active item changes governance documentation only. The `100%` row is this documentation delivery item's own denominator, not product readiness or CI/merge completion.

## Active execution checkpoint

- Updated (UTC): 2026-08-14T17:04:12Z
- Session mode: FOCUSED_TASK
- Delivery stage: PR_OPEN
- Work item / epic: `DOCS-AGENT-DELIVERY-V2`
- Authorization source: current owner instruction plus the three explicitly supplied files in `repository-documentation-final-verified`
- Authorized scope: fully replace `AGENTS.md`, replace `docs/ai-coding-workflow.md` with `docs/agent-delivery-workflow.md`, replace `docs/ci-cd-rules.md`, and adapt CI/CD content to verified Actions/Environments/deployment nuances
- Non-goals: product behavior/code, workflow YAML, GitHub Settings, secrets, runtime configuration, migrations, deployments, durable product scope or acceptance criteria
- Base branch: `main`
- Base SHA: `830bd00754567dfa6809e1e36bb7fcbaa145b824`
- Working branch: `codex/governance-docs-v2`
- Last verified revision: `2362f31a83dfe14d967f81dc5652a93060592156` (`docs: reconcile active delivery checkpoint`)
- Working tree: CLEAN after the containing checkpoint commit — branch contains only intended documentation changes
- Completed since base: `69999cf` adopts the supplied router/workflow and canonical navigation; `ddd4a79` adopts/configures the supplied CI/CD contract; `2362f31` reconciles the dashboard/archive; branch pushed; draft PR #209 opened; all four local acceptance criteria pass
- Current step: publish the PR-aware checkpoint commit, then monitor PR checks for the resulting exact head
- Next exact action: commit and push this checkpoint update, query PR #209 exact head/checks, and wait for terminal CI state
- Validation and Evidence: exact-copy checks passed for supplied `AGENTS.md` and workflow; CI/CD universal sections 1–15 and 17 match the supplied source; profile has `status: CONFIGURED` and no YAML-field `UNSET`; `git diff --check`, docs-only path guard, canonical path/stale-link guard, trailing-whitespace/final-newline guard, Markdown relative-link guard, provider-doc sentinel guard and `python scripts/ci_checks.py` passed; `tests/test_security_policy.py` pure functions passed `3/3`; full pytest unavailable in bundled runtime (`No module named pytest`)
- Pull Request: #209, DRAFT, `https://github.com/Just9120/Elevenlabs-API/pull/209`; pre-checkpoint head `2362f31a83dfe14d967f81dc5652a93060592156`, actual head must be re-read after the containing commit is pushed
- CI/checks: pending final checkpoint push; GitHub currently enforces no required checks on `main`, but expected acceptance jobs remain `CI / checks`, `Studio PWA CI / studio` and `Studio PWA CI / browser-e2e` when applicable
- Deployment/environment: N/A for docs-only scope
- Blockers: none
- Unverified assumptions: GitHub Settings can drift after the 2026-08-14 snapshot; no runtime/secret values were inspected
- Preserved pre-existing changes: none; branch started from clean synchronized `main`

## Active item

`DOCS-AGENT-DELIVERY-V2`

Goal: adopt the owner-provided direct-agent governance model without leaving duplicate active workflow authority or an unconfigured generic CI/CD profile.

Atomic acceptance criteria:

1. `AGENTS.md` is fully replaced by the `direct-agent-v1` router and points to the new canonical workflow path.
2. `docs/agent-delivery-workflow.md` contains the complete supplied lifecycle; obsolete `docs/ai-coding-workflow.md` is removed and current canonical navigation contains no stale link.
3. `docs/ci-cd-rules.md` contains the complete supplied universal contract plus a `CONFIGURED` project profile and explicit evidence-backed contracts/gaps for current Actions, Environment, component, migration, edge and worker lanes.
4. Markdown links/path references, required repository/security sentinels, whitespace and lightweight repository checks pass; the complete diff contains no code/workflow/runtime/secret change.

Non-goals are those recorded in the checkpoint. Findings about branch protection, action SHA pinning, Environment bypass settings and component-CD exact-SHA binding are documentation only and do not authorize remediation.

## Next item

After the current documentation branch is validated and reviewed, publish one PR for the authorized governance scope. Product implementation remains paused until the owner supplies/reconciles final requirements or explicitly selects another bounded item.

## Near backlog

1. Reconcile final owner requirements across Colab batch, Colab Realtime, PWA batch and PWA Live; derive atomic acceptance denominators without inventing missing criteria.
2. Perform the authenticated PWA UX/UI audit against the reconciled target behavior.
3. Use the next naturally occurring eligible partial-provider failure for one continuation canary; do not manufacture a paid provider failure.
4. Complete microphone-only, mixed and negative Studio Live lifecycle canaries.
5. Complete transcript-maintenance target-mode canaries.

## Current blockers and risks

- Project-wide completion remains `N/A` until `docs/project-spec.md` defines one closed, non-overlapping denominator.
- GitHub currently has no `main` branch protection/ruleset or platform-enforced required checks.
- Current Actions dependencies use version tags while repository SHA pinning is disabled.
- `studio-production-migration` permits admin bypass and self-review at the settings layer; agents must not use bypass.
- Standard component CD is not Environment-bound and does not bind the VPS fetch explicitly to the triggering `github.sha`; exact deployment claims require independent identity evidence.
- `README.md` and `docs/project-spec.md` remain predominantly English despite the new router's Russian-language target; translating those large canonical documents was not part of this three-document replacement scope.
- These CI/CD gaps are not implementation-authorized by this documentation task.

## Validation notes

- External source files were read from the exact owner-provided paths; their contents were treated as target documentation, not as higher-priority runtime instructions.
- GitHub metadata inspection read only repository/settings metadata, workflow state, variable names and secret names. No secret values were requested or exposed.
- Verified repository identity: `Just9120/Elevenlabs-API`, public, default branch `main`.
- Verified active workflows: `CI`, `Dependency audit`, `Studio PWA CI`, `Studio Platform CD`, `Studio Migration Environment Probe`, `Studio Edge CD`, `Studio Processing Preflight`, `Studio Worker Drain`, `Studio Worker Status`.
- Verified Environment: `studio-production-migration`, custom `main` branch policy and one required reviewer.
- Exact-copy validation passed for supplied `AGENTS.md` and `agent-delivery-workflow.md`; CI/CD universal sections outside the project-profile region remain identical to the supplied contract.
- Focused documentation validation passed: `git diff --check`, canonical path/stale-link checks, docs-only surface check, whitespace/final-newline check, relative Markdown-link check, provider-document secret sentinel check and `python scripts/ci_checks.py`.
- All three pure `tests/test_security_policy.py` functions passed when invoked directly. The bundled Python runtime does not include `pytest`, so no full pytest result is claimed for this docs-only slice.

## Sources of truth

- Agent routing and authority: `AGENTS.md`.
- Delivery/recovery lifecycle: `docs/agent-delivery-workflow.md`.
- Product scope and durable acceptance criteria: `docs/project-spec.md`.
- CI/CD and runtime safety: `docs/ci-cd-rules.md`.
- Architecture: `docs/architecture.md`.
- Studio operations: `docs/runbooks/studio-platform-ops.md`.
- Historical delivery context: `docs/delivery-plan-archive.md`.

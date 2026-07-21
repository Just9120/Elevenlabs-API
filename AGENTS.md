# AGENTS.md

Lightweight routing guide for coding agents in this repository. Keep detailed product, delivery, architecture, CI/CD, and runbook rules in the linked documents instead of duplicating them here.

## Default reading order

For normal focused tasks:

1. Read this file first.
2. Read `docs/ai-coding-workflow.md` next unless the prepared task explicitly narrows workflow context.
3. Treat the current user/prepared task as primary context.
4. Read only the additional source-of-truth sections needed for the requested change.

For broad source-of-truth, planning, archive, or reconciliation tasks, read the documents named by the task and preserve the source priority below.

## Source priority

1. Current explicit user instruction/task.
2. `docs/project-spec.md` for product scope, requirements, durable constraints, business rules, and acceptance criteria.
3. `docs/ai-coding-workflow.md` for AI-assisted development process.
4. `docs/ci-cd-rules.md` for CI/CD, deployment, migrations, secrets, and runtime safety.
5. `docs/delivery-plan.md` for the current delivery dashboard.
6. `docs/architecture.md` for supporting component/runtime map.
7. Current code/configuration as implementation evidence, not automatic product authority.
8. Tests/CI as verification evidence.
9. Runbooks, archive, and historical/supporting docs as subordinate context.

If sources conflict, report the conflict and do not silently rewrite product scope to match code or history.

## Focused task rules

- Make the smallest safe change that satisfies the task.
- Do not perform broad audits, refactors, dependency upgrades, cleanup, CI/CD changes, deployment changes, runtime changes, or documentation rewrites unless explicitly requested.
- Inspect only code, tests, configuration, and docs directly related to the task.
- Do not modify product code, tests, migrations, Docker/Compose, GitHub Actions, secrets, runtime config, deployment scripts, or notebooks unless the task explicitly asks for that surface.
- Never print or commit secrets, credentials, tokens, private operational values, transcript bodies, raw provider responses, or raw Google responses.

## Document routing

- Read `docs/project-spec.md` when product behavior, data/state, integrations, safety boundaries, scope, or acceptance criteria are affected.
- Read `docs/delivery-plan.md` when current delivery state, active item, next item, blockers, or validation notes are relevant.
- Do not read `docs/delivery-plan-archive.md` for ordinary focused tasks; use it only for explicit historical/archive/reconciliation work.
- Read `docs/ci-cd-rules.md` before any CI/CD, deployment, Docker, VPS/server, secrets, runtime, migration, backup, restore, rollback, or stateful-service task.
- Read component-specific specs/runbooks only when the task touches that component or the prompt names the document.
- Do not create `docs/context-bundle-builder/MASTER_SPEC.md` or `docs/ai-delivery-infrastructure-plan.md` unless the corresponding real workstream exists and the task requests it.

## Repository checks

Use existing commands where relevant:

```text
Install: `python -m pip install -r requirements-dev.txt -c constraints-dev.txt` for repository checks; Colab keeps its separate runtime requirements.
Lightweight checks: python scripts/ci_checks.py
Python tests: pytest -q
Docs diff check: git diff --check
Colab runtime: manually run notebooks/elevenlabs_api_colab.ipynb in Google Colab.
Studio frontend: inspect apps/studio/package.json; existing scripts are dev, lint, test, and build.
Studio backend: use existing pytest/config commands for apps/studio-api scope.
Studio deploy/runtime: follow docs/ci-cd-rules.md and the relevant runbook.
```

For docs-only changes, prefer `git diff --check`, available markdown/link checks, and targeted `rg` searches over runtime integration tests.

## Done means

- Requested focused change is implemented within scope.
- Required documentation updates are made only where applicable.
- Relevant checks are run or limitations are stated.
- Final response reports changed files, validation, risks, and any unresolved decisions.

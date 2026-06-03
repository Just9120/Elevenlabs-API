# CI/CD Rules

Status: CI-only repo adaptation / skeleton.

## Current mode

- Current repository mode: CI only.
- CD/deploy is not adopted.
- No VPS/SSH/`DEPLOY_*` secrets are required.
- No Docker deploy is used.
- There is no production server target for this repository.

## CI rules

GitHub Actions CI should remain lightweight and repository-local:

- Run on `pull_request`.
- Run on `push` to `main`.
- Support manual `workflow_dispatch`.
- Use minimal permissions, currently `contents: read`.
- Use a concurrency guard to cancel stale runs for the same workflow/ref.
- Set up Python 3.11.
- Install development dependencies from `requirements-dev.txt`.
- Run `python scripts/ci_checks.py`.
- Run `pytest -q`.
- Print `CI_OK` after successful checks.
- Do not use production secrets.
- Do not access Google Drive/Docs runtime state.
- Do not call provider/STT/LLM APIs.
- Do not deploy.

## CD rules

CD is inactive and out of scope for this repository.

If CD/deploy is ever adopted, it must be introduced as a separate future delivery item with an explicit target, security model, validation plan, and user approval. CI and CD must remain separate, and CI must not deploy.

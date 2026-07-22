# Validation runbook

This runbook consolidates repository validation commands and manual evidence checklists. It is not proof of production-live Studio processing by itself.

## Safe evidence rules

Do not record secrets, provider API keys, OAuth tokens, refresh tokens, document IDs/URLs, folder IDs, account data, source bytes, transcript bodies, document bodies, raw provider responses, raw Google responses, private paths, stack traces with sensitive values, or production credential values.

Classify manual evidence as `pass`, `fail`, `blocked`, or `not-run`.

## Repository checks

Use the smallest relevant checks for the task.

```bash
# Whitespace/diff safety
 git diff --check

# Lightweight Python/static repository checks
 python scripts/ci_checks.py

# Python tests
 pytest -q
```

### Portable local Python profile

On a workstation without the repository's PostgreSQL/Redis services or a bash runtime, run:

```bash
pytest -q --portable
```

The repository pytest configuration limits discovery to the owned `tests/` tree so installed dependency suites inside a local virtual environment are never collected. The portable option additionally prevents collection—and therefore import-time setup—of the two PostgreSQL/Redis suites and the four bash integration suites. It still runs the remaining Python tests and is intended as a fast cross-platform baseline. It is not a replacement for plain `pytest`, which remains the required CI/service-backed suite and is unchanged when `--portable` is absent.

For Studio frontend changes, inspect `apps/studio/package.json` and run the relevant existing npm scripts from `apps/studio/` when dependencies are available.

### Studio processing E2E

The deterministic source-level processing scenario is:

```bash
pytest -q tests/test_studio_processing_e2e.py
```

It requires the same PostgreSQL database, current Alembic head, and Redis service used by repository CI. A developer run without those services is reported as skipped; `CI=true` makes either missing service a failure. The test creates the project, credential, source, output destination, and job through the authenticated API, runs the real claim/orchestration/persistence path, replaces only storage, ElevenLabs, and Google network boundaries with controlled fakes, then verifies the completed job and explicit browser-safe output DTO. It is not a real-browser test and does not replace the controlled production canary.

### Studio authenticated browser E2E

From `apps/studio/`, Playwright discovery can be checked without starting a browser:

```bash
npm run test:e2e:list
```

The full scenario is run by the `browser-e2e` job in `.github/workflows/studio-ci.yml`. That job creates an isolated PostgreSQL database named `studio_browser_e2e`, starts Redis, applies the current migrations, seeds synthetic owner-scoped state, starts the real FastAPI and Vite servers, and runs:

```bash
npm run test:e2e
```

The scenario uses headless Chromium through the same-origin Vite proxy. It verifies real login/session/CSRF behavior, authenticated project creation, safe completed-result rendering, and logout. It does not call ElevenLabs, Google, S3/R2, production infrastructure, or the deployed public host, and it does not replace the controlled production canary. On failure, the GitHub job uploads the Playwright trace and screenshot directory as a short-lived artifact.

A full local run requires the same isolated database name, test-only environment, migrations, seed, Redis service, and Playwright Chromium installation as the GitHub job. Do not point the seed at a shared, development, staging, or production database; the seed fails closed unless the exact isolated localhost test boundary is present and the user table is empty.

## Reproducible Python dependencies

Repository/CI development installs use the input requirements together with the committed transitive constraints:

```bash
python -m pip install -r requirements-dev.txt -c constraints-dev.txt
```

The Studio API container applies `apps/studio-api/constraints.txt` to `apps/studio-api/requirements.txt`. These constraints do not replace `requirements-colab.txt` when installing the stable Colab runtime.

After an intentional Python dependency change, regenerate both constraints with the pinned generator and review the complete diff before testing:

```bash
python -m pip install pip-tools==7.6.0
python -m piptools compile --resolver=backtracking --strip-extras --newline=LF --output-file=apps/studio-api/constraints.txt apps/studio-api/requirements.txt
python -m piptools compile --resolver=backtracking --strip-extras --newline=LF --output-file=constraints-dev.txt requirements-dev.txt
```

Constraints are installed with `-c`; they are not standalone cross-platform requirements files. This preserves platform-specific dependencies selected by extras while constraining the shared resolution.

The `Dependency audit` GitHub Actions workflow runs weekly and via `workflow_dispatch`. It audits the exact npm lock and an installed Linux/Python 3.11 graph. Findings fail only that reporting workflow; ordinary PR/push CI does not call advisory services. Treat service outages as `blocked` and rerun later rather than recording a vulnerability or a pass.

For docs-only changes, run `git diff --check`, available markdown/link checks, targeted `rg` searches for stale links/conflicting claims, and a docs-only changed-file review. Runtime integration tests are not required unless the task explicitly asks for them.

## Markdown link check pattern

When no dedicated markdown link checker exists, a repository-local script may parse markdown links and verify relative targets. It should ignore external URLs, anchors, mailto links, and intentionally absent generated artifacts only if the task documents that limitation.

## Authority-reset searches

Useful checks for documentation authority work:

```bash
rg -n "record-only|record only" README.md AGENTS.md docs
rg -n "studio-processing-contract.md" README.md AGENTS.md docs
rg -n "production-live|production ready|production-ready" README.md AGENTS.md docs
rg -n "active item|Active item|ACTIVE" docs/delivery-plan.md
```

Migration references should match the factual repository head under `apps/studio-api/alembic/versions/`.

## Studio controlled canary checklist

Use this only with the Studio operations runbook. A successful canary requires all of the following without unsafe evidence:

- [ ] Intended commit/source state identified.
- [ ] Database revision equals repository Alembic head where required.
- [ ] Web/API health and deployment identity verified.
- [ ] Exactly one intended worker instance is running from the intended image.
- [ ] One test account/project/source/credential/Google connection/output folder is approved.
- [ ] One queued job is created; no duplicate job and no automatic retry.
- [ ] Worker claims the job and reaches a terminal normalized state.
- [ ] On success, exactly one persisted output row exists.
- [ ] On success, the operator confirms the expected Google document opens in the selected folder without recording its ID/URL/content.
- [ ] No secrets, transcript bodies, raw external payloads, source bytes, or private account data are recorded.

Failure, uncertainty, duplicate output, wrong folder, missing persisted output after possible document creation, or lease ambiguity blocks a production-live claim and requires follow-up reconciliation/recovery work.

## Colab batch validation checklist

- [ ] Launch `notebooks/elevenlabs_api_colab.ipynb` in Google Colab from the intended revision.
- [ ] Confirm required secrets are available without printing values.
- [ ] Run only approved safe sources.
- [ ] Confirm provider transcription, Google Docs delivery, manifest update/skip behavior, and analytics hygiene.
- [ ] Record only safe pass/fail metadata, not transcript content or raw provider/Google responses.

### Source-mode smoke

Validate each supported source contour when safe fixtures are available:

- [ ] computer single file;
- [ ] computer multiple files;
- [ ] Google Drive single file;
- [ ] Google Drive folder.

### Manifest and Drive workspace

- [ ] `VoiceOps Workspace/` exists.
- [ ] `VoiceOps Workspace/manifest/elevenlabs_transcription_manifest.json` exists.
- [ ] Legacy `_transcription_state` migration preserves existing history when legacy state is present.
- [ ] A repeated controlled run confirms manifest skip behavior and does not repeat paid transcription without a valid reason.
- [ ] Old state files are not manually deleted before reconciliation when legacy/current manifest conflict is observed.

### Analytics JSONL

Check `VoiceOps Workspace/analytics/elevenlabs_transcription_runs.jsonl`:

- [ ] file exists after a successful or best-effort analytics run;
- [ ] latest line is valid JSON;
- [ ] expected aggregate fields are present;
- [ ] no secrets or API keys;
- [ ] no transcript text;
- [ ] no Google Docs body;
- [ ] no raw provider payload;
- [ ] no raw Drive URLs;
- [ ] no full local paths.

### Provider matrix

Use non-sensitive fixtures only:

- [ ] ElevenLabs short file;
- [ ] OpenAI short file;
- [ ] OpenAI long-but-small file over the safe duration target of 1320 seconds;
- [ ] OpenAI oversized file exercising the 25 MB hard upload limit / 20 MB safe target split behavior;
- [ ] OpenAI diarization with a copied non-sensitive fixture.

### Manual segmentation

- [ ] segmentation is available only in one-source modes;
- [ ] segment order is deterministic;
- [ ] labels/titles are unique according to the UI rules;
- [ ] one output is created or skipped for each intended segment;
- [ ] provider settings remain unchanged per segment;
- [ ] OpenAI technical split can still run inside a segment when required.

### Colab stop conditions

Stop validation and investigate before repeating paid work on:

- manifest history missing after migration;
- unexpected paid retranscription on a repeated controlled run;
- duplicate or missing Google Docs output;
- unsafe analytics content;
- provider success without Google Docs and manifest success;
- unresolved legacy/current manifest conflict.

## Realtime Colab validation

Realtime Colab validation is experimental and lives in `docs/runbooks/realtime-colab.md`.

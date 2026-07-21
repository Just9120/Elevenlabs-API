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

For Studio frontend changes, inspect `apps/studio/package.json` and run the relevant existing npm scripts from `apps/studio/` when dependencies are available.

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

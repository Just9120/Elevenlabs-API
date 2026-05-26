# VoiceOps Workspace Runtime Validation Checklist

## Purpose

This runbook is a **runtime validation checklist** for the Drive state migration and analytics logging behavior introduced in PR #13. It is intended for later execution when a safe test transcription file is available.

This checklist specifically validates:

1. VoiceOps Workspace folder creation.
2. Legacy manifest migration from `_transcription_state`.
3. Manifest history preservation after migration.
4. Analytics JSONL creation.
5. Analytics record append after a run.
6. Analytics record hygiene (no secrets/transcript/raw provider payloads).
7. Existing manifest skip/retry behavior remains intact.

> Status note: This document is planning guidance only and does **not** mark any feature as smoke-tested or formally validated.

## Preconditions

- Run via the Google Colab launcher notebook (`notebooks/elevenlabs_api_colab.ipynb`).
- Use the current GitHub `main` branch.
- Legacy Drive state (`_transcription_state`) may already exist and may contain `elevenlabs_transcription_manifest.json`.
- Use a small, safe test media file when available.

## Checklist

### 1) Before run

- Inspect current Drive state folders.
- Record whether `_transcription_state` exists.
- Record whether legacy manifest file exists in `_transcription_state`.
- **Do not** manually delete old or new state folders/files before first validation run.

### 2) Start Colab

- Open `notebooks/elevenlabs_api_colab.ipynb`.
- Confirm notebook setup pulls the `main` branch.
- Confirm normal preflight output appears.

### 3) Run test transcription

- Use a small audio file.
- Provider path can be ElevenLabs primary flow.
- Record run context:
  - source mode;
  - file extension;
  - provider;
  - approximate duration (if known).

### 4) After run

Verify all of the following:

- `VoiceOps Workspace/` exists.
- `VoiceOps Workspace/manifest/elevenlabs_transcription_manifest.json` exists.
- Legacy manifest entries were preserved (no historical loss).
- `VoiceOps Workspace/analytics/elevenlabs_transcription_runs.jsonl` exists.
- Colab output includes:

```text
Analytics log updated: VoiceOps Workspace/analytics/elevenlabs_transcription_runs.jsonl
```

### 5) Analytics record inspection

- Confirm latest JSONL line parses as valid JSON.
- Confirm expected high-level fields are present (for example):
  - `source_mode`
  - `provider`
  - `model`
  - `status`
  - count metrics
  - timing metrics
- Confirm the record **does not** contain:
  - API keys/secrets;
  - transcript text;
  - raw provider responses;
  - Google Docs output content;
  - raw Drive URLs;
  - full local filesystem paths.

### 6) Conservative validation update (later)

Only **after** successful runtime validation execution:

- Update `VALIDATION_MATRIX.md`.
- Candidate rows to update later:
  - `Drive state folder substructure`
  - `Persistent performance analytics log`

Do **not** update those statuses now.

## Troubleshooting

- If both old and new manifest files exist, do not auto-delete either one; inspect manually first.
- If analytics write fails but transcription succeeds, record it as best-effort/non-fatal analytics behavior.
- If manifest history appears missing, stop and do not run repeated paid transcription until investigated.

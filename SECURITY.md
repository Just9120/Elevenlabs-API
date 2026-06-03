# SECURITY.md

## Security baseline (Colab-first)

This project is a **Google Colab-first transcription workflow**. Secrets, media files, and notebook outputs must be handled as sensitive data.

## Secrets and credentials

Never commit secrets to the repository, including:
- API keys (`ELEVENLABS_API_KEY`, `OPENAI_API_KEY`, legacy `ELEVEN_API_KEY`)
- Google OAuth / service account credentials
- `.env` files

Use Google Colab Secrets (`google.colab.userdata`) for runtime access.

## Colab outputs and logs

Notebook outputs can leak sensitive values, request payload details, or provider error bodies.

Security baseline in this PR:
- provider HTTP errors are logged with **safe diagnostics only**;
- raw response bodies are **not** printed to Colab output;
- only provider name, status code, endpoint without query parameters, and selected safe scalar JSON fields are logged (`detail`, `message`, `code`, `type`, `error.message`, `error.type`, `error.code`).

## Generated media and transcripts

Do not commit:
- downloaded media,
- extracted audio,
- generated transcripts,
- manifest exports from private runs,
- notebook `.ipynb` outputs containing user data.
- runtime analytics logs from Drive (`VoiceOps Workspace/analytics/elevenlabs_transcription_runs.jsonl`).

Analytics logs are runtime diagnostic artifacts. They must not store secrets, transcript text, raw provider response bodies, or Google Docs contents. Structured Google Docs output for new transcriptions must be produced from transcript text and runtime provider/model/language/speaker/timestamp metadata already available in memory; it must not embed source filename/source mode in the visible transcript metadata block, create mirrored Markdown artifacts, or perform extra provider/LLM/Docs readback calls for formatting.

Docs-only standardization for existing transcripts is a separate user-triggered Google Drive/Docs flow. Its reports separate selected-folder scan counters from apply impact counters. It reads existing Google Docs and, only in explicit apply mode, rewrites the same Google Doc in place. It must not call STT providers, diarization providers, ElevenLabs, OpenAI, or LLM APIs; must not create new Docs; must not create Markdown/JSON/mirrored folders/export artifacts; must not mutate manifest entries; must ignore PDFs and non-Google-Docs files; and must default to dry-run. It also must not print full transcript text in logs/reports. The older source-matching standardization flow is optional/legacy and should not be treated as the primary path for existing transcript standardization.

Unified manifest v2 maintenance is a schema-only docs metadata flow. Its reports must clearly separate selected-folder scan counters from global manifest before/after totals, and must not print transcript text. It may read Google Docs only to classify transcript structure for `standard_check`, but it must not store transcript text or Google Docs body content in `documents`, `sources`, backups, logs, analytics, or reports. Reconciliation/refresh may inspect manifest metadata fields such as `doc_id`, `doc_link`, `doc_name`, `source_name`, `status`, `source_type`, source signatures, and registration metadata; it must not store or print transcript text. Apply mode may store doc IDs, doc names, doc links, paths, MIME type, timestamps, separated document/source metadata, and classification metadata only. `standard_check` stores only `target_standard`, `detected_standard`, `status`, `checked_at`, and checker version. Dry-run must remain the default and read-only. When apply migrates v1 to v2, it writes a timestamped backup of the prior active manifest; that backup may contain prior operational metadata such as source names, document links, source signatures, and historical statuses, so treat backup files as sensitive operational metadata with the same access care as the active manifest. The unified manifest flow must not mutate Google Docs content, create Docs, call STT/provider/LLM APIs, or print full transcript text.

Runtime hygiene:
- startup cleanup removes only stale temp artifacts with project prefix `elevenlabs_api_`;
- cleanup is TTL-based (default 24h) and best-effort;
- generic `/tmp` files and arbitrary user media are not targeted.

## Supported operating model

The current manifest model is intended for **single-user / single-runtime Colab usage**. Parallel notebooks/tabs are not officially supported and may create state races.

## Incident handling recommendation

If secret leakage is suspected:
1. Revoke/rotate affected keys immediately.
2. Remove exposed artifacts from history if possible.
3. Re-run impacted jobs only after credential rotation.


## GitHub Colab launcher safety

`notebooks/elevenlabs_api_colab.ipynb` downloads executable code (`elevenlabs_api.py`) from the configured GitHub ref and executes it in Colab runtime.

Recommendations:
- use trusted refs only (default `main` or a reviewed commit SHA);
- prefer pinning `GITHUB_REF` to a commit SHA for reproducible runs;
- never commit notebook outputs or secrets from launcher/runtime sessions.

## CI credentials policy

The lightweight GitHub Actions CI is intentionally secretless:
- it must not require real ElevenLabs, OpenAI, or Google credentials;
- it must not perform real provider/API transcription calls;
- no CI-specific secrets are required for baseline hygiene checks.

If future workflows add integration/E2E checks, keep them isolated and explicitly gated before introducing any credentials.

- Retry logging for Google API transient failures is intentionally minimal and must not include request/response bodies, transcript text, tokens, or secrets.

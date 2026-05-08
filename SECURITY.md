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

## Supported operating model

The current manifest model is intended for **single-user / single-runtime Colab usage**. Parallel notebooks/tabs are not officially supported and may create state races.

## Incident handling recommendation

If secret leakage is suspected:
1. Revoke/rotate affected keys immediately.
2. Remove exposed artifacts from history if possible.
3. Re-run impacted jobs only after credential rotation.

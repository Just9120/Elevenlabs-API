# Transcription Workflow

Colab-based workflow for transcribing long audio and video files into Google Docs.

## What this project does

This project is designed for quality-first transcription of long Russian-language lectures, webinars, meetings, and study recordings.

Main workflow:
- source selection from local upload or Google Drive
- audio extraction from video when needed
- transcription through ElevenLabs as the primary provider
- OpenAI as fallback provider
- output directly to Google Docs
- manifest protection against duplicate paid runs
- import of existing transcripts into manifest without re-transcription

## Current provider strategy

- Primary: `ElevenLabs / scribe_v2`
- Fallback: `OpenAI / gpt-4o-transcribe`
- For speaker-separated meeting transcription: `OpenAI / gpt-4o-transcribe-diarize`

## Current status

Current main candidate version is based on the improved OpenAI fallback workflow with:
- provider dropdown
- Russian / Auto-detect language mode
- speaker split option
- smart split for OpenAI size limits
- overlap-aware merge
- silence-aware split
- no crash when `OPENAI_API_KEY` is missing unless OpenAI is actually selected

Important:
- ElevenLabs path is the main production path
- OpenAI fallback is implemented, but not all branches are fully validated by real end-to-end tests yet
- OpenAI diarization with chunking has known limitations on long recordings

## Key features

- Google Colab-based workflow
- Google Drive source support
- Google Docs output only
- output folder picker
- multiple source modes
- conflict modes
- chunked insert to Google Docs
- manifest with status tracking
- import existing transcripts / backfill
- optional keyterms
- optional speaker split

## Source modes

Supported source modes:
- local computer: single file
- local computer: multiple files
- Google Drive: single file
- Google Drive: folder

## Output

Output target:
- Google Docs only

Not used as final output:
- local transcript files
- JSON transcript exports

## Secrets

Secrets should not be stored in code.

Use Google Colab Secrets / userdata for:
- `ELEVENLABS_API_KEY`
- `OPENAI_API_KEY` (optional, only needed for OpenAI fallback)
- other Google-related credentials if applicable

Example pattern:

```python
from google.colab import userdata

ELEVENLABS_API_KEY = userdata.get("ELEVENLABS_API_KEY")
OPENAI_API_KEY = userdata.get("OPENAI_API_KEY")

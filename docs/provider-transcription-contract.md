# Batch provider transcription contract

This document records the current batch transcription provider contract. It does not describe or change realtime behavior.

## ElevenLabs batch

- UI default provider: ElevenLabs.
- Model: `scribe_v2`.
- Russian is selected by default; auto-detect is available.
- `no_verbatim=false`.
- `temperature=0`.
- `tag_audio_events=false`.
- Keyterms are optional.
- Speaker separation is optional.

## OpenAI batch

- Standard model: `gpt-4o-transcribe`.
- Speaker/diarized model: `gpt-4o-transcribe-diarize`.
- Media is prepared as mono AAC M4A before upload.
- Automatic splitting is based on both prepared file size and prepared audio duration.
- Hard upload limit: 25 MB.
- Safe per-part size target: 20 MB.
- Observed hard duration limit: 1400 seconds.
- Safe per-part duration target: 1320 seconds.
- Speaker labels are provider labels only. They are not identity claims.
- OpenAI chunk timing is local diagnostic console output only; it does not persist transcript text, source paths, filenames, Google Docs identifiers, provider payloads, keys, raw responses, or source metadata beyond aggregate chunk duration and size.
- OpenAI realtime is not part of this batch contract.

## Manual validation checklist

- ElevenLabs short file.
- OpenAI short file.
- OpenAI long-but-small file above 1320 seconds.
- OpenAI oversized file.
- OpenAI diarization on a copied non-sensitive test recording.

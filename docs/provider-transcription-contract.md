# Batch provider transcription contract

This document records the current batch transcription provider contract. It does not describe or change realtime behavior.

## Manual user segmentation pre-layer

Optional manual project segmentation runs before batch provider transcription and only in one-source modes. Each temporary user segment is an audio-only M4A input submitted through the same selected provider settings as a normal source file; ElevenLabs and OpenAI request payload contracts remain unchanged per segment, and OpenAI smart split may still run inside an OpenAI segment. Optional per-segment Google Doc titles and local suffix allocation are output-only naming controls; they do not change provider requests, provider payloads, selected provider settings, or OpenAI split behavior.

## ElevenLabs batch

- UI default provider: ElevenLabs.
- Model: `scribe_v2`.
- Russian is selected by default; auto-detect is available.
- `no_verbatim=false`.
- `temperature=0`.
- `tag_audio_events=false`.
- Keyterms are optional.
- Speaker separation is optional.

## Studio ElevenLabs internal subset

The Studio server-side boundary currently supports only a conservative internal single-source ElevenLabs subset: one already-materialized source for an already-leased `processing` job, one synchronous `scribe_v2` request, `no_verbatim=false`, `temperature=0`, `tag_audio_events=false`, `diarize=false`, and `use_multi_channel=false`. It omits `language_code` when the already-validated job language is absent so provider auto-detection remains available. It does not implement keyterms, diarization, multi-channel processing, webhooks, async polling, `source_url`, `cloud_storage_url`, OpenAI, output persistence, Google Docs creation, job completion, or manifest mutation. The existing batch defaults above remain unchanged.

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

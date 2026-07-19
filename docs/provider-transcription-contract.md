# Provider transcription contract

This is a compact current component contract. Product authority remains `docs/project-spec.md`; architecture boundaries remain `docs/architecture.md`; validation coverage lives in `docs/runbooks/validation.md`.

## Colab batch providers

- Default/primary provider: ElevenLabs `scribe_v2`.
- OpenAI standard provider: `gpt-4o-transcribe`.
- OpenAI speaker-aware provider: `gpt-4o-transcribe-diarize`.

## ElevenLabs Colab defaults

- Russian is selected by default; provider auto-detection is available when no runtime language code is supplied.
- `no_verbatim=false`.
- `temperature=0`.
- `tag_audio_events=false`.
- Keyterms are optional.
- Speaker separation is optional in the Colab batch path.

## Studio ElevenLabs subset

Studio currently has a source-level ElevenLabs-only subset: one already-materialized source for an already-leased `processing` job, one synchronous `scribe_v2` call, `no_verbatim=false`, `temperature=0`, `tag_audio_events=false`, `diarize=false`, and no multi-channel mode. OpenAI Studio processing parity is unfinished and must not be claimed from the Colab provider paths.

## OpenAI long-media constraints

OpenAI batch media is prepared as mono AAC M4A before upload. Splitting occurs before provider submission.

- Hard upload limit: 25 MB.
- Safe per-part size target: 20 MB.
- Observed hard duration boundary: 1400 seconds.
- Safe per-part duration target: 1320 seconds.
- Diarization/chunk merging remains a quality-risk area.

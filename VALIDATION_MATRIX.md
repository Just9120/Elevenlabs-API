# VALIDATION_MATRIX

Legend:
- **Observed in user practice** = overall Colab workflow used in real runs (over one month) without critical user-reported issues.
- **Smoke-tested by user** = user confirmed at least one real run worked, but full scenario-level E2E coverage is not yet documented.
- **Formally validated** = validated with explicit reproducible checks.
- **TBD / needs E2E validation** = expected path but requires dedicated end-to-end run.
- **Experimental** = available but still under exploratory use.
- **High risk** = known quality/reliability caveats.
- **Not supported** = outside current operating model.

Important: observed operational usage is **not** equivalent to formal E2E validation for every specific mode below.

| Scenario | Initial status | Notes |
|---|---|---|
| General Colab workflow | Observed in user practice | Used in practice for over one month without critical user-reported issues. |
| GitHub Colab launcher notebook | Smoke-tested by user | Thin launcher that fetches and executes canonical elevenlabs_api.py from configured GitHub ref. |
| Transcription through GitHub Colab launcher | Smoke-tested by user | User confirmed a successful transcription run; scenario details not yet broken down by source mode, media type, duration, and provider. |
| GitHub Actions lightweight CI | TBD / needs first run validation | Static repository hygiene checks only; no real STT or Google API calls. |
| Startup stale temp cleanup (`elevenlabs_api_*`, TTL-based) | TBD / needs runtime validation | Static inspection done; needs reproducible runtime cleanup check. |
| ElevenLabs + local single audio | TBD / needs E2E validation | Main path; requires explicit reproducible validation record. |
| ElevenLabs + local multiple files | TBD / needs E2E validation | Batch mode needs explicit E2E run logs. |
| ElevenLabs + Google Drive file | TBD / needs E2E validation | Supported mode; needs scenario-level validation evidence. |
| ElevenLabs + Google Drive folder | TBD / needs E2E validation | Supported mode; needs scenario-level validation evidence. |
| ElevenLabs + 1 hour audio | TBD / needs E2E validation | Needs documented repeatable E2E check. |
| ElevenLabs + 3 hour audio | TBD / needs E2E validation | Conservative changes only; validate on real files. |
| ElevenLabs + 5 hour audio | TBD / needs E2E validation | Evidence-driven before introducing client-side split. |
| Video to audio extraction to ElevenLabs | TBD / needs E2E validation | Existing flow; requires explicit E2E confirmation. |
| Google Docs chunked insert | TBD / needs E2E validation | Core output path; needs explicit scenario validation. |
| Manifest skip on repeated run | TBD / needs E2E validation | Prevents duplicate billing/transcription; verify with controlled rerun. |
| Manifest after failed run | TBD / needs E2E validation | Verify recovery behavior with controlled failed run. |
| Import existing / backfill | TBD / needs E2E validation | Feature exists; requires explicit E2E script. |
| OpenAI manual fallback path | Experimental | Manual/alternative provider, not automatic fallback. |
| OpenAI >25MB chunking | Experimental | Implemented path requires broader E2E coverage. |
| OpenAI diarization | Experimental | Speaker-aware output requires more validation. |
| OpenAI diarization + chunking | High risk | Known risks in speaker segmentation consistency. |
| Parallel notebooks / two Colab tabs | Not supported | Manifest model is single-user/single-runtime. |

# VALIDATION_MATRIX

Legend:
- **Observed in user practice** = used in real runs (over one month) without critical user-reported issues.
- **Formally validated** = validated with explicit reproducible checks.
- **TBD / needs E2E validation** = expected path but requires dedicated end-to-end run.
- **Experimental** = available but still under exploratory use.
- **High risk** = known quality/reliability caveats.
- **Not supported** = outside current operating model.

| Scenario | Initial status | Notes |
|---|---|---|
| ElevenLabs + local single audio | Observed in user practice | Main path in Colab workflow. |
| ElevenLabs + local multiple files | Observed in user practice | Batch mode used in practice. |
| ElevenLabs + Google Drive file | Observed in user practice | Supported source mode. |
| ElevenLabs + Google Drive folder | Observed in user practice | Supported source mode. |
| ElevenLabs + 1 hour audio | Observed in user practice | User-reported stable behavior. |
| ElevenLabs + 3 hour audio | TBD / needs E2E validation | Conservative changes only; validate on real files. |
| ElevenLabs + 5 hour audio | TBD / needs E2E validation | Evidence-driven before introducing client-side split. |
| Video to audio extraction to ElevenLabs | Observed in user practice | Existing conversion flow in Colab. |
| Google Docs chunked insert | Observed in user practice | Core output path. |
| Manifest skip on repeated run | Observed in user practice | Prevents duplicate billing/transcription. |
| Manifest after failed run | TBD / needs E2E validation | Verify recovery behavior with controlled failed run. |
| Import existing / backfill | TBD / needs E2E validation | Feature exists; requires explicit E2E script. |
| OpenAI manual fallback path | Experimental | Manual/alternative provider, not automatic fallback. |
| OpenAI >25MB chunking | Experimental | Implemented path requires broader E2E coverage. |
| OpenAI diarization | Experimental | Speaker-aware output requires more validation. |
| OpenAI diarization + chunking | High risk | Known risks in speaker segmentation consistency. |
| Parallel notebooks / two Colab tabs | Not supported | Manifest model is single-user/single-runtime. |

# Delivery plan: Elevenlabs-API

## Operational dashboard

- ✅ **DOCS-REF-01 — Documentation reconciliation and architecture baseline** — current docs-only reconciliation target for merged realtime work; no runtime behavior change.
- 👉 **RT-REF-01 — Refactor realtime frontend boundaries and harden permission-cancellation lifecycle** — current recommended next delivery item.
- 📋 **RUNTIME-01 — Batch source picker / manifest skip / Google Docs output smoke-check** — planned manual Colab/Drive/Docs validation.
- 📋 **SPEAKER-RUNTIME-01 — Speaker projects workflow on copied diarized Google Doc** — planned manual validation.
- 📋 **PERF-RUNTIME-01 — Startup timing summary collection** — planned runtime diagnostics validation.
- 📋 **LIVE-COLAB-PROXY-01 remaining validation** — planned realtime manual validation gaps.

## Current checkpoint

Batch Colab remains the stable/fallback product workflow. Docs-only maintenance workflows remain separate and must not call provider/STT/LLM APIs. Realtime Colab/proxy remains an experimental contour for browser capture + ElevenLabs realtime STT and must not save Google Docs, mutate `manifest`, or integrate speaker projects.

Current confirmed realtime evidence is partial: one display+microphone run confirmed standalone page boot, capture, WebSocket open, `session_started`, partial transcript, committed transcript, user Stop, media-track release and WebSocket close. Full realtime E2E success is not claimed.

## Completed milestone summary

- README/project docs were converted to Russian-first source-of-truth/navigation model.
- `docs/project-spec.md` is the active product contract.
- `VALIDATION_MATRIX.md` is the evidence/status truth table.
- Batch source/output folder distinction, safe skip / `Пропустить`, docs-only boundaries and speaker project safety boundaries are documented.
- Realtime notebook/runtime/proxy bridge exist with static/generated-JS validation and partial manual display+microphone evidence.
- Output-cell realtime UI path is documented as blocked in the tested Colab runtime.

## Active recommended next item

### RT-REF-01 — Refactor realtime frontend boundaries and harden permission-cancellation lifecycle

Planned scope only; do not implement as part of docs-only reconciliation:

- move realtime frontend responsibilities into clearer boundaries;
- preserve existing proxy/token/WebSocket behavior;
- add cancellation protection while browser permission prompts are open;
- preserve browser-only live transcript rendering with `realtime_live_transcript_v1`;
- preserve no Google Docs save, no `manifest` mutation and no speaker project integration;
- require focused static tests and fresh manual realtime validation after refactor.

Suggested implementation seams are described in `docs/architecture.md` as recommendations, not current implementation facts.

## Near backlog

### RUNTIME-01 — batch runtime smoke validation

Validate in real Colab/Drive/Docs:

- launch `notebooks/elevenlabs_api_colab.ipynb` from `main` or selected commit SHA;
- verify relevant Colab Secrets without printing values;
- select source through Drive picker button path;
- create Google Docs transcript in selected output folder;
- verify `manifest` source/document update;
- rerun same source and confirm safe skip / `Пропустить` without repeat provider/STT call;
- record result in `VALIDATION_MATRIX.md` only after factual validation.

### SPEAKER-RUNTIME-01 — speaker project validation

Validate on copied diarized Google Doc only:

- gate behavior for `Speakers: no`, `Speakers: yes` and unknown metadata where possible;
- turn-boundary `Speaker N labels` detection;
- counts/sample display without persistence;
- manual mapping and explicit apply;
- unmapped labels unchanged;
- plain-text rewrite/formatting impact.

### PERF-RUNTIME-01 — startup timing collection

Collect timing from clean Colab runtime and confirm summary contains no secrets, transcript body, Docs body content or raw provider responses. Do not treat timing as transcription success.

### LIVE-COLAB-PROXY-01 remaining validation

Use `docs/realtime-colab.md` as the operator guide. Pending: microphone-only, display-only, loopback/virtual input, permission cancellation, refreshed-device UX, structured `realtime_live_transcript_v1` behavior and cross-browser validation.

## Blockers and validation notes

- Realtime output-cell UI path is blocked in the tested Colab runtime; active validation path is proxy/new-tab standalone page.
- Realtime evidence is partial and must not be generalized beyond the confirmed display+microphone path.
- Batch Google Docs output and manifest skip still need controlled live runtime validation before E2E claims.
- OpenAI diarization + chunking remains high risk due to potential inconsistent `Speaker N labels` across chunks.
- Speaker project apply may rewrite Google Doc as plain text; first validation must use copies.

## Docs-only PR validation

For documentation-only PRs, run:

```bash
python scripts/ci_checks.py
pytest -q
git diff --check
```

If runtime code/notebooks/token flow/Google Docs behavior/manifest behavior are untouched, state that explicitly in the PR and final response. Local checks do not replace manual Colab runtime validation.

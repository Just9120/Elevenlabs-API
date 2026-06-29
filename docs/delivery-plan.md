# Delivery plan: Elevenlabs-API

## Operational dashboard

- ✅ **DOCS-REF-01 — Documentation reconciliation and architecture baseline** — merged/completed docs-only reconciliation; no runtime behavior change.
- ✅ **RT-REF-01 — Refactor realtime frontend boundaries and harden permission-cancellation lifecycle** — merged into main via PR #65; static/generated-JS coverage added; manual permission-cancellation validation remains pending under LIVE-COLAB-PROXY-01.
- ✅ **RT-POLISH-01 — Behavior-preserving realtime frontend lifecycle readability refactor** — merged into main; no new manual/browser evidence claimed.
- ✅ **RT-TOKEN-01 — Fresh realtime single-use token per standalone Start attempt** — done/merged into main; sequential Start → Stop → Start in one standalone page was manually confirmed after RT-TOKEN-01.
- ✅ **OPENAI-BATCH-DURATION-01 — OpenAI batch duration-aware splitting** — manually runtime-confirmed for one long duration-triggered OpenAI batch run that produced a Google Doc; oversized-file and OpenAI diarization runtime validation remain pending.
- ✅ **OPENAI-BATCH-TIMING-01 — Safe OpenAI per-chunk timing observability** — implemented as local diagnostics; manual review remains separate.
- ✅ **USER-SEGMENTS-VISUAL-BUILDER-01 — Visual multi-document segmentation builder** — completed/merged via PR #75; raw manual segment text input replaced with a one-source-only visual builder before provider transcription.
- ✅ **USER-SEGMENTS-HARDENING-01 — Harden visual segment builder validation** — completed follow-up; full-chain add validation, correct-card add errors, and regression coverage added.
- 👉 **PWA-FOUNDATION-01 — Studio PWA foundation and isolated delivery boundary** — current recommended item for a UI-only, deployable PWA contour at `studio.librechat.online`; no provider, Google, queue, persistence or transcription runtime.
- 📋 **RUNTIME-01 — Batch source picker / manifest skip / Google Docs output smoke-check** — deferred by current product priority; still planned manual Colab/Drive/Docs validation without claiming pass/fail.
- 📋 **LIVE-COLAB-PROXY-01 remaining validation** — separate unfinished manual realtime validation gaps after RT-TOKEN-01.
- 📋 **SPEAKER-RUNTIME-01 — Speaker projects workflow on copied diarized Google Doc** — planned manual validation.
- 📋 **PERF-RUNTIME-01 — Startup timing summary collection** — planned runtime diagnostics validation.

## Current checkpoint

Batch Colab remains the stable/fallback product workflow. Docs-only maintenance workflows remain separate and must not call provider/STT/LLM APIs. Realtime Colab/proxy remains an experimental contour for browser capture + ElevenLabs realtime STT and must not save Google Docs, mutate `manifest`, or integrate speaker projects.

Current confirmed realtime evidence is partial: one display+microphone run confirmed standalone page boot, capture, WebSocket open, `session_started`, partial transcript, committed transcript, user Stop, media-track release and WebSocket close. After RT-TOKEN-01, the standalone page also manually confirmed sequential Start → Stop → Start without page reload: both sessions reached WebSocket open and `session_started`, both stopped cleanly, and the final close was user-initiated with code 1000. Full realtime E2E success is not claimed.

## Completed milestone summary

- README/project docs were converted to Russian-first source-of-truth/navigation model.
- `docs/project-spec.md` is the active product contract.
- `VALIDATION_MATRIX.md` is the evidence/status truth table.
- Batch source/output folder distinction, safe skip / `Пропустить`, docs-only boundaries and speaker project safety boundaries are documented.
- Realtime notebook/runtime/proxy bridge exist with static/generated-JS validation and partial manual display+microphone evidence.
- Output-cell realtime UI path is documented as blocked in the tested Colab runtime.

## Active recommended next item

### PWA-FOUNDATION-01 — Studio PWA foundation

Current recommended next item: establish `apps/studio/`, PWA-only CI/CD scaffolding and localhost-only `studio-web` deployment boundary for `studio.librechat.online`. This item is UI-only and must not add provider calls, Google integration, uploads, queues, databases, workers, persistence or changes to Colab runtime behavior.

### RUNTIME-01 — batch runtime smoke validation

RUNTIME-01 is deferred by current product priority, not passed or failed. It remains a separate manual Colab/Drive/Docs batch smoke validation item, including the visual user-segment builder, selected output folder, Google Docs creation, and `manifest` skip behavior. Do not claim runtime success until this is executed in Colab and recorded with factual evidence.

### USER-SEGMENTS-VISUAL-BUILDER-01 / USER-SEGMENTS-HARDENING-01 — Visual multi-document segmentation builder

USER-SEGMENTS-VISUAL-BUILDER-01 is completed/merged via PR #75. USER-SEGMENTS-HARDENING-01 is the completed follow-up that hardens the add-part path by validating the full existing chain in order, reporting add errors on the first failing card, and keeping canonical segment construction defensive. Static/unit coverage was added; manual Colab runtime validation remains separate under RUNTIME-01.

### OPENAI-BATCH-TIMING-01 — Safe OpenAI per-chunk timing observability

OpenAI timing diagnostics remain separate from USER-SEGMENTS-01 manual runtime validation. OpenAI smart split may still happen inside an OpenAI user segment, but manual project segmentation must not replace provider-path safeguards.

### OPENAI-BATCH-DURATION-01 — OpenAI batch duration-aware splitting

Duration-triggered OpenAI splitting is manually runtime-confirmed for one long batch run that produced a Google Doc. Oversized-file validation and OpenAI diarization validation remain pending; do not generalize the long-file result to those paths.

### LIVE-COLAB-PROXY-01 remaining validation

Current recommended manual runtime scope after RT-TOKEN-01. RT-TOKEN-01 is done/merged into `main`; repeated Start → Stop → Start in one standalone page was manually confirmed after RT-TOKEN-01, including fresh per-Start token behavior sufficient for sequential sessions without page reload. Remaining validation gaps are preserved below:

- validate the standalone Colab proxy/new-tab page from `main` or the merged RT-REF-01 commit;
- confirm microphone/input-only, display-only and display+microphone capture behavior where browser permissions and devices are available;
- manually validate explicit Stop while display, microphone or mixed-source prompts are pending, or record browser prompt modality as not tested when it blocks interaction with `Остановить`; ordinary browser deny/cancel before WebSocket creation has partial manual evidence only;
- confirm refreshed-device UX after Stop/cancelled attempts;
- verify `realtime_live_transcript_v1` browser-only copy/download/clear behavior for committed text;
- preserve the realtime boundaries: no Google Docs save, no `manifest` mutation, no batch analytics mutation and no speaker project integration;
- do not record API keys, one-time tokens, private audio, raw transcript content, raw provider payloads or browser identity.

RT-REF-01 is complete and merged into `main` via PR #65. RT-POLISH-01 and RT-TOKEN-01 are merged into `main`. Static/generated-JS coverage does not replace the remaining live browser/Colab validation above; the sequential same-page repeat-session path is manually confirmed, but the other realtime validation gaps remain pending.

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

Use `docs/realtime-colab.md` as the operator guide. Pending: microphone-only, display-only, loopback/virtual input, explicit Stop-during-prompt cancellation, refreshed-device UX, structured `realtime_live_transcript_v1` copy/download/clear behavior and cross-browser validation. Ordinary browser deny/cancel before WebSocket creation has partial manual evidence only.

## Blockers and validation notes

- Realtime output-cell UI path is blocked in the tested Colab runtime; active validation path is proxy/new-tab standalone page.
- Realtime evidence is partial and must not be generalized beyond the confirmed display+microphone path.
- Batch Google Docs output and manifest skip still need controlled live runtime validation before E2E claims.
- OpenAI duration-triggered chunking has one manually confirmed long-file Google Docs output path; oversized-file and OpenAI diarization validation remain pending.
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

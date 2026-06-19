# Validation matrix

## Легенда

Этот файл — evidence/status truth table. Он фиксирует CI/static/manual evidence и не заменяет product spec, delivery plan или operator guides.

- **CI validated** — проверено локальными/CI командами, без live Colab/Drive/Docs/browser доказательств.
- **Unit/static-tested** — покрыто тестами или static/source checks, но не доказывает runtime provider/browser/API behavior.
- **Partial manual evidence** — вручную подтверждён конкретный ограниченный path; нельзя расширять claim на весь contour.
- **Needs runtime validation** — требуется ручная проверка в Colab/Drive/Docs/browser/provider.
- **Experimental** — путь существует, но E2E уверенность недостаточна.
- **High risk** — известный риск требует отдельной validation plan.
- **Not supported** — scenario intentionally out of scope.

## Evidence table

| Область | Статус | Evidence / notes |
| --- | --- | --- |
| Thin batch Colab launcher | CI validated | `scripts/ci_checks.py` проверяет notebook hygiene: thin launcher, no committed outputs/execution counts. |
| Batch runtime helper guardrails | Unit/static-tested | Existing tests/source checks cover helper logic, safety guards and selected UI behavior; live Colab/Drive/Docs smoke validation still required for E2E claims. |
| Raw provider body logging guard | CI validated | CI guard rejects obvious `resp.text` / `response.text` logging patterns. |
| Temporary cleanup safety | CI validated | CI guard rejects broad `/tmp` cleanup patterns. |
| README/docs synchronization | Docs-only / CI validated | Docs are maintained as source-of-truth/navigation/evidence files. This does not change runtime behavior. |
| Source folder vs output folder wording | Unit/static-tested / needs runtime validation | UI/docs distinguish source folder and result/output folder. Real Colab UX remains part of RUNTIME-01. |
| Google Drive picker buttons primary path | Unit/static-tested / needs runtime validation | Buttons are documented as reliable primary path; browser confirmation in Colab remains needed. |
| Drive picker double-click | Unit/static-tested / needs runtime validation | Double-click is convenience only. `drive_multi` remains explicit/button-based and must not become folder scan. |
| Google Docs transcript creation | Unit/static-tested helpers / needs E2E validation | Real Google Doc creation from a provider run requires RUNTIME-01. |
| Manifest skip protection | Unit-tested / needs E2E validation | Current-format source/document behavior is helper-tested; controlled rerun must confirm safe skip without repeat provider call. |
| Docs-only standardization | Unit-tested / needs E2E validation | Dry-run/apply logic and no-provider boundaries have test coverage; real Google Docs rewrite requires manual validation. |
| Manifest maintenance | Unit-tested / needs E2E validation | Reconciliation/refresh helpers are covered; real Drive backup/write behavior requires manual validation. |
| No transcript body / Docs body in `manifest` or analytics | Unit/static-tested guardrails / ongoing review | Safety requirement remains active for future fields and reports. |
| No provider/STT/LLM calls in docs-only workflows | Unit/static-tested | Runtime observation should still verify no unexpected calls during manual validation. |
| Analytics JSONL and startup timing | Unit/static-tested / needs runtime collection | Diagnostics exist; PERF-RUNTIME-01 must collect real Colab timing before performance claims. |
| Optional speaker project workflow | Unit/static-tested / manual validation required | Label detection, mapping, preview and safety guardrails are tested. Live workflow must be tested on copied diarized Google Doc; current apply may rewrite as plain text. |
| Speaker projects are not voice identification | Safety requirement / ongoing review | Manual text-label mapping only; no voice samples, voiceprints, embeddings or biometric matching. |
| LIVE-COLAB-01 output-cell UI | Blocked | Tested Colab runtime did not attach active JS for inline `display(HTML(...))`, `IPython.display.Javascript(...)`, or `iframe srcdoc`. |
| LIVE-COLAB-PROXY-01 standalone page | Partial manual evidence / more validation pending | One manual run confirmed standalone page boot, display+microphone capture, WebSocket open, `session_started`, partial transcript, committed transcript, user Stop, media-track release and WebSocket close. This is not full realtime E2E validation. |
| Realtime generated frontend/static behavior | Unit/static-tested | Static/generated-JS checks cover local server/page builder, `/realtime.js` syntax, proxy-link output, source controls, one-time token exposure boundaries, Stop status preservation, failed mixed-capture cleanup, Russian-first UI copy and browser-only `realtime_live_transcript_v1` committed segments. |
| Realtime microphone/input-only capture | Pending runtime validation | Requires real browser permissions and input device; not manually confirmed. |
| Realtime tab/screen-audio-only capture | Pending runtime validation | Browser may not provide audio track; expected Russian no-audio-track behavior must be validated. |
| Realtime display+microphone capture | Partial manual evidence / more validation pending | One run confirmed the basic path; echo/double-audio behavior, other devices and other browsers remain pending. |
| Realtime loopback/virtual input route | Pending runtime validation | Treated as `Микрофон / аудиовход`; OS/browser exposure remains unvalidated. |
| Realtime permission-cancellation behavior | Pending runtime validation | Prompt cancellation lifecycle must be manually checked and is planned for hardening in RT-REF-01. |
| Realtime refreshed-device UX | Pending runtime validation | Device refresh behavior and label handling need manual confirmation. |
| Realtime structured live presentation | Pending focused validation | `realtime_live_transcript_v1` rendering is static-tested; manual verification of copy/download/clear behavior remains pending. |
| Realtime cross-browser coverage | Pending runtime validation | Current evidence must not be generalized across browsers. |
| ElevenLabs realtime WebSocket | Partial manual evidence / more validation pending | URL/config helpers are static-tested; one display+microphone run observed open, `session_started`, partial and committed events. Other source combinations remain pending. |
| Realtime single-use token safety | Static-reviewed / runtime pending | Browser should not receive `ELEVEN_API_KEY` or `ELEVENLABS_API_KEY`. Live token creation/log review remains pending across validation paths. |
| Realtime Google Docs save / manifest mutation / speaker integration | Not supported | Not part of current realtime contour. Any future save path requires separate scope and validation. |
| OpenAI provider paths | Experimental | Manual alternative paths require separate E2E validation, especially diarization and chunking. |
| Parallel notebooks / two Colab tabs | Not supported | Manifest model is single-user/single-runtime. |
| GitHub Actions CI | Must be checked per PR | Local checks are necessary but not identical to hosted CI. |

## Runtime validation backlog

- **RUNTIME-01** — source picker / `manifest` skip / Google Docs output smoke-check in real Colab.
- **SPEAKER-RUNTIME-01** — speaker project workflow on a copied diarized Google Doc, including formatting caveat.
- **PERF-RUNTIME-01** — collect startup timing summary from clean Colab runtime without treating it as transcription success.
- **LIVE-COLAB-PROXY-01** — continue realtime manual validation for microphone-only, display-only, loopback/virtual input, permission cancellation, refreshed-device UX, structured live presentation and cross-browser behavior.

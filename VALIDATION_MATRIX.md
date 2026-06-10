# Validation matrix

## Легенда

Этот файл — validation truth table для проекта. Он фиксирует, что реально покрыто CI/unit/static tests, а что требует ручной runtime validation в Google Colab/Google Drive/Google Docs.

Статусы должны оставаться консервативными:

- **CI validated** — проверено локальными/CI командами, без live Colab/Drive/Docs доказательств.
- **Unit/static-tested** — покрыто тестами или source/static checks, но не доказывает runtime browser/API behavior.
- **Needs runtime validation** — требуется ручная проверка в Colab/Drive/Docs.
- **Experimental** — путь существует, но не имеет достаточной E2E уверенности.
- **High risk** — известные риски требуют отдельного плана валидации.
- **Not supported** — сценарий не является поддерживаемым.

Docs-only CI не доказывает provider/STT/LLM или Google Docs E2E success. Не повышайте статус без фактических evidence notes.

## Матрица

| Область | Статус | Evidence / notes |
| --- | --- | --- |
| Thin Colab launcher | CI validated | `scripts/ci_checks.py` проверяет, что launcher notebook остается тонким, без embedded canonical workflow markers и без committed outputs. |
| Notebook hygiene | CI validated | Проверяется валидность `.ipynb`, отсутствие outputs и `execution_count`. |
| Raw provider body logging guard | CI validated | CI guard запрещает очевидные patterns печати/logging `resp.text` / `response.text`. |
| Temporary cleanup safety | CI validated | CI guard запрещает broad `/tmp` cleanup patterns. |
| README / docs source synchronization | Docs-only / CI validated | README, `docs/project-spec.md`, `docs/delivery-plan.md` и эта матрица синхронизированы как документация. Это не меняет runtime behavior и не доказывает E2E. |
| Project specification source of truth | Docs-only / needs ongoing review | `docs/project-spec.md` отражает current main after PR #47, включая optional speaker project rename workflow. Требует поддержки при изменении scope. |
| Source folder vs destination/output folder wording | Unit/static-tested historically / needs runtime validation | Документы и UI wording разделяют папку источника и папку результата. Реальная Colab UX проверка остается частью RUNTIME-01. |
| Drive source card/readability fixes | Unit/static-tested / needs Colab runtime validation | Drive picker UX fixes находятся в main, но visual/browser confirmation в реальном Colab все еще нужна. |
| Conflict default safe skip / `Пропустить` | Unit/static-tested / needs runtime validation | Default conflict behavior задокументирован как safe skip. Повторный live run должен подтвердить отсутствие повторного provider/STT call. |
| Drive picker buttons as primary path | Unit/static-tested / needs Colab runtime validation | Buttons считаются reliable primary path. Требуется ручная проверка в Colab browser. |
| Drive picker double-click: source/destination | Unit/static-tested / needs manual Colab validation | Double-click является convenience для supported contexts; не должен быть единственным path. Реальное browser behavior требует проверки. |
| `drive_multi` double-click fallback | Unit/static-tested / needs manual Colab validation | `drive_multi` остается explicit/button-based for safety и должен иметь fallback, если double-click ненадежен. Проверить в Colab browser. |
| Google Drive multi-file source selection | Unit-tested / needs Colab runtime validation | Должен обрабатывать только выбранные files, не folders, не recursion/folder scan. Нужна runtime проверка. |
| Google Drive folder source mode | Unit/static-tested / needs Colab runtime validation | Folder source processing и optional recursive scan требуют live Drive validation. |
| Local computer upload modes | Existing behavior / needs smoke validation | Локальные single/multi upload modes не менялись в docs cleanup; smoke-check полезен перед release claim. |
| Google Docs transcript creation | Unit/static-tested helpers / needs E2E validation | Создание реального Google Doc из transcription run требует RUNTIME-01. |
| `transcript_doc_v1.2` current standard detection | Unit-tested | Tests cover strict current/outdated/unstructured detection behavior for helper logic. Runtime Docs parsing still needs live validation when claims change. |
| Docs-only existing Google Docs standardization | Unit-tested / needs E2E validation | Dry-run/apply branching, reports and no-provider boundaries covered by tests; real Drive/Docs rewrite needs manual validation. |
| Existing Docs backfill metadata and Created-at preservation | Unit-tested / needs runtime validation | Helper behavior covered; real Google Docs metadata fetch/rewrite requires runtime validation. |
| Unified manifest maintenance | Unit-tested / needs E2E validation | Dry-run/apply reports, current-format refresh, no Docs body persistence and no provider calls covered by tests; real Drive backup/write behavior needs validation. |
| Runtime manifest source/document sync | Unit-tested / needs E2E validation | `mark_manifest_done` behavior is tested at helper level; successful live transcription sync requires RUNTIME-01. |
| Manifest skip on repeated run | Unit-tested / needs E2E validation | Current-format `sources` support skip logic. Duplicate-billing prevention must be validated with controlled rerun. |
| Manifest after failed/interrupted run | TBD / needs E2E validation | Recovery after failed runtime processing still needs a controlled validation record. |
| No transcript body in `manifest`/analytics | Unit/static-tested guardrails / needs ongoing review | Safety requirement is documented and partially guarded. New analytics/manifest fields require review. |
| No Google Docs body content in `manifest`/analytics | Unit/static-tested guardrails / needs ongoing review | Docs-only flows must not persist Docs body content. Continue reviewing future changes. |
| No provider/STT/LLM calls in docs-only workflows | Unit/static-tested | Tests/source checks cover key docs-only boundaries. Runtime observation should verify no unexpected calls during manual validation. |
| Analytics JSONL | Unit/static-tested / needs runtime validation | Run-level analytics and safety constraints exist; live artifact shape should be checked in runtime validation. |
| Startup timing summary | Unit/static-tested / needs runtime collection | Instrumentation exists for startup diagnostics. PERF-RUNTIME-01 must collect real Colab timing before performance claims. |
| Realtime Colab prototype | Experimental / Unit/static-tested / needs manual Colab runtime validation | `Realtime Colab prototype` / `LIVE-COLAB-01` adds separate runtime/notebook docs and static tests. Live/browser/provider behavior is not E2E validated yet. |
| Realtime microphone capture | Needs manual Colab runtime validation | Browser `getUserMedia({ audio: true })` requires real Colab/browser permissions and a real input device. |
| Realtime tab/screen audio capture | Needs manual Colab runtime validation | Browser `getDisplayMedia({ video: true, audio: true })` may not return audio tracks for every browser/window/system source; UI must show the clear Russian no-audio-track error when needed. |
| Realtime tab/screen audio + microphone mixing | Needs manual Colab runtime validation | Web Audio API mixing exists in prototype, but echo/double-audio behavior and browser permissions require manual validation. |
| Realtime virtual input/system-audio route | Needs manual Colab runtime validation | Treated as microphone/input-device selection. Desktop app audio may require OS-level routing/virtual audio/loopback; browser system-wide capture is not guaranteed. |
| ElevenLabs realtime WebSocket | Needs manual Colab runtime validation | URL builder/static checks cover endpoint/model/audio format/`commit_strategy=vad` shape and documented audio chunk payload fields; actual `session_started`, partial transcript and committed transcript require live provider validation. |
| Realtime single-use token safety | Unit/static-tested / needs live token validation | Helper validates response shape without provider calls; browser HTML does not embed `ELEVENLABS_API_KEY`. Live token creation with Colab Secrets remains pending. |
| Realtime Colab cold-start limitation | Experimental / needs runtime timing | Prototype is optimized as a thin launcher, but Colab cold start may not meet a 20–30 second live-start requirement unless pre-warmed. Measure before making performance claims. |
| OpenAI manual fallback path | Experimental | Manual/alternative provider path, not automatic fallback. Requires separate E2E validation. |
| OpenAI >25MB chunking | Experimental | Implemented path requires broader E2E coverage. |
| OpenAI diarization | Experimental | Speaker-aware output requires runtime validation before reliability claims. |
| OpenAI diarization + chunking | High risk | Known risk: inconsistent `Speaker N labels` across chunks. Needs dedicated validation plan. |
| Optional speaker project workflow | Unit/static-tested / manual Colab Docs validation required | Pure helper/UI guardrails are tested: gate logic, label detection, mapping/preview and stale-plan refusal. Live workflow must be tested on a copied diarized Google Doc before E2E success is claimed. |
| Speaker project storage | Unit/static-tested / manual UI validation required | Roster path is `VoiceOps Workspace/projects/speaker_projects.json`; no voice samples, voiceprints, embeddings or biometric data should be stored. Validate real Drive write/read manually. |
| Speaker project samples | Unit-tested / manual UI validation required | Samples are UI-only aids and should not persist in `manifest`/analytics. Confirm in Colab UI and artifacts. |
| Speaker project apply behavior | Unit/static-tested / manual Google Docs validation required | Apply is explicit, changes turn-boundary labels only, refuses stale preview context and leaves unmapped labels unchanged. Must be tested on copied Docs first. |
| Speaker project apply formatting caveat | Needs manual validation | Current MVP apply rewrites Google Doc as plain text. Formatting impact must be manually checked on a copy; do not claim formatting preservation. |
| Speaker projects are not voice identification | Safety requirement / ongoing review | Workflow relies on user manual mapping from text context. It must not use voice samples, voiceprints, embeddings or biometric matching. |
| Google Docs/Drive transient write retry | TBD / needs runtime validation | Conservative retry behavior needs live failure/retry validation; Docs text insertion retry should remain narrow due to idempotency risk. |
| Parallel notebooks / two Colab tabs | Not supported | Manifest model is single-user/single-runtime. Do not claim concurrent safety. |
| GitHub Actions CI | Must be checked per PR | Before merge, confirm CI status in GitHub. Local commands are necessary but not identical to hosted CI. |

## Runtime validation backlog

### RUNTIME-01

Source picker / manifest skip / Google Docs output smoke-check in real Colab.

### SPEAKER-RUNTIME-01

Speaker projects workflow on a copied diarized Google Doc, including preview, explicit apply and formatting caveat review.

### PERF-RUNTIME-01

Collect startup timing summary from a clean Colab runtime and record notes without claiming transcription success solely from timing data.
### LIVE-COLAB-01

Manual Colab runtime validation for the experimental realtime contour: token creation, microphone capture, display audio track handling, display+mic mixing, WebSocket open/session_started, partial transcript, committed transcript, Stop cleanup, no API key in JS, and no Google Docs/manifest mutation.

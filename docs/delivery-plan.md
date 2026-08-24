# Delivery plan

## Current Goal

- **ID / title:** `COLAB-PRODUCTION-COMPLETION-01` — полное закрытие production Colab batch и realtime contours.
- **State:** `IN_PROGRESS` — Goal явно авторизована владельцем 2026-08-24; clean working branch создана от verified `origin/main`.
- **Authorization source:** explicit owner instruction 2026-08-24: `ставь цель и приступай` после согласования полного Colab scope до `29/29`.
- **Scope:** закрыть `CB-05`, `CB-11`, `CB-15`, `CB-17`, `CB-21`, `CB-22` и `CR-06`; независимо перепроверить source/test/runtime gaps; реализовать local-folder intake, English, safe manifest clear, accepted-output-only manifest semantics, authoritative ISO 8601 source creation timestamp и representative realtime capture stability; добавить relevant regression tests/documentation; выполнить atomic commits и полный PR → CI → merge → applicable delivery → bounded LIVE flow.
- **Non-goals:** PWA implementation; `PWA-SPEAKER-IDENTITY-01`; новые providers; ослабление source-creation authority; unrelated architecture, CI/CD, credential или production-topology changes.
- **Goal AC:**
  1. Предыдущая `PWA-REALTIME-STABILITY-READINESS-01` reconciled по exact PR/CI/deployment/LIVE Evidence; current denominator остаётся `120`.
  2. Targeted audit независимо подтверждает фактический state каждого из семи незакрытых Colab product AC и не принимает старый dashboard на веру.
  3. `COLAB-BATCH-01` достигает `23/23`: local folder, English, manifest clear, post-output manifest persistence и authoritative ISO timestamp работают по canonical rules.
  4. Duplicate-protection manifest не сохраняет source как accepted до подтверждённого Google Docs output; transient failure/in-progress state не создаёт ложного success evidence.
  5. Timestamp не подменяется modification/job/document/transcription time; unavailable or conflicting authority остаётся explicit `unknown`/blocked result, а не выдуманной датой.
  6. `COLAB-REALTIME-01` достигает `6/6`: representative Windows/Chrome microphone/display/mixed sessions, repeated start/stop и permission-cancellation lifecycle проходят bounded LIVE matrix без воспроизводимого capture break.
  7. Secrets, tokens, transcript bodies, private source bytes, Google/provider payloads и raw Drive links не попадают в code, tests, logs, analytics или delivery Evidence.
  8. Relevant focused/full tests и exact-head CI проходят; reviewed exact revision доступна Colab launcher; bounded production LIVE подтверждает batch и realtime либо фиксирует конкретный внешний gate.
- **Required Evidence:** `SPEC ✅ | CODE ◐ | TEST ◐ | CI — | DEPLOY — | LIVE ◐`.
- **Known blockers/dependencies:** standard browser upload не гарантирует filesystem creation time для local files; targeted audit должен найти truthful authority (например embedded media metadata) либо зафиксировать narrow blocker без fallback на `lastModified`. Финальный batch canary требует owner-approved non-sensitive fixtures, provider quota и одного/нескольких Google Docs outputs. Production manifest clear — stateful/destructive operation и требует отдельной explicit authorization после safe preview/backup. Realtime matrix требует owner-controlled Chrome/Windows permission prompts. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`), поэтому фактический post-delivery state фиксируется GitHub Evidence/final report и reconciled в следующей authorized Goal без docs-only follow-up PR.
- **Stop condition:** все Goal AC и required Evidence подтверждены либо flow достиг `BLOCKED` / `PENDING_EXTERNAL_GATE`; затем остановиться и не переходить к следующей Goal без explicit authorization.

## Active execution checkpoint

- Updated (UTC): 2026-08-24T08:56:35Z.
- Session mode: authorized Goal implementation.
- Base branch: `main`.
- Base SHA: `ebbba50a938feb2d06b2ec59e828834ff204988d`.
- Working branch: `codex/colab-production-completion`.
- Last verified revision: `a6359dbcc29fbef99818507aef7f1d821947121c` — confirmed-output-only manifest persistence slice.
- Working tree at branch start: clean; local `main = origin/main`; divergence `0/0`; unrelated pre-existing changes absent.
- Completed: previous realtime Goal reconciled from PRs #228–#230. Exact-main repository CI `32706218832`, Studio/browser CI `32706218892` and web CD `32706218830` passed for `main@ebbba50`; owner-controlled Chrome mixed canary confirmed both source signals and accepted residual simultaneous-speaker masking as non-critical. Three merged realtime branches were safely removed locally/remotely.
- Current step: safe manifest clear реализован как read-only dry-run по умолчанию и explicit-confirmation apply; перед непустой очисткой создаётся backup, source files и Google Docs не удаляются, backup failure fail-closed блокирует write.
- Next exact action: реализовать browser-native local folder selection/upload с сохранением безопасных relative paths, фильтрацией supported media и bounded transfer.
- Validation and Evidence: safe clear slice — focused Colab helpers `193 passed`; destructive production apply не запускался. `CB-11/15/17` закрыты CODE/TEST; `CB-21/22` имеют CODE/TEST, но остаются open до representative Colab LIVE.
- Pull Request: none.
- CI/checks: not started for this branch.
- Deployment/environment: Colab has no VPS component deployment; exact reviewed repository revision and launcher `GITHUB_REF` are the applicable delivery identity. Final applicability of `DEPLOY` Evidence will be stated explicitly after targeted topology verification.
- Blockers: none for safe source/test work. External LIVE and destructive manifest-clear gates are deferred until implementation and CI are ready.
- Unverified assumptions: local media may or may not contain trustworthy embedded creation metadata; Colab browser folder upload capabilities and path preservation must be tested rather than inferred.
- Preserved pre-existing changes: none.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Snapshot независимо reconciled по exact-main delivery и owner-controlled LIVE предыдущей Goal; denominator не изменился.

| Product/epic | Current | Previous independent snapshot | Readiness/Evidence |
|---|---:|---:|---|
| **Project** | **92,5% (`111/120`)** | **91,7% (`110/120`)** | `CB-15` закрыт safe dry-run/backup/confirmation contract; четыре Colab AC остаются open. |
| **Google Colab** | **86,2% (`25/29`)** | **82,8% (`24/29`)** | Current Goal target: `29/29`. |
| `COLAB-BATCH-01` | **87,0% (`20/23`)** | **82,6% (`19/23`)** | 🟦 IN PROGRESS; `CB-05/21/22` open, timestamp LIVE gate ожидается. |
| `COLAB-REALTIME-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; `CR-06` open. |
| **Studio PWA** | **94,5% (`86/91`)** | **93,4% (`85/91`)** | Previous Goal closed `PR-06`; вне Goal. |
| `PWA-CORE-01` | **100% (`13/13`)** | **100% (`13/13`)** | 🟦 IN PROGRESS; LIVE retention breadth remains partial. |
| `PWA-TRANSCRIPTIONS-UX-01` | **100% (`4/4`)** | **100% (`4/4`)** | 🟩 READY. |
| `PWA-INGEST-01` | **100% (`11/11`)** | **100% (`11/11`)** | 🟩 READY. |
| `PWA-SEGMENTS-01` | **100% (`5/5`)** | **100% (`5/5`)** | 🟩 READY. |
| `PWA-BATCH-01` | **100% (`10/10`)** | **100% (`10/10`)** | 🟩 READY. |
| `PWA-SPEAKER-IDENTITY-01` | **0% (`0/5`)** | **0% (`0/5`)** | Explicitly deferred; вне Goal. |
| `PWA-MANIFEST-01` | **100% (`6/6`)** | **100% (`6/6`)** | 🟦 IN PROGRESS; destructive LIVE breadth remains partial. |
| `PWA-STANDARDIZATION-01` | **100% (`6/6`)** | **100% (`6/6`)** | 🟩 READY. |
| `PWA-REALTIME-01` | **100% (`13/13`)** | **92,3% (`12/13`)** | 🟩 READY; exact CI/deploy and bounded Chrome matrix accepted. |
| `PWA-OPERABILITY-01` | **100% (`18/18`)** | **100% (`18/18`)** | 🟩 READY. |

## Candidate next Goals

Эти items — proposals и не авторизуют implementation:

1. `PWA-SPEAKER-IDENTITY-01` — owner explicitly deferred; names/roles и manual listen-and-assign требуют отдельного privacy/product decision.
2. `PWA-OPERATIONAL-EVIDENCE-CLOSURE-01` — retention expiry и destructive manifest LIVE breadth без изменения product numerator.

## Risks и boundaries

- Colab manifest содержит sensitive operational metadata; clear/migration обязаны иметь preview, confirmation, backup и narrow target semantics.
- Provider success без confirmed Google Docs output не является accepted result и не должен блокировать safe retry как completed manifest entry.
- Browser/local upload metadata не считается authoritative creation time только потому, что поле называется `lastModified`.
- Realtime main API key остаётся Python-only; browser получает только short-lived single-use token.
- Browser capture permission и surface selection остаются user gesture; automated/static tests не заменяют owner-controlled Chrome/Windows matrix.
- No Google Docs, manifest или analytics mutation допускается из realtime contour.
- Approved post-deploy metadata writer отсутствует; фактический state фиксируется в final report/GitHub records и reconciled в следующем authorized scope без docs-only follow-up PR.

## Sources of truth

- Repository instructions и Goal process: `AGENTS.md`.
- Product scope/AC: `docs/project-spec.md`.
- Current Goal/checkpoint/readiness: этот документ.
- CI/CD и production safety: `docs/ci-cd-rules.md`.
- Actual architecture: `docs/architecture.md`.
- Colab validation: `docs/runbooks/validation.md` и `docs/runbooks/realtime-colab.md`.
- Historical evidence: `docs/delivery-plan-archive.md` только при reconciliation.

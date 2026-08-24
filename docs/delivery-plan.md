# Delivery plan

## Current Goal

- **ID / title:** `COLAB-PRODUCTION-COMPLETION-01` — полное закрытие production Colab batch и realtime contours.
- **State:** `IN_PROGRESS` — Goal явно авторизована владельцем 2026-08-24; clean working branch создана от verified `origin/main`.
- **Authorization source:** explicit owner instructions 2026-08-24: `ставь цель и приступай` после согласования полного Colab scope до `29/29`, затем `расширяй эту goal` для auto-detection default.
- **Scope:** закрыть `CB-05`, `CB-11`, `CB-15`, `CB-17`, `CB-21`, `CB-22` и `CR-06`; независимо перепроверить source/test/runtime gaps; реализовать local-folder intake, English, safe manifest clear, accepted-output-only manifest semantics, authoritative ISO 8601 source creation timestamp и representative realtime capture stability; сделать Colab batch auto-detection default, сохранив explicit Russian/English overrides; добавить relevant regression tests/documentation; выполнить atomic commits и полный PR → CI → merge → applicable delivery → bounded LIVE flow.
- **Non-goals:** удаление explicit Russian/English overrides; PWA implementation; `PWA-SPEAKER-IDENTITY-01`; новые providers; ослабление source-creation authority; unrelated architecture, CI/CD, credential или production-topology changes.
- **Goal AC:**
  1. Предыдущая `PWA-REALTIME-STABILITY-READINESS-01` reconciled по exact PR/CI/deployment/LIVE Evidence; current denominator остаётся `120`.
  2. Targeted audit независимо подтверждает фактический state каждого из семи незакрытых Colab product AC и не принимает старый dashboard на веру.
  3. `COLAB-BATCH-01` достигает `23/23`: local folder, English, manifest clear, post-output manifest persistence и authoritative ISO timestamp работают по canonical rules.
  4. Duplicate-protection manifest не сохраняет source как accepted до подтверждённого Google Docs output; transient failure/in-progress state не создаёт ложного success evidence.
  5. Timestamp не подменяется modification/job/document/transcription time; unavailable or conflicting authority остаётся explicit `unknown`/blocked result, а не выдуманной датой.
  6. `COLAB-REALTIME-01` достигает `6/6`: representative Windows/Chrome microphone/display/mixed sessions, repeated start/stop и permission-cancellation lifecycle проходят bounded LIVE matrix без воспроизводимого capture break.
  7. Secrets, tokens, transcript bodies, private source bytes, Google/provider payloads и raw Drive links не попадают в code, tests, logs, analytics или delivery Evidence.
  8. Relevant focused/full tests и exact-head CI проходят; reviewed exact revision доступна Colab launcher; bounded production LIVE подтверждает batch и realtime либо фиксирует конкретный внешний gate.
  9. Colab batch выбирает provider auto-detection по умолчанию; explicit Russian/English остаются доступными overrides, а provider request не получает language code в default mode.
- **Required Evidence:** `SPEC ✅ | CODE ✅ | TEST ✅ | CI ◐ | DEPLOY N/A | LIVE ◐`.
- **Known blockers/dependencies:** standard browser upload не гарантирует filesystem creation time; implementation использует embedded media creation metadata, затем Drive `createdTime`, а при отсутствии/conflict оставляет `unknown` без fallback на `lastModified`. Batch provider canary завершён; destructive manifest-clear apply не требуется и не авторизован. Финальная realtime matrix и визуальная проверка нового auto-detection default требуют owner-controlled Chrome/Windows. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`), поэтому фактический post-delivery state фиксируется GitHub Evidence/final report и reconciled в следующей authorized Goal без docs-only follow-up PR.
- **Stop condition:** все Goal AC и required Evidence подтверждены либо flow достиг `BLOCKED` / `PENDING_EXTERNAL_GATE`; затем остановиться и не переходить к следующей Goal без explicit authorization.

## Active execution checkpoint

- Updated (UTC): 2026-08-24T14:17:03Z.
- Session mode: authorized Goal implementation.
- Base branch: `main`.
- Base SHA for expanded scope: `ceab95988b4a16f36e76134d6312a10c60d72fe5`.
- Working branch: `codex/colab-production-completion`.
- Last verified revision: `65d2b76b0e026ac05f96d42439134b06b7292163` — auto-detection default, explicit overrides preserved.
- Working tree at expanded-scope start: clean; local `main = origin/main@ceab959`; existing Goal branch safely fast-forwarded to main; unrelated pre-existing changes absent.
- Completed: PR `#231` merged as `main@ceab959`; PR-head CI `32716793205` и post-merge main CI `32717076189` passed. Bounded batch LIVE обработал nested local-folder fixture, создал один native Google Doc с непустым transcript и exact authoritative `Created at: 2026-08-01T09:10:11Z`; Drive metadata подтверждает document creation before manifest modification. Auto-detection default реализован отдельным atomic commit без удаления explicit overrides.
- Current step: expanded code/spec change локально проверен; operational checkpoint и readiness синхронизируются перед push/new PR той же Goal.
- Next exact action: закоммитить checkpoint, push рабочей branch, создать новый code-bearing PR для расширенного scope и дождаться terminal exact-head CI.
- Validation and Evidence: auto-default commit — `197 passed`; `scripts/ci_checks.py` и `git diff --check` passed. Предыдущий combined Colab helper/realtime suite — `258 passed, 1 skipped`, отдельный bundled Node syntax check passed. Batch `CB-05/21/22` закрыты bounded LIVE; `CR-06` остаётся единственным open product AC.
- Pull Request: `#231` merged; новый PR для post-merge code scope ещё не создан.
- CI/checks: exact-main CI `32717076189` passed для `ceab959`; `65d2b76` ожидает exact-head CI.
- Deployment/environment: Colab не имеет VPS deployment unit; `DEPLOY N/A`. Applicable delivery identity — reviewed repository revision и exact `GITHUB_REF` launcher.
- Blockers: none for code/PR. Финальная realtime и non-provider auto-default LIVE остаются owner-controlled.
- Unverified assumptions: representative Windows/Chrome realtime matrix после lifecycle hardening ещё не завершена.
- Preserved pre-existing changes: none.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Snapshot независимо reconciled по exact-main delivery и owner-controlled LIVE предыдущей Goal; denominator не изменился.

| Product/epic | Current | Previous independent snapshot | Readiness/Evidence |
|---|---:|---:|---|
| **Project** | **95,0% (`114/120`)** | **92,5% (`111/120`)** | `CB-05/21/22` закрыты bounded batch LIVE; +3 AC, denominator не изменился. |
| **Google Colab** | **96,6% (`28/29`)** | **86,2% (`25/29`)** | Остался `CR-06`; auto-default меняет behavior, но не numerator. |
| `COLAB-BATCH-01` | **100% (`23/23`)** | **87,0% (`20/23`)** | 🟦 IN PROGRESS; product AC выполнены, новый default ожидает exact-head CI/merge и non-provider LIVE view. |
| `COLAB-REALTIME-01` | **83,3% (`5/6`)** | **83,3% (`5/6`)** | 🟦 IN PROGRESS; `CR-06` open. |
| **Studio PWA** | **94,5% (`86/91`)** | **94,5% (`86/91`)** | Вне Goal; numerator не изменился. |
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

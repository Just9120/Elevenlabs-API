# Delivery plan

## Current Goal

- **ID / title:** `PWA-SPEAKER-IDENTITY-01` — ручная идентификация спикеров в Studio PWA.
- **State:** `IN_PROGRESS` — Goal явно авторизована владельцем 2026-08-24 командой `ставь цель и приступай` после независимой проверки code/tests и подтверждения единственного оставшегося product gap.
- **Authorization source:** explicit current user instruction 2026-08-24; durable product scope — `SP-01..SP-05` из `docs/project-spec.md`.
- **Scope:** реализовать owner-scoped speaker identity database с именем и ролью; сохранять только provider label и bounded sample time bounds без voiceprints/audio persistence; предоставить безопасное прослушивание короткого фрагмента из исходного source; реализовать explicit manual label-to-identity assignment; синхронизировать подтверждённые имя/роль в Google Docs transcript и safe History metadata; добавить additive migration, API/UI, regression tests, architecture/operational documentation и полный PR → CI → merge → MANUAL_GATED migration → API/worker/web deployment → bounded LIVE flow.
- **Non-goals:** automatic biometric matching, voiceprints, embeddings, постоянное хранение voice samples, raw transcript/audio в database/logs/diagnostics, изменение Colab speaker-project contour, новые providers и unrelated UX/CI/CD/infrastructure scope.
- **Goal AC:**
  1. `SP-01`: authenticated owner создаёт, читает, изменяет и деактивирует только собственные speaker identities; names не конфликтуют case-insensitively в owner scope.
  2. `SP-02`: каждая identity хранит bounded normalized role и возвращает её только в owner-scoped safe DTO.
  3. `SP-03`: completed diarized job предоставляет по одному bounded sample на detected provider label; endpoint fail-closed при чужом job/profile, unavailable/expired source, invalid bounds или media failure и не сохраняет audio.
  4. `SP-04`: пользователь явно выбирает identity для technical speaker label; assignment идемпотентен, owner-scoped и не выполняет biometric inference.
  5. `SP-05`: successful assignment обновляет speaker heading в exact Google Docs output и отображается как safe name/role metadata в History/job detail; failure Google mutation не выдаётся за persisted assignment.
  6. Schema/API/browser DTO не раскрывают provider payload, transcript body, source bytes/keys, Google document ID/token или credential values; logs/diagnostics содержат только allowlisted scalar outcomes.
  7. Relevant backend/frontend/migration tests, full repository/Studio CI и exact-head checks проходят; production release соблюдает migration/API/worker/web gates.
  8. Bounded LIVE использует один уже существующий либо отдельно авторизованный короткий diarized result, подтверждает profile → listen → assign → Doc/History flow без нового provider charge, если существующего evidence достаточно.
- **Required Evidence:** `SPEC ✅ | CODE ✅ | TEST ✅ | CI — | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** additive migration `0024_speaker_identity` будет `MANUAL_GATED` и потребует отдельной action-time authorization/Environment approval после merge; sample доступен только пока исходный Drive/R2 source доступен; Google Docs mutation требует active owner Google connection и exact persisted output. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`), поэтому final delivery state фиксируется GitHub Evidence/final report и reconciled в следующем authorized code-bearing scope без docs-only follow-up PR.
- **Stop condition:** все Goal AC и required Evidence подтверждены либо flow достиг `BLOCKED` / `PENDING_EXTERNAL_GATE`; затем остановиться и не переходить к следующей Goal без explicit authorization.

## Active execution checkpoint

- Updated (UTC): 2026-08-24T17:54:56Z.
- Session mode: authorized Goal implementation.
- Base branch: `main`.
- Base SHA: `c9ac43fc71a97a868db744088c06c69882a555fa`.
- Working branch: `codex/pwa-speaker-identity`.
- Last verified revision: `49e09c5` — полный локальный speaker-identity scope, UI, documentation, migration-aware release preflight и browser DTO regression contract; applicable local regression green.
- Working tree at Goal start: clean; local `main = origin/main@c9ac43f`; unrelated pre-existing changes absent.
- Completed: commits `ae5ef23`/`1fd1e78`/`6eafc9b` реализовали migration/domain/API/UI и operational documentation; `49e09c5` синхронизировал exact migration head в production preflight и закрепил safe browser DTO contract.
- Current step: PR `#233` открыт из exact Goal branch; required CI checks запущены/ожидаются.
- Next exact action: дождаться terminal state всех required checks PR `#233`, проанализировать failures/skips и исправить Goal-related failures в этой же ветке.
- Validation and Evidence: migration full upgrade/current на isolated SQLite → `0024_speaker_identity (head)`; schema/domain/orchestrator regression `81/81` passed; profile/sample/assignment/Google Docs regression `66/66` passed; focused frontend `27/27`, full Studio frontend `567/567` passed; TypeScript, ESLint и production PWA build passed; full portable backend `1021 passed, 6 skipped`; `scripts/ci_checks.py` passed. POSIX production-preflight suite локально невалиден под Windows path semantics и остаётся обязательным Linux CI gate. Product AC `5/5`; CI/DEPLOY/LIVE gates ещё открыты.
- Pull Request: `#233` — `codex/pwa-speaker-identity` → `main`; branch base не diverged (`origin/main@c9ac43f`, `0 behind / 7 ahead` перед push).
- CI/checks: pending for PR `#233`; exact final checked revision будет зафиксирован GitHub check suite после checkpoint push.
- Deployment/environment: not started; expected migration class `MANUAL_GATED`, component units API/worker/web.
- Blockers: none for local implementation. Production migration remains future external gate requiring explicit authorization.
- Unverified assumptions: existing production diarized output/source may or may not remain suitable for no-charge LIVE sample/assignment; verify before requesting any provider canary.
- Preserved pre-existing changes: none.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Snapshot независимо reconciled по current code/tests, exact CI/CD records и completed owner-controlled Colab/PWA LIVE; denominator не изменился.

| Product/epic | Current | Previous independent snapshot | Readiness/Evidence |
|---|---:|---:|---|
| **Project** | **100% (`120/120`)** | **95,8% (`115/120`)** | Все current product AC реализованы; release Evidence текущей Goal ещё не закрыт. |
| **Google Colab** | **100% (`29/29`)** | **96,6% (`28/29`)** | Batch `23/23`, realtime `6/6`; PR `#231/#232`, CI и bounded LIVE завершены. |
| `COLAB-BATCH-01` | **100% (`23/23`)** | **100% (`23/23`)** | 🟩 READY. |
| `COLAB-REALTIME-01` | **100% (`6/6`)** | **83,3% (`5/6`)** | 🟩 READY; representative Windows/Chrome matrix accepted. |
| **Studio PWA** | **100% (`91/91`)** | **94,5% (`86/91`)** | Product AC complete в working branch; epic остаётся IN PROGRESS до CI/DEPLOY/LIVE. |
| `PWA-CORE-01` | **100% (`13/13`)** | **100% (`13/13`)** | Product AC complete; operational LIVE breadth учитывается отдельно. |
| `PWA-TRANSCRIPTIONS-UX-01` | **100% (`4/4`)** | **100% (`4/4`)** | Product AC complete. |
| `PWA-INGEST-01` | **100% (`11/11`)** | **100% (`11/11`)** | 🟩 READY. |
| `PWA-SEGMENTS-01` | **100% (`5/5`)** | **100% (`5/5`)** | 🟩 READY. |
| `PWA-BATCH-01` | **100% (`10/10`)** | **100% (`10/10`)** | 🟩 READY. |
| `PWA-SPEAKER-IDENTITY-01` | **100% (`5/5`)** | **0% (`0/5`)** | 🟦 IN PROGRESS; CODE/TEST подтверждены, delivery gates открыты. |
| `PWA-MANIFEST-01` | **100% (`6/6`)** | **100% (`6/6`)** | Product AC complete; destructive LIVE breadth учитывается отдельно. |
| `PWA-STANDARDIZATION-01` | **100% (`6/6`)** | **100% (`6/6`)** | 🟩 READY. |
| `PWA-REALTIME-01` | **100% (`13/13`)** | **100% (`13/13`)** | 🟩 READY. |
| `PWA-OPERABILITY-01` | **100% (`18/18`)** | **100% (`18/18`)** | 🟩 READY. |

## Candidate next Goals

Новых product Goals в current denominator после `PWA-SPEAKER-IDENTITY-01` нет. Future auth hardening остаётся вне denominator и не авторизовано.

## Risks и boundaries

- Speaker identity — manual user decision; provider label не считается biometric identity и не переносится автоматически между jobs.
- Voice sample извлекается on demand из owner-authorized source, ограничен длительностью и размером, получает `no-store` и не сохраняется в database/R2/Google Docs.
- Assignment mutation касается только exact accepted Google Docs output текущего owner/job; raw document ID не возвращается browser.
- Source retention может сделать sample недоступным после успешной транскрибации; это explicit recoverable UI state, а не основание хранить audio бессрочно.
- MANUAL_GATED migration, worker lifecycle и production canary не выполняются без соответствующих action-time gates.
- Approved post-deploy metadata writer отсутствует; protection rules не обходятся ради metadata-only update.

## Sources of truth

- Repository instructions и Goal process: `AGENTS.md`.
- Product scope/AC: `docs/project-spec.md`.
- Current Goal/checkpoint/readiness: этот документ.
- CI/CD и production safety: `docs/ci-cd-rules.md`.
- Actual architecture: `docs/architecture.md`.
- Historical evidence: `docs/delivery-plan-archive.md` только при reconciliation.

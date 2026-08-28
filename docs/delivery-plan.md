# Delivery plan

## Current Goal

- **ID / title:** `PWA-SESSION-CONTROL-01` — owner-scoped управление активными personal sessions.
- **State:** `IN_PROGRESS` — Goal явно авторизована, exact base/branch зафиксированы, implementation начата.
- **Authorization source:** explicit user instruction 2026-08-28 «делай» после review и описания bounded Goal `PWA-SESSION-CONTROL-01`.
- **Scope:** реализовать canonical `PWASEC-07..PWASEC-09`: безопасный bounded список active sessions текущего owner с current marker; targeted revoke выбранной другой session; idempotent revoke всех остальных active sessions; Settings → Account UI с confirmation/loading/error/empty/retry и authoritative reconciliation ambiguous mutations; CSRF/same-origin/rate-limit/audit boundaries; API/UI/browser tests; PR/CI/merge; API+web deploy и bounded authenticated two-session LIVE.
- **Non-goals:** commercial contour; TOTP, password reset и recent re-authentication; IP/raw User-Agent/device fingerprint/geolocation; изменение cookie/token format или session lifetime; unrelated security/storage/provider work; worker deployment или schema migration без обнаруженной necessity и новой authorization.
- **Goal AC:**
  1. `PSC-01`: owner-scoped GET возвращает не более bounded limit только unrevoked/unexpired sessions текущего user, current session помечена; DTO содержит только opaque session ID и safe timestamps, без token/CSRF/cookie/IP/User-Agent data.
  2. `PSC-02`: выбранная другая active session отзывается CSRF/same-origin-protected mutation; cross-owner/missing/replayed targets не раскрывают чужое состояние и дают безопасный idempotent outcome.
  3. `PSC-03`: revoke-all-other отзывает только active sessions текущего user, сохраняет current session и безопасно повторяется.
  4. `PSC-04`: Settings → Account показывает current/other sessions, created/last-active/expires, loading/error/empty states, refresh, selected revoke и confirm-required revoke-all-other.
  5. `PSC-05`: ambiguous mutation failure reconciliate через authoritative list; UI не сообщает ложный success и не удаляет last-confirmed state при transient read failure.
  6. `PSC-06`: list/revoke operations имеют bounded rate limits и safe audit events; credential/session secrets не попадают в response/log/test evidence.
  7. `PSC-07`: focused API/UI/browser tests, full local validation, exact PR-head required CI, merge, applicable API/web deployment и bounded authenticated two-session LIVE завершены.
- **Required Evidence:** target `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`; current `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** LIVE требует две независимые authenticated owner sessions без раскрытия credentials; approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`). Existing `sessions` table уже имеет required timestamps/revocation fields, поэтому migration предварительно не ожидается.
- **Stop condition:** все Goal AC подтверждены required Evidence либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; после closure к следующей Goal без новой authorization не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-28T06:43:23Z.
- Session mode: authorized full delivery Goal; commercial и перечисленные non-goals запрещены.
- Base branch/SHA: fetched `origin/main@baa55d695c015385ba992b87c505d1a1fc116df3`; local `main` clean, совпадал с origin; open PR отсутствовали.
- Working branch: `codex/pwa-session-control-01`; создана от exact verified base SHA выше.
- Last verified revision: base `main@baa55d695c015385ba992b87c505d1a1fc116df3`.
- Working tree at Goal start: clean; unrelated pre-existing changes absent.
- Completed: stale `SPEC-CANONICALIZATION-02` actual state recovered: PR `#248` merged as `baa55d6`; exact-head CI `33147462748` and exact-main CI `33147622878` success; docs-only deploy/LIVE N/A. New base/branch and existing Session model/revoke-other foundation verified.
- Current step: implement bounded owner-scoped session service/API and focused backend tests.
- Next exact action: add `session_control` domain module, list/targeted-revoke routes and API tests before UI work.
- Validation and Evidence: exact-main repository CI `33147622878` success on `baa55d6`; latest Studio/browser CI `33116072392` success on unchanged product-code baseline `f6b0d70`. New exact-head CI remains mandatory.
- Pull Request / CI / deployment: PR/push absent. Expected changed components: API + web; migration/worker N/A unless verified implementation evidence changes this conclusion.
- Blockers: no implementation blocker. Potential LIVE external gate: second authenticated owner browser context.
- Unverified assumptions: existing Session timestamps are sufficient for useful list without device/IP tracking; no schema migration is expected.
- Preserved pre-existing changes: отсутствуют.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Текущий snapshot пересчитан после явного расширения canonical scope; previous snapshot сохранён для сравнения.

| Product/epic | Current independent snapshot | Previous independent snapshot | Основание |
|---|---:|---:|---|
| **Полный canonical scope** | **38,2% (`203/532`)** | **38,2% (`203/532`)** | Goal start: implementation ещё не изменила product AC. |
| **Non-commercial scope** | **70,0% (`203/290`)** | **70,0% (`203/290`)** | Goal start: `PWASEC-07..09` ещё не выполнены. |
| **Commercial/cross-contour** | **0% (`0/242`)** | **0% (`0/242`)** | Вне Goal; implementation запрещена. |
| **Google Colab canonical** | **100% (`31/31`)** | **100% (`31/31`)** | Вне Goal; runtime risk не меняет numerator. |
| **Personal Studio PWA canonical** | **66,4% (`172/259`)** | **66,4% (`172/259`)** | Goal start; target после `PWASEC-07..09` — `175/259`. |
| `PWA-SECURITY-HARDENING-02` | **33,3% (`6/18`)** | **33,3% (`6/18`)** | Target Goal — `9/18`; остальные security AC вне scope. |
| `PWA-GOOGLE-PICKER-UX-01` | **100% (`3/3`)** | **100% (`3/3`)** | PR `#245`, exact-main CI и web deployment подтверждены; authenticated source/output-folder LIVE исправления ещё не зафиксировано как Evidence. |
| `PWA-TRANSCRIPTIONS-UX-01` | **100% (`4/4`)** | **100% (`4/4`)** | DEPLOY теперь ✅ после PR `#244`; authenticated LIVE остаётся `—`. |
| `PWA-MANIFEST-01` | **100% (`6/6`)** | **100% (`6/6`)** | Representative folder import/clear mutation LIVE остаётся `◐`. |
| Остальные existing epics | **100% (`135/135`)** | **100% (`135/135`)** | AC completion не изменился; current audit не отменяет ранее зафиксированные required Evidence. |

## Candidate next Goals

1. `SPEC-GAPS-DECISIONS-03` — принять bounded решения по сохранённым conflicts/ambiguities; implementation не начинается автоматически.
2. `CI-CD-HARDENING-02` — exact deployed revision contract, branch/ruleset/Environment enforcement и metadata synchronization.
3. `DB-LEAST-PRIVILEGE-01` — evidence actual roles и отдельные migration/application roles с backup/rollback plan.
4. `PWA-QUERY-BOUNDS-01` — pagination/retention/query budgets и load/concurrency validation растущих collections.
5. `PWA-STORAGE-ISOLATION-01` — разделить Audio Preparation references и transcription intake на разные lifecycle namespaces/buckets после architecture decision.

## Risks и boundaries

- API collection остаётся authority для active source picker; transient reload failure не должен молча удалять last-known metadata или разрешать mutation по неподтверждённому state.
- Ручное удаление object напрямую в R2 обходит application lifecycle и не определяется текущим list endpoint; per-object `HEAD` в hot path не добавляется без отдельной architecture/performance оценки.
- Переименование user-visible brand не означает автоматический rename repository, packages, routes, domain, Compose project или persistent identities.

## Sources of truth

- Repository instructions: `AGENTS.md`.
- Product scope/AC: `docs/project-spec.md`.
- Current Goal/checkpoint/readiness: этот документ.
- CI/CD safety: `docs/ci-cd-rules.md`.
- Actual architecture: `docs/architecture.md`.
- Historical evidence: `docs/delivery-plan-archive.md`.

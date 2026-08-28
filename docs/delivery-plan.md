# Delivery plan

## Current Goal

- **ID / title:** `PWA-TRANSCRIPTION-UX-POLISH-01` — app-owned Google Drive selection/search и явная индикация diarization.
- **State:** `IN_PROGRESS`.
- **Authorization source:** explicit owner instruction 2026-08-28 «ок, согласовано. делай» после согласования изолированной UX Goal; browser annotations 2026-08-28 являются owner-provided product input для `PG-04..08` и `PB-11`.
- **Scope:** единый app-owned Google Drive dialog для `sources`, `source-folder` и `output-folder`; folder navigation, My Drive/shared folders/shared drives; bounded Drive REST pages и explicit continuation; folder-name search для source/output folders; supported audio/video filename search и multi-selection до `50` для source files; selection dedup/preservation; existing current-folder semantics; scroll lock, focus/keyboard/accessibility и safe timeout; явная текстовая/визуальная индикация разделения на спикеров в composer и preflight; focused/full frontend validation; exact-head CI; web-only deployment и authenticated production LIVE.
- **Non-goals:** implementation `transcript_doc`; commercial contour; OAuth scope changes; provider calls/spend; backend source import/validation semantics; catalog/transcript native Picker flows; API/schema/worker changes; CI/CD contract или infrastructure hardening; DB least privilege; storage redesign; unrelated refactors.
- **Goal AC:**
  1. `TUX-01`: `PG-04` — output-folder dialog ищет доступные folders по имени, открывает найденную folder и позволяет выбрать current folder, включая empty folder.
  2. `TUX-02`: `PG-05..06` — source-file flow использует app-owned dialog, показывает только folders и supported audio/video, поддерживает filename search, до `50` selections, dedup и сохранение selection при navigation/search/pagination.
  3. `TUX-03`: `PG-07..08` — source-folder flow использует тот же app-owned dialog, поддерживает current-folder selection и folder-name search, включая empty folders.
  4. `TUX-04`: list/search используют hard page size, opaque Drive `nextPageToken`, explicit `Загрузить ещё`, bounded maximum pages и cancellation stale requests; UI не выполняет eager all-pages fetch.
  5. `TUX-05`: existing OAuth/session/server-side verification, source MIME revalidation, current-folder semantics, shared Drive handling, modal scroll/focus/timeout/accessibility boundaries не ослаблены.
  6. `TUX-06`: `PB-11` — composer и preflight явно показывают `Разделение спикеров: включено/выключено`; enabled state заметно не только цветом.
  7. `TUX-07`: focused tests покрывают empty current folder, folder/file search, escaped query, pagination, selection persistence/dedup/max, stale/cancel/error/timeout, shared Drive и diarization states; full frontend test/lint/build и repository checks green.
  8. `TUX-08`: exact PR-head required checks, web-only delivery exact merged revision и authenticated LIVE подтверждают три picker modes, search/current-folder/multi-select/scroll behavior и обе diarization states без provider call.
- **Required Evidence:** target `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`; current `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** immediate blocker отсутствует. Authenticated Google Drive LIVE требует существующую owner session и доступные representative folders/media; GitHub Actions minutes расходуются только на один validated initial push и автоматические required checks. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** все Goal AC и canonical `PG-04..08`/`PB-11` подтверждены required Evidence либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; после closure к `transcript_doc` или другой Goal без новой authorization не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-28T16:42:28Z.
- Session mode: authorized full-delivery Goal; commercial, `transcript_doc` implementation и перечисленные non-goals запрещены.
- Base branch/SHA: verified `origin/main@ea92ac671a31cb70dd8f59c78561ee1e5fcf4fbe`.
- Working branch: `codex/pwa-transcription-ux-polish-01`, создана от exact base.
- Last verified revision: documentation checkpoint `edf37413e0f2cdb50b9a70d54006837a74a9551c`; canonical AC/readiness/Goal contract validation covered by this commit.
- Working tree at Goal start: clean; unrelated pre-existing changes отсутствовали.
- Completed: Git/GitHub state и no-open-PR проверены; applicable contracts/runbooks и current Drive Picker/tests изучены; owner-approved AC атомизированы; commit `edf3741` синхронизировал spec, readiness denominator, previous Goal archive и durable checkpoint. Проверка подтвердила `546` unique AC rows и arithmetic `216/546`, `185/272`, `31/32`; `git diff --check` green.
- Current step: зафиксировать locally validated picker/diarization implementation отдельным reviewable commit.
- Next exact action: создать implementation commit, обновить checkpoint на exact SHA и выполнить repository-wide local validation перед единственным initial push.
- Validation and Evidence: `SPEC ✅`; implementation local state: focused picker `8/8`, focused App `221/221`, full frontend Vitest `619/619`, ESLint success, production TypeScript/Vite/PWA build success, `git diff --check` green. Build сохраняет existing non-blocking chunk-size warning; CODE/TEST ещё не синхронизированы как delivery Evidence до commit/CI.
- Pull Request / CI / deployment: PR не создан; push запрещён до полной local validation. Production web baseline `ea92ac67`; API/worker `cc434775`; schema `0027_query_bounds`.
- Blockers: отсутствуют. Возможный external gate — недостаточный representative Drive data/session для authenticated LIVE; до фактической проверки это не blocker.
- Unverified assumptions: Drive API search возвращает accessible items в рамках existing OAuth scopes; MIME policy достаточно выразима для server-equivalent client filter, при этом backend exact-ID validation остаётся final authority; production representative media/folders доступны владельцу.
- Preserved pre-existing changes: отсутствуют.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Current snapshot независимо пересчитан после owner-approved расширения scope на `14` AC; предыдущий snapshot сохранён только для сравнения, а не как основание current numerator.

| Product/epic | Current independent snapshot | Previous independent snapshot | Основание |
|---|---:|---:|---|
| **Полный canonical scope** | **39,6% (`216/546`)** | **40,6% (`216/532`)** | Numerator не изменён; denominator `+14` owner-approved AC. |
| **Non-commercial scope** | **71,1% (`216/304`)** | **74,5% (`216/290`)** | Colab `31/32` + personal PWA `185/272`. |
| **Commercial/cross-contour** | **0% (`0/242`)** | **0% (`0/242`)** | Вне Goal; implementation запрещена. |
| **Google Colab canonical** | **96,9% (`31/32`)** | **100% (`31/31`)** | Новый `CB-24` требует current `transcript_doc` для новых Colab документов. |
| **Personal Studio PWA canonical** | **68,0% (`185/272`)** | **71,4% (`185/259`)** | Добавлены `PG-04..08`, `PB-11`, `PD-07..13`; до Evidence все невыполнены. |
| `PWA-GOOGLE-PICKER-UX-01` | **37,5% (`3/8`)** | **100% (`3/3`)** | Denominator расширен на пять owner-approved search/app-owned interface AC. |
| `PWA-BATCH-01` | **90,9% (`10/11`)** | **100% (`10/10`)** | Добавлен `PB-11` — явная non-color-only diarization indication. |
| `PWA-STANDARDIZATION-01` | **46,2% (`6/13`)** | **100% (`6/6`)** | Добавлены семь PWA AC versionless `transcript_doc`; отдельный Colab AC учтён в `COLAB-BATCH-01`. |
| Остальные existing epics | **100% (`132/132`)** | **100% (`132/132`)** | Existing completed numerator не изменён. |

Изменения больше `10` п.п. у `PWA-GOOGLE-PICKER-UX-01` (`−62,5` п.п.) и `PWA-STANDARDIZATION-01` (`−53,8` п.п.) вызваны новым явным owner-approved denominator, а не регрессом existing code. Никакой новый AC не засчитан выполненным до фактического Evidence.

## Candidate next Goals

1. `TRANSCRIPT-DOC-STANDARD-01` — versionless `transcript_doc` для новых Colab/PWA outputs и existing one-click dry-run/apply standardization по `CB-24`, `PD-07..13`; implementation не авторизована текущей Goal.
2. `DB-LEAST-PRIVILEGE-01` — evidence actual roles и отдельные migration/application roles с backup/rollback plan.
3. `PWA-STORAGE-ISOLATION-01` — разделить Audio Preparation references и transcription intake на разные lifecycle namespaces/buckets после architecture decision.

## Risks и boundaries

- Drive `name contains` имеет prefix semantics; UI должен честно называть это поиском по началу имени и не обещать arbitrary substring.
- Search/list pagination не должна eager-fetch весь Drive, терять source selections или разрешать unsupported MIME; backend exact-ID verification остаётся authoritative.
- Shared folders и shared drives имеют отличающиеся corpora/driveId semantics; regression в существующем app-owned output dialog недопустим.
- Modal scroll lock/focus restoration и timeout cleanup должны оставаться idempotent во всех success/cancel/error paths.
- Authenticated LIVE не запускает transcription/provider job и не создаёт платный side effect.
- Post-deploy metadata writer отсутствует; protections не обходятся и отдельный docs-only follow-up PR не создаётся.

## Sources of truth

- Repository instructions: `AGENTS.md`.
- Product scope/AC: `docs/project-spec.md`.
- Current Goal/checkpoint/readiness: этот документ.
- CI/CD safety: `docs/ci-cd-rules.md`.
- Current architecture/runtime boundaries: `docs/architecture.md` и applicable runbooks.

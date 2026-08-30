# Delivery plan

## Current Goal

- **ID / title:** `PWA-USER-UX-STORAGE-ISOLATION-01` — пользовательский UX и изоляция reference storage.
- **State:** `IN_PROGRESS`.
- **Authorization source:** explicit owner instruction 2026-08-30: весь согласованный production UX/UI audit выполнить единой Goal, дополнительно включить candidate `PWA-STORAGE-ISOLATION-01`, поставить Goal и приступить.
- **Scope:** выполнить `PUX-01..12` во всех текущих PWA surfaces; сделать primary copy/actions пользовательскими, спрятать implementation details за progressive disclosure, исправить semantic status/error presentation, упростить одиночные/групповые cards и History, сделать maintenance summary-first с bounded list navigation, отделить support/advanced Settings, устранить mobile Drive-dialog overflow; выполнить `STORAG-16..21` через раздельные audio/transcription reference data classes, S3/R2 buckets, credentials и lifecycle configuration с persisted safe routing и backward compatibility; добавить tests/docs, PR/CI, applicable protected delivery и bounded owner LIVE без provider call.
- **Non-goals:** commercial contour; новый STT/provider, provider call или spend; durable transcript/audio-recording features; `STORAG-01..15`; перенос/удаление существующих objects; bucket/IAM provisioning без отдельной external authorization; DB least privilege; OAuth scopes; изменение `docs/ci-cd-rules.md`, repository protections или deployment topology; unrelated refactors.
- **Goal AC:**
  1. `UXSI-01`: canonical `PUX-01..12`, `STORAG-16..21`, denominator и factual closure PR `#258` синхронизированы без изменения unrelated scope.
  2. `UXSI-02`: terminal success/failure/cancel имеют разные semantic visual/ARIA tones; raw error code заменён локализованной actionable причиной, а support code доступен только под disclosure.
  3. `UXSI-03`: single/group transcription cards и History не используют default `Мульти-транскрибация`, `Элемент`, UUID или internal source/output type labels и не дублируют одинаковые metadata/timestamps.
  4. `UXSI-04`: Dashboard, Audio, ordinary Transcriptions/preflight и Live primary copy/actions описывают пользовательский результат; технические implementation details доступны только явно и вторично.
  5. `UXSI-05`: maintenance и Settings используют user-task IA/copy, отделяют support/advanced surfaces; maintenance result summary precedes filterable bounded/paginated rows.
  6. `UXSI-06`: Drive dialogs на `390x844` не имеют horizontal overflow, сохраняют доступные controls и modal scroll isolation.
  7. `UXSI-07`: новые local references явно относятся к `audio_processing` либо `transcription`, сохраняют exact bucket identity и используют разные configured buckets; existing legacy sources читаются/удаляются без object move.
  8. `UXSI-08`: audio/transcription buckets имеют разные credential files и independently declared lifecycle policy identifiers; equal/missing identities fail closed, и runtime health проверяет оба boundaries без раскрытия values.
  9. `UXSI-09`: API/worker upload, completion, materialization, audio output, speaker sample, cleanup и diagnostics выбирают storage по persisted class/bucket и не получают silent cross-bucket fallback.
  10. `UXSI-10`: focused и full local tests подтверждают UX regressions, narrow viewport, storage configuration/routing/legacy compatibility, secret boundary и existing product behavior.
  11. `UXSI-11`: один initial push после полной local validation, reviewable PR и exact-head required CI завершаются success; failure исправляется одним grouped follow-up batch.
  12. `UXSI-12`: applicable migration/API/web/worker delivery соответствует exact merge revision; bounded authenticated UX LIVE и distinct storage runtime Evidence подтверждены либо Goal честно достигает `PENDING_EXTERNAL_GATE` до external bucket/IAM/lifecycle setup.
- **Required Evidence:** target `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`; current `SPEC ✅ | CODE ✅ | TEST ◐ | CI ❌ | DEPLOY ❌ | LIVE —`.
- **Known blockers/dependencies:** distinct provider buckets, lifecycle rules, scoped credential pairs и cross-access denial подтверждены; production activation блокирует воспроизведённый image-permission defect protected migration preflight. Migration не применялась, backup/schema не затронуты, manual recovery не требуется. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** все Goal AC и required Evidence выполнены либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; существующие objects не мигрируются автоматически; после closure к следующей Goal без новой authorization не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-30T08:34:55Z.
- Session mode: authorized full-delivery Goal; все non-goals выше запрещены.
- Base branch/SHA: verified `origin/main@c11de8af22d694540b26d98c2ec40aab064adf25`.
- Working branch: `codex/pwa-storage-permission-hotfix`.
- Isolated worktree: `C:/Users/wait9/AppData/Local/Temp/codex-elevenlabs-pwa-user-ux-storage-isolation`.
- Last verified revision: merged Goal revision `c11de8af22d694540b26d98c2ec40aab064adf25`; exact-main CI success, protected migration run `33301092693` failed before mutation because candidate image preserved restrictive checkout permissions on new migration file.
- Working tree at Goal start: isolated worktree clean. Основной checkout содержал unknown/unrelated `.pytest-tmp-*` directories; они сохранены нетронутыми, основной checkout возвращён на `main`.
- Completed: PR `#259` merged as `c11de8af22d694540b26d98c2ec40aab064adf25`; exact-main CI `33300960336` и Studio PWA CI `33300960367` success. Provider lifecycle и independently scoped access подтверждены без создания objects. Worker status `33300735593` success, graceful drain `33300899674` success (`exited`, `exit_code=0`). Automatic Platform CD временно отключён; protected migration изолированно воспроизвела non-root read failure до backup/schema mutation. Hotfix нормализует application image permissions, добавляет networkless/read-only Alembic metadata probe под runtime UID и сохраняет безопасный traceback release preflight.
- Current step: завершить hotfix validation и создать reviewable commit.
- Next exact action: закоммитить hotfix, выполнить один push/PR batch, дождаться exact-head Linux container CI и merge; затем повторить owner-approved protected migration без speculative rerun.
- Validation and Evidence: reproduction: `PermissionError` при чтении `/app/alembic/versions/0029_source_reference_class.py` под image runtime user. Local hotfix: affected portable contracts `8 passed`; portable baseline без недоступного host-only WSL syntax probe `1131 passed, 5 skipped, 1 deselected`; lightweight checks и YAML parse success; `git diff --check` success. Full shell/Docker validation остаётся exact-head Linux CI gate.
- Pull Request / CI / deployment: PR `#259` merged; hotfix PR ещё не создан. Main CI runs `33300960336` / `33300960367` success. Migration run `33301092693` failed terminally with `migration_applied=no`, `manual_recovery_required=no`; web/API/worker deployment в этом run не выполнялся. `STUDIO_PLATFORM_CD_ENABLED=false`, `STUDIO_MIGRATION_RELEASE_ENABLED=false` до validated hotfix.
- Blockers: exact-head Linux Docker build должен подтвердить новый non-root Alembic metadata probe; после CI потребуется новый protected migration approval.
- Unverified assumptions: deterministic `/app` permission normalization устраняет VPS checkout umask drift для всех новых application files; это подтверждается Docker CI, не локальным Windows host без Docker/WSL.
- Preserved pre-existing changes: шесть `.pytest-tmp-*` directories в основном checkout; текущая Goal их не читает, не изменяет и не удаляет.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Current snapshot независимо пересчитан по фактической local implementation: `PUX-01..12` и persisted data-class boundary `STORAG-16` выполнены; `STORAG-17..21` не засчитаны без external provider Evidence. Evidence gate-ит READY, но не меняет numerator.

| Product/epic | Current independent snapshot | Previous independent snapshot | Основание |
|---|---:|---:|---|
| **Полный canonical scope** | **45,1% (`259/574`)** | **42,9% (`246/574`)** | `+12` выполненных PUX AC и `+1` storage AC при неизменном denominator. Изменение `+2,2` п.п. |
| **Non-commercial scope** | **78,0% (`259/332`)** | **74,1% (`246/332`)** | Colab `32/32` + personal PWA `227/300`. Изменение `+3,9` п.п. |
| **Commercial/cross-contour** | **0% (`0/242`)** | **0% (`0/242`)** | Durable BACKLOG, implementation не авторизована. |
| **Google Colab canonical** | **100% (`32/32`)** | **100% (`32/32`)** | Current Goal Colab не затрагивает; applicable delivery Evidence closed. |
| **Personal Studio PWA canonical** | **75,7% (`227/300`)** | **71,3% (`214/300`)** | `PUX-01..12` и `STORAG-16` выполнены локально. Изменение `+4,4` п.п. |
| `PWA-USER-EXPERIENCE-02` | **100% (`12/12`)** | **0% (`0/12`)** | Все AC имеют CODE и local TEST evidence, но CI/DEPLOY/LIVE ещё отсутствуют; эпик не READY. Изменение `+100` п.п. обусловлено завершением всего нового 12-AC epic scope в одной owner-approved Goal. |
| `STORAGE-LIFECYCLE-02` | **33,3% (`7/21`)** | **28,6% (`6/21`)** | Persisted distinct reference data classes выполнены; external buckets/lifecycle/access ещё не подтверждены. Изменение `+4,7` п.п. |

Общая, non-commercial, PWA и storage оценки изменились менее чем на `10` п.п. `PWA-USER-EXPERIENCE-02` изменился на `+100` п.п., потому что единая Goal реализовала все `12/12` его atomic AC; Evidence gate всё ещё удерживает lifecycle state `IN PROGRESS`.

## Candidate next Goals

1. `DB-LEAST-PRIVILEGE-01` — actual roles Evidence и отдельные migration/application roles с backup/rollback plan.
2. `STORAGE-LIFECYCLE-FOLLOWUP-01` — только после отдельного owner decision выбрать bounded subset из `STORAG-01..15`.

## Risks и boundaries

- Разделение buckets/credentials меняет stateful external configuration. Code/config schema можно доставить reviewably, но production switch требует explicit operator setup и fail-closed preflight.
- Существующие local Sources остаются в legacy/transcription bucket; Goal не перемещает bytes, не меняет owner retention и не выполняет broad cleanup.
- API и worker deployment/state различаются; migration остаётся protected `MANUAL_GATED`, worker — manual status/drain/deploy/status.
- UX не должен скрыть recovery/spend/security warnings: они упрощаются, но actionable confirmation и safety detail остаются доступны.
- Approved post-deploy metadata writer отсутствует; protection rules не обходятся и отдельный docs-only follow-up PR не создаётся.

## Sources of truth

- Repository instructions: `AGENTS.md`.
- Product scope/AC: `docs/project-spec.md`.
- Current Goal/checkpoint/readiness: этот документ.
- CI/CD safety: `docs/ci-cd-rules.md`.
- Current architecture/runtime boundaries: `docs/architecture.md` и applicable runbooks.
- Completed delivery history: `docs/delivery-plan-archive.md` (не current source of truth).

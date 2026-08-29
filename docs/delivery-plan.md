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
- **Required Evidence:** target `SPEC ✅ | CODE ✅ | TEST ✅ | CI ✅ | DEPLOY ✅ | LIVE ✅`; current `SPEC ✅ | CODE — | TEST — | CI — | DEPLOY — | LIVE —`.
- **Known blockers/dependencies:** production сейчас подтверждён только с одним legacy source bucket/credential boundary. `STORAG-17..21` требуют два реально distinct buckets, credential pairs и lifecycle policies в operator-managed R2/VPS configuration; standard CD не provision-ит и не переписывает их. Approved post-deploy metadata writer отсутствует (`metadata_sync.enabled=false`).
- **Stop condition:** все Goal AC и required Evidence выполнены либо Goal достигает `BLOCKED` / `PENDING_EXTERNAL_GATE`; существующие objects не мигрируются автоматически; после closure к следующей Goal без новой authorization не переходить.

## Active execution checkpoint

- Updated (UTC): 2026-08-29T22:28:34Z.
- Session mode: authorized full-delivery Goal; все non-goals выше запрещены.
- Base branch/SHA: verified `origin/main@a31770eabcd7a97acfa084252de06f26d041bc1b`.
- Working branch: `codex/pwa-user-ux-storage-isolation`.
- Isolated worktree: `C:/Users/wait9/AppData/Local/Temp/codex-elevenlabs-pwa-user-ux-storage-isolation`.
- Last verified revision: base `a31770eabcd7a97acfa084252de06f26d041bc1b`; текущие documentation edits ещё не committed.
- Working tree at Goal start: isolated worktree clean. Основной checkout содержал unknown/unrelated `.pytest-tmp-*` directories; они сохранены нетронутыми, основной checkout возвращён на `main`.
- Completed: восстановлен exact Git/GitHub state; PR `#258`, exact-main CI/CD и owner LIVE reconciled; прочитаны repository, architecture и CI/CD contracts; создана active Goal; зафиксирован новый 12-AC UX denominator и scope `STORAG-16..21`; начат storage/config/code inventory.
- Current step: завершить implementation design и первый documentation/checkpoint commit.
- Next exact action: проверить canonical docs consistency, выполнить documentation validation и закоммитить Goal/spec/archive checkpoint; затем реализовать semantic status/error и compact transcription presentation.
- Validation and Evidence: base exact-main repository CI `33242536922`, Studio PWA CI `33242536918`, Platform CD `33242536907`/`33242827363`, worker operations `33242755832`/`33242786300`/`33242964630` — success. Current branch validation ещё не запускалась.
- Pull Request / CI / deployment: PR отсутствует; branch не pushed. Initial push разрешён только после полной local validation.
- Blockers: external production bucket/IAM/lifecycle state пока не подтверждён; локальную implementation это не блокирует.
- Unverified assumptions: provider поддерживает два distinct private S3/R2 buckets и independently scoped credentials/lifecycle; production operator сможет предоставить config без secret disclosure. UX audit основан на authenticated production surface и source review, но все изменённые paths ещё должны пройти narrow and desktop browser regression.
- Preserved pre-existing changes: шесть `.pytest-tmp-*` directories в основном checkout; текущая Goal их не читает, не изменяет и не удаляет.

## Project readiness

Метод: выполненные равновесные atomic product AC / все AC current scope из `docs/project-spec.md`. Current snapshot независимо пересчитан после explicit owner addition `PUX-01..12`; ни один новый UX AC до implementation не засчитан. `STORAG-16..21` уже входили в previous denominator. Evidence gate-ит READY, но не меняет numerator.

| Product/epic | Current independent snapshot | Previous independent snapshot | Основание |
|---|---:|---:|---|
| **Полный canonical scope** | **42,9% (`246/574`)** | **43,8% (`246/562`)** | Owner добавил `12` UX AC, выполнено `0/12`; numerator предыдущего Goal подтверждён exact-main delivery/LIVE. Изменение `-0,9` п.п. |
| **Non-commercial scope** | **74,1% (`246/332`)** | **76,9% (`246/320`)** | Colab `32/32` + personal PWA `214/300`; denominator `+12`. Изменение `-2,8` п.п. |
| **Commercial/cross-contour** | **0% (`0/242`)** | **0% (`0/242`)** | Durable BACKLOG, implementation не авторизована. |
| **Google Colab canonical** | **100% (`32/32`)** | **100% (`32/32`)** | Current Goal Colab не затрагивает; applicable delivery Evidence closed. |
| **Personal Studio PWA canonical** | **71,3% (`214/300`)** | **74,3% (`214/288`)** | Новый UX denominator `+12`; storage denominator существовал ранее. Изменение `-3,0` п.п. |
| `PWA-USER-EXPERIENCE-02` | **0% (`0/12`)** | **N/A** | Новый owner-approved epic; audit evidence не считается implementation. |
| `STORAGE-LIFECYCLE-02` | **28,6% (`6/21`)** | **28,6% (`6/21`)** | Goal авторизует `STORAG-16..21`, но CODE/TEST ещё отсутствуют. |

Ни одна сопоставимая оценка не изменилась более чем на `10` п.п.; новый эпик не сравнивается с отсутствовавшим denominator.

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

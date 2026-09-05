# Delivery plan

## Current Goal и граница исполнения

Режим: **IMPLEMENT / DELIVERY существующего hotfix и согласованных документов**. Пользователь 2026-09-05 поручил merge и подтвердил включение audio-upload hotfix вместе с документами: «Да делай мердж». Это снимает прежнюю неопределённость publication scope. Следующая продуктовая Goal пока не выбрана.

- **ID / title:** `AUDIO-REFERENCE-UPLOAD-HOTFIX-01` — поставка готового исправления подтверждения audio-reference upload.
- **State:** `IN_PROGRESS`; текущий этап — PR/CI/merge и стандартная web-поставка. Готовый code commit `d62945912b3e470b2cb8b20912057a4a57c0f6f1` не переписывается.
- **Authorization:** исходное поручение исправить audio upload от 2026-09-05; затем отдельные поручения AUDIT/обновить документы и правила; явное подтверждение merge **документов и hotfix** в текущем чате. Ранее разрешённый synthetic silence WAV около 17 МБ уже подтверждал storage/CORS recovery; повторный upload, processing/STT/Google mutation не входят в текущий delivery scope.
- **Встроенная Goal:** активирована и проверена инструментами приложения 2026-09-05; objective — проверка и merge этого batch, стандартная web-поставка/read-only post-checks, sync local main и подготовка вариантов следующей Goal. Активной Goal до этого не было; дубликат не создавался.
- **Scope:** готовый audio multipart hotfix и regression tests; шесть подготовленных документов (AGENTS, README, spec, plan, archive, CI/CD rules); PR в `Just9120/Elevenlabs-API`, applicable CI, merge в main, web CD и public read-only identity/health. Сам текст референса AGENTS сохраняется полностью, проектные пункты только добавляются.
- **Non-goals:** новая продуктовая реализация по findings; изменение workflows/settings/credentials/CORS, backend/worker/migrations/edge; provider/Google/Telegram side effects; удаление пользовательских sources; следующая Goal.
- **Связь с прежними Goal AC:** `ARU-01` — исторически подтверждённая CORS/storage причина; `ARU-02` — bounded same-part reconciliation, остановка при invalid/unavailable status, безопасные сообщения и completed-session handling; `ARU-03` — tests/CI и поставка исправления. Прежний successful synthetic upload остаётся historical Evidence, не выдаётся за повторный LIVE на новой версии.
- **DoD текущего поручения:** согласованный diff проверен; существенные review findings закрыты; required PR CI successful на final revision; PR merged; стандартный web job successful, deployed web SHA совпадает с merge SHA и read-only health/build checks пройдены; local main синхронизирован; факты сохранены в первичных records и локальном durable checkpoint. Приёмка остальных 687 product AC не входит в этот DoD.
- **Required Evidence:** CODE/TEST/FORMAT/LINT/TYPECHECK/BUILD подтверждены локально; REVIEW self-review PASS; CI/merge/DEPLOY/post-deploy LIVE ожидаются и пока не считаются PASS. Исторический real upload покрывает только прежний scenario/revision.
- **Blockers:** перед публикацией актуальных blockers не выявлено. Ранее auto-review отказал в publication из-за scope; новая явная authorization записана выше. Любой новый отказ рассматривается по фактическому результату, без обхода защиты.
- **Stop condition:** после DoD этого delivery поручения остановиться; предложить варианты следующей Goal без её запуска.

### Batch и Validation Plan

Один PR объединяет уже готовый hotfix commit и согласованные документы по явному выбору владельца. Это завершает подготовленное состояние перед новой Goal; новых code fixes в batch нет. Документация описывает весь проект и аудированный backlog, не расширяя hotfix behavior.

| Проверка / риск | Команда / primary record | Среда / этап | Обязательность и текущее состояние |
| --- | --- | --- | --- |
| Reference/routing и AC consistency | Сравнение полного AGENTS prefix и CI/CD §§1–9 с референсами; 687 уникальных AC в spec/plan, 289 source rows, 40 local links | Local worktree перед commit | REQUIRED; PASS |
| Whitespace / patch | `git diff --check`, совокупный diff относительно origin/main | Local pre-commit | REQUIRED; PASS |
| Audio multipart regression | `node node_modules/vitest/vitest.mjs run src/AudioPreparationUpload.test.tsx` из apps/studio | Windows/Node 22, 2026-09-05 | REQUIRED; PASS, 10 tests, без real storage calls |
| Frontend static/build | `node node_modules/eslint/bin/eslint.js .`, `node node_modules/typescript/bin/tsc -b`, `npm run build` | apps/studio, local перед commit | REQUIRED; PASS. Существующий chunk-size warning остаётся F15 |
| Repository / Studio suites | `CI / checks`, `Studio PWA CI / studio`, `Studio PWA CI / browser-e2e` | GitHub Linux, final PR head/test-merge revision | REQUIRED перед merge; PENDING |
| Review | Self-review diff, GitHub comments/conversations/mergeability и фактические protections | Final PR revision | REQUIRED; local review PASS, remote check PENDING |
| Release | Studio Platform CD selected `deploy-web`, image/commit identity, `/build-meta.json`, `/api/healthz` | production web после merge | REQUIRED; PENDING. Skipped API/worker/migration не считаются deployments |
| Human/product scenarios | Новый real upload/capture/provider/export end-to-end и весь audit backlog | По отдельной Manual Validation/продуктовой Goal | Вне текущего merge DoD; прежние ограничения приёмки сохранены |

Будущие условия: CI success → merge → selected web CD success → exact web SHA/read-only health → sync main. Это условия, не прогнозные PASS/READY; второй набор будущих процентов не создаётся. PR/CI/CD records принадлежат ветке `codex/audio-upload-confirmation`; точные IDs записываются после получения и сверяются при AUDIT/RESUME. Post-deploy facts вне records сохраняются в этом локальном tracked файле до следующего содержательного commit, без отдельного служебного PR.

## Active execution checkpoint

- Updated UTC: `2026-09-05T17:44:11Z`.
- Root: `C:/Users/wait9/OneDrive/Документы/GitHub/Elevenlabs-API`; origin: `https://github.com/Just9120/Elevenlabs-API.git`.
- Verified base/default: `main@dce709df90d4495f7775be93d631ee9a0d3e6f6d` по GitHub API и успешному `git -c http.sslBackend=openssl fetch origin main`. Разовая настройка TLS backend сохранила certificate verification; repo/global Git config не менялась.
- Working branch: `codex/audio-upload-confirmation`; last verified code revision `d62945912b3e470b2cb8b20912057a4a57c0f6f1`; один code commit впереди main, conflicts нет. Шесть исходных незакоммиченных документов принадлежат завершённым задачам этого чата и явно включены владельцем в batch.
- Preserved state: existing ignored/inaccessible pytest directories и остальные unknown files не трогались; source/workflows вне готового hotfix не менялись. Tmp diagnostics в ignored `tmp/audit-2026-09-05/` не публикуются.
- Completed: полный AUDIT (289 source units, 687 AC), новые policy references с сохранением полного AGENTS, self-review code/docs и local validation из таблицы. Source-level реализация остаётся 356/687 (51.8%); полный numerator приёмки не установлен, нулём не заменяется.
- Current step: документы committed в `45801805c8aeb6bdc7baae67af68d9b2e9d2bd73` поверх готового hotfix; ветка опубликована, [PR #301](https://github.com/Just9120/Elevenlabs-API/pull/301) OPEN/MERGEABLE. Tracked worktree после commit был clean; далее только локальный durable checkpoint без служебного commit.
- PR CI на `45801805c8aeb6bdc7baae67af68d9b2e9d2bd73`: [CI 33981927044](https://github.com/Just9120/Elevenlabs-API/actions/runs/33981927044) FAIL в `tests/test_security_policy.py::test_project_spec_owns_durable_colab_security_constraints`: тест ожидает буквальный marker `Baseline repository and Studio CI must remain secretless`. В новой формулировке профиля смысл был сохранён, literal marker — нет. Исходная фраза восстановлена в Project profile; tests и универсальные §§1–9 не ослаблены. [Studio PWA CI 33981927029](https://github.com/Just9120/Elevenlabs-API/actions/runs/33981927029): studio и browser-e2e SUCCESS. После doc correction требуется CI новой revision; прежний FAIL не считается success.
- Local doc-correction validation: `python -m pytest -q --portable -p no:cacheprovider tests/test_security_policy.py` — 3 passed; reference/687 AC/289 sources/40 links consistency и `git diff --check` — PASS. Product CODE numerator не изменился (356/687, 51.8%); full acceptance numerator по-прежнему не установлен.
- **Next exact action:** отправить проверенную doc correction в тот же PR и дождаться terminal success трёх required jobs на новой revision; повторно сверить head/base и merge gates, выполнить разрешённый merge и applicable web delivery.
- Primary records до этого batch: PR #300 merged в `dce709df90d4495f7775be93d631ee9a0d3e6f6d`; прошлый main CI/Studio CI successful. Эти runs не заменяют validation новой revision.
- Historical runtime: 2026-09-05 11:03 UTC owner CORS recovery и successful synthetic multipart audio upload на web `dce709df90d4495f7775be93d631ee9a0d3e6f6d`, API/worker `e00febc5f77ebb9bcc8cd797a09ee7c1a94354b7`. Audit public GET позже подтвердили web identity и API health/schema `0037_ux_audit_controls`; private scenarios и worker identity не перепроверялись.

### Локальное обновление repository rules — 2026-09-05

- Основание: пользователь предоставил новые `repository/AGENTS.md` и `repository/ci-cd-rules.md`, поручил заменить старые правила и адаптировать их к проекту. Это отдельная локальная documentation task; предыдущая product Goal не возобновлена, code/workflows/settings и публикация не разрешены этим поручением.
- Результат: после уточнения пользователя root AGENTS содержит полный неизменённый текст нового референса и отдельный §9 с проектными дополнениями; CI/CD §§1–9 заменены новым Safety contract, §10 содержит фактические команды, CI/CD profile, защищённые lanes и durable handoff. Старое имя migration class MANUAL_GATED сопоставлено EXPLICITLY_GATED с сохранением gates. Universal safety policy изменена по этому явному поручению, а не для снятия blocker.
- Сохранены прежние локальные результаты AUDIT в README/spec/plan/archive. В отличие от предыдущего checkpoint, теперь изменены AGENTS и весь CI/CD document. Branch/HEAD не менялись; commit/push/PR/merge/deploy не выполнялись. Built-in product Goal не активировалась: поручена замена документов.
- Scope и Evidence product AC этой задачей не пересматривались. Реестр ниже — snapshot предшествующего аудита с его оговорками: source-level 356/687 (51.8%), полный numerator приёмки не установлен. Введение словаря IMPLEMENTED/READY не является автоматической переклассификацией старых строк или runtime Evidence; следующая разрешённая сверка должна применять новые определения к каждому затронутому AC.
- Validation документации на worktree поверх `d62945912b3e470b2cb8b20912057a4a57c0f6f1`, 2026-09-05: readback и self-review PASS; §§1–9 CI/CD совпадают с новым референсом; четыре проектные lane-секции сохранены с перенумерацией и явным соответствием migration class. Проверены 16 локальных links, 16 profile paths, сохранность README/spec/archive по SHA-256 и отсутствие code/workflow diff. `git diff --check` PASS; `python scripts/ci_checks.py` PASS. Full product suites не повторялись для изменения правил. При source review исключено неподтверждённое утверждение об общем remote deployment lock: найденный flock относится только к backup.
- Размер AGENTS после восстановления полного референса: 127 строк, 24,896 bytes (24.3 KiB); вместе с существующим глобальным AGENTS — 29,298 bytes. Полный исходный файл сохранён byte-for-byte как префикс: удалений и замен в нём нет, добавлен только §9. [OpenAI рекомендует краткие практичные инструкции со ссылками](https://learn.chatgpt.com/guides/best-practices); [32 KiB — default лимит загрузки, а не рекомендуемый целевой размер](https://learn.chatgpt.com/docs/agent-configuration/agents-md). Точного лимита строк эти страницы не задают; global settings не менялись.
- Уточнение пользователя: адаптация AGENTS должна только добавлять проектные строки. Предыдущая версия сокращала формулировки и объединяла разделы; это исправлено восстановлением всего референса без редактирования его текста. Validation: byte-for-byte prefix comparison PASS, ссылки проектного дополнения PASS, общий размер с глобальным AGENTS ниже 32 KiB, `git diff --check` PASS. CI/CD и результаты продуктового аудита этой коррекцией не изменены.
- Documentation task завершена локально. **Next exact action для продукта:** дождаться выбранной владельцем Goal или явного продолжения hotfix.

## Project readiness — текущий и предыдущий snapshots

Предыдущий snapshot документации: `359/610` (58,9%), Colab `32/32`, personal PWA `327/336`, commercial/cross-contour `0/242`. Это предыдущая оценка, не вход в текущий подсчёт.

Текущий source-level numerator — сумма строк CODE ✅ реестра ниже: **356/687 (51.8%)**. Denominator `610 + 77 = 687` уникальных AC; `RUNTIME-RISK-COLAB-01` и другие gap-записи в denominator не включены. Уменьшение относительно прежних процентов связано с новым scope и reopened/недоказанными AC, а не с изменением продуктового кода в AUDIT. Общие компоненты в source-level оценке считаются один раз; commercial delivery отдельно не подтверждён (EVC-13/31 остаются backlog).

**Полный текущий numerator приёмки не установлен. Нижняя граница полноценно перепроверенных dossiers в этом аудите — 0/687; это не оценка приёмки проекта в 0%.** Ни одному AC автоматически не присвоен полный набор обязательных Evidence: локальные/CI checks не заменяют AC-specific LIVE, а прежние blanket READY/owner-report claims не перенесены автоматически. Это консервативная нижняя граница подтверждений данного аудита, а не утверждение, что работающие функции отсутствуют. Историческую приёмку необходимо дополнить проверкой точных сценариев/records; отсутствие повторного LIVE само по себе её не опровергает. пометки —/◐ не равны доказанному failure.

| Эпик | CODE, numerator/denominator | Подтверждённая нижняя граница приёмки | Статус |
|---|---:|---:|---|
| `COLAB-BATCH-01` | 24/24 (100.0%) | 0/24 | 🟦 IN PROGRESS |
| `COLAB-REALTIME-01` | 5/6 (83.3%) | 0/6 | 🟦 IN PROGRESS |
| `PWA-CORE-01` | 14/14 (100.0%) | 0/14 | 🟦 IN PROGRESS |
| `PWA-USER-EXPERIENCE-02` | 13/13 (100.0%) | 0/13 | 🟦 IN PROGRESS |
| `PWA-UX-POLISH-03` | 8/8 (100.0%) | 0/8 | 🟦 IN PROGRESS |
| `PWA-UX-CONTROLS-04` | 14/14 (100.0%) | 0/14 | 🟦 IN PROGRESS |
| `PWA-TRANSCRIPTIONS-UX-01` | 4/4 (100.0%) | 0/4 | 🟦 IN PROGRESS |
| `PWA-INGEST-01` | 11/11 (100.0%) | 0/11 | 🟦 IN PROGRESS |
| `PWA-GOOGLE-PICKER-UX-01` | 8/8 (100.0%) | 0/8 | 🟦 IN PROGRESS |
| `PWA-SEGMENTS-01` | 5/5 (100.0%) | 0/5 | 🟦 IN PROGRESS |
| `PWA-BATCH-01` | 11/11 (100.0%) | 0/11 | 🟦 IN PROGRESS |
| `PWA-AUDIO-PREPARATION-01` | 30/30 (100.0%) | 0/30 | 🟦 IN PROGRESS |
| `PWA-SPEAKER-IDENTITY-01` | 5/5 (100.0%) | 0/5 | 🟦 IN PROGRESS |
| `PWA-MANIFEST-01` | 5/6 (83.3%) | 0/6 | 🟦 IN PROGRESS |
| `PWA-STANDARDIZATION-01` | 14/14 (100.0%) | 0/14 | 🟦 IN PROGRESS |
| `PWA-TRANSCRIPT-MAINTENANCE-01` | 8/9 (88.9%) | 0/9 | 🟦 IN PROGRESS |
| `PWA-REALTIME-01` | 12/13 (92.3%) | 0/13 | 🟦 IN PROGRESS |
| `PWA-OPERABILITY-01` | 18/18 (100.0%) | 0/18 | 🟦 IN PROGRESS |
| `COLAB-LIFECYCLE-02` | 2/2 (100.0%) | 0/2 | 🟦 IN PROGRESS |
| `PWA-SECURITY-HARDENING-02` | 18/18 (100.0%) | 0/18 | 🟦 IN PROGRESS |
| `GOOGLE-DRIVE-RELIABILITY-02` | 6/6 (100.0%) | 0/6 | 🟦 IN PROGRESS |
| `STORAGE-LIFECYCLE-02` | 16/21 (76.2%) | 0/21 | 🟦 IN PROGRESS |
| `STT-PROVIDER-ABSTRACTION-01` | 13/14 (92.9%) | 0/14 | 🟦 IN PROGRESS |
| `YANDEX-STT-01` | 1/5 (20.0%) | 0/5 | 🟦 IN PROGRESS |
| `PWA-DICTIONARIES-01` | 1/1 (100.0%) | 0/1 | 🟦 IN PROGRESS |
| `PWA-WORKER-ISOLATION-02` | 3/3 (100.0%) | 0/3 | 🟦 IN PROGRESS |
| `PWA-DATABASE-LEAST-PRIVILEGE-03` | 7/8 (87.5%) | 0/8 | 🟦 IN PROGRESS |
| `JOB-RELIABILITY-02` | 17/17 (100.0%) | 0/17 | 🟦 IN PROGRESS |
| `JOB-NOTIFICATIONS-01` | 6/6 (100.0%) | 0/6 | 🟦 IN PROGRESS |
| `REALTIME-CONTINUITY-02` | 5/5 (100.0%) | 0/5 | 🟦 IN PROGRESS |
| `TRANSCRIPT-EXPORTS-02` | 0/3 (0.0%) | 0/3 | ⬜ BACKLOG |
| `USAGE-COST-ACCOUNTING-01` | 5/6 (83.3%) | 0/6 | 🟦 IN PROGRESS |
| `OBSERVABILITY-AUDIT-02` | 35/35 (100.0%) | 0/35 | 🟦 IN PROGRESS |
| `RELEASE-SAFETY-02` | 4/5 (80.0%) | 0/5 | 🟦 IN PROGRESS |
| `ENVIRONMENT-CAPABILITIES-01` | 0/50 (0.0%) | 0/50 | ⬜ BACKLOG |
| `COMMERCIAL-INFRA-DATA-01` | 0/20 (0.0%) | 0/20 | ⬜ BACKLOG |
| `COMMERCIAL-IDENTITY-01` | 0/18 (0.0%) | 0/18 | ⬜ BACKLOG |
| `COMMERCIAL-DATA-GOVERNANCE-01` | 0/26 (0.0%) | 0/26 | ⬜ BACKLOG |
| `COMMERCIAL-CROSS-BORDER-01` | 0/14 (0.0%) | 0/14 | ⬜ BACKLOG |
| `COMMERCIAL-STT-QUOTA-01` | 0/16 (0.0%) | 0/16 | ⬜ BACKLOG |
| `COMMERCIAL-SPEAKER-PRIVACY-01` | 0/3 (0.0%) | 0/3 | ⬜ BACKLOG |
| `COMMERCIAL-QUEUE-FAIRNESS-01` | 0/6 (0.0%) | 0/6 | ⬜ BACKLOG |
| `COMMERCIAL-BILLING-01` | 0/27 (0.0%) | 0/27 | ⬜ BACKLOG |
| `COMMERCIAL-ECONOMICS-01` | 0/15 (0.0%) | 0/15 | ⬜ BACKLOG |
| `COMMERCIAL-SECURITY-01` | 0/21 (0.0%) | 0/21 | ⬜ BACKLOG |
| `COMMERCIAL-NOTIFICATIONS-01` | 0/8 (0.0%) | 0/8 | ⬜ BACKLOG |
| `COMMERCIAL-LEGAL-01` | 0/18 (0.0%) | 0/18 | ⬜ BACKLOG |
| `RESULTS-STUDIO-02` | 0/17 (0.0%) | 0/17 | ⬜ BACKLOG |
| `YANDEX-DISK-01` | 0/9 (0.0%) | 0/9 | ⬜ BACKLOG |
| `REALTIME-RECOVERY-03` | 1/8 (12.5%) | 0/8 | 🟦 IN PROGRESS |
| `PWA-REQUIREMENTS-05` | 0/8 (0.0%) | 0/8 | ⬜ BACKLOG |
| `MEDIA-CONTRACT-03` | 1/8 (12.5%) | 0/8 | 🟦 IN PROGRESS |
| `PERSONAL-VOICE-02` | 1/5 (20.0%) | 0/5 | 🟦 IN PROGRESS |
| `SECURITY-LIFECYCLE-03` | 5/6 (83.3%) | 0/6 | 🟦 IN PROGRESS |
| `RECOVERY-DATA-03` | 0/7 (0.0%) | 0/7 | ⬜ BACKLOG |
| `COMMERCIAL-COMPLETENESS-02` | 0/9 (0.0%) | 0/9 | ⬜ BACKLOG |

## Validation и Evidence index

| ID | Проверка | Terminal result / ограничение |
|---|---|---|
| V-STATIC | `python scripts/ci_checks.py` | PASS, все 7 lightweight guards |
| V-WEB | direct Vitest `node node_modules/vitest/vitest.mjs run` | PASS: 68 files, 716 tests; существующий node_modules имеет pnpm layout, npm clean install не выполнялся |
| V-PY | `python -X utf8 -m pytest -q --portable -p no:cacheprovider --basetemp=...` | 1363 passed, 5 skipped, 9 failed; failures вызваны system WSL bash. Отдельная syntax check с Git Bash PASS; 8 worker fixtures по-прежнему выбирают system bash. Required Linux CI отдельно PASS; full local PostgreSQL/Redis suite не запускалась |
| V-SANDBOX | Первые Vitest/pytest attempts | FAILED environment: esbuild EPERM / pytest temporary-directory PermissionError; approved диагностические reruns выполнены |
| V-TYPES | ESLint и `tsc -b` direct node entrypoints | PASS, logs пустые; Vite production build PASS, warning chunk 694.75 kB (194.57 kB gzip) |
| V-NPM | npm audit committed package-lock, 2026-09-05 | FAIL: 6 unique advisories / 2 leaf packages, 86 affected/metavulnerability entries; fix не применялся |
| V-PIP | global `pip check` | FAIL из-за несовместимостей unrelated installed projects; не является дефектом requirements этого repo. Exact isolated Python advisory audit не выполнялся |
| V-YANDEX | synthetic official-shape normalization без сети, SQLite memory | Числа 1000/2000 дают 1.0/2.0 s; строки "1000"/"2000" дают None/None — F04 reproduced |
| V-CI | main CI [33948143149](https://github.com/Just9120/Elevenlabs-API/actions/runs/33948143149) | checks SUCCESS, exact main dce709d |
| V-STUDIO-CI | [33948143141](https://github.com/Just9120/Elevenlabs-API/actions/runs/33948143141) | studio SUCCESS; browser-e2e SUCCESS, exact main dce709d |
| V-CD | [33948143144](https://github.com/Just9120/Elevenlabs-API/actions/runs/33948143144) | deploy-web SUCCESS; API, worker, migration SKIPPED — это не их delivery Evidence |
| V-PR | [PR #300](https://github.com/Just9120/Elevenlabs-API/pull/300) | MERGED; final head 5c87d96, CI 33947954714 / 33947954700 SUCCESS; previous implementation-head runs cancelled и не считаются success |
| V-ADVISORY-OLD | Dependency audit [33384307698](https://github.com/Just9120/Elevenlabs-API/actions/runs/33384307698) | SUCCESS на 8957e974, 2026-08-31; не покрывает нынешние advisory/HEAD |
| V-LIVE | public health/build read | HTTP 200, web identity main dce709d, schema 0037; без authenticated/paid сценариев |

Все code references ниже относятся к d629459, backend/Colab/config source совпадает с main dce709d. В references с сокращённым filename directory наследуется от первого соседнего пути того же типа; glob означает просмотренную соответствующую module/test surface. TEST ◐ означает наличие и прогон subsystem checks без утверждения о полной трассировке конкретного AC к assertion. Для новой отсутствующей функции зелёная общая suite не является TEST Evidence.

## Реестр findings и backlog

Приоритет: P1 — существенный product/correctness/security/release gap, P2 — ограниченная функциональность или maintainability/validation gap. Для всех source findings revision `d62945912b3e470b2cb8b20912057a4a57c0f6f1`; backend source совпадает с remote main `dce709d`. Рекомендации не авторизуют исправления.

| ID | Приоритет / AC или область | Проверенное Evidence | Влияние и рекомендуемое действие | Уверенность |
|---|---|---|---|---|
| F01 | P1 · RS-01..17, PM-05, TRANSC-01..03, STORAG-10 | `main.py:554–558`: обязательный output_folder_id; `job_output_destination.py:89–110`: обязательный Google grant; `job_output_read.py:7–18`: output DTO содержит ссылку/metadata, без retained transcript; `models.py`: Google output, нет самостоятельной модели сохранённого batch transcript; `JobOutputsSection.tsx` | Без Drive batch не реализует согласованный Studio-only результат. Нет полного retained transcript, DOCX UI и независимого export lifecycle. Сначала спроектировать canonical retained artifact и состояния recognition/export, затем storage/retention, downloads и exports; не маскировать Google failure как завершённый Studio result. | Высокая, source-level; production потеря данных не заявляется |
| F02 | P1 · YD-01..09, EVC-13, S007/041–044 | `models.py:16`: SourceType только local_upload/google_drive; source/config/routes search не обнаружил Yandex Disk adapter; Yandex modules относятся к SpeechKit | Согласованный Яндекс Диск отсутствует в обоих контурах. Требуются отдельные OAuth/source/destination/export adapters и version-aware retry; зависит от F01. | Высокая |
| F03 | P1 · RTC-01..07 | `realtimeSession.ts:549–573` закрывает transport и сообщает «Автоподключение отключено»; MediaRecorder/audio replay path не найден; `realtime_drafts.py` хранит encrypted draft, не полное audio | Краткий обрыв не сохраняет непрерывность по новому intent. Нужны новая capability на reconnect, bounded buffer, segment identity/dedup и видимый gap; audio recording — отдельный явный режим со storage/retention. | Высокая |
| F04 | P1 · YANDEX-01/02/05, MC-08 | `yandex_transcription.py:339–345` обрабатывает времена только int/float; [official REST schema](https://aistudio.yandex.ru/en/docs/speechkit/stt-v3/api-ref/AsyncRecognizer/getRecognition) задаёт строковые startTimeMs/endTimeMs. V-YANDEX воспроизвёл `(1.0,2.0)` для чисел и `(None,None)` для строк; tests используют числа | При реальном JSON теряются word timings, от которых зависят samples/timed exports. Добавить faithful REST fixtures и строгую bounded normalization числовых строк. Текстовое распознавание само по себе может продолжить работать. | Высокая, воспроизведено локально без paid call |
| F05 | P1 · YANDEX-03, STTPRO-05, MC-09, RTC-06 | `stt_provider.py` объявляет Yandex realtime diarization; `yandex_realtime_relay.py:269–277` всегда посылает REAL_TIME + SPEAKER_LABELING_ENABLED. [Yandex speaker labeling](https://yandex.cloud/ru-kz/docs/speechkit/stt/speaker-labeling) описывает FULL_DATA и до 2 speakers. Relay `:314–361` хранит один pending_final без final_index и отдаёт refinement как новый committed chunk; UI append-ит committed text | Capability promise требует проверки/коррекции. При final → partial → late refinement старый текст уже committed, correction может дублироваться; несколько finals также нуждаются в indexed state. Нужны official-protocol fixtures и opt-in canary. Это source/API compatibility finding, не утверждение о наблюдённом production отказе. | Высокая для конфликта metadata; средняя для фактических provider outcomes |
| F06 | P2 · MC-01/03/04/06/07/08, UXN-03/05/06/07 | `job_google_docs_output.py:155–162,207–219` не получает фактический provider/model и пишет ElevenLabs/current model; неизвестная дата становится Created at: unknown. `AudioPreparationPage.tsx:554` фиксирует template `{title}`. `media_preparation.py` содержит duration 4h/12h checks, но полная до-запуска проверка/привязка всех новых сценариев не подтверждена | Метаданные Yandex результата неверны; дата нарушает новый S135. Добавить фактический provider/model и provenance; отдельно закрыть preflight/partial timeline сценарии. Сам default 12h уже есть и не считается дефектом; Yandex 4h provider ceiling не объявляется ошибкой общего лимита. | Высокая для metadata; средняя для preflight coverage gaps |
| F07 | P2 · UXN-01/02/09, PTM-01 | `PlatformSidebar.tsx:4–9` имеет 4 пункта, Projects отсутствует; `platformRouting.ts` alias /projects → transcriptions. Audio UI не предоставляет naming templates; прежний workspace label «Подготовка документов». Diagnostics exact-ID и новое удобство поиска требуют отдельных checks | Есть drift относительно S014/060/143/250. В новой UX Goal определить содержание Projects, добавить заданные controls; внутренний technical Project не делать обязательным шагом новой транскрибации. | Высокая для nav/template/label; средняя для полного search UX |
| F08 | P2 · VID-01..04 | `speaker_identity.py`, `speaker_assignment.py`, `speaker_sample.py`: ручная база имён/ролей и bounded sample из source; voiceprint/embedding matcher и долговременные voice samples отсутствуют | Ручное назначение не равно согласованной optional automatic voice identification. Нужны отдельный personal feature, модель сохранённых образцов, consent/retention/deletion и выбор алгоритма; ordinary diarization не блокировать. | Высокая |
| F09 | P1 · EVC, commercial epics, CX | `compose.platform.yml` — один personal stack; `config.py`, `models.py`, routes/UI не имеют complete commercial environment/capability/billing/registration graph | Commercial production и три personal capability-набора не готовы. Заданный scope сохранён, реализации нет; сначала выбрать Goal по контурам/capabilities и зависимостям F01/F02. Правовые решения/тарифы не выдумывать. | Высокая в пределах repo; сторонняя неучтённая инфраструктура не проверялась |
| F10 | P1 · STORAG-05/10/12/13/15, REC-01..07 | `source_storage.py:390–406` delete/head только текущего объекта, без version enumeration; storage_reconciliation относится к source objects; долговременный full transcript отсутствует. Backup scripts/runbook есть, свежий isolated restore/RPO/RTO measurement не получен | Source expiry не закрывает весь lifecycle. Требуются версии/копии, transcript/history/analytics rules, truthful deletion state и restore, не возвращающий удалённые данные. Production cleanup/restore в AUDIT не выполнялись. | Высокая для version/transcript gap; ограниченная для действующего backup schedule |
| F11 | P2 · USAGEC-02 | `provider_usage_accounting.py`, `config.py`: immutable tariff/provenance hooks есть, цена конфигурируема и может отсутствовать; прежний AC оставался открытым, актуальный тарифный runtime evidence не получен | Не утверждать точную себестоимость или billed spend там, где источник неизвестен. Закрыть конфигурацию/provenance/rounding и per-provider applicability в отдельной cost Goal; данные аккаунта не распределять произвольно по jobs. | Средняя; отсутствие runtime evidence не равно отсутствию кода |
| F12 | P1 · зависимости / security validation | V-NPM: locked browserslist 4.28.4 и fast-uri 3.1.5; 2 + 4 high advisories, 86 entries включая dependents. Примеры: [browserslist OOM](https://github.com/advisories/GHSA-c83g-rgw3-j3cx), [fast-uri canonicalization](https://github.com/advisories/GHSA-5jgf-p345-68v8). `package.json` закрепляет fast-uri override 3.1.5 | Новые advisory делают прежний audit 31 августа недостаточным. Нужны triage по реальному использованию, допустимые patched versions, lock regeneration и точный Node/Python audit. Не запускать blind audit fix и не выдавать build-tool advisory за доказанный backend SSRF. | Высокая для audit report/locked versions; exploitability не установлена |
| F13 | P1 · CI/CD enforcement | GitHub API: main protected=false, rulesets=[], allowed_actions=all, sha_pinning_required=false; обычные component CD jobs без protected Environment; migration Environment main-only + один reviewer | Проверки/review не enforced платформой; owner/admin может случайно обойти delivery discipline. Предложить отдельную explicit settings/CI-policy Goal. Workflows сами pin actions и default token read-only — это действующие compensating controls. | Высокая, текущий settings read |
| F14 | P2 · воспроизводимость local validation | V-PY: portable исключает 9 modules, но ещё использует shell tests, выбирающие WSL bash; runbook говорит о 6 исключениях. Existing node_modules pnpm-layout, canonical lock npm; global pip содержит unrelated conflicts | Portable Windows baseline не даёт clean green по заявленному пути. Сделать shell discovery/portable profile честными и проверять isolated constrained installs. В AUDIT пакеты/lockfiles/tests не менялись. | Высокая; Linux main CI green |
| F15 | P2 · coupling / performance | `App.tsx` 10518 строк, `main.py` 4798; Vite main chunk 694.75 kB (194.57 kB gzip). Много domain helpers уже выделено; часть route/auth DTO и frontend orchestration сосредоточена в этих файлах | Новые results/storage/provider changes затронут крупные coupled surfaces. Выделять ownership и route/page boundaries по мере согласованной feature Goal; chunk warning не доказывает медленный runtime или необходимость тотального rewrite. | Высокая для размера; средняя для влияния |
| F16 | P2 · документация / readiness | Старый spec одновременно называл READY и LIVE ◐, хранил current schema 0033 рядом с новым 0037; plan перечислял закрытые Goals как IN_PROGRESS. Current checkpoint SHA 26bf0e8 не равен HEAD d629459. Старый CI profile claim о lack of expected SHA опровергается bundle transport `:37–51,79–117` | Локально устранены operational дубли в spec/plan и stale profile; useful closed Goal contracts перенесены в archive. Старый historical факт не повышается до current Evidence. AGENTS policy не переписан — override текущей инструкции явно зафиксирован. | Высокая; documentation correction выполнена |

Основная архитектура: PostgreSQL владеет jobs/leases/checkpoints/outbox и безопасными metadata; R2 — source/audio bytes; Google Docs — внешний transcript artifact. Redis — rate limits/readiness, а не durable queue. Worker отделён по ресурсам и DB grants, I/O вынесен из длительных DB transactions; lease generation/revalidation и uncertain-outcome state — важные действующие safety boundaries. Самое значимое изменение для нового scope — перенести владение полной принятой транскрипцией внутрь Studio, сохранив внешний export отдельным side effect.

API/schema: 37 последовательных Alembic revisions, current head 0037; exact-main CI проверил upgrade. Legacy source IDs/output DTO защищены owner checks и CSRF в рассмотренных маршрутах. SourceType/Google-specific output model ограничивают новый Yandex Disk и Studio-only workflow. Race/tenancy formal proof для каждого endpoint не выполнялся; коммерческая изоляция/RLS не выводятся из personal ownership filters. Generated protobuf и dynamically used modules не предлагались к удалению.

## Evidence-поверхности по группам AC

| Префикс | CODE paths | TEST paths |
|---|---|---|
| CB | elevenlabs_api.py; notebooks/elevenlabs_api_colab.ipynb | tests/test_text_processing_helpers.py |
| CR | elevenlabs_realtime.py; notebooks/elevenlabs_realtime_colab.ipynb | tests/test_realtime_static.py |
| PC | apps/studio/src/App.tsx; apps/studio-api/studio_api/main.py; source_storage.py; auth_retention.py | apps/studio/src/App.test.tsx; tests/test_studio_api_core.py; tests/test_studio_reference_storage.py |
| PUX | apps/studio/src/App.tsx; JobCard.tsx; JobProgressPipeline.tsx | apps/studio/src/App.test.tsx; JobCard.test.tsx; JobProgressPipeline.test.tsx |
| UXPOL | apps/studio/src/App.tsx | apps/studio/src/App.test.tsx |
| UXCTL | apps/studio/src/App.tsx; apps/studio-api/studio_api/main.py; job_output_reconciliation.py; diagnostic_reports.py | apps/studio/src/App.test.tsx; tests/test_studio_ux_audit_controls_schema.py |
| PT | apps/studio/src/multiTranscriptionModel.ts; App.tsx; platformRouting.ts | apps/studio/src/multiTranscriptionModel.test.ts; platformRouting.test.ts |
| PI | apps/studio/src/App.tsx; apps/studio-api/studio_api/google_drive_folder_intake.py | apps/studio/src/App.test.tsx; tests/test_studio_google_drive_folder_intake.py |
| PG | apps/studio/src/GoogleDriveFolderPickerDialog.tsx; googlePicker.ts; documentScrollLock.ts | apps/studio/src/GoogleDriveFolderPickerDialog.test.tsx; documentScrollLock.test.ts |
| PS | apps/studio/src/batchComposerModel.ts; apps/studio-api/studio_api/media_clip.py | apps/studio/src/batchComposerModel.test.ts; tests/test_studio_media_clip.py |
| PB | apps/studio-api/studio_api/job_google_docs_output.py; job_progress.py; transcription_options.py; apps/studio/src/App.tsx | tests/test_studio_job_google_docs_output.py; test_studio_job_progress.py; test_studio_transcription_options.py |
| AP | apps/studio-api/studio_api/audio_preparation*.py; direct_drive_upload.py; apps/studio/src/AudioPreparationPage.tsx; localAudioProcessing.ts; directDriveUpload.ts | tests/test_studio_audio_preparation*.py; test_studio_direct_drive_upload.py; apps/studio/src/AudioPreparation*.test.tsx; localAudioProcessing.test.ts; directDriveUpload.test.ts |
| SP | apps/studio-api/studio_api/speaker_identity.py; speaker_assignment.py; speaker_sample.py; apps/studio/src/SpeakerIdentityPanel.tsx | tests/test_studio_speaker_identity.py; apps/studio/src/SpeakerIdentityPanel.test.tsx |
| PM | apps/studio-api/studio_api/transcript_catalog*.py; batch_preflight.py | tests/test_studio_transcript_catalog*.py; test_studio_batch_preflight.py |
| PD | apps/studio-api/studio_api/transcript_document.py; transcript_catalog_standardize.py; transcript_maintenance*.py | tests/test_studio_transcript_document.py; test_studio_transcript_maintenance*.py |
| PTM | apps/studio-api/studio_api/transcript_maintenance*.py; apps/studio/src/TranscriptCatalogMigrationPanel.tsx | tests/test_studio_transcript_maintenance*.py; apps/studio/src/TranscriptCatalogMigrationPanel.test.tsx |
| PR | apps/studio/src/realtimeSession.ts; LiveTranscriptionPanel.tsx; realtimeDrafts.ts; apps/studio-api/studio_api/realtime_drafts.py | apps/studio/src/realtimeSession.test.ts; LiveTranscriptionPanel.test.tsx; realtimeDrafts.test.ts; tests/test_studio_realtime_drafts.py |
| PO | apps/studio-api/studio_api/diagnostic_reports.py; diagnostic*.py; transcription_analytics.py; apps/studio/src/App.tsx | tests/test_studio_diagnostic_reports.py; test_studio_transcription_analytics.py; apps/studio/src/App.test.tsx |
| COLABL | notebooks/*.ipynb; elevenlabs_api.py; elevenlabs_realtime.py | scripts/ci_checks.py; tests/test_realtime_static.py |
| PWASEC | apps/studio-api/studio_api/security.py; deps.py; main.py; account_security.py; session_control.py; auth_retention.py; rate_limit.py | tests/test_studio_account_security.py; test_studio_csrf_contract.py; test_studio_session_control.py; test_studio_rate_limit.py |
| GOOGLE | apps/studio-api/studio_api/google_connection_access.py; google_drive_upload.py; google_oauth.py; job_output_destination.py | tests/test_studio_google_token_refresh.py; test_studio_google_drive_upload.py; test_studio_job_source_availability.py |
| STORAG | apps/studio-api/studio_api/source_storage.py; source_deletion.py; storage_reconciliation.py; source_policy.py; deploy/studio/compose.platform.yml | tests/test_studio_storage_reconciliation.py; test_studio_source_deletion.py; test_studio_reference_storage.py |
| STTPRO | apps/studio-api/studio_api/stt_provider.py; job_stt_transcription.py; stt_provider_health.py | tests/test_studio_stt_provider.py; test_studio_yandex_transcription.py |
| YANDEX | apps/studio-api/studio_api/yandex_transcription.py; yandex_realtime_relay.py; yandex_realtime.proto | tests/test_studio_yandex_transcription.py; tmp/audit-2026-09-05/yandex_probe.py |
| PWADIC | apps/studio-api/studio_api/stt_dictionaries.py; apps/studio/src/SttDictionariesPanel.tsx | tests/test_studio_stt_dictionaries.py; apps/studio/src/SttDictionariesPanel.test.tsx |
| PWAWOR | deploy/studio/compose.platform.yml; apps/studio-api/studio_api/worker.py; scripts/manage_studio_worker.sh | tests/test_studio_worker.py; test_studio_worker_compose.py; test_studio_worker_isolation_report.py |
| DBLP | deploy/studio/database-roles.sql; worker-db-role.sql; scripts/configure_studio_database_roles.sh | tests/test_studio_database_roles.py; test_studio_worker_db_role_integration.py |
| JOBREL | apps/studio-api/studio_api/job_processing*.py; job_retry_recovery.py; job_claim_lease.py; provider_part_checkpoints.py; job_notifications.py | tests/test_studio_job_processing*.py; test_studio_job_retry_recovery.py; test_studio_job_notifications.py; test_studio_processing_e2e.py |
| JOBNOT | apps/studio-api/studio_api/job_notifications.py; apps/studio/src/NotificationsPanel.tsx; apps/studio/public/push-handler.js | tests/test_studio_job_notifications.py; apps/studio/src/NotificationsPanel.test.tsx |
| REALTI | apps/studio/src/realtimeConsumers.ts; RealtimeOverlay.tsx; apps/studio-api/studio_api/realtime_consumers.py | apps/studio/src/realtimeConsumers.test.ts; tests/test_studio_realtime_consumers.py |
| TRANSC | apps/studio/src/JobOutputsSection.tsx; apps/studio-api/studio_api/job_output_read.py | tests/test_studio_job_output_read.py; apps/studio/src/JobOutputsSection.test.tsx |
| USAGEC | apps/studio-api/studio_api/provider_usage_accounting.py; elevenlabs_account.py; provider_account_sync.py; apps/studio/src/ElevenLabsAccountPanel.tsx | tests/test_studio_provider_usage_accounting.py; test_studio_elevenlabs_account.py; apps/studio/src/ElevenLabsAccountPanel.test.tsx |
| OBSERV | apps/studio-api/studio_api/runtime_observability.py; operational_alerts.py; audit.py; trace_context.py; diagnostics.py | tests/test_studio_runtime_observability.py; test_studio_operational_alerts.py; test_studio_diagnostics.py |
| RELEAS | .github/workflows/*.yml; scripts/deploy_studio_platform_component_bundle_transport.sh; deploy/studio/* | tests/test_studio_platform_component_deploy.py; test_studio_edge_release.py; test_studio_migration_release.py |

Новые RS/TRANSC проверяются через output DTO, модели, маршруты и JobOutputsSection; YD — SourceType/GoogleConnection/models и отсутствие Yandex Disk adapter; RTC — realtimeSession/relay/drafts; UXN — App/PlatformSidebar/AudioPreparationPage/job_google_docs_output; MC — media_preparation/stt_provider/yandex_transcription; VID — speaker_identity/sample; SECX — account_security/main/security; REC — backup scripts/runbooks; CX и остальные commercial prefixes — EVC/config/models/compose и отсутствие отдельного contour. Это negative/partial evidence, не утверждение о полном dead-code анализе.

## Полный проверенный реестр AC

Каждый canonical ID присутствует один раз. SPEC ✅ для всех строк. CODE ✅ — подтверждённая реализация указанной source surface, ◐ — частичная/недоказанная полнота, — — отсутствует. TEST ◐ — subsystem coverage; CI ✅ означает применимый main source check, CI ◐ для frontend означает отсутствие CI именно неопубликованного hotfix. DEPLOY ◐ — только исторический component record/health, LIVE ◐ — лишь общий health; у конкретных product сценариев LIVE —. Полная приёмка каждой строки пока —. Реализация с gap, даже при green tests, не засчитывается.

### `COLAB-BATCH-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `CB-01` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CB-02` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CB-03` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CB-04` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CB-05` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CB-06` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CB-07` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CB-08` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CB-09` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CB-10` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CB-11` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CB-12` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CB-13` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CB-14` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CB-15` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CB-16` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CB-17` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CB-18` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CB-19` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CB-20` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CB-21` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CB-22` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CB-23` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CB-24` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |

### `COLAB-REALTIME-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `CR-01` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CR-02` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CR-03` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CR-04` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CR-05` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `CR-06` | ◐ | ◐ | ✅ | N/A | — | V-LIVE |

### `PWA-CORE-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `PC-01` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PC-02` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PC-03` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PC-04` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PC-05` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PC-06` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PC-07` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PC-08` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PC-09` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PC-10` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PC-11` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PC-12` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PC-13` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PC-14` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |

### `PWA-USER-EXPERIENCE-02`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `PUX-01` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PUX-02` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PUX-03` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PUX-04` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PUX-05` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PUX-06` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PUX-07` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PUX-08` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PUX-09` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PUX-10` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PUX-11` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PUX-12` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PUX-13` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |

### `PWA-UX-POLISH-03`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `UXPOL-01` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `UXPOL-02` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `UXPOL-03` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `UXPOL-04` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `UXPOL-05` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `UXPOL-06` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `UXPOL-07` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `UXPOL-08` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |

### `PWA-UX-CONTROLS-04`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `UXCTL-01` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `UXCTL-02` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `UXCTL-03` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `UXCTL-04` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `UXCTL-05` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `UXCTL-06` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `UXCTL-07` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `UXCTL-08` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `UXCTL-09` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `UXCTL-10` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `UXCTL-11` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `UXCTL-12` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `UXCTL-13` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `UXCTL-14` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |

### `PWA-TRANSCRIPTIONS-UX-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `PT-01` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PT-02` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PT-03` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PT-04` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |

### `PWA-INGEST-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `PI-01` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PI-02` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PI-03` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PI-04` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PI-05` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PI-06` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PI-07` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PI-08` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PI-09` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PI-10` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PI-11` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |

### `PWA-GOOGLE-PICKER-UX-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `PG-01` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PG-02` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PG-03` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PG-04` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PG-05` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PG-06` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PG-07` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PG-08` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |

### `PWA-SEGMENTS-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `PS-01` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PS-02` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PS-03` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PS-04` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PS-05` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |

### `PWA-BATCH-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `PB-01` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PB-02` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PB-03` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PB-04` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PB-05` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PB-06` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PB-07` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PB-08` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PB-09` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PB-10` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PB-11` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |

### `PWA-AUDIO-PREPARATION-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `AP-01` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-02` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-03` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-04` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-05` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-06` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-07` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-08` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-09` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-10` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-11` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-12` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-13` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-14` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-15` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-16` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-17` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-18` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-19` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-20` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-21` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-22` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-23` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-24` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-25` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-26` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-27` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-28` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-29` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `AP-30` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |

### `PWA-SPEAKER-IDENTITY-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `SP-01` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `SP-02` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `SP-03` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `SP-04` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `SP-05` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |

### `PWA-MANIFEST-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `PM-01` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PM-02` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PM-03` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PM-04` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PM-05` | ◐ | ◐ | ✅ | ◐ | — | F01 |
| `PM-06` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |

### `PWA-STANDARDIZATION-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `PD-01` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PD-02` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PD-03` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PD-04` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PD-05` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PD-06` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PD-07` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PD-08` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PD-09` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PD-10` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PD-11` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PD-12` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PD-13` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PD-14` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |

### `PWA-TRANSCRIPT-MAINTENANCE-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `PTM-01` | ◐ | ◐ | ✅ | ◐ | — | F07 |
| `PTM-02` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PTM-03` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PTM-04` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PTM-05` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PTM-06` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PTM-07` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PTM-08` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PTM-09` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |

### `PWA-REALTIME-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `PR-01` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PR-02` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PR-03` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PR-04` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PR-05` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PR-06` | ◐ | ◐ | ◐ | ◐ | — | V-LIVE |
| `PR-07` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PR-08` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PR-09` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PR-10` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PR-11` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PR-12` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `PR-13` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |

### `PWA-OPERABILITY-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `PO-01` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PO-02` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PO-03` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PO-04` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PO-05` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PO-06` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PO-07` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PO-08` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PO-09` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PO-10` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PO-11` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PO-12` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PO-13` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PO-14` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PO-15` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PO-16` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PO-17` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PO-18` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |

### `COLAB-LIFECYCLE-02`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `COLABL-01` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |
| `COLABL-02` | ✅ | ◐ | ✅ | N/A | — | AC-specific acceptance / LIVE |

### `PWA-SECURITY-HARDENING-02`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `PWASEC-01` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PWASEC-02` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PWASEC-03` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PWASEC-04` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PWASEC-05` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PWASEC-06` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PWASEC-07` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PWASEC-08` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PWASEC-09` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PWASEC-10` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PWASEC-11` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PWASEC-12` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PWASEC-13` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PWASEC-14` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PWASEC-15` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PWASEC-16` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PWASEC-17` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PWASEC-18` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |

### `GOOGLE-DRIVE-RELIABILITY-02`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `GOOGLE-01` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `GOOGLE-02` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `GOOGLE-03` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `GOOGLE-04` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `GOOGLE-05` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `GOOGLE-06` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |

### `STORAGE-LIFECYCLE-02`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `STORAG-01` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STORAG-02` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STORAG-03` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STORAG-04` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STORAG-05` | — | — | — | — | — | F10 |
| `STORAG-06` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STORAG-07` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STORAG-08` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STORAG-09` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STORAG-10` | — | — | — | — | — | F10 |
| `STORAG-11` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STORAG-12` | — | — | — | — | — | F10 |
| `STORAG-13` | — | — | — | — | — | F10 |
| `STORAG-14` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STORAG-15` | — | — | — | — | — | F10 |
| `STORAG-16` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STORAG-17` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STORAG-18` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STORAG-19` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STORAG-20` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STORAG-21` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |

### `STT-PROVIDER-ABSTRACTION-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `STTPRO-01` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STTPRO-02` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STTPRO-03` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STTPRO-04` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STTPRO-05` | ◐ | ◐ | ✅ | ◐ | — | F05 |
| `STTPRO-06` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STTPRO-07` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STTPRO-08` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STTPRO-09` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STTPRO-10` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STTPRO-11` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STTPRO-12` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STTPRO-13` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `STTPRO-14` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |

### `YANDEX-STT-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `YANDEX-01` | ◐ | ◐ | ✅ | ◐ | — | F04 |
| `YANDEX-02` | ◐ | ◐ | ✅ | ◐ | — | F04 |
| `YANDEX-03` | ◐ | ◐ | ✅ | ◐ | — | F05 |
| `YANDEX-04` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `YANDEX-05` | ◐ | ◐ | ✅ | ◐ | — | F04 |

### `PWA-DICTIONARIES-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `PWADIC-01` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |

### `PWA-WORKER-ISOLATION-02`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `PWAWOR-01` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PWAWOR-02` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `PWAWOR-03` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |

### `PWA-DATABASE-LEAST-PRIVILEGE-03`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `DBLP-01` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `DBLP-02` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `DBLP-03` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `DBLP-04` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `DBLP-05` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `DBLP-06` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `DBLP-07` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `DBLP-08` | ◐ | ◐ | ✅ | ◐ | — | V-RESTORE |

### `JOB-RELIABILITY-02`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `JOBREL-01` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `JOBREL-02` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `JOBREL-03` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `JOBREL-04` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `JOBREL-05` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `JOBREL-06` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `JOBREL-07` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `JOBREL-08` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `JOBREL-09` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `JOBREL-10` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `JOBREL-11` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `JOBREL-12` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `JOBREL-13` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `JOBREL-14` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `JOBREL-15` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `JOBREL-16` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `JOBREL-17` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |

### `JOB-NOTIFICATIONS-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `JOBNOT-01` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `JOBNOT-02` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `JOBNOT-03` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `JOBNOT-04` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `JOBNOT-05` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `JOBNOT-06` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |

### `REALTIME-CONTINUITY-02`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `REALTI-01` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `REALTI-02` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `REALTI-03` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `REALTI-04` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |
| `REALTI-05` | ✅ | ◐ | ◐ | ◐ | — | AC-specific acceptance / LIVE |

### `TRANSCRIPT-EXPORTS-02`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `TRANSC-01` | — | — | — | — | — | F01 |
| `TRANSC-02` | — | — | — | — | — | F01 |
| `TRANSC-03` | — | — | — | — | — | F01 |

### `USAGE-COST-ACCOUNTING-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `USAGEC-01` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `USAGEC-02` | ◐ | ◐ | ✅ | ◐ | — | F11 |
| `USAGEC-03` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `USAGEC-04` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `USAGEC-05` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `USAGEC-06` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |

### `OBSERVABILITY-AUDIT-02`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `OBSERV-01` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-02` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-03` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-04` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-05` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-06` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-07` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-08` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-09` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-10` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-11` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-12` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-13` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-14` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-15` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-16` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-17` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-18` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-19` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-20` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-21` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-22` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-23` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-24` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-25` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-26` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-27` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-28` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-29` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-30` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-31` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-32` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-33` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-34` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `OBSERV-35` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |

### `RELEASE-SAFETY-02`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `RELEAS-01` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `RELEAS-02` | ◐ | ◐ | ✅ | ◐ | — | V-RESTORE |
| `RELEAS-03` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `RELEAS-04` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `RELEAS-05` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |

### `ENVIRONMENT-CAPABILITIES-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `EVC-01` | — | — | — | — | — | BACKLOG |
| `EVC-02` | — | — | — | — | — | BACKLOG |
| `EVC-03` | — | — | — | — | — | BACKLOG |
| `EVC-04` | — | — | — | — | — | BACKLOG |
| `EVC-05` | — | — | — | — | — | BACKLOG |
| `EVC-06` | — | — | — | — | — | BACKLOG |
| `EVC-07` | — | — | — | — | — | BACKLOG |
| `EVC-08` | — | — | — | — | — | BACKLOG |
| `EVC-09` | — | — | — | — | — | BACKLOG |
| `EVC-10` | — | — | — | — | — | BACKLOG |
| `EVC-11` | — | — | — | — | — | BACKLOG |
| `EVC-12` | — | — | — | — | — | BACKLOG |
| `EVC-13` | — | — | — | — | — | BACKLOG |
| `EVC-14` | — | — | — | — | — | BACKLOG |
| `EVC-15` | — | — | — | — | — | BACKLOG |
| `EVC-16` | — | — | — | — | — | BACKLOG |
| `EVC-17` | — | — | — | — | — | BACKLOG |
| `EVC-18` | — | — | — | — | — | BACKLOG |
| `EVC-19` | — | — | — | — | — | BACKLOG |
| `EVC-20` | — | — | — | — | — | BACKLOG |
| `EVC-21` | — | — | — | — | — | BACKLOG |
| `EVC-22` | — | — | — | — | — | BACKLOG |
| `EVC-23` | — | — | — | — | — | BACKLOG |
| `EVC-24` | — | — | — | — | — | BACKLOG |
| `EVC-25` | — | — | — | — | — | BACKLOG |
| `EVC-26` | — | — | — | — | — | BACKLOG |
| `EVC-27` | — | — | — | — | — | BACKLOG |
| `EVC-28` | — | — | — | — | — | BACKLOG |
| `EVC-29` | — | — | — | — | — | BACKLOG |
| `EVC-30` | — | — | — | — | — | BACKLOG |
| `EVC-31` | — | — | — | — | — | BACKLOG |
| `EVC-32` | — | — | — | — | — | BACKLOG |
| `EVC-33` | — | — | — | — | — | BACKLOG |
| `EVC-34` | — | — | — | — | — | BACKLOG |
| `EVC-35` | — | — | — | — | — | BACKLOG |
| `EVC-36` | — | — | — | — | — | BACKLOG |
| `EVC-37` | — | — | — | — | — | BACKLOG |
| `EVC-38` | — | — | — | — | — | BACKLOG |
| `EVC-39` | — | — | — | — | — | BACKLOG |
| `EVC-40` | — | — | — | — | — | BACKLOG |
| `EVC-41` | — | — | — | — | — | BACKLOG |
| `EVC-42` | — | — | — | — | — | BACKLOG |
| `EVC-43` | — | — | — | — | — | BACKLOG |
| `EVC-44` | — | — | — | — | — | BACKLOG |
| `EVC-45` | — | — | — | — | — | BACKLOG |
| `EVC-46` | — | — | — | — | — | BACKLOG |
| `EVC-47` | — | — | — | — | — | BACKLOG |
| `EVC-48` | — | — | — | — | — | BACKLOG |
| `EVC-49` | — | — | — | — | — | BACKLOG |
| `EVC-50` | — | — | — | — | — | BACKLOG |

### `COMMERCIAL-INFRA-DATA-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `CINF-01` | — | — | — | — | — | BACKLOG |
| `CINF-02` | — | — | — | — | — | BACKLOG |
| `CINF-03` | — | — | — | — | — | BACKLOG |
| `CINF-04` | — | — | — | — | — | BACKLOG |
| `CINF-05` | — | — | — | — | — | BACKLOG |
| `CINF-06` | — | — | — | — | — | BACKLOG |
| `CINF-07` | — | — | — | — | — | BACKLOG |
| `CINF-08` | — | — | — | — | — | BACKLOG |
| `CINF-09` | — | — | — | — | — | BACKLOG |
| `CINF-10` | — | — | — | — | — | BACKLOG |
| `CINF-11` | — | — | — | — | — | BACKLOG |
| `CINF-12` | — | — | — | — | — | BACKLOG |
| `CINF-13` | — | — | — | — | — | BACKLOG |
| `CINF-14` | — | — | — | — | — | BACKLOG |
| `CINF-15` | — | — | — | — | — | BACKLOG |
| `CINF-16` | — | — | — | — | — | BACKLOG |
| `CINF-17` | — | — | — | — | — | BACKLOG |
| `CINF-18` | — | — | — | — | — | BACKLOG |
| `CINF-19` | — | — | — | — | — | BACKLOG |
| `CINF-20` | — | — | — | — | — | BACKLOG |

### `COMMERCIAL-IDENTITY-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `CID-01` | — | — | — | — | — | BACKLOG |
| `CID-02` | — | — | — | — | — | BACKLOG |
| `CID-03` | — | — | — | — | — | BACKLOG |
| `CID-04` | — | — | — | — | — | BACKLOG |
| `CID-05` | — | — | — | — | — | BACKLOG |
| `CID-06` | — | — | — | — | — | BACKLOG |
| `CID-07` | — | — | — | — | — | BACKLOG |
| `CID-08` | — | — | — | — | — | BACKLOG |
| `CID-09` | — | — | — | — | — | BACKLOG |
| `CID-10` | — | — | — | — | — | BACKLOG |
| `CID-11` | — | — | — | — | — | BACKLOG |
| `CID-12` | — | — | — | — | — | BACKLOG |
| `CID-13` | — | — | — | — | — | BACKLOG |
| `CID-14` | — | — | — | — | — | BACKLOG |
| `CID-15` | — | — | — | — | — | BACKLOG |
| `CID-16` | — | — | — | — | — | BACKLOG |
| `CID-17` | — | — | — | — | — | BACKLOG |
| `CID-18` | — | — | — | — | — | BACKLOG |

### `COMMERCIAL-DATA-GOVERNANCE-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `CDG-01` | — | — | — | — | — | BACKLOG |
| `CDG-02` | — | — | — | — | — | BACKLOG |
| `CDG-03` | — | — | — | — | — | BACKLOG |
| `CDG-04` | — | — | — | — | — | BACKLOG |
| `CDG-05` | — | — | — | — | — | BACKLOG |
| `CDG-06` | — | — | — | — | — | BACKLOG |
| `CDG-07` | — | — | — | — | — | BACKLOG |
| `CDG-08` | — | — | — | — | — | BACKLOG |
| `CDG-09` | — | — | — | — | — | BACKLOG |
| `CDG-10` | — | — | — | — | — | BACKLOG |
| `CDG-11` | — | — | — | — | — | BACKLOG |
| `CDG-12` | — | — | — | — | — | BACKLOG |
| `CDG-13` | — | — | — | — | — | BACKLOG |
| `CDG-14` | — | — | — | — | — | BACKLOG |
| `CDG-15` | — | — | — | — | — | BACKLOG |
| `CDG-16` | — | — | — | — | — | BACKLOG |
| `CDG-17` | — | — | — | — | — | BACKLOG |
| `CDG-18` | — | — | — | — | — | BACKLOG |
| `CDG-19` | — | — | — | — | — | BACKLOG |
| `CDG-20` | — | — | — | — | — | BACKLOG |
| `CDG-21` | — | — | — | — | — | BACKLOG |
| `CDG-22` | — | — | — | — | — | BACKLOG |
| `CDG-23` | — | — | — | — | — | BACKLOG |
| `CDG-24` | — | — | — | — | — | BACKLOG |
| `CDG-25` | — | — | — | — | — | BACKLOG |
| `CDG-26` | — | — | — | — | — | BACKLOG |

### `COMMERCIAL-CROSS-BORDER-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `CXB-01` | — | — | — | — | — | BACKLOG |
| `CXB-02` | — | — | — | — | — | BACKLOG |
| `CXB-03` | — | — | — | — | — | BACKLOG |
| `CXB-04` | — | — | — | — | — | BACKLOG |
| `CXB-05` | — | — | — | — | — | BACKLOG |
| `CXB-06` | — | — | — | — | — | BACKLOG |
| `CXB-07` | — | — | — | — | — | BACKLOG |
| `CXB-08` | — | — | — | — | — | BACKLOG |
| `CXB-09` | — | — | — | — | — | BACKLOG |
| `CXB-10` | — | — | — | — | — | BACKLOG |
| `CXB-11` | — | — | — | — | — | BACKLOG |
| `CXB-12` | — | — | — | — | — | BACKLOG |
| `CXB-13` | — | — | — | — | — | BACKLOG |
| `CXB-14` | — | — | — | — | — | BACKLOG |

### `COMMERCIAL-STT-QUOTA-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `CSQ-01` | — | — | — | — | — | BACKLOG |
| `CSQ-02` | — | — | — | — | — | BACKLOG |
| `CSQ-03` | — | — | — | — | — | BACKLOG |
| `CSQ-04` | — | — | — | — | — | BACKLOG |
| `CSQ-05` | — | — | — | — | — | BACKLOG |
| `CSQ-06` | — | — | — | — | — | BACKLOG |
| `CSQ-07` | — | — | — | — | — | BACKLOG |
| `CSQ-08` | — | — | — | — | — | BACKLOG |
| `CSQ-09` | — | — | — | — | — | BACKLOG |
| `CSQ-10` | — | — | — | — | — | BACKLOG |
| `CSQ-11` | — | — | — | — | — | BACKLOG |
| `CSQ-12` | — | — | — | — | — | BACKLOG |
| `CSQ-13` | — | — | — | — | — | BACKLOG |
| `CSQ-14` | — | — | — | — | — | BACKLOG |
| `CSQ-15` | — | — | — | — | — | BACKLOG |
| `CSQ-16` | — | — | — | — | — | BACKLOG |

### `COMMERCIAL-SPEAKER-PRIVACY-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `CSP-01` | — | — | — | — | — | BACKLOG |
| `CSP-02` | — | — | — | — | — | BACKLOG |
| `CSP-03` | — | — | — | — | — | BACKLOG |

### `COMMERCIAL-QUEUE-FAIRNESS-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `CQF-01` | — | — | — | — | — | BACKLOG |
| `CQF-02` | — | — | — | — | — | BACKLOG |
| `CQF-03` | — | — | — | — | — | BACKLOG |
| `CQF-04` | — | — | — | — | — | BACKLOG |
| `CQF-05` | — | — | — | — | — | BACKLOG |
| `CQF-06` | — | — | — | — | — | BACKLOG |

### `COMMERCIAL-BILLING-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `CBI-01` | — | — | — | — | — | BACKLOG |
| `CBI-02` | — | — | — | — | — | BACKLOG |
| `CBI-03` | — | — | — | — | — | BACKLOG |
| `CBI-04` | — | — | — | — | — | BACKLOG |
| `CBI-05` | — | — | — | — | — | BACKLOG |
| `CBI-06` | — | — | — | — | — | BACKLOG |
| `CBI-07` | — | — | — | — | — | BACKLOG |
| `CBI-08` | — | — | — | — | — | BACKLOG |
| `CBI-09` | — | — | — | — | — | BACKLOG |
| `CBI-10` | — | — | — | — | — | BACKLOG |
| `CBI-11` | — | — | — | — | — | BACKLOG |
| `CBI-12` | — | — | — | — | — | BACKLOG |
| `CBI-13` | — | — | — | — | — | BACKLOG |
| `CBI-14` | — | — | — | — | — | BACKLOG |
| `CBI-15` | — | — | — | — | — | BACKLOG |
| `CBI-16` | — | — | — | — | — | BACKLOG |
| `CBI-17` | — | — | — | — | — | BACKLOG |
| `CBI-18` | — | — | — | — | — | BACKLOG |
| `CBI-19` | — | — | — | — | — | BACKLOG |
| `CBI-20` | — | — | — | — | — | BACKLOG |
| `CBI-21` | — | — | — | — | — | BACKLOG |
| `CBI-22` | — | — | — | — | — | BACKLOG |
| `CBI-23` | — | — | — | — | — | BACKLOG |
| `CBI-24` | — | — | — | — | — | BACKLOG |
| `CBI-25` | — | — | — | — | — | BACKLOG |
| `CBI-26` | — | — | — | — | — | BACKLOG |
| `CBI-27` | — | — | — | — | — | BACKLOG |

### `COMMERCIAL-ECONOMICS-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `CEC-01` | — | — | — | — | — | BACKLOG |
| `CEC-02` | — | — | — | — | — | BACKLOG |
| `CEC-03` | — | — | — | — | — | BACKLOG |
| `CEC-04` | — | — | — | — | — | BACKLOG |
| `CEC-05` | — | — | — | — | — | BACKLOG |
| `CEC-06` | — | — | — | — | — | BACKLOG |
| `CEC-07` | — | — | — | — | — | BACKLOG |
| `CEC-08` | — | — | — | — | — | BACKLOG |
| `CEC-09` | — | — | — | — | — | BACKLOG |
| `CEC-10` | — | — | — | — | — | BACKLOG |
| `CEC-11` | — | — | — | — | — | BACKLOG |
| `CEC-12` | — | — | — | — | — | BACKLOG |
| `CEC-13` | — | — | — | — | — | BACKLOG |
| `CEC-14` | — | — | — | — | — | BACKLOG |
| `CEC-15` | — | — | — | — | — | BACKLOG |

### `COMMERCIAL-SECURITY-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `CSEC-01` | — | — | — | — | — | BACKLOG |
| `CSEC-02` | — | — | — | — | — | BACKLOG |
| `CSEC-03` | — | — | — | — | — | BACKLOG |
| `CSEC-04` | — | — | — | — | — | BACKLOG |
| `CSEC-05` | — | — | — | — | — | BACKLOG |
| `CSEC-06` | — | — | — | — | — | BACKLOG |
| `CSEC-07` | — | — | — | — | — | BACKLOG |
| `CSEC-08` | — | — | — | — | — | BACKLOG |
| `CSEC-09` | — | — | — | — | — | BACKLOG |
| `CSEC-10` | — | — | — | — | — | BACKLOG |
| `CSEC-11` | — | — | — | — | — | BACKLOG |
| `CSEC-12` | — | — | — | — | — | BACKLOG |
| `CSEC-13` | — | — | — | — | — | BACKLOG |
| `CSEC-14` | — | — | — | — | — | BACKLOG |
| `CSEC-15` | — | — | — | — | — | BACKLOG |
| `CSEC-16` | — | — | — | — | — | BACKLOG |
| `CSEC-17` | — | — | — | — | — | BACKLOG |
| `CSEC-18` | — | — | — | — | — | BACKLOG |
| `CSEC-19` | — | — | — | — | — | BACKLOG |
| `CSEC-20` | — | — | — | — | — | BACKLOG |
| `CSEC-21` | — | — | — | — | — | BACKLOG |

### `COMMERCIAL-NOTIFICATIONS-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `CNOT-01` | — | — | — | — | — | BACKLOG |
| `CNOT-02` | — | — | — | — | — | BACKLOG |
| `CNOT-03` | — | — | — | — | — | BACKLOG |
| `CNOT-04` | — | — | — | — | — | BACKLOG |
| `CNOT-05` | — | — | — | — | — | BACKLOG |
| `CNOT-06` | — | — | — | — | — | BACKLOG |
| `CNOT-07` | — | — | — | — | — | BACKLOG |
| `CNOT-08` | — | — | — | — | — | BACKLOG |

### `COMMERCIAL-LEGAL-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `CLEG-01` | — | — | — | — | — | BACKLOG |
| `CLEG-02` | — | — | — | — | — | BACKLOG |
| `CLEG-03` | — | — | — | — | — | BACKLOG |
| `CLEG-04` | — | — | — | — | — | BACKLOG |
| `CLEG-05` | — | — | — | — | — | BACKLOG |
| `CLEG-06` | — | — | — | — | — | BACKLOG |
| `CLEG-07` | — | — | — | — | — | BACKLOG |
| `CLEG-08` | — | — | — | — | — | BACKLOG |
| `CLEG-09` | — | — | — | — | — | BACKLOG |
| `CLEG-10` | — | — | — | — | — | BACKLOG |
| `CLEG-11` | — | — | — | — | — | BACKLOG |
| `CLEG-12` | — | — | — | — | — | BACKLOG |
| `CLEG-13` | — | — | — | — | — | BACKLOG |
| `CLEG-14` | — | — | — | — | — | BACKLOG |
| `CLEG-15` | — | — | — | — | — | BACKLOG |
| `CLEG-16` | — | — | — | — | — | BACKLOG |
| `CLEG-17` | — | — | — | — | — | BACKLOG |
| `CLEG-18` | — | — | — | — | — | BACKLOG |

### `RESULTS-STUDIO-02`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `RS-01` | — | — | — | — | — | F01 |
| `RS-02` | — | — | — | — | — | F01 |
| `RS-03` | — | — | — | — | — | F01 |
| `RS-04` | — | — | — | — | — | F01 |
| `RS-05` | — | — | — | — | — | F01 |
| `RS-06` | — | — | — | — | — | F01 |
| `RS-07` | — | — | — | — | — | F01 |
| `RS-08` | — | — | — | — | — | F01 |
| `RS-09` | — | — | — | — | — | F01 |
| `RS-10` | — | — | — | — | — | F01 |
| `RS-11` | — | — | — | — | — | F01 |
| `RS-12` | — | — | — | — | — | F01 |
| `RS-13` | — | — | — | — | — | F01 |
| `RS-14` | — | — | — | — | — | F01 |
| `RS-15` | — | — | — | — | — | F01 |
| `RS-16` | — | — | — | — | — | F01 |
| `RS-17` | — | — | — | — | — | F01 |

### `YANDEX-DISK-01`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `YD-01` | — | — | — | — | — | F02 |
| `YD-02` | — | — | — | — | — | F02 |
| `YD-03` | — | — | — | — | — | F02 |
| `YD-04` | — | — | — | — | — | F02 |
| `YD-05` | — | — | — | — | — | F02 |
| `YD-06` | — | — | — | — | — | F02 |
| `YD-07` | — | — | — | — | — | F02 |
| `YD-08` | — | — | — | — | — | F02 |
| `YD-09` | — | — | — | — | — | F02 |

### `REALTIME-RECOVERY-03`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `RTC-01` | ◐ | ◐ | ✅ | ◐ | — | F03 |
| `RTC-02` | ◐ | ◐ | ✅ | ◐ | — | F03 |
| `RTC-03` | ◐ | ◐ | ✅ | ◐ | — | F03 |
| `RTC-04` | ◐ | ◐ | ✅ | ◐ | — | F03 |
| `RTC-05` | ◐ | ◐ | ✅ | ◐ | — | F03 |
| `RTC-06` | ◐ | ◐ | ✅ | ◐ | — | F03 |
| `RTC-07` | ◐ | ◐ | ✅ | ◐ | — | F03 |
| `RTC-08` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |

### `PWA-REQUIREMENTS-05`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `UXN-01` | ◐ | ◐ | ◐ | ◐ | — | F07 |
| `UXN-02` | ◐ | ◐ | ◐ | ◐ | — | F07 |
| `UXN-03` | ◐ | ◐ | ◐ | ◐ | — | F07 |
| `UXN-04` | ◐ | ◐ | ◐ | ◐ | — | F07 |
| `UXN-05` | ◐ | ◐ | ◐ | ◐ | — | F07 |
| `UXN-06` | ◐ | ◐ | ◐ | ◐ | — | F07 |
| `UXN-07` | ◐ | ◐ | ◐ | ◐ | — | F07 |
| `UXN-09` | ◐ | ◐ | ◐ | ◐ | — | F07 |

### `MEDIA-CONTRACT-03`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `MC-01` | ◐ | ◐ | ✅ | ◐ | — | F06 |
| `MC-03` | ◐ | ◐ | ✅ | ◐ | — | F06 |
| `MC-04` | ◐ | ◐ | ✅ | ◐ | — | F06 |
| `MC-05` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `MC-06` | ◐ | ◐ | ✅ | ◐ | — | F06 |
| `MC-07` | ◐ | ◐ | ✅ | ◐ | — | F06 |
| `MC-08` | ◐ | ◐ | ✅ | ◐ | — | F06 |
| `MC-09` | ◐ | ◐ | ✅ | ◐ | — | F06 |

### `PERSONAL-VOICE-02`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `VID-01` | ◐ | ◐ | ✅ | ◐ | — | F08 |
| `VID-02` | ◐ | ◐ | ✅ | ◐ | — | F08 |
| `VID-03` | ◐ | ◐ | ✅ | ◐ | — | F08 |
| `VID-04` | ◐ | ◐ | ✅ | ◐ | — | F08 |
| `VID-05` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |

### `SECURITY-LIFECYCLE-03`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `SECX-01` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `SECX-02` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `SECX-03` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `SECX-04` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `SECX-05` | ✅ | ◐ | ✅ | ◐ | — | AC-specific acceptance / LIVE |
| `SECX-06` | ◐ | ◐ | ✅ | ◐ | — | V-LIVE |

### `RECOVERY-DATA-03`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `REC-01` | ◐ | ◐ | ✅ | ◐ | — | F10 |
| `REC-02` | ◐ | ◐ | ✅ | ◐ | — | F10 |
| `REC-03` | ◐ | ◐ | ✅ | ◐ | — | F10 |
| `REC-04` | ◐ | ◐ | ✅ | ◐ | — | F10 |
| `REC-05` | ◐ | ◐ | ✅ | ◐ | — | F10 |
| `REC-06` | ◐ | ◐ | ✅ | ◐ | — | F10 |
| `REC-07` | ◐ | ◐ | ✅ | ◐ | — | F10 |

### `COMMERCIAL-COMPLETENESS-02`

| AC | CODE | TEST | CI | DEPLOY | LIVE | Остаток / gap |
|---|---|---|---|---|---|---|
| `CX-01` | — | — | — | — | — | F09 |
| `CX-02` | — | — | — | — | — | F09 |
| `CX-03` | — | — | — | — | — | F09 |
| `CX-04` | — | — | — | — | — | F09 |
| `CX-05` | — | — | — | — | — | F09 |
| `CX-06` | — | — | — | — | — | F09 |
| `CX-07` | — | — | — | — | — | F09 |
| `CX-08` | — | — | — | — | — | F09 |
| `CX-09` | — | — | — | — | — | F09 |

## Candidate next Goals — proposals без authorization

1. **AUDIO-REFERENCE-UPLOAD-HOTFIX-01 — текущая поставка, не новая candidate Goal.** Merge документов и готового hotfix явно поручен владельцем; результат и gates находятся в Current Goal выше. CORS и synthetic upload не повторять без новой необходимости.
2. **Yandex correctness.** F04/F05/F06: official-wire fixtures, сохранение string timestamps, корректные provider metadata, documented realtime capabilities и indexed final refinements. После безопасных checks — отдельные разрешённые provider canaries. До них не объявлять Yandex READY.
3. **Результат в Studio — 25 незавершённых AC.** RS-01..17 (17), STORAG-05/10/12/13/15 (5), TRANSC-01..03 (3). Сначала спроектировать retained transcript + export state/ownership, затем S3 retention/deletion, UI/downloads и повторный export. Возможна поставка несколькими reviewable batches в одной согласованной Goal; schema change требует approved migration lane.
4. **Yandex Disk + контуры.** YD-01..09, EVC/CX: зависит от независимого результата Studio и явного выбора конкретной contour Goal. Common personal код не закрывает commercial tenant/billing/legal readiness.
5. **Realtime continuity.** RTC-01..08: bounded replay/dedup и отдельное consented audio retention; не ограничиваться UI reconnect toggle.
6. **Dependency/config hardening.** F12/F13/F14: advisory triage и portable shell/clean dependency reproducibility; изменение защиты main/environments — отдельная explicit settings/CI policy Goal.

## Отложенные проверки и решения владельца

Manual/credentialed validation backlog: paid ElevenLabs/Yandex batch/deferred/realtime; реальные Google Docs standardization и Drive/Yandex Disk export; microphone/display/mixed matrix в Windows с drop/reconnect; доставка email/Web Push/Telegram и external captions; versioned object deletion, retention expiry и isolated restore относительно RPO/RTO; opt-in TOTP recovery; commercial payments/fiscalization/legal review. Browser checks без paid/mutating эффекта могут выполняться агентом в соответствующей Goal; пользовательская приёмка не должна подменять известные defects или блокировать независимую реализацию.

Нужны продуктовые значения для Projects UX, RPO/RTO, realtime buffer bounds, voice retention/algorithm и коммерческих тарифов/quota outcome rules. Их отсутствие не отменяет сам scope и не требует подтверждать каждый сформированный AC.

## Самопроверка выводов и границы аудита

- Просмотрены все canonical AC и актуальные source units; технический просмотр риск-ориентированный, не исчерпывающий formal proof каждой строки кода/ветки. Полный per-AC runtime dossier отсутствует и явно показан.
- Неподтверждённые security exploits, утечки secrets, corruption или потеря production transcripts не заявляются. Yandex timestamp defect подтверждён synthetic probe, а не paid runtime.
- Шесть npm advisories не называются 86 независимыми уязвимостями. Build-time reachability не равна API SSRF. Local global pip conflicts не приписаны репозиторию.
- Старый claim об отсутствии exact commit в CD опровергнут bundle transport. SKIPPED jobs и health не подменяют deployment/приёмку функции.
- Generated protobuf modules не dead code: их использует relay. Colab formatter и Studio formatter принадлежат разным исполняемым контурам; схожесть сама по себе не основание для удаления. Подтверждённого безопасного списка code deletion нет.
- Во время исходного AUDIT AGENTS и universal CI/CD policy не изменялись; затем отдельным поручением владельца заменены новыми референсами, как зафиксировано в checkpoint выше. Аудит разрешал upstream reconciliation/status relocation и не возобновлял implementation.

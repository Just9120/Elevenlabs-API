# Delivery dashboard VoiceOps Studio

## Current Goal и checkpoint

**AUDIO-UX-DRIVE-01 / IN_PROGRESS.** Authorization: четыре UX-аннотации владельца 2026-09-07: сохранить готовое аудио в Drive, сортировка папок, ввод минуса и десятичного разделителя. Встроенная Goal активирована. Base `8923ba4028506a68bd2d69114339a23c54b47442`; ветка `codex/audio-drive-numeric-ux`; main clean, open PR отсутствуют, protection=false/rulesets пусты; required checks сохраняются.

- Scope: AP-15/23 — отдельное сохранение готового output с folder picker, durable export и безопасным повтором без FFmpeg; AP-22 — свободное редактирование чисел и понятная validation; PG-09 — сортировка папок по имени/дате обновления с корректной pagination.
- DoD: все четыре сценария реализованы, содержательные regression checks PASS, self-review и required CI на текущей revision, PR merged, standard web/API/worker delivery и version/health smoke, safe branch cleanup.
- Non-goals: коммерческий контур, прочий backlog, pipeline/settings, OAuth scope expansion, schema migration, реальная отправка пользовательских файлов в Drive и платные provider calls как тесты. Ad-hoc/dogfooding не является gate.
- Последовательность: spec/plan → numeric/picker UI + tests → API/worker export + tests → local validation/self-review → один PR → CI/merge → applicable CD/worker routine procedure → smoke/cleanup. Queued export должен игнорироваться старым worker до его обновления, не попадать в повторную обработку исходников.
- Зависимости: существующие owner/CSRF/Google folder verification, audio storage isolation/retention, durable lease и Drive idempotency marker. Export errors/cancel сохраняют готовый файл; pending export не разрешает удалять используемый output. Переключение сортировки сбрасывает page tokens и отбрасывает поздние ответы.
- Baseline на main: 355/675 READY, AP 30/30, PG 8/8. AP-22/23 пересматриваются по найденным дефектам; PG-09 добавляется по новому запросу, denominator +1, finding сам AC не создаёт. Unmerged выполнение отдельно от main.

| AC/риск | Проверка и ожидаемый результат | Команда / каталог / environment | Этап |
|---|---|---|---|
| AP-22, PG-09 | Минус/пустое/точка/запятая, bounds, sorting/navigation/search/pagination/stale responses | existing Vitest tests; `apps/studio`, Windows synthetic fetch | REQUIRED local |
| AP-15/23, auth/data integrity | Owner/CSRF/folder, ready/expired source, export-only, retries/cancel/restart, no duplicate conversion, storage isolation | affected pytest; root, isolated Python + synthetic DB/storage/Google | REQUIRED local |
| UI integration | Full Vitest, lint, TypeScript/build | canonical commands [validation](runbooks/validation.md); `apps/studio` | REQUIRED local |
| Repository/DB/E2E | `python scripts/ci_checks.py`, `git diff --check`; full Linux Python/PostgreSQL/Redis and authenticated Playwright | root/local guards; existing CI / checks and Studio PWA CI / studio + browser-e2e | REQUIRED local / remote-only integration |
| Delivery | Expected image/revision, current schema, health/readiness; safe browser numeric/folder UI smoke | [Studio operations](runbooks/studio-platform-ops.md), production; external mutations N/A as test | REQUIRED after merge |

Checkpoint: implementation и применимая local validation/self-review завершены (V30-LOCAL); initial push/PR, required CI/review, merge, CD и cleanup PENDING. Blockers не обнаружены.

Предыдущая **REPOSITORY-RULES-03 / DONE**: PR #304, merge 8923ba4; PR CI 34137248500 и Studio 34137248580 PASS, main CI 34137716826 и Studio 34137716793 PASS; CD N/A (docs-only). Локальная ветка удалена, main синхронизирована, built-in Goal завершена. F26 CLOSED по этим records; post-merge metadata PR не требуется.

## Завершённая Goal STUDIO-CLEANUP-HOTFIX-01

**STUDIO-CLEANUP-HOTFIX-01 / DONE.** Исправления поставлены через PR #303; CI/CD и read-only runtime checks подтверждены по V28. Обязательная post-merge metadata synchronization отменена явным решением владельца о новых правилах 2026-09-07. DOC-GATE-02 больше не применяется; встроенная прежняя Goal завершена и проверена инструментом до активации REPOSITORY-RULES-03.

- Результат: понятный и работоспособный повтор bulk cleanup/attention resolution после recent-auth; доступная отмена удерживающего файл audio preview; отсутствие старых противоречивых deletion notices.
- Baseline: PUX-06, UXCTL-07/11, AP-13; технические критерии F22–F24 ниже, без новых product AC. Сохранить owner/CSRF/recent-auth, audit, явное подтверждение отсутствия результата и защиту используемых sources.
- Base: `27644aa734b1fea6880a0833c947cadb7eb9c642`, fresh origin/main; ветка `codex/studio-source-cleanup-hotfix`. GitHub default main, protected=false, rulesets пусты; это не отменяет required CI. Предыдущие локальные правки Ad-hoc/readiness разрешены владельцем и сохраняются для публикации вместе с содержательным хотфиксом.
- Один batch/PR: review и необходимые исправления → локальные regression/lint/typecheck/build → grouped commits и initial push → PR/checks/review → merge → standard web CD, read-only identity/health → local main/branch cleanup.
- Non-goals: изменение product scope, recent-auth policy, workflow/security settings, backend storage semantics/миграции, provider/Google calls и удаление реальных пользовательских данных агентом.
- Validation REQUIRED local: App/AudioPreparation components (reauth/retry, blocker/notice, preview cancellation), SQLite source deletion + audio service, ESLint, TypeScript/build, ci_checks и diff review. REQUIRED remote-only: CI / checks (Linux PostgreSQL/Redis), Studio PWA CI / studio и browser-e2e. Deployment: только web по фактическому router diff; API/worker/migration N/A при отсутствии runtime изменений. Browser LIVE только read-only; реальные действия владельца тестами на production не подменяются.
- DoD: исправления, regression tests и применимые gates PASS; reviewed PR merged; web revision/health подтверждены; local main синхронизирована, созданная merged ветка очищена.
- Checkpoint 2026-09-07T14:32Z: PR #303 MERGED 14:25:48Z, final head cfd3b11b16c8fc56eeadc89d5c0f78c7fae0403f, merge/product web revision **3e65322e12ba3d1ac2bc9f3ec7ecc412a6e3090b**. PR CI, main CI, web CD и read-only LIVE PASS в указанном ниже охвате. Local main = origin/main = GitHub main 3e65322; созданная merged codex/studio-source-cleanup-hotfix удалена local/remote после ancestor/head проверки, один worktree. Прежняя чужая ветка и ignored/unknown state сохранены. Подготовленные факты включены в содержательный PR внедрения правил; отдельный metadata push не требуется по решению 2026-09-07.

V28-CI-RECOVERY / 2026-09-07: `pytest -q tests/test_realtime_static.py` **62 PASS**, `python scripts/ci_checks.py` и `git diff --check` PASS на исправленном guard. Локальный pytest потребовал запуск вне sandbox из-за WinError 5 при чтении собственного временного каталога; использован новый каталог `.tmp` внутри workspace. Ограничения runtime проверки и experimental boundaries сохранены.

| Finding | Область / Evidence на base 27644aa | Влияние и критерий закрытия | Confidence |
| --- | --- | --- | --- |
| F22 · P1 | PUX-06, UXCTL-07/11; `main.py` require_recent_auth, `SourcesPanel.tsx` applyBulkDeletion, `App.tsx` attention catch | API возвращает 409/recent_reauthentication_required, UI ожидает 401 и теряет правильное действие. Различать причину, сохранять возможность явного повтора после подтверждения личности; проверить success/409/401/preview_changed. | HIGH: backend/frontend contract; конкретный production response не перехвачен |
| F23 · P1 | PUX-06, AP-13; source_deletion.py active audio references, AudioPreparationPage.tsx terminal/restore | preview_ready удерживает source, но кнопка отмены скрыта; после reload видна только последняя операция. Показывать причину и доступную отмену возвращённых API активных previews; backend должен разрешать удаление после отмены. | HIGH: исполняемые ветви кода; старые операции за границей bounded API list требуют отдельного исследования |
| F24 · P2 | PUX-06; App.tsx SourceStorageSettings deletionNotices | Уведомления разных удалений остаются вместе и создают ложное впечатление успешного удаления текущего файла. Очищать старое сообщение при новом действии/reload, показывать только последний исход; regression success→blocker. | HIGH: state lifecycle и пользовательский screenshot |

V28-LOCAL / 2026-09-07 / Windows / code revision `9ab692608d991ce5232646ccdc93d22e22879979`: полный Vitest **69 files / 736 tests PASS**; targeted App/AudioPreparation **245 PASS**; SQLite source deletion + audio service **38 PASS**; `npm.cmd run lint`, `npm.cmd run build` (TypeScript, Vite, PWA, build metadata), `python scripts/ci_checks.py`, `git diff --check` PASS. Регрессии: реальный 409 reason, переход Аккаунт → reauth → сохранённый cleanup plan → success; 401 session error; явный retry attention; success→blocked notice; restored older preview cancellation и backend source deletion после cancel. Tests используют synthetic/fake integrations; production mutations не выполнялись. Build сохраняет прежний advisory warning о chunk >500 kB.

V28-REVIEW: полный code/documentation diff проверен, outstanding PR comments/reviews отсутствовали; внешний approval не требовался, bypass не использован. F22–F24 CLOSED: исправлены в коде, regression checks и поставка PASS (V28-DELIVERY). Полный новый аудит не выполнялся. Пересчёт после merge 3e65322: **355/675 = 52,6%**, Goal **4/4 = 100% по коду**, технические критерии **3/3**; delivery DoD выполнен после отмены metadata gate решением 2026-09-07. Feature PUX 13/13, UXCTL 14/14, AP 30/30. Denominator и статусы незатронутых AC сохранены.

F25 / P2 / supply-chain / DEFER: плановый Dependency audit 34105545153 на неизменённой base 27644aa, 2026-09-07T09:21Z, FAIL: browserslist и fast-uri, 2 high по npm audit. Это действующий debt; проверку не запускали повторно и не снимали gate. В этом хотфиксе package/lock/workflows не меняются; требуется отдельная узкая dependency remediation с проверкой advisory ranges и frontend/CI regression. Confidence HIGH для факта audit failure, применимость к production runtime отдельно не оценена.

Ограничение F23: UI восстанавливает активные операции из существующей owner-scoped API выборки до 50 последних jobs; бесконечную историю и поиск удерживающего source за этой границей данный patch не реализует. Это не доказательство отсутствия старых ссылок.

## V28-DELIVERY — STUDIO-CLEANUP-HOTFIX-01

| Evidence | Primary record / revision | Результат и ограничения |
|---|---|---|
| PR / CI / REVIEW | PR #303, CI 34132508136, Studio 34132508078; exact head cfd3b11 | PASS: 1745 Python tests, 736 Vitest / 69 files, 13 authenticated browser E2E, lint/build/container checks. Первый CI 34131596683 выявил устаревший docs guard; исправлен под решение Ad-hoc, experimental/security boundaries сохранены. |
| Main CI | CI 34132904648, Studio 34132904603; merge 3e65322 | PASS: оба workflows completed/success. Новые workflows или CI jobs не добавлены; выполнены обычные проверки PR и merge. |
| DEPLOY web | CD 34132904885, job 101777086677; 3e65322 | PASS, 2026-09-07T14:27:34Z: built/running image identity check, localhost health и STUDIO_PLATFORM_WEB_DEPLOY_OK. API/worker/migration jobs skipped по router scope, их redeploy N/A: runtime paths не менялись. |
| LIVE identity/health | Public /build-meta.json, /healthz, /api/healthz; 2026-09-07T14:29:18Z | PASS: web commit 3e65322e12ba3d1ac2bc9f3ec7ecc412a6e3090b; web HTTP 200; API ok=true, database/Redis reachable, schema 0037_ux_audit_controls current. |
| AGENT_BROWSER | Authenticated production /settings/files, /audio, /transcriptions; 2026-09-07T14:29–14:31Z | PASS для read-only smoke: список файлов без старого противоречивого notice; после reload восстановлены восемь старых preview_ready с доступной отменой плюс последний completed; кнопки закрытия двух старых ошибок доступны; captured console errors отсутствуют. Production deletion/cancel/attention resolution не выполнялись; их поведение проверено synthetic component/backend tests, полного нового LIVE сценария нет. |
| Git / cleanup | main/local origin/main/GitHub readback, 2026-09-07T14:32Z | PASS: 3e65322, divergence 0/0; созданная merged ветка удалена local/remote, один worktree. Финальный metadata diff пока локален. |

Предыдущая Goal — **AUDIO-NAME-ERROR-UX-01 / DONE**. F20/F21 исправлены и поставлены. Authorization: «Запускай», 2026-09-06; scope AP-11/UXCTL-07. Одноразовый metadata push разрешён ответом «ну делай». Встроенная Goal завершена update_goal и проверена get_goal 2026-09-06T16:34:43Z; это исторический record завершённой работы.

Предыдущий delivery checkpoint: PR #302 merged 2026-09-06T14:23:10Z; product/deployed revision **84ae25f3c53e5152466b0e1e7fa59936d08a24c7**, исходный base b8babc257abf7a33cda2df3c36c33570ee043108, PR head dce041950773f6790b3cc8d422dfa0843b0fa0cd. Metadata опубликованы commit 27644aa (`commit 27644aa734b1fea6880a0833c947cadb7eb9c642`): exact three-file remote readback PASS; local main = origin/main = GitHub main. CI 34045687136 PASS: 1744 tests, 4 warnings; все обязательные steps выполнены. Ветка codex/audio-name-error-ux удалена local/remote после проверки squash result; один worktree, прежняя чужая ветка и unknown/ignored state сохранены.

Validation Plan выполнен: naming pure/service/processor/frontend; recovery query/API/component, owner/recent-auth/timeout; lint/typecheck/build; Linux PostgreSQL/Redis/security и authenticated Playwright; self-review/exact-head CI; web/API/worker CD, schema/image/health/isolation и узкий read-only LIVE. Primary records — V27 ниже. Schema/workflows не менялись; migration/edge N/A. Provider/Google mutations, canary, переименование старых файлов и решение об отсутствии результата за владельца не выполнялись.

Готовность завершённой Goal — **2/2 = 100%**. Required технические проверки и delivery выполнены; DOC-GATE-01 закрыт для этой поставки. Обязательный metadata mechanism отменён новыми правилами 2026-09-07; process blocker снят. Правка правил готовности подготовлена по отдельному решению владельца и включена в содержательный hotfix PR; прежнее одноразовое разрешение на direct-main metadata push не продлевается.

## Готовность проекта

**Постоянное правило владельца, 2026-09-06:** при аудите и всех последующих пересчётах готовность всегда считается по соответствию реализации в коде согласованным требованиям. Режим **Ad-hoc**: владелец использует проект, обнаруженные баги попадают в backlog и исправляются в разрешённой задаче; плановой программы ручных тестов и отчётов пользователя по функциям нет. Отдельная приёмка и её процент отменены. Агент выполняет доступные автоматические и браузерные проверки. Источник — прямое сообщение «процент готовности при аудите и в дальнейшем всегда считается по коду исходя из требований» и уточнение режима Ad-hoc в текущем чате; opaque message ID не предоставлен. Формула и статусы — [AGENTS: требования и готовность](../AGENTS.md#требования-findings-и-готовность).

Предыдущий snapshot — browser review 2026-09-06T13:10Z: **351/675 = 52,0% готовности** по реализованным AC.

Текущий snapshot — пересчёт по проверенному origin/main **3e65322e12ba3d1ac2bc9f3ec7ecc412a6e3090b**, 2026-09-07: **355/675 = 52,6%**. Продуктовые и технические AC учитываются наравне. Все 355 прежних IMPLEMENTED имеют CODE PASS и существующие подходящие subsystem tests (350 TEST PARTIAL, 5 TEST PASS); они соответствуют новому READY без новых runtime утверждений. Миграция названия статуса не меняет numerator, denominator или охват проверок. Полный повтор аудита не выполнялся; findings и ограничения tests сохранены. Незамерженные изменения этой docs Goal не добавляют реализации требований.

**USER-LIVE-01 / USER_FEEDBACK, 2026-09-06:** владелец сообщил об использовании проекта не менее двух недель и исправлении обнаруживаемых багов по факту. Это опыт реальной эксплуатации. Конкретные сообщения о дефектах связываются с AC и regression checks; период использования не заменяет проверку кода ещё не реализованных возможностей.

Состав AC не менялся: 687 сохранённых ID минус 12 ALIAS/SUPERSEDED = 675. AP-11 и UXCTL-07 реализованы и поставлены по V27. Рост с предыдущего snapshot на 0,6 п.п. включает два исправленных дефекта и два критерия capture, пересмотренных по новому правилу. Audio preparation: 30/30; UX controls: 14/14; завершённая Goal: 2/2. Технические проверки и ограничения Evidence отражены отдельно и не образуют второй процент. COLAB-REALTIME изменился на +16,7 п.п. из-за удаления runtime-series gate у уже существующей реализации CR-06; это не новое улучшение capture в коде.

| Эпик / feature | Готовность по коду | Состояние |
| --- | ---: | --- |
| `COLAB-BATCH-01` | 24/24 (100.0%) | READY |
| `COLAB-REALTIME-01` | 6/6 (100.0%) | READY |
| `PWA-CORE-01` | 14/14 (100.0%) | READY |
| `PWA-USER-EXPERIENCE-02` | 13/13 (100.0%) | READY |
| `PWA-UX-POLISH-03` | 7/7 (100.0%) | READY |
| `PWA-UX-CONTROLS-04` | 14/14 (100.0%) | READY |
| `PWA-TRANSCRIPTIONS-UX-01` | 4/4 (100.0%) | READY |
| `PWA-INGEST-01` | 11/11 (100.0%) | READY |
| `PWA-GOOGLE-PICKER-UX-01` | 8/8 (100.0%) | READY |
| `PWA-SEGMENTS-01` | 5/5 (100.0%) | READY |
| `PWA-BATCH-01` | 10/11 (90.9%) | IN_PROGRESS |
| `PWA-AUDIO-PREPARATION-01` | 30/30 (100.0%) | READY |
| `PWA-SPEAKER-IDENTITY-01` | 5/5 (100.0%) | READY |
| `PWA-MANIFEST-01` | 5/6 (83.3%) | IN_PROGRESS |
| `PWA-STANDARDIZATION-01` | 14/14 (100.0%) | READY |
| `PWA-TRANSCRIPT-MAINTENANCE-01` | 8/9 (88.9%) | IN_PROGRESS |
| `PWA-REALTIME-01` | 13/13 (100.0%) | READY |
| `PWA-OPERABILITY-01` | 17/18 (94.4%) | IN_PROGRESS |
| `COLAB-LIFECYCLE-02` | 2/2 (100.0%) | READY |
| `PWA-SECURITY-HARDENING-02` | 18/18 (100.0%) | READY |
| `GOOGLE-DRIVE-RELIABILITY-02` | 6/6 (100.0%) | READY |
| `STORAGE-LIFECYCLE-02` | 16/21 (76.2%) | IN_PROGRESS |
| `STT-PROVIDER-ABSTRACTION-01` | 13/14 (92.9%) | IN_PROGRESS |
| `YANDEX-STT-01` | 1/5 (20.0%) | IN_PROGRESS |
| `PWA-DICTIONARIES-01` | 1/1 (100.0%) | READY |
| `PWA-WORKER-ISOLATION-02` | 3/3 (100.0%) | READY |
| `PWA-DATABASE-LEAST-PRIVILEGE-03` | 7/8 (87.5%) | IN_PROGRESS |
| `JOB-RELIABILITY-02` | 17/17 (100.0%) | READY |
| `JOB-NOTIFICATIONS-01` | 6/6 (100.0%) | READY |
| `REALTIME-CONTINUITY-02` | 5/5 (100.0%) | READY |
| `TRANSCRIPT-EXPORTS-02` | 0/3 (0.0%) | BACKLOG |
| `USAGE-COST-ACCOUNTING-01` | 5/6 (83.3%) | IN_PROGRESS |
| `OBSERVABILITY-AUDIT-02` | 35/35 (100.0%) | READY |
| `RELEASE-SAFETY-02` | 4/5 (80.0%) | IN_PROGRESS |
| `ENVIRONMENT-CAPABILITIES-01` | 0/50 (0.0%) | BACKLOG |
| `COMMERCIAL-INFRA-DATA-01` | 0/15 (0.0%) | BACKLOG |
| `COMMERCIAL-IDENTITY-01` | 0/18 (0.0%) | BACKLOG |
| `COMMERCIAL-DATA-GOVERNANCE-01` | 0/26 (0.0%) | BACKLOG |
| `COMMERCIAL-CROSS-BORDER-01` | 0/14 (0.0%) | BACKLOG |
| `COMMERCIAL-STT-QUOTA-01` | 0/16 (0.0%) | BACKLOG |
| `COMMERCIAL-SPEAKER-PRIVACY-01` | 0/3 (0.0%) | BACKLOG |
| `COMMERCIAL-QUEUE-FAIRNESS-01` | 0/6 (0.0%) | BACKLOG |
| `COMMERCIAL-BILLING-01` | 0/27 (0.0%) | BACKLOG |
| `COMMERCIAL-ECONOMICS-01` | 0/15 (0.0%) | BACKLOG |
| `COMMERCIAL-SECURITY-01` | 0/19 (0.0%) | BACKLOG |
| `COMMERCIAL-NOTIFICATIONS-01` | 0/8 (0.0%) | BACKLOG |
| `COMMERCIAL-LEGAL-01` | 0/15 (0.0%) | BACKLOG |
| `RESULTS-STUDIO-02` | 0/17 (0.0%) | BACKLOG |
| `YANDEX-DISK-01` | 0/9 (0.0%) | BACKLOG |
| `REALTIME-RECOVERY-03` | 1/8 (12.5%) | IN_PROGRESS |
| `PWA-REQUIREMENTS-05` | 0/7 (0.0%) | IN_PROGRESS |
| `MEDIA-CONTRACT-03` | 1/8 (12.5%) | IN_PROGRESS |
| `PERSONAL-VOICE-02` | 1/5 (20.0%) | IN_PROGRESS |
| `SECURITY-LIFECYCLE-03` | 5/6 (83.3%) | IN_PROGRESS |
| `RECOVERY-DATA-03` | 0/7 (0.0%) | IN_PROGRESS |
| `COMMERCIAL-COMPLETENESS-02` | 0/9 (0.0%) | BACKLOG |

- [Colab: полный реестр AC](delivery/colab.md), [требования](spec/colab.md).
- [Studio: существующие personal-подсистемы: полный реестр AC](delivery/studio.md), [требования](spec/studio.md).
- [Studio: расширение согласованных сценариев: полный реестр AC](delivery/extensions.md), [требования](spec/extensions.md).
- [Commercial и разделение контуров: полный реестр AC](delivery/commercial.md), [требования](spec/commercial.md).

## V27 — предыдущая поставка AUDIO-NAME-ERROR-UX-01

Источник V27: local tree, PR head dce041950773f6790b3cc8d422dfa0843b0fa0cd и эквивалентный squash commit **84ae25f3c53e5152466b0e1e7fa59936d08a24c7**; Windows/Python 3.12/Node 22 локально, Ubuntu/Python 3.11/Node 20 в CI. Runtime production Studio; итог 2026-09-06T14:36Z. Metadata revision отделена от product source: 27644aa опубликован; remote readback и CI PASS по checkpoint.

| Evidence | Primary record | Фактический результат / ограничения |
|---|---|---|
| REVIEW / PR CI | PR #302, CI 34038778997, Studio 34038778974, exact head dce0419 | PASS: 1744 Python, 731 frontend и 13 authenticated browser scenarios. Self-review; outstanding comments/reviews нет, required external approval/protection отсутствуют, bypass не использован. Первый browser run выявил substring selector, исправлен exact matching; повтор PASS. |
| Main CI | CI 34038997877, Studio 34038997921, exact merge 84ae25f | PASS, оба workflows completed/success. |
| DEPLOY web/API | CD 34038997893, jobs 101502211859 / 101502416185 | PASS: built/running image identity, schema equality, health и WEB/API_DEPLOY_OK. Worker/migration здесь skipped, не засчитаны как их поставка. |
| Worker lifecycle | status 34039274029 → drain 34039336472 → worker CD 34039424990 | PASS: previous worker healthy; normal drain → exited / exit_code=0 / gracefully-drained; WORKER_DEPLOY_OK. Нет forced stop, миграций или canary. |
| Worker post-check | 34039644788, 14:35:47Z | PASS: running/healthy, identity_match=yes, isolation_match=yes, tag 84ae25f; image sha256:959e88063247b07f4f9fc6ff0b28b7ef0c75c50c1971a75fc9a830362d65c25c. Health/read-only DB не доказывают новую provider/Google обработку. |
| LIVE web/API | public /build-meta.json и /api/healthz, 14:27Z; authenticated /transcriptions, 14:30Z | Web 84ae25f, health HTTP 200, DB/Redis reachable, schema 0037 current. На старых ошибках новая кнопка; no-case check недоступен с честным пояснением. У исходной задачи один совместимый поздний результат; у другой ошибки несовместимые candidates отсутствуют. Mutations не выполнялись. |
| Metadata / Git | 27644aa / CI 34045687136, 2026-09-06T16:34Z | PASS: exact three-file remote readback; local/remote main совпали, source branch cleanup verified; 1744 tests PASS. Product revision осталась 84ae25f. |

**DOC REVIEW 2026-09-06T14:13Z:** 687 уникальных ID / 675 актуальных AC, 289 исходных bullet paragraphs и 136 local links проверены; project section и deployment lanes сохранены. Внешние файлы в Downloads к повторной проверке уже отличаются от версии, применённой в AUDIT и переданной владельцем в инструкциях этого чата. Они не применяются повторно автоматически; текущая поставка сохраняет явно утверждённый baseline. Результат прежнего exact-template comparison относится к прежнему snapshot, не к изменившимся файлам Downloads.

- **CODE PASS:** filename/title разделены, точка больше не обрезает title в API/worker formatter; известное media extension удаляется ровно на границе source filename. Сохранены Unicode, custom title и sanitization. Новые outputs используют полный title; ранее сохранённые имена не переименовываются.
- **TEST PASS:** 50 focused Python tests — formatter, actual preview/process/storage pipeline и shared candidate SQL query. Проверены source order/count, owner/project, clip, timestamp, completed/persisted output. Использованы SQLite in-memory, fake storage/Google, constrained isolated graph; production credentials не читались.
- **TEST PASS:** frontend suite и targeted повтор после исправления двух test fixtures: 731 тест. Timeout readback подтверждает закрытие только по точным persisted resolution fields; 401 и неопределённый ответ не становятся успехом. npm clean install по существующему lockfile.
- **LINT / TYPECHECK / BUILD PASS:** npm lint, TypeScript + Vite production build; прежний bundle-size warning сохраняется. **FORMAT PASS:** lightweight checks и diff check. **REVIEW:** self-review всего product diff, DTO compatibility, source naming callers, owner query, no-case/no-Google path; exact-head и main CI PASS; обязательного внешнего review нет.
- **AGENT_BROWSER PASS (isolated UI):** Chromium 149 / Playwright 1.61.1, 1280 и 390px; реальные JobCard/AudioPreparationPage, синтетические API props. Close расположен вне details; decline не закрывает, explicit accept завершает тестовый UI flow. Real Web Audio обработал synthetic WAV, фактический browser download сохранил полное `Лекция 1. Предмет, задачи и методы социальной психологии.wav`. Снимки визуально проверены; внешних интеграций не было. Это не production mutation Evidence.
- **TEST PARTIAL:** full Windows portable с Git Bash: 1382 PASS, 5 SKIP, 8 FAIL существующих worker-isolation shell fixtures из-за Windows `bash` resolution (F14). Попытка с default WSL имела дополнительный syntax-check failure; Git Bash его снял. Все затронутые Python tests PASS. Linux PostgreSQL/Redis/API tests и 13 authenticated Playwright scenarios — REQUIRED remote-only, теперь PASS по primary records выше; Docker здесь не установлен.
- **CI / DEPLOY / узкий LIVE PASS:** primary records выше. Migration/edge N/A: schema/edge не менялись; paid canary и Google mutations вне scope.
- **F20/F21 FIXED:** regression/CI и runtime поставка завершены. Новый Google Drive side effect не запускался в проверках агента; это ограничение Evidence. Уже обрезанные files не переименовывались. Решение о наличии результата старой операции — обычное действие владельца с его данными, а не обязательный тест функции.
- **DOC-GATE-01 CLOSED:** разрешённый docs-only commit 27644aa опубликован; remote readback и CI PASS, local main синхронизирован. Это историческая процедура; новые правила не требуют её повторения.

## Validation и Evidence

Все V26 записи относятся к product source `b8babc257abf7a33cda2df3c36c33570ee043108`, Windows/Python 3.12 и имеющемуся Node 22 environment, если не указано иное. Existing node_modules имеет pnpm layout; canonical package manager остаётся npm. Source/ref/tool readback не изменяет внешний state. Диагностические временные файлы находятся в ignored `tmp/audit-2026-09-06/`; durable результат и limitations сохранены здесь, raw logs не публикуются.

| ID / тип | Команда / сценарий | Результат и ограничения |
|---|---|---|
| V26-SPEC / SPEC | Google Drive fetch + metadata, exact comparison source bullets/trace; spec/plan ID inventory | PASS: 289/289 source paragraphs совпали; 56 эпиков, 687 сохранённых ID, из них 675 учитываются. Semantic alias review выполнен; historical детализация не отменяется отсутствием повтора в новом источнике. |
| V26-CODE / CODE | Все tracked paths, AST и config/workflow inventory; focused review перечисленных surfaces | 484 tracked files, 264 Python AST, 105 backend modules; Colab `elevenlabs_api.py` содержит IPython magic и не является обычным Python module. 37 linear migrations, единственный head 0037. Нет доказанного whole-module REMOVE candidate; external callers не инвентаризированы. |
| V26-STATIC / FORMAT | `python scripts/ci_checks.py`, `git diff --check` | PASS: 7 lightweight guards; финальный docs readback отдельно ниже. |
| V26-WEB / TEST | `node node_modules/vitest/vitest.mjs run` из apps/studio | PASS: 68 files, 716 tests, 35 s. Первый sandbox запуск упал на esbuild spawn EPERM; повтор в разрешённом окружении PASS. Clean install не выполнялся; mocks не доказывают external provider contract. |
| V26-PY / TEST | `python -X utf8 -m pytest -q --portable -p no:cacheprovider --basetemp=...` | PARTIAL: 1364 passed, 5 skipped, 8 failed (worker capability shell fixtures). 9 modules excluded профилем. Первый sandbox запуск получил temp PermissionError; повтор с Git Bash PATH всё ещё выбрал Windows/system bash в этих fixtures. Linux CI отдельно PASS; local DB/Docker suites не выполнялись. |
| V26-PROBE / TEST | Синтетические input fixtures; normalizer и analytics actual functions; SQLite memory, `_env_file=None`, без сети | F04 reproduced: numeric/root-tag fixture → (1.0, 2.0, '1'); official string/nested-tag fixture → (None, None, None). F06 reproduced: Yandex job → unknown=1. Это дефекты contract normalization, не зарегистрированный production incident. |
| V26-NPM / supply chain | `npm.cmd audit --package-lock-only --json` | FAIL: 6 уникальных HIGH advisories у browserslist/fast-uri; 86 affected/metavulnerability entries. Lock не менялся; 86 не означает 86 независимых уязвимостей. |
| V26-PIP / supply chain | Изолированный Python 3.12/Windows graph: install `-r requirements-dev.txt -c constraints-dev.txt` в temporary target; `pip-audit==2.10.1 --strict --path <target> --timeout 10`; 2026-09-05T23:12Z | PASS для 102 distributions: 0 известных advisories, 0 skipped. Tool и graph изолированы от global Python; requirements/constraints не менялись. Для Cyrillic path включён PYTHONUTF8; sandbox cache limitation устранено повтором в разрешённом окружении. Linux-specific graph не проверен этим запуском. Последний Linux scheduled audit 33384307698 SUCCESS на 8957e974 от 31 августа остаётся историческим Evidence. |
| V26-CI / CI, LINT, TYPECHECK, TEST, BUILD | CI 33982502558, Studio CI 33982502612 | PASS: exact main b8babc2; checks, studio, browser-e2e фактически SUCCESS, не SKIPPED. Linux PostgreSQL/Redis/migration, ESLint, TypeScript, build и authenticated synthetic E2E по workflows. Full step-to-AC assertion audit не завершён. |
| V26-CD / DEPLOY | CD 33982502551 | PASS для web b8babc2; detect/deploy-web/summary SUCCESS, API/worker/migration SKIPPED. |
| V26-LIVE / LIVE | HTTPS GET `/build-meta.json`, `/api/healthz`, default certificate verification; `2026-09-05T22:42:58Z` | PASS в узком scope: web commit b8babc2, API health ok/schema0037. Не доказывает сохранность transcript, provider spend, backup или worker readiness. |
| V26-BROWSER / AGENT_BROWSER | Authenticated существующая browser session: dashboard → audio, без ввода/записи данных; 2026-09-06 MSK | PASS: navigation/heading/order PC-02, PC-04, AP-01; видны recent-result/connection summary, отдельного Projects нет. Private content/identifiers не сохранены в отчёте. Capture, upload, export, settings mutations не запускались. |
| V26-SETTINGS / CI policy | GitHub branch/rulesets/Actions permissions/environments, pagination проверена | main protected=false, rulesets пусты; allowed_actions=all, sha_pinning_required=false; token default read, approval by Actions false. Один environment studio-production-migration с reviewer, prevent_self_review=false. 25 external Action refs в YAML pinned SHA. Ничего не менялось. |

**V26-DOC / FORMAT, TEST, SPEC PASS — 2026-09-05T23:12Z, uncommitted documentation поверх b8babc2.** Проверены 687 сохранённых ID, 675 active AC, 353 реализованных AC (названия статусов на момент проверки сохранены в Git history), 56 эпиков, точное совпадение 289 исходных пунктов, существование всех локальных Markdown links. Общие политики точно совпадают с новыми приложениями; исходный проектный раздел AGENTS и deployment lanes 10.4–10.8 сохранены. `python scripts/ci_checks.py` — 7 guards PASS; `git diff --check` — PASS. `pytest -q -p no:cacheprovider --basetemp=<isolated> tests/test_security_policy.py tests/test_text_processing_helpers.py tests/test_realtime_static.py` — **268 passed**; первый sandbox запуск имел 261 passed/7 fixture PermissionError, повтор в разрешённом окружении полностью PASS. Согласие владельца «Да, применить обе новые версии» выполнено; implementation authorization из него не выводится.

CODE/TEST surfaces и значения по каждому AC — в реестрах ниже. У inherited PARTIAL ограничен охват runtime Evidence. Доступный browser проверен самим агентом; credentials/provider/privacy side effects остаются в соответствующих границах разрешённой задачи.

## Реестр findings и backlog

Приоритет: P1 — существенный product/correctness/security/release gap, P2 — ограниченная функциональность или maintainability/validation gap. Повторная проверка source findings — `b8babc257abf7a33cda2df3c36c33570ee043108`, 2026-09-06 MSK. Короткие Python paths в findings относятся к `apps/studio-api/studio_api/`, frontend paths — к `apps/studio/src/`; root Colab, scripts и tests указаны отдельно в таблице surfaces. CODE paths относятся к этой revision; внешние settings — snapshot текущего аудита. Рекомендации REFACTOR/CONSOLIDATE/DOCUMENT/DEFER не являются разрешением на реализацию. Рекомендации не авторизуют исправления.

| ID | Приоритет / AC или область | Проверенное Evidence | Влияние и рекомендуемое действие | Уверенность |
|---|---|---|---|---|
| F01 | P1 · RS-01..17, PM-05, TRANSC-01..03, STORAG-10 | `main.py:554–558`: обязательный output_folder_id; `job_output_destination.py:89–110`: обязательный Google grant; `job_output_read.py:7–18`: output DTO содержит ссылку/metadata, без retained transcript; `models.py`: Google output, нет самостоятельной модели сохранённого batch transcript; `JobOutputsSection.tsx` | Без Drive batch не реализует согласованный Studio-only результат. Нет полного retained transcript, DOCX UI и независимого export lifecycle. Сначала спроектировать canonical retained artifact и состояния recognition/export, затем storage/retention, downloads и exports; не маскировать Google failure как завершённый Studio result. | HIGH, source-level; production потеря данных не заявляется |
| F02 | P1 · YD-01..09, EVC-13, S007/041–044 | `models.py:16`: SourceType только local_upload/google_drive; source/config/routes search не обнаружил Yandex Disk adapter; Yandex modules относятся к SpeechKit | Согласованный Яндекс Диск отсутствует в обоих контурах. Требуются отдельные OAuth/source/destination/export adapters и version-aware retry; зависит от F01. | HIGH |
| F03 | P1 · RTC-01..07 | `realtimeSession.ts:549–573` закрывает transport и сообщает «Автоподключение отключено»; MediaRecorder/audio replay path не найден; `realtime_drafts.py` хранит encrypted draft, не полное audio | Краткий обрыв не сохраняет непрерывность по новому intent. Нужны новая capability на reconnect, bounded buffer, segment identity/dedup и видимый gap; audio recording — отдельный явный режим со storage/retention. | HIGH |
| F04 | P1 · YANDEX-01/02/05, MC-08 | `yandex_transcription.py:339–345` обрабатывает времена только int/float; official REST schema (`источник aistudio.yandex.ru, en/docs/speechkit/stt-v3/api-ref/AsyncRecognizer/getRecognition`) задаёт строковые startTimeMs/endTimeMs. V26-PROBE воспроизвёл `(1.0,2.0)` для чисел и `(None,None)` для строк; tests используют числа | V26-PROBE: официальный nested `final.channelTag` также теряется, потому что parser читает его из корня event (`:316`). При таком JSON теряются timing и speaker metadata, от которых зависят samples/timed exports. REFACTOR parser и faithful fixtures. Добавить faithful REST fixtures и строгую bounded normalization числовых строк. Текстовое распознавание само по себе может продолжить работать. | HIGH, воспроизведено локально без paid call |
| F05 | P1 · YANDEX-03, STTPRO-05, MC-09, RTC-06 | `stt_provider.py` объявляет Yandex realtime diarization; `yandex_realtime_relay.py:269–277` всегда посылает REAL_TIME + SPEAKER_LABELING_ENABLED. Yandex speaker labeling (`источник yandex.cloud, ru-kz/docs/speechkit/stt/speaker-labeling`) описывает FULL_DATA и до 2 speakers. Relay `:314–361` хранит один pending_final без final_index и отдаёт refinement как новый committed chunk; UI append-ит committed text | Capability promise требует проверки/коррекции. При final → partial → late refinement старый текст уже committed, correction может дублироваться; несколько finals также нуждаются в indexed state. Нужны official-protocol fixtures и opt-in canary. Это source/API compatibility finding, не утверждение о наблюдённом production отказе. | HIGH для конфликта metadata; MEDIUM для фактических provider outcomes |
| F06 | P2 · MC-01/03/04/06/07/08, UXN-03/05/06/07, PO-14 | `job_google_docs_output.py:155–162,207–219` не получает фактический provider/model и пишет ElevenLabs/current model; неизвестная дата становится Created at: unknown. `AudioPreparationPage.tsx:554` фиксирует template `{title}`. `media_preparation.py` содержит duration 4h/12h checks, но полная до-запуска проверка/привязка всех новых сценариев не подтверждена | Метаданные Yandex результата неверны; дата нарушает S135. `transcription_analytics.py:58–61,273–280` также превращает Yandex в unknown; V26-PROBE воспроизводит это. PO-14 возвращён в IN_PROGRESS. REFACTOR provider/model projection и metadata formatter. Добавить фактический provider/model и provenance; отдельно закрыть preflight/partial timeline сценарии. Сам default 12h уже есть и не считается дефектом; Yandex 4h provider ceiling не объявляется ошибкой общего лимита. | HIGH для metadata; MEDIUM для preflight coverage gaps |
| F07 | P2 · UXN-01/02, PTM-01 | `PlatformSidebar.tsx:4–9`, `AudioPreparationPage.tsx:554,714`, `App.tsx:6777,9437–9454`; V26-BROWSER | DOCUMENT/REFACTOR: отдельного Projects и naming templates нет, label остаётся «Подготовка документов». Прежнее подозрение об отсутствии поиска операции снято: выбор последних событий и case-insensitive search уже есть; UXN-09 объединён с UXPOL-07. | HIGH: код, tests и доступные UI controls; запись/экспорт не запускались |
| F08 | P2 · VID-01..04 | `speaker_identity.py`, `speaker_assignment.py`, `speaker_sample.py`: ручная база имён/ролей и bounded sample из source; voiceprint/embedding matcher и долговременные voice samples отсутствуют | Ручное назначение не равно согласованной optional automatic voice identification. Нужны отдельный personal feature, модель сохранённых образцов, consent/retention/deletion и выбор алгоритма; ordinary diarization не блокировать. | HIGH |
| F09 | P1 · EVC, commercial epics, CX | `compose.platform.yml` — один personal stack; `config.py`, `models.py`, routes/UI не имеют complete commercial environment/capability/billing/registration graph | Commercial production и три personal capability-набора не готовы. Заданный scope сохранён, реализации нет; сначала выбрать Goal по контурам/capabilities и зависимостям F01/F02. Правовые решения/тарифы не выдумывать. | HIGH в пределах repo; сторонняя неучтённая инфраструктура не проверялась |
| F10 | P1 · STORAG-05/10/12/13/15, REC-01..07 | `source_storage.py:390–406` delete/head только текущего объекта, без version enumeration; storage_reconciliation относится к source objects; долговременный full transcript отсутствует. Backup scripts/runbook есть, свежий isolated restore/RPO/RTO measurement не получен | Source expiry не закрывает весь lifecycle. Требуются версии/копии, transcript/history/analytics rules, truthful deletion state и restore, не возвращающий удалённые данные. Production cleanup/restore в AUDIT не выполнялись. | HIGH для version/transcript gap; ограниченная для действующего backup schedule |
| F11 | P2 · USAGEC-02 | `provider_usage_accounting.py`, `config.py`: immutable tariff/provenance hooks есть, цена конфигурируема и может отсутствовать; прежний AC оставался открытым, актуальный тарифный runtime evidence не получен | Не утверждать точную себестоимость или billed spend там, где источник неизвестен. Закрыть конфигурацию/provenance/rounding и per-provider applicability в отдельной cost Goal; данные аккаунта не распределять произвольно по jobs. | MEDIUM; отсутствие runtime evidence не равно отсутствию кода |
| F12 | P1 · зависимости / security validation | V26-NPM: locked browserslist 4.28.4 и fast-uri 3.1.5; 2 + 4 high advisories, 86 entries включая dependents. Примеры: browserslist OOM (`источник github.com, advisories/GHSA-c83g-rgw3-j3cx`), fast-uri canonicalization (`источник github.com, advisories/GHSA-5jgf-p345-68v8`). `package.json` закрепляет fast-uri override 3.1.5 | Новые advisory делают прежний audit 31 августа недостаточным. Нужны triage по реальному использованию, допустимые patched versions, lock regeneration и точный Node/Python audit. Не запускать blind audit fix и не выдавать build-tool advisory за доказанный backend SSRF. | HIGH для audit report/locked versions; exploitability не установлена |
| F13 | P1 · CI/CD enforcement | GitHub API: main protected=false, rulesets=[], allowed_actions=all, sha_pinning_required=false; обычные component CD jobs без protected Environment; migration Environment main-only + один reviewer | Проверки/review не enforced платформой; owner/admin может случайно обойти delivery discipline. Предложить отдельную explicit settings/CI-policy Goal. Workflows сами pin actions и default token read-only — это действующие compensating controls. | HIGH, текущий settings read |
| F14 | P2 · local validation | V26-PY: 1364 PASS, 5 skipped, 8 failures в worker shell fixtures; `conftest.py:6–18`, `test_studio_worker_isolation_report.py:47–51` | REFACTOR shell discovery/portable selection; DOCUMENT setup. Добавление Git Bash в PATH не устранило Windows/system bash lookup. Исправлена ложная документация о 6 исключениях; их 9. Linux exact-main CI PASS. Windows Python graph установлен из constraints и проверен V26-PIP; clean npm, Linux Python graph и local DB/Docker отдельно не проверены. | HIGH для результата; MEDIUM для универсальности исправления shell discovery |
| F15 | P2 · coupling / performance | `App.tsx` 10518 строк, `main.py` 4798; Vite main chunk 694.75 kB (194.57 kB gzip). Много domain helpers уже выделено; часть route/auth DTO и frontend orchestration сосредоточена в этих файлах | Новые results/storage/provider changes затронут крупные coupled surfaces. Выделять ownership и route/page boundaries по мере согласованной feature Goal; chunk warning не доказывает медленный runtime или необходимость тотального rewrite. | HIGH для размера; MEDIUM для влияния |
| F16 | P2 · docs/readiness | README называл upstream несогласованным; UXPOL-02 противоречил PTM-01; UXN-09 повторял UXPOL-07; архив хранил старые оценки | CONSOLIDATE/DOCUMENT: локально исправлены source routing, связи 12 повторных/заменённых ID, явные статусы и разделение spec/plan. PB-06 и PO-14 переоткрыты по текущему контракту/дефекту. Последняя проверенная revision — b8babc2. | HIGH: полный readback и structural check; product code не менялся |
| F17 | P2 · MC-03/04, UXN-03 | `media_preparation.py:214–240,348–362`; `batch_preflight.py:103`; App.tsx:3945 | REFACTOR/DOCUMENT: global duration проверяется после manual clip, а long-record confirmation появляется после failed job; полного pre-launch cost estimate нет. Проверить >12h source с коротким fragment и согласовать реализацию общего source limit по S051–053; не объявлять provider-specific 4h ceiling дефектом. | HIGH для порядка кода; MEDIUM для всех runtime сценариев, synthetic media canary не выполнялся |
| F18 | P2 · compatibility/dead-code | `main.py:2669,3339` — deprecated routes; текущий PWA использует batch/preflight; `googlePicker.ts` содержит app-owned bridge и native compatibility; 105 backend modules имеют references в tracked sources/docs/tests | DEPRECATE/DOCUMENT: сохранить совместимость до инвентаризации внешних callers/telemetry и migration notice. REMOVE пока не обоснован. Generated protobuf импортируется relay; notebooks исполняют canonical entrypoints. Нулевые imports не использованы как доказательство dead code. | HIGH для entrypoints/references; LOW для неизвестных внешних callers |
| F19 | P2 · документация и test coupling | `SECURITY.md` хранит schema 0026, `tests/test_security_policy.py:12–13` закрепляет её literal assertion; architecture/runbooks частично на английском и содержат прежние ограничения | DOCUMENT/CONSOLIDATE: current readiness только в dashboard; при отдельном разрешённом исправлении SECURITY и соответствующего test оставить durable security scope без snapshot schema. Перевод/консолидацию старых runbooks делать по затронутой области, сохраняя процедуры. | HIGH для stale marker; не доказательство runtime vulnerability |
| F20 · FIXED V27 | P1 · AP-11 | Browser comment 1 + V26-BC-PROBE; `AudioPreparationPage.tsx:95–98,544–551`; `audio_preparation_service.py:72`; `audio_preparation.py:520–536` | Повторный strip расширения обрезает значимые точки: filename → frontend title → persisted title → export. Синтетический пример воспроизвёл «Лекция 1.flac» вместо полного названия. REFACTOR: разделить filename и готовый title, сохранять Unicode/точки, исключить повторное обрезание во всех formatter stages. Проверить default/custom title, multi-dot/no-extension, concat, download/Drive/reuse. | HIGH: фактические service/formatter функции на SQLite in-memory, source и совпадающий UI symptom |
| F21 · FIXED V27 | P2 · UXCTL-07, PUX-06 / error recovery UX | Browser comment 2 + V26-BC-CODE/BROWSER; `JobCard.tsx:141–219`; `App.tsx:3820–3910,4451–4456`; `job_output_reconciliation.py:121–139`; `main.py:3400–3475` | Кнопки существуют, но закрытие ошибки неочевидно. Automatic check без reconciliation cases возвращает checked=0, lookup не вызывается, UI сообщает «Документ пока не найден». Candidate list фильтрует только status/date, backend дополнительно требует тот же source/clip/output. REFACTOR: показывать доступные действия сразу, различать «не проверено/недоступно» и «не найдено», предлагать только подтверждаемые кандидаты. Сохранить явное подтверждение возможного расхода, owner boundary и audit. Отказ actual production attention-resolution не воспроизведён: mutation не выполнялась. | HIGH для code/probe и наличия controls; MEDIUM для причины конкретного пользовательского затруднения |

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
| YANDEX | apps/studio-api/studio_api/yandex_transcription.py; yandex_realtime_relay.py; yandex_realtime.proto | tests/test_studio_yandex_transcription.py; V26-PROBE (описание в dashboard) |
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


Все перечисленные source/test surfaces повторно сверены с tracked inventory b8babc2. Это карта покрытия 56 эпиков, не построчное доказательство всех assertions. Новые runtime-only и commercial AC сохраняют PENDING.

## Архитектура, данные и configuration review

- PostgreSQL владеет jobs, lease generations, attempts, encrypted part checkpoints, maintenance runs и outbox. `job_claim_lease.py:83–87` использует ordered claim + `FOR UPDATE SKIP LOCKED`. Долгие I/O этапы отделены от transactions через execution snapshots и повторную проверку lease. Redis используется для rate limits/readiness, не заменяет durable queue. Обработка media отделена от API по process/resources и DB grants. Полный concurrent multi-worker/load proof не получен.
- В models есть owner foreign keys, uniqueness для provider/accounting/notification identities и claim indexes. Alembic chain имеет 37 revisions/один head; exact-main Linux CI проверяет upgrade и role contracts. Destructive production migration и restore не выполнялись. Следующий results/export design должен сохранить совместимость API/worker и безопасные uncertain-outcome checkpoints.
- Analytics уже агрегирует в PostgreSQL и использует `yield_per(500)`; преждевременный вывод «все jobs грузятся в RAM» был бы неверен. Потенциальный рост стоимости `GROUP BY options_json` и ordered percentiles требует `EXPLAIN (ANALYZE, BUFFERS)` на синтетическом репрезентативном объёме. Время запроса, допустимая нагрузка и SLO не измерены; bottleneck не объявляется доказанным.
- `config.py:11` задаёт Pydantic settings: явные constructor overrides → environment → `.env` → file secret source/defaults; прикладные secret contents читаются из указанных файлов соответствующими methods. `database_url` обходит сборку URL из отдельных DB fields (`:354–362`), `get_settings` cached до restart/cache invalidation. Приоритет подтверждён чтением установленного `BaseSettings.settings_customise_sources`; runtime `.env` не читался. Required-field/model validators связывают pricing provenance, TLS и enabled notification credentials. Default production origin/secure cookies требуют явного synthetic local setup, описанного в profile.
- API session проверяет активного owner, expiry/revocation; mutation boundary добавляет Origin/Referer и CSRF token, recent-auth/TOTP для критических действий. Provider keys/OAuth/TOTP encrypted; password/recovery verifiers one-way. Public health возвращает readiness summary. Это позитивные source/test findings, не формальный аудит каждого route и не commercial RLS proof.
- CI/CD: 9 workflows, 25 SHA-pinned Action refs, secretless baseline CI. Component CD стартует от push/manual и не зависит от результата отдельных CI workflows; безопасность relies on установленной pre-merge дисциплине, а main не protected (F13). Настройку fail-closed platform gate рассматривать отдельной Goal. Edge и component workflows имеют разные concurrency groups; общего host lock для всех операций не доказано. Не запускать конкурирующие поставки по предположению о глобальном lock.
- Python requirements имеют exact direct pins и transitive constraints, npm — integrity lock. Constraints не равны hash lock для всех платформ; pip install upgrade в CI и плавающий base-image tag ограничивают бинарную воспроизводимость. Runtime build создаётся на target и проверяется по image ID, не выдаётся за тот же CI artifact. Известные advisories — F12; production exploitability не установлена.

## Консолидация документов и compatibility code

| Поверхность | Действие / canonical destination | Основание и результат |
|---|---|---|
| README source role | DOCUMENT → ссылка на исходник и spec | Исправлено ошибочное «сырые/несогласованные». Current intent согласован пользователем. |
| Большие spec/plan | CONSOLIDATE → индексы и `docs/spec/*`, `docs/delivery/*` | 56 эпиков разбиты на четыре области; у формулировок и статусов один владелец. Все 687 ID сохранены, 12 связей исключают повторный учёт. |
| Закрытая Goal #301 и старая подготовка документов | ARCHIVE → `delivery-plan-archive.md` | Исходный незакоммиченный checkpoint сохранён как история; актуальные PR/CI/CD links и pending обязательства остались в dashboard. |
| Старые readiness оценки в архиве | CONSOLIDATE → текущий/предыдущий snapshot здесь; старые числа доступны через Git history | Удалены накопленные оценки, release records и технические ограничения сохранены. Проценты progress в реальном job scenario не являются readiness snapshot. |
| Прежний Project profile | CONSOLIDATE → validation и Studio operations | Команды, проверяемая revision и CI gates перенесены в validation; target/access/rollout — в Studio operations; CI/CD rules оставлены для настройки pipeline. |
| architecture / processing contract | DOCUMENT → фактический Google-only output boundary и ссылка на новый intent | Прежние фразы о запрете retained transcript относятся к текущему implementation boundary; новый согласованный scope требует его реализации. Позитивные safety constraints сохранены. |
| Dated audits в `docs/audits/` | DEFER, оставить historical links в README | Имеют уникальную историческую Evidence; не читались как current readiness и не дублируют dashboard. Удаление не обосновано. |
| SECURITY.md, stale literal tests | DOCUMENT по F19 в отдельном разрешённом изменении | Исправление связанного test выходит за документационный scope этого AUDIT. Путь SECURITY сохранён. |
| Deprecated API routes | DEPRECATE/DOCUMENT, сохранить routes до проверки external callers | Текущий PWA использует batch/preflight; отсутствие browser caller не доказывает отсутствие CLI/старого клиента. |
| Generated protobuf, Colab notebooks, Google Picker bridge | DEFER / сохранить | Проверены imports, notebook dynamic execution и caller sites; whole-module REMOVE не обоснован. |

Версии 2026-09-06 заменены по явному поручению владельца 2026-09-07. Новые AGENTS/CI-CD применены с сохранением project boundaries; operational сведения перенесены в существующие runbooks. Обязательная post-merge metadata запись и отдельные DEPLOY/LIVE статусы отменены. Новая policy, а не содержимое прежнего checkpoint, определяет дальнейший workflow.

## Roadmap и рабочая очередь

Приоритет не означает authorization. Findings закрываются по наблюдаемому результату и regression Evidence; findings/задачи сами по себе не увеличивают denominator; согласованные технические AC учитываются наравне с продуктовыми.

| Порядок | Bounded workstream | AC/findings | Зависимости и критерий выхода |
|---|---|---|---|
| 1 | Yandex correctness | F04/F05, Yandex-часть F06; YANDEX-01/02/03/05, STTPRO-05, MC-08/09, PO-14 | Faithful REST/gRPC fixtures, правильные capabilities, segment replacement/order, реальные provider/model projections. Изолированные checks возможны сейчас после поручения; provider canary требует отдельного согласованного side-effect scope. |
| 1, независимо | Dependency triage и reproducibility | F12/F14 | Triage двух leaf packages/6 advisories, проверенный patched lock, isolated Node/Python audit; Windows shell profile и Linux regression. Не применять blind audit fix. |
| 2 | Внутренний результат Studio | F01/F10, RS-01..17, PB-06, PM-05, TRANSC-01..03, storage lifecycle | Сначала accepted transcript artifact + state/ownership, затем retention/download/re-export. Schema/worker rollout по установленному migration gate. Не смешивать с payment/tenant инфраструктурой. |
| 3 | Яндекс Диск | F02, YD-01..09 | Зависит от RS accepted artifact и export model; OAuth/scopes/provider account и version-aware writes должны быть конкретизированы. |
| 3, независимо | Realtime continuity | F03/F05, RTC-01..07 | Сначала корректные segment identities, затем bounded replay/gap visibility, opt-in full audio/result retention. |
| 3, независимо | Media/preflight и UX | F06/F07/F17, UXN, MC | Даты/provenance/whole-source limits, Projects semantics, пользовательские templates; независимый Studio destination зависит от RS. |
| 4 | Capability contours | F09, EVC/CX-01/02 | Отдельные environments/configs и capability resolver; personal preview без оплаты. Общие функции интегрируются с commercial изоляцией. |
| 5 | Commercial delivery | CINF/CID/CDG/CXB/CSQ/CQF/CBI/CEC/CSEC/CNOT/CLEG/CX | После F01/F02/F09: российская инфраструктура, registration/RLS, quota reservations/fairness, payments/fiscalization/economics, data/legal decisions. Public launch только по complete applicable gates. |
| Поперёк соответствующих Goals | Recovery, monitoring и maintainability | F10/F11/F13/F15/F18/F19, REC/RELEAS/USAGEC | Приоритетные backup/restore proof, price provenance, platform enforcement; выделять modules при изменении соответствующих features, без общего rewrite. |

## Предложение следующей Goal

**`YANDEX-CORRECTNESS-01` — PROPOSED.** Исполнение не разрешено. Результат: существующие Yandex batch/deferred/realtime возвращают корректные provider данные и честно сообщают поддерживаемые режимы.

- Baseline: восемь текущих AC `YANDEX-01`, `YANDEX-02`, `YANDEX-03`, `YANDEX-05`, `STTPRO-05`, `MC-08`, `MC-09`, `PO-14`; критерии закрытия F04/F05 и Yandex-части F06. Это уточнение прежнего локального proposal: добавлен обнаруженный analytics defect, а остальные варианты выбора сохранены Roadmap.
- Non-goals: Яндекс Диск, commercial, retained transcript, общий UI redesign, dependency/security settings, real provider calls без явно включённого canary scope. Остальная часть F06 (неизвестная дата/source provenance) остаётся отдельной задачей, не закрывается автоматически.
- Batch A: REST integer-string timestamps и nested channelTag; malformed/bool/NaN/negative/out-of-range fixtures, provider/model в Google output и analytics, legacy compatibility. Batch B: документированные realtime options; indexed finals/refinements, interleaving/late correction/dedup и truthful UI. Batch C: review, required CI, установленная component поставка и доступные агенту runtime checks.
- Validation Plan: REQUIRED local unit/contract tests с official wire shapes; component tests для capabilities и display; Linux CI/Studio CI при соответствующем path scope; текущая schema не должна меняться без необходимости; REVIEW всех существенных findings; exact deployed API/worker/web identity и applicable health checks. Media body, keys и private IDs не включаются в artifacts.
- DoD реализации: выбранное поведение реализовано, regression checks PASS, review findings закрыты, применимые merge/component delivery выполнены по действующим правилам, Evidence/checkpoint сохранены. Готовность AC определяется реализацией в коде; охват provider/capture checks и недоступные сценарии фиксируются отдельно. Privileged worker/migration действия не выводятся из технического доступа. Обязательная отдельная metadata запись после поставки отменена; окончательный результат восстанавливается по PR/CI/CD records.
- Blockers: до выбора — нет authorization на implementation; рабочий Yandex account/BYOK и paid canary scope не проверены; full realtime diarization нельзя обещать в REAL_TIME при текущей официальной документации. Если цель требует иной latency/diarization tradeoff, это отдельное product decision, а не молчаливое отключение требования.

### Предыдущая завершённая Goal — `AUDIO-NAME-ERROR-UX-01`

**DONE: исправления, runtime поставка и metadata synchronization завершены. Исполнение разрешено ответом «Запускай», одноразовый metadata push — ответом «ну делай» 2026-09-06.** Источник — два комментария владельца к `/audio` и `/transcriptions` в текущем чате 2026-09-06; opaque message ID не предоставлен. Результат: полное название аудиорезультата сохраняется; ошибочная job имеет понятный доступный путь завершения ручного разбора.

- Baseline: AP-11, UXCTL-07; критерии закрытия F20/F21. Назначение существующих AC не меняется. Ранее предложенная Yandex Goal остаётся PROPOSED и не выполняется.
- Batch A: исправить filename/title boundary в frontend/API/formatter, проверить default/custom/dotted/Unicode names и source→job→download/Drive/reuse flow. Для уже созданных укороченных результатов сначала установить однозначную связь с исходником; существующие данные в диагностике не переименовывались.
- Batch B: заметное действие завершения разбора failed job; корректные availability и checked=0 сообщения; совместимые source/clip candidates; понятные auth/error outcomes. Failed job уже terminal: не выдавать закрытие карточки за остановку процесса или возврат средств. Решение «результата нет» остаётся явным действием владельца.
- Non-goals: повторная платная транскрибация, массовая очистка/переименование старых данных, изменение правил списания, удаление audit, commercial/Yandex Disk, общий redesign. Снятие safety confirmation из UXCTL-07 не предлагается.
- Required Evidence/DoD: regression unit + component/integration fixtures на двух выявленных ошибках; негативные сценарии несовместимого кандидата, recent-auth и неопределённого ответа; browser проверка заметности и завершения потока в isolated environment; applicable lint/typecheck/build/CI/review и component delivery; точная revision/health, remote metadata synchronization по DOC-GATE-01. Production решение о наличии результата не принимать за пользователя.
- Blockers: отсутствуют для завершённой Goal; DOC-GATE-01 закрыт по checkpoint. Production нажатие «Закрыть ошибку и убрать в историю» не выполнялось: оно меняет durable state и утверждает факт за владельца. Аналогичный flow с тестовым API прошёл CI.

### Дополнительное Evidence по browser comments — 2026-09-06T13:10Z

- **V26-BC-PROBE / TEST:** synthetic filename с несколькими точками; actual `create_audio_preparation_job` и `render_output_filename`, SQLite in-memory, `_env_file=None`, изолированный constrained Python graph. Вход: полное имя с `.mp4`; frontend-equivalent regex оставил полное title; service сохранил `Лекция 1`; formatter выдал `Лекция 1.flac`. Неправильное поведение воспроизведено; это FAIL для AP-11. Network/provider/Drive/storage side effects не выполнялись.
- **V26-BC-CODE / TEST, CODE:** actual `check_job_output_reconciliation` с fake read-only session без cases вернул все counters=0, callback lookup не вызван. App выбирает not-found сообщение по отсутствию resolved/conflicts без проверки checked. UI candidate predicate не проверяет source/clip, backend проверяет. Это подтверждённый UX contract defect; реальная backend ошибка сохранения решения не заявляется.
- **V26-BC-BROWSER / AGENT_BROWSER:** существующая authenticated вкладка `/transcriptions`, read-only просмотр; «Подтвердить: результата нет» доступна, linking требует выбора; details раскрыты и возвращены в исходное состояние. Повтор запрещён UI из-за uncertain provider outcome. Никакие resolve/cancel/retry/check mutations не нажимались. GitHub main и public web metadata повторно проверены: b8babc2; running API/worker revision этим не подтверждена.
- Ограничение local environment: global Python Pydantic/core несовместимы; synthetic probe успешно выполнен на ранее созданном isolated graph. Global packages не менялись. Полные suites заново не запускались; предыдущий PASS не закрывает новые regression gaps.

## Ограничения проверок агента и внешние gates

Эта таблица — технические gaps и условия конкретных внешних операций. Заданий владельцу пройти функции по списку нет. Известные дефекты учитываются в готовности соответствующих AC; непроверенный сценарий сам по себе не объявляется дефектом. Прежние MV-01..03 заменены VAL-01..03 с сохранением технических ограничений.

| ID / AC | Ограничение или техническая задача | Доступные проверки / действие агента |
|---|---|---|
| VAL-01 · CR-01..06, PR-01..13 | Runtime evidence по реальным audio devices, microphone/display/mixed capture и source loss неполно. | Static/component проверки есть; выполнять доступные capture/recovery сценарии в подходящем окружении при работе над эпиком. CR-06/PR-06 реализованы по коду; отсутствие отдельной серии production sessions учитывается только как ограничение runtime Evidence. |
| VAL-02 · PC-01, PUX-12, PG-01..08 | Физический touch и assistive-tech не проверялись; desktop и narrow viewport доступны агенту. | Desktop/browser и synthetic E2E checks есть; использовать доступную браузерную проверку затронутого поведения. |
| VAL-03 · SP/AP/VID | Субъективная слышимость samples отдельно не измерялась; VID ещё не реализован. | Алгоритмы/component tests есть; готовность считается по реализации. Жалобы на качество из эксплуатации оформлять как конкретный finding. |
| EXT-01 · YANDEX/STTPRO/GOOGLE/PD/PTM/JOBREL | Real provider/Google failure matrix требует подходящего тестового аккаунта и разрешения на конкретные платные/изменяющие данные операции. | Faithful fixtures и synthetic checks выполняет агент. Известные F04/F05/F06 исправляются по выбранной Goal; реальные вызовы не запускаются без нужного scope. |
| EXT-02 · JOBNOT/REALTI | Реальные notification destinations и отправка относятся к внешним side effects. | Fakes/permission UI tests есть; разрешённый delivery scenario проверяет агент при наличии доступа. |
| EXT-03 · REC/STORAG/DBLP/RELEAS | Disposable restore target, reviewed artifact/backup и недостающие RPO/RTO; fresh restore/runtime roles не подтверждены. | Выполнить доступные isolated recovery checks в соответствующей Goal; production restore/cleanup требуют установленной процедуры и полномочий. |
| EXT-04 · commercial/legal/billing | Для будущего commercial запуска нужны решения seller/operator, тарифы/quota и разрешённый payment sandbox. | Зафиксировать конкретные продуктовые решения и технически проверить callbacks/idempotency/RLS в выбранной Goal. Юридическое заключение аудитом не проводилось. |

## Audit quality review

- Охват HIGH по inventory/trace: весь актуальный upstream, 56 эпиков, все сохранённые AC, явные aliases, tracked stack/config/workflows и доступные GitHub records. Backend module references, notebook entrypoints и generated callers проверены; отсутствующий импорт сам по себе не использован как основание REMOVE.
- Findings HIGH там, где есть code + reproduction/official schema (F04, metadata/analytics F06), settings read или явная отсутствующая модель/route. MEDIUM для фактических provider outcomes, нагрузки, полноты preflight/recovery и применимости tariff/runtime configuration. LOW для неизвестных external consumers. Общая уверенность в production readiness — MEDIUM: scope шире доступного LIVE Evidence.
- False positives исправлены: diagnostic search уже есть; analytics использует SQL aggregation; native Picker bridge/notebooks/protobuf не dead code; Yandex provider ceiling не равен общему media limit; 86 npm entries не 86 независимых defects. Healthy endpoint не подтверждает worker/backup/product lifecycle.
- Возможные false negatives: каждый API route не прошёл отдельный pen-test/tenancy proof; нет свежей проверки Linux-specific Python advisory graph, multi-worker/load, real provider/Google/notification failure matrix, restore drill, full mobile capture и commercial runtime. Они отмечены PENDING, а не «проблем нет».
- По решению владельца от 2026-09-06 сохранён один показатель готовности по реализации в коде. Переименование прежних READY в IMPLEMENTED не увеличивает numerator и не создаёт новых PASS. USER-LIVE-01 фиксирует эксплуатационный опыт; изменённый PB-06 и найденный PO-14 остаются в работе. Декомпозиция/alias не считается новой реализацией.
- Документационный DoD: V26-DOC подтверждает links/ID/счётчики, source trace, сохранность project policy и user checkpoint, отсутствие product/workflow diff и relevant documentation guards. Commit/push/PR/merge/deploy этого AUDIT не выполнялись. Между предыдущим и текущим snapshot нет изменений реализации отдельного эпика более 10 п.п.; сравнение выполнено по обоим составам AC.

## DOC-GATE-01 — CLOSED для AUDIO-NAME-ERROR-UX-01

Разрешённый владельцем ответом «ну делай» 2026-09-06 одноразовый механизм по действовавшему тогда Project profile §10.9 выполнен: commit 27644aa опубликован в remote main; exact three-file remote readback, local/remote main equality и CI 34045687136 PASS. Встроенная Goal завершена после проверок. Постоянный механизм больше не требуется по решению владельца 2026-09-07. Согласованные правила готовности опубликованы с содержательным hotfix PR #303. Это не продлевает прежнее одноразовое разрешение на direct-main metadata push.

## DOC-GATE-02 — CLOSED / требование отменено

Владелец явно внедрил правила 2026-09-07, отменяющие обязательную post-merge запись metadata. Поставка STUDIO-CLEANUP-HOTFIX-01 восстановлена по PR #303, merge 3e65322, успешным CI/CD и scoped runtime Evidence V28; встроенная Goal закрыта. Direct-main metadata commit не выполнялся и больше не требуется. Подготовленные факты сохранены в текущем содержательном docs PR.

## F26 — консолидация repository workflow / CLOSED

Область: AGENTS, CI/CD rules, README, spec/plan, validation и operations. Evidence: старые инструкции на origin/main 3e65322 и явно принятый комплект 2026-09-07; шаблоны/проектные отличия доступны в AGENTS. P1: прежнее требование metadata commit блокировало уже выполненную поставку, operational routing зависел от универсального CI/CD документа. Действие CONSOLIDATE/DOCUMENT: критерии DOC-01..03 текущей Goal; зависимости — docs checks и merge. Confidence HIGH: прямой конфликт правил и первичные delivery records. Это process finding, не новый AC требований.

## F27–F29 — AUDIO-UX-DRIVE-01 / IN_PROGRESS

| ID / приоритет | Область / Evidence на 8923ba4 | Влияние / действие / зависимости / confidence |
|---|---|---|
| F27 / P1 | AP-15/23; `apps/studio/src/AudioPreparationPage.tsx`, audio API/service/processor; annotation 1 | Нет post-completion save action, забытый auto-save требует нового обходного действия. FIX: отдельный durable export готовых bytes с existing picker/owner/storage/lease/idempotency. HIGH: UI и API не предоставляют действие. |
| F28 / P2 | PG-09; `apps/studio/src/GoogleDriveFolderPickerDialog.tsx`, annotation 2 | Только name_natural, нет выбора даты. IMPLEMENT по явному запросу: Drive orderBy, reset pagination/stale requests; shared-drive containers не имеют modification time. HIGH: request/UI inspected. |
| F29 / P1 | AP-22; `apps/studio/src/AudioPreparationPage.tsx`, annotations 3/4 | Number(value) уничтожает пустой/промежуточный ввод. FIX: string drafts, normalize decimal point to comma, finite bounds before both processing paths; regression UI tests. HIGH: причина установлена в handler. |

## V30-LOCAL — AUDIO-UX-DRIVE-01

2026-09-07, Windows, dirty branch `codex/audio-drive-numeric-ux` от 8923ba4: numeric draft/validation, Drive sorting/pagination и post-completion export реализованы. **91 focused Python tests PASS**, включая 14 новых export tests; **741 Vitest / 69 files PASS**, после уточнений — **24 affected UI tests PASS**; lint/TypeScript/build, Python compile и lightweight repository checks PASS. В существующий authenticated Playwright scenario добавлены настоящий ввод минуса/точки, блокировка неполного ввода и локальная обработка WAV; Linux API/PostgreSQL/Redis + этот browser scenario REQUIRED remote-only, пока PENDING. API regression проверяет owner, session/CSRF/origin, server folder verification и idempotent queue. Новых jobs/workflows, зависимостей, lockfile или schema changes нет. Сохраняется прежний advisory chunk >500 kB.

Self-review: source/owner boundaries, expired/deleted output, temporary streaming file, lease fencing/restart, idempotent existing Drive lookup, поздняя отмена после подтверждения и cached ORM state проверены. Очередь completed-stage совместима со старым worker; новый export не читает исходные inputs и не запускает FFmpeg. Полный Google transfer, cancellation и mutations на production не выполнялись; fake integrations ограничивают вывод о реальном Google runtime. Required gates не объявлены PASS заранее.

Registry этой ветки: **356/676 READY**, включая новый PG-09; AP-22/23 восстановлены после исправления. Это unmerged code progress, не готовность main до merge. Baseline main 8923ba4 содержал 355/675 READY по прежнему snapshot; обнаруженные F27/F29 нарушают два действующих AC, поэтому проверенная base до исправления — **353/675**, AP **28/30**, PG **8/8**. Новый denominator +1 обусловлен отдельным запросом сортировки; после merge пересчитать по actual origin/main. Delivery: один code PR, стандартный web/API CD → worker status/drain (graceful exit 0) → manual worker component CD по существующей процедуре → identity/schema/health и bounded browser smoke. Metadata-only follow-up PR не нужен.

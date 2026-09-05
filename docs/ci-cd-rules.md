# Правила validation и CI/CD

Документ определяет выбор проверок, CI, build/artifact, CD и связанные операции с окружениями. Scope и полномочия задаёт пользователь; Goal и состояние исполнения ведутся по корневому `AGENTS.md`. Правила применяются к фактическому стеку проекта, а не требуют внедрить все перечисленные инструменты.

Разделы 1–9 — общая политика и Safety contract: не изменяй их без явного запроса пользователя. Обнаруженное препятствие сначала исследуй и зафиксируй; если решение требует изменения политики, эскалируй его. Не переписывай правила для обхода blocker. Раздел 10 — изменяемый Project profile: агент заполняет и актуализирует факты и команды в разрешённой задаче, не ослабляя общую политику и required gates. Конкретные workflows, scripts и runbooks могут изменяться внутри Goal, если это необходимо для её выполнения и не меняет согласованные границы.

## 1. Основные условия

- CI проверяет конкретную revision, CD изменяет выбранное окружение. Разделяй их jobs, triggers, credentials и permissions; отдельные workflow-файлы необязательны. Обычная проверка PR не должна незаметно запускать production deploy.
- Не исполняй untrusted code с production credentials, write-capable token или доступом к privileged persistent runner. Credentials и permissions выдаются минимально нужному job и target.
- Для каждого consequential действия установи repository, revision/artifact, environment и deployment unit. Неизвестные target, identity или обязательные preconditions останавливают соответствующее действие.
- Required validation должна действительно выполняться и подтверждать проверяемое поведение. Наличие зелёного значка само по себе недостаточно, если необходимые steps были пропущены.
- Обычная поставка не должна включать скрытые destructive migrations, удаление persistent state, bootstrap, hardening или изменение модели доступа.
- Успешную поставку объявляй после обязательных post-checks. Сохраняй проверяемое Evidence без secrets.

## 2. Выбор validation

При подготовке проекта установи stack/runtime, package manager, tests, API/DB/integrations, environments и критичные сценарии; сохрани факты и команды в разделе 10. Используй подходящий существующий стек проверок; при отсутствии выбери минимальный набор, обнаруживающий существенные ошибки.

До реализации составь Validation Plan внутри Goal в `docs/delivery-plan.md`: AC/риск, check/сценарий, команда/tool, environment, `REQUIRED` / `RECOMMENDED` / `N/A`, этап и основание. Недостающие AC сформируй по `AGENTS.md`.

`REQUIRED` — условие соответствующей Goal/stage; `RECOMMENDED` — отсутствие допустимо с описанным остаточным риском; `N/A` — неприменимость к стеку/scope. Недоступность инструмента или окружения не означает N/A.

| Проверка | Когда нужна |
| --- | --- |
| Format и lint | Настроенные правила стиля и статические ошибки |
| Typecheck и build | Типы, компиляция, packaging, deployable configuration |
| Unit | Business logic, вычисления, валидация, state transitions, error paths |
| Component | UI-состояния, формы, события, accessibility компонента |
| Integration / API / contract | Границы модулей и сервисов, auth, очереди, адаптеры, совместимость API/сообщений |
| DB и migrations | Queries, constraints, transactions, сохранность данных, upgrade path |
| E2E и smoke | Критичные пользовательские сценарии и базовая работоспособность |
| Visual и accessibility | Требования к виду/доступности, чувствительные layout/interaction changes |
| Security и supply chain | Auth, доступ, данные, dependencies, CI trust |
| Performance и load | Заданные SLO/нагрузочные AC, concurrency, рост данных, признаки регрессии |
| Recovery и resilience | Retry/idempotency, восстановление, rollout, backup/restore, stateful changes |
| Human validation | Субъективная оценка, физическое устройство, недоступное агенту действие |

Уровень и охват определяются проверяемым поведением, не названием framework. Подбирай инструменты под платформу; не внедряй все виды tests автоматически. FORMAT/LINT/TYPECHECK/BUILD — самостоятельные проверки, они не заменяют tests поведения.

Проверяй ожидаемый результат, границы, негативные сценарии и права доступа. Для дефекта добавь regression test, когда это технически разумно; иначе сохрани воспроизводимую проверку. Не добавляй tests, повторяющие implementation, и тяжёлую инфраструктуру ради таблицы. Простому изменению текста достаточно проверки содержимого/ссылок.

Не вводи универсальный coverage target; покрытие строк не доказывает AC. Не ослабляй assertions и не исключай tests ради green CI. Удаление obsolete test допустимо при подтверждённом изменении контракта.

При изменении требований пересмотри critical paths/NFR, совместимость, тестовые данные, regression scope и release risks; обнови план/профиль. Сохраняй обязательные гарантии. Старое Evidence используй после проверки применимости к текущим AC/revision/environment.

Если required check невозможен, исследуй причину и эквивалентную проверку. Замена должна сохранять гарантии и не обходить platform gate; сохрани обоснование. Иначе это TEST GAP и незавершённый этап. Продолжай независимую работу; waiver/изменение DoD согласуй.

Для web-проекта сам выполняй доступные browser checks в local/staging/подходящем deployed environment с указанием сценария и версии; они не заменяют обязательную воспроизводимую E2E suite. Используй тестовые аккаунты/данные и изоляцию. На production по умолчанию — безопасные read-only smoke checks. Реальные платежи, рассылки, удаление/изменение пользовательских данных требуют явной authorization. Browser artifacts не должны раскрывать чувствительные данные.

Human-only очередь и её влияние на Goal определены в `AGENTS.md`. Известный дефект и обязательный внешний gate нельзя отложить под видом ручной приёмки.

## 3. Локальные проверки и CI

### Delivery cycle для каждого batch

Перед изменениями проверь worktree, base branch и SHA; зафиксируй их в checkpoint. Получи актуальное состояние remote, если доступно; clean local base обнови безопасным fast-forward. Работай в отдельной feature/fix-ветке от проверенной base либо подходящей ветке текущего batch. При unknown user changes используй изолированную ветку/worktree, сохраняя исходное состояние; не включай чужие изменения в PR и не переписывай опубликованную историю без authorization.

Для нового Git repository нужен разрешённый bootstrap: минимальный initial commit, затем рабочая ветка с base SHA. Отсутствие remote не запрещает разрешённую локальную работу; создание remote и публикация требуют соответствующего scope.

Делай commits после связных проверенных шагов; показатели готовности показывай по `AGENTS.md`. Группируй commits в pushes. Обычно отправляй подготовленный batch после доступной local validation; ранний push/draft PR допустим для remote-only validation, необходимого review или сохранения работы.

Перед PR проверь совокупный diff, проведи self-review, доступные local checks и обнови relevant docs/plan в той же ветке. Укажи результат, AC, проверки, ограничения и rollout. При CI/review failure сначала разбери причину, затем собери исправления с local checks в следующий push; повторяй по фактической необходимости, не отправляя каждую мелкую правку отдельно.

Дождись terminal results required checks и обязательного review. Self-review не заменяет required approval другого лица. Перед merge проверь актуальные head/base, protections и AC batch в части, проверяемой до merge. Новая revision требует применимой validation; прежний CI не доказывает её проверку. Human-only приёмка отделена по `AGENTS.md`; DEPLOY/LIVE подтверждаются на своём этапе. Незавершённые AC других batches не блокируют merge независимого готового batch.

Выполни разрешённый merge установленным способом, применимый CD и post-checks. Для последовательного batch используй актуальную base. По завершении applicable delivery безопасно синхронизируй local base с remote. Удаляй только созданные этой работой merged branches/worktrees после проверки отсутствия уникальных изменений; сохраняй незавершённую работу.

Для hotfix допустимо сокращать необязательные шаги; required safety/CI/deployment gates сохраняются.

### Выполнение проверок

Перед push выполняй доступные relevant local checks. Требуемые только в CI проверки выполняй в CI; их недоступность локально не запрещает отправить подготовленную ветку. Фиксируй проверенную revision и отличия local environment от CI.

CI должен использовать intended revision, изолированный workspace, воспроизводимую установку dependencies и lockfiles, если применимы. Обязательная команда при failure возвращает non-zero; silent fallback, безусловный success и `continue-on-error` не должны скрывать required failure. Проверяй, что test discovery действительно нашёл ожидаемые tests.

Определи обязательные проверки до merge и проверки других этапов: например, расширенная regression перед release или по расписанию. Сценарий, существенный для безопасности текущего merge, нельзя вынести только в nightly ради скорости. Учитывай зависимости между модулями при выборе affected tests; при неопределённом impact запускай более широкий подходящий набор.

Избегай дублирующих `push` + `pull_request` запусков одной suite без отдельной цели. CI не нужен на каждый локальный commit. Используй группировку изменений, безопасный cache и параллельность по возможностям проекта. Число PR определяется batches по `AGENTS.md`, без фиксированной квоты; экономия запусков не разрешает объединять несвязанные изменения в непроверяемый diff. Speculative reruns без анализа причины не выполняй; transient failure можно повторить обоснованно, deterministic failure нужно исправить.

Не используй GitHub-hosted Actions для длительного мониторинга или наблюдения за окружением без отдельного согласования. Ограниченные health/readiness и post-deploy checks внутри поставки допустимы; ожидание агентом завершения CI вне runner под этот запрет не подпадает.

Обычный CI выполняет checks, а не изменяет repository: self-modifying workflows и auto-fix commits/push по умолчанию запрещены. Исключение — отдельно согласованная узкая automation с доверенным trigger, минимальными permissions, allowlist изменений и защитой от циклических запусков. Это не запрещает агенту исправлять code/workflows обычными commits в рабочей ветке разрешённой Goal.

Универсального лимита длительности pipeline нет. Подбирай job timeouts по реальным операциям и поведению зависаний. Длительность или экономия Actions minutes сами по себе не разрешают снимать required validation. Целевые длительности и бюджет фиксируй в профиле только если они действительно заданы проектом.

Агент самостоятельно дожидается terminal status required checks, разбирает результат и продолжает delivery. Обычное ожидание CI не переводит Goal в `BLOCKED`. Если ожидание требует продолжения вне текущего запуска, используй доступный механизм ожидания/продолжения приложения и checkpoint; не считай работу завершённой.

### Required checks в GitHub

Проверяй required checks и их источник по фактическим rulesets/branch protection, а не только YAML. Gate должен относиться к актуальной проверяемой revision: PR head, test merge commit или merge group согласно конфигурации. После изменения revision проверь новые результаты. При merge queue нужны соответствующие `merge_group` triggers.

Не настраивай обязательный workflow так, чтобы path/branch filters оставляли его навсегда ожидаемым. Для выборочного набора jobs используй надёжный итоговый gate: он запускается после dependencies и явно проверяет результаты всех применимых required jobs.

GitHub может принимать `skipped` или `neutral` как успешное состояние. По этому контракту они не доказывают выполнение обязательной проверки. Допустим только заранее определённый и подтверждённый выбор неприменимой проверки; dependency failure или ошибочный фильтр не являются `N/A`.

`failure`, `cancelled`, `timed_out`, отсутствие нужного результата и неожиданное `action_required` требуют разбирательства. Не удаляй requirement и не обходи protections. Подробности поведения платформы: [GitHub required status checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).

## 4. Trust boundaries и supply chain

Задавай GitHub `permissions` явно, с read-only/none по умолчанию и точечным повышением для нужного job. OIDC и short-lived credentials предпочтительны, когда доступны; фиксируй ограничения identity, environment и target. Reusable workflow получает только необходимые inputs/secrets.

Untrusted PR/fork code не запускай с production secrets, write token, privileged runner или доступом к внутренним ресурсам. Для PR предпочитай изолированные ephemeral runners. Deploy runners отделяй от общего PR execution; для self-hosted runners учитывай cleanup и возможность сохранения чужого состояния.

`pull_request_target` и привилегированный `workflow_run` не должны исполнять untrusted PR code или без проверки доверять его artifacts. Metadata-операции допустимы при обработке содержимого PR как данных. Не вставляй untrusted expressions напрямую в shell source; используй безопасно переданные аргументы/environment variables и проверку формата.

Внешние Actions/reusable workflows фиксируй полным commit SHA. Проверяй источник и необходимые полномочия новой dependency. В build используй lock integrity и доверенные registries; учитывай install scripts. Vulnerability/license scans, SBOM и attestations включай по требованиям и риску проекта, а не автоматически все сразу.

Cache — оптимизация, не доверенный artifact и не источник secrets. Учитывай OS/runtime/lockfile и trust context в ключах; не допускай, чтобы привилегированный build потреблял cache, который может отравить untrusted job. Validate artifacts отдельно от cache.

Security baseline платформы: [GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use). Изменение trust context, runner или credential model требует повторной оценки затронутых границ.

## 5. Build, artifacts и release identity

Если результатом является image/package/archive, связывай его с source revision, build run и immutable digest/version. `latest` или branch tag без digest не является достаточной identity. Проверяй repository и источник artifact, особенно при переходе между workflows.

Production artifact должен пройти требуемую validation в допустимом trust context. Успешный untrusted PR run сам по себе не делает его artifact доверенным для production. Если release build выполняется после merge, связывай фактический merge SHA, результаты применимой validation и созданный artifact.

По возможности строй один раз и продвигай тот же artifact между environments. Если platform model требует пересборки, укажи это в профиле и проверь точную source revision, воспроизводимость inputs и новый artifact; не выдавай его за уже проверенный бинарный результат.

Artifacts не должны содержать credentials, runtime state и лишние данные. Задавай retention/access по назначению. Versioning, signing, provenance и публикация пакетов применяются по release model проекта; публикация — отдельный явный этап, а не побочный эффект теста.

## 6. CD и окружения

До изменения target установи trusted trigger, expected repository/ref, exact revision/artifact, environment/account/host/cluster, directory/namespace, service и credential/runtime-config owner. Проверь preconditions и отсутствие конфликтующей поставки. Не выбирай неизвестный target по догадке.

Применяй установленные environment protections, allowed branches/tags и required approvals. Routine deploy по согласованному процессу выполняй автономно; наличие технического доступа само по себе не разрешает новую production topology или privileged operation.

Сериализуй поставки в один target. Перед изменением окружения повторно проверь, что candidate ещё допустим по release policy: отложенный job не должен затереть уже поставленную более новую версию. Одна очередь не гарантирует порядок версий; правило выбора candidate зафиксируй в профиле. Намеренный rollback выполняй по отдельной recovery procedure. Не отменяй migration/deploy при риске неконсистентного state; retry допустим при известной idempotency или безопасной точке продолжения. Поведение платформы: [GitHub concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

Перед переключением версии проверь config и stateful preconditions. Изменяй только intended deployment unit; затем выполни health/readiness и требуемые прикладные smoke/LIVE checks. Отличай статус процесса, доступность endpoint и выполнение бизнес-сценария.

`DEPLOY PASS` требует подтверждения поставленной версии; `LIVE PASS` — успешного соответствующего post-check с указанием окружения и времени. Если нельзя доказать deployed revision, сохрани ограничение; ответ endpoint не устраняет неизвестную identity. Не выполняй искусственный production deploy только ради Evidence для изменения, которому он не нужен.

При failed post-check останови дальнейшее продвижение этой поставки, сохрани Evidence и примени согласованную recovery strategy. Другую независимую работу в Goal можно продолжать, если это безопасно.

### VPS и Docker Compose при наличии

Проверь host identity/SSH host key, deploy directory, remote, ref, exact target commit, worktree, Compose project, allowlisted services и persistent volumes. Не отключай проверку host identity для устранения ошибки доступа.

Git-based deploy обновляет код безопасным fast-forward или получением exact revision в чистую release directory. `reset --hard`, broad `clean`, `docker compose down`, volume removal и system-wide prune не являются стандартной стратегией поставки. Не перезаписывай неизвестные изменения на host.

Bootstrap host, users/SSH/firewall, массовые permission changes и перенос данных выполняются только в согласованной setup/maintenance задаче. Не смешивай credential, позволяющий VPS читать repository/artifact, с credential, позволяющим CI подключаться к VPS.

### Infrastructure as Code при наличии

Перед apply проверь target account/workspace, plan diff, exact revision, полномочия и изменения persistent resources. Apply выполняется в trusted context с locking state и понятной recovery procedure. Пересоздание/удаление ресурсов не маскируй под routine deploy; state и plan artifacts могут содержать secrets и требуют соответствующего обращения.

## 7. Runtime configuration и stateful changes

Укажи canonical config owner: platform settings, secret manager, environment secrets или host files. Schema/examples содержат только безопасные значения. Production `.env` не заменяй template-файлом; сохраняй existing values. Missing required value блокирует соответствующий deploy, а не весь независимый development.

Проверяй наличие/формат config без печати secret values, resolved secret-bearing config и authorization headers. Не коммить credentials и не сохраняй их в artifacts/cache/logs. Rotation и recovery выполняй по разрешённому scope; не меняй секреты незаметно при обычном запуске.

К stateful systems относятся DB, очереди, object/file storage, volumes и другие хранилища важных невосстанавливаемых данных. Для изменения выбери класс:

- `NONE` — изменений persistent schema/data нет.
- `BACKWARD_COMPATIBLE_AUTOMATED` — versioned migration совместима в rollout window; известны retry, locking, duration/failure behavior, выполнены необходимые backup/recovery preconditions и предусмотрен post-check.
- `EXPLICITLY_GATED` — destructive, несовместимое, необратимое или привилегированное изменение; нужны явный scope, authorization, target, preconditions, recovery/forward-fix и критерии остановки.

Gated infrastructure/data operation отличается от Manual Validation Goal. Пока обязательная операция не выполнена, соответствующий delivery stage остаётся незавершённым. Подготовку и независимую реализацию можно продолжать.

Если backup требуется для безопасной migration, проверь пригодность recovery по принятой процедуре. Не объявляй backup достаточным только по наличию файла. Routine backup в заранее согласованной процедуре разрешён; restore, broad cleanup, удаление volumes и перенос данных не становятся разрешёнными автоматически.

Automatic rollback допустим только при проверенной совместимости artifact, config и уже изменённой schema/state. Rollback приложения не равен откату данных. Если безопасный rollback не определён, используй согласованный forward-fix или внешний gate; не импровизируй destructive recovery.

## 8. Evidence и operational metadata

Checkpoint и словарь Evidence определены в `AGENTS.md`. Delivery plan хранит реестр состояния и ссылки на первичные records:

| Этап | Минимальное подтверждение |
| --- | --- |
| Local validation / browser | Команда/сценарий, результат, revision/worktree, environment, время, ограничения |
| CI / review | Check/run/PR URL или ID, revision, required результаты и существенные findings |
| Build | Source revision, run, artifact version/digest, применимая provenance |
| Deploy / LIVE | Target, deployed revision/artifact, run/deployment ID, migration result, post-check, время |

Raw log без target/revision не заменяет Evidence. Отчёт не должен превышать охват проверки. Отсутствие deploy даёт `DEPLOY/LIVE N/A` только при неприменимости к scope.

### Фиксация без отдельного служебного PR

До финального push обнови фактическое состояние batch в delivery-plan в той же ветке/PR: AC/baseline, результаты, оставшиеся gates и источники их проверки. Будущие условия merge/deploy перечисли отдельно; не записывай прогнозные PASS/READY и второй набор «будущих» процентов.

Свяжи batch с branch/PR и установленными источниками CI/deployment records. Не выдумывай будущие run IDs или SHA содержащего запись commit. Локальную проверенную revision/worktree связывай с финальным PR/merge через первичные records; при изменении кода/AC перепроверь Evidence. Human-only AC остаются IMPLEMENTED/PENDING, operational/live AC требуют фактических DEPLOY/LIVE.

После merge и применимой поставки проверь gates по фактическим records. Сохрани точные результаты и ссылки в durable handoff, доступном следующему чату по routing проекта. Результаты, которых нет в первичных records (например, ручной LIVE check), сохраняй в указанном в Project profile месте с revision/target/временем; одного итогового сообщения чата недостаточно. Используй разрешённый существующий механизм, не создавай молча новую внешнюю запись/automation. Если места или доступа нет — зафиксируй конкретный metadata gap и сохрани доступный локальный checkpoint.

При AUDIT/RESUME и расчёте readiness читай план вместе с этими records; применяй только проверенные факты. Недоступное подтверждение — ограничение, известный failure отменяет прежний PASS соответствующей гарантии. При следующем содержательном изменении синхронизируй реестр с результатами; отдельный metadata commit/PR только для отметки merge или переноса доступных records не требуется.

До merge исправляй failure в текущем batch; после merge — согласованный recovery/forward-fix с незавершённым delivery stage. Необходимый PR с содержательным исправлением включает актуальный план. Не обходи protections ради metadata. Post-deploy metadata automation не обязательна; если согласована, соблюдай раздел 3 и не меняй product requirements.

## 9. Завершение и исключения

Для применимого delivery stage требуются фактические successful результаты validation/review, правильная revision/artifact, соблюдённые protections, безопасная работа с config/state и выполненный post-check. Пока required этап не завершён, не объявляй соответствующую Goal `DONE`; отложенная human-only приёмка учитывается отдельно по `AGENTS.md`.

Operational/live эпик не получает `READY` без подтверждённых `DEPLOY` и `LIVE` для требуемой версии и окружения. Локальная или PR-only Goal может завершиться в своих явно заданных границах, не делая весь такой эпик `READY`. Недоступность инфраструктуры не превращает необходимые подтверждения в `N/A`.

Не снимай gate из-за Actions cost, длительного ожидания, отсутствия доступа или flaky test. Разберись в причине, исправь в разрешённом scope либо укажи конкретное внешнее действие. Продолжай независимую работу внутри Goal.

Исключение из политики требует решения пользователя/уполномоченного владельца: правило, причина, scope и срок, риск, compensating checks, источник authorization и критерии остановки/recovery. Уже согласованное исключение применяй только в его пределах. Оно не меняет универсальный шаблон для других проектов.

## 10. Project profile

Профиль адаптирован к Elevenlabs-API из референса владельца от 2026-09-05. Разделы 1–9 сохранены из нового референса; старый `goal-driven-v1` ими заменён. Общие правила не разрешают расширять текущую задачу. Фактические пробелы не являются safety exceptions и не разрешают менять settings/workflows без соответствующего scope.

### 10.1. Проект и проверенные источники

- Repository: `Just9120/Elevenlabs-API`, public; default и release branch — `main`. Source snapshot 2026-09-05: local `d62945912b3e470b2cb8b20912057a4a57c0f6f1`, remote main `dce709df90d4495f7775be93d631ee9a0d3e6f6d`. Branch текущей задачи и Current Goal хранятся в [delivery-plan](delivery-plan.md).
- Продукты: Python/Google Colab entrypoints и VoiceOps Studio PWA. Studio: React 18, TypeScript 5.6, Vite 6; Python/FastAPI, SQLAlchemy/Alembic, PostgreSQL, Redis, FFmpeg; batch worker и realtime/provider adapters. Product scope — [project-spec](project-spec.md), boundaries — [architecture](architecture.md) и [processing contract](studio-processing-contract.md).
- Node: npm и `apps/studio/package-lock.json`; engines `^20.19.0 || ^22.13.0 || >=24`, CI Node 22. Python CI 3.11; `requirements-dev.txt` + `constraints-dev.txt`, API requirements + `apps/studio-api/constraints.txt`. Constraints являются version pins, не универсальным lock с hash integrity. Не заменяй package manager по существующему local node_modules.
- Sources: девять `.github/workflows/*.yml`, package/constraints files, `deploy/studio/compose.platform.yml`, безопасный `.env.example`, deploy/operations scripts и [Studio operations](runbooks/studio-platform-ops.md). GitHub settings API проверены в аудите 2026-09-05: branch/rulesets, Actions permissions, Environment, variable/secret names. Это snapshots, перед consequential operation перечитай внешние settings.
- Runtime secret values, private keys и host `.env` не читались. Local Windows/Python 3.12/Node 22 не равны Linux CI; Docker локально недоступен. Public read-only health/build identity не подтверждают private product scenarios или worker identity. Точные результаты и ограничения — в delivery-plan, здесь только профиль проверок.

### 10.2. Команды и validation

Рабочий каталог указан отдельно; команды установки выполняй в изолированном environment. Production config/data не использовать. Подробный setup: [validation runbook](runbooks/validation.md); при расхождении команды сверяй с фактическим workflow/package script, фиксируя drift.

| Назначение | Каталог и команда | Применимость / условия |
| --- | --- | --- |
| Install Python | Root: `python -m pip install -r requirements-dev.txt -c constraints-dev.txt` | Изолированный Python 3.11 для CI-equivalent; API-only install — как в `studio-ci.yml` |
| Install web | `apps/studio`: `npm ci` | Canonical npm lock; не менять lock ради локального окружения |
| Lightweight | Root: `python scripts/ci_checks.py` | Существующие notebook/guard checks; быстрый repository gate |
| Format / docs | Root: `git diff --check`; проверить содержимое, links и routing | Отдельного formatter script нет; это не замена configured lint |
| Lint | `apps/studio`: `npm run lint` | ESLint |
| Typecheck | `apps/studio`: `node node_modules/typescript/bin/tsc -b` | Также входит в build |
| Focused tests | Root: `pytest -q <test-path>`; web: `node node_modules/vitest/vitest.mjs run <test-path>` | Выбрать существующие tests затронутого поведения; Python service fixtures требуют соответствующего environment |
| Frontend suite | `apps/studio`: `npm run test -- --run` | Vitest; если local npm wrapper не передаёт `--run`, эквивалент — `node node_modules/vitest/vitest.mjs run`, различие записать |
| Full Python / DB | Root: `alembic -c apps/studio-api/alembic.ini upgrade head`, затем `pytest -q` | Только isolated PostgreSQL 17/Redis 7 + synthetic config по `ci.yml`; Linux/bash, тестовый DB owner/runtime setup из workflow |
| Portable Python | Root: `pytest -q --portable` | Ограниченная диагностика; исключает 9 modules по `conftest.py`, оставляет часть shell tests, не гарантирует Windows compatibility |
| Browser E2E | `apps/studio`: `npm run test:e2e`; inventory — `npm run test:e2e:list` | Playwright Chromium, isolated DB `studio_browser_e2e`, Redis, migrations, seed и fake external services по `studio-ci.yml` |
| Build | `apps/studio`: `npm run build` | TypeScript + Vite/PWA + `scripts/write-build-meta.mjs`; отдельный Vite run не равен всей команде |
| Containers / Compose | Команды build и synthetic Compose checks из `.github/workflows/studio-ci.yml` | Docker/Linux; repository build contexts и env из workflow, без production secrets |
| Advisory audit | `apps/studio`: `npm audit --audit-level=high`; Python — isolated constrained `pip-audit` по `dependency-audit.yml` | Scheduled/manual supply-chain check; фиксировать дату, lock/revision и advisories |
| Local web / API | `apps/studio`: `npm run dev`; root: `uvicorn studio_api.main:app` | API требует `PYTHONPATH=apps/studio-api`, isolated DB/Redis/config и synthetic secrets; production `.env` не копировать |

Применимые pre-merge проверки по проектному контракту: `CI / checks`; для path scope Studio — `Studio PWA CI / studio` и `Studio PWA CI / browser-e2e`. GitHub platform сейчас их не enforces: `main` без protection, rulesets пусты. Перед разрешённым merge агент проверяет актуальную revision, relevant jobs, self-review, существенные findings/conversations и mergeability; отдельно соблюдает реально заданные внешние approvals. Наличие технической возможности merge не снимает эти проверки.

`CI` запускается на PR, push main и вручную; `Studio PWA CI` — по своим path filters на PR/main и вручную. PR validation относится к фактическому head/test-merge SHA из run; post-merge CI — к main SHA. Merge queue не настроена. Required job не считать PASS по skipped/summary; документировать неприменимость по scope. При workflow-only/security change проверяй соответствующие regression tests и новый trust context, даже если Studio path filter не сработал.

Critical scenarios: owner/CSRF/session/TOTP isolation; source multipart reconciliation и storage classes; batch queue/retry/idempotency; Yandex REST timestamp types и realtime final ordering; Google output metadata; retained transcript/re-export; cleanup/backup/recovery; schema compatibility; PWA capture/permissions, 390px viewport и accessibility. AC/риски и нужные проверки выбирай в Validation Plan конкретной Goal. Реальные STT, Google mutation, Telegram notifications и destructive cleanup/restore не входят в обычную suite; live canary требует согласованного scope, тестовых данных и ограниченного побочного эффекта.

Известные gaps: Windows `--portable` всё ещё зависит от bash для части tests; текущий validation runbook описывал меньше исключений, чем `conftest.py`. Existing local dependencies не являются clean-install Evidence. Fresh Python advisory audit и полноценная local Docker/DB/browser suite в последнем аудите не выполнены. Npm advisory findings и результаты отдельных checks — в delivery-plan; профиль не превращает их в PASS. Универсальный duration/coverage/budget target владельцем не задан; действуют timeout guards конкретных jobs. Human-only очередь и её gates — по AGENTS.md/плану.

### 10.3. CI, build и credentials

| Workflow | Trigger / назначение | Production capability |
| --- | --- | --- |
| `.github/workflows/ci.yml` — CI | PR/main/manual; PostgreSQL/Redis, Alembic, lightweight, full pytest | Нет |
| `.github/workflows/studio-ci.yml` — Studio PWA CI | Path-filtered PR/main/manual; studio и authenticated browser-e2e | Нет |
| `.github/workflows/dependency-audit.yml` — Dependency audit | Weekly/manual npm/Python advisory audit | Нет; не regular PR gate |
| `.github/workflows/studio-platform-cd.yml` — Studio Platform CD | Path-filtered main/manual; web/API, gated migration, manual worker | Да |
| `.github/workflows/studio-migration-environment-probe.yml` | Manual main; no-op Environment reviewer probe | Только Environment gate; без checkout/secrets/SSH |
| `.github/workflows/studio-edge-cd.yml` — Studio Edge CD | Manual exact main SHA; security-header release | Да, gated |
| `.github/workflows/studio-processing-preflight.yml` | Manual expected SHA; processing readiness | Read-only SSH |
| `.github/workflows/studio-worker-status.yml` | Manual expected SHA; worker identity/health | Read-only SSH |
| `.github/workflows/studio-worker-drain.yml` | Manual expected SHA; graceful stop | Да, меняет worker process state |

GitHub-hosted Ubuntu runners; token read-only, Actions не могут approve PR reviews. **Baseline repository and Studio CI must remain secretless**: baseline CI и Studio E2E используют synthetic data/fake integrations, не получают production secrets и не вызывают реальные ElevenLabs/Yandex/Google/R2/production. Эта формулировка сохраняет проверяемый маркер `tests/test_security_policy.py`. Credentialed integration flow требует собственного scope/trust boundary. Внешние Actions pinned full SHA по YAML и regression guard; repository settings пока разрешают `allowed_actions: all`, `sha_pinning_required: false`. Это gap platform enforcement, не разрешение mutable refs. Cache keys/install inputs проверяй по lock/OS/runtime и trust context; cache не переносит secrets и не является release artifact.

Release model: target-side Docker build на VPS, registry promotion не используется. Immutable built image ID сравнивается с running image ID, source связан с exact Git bundle SHA. Это заново построенный artifact, не проверенный CI binary. Отдельные provenance/attestations не настроены; их добавление — по требованиям/риску Goal. Browser report artifact в Studio CI имеет retention 7 дней; после expiry отсутствие report нельзя выдавать за повторную проверку.

Имена credentials, без значений:

- Repository secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` — ordinary component/worker/preflight operations.
- Environment migration secrets: `STUDIO_MIGRATION_DEPLOY_HOST`, `STUDIO_MIGRATION_SSH_KEY`, `STUDIO_MIGRATION_KNOWN_HOSTS`.
- Environment edge secrets: `STUDIO_EDGE_DEPLOY_HOST`, `STUDIO_EDGE_SSH_KEY`, `STUDIO_EDGE_KNOWN_HOSTS`.
- Repository variables: `STUDIO_PLATFORM_CD_ENABLED`, `STUDIO_MIGRATION_RELEASE_ENABLED`, `STUDIO_EDGE_RELEASE_ENABLED` — перед action проверять значение, не только имя.

### 10.4. CD, target identity и recovery

CD используется для Studio; Colab не получает VPS deployment автоматически. Public entrypoint — `studio.librechat.online`; SSH target identity определяется соответствующими secret references и known-hosts, не догадкой по публичному домену. Directory `/opt/elevenlabs-studio`, repository `Just9120/Elevenlabs-API`, branch `main`, Compose project `elevenlabs-studio-platform`, compose `deploy/studio/compose.platform.yml`. Config owner — оператор: target-host `deploy/studio/.env` и отдельные root/operator-owned secret files. Не печатай resolved config и не заменяй `.env` шаблоном.

Deployment units: `studio-web`, `studio-api`, `studio-worker`; отдельно один direct additive Alembic successor и allowlisted host security-header snippet. Обычный component CD не использует GitHub Environment. Migration/edge используют единственный Environment `studio-production-migration`, branch policy main, одного reviewer (Just9120), `prevent_self_review=false`. Admin bypass в свежем scoped ответе не перепроверен; не используй bypass. Dedicated forced-command SSH identities/known-hosts разделяют migration/edge boundaries.

Concurrency: platform `studio-platform-production`, edge `studio-edge-production`, probe `studio-migration-environment-probe`; `cancel-in-progress: false`. Общий remote lock между всеми deployment lanes не подтверждён; найденный `flock` относится только к backup script. Перед пересекающимися operations проверь общий target/state и исключи конфликт; разные concurrency groups сами по себе его не исключают. Standard component workflow передаёт `EXPECTED_COMMIT=${{ github.sha }}` в bundle transport; проверяются 40-hex local HEAD, bundle checksum, exact fetched ref и resulting checkout. Target script получает bundle через `STUDIO_DEPLOY_FETCH_BUNDLE`, checkout обновляется `--ff-only`. Устаревший/расходящийся bundle не должен заменять более новый checkout: identity/fast-forward failure останавливает job. Migration/edge требуют exact current remote main SHA. Очередь не доказывает порядок версий: до dispatch/retry сверяй candidate с actual target/remote; intentional rollback — отдельная procedure. Standalone component entrypoint без bundle имеет иной fetch path и не является active workflow transport.

Stateful surfaces: PostgreSQL persistent volume `studio-postgres-data`, Redis coordination, private external S3/R2 storage, Google Docs side effects вне DB transaction. DB owner — отдельная NOLOGIN role; migrator и API/worker runtime roles/secret files разделены. Класс ordinary component deploy — `NONE`; migration lane — `EXPLICITLY_GATED` (старое имя в runbooks/истории `MANUAL_GATED` означает ту же защищённую процедуру, не автоматизацию). `BACKWARD_COMPATIBLE_AUTOMATED` для production migrations сейчас не используется. Не ослабляй protection только потому, что migration additive.

Recovery по умолчанию — diagnosis и согласованный forward-fix. Автоматического application/data rollback нет; edge допускает только narrow exact snippet-backup restore. При failed identity/schema/health останови продвижение, сохрани Evidence, не делай blind retry. После применения migration сначала проверь реальное schema/API state; повтор run не является стандартным recovery.

Health: web `http://127.0.0.1:8181/healthz`, API `http://127.0.0.1:8182/api/healthz`, worker Docker healthcheck `python -m studio_api.worker_health`; edge — nginx syntax, local/public TLS headers и API health. Web identity — `/build-meta.json` плюс deployment records; API/worker — exact source/image records из job/target. Health подтверждает свой узкий сценарий; product LIVE привязывай к конкретному AC/версии. Safe public read-only smoke выполняй в разрешённом scope; платный/provider/Google canary — только по согласованной процедуре.

### 10.5. Standard Studio component CD

`.github/workflows/studio-platform-cd.yml` — единственный standard component router:

- automatic push flow включается только при `STUDIO_PLATFORM_CD_ENABLED=true`;
- `apps/studio/**` выбирает `studio-web`;
- non-migration `apps/studio-api/**` выбирает `studio-api`;
- Alembic change не deploy-ит API обычным путём: он выбирает protected migration lane только при `STUDIO_MIGRATION_RELEASE_ENABLED=true`, иначе API/migration остаются intentionally skipped/blocked;
- worker dependency changes не auto-deploy-ят worker; `studio-worker` остаётся manual-only;
- green `deployment-summary` с skipped component jobs не является component deployment Evidence.

Target contract:

- deploy directory `/opt/elevenlabs-studio`;
- expected repository `Just9120/Elevenlabs-API`, branch `main`, clean tracked worktree;
- Compose project `elevenlabs-studio-platform` из `deploy/studio/compose.platform.yml` и operator-owned `deploy/studio/.env`;
- web/API bind только localhost ports `8181`/`8182`; worker не публикует port;
- workflow передаёт verified exact-revision Git bundle; deploy script материализуется из ref после checksum/SHA checks и исполняется как файл;
- build/recreate затрагивает только selected service с `--no-deps --force-recreate`;
- PostgreSQL/Redis/volumes/runtime secrets не создаются и не пересоздаются;
- API/worker deploy требует schema equality между current database revision и Alembic head нового image;
- success marker возможен только после built/running image-ID equality и localhost/Docker health.

Standard component CD не выполняет migration, backup/restore, nginx change, provider/Google call, production canary или automatic rollback. Failed health/schema/identity gate завершает job non-zero и требует diagnosis/forward-fix.

### 10.6. Protected additive migration lane

`release-api-migration` — `EXPLICITLY_GATED` stateful release (legacy runbook term: `MANUAL_GATED`), а не standard component CD.

Обязательные boundaries:

- Environment `studio-production-migration`, branch `main`, explicit reviewer approval и repository variable `STUDIO_MIGRATION_RELEASE_ENABLED=true`;
- отдельные Environment secrets `STUDIO_MIGRATION_DEPLOY_HOST`, `STUDIO_MIGRATION_SSH_KEY`, `STUDIO_MIGRATION_KNOWN_HOSTS`;
- dedicated root SSH identity restricted forced command принимает только `release <40-hex-sha> <head-or-revision>`;
- exact selected SHA должен быть current remote `main`, checkout clean/trusted;
- worker остановлен; PostgreSQL, Redis и API healthy; required runtime/backup/OAuth secret files присутствуют без раскрытия values;
- candidate API image и immutable image ID фиксируются до backup/migration;
- один run выбирает ровно одного direct Alembic successor на single linear repository-head chain, declared `additive`;
- каждый successor требует новое approval и новый tagged pre-migration snapshot;
- snapshot определяется относительно pre-run inventory, восстанавливается только в isolated temporary directory и принимается только после non-empty custom dump + `pg_restore --list` в network-disabled/read-only helper container на immutable healthy PostgreSQL image ID;
- migration выполняется один раз; current revision должен равняться reviewed target;
- intermediate target сохраняет running API и повторно проверяет local/public health; только repository-head target recreates API из captured candidate image ID;
- success требует migration wrapper/program markers и applicable local/public health.

Lane не выполняет downgrade, production restore, automatic retry/rollback, worker deploy, provider/Google call, nginx change, volume operation или stateful-service recreation. Multiple/branched/unclassified/destructive migration fail-closed. Если safe output сообщает `migration_applied=yes`, повторный workflow run запрещён до отдельной диагностики schema/API image state и recovery decision.

`Studio Migration Environment Probe` используется для проверки реального Waiting/reviewer history без checkout, credentials, SSH или runtime mutation. Green no-op job без зафиксированного reviewer pause не доказывает protection gate.

### 10.7. Protected Studio edge lane

`Studio Edge CD` — manual-only release exact current `main` SHA, gated repository variable `STUDIO_EDGE_RELEASE_ENABLED=true` и Environment `studio-production-migration`.

- Используются отдельные `STUDIO_EDGE_DEPLOY_HOST`, `STUDIO_EDGE_SSH_KEY`, `STUDIO_EDGE_KNOWN_HOSTS`; migration/component SSH identities не переиспользуются.
- Dedicated root forced command принимает только `release <40-hex-sha>`.
- Единственная mutable target surface — allowlisted root-owned Studio security-header snippet; active site обязан уже include-ить его.
- Перед mutation создаётся timestamped backup; проверяются шесть allowlisted header directives, `nginx -t`, reload, local/public TLS header values и local/public API health.
- Failure после mutation восстанавливает exact backup, повторяет nginx validation и reload; blind rerun запрещён.

Lane не меняет active site routing, repository source, `.env`, Docker/Compose, containers, PostgreSQL, Redis, migrations, volumes, credentials, Google/provider state.

### 10.8. Worker и operational workflows

Worker lifecycle manual-only:

```text
status → drain → confirm stopped → deploy worker → verify image/commit identity → verify healthy → leave idle
```

- Drain использует normal SIGTERM/Docker stop и считается graceful только при single worker container с `exit_code=0`; `137`, `143`, multiple containers и unknown state fail-closed.
- Worker deploy запрещён при active/restarting/abnormally stopped previous worker, не drains автоматически и не запускает canary.
- New worker image получает commit-specific tag; running image ID и schema compatibility проверяются.
- Resume/rollback выполняются только отдельной approved operator procedure из `docs/runbooks/studio-platform-ops.md`; automatic rollback запрещён.
- Worker health подтверждает process shape, configuration и read-only PostgreSQL connectivity, но не queue progress, provider/Google readiness или production-live behavior.

Processing preflight/status не авторизуют provider call или canary. Controlled canary остаётся отдельным operator-approved LIVE gate с exactly one intended job/output и safe evidence boundary.

### 10.9. Первичные records и durable handoff

- Git/PR/review: [repository Pull Requests](https://github.com/Just9120/Elevenlabs-API/pulls); CI/CD: [GitHub Actions](https://github.com/Just9120/Elevenlabs-API/actions) с exact run/job/revision. Environment review history доказывает approval, но не выполнение selected deployment job.
- Разрешённое локальное durable место для фактов вне этих records — `docs/delivery-plan.md`: scenario/command, exact revision/image, target, UTC, результат и ограничения без secrets/raw logs. Это существующий tracked dashboard; после merge локальный checkpoint может оставаться uncommitted до следующего содержательного изменения, его наличие нужно явно сообщить в handoff.
- Чат на другом устройстве не гарантированно видит local worktree. Если локальная запись недоступна следующему исполнителю, зафиксируй metadata gap и нужную передачу checkpoint; не выдавай итоговое сообщение за единственное durable Evidence и не создавай новую внешнюю запись без scope.
- Post-deploy metadata automation не настроена и не обязательна сама по себе. До merge записывай фактические результаты и оставшиеся условия; после merge сверяй первичные records, сохраняй доступный checkpoint и синхронизируй план в следующем содержательном изменении. Отдельный metadata-only commit/PR, direct push в обход protections или прогнозный PASS не нужны.

Профиль не доказывает выполнение проверки/deployment. Текущие результаты, findings и выбранная Goal — только в delivery-plan. Обновляй факты профиля при изменении commands/settings/процесса в разрешённом scope; required gates и границы lane не ослабляй под видом фактической актуализации.

# Работа в репозитории

Этот файл — постоянный router и рабочие правила агента. При старте, восстановлении контекста, смене scope/инструкций и перед существенным этапом сверяйся с ним; проверяй вложенные `AGENTS.md` / `AGENTS.override.md` для затронутого subtree. В этот AGENTS.md и документацию репозитория не добавляй внешние ссылки. Для навигации используй относительные Markdown-ссылки на файлы и при необходимости их разделы, особенно в README.md.

## Источники и контекст

| Документ | Когда и зачем читать |
| --- | --- |
| [README.md](README.md) | Назначение, карта проекта, stack, canonical commands и ссылки на действующие процедуры |
| [docs/project-spec.md](docs/project-spec.md) | Требования, эпики/features, продуктовые и технические AC, ограничения и решения |
| [docs/delivery-plan.md](docs/delivery-plan.md) | Current Goal, задачи, findings, состояния AC, Evidence и checkpoint |
| [docs/architecture.md](docs/architecture.md), [docs/runbooks/](docs/runbooks/) | При затрагивании архитектуры, окружения, поставки, миграций или recovery |
| [docs/ci-cd-rules.md](docs/ci-cd-rules.md) | При настройке CI/CD и исправлении проблем pipeline |
| [docs/delivery-plan-archive.md](docs/delivery-plan-archive.md) | Только для завершённой истории, если архив существует |

При адаптации проверь реальные пути и цели ссылок; не оставляй ссылки на отсутствующие документы и не создавай пустые документы ради таблицы. Commands/settings храни в canonical scripts, README и процедурах. Повседневная работа должна восстанавливаться без внешнего промта. При обычных проверках, merge и routine deploy достаточно действующих процедур; при CI failure сначала изучи logs и отличи ошибку кода от проблемы pipeline.

Сверяй план с файлами, Git/remotes и первичными PR/CI/CD records. Spec хранит согласованные требования, план — работу и checkpoint; запись в документе не создаёт новых полномочий. Явно разрешённый scope восстанавливай по запросу и доверенному контексту; неизвестное блокирует только зависимое действие.

## Требования, findings и готовность

Сохраняй стабильные ID требований/AC и связи изменённых критериев. Spec охватывает весь согласованный проект; текущие статусы не дублируй в нём. В плане сохраняй все findings, включая мусор, дефекты, техдолг, gaps и отложенные проблемы: ID, суть, область/AC, Evidence, влияние/приоритет, действие и обоснование, зависимости, confidence HIGH / MEDIUM / LOW. Действия: FIX / IMPLEMENT / REMOVE / REFACTOR / CONSOLIDATE / DEPRECATE / DOCUMENT / DEFER.

Повторный аудит обновляет существующие findings без дублей, с сохранением ID и решений. Отсутствие finding в новом отчёте не означает устранение; закрытие требует подтверждения исправления либо обоснованного признания finding ошибочным. Подробный отчёт и исследовательские материалы в репозиторий не включай.

AC: BACKLOG — работа не начата; IN_PROGRESS — выполнен не полностью; READY — выполнен в коде, что подтверждают анализ реализации и подходящие автоматические проверки. BLOCKED указывай с причиной. Известный дефект, нарушающий AC, требует пересмотра READY. Ожидание CD не уменьшает готовность кода. Ad-hoc тестирование — по необходимости/запросу; его ожидание не блокирует READY, merge или Goal. Дефекты учитывай как findings.

Готовность = READY AC / все AC текущего scope × 100%. Продуктовые и технические AC равноправны. Для проекта/эпиков используй проверенный `origin/main`; указывай SHA, числитель, denominator и основание. Незамерженные AC показывай в прогрессе PR/Goal отдельно. Не усредняй проценты эпиков. Неизвестный/нулевой denominator — SPEC gap без выдуманного процента.

Каждую оценку считай заново: после аудита, merge каждого PR, изменения выполнения AC или существенного scope/denominator и при закрытии Goal. Прежняя оценка нужна только для сравнения; разницу более 10 процентных пунктов объясни. Нарушение существующего AC не меняет denominator. Пропущенное требование согласованного источника восстанови с объяснением; новое улучшение включай в требования только после согласования. Finding не становится AC автоматически.

Evidence: тип/результат, источник или команда/сценарий, revision/artifact, environment, время и ограничения; для dirty state — соответствующий diff/worktree. Результаты: PASS / PARTIAL / FAIL / PENDING / N/A с основанием. Сохраняй ссылки/ID первичных records, не raw logs. Config подтверждает настройки, tests — проверенные условия; вывод о работающем окружении требует его Evidence. Старый PASS применяй только после проверки соответствия требованиям и версии.

## Goal и проверки

Пользователь выбирает Goal. До реализации зафиксируй в плане результат, scope/AC или критерии закрытия findings, non-goals, зависимости, DoD, Validation Plan и доступное основание поручения. Явно порученную Goal активируй встроенным инструментом, если он доступен; при продолжении используй существующую. Соблюдай lifecycle инструмента; недоступность сообщи без имитации активации.

Работай автономно до DoD. Разбивай Goal на последовательные PR по связности, зависимостям, риску и проверяемости. Каждый PR оставляет main в допустимом состоянии; незавершённой функциональности нужен безопасный способ интеграции. Расширение scope, изменение требований/политики, ослабление gates и неразрешённые privileged/destructive operations выноси пользователю. Обычные исправимые failures и conflicts устраняй в той же Goal.

Validation Plan: AC/риск, проверка/ожидаемый результат, canonical команда/tool и рабочий каталог, environment, этап, REQUIRED / RECOMMENDED / N/A с основанием. Заранее отдели локальные проверки от remote-only. REQUIRED failure или недоступная обязательная проверка оставляет этап незавершённым; отсутствие доступа не является N/A.

Покрывай критичные бизнес-сценарии, ошибки, права доступа, целостность данных и регрессии подходящими unit/integration/E2E tests. Coverage помогает искать gaps, но не доказывает AC. Не задавай универсальный coverage target и не добавляй tests, повторяющие implementation. После дефекта добавляй содержательный regression test, когда применимо. Учитывай зависимости affected tests; при неясном impact расширяй набор. Не ослабляй assertions/gates ради green CI.

## Ветка, commits и PR

Перед изменениями для каждого PR, включая docs PR аудита, проверь фактические Git/GitHub, remotes, divergence, worktrees и protections. Получи свежий `origin/main`; обнови локальный main безопасным fast-forward с сохранением unrelated/unknown user changes. Если это невозможно, сохрани его состояние и создай чистую ветку/worktree от проверенного `origin/main`. Работай в отдельной ветке на каждый PR, зафиксируй base SHA. Для иной default branch используй фактическое имя проекта.

Для нового repository без исходного commit сначала выполни разрешённый bootstrap, затем создай рабочую ветку с base SHA. Без remote возможна разрешённая локальная подготовка; создание remote и публикация должны входить в scope.

После каждой завершённой узкой задачи выполни необходимые проверки и создай commit. До завершения scope конкретного PR и полной применимой local validation работай локально. Затем выполни self-review, актуализируй документацию/план, сделай initial push и создай PR с результатом, AC, проверками и ограничениями. Завершения всей Goal перед первым PR ждать не нужно.

Подтверждённые CI/review failures собирай в batch, исправляй и проверяй локально; отправляй один сгруппированный push на каждый цикл. Число необходимых циклов не ограничено. Необходимое обновление base допускается с сохранением user changes и повторной validation. Speculative pushes не допускаются. Hotfix может иметь сокращённый flow, но сохраняет обязательные safety/CI/deployment gates.

После каждого push дождись required checks/review актуальной revision из предусмотренных источников. Разбери failures, cancellations и skips: skip допустим только при подтверждённой неприменимости. Self-review не заменяет required approval. При выполненных gates и необходимых правах самостоятельно доведи PR до merge, соблюдая protections.

Разрешённый аудит завершай одним отдельным docs PR с актуализированными spec/plan, по тому же Git/validation flow. После merge покажи готовность, findings и эпики/AC для выбора следующей Goal. Read-only аудит ограничивается отчётом.

## Поставка и очистка

После каждого merge подтверди его в GitHub, получи свежий `origin/main` и безопасно синхронизируй локальный main по правилу выше, проверив результат интеграции. Затем дождись applicable delivery flow: для runtime изменений — CD на целевой VPS с expected merge revision/artifact, обязательными environment gates, проверкой запущенной версии, health/readiness и прикладными smoke checks. Для изменений без deployment CD неприменим по scope PR/DoD.

Исполняй проверенную проектную процедуру: установи точный target, artifact/config, preconditions и отсутствие конфликтующей поставки. Сохраняй secrets и persistent state. Не обходи approvals, host verification и recovery gates; неизвестный target блокирует действие. При failed post-check останови дальнейшее продвижение и примени согласованную recovery strategy; содержательный hotfix в scope остаётся частью Goal.

Результат CD устанавливай по первичным records с environment, revision/artifact, временем и итогами обязательных checks. Наличие workflow или ответ endpoint без идентификации версии недостаточны. Отдельные статусы DEPLOY/LIVE и обязательная post-merge запись delivery metadata в main не нужны. Metadata-only follow-up PR не создавай. Недоступный/неуспешный CD остаётся неподтверждённой/незавершённой поставкой.

Длительный monitoring/observation и speculative reruns на GitHub-hosted Actions требуют отдельного owner approval и проверки остатка included minutes. Неизвестный остаток сообщи. Ограниченные обязательные post-checks входят в поставку.

После applicable delivery удали созданные для PR локальную/remote ветки и ненужный worktree только после safe deletion: принадлежность этой работе, подтверждённый merge, отсутствие неинтегрированных изменений, нужных локальных файлов и зависимостей активных задач. Учитывай squash/rebase по фактическому результату PR. Уже автоматически удалённую GitHub ветку не восстанавливай; CD не должен зависеть от её существования.

Следующий PR той же Goal начинай после завершения поставки предыдущего, повторной проверки актуальности main и безопасной синхронизации. Создай новую ветку от актуальной base. При закрытии Goal повтори синхронизацию и проверку оставшихся её веток/worktrees; сохрани чужие и созданные до работы, объясни причины сохранения своих.

## Checkpoint и завершение

Обновляй план в содержательных commits и перед прерыванием: Goal, baseline, branch/base SHA/worktree, выполненное/оставшееся, следующий шаг, известные PR/records, проверки и blockers. До последнего push сохрани условия оставшихся gates, не предсказывая их успех. Достаточно текущего и предыдущего snapshot готовности; не создавай commits ради самообновляющихся SHA/процентов.

При восстановлении установи связанные PR, merge revision и соответствующие CD records нужного окружения; недостающие ID найди по фактическому Git/GitHub. Не повторяй deploy ради статуса. План может отражать checkpoint до merge; окончательный результат поставки восстанавливается по первичным records независимо от сессии, без обязательного переписывания Markdown.

DONE требует выполненных scope/DoD, обязательных checks/review, merge и applicable delivery всех PR. Исправимый failure не завершает Goal; при внешнем blocker сохрани причину и нужное действие, продолжая независимую работу. Заверши встроенную Goal по её правилам, сообщи результат, готовность, Evidence, PR/поставку и ограничения. Остановись: следующую Goal выбирает пользователь.


## Особенности Elevenlabs-API

- Repository `Just9120/Elevenlabs-API`: ожидаемая default/release branch `main`, рабочие ветки `codex/`. Перед consequential operation проверяй фактические remote/base и target. Существующий canonical путь правил настройки CI/CD — `docs/ci-cd-rules.md`; второй файл в корне не создаётся.
- Два продукта: Colab entrypoints в корне и VoiceOps Studio. `apps/studio` — React/TypeScript/Vite PWA; `apps/studio-api` — Python/FastAPI API, worker, Alembic и provider adapters; `deploy/studio` и `scripts` — Compose/operations. Runtime/credential/state boundaries различаются; personal implementation не доказывает commercial readiness. Generated protobuf и notebooks не считать dead/duplicate code без проверки callers.
- Обычные команды, тестовые окружения, required checks и revision model: [validation runbook](docs/runbooks/validation.md). Targets, config owners, credentials boundaries, GitHub Environment, очередь, rollout и recovery: [Studio operations](docs/runbooks/studio-platform-ops.md). Инварианты обработки: [processing contract](docs/studio-processing-contract.md); отдельный Colab capture: [Realtime Colab](docs/runbooks/realtime-colab.md). Optional AI tooling documents не создавать без соответствующего workstream.
- Windows `pytest -q --portable` сохраняет часть shell-dependent tests и не заменяет Linux CI. Обычные проверки используют synthetic configuration/data; production `.env`, реальные provider/Google calls и пользовательские данные не использовать как тестовые fixtures.
- Spec и план имеют индексы: [project-spec](docs/project-spec.md), [delivery-plan](docs/delivery-plan.md). Формулировки разделены по `docs/spec/{colab,studio,extensions,commercial}.md`, текущие AC — по соответствующим `docs/delivery/*.md`, трассировка — [source trace](docs/spec/source-trace.md). ALIAS/SUPERSEDED сохраняют ID и связи, но не входят в denominator. Технические AC учитываются наравне с продуктовыми; findings сами по себе denominator не увеличивают.
- Ad-hoc/dogfooding сохраняется: владелец сообщает встреченные баги, доступные проверки выполняет агент. READY устанавливается по исполняемому коду и подходящим автоматическим проверкам; отсутствие полного runtime сценария отражается в ограничениях Evidence. Last verified revision — фактически проверенный commit; raw logs и secrets в checkpoint не помещать.

### Версия инструкций

Владелец явно поручил внедрить новые версии 2026-09-07. Источник — приложенный комплект `workflow-documents/repository`, без изменения глобального AGENTS. Адаптация сохраняет существующие canonical пути и переносит operational сведения прежнего Project profile в действующие runbooks. Внешний входной промт в repository не копируется.

SHA-256 приложений: `AGENTS.md` — `e939a859e699f84d14635c05d5c168c39874370220c100b5bfaaf9a002f5eb79`; `ci-cd-rules.md` — `a5ada63507c17d77f9691e3c67c83e423d8dc04a4732e4fefe925c96161b7f2e`.

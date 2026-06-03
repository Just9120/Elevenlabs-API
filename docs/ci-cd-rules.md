# CI/CD Rules — универсальные правила для проектов

## 1. Назначение

Документ задаёт единые правила для подготовки CI и CD в проектах.

Документ также фиксирует границу между initial server bootstrap, Deploy Keys, стандартным CD и отдельными maintenance/migration задачами для stateful services.

Он используется как базовый стандарт, по которому ChatGPT для каждого конкретного проекта должен подготовить:

- проверки и настройки GitHub;
- команды для VPS, если нужен CD;
- промт для Codex;
- post-check;
- риски;
- rollback-план.

Документ задаёт контур, границы и обязательные правила. Детали реализации уточняются отдельно для каждого проекта.

---

## 2. Общий принцип

CI подключается сразу при заведении или первичной настройке проекта.

CD подключается позже — когда проект готов к первому deploy или smoke test на VPS.

CI отвечает за проверку качества и собираемости проекта.

CD отвечает за безопасную доставку рабочей версии на VPS.

CI не должен выполнять deploy.

CD не должен делать cleanup, hardening, переносы, destructive-действия и изменения за пределами целевого сервиса.

Initial server bootstrap может использовать repository Deploy Key для доступа VPS к GitHub repository. После первичной настройки стандартный CD должен работать по правилам этого документа.

Deploy Key и `DEPLOY_*` Repository Secrets не являются одним и тем же:

```text
Deploy Key = доступ VPS → GitHub repository
DEPLOY_* Repository Secrets = доступ GitHub Actions → VPS
```

---

## 3. CI standard

Базовый CI-flow:

```text
pull_request / push в main
→ GitHub Actions
→ install dependencies
→ lint / typecheck / tests / build
→ CI_OK
```

CI workflow должен:

- запускаться на `pull_request`;
- запускаться на `push` в `main`;
- иметь `workflow_dispatch`;
- использовать минимальные `permissions`;
- иметь `concurrency` guard;
- использовать lockfile, если он есть;
- использовать существующие команды проекта;
- не использовать production secrets;
- не подключаться к production VPS;
- не выполнять deploy;
- завершаться `CI_OK` при успехе.

Если в проекте нет тестов, CI всё равно должен выполнять минимально доступные проверки: install, lint, typecheck, build или их эквиваленты.

Codex не должен внедрять тяжёлую инфраструктуру тестирования без отдельной задачи.

---

## 4. CD standard

Базовый CD-flow:

```text
push/merge в main
→ GitHub Actions
→ проверки/тесты
→ SSH на VPS
→ переход в APP_DIR
→ получение актуального кода из GitHub
→ safe .env.example → .env sync
→ check unresolved runtime secrets
→ build/up целевого Docker Compose service
→ post-check
→ DEPLOY_OK or safe failure
```

CD workflow должен:

- запускаться на `push/merge` в `main`;
- иметь `workflow_dispatch`;
- использовать минимальные `permissions`;
- иметь `concurrency` guard;
- проверять наличие `DEPLOY_*` secrets;
- подключаться к VPS по SSH;
- проверять `APP_DIR` и наличие git repo;
- проверять `origin remote`;
- получать код из GitHub по SSH;
- отказываться от deploy при tracked local changes;
- обновлять код безопасным fast-forward способом;
- выполнять safe env sync до docker build/up;
- проверять runtime `.env` на unresolved `__REQUIRED_SECRET__` после safe env sync и до build/up;
- деплоить только `COMPOSE_SERVICE`;
- выполнять post-check;
- не завершаться `DEPLOY_OK`, если post-check не пройден;
- завершаться `DEPLOY_OK` только при успехе.

---

Post-check / rollback policy:

- если post-check не пройден, CD не должен помечать deploy как `DEPLOY_OK`;
- workflow может выполнить автоматический rollback только если в проекте явно реализована и задокументирована безопасная rollback strategy;
- если безопасный rollback не реализован, CD должен fail loudly и сообщить о failed post-check без blind cleanup, destructive commands или изменений stateful services;
- rollback не должен нарушать запреты на `docker compose down`, `git reset --hard`, prune, удаление volumes, cleanup или изменение stateful services.

## 5. Входные данные по проекту

Для подготовки CI/CD по конкретному проекту должны быть определены:

- GitHub repository;
- production branch;
- стек проекта;
- package manager;
- доступные install/lint/typecheck/test/build команды;
- наличие lockfile;
- наличие `.env.example`;
- наличие существующих GitHub Actions workflow.

Для CD дополнительно:

- `APP_DIR` на VPS;
- `EXPECTED_REMOTE`;
- `EXPECTED_BRANCH`;
- `COMPOSE_SERVICE`;
- compose-файл, если он нестандартный;
- наличие `.env` на VPS;
- health endpoint или fallback post-check;
- текущая модель доступа VPS → GitHub;
- используется ли repository Deploy Key для доступа VPS к GitHub;
- текущие GitHub Repository Secrets;
- наличие stateful services: database, Redis, queues, vector DB, object/file storage, volumes;
- есть ли миграции, backup/restore или reindex expectations.

Если часть данных неизвестна, ChatGPT должен дать команды для безопасной проверки, а не придумывать значения.

---

## 6. GitHub rules

Для CI:

- production secrets не использовать;
- deploy не выполнять;
- workflow должен быть безопасным для `pull_request`.

Для CD используются Repository Secrets:

- `DEPLOY_HOST`;
- `DEPLOY_USER`;
- `DEPLOY_SSH_KEY`;
- `DEPLOY_KNOWN_HOSTS`.

Секреты не должны попадать в код, логи или промты для Codex как значения.

---

## 7. VPS/CD rules

VPS получает код из GitHub по SSH.

Требования:

- remote должен быть SSH;
- HTTPS/PAT для CD не использовать;
- `APP_DIR` не менять;
- текущие пути проектов на VPS сохранять;
- `.env` остаётся на VPS;
- `.env.example` считается схемой runtime-переменных;
- существующие значения `.env` не менять;
- значения `.env` не печатать;
- новые secret-like переменные добавлять в `.env.example` как `__REQUIRED_SECRET__`;
- после safe `.env.example` → `.env` sync CD обязан проверить runtime `.env` на unresolved `__REQUIRED_SECRET__`;
- если в runtime `.env` остался `__REQUIRED_SECRET__`, deploy блокируется до `docker build`, `docker compose up` или restart текущего сервиса;
- проверка не должна печатать значения `.env` в логи;
- при unresolved secret workflow должен вывести generic error, например `Missing required runtime secrets`, и завершиться с non-zero exit code.

Docker Compose policy:

- build только `COMPOSE_SERVICE`;
- up/recreate только `COMPOSE_SERVICE`;
- dependency/stateful services не пересоздавать;
- базы данных, Redis, vector DB, queues и volumes не трогать.

Stateful services policy:

- базы данных, vector DB, Redis, queues, object/file storage и Docker volumes считаются stateful services;
- стандартный CD не должен пересоздавать, очищать, переносить или переинициализировать stateful services;
- migration, backup, restore, vector reindex, volume migration и stateful service maintenance не входят в стандартный CD;
- любые изменения stateful services выполняются только отдельной delivery / maintenance задачей с явным scope, rollback-планом и validation;
- если deploy требует миграции БД или reindex, стандартный CD должен быть расширен только в рамках отдельного согласованного item, а не по умолчанию.

---

## 8. Запрещённые действия

В стандартном CI запрещены:

- SSH на production VPS;
- deploy-команды;
- использование production `.env`;
- изменение production database;
- изменение инфраструктуры;
- auto-fix с commit/push в `main`.

В стандартном CD запрещены:

- `docker compose down`;
- `docker system prune -a`;
- `docker volume prune`;
- `docker image prune -a`;
- `git reset --hard`;
- `git clean -fdx`;
- `rm -rf`;
- `chmod -R`;
- `chown -R`;
- `docker compose config`;
- `cat .env`;
- cleanup;
- hardening;
- перенос директорий;
- изменение volumes/stateful services;
- destructive database migrations;
- database backup/restore;
- vector DB reindex;
- volume migration.

Любые destructive/maintenance-действия выполняются только отдельными задачами.

---

## 9. Что должен подготовить ChatGPT по каждому проекту

После анализа конкретного проекта ChatGPT должен выдать:

1. Что проверить/создать в GitHub.
2. Что проверить на VPS.
3. Команды для безопасной диагностики.
4. Промт для Codex.
5. Ожидаемые CI/CD workflow changes.
6. Команды post-check.
7. Риски и ограничения.
8. Rollback-план.

ChatGPT не должен придумывать неизвестные значения. Если данных не хватает, он должен дать команды для проверки.

---

## 10. Что должен сделать Codex

Для CI Codex должен:

- создать или обновить CI workflow;
- использовать существующие команды проекта;
- не добавлять production secrets;
- не добавлять deploy;
- не менять архитектуру проекта;
- обеспечить `CI_OK`.

Для CD Codex должен:

- создать или обновить CD workflow;
- явно задать `APP_DIR / EXPECTED_REMOTE / EXPECTED_BRANCH / COMPOSE_SERVICE`;
- добавить safe env sync, если его нет;
- встроить env sync до docker build/up;
- убрать опасные команды;
- сохранить текущие VPS paths;
- не добавлять secrets в код;
- не трогать volumes;
- не выполнять migrations, backup/restore, vector reindex или volume maintenance без отдельной задачи;
- не делать cleanup/hardening;
- обеспечить `DEPLOY_OK`.

---

## 11. Definition of Done

CI считается готовым, если:

- workflow запускается на `pull_request`;
- workflow запускается на `push` в `main`;
- доступен `workflow_dispatch`;
- есть минимальные `permissions`;
- есть `concurrency` guard;
- зависимости устанавливаются воспроизводимо;
- выполняются доступные проверки проекта;
- deploy не выполняется;
- production secrets не используются;
- успешный workflow завершается `CI_OK`.

CD считается готовым, если:

- push/merge в `main` запускает deploy на VPS;
- `workflow_dispatch` доступен;
- GitHub Actions подключается к VPS через `DEPLOY_*` secrets;
- VPS получает код из GitHub по SSH;
- `APP_DIR / EXPECTED_REMOTE / EXPECTED_BRANCH / COMPOSE_SERVICE` явно заданы;
- `.env.example` безопасно синхронизируется в `.env`;
- существующие значения `.env` не перезаписываются;
- deploy блокируется при новых незаполненных секретах;
- деплоится только `COMPOSE_SERVICE`;
- stateful services и volumes не трогаются;
- Deploy Key, если используется для VPS → GitHub, не смешивается с `DEPLOY_*` secrets для GitHub Actions → VPS;
- migrations, backup/restore, vector reindex и volume maintenance не выполняются как часть стандартного CD;
- destructive-команды отсутствуют;
- есть post-check;
- runtime `.env` проверяется на unresolved `__REQUIRED_SECRET__` после safe env sync и до build/up;
- failed post-check не может завершиться `DEPLOY_OK`;
- automatic rollback выполняется только при явно описанной safe rollback strategy;
- успешный workflow завершается `DEPLOY_OK`.

---

## 12. За рамками задачи

Отдельными задачами выполняются:

- увеличение test coverage;
- внедрение новых линтеров;
- e2e-тесты;
- security scanning;
- dependency audit policy;
- preview environments;
- SSH hardening;
- переход с root на deploy-user;
- per-repo read-only GitHub Deploy Keys;
- firewall/sshd hardening;
- перенос директорий проектов;
- cleanup старых файлов/snapshots/audits;
- реорганизация volumes/stateful services;
- database migrations;
- backup / restore procedures;
- vector index rebuild / reindex;
- volume migration;
- stateful service maintenance;

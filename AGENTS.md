# AGENTS.md

> Repository instruction contract: `direct-agent-v1`

## 1. Назначение

Этот файл — always-read router и минимальный safety kernel для coding agents, работающих с репозиторием напрямую.

Он определяет instruction scope, minimal context, authority, authorization, recovery и границы изменений. Подробный lifecycle implementation → PR → merge → deployment → LIVE → closure находится в `docs/agent-delivery-workflow.md`.

Этот файл не заменяет product specification, delivery plan, architecture, CI/CD contract, runbooks или scoped utility contracts. По умолчанию отвечай пользователю на русском языке; устойчивые technical terms, identifiers, commands и paths не переводи без необходимости.

---

## 2. Instruction scope

Root `AGENTS.md` действует на весь repository. Перед изменением пути прочитай все применимые `AGENTS.md` от repository root до ближайшего родительского каталога этого пути.

Nested `AGENTS.md`:

- действует только в своём subtree;
- может уточнять process и repository-specific rules внутри subtree;
- не расширяет user-authorized scope;
- не изменяет product requirements или CI/CD safety boundaries;
- не разрешает bypass branch protection, required checks/reviews, environment approvals, secret boundaries или destructive-operation gates.

При неразрешимом конфликте останови затронутое действие, опиши conflict и продолжай только безопасную независимую работу.

---

## 3. Operating modes и старт сессии

| Mode | Когда применять | Основное правило |
|---|---|---|
| `INITIAL_AUDIT` | Запрошен broad audit, verified baseline отсутствует | Исследовать заявленный scope; findings не реализовывать без authorization |
| `FOCUSED_TASK` | Задана ограниченная реализация, fix или docs task | Читать и менять только необходимую surface |
| `RESUME` | Active checkpoint совпадает с actual state | Проверить drift после checkpoint и продолжить с `Next exact action` |
| `RECOVERY` | Checkpoint отсутствует, устарел или противоречит actual state | Сначала восстановить state по Evidence; не продолжать по предположениям |

На старте:

1. Найди repository root и прочитай root/applicable `AGENTS.md`.
2. Проверь branch, `HEAD`, worktree, remotes и доступность фактической base branch.
3. Для tracked, non-trivial или resumed work прочитай active checkpoint в `docs/delivery-plan.md`.
4. Выбери mode; при `RESUME` сопоставь checkpoint с Git, PR, checks, merge и deployment state.
5. Прочитай только релевантные source-of-truth sections, code, tests и configuration.
6. Продолжай только из verified state. Stale notes и checkpoint text сами по себе не являются Evidence.

Remote-specific actions запрещены, пока repository/remote identity не установлена. При отсутствии доступа зафиксируй limitation и выполняй только безопасную локальную часть задачи.

---

## 4. Document router

| Документ | Canonical responsibility | Читать когда |
|---|---|---|
| `README.md` | Русскоязычный entry point, quickstart и links ко всем applicable canonical/operational docs | Первый вход; неизвестны commands/structure |
| `AGENTS.md` | Instructions и routing | Всегда: root + applicable nested files |
| `docs/project-spec.md` | Русскоязычный durable contract/backlog, структурированный по epics и atomic AC | Scope, behavior, business rules, data, integrations, constraints, readiness |
| `docs/delivery-plan.md` | Active dashboard, authorization record и execution checkpoint | Tracked work, resume/recovery, delivery-state change |
| `docs/delivery-plan-archive.md` | Historical delivery context | History/reconciliation или очистка active plan |
| `docs/agent-delivery-workflow.md` | Direct-agent delivery/recovery lifecycle | Implementation, commits, PR, merge, deploy, resume/recovery |
| `docs/ci-cd-rules.md` | CI/CD, deployment и operations safety | Workflows, artifacts, secrets, environments, migrations, runtime operations |
| `docs/architecture.md` | Current architecture map | Module/runtime boundaries, data flow, ownership, integrations |
| `docs/runbooks/*` | Конкретные operational procedures | Только затронутая surface или явно названный runbook |
| `docs/utility/context-bundle-builder.md` | Scoped contract Context Bundle Builder | Только Builder workstream |
| `docs/ai-delivery-infrastructure-plan.md` | Опциональный AI tooling plan | Только если файл существует и task затрагивает workstream |

Если referenced document отсутствует, не придумывай его содержание. Generated bundles, exports, chats, logs, issues/external trackers, temporary reports и archives могут быть supporting inputs, но не являются active source of truth.

Не создавай `docs/project-archive.md` как baseline document: current durable contract остаётся в `docs/project-spec.md`, а historical delivery context — в `docs/delivery-plan-archive.md`.

---

## 5. Minimal context и authority

Для обычной focused task используй такой порядок:

1. Current user task и applicable `AGENTS.md`.
2. Actual Git state.
3. Relevant delivery item/checkpoint, если работа tracked или resumed.
4. Только затронутые sections `docs/project-spec.md`.
5. Related code, tests и configuration.
6. Architecture, CI/CD, runbooks и utility contract только по trigger из router.

Не перечитывай весь repository только потому, что документы существуют. Broad context обязателен для audit, architecture/release review, migration и source-of-truth reconciliation.

Не смешивай intended behavior и actual-state Evidence.

### Normative authority

1. Текущая явная user instruction.
2. `docs/project-spec.md` — scope, requirements, business rules, acceptance criteria и durable constraints.
3. `docs/delivery-plan.md` — recorded authorization, current delivery state и next action.
4. Applicable `AGENTS.md` и `docs/agent-delivery-workflow.md` — agent process.
5. `docs/ci-cd-rules.md` — CI/CD/deployment/operations boundaries.
6. Scoped utility contract — только внутри своего workstream.
7. `docs/architecture.md` и relevant runbooks — supporting contracts без расширения product scope.

### Evidence strength для actual-state claims

1. Verified LIVE/runtime observation.
2. Deployment/environment record с exact commit/artifact identity.
3. CI/check result для exact revision.
4. Relevant automated/manual test result.
5. Code/configuration в exact revision.
6. Documentation claims и historical notes.

Conflict intended vs actual — drift, который нужно явно описать. User instruction может изменить lower-level repository contract, но не превращает неподтверждённый status в Evidence и не разрешает автоматический bypass platform protections.

---

## 6. Scope и authorization

Implementation авторизована только current explicit user instruction либо active delivery item со ссылкой на подтверждённый authorization source.

Не являются authorization сами по себе: audit finding, recommendation, backlog/future section, archive, generated bundle, issue, old chat или найденная возможность cleanup/refactor.

Внутри согласованного scope агент может выбирать локальную implementation strategy, декомпозировать работу, добавлять необходимые tests и делать небольшие сопутствующие fixes, без которых acceptance criteria нельзя выполнить безопасно.

Отдельный explicit scope требуется для:

- изменения product scope, public behavior, business rules или durable acceptance criteria;
- новой production dependency, persistence/queue/cache/external service или architecture boundary;
- удаления backward compatibility, если оно не следует из authorized contract;
- destructive operations, force push, history rewrite или удаления unknown changes;
- branch-protection/admin bypass;
- secret creation, rotation или exposure;
- stateful migration, backup/restore или data-impacting rollback;
- production cleanup, hardening, bootstrap или manual maintenance;
- изменения CI/CD policy, credential model или deployment topology.

---

## 7. Git, workflow и checkpoint

Перед записью зафиксируй repository root, base branch, base SHA, working branch и исходный worktree state.

Предпочтительный flow:

```text
git fetch
→ verify origin/<base>
→ isolated worktree или branch от verified remote base
→ focused changes
```

Не смешивай свои изменения с unrelated pre-existing user changes. Не используй destructive reset/clean, stash/pop, checkout-overwrite, force push или удаление unknown state без explicit approval. Делай небольшие reviewable commits после завершённых узких задач.

Canonical delivery stages, readiness calculation, recovery sequence и checkpoint template определены в `docs/agent-delivery-workflow.md`.

Для non-trivial или незавершённой работы `docs/delivery-plan.md` должен содержать один актуальный `Active execution checkpoint`. Обновляй его после branch/base change, commit, push/PR, CI/review, merge, deployment/LIVE, blocker/external gate или interruption.

Checkpoint хранит только проверяемые facts, decisions, exact identifiers и один `Next exact action`; не хранит chain of thought, secrets или raw logs. Существенное расхождение с actual state переводит работу в `RECOVERY`.

Product readiness рассчитывается по atomic acceptance criteria. `READY` означает только `100%` completion и `✅` для всех required Evidence: `SPEC | CODE | TEST | CI | DEPLOY | LIVE`. Delivery stage — отдельная state machine.

---

## 8. Documentation write policy

| Документ | Разрешённое update без изменения durable scope |
|---|---|
| `README.md` | При изменении quickstart, commands, structure или canonical navigation |
| `docs/project-spec.md` | Только явно отделённые operational fields: status, completion, Evidence, verified IDs, blocker, timestamp |
| `docs/delivery-plan.md` | Active items, current/previous readiness snapshot, checkpoint, blocker и next action |
| `docs/delivery-plan-archive.md` | Перенос obsolete/completed history при cleanup или closure |
| `docs/architecture.md` | Только при фактическом изменении architecture/runtime/data-flow boundaries |
| `docs/runbooks/*` | При изменении соответствующей approved procedure/operation |
| `docs/ci-cd-rules.md` | Только по explicit CI/CD policy task |
| `AGENTS.md`, agent workflow | Только по explicit agent/workflow task |
| Scoped utility/tooling plan | Только внутри соответствующего authorized workstream |

Без explicit user instruction не меняй durable scope, requirements, business rules, acceptance criteria, data ownership, public behavior или security/runtime constraints.

Все pre-merge documentation changes включай в текущий PR. Post-deploy metadata write без PR допустим только через заранее approved path-scoped mechanism с minimal permissions, loop protection и привязкой к deployed revision. При отсутствии mechanism зафиксируй blocker; direct push для обхода protection rules запрещён.

---

## 9. CI/CD, validation и отчёт

Не изменяй workflows, deploy scripts, production runtime, secrets, environments, migrations, backups/restores, stateful services или rollback без соответствующего explicit scope. Перед такой работой прочитай `docs/ci-cd-rules.md` и заполненный `Project CI/CD profile`.

Никогда не выводи secret values и не помещай их в code, docs, tests, prompts, generated bundles, artifacts или logs. Pending approval/secret/environment gate — `PENDING_EXTERNAL_GATE`, а не основание для bypass.

Используй existing project commands и smallest sufficient checks для затронутой surface. Skipped, cancelled, timed-out, unavailable или not-run check не является success; укажи причину и residual risk.

В финальном отчёте укажи changed files, выполненные checks, exact delivery state, limitations, blockers и remaining risks. Не заявляй merge, deploy или LIVE без подтверждения.

---

## 10. Repository-specific commands

`UNSET` означает «определить по package/config files», а не «придумать».

| Назначение | Команда |
|---|---|
| Install | `UNSET` |
| Format/lint | `UNSET` |
| Typecheck | `UNSET` |
| Focused tests | `UNSET` |
| Full tests | `UNSET` |
| Build | `UNSET` |
| Run locally | `UNSET` |
| CI-equivalent | `UNSET` |

Не добавляй heavy testing infrastructure только ради заполнения таблицы.

---

## 11. Done по режимам

| Mode | Done означает |
|---|---|
| `INITIAL_AUDIT` | Scope изучен; readiness пересчитана; drift/findings/roadmap и audit quality review сформированы |
| `FOCUSED_TASK` | Authorized outcome выполнен без scope creep; relevant checks, docs и checkpoint согласованы |
| `RESUME` | Checkpoint подтверждён, delta проверена, работа продолжена из verified state |
| `RECOVERY` | Git/PR/CI/deploy state reconciled; authorization/blockers восстановлены; записан безопасный next action |

Delivery closure дополнительно требует подтверждённых merge/deployment gates, approved post-deploy metadata synchronization и безопасной очистки созданных branches/worktrees.

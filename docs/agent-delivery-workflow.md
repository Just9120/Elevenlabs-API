# Agent Delivery Workflow

## 1. Назначение

Этот документ определяет repository-local lifecycle прямой работы coding agent: verified baseline → authorization → implementation → Pull Request → merge → deployment → LIVE verification → recovery/closure.

Он применяется к non-trivial implementation/delivery tasks и к продолжению работы после нового чата или context compaction.

Authority и document routing определены в `AGENTS.md`; CI/CD и production safety — в `docs/ci-cd-rules.md`. Этот workflow не меняет product scope и не является implementation authorization сам по себе.

---

## 2. Core principles

1. **Verified state before action.** Branch, SHA, worktree, PR, checks и deployment state проверяются, а не принимаются из старого текста.
2. **Scope before implementation.** У работы есть authorization source, bounded scope, non-goals и atomic acceptance criteria.
3. **Repository-native continuity.** Новый чат продолжает работу по Git/GitHub state и одному active checkpoint без старого transcript.
4. **Small reviewable increments.** Каждая законченная узкая задача получает relevant validation, docs update и commit.
5. **Evidence before claims.** `TEST`, `CI`, `DEPLOY`, `LIVE`, merge и closure заявляются только по проверяемым результатам.
6. **No hidden bypass.** Required checks/reviews, environment approvals, branch protection, secrets и stateful-operation gates не обходятся.
7. **One active truth.** `docs/delivery-plan.md` хранит current state; obsolete history переносится в archive.

---

## 3. State model

Не смешивай product completion, delivery lifecycle, Evidence и blockers.

### 3.1. Product/epic status

```text
⬜ BACKLOG
🟦 IN PROGRESS
🟩 READY
```

`⛔ BLOCKED` — modifier к текущему status.

- `BACKLOG` — epic определён, implementation не начата или не авторизована.
- `IN PROGRESS` — implementation авторизована и начата, Definition of Done ещё не выполнен.
- `READY` — 100% atomic acceptance criteria выполнены и все required Evidence имеют `✅`.

`READY` не означает «можно начать», «PR можно merge» или «CI прошёл».

### 3.2. Evidence

```text
SPEC | CODE | TEST | CI | DEPLOY | LIVE
✅ confirmed | ◐ partial | ❌ failed | — absent | N/A not required
```

| Evidence | Подтверждает |
|---|---|
| `SPEC` | Requirement и atomic acceptance criteria определены без критической неоднозначности |
| `CODE` | Implementation присутствует в exact revision и соответствует scope |
| `TEST` | Relevant automated/manual checks подтверждают behavior |
| `CI` | Required checks для exact revision завершились успешно |
| `DEPLOY` | Exact commit/artifact доставлен в target environment |
| `LIVE` | Required runtime behavior или health подтверждены в target environment |

Каждый status должен ссылаться на path/section, commit SHA, command/result, CI run, deployment ID, environment или health-check result.

### 3.3. Delivery stage

```text
PLANNED
AUTHORIZED
IMPLEMENTING
VALIDATING
PR_OPEN
CHECKS_PASSED
MERGE_GATES_PASSED
MERGED
DEPLOYING
DEPLOYED
LIVE_VERIFIED
CLOSED
```

| Stage | Условие перехода |
|---|---|
| `PLANNED` | Scope сформулирован, authorization не подтверждена |
| `AUTHORIZED` | Зафиксированы authorization source, scope, non-goals и baseline intent |
| `IMPLEMENTING` | Создана working branch/worktree и начаты изменения |
| `VALIDATING` | Implementation slice завершён, выполняются checks |
| `PR_OPEN` | Branch опубликована и PR создан/обновлён |
| `CHECKS_PASSED` | Required checks exact PR head завершились успешно |
| `MERGE_GATES_PASSED` | Checks, reviews, conversations и policy gates допускают merge |
| `MERGED` | Platform подтверждает merge и известен merge commit |
| `DEPLOYING` | Запущен delivery flow exact merged commit/artifact |
| `DEPLOYED` | Deployment завершён, но отдельный LIVE gate ещё не подтверждён или не требуется |
| `LIVE_VERIFIED` | Required runtime/health checks подтверждены |
| `CLOSED` | Applicable metadata synchronized, dashboard/archive/cleanup завершены, base стала новым baseline |

Для scope без deployment stages `DEPLOYING`, `DEPLOYED` и `LIVE_VERIFIED` считаются неприменимыми; `CLOSED` достигается после обязательных merge/docs/checkpoint/cleanup gates.

Modifiers:

```text
BLOCKED
PENDING_EXTERNAL_GATE
DEFERRED
SUPERSEDED
RECOVERY_REQUIRED
```

Modifier содержит reason, owner/gate, Evidence identifier, условие снятия и safe next action.

### 3.4. Readiness calculation

1. Перед расчётом перечисли atomic acceptance criteria и denominator.
2. По умолчанию criteria имеют равный вес; иной вес допустим только если задан в product contract.
3. Не назначай criterion субъективную долю: декомпозируй его без изменения intended requirement либо считай невыполненным.
4. Epic completion:

```text
вес выполненных in-scope criteria / вес всех in-scope criteria × 100
```

5. Overall completion считается по сумме criteria проекта, а не как среднее процентов epics.
6. Deferred/out-of-scope criteria исключаются только по подтверждённому contract или user instruction.
7. Evidence не увеличивает percentage, а gate-ит `READY`.
8. Для operational/live epics `DEPLOY` и `LIVE` обязательны; для local/design-only scope могут быть `N/A`.

`docs/delivery-plan.md` хранит текущий independently recalculated snapshot и один предыдущий snapshot. Изменение более чем на 10 percentage points требует краткого объяснения.

---

## 4. Delivery item и authorization

Перед implementation зафиксируй:

```text
ID
Goal
Authorization source
Scope
Non-goals
Atomic acceptance criteria
Required Evidence
Expected validation
Documentation impact
Delivery expectation
```

Authorization source — проверяемая ссылка на current user instruction или durable approved delivery record.

Audit findings, backlog, future scope, archive, old chat, issue и generated bundle не авторизуют implementation сами по себе.

Новая authorization нужна, если работа требует:

- изменения public behavior, requirements, acceptance criteria или durable constraints;
- расширения component/file scope за пределы необходимого;
- новой production dependency, persistence/queue/cache/external service или architecture boundary;
- CI/CD policy, secrets, stateful systems, destructive operation или protection bypass;
- удаления backward compatibility или действия, указанного как non-goal.

Внутри authorized scope агент выбирает implementation details, добавляет необходимые tests и исправляет локальные defects, без которых acceptance criteria нельзя выполнить безопасно. Broad cleanup остаётся вне scope.

---

## 5. Session start и mode selection

### Read-only baseline

До первых изменений:

1. Прочитай applicable `AGENTS.md`.
2. Определи repository root, base branch, `HEAD`, remotes и worktree state.
3. Выполни `git fetch`, если remote доступен и это безопасно.
4. Прочитай relevant delivery item/checkpoint.
5. Проверь applicable product-spec sections, impacted code/tests/configuration.
6. Зафиксируй unknowns, conflicts и preserved pre-existing changes.

### Mode behavior

- `INITIAL_AUDIT`:
  1. **Documents:** canonicality, duplicate/stale/obsolete/orphaned/non-canonical files, requirements, AC, readiness и Evidence drift.
  2. **Repository:** legacy/dead/deprecated/unreachable/duplicate/orphaned code, architecture, tests, configuration/defaults/environment/secret handling и доступное CI/runtime Evidence. При этом generated/vendored code учитывается отдельно; для finding используй `REMOVE | REFACTOR | CONSOLIDATE | DEPRECATE | DOCUMENT | DEFER`.
  3. **Delivery:** roadmap/pipeline и audit quality review с coverage gaps, assumptions, false-positive/negative risk и confidence `HIGH | MEDIUM | LOW`.
  Findings не реализуются без authorization.
- `FOCUSED_TASK`: только достаточная проверка scope, dependencies, relevant docs и regression surface.
- `RESUME`: checkpoint сверяется с actual state; проверяется только drift после него.
- `RECOVERY`: применяется при missing/stale checkpoint, branch/HEAD/PR/check/deploy mismatch, неописанном dirty state или небезопасном next action.

---

## 6. Active execution checkpoint

Для non-trivial незавершённой работы `docs/delivery-plan.md` содержит один перезаписываемый checkpoint:

```md
## Active execution checkpoint

- Updated (UTC): <ISO 8601>
- Session mode: INITIAL_AUDIT | FOCUSED_TASK | RESUME | RECOVERY
- Delivery stage: <stage> [; <modifier>]
- Work item / epic: <stable IDs>
- Authorization source: <short durable reference>
- Authorized scope: <bounded outcome>
- Non-goals: <explicit exclusions>
- Base branch: <branch>
- Base SHA: <full SHA>
- Working branch: <branch or N/A>
- Last verified revision: <full SHA or N/A>
- Working tree: CLEAN | DIRTY — <owned/unowned summary>
- Completed since base: <short facts and commit SHAs>
- Current step: <one current operation/state>
- Next exact action: <one executable action>
- Validation and Evidence: <commands/results/IDs>
- Pull Request: <number/state/head SHA or N/A>
- CI/checks: <required checks and run IDs/status>
- Deployment/environment: <run/deployment/environment/artifact/status>
- Blockers: <none or explicit conditions>
- Unverified assumptions: <none or bounded list>
- Preserved pre-existing changes: <none or paths/worktree>
```

Checkpoint:

- содержит facts, decisions, identifiers и один next action;
- не содержит chain of thought, credentials, secrets или raw logs;
- обновляется после branch/base change, commit, push/PR, CI/review, merge, deployment/LIVE, blocker/external gate и interruption;
- подтверждается actual state при каждом resume;
- не является Evidence без независимой проверки.

`Last verified revision` — последний commit, состояние которого покрывает checkpoint. Checkpoint не обязан и не может надёжно ссылаться на собственный containing commit.

Не создавай цепочку metadata-only commits ради фиксации SHA/CI/run ID, меняющегося от самого commit. Actual branch, PR, checks и deployment state всегда перепроверяются.

Не добавляй новый checkpoint ниже старого. Obsolete history переносится в archive при cleanup/closure.

---

## 7. Base, branch и worktree

Перед working branch установи exact remote base SHA:

```text
git fetch origin
→ verify origin/main или configured base
→ record base SHA
→ create feature/fix branch
```

Локальный `main` обновляй только fast-forward и только если это не затрагивает unrelated user state. При dirty/diverged checkout предпочитай isolated worktree от verified `origin/<base>`.

Branch naming:

```text
feature/<item-id>-<slug>
fix/<item-id>-<slug>
hotfix/<item-id>-<slug>
docs/<item-id>-<slug>
```

Не переиспользуй merged branch для unrelated work.

Pre-existing user changes:

- инвентаризируй до записи;
- не изменяй, не stash/pop, не reset/clean и не включай в commits;
- при пересечении путей используй isolated worktree или останови конфликтующую часть;
- укажи preserved paths в checkpoint.

При base drift определи влияние на scope, AC, checks и mergeability. Rebase/merge выполняй только безопасным project-approved способом; после изменения history/SHA повтори affected validation и обнови checkpoint.

---

## 8. Planning и implementation loop

Перед кодом:

1. Сопоставь AC с files/components/tests.
2. Определи минимальный implementation slice.
3. Зафиксируй risks, unknowns и non-goals.
4. Проверь, нужны ли architecture, migration, CI/CD или runbook updates.

Не смешивай product delivery, agent workflow/tooling, CI/CD и Builder work в одном PR без explicit combined scope; иначе раздели работу.

Для каждого slice:

1. Внеси focused change.
2. Добавь/обнови tests, необходимые для behavior и regression risk.
3. Выполни smallest sufficient validation.
4. Проверь diff на scope creep, secrets, generated noise и unrelated edits.
5. Обнови factual docs, readiness и checkpoint.
6. Создай reviewable commit.

Если найден defect вне scope, зафиксируй его как finding/follow-up; не расширяй реализацию молча.

---

## 9. Validation contract

Используй existing commands в порядке от focused к broad:

1. syntax/format/lint;
2. typecheck/static analysis;
3. focused tests;
4. relevant regression suite;
5. build/package/config validation;
6. CI required checks;
7. deployment/LIVE checks, когда применимо.

Правила:

- записывай exact command, result и revision;
- not-run, skipped, cancelled, timed-out или unavailable не равны success;
- pre-existing failure отделяй от introduced regression и подтверждай сравнением, если возможно;
- runtime conclusion не основывай только на code inspection;
- manual check описывай воспроизводимо и без secrets;
- после base/rebase/merge drift повторяй affected checks.

Не добавляй heavy testing infrastructure вне scope только ради формального покрытия.

---

## 10. Commit, push и Pull Request

Commit создаётся после завершённого slice, validation и обновления связанного checkpoint/readiness. Message описывает outcome, а не внутренний процесс агента.

После каждого implementation commit:

1. независимо пересчитай readiness затронутых epics/features и overall project по текущему denominator/Evidence;
2. зафиксируй exact SHA и обнови working checkpoint;
3. включи operational update в следующий material commit либо final pre-push docs commit, используя `Last verified revision`.

Не создавай отдельный recursive commit только ради ссылки на собственный SHA или новый CI run. Correction оформляй следующим scoped commit, а не rewrite history.

Перед push проверь:

- branch основана на известном base SHA;
- worktree содержит только intended changes;
- relevant checks выполнены или limitations записаны;
- secrets/unsafe artifacts отсутствуют;
- docs и code не противоречат друг другу.

После серии commits, покрывающей selected scope, push branch и создай/обнови PR.

Минимальный PR body:

```md
## Summary
- <что изменено>

## Scope
- Work item: <ID or N/A>
- In scope: <bounded list>
- Non-goals: <bounded list>

## Acceptance criteria
- <criterion → result/evidence>

## Validation
- `<command>` — <result>

## Documentation
- <updated paths or why not needed>

## Risks and follow-up
- <remaining limitations/blockers or none>
```

Перед merge gates проверь diff, AC/non-goals, public behavior, dependencies, docs, generated files и актуальность base/head SHA. PR не должен дублировать полный spec, logs или generated bundle.

---

## 11. CI, review и merge

После push отслеживай required checks exact PR head. Для failure/skip:

- установи failing job/step и relevant logs без раскрытия secrets;
- классифицируй introduced, pre-existing, flaky, configuration или external;
- исправляй только в scope либо фиксируй blocker;
- не считай rerun success доказательством причины без анализа;
- не переходи в `CHECKS_PASSED`, пока required checks не завершены успешно.

Учитывай required approvals, unresolved conversations, CODEOWNERS, merge queue, branch protection и policy checks. Pending review/approval — `PENDING_EXTERNAL_GATE` с PR/check IDs.

`MERGE_GATES_PASSED` допустим только когда current head имеет успешные required checks, approvals, resolved blocking conversations, platform mergeability, завершённый scope/AC/docs/risk review и authorization на merge без bypass.

Если права и authorization позволяют, используй стандартный repository merge method. Не применяй admin bypass. Зафиксируй PR number, merge commit SHA и фактический base state.

Merge не равен deployment success.

---

## 12. Deployment, LIVE и metadata sync

Deployment применяется только если входит в current scope и описан в `Project CI/CD profile`.

Перед flow:

- прочитай `docs/ci-cd-rules.md`;
- установи exact merge commit или artifact digest;
- проверь trusted trigger и target environment;
- сохрани workflow/deployment IDs;
- не обходи environment approvals или secret gates.

`DEPLOYED` требует подтверждённого deployment result exact revision. `LIVE_VERIFIED` требует предусмотренного health/runtime check target environment. Failed, cancelled, skipped или pending result не является success.

После required `DEPLOY`/`LIVE` синхронизируй только те operational metadata, которые разрешены `AGENTS.md` и `docs/project-spec.md`.

Post-deploy write без отдельного PR допустим только через заранее предусмотренный mechanism, который:

- path/section scoped и имеет minimal permissions;
- привязан к exact deployed commit/artifact/environment;
- защищён от recursive workflow loops;
- не меняет durable requirements, code или CI/CD policy;
- оставляет auditable commit/run record;
- не обходит branch protection прямым push агента.

Разрешённые данные: status, completion, Evidence, verified commit/run/deployment IDs, timestamp и readiness blocker.

Если mechanism отсутствует или failed, не создавай follow-up docs-only PR автоматически. Зафиксируй blocker/technical debt и фактический deployment state без ложного `CLOSED`.

---

## 13. Recovery и external gates

Recovery sequence:

1. Прочитай applicable instructions и active checkpoint.
2. Установи actual root, branch, `HEAD`, worktree и remotes.
3. Найди related local/remote branches и commits.
4. Проверь PR state, head/base SHA, reviews и checks.
5. Проверь merge commit, workflow runs, deployments и environments.
6. Сопоставь actual state с checkpoint field-by-field.
7. Отдели owned changes от pre-existing user changes.
8. Восстанови authorized scope и blockers.
9. Обнови checkpoint только подтверждёнными facts.
10. Выполни delta-audit relevant drift.
11. Запиши один `Next exact action` и продолжи, если blocker отсутствует.

В recovery не повторяй implementation «на всякий случай», не создавай duplicate PR, не force-update branch ради stale checkpoint, не удаляй unknown changes и не объявляй Evidence по старому тексту.

При pending CI, review, merge queue, environment approval, credential access или deployment сохрани exact ID/status, owner/exit condition и safe next action. Не имитируй завершение и не ослабляй gate.

---

## 14. Delivery plan, archive и documentation

`docs/delivery-plan.md` — operational dashboard, а не journal. Он хранит current milestone, active/next/near items, current readiness snapshot и один previous snapshot, blockers/risks, один active checkpoint и ссылку на archive.

Рекомендуемые markers:

```text
👉 active
📋 planned
⛔ blocked
✅ completed / pending archive
```

Для top dashboard не используй Markdown task-list markers `[ ]`/`[x]`: они смешивают delivery state с checklist semantics.

`docs/delivery-plan-archive.md` создаётся при первой необходимости. Переноси туда completed checkpoints, длинные PR/check/deployment chains, superseded sequencing и historical notes, потерявшие operational relevance.

Archive не хранит единственный current authorization, blocker или next action; не авторизует implementation и не используется для regular readiness calculation.

Для `docs/project-spec.md` применяй targeted updates. Не переписывай, не сокращай и не регенерируй крупный source-of-truth document целиком, если user не запросил именно такую rewrite. Без explicit user request не меняй durable scope/requirements/AC. Agent-writable operational metadata должна быть визуально отделена, например:

```md
<!-- BEGIN AGENT-MANAGED: OPERATIONAL_METADATA -->
...
<!-- END AGENT-MANAGED: OPERATIONAL_METADATA -->
```

Не создавай конкурирующую копию document policy: canonical rules находятся в `AGENTS.md`.

---

## 15. Failure, hotfix и closure

- **Implementation/test failure:** оставь branch в безопасном состоянии, отдели introduced issue от pre-existing state, обнови Evidence/blocker и не скрывай skipped validation.
- **CI failure:** исправь в той же branch, если причина входит в scope; иначе зафиксируй blocker без broad unrelated repair.
- **Deployment failure:** не заявляй `DEPLOYED`/`LIVE_VERIFIED`; следуй project rollback/forward-fix policy и не выполняй destructive recovery без authorization.
- **Hotfix:** может сокращать planning ceremony, но не bypass-ит required CI, review, environment, stateful-data или LIVE gates; после стабилизации восстанови checkpoint и docs consistency.

Closure sequence:

1. Подтверди merge commit и, когда применимо, deployment/LIVE Evidence и metadata synchronization.
2. Перенеси obsolete checkpoint/history в archive, если требуется cleanup.
3. Обнови active plan до следующего current state.
4. Fetch и fast-forward local base, не затрагивая unrelated state.
5. Удали созданные merged branches только после проверки merge и отсутствия unique commits.
6. Удали принадлежащие работе temporary worktree/output только после safety check.
7. Зафиксируй final baseline SHA и remaining blockers/risks.

`CLOSED` недопустим, если обязательный deployment/LIVE gate или post-deploy metadata synchronization остаётся неподтверждённым.

---

## 16. Definition of Done

### Audit

- заявленный scope и relevant sources изучены;
- readiness пересчитана по atomic AC и Evidence;
- docs/code/config/tests/CI/runtime drift указан;
- findings отделены от assumptions;
- roadmap и audit quality review сформированы.

### Implementation slice

- authorized outcome реализован без scope creep;
- AC и relevant checks выполнены либо limitations explicit;
- docs/checkpoint/readiness отражают factual state;
- commit reviewable и не содержит unrelated changes/secrets.

### Pull Request и merge

- PR соответствует scope и содержит validation/documentation/risk summary;
- required checks/reviews/conversations подтверждены exact head;
- merge выполнен approved method без bypass;
- merge commit известен.

### Deployment и closure

- exact merged commit/artifact доставлен в correct environment;
- required LIVE checks подтверждены;
- operational metadata synchronized approved mechanism;
- active plan/archive согласованы;
- base/branches/worktrees очищены безопасно;
- final response содержит exact state, Evidence, limitations и remaining risks.

# Документация проекта

Этот раздел нужен не вместо `README.md`, а поверх него.

`README.md` отвечает на вопрос **«что это за проект»**, а папка `docs/` — на вопросы **«как он устроен», «в каком он состоянии», «как его развивать и ревьюить»**.

## Состав документации

- [Статус проекта](./PROJECT_STATUS.md)
- [Обзор workflow](./WORKFLOW_OVERVIEW.md)
- [Архитектура и стратегия провайдеров](./ARCHITECTURE_AND_PROVIDER_STRATEGY.md)
- [Настройка Colab, Secrets и зависимости](./COLAB_SETUP_AND_SECRETS.md)
- [GitHub / PR / review workflow](./GITHUB_AND_REVIEW_WORKFLOW.md)
- [Ограничения, риски и открытые вопросы](./LIMITATIONS_AND_RISKS.md)

## Как читать эти документы

Если ты заходишь в проект впервые, рекомендуемый порядок такой:

1. `README.md`
2. `docs/PROJECT_STATUS.md`
3. `docs/WORKFLOW_OVERVIEW.md`
4. `docs/ARCHITECTURE_AND_PROVIDER_STRATEGY.md`
5. `docs/COLAB_SETUP_AND_SECRETS.md`
6. `docs/GITHUB_AND_REVIEW_WORKFLOW.md`
7. `docs/LIMITATIONS_AND_RISKS.md`

## Важная договорённость

Документация должна быть честной:

- не считать неподтверждённый код уже загруженным в репозиторий;
- не считать OpenAI-ветку fully validated без реальных end-to-end прогонов;
- не хранить секреты в коде или в документации.

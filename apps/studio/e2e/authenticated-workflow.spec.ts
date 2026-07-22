import { expect, test } from '@playwright/test';

const E2E_EMAIL = 'browser-e2e@example.com';
const E2E_PASSWORD = 'browser-e2e-password';
const RESULT_PROJECT = 'Browser E2E Results';
const RESULT_JOB = 'Browser E2E completed job';
const RESULT_URL =
  'https://docs.google.com/document/d/browser-e2e-document/edit';

test('authenticated user creates a project and reads a completed job result', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Пароль').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();

  const navigation = page.getByRole('navigation', {
    name: 'Основная навигация',
  });
  await expect(navigation).toBeVisible();
  await navigation.getByRole('button', { name: 'Проекты', exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);

  await page.getByRole('button', { name: 'Новый проект' }).click();
  const createProjectForm = page.locator('form.project-form');
  await createProjectForm
    .getByLabel('Название проекта')
    .fill('Browser E2E Draft');
  await createProjectForm
    .getByLabel('Описание')
    .fill('Created through the authenticated browser workflow');
  await createProjectForm.getByRole('button', { name: 'Создать' }).click();
  await expect(
    page
      .getByRole('region', { name: 'Список проектов' })
      .getByRole('button', { name: /^Browser E2E Draft/ }),
  ).toBeVisible();

  await page
    .getByRole('button', { name: new RegExp(`^${RESULT_PROJECT}`) })
    .click();
  await expect(
    page.getByRole('region', { name: `Подготовка ${RESULT_PROJECT}` }),
  ).toBeVisible();

  await page.getByText('Недавние задачи · 1', { exact: true }).click();
  const jobCard = page
    .locator('article.source-card')
    .filter({ hasText: RESULT_JOB })
    .first();
  await expect(jobCard.getByText('Статус: Завершена')).toBeVisible();
  await jobCard.getByRole('button', { name: 'Открыть' }).click();

  await expect(jobCard.getByRole('heading', { name: 'Результаты' })).toBeVisible();
  await expect(jobCard.getByText('Результатов: 1')).toBeVisible();
  await expect(jobCard.getByRole('link', { name: 'Открыть документ' })).toHaveAttribute(
    'href',
    RESULT_URL,
  );

  await navigation
    .getByRole('button', { name: 'Настройки', exact: true })
    .click();
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
});

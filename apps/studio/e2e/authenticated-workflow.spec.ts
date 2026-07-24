import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const E2E_EMAIL = 'browser-e2e@example.com';
const E2E_PASSWORD = 'browser-e2e-password';
const RESULT_PROJECT = 'Browser E2E Results';
const RESULT_JOB = 'Browser E2E completed job';
const RESULT_URL =
  'https://docs.google.com/document/d/browser-e2e-document/edit';

async function login(page: Page) {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Пароль').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();

  const navigation = page.getByRole('navigation', {
    name: 'Основная навигация',
  });
  await expect(navigation).toBeVisible();
  return navigation;
}

test('authenticated user creates a project and reads a completed job result', async ({
  page,
}) => {
  const navigation = await login(page);
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
  const reconciliationResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes('/output-reconciliation'),
  );
  await jobCard.getByRole('button', { name: 'Открыть' }).click();
  const reconciliationResponse = await reconciliationResponsePromise;
  expect(reconciliationResponse.status()).toBe(200);
  const reconciliation = await reconciliationResponse.json();
  expect(reconciliation).toMatchObject({
    job_status: 'completed',
    available: false,
    counts: {
      reconciliation_required: 0,
      resolved: 1,
      conflict: 0,
    },
  });
  const resultJobId = String(
    (reconciliation as { job_id?: unknown }).job_id ?? '',
  );
  expect(resultJobId).toMatch(/^[0-9a-f-]{36}$/);

  await expect(jobCard.getByRole('heading', { name: 'Результаты' })).toBeVisible();
  await expect(jobCard.getByText('Результатов: 1')).toBeVisible();
  await expect(jobCard.getByRole('link', { name: 'Открыть документ' })).toHaveAttribute(
    'href',
    RESULT_URL,
  );
  const jobDetail = jobCard.locator('section[aria-label^="Job detail "]');
  await expect(jobDetail.getByRole('heading', { name: 'Файлы задачи' })).toBeVisible();
  await expect(jobDetail.getByText('Статус обработки: Завершена')).toBeVisible();
  await expect(jobDetail).not.toContainText('Статус файла: queued');
  await expect(jobDetail).not.toContainText('Статус обработки: В очереди');
  await expect(
    jobCard.locator('section[aria-label^="Output reconciliation "]'),
  ).toHaveCount(0);
  await expect(
    jobCard.getByRole('button', {
      name: 'Проверить созданный документ в Google Drive',
    }),
  ).toHaveCount(0);

  await navigation
    .getByRole('button', { name: 'Настройки', exact: true })
    .click();
  await page.getByRole('tab', { name: 'Диагностика' }).click();
  await page
    .getByRole('textbox', { name: 'Задача', exact: true })
    .fill(resultJobId);
  const diagnosticsResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes('/diagnostics/events?') &&
      response.url().includes(`job_id=${resultJobId}`),
  );
  await page
    .getByRole('button', { name: 'Применить фильтры', exact: true })
    .click();
  const diagnosticsResponse = await diagnosticsResponsePromise;
  expect(diagnosticsResponse.status()).toBe(200);
  const diagnostics = await diagnosticsResponse.json();
  expect(
    (diagnostics as { events?: Array<{ event_code?: string }> }).events?.map(
      (event) => event.event_code,
    ),
  ).toEqual(['JOB_COMPLETED', 'OUTPUT_PERSISTED', 'JOB_CREATED']);
  const diagnosticsJson = JSON.stringify(diagnostics);
  expect(diagnosticsJson).not.toContain('browser-e2e-audio.mp3');
  expect(diagnosticsJson).not.toContain('browser-e2e-document');
  expect(diagnosticsJson).not.toContain('browser-e2e-source');

  const diagnosticEvents = page.getByRole('region', {
    name: 'События диагностики',
  });
  await expect(diagnosticEvents.getByText('JOB_COMPLETED')).toBeVisible();
  await expect(diagnosticEvents.getByText('OUTPUT_PERSISTED')).toBeVisible();
  await expect(diagnosticEvents.getByText('JOB_CREATED')).toBeVisible();
  await expect(diagnosticEvents).toContainText('final_job_status');
  await expect(diagnosticEvents).toContainText('completed');
  await expect(diagnosticEvents).toContainText('output_count');
  await expect(diagnosticEvents).toContainText('1');

  await page.getByRole('tab', { name: 'Аккаунт' }).click();
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
});

test('preparation stays fail-closed without external integrations', async ({
  page,
}) => {
  const navigation = await login(page);
  await navigation.getByRole('button', { name: 'Проекты', exact: true }).click();
  await page
    .getByRole('button', { name: new RegExp(`^${RESULT_PROJECT}`) })
    .click();

  const preparation = page.getByRole('region', {
    name: `Подготовка ${RESULT_PROJECT}`,
  });
  await expect(preparation).toBeVisible();

  const integrationRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    const isExternalIntegration =
      url.hostname.includes('google') ||
      url.hostname.includes('elevenlabs') ||
      url.hostname.includes('cloudflarestorage');
    const isJobMutation =
      request.method() !== 'GET' && url.pathname.includes('/api/jobs/batch');
    if (isExternalIntegration || isJobMutation) {
      integrationRequests.push(`${request.method()} ${url.origin}${url.pathname}`);
    }
  });

  await expect(
    preparation.getByText(
      'Добавьте активный ключ ElevenLabs в настройках, чтобы создавать задачи.',
    ),
  ).toBeVisible();
  await expect(preparation.getByText('Google Drive не подключён.')).toBeVisible();
  await expect(
    preparation.getByRole('button', { name: 'Выбрать файлы Google Drive' }),
  ).toBeDisabled();
  await expect(
    preparation.getByRole('button', {
      name: 'Выбрать папку результата для строки 1',
    }),
  ).toBeDisabled();

  const readiness = preparation.getByRole('status', {
    name: 'Готовность строк подготовки',
  });
  await expect(readiness).toContainText('Готово: 0 из 1');
  await expect(readiness).toContainText('Строка 1: выберите источник');

  await preparation
    .getByLabel('Существующий файл для строки 1')
    .selectOption({ label: /browser-e2e-audio\.mp3/ });

  await expect(readiness).toContainText(
    'Строка 1: выберите папку результата',
  );
  await expect(
    preparation.getByRole('button', { name: 'Проверить задачи (1)' }),
  ).toBeDisabled();
  await expect(preparation).toContainText(
    'Добавьте активный ключ ElevenLabs в настройках',
  );
  expect(integrationRequests).toEqual([]);
});

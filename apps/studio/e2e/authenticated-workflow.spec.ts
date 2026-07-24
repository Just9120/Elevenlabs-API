import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const E2E_EMAIL = 'browser-e2e@example.com';
const E2E_PASSWORD = 'browser-e2e-password';
const RESULT_PROJECT = 'Browser E2E Results';
const RESULT_JOB = 'Browser E2E completed job';
const UNCERTAIN_JOB = 'Browser E2E uncertain provider job';
const RETRY_SAFE_JOB = 'Browser E2E retry-safe provider job';
const RECONCILIATION_JOB = 'Browser E2E reconciliation required job';
const QUEUED_CANCELLATION_JOB = 'Browser E2E queued cancellation job';
const PROCESSING_CANCELLATION_JOB = 'Browser E2E processing cancellation job';
const RECONCILIATION_TOKEN = 'or_browser_e2e_pending';
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

function trackExternalOrJobMutations(page: Page) {
  const requests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    const isExternalIntegration =
      url.hostname.includes('google') ||
      url.hostname.includes('elevenlabs') ||
      url.hostname.includes('cloudflarestorage');
    const isJobMutation =
      request.method() !== 'GET' && url.pathname.startsWith('/api/jobs/');
    if (isExternalIntegration || isJobMutation) {
      requests.push(`${request.method()} ${url.origin}${url.pathname}`);
    }
  });
  return requests;
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

  await page.getByText('Недавние задачи · 4', { exact: true }).click();
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

  const integrationRequests = trackExternalOrJobMutations(page);

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

test('uncertain provider result exposes no unsafe recovery action', async ({
  page,
}) => {
  const navigation = await login(page);
  await navigation.getByRole('button', { name: 'Проекты', exact: true }).click();
  await page
    .getByRole('button', { name: new RegExp(`^${RESULT_PROJECT}`) })
    .click();
  await page.getByText('Недавние задачи · 4', { exact: true }).click();

  const jobCard = page
    .locator('article.source-card')
    .filter({ hasText: UNCERTAIN_JOB })
    .first();
  await expect(jobCard.getByText('Статус: Ошибка')).toBeVisible();

  const integrationRequests = trackExternalOrJobMutations(page);
  const retryResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().endsWith('/retry'),
  );
  const reconciliationResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().endsWith('/output-reconciliation'),
  );
  await jobCard.getByRole('button', { name: 'Открыть' }).click();

  const retryResponse = await retryResponsePromise;
  expect(retryResponse.status()).toBe(200);
  const retry = await retryResponse.json();
  expect(retry).toMatchObject({
    job_status: 'failed',
    available: false,
    reason: 'provider_outcome_uncertain',
    attempt_count: 1,
    missing_output_count: 1,
    retry_safe_source_count: 0,
  });

  const reconciliationResponse = await reconciliationResponsePromise;
  expect(reconciliationResponse.status()).toBe(200);
  const reconciliation = await reconciliationResponse.json();
  expect(reconciliation).toMatchObject({
    job_status: 'failed',
    available: false,
    counts: {
      reconciliation_required: 0,
      resolved: 0,
      conflict: 0,
    },
  });

  await expect(jobCard.getByRole('heading', { name: 'Результаты' })).toBeVisible();
  await expect(jobCard.getByText('Результатов: 0')).toBeVisible();
  await expect(jobCard.getByText('Результаты пока не созданы.')).toBeVisible();
  await expect(jobCard.getByText('Статус обработки: Ошибка')).toBeVisible();

  const retryAction = jobCard.locator('[aria-label="Safe retry action"]');
  await expect(retryAction).toContainText(
    'Повтор недоступен: результат внешнего вызова не определён',
  );
  await expect(
    retryAction.getByRole('button', {
      name: 'Повторить безопасную обработку',
    }),
  ).toHaveCount(0);
  await expect(
    jobCard.locator('section[aria-label^="Output reconciliation "]'),
  ).toHaveCount(0);
  await expect(
    jobCard.getByRole('button', {
      name: 'Проверить созданный документ в Google Drive',
    }),
  ).toHaveCount(0);
  expect(integrationRequests).toEqual([]);
});

test('unresolved output reconciliation waits for an explicit safe action', async ({
  page,
}) => {
  const navigation = await login(page);
  await navigation.getByRole('button', { name: 'Проекты', exact: true }).click();
  await page
    .getByRole('button', { name: new RegExp(`^${RESULT_PROJECT}`) })
    .click();
  await page.getByText('Недавние задачи · 4', { exact: true }).click();

  const jobCard = page
    .locator('article.source-card')
    .filter({ hasText: RECONCILIATION_JOB })
    .first();
  await expect(jobCard.getByText('Статус: Ошибка')).toBeVisible();

  const integrationRequests = trackExternalOrJobMutations(page);
  const retryResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().endsWith('/retry'),
  );
  const reconciliationResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().endsWith('/output-reconciliation'),
  );
  await jobCard.getByRole('button', { name: 'Открыть' }).click();

  const retryResponse = await retryResponsePromise;
  expect(retryResponse.status()).toBe(200);
  const retry = await retryResponse.json();
  expect(retry).toMatchObject({
    job_status: 'failed',
    available: false,
    reason: 'output_reconciliation_required',
    attempt_count: 1,
    missing_output_count: 1,
    retry_safe_source_count: 0,
  });

  const reconciliationResponse = await reconciliationResponsePromise;
  expect(reconciliationResponse.status()).toBe(200);
  const reconciliation = await reconciliationResponse.json();
  expect(reconciliation).toMatchObject({
    job_status: 'failed',
    available: true,
    counts: {
      reconciliation_required: 1,
      resolved: 0,
      conflict: 0,
    },
    cases: [
      {
        status: 'reconciliation_required',
        reason: 'google_docs_timeout',
        resolved: false,
      },
    ],
  });
  const reconciliationJson = JSON.stringify(reconciliation);
  expect(reconciliationJson).not.toContain(RECONCILIATION_TOKEN);
  expect(reconciliationJson).not.toContain('Browser E2E pending document');
  expect(reconciliationJson).not.toContain('browser-e2e-folder');

  await expect(jobCard.getByRole('heading', { name: 'Результаты' })).toBeVisible();
  await expect(jobCard.getByText('Результатов: 0')).toBeVisible();
  const reconciliationNotice = jobCard.locator(
    'section[aria-label^="Output reconciliation "]',
  );
  await expect(reconciliationNotice).toContainText(
    'Требуется проверка результата Google Docs',
  );
  await expect(
    reconciliationNotice.getByRole('button', {
      name: 'Проверить созданный документ в Google Drive',
    }),
  ).toBeVisible();

  const retryAction = jobCard.locator('[aria-label="Safe retry action"]');
  await expect(retryAction).toContainText(
    'Требуется проверка созданного документа',
  );
  await expect(
    retryAction.getByRole('button', {
      name: 'Повторить безопасную обработку',
    }),
  ).toHaveCount(0);
  expect(integrationRequests).toEqual([]);
});

test('progress refresh keeps the last confirmed checkpoint after a temporary failure', async ({
  page,
}) => {
  const navigation = await login(page);
  await navigation.getByRole('button', { name: 'Проекты', exact: true }).click();

  const integrationRequests = trackExternalOrJobMutations(page);
  const initialProgressResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().endsWith('/jobs/progress'),
  );
  await page
    .getByRole('button', { name: new RegExp(`^${RESULT_PROJECT}`) })
    .click();

  const initialProgressResponse = await initialProgressResponsePromise;
  expect(initialProgressResponse.status()).toBe(200);
  const initialProgressPayload = await initialProgressResponse.json();
  const processingProgress = initialProgressPayload.jobs.find(
    (job: { job_status?: string }) => job.job_status === 'processing',
  );
  expect(processingProgress).toMatchObject({
    job_status: 'processing',
    current_stage: 'provider_processing',
  });
  expect(processingProgress.job_id).toMatch(/^[0-9a-f-]{36}$/);

  const progress = page.getByRole('region', {
    name: `Прогресс задачи ${processingProgress.job_id}`,
  });
  await expect(
    progress.getByText('Транскрибация ElevenLabs').locator('..'),
  ).toContainText('Выполняется');
  await expect(
    progress.getByText('Создание Google Docs').locator('..'),
  ).toContainText('Ожидает');

  let failedRefreshes = 0;
  await page.route('**/api/projects/*/jobs/progress', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    failedRefreshes += 1;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'temporary_progress_unavailable' }),
    });
  });
  const failedProgressResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().endsWith('/jobs/progress') &&
      response.status() === 503,
  );

  const failedProgressResponse = await failedProgressResponsePromise;
  expect(failedProgressResponse.status()).toBe(503);
  expect(failedRefreshes).toBe(1);
  await expect(
    progress.getByText(
      'Не удалось обновить прогресс; показан последний подтверждённый статус.',
    ),
  ).toBeVisible();
  await expect(
    progress.getByText('Подготовка источника').locator('..'),
  ).toContainText('Готово');
  await expect(
    progress.getByText('Транскрибация ElevenLabs').locator('..'),
  ).toContainText('Выполняется');
  await expect(
    progress.getByText('Создание Google Docs').locator('..'),
  ).toContainText('Ожидает');
  await expect(progress.getByText('Готово файлов: 0 из 1')).toBeVisible();
  expect(integrationRequests).toEqual([]);
});

test('processing cancellation records a request without claiming completion', async ({
  page,
}) => {
  const navigation = await login(page);
  await navigation.getByRole('button', { name: 'Проекты', exact: true }).click();

  const integrationRequests = trackExternalOrJobMutations(page);
  const progressResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().endsWith('/jobs/progress'),
  );
  await page
    .getByRole('button', { name: new RegExp(`^${RESULT_PROJECT}`) })
    .click();

  const progressResponse = await progressResponsePromise;
  expect(progressResponse.status()).toBe(200);
  const progressPayload = await progressResponse.json();
  const processingProgress = progressPayload.jobs.find(
    (job: { job_status?: string }) => job.job_status === 'processing',
  );
  expect(processingProgress).toMatchObject({
    job_status: 'processing',
    tracking_precision: 'checkpoint',
    completed_source_count: 0,
    total_source_count: 1,
    active_source_position: 0,
    current_stage: 'provider_processing',
    sources: [
      {
        position: 0,
        name: 'browser-e2e-audio.mp3',
        status: 'processing',
        stages: [
          {
            key: 'preparation',
            status: 'completed',
            applicability: 'required',
          },
          {
            key: 'audio_extraction',
            status: 'not_applicable',
            applicability: 'not_applicable',
          },
          {
            key: 'splitting',
            status: 'completed',
            applicability: 'conditional',
          },
          {
            key: 'provider_processing',
            status: 'active',
            applicability: 'required',
          },
          {
            key: 'part_merge',
            status: 'pending',
            applicability: 'conditional',
          },
          {
            key: 'google_docs_output',
            status: 'pending',
            applicability: 'required',
          },
        ],
      },
    ],
  });
  expect(processingProgress.job_id).toMatch(/^[0-9a-f-]{36}$/);
  expect(JSON.stringify(processingProgress)).not.toContain(
    'browser-e2e-worker',
  );

  const progress = page.getByRole('region', {
    name: `Прогресс задачи ${processingProgress.job_id}`,
  });
  await expect(progress.getByText('Готово файлов: 0 из 1')).toBeVisible();
  await expect(
    progress.getByText('Подготовка источника').locator('..'),
  ).toContainText('Готово');
  await expect(
    progress.getByText('Извлечение аудио').locator('..'),
  ).toContainText('Не требуется');
  await expect(
    progress
      .getByText('Разбиение на части (при необходимости)')
      .locator('..'),
  ).toContainText('Проверено');
  await expect(
    progress.getByText('Транскрибация ElevenLabs').locator('..'),
  ).toContainText('Выполняется');
  await expect(
    progress.getByText('Создание Google Docs').locator('..'),
  ).toContainText('Ожидает');

  const currentJobs = page.getByRole('region', { name: 'Текущие задачи' });
  const processingCard = currentJobs
    .locator('article.source-card')
    .filter({ hasText: PROCESSING_CANCELLATION_JOB })
    .first();
  await expect(processingCard.getByText('Статус: Обрабатывается')).toBeVisible();

  const cancelResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/cancel'),
  );
  await processingCard
    .getByRole('button', { name: 'Запросить отмену' })
    .click();

  const cancelResponse = await cancelResponsePromise;
  expect(cancelResponse.status()).toBe(200);
  const cancellationRequested = await cancelResponse.json();
  expect(cancellationRequested).toMatchObject({
    status: 'processing',
    attempt_count: 1,
    cancelled_at: null,
    finished_at: null,
  });
  expect(String(cancellationRequested.cancel_requested_at ?? '')).toMatch(
    /^\d{4}-\d{2}-\d{2}T/,
  );

  await expect(
    page.getByText(
      'Запрос отмены отправлен. Уже созданные результаты останутся доступны.',
    ),
  ).toBeVisible();
  await expect(processingCard.getByText('Статус: Обрабатывается')).toBeVisible();
  await expect(
    processingCard.getByText('Отмена запрошена', { exact: true }),
  ).toBeVisible();
  await expect(
    processingCard.getByRole('button', { name: 'Запросить отмену' }),
  ).toHaveCount(0);

  expect(integrationRequests).toHaveLength(1);
  expect(integrationRequests[0]).toMatch(
    /^POST http:\/\/127\.0\.0\.1:4173\/api\/jobs\/[0-9a-f-]{36}\/cancel$/,
  );
});

test('queued cancellation performs one bounded API mutation', async ({
  page,
}) => {
  const navigation = await login(page);
  await navigation.getByRole('button', { name: 'Проекты', exact: true }).click();

  const integrationRequests = trackExternalOrJobMutations(page);
  const progressResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().endsWith('/jobs/progress'),
  );
  await page
    .getByRole('button', { name: new RegExp(`^${RESULT_PROJECT}`) })
    .click();

  const progressResponse = await progressResponsePromise;
  expect(progressResponse.status()).toBe(200);
  const progressPayload = await progressResponse.json();
  const queuedProgress = progressPayload.jobs.find(
    (job: { job_status?: string }) => job.job_status === 'queued',
  );
  expect(queuedProgress).toMatchObject({
    job_status: 'queued',
    tracking_precision: 'checkpoint',
    completed_source_count: 0,
    total_source_count: 1,
    active_source_position: null,
    current_stage: null,
    sources: [
      {
        position: 0,
        name: 'browser-e2e-audio.mp3',
        status: 'queued',
        stages: [
          {
            key: 'preparation',
            status: 'pending',
            applicability: 'required',
          },
          {
            key: 'audio_extraction',
            status: 'not_applicable',
            applicability: 'not_applicable',
          },
          {
            key: 'splitting',
            status: 'pending',
            applicability: 'conditional',
          },
          {
            key: 'provider_processing',
            status: 'pending',
            applicability: 'required',
          },
          {
            key: 'part_merge',
            status: 'pending',
            applicability: 'conditional',
          },
          {
            key: 'google_docs_output',
            status: 'pending',
            applicability: 'required',
          },
        ],
      },
    ],
  });
  expect(queuedProgress.job_id).toMatch(/^[0-9a-f-]{36}$/);

  const progress = page.getByRole('region', {
    name: `Прогресс задачи ${queuedProgress.job_id}`,
  });
  await expect(progress.getByText('Готово файлов: 0 из 1')).toBeVisible();
  await expect(
    progress.getByText('Подготовка источника').locator('..'),
  ).toContainText('Ожидает');
  await expect(
    progress.getByText('Извлечение аудио').locator('..'),
  ).toContainText('Не требуется');
  await expect(
    progress.getByText('Транскрибация ElevenLabs').locator('..'),
  ).toContainText('Ожидает');
  await expect(
    progress.getByText('Создание Google Docs').locator('..'),
  ).toContainText('Ожидает');
  await expect(progress.getByText('Выполняется', { exact: true })).toHaveCount(
    0,
  );
  await expect(progress.getByText('Готово', { exact: true })).toHaveCount(0);
  await expect(progress.getByText('Проверено', { exact: true })).toHaveCount(0);

  const currentJobs = page.getByRole('region', { name: 'Текущие задачи' });
  const queuedCard = currentJobs
    .locator('article.source-card')
    .filter({ hasText: QUEUED_CANCELLATION_JOB })
    .first();
  await expect(queuedCard.getByText('Статус: В очереди')).toBeVisible();

  const cancelResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/cancel'),
  );
  await queuedCard.getByRole('button', { name: 'Отменить' }).click();

  const cancelResponse = await cancelResponsePromise;
  expect(cancelResponse.status()).toBe(200);
  const cancelled = await cancelResponse.json();
  expect(cancelled).toMatchObject({
    status: 'cancelled',
    attempt_count: 0,
    started_at: null,
    cancel_requested_at: null,
  });
  expect(String(cancelled.cancelled_at ?? '')).toMatch(
    /^\d{4}-\d{2}-\d{2}T/,
  );

  await expect(
    page.getByText(
      'Запрос отмены отправлен. Уже созданные результаты останутся доступны.',
    ),
  ).toBeVisible();
  await expect(
    currentJobs
      .locator('article.source-card')
      .filter({ hasText: QUEUED_CANCELLATION_JOB }),
  ).toHaveCount(0);
  await expect(currentJobs).toContainText(PROCESSING_CANCELLATION_JOB);

  await page.getByText('Недавние задачи · 5', { exact: true }).click();
  const cancelledCard = page
    .locator('article.source-card')
    .filter({ hasText: QUEUED_CANCELLATION_JOB })
    .first();
  await expect(cancelledCard.getByText('Статус: Отменена')).toBeVisible();
  await expect(
    cancelledCard.getByRole('button', { name: 'Отменить' }),
  ).toHaveCount(0);

  expect(integrationRequests).toHaveLength(1);
  expect(integrationRequests[0]).toMatch(
    /^POST http:\/\/127\.0\.0\.1:4173\/api\/jobs\/[0-9a-f-]{36}\/cancel$/,
  );
});

test('retry-safe provider rejection performs one explicit requeue mutation', async ({
  page,
}) => {
  const navigation = await login(page);
  await navigation.getByRole('button', { name: 'Проекты', exact: true }).click();
  await page
    .getByRole('button', { name: new RegExp(`^${RESULT_PROJECT}`) })
    .click();

  const recentJobs = page.locator('details.recent-jobs');
  await recentJobs.getByText(/^Недавние задачи · \d+$/).click();
  const retryCard = recentJobs
    .locator('article.source-card')
    .filter({ hasText: RETRY_SAFE_JOB })
    .first();
  await expect(retryCard.getByText('Статус: Ошибка')).toBeVisible();

  const integrationRequests = trackExternalOrJobMutations(page);
  const retryReadinessResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().endsWith('/retry'),
  );
  await retryCard.getByRole('button', { name: 'Открыть' }).click();

  const retryReadinessResponse = await retryReadinessResponsePromise;
  expect(retryReadinessResponse.status()).toBe(200);
  const retryReadiness = await retryReadinessResponse.json();
  expect(retryReadiness).toMatchObject({
    job_status: 'failed',
    available: true,
    reason: 'available',
    attempt_count: 1,
    max_attempts: 3,
    missing_output_count: 1,
    retry_safe_source_count: 1,
  });

  const retryAction = retryCard.locator('[aria-label="Safe retry action"]');
  const retryButton = retryAction.getByRole('button', {
    name: 'Повторить безопасную обработку',
  });
  await expect(retryButton).toBeVisible();
  expect(integrationRequests).toEqual([]);

  const retryMutationResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/retry'),
  );
  await retryButton.click();

  const retryMutationResponse = await retryMutationResponsePromise;
  expect(retryMutationResponse.status()).toBe(200);
  const queuedRetry = await retryMutationResponse.json();
  expect(queuedRetry).toMatchObject({
    job_status: 'queued',
    available: true,
    reason: 'available',
    attempt_count: 1,
    max_attempts: 3,
    missing_output_count: 0,
    retry_safe_source_count: 0,
  });

  const currentJobs = page.getByRole('region', { name: 'Текущие задачи' });
  const queuedRetryCard = currentJobs
    .locator('article.source-card')
    .filter({ hasText: RETRY_SAFE_JOB })
    .first();
  await expect(queuedRetryCard.getByText('Статус: В очереди')).toBeVisible();
  await expect(
    queuedRetryCard.getByRole('button', {
      name: 'Повторить безопасную обработку',
    }),
  ).toHaveCount(0);
  await expect(
    recentJobs
      .locator('article.source-card')
      .filter({ hasText: RETRY_SAFE_JOB }),
  ).toHaveCount(0);

  expect(integrationRequests).toHaveLength(1);
  expect(integrationRequests[0]).toMatch(
    /^POST http:\/\/127\.0\.0\.1:4173\/api\/jobs\/[0-9a-f-]{36}\/retry$/,
  );
});

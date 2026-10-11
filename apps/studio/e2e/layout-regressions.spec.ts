import { expect, test, type Page } from '@playwright/test';

const project = {id: 'synthetic-layout', title: 'Studio', description: '',
  created_at: '2026-10-11T12:00:00Z', updated_at: '2026-10-11T12:00:00Z', archived_at: null,
  output_drive_folder_id: null, output_drive_folder_url: null, output_drive_folder_name: null};
const history = Array.from({length: 12}, (_, index) => ({
  id: `synthetic-job-${index}`, project_id: project.id, status: 'completed', title: `Запись ${index + 1}`,
  provider: 'elevenlabs', source_count: 1, source_names: ['synthetic.wav'], sources: [],
  created_at: `2026-10-11T12:${String(index).padStart(2, '0')}:00Z`, updated_at: '2026-10-11T12:30:00Z',
  finished_at: '2026-10-11T12:30:00Z', started_at: null, cancelled_at: null, cancel_requested_at: null,
  terminal_dismissed_at: '2026-10-11T12:30:00Z', attempt_count: 1, error_code: null, error_message: null,
  primary_output_url: `https://docs.google.com/document/d/synthetic-${index}/edit`,
}));

async function fixtures(page: Page) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    let value: unknown = {ok: true};
    if (path === '/auth/session' || path === '/auth/csrf') value = {authenticated: true, csrf_token: 'synthetic-csrf', user: {email: 'layout@example.test', role: 'admin', accent_color: 'blue'}};
    else if (path === '/auth/bootstrap-status') value = {bootstrap_required: false};
    else if (path === '/projects') value = {projects: [project], next_cursor: null};
    else if (path === '/transcriptions/workspace') value = {project, created: false};
    else if (path.endsWith('/sources')) value = {sources: [], next_cursor: null};
    else if (path.endsWith('/jobs')) value = {jobs: history, next_cursor: null};
    else if (path === '/credentials') value = {credentials: [{id: 'synthetic-key', provider: 'elevenlabs', label: 'Тестовый ключ', status: 'active', masked_value: '••••1234', active_version: 1}]};
    else if (path === '/account/preferences') value = {source_retention_ttl_seconds: 259200, allowed_source_retention_ttl_seconds: [259200, 604800, 2592000], accent_color: 'blue', allowed_accent_colors: ['blue','violet','teal','rose']};
    else if (path === '/google/connection') value = {connected: true, status: 'active', email: 'layout@example.test', scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly'};
    else if (path === '/google/picker/session') value = {access_token: 'synthetic-token', api_key: 'synthetic-key', app_id: 'synthetic-id', scope_ready: true};
    else if (path === '/google/output-folder-favorites') value = {favorites: []};
    else if (path === '/stt/providers') value = {providers: [{provider: 'elevenlabs', display_name: 'ElevenLabs', byok_enabled: true, modes: [{mode: 'standard', model: 'scribe_v2', transport: 'batch', languages: ['ru','en','detect'], diarization: true, dictionaries: true, file_constraints: {max_bytes: 26214400, max_duration_seconds: 14400, audio_channels: [1,2]}, health: {available: true, consecutive_failures: 0, retry_after_seconds: null}}]}]};
    else if (path === '/stt/dictionaries') value = {dictionaries: []};
    else if (path.endsWith('/realtime/drafts/latest')) value = {draft: null};
    else if (path.endsWith('/audio-preparations')) value = {jobs: [{id: 'synthetic-audio', project_id: project.id, title: 'Сохранённая копия', status: 'completed', progress: {stage: 'completed', percent: 100}, source_ids: [], output: {download_ready: false, export_ready: false, source_id: null, google_drive_url: 'https://drive.google.com/file/d/synthetic-audio/view'}}]};
    else if (path === '/sources/upload-policy') value = {local_upload_enabled: true, max_upload_bytes: 536870912, multipart_threshold_bytes: 16777216, multipart_part_size_bytes: 8388608, supported_mime_prefixes: ['audio/','video/'], supported_mime_types: ['application/ogg']};
    else if (path.includes('/google/drive/folders/') && path.endsWith('/children')) value = {folder_id: 'root', items: Array.from({length: 12}, (_, index) => ({id: `synthetic-folder-${index}`, name: `Папка ${index}`, mime_type: 'application/vnd.google-apps.folder', size_bytes: null, web_view_link: null, created_time: null, modified_time: '2026-10-11T12:00:00Z', is_folder: true})), next_page_token: null};
    await route.fulfill({json: value});
  });
  // Fixtures never send external requests, even if an unexpected SDK path opens.
  await page.route(/^https:\/\/(?!127\.0\.0\.1)/, route => {
    const url = new URL(route.request().url());
    const headers = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization', 'access-control-allow-methods': 'GET, OPTIONS'};
    if (url.hostname === 'www.googleapis.com' && route.request().method() === 'OPTIONS')
      return route.fulfill({status: 204, headers});
    if (url.hostname === 'www.googleapis.com' && url.pathname.endsWith('/files/root'))
      return route.fulfill({headers, json: {id: 'synthetic-root', name: 'Мой диск', mimeType: 'application/vnd.google-apps.folder', capabilities: {canAddChildren: true}}});
    if (url.hostname === 'www.googleapis.com' && url.pathname.endsWith('/drives'))
      return route.fulfill({headers, json: {drives: []}});
    if (url.hostname === 'www.googleapis.com')
      return route.fulfill({headers, json: {files: Array.from({length: 12}, (_, index) => ({id: `synthetic-folder-${index}`, name: `Папка ${index}`, mimeType: 'application/vnd.google-apps.folder', modifiedTime: '2026-10-11T12:00:00Z', capabilities: {canAddChildren: true}}))}});
    return route.abort();
  });
}

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

for (const viewport of [{width: 1280, height: 720}, {width: 390, height: 844}]) {
  test(`layout overview history audio and menus ${viewport.width}`, async ({page}) => {
    await page.setViewportSize(viewport); await fixtures(page); await page.goto('/');
    const navigation = page.getByRole('navigation', {name: 'Основная навигация'});
    await expect(navigation).toBeVisible();
    await expect(page.locator('.dashboard-workspace-grid')).toBeVisible();
    await noHorizontalOverflow(page);
    if (viewport.width === 390) {
      const boxes = await page.locator('.dashboard-workspace-grid > article').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().x));
      expect(new Set(boxes.map(Math.round)).size).toBe(1);
    }
    await navigation.getByRole('button', {name: 'Транскрибации', exact: true}).click();
    const firstSource = page.getByRole('region', {name: 'Источник задачи 1'});
    await expect(firstSource).toBeVisible();
    const sourceBounds = await firstSource.boundingBox();
    expect(sourceBounds).not.toBeNull();
    expect(sourceBounds!.y + await page.evaluate(() => window.scrollY)).toBeLessThan(1100);
    await page.locator('.recent-jobs > summary').click();
    const search = page.getByLabel('Поиск по названию среди загруженных задач');
    await expect(search).toBeVisible();
    await expect(search).toBeEmpty();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.locator('.recent-jobs article[data-job-id]')).toHaveCount(10);
    await page.getByRole('button', {name: 'Следующая страница истории', exact: true}).click();
    await expect(page.locator('.recent-jobs article[data-job-id]')).toHaveCount(2);
    await search.fill('Запись 12');
    await expect(page.locator('article[data-job-id]')).toHaveCount(1);
    await expect(page.getByRole('link', {name: 'Открыть документ'})).toBeVisible();
    await search.clear();
    await expect(page.locator('.recent-jobs article[data-job-id]')).toHaveCount(10);
    await expect(page.getByRole('button', {name: 'Предыдущая страница истории', exact: true})).toBeDisabled();
    await noHorizontalOverflow(page);
    await navigation.getByRole('button', {name: 'Подготовка аудио', exact: true}).click();
    await expect(page.getByText(/Копия результата сохранена в Google Drive/)).toBeVisible();
    await expect(page.getByRole('link', {name: 'Открыть в Google Drive'})).toBeVisible();
    await expect(page.getByText(/Исходники больше недоступны/)).toHaveCount(0);
    const menu = page.getByRole('button', {name: 'Другие действия: Сохранённая копия'});
    await menu.click(); await expect(page.getByRole('menuitem', {name: 'Использовать в новой обработке'})).toBeFocused();
    const menuBounds = await page.getByRole('menu').boundingBox();
    expect(menuBounds!.x).toBeGreaterThanOrEqual(0);
    expect(menuBounds!.x + menuBounds!.width).toBeLessThanOrEqual(viewport.width);
    await page.keyboard.press('Escape'); await expect(menu).toBeFocused();
    await noHorizontalOverflow(page);
    await page.getByLabel('Автоматически сохранить копию в Google Drive').check();
    await page.getByRole('button', {name: 'Выбрать папку', exact: true}).click();
    const dialog = page.getByRole('dialog', {name: 'Выберите папку для результатов'});
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.height).toBeLessThanOrEqual(viewport.height);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    await dialog.getByRole('button', {name: 'Закрыть выбор папки', exact: true}).click();
    await expect(page.getByRole('button', {name: 'Выбрать папку', exact: true})).toBeFocused();
    await page.screenshot({path: `../../.tmp/goal-audio-${viewport.width}.png`, fullPage: true});
  });
}

test('a reset link is usable in an already authenticated browser without retaining the token in URL', async ({page}) => {
  await fixtures(page);
  const token = 'x'.repeat(43);
  await page.goto(`/#password-reset=${token}`);
  await expect(page.getByLabel('Новый пароль', {exact: true})).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await page.getByLabel('Новый пароль', {exact: true}).fill('Synthetic-new-password-123');
  await page.route('**/api/auth/password-reset/confirm', async route => {
    expect(route.request().postDataJSON()).toEqual({token, new_password: 'Synthetic-new-password-123'});
    await route.fulfill({json: {ok: true}});
  });
  await page.route('**/api/auth/session', route => route.fulfill({status: 401, json: {detail: 'Synthetic revoked session'}}));
  await page.getByRole('button', {name: 'Изменить пароль', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Войти', exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Забыли пароль?', exact: true})).toHaveCount(0);
  expect(await page.evaluate(() => window.location.hash)).toBe('');
});

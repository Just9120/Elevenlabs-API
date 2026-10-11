import { defineConfig } from '@playwright/test';
const layoutOnly = process.env.STUDIO_BROWSER_LAYOUT_ONLY === '1';
const browserPort = Number(process.env.STUDIO_BROWSER_PORT ?? 4173);
if (!Number.isInteger(browserPort) || browserPort < 1024 || browserPort > 65535) throw new Error('Invalid STUDIO_BROWSER_PORT');
const browserUrl = `http://127.0.0.1:${browserPort}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: layoutOnly ? '**/layout-regressions.spec.ts' : undefined,
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    baseURL: browserUrl,
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    ...(!layoutOnly ? [{
      command:
        'python -m uvicorn studio_api.main:app --app-dir apps/studio-api --host 127.0.0.1 --port 8000',
      cwd: '../..',
      url: 'http://127.0.0.1:8000/api/healthz',
      timeout: 30_000,
      reuseExistingServer: false,
    }] : []),
    {
      command: `npm run dev -- --port ${browserPort} --strictPort`,
      url: browserUrl,
      timeout: 30_000,
      reuseExistingServer: false,
    },
  ],
});

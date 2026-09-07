import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

config({ path: ['.env.local', '.env'] });

const PORT = Number(process.env.PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://cofresso:cofresso@localhost:5432/cofresso_test';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: process.env.PLAYWRIGHT_BASE_URL ? undefined : './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `pnpm start -p ${PORT}`,
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: { DATABASE_URL: TEST_DATABASE_URL, SITE_URL: baseURL, NODE_ENV: 'production' },
      },
});

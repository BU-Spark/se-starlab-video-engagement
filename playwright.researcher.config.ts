import { defineConfig, devices } from '@playwright/test';
import process from 'node:process';

const baseURL = 'http://127.0.0.1:' + (process.env.RESEARCHER_TEST_PORT || '3101');

export default defineConfig({
  testDir: './tests/researcher',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 30000,
  expect: { timeout: 10000 },
  outputDir: 'test-results/researcher/artifacts',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/researcher', open: 'never' }],
    ['junit', { outputFile: 'test-results/researcher/results.xml' }],
  ],
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    reducedMotion: 'reduce',
    channel: process.env.RESEARCHER_BROWSER_CHANNEL || undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/researcher-preview.mjs',
    env: { RESEARCHER_TEST_PORT: process.env.RESEARCHER_TEST_PORT || '3101' },
    url: baseURL + '/researcher/studies/new',
    timeout: 120000,
    reuseExistingServer: false,
  },
});

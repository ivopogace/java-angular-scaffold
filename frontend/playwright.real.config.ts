import { defineConfig, devices } from '@playwright/test';

// `localized` needs `npm run build` before `bootRun`, so :8080 serves the packaged `de` and `en` builds.
const LOCALIZED = '*.localized.real.e2e.ts';

export default defineConfig({
  testDir: './e2e/real-backend',
  testMatch: '*.e2e.ts',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: process.env['CI'] ? 'list' : 'line',
  use: { trace: 'on-first-retry' },
  projects: [
    {
      name: 'dev-server',
      testIgnore: LOCALIZED,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4200', locale: 'en-US' },
    },
    {
      name: 'localized',
      testMatch: LOCALIZED,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:8080', locale: 'de-DE' },
    },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    timeout: 120_000,
    reuseExistingServer: true,
  },
});

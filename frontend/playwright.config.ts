import { defineConfig, devices } from '@playwright/test';

// `npm start` serves only `en`, so specs assert English and the browser locale is pinned to `en-US`.
export default defineConfig({
  testDir: './e2e',
  testMatch: '*.e2e.ts',
  testIgnore: 'real-backend/**',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'list' : 'line',
  use: {
    baseURL: 'http://localhost:4200',
    locale: 'en-US',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    timeout: 120_000,
    reuseExistingServer: !process.env['CI'],
  },
});

import { defineConfig, devices } from '@playwright/test';

/**
 * Mocked e2e suite (`e2e/`): runs against the dev server with the API stubbed per spec, so it
 * needs no backend and is safe for CI. The real-backend suite is `playwright.real.config.ts`.
 *
 * Specs assert English text: `npm start` serves only the source locale (`en`), not the `de` build
 * users get by default. The browser locale is pinned to match.
 */
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

import { defineConfig, devices } from '@playwright/test';

/**
 * Real-backend e2e suite (`e2e/real-backend/`): drives a browser against a running full stack
 * (Spring Boot on :8080 and its database). Local only, not part of CI. Specs skip unless
 * `REAL_BACKEND=1`. The dev server proxies `/api` to the backend.
 *
 * Specs assert English text: `npm start` serves only the source locale (`en`), not the `de` build
 * users get by default. The browser locale is pinned to match.
 */
export default defineConfig({
  testDir: './e2e/real-backend',
  testMatch: '*.e2e.ts',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: 0,
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
    reuseExistingServer: true,
  },
});

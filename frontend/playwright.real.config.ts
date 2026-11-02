import { defineConfig, devices } from '@playwright/test';

/**
 * Real-backend e2e suite (`e2e/real-backend/`): drives a browser against a running full stack
 * (Spring Boot on :8080 and its database). Local only, not part of CI. Specs skip unless
 * `REAL_BACKEND=1`. Two projects:
 *
 * - `dev-server`: the `npm start` dev server on :4200, which proxies `/api` to the backend. It
 *   serves only the source locale (`en`), not the `de` build users get by default, so its specs
 *   assert English text with the browser locale pinned to `en-US` (browser-side defaults such as
 *   `navigator.language` and `Intl` without a locale then match on every machine).
 * - `localized` (`*.localized.real.e2e.ts`): Spring Boot itself on :8080, serving the production
 *   build (`de` and `en`) that `bootstrap` packaged; run `npm run build` before `bootRun`. Its
 *   browser locale is pinned to `de-DE`, the default users get.
 */
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

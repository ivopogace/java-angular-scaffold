import { expect, test } from '@playwright/test';

import { APP_NAME } from '../../src/app/shared/app-name/app-name';

test.skip(process.env['REAL_BACKEND'] !== '1', 'needs a running stack; set REAL_BACKEND=1');

test.beforeAll(async ({ request }) => {
  const shell = await request.get('/de/');
  expect(
    shell.status(),
    'Spring serves no /de/ build: run `npm run build` in frontend/, then restart bootRun',
  ).toBe(200);
});

test.describe('redirects by Accept-Language', () => {
  test('a request without a language preference goes to /de/', async ({ playwright, baseURL }) => {
    // A fresh context, so no Accept-Language from the project's browser locale is sent.
    const request = await playwright.request.newContext({ baseURL });
    const response = await request.get('/', { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    expect(new URL(response.headers()['location']!, baseURL).pathname).toBe('/de/');
    expect(response.headers()['vary']).toMatch(/Accept-Language/i);
    await request.dispose();
  });

  test('a German browser lands on /de/', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/de\/$/);
  });

  test('an English browser lands on the English build', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en-US' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page).toHaveURL(/\/en\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByText('Your application starts here.')).toBeVisible();
    await context.close();
  });
});

test('the German build renders German text', async ({ page }) => {
  await page.goto('/de/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.locator('mat-toolbar')).toContainText(APP_NAME);
  await expect(page.getByText('Hier beginnt Ihre Anwendung.')).toBeVisible();
  await expect(page).toHaveTitle(`Startseite · ${APP_NAME}`);
});

test('a deep link to a client route under /de/ loads the shell', async ({ page }) => {
  const response = await page.goto(`/de/e2e-no-such-page-${Date.now()}`);
  expect(response?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.locator('mat-toolbar')).toContainText(APP_NAME);
  await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible();
});

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { APP_NAME } from '../src/app/shared/app-name/app-name';

test('home shows the toolbar title', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('mat-toolbar')).toContainText(APP_NAME);
  await expect(page).toHaveTitle(`Home · ${APP_NAME}`);
});

test('an unknown route shows the not-found page', async ({ page }) => {
  await page.goto('/nowhere');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page).toHaveTitle(`Not found · ${APP_NAME}`);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} colour scheme`, () => {
    test.use({ colorScheme });

    test('home has no accessibility violations', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: APP_NAME })).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  });
}

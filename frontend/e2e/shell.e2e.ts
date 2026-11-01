import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('home shows the toolbar title', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('mat-toolbar')).toContainText('Scaffold Starter');
  await expect(page).toHaveTitle('Home · Scaffold Starter');
});

test('an unknown route shows the not-found page', async ({ page }) => {
  await page.goto('/nowhere');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page).toHaveTitle('Not found · Scaffold Starter');
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} colour scheme`, () => {
    test.use({ colorScheme });

    test('home has no accessibility violations', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Scaffold Starter' })).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  });
}

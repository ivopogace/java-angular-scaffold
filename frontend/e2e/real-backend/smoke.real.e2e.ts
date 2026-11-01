import { expect, test } from '@playwright/test';

test.skip(process.env['REAL_BACKEND'] !== '1', 'needs a running stack; set REAL_BACKEND=1');

test('the app loads against the running stack', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('mat-toolbar')).toContainText('Scaffold Starter');
});

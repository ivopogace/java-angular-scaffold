import { expect, test } from '@playwright/test';

import { APP_NAME } from '../../src/app/shared/app-name/app-name';

test.skip(process.env['REAL_BACKEND'] !== '1', 'needs a running stack; set REAL_BACKEND=1');

test('the app loads against the running stack', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('mat-toolbar')).toContainText(APP_NAME);
});

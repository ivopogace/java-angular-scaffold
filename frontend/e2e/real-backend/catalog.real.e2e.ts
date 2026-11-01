import { expect, test } from '@playwright/test';

test.skip(process.env['REAL_BACKEND'] !== '1', 'needs a running stack; set REAL_BACKEND=1');

test('a product can be created, published and retired', async ({ page }) => {
  const name = `E2E product ${Date.now()}`;

  await page.goto('/catalog/new');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Price').fill('9.99');
  await page.getByRole('button', { name: 'Create product' }).click();

  await expect(page).toHaveURL(/\/catalog$/);
  const row = page.getByRole('row', { name: new RegExp(name) });
  await expect(row).toContainText('€9.99');
  await expect(row).toContainText('Draft');

  await page.getByRole('button', { name: `Publish ${name}` }).click();
  await expect(row).toContainText('Published');

  await page.getByRole('button', { name: `Retire ${name}` }).click();
  await expect(row).toContainText('Retired');
});

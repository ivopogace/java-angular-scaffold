import { expect, test } from '@playwright/test';

test.skip(process.env['REAL_BACKEND'] !== '1', 'needs a running stack; set REAL_BACKEND=1');

test('the German catalog formats prices in German', async ({ page, request }) => {
  const name = `E2E Produkt ${Date.now()}`;
  const created = await request.post('/api/catalog/products', {
    data: { name, priceMinor: 123456, currency: 'EUR' },
  });
  expect(created.status()).toBe(201);

  await page.goto('/de/catalog');
  await expect(page.getByRole('heading', { name: 'Katalog' })).toBeVisible();
  const row = page.getByRole('row', { name: new RegExp(name) });
  await expect(row).toContainText('1.234,56 €');
  await expect(row).toContainText('Entwurf');
});

test('a deep link to a catalog route under /de/ loads it', async ({ page }) => {
  await page.goto('/de/catalog/new');
  await expect(page.getByRole('heading', { name: 'Neues Produkt' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Produkt anlegen' })).toBeVisible();
});

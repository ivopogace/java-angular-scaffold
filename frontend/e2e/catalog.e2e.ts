import AxeBuilder from '@axe-core/playwright';
import { expect, Page, Route, test } from '@playwright/test';

import { APP_NAME } from '../src/app/shared/app-name/app-name';

interface StubProduct {
  id: string;
  name: string;
  priceMinor: number | null;
  currency: string | null;
  state: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  publishedAt: string | null;
}

const MUG: StubProduct = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Mug',
  priceMinor: 1250,
  currency: 'EUR',
  state: 'DRAFT',
  publishedAt: null,
};
const POSTER: StubProduct = {
  id: '22222222-2222-2222-2222-222222222222',
  name: 'Poster',
  priceMinor: null,
  currency: null,
  state: 'PUBLISHED',
  publishedAt: '2030-01-14T12:00:00Z',
};

/** Stubs the catalog API over an in-memory list; `fail` answers publish with a 409 problem. */
async function stubCatalog(
  page: Page,
  initial: StubProduct[],
  fail?: { reason: string },
): Promise<void> {
  const products = [...initial];
  await page.route('**/api/catalog/**', async (route: Route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (request.method() === 'GET') {
      return route.fulfill({ json: products });
    }
    if (pathname.endsWith('/products')) {
      const body = request.postDataJSON() as {
        name: string;
        priceMinor?: number;
        currency?: string;
      };
      const created: StubProduct = {
        id: '33333333-3333-3333-3333-333333333333',
        name: body.name,
        priceMinor: body.priceMinor ?? null,
        currency: body.currency ?? null,
        state: 'DRAFT',
        publishedAt: null,
      };
      products.push(created);
      return route.fulfill({ status: 201, json: created });
    }
    if (fail) {
      return route.fulfill({
        status: 409,
        contentType: 'application/problem+json',
        json: { title: 'Conflict', status: 409, reason: fail.reason },
      });
    }
    return route.fulfill({ status: 404, json: {} });
  });
}

test('the list shows the stubbed products with price and state', async ({ page }) => {
  await stubCatalog(page, [MUG, POSTER]);
  await page.goto('/catalog');

  await expect(page).toHaveTitle(`Catalog · ${APP_NAME}`);
  const rows = page.getByRole('row');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(1)).toContainText('Mug');
  await expect(rows.nth(1)).toContainText('€12.50');
  await expect(rows.nth(1)).toContainText('Draft');
  await expect(rows.nth(2)).toContainText('Poster');
  await expect(rows.nth(2)).toContainText('No price');
  await expect(rows.nth(2)).toContainText('Published');
});

test('an empty catalog says so', async ({ page }) => {
  await stubCatalog(page, []);
  await page.goto('/catalog');

  await expect(page.getByText('No products yet.')).toBeVisible();
});

test('the toolbar links to the catalog', async ({ page }) => {
  await stubCatalog(page, [MUG]);
  await page.goto('/');
  await page.getByRole('link', { name: 'Catalog' }).click();

  await expect(page.getByRole('heading', { name: 'Catalog' })).toBeVisible();
});

test('creating a product lands on the list with the new product', async ({ page }) => {
  await stubCatalog(page, [MUG]);
  await page.goto('/catalog');
  await page.getByRole('link', { name: 'New product' }).click();

  await expect(page).toHaveTitle(`New product · ${APP_NAME}`);
  await page.getByLabel('Name').fill('Sticker');
  await page.getByLabel('Price').fill('2.5');
  await page.getByRole('button', { name: 'Create product' }).click();

  await expect(page).toHaveURL(/\/catalog$/);
  const sticker = page.getByRole('row', { name: /Sticker/ });
  await expect(sticker).toContainText('€2.50');
  await expect(sticker).toContainText('Draft');
});

test('the form refuses a blank name and a three-decimal price', async ({ page }) => {
  await stubCatalog(page, []);
  await page.goto('/catalog/new');
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page.getByText('Enter a name.')).toBeVisible();

  await page.getByLabel('Name').fill('Mug');
  await page.getByLabel('Price').fill('12.345');
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page.getByText('Enter an amount such as 12.50.')).toBeVisible();
  await expect(page).toHaveURL(/\/catalog\/new$/);
});

test('publishing without a price shows the conflict message', async ({ page }) => {
  await stubCatalog(page, [{ ...POSTER, state: 'DRAFT', publishedAt: null }], {
    reason: 'NO_PRICE',
  });
  await page.goto('/catalog');
  await page.getByRole('button', { name: 'Publish Poster' }).click();

  await expect(page.getByText('Add a price before publishing.')).toBeVisible();
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} colour scheme`, () => {
    test.use({ colorScheme });

    test('the list has no accessibility violations', async ({ page }) => {
      await stubCatalog(page, [MUG, POSTER]);
      await page.goto('/catalog');
      await expect(page.getByRole('row')).toHaveCount(3);

      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });

    test('the form has no accessibility violations', async ({ page }) => {
      await stubCatalog(page, []);
      await page.goto('/catalog/new');
      await page.getByRole('button', { name: 'Create product' }).click();
      await expect(page.getByText('Enter a name.')).toBeVisible();

      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  });
}

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { expectNoAxeViolations } from '../../../testing/axe';
import { Product } from '../catalog.model';
import { ProductList } from './product-list';

const LIST_URL = '/api/catalog/products';

const MUG: Product = {
  id: 'p1',
  name: 'Mug',
  priceMinor: 1250,
  currency: 'EUR',
  state: 'DRAFT',
  publishedAt: null,
};
const POSTER: Product = {
  id: 'p2',
  name: 'Poster',
  priceMinor: null,
  currency: null,
  state: 'DRAFT',
  publishedAt: null,
};
const SHIRT: Product = {
  id: 'p3',
  name: 'Shirt',
  priceMinor: 2000,
  currency: 'EUR',
  state: 'PUBLISHED',
  publishedAt: '2030-01-14T12:00:00Z',
};

describe('ProductList', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<ProductList>;

  /** Sends the list request the resource has queued, answers it and renders the result. */
  async function flushList(products: Product[]): Promise<void> {
    TestBed.tick();
    http.expectOne(LIST_URL).flush(products);
    await TestBed.inject(ApplicationRef).whenStable();
    fixture.detectChanges();
  }

  function create(): void {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProductList);
    fixture.detectChanges();
  }

  async function render(products: Product[]): Promise<HTMLElement> {
    create();
    await flushList(products);
    return fixture.nativeElement as HTMLElement;
  }

  function rows(element: HTMLElement): string[][] {
    return Array.from(element.querySelectorAll('tr[mat-row]')).map((row) =>
      Array.from(row.querySelectorAll('td')).map((cell) => (cell.textContent ?? '').trim()),
    );
  }

  function button(element: HTMLElement, label: string): HTMLButtonElement {
    const found = element.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    if (!found) {
      throw new Error(`no button "${label}"`);
    }
    return found;
  }

  afterEach(() => http.verify());

  it('renders a row per product with the formatted price and state', async () => {
    const element = await render([MUG, POSTER, SHIRT]);

    expect(rows(element)).toEqual([
      ['Mug', '€12.50', 'Draft', 'Publish'],
      ['Poster', 'No price', 'Draft', 'Publish'],
      ['Shirt', '€20.00', 'Published', 'Retire'],
    ]);
  });

  it('says so when there are no products', async () => {
    const element = await render([]);

    expect(element.textContent).toContain('No products yet.');
    expect(element.querySelector('table')).toBeNull();
  });

  it('shows an error when the list cannot be loaded', async () => {
    create();
    TestBed.tick();
    http.expectOne(LIST_URL).flush(null, { status: 500, statusText: 'Server Error' });
    await TestBed.inject(ApplicationRef).whenStable();
    fixture.detectChanges();

    const alert = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Could not load products.');
  });

  it('publishes a draft and refreshes the list', async () => {
    const element = await render([MUG]);

    button(element, 'Publish Mug').click();
    http.expectOne(`${LIST_URL}/p1/publish`).flush({ ...MUG, state: 'PUBLISHED' });
    await flushList([{ ...MUG, state: 'PUBLISHED' }]);

    expect(rows(element)).toEqual([['Mug', '€12.50', 'Published', 'Retire']]);
  });

  it('retires a published product and refreshes the list', async () => {
    const element = await render([SHIRT]);

    button(element, 'Retire Shirt').click();
    http.expectOne(`${LIST_URL}/p3/retire`).flush({ ...SHIRT, state: 'RETIRED' });
    await flushList([{ ...SHIRT, state: 'RETIRED' }]);

    expect(rows(element)).toEqual([['Shirt', '€20.00', 'Retired', '']]);
  });

  it.each([
    ['NO_PRICE', 'Add a price before publishing.'],
    ['NOT_DRAFT', 'Only draft products can be published.'],
    ['NOT_PUBLISHED', 'Only published products can be retired.'],
  ])('explains a %s conflict in a snackbar', async (reason, message) => {
    const element = await render([POSTER]);

    button(element, 'Publish Poster').click();
    http
      .expectOne(`${LIST_URL}/p2/publish`)
      .flush({ reason }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(document.body.textContent).toContain(message);
  });

  it('falls back to a generic message for other failures', async () => {
    const element = await render([MUG]);

    button(element, 'Publish Mug').click();
    http
      .expectOne(`${LIST_URL}/p1/publish`)
      .flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(document.body.textContent).toContain('Something went wrong. Try again.');
  });

  it('has no accessibility violations', async () => {
    await expectNoAxeViolations(await render([MUG, POSTER, SHIRT]));
  });

  it('has no accessibility violations when empty', async () => {
    await expectNoAxeViolations(await render([]));
  });
});

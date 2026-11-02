import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HarnessLoader, manualChangeDetection } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatSnackBarHarness } from '@angular/material/snack-bar/testing';
import { MatTableHarness } from '@angular/material/table/testing';
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

/*
 * `whenStable()`, and so every harness call, waits for open HTTP requests. While a request is
 * still unanswered the specs render with `TestBed.tick()` and drive harnesses inside
 * `manualChangeDetection`; once it is flushed they wait with `fixture.whenStable()`.
 */
describe('ProductList', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<ProductList>;
  let loader: HarnessLoader;

  function create(): void {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProductList);
    loader = TestbedHarnessEnvironment.loader(fixture);
  }

  /** Renders, which sends the list request the resource has queued, then answers it. */
  async function flushList(products: Product[]): Promise<void> {
    TestBed.tick();
    http.expectOne(LIST_URL).flush(products);
    await fixture.whenStable();
  }

  async function render(products: Product[]): Promise<HTMLElement> {
    create();
    await flushList(products);
    return fixture.nativeElement as HTMLElement;
  }

  async function rows(): Promise<string[][]> {
    return (await loader.getHarness(MatTableHarness)).getCellTextByIndex();
  }

  function button(label: string): Promise<MatButtonHarness> {
    return loader.getHarness(MatButtonHarness.with({ selector: `[aria-label="${label}"]` }));
  }

  /** Clicks a button whose request stays open, so the click must not wait for stability. */
  function clickSendingRequest(target: MatButtonHarness): Promise<void> {
    return manualChangeDetection(() => target.click());
  }

  async function snackBarMessage(): Promise<string> {
    const rootLoader = TestbedHarnessEnvironment.documentRootLoader(fixture);
    return (await rootLoader.getHarness(MatSnackBarHarness)).getMessage();
  }

  afterEach(() => http.verify());

  it('renders a row per product with the formatted price and state', async () => {
    await render([MUG, POSTER, SHIRT]);

    expect(await rows()).toEqual([
      ['Mug', '€12.50', 'Draft', 'Publish'],
      ['Poster', 'No price', 'Draft', 'Publish'],
      ['Shirt', '€20.00', 'Published', 'Retire'],
    ]);
  });

  it('says so when there are no products', async () => {
    const element = await render([]);

    expect(element.textContent).toContain('No products yet.');
    expect(await loader.getHarnessOrNull(MatTableHarness)).toBeNull();
  });

  it('shows an error when the list cannot be loaded', async () => {
    create();
    TestBed.tick();
    http.expectOne(LIST_URL).flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    const alert = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Could not load products.');
  });

  it('publishes a draft and refreshes the list', async () => {
    await render([MUG]);

    await clickSendingRequest(await button('Publish Mug'));
    http.expectOne(`${LIST_URL}/p1/publish`).flush({ ...MUG, state: 'PUBLISHED' });
    await flushList([{ ...MUG, state: 'PUBLISHED' }]);

    expect(await rows()).toEqual([['Mug', '€12.50', 'Published', 'Retire']]);
  });

  it('sends one request for a double click and disables the action until it settles', async () => {
    await render([POSTER]);
    const publish = await button('Publish Poster');

    await manualChangeDetection(async () => {
      await publish.click();
      await publish.click();
      TestBed.tick();
      expect(await publish.isDisabled()).toBe(true);
    });
    http
      .expectOne(`${LIST_URL}/p2/publish`)
      .flush({ reason: 'NO_PRICE' }, { status: 409, statusText: 'Conflict' });

    expect(await publish.isDisabled()).toBe(false);
  });

  it('re-enables the action once a successful change has settled', async () => {
    await render([MUG]);
    const publish = await button('Publish Mug');

    await manualChangeDetection(async () => {
      await publish.click();
      TestBed.tick();
      expect(await publish.isDisabled()).toBe(true);

      http.expectOne(`${LIST_URL}/p1/publish`).flush({ ...MUG, state: 'PUBLISHED' });
      TestBed.tick();
      expect(await publish.isDisabled()).toBe(false);
    });

    await flushList([{ ...MUG, state: 'PUBLISHED' }]);
    expect(await (await button('Retire Mug')).isDisabled()).toBe(false);
  });

  it('retires a published product and refreshes the list', async () => {
    await render([SHIRT]);

    await clickSendingRequest(await button('Retire Shirt'));
    http.expectOne(`${LIST_URL}/p3/retire`).flush({ ...SHIRT, state: 'RETIRED' });
    await flushList([{ ...SHIRT, state: 'RETIRED' }]);

    expect(await rows()).toEqual([['Shirt', '€20.00', 'Retired', '']]);
  });

  it.each([
    ['NO_PRICE', 'Add a price before publishing.'],
    ['NOT_DRAFT', 'Only draft products can be published.'],
    ['NOT_PUBLISHED', 'Only published products can be retired.'],
  ])('explains a %s conflict in a snackbar', async (reason, message) => {
    await render([POSTER]);

    await clickSendingRequest(await button('Publish Poster'));
    http
      .expectOne(`${LIST_URL}/p2/publish`)
      .flush({ reason }, { status: 409, statusText: 'Conflict' });

    expect(await snackBarMessage()).toBe(message);
  });

  it('falls back to a generic message for other failures', async () => {
    await render([MUG]);

    await clickSendingRequest(await button('Publish Mug'));
    http
      .expectOne(`${LIST_URL}/p1/publish`)
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(await snackBarMessage()).toBe('Something went wrong. Try again.');
  });

  it('has no accessibility violations', async () => {
    await expectNoAxeViolations(await render([MUG, POSTER, SHIRT]));
  });

  it('has no accessibility violations when empty', async () => {
    await expectNoAxeViolations(await render([]));
  });
});

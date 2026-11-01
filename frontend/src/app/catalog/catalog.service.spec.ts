import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Product } from './catalog.model';
import { CatalogService } from './catalog.service';

const LIST_URL = '/api/catalog/products';

const DRAFT: Product = {
  id: 'p1',
  name: 'Mug',
  priceMinor: 1250,
  currency: 'EUR',
  state: 'DRAFT',
  publishedAt: null,
};

describe('CatalogService', () => {
  let http: HttpTestingController;
  let service: CatalogService;

  /** Sends the list request the resource has queued and answers it. */
  async function flushList(products: Product[]): Promise<void> {
    TestBed.tick();
    http.expectOne(LIST_URL).flush(products);
    await TestBed.inject(ApplicationRef).whenStable();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(CatalogService);
    await flushList([DRAFT]);
  });

  afterEach(() => http.verify());

  it('loads the products from the API', () => {
    expect(service.products.value()).toEqual([DRAFT]);
  });

  it('posts a new product and refreshes the list', async () => {
    const request = { name: 'Mug', priceMinor: 1250, currency: 'EUR' };
    let created: Product | undefined;
    service.create(request).subscribe((product) => (created = product));

    const post = http.expectOne(LIST_URL);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(request);
    post.flush(DRAFT, { status: 201, statusText: 'Created' });
    await flushList([DRAFT, { ...DRAFT, id: 'p2' }]);

    expect(created).toEqual(DRAFT);
    expect(service.products.value()).toHaveLength(2);
  });

  it('publishes a product and refreshes the list', async () => {
    service.publish('p1').subscribe();

    const post = http.expectOne(`${LIST_URL}/p1/publish`);
    expect(post.request.method).toBe('POST');
    post.flush({ ...DRAFT, state: 'PUBLISHED' });
    await flushList([{ ...DRAFT, state: 'PUBLISHED' }]);

    expect(service.products.value()?.[0].state).toBe('PUBLISHED');
  });

  it('retires a product and refreshes the list', async () => {
    service.retire('p1').subscribe();

    const post = http.expectOne(`${LIST_URL}/p1/retire`);
    expect(post.request.method).toBe('POST');
    post.flush({ ...DRAFT, state: 'RETIRED' });
    await flushList([{ ...DRAFT, state: 'RETIRED' }]);

    expect(service.products.value()?.[0].state).toBe('RETIRED');
  });

  it('does not refresh the list when a change fails', () => {
    let status: number | undefined;
    service.publish('p1').subscribe({ error: (e) => (status = e.status) });

    http
      .expectOne(`${LIST_URL}/p1/publish`)
      .flush({ reason: 'NO_PRICE' }, { status: 409, statusText: 'Conflict' });
    TestBed.tick();

    expect(status).toBe(409);
  });

  it('reloads the list on demand', async () => {
    service.reload();
    await flushList([]);

    expect(service.products.value()).toEqual([]);
  });
});

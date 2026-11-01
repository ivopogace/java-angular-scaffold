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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(CatalogService);
  });

  afterEach(() => http.verify());

  it('loads nothing until a component asks for the list', () => {
    TestBed.tick();

    http.expectNone(LIST_URL);
  });

  it('refuses to create the list resource outside an injection context', () => {
    expect(() => service.loadProducts()).toThrowError(/loadProducts/);
  });

  it('gives a component a list resource that loads the products', async () => {
    const products = TestBed.runInInjectionContext(() => service.loadProducts());
    TestBed.tick();

    http.expectOne(LIST_URL).flush([DRAFT]);
    await TestBed.inject(ApplicationRef).whenStable();

    expect(products.value()).toEqual([DRAFT]);
  });

  it('posts a new product', () => {
    const request = { name: 'Mug', priceMinor: 1250, currency: 'EUR' };
    let created: Product | undefined;
    service.create(request).subscribe((product) => (created = product));

    const post = http.expectOne(LIST_URL);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(request);
    post.flush(DRAFT, { status: 201, statusText: 'Created' });

    expect(created).toEqual(DRAFT);
  });

  it('publishes a product', () => {
    let published: Product | undefined;
    service.publish('p1').subscribe((product) => (published = product));

    const post = http.expectOne(`${LIST_URL}/p1/publish`);
    expect(post.request.method).toBe('POST');
    post.flush({ ...DRAFT, state: 'PUBLISHED' });

    expect(published?.state).toBe('PUBLISHED');
  });

  it('retires a product', () => {
    let retired: Product | undefined;
    service.retire('p1').subscribe((product) => (retired = product));

    const post = http.expectOne(`${LIST_URL}/p1/retire`);
    expect(post.request.method).toBe('POST');
    post.flush({ ...DRAFT, state: 'RETIRED' });

    expect(retired?.state).toBe('RETIRED');
  });

  it('surfaces a rejected change as an error', () => {
    let status: number | undefined;
    service.publish('p1').subscribe({ error: (e: { status: number }) => (status = e.status) });

    http
      .expectOne(`${LIST_URL}/p1/publish`)
      .flush({ reason: 'NO_PRICE' }, { status: 409, statusText: 'Conflict' });

    expect(status).toBe(409);
  });
});

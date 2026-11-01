import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { expectNoAxeViolations } from '../../../testing/axe';
import { ProductForm } from './product-form';

const LIST_URL = '/api/catalog/products';

describe('ProductForm', () => {
  let http: HttpTestingController;
  let router: Router;
  let fixture: ComponentFixture<ProductForm>;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(ProductForm);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  /** The catalog service's own list request is not what these specs are about. */
  function answerListRequest(): void {
    TestBed.tick();
    http
      .match((request) => request.method === 'GET' && request.url === LIST_URL)
      .forEach((request) => request.flush([]));
  }

  /** Answers the list requests in flight, since a pending request keeps the app unstable. */
  async function settle(): Promise<void> {
    answerListRequest();
    await TestBed.inject(ApplicationRef).whenStable();
  }

  afterEach(() => {
    answerListRequest();
    http.verify();
  });

  function input(label: string): HTMLInputElement {
    const found = Array.from(element.querySelectorAll('mat-form-field')).find((field) =>
      field.querySelector('mat-label')?.textContent?.includes(label),
    );
    const control = found?.querySelector('input');
    if (!control) {
      throw new Error(`no field "${label}"`);
    }
    return control;
  }

  function type(label: string, text: string): void {
    const control = input(label);
    control.value = text;
    control.dispatchEvent(new Event('input'));
    control.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  async function submit(): Promise<void> {
    element.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  }

  function errors(): string {
    return Array.from(element.querySelectorAll('mat-error'))
      .map((error) => (error.textContent ?? '').trim())
      .join(' | ');
  }

  function expectPost(): ReturnType<HttpTestingController['expectOne']> {
    return http.expectOne((request) => request.method === 'POST' && request.url === LIST_URL);
  }

  function expectNoPost(): void {
    http.expectNone((request) => request.method === 'POST');
  }

  it('rejects a blank name without calling the API', async () => {
    type('Name', '   ');
    await submit();

    expect(errors()).toContain('Enter a name.');
    expectNoPost();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('rejects a price with more than two decimals', async () => {
    type('Name', 'Mug');
    type('Price', '12.345');
    await submit();

    expect(errors()).toContain('Enter an amount such as 12.50.');
    expectNoPost();
  });

  it('rejects a name longer than the API allows', async () => {
    type('Name', 'x'.repeat(121));
    await submit();

    expect(errors()).toContain('Use at most 120 characters.');
    expectNoPost();
  });

  it('submits the name and the price in minor units, then returns to the list', async () => {
    type('Name', ' Mug ');
    type('Price', '12.50');
    await submit();

    const post = expectPost();
    expect(post.request.body).toEqual({ name: 'Mug', priceMinor: 1250, currency: 'EUR' });
    post.flush({}, { status: 201, statusText: 'Created' });
    await settle();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/catalog');
  });

  it('accepts a decimal comma', async () => {
    type('Name', 'Mug');
    type('Price', '12,5');
    await submit();

    const post = expectPost();
    expect(post.request.body).toEqual({ name: 'Mug', priceMinor: 1250, currency: 'EUR' });
    post.flush({}, { status: 201, statusText: 'Created' });
  });

  it('creates a draft without a price when the price is left blank', async () => {
    type('Name', 'Poster');
    await submit();

    const post = expectPost();
    expect(post.request.body).toEqual({ name: 'Poster' });
    post.flush({}, { status: 201, statusText: 'Created' });
  });

  it('stays on the form and says so when the API rejects the product', async () => {
    type('Name', 'Mug');
    await submit();

    expectPost().flush({}, { status: 400, statusText: 'Bad Request' });
    await settle();

    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Could not save the product. Try again.');
  });

  it('has no accessibility violations', async () => {
    await expectNoAxeViolations(element);
  });

  it('has no accessibility violations while showing errors', async () => {
    type('Name', '');
    type('Price', 'abc');
    await submit();

    expect(errors()).not.toBe('');
    await expectNoAxeViolations(element);
  });
});

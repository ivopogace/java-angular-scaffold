import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HarnessLoader, parallel } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatSnackBarHarness } from '@angular/material/snack-bar/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { expectNoAxeViolations } from '../../../testing/axe';
import { ProductForm } from './product-form';

const LIST_URL = '/api/catalog/products';
const FORM_PATH = '/catalog/new';

@Component({ template: '' })
class ListStub {}

/*
 * Under `provideHttpClientTesting()` an open `HttpClient` request is no pending task, so harness
 * calls do not wait for the POST. Nor is a Signal Forms submission: what follows the answer
 * (re-enabling the button, the snackbar, the navigation) is polled for.
 */
describe('ProductForm', () => {
  let http: HttpTestingController;
  let router: RouterTestingHarness;
  let loader: HarnessLoader;
  let element: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'catalog', component: ListStub },
          { path: 'catalog/new', component: ProductForm },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = await RouterTestingHarness.create(FORM_PATH);
    loader = TestbedHarnessEnvironment.loader(router.fixture);
    element = router.routeNativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  function field(label: string): Promise<MatFormFieldHarness> {
    return loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: label }));
  }

  async function type(label: string, text: string): Promise<void> {
    const input = await (await field(label)).getControl(MatInputHarness);
    if (!input) {
      throw new Error(`no input in field "${label}"`);
    }
    await input.setValue(text);
    await input.blur();
  }

  function submitButton(): Promise<MatButtonHarness> {
    return loader.getHarness(MatButtonHarness.with({ text: 'Create product' }));
  }

  async function submit(): Promise<void> {
    await (await submitButton()).click();
  }

  async function errors(): Promise<string> {
    const fields = await loader.getAllHarnesses(MatFormFieldHarness);
    const texts = await parallel(() => fields.map((f) => f.getTextErrors()));
    return texts.flat().join(' | ');
  }

  function expectPost(): ReturnType<HttpTestingController['expectOne']> {
    return http.expectOne((request) => request.method === 'POST' && request.url === LIST_URL);
  }

  function expectNoPost(): void {
    http.expectNone((request) => request.method === 'POST');
  }

  function url(): string {
    return TestBed.inject(Router).url;
  }

  it('does not load the product list', () => {
    http.expectNone((request) => request.method === 'GET');
  });

  it('rejects a blank name without calling the API', async () => {
    await type('Name', '   ');
    await submit();

    expect(await errors()).toContain('Enter a name.');
    expectNoPost();
    expect(url()).toBe(FORM_PATH);
  });

  it('rejects a price with more than two decimals', async () => {
    await type('Name', 'Mug');
    await type('Price', '12.345');
    await submit();

    expect(await errors()).toContain('Enter an amount such as 12.50.');
    expectNoPost();
  });

  it('rejects a name longer than the API allows', async () => {
    await type('Name', 'x'.repeat(121));
    await submit();

    expect(await errors()).toContain('Use at most 120 characters.');
    expectNoPost();
  });

  it('submits the name and the price in minor units, then returns to the list', async () => {
    await type('Name', ' Mug ');
    await type('Price', '12.50');
    await submit();

    const post = expectPost();
    expect(post.request.body).toEqual({ name: 'Mug', priceMinor: 1250, currency: 'EUR' });
    post.flush({}, { status: 201, statusText: 'Created' });

    await expect.poll(url).toBe('/catalog');
  });

  it('accepts a decimal comma', async () => {
    await type('Name', 'Mug');
    await type('Price', '12,5');
    await submit();

    const post = expectPost();
    expect(post.request.body).toEqual({ name: 'Mug', priceMinor: 1250, currency: 'EUR' });
    post.flush({}, { status: 201, statusText: 'Created' });
  });

  it('creates a draft without a price when the price is left blank', async () => {
    await type('Name', 'Poster');
    await submit();

    const post = expectPost();
    expect(post.request.body).toEqual({ name: 'Poster' });
    post.flush({}, { status: 201, statusText: 'Created' });
  });

  it('disables the submit button while the request is in flight', async () => {
    await type('Name', 'Mug');
    await submit();
    const button = await submitButton();

    expect(await button.isDisabled()).toBe(true);
    expectPost().flush({}, { status: 400, statusText: 'Bad Request' });

    await expect.poll(() => button.isDisabled()).toBe(false);
  });

  it('stays on the form and says so when the API rejects the product', async () => {
    await type('Name', 'Mug');
    await submit();

    expectPost().flush({}, { status: 400, statusText: 'Bad Request' });

    const rootLoader = TestbedHarnessEnvironment.documentRootLoader(router.fixture);
    const snackBar = await rootLoader.getHarness(MatSnackBarHarness);
    expect(await snackBar.getMessage()).toBe('Could not save the product. Try again.');
    expect(url()).toBe(FORM_PATH);
  });

  it('has no accessibility violations', async () => {
    await expectNoAxeViolations(element);
  });

  it('has no accessibility violations while showing errors', async () => {
    await type('Name', '');
    await type('Price', 'abc');
    await submit();

    expect(await errors()).not.toBe('');
    await expectNoAxeViolations(element);
  });
});

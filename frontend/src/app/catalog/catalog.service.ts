import { HttpClient, HttpResourceRef, httpResource } from '@angular/common/http';
import { assertInInjectionContext, inject, Service } from '@angular/core';
import { Observable } from 'rxjs';

import { CreateProductRequest, Product } from './catalog.model';

const PRODUCTS_URL = '/api/catalog/products';

@Service()
export class CatalogService {
  private readonly http = inject(HttpClient);

  /** Call from a component's field initializer, so the request lives and ends with it; reload after a change. */
  loadProducts(): HttpResourceRef<Product[] | undefined> {
    assertInInjectionContext(this.loadProducts);
    return httpResource<Product[]>(() => PRODUCTS_URL);
  }

  create(request: CreateProductRequest): Observable<Product> {
    return this.http.post<Product>(PRODUCTS_URL, request);
  }

  publish(id: string): Observable<Product> {
    return this.http.post<Product>(`${PRODUCTS_URL}/${encodeURIComponent(id)}/publish`, null);
  }

  retire(id: string): Observable<Product> {
    return this.http.post<Product>(`${PRODUCTS_URL}/${encodeURIComponent(id)}/retire`, null);
  }
}

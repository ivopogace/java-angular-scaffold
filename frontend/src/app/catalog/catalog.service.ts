import { HttpClient, HttpResourceRef, httpResource } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';

import { CreateProductRequest, Product } from './catalog.model';

const PRODUCTS_URL = '/api/catalog/products';

/** The catalog REST API. Nothing is requested until a component asks. */
@Service()
export class CatalogService {
  private readonly http = inject(HttpClient);

  /**
   * A resource over the product list. Call it from a component's field initializer, so the
   * request starts with that component and ends with it; reload it after a change.
   */
  loadProducts(): HttpResourceRef<Product[] | undefined> {
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
